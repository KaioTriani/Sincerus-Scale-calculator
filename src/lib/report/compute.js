// Cálculos e textos do relatório. Usa só os números informados; tudo derivado é marcado como calculado.

const ACTIVE = new Set(['ativo', 'active', 'aprendizado', 'learning', 'aprendizado limitado', 'learning limited', 'em veiculacao', 'veiculando']);
export const isActive = (status) => ACTIVE.has(String(status).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim());

const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const byGasto = (a, b) => b.spend - a.spend || a.id - b.id;
const nf = (d) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const z = (v) => (Math.abs(v) < 0.005 ? 0 : v);

export function makeFmt(currency, rate) {
  const conv = currency === 'USD';
  const usd = (v, d = 2) => (v == null ? '—' : 'US$ ' + nf(d).format(z(v)));
  const brl = (v, d = 2) => (v == null ? '—' : 'R$ ' + nf(d).format(z(v)));
  return {
    conv,
    rate: conv ? rate : 1,
    usd, brl,
    money: (v, d = 2) => (conv ? usd(v, d) : brl(v, d)), // moeda original da conta
    both: (v, d = 2) => (v == null ? '—' : conv ? `${usd(v, d)} | ${brl(v * rate, d)}` : brl(v, d)),
    int: (v) => (v == null ? '—' : nf(0).format(v)),
    pct: (v, d = 1) => (v == null ? '—' : nf(d).format(v * 100) + '%'),
    dec: (v, d = 2) => (v == null ? '—' : nf(d).format(v)),
  };
}

export const carro = (a) => (!a.brand && !a.model && !a.year ? 'não identificado no nome' : [a.brand ?? 'n/i', a.model ?? 'n/i', a.year ?? 'n/i'].join(' · '));
export const curto = (a) => {
  const base = a.name.replace(/^ADS\s*[-–]\s*/i, '');
  return `${base.length > 22 ? base.slice(0, 21) + '…' : base} #${a.id}`;
};

export function compute(report) {
  const F = makeFmt(report.currency, Number(report.rate) || 0);
  const camps = report.campaigns.map((c, ci) => {
    const ads = c.ads.map((a, i) => ({ ...a, id: i + 1, ativo: isActive(a.status) }));
    const sum = (list, k) => list.reduce((s, a) => s + (a[k] ?? 0), 0);
    const spend = sum(ads, 'spend'), imp = sum(ads, 'imp'), reach = sum(ads, 'reach'), results = sum(ads, 'results');
    for (const a of ads) {
      a.brl = a.spend * F.rate;
      a.pct = spend ? a.spend / spend : 0;
      // valor do arquivo quando existe; senão, calculado
      a.cpmC = a.cpm ?? (a.imp ? (a.spend / a.imp) * 1000 : null);
      a.freqC = a.freq ?? (a.imp && a.reach ? a.imp / a.reach : null);
      a.cprC = a.results ? a.spend / a.results : null;
    }
    const grp = (list) => {
      const g = { list: [...list].sort(byGasto), spend: sum(list, 'spend'), imp: sum(list, 'imp'), reach: sum(list, 'reach'), results: sum(list, 'results') };
      g.brl = g.spend * F.rate; g.pct = spend ? g.spend / spend : 0;
      return g;
    };
    return {
      ...c,
      num: String(ci + 1).padStart(2, '0'),
      ads,
      ativos: grp(ads.filter((a) => a.ativo)),
      nao: grp(ads.filter((a) => !a.ativo)),
      spend, brl: spend * F.rate, imp, reach, results,
      cpr: results ? spend / results : null,
      cpm: imp ? (spend / imp) * 1000 : null,
      freq: reach ? imp / reach : null,
      difCentavos: r2(ads.reduce((s, a) => s + r2(a.brl), 0) - r2(spend * F.rate)),
      top: (k, n = 5) => [...ads].filter((a) => (a[k] ?? 0) > 0).sort((a, b) => (b[k] ?? 0) - (a[k] ?? 0) || a.id - b.id).slice(0, n),
    };
  });
  const all = camps.flatMap((c) => c.ads.map((a) => ({ ...a, camp: c.num, resultShort: c.resultShort })));
  const tot = {
    spend: camps.reduce((s, c) => s + c.spend, 0),
    imp: camps.reduce((s, c) => s + c.imp, 0),
    reach: camps.reduce((s, c) => s + c.reach, 0),
    n: all.length,
    nAtivos: all.filter((a) => a.ativo).length,
  };
  tot.brl = tot.spend * F.rate;
  tot.difCentavos = r2(camps.reduce((s, c) => s + r2(c.brl), 0) - r2(tot.brl));

  for (const c of camps) Object.assign(c, texts(c, F, report));
  const cmp = comparison(camps, tot, F);
  const checks = validation(report, camps, tot, F);
  return { F, camps, all, tot, cmp, checks };
}

