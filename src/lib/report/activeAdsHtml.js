// Relatório de ANÚNCIOS ATIVOS para o cliente: lista simples, no formato que a Sincerus já usa no WhatsApp
// ("Anúncios Ativos - Cliente - data" + ✅ um anúncio por linha). Uma página A4 por cliente, cliente em destaque.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');

// "ADS - IPHONE 17 PRO 256gb" → "IPHONE 17 PRO 256GB" (tira o prefixo interno de nomenclatura)
export const adLabel = (name) => String(name || '').replace(/^\s*(ads?|anuncio|anúncio)\s*\d*\s*[-–—:|]\s*/i, '').trim().toUpperCase() || String(name || '').toUpperCase();

// Lista de anúncios do cliente, sem repetir nomes iguais (o mesmo anúncio pode rodar em mais de um conjunto)
export function clientAdList(a) {
  const seen = new Set();
  const list = [];
  for (const c of a.campaigns) for (const s of c.adsets) for (const ad of s.ads) {
    const label = adLabel(ad.name);
    if (!seen.has(label)) { seen.add(label); list.push(label); }
  }
  return list;
}

// Texto pronto para colar no WhatsApp (mesmo formato do exemplo da Ponto Auto)
export function activeAdsText(accounts, when = new Date()) {
  const day = when.toLocaleDateString('pt-BR');
  return accounts.map((a) => `*Anúncios Ativos - ${a.name} - ${day}*\n\n${clientAdList(a).map((l) => `✅ ${l}`).join('\n')}`).join('\n\n\n');
}

const CSS = `
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: Verdana, "DejaVu Sans", sans-serif; color: #0C0D0F; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media screen { body { background: #2A2D33; padding: 18px 0; } .sheet { margin: 0 auto 18px; box-shadow: 0 6px 30px rgba(0,0,0,.35); } }
.sheet { width: 210mm; min-height: 297mm; background: #fff; position: relative; padding: 0 0 22mm; break-after: page; page-break-after: always; }
.sheet:last-child { break-after: auto; page-break-after: auto; }
.hero { background: #0C0D0F; color: #fff; padding: 10mm 16mm 9mm; border-bottom: 2.2mm solid #F76000; }
.hero .brand { display: flex; align-items: center; justify-content: space-between; }
.hero .brand img { height: 11mm; background: #F7F7F7; padding: 1mm 2mm; border-radius: 1mm; }
.hero .brand span { font-size: 8pt; color: #C9CBCF; letter-spacing: .6pt; text-transform: uppercase; }
.hero .kicker { margin-top: 9mm; color: #F76000; font-size: 10pt; font-weight: 700; letter-spacing: 1pt; text-transform: uppercase; }
.hero h1 { margin: 2mm 0 0; font-size: 30pt; line-height: 1.1; letter-spacing: -.3pt; word-break: break-word; }
.hero .date { margin-top: 3mm; font-size: 10.5pt; color: #C9CBCF; }
.hero .date b { color: #fff; }
.count { display: inline-block; margin-top: 5mm; background: #F76000; color: #0C0D0F; font-weight: 700; font-size: 10pt; padding: 1.6mm 4mm; border-radius: 10mm; }
.list { padding: 9mm 16mm 0; }
.list h2 { margin: 6mm 0 2mm; font-size: 8pt; font-weight: 400; color: #6B7078; text-transform: uppercase; letter-spacing: .5pt; }
.list h2:first-child { margin-top: 0; }
.list ul { list-style: none; margin: 0; padding: 0; }
.list li { display: flex; align-items: center; gap: 4mm; padding: 3.1mm 0; border-bottom: .3mm solid #E9EAEC; font-size: 12.5pt; font-weight: 700; break-inside: avoid; page-break-inside: avoid; }
.chk { flex: none; width: 6.5mm; height: 6.5mm; border-radius: 1.4mm; background: #1FA463; color: #fff; display: grid; place-items: center; font-size: 10pt; font-weight: 700; }
.foot { position: absolute; left: 16mm; right: 16mm; bottom: 9mm; display: flex; justify-content: space-between; font-size: 7.5pt; color: #6B7078; border-top: .3mm solid #E2E3E5; padding-top: 2.5mm; }
`;

// accounts: árvore de /api/meta/active-ads (cliente → campanhas → conjuntos → anúncios)
export function buildActiveAdsHtml(accounts, logoDataUrl, { showCampaigns = true, when = new Date() } = {}) {
  const day = when.toLocaleDateString('pt-BR');
  const time = when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const sheets = accounts.map((a) => {
    const all = clientAdList(a);
    let body = '';
    if (showCampaigns && a.campaigns.length > 1) {
      const seen = new Set();
      for (const c of a.campaigns) {
        const items = [];
        for (const s of c.adsets) for (const ad of s.ads) { const l = adLabel(ad.name); if (!seen.has(l)) { seen.add(l); items.push(l); } }
        if (items.length) body += `<h2>${esc(c.name)}</h2><ul>${items.map((l) => `<li><span class="chk">✓</span>${esc(l)}</li>`).join('')}</ul>`;
      }
    } else {
      body = `<ul>${all.map((l) => `<li><span class="chk">✓</span>${esc(l)}</li>`).join('')}</ul>`;
    }
    return `<section class="sheet">
      <div class="hero">
        <div class="brand"><img src="${logoDataUrl}" alt="Sincerus Scale"><span>Tráfego pago · Meta Ads</span></div>
        <div class="kicker">Anúncios ativos</div>
        <h1>${esc(a.name)}</h1>
        <div class="date">Situação em <b>${day}</b> às ${time}</div>
        <div class="count">${all.length} anúncio${all.length === 1 ? '' : 's'} no ar</div>
      </div>
      <div class="list">${body}</div>
      <div class="foot"><span>Sincerus Scale · Relatório de anúncios ativos</span><span>${esc(a.name)} · ${day}</span></div>
    </section>`;
  });
  const fileName = accounts.length === 1 ? `Anuncios-ativos_${slug(accounts[0].name)}_${day.split('/').reverse().join('-')}` : `Anuncios-ativos_${accounts.length}-clientes_${day.split('/').reverse().join('-')}`;
  return { html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(fileName)}</title><style>${CSS}</style></head><body>${sheets.join('\n')}</body></html>`, fileName };
}
