// Relatório PARA O CLIENTE (modelo "Relatório de performance Meta Ads" da Sincerus, A4 retrato, 2 páginas).
// Números vêm da API (nível campanha, alcance como no Gerenciador); textos têm rascunho automático
// feito só com os números do relatório e são editáveis antes de gerar o PDF.
import { shortResult } from './build';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nf = (d) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const int = (v) => (v == null ? '—' : nf(0).format(Math.round(v)));
const dec = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : nf(d).format(v));
const brl = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : `R$ ${nf(d).format(v)}`);
const usd = (v) => (v == null ? '—' : `US$ ${nf(2).format(v)}`);
const pct = (v, d = 1) => (v == null || !Number.isFinite(v) ? '—' : `${nf(d).format(v * 100)}%`);
const signed = (v) => (v == null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${nf(1).format(Math.abs(v * 100))}%`);
const dmy = (s) => s.split('-').reverse().join('/');
const dm = (s) => s.split('-').reverse().slice(0, 2).join('/');
const days = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 86400000) + 1;

// "[SS] [05] [ENGAJAMENTO [+CONV] [12/09/2026]" → "[05] Engajamento"
export function campaignLabel(name) {
  const parts = (String(name).match(/\[[^\]]*\]?/g) || []).map((p) => p.replace(/[[\]]/g, '').trim()).filter(Boolean);
  const i = parts.findIndex((p) => /^\d{1,3}$/.test(p));
  if (i >= 0 && parts[i + 1]) {
    const word = parts[i + 1].split(/[+/]/)[0].trim().toLowerCase();
    return `[${parts[i]}] ${word.charAt(0).toUpperCase()}${word.slice(1)}`;
  }
  return String(name).length > 38 ? `${String(name).slice(0, 36)}…` : String(name);
}

const periodText = (s, e) => {
  const n = days(s, e);
  if (s === e) return `${dmy(s)} (1 dia)`;
  const [ys, ms] = s.split('-'), [ye, me] = e.split('-');
  const start = ys === ye && ms === me ? s.slice(8) : ys === ye ? dm(s) : dmy(s);
  return `${start} a ${dmy(e)} (${n} dias)`;
};

// Junta os números do relatório. opts: { rate, ceiling (R$), responseRef (0–1), freqLimit, compareName }
export function computeClientReport(data, opts) {
  const isUsd = data.currency === 'USD';
  const rate = isUsd ? opts.rate : 1;
  const toBrl = (v) => (v == null ? null : v * rate);
  const n = days(data.since, data.until);
  const main = data.campaigns[0] || null;
  const goal = main?.goal;
  const resultLabel = main?.resultLabel || 'Resultados';
  const resShort = shortResult(resultLabel); // "conversas"
  const sameGoal = (c) => c.goal === goal;
  const mixed = data.campaigns.some((c) => c.results != null && !sameGoal(c));
  const T = data.total;
  // total da conta (inclui resultados de campanhas com outro objetivo); cai para a soma das campanhas se faltar
  const results = T.results ?? data.campaigns.filter(sameGoal).reduce((t, c) => t + (c.results || 0), 0);
  const fromOthers = T.resultsOwnGoal != null && results > T.resultsOwnGoal ? results - T.resultsOwnGoal : 0;
  const spendBrl = toBrl(T.spend);
  const cpr = results ? spendBrl / results : null;
  const response = T.reach ? results / T.reach : null;
  const perDay = results / n;
  const spendDay = spendBrl / n;
  const cpm = T.imp ? (spendBrl / T.imp) * 1000 : null;
  const budgetDay = data.dailyBudget ? toBrl(data.dailyBudget) : null;
  const budgetUse = budgetDay ? spendDay / budgetDay : null;

  let cmp = null;
  if (data.compare?.total) {
    const C = data.compare.total;
    const cn = days(data.cmpSince, data.cmpUntil);
    const cRes = C.results ?? data.compare.campaigns.filter((c) => c.goal === goal).reduce((t, c) => t + (c.results || 0), 0);
    const cSpend = toBrl(C.spend);
    const cMain = main ? data.compare.campaigns.find((c) => c.id === main.id) : null;
    const mainNowCpr = main?.results ? toBrl(main.spend) / main.results : null;
    const mainCmpCpr = cMain?.results ? toBrl(cMain.spend) / cMain.results : null;
    cmp = {
      name: opts.compareName || `${dm(data.cmpSince)} a ${dm(data.cmpUntil)}`, days: cn,
      rows: [
        ['Investimento por dia', cSpend / cn, spendDay, brl, 'neutral'],
        [`${cap(resShort)} por dia`, cRes / cn, perDay, (v) => dec(v, 1), 'up'],
        [`Custo por ${singular(resShort)} (conta)`, cRes ? cSpend / cRes : null, cpr, brl, 'down'],
        // custo da campanha principal, quando a conta tem (ou tinha) mais de uma campanha
        ...(main && mainCmpCpr != null && (data.campaigns.length > 1 || data.compare.campaigns.length > 1) ? [[`Custo por ${singular(resShort)} da ${campaignLabel(main.name).split(' ')[0]}`, mainCmpCpr, mainNowCpr, brl, 'down']] : []),
        ['CPM', C.imp ? (cSpend / C.imp) * 1000 : null, cpm, brl, 'down'],
      ].map(([label, before, now, fmt, good]) => ({ label, before, now, fmt, good, var: before ? now / before - 1 : null })),
      perDay: cRes / cn, spendDay: cSpend / cn, cpr: cRes ? cSpend / cRes : null, cpm: C.imp ? (cSpend / C.imp) * 1000 : null,
    };
  }

  const camps = data.campaigns.map((c) => {
    const s = toBrl(c.spend);
    const own = sameGoal(c);
    return { ...c, label: campaignLabel(c.name), spendBrl: s, cpr: c.results ? s / c.results : null, cpmBrl: c.imp ? (s / c.imp) * 1000 : null, own };
  });

  return {
    client: opts.clientName || data.name, isUsd, rate, rateSource: opts.rateSource, n, period: periodText(data.since, data.until),
    periodShort: `${dm(data.since)} a ${dm(data.until)}`, weekWord: n === 7 ? 'na semana' : `em ${n} dias`,
    objective: main?.objective || resultLabel, resultLabel, resShort, mixed, fromOthers,
    T, results, spendBrl, spendUsd: isUsd ? T.spend : null, cpr, response, perDay, spendDay, cpm, budgetDay, budgetUse,
    ceiling: opts.ceiling || null, responseRef: opts.responseRef || null, freqLimit: opts.freqLimit || null,
    camps, idle: data.idle, cmp, main: camps[0] || null,
  };
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const singular = (s) => ({ conversas: 'conversa', 'visitas ao perfil': 'visita ao perfil', leads: 'lead', compras: 'compra', cliques: 'clique', seguidores: 'seguidor' }[s] || 'resultado');

// Rascunho dos textos (só com números do relatório; o analista revisa e completa)
export function draftTexts(m) {
  const R = cap(m.resShort);
  // Leitura no formato do modelo: o que aconteceu (com o custo em contexto) → ponto de atenção → próximo ganho
  const conv = m.resShort === 'conversas';
  const quando = m.n === 7 ? 'Em sete dias' : m.n === 1 ? 'Em um dia' : `Em ${m.n} dias`;
  const cprCmp = m.cmp?.cpr && m.cpr != null ? m.cpr / m.cmp.cpr - 1 : null;
  const contexto = cprCmp != null
    ? ` — ${pct(Math.abs(cprCmp), 0)} ${cprCmp <= 0 ? 'mais barato' : 'mais caro'} que em ${m.cmp.name.toLowerCase()}`
    : m.ceiling && m.cpr != null ? ` — ${m.cpr <= m.ceiling ? 'abaixo' : 'acima'} do teto de ${brl(m.ceiling)} do nicho` : '';
  const viu = conv ? 'de quem viu chamou' : 'de quem viu gerou resultado';
  let atencao = '';
  if (m.ceiling && m.cpr != null && m.cpr > m.ceiling) {
    atencao = ` O ponto de atenção é o custo: ==${brl(m.cpr)}== por ${singular(m.resShort)}, acima do teto de ${brl(m.ceiling)}. O próximo ganho está em baixar o custo de entrega e testar novos criativos.`;
  } else if (m.response != null && m.responseRef && m.response < m.responseRef) {
    atencao = ` O ponto de atenção é a resposta ao anúncio: só ==${pct(m.response, 2)}== ${viu}, abaixo da referência de ${pct(m.responseRef, 1)}. O próximo ganho está no criativo.`;
  } else if (m.response != null) {
    atencao = ` A resposta ao anúncio está boa: ==${pct(m.response, 2)}== ${viu}${m.responseRef ? `, acima da referência de ${pct(m.responseRef, 1)}` : ''}. O próximo ganho está em escalar a verba com cuidado com a frequência (${dec(m.T.freq)}x).`;
  }
  const leitura = `${quando}, a ${m.client} recebeu ==${int(m.results)} ${m.resShort}==${conv ? ' no WhatsApp' : ''} a ==${brl(m.cpr)}== cada${contexto}.${atencao}`;
  const d = [];
  if (m.cmp) {
    const sp = m.cmp.rows[0], pd = m.cmp.rows[1], cp = m.cmp.rows[2];
    d.push({
      title: `${pd.var >= 0 ? 'Mais' : 'Menos'} ${m.resShort} por dia que em ${m.cmp.name.toLowerCase()}`,
      text: `A conta investiu **${brl(m.spendDay)} por dia**, ${pct(Math.abs(sp.var), 0)} ${sp.var <= 0 ? 'a menos' : 'a mais'} que a média de ${m.cmp.name.toLowerCase()}, e recebeu **${dec(m.perDay, 0)} ${m.resShort} por dia**, ${pct(Math.abs(pd.var), 0)} ${pd.var >= 0 ? 'a mais' : 'a menos'}. O custo por ${singular(m.resShort)} ${cp.var <= 0 ? 'caiu' : 'subiu'} de ${brl(cp.before)} para **${brl(cp.now)}**.`,
    });
  }
  if (m.response != null) {
    d.push({
      title: m.responseRef && m.response < m.responseRef ? 'A entrega está barata; o ganho agora está no criativo' : 'O anúncio está convertendo bem o público alcançado',
      text: `O custo para aparecer ficou em **${brl(m.cpm)} a cada mil exibições**${m.cmp?.cpm ? ` (${pct(Math.abs(m.cpm / m.cmp.cpm - 1), 1)} ${m.cpm <= m.cmp.cpm ? 'menor' : 'maior'} que em ${m.cmp.name.toLowerCase()})` : ''}, e **${pct(m.response, 2)}** das pessoas alcançadas ${m.resShort === 'conversas' ? 'chamaram no WhatsApp' : 'geraram resultado'}${m.responseRef ? `. A referência da carteira é ${pct(m.responseRef, 1)}` : ''}.`,
    });
  }
  if (m.main) {
    const share = m.spendBrl ? m.main.spendBrl / m.spendBrl : null;
    d.push({
      title: m.camps.length === 1 ? 'Uma única campanha sustenta a conta' : `${m.camps.length} campanhas com veiculação no período`,
      text: `A ${m.main.label} ${m.main.startTime ? `está no ar desde ${dmy(m.main.startTime)} e ` : ''}respondeu por **${pct(share, 0)} do investimento**${m.results && m.main.results != null ? ` e **${pct(m.main.results / m.results, 0)} ${['conversas', 'visitas ao perfil', 'compras'].includes(m.resShort) ? 'das' : 'dos'} ${m.resShort}**` : ''} do período.${m.idle.length ? ` ${m.idle.length} ${m.idle.length === 1 ? 'campanha está desligada' : 'campanhas estão desligadas'}.` : ''}`,
    });
  }
  if (m.budgetUse != null || m.T.freq != null) {
    d.push({
      title: 'Espaço para crescer, com a frequência como trava',
      text: `${m.budgetUse != null ? `A conta usou **${pct(m.budgetUse, 0)} do orçamento** disponível (${brl(m.spendDay)} de ${brl(m.budgetDay)} por dia). ` : ''}A frequência está em **${dec(m.T.freq)}x ${m.weekWord}**${m.freqLimit ? ` (limite de referência: ${dec(m.freqLimit, 1)}x no mês)` : ''}.`,
    });
  }
  return { leitura, destaques: d, plano: [] };
}

// **negrito** e ==destaque== nos textos
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/==(.+?)==/g, '<mark>$1</mark>');
const moneyBig = (v) => { const [a, b] = nf(2).format(v ?? 0).split(','); return `<small>R$</small> ${a}<small>,${b}</small>`; };

const CSS = `
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: 'Poppins', Verdana, sans-serif; color: #12141A; font-size: 8.6pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media screen { body { background: #2A2D33; padding: 18px 0; } .page { margin: 0 auto 18px; box-shadow: 0 6px 30px rgba(0,0,0,.35); } }
.page { width: 210mm; height: 297mm; background: #fff; position: relative; overflow: hidden; break-after: page; page-break-after: always; }
.page:last-child { break-after: auto; page-break-after: auto; }
.wrap { padding: 0 15mm; }
.hero { background: #12141A; color: #fff; padding: 11mm 15mm 7mm; position: relative; }
.hero::after { content: ""; position: absolute; left: 0; right: 0; bottom: -2.6mm; height: 2.6mm; background: linear-gradient(90deg, #F76000, #FFB04D); }
.brand { display: flex; align-items: center; gap: 3mm; font-weight: 700; letter-spacing: 1.6pt; font-size: 10.5pt; }
.brand i { width: 2.4mm; height: 2.4mm; border-radius: 50%; background: #F76000; display: inline-block; }
.brand span { font-weight: 400; color: #8A8F98; font-size: 6.8pt; letter-spacing: 1.8pt; margin-left: 4mm; }
.hero h1 { font-size: 23pt; line-height: 1.12; margin: 6mm 0 0; font-weight: 700; letter-spacing: -.3pt; }
.hero h1 em { font-style: normal; color: #FF8A1F; }
.meta { display: flex; gap: 10mm; margin-top: 6mm; }
.meta div span { display: block; font-size: 6.3pt; letter-spacing: 1pt; color: #8A8F98; text-transform: uppercase; }
.meta div b { display: block; font-weight: 500; font-size: 9.5pt; margin-top: 1.5mm; }
.sec { display: flex; align-items: center; gap: 3mm; font-size: 6.8pt; font-weight: 700; letter-spacing: 1.6pt; color: #5B6068; text-transform: uppercase; margin: 9mm 0 4mm; }
.sec::after { content: ""; flex: 1; border-top: .3mm solid #E2E3E5; }
.funnel { display: flex; gap: 2mm; align-items: flex-end; }
.funnel div { flex: var(--w); }
.funnel span { display: block; font-size: 6.3pt; letter-spacing: 1pt; color: #5B6068; text-transform: uppercase; margin-bottom: 2.2mm; }
.funnel b { display: block; color: #fff; font-size: 12pt; font-weight: 700; padding: 3.6mm 4mm; border-radius: 1.2mm; }
.fnote { display: flex; justify-content: space-between; font-size: 6.6pt; color: #5B6068; margin-top: 2mm; }
.fnote b { color: #12141A; }
.cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-top: 6mm; }
.card { border: .3mm solid #E2E3E5; border-radius: 2mm; padding: 4.5mm 4.5mm 4mm; }
.card.dark { background: #12141A; border-color: #12141A; color: #fff; }
.card span { display: block; font-size: 6.3pt; letter-spacing: 1pt; color: #5B6068; text-transform: uppercase; }
.card.dark span { color: #A9ADB4; }
.card b { display: block; font-size: 17pt; font-weight: 700; margin-top: 3mm; letter-spacing: -.3pt; }
.card b small { font-size: 9pt; font-weight: 600; }
.card b.green { color: #19A35A; }
.card p { margin: 2mm 0 0; font-size: 6.6pt; color: #5B6068; line-height: 1.45; }
.card.dark p { color: #A9ADB4; }
table { width: 100%; border-collapse: collapse; }
.camps th { font-size: 6.2pt; letter-spacing: 1pt; color: #5B6068; text-transform: uppercase; text-align: right; padding: 0 0 2.5mm; border-bottom: .4mm solid #12141A; }
.camps th:first-child { text-align: left; }
.camps td { padding: 3.2mm 0; text-align: right; border-bottom: .3mm solid #E9EAEC; font-size: 8.4pt; }
.camps td:first-child { text-align: left; }
.camps .nm { display: flex; gap: 2.5mm; align-items: flex-start; }
.camps .nm i { width: 1.4mm; height: 7mm; border-radius: .6mm; background: #F76000; flex: none; }
.camps .nm.off i { background: #E2E3E5; }
.camps .nm b { display: block; font-weight: 500; font-size: 9pt; }
.camps .nm small { display: block; font-size: 6.4pt; color: #8A8F98; margin-top: .6mm; }
.camps tr.off td { color: #A9ADB4; }
.camps tr.tot td { font-weight: 700; border-bottom: 0; }
.camps td.g { color: #19A35A; font-weight: 700; }
.bars { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7mm; }
.bars h4 { margin: 0 0 3mm; font-size: 6.8pt; letter-spacing: 1.2pt; text-transform: uppercase; }
.bar { margin-bottom: 3mm; }
.bar div { display: flex; justify-content: space-between; font-size: 7pt; margin-bottom: 1.4mm; }
.bar div b { font-weight: 700; }
.bar em { display: block; height: 2.4mm; border-radius: 2mm; background: #E9EAEC; overflow: hidden; }
.bar em u { display: block; height: 100%; border-radius: 2mm; }
.bars p { margin: 2mm 0 0; font-size: 6.4pt; color: #5B6068; line-height: 1.45; }
.strip { display: flex; background: #12141A; color: #fff; border-radius: 2mm; padding: 5mm 7mm; margin-top: 8mm; }
.strip div { flex: 1; border-right: .3mm solid #2D3038; padding-left: 5mm; }
.strip div:first-child { padding-left: 0; }
.strip div:last-child { border-right: 0; }
.strip b { display: block; font-size: 13pt; font-weight: 700; }
.strip b.o { color: #FF8A1F; }
.strip span { display: block; font-size: 6.2pt; letter-spacing: 1pt; color: #A9ADB4; text-transform: uppercase; margin-top: 1mm; }
.foot { position: absolute; left: 15mm; right: 15mm; bottom: 10mm; display: flex; justify-content: space-between; border-top: .3mm solid #E2E3E5; padding-top: 3mm; font-size: 6.6pt; color: #8A8F98; }
.foot b { color: #12141A; letter-spacing: 1.2pt; margin-right: 2mm; }
.kick { color: #F76000; font-size: 6.8pt; font-weight: 700; letter-spacing: 1.6pt; text-transform: uppercase; margin: 12mm 0 4mm; }
.lead { font-family: Georgia, 'Times New Roman', serif; font-size: 11.4pt; line-height: 1.55; margin: 0; }
mark { background: none; color: #12141A; font-weight: 700; text-decoration: underline; text-decoration-color: #F76000; text-decoration-thickness: .55mm; text-underline-offset: .9mm; }
.cmp th { font-size: 6.2pt; letter-spacing: 1pt; color: #5B6068; text-transform: uppercase; text-align: right; padding: 0 0 2.5mm; border-bottom: .4mm solid #12141A; }
.cmp th:first-child { text-align: left; }
.cmp td { padding: 2.8mm 0; text-align: right; border-bottom: .3mm solid #E9EAEC; font-size: 8.4pt; }
.cmp td:first-child { text-align: left; }
.cmp td.up { color: #19A35A; font-weight: 700; }
.cmp td.down { color: #D92D20; font-weight: 700; }
.note { font-size: 6.2pt; color: #8A8F98; margin: 2.5mm 0 0; }
.ins { border-top: .3mm solid #E2E3E5; padding: 3.5mm 0; display: grid; grid-template-columns: 13mm 1fr; }
.ins > span { color: #F76000; font-weight: 700; font-size: 9pt; }
.ins h3 { margin: 0 0 1.6mm; font-size: 10pt; font-weight: 600; }
.ins p { margin: 0; font-size: 7.6pt; line-height: 1.55; color: #3A3E46; }
.ins p b { color: #12141A; }
.plan { background: #12141A; color: #fff; border-radius: 2mm; padding: 6mm 8mm 4mm; margin-top: 6mm; }
.plan .sec { margin: 0 0 4mm; color: #A9ADB4; }
.plan .sec::after { border-color: #2D3038; }
.plan li { display: grid; grid-template-columns: 9mm 1fr; padding: 2.6mm 0; border-bottom: .3mm solid #2D3038; font-size: 7.8pt; line-height: 1.5; color: #C9CBCF; }
.plan li:last-child { border-bottom: 0; }
.plan li i { width: 4.4mm; height: 4.4mm; border-radius: 50%; background: #F76000; color: #12141A; font-style: normal; font-weight: 700; font-size: 6.6pt; display: grid; place-items: center; }
.plan li b { color: #fff; }
.plan ol { list-style: none; margin: 0; padding: 0; }
`;

export function buildClientReportHtml(m, texts) {
  const R = cap(m.resShort);
  const one = singular(m.resShort);
  const isConv = m.resShort === 'conversas';
  const pages = [];
  const foot = (p, t) => `<div class="foot"><span><b>SINCERUS SCALE</b>· Relatório de tráfego pago — ${esc(m.client)}</span><span>Página ${p} de ${t}</span></div>`;
  const moveExtra = m.camps.length + (m.idle.length ? 1 : 0) > 2; // muitas campanhas: barras e faixa vão para a página 2
  const hasPage2 = moveExtra || !!(texts.leitura?.trim() || m.cmp || texts.destaques?.length || texts.plano?.length);
  const total = hasPage2 ? 2 : 1;

  // ---------- página 1 ----------
  const fw = (v) => Math.max(0.55, Math.min(1, v));
  const impW = 1, reachW = m.T.imp ? fw(m.T.reach / m.T.imp + 0.25) : 0.7, resW = 0.45;
  const ceilingTxt = m.ceiling && m.cpr != null ? `${pct(Math.abs(1 - m.cpr / m.ceiling), 0)} ${m.cpr <= m.ceiling ? 'abaixo' : 'acima'} do teto do nicho (${brl(m.ceiling)})` : '';
  const rows = m.camps.map((c) => `<tr><td><div class="nm"><i></i><div><b>${esc(c.label)}</b><small>${c.active ? `No ar desde ${c.startTime ? dmy(c.startTime) : '—'}` : esc(c.status || 'Desligada')}${!c.own && c.ownResults != null ? ` · ${esc(c.ownLabel)}: ${int(c.ownResults)}` : ''}</small></div></div></td>
    <td>${brl(c.spendBrl)}</td><td>${c.own && c.results != null ? int(c.results) : '—'}</td><td class="${c.own && m.ceiling && c.cpr != null && c.cpr <= m.ceiling ? 'g' : ''}">${c.own ? brl(c.cpr) : '—'}</td><td>${int(c.imp)}</td><td>${int(c.reach)}</td><td>${c.freq != null ? `${dec(c.freq)}x` : '—'}</td><td>${brl(c.cpmBrl)}</td></tr>`).join('');
  const idleRow = m.idle.length ? `<tr class="off"><td><div class="nm off"><i></i><div><b style="color:#8A8F98">${m.idle.length} ${m.idle.length === 1 ? 'campanha desligada' : 'campanhas desligadas'}</b><small>Sem veiculação no período</small></div></div></td><td>R$ 0,00</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>` : '';
  const bar = (label, val, txt, w, color) => `<div class="bar"><div><span>${label}</span><b>${txt}</b></div><em><u style="width:${Math.max(2, Math.min(100, w * 100))}%;background:${color}"></u></em></div>`;
  const barCols = [];
  if (m.ceiling && m.cpr != null) {
    const mx = Math.max(m.cpr, m.ceiling);
    barCols.push(`<div><h4>Custo por ${one}</h4>${bar('Realizado', m.cpr, brl(m.cpr), m.cpr / mx, m.cpr <= m.ceiling ? '#19A35A' : '#D92D20')}${bar('Teto do nicho', m.ceiling, brl(m.ceiling), m.ceiling / mx, '#C9CBD0')}<p>${m.cpr <= m.ceiling ? `${pct(1 - m.cpr / m.ceiling, 0)} abaixo do teto do nicho.` : `${pct(m.cpr / m.ceiling - 1, 0)} acima do teto do nicho.`}</p></div>`);
  }
  if (m.responseRef && m.response != null) {
    const mx = Math.max(m.response, m.responseRef);
    barCols.push(`<div><h4>Alcance → ${one}</h4>${bar('Realizado', m.response, pct(m.response, 2), m.response / mx, m.response >= m.responseRef ? '#19A35A' : '#D92D20')}${bar('Referência', m.responseRef, pct(m.responseRef, 2), m.responseRef / mx, '#C9CBD0')}<p>${m.response >= m.responseRef ? 'A resposta ao anúncio está acima da referência.' : 'Menos pessoas respondem do que o esperado: o ganho está no criativo.'}</p></div>`);
  }
  if (m.cmp) {
    const mx = Math.max(m.perDay, m.cmp.perDay || 0) || 1;
    const v = m.cmp.perDay ? m.perDay / m.cmp.perDay - 1 : null;
    barCols.push(`<div><h4>${R} por dia</h4>${bar(esc(m.periodShort), m.perDay, dec(m.perDay, 1), m.perDay / mx, '#F76000')}${bar(esc(m.cmp.name), m.cmp.perDay, dec(m.cmp.perDay, 1), (m.cmp.perDay || 0) / mx, '#C9CBD0')}<p>${v != null ? `${pct(Math.abs(v), 0)} ${v >= 0 ? 'mais' : 'menos'} ${m.resShort} por dia que em ${esc(m.cmp.name.toLowerCase())}${m.cmp.spendDay ? `, com ${pct(Math.abs(m.spendDay / m.cmp.spendDay - 1), 0)} ${m.spendDay <= m.cmp.spendDay ? 'menos' : 'mais'} verba diária` : ''}.` : ''}</p></div>`);
  }

  const extra = `${barCols.length ? `<div class="sec" style="margin-top:7mm"></div><div class="bars" style="grid-template-columns:repeat(${barCols.length},1fr)">${barCols.join('')}</div>` : ''}
      <div class="strip"><div><b>${int(m.results)}</b><span>${esc(R)}</span></div><div><b class="o">${brl(m.cpr)}</b><span>Custo por ${one}</span></div><div><b>${dec(m.perDay, 0)}</b><span>${esc(R)} por dia</span></div>${m.budgetUse != null ? `<div><b>${pct(m.budgetUse, 0)}</b><span>Uso do orçamento</span></div>` : `<div><b>${brl(m.cpm)}</b><span>CPM</span></div>`}</div>`;
  pages.push(`<section class="page">
    <div class="hero">
      <div class="brand"><i></i>SINCERUS SCALE<span>GESTÃO DE TRÁFEGO PAGO</span></div>
      <h1>Relatório de performance<br><em>Meta Ads</em></h1>
      <div class="meta"><div><span>Cliente</span><b>${esc(m.client)}</b></div><div><span>Período</span><b>${esc(m.period)}</b></div><div><span>Objetivo</span><b>${esc(m.objective)}</b></div>${m.isUsd ? `<div><span>Câmbio</span><b>US$ 1 = R$ ${dec(m.rate)}</b></div>` : ''}</div>
    </div>
    <div class="wrap">
      <div class="sec">Do investimento até ${isConv ? 'a conversa' : 'o resultado'}</div>
      <div class="funnel">
        <div style="--w:${impW * 3.3}"><span>Impressões</span><b style="background:linear-gradient(90deg,#F76000,#FF7A1A)">${int(m.T.imp)}</b></div>
        <div style="--w:${reachW * 2.3}"><span>Contas alcançadas</span><b style="background:linear-gradient(90deg,#FF8A1F,#FFA142)">${int(m.T.reach)}</b></div>
        <div style="--w:${resW * 3}"><span>${esc(R)}</span><b style="background:#19A35A">${int(m.results)}</b></div>
      </div>
      <div class="fnote"><span>Cada conta viu o anúncio <b>${dec(m.T.freq)} vezes</b> ${m.weekWord}</span><span><b>${pct(m.response, 2)}</b> do alcance ${isConv ? 'chamou' : 'gerou resultado'}</span></div>
      <div class="cards">
        <div class="card dark"><span>Investimento</span><b>${moneyBig(m.spendBrl)}</b><p>${m.isUsd ? `${usd(m.spendUsd)} · ` : ''}média de ${brl(m.spendDay)} por dia</p></div>
        <div class="card"><span>${esc(R)}</span><b>${int(m.results)}</b><p>Cerca de ${dec(m.perDay, 0)} por dia</p></div>
        <div class="card"><span>Custo / ${one}</span><b class="${m.ceiling && m.cpr != null && m.cpr <= m.ceiling ? 'green' : ''}">${m.cpr != null ? moneyBig(m.cpr) : '—'}</b><p>${ceilingTxt}</p></div>
        <div class="card"><span>Frequência</span><b>${dec(m.T.freq)}<small>x</small></b><p>Em ${m.n} ${m.n === 1 ? 'dia' : 'dias'}${m.freqLimit ? ` · limite mensal: ${dec(m.freqLimit, 1)}x` : ''}</p></div>
      </div>
      <div class="sec">Desempenho por campanha</div>
      <table class="camps"><thead><tr><th>Campanha</th><th>Investido</th><th>${esc(R)}</th><th>Custo</th><th>Impressões</th><th>Alcance</th><th>Freq.</th><th>CPM</th></tr></thead>
      <tbody>${rows}${idleRow}<tr class="tot"><td>Total</td><td>${brl(m.spendBrl)}</td><td>${int(m.results)}</td><td>${brl(m.cpr)}</td><td>${int(m.T.imp)}</td><td>${int(m.T.reach)}${m.T.reachSummed ? '*' : ''}</td><td>${m.T.freq != null ? `${dec(m.T.freq)}x` : '—'}</td><td>${brl(m.cpm)}</td></tr></tbody></table>
      ${m.mixed || m.T.reachSummed || m.fromOthers ? `<p class="note">${m.fromOthers ? `Total inclui ${int(m.fromOthers)} ${esc(m.resShort)} vindas de campanhas com outro objetivo. ` : m.mixed ? `Total de ${esc(m.resShort)} considera só as campanhas com esse objetivo. ` : ''}${m.T.reachSummed ? '*Alcance total = soma do alcance de cada campanha (uma pessoa pode ter visto mais de uma).' : ''}</p>` : ''}
      ${moveExtra ? '' : extra}
    </div>
    ${foot(1, total)}
  </section>`);

  // ---------- página 2 ----------
  if (hasPage2) {
    const cmpTable = m.cmp ? `<div class="sec">Comparativo com ${esc(m.cmp.name.toLowerCase())} · média por dia</div>
      <table class="cmp"><thead><tr><th>Indicador</th><th>${esc(m.cmp.name)}</th><th>${esc(m.periodShort)}</th><th>Variação</th></tr></thead><tbody>
      ${m.cmp.rows.map((r) => { const good = r.var == null || r.good === 'neutral' ? '' : (r.good === 'up' ? r.var > 0 : r.var < 0) ? 'up' : 'down'; return `<tr><td>${esc(r.label)}</td><td>${r.fmt(r.before)}</td><td>${r.fmt(r.now)}</td><td class="${good}">${signed(r.var)}</td></tr>`; }).join('')}
      </tbody></table><p class="note">${m.cmp.days !== m.n ? `${esc(m.cmp.name)} tem ${m.cmp.days} dias; o recorte atual tem ${m.n}. A média diária indica direção, não equivalência exata.` : 'Mesma quantidade de dias nos dois períodos.'}${m.isUsd ? ` Mesma cotação (R$ ${dec(m.rate)}) nos dois períodos.` : ''}</p>` : '';
    const ins = (texts.destaques || []).filter((d) => d.title?.trim() || d.text?.trim()).map((d, i) => `<div class="ins"><span>${String(i + 1).padStart(2, '0')}</span><div><h3>${rich(d.title)}</h3><p>${rich(d.text)}</p></div></div>`).join('');
    const plan = (texts.plano || []).filter((p) => p.title?.trim() || p.text?.trim());
    pages.push(`<section class="page"><div class="wrap">
      ${moveExtra ? `<div style="height:4mm"></div>${extra}` : ''}
      ${texts.leitura?.trim() ? `<div class="kick">Leitura ${m.n === 7 ? 'da semana' : 'do período'}</div><p class="lead">${rich(texts.leitura)}</p>` : '<div style="height:6mm"></div>'}
      ${cmpTable}
      ${ins ? `<div style="margin-top:5mm">${ins}</div>` : ''}
      ${plan.length ? `<div class="plan"><div class="sec">Plano de ação</div><ol>${plan.map((p, i) => `<li><i>${i + 1}</i><span><b>${rich(p.title)}</b> ${rich(p.text)}</span></li>`).join('')}</ol></div>` : ''}
    </div>${foot(2, total)}</section>`);
  }

  const fileName = `Relatorio_${String(m.client).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '')}_${m.periodShort.replace(/\//g, '-').replace(/ a /, '_a_')}`;
  return {
    fileName,
    html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(fileName)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>${pages.join('\n')}</body></html>`,
  };
}

// Vários clientes no mesmo PDF: as páginas de cada um, uma depois da outra
export function buildClientReportsHtml(list) {
  if (list.length === 1) return buildClientReportHtml(list[0].model, list[0].texts);
  const parts = list.map(({ model, texts }) => buildClientReportHtml(model, texts).html.match(/<body>([\s\S]*)<\/body>/)[1]);
  const head = buildClientReportHtml(list[0].model, list[0].texts).html.match(/<head>([\s\S]*)<\/head>/)[1].replace(/<title>[\s\S]*?<\/title>/, '');
  const fileName = `Relatorios_${list.length}-clientes_${list[0].model.periodShort.replace(/\//g, '-').replace(/ a /, '_a_')}`;
  return { fileName, html: `<!doctype html><html lang="pt-BR"><head><title>${fileName}</title>${head}</head><body>${parts.join('\n')}</body></html>` };
}