const nm = (a) => `<b>${esc(curto(a))}</b>`;
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const li = (arr) => `<ul>${arr.filter(Boolean).map((x) => `<li>${x}</li>`).join('')}</ul>`;
const sug = (t) => `<span class="tag sug">sugestão</span>${t}`;
// 'visitas ao perfil' -> 'visita ao perfil', 'seguidores' -> 'seguidor'
export const singular = (s) => (s || 'resultados').replace(/^(\S+)/,(w) => (/ores$/i.test(w) ? w.slice(0, -2) : w.replace(/s$/i, '')));
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function texts(c, F, report) {
  const r = c.resultShort || 'resultados';
  const comRes = c.ads.filter((a) => a.results);
  const withSpend = c.ads.filter((a) => a.spend > 0);
  const maior = c.top('spend', 1)[0];
  const maisRes = [...comRes].sort((a, b) => b.results - a.results || a.id - b.id)[0];
  const baratos = [...comRes].sort((a, b) => a.cprC - b.cprC).slice(0, 3);
  const naoComGasto = c.nao.list.filter((a) => a.spend > 0);
  const naoZero = c.nao.list.filter((a) => a.spend === 0);
  const d4 = (v) => (v != null && v < 0.1 ? 4 : 2);

  const resumo = [
    `Investimento no período: <b>${F.money(c.spend)}</b>${F.conv ? ` (<b>${F.brl(c.brl)}</b>)` : ''}, com ${F.int(c.imp)} impressões e alcance de ${F.int(c.reach)} somado por anúncio.`,
    c.results ? `${F.int(c.results)} ${esc(r)}; custo médio calculado de ${F.money(c.cpr, d4(c.cpr))}${F.conv ? ` (${F.brl(c.cpr * F.rate, d4(c.cpr * F.rate))})` : ''} por ${esc(singular(r))}. CPM calculado: ${F.money(c.cpm)}.` : `Nenhum resultado registrado no período. CPM calculado: ${F.money(c.cpm)}.`,
    `${plural(c.ads.length, 'anúncio', 'anúncios')}: ${plural(c.ativos.list.length, 'ativo', 'ativos')} (${F.money(c.ativos.spend)}; ${F.pct(c.ativos.pct)} do gasto) e ${plural(c.nao.list.length, 'não ativo', 'não ativos')} — ${naoComGasto.length} com gasto no período (${F.money(c.nao.spend)}) e ${naoZero.length} sem gasto.`,
    maior && `Maior gasto: ${nm(maior)} — ${F.money(maior.spend)} (${F.pct(maior.pct)} da campanha)${maior.results ? `, ${F.int(maior.results)} ${esc(r)} a ${F.money(maior.cprC, d4(maior.cprC))}` : ', sem resultado registrado'}.`,
    maisRes && maisRes !== maior && `Mais ${esc(r)}: ${nm(maisRes)} — ${F.int(maisRes.results)} a ${F.money(maisRes.cprC, d4(maisRes.cprC))}.`,
    baratos.length > 1 && `Menores custos por ${esc(singular(r))}: ${baratos.map((a) => `${nm(a)} ${F.money(a.cprC, d4(a.cprC))} (${F.int(a.results)})`).join('; ')}.`,
  ].filter(Boolean);

  const lim = c.cpr ? c.cpr * 1.5 : null;
  const caros = lim ? comRes.filter((a) => a.cprC >= lim).sort((a, b) => b.cprC - a.cprC) : [];
  const semRes = withSpend.filter((a) => !a.results);
  const fAds = c.ads.filter((a) => a.freqC);
  const fmax = [...fAds].sort((a, b) => b.freqC - a.freqC)[0];
  const fAlta = c.freq ? fAds.filter((a) => a.freqC >= c.freq * 1.3) : [];
  const abx = (k) => c.ads.filter((a) => a[k] && /^abaixo|below/i.test(a[k])).map(nm).join(', ') || 'nenhum';
  const hasRank = c.ads.some((a) => a.q || a.e || a.cv);
  const pt = c.printTotals ?? {};
  const totalNote = pt.spend != null
    ? (Math.abs(pt.spend - c.spend) < 0.005 && (pt.imp == null || pt.imp === c.imp)
      ? `A soma das linhas confere com o total do Gerenciador (${F.money(pt.spend)}${pt.imp != null ? `, ${F.int(pt.imp)} impressões` : ''}).`
      : `<b>Divergência:</b> soma das linhas ${F.money(c.spend)} / ${F.int(c.imp)} impr. × total do Gerenciador ${F.money(pt.spend)}${pt.imp != null ? ` / ${F.int(pt.imp)} impr.` : ''}. Diferença de ${F.money(c.spend - pt.spend)}.`)
    : 'O total do Gerenciador não foi informado; a soma das linhas não pôde ser conferida.';
  const cprChecked = comRes.filter((a) => a.cpr != null);
  const cprOk = cprChecked.filter((a) => Math.abs(r2(a.cprC) - a.cpr) < 0.0051 || Math.abs(a.cprC - a.cpr) < 0.0051);
  const reactivate = naoComGasto.filter((a) => a.results && c.cpr && a.cprC < c.cpr && a.results >= Math.max(3, c.results * 0.05)).sort((a, b) => b.results - a.results);

  const alertas = `<div class="alert">
    <h4>Dados ausentes e divergências</h4>${li([
      totalNote,
      ...(c.notes ?? []).map(esc),
      cprChecked.length ? `Custo por resultado recalculado (gasto ÷ resultados) confere com o valor importado em ${cprOk.length} de ${cprChecked.length} linhas.` : null,
      `Frequência e CPM são calculados quando não vêm no arquivo. ${c.hasClicks ? '' : 'Cliques e CTR: n/d. '}`,
      c.ads.some((a) => a.edited) ? `${c.ads.filter((a) => a.edited).length} linha(s) foram digitadas ou editadas manualmente — confira contra o Gerenciador.` : null,
    ])}
    <h4>Gasto alto e poucos resultados</h4>${li([
      lim ? `Critério: custo por ${esc(singular(r))} ≥ 1,5× a média da campanha (${F.money(c.cpr, d4(c.cpr))} → limite ${F.money(lim, d4(lim))}). ${caros.length ? `Anúncios: ${caros.map((a) => `${nm(a)} ${F.money(a.cprC, d4(a.cprC))} (${F.int(a.results)} ${esc(r)}, ${F.money(a.spend)}, ${esc(a.status)})`).join('; ')}.` : 'Nenhum anúncio acima do limite.'}` : 'Sem resultados registrados para calcular custo por resultado.',
      maior && maior.pct >= 0.4 ? `Concentração: ${nm(maior)} responde por ${F.pct(maior.pct)} do gasto da campanha.` : null,
      semRes.length ? `Gasto sem resultado registrado: ${semRes.map((a) => `${nm(a)} ${F.money(a.spend)}`).join('; ')}.` : 'Todos os anúncios com gasto registraram resultado.',
    ])}
    <h4>Frequência</h4>${li([
      fmax ? `Frequência calculada da campanha: ${F.dec(c.freq)}. Maior: ${nm(fmax)} com ${F.dec(fmax.freqC)} (${F.dec(fmax.freqC / c.freq)}× a média). ${fAlta.length ? `Acima de 1,3× a média: ${fAlta.map(nm).join(', ')}.` : 'Nenhum anúncio ficou 1,3× acima da média.'}` : 'Sem impressões e alcance suficientes para calcular frequência.',
    ])}
    ${hasRank ? `<h4>Classificações "abaixo da média" no Gerenciador</h4>${li([`Qualidade: ${abx('q')}.`, `Taxa de engajamento: ${abx('e')}.`, `Taxa de conversão: ${abx('cv')}.`])}` : ''}
    <h4>Sugestões (sem afirmar causas)</h4>${li([
      caros.length ? sug(`Revisar ${caros.slice(0, 2).map(nm).join(' e ')} comparando criativo e oferta com os anúncios de menor custo por ${esc(singular(r))}.`) : null,
      caros.some((a) => a.ativo) ? sug(`Acompanhar de perto ${caros.filter((a) => a.ativo).map(nm).join(', ')}, que segue(m) ativo(s) com custo acima do limite.`) : null,
      reactivate.length ? sug(`Avaliar testar novamente anúncios não ativos com volume e custo abaixo da média: ${reactivate.slice(0, 4).map((a) => `${nm(a)} (${F.int(a.results)} a ${F.money(a.cprC, d4(a.cprC))})`).join(', ')}.`) : null,
      withSpend.length === 1 ? sug('Com um único anúncio veiculando, considerar testar um segundo criativo para ter comparação.') : null,
      sug(`Registrar quantos resultados (${esc(r)}) avançam para visita, proposta e venda, para julgar os anúncios também pela qualidade, não só pelo custo.`),
    ])}</div>`;

  return { resumo, alertas, hasRank };
}

