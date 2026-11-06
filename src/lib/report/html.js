// Monta o relatório em HTML (páginas A4 paisagem) com a identidade Sincerus.
// Mesmo layout do modelo de relatório Sincerus.
import css from './report.css?raw';
import { carro, curto, esc, singular, plural } from './compute';

const OR = '#F76000', DK = '#0C0D0F', GR = '#5B6068';
const colorOf = (a) => (a.ativo ? OR : GR);
const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function niceMax(v, steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of steps) if (m * p >= v) return m * p;
  return 10 * p;
}
const kAxis = (v) => (v >= 1000 ? nf1.format(v / 1000) + ' mil' : nf0.format(v));

function hbar({ title, sub = '', items, w = 800, labelW = 170, valueW = 150, axisFmt = kAxis }) {
  const rowH = 22, top = sub ? 44 : 32, bottom = 26;
  const h = top + Math.max(items.length, 1) * rowH + bottom;
  const plotW = w - labelW - valueW - 16;
  const max = niceMax(Math.max(...items.map((i) => i.value), 0));
  const x = (v) => labelW + (v / max) * plotW;
  let s = `<svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Verdana, DejaVu Sans, sans-serif">`;
  s += `<rect width="${w}" height="${h}" fill="#F8F8F8"/><text x="14" y="21" font-size="13" font-weight="700" fill="${DK}">${esc(title)}</text>`;
  if (sub) s += `<text x="14" y="36" font-size="9.5" fill="#6B7078">${esc(sub)}</text>`;
  for (let t = 0; t <= 5; t++) {
    const v = (max * t) / 5, xx = x(v);
    s += `<line x1="${xx}" y1="${top - 4}" x2="${xx}" y2="${h - bottom + 2}" stroke="#E2E3E5"/><text x="${xx}" y="${h - 10}" font-size="9" fill="#6B7078" text-anchor="middle">${esc(axisFmt(v))}</text>`;
  }
  items.forEach((it, i) => {
    const y = top + i * rowH, bw = Math.max(x(it.value) - labelW, it.value > 0 ? 1.5 : 0);
    s += `<text x="${labelW - 8}" y="${y + rowH / 2 + 3.5}" font-size="10" fill="${DK}" text-anchor="end">${esc(it.label)}</text>`;
    s += `<rect x="${labelW}" y="${y + 4}" width="${bw}" height="${rowH - 8}" fill="${it.color}" rx="1"/>`;
    s += `<text x="${labelW + bw + 6}" y="${y + rowH / 2 + 3.5}" font-size="9.5" font-weight="700" fill="${DK}">${esc(it.valueLabel)}</text>`;
  });
  return s + `<line x1="${labelW}" y1="${top - 4}" x2="${labelW}" y2="${h - bottom + 2}" stroke="#9A9EA4"/></svg>`;
}

