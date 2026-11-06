// Planilha do relatório: cotação em uma única célula (nome "Cotacao"), conversões por fórmula
// e gráficos nativos do Excel (injetados no pacote OOXML, já que o ExcelJS não cria gráficos).
import { carro, curto } from './compute';

const OR = 'FFF76000', DK = 'FF0C0D0F', GR = '5B6068', ROW = 'FFF1F2F3', TOT = 'FFFFE3D2';
const F_USD = '"US$" #,##0.00', F_BRL = '"R$" #,##0.00', F_INT = '#,##0', F_PCT = '0.0%', F_DEC = '0.00';
const COT = 'Cotacao';
const strip = (s) => String(s).replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');
const fx2 = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sheetName = (s) => s.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);

function styleHeader(row) {
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DK } };
    c.border = { bottom: { style: 'medium', color: { argb: 'FFBD4C04' } } };
    c.alignment = { vertical: 'middle', wrapText: true };
  });
  row.height = 30;
}
const fillRow = (row, argb, bold = false) => row.eachCell({ includeEmpty: true }, (c) => {
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  if (bold) c.font = { ...(c.font || {}), bold: true };
});
function brand(ws, title, sub) {
  ws.getCell('A1').value = title; ws.getCell('A1').font = { bold: true, size: 16, color: { argb: DK } };
  ws.getCell('A2').value = sub; ws.getCell('A2').font = { bold: true, size: 10, color: { argb: OR } };
}

