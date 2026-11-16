// Integração com a Meta Marketing API (somente leitura). O token fica só no servidor (META_ACCESS_TOKEN).
const version = () => process.env.META_API_VERSION || 'v23.0';
// META_GRAPH_URL só serve para testes locais com uma API simulada
const base = () => process.env.META_GRAPH_URL || 'https://graph.facebook.com';
export const configured = () => !!process.env.META_ACCESS_TOKEN;

const cache = new Map();
const TTL = 10 * 60 * 1000;

// Falhas de rede momentâneas ("fetch failed") ganham mais 2 tentativas antes de virar erro na tela
async function fetchRetry(url, tries = 3) {
  for (let i = 1; ; i++) {
    try { return await fetch(url, { signal: AbortSignal.timeout(30000) }); }
    catch (e) {
      if (i >= tries) throw Object.assign(new Error('Não foi possível falar com a API da Meta agora (falha de rede). Tente "Atualizar da Meta" em instantes.'), { status: 504 });
      await new Promise((r) => setTimeout(r, 600 * i));
    }
  }
}

async function graph(path, params = {}, { all = true } = {}) {
  if (!configured()) throw Object.assign(new Error('A API da Meta não está configurada no servidor (META_ACCESS_TOKEN).'), { status: 503 });
  const qs = new URLSearchParams({ ...params, access_token: process.env.META_ACCESS_TOKEN });
  let url = `${base()}/${version()}/${path}?${qs}`;
  const out = [];
  for (let page = 0; url && page < 20; page++) {
    const res = await fetchRetry(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
      const e = json.error || {};
      throw Object.assign(new Error(`Meta API: ${e.message || res.status}${e.code ? ` (código ${e.code})` : ''}`), { status: res.status === 400 || res.status === 403 ? 502 : res.status });
    }
    if (!Array.isArray(json.data)) return json;
    out.push(...json.data);
    url = all ? json.paging?.next : null;
  }
  return out;
}