function stacked({ title, rows, w = 560, valueW = 80, axisFmt = kAxis, labelFmt }) {
  const labelW = 110, rowH = 34, top = 34, bottom = 44;
  const h = top + rows.length * rowH + bottom;
  const plotW = w - labelW - valueW - 10;
  const max = niceMax(Math.max(...rows.map((r) => r.a + r.n), 0), [1, 1.2, 1.6, 2, 2.4, 3, 4, 6, 8, 10]);
  const x = (v) => labelW + (v / max) * plotW;
  let s = `<svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Verdana, DejaVu Sans, sans-serif"><rect width="${w}" height="${h}" fill="#F8F8F8"/>`;
  s += `<text x="12" y="21" font-size="12.5" font-weight="700" fill="${DK}">${esc(title)}</text>`;
  for (let t = 0; t <= 4; t++) {
    const v = (max * t) / 4, xx = x(v);
    s += `<line x1="${xx}" y1="${top - 2}" x2="${xx}" y2="${h - bottom + 2}" stroke="#E2E3E5"/><text x="${xx}" y="${h - bottom + 14}" font-size="8.5" fill="#6B7078" text-anchor="middle">${esc(axisFmt(v))}</text>`;
  }
  rows.forEach((r, i) => {
    const y = top + i * rowH, wa = x(r.a) - labelW, wn = x(r.a + r.n) - x(r.a);
    s += `<text x="${labelW - 8}" y="${y + rowH / 2 + 4}" font-size="10" fill="${DK}" text-anchor="end">${esc(r.label)}</text>`;
    s += `<rect x="${labelW}" y="${y + 6}" width="${wa}" height="${rowH - 12}" fill="${OR}"/>`;
    if (wn > 0) s += `<rect x="${labelW + wa}" y="${y + 6}" width="${Math.max(wn, 1.5)}" height="${rowH - 12}" fill="${GR}"/>`;
    s += `<text x="${labelW + wa + Math.max(wn, 0) + 6}" y="${y + rowH / 2 + 4}" font-size="9.5" font-weight="700" fill="${DK}">${esc(labelFmt(r.a + r.n))}</text>`;
  });
  const ly = h - 12;
  s += `<line x1="${labelW}" y1="${top - 2}" x2="${labelW}" y2="${h - bottom + 2}" stroke="#9A9EA4"/>`;
  s += `<rect x="${labelW}" y="${ly - 8}" width="10" height="10" fill="${OR}"/><text x="${labelW + 14}" y="${ly}" font-size="9" fill="${DK}">Ativos</text>`;
  s += `<rect x="${labelW + 70}" y="${ly - 8}" width="10" height="10" fill="${GR}"/><text x="${labelW + 84}" y="${ly}" font-size="9" fill="${DK}">Não ativos</text>`;
  return s + '</svg>';
}