function comparison(camps, tot, F) {
  if (camps.length < 2) return [];
  const lines = [
    `Gasto: ${camps.map((c) => `campanha ${c.num} ${F.money(c.spend)} (${F.pct(c.spend / tot.spend)})`).join(' × ')}. Total ${F.money(tot.spend)}${F.conv ? ` = ${F.brl(tot.brl)}` : ''}.`,
    `Impressões e CPM calculado: ${camps.map((c) => `${c.num} = ${F.int(c.imp)} (${F.pct(c.imp / tot.imp)}), CPM ${F.money(c.cpm)}`).join('; ')}.`,
    `Alcance (soma por anúncio) e frequência calculada: ${camps.map((c) => `${c.num} = ${F.int(c.reach)}, freq. ${F.dec(c.freq)}`).join('; ')}.`,
    `Gasto em anúncios ativos: ${camps.map((c) => `${c.num} = ${F.money(c.ativos.spend)} (${F.pct(c.ativos.pct)})`).join('; ')}.`,
  ];
  const types = new Set(camps.map((c) => (c.resultType || '').toLowerCase()));
  lines.push(types.size > 1
    ? `Resultados: ${camps.map((c) => `${c.num} = ${esc(c.resultShort)}`).join('; ')}. Objetivos diferentes — não somados nem comparados.`
    : `Resultados do mesmo tipo (${esc(camps[0].resultShort)}): ${camps.map((c) => `${c.num} = ${F.int(c.results)} a ${F.money(c.cpr)}`).join('; ')}.`);
  return lines;
}

