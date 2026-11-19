// Relatório interno "Saldos das contas" (padrão visual Sincerus, A4 retrato).
// Sem imports: também roda no Node para gerar o PDF fora do navegador.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (v, cur) => (v == null ? '—' : `${cur === 'USD' ? 'US$' : 'R$'} ${nf2.format(v)}`);

// limites para "saldo baixo" (contas pré-pagas)
export const LOW = { BRL: 100, USD: 20 };

// classifica cada conta: crit (parada ou prestes a parar), warn (atenção), ok, idle (sem uso)
export function classify(a) {
  if (!a.used && !a.available && !a.due) return { level: 'idle', note: 'Conta sem uso' };
  if (a.statusCode === 2) return { level: 'crit', note: 'Conta desativada pela Meta' };
  if (a.statusCode === 101 || a.statusCode === 100) return { level: 'idle', note: 'Conta fechada' };
  if (a.statusCode === 3) return { level: 'crit', note: 'Pagamento pendente — veiculação pode parar' };
  if (a.statusCode === 8) return { level: 'crit', note: 'Pendente de liquidação' };
  if (a.statusCode === 9) return { level: 'warn', note: 'Em período de carência — regularizar o pagamento' };
  if (a.statusCode === 7) return { level: 'warn', note: 'Conta em análise de risco' };
  if (a.prepay && a.available != null && a.available <= 0) return { level: 'crit', note: 'Sem saldo — anúncios parados' };
  if (a.prepay && a.available != null && a.available < (LOW[a.currency] ?? 100)) return { level: 'warn', note: 'Saldo baixo' };
  if (!a.prepay && a.payment === 'Sem forma de pagamento' && a.used) return { level: 'warn', note: 'Sem forma de pagamento cadastrada' };
  return { level: 'ok', note: 'Em dia' };
}

