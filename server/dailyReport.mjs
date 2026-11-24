// PDF "Resumo do dia" no padrão visual da Sincerus (Poppins, laranja #F76000, logo):
// avisos das contas, situação do sistema e anúncios ativos por cliente/campanha. A4 retrato, várias páginas.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CSS = `
@page { size: A4 portrait; margin: 14mm 14mm 16mm; }
@page :first { margin-top: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Poppins', Verdana, sans-serif; color: #12141A; font-size: 8.8pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.hero { background: #12141A; color: #fff; margin: 0 -14mm 7mm; padding: 13mm 14mm 9mm; display: flex; justify-content: space-between; align-items: flex-end; }
.hero .k { color: #F76000; font-size: 7.6pt; letter-spacing: .16em; text-transform: uppercase; font-weight: 600; }
.hero h1 { font-size: 21pt; margin: 1.5mm 0 1mm; font-weight: 700; }
.hero .s { color: #A9ADB4; font-size: 9pt; }
.hero img { height: 12mm; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-bottom: 7mm; }
.kpi { border: 1px solid #E2E3E5; border-radius: 2.5mm; padding: 3mm 3.5mm; }
.kpi b { display: block; font-size: 15pt; margin-top: .8mm; }
.kpi span { color: #5B6068; font-size: 6.8pt; text-transform: uppercase; letter-spacing: .06em; }
.kpi.red b { color: #D23B2E; } .kpi.org b { color: #F76000; }
h2 { font-size: 11.5pt; margin: 0 0 3mm; padding-bottom: 1.8mm; border-bottom: 2px solid #F76000; break-after: avoid; page-break-after: avoid; }
section { margin-bottom: 7mm; }
table { width: 100%; border-collapse: collapse; }
td { padding: 2.2mm 2mm; border-bottom: 1px solid #EEEFF1; vertical-align: top; font-size: 8.8pt; }
tr { break-inside: avoid; page-break-inside: avoid; }
td.dot { width: 6mm; } td.dot i { display: inline-block; width: 2.6mm; height: 2.6mm; border-radius: 50%; margin-top: 1mm; }
td.cli { font-weight: 600; white-space: nowrap; width: 38mm; }
td .act { color: #5B6068; }
.legend { color: #8A8F98; font-size: 7pt; margin-top: 2mm; }
.legend i { display: inline-block; width: 2.2mm; height: 2.2mm; border-radius: 50%; margin: 0 1mm 0 3mm; vertical-align: -.2mm; }
.ok { font-size: 9.5pt; }
ul.sys { margin: 0; padding-left: 4.5mm; line-height: 1.6; }
.ads { columns: 2; column-gap: 7mm; }
.cl { break-inside: avoid; page-break-inside: avoid; margin-bottom: 4.5mm; border-left: 2.5px solid #F76000; padding-left: 3mm; }
.cl h3 { font-size: 10pt; margin: 0 0 .8mm; }
.cl h3 small { color: #8A8F98; font-weight: 400; font-size: 7.4pt; }
.camp { color: #5B6068; font-size: 7.4pt; margin: 1.6mm 0 .6mm; text-transform: uppercase; letter-spacing: .04em; }
.ad { font-size: 8.4pt; line-height: 1.5; }
.ad::before { content: '✓ '; color: #19A35A; font-weight: 700; }
.foot { color: #A9ADB4; font-size: 7pt; margin-top: 6mm; }
`;

const DOT = { crit: '#D23B2E', soon: '#F76000', warn: '#E8A100' };

// alerts: [{ client, level, kind, info }] já ordenados; sys: itens da verificação que precisam de atenção (ou null)
// clients: [{ name, campaigns: [{ name, ads: [rótulos] }] }]
export function buildDailyReportHtml({ day, alerts, sys, sysChecked, clients, logo }) {
  const tone = (a) => (a.kind === 'saldo/pagamento' && a.level !== 'crit' ? 'soon' : a.level === 'crit' ? 'crit' : 'warn');
  const nCrit = alerts.filter((a) => tone(a) === 'crit').length;
  const nAds = clients.reduce((t, c) => t + c.campaigns.reduce((u, k) => u + k.ads.length, 0), 0);
  const nCamp = clients.reduce((t, c) => t + c.campaigns.length, 0);
  const split = (s) => { const i = s.indexOf(' → '); return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 3)]; };
  const alertsHtml = alerts.length
    ? `<table>${alerts.map((a) => { const [what, todo] = split(a.info); return `<tr><td class="dot"><i style="background:${DOT[tone(a)]}"></i></td><td class="cli">${esc(a.client)}</td><td>${esc(what)}${todo ? `<br><span class="act">→ ${esc(todo)}</span>` : ''}</td></tr>`; }).join('')}</table>
       <div class="legend"><i style="background:${DOT.crit}"></i>urgente<i style="background:${DOT.soon}"></i>resolver em breve<i style="background:${DOT.warn}"></i>atenção</div>`
    : '<p class="ok">✅ Nenhum problema nas contas: saldos, anúncios e entrega em dia.</p>';
  const sysHtml = !sysChecked ? '<p class="ok">Verificação do sistema ainda não executada hoje.</p>'
    : sys.length ? `<ul class="sys">${sys.map((i) => `<li><b>${esc(i.area)} · ${esc(i.nome)}:</b> ${esc(i.detalhe)}</li>`).join('')}</ul>`
    : '<p class="ok">✅ Meta Ads, WhatsApp, e-mail e servidor funcionando.</p>';
  const adsHtml = clients.length ? `<div class="ads">${clients.map((c) => `<div class="cl"><h3>${esc(c.name)} <small>· ${c.campaigns.length} campanha(s) · ${c.campaigns.reduce((t, k) => t + k.ads.length, 0)} anúncio(s)</small></h3>${c.campaigns.map((k) => `<div class="camp">${esc(k.name)}</div>${k.ads.map((l) => `<div class="ad">${esc(l)}</div>`).join('')}`).join('')}</div>`).join('')}</div>` : '<p class="ok">Nenhum anúncio ativo.</p>';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Resumo do dia ${esc(day)}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>
<div class="hero"><div><div class="k">Sincerus Scale · Relatório diário</div><h1>Resumo do dia ${esc(day)}</h1><div class="s">Avisos das contas, situação do sistema e anúncios ativos</div></div>${logo ? `<img src="${logo}" alt="">` : ''}</div>
<div class="kpis"><div class="kpi ${nCrit ? 'red' : ''}"><span>Urgentes</span><b>${nCrit}</b></div><div class="kpi org"><span>Avisos no total</span><b>${alerts.length}</b></div><div class="kpi"><span>Clientes com anúncios</span><b>${clients.length}</b></div><div class="kpi"><span>Anúncios ativos</span><b>${nAds}</b><span>${nCamp} campanhas</span></div></div>
<section><h2>Avisos das contas</h2>${alertsHtml}</section>
<section><h2>Situação do sistema</h2>${sysHtml}</section>
<section><h2>Anúncios ativos por cliente</h2>${adsHtml}</section>
<div class="foot">Gerado automaticamente pela plataforma Sincerus Scale com dados da Meta Ads.</div>
</body></html>`;
}