function validation(report, camps, tot, F) {
  const withData = camps.flatMap((c) => c.ads.filter((a) => a.spend > 0).map((a) => ({ a, c })));
  let seed = 20261103;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = [];
  while (pick.length < Math.min(3, withData.length)) { const x = withData[Math.floor(rnd() * withData.length)]; if (!pick.includes(x)) pick.push(x); }
  const totalsInfo = camps.map((c) => {
    const pt = c.printTotals ?? {};
    if (pt.spend == null) return { c, state: 'missing' };
    const ok = Math.abs(pt.spend - c.spend) < 0.005 && (pt.imp == null || pt.imp === c.imp);
    return { c, state: ok ? 'ok' : 'diff', pt };
  });
  const periodOk = camps.every((c) => c.periodStatus === 'ok');
  return [
    ['Todos os anúncios aparecem', true, camps.map((c) => `Campanha ${c.num}: ${c.ads.length} anúncios`).join('. ') + `. Total: ${tot.n}.`],
    ['Ativos + não ativos = total', camps.every((c) => c.ativos.list.length + c.nao.list.length === c.ads.length), camps.map((c) => `${c.num}: ${c.ativos.list.length} + ${c.nao.list.length} = ${c.ads.length}`).join('. ') + '.'],
    ['Soma das linhas = total do Gerenciador', totalsInfo.every((t) => t.state === 'ok') ? true : 'warn',
      totalsInfo.map(({ c, state, pt }) => state === 'missing' ? `${c.num}: total não informado — soma ${F.money(c.spend)}, ${F.int(c.imp)} impr.` : state === 'ok' ? `${c.num}: confere (${F.money(c.spend)})` : `${c.num}: soma ${F.money(c.spend)} × Gerenciador ${F.money(pt.spend)} (diferença ${F.money(c.spend - pt.spend)})`).join('<br>')],
    [`Período ${report.periodLabel}`, periodOk ? true : 'warn', camps.map((c) => `${c.num}: ${esc(c.periodNote ?? '')}`).join('<br>')],
    ['Cotação aplicada em todas as linhas', true, F.conv
      ? `Todas as ${tot.n} linhas: BRL = USD × ${F.dec(F.rate, 4)}. Diferença de centavos entre soma das linhas BRL arredondadas e total: ${camps.map((c) => `${c.num} = ${F.brl(c.difCentavos)}`).join('; ')}; geral = ${F.brl(tot.difCentavos)}.`
      : 'Conta em real (R$): sem conversão de moeda.'],
    ['Conferência de 3 linhas sorteadas', pick.some(({ a }) => a.edited) ? 'warn' : true,
      pick.map(({ a, c }) => `${c.num} · ${esc(a.name)}: ${esc(a.status)}, ${F.money(a.spend)}, ${F.int(a.imp)} impr., ${F.int(a.reach)} alc., ${a.results ?? '—'} result. — ${a.edited ? 'linha editada manualmente: conferir no Gerenciador' : c.source === 'file' ? 'igual ao arquivo importado' : c.source === 'meta' ? 'igual ao retorno da API da Meta' : 'transcrito e confirmado pelo usuário'}`).join('<br>') || 'Sem linhas com gasto.'],
    ['Nenhum número estimado ou inventado', true, 'Somente valores importados ou digitados. Métricas derivadas marcadas como calculadas; colunas ausentes como n/d; campos sem valor como "—".'],
  ];
}
