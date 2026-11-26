// Verificação de saúde (todo dia 7h e sob demanda: /api/jobs/run?job=health&key=...).
// Testa cada elo da cadeia Hostinger → Meta Ads → ViaZapi/Chatwoot → WhatsApp e corrige sozinho o que dá:
// sincroniza modelos no Chatwoot, limpa trava velha do agendador e bloqueios vencidos.
// Resultado: lista de itens { area, nome, nivel: ok|aviso|erro, detalhe, corrigido? } + resumo de uma linha.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './paths.mjs';
import * as meta from './meta.mjs';
import { htmlToPdf } from './pdf.mjs';
import { chatwoot, inboxPath, accountPath, recipients, guardStatus, publishFile } from './whatsapp.mjs';
import { verifyEmail, emailRecipients } from './email.mjs';

const G = 'https://graph.facebook.com/v23.0';
const NEEDED = [...Array.from({ length: 10 }, (_, i) => `diario_sincerus_${i + 1}`), 'relatorio_sincerus', 'alerta_sincerus'];
const fmt = (ms) => new Date(ms).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const graphGet = async (p, token) => {
  const r = await fetch(`${G}/${p}${p.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (j.error) throw new Error(`${j.error.message} (código ${j.error.code})`);
  return j;
};

export async function healthCheck({ readState, writeState, logFile } = {}) {
  const items = [];
  const add = (area, nome, nivel, detalhe, corrigido) => items.push({ area, nome, nivel, detalhe, ...(corrigido ? { corrigido } : {}) });
  const step = async (area, nome, fn) => { try { await fn(); } catch (e) { add(area, nome, 'erro', e.message.slice(0, 200)); } };

  // ---------- Hostinger ----------
  await step('Servidor', 'Pasta de dados', async () => {
    const f = path.join(DATA_DIR, '.write-test'); fs.writeFileSync(f, 'ok'); fs.rmSync(f);
    add('Servidor', 'Pasta de dados', 'ok', 'gravação ok');
  });
  await step('Servidor', 'Agendador (Cron)', async () => {
    const st = readState?.() || {};
    const last = st.lastTickAt || 0;
    if (!last) add('Servidor', 'Agendador (Cron)', 'aviso', 'ainda sem registro de execução');
    else if (Date.now() - last > 20 * 60000) add('Servidor', 'Agendador (Cron)', 'erro', `última execução em ${fmt(last)} — confira o Cron Job da Hostinger`);
    else add('Servidor', 'Agendador (Cron)', 'ok', `última execução ${fmt(last)}`);
    const lock = path.join(DATA_DIR, 'tick.lock');
    if (fs.existsSync(lock) && Date.now() - fs.statSync(lock).mtimeMs > 20 * 60000) { fs.rmSync(lock, { force: true }); add('Servidor', 'Trava do agendador', 'aviso', 'trava antiga de um processo que caiu', 'removida'); }
  });
  await step('Servidor', 'Geração de PDF', async () => {
    const t = Date.now();
    const pdf = await htmlToPdf('<!doctype html><html><body><p>teste</p></body></html>');
    if (!pdf?.length) throw new Error('PDF vazio');
    add('Servidor', 'Geração de PDF', 'ok', `${Math.round((Date.now() - t) / 1000)}s`);
  });
  await step('Servidor', 'Link público dos PDFs', async () => {
    const { url } = publishFile(Buffer.from('%PDF-1.4\n%teste\n'), 'teste-saude.pdf');
    if (!url) throw new Error('PUBLIC_URL não configurado: o WhatsApp não consegue baixar os PDFs');
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`${url.split('/files/')[0]}/files/… respondeu ${r.status}`);
    add('Servidor', 'Link público dos PDFs', 'ok', 'acessível pela internet');
  });
  await step('Servidor', 'Rotinas recentes', async () => {
    const lines = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').trim().split('\n').slice(-300).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
    const day = lines.filter((l) => Date.now() - Date.parse(l.at) < 24 * 3600000 && !l.dry && l.job !== 'health');
    const bad = day.filter((l) => !l.ok && !String(l.result || '').includes('"deferred":true'));
    if (bad.length) add('Servidor', 'Rotinas recentes', 'aviso', `${bad.length} execução(ões) com falha nas últimas 24h: ${[...new Set(bad.map((l) => l.job))].join(', ')}`);
    else add('Servidor', 'Rotinas recentes', 'ok', `${day.length} execuções nas últimas 24h, sem erro`);
  });

  // ---------- E-mail ----------
  await step('E-mail', 'Servidor de e-mail', async () => {
    const v = await verifyEmail();
    if (!v.configured) add('E-mail', 'Servidor de e-mail', 'aviso', 'não configurado (SMTP_USER, SMTP_PASS e REPORT_EMAILS na Hostinger)');
    else add('E-mail', 'Servidor de e-mail', 'ok', `login ok · ${emailRecipients().length} destinatário(s)`);
  });

  // ---------- Meta Ads (leitura das contas) ----------
  await step('Meta Ads', 'Token da Meta', async () => {
    const t = process.env.META_ACCESS_TOKEN;
    if (!t) throw new Error('META_ACCESS_TOKEN ausente');
    const d = (await graphGet(`debug_token?input_token=${encodeURIComponent(t)}`, t)).data || {};
    if (!d.is_valid) throw new Error('token inválido ou expirado — gere outro e troque na Hostinger');
    const exp = d.expires_at ? d.expires_at * 1000 : 0;
    const days = exp ? Math.floor((exp - Date.now()) / 86400000) : null;
    if (days != null && days < 10) add('Meta Ads', 'Token da Meta', days < 3 ? 'erro' : 'aviso', `expira em ${days} dia(s) (${fmt(exp)}) — troque por um token de usuário do sistema (sem validade)`);
    else add('Meta Ads', 'Token da Meta', 'ok', exp ? `válido até ${fmt(exp)}` : 'válido, sem data de expiração');
  });
  await step('Meta Ads', 'Contas de anúncio', async () => {
    const accs = await meta.accounts(true);
    const off = accs.filter((a) => a.statusCode === 2);
    add('Meta Ads', 'Contas de anúncio', off.length ? 'aviso' : 'ok', `${accs.length} contas lidas${off.length ? `; desativadas pela Meta: ${off.map((a) => a.name).join(', ')}` : ''}`);
  });

  // ---------- ViaZapi / Chatwoot ----------
  let inbox = null;
  await step('ViaZapi', 'API do Chatwoot', async () => {
    inbox = await chatwoot(inboxPath());
    add('ViaZapi', 'API do Chatwoot', 'ok', `caixa "${inbox.name}" (${inbox.phone_number || 'sem número'})`);
  });
  if (inbox) {
    await step('ViaZapi', 'Modelos no Chatwoot', async () => {
      const okIn = (ib) => NEEDED.filter((n) => (ib.message_templates || []).some((t) => t.name === n && t.status === 'APPROVED'));
      let have = okIn(inbox);
      if (have.length < NEEDED.length) {
        await chatwoot(`${inboxPath()}/sync_templates`, { method: 'POST' }).catch(() => {});
        await new Promise((r) => setTimeout(r, 8000));
        inbox = await chatwoot(inboxPath());
        have = okIn(inbox);
        if (have.length === NEEDED.length) { add('ViaZapi', 'Modelos no Chatwoot', 'ok', 'estavam desatualizados', 'sincronizados'); return; }
        add('ViaZapi', 'Modelos no Chatwoot', 'erro', `faltando ou não aprovados: ${NEEDED.filter((n) => !have.includes(n)).join(', ')}`);
      } else add('ViaZapi', 'Modelos no Chatwoot', 'ok', `${have.length} modelos aprovados e sincronizados`);
    });
    const conf = inbox.provider_config || {};
    const waToken = conf.api_key;
    // ---------- WhatsApp (Meta) ----------
    await step('WhatsApp', 'Número', async () => {
      const p = await graphGet(`${conf.phone_number_id}?fields=display_phone_number,status,quality_rating,messaging_limit_tier,name_status,webhook_configuration`, waToken);
      const lvl = p.status !== 'CONNECTED' ? 'erro' : p.quality_rating === 'RED' ? 'erro' : p.quality_rating === 'YELLOW' ? 'aviso' : 'ok';
      add('WhatsApp', 'Número', lvl, `${p.display_phone_number}: ${p.status}, qualidade ${p.quality_rating}${p.messaging_limit_tier ? `, limite ${p.messaging_limit_tier}` : ''}`);
      const hook = p.webhook_configuration?.phone_number || p.webhook_configuration?.application || '';
      const expect = `${process.env.VIAZAPI_BASE_URL || ''}/webhooks/whatsapp/`;
      add('WhatsApp', 'Webhook do número', hook.startsWith(expect) ? 'ok' : 'erro', hook.startsWith(expect) ? 'aponta para o Chatwoot' : `aponta para outro endereço (${hook.split('/').slice(0, 3).join('/') || 'nenhum'})`);
    });
    await step('WhatsApp', 'Modelos na Meta', async () => {
      const list = (await graphGet(`${conf.business_account_id}/message_templates?fields=name,status,category&limit=100`, waToken)).data || [];
      const mine = list.filter((t) => NEEDED.includes(t.name));
      const notOk = mine.filter((t) => t.status !== 'APPROVED');
      const mkt = mine.filter((t) => t.category === 'MARKETING').length;
      add('WhatsApp', 'Modelos na Meta', notOk.length ? 'erro' : mkt ? 'aviso' : 'ok',
        notOk.length ? `com problema: ${notOk.map((t) => `${t.name} (${t.status})`).join(', ')}` : mkt ? `${mine.length} aprovados, ${mkt} como Marketing (sujeitos ao limite diário por pessoa)` : `${mine.length} aprovados como Utilidade`);
    });
    await step('WhatsApp', 'Mensagens recebidas', async () => {
      const convs = (await chatwoot(`${accountPath()}/conversations?inbox_id=${inbox.id}&status=all`)).data?.payload || [];
      let lastIn = 0;
      for (const c of convs.slice(0, 15)) {
        const m = await chatwoot(`${accountPath()}/conversations/${c.id}/messages`);
        for (const x of m.payload || []) if (x.message_type === 0) lastIn = Math.max(lastIn, x.created_at * 1000);
      }
      if (!lastIn) add('WhatsApp', 'Mensagens recebidas', 'aviso', 'nenhuma mensagem recebida chegou ao Chatwoot — sem isso a janela de 24h nunca abre e tudo depende dos modelos');
      else add('WhatsApp', 'Mensagens recebidas', 'ok', `última recebida em ${fmt(lastIn)}`);
    });
    await step('WhatsApp', 'Entregas (24h)', async () => {
      const convs = (await chatwoot(`${accountPath()}/conversations?inbox_id=${inbox.id}&status=all`)).data?.payload || [];
      const want = recipients().map((p) => p.replace(/\D/g, ''));
      const per = [];
      for (const c of convs) {
        const phone = String(c.meta?.sender?.phone_number || '').replace(/\D/g, '');
        if (!want.includes(phone)) continue;
        const m = (await chatwoot(`${accountPath()}/conversations/${c.id}/messages`)).payload || [];
        const day = m.filter((x) => x.message_type === 1 && Date.now() / 1000 - x.created_at < 86400);
        const fail = day.filter((x) => x.status === 'failed');
        per.push({ phone, total: day.length, fail: fail.length, code: fail[0] ? String(fail[0].content_attributes?.external_error || '').slice(0, 6) : '' });
      }
      const g = guardStatus();
      const bad = per.filter((p) => p.fail);
      const txt = per.map((p) => `…${p.phone.slice(-4)}: ${p.total - p.fail}/${p.total} entregues${p.fail ? ` (falha ${p.code})` : ''}`).join(' · ');
      add('WhatsApp', 'Entregas (24h)', bad.length ? 'aviso' : 'ok', `${txt || 'sem envios'}${Object.keys(g.blocked).length ? ` · em pausa: ${Object.keys(g.blocked).map((p) => `…${p.slice(-4)} até ${fmt(g.blocked[p].until)}`).join(', ')}` : ''}${g.queued ? ` · ${g.queued} na fila` : ''}`);
    });
  }

  const erros = items.filter((i) => i.nivel === 'erro'), avisos = items.filter((i) => i.nivel === 'aviso');
  const resumo = erros.length ? `🛠️ ${erros.length} problema(s): ${erros.map((e) => e.nome).join(', ')}` : avisos.length ? `🟡 Sistema funcionando, ${avisos.length} ponto(s) de atenção` : '✅ Sistema: Meta, WhatsApp e servidor funcionando';
  const result = { at: new Date().toISOString(), resumo, erros: erros.length, avisos: avisos.length, items };
  if (writeState) writeState({ ...readState(), health: result });
  return result;
}

// linhas para o resumo do dia (só o que precisa de atenção)
export function healthLines(h) {
  if (!h) return [];
  const bad = h.items.filter((i) => i.nivel !== 'ok' && !i.corrigido);
  if (!bad.length) return ['✅ Sistema: Meta, WhatsApp e servidor funcionando'];
  return bad.slice(0, 3).map((i) => `${i.nivel === 'erro' ? '🛠️' : '⚙️'} Sistema · ${i.nome}: ${i.detalhe.slice(0, 120)}`);
}