const CSS = `
@page { size: A4 portrait; margin: 12mm 0 14mm; }
@page :first { margin-top: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: 'Poppins', Verdana, sans-serif; color: #12141A; font-size: 8.6pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media screen { body { background: #2A2D33; padding: 18px 0; } .page { margin: 0 auto 18px; box-shadow: 0 6px 30px rgba(0,0,0,.35); } }
.page { width: 210mm; min-height: 297mm; background: #fff; position: relative; padding-bottom: 22mm; break-after: page; page-break-after: always; }
.page:last-child { break-after: auto; page-break-after: auto; }
.hero { background: #12141A; color: #fff; padding: 11mm 15mm 7mm; position: relative; }
.hero::after { content: ""; position: absolute; left: 0; right: 0; bottom: -2.6mm; height: 2.6mm; background: linear-gradient(90deg, #F76000, #FFB04D); }
.brand { display: flex; align-items: center; gap: 3mm; font-weight: 700; letter-spacing: 1.6pt; font-size: 10.5pt; }
.brand i { width: 2.4mm; height: 2.4mm; border-radius: 50%; background: #F76000; display: inline-block; }
.brand span { font-weight: 400; color: #8A8F98; font-size: 6.8pt; letter-spacing: 1.8pt; margin-left: 4mm; }
.hero h1 { font-size: 23pt; line-height: 1.12; margin: 6mm 0 0; font-weight: 700; }
.hero h1 em { font-style: normal; color: #FF8A1F; }
.meta { display: flex; gap: 10mm; margin-top: 6mm; }
.meta div span { display: block; font-size: 6.3pt; letter-spacing: 1pt; color: #8A8F98; text-transform: uppercase; }
.meta div b { display: block; font-weight: 500; font-size: 9.5pt; margin-top: 1.5mm; }
.wrap { padding: 0 15mm; }
.sec { display: flex; align-items: center; gap: 3mm; font-size: 6.8pt; font-weight: 700; letter-spacing: 1.6pt; color: #5B6068; text-transform: uppercase; margin: 9mm 0 3.5mm; }
.sec::after { content: ""; flex: 1; border-top: .3mm solid #E2E3E5; }
.cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-top: 8mm; }
.card { border: .3mm solid #E2E3E5; border-radius: 2mm; padding: 4mm 4.5mm; }
.card.dark { background: #12141A; border-color: #12141A; color: #fff; }
.card.red { border-color: #F3B8B2; background: #FEF3F2; }
.card span { display: block; font-size: 6.3pt; letter-spacing: 1pt; color: #5B6068; text-transform: uppercase; }
.card.dark span { color: #A9ADB4; }
.card b { display: block; font-size: 13.5pt; font-weight: 700; margin-top: 2.5mm; }
.card b + b { font-size: 10pt; margin-top: .8mm; }
.card.red b { color: #B42318; }
.card p { margin: 1.5mm 0 0; font-size: 6.4pt; color: #5B6068; }
.card.dark p { color: #A9ADB4; }
.alert { display: grid; grid-template-columns: 3mm 1fr auto; gap: 3mm; align-items: center; padding: 2.6mm 3.5mm; border-radius: 1.6mm; margin-bottom: 1.8mm; font-size: 8.2pt; }
.alert i { width: 2.4mm; height: 2.4mm; border-radius: 50%; }
.alert.crit { background: #FEF3F2; } .alert.crit i { background: #D92D20; }
.alert.warn { background: #FFF6E5; } .alert.warn i { background: #F79009; }
.alert b { font-weight: 600; }
.alert small { color: #5B6068; font-size: 7.4pt; }
.alert em { font-style: normal; font-weight: 700; white-space: nowrap; }
table { width: 100%; border-collapse: collapse; }
th { font-size: 6.2pt; letter-spacing: 1pt; color: #5B6068; text-transform: uppercase; text-align: left; padding: 0 0 2.4mm; border-bottom: .4mm solid #12141A; }
th.n, td.n { text-align: right; }
td { padding: 2.6mm 0; border-bottom: .3mm solid #E9EAEC; font-size: 8.2pt; vertical-align: middle; }
tr, .alert, .card { break-inside: avoid; page-break-inside: avoid; }
thead { display: table-header-group; }
.sec { break-after: avoid; page-break-after: avoid; }
td small { display: block; color: #8A8F98; font-size: 6.4pt; margin-top: .4mm; }
.pill { display: inline-block; padding: .7mm 2.4mm; border-radius: 5mm; font-size: 6.6pt; font-weight: 600; }
.pill.ok { background: #E7F6EC; color: #137A3E; }
.pill.warn { background: #FFF1D6; color: #9A5B00; }
.pill.crit { background: #FDE4E1; color: #B42318; }
.pill.idle { background: #F1F2F3; color: #6B7078; }
td b.crit { color: #B42318; } td b.warn { color: #9A5B00; }
.note { font-size: 6.4pt; color: #8A8F98; margin: 2.5mm 0 0; line-height: 1.5; }
.foot { position: absolute; left: 15mm; right: 15mm; bottom: 10mm; display: flex; justify-content: space-between; border-top: .3mm solid #E2E3E5; padding-top: 3mm; font-size: 6.6pt; color: #8A8F98; }
.foot b { color: #12141A; letter-spacing: 1.2pt; margin-right: 2mm; }
`;