export function buildReportHtml(report, { F, camps, all, tot, cmp, checks }, logoDataUrl) {
  const conv = F.conv;
  const rateTxt = F.dec(F.rate, 4);
  const footer = conv ? `Fonte: dados do Gerenciador de Anúncios · Cotação USD→BRL ${rateTxt}` : 'Fonte: dados do Gerenciador de Anúncios';
  const d4 = (v) => (v != null && v < 0.1 ? 4 : 2);
  const legend = `<div class="legend"><span class="sw" style="background:${OR}"></span>Ativo <span class="sw" style="background:${GR}"></span>Não ativo (status no dia da exportação; a mesma cor identifica o anúncio em todos os gráficos)</div>`;
  const kpis = (items) => `<div class="kpis">${items.map(([l, v, s]) => `<div><span>${l}</span><b>${v}</b>${s ? `<i>${s}</i>` : ''}</div>`).join('')}</div>`;
  const NOTA = report.rateNote;

  let pageNo = 0;
  const page = (body, cover = false) => {
    pageNo++;
    return `<section class="page${cover ? ' cover' : ''}"><div class="bar"></div>
      ${cover ? '' : `<header><b>SINCERUS SCALE&nbsp; / &nbsp;RELATÓRIO DE TRÁFEGO PAGO&nbsp; / &nbsp;${esc(report.client.toUpperCase())}</b><span>${esc(report.periodShort)}</span></header>`}
      <main>${body}</main><footer><span>${footer}</span><span>${pageNo}</span></footer></section>`;
  };

  // ---------- tabela de anúncios ----------
  const cols = conv
    ? [['ID', 9], ['Anúncio', 41], ['Carro (marca · modelo · ano)', 37], ['Status', 18], ['Gasto USD', 19, 1], ['Gasto BRL', 20, 1], ['% gasto<sup>c</sup>', 13, 1], ['Impressões', 17, 1], ['Alcance', 16, 1], ['RES', 15, 1], ['Custo/res. (arquivo)', 16, 1], ['Custo/res.<sup>c</sup>', 18, 1], ['Freq.', 10, 1], ['CPM', 16, 1]]
    : [['ID', 9], ['Anúncio', 50], ['Carro (marca · modelo · ano)', 40], ['Status', 18], ['Gasto', 21, 1], ['% gasto<sup>c</sup>', 13, 1], ['Impressões', 18, 1], ['Alcance', 17, 1], ['RES', 16, 1], ['Custo/res. (arquivo)', 17, 1], ['Custo/res.<sup>c</sup>', 18, 1], ['Freq.', 11, 1], ['CPM', 17, 1]];
  const tableOpen = (resL) => `<table class="ads"><colgroup>${cols.map(([, w]) => `<col style="width:${w}mm">`).join('')}</colgroup><thead><tr>${cols.map(([t, , n]) => `<th${n ? ' class="n"' : ''}>${t === 'RES' ? esc(resL) : t}</th>`).join('')}</tr></thead><tbody>`;
  const row = (a) => `<tr><td>#${a.id}</td><td class="nm">${esc(a.name)}</td><td class="car">${esc(carro(a))}</td><td>${esc(a.status)}</td>
    <td class="n">${F.money(a.spend)}</td>${conv ? `<td class="n">${F.brl(a.brl)}</td>` : ''}<td class="n">${F.pct(a.pct)}</td>
    <td class="n">${F.int(a.imp)}</td><td class="n">${F.int(a.reach)}</td><td class="n">${F.int(a.results)}</td>
    <td class="n">${F.money(a.cpr, d4(a.cpr))}</td><td class="n">${F.money(a.cprC, d4(a.cprC))}</td><td class="n">${F.dec(a.freqC)}</td><td class="n">${F.money(a.cpmC)}</td></tr>`;
  const sumRow = (label, g, cls = 'sub') => {
    const cpr = g.results ? g.spend / g.results : null;
    return `<tr class="${cls}"><td></td><td colspan="3">${label}</td><td class="n">${F.money(g.spend)}</td>${conv ? `<td class="n">${F.brl(g.spend * F.rate)}</td>` : ''}<td class="n">${F.pct(g.pct)}</td>
      <td class="n">${F.int(g.imp)}</td><td class="n">${F.int(g.reach)}*</td><td class="n">${F.int(g.results)}</td><td class="n">—</td>
      <td class="n">${F.money(cpr, d4(cpr))}</td><td class="n">${F.dec(g.reach ? g.imp / g.reach : null)}</td><td class="n">${F.money(g.imp ? (g.spend / g.imp) * 1000 : null)}</td></tr>`;
  };
  const rankTable = (title, list, fmt) => `<div class="rank"><h4>${title}</h4><table><tbody>${list.map((a, i) => `<tr><td class="pos">${i + 1}</td><td>${esc(curto(a))}</td><td class="n">${fmt(a)}</td></tr>`).join('') || '<tr><td>—</td></tr>'}</tbody></table></div>`;

  const pages = [];
  // ---------- capa ----------
  pages.push(page(`
    <div class="logo"><img src="${logoDataUrl}"></div>
    <h1 class="big">RELATÓRIO DE DESEMPENHO</h1>
    <h2 class="kicker">TRÁFEGO PAGO • META ADS • ${esc(report.client.toUpperCase())} • ${esc(report.periodLong.toUpperCase())}</h2>
    <p class="lead">Desempenho dos anúncios de ${camps.length === 1 ? 'uma campanha' : `${camps.length} campanhas`} da conta ${esc(report.client)}, com base nos dados do Gerenciador de Anúncios.${report.originalCurrency === 'BRL' ? ' Conta em real (R$): valores em R$ como no Gerenciador e em dólar (US$) convertidos por uma única cotação.' : ' Valores originais em dólar (USD), convertidos para real (BRL) por uma única cotação.'}</p>
    <hr class="or">
    ${kpis([
      [conv ? 'Investimento total (USD)' : 'Investimento total', F.money(tot.spend)],
      ...(conv ? [['Investimento total (BRL)', F.brl(tot.brl)]] : []),
      ['Impressões', F.int(tot.imp)],
      ['Alcance (soma por anúncio)', F.int(tot.reach)],
      ['Anúncios analisados', `${tot.n}`, `${plural(tot.nAtivos, 'ativo', 'ativos')} · ${plural(tot.n - tot.nAtivos, 'não ativo', 'não ativos')}`],
    ])}
    <h3>RESUMO POR CAMPANHA</h3>
    <table class="std"><thead><tr><th>Campanha</th><th>Conjunto</th><th class="n">Gasto${conv ? ' USD' : ''}</th>${conv ? '<th class="n">Gasto BRL</th>' : ''}<th class="n">Impressões</th><th class="n">Alcance*</th><th class="n">Resultados registrados</th><th class="n">Custo/resultado<sup>c</sup></th></tr></thead><tbody>
    ${camps.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.adset || '—')}</td><td class="n">${F.money(c.spend)}</td>${conv ? `<td class="n">${F.brl(c.brl)}</td>` : ''}<td class="n">${F.int(c.imp)}</td><td class="n">${F.int(c.reach)}</td><td class="n">${F.int(c.results)} ${esc(c.resultShort)}</td><td class="n">${F.money(c.cpr, d4(c.cpr))}</td></tr>`).join('')}
    ${camps.length > 1 ? `<tr class="tot"><td colspan="2">TOTAL</td><td class="n">${F.money(tot.spend)}</td>${conv ? `<td class="n">${F.brl(tot.brl)}</td>` : ''}<td class="n">${F.int(tot.imp)}</td><td class="n">${F.int(tot.reach)}</td><td class="n">${new Set(camps.map((c) => c.resultType)).size > 1 ? 'não somados' : F.int(camps.reduce((s, c) => s + c.results, 0))}</td><td class="n">—</td></tr>` : ''}
    </tbody></table>
    <div class="cols2 small-gap">
      ${conv ? `<div class="box"><b>Cotação usada: US$ 1,00 = R$ ${rateTxt}</b><br>${esc(report.rateSource || 'Cotação informada pelo usuário.')}<br><i>${NOTA}</i></div>` : `<div class="box"><b>Moeda:</b> conta de anúncios em real (R$). Nenhuma conversão aplicada.</div>`}
      <div class="box"><b>Leitura importante:</b> ${camps.length > 1 && new Set(camps.map((c) => c.resultType)).size > 1 ? `as campanhas medem resultados diferentes (${camps.map((c) => `${c.num}: ${esc(c.resultShort)}`).join('; ')}). Por isso os resultados não foram somados nem comparados em um único indicador.` : 'os resultados seguem o indicador exibido no Gerenciador para cada campanha.'}<br>*Alcance somado por anúncio — não representa pessoas únicas.</div>
    </div>
    <p class="meta">Período: ${esc(report.periodLabel)}. Relatório gerado em ${esc(report.generatedAt)}. <sup>c</sup> = calculado a partir dos números informados.</p>
  `, true));

  // ---------- campanhas ----------
  for (const c of camps) {
    const resL = c.resultShort ? c.resultShort[0].toUpperCase() + c.resultShort.slice(1) : 'Resultados';
    pages.push(page(`<h1>${c.num} / ${esc((c.label || c.name).toUpperCase())}</h1>
      <p class="lead">Campanha <b>${esc(c.name)}</b> · Conjunto <b>${esc(c.adset || '—')}</b> · Período ${esc(report.periodLabel)}${conv ? ` · Cotação ${rateTxt}` : ''} · Gerado em ${esc(report.generatedAt)}<br>Resultado: ${esc(c.resultType || 'n/d')}${c.attribution ? ` · Atribuição: ${esc(c.attribution)}` : ''}${c.budget ? ` · Orçamento: ${esc(c.budget)}` : ''}</p>
      ${kpis([
        ['Investimento', F.money(c.spend), conv ? F.brl(c.brl) : ''],
        [esc(c.resultShort || 'Resultados'), F.int(c.results)],
        [`Custo / ${esc(singular(c.resultShort))} (calc.)`, F.money(c.cpr, d4(c.cpr)), conv && c.cpr != null ? F.brl(c.cpr * F.rate, d4(c.cpr * F.rate)) : ''],
        ['Impressões', F.int(c.imp), `CPM calc. ${F.money(c.cpm)}`],
        ['Alcance (soma)', F.int(c.reach), `Freq. calc. ${F.dec(c.freq)}`],
        ['Anúncios', `${c.ads.length}`, `${plural(c.ativos.list.length, 'ativo', 'ativos')} · ${plural(c.nao.list.length, 'não ativo', 'não ativos')}`],
      ])}
      <h3>RESUMO EXECUTIVO</h3><ul class="exec">${c.resumo.map((l) => `<li>${l}</li>`).join('')}</ul>
      <h3>RANKINGS ${c.ads.length < 10 ? '(todos os anúncios — menos de 10)' : '(top 5)'}</h3><div class="cols3">
        ${rankTable('Por gasto', c.top('spend', c.ads.length < 10 ? 99 : 5), (a) => F.both(a.spend))}
        ${rankTable('Por impressões', c.top('imp', c.ads.length < 10 ? 99 : 5), (a) => F.int(a.imp))}
        ${rankTable('Por alcance', c.top('reach', c.ads.length < 10 ? 99 : 5), (a) => F.int(a.reach))}</div>`));

    // paginação das tabelas: cabeçalho de seção = 3 unidades, linha = 1
    const items = [];
    const pushGroup = (label, g) => {
      items.push({ t: 'h', label, n: g.list.length });
      g.list.forEach((a) => items.push({ t: 'r', a }));
      items.push({ t: 's', html: sumRow(`Subtotal ${label}`, g) });
    };
    pushGroup('ATIVOS', c.ativos);
    pushGroup('NÃO ATIVOS', c.nao);
    items.push({ t: 's', html: sumRow('TOTAL DA CAMPANHA', { ...c, pct: 1 }, 'tot') });
    const CAP = 25;
    const chunks = [];
    let cur = [], used = 0;
    for (const it of items) {
      const cost = it.t === 'h' ? 3 : 1;
      if (used + cost > CAP && cur.length) { chunks.push(cur); cur = []; used = 0; }
      cur.push(it); used += cost;
    }
    chunks.push(cur);
    chunks.forEach((chunk, pi) => {
      let html = '', open = false, group = null;
      const close = () => { if (open) { html += '</tbody></table>'; open = false; } };
      chunk.forEach((it, k) => {
        if (it.t === 'h') { close(); group = it.label; html += `<h2 class="sec">${c.num} / ANÚNCIOS ${it.label} <span>(${it.n}) — ordenados por gasto</span></h2>`; html += tableOpen(resL); open = true; return; }
        if (!open) { html += `<h2 class="sec">${c.num} / ANÚNCIOS ${group ?? findGroup(items, it)} <span>— continuação</span></h2>` + tableOpen(resL); open = true; }
        html += it.t === 'r' ? row(it.a) : it.html;
      });
      close();
      if (pi === chunks.length - 1) {
        html += `<p class="note">${conv ? NOTA + ` Cotação ${rateTxt}. ` : ''}<sup>c</sup> calculado: % gasto = gasto ÷ gasto da campanha; custo/res. = gasto ÷ resultados. Freq. e CPM vêm do arquivo quando existem; senão, freq. = impressões ÷ alcance e CPM = gasto ÷ impressões × 1.000. *Alcance de subtotal/total = soma por anúncio, não pessoas únicas. "—" = sem valor. n/i = não identificado no nome do anúncio.${c.hasClicks ? '' : ' Cliques e CTR: n/d.'}</p>`;
      }
      pages.push(page(html));
    });
    function findGroup(list, it) { const idx = list.indexOf(it); for (let i = idx; i >= 0; i--) if (list[i].t === 'h') return list[i].label; return ''; }

    if (c.hasRank) {
      const rk = c.ads.filter((a) => a.q || a.e || a.cv);
      for (let i = 0; i < rk.length; i += 24) {
        pages.push(page(`<h2 class="sec">${c.num} / CLASSIFICAÇÕES DE DIAGNÓSTICO DO GERENCIADOR</h2><table class="std q"><thead><tr><th>Anúncio</th><th>Qualidade</th><th>Taxa de engajamento</th><th>Taxa de conversão</th></tr></thead><tbody>
          ${rk.slice(i, i + 24).map((a) => `<tr><td>${esc(curto(a))}</td>${[a.q, a.e, a.cv].map((v) => `<td class="${v && /^abaixo|below/i.test(v) ? 'neg' : ''}">${esc(v ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table>`));
      }
    }

    // gráficos
    const n = 10;
    const lbl = n >= c.ads.length ? `todos os ${c.ads.length} anúncios` : 'top 10';
    const by = (k) => [...c.ads].sort((a, b) => (b[k] ?? 0) - (a[k] ?? 0) || a.id - b.id).slice(0, n);
    const moneyAxis = (v) => (conv ? 'US$ ' : 'R$ ') + (v >= 1000 ? nf1.format(v / 1000) + ' mil' : nf0.format(v));
    const gasto = hbar({ title: `Gasto por anúncio — ${lbl}`, sub: conv ? `Rótulo: USD | BRL (cotação ${rateTxt})` : '', labelW: 190, valueW: conv ? 190 : 110, axisFmt: moneyAxis, items: by('spend').map((a) => ({ label: curto(a), value: a.spend, color: colorOf(a), valueLabel: F.both(a.spend) })) });
    const imp = hbar({ title: `Impressões — ${lbl}`, w: 560, labelW: 180, valueW: 70, items: by('imp').map((a) => ({ label: curto(a), value: a.imp ?? 0, color: colorOf(a), valueLabel: F.int(a.imp ?? 0) })) });
    const alc = hbar({ title: `Alcance — ${lbl}`, w: 560, labelW: 180, valueW: 70, items: by('reach').map((a) => ({ label: curto(a), value: a.reach ?? 0, color: colorOf(a), valueLabel: F.int(a.reach ?? 0) })) });
    pages.push(page(`<h2 class="sec">${c.num} / GRÁFICOS</h2>${legend}<div class="chart">${gasto}</div><div class="cols2 charts"><div class="chart">${imp}</div><div class="chart">${alc}</div></div>`));
    pages.push(page(`<h2 class="sec">${c.num} / ALERTAS E OBSERVAÇÕES</h2>${c.alertas}`));
  }

  // ---------- consolidado ----------
  if (camps.length > 1) {
    const rows = camps.map((c) => ({ label: `Campanha ${c.num}`, c }));
    const st = (k, title, fmt, w, valueW, axis) => stacked({ title, w, valueW, axisFmt: axis, labelFmt: fmt, rows: rows.map((r) => ({ label: r.label, a: r.c.ativos[k], n: r.c.nao[k] })) });
    const moneyAxis = (v) => (conv ? 'US$ ' : 'R$ ') + nf0.format(v);
    const mixed = new Set(camps.map((c) => c.resultType)).size > 1;
    pages.push(page(`<h1>${String(camps.length + 1).padStart(2, '0')} / CONSOLIDADO DAS CAMPANHAS</h1>
      <p class="lead">${mixed ? 'Somente gasto, impressões e alcance são consolidados. Resultados têm objetivos diferentes e ficam separados.' : 'Gasto, impressões, alcance e resultados (mesmo tipo) consolidados.'}</p>
      ${kpis([['Investimento total', F.money(tot.spend), conv ? F.brl(tot.brl) : ''], ['Impressões', F.int(tot.imp)], ['Alcance (soma por anúncio)', F.int(tot.reach)], ['Anúncios', `${tot.n}`, `${plural(tot.nAtivos, 'ativo', 'ativos')} · ${plural(tot.n - tot.nAtivos, 'não ativo', 'não ativos')}`]])}
      <table class="std"><thead><tr><th>Campanha</th><th class="n">Gasto${conv ? ' USD' : ''}</th>${conv ? '<th class="n">Gasto BRL</th>' : ''}<th class="n">% do gasto</th><th class="n">Gasto ativos</th><th class="n">Gasto não ativos</th><th class="n">Impressões</th><th class="n">% impr.</th><th class="n">Alcance*</th><th class="n">CPM<sup>c</sup></th><th class="n">Freq.<sup>c</sup></th><th class="n">Resultados</th></tr></thead><tbody>
      ${camps.map((c) => `<tr><td>${c.num} · ${esc(c.label || c.name)}</td><td class="n">${F.money(c.spend)}</td>${conv ? `<td class="n">${F.brl(c.brl)}</td>` : ''}<td class="n">${F.pct(c.spend / tot.spend)}</td><td class="n">${F.money(c.ativos.spend)}</td><td class="n">${F.money(c.nao.spend)}</td><td class="n">${F.int(c.imp)}</td><td class="n">${F.pct(c.imp / tot.imp)}</td><td class="n">${F.int(c.reach)}</td><td class="n">${F.money(c.cpm)}</td><td class="n">${F.dec(c.freq)}</td><td class="n">${F.int(c.results)} ${esc(c.resultShort)}</td></tr>`).join('')}
      <tr class="tot"><td>TOTAL</td><td class="n">${F.money(tot.spend)}</td>${conv ? `<td class="n">${F.brl(tot.brl)}</td>` : ''}<td class="n">100,0%</td><td class="n">${F.money(camps.reduce((s, c) => s + c.ativos.spend, 0))}</td><td class="n">${F.money(camps.reduce((s, c) => s + c.nao.spend, 0))}</td><td class="n">${F.int(tot.imp)}</td><td class="n">100,0%</td><td class="n">${F.int(tot.reach)}</td><td class="n">${F.money(tot.imp ? (tot.spend / tot.imp) * 1000 : null)}</td><td class="n">—</td><td class="n">${mixed ? 'não somados' : F.int(camps.reduce((s, c) => s + c.results, 0))}</td></tr></tbody></table>
      ${legend}
      <div class="chart">${st('spend', `Gasto por campanha${conv ? ' (USD)' : ''}`, (v) => F.both(v), 1000, 200, moneyAxis)}</div>
      <div class="cols2 charts"><div class="chart">${st('imp', 'Impressões por campanha', F.int, 560, 80, kAxis)}</div><div class="chart">${st('reach', 'Alcance por campanha (soma)', F.int, 560, 80, kAxis)}</div></div>
      <p class="note">${conv ? `Total em BRL = total em USD × ${rateTxt}. ${tot.difCentavos ? `A soma dos totais BRL arredondados das campanhas difere do total geral em ${F.brl(tot.difCentavos)} (arredondamento).` : 'A soma dos totais BRL das campanhas, arredondados, bate com o total geral.'} ` : ''}*Alcance somado por anúncio e por campanha: a mesma pessoa pode ter sido contada mais de uma vez.</p>`));
    const geral = [...all].sort((a, b) => b.spend - a.spend).slice(0, 10);
    pages.push(page(`<h2 class="sec">${String(camps.length + 1).padStart(2, '0')} / RANKING GERAL — TOP 10 POR GASTO</h2>
      <table class="std"><thead><tr><th>#</th><th>Campanha</th><th>Anúncio</th><th>Status</th><th class="n">Gasto${conv ? ' USD' : ''}</th>${conv ? '<th class="n">Gasto BRL</th>' : ''}<th class="n">% do gasto total</th><th class="n">Impressões</th><th class="n">Alcance</th><th class="n">Resultados</th></tr></thead><tbody>
      ${geral.map((a, i) => `<tr><td>${i + 1}</td><td>${a.camp}</td><td>${esc(a.name)} (#${a.id})</td><td>${esc(a.status)}</td><td class="n">${F.money(a.spend)}</td>${conv ? `<td class="n">${F.brl(a.brl)}</td>` : ''}<td class="n">${F.pct(a.spend / tot.spend)}</td><td class="n">${F.int(a.imp)}</td><td class="n">${F.int(a.reach)}</td><td class="n">${F.int(a.results)} ${esc(a.resultShort)}</td></tr>`).join('')}
      </tbody></table>
      <h3>COMPARAÇÃO ENTRE CAMPANHAS (somente números informados)</h3><ul class="exec">${cmp.map((l) => `<li>${l}</li>`).join('')}</ul>`));
  }

  // ---------- validação ----------
  const vn = String(camps.length + (camps.length > 1 ? 2 : 1)).padStart(2, '0');
  pages.push(page(`<h1>${vn} / VALIDAÇÃO FINAL</h1><p class="lead">Checagens feitas sobre os dados confirmados antes da geração.</p>
    <table class="std val"><thead><tr><th>Checagem</th><th>Resultado</th><th>Detalhe</th></tr></thead><tbody>
    ${checks.map(([k, ok, d]) => `<tr><td>${esc(k)}</td><td><span class="badge ${ok === true ? 'ok' : 'warn'}">${ok === true ? 'OK' : 'ATENÇÃO'}</span></td><td>${d}</td></tr>`).join('')}
    </tbody></table>
    <p class="meta">Traços (—) indicam ausência de valor. Métricas não disponíveis não foram estimadas. Status é o do dia da exportação; anúncios não ativos com gasto no período foram incluídos normalmente.</p>`));

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(report.fileName)}</title><style>${css}</style></head><body>${pages.join('\n')}</body></html>`;
}