function chartXml({ title, cats, series, stacked = false, numFmt = '#,##0' }) {
  const strCache = (vals) => `<c:strCache><c:ptCount val="${vals.length}"/>${vals.map((v, i) => `<c:pt idx="${i}"><c:v>${xmlEsc(v)}</c:v></c:pt>`).join('')}</c:strCache>`;
  const numCache = (vals) => `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${vals.length}"/>${vals.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('')}</c:numCache>`;
  const fill = (hex) => `<c:spPr><a:solidFill><a:srgbClr val="${hex}"/></a:solidFill></c:spPr>`;
  const txt = (sz, b = 0) => `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}" b="${b}"><a:solidFill><a:srgbClr val="0C0D0F"/></a:solidFill><a:latin typeface="Verdana"/></a:defRPr></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr>`;
  const sers = series.map((s, i) => `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${xmlEsc(s.name)}</c:v></c:tx>${fill(s.color)}<c:invertIfNegative val="0"/>
    ${(s.pointColors || []).map((col, j) => `<c:dPt><c:idx val="${j}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/>${fill(col)}</c:dPt>`).join('')}
    <c:dLbls><c:numFmt formatCode="${xmlEsc(s.labelFmt || numFmt)}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txt(800, 1)}<c:dLblPos val="${stacked ? 'ctr' : 'outEnd'}"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>
    <c:cat><c:strRef><c:f>${xmlEsc(cats.ref)}</c:f>${strCache(cats.vals)}</c:strRef></c:cat>
    <c:val><c:numRef><c:f>${xmlEsc(s.ref)}</c:f>${numCache(s.vals)}</c:numRef></c:val></c:ser>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/>
<c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1100" b="1"/></a:pPr><a:r><a:rPr lang="pt-BR" sz="1100" b="1"><a:solidFill><a:srgbClr val="0C0D0F"/></a:solidFill><a:latin typeface="Verdana"/></a:rPr><a:t>${xmlEsc(title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>
<c:plotArea><c:layout/><c:barChart><c:barDir val="bar"/><c:grouping val="${stacked ? 'stacked' : 'clustered'}"/><c:varyColors val="0"/>${sers}
<c:gapWidth val="${stacked ? 50 : 40}"/>${stacked ? '<c:overlap val="100"/>' : ''}<c:axId val="111"/><c:axId val="222"/></c:barChart>
<c:catAx><c:axId val="111"/><c:scaling><c:orientation val="maxMin"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:solidFill><a:srgbClr val="9A9EA4"/></a:solidFill></a:ln></c:spPr>${txt(800)}<c:crossAx val="222"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>
<c:valAx><c:axId val="222"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:majorGridlines><c:spPr><a:ln><a:solidFill><a:srgbClr val="E2E3E5"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="${xmlEsc(numFmt)}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${txt(800)}<c:crossAx val="111"/><c:crosses val="max"/><c:crossBetween val="between"/></c:valAx>
<c:spPr><a:solidFill><a:srgbClr val="F8F8F8"/></a:solidFill></c:spPr></c:plotArea>
${stacked ? `<c:legend><c:legendPos val="b"/><c:overlay val="0"/>${txt(800)}</c:legend>` : ''}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>
<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="E2E3E5"/></a:solidFill></a:ln></c:spPr></c:chartSpace>`;
}
const anchor = (i, { c0, r0, c1, r1 }) => `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${c0}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r0}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${c1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Gráfico ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;

async function injectCharts(buf, sheetCharts) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buf);
  let ct = await zip.file('[Content_Types].xml').async('string');
  let chartNo = 0, drawNo = 0;
  for (const [sIdx, charts] of Object.entries(sheetCharts)) {
    if (!charts.length) continue;
    drawNo++;
    const sheetPath = `xl/worksheets/sheet${sIdx}.xml`;
    let sx = await zip.file(sheetPath).async('string');
    sx = sx.replace('</worksheet>', '<drawing r:id="rIdDrw1"/></worksheet>');
    if (!sx.includes('xmlns:r=')) sx = sx.replace('<worksheet ', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
    zip.file(sheetPath, sx);
    const relPath = `xl/worksheets/_rels/sheet${sIdx}.xml.rels`;
    const relEntry = `<Relationship Id="rIdDrw1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawNo}.xml"/>`;
    if (zip.file(relPath)) zip.file(relPath, (await zip.file(relPath).async('string')).replace('</Relationships>', relEntry + '</Relationships>'));
    else zip.file(relPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relEntry}</Relationships>`);
    const drels = [];
    const anchors = charts.map((ch, i) => {
      chartNo++;
      zip.file(`xl/charts/chart${chartNo}.xml`, ch.xml);
      ct = ct.replace('</Types>', `<Override PartName="/xl/charts/chart${chartNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`);
      drels.push(`<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chartNo}.xml"/>`);
      return anchor(i, ch.pos);
    });
    zip.file(`xl/drawings/drawing${drawNo}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors.join('')}</xdr:wsDr>`);
    zip.file(`xl/drawings/_rels/drawing${drawNo}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drels.join('')}</Relationships>`);
    ct = ct.replace('</Types>', `<Override PartName="/xl/drawings/drawing${drawNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
  }
  zip.file('[Content_Types].xml', ct);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function buildXlsx(report, { F, camps, all, tot, checks }) {
  const { default: ExcelJS } = await import('exceljs');
  const conv = F.conv;
  const F_MON = conv ? F_USD : F_BRL;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sincerus Scale';
  const sheetCharts = {};

  // ---- Resumo (planilha 1) ----
  const rs = wb.addWorksheet('Resumo', { views: [{ showGridLines: false }] });
  brand(rs, `RELATÓRIO DE DESEMPENHO — ${report.client.toUpperCase()}`, `SINCERUS SCALE • TRÁFEGO PAGO • META ADS • ${report.periodLabel}`);
  rs.getCell('A4').value = conv ? 'Cotação USD→BRL (célula única usada em todas as conversões)' : 'Conta em real: fator de conversão = 1 (sem conversão)';
  rs.getCell('A4').font = { bold: true };
  rs.getCell('A5').value = conv ? 'US$ 1,00 =' : 'Fator';
  const cot = rs.getCell('B5');
  cot.value = F.rate; cot.numFmt = conv ? '"R$" 0.0000' : '0'; cot.name = COT;
  cot.font = { bold: true, size: 14, color: { argb: OR } };
  cot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1E8' } };
  if (conv) { rs.getCell('A6').value = 'Fonte: ' + (report.rateSource || 'informada pelo usuário'); rs.getCell('A7').value = report.rateNote; rs.getCell('A7').font = { italic: true, color: { argb: 'FF6B7078' } }; }
  rs.getCell('A8').value = `Período: ${report.periodLabel} · Gerado em ${report.generatedAt} · Moeda da conta: ${report.currency}`;
  rs.getColumn(1).width = 50; for (let c = 2; c <= 8; c++) rs.getColumn(c).width = 18;

  // ---- Campanhas ----
  const totals = {};
  camps.forEach((c, ci) => {
    const sIdx = ci + 2;
    const name = sheetName(`Campanha ${c.num}`);
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 6, showGridLines: false }] });
    brand(ws, `${c.num} / ${c.name}`, `Conjunto: ${c.adset || '—'} · ${report.periodLabel} · Resultado: ${c.resultType || 'n/d'}`);
    ws.getCell('A3').value = `Gasto BRL = Gasto × Cotação (Resumo!B5). Colunas "(calc.)" calculadas; vazio = sem valor ("—"). ${c.hasClicks ? '' : 'Cliques e CTR: n/d.'}`;
    if (conv) { ws.getCell('A4').value = report.rateNote; ws.getCell('A4').font = { italic: true, color: { argb: 'FF6B7078' } }; }
    ws.getRow(6).values = ['ID', 'Anúncio', 'Carro (marca · modelo · ano)', 'Status', 'Grupo', `Gasto ${conv ? 'USD' : 'R$'}`, 'Gasto BRL', '% do gasto (calc.)', 'Impressões', 'Alcance', `Resultados (${c.resultShort || 'n/d'})`, 'Custo/resultado (arquivo)', 'Custo/resultado (calc.)', 'Frequência', 'CPM', 'Qualidade', 'Taxa de engajamento', 'Taxa de conversão'];
    styleHeader(ws.getRow(6));
    const ordered = [...c.ativos.list, ...c.nao.list];
    const r0 = 7, rN = r0 + ordered.length - 1, rA = rN + 1, rNA = rN + 2, rT = rN + 3;
    const rowOf = new Map();
    ordered.forEach((a, i) => {
      const r = r0 + i; rowOf.set(a, r);
      const row = ws.getRow(r);
      row.values = [a.id, a.name, carro(a), a.status, a.ativo ? 'ATIVO' : 'NÃO ATIVO', a.spend,
        { formula: `F${r}*${COT}`, result: a.brl }, { formula: `IF($F$${rT}>0,F${r}/$F$${rT},0)`, result: a.pct },
        a.imp ?? null, a.reach ?? null, a.results ?? null, a.cpr ?? null,
        { formula: `IF(K${r}>0,F${r}/K${r},"")`, result: a.cprC ?? '' },
        a.freq != null ? a.freq : { formula: `IF(J${r}>0,I${r}/J${r},"")`, result: a.freqC ?? '' },
        a.cpm != null ? a.cpm : { formula: `IF(I${r}>0,F${r}/I${r}*1000,"")`, result: a.cpmC ?? '' },
        a.q ?? '—', a.e ?? '—', a.cv ?? '—'];
      if (i % 2) fillRow(row, ROW);
    });
    const sumRow = (r, label, crit, g) => {
      const sf = (col) => (crit ? { formula: `SUMIF($E$${r0}:$E$${rN},"${crit}",${col}${r0}:${col}${rN})` } : { formula: `SUM(${col}${r0}:${col}${rN})` });
      ws.getRow(r).values = [null, label, null, null, crit ?? 'TOTAL', { ...sf('F'), result: g.spend }, { formula: `F${r}*${COT}`, result: g.spend * F.rate },
        { formula: `IF($F$${rT}>0,F${r}/$F$${rT},0)`, result: c.spend ? g.spend / c.spend : 0 }, { ...sf('I'), result: g.imp }, { ...sf('J'), result: g.reach }, { ...sf('K'), result: g.results }, null,
        { formula: `IF(K${r}>0,F${r}/K${r},"")`, result: g.results ? g.spend / g.results : '' }, { formula: `IF(J${r}>0,I${r}/J${r},"")`, result: g.reach ? g.imp / g.reach : '' },
        { formula: `IF(I${r}>0,F${r}/I${r}*1000,"")`, result: g.imp ? (g.spend / g.imp) * 1000 : '' }];
      fillRow(ws.getRow(r), crit ? 'FFFFF1E8' : TOT, true);
    };
    if (ordered.length) {
      sumRow(rA, 'Subtotal ATIVOS', 'ATIVO', c.ativos);
      sumRow(rNA, 'Subtotal NÃO ATIVOS', 'NÃO ATIVO', c.nao);
      sumRow(rT, 'TOTAL DA CAMPANHA', null, c);
    }
    ws.getCell(`B${rT + 1}`).value = '* Alcance de subtotal/total = soma por anúncio (não são pessoas únicas).';
    ws.getCell(`B${rT + 1}`).font = { italic: true, size: 8, color: { argb: 'FF6B7078' } };
    for (let r = r0; r <= rT; r++) {
      const row = ws.getRow(r);
      row.getCell(6).numFmt = F_MON; row.getCell(7).numFmt = F_BRL; row.getCell(8).numFmt = F_PCT;
      [9, 10, 11].forEach((k) => (row.getCell(k).numFmt = F_INT));
      row.getCell(12).numFmt = F_MON; row.getCell(13).numFmt = F_MON; row.getCell(14).numFmt = F_DEC; row.getCell(15).numFmt = F_MON;
    }
    [6, 34, 30, 12, 11, 12, 13, 10, 11, 10, 12, 12, 12, 10, 11, 26, 20, 26].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    totals[c.num] = { name, rA, rNA, rT };

    // dados dos gráficos (colunas T:AA)
    const n = Math.min(10, c.ads.length);
    if (!n) return;
    const topBy = (k) => [...c.ads].sort((a, b) => (b[k] ?? 0) - (a[k] ?? 0) || a.id - b.id).slice(0, n);
    [['T', 'Gráfico: gasto'], ['U', 'Gasto'], ['W', 'Gráfico: impressões'], ['X', 'Impressões'], ['Z', 'Gráfico: alcance'], ['AA', 'Alcance']].forEach(([col, t]) => {
      const cell = ws.getCell(`${col}6`); cell.value = t; cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DK } };
    });
    const sp = topBy('spend'), im = topBy('imp'), al = topBy('reach');
    const sym = conv ? 'US$' : 'R$';
    for (let i = 0; i < n; i++) {
      const r = r0 + i, a = sp[i], ra = rowOf.get(a);
      ws.getCell(`T${r}`).value = conv
        ? { formula: `"${curto(a).replace(/"/g, '')} | US$ "&FIXED(F${ra},2)&" | R$ "&FIXED(G${ra},2)`, result: `${curto(a)} | US$ ${fx2(a.spend)} | R$ ${fx2(a.brl)}` }
        : { formula: `"${curto(a).replace(/"/g, '')} | R$ "&FIXED(F${ra},2)`, result: `${curto(a)} | R$ ${fx2(a.spend)}` };
      ws.getCell(`U${r}`).value = { formula: `F${ra}`, result: a.spend }; ws.getCell(`U${r}`).numFmt = F_MON;
      ws.getCell(`W${r}`).value = curto(im[i]); ws.getCell(`X${r}`).value = { formula: `N(I${rowOf.get(im[i])})`, result: im[i].imp ?? 0 };
      ws.getCell(`Z${r}`).value = curto(al[i]); ws.getCell(`AA${r}`).value = { formula: `N(J${rowOf.get(al[i])})`, result: al[i].reach ?? 0 };
    }
    ws.getColumn('T').width = 48; ws.getColumn('W').width = 28; ws.getColumn('Z').width = 28;
    const rng = (col) => `'${name}'!$${col}$${r0}:$${col}$${r0 + n - 1}`;
    const pc = (list) => list.map((a) => (a.ativo ? 'F76000' : GR));
    const lbl = n >= c.ads.length ? 'todos os anúncios' : 'top 10';
    const base = rT + 3;
    sheetCharts[sIdx] = [
      { pos: { c0: 1, r0: base, c1: 8, r1: base + 24 }, xml: chartXml({ title: `Gasto por anúncio (${sym}) — ${lbl}`, numFmt: `"${sym}" #,##0`, cats: { ref: rng('T'), vals: sp.map((a) => (conv ? `${curto(a)} | US$ ${fx2(a.spend)} | R$ ${fx2(a.brl)}` : `${curto(a)} | R$ ${fx2(a.spend)}`)) }, series: [{ name: 'Gasto', ref: rng('U'), vals: sp.map((a) => a.spend), color: 'F76000', pointColors: pc(sp), labelFmt: `"${sym}" #,##0.00` }] }) },
      { pos: { c0: 8, r0: base, c1: 13, r1: base + 24 }, xml: chartXml({ title: `Impressões — ${lbl}`, cats: { ref: rng('W'), vals: im.map(curto) }, series: [{ name: 'Impressões', ref: rng('X'), vals: im.map((a) => a.imp ?? 0), color: 'F76000', pointColors: pc(im) }] }) },
      { pos: { c0: 13, r0: base, c1: 18, r1: base + 24 }, xml: chartXml({ title: `Alcance — ${lbl}`, cats: { ref: rng('Z'), vals: al.map(curto) }, series: [{ name: 'Alcance', ref: rng('AA'), vals: al.map((a) => a.reach ?? 0), color: 'F76000', pointColors: pc(al) }] }) },
    ];
    ws.getCell(`B${base}`).value = 'Cores: laranja = Ativo; cinza = Não ativo (mesma cor para o mesmo anúncio em todos os gráficos).';
    ws.getCell(`B${base}`).font = { italic: true, size: 8, color: { argb: 'FF6B7078' } };
  });

  // ---- Consolidado ----
  const csIdx = camps.length + 2;
  const cs = wb.addWorksheet('Consolidado', { views: [{ showGridLines: false }] });
  brand(cs, `CONSOLIDADO — ${report.client.toUpperCase()}`, report.periodLabel);
  cs.getRow(4).values = ['Campanha', `Gasto ${conv ? 'USD' : 'R$'}`, 'Gasto BRL', '% do gasto', 'Gasto ativos', 'Gasto não ativos', 'Impr. ativos', 'Impr. não ativos', 'Impressões', 'Alcance ativos', 'Alcance não ativos', 'Alcance (soma)', 'CPM (calc.)', 'Resultados'];
  styleHeader(cs.getRow(4));
  const rTot = 5 + camps.length;
  camps.forEach((c, i) => {
    const r = 5 + i, t = totals[c.num], q = (col, row) => `'${t.name}'!${col}${row}`;
    cs.getRow(r).values = [`${c.num} · ${c.label || c.name}`,
      { formula: q('F', t.rT), result: c.spend }, { formula: `B${r}*${COT}`, result: c.brl }, { formula: `IF($B$${rTot}>0,B${r}/$B$${rTot},0)`, result: tot.spend ? c.spend / tot.spend : 0 },
      { formula: q('F', t.rA), result: c.ativos.spend }, { formula: q('F', t.rNA), result: c.nao.spend },
      { formula: q('I', t.rA), result: c.ativos.imp }, { formula: q('I', t.rNA), result: c.nao.imp }, { formula: q('I', t.rT), result: c.imp },
      { formula: q('J', t.rA), result: c.ativos.reach }, { formula: q('J', t.rNA), result: c.nao.reach }, { formula: q('J', t.rT), result: c.reach },
      { formula: `IF(I${r}>0,B${r}/I${r}*1000,"")`, result: c.cpm ?? '' }, `${c.results} ${c.resultShort}`];
  });
  const sumC = (col, v) => ({ formula: `SUM(${col}5:${col}${rTot - 1})`, result: v });
  const sumK = (k, g) => camps.reduce((s, c) => s + c[g][k], 0);
  cs.getRow(rTot).values = ['TOTAL', sumC('B', tot.spend), { formula: `B${rTot}*${COT}`, result: tot.brl }, { formula: `IF(B${rTot}>0,1,0)`, result: 1 },
    sumC('E', sumK('spend', 'ativos')), sumC('F', sumK('spend', 'nao')), sumC('G', sumK('imp', 'ativos')), sumC('H', sumK('imp', 'nao')), sumC('I', tot.imp),
    sumC('J', sumK('reach', 'ativos')), sumC('K', sumK('reach', 'nao')), sumC('L', tot.reach), { formula: `IF(I${rTot}>0,B${rTot}/I${rTot}*1000,"")`, result: tot.imp ? (tot.spend / tot.imp) * 1000 : '' }, 'ver por campanha'];
  fillRow(cs.getRow(rTot), TOT, true);
  for (let r = 5; r <= rTot; r++) {
    const row = cs.getRow(r);
    [2, 5, 6, 13].forEach((k) => (row.getCell(k).numFmt = F_MON)); row.getCell(3).numFmt = F_BRL; row.getCell(4).numFmt = F_PCT;
    [7, 8, 9, 10, 11, 12].forEach((k) => (row.getCell(k).numFmt = F_INT));
  }
  cs.getColumn(1).width = 34; for (let k = 2; k <= 13; k++) cs.getColumn(k).width = 14; cs.getColumn(14).width = 30;
  const rk0 = rTot + 3;
  cs.getCell(`A${rk0}`).value = 'RANKING GERAL — TOP 10 POR GASTO'; cs.getCell(`A${rk0}`).font = { bold: true, color: { argb: OR } };
  cs.getRow(rk0 + 1).values = ['Anúncio', 'Campanha', 'Status', `Gasto ${conv ? 'USD' : 'R$'}`, 'Gasto BRL', '% do gasto total', 'Impressões', 'Alcance', 'Resultados'];
  styleHeader(cs.getRow(rk0 + 1));
  [...all].sort((a, b) => b.spend - a.spend).slice(0, 10).forEach((a, i) => {
    const r = rk0 + 2 + i;
    cs.getRow(r).values = [`${i + 1}. ${a.name} (#${a.id})`, a.camp, a.status, a.spend, { formula: `D${r}*${COT}`, result: a.brl }, { formula: `IF($B$${rTot}>0,D${r}/$B$${rTot},0)`, result: tot.spend ? a.spend / tot.spend : 0 }, a.imp, a.reach, `${a.results ?? '—'} ${a.resultShort}`];
    const row = cs.getRow(r); row.getCell(4).numFmt = F_MON; row.getCell(5).numFmt = F_BRL; row.getCell(6).numFmt = F_PCT; row.getCell(7).numFmt = F_INT; row.getCell(8).numFmt = F_INT;
  });
  const chartRow = rk0 + 14;
  const cats = { ref: `'Consolidado'!$A$5:$A$${rTot - 1}`, vals: camps.map((c) => `${c.num} · ${c.label || c.name}`) };
  const st = (title, ca, cn, va, vn, fmt) => chartXml({ title, stacked: true, numFmt: fmt, cats, series: [
    { name: 'Ativos', ref: `'Consolidado'!$${ca}$5:$${ca}$${rTot - 1}`, vals: va, color: 'F76000' },
    { name: 'Não ativos', ref: `'Consolidado'!$${cn}$5:$${cn}$${rTot - 1}`, vals: vn, color: GR }] });
  sheetCharts[csIdx] = [
    { pos: { c0: 0, r0: chartRow, c1: 4, r1: chartRow + 18 }, xml: st('Gasto por campanha', 'E', 'F', camps.map((c) => c.ativos.spend), camps.map((c) => c.nao.spend), `"${conv ? 'US$' : 'R$'}" #,##0.00`) },
    { pos: { c0: 4, r0: chartRow, c1: 9, r1: chartRow + 18 }, xml: st('Impressões por campanha', 'G', 'H', camps.map((c) => c.ativos.imp), camps.map((c) => c.nao.imp), '#,##0') },
    { pos: { c0: 9, r0: chartRow, c1: 14, r1: chartRow + 18 }, xml: st('Alcance por campanha (soma)', 'J', 'K', camps.map((c) => c.ativos.reach), camps.map((c) => c.nao.reach), '#,##0') },
  ];

  // ---- Validação ----
  const vs = wb.addWorksheet('Validação', { views: [{ showGridLines: false }] });
  brand(vs, 'VALIDAÇÃO FINAL', 'Checagens sobre os dados confirmados');
  vs.getRow(4).values = ['Checagem', 'Resultado', 'Detalhe']; styleHeader(vs.getRow(4));
  checks.forEach(([k, ok, d], i) => {
    const row = vs.getRow(5 + i);
    row.values = [k, ok === true ? 'OK' : 'ATENÇÃO', strip(d)];
    row.alignment = { wrapText: true, vertical: 'top' };
    row.getCell(2).font = { bold: true, color: { argb: ok === true ? 'FF1F7A3E' : OR } };
  });
  vs.getColumn(1).width = 36; vs.getColumn(2).width = 12; vs.getColumn(3).width = 120;

  return injectCharts(await wb.xlsx.writeBuffer(), sheetCharts);
}