async function cached(key, fn, refresh) {
  const hit = cache.get(key);
  if (!refresh && hit && Date.now() - hit.at < TTL) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const ACCOUNT_STATUS = { 1: 'Ativa', 2: 'Desativada', 3: 'Pendente de pagamento', 7: 'Em análise de risco', 8: 'Pendente de liquidação', 9: 'Em período de carência', 100: 'Fechamento pendente', 101: 'Fechada' };

export function accounts(refresh) {
  return cached('accounts', async () => {
    const list = await graph('me/adaccounts', { fields: 'name,account_id,currency,account_status,business_name', limit: '200' });
    return list.map((a) => ({ id: a.id, accountId: a.account_id, name: a.name, currency: a.currency, status: ACCOUNT_STATUS[a.account_status] || String(a.account_status), active: a.account_status === 1, statusCode: a.account_status, business: a.business_name || '' }))
      .sort((x, y) => x.name.localeCompare(y.name, 'pt-BR'));
  }, refresh);
}

// Status exibido no Gerenciador (pt-BR)
const STATUS = { ACTIVE: 'Ativo', PAUSED: 'Desativado', CAMPAIGN_PAUSED: 'Inativo', ADSET_PAUSED: 'Inativo', IN_PROCESS: 'Em análise', PENDING_REVIEW: 'Em análise', DISAPPROVED: 'Reprovado', PREAPPROVED: 'Pré-aprovado', PENDING_BILLING_INFO: 'Pendente de pagamento', WITH_ISSUES: 'Com problemas', ARCHIVED: 'Arquivado', DELETED: 'Excluído' };
const RANK = { ABOVE_AVERAGE: 'Acima da média', AVERAGE: 'Média', BELOW_AVERAGE_35: 'Abaixo da média (últimos 35%)', BELOW_AVERAGE_20: 'Abaixo da média (últimos 20%)', BELOW_AVERAGE_10: 'Abaixo da média (últimos 10%)' };

// Meta de otimização do conjunto -> tipos de ação que contam como "resultado".
// Confira na primeira vez com a coluna "Resultados" do Gerenciador; ajuste aqui se a conta usar outro evento.
const RESULT = {
  CONVERSATIONS: ['Conversas por mensagem iniciadas', ['onsite_conversion.messaging_conversation_started_7d']],
  PROFILE_VISIT: ['Visitas ao perfil do Instagram', ['onsite_conversion.ig_profile_visit', 'ig_profile_visit', 'profile_visit']],
  VISIT_INSTAGRAM_PROFILE: ['Visitas ao perfil do Instagram', ['onsite_conversion.ig_profile_visit', 'ig_profile_visit', 'profile_visit']],
  LEAD_GENERATION: ['Leads', ['onsite_conversion.lead_grouped', 'lead', 'leadgen_grouped']],
  QUALITY_LEAD: ['Leads', ['onsite_conversion.lead_grouped', 'lead']],
  LINK_CLICKS: ['Cliques no link', ['link_click']],
  LANDING_PAGE_VIEWS: ['Visualizações da página de destino', ['landing_page_view']],
  OFFSITE_CONVERSIONS: ['Compras', ['offsite_conversion.fb_pixel_purchase', 'purchase', 'omni_purchase']],
  VALUE: ['Compras', ['offsite_conversion.fb_pixel_purchase', 'purchase', 'omni_purchase']],
  POST_ENGAGEMENT: ['Engajamento com a publicação', ['post_engagement']],
  THRUPLAY: ['ThruPlays', ['video_thruplay_watched_actions', 'video_view']],
  REACH: ['Alcance', null],
  IMPRESSIONS: ['Impressões', null],
};
const num = (v) => (v == null || v === '' ? null : Number(v));
const actionValue = (list, types) => {
  if (!types || !Array.isArray(list)) return null;
  for (const t of types) { const f = list.find((a) => a.action_type === t); if (f) return { type: t, value: Number(f.value) }; }
  return null;
};
const money = (cents, cur) => (cents ? `${cur === 'USD' ? 'US$' : 'R$'} ${(Number(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '');
const attribution = (spec) => {
  const click = spec?.find((s) => s.event_type === 'CLICK_THROUGH');
  const view = spec?.find((s) => s.event_type === 'VIEW_THROUGH');
  return [click && `Clique de ${click.window_days} dia${click.window_days > 1 ? 's' : ''}`, view && `visualização de ${view.window_days} dia`].filter(Boolean).join(' e ');
};

export function report(account, since, until, refresh) {
  if (!/^act_\d+$/.test(account) || !/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    throw Object.assign(new Error('Parâmetros inválidos.'), { status: 400 });
  }
  return cached(`report:${account}:${since}:${until}`, async () => {
    const time_range = JSON.stringify({ since, until });
    const [info, insights, ads, adsets, campaigns] = await Promise.all([
      graph(account, { fields: 'name,currency' }, { all: false }),
      graph(`${account}/insights`, { level: 'ad', time_range, limit: '500', fields: 'ad_id,ad_name,adset_id,campaign_id,spend,impressions,reach,frequency,cpm,inline_link_clicks,inline_link_click_ctr,actions,quality_ranking,engagement_rate_ranking,conversion_rate_ranking' }),
      graph(`${account}/ads`, { fields: 'id,name,effective_status,adset_id,campaign_id', limit: '500' }),
      graph(`${account}/adsets`, { fields: 'id,name,optimization_goal,effective_status,daily_budget,lifetime_budget,attribution_spec', limit: '500' }),
      graph(`${account}/campaigns`, { fields: 'id,name,objective,effective_status,daily_budget,lifetime_budget', limit: '500' }),
    ]);
    const cur = info.currency;
    const byAd = new Map(insights.map((r) => [r.ad_id, r]));
    const adsetById = new Map(adsets.map((s) => [s.id, s]));
    const campById = new Map(campaigns.map((c) => [c.id, c]));
    // Entram os conjuntos com gasto no período ou ativos agora (anúncios sem gasto também aparecem)
    const keepAdset = new Set([...insights.map((r) => r.adset_id), ...adsets.filter((s) => s.effective_status === 'ACTIVE').map((s) => s.id)]);
    const groups = new Map();
    for (const ad of ads) {
      if (!keepAdset.has(ad.adset_id) || ad.effective_status === 'DELETED') continue;
      const ins = byAd.get(ad.id);
      if (!ins && ad.effective_status === 'ARCHIVED') continue;
      const set = adsetById.get(ad.adset_id) || {};
      const camp = campById.get(ad.campaign_id) || {};
      const key = `${ad.campaign_id}|${ad.adset_id}`;
      if (!groups.has(key)) {
        const [label, types] = RESULT[set.optimization_goal] || ['Resultados', null];
        groups.set(key, {
          name: camp.name || '(campanha)', adset: set.name || '', campaignStatus: STATUS[camp.effective_status] || camp.effective_status || '',
          resultType: label, types, goal: set.optimization_goal, attribution: attribution(set.attribution_spec),
          budget: set.daily_budget ? `${money(set.daily_budget, cur)} diário (conjunto)` : camp.daily_budget ? `${money(camp.daily_budget, cur)} diário (campanha)` : set.lifetime_budget ? `${money(set.lifetime_budget, cur)} total (conjunto)` : '',
          usedTypes: new Set(), ads: [],
        });
      }
      const g = groups.get(key);
      const res = ins ? actionValue(ins.actions, g.types) : null;
      if (res) g.usedTypes.add(res.type);
      const spend = ins ? Number(ins.spend) : 0;
      g.ads.push({
        name: ad.name, status: STATUS[ad.effective_status] || ad.effective_status,
        spend, imp: ins ? num(ins.impressions) : null, reach: ins ? num(ins.reach) : null,
        results: res ? res.value : null, cpr: res && res.value ? spend / res.value : null,
        freq: ins ? num(ins.frequency) : null, cpm: ins ? num(ins.cpm) : null,
        clicks: ins ? num(ins.inline_link_clicks) : null, ctr: ins ? num(ins.inline_link_click_ctr) : null,
        q: RANK[ins?.quality_ranking] || null, e: RANK[ins?.engagement_rate_ranking] || null, cv: RANK[ins?.conversion_rate_ranking] || null,
      });
    }
    const out = [...groups.values()].map(({ types, usedTypes, goal, ...g }) => ({
      ...g,
      notes: [
        types ? `Resultados lidos da API pelo evento ${[...usedTypes].join(', ') || types[0]} (meta de otimização ${goal}). Na primeira vez, confira com a coluna "Resultados" do Gerenciador.` : `Meta de otimização ${goal || 'não informada'} sem evento de resultado mapeado — resultados ficam "—".`,
      ],
      ads: g.ads.sort((a, b) => b.spend - a.spend),
    }));
    return { account, name: info.name, currency: cur, since, until, fetchedAt: new Date().toISOString(), campaigns: out };
  }, refresh);
}

// Roda fn em cada item com no máximo `n` chamadas simultâneas (evita estourar o limite da Meta com muitas contas)
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

// Todos os anúncios ativos agora, de todas as contas: cliente → campanha → conjunto → anúncios
export function activeAds(refresh) {
  return cached('active-ads', async () => {
    const accs = (await accounts(refresh)).filter((a) => a.statusCode !== 2 && a.statusCode !== 101);
    const rows = await pool(accs, 10, async (a) => {
      try {
        const ads = await graph(`${a.id}/ads`, {
          effective_status: JSON.stringify(['ACTIVE']),
          fields: 'id,name,created_time,campaign{id,name,objective,effective_status},adset{id,name,effective_status}',
          limit: '500',
        });
        const camps = new Map();
        for (const ad of ads) {
          const c = ad.campaign || {};
          if (!camps.has(c.id)) camps.set(c.id, { id: c.id, name: c.name || '(campanha)', objective: c.objective || '', status: STATUS[c.effective_status] || c.effective_status || '', adsets: new Map() });
          const camp = camps.get(c.id);
          const s = ad.adset || {};
          if (!camp.adsets.has(s.id)) camp.adsets.set(s.id, { id: s.id, name: s.name || '(conjunto)', ads: [] });
          camp.adsets.get(s.id).ads.push({ id: ad.id, name: ad.name, created: ad.created_time?.slice(0, 10) || '' });
        }
        const campaigns = [...camps.values()].map((c) => ({ ...c, adsets: [...c.adsets.values()].map((s) => ({ ...s, ads: s.ads.sort((x, y) => x.name.localeCompare(y.name, 'pt-BR')) })) }))
          .sort((x, y) => x.name.localeCompare(y.name, 'pt-BR'));
        return { id: a.id, name: a.name, currency: a.currency, status: a.status, business: a.business, campaigns, ads: ads.length };
      } catch (e) { return { id: a.id, name: a.name, currency: a.currency, status: a.status, business: a.business, campaigns: [], ads: 0, error: e.message }; }
    });
    return { fetchedAt: new Date().toISOString(), accounts: rows };
  }, refresh);
}

// Visão geral para o dashboard: gasto e impressões mensais de cada conta
export function overview(since, until, refresh) {
  return cached(`overview:${since}:${until}`, async () => {
    const accs = await accounts(refresh);
    const time_range = JSON.stringify({ since, until });
    const rows = await pool(accs, 5, async (a) => {
      // conta desativada ou fechada: aparece na carteira, sem consulta de insights (pendente de pagamento ainda tem histórico)
      if (a.statusCode === 2 || a.statusCode === 101) return { ...a, months: [] };
      try {
        const data = await graph(`${a.id}/insights`, { time_range, time_increment: 'monthly', fields: 'spend,impressions,reach,actions' });
        const months = data.map((d) => ({
          month: d.date_start.slice(0, 7), spend: Number(d.spend || 0), imp: Number(d.impressions || 0), reach: Number(d.reach || 0),
          conversations: Number(d.actions?.find((x) => x.action_type === 'onsite_conversion.messaging_conversation_started_7d')?.value || 0),
          leads: Number(d.actions?.find((x) => x.action_type === 'onsite_conversion.lead_grouped' || x.action_type === 'lead')?.value || 0),
        }));
        return { ...a, months };
      } catch (e) { return { ...a, months: [], error: e.message }; }
    });
    return { since, until, fetchedAt: new Date().toISOString(), accounts: rows };
  }, refresh);
}

// ---------- Relatório para o cliente (nível campanha + conta, com período de comparação opcional) ----------
const OBJETIVO = {
  CONVERSATIONS: 'Conversas no WhatsApp', PROFILE_VISIT: 'Visitas ao perfil do Instagram', VISIT_INSTAGRAM_PROFILE: 'Visitas ao perfil do Instagram',
  LEAD_GENERATION: 'Geração de cadastros', QUALITY_LEAD: 'Geração de cadastros', LINK_CLICKS: 'Cliques no link', LANDING_PAGE_VIEWS: 'Visitas ao site',
  OFFSITE_CONVERSIONS: 'Vendas no site', VALUE: 'Vendas no site', POST_ENGAGEMENT: 'Engajamento', THRUPLAY: 'Visualizações de vídeo', REACH: 'Alcance', IMPRESSIONS: 'Impressões',
};
const sumMetrics = (rows) => rows.reduce((t, r) => ({ spend: t.spend + r.spend, imp: t.imp + r.imp, results: t.results + (r.results || 0) }), { spend: 0, imp: 0, results: 0 });
const metrics = (ins) => ({
  spend: Number(ins?.spend || 0), imp: Number(ins?.impressions || 0), reach: Number(ins?.reach || 0),
  freq: ins?.frequency != null ? Number(ins.frequency) : null, cpm: ins?.cpm != null ? Number(ins.cpm) : null,
});

export function clientReport(account, since, until, cmpSince, cmpUntil, refresh) {
  const okDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!/^act_\d+$/.test(account) || !okDate(since) || !okDate(until) || (cmpSince && (!okDate(cmpSince) || !okDate(cmpUntil)))) {
    throw Object.assign(new Error('Parâmetros inválidos.'), { status: 400 });
  }
  return cached(`client:${account}:${since}:${until}:${cmpSince || ''}:${cmpUntil || ''}`, async () => {
    const tr = (s, u) => JSON.stringify({ since: s, until: u });
    const insFields = 'campaign_id,campaign_name,spend,impressions,reach,frequency,cpm,actions';
    const [info, campaigns, adsets, byCamp, acc, cmpCamp, cmpAcc, bySet, cmpSet] = await Promise.all([
      graph(account, { fields: 'name,currency,timezone_name' }, { all: false }),
      graph(`${account}/campaigns`, { fields: 'id,name,effective_status,start_time,daily_budget,lifetime_budget', limit: '500' }),
      graph(`${account}/adsets`, { fields: 'id,campaign_id,optimization_goal,effective_status,daily_budget', limit: '500' }),
      graph(`${account}/insights`, { level: 'campaign', time_range: tr(since, until), fields: insFields, limit: '500' }),
      graph(`${account}/insights`, { level: 'account', time_range: tr(since, until), fields: 'spend,impressions,reach,frequency,cpm,actions' }),
      cmpSince ? graph(`${account}/insights`, { level: 'campaign', time_range: tr(cmpSince, cmpUntil), fields: insFields, limit: '500' }) : [],
      cmpSince ? graph(`${account}/insights`, { level: 'account', time_range: tr(cmpSince, cmpUntil), fields: 'spend,impressions,reach,frequency,cpm,actions' }) : [],
      // alcance como no Gerenciador: soma do alcance dos conjuntos (a API devolve outro valor no nível campanha/conta)
      graph(`${account}/insights`, { level: 'adset', time_range: tr(since, until), fields: 'campaign_id,reach', limit: '500' }),
      cmpSince ? graph(`${account}/insights`, { level: 'adset', time_range: tr(cmpSince, cmpUntil), fields: 'campaign_id,reach', limit: '500' }) : [],
    ]);
    const reachBy = (list) => list.reduce((m, r) => m.set(r.campaign_id, (m.get(r.campaign_id) || 0) + Number(r.reach || 0)), new Map());
    const reachNow = reachBy(bySet), reachCmp = reachBy(cmpSet);
    // reach/frequência ajustados ao Gerenciador
    const fixReach = (m, reach) => ({ ...m, reach, freq: reach ? m.imp / reach : null });

    // meta de otimização de cada campanha = a mais comum entre os conjuntos
    const goalOf = new Map();
    const count = new Map();
    for (const s of adsets) {
      const k = `${s.campaign_id}|${s.optimization_goal}`;
      count.set(k, (count.get(k) || 0) + 1);
      const cur = goalOf.get(s.campaign_id);
      if (!cur || count.get(k) > count.get(`${s.campaign_id}|${cur}`)) goalOf.set(s.campaign_id, s.optimization_goal);
    }
    const resultsOf = (campId, actions) => {
      const types = RESULT[goalOf.get(campId)]?.[1];
      return actionValue(actions, types)?.value ?? null;
    };

    // orçamento diário atual (campanhas ativas): orçamento da campanha ou soma dos conjuntos ativos
    let dailyBudget = 0;
    for (const c of campaigns.filter((x) => x.effective_status === 'ACTIVE')) {
      if (c.daily_budget) dailyBudget += Number(c.daily_budget) / 100;
      else dailyBudget += adsets.filter((s) => s.campaign_id === c.id && s.effective_status === 'ACTIVE' && s.daily_budget).reduce((t, s) => t + Number(s.daily_budget) / 100, 0);
    }

    const campInfo = new Map(campaigns.map((c) => [c.id, c]));
    const rows = byCamp.map((r) => {
      const c = campInfo.get(r.campaign_id) || {};
      const goal = goalOf.get(r.campaign_id);
      return {
        id: r.campaign_id, name: c.name || r.campaign_name, status: STATUS[c.effective_status] || c.effective_status || '',
        active: c.effective_status === 'ACTIVE', startTime: c.start_time?.slice(0, 10) || '',
        goal, resultLabel: RESULT[goal]?.[0] || 'Resultados', objective: OBJETIVO[goal] || '',
        ...fixReach(metrics(r), reachNow.get(r.campaign_id) || 0), results: resultsOf(r.campaign_id, r.actions),
      };
    }).filter((r) => r.spend > 0 || r.imp > 0).sort((a, b) => b.spend - a.spend);

    const live = campaigns.filter((c) => c.effective_status !== 'DELETED' && c.effective_status !== 'ARCHIVED');
    const withSpend = new Set(rows.map((r) => r.id));
    const idle = live.filter((c) => !withSpend.has(c.id)).map((c) => ({ id: c.id, name: c.name, status: STATUS[c.effective_status] || c.effective_status }));

    const cmpRows = cmpCamp.map((r) => ({ id: r.campaign_id, name: r.campaign_name, goal: goalOf.get(r.campaign_id), ...fixReach(metrics(r), reachCmp.get(r.campaign_id) || 0), results: resultsOf(r.campaign_id, r.actions) }));
    // total: gasto/impressões/CPM da conta; alcance = soma por campanha (como o Gerenciador mostra por linha)
    // resultado total = ação do objetivo principal no nível da conta (inclui o que veio de campanhas com outro objetivo)
    const mainGoal = rows[0]?.goal;
    const accTot = (list, campRows) => {
      if (!list[0]) return null;
      const accRes = actionValue(list[0].actions, RESULT[mainGoal]?.[1])?.value;
      const own = campRows.filter((r) => r.goal === mainGoal || goalOf.get(r.id) === mainGoal).reduce((t, r) => t + (r.results || 0), 0);
      return { ...fixReach(metrics(list[0]), campRows.reduce((t, r) => t + r.reach, 0)), results: accRes ?? own, resultsOwnGoal: own, reachSummed: campRows.filter((r) => r.reach).length > 1 };
    };

    return {
      account, name: info.name, currency: info.currency, timezone: info.timezone_name, since, until, cmpSince: cmpSince || null, cmpUntil: cmpUntil || null,
      fetchedAt: new Date().toISOString(), dailyBudget: dailyBudget || null,
      campaigns: rows, idle,
      total: accTot(acc, rows) || { spend: 0, imp: 0, reach: 0, freq: null, cpm: null, results: 0 },
      compare: cmpSince ? { campaigns: cmpRows, total: accTot(cmpAcc, cmpRows) } : null,
    };
  }, refresh);
}