export function buildBalancesHtml(data, { includeIdle = false, hidden = [] } = {}) {
  const when = new Date(data.fetchedAt);
  const dia = when.toLocaleDateString('pt-BR');
  const hora = when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const all = data.accounts.filter((a) => !hidden.includes(a.id)).map((a) => ({ ...a, ...classify(a) }));
  const list = includeIdle ? all : all.filter((a) => a.level !== 'idle');
  const prepay = list.filter((a) => a.prepay);
  const card = list.filter((a) => !a.prepay);
  const alerts = list.filter((a) => a.level === 'crit' || a.level === 'warn').sort((x, y) => (x.level === y.level ? x.name.localeCompare(y.name, 'pt-BR') : x.level === 'crit' ? -1 : 1));
  const sum = (arr, k, cur) => arr.filter((a) => a.currency === cur).reduce((t, a) => t + (a[k] || 0), 0);
  const two = (arr, k) => {
    const brl = sum(arr, k, 'BRL'), usd = sum(arr, k, 'USD');
    return `<b>${money(brl, 'BRL')}</b>${usd ? `<b>${money(usd, 'USD')}</b>` : ''}`;
  };
  const pill = (a) => `<span class="pill ${a.level}">${a.level === 'ok' ? 'Em dia' : a.level === 'idle' ? 'Sem uso' : a.level === 'crit' ? 'Urgente' : 'Atenção'}</span>`;
  const alertValue = (a) => (a.prepay ? `Saldo ${money(a.available, a.currency)}` : a.due ? `A cobrar ${money(a.due, a.currency)}` : '');

  const body = `
    <div class="hero">
      <div class="brand"><i></i>SINCERUS SCALE<span>GESTÃO DE TRÁFEGO PAGO</span></div>
      <h1>Saldos das contas<br><em>Meta Ads</em></h1>
      <div class="meta"><div><span>Situação em</span><b>${dia} às ${hora}</b></div><div><span>Contas</span><b>${list.length} com uso</b></div><div><span>Alertas</span><b>${alerts.length ? `${alerts.length} conta(s)` : 'Nenhum'}</b></div><div><span>Fonte</span><b>API da Meta (somente leitura)</b></div></div>
    </div>
    <div class="wrap">
      <div class="cards">
        <div class="card dark"><span>Saldo pré-pago disponível</span>${two(prepay, 'available')}<p>${prepay.length} conta(s) pré-paga(s)</p></div>
        <div class="card"><span>A cobrar no cartão</span>${two(card, 'due')}<p>${card.length} conta(s) no cartão</p></div>
        <div class="card ${alerts.some((a) => a.level === 'crit') ? 'red' : ''}"><span>Urgente</span><b>${alerts.filter((a) => a.level === 'crit').length}</b><p>Sem saldo ou pagamento pendente</p></div>
        <div class="card"><span>Atenção</span><b>${alerts.filter((a) => a.level === 'warn').length}</b><p>Saldo baixo ou carência</p></div>
      </div>
      ${alerts.length ? `<div class="sec">Precisa de atenção</div>${alerts.map((a) => `<div class="alert ${a.level}"><i></i><div><b>${esc(a.name)}</b> <small>· ${esc(a.note)}</small></div><em>${alertValue(a)}</em></div>`).join('')}` : ''}
      ${prepay.length ? `<div class="sec">Contas pré-pagas</div>
      <table><thead><tr><th>Conta</th><th class="n">Saldo disponível</th><th class="n">Situação</th></tr></thead><tbody>
      ${prepay.map((a) => `<tr><td>${esc(a.name)}<small>${esc(a.status)}${a.business ? ` · ${esc(a.business)}` : ''}</small></td><td class="n"><b class="${a.level === 'ok' ? '' : a.level}">${money(a.available, a.currency)}</b></td><td class="n">${pill(a)}</td></tr>`).join('')}
      </tbody></table>` : ''}
      ${card.length ? `<div class="sec">Contas no cartão</div>
      <table><thead><tr><th>Conta</th><th>Forma de pagamento</th><th class="n">A cobrar</th><th class="n">Situação</th></tr></thead><tbody>
      ${card.map((a) => `<tr><td>${esc(a.name)}<small>${esc(a.status)}</small></td><td>${esc(a.payment)}</td><td class="n"><b class="${a.level === 'ok' ? '' : a.level}">${money(a.due, a.currency)}</b></td><td class="n">${pill(a)}</td></tr>`).join('')}
      </tbody></table>` : ''}
      <p class="note">Pré-paga: saldo disponível para veicular. Cartão: valor acumulado que a Meta ainda vai cobrar no próximo pagamento. Saldo baixo = menos de ${money(LOW.BRL, 'BRL')} (contas em real) ou ${money(LOW.USD, 'USD')} (contas em dólar). ${includeIdle ? '' : 'Contas sem uso não aparecem.'}</p>
    </div>
    <div class="foot"><span><b>SINCERUS SCALE</b>· Saldos das contas — uso interno</span><span>${dia}</span></div>`;

  const fileName = `Saldos_contas_${dia.split('/').reverse().join('-')}`;
  return {
    fileName,
    html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(fileName)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>${CSS}</style></head><body><section class="page">${body}</section></body></html>`,
  };
}
