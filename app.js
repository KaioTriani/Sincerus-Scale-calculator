const scenarios = [
  { key: 'conservative', name: 'Conservador', costConversation: 9.91, closeRate: 0.0456 },
  { key: 'base', name: 'Base', costConversation: 5.28, closeRate: 0.0504, reference: true },
  { key: 'optimistic', name: 'Otimista', costConversation: 4.12, closeRate: 0.0578 }
];

const WHATSAPP_PHONE = '5583999054165';

const investmentInput = document.getElementById('investment');
const investmentRange = document.getElementById('investmentRange');
const marginInput = document.getElementById('margin');
const clientNameInput = document.getElementById('clientName');
const storeNameInput = document.getElementById('storeName');
const clientPanel = document.getElementById('dados-cliente');
const scenarioGrid = document.getElementById('scenarioGrid');
const baseNote = document.getElementById('baseNote');
const profitHint = document.getElementById('profitHint');
const profitSection = document.getElementById('profitSection');
const grossProfitEl = document.getElementById('grossProfit');
const netProfitEl = document.getElementById('netProfit');
const roasEl = document.getElementById('roas');
const wheel = document.getElementById('wheel');
const spinBtn = document.getElementById('spinBtn');
const cashbackResult = document.getElementById('cashbackResult');

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const oneDecimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const twoDecimals = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let currentCashback = null;

function clampInvestment(value) {
  const n = Number(value) || 1500;
  return Math.min(15000, Math.max(1500, n));
}

function calculateScenario(investment, scenario) {
  const conversations = investment / scenario.costConversation;
  const sales = conversations * scenario.closeRate;
  const cac = sales > 0 ? investment / sales : 0;
  return { conversations, sales, cac, conversationsPerDay: conversations / 30 };
}

function scenarioMarkup(s, values) {
  return `
    <article class="scenario-card ${s.reference ? 'reference' : ''}">
      ${s.reference ? '<span class="reference-badge">REFERÊNCIA</span>' : ''}
      <div class="scenario-name">${s.name}</div>
      <div class="sales"><strong>${oneDecimal.format(values.sales)}</strong><span>vendas estimadas</span></div>
      <div class="metrics">
        <div class="metric"><span>Conversas</span><strong>${Math.round(values.conversations)}</strong></div>
        <div class="metric"><span>CAC em mídia</span><strong>${brl.format(values.cac)}</strong></div>
        <div class="metric"><span>Conversas / dia</span><strong>${oneDecimal.format(values.conversationsPerDay)}</strong></div>
        <div class="metric"><span>Custo / conversa</span><strong>${brl.format(s.costConversation)} / conversa</strong></div>
        <div class="metric"><span>Fechamento</span><strong>${twoDecimals.format(s.closeRate * 100)} % de fechamento</strong></div>
      </div>
    </article>`;
}

function getProjection() {
  const investment = clampInvestment(investmentInput.value);
  const results = scenarios.map(s => ({ s, values: calculateScenario(investment, s) }));
  const base = results.find(x => x.s.key === 'base').values;
  const margin = Number(marginInput.value);
  const hasMargin = Number.isFinite(margin) && margin > 0;
  const grossProfit = hasMargin ? base.sales * margin : null;
  const netProfit = hasMargin ? grossProfit - investment : null;
  const roas = hasMargin ? grossProfit / investment : null;

  return { investment, results, base, margin, hasMargin, grossProfit, netProfit, roas };
}

function buildWhatsAppMessage(projection) {
  const clientName = clientNameInput.value.trim();
  const storeName = storeNameInput.value.trim();

  const lines = [
    'Olá, equipe Sincerus! 👋',
    '',
    `Meu nome é ${clientName} e falo pela loja ${storeName}.`,
    'Fiz uma projeção no Sincerus Scale e gostaria de conversar sobre esses números:',
    '',
    `• Investimento mensal em mídia: ${brl.format(projection.investment)}`,
    `• Cenário base: ${oneDecimal.format(projection.base.sales)} vendas estimadas`,
    `• Conversas estimadas: ${Math.round(projection.base.conversations)} por mês`,
    `• Conversas por dia: ${oneDecimal.format(projection.base.conversationsPerDay)}`,
    `• CAC em mídia: ${brl.format(projection.base.cac)}`
  ];

  if (projection.hasMargin) {
    lines.push(
      `• Margem por aparelho informada: ${brl.format(projection.margin)}`,
      `• Lucro bruto estimado: ${brl.format(projection.grossProfit)}`,
      `• Lucro líquido estimado: ${brl.format(projection.netProfit)}`,
      `• ROAS estimado: ${twoDecimals.format(projection.roas)}x`
    );
  } else {
    lines.push('• Margem por aparelho: não informada');
  }

  if (currentCashback) {
    lines.push(`• Cashback sorteado: ${brl.format(currentCashback)}`);
  }

  lines.push('', 'Quero entender os próximos passos para aplicar isso na minha loja.');

  return lines.join('\n');
}

function updateWhatsAppLinks(projection) {
  const message = buildWhatsAppMessage(projection);
  const url = `https://api.whatsapp.com/send/?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(message)}&type=phone_number&app_absent=0`;

  document.querySelectorAll('[data-whatsapp]').forEach(link => {
    link.href = url;
  });
}

function updateQuickButtons(investment) {
  document.querySelectorAll('.quick-values button').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.value) === investment);
  });
}

function render() {
  const projection = getProjection();
  const { investment, results, base, hasMargin, grossProfit, netProfit, roas } = projection;

  investmentInput.value = investment;
  investmentRange.value = investment;
  updateQuickButtons(investment);

  scenarioGrid.innerHTML = results.map(({ s, values }) => scenarioMarkup(s, values)).join('');

  baseNote.innerHTML = `No cenário base, prepare sua equipe para <strong>${oneDecimal.format(base.conversationsPerDay)} conversas por dia.</strong> <span>30 dias / mês</span>`;

  if (hasMargin) {
    grossProfitEl.textContent = brl.format(grossProfit);
    netProfitEl.textContent = brl.format(netProfit);
    roasEl.textContent = `${twoDecimals.format(roas)}x`;
    profitSection.classList.remove('hidden');
    profitHint.classList.add('hidden');
  } else {
    profitSection.classList.add('hidden');
    profitHint.classList.remove('hidden');
  }

  updateWhatsAppLinks(projection);
}

function ensureClientIdentification(event) {
  const missing = !clientNameInput.value.trim() ? clientNameInput : !storeNameInput.value.trim() ? storeNameInput : null;

  if (!missing) return;

  event.preventDefault();
  clientPanel.classList.add('needs-data');
  clientPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => missing.focus(), 450);
}

investmentInput.addEventListener('input', () => {
  investmentRange.value = clampInvestment(investmentInput.value);
  render();
});
investmentInput.addEventListener('blur', render);

investmentRange.addEventListener('input', () => {
  investmentInput.value = investmentRange.value;
  render();
});

marginInput.addEventListener('input', render);

[clientNameInput, storeNameInput].forEach(input => {
  input.addEventListener('input', () => {
    clientPanel.classList.remove('needs-data');
    updateWhatsAppLinks(getProjection());
  });
});

document.querySelectorAll('.quick-values button').forEach(btn => {
  btn.addEventListener('click', () => {
    investmentInput.value = btn.dataset.value;
    render();
  });
});

document.getElementById('customizeBtn').addEventListener('click', () => {
  const target = !clientNameInput.value.trim()
    ? clientNameInput
    : !storeNameInput.value.trim()
      ? storeNameInput
      : marginInput;

  target.focus();
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

document.querySelectorAll('[data-whatsapp]').forEach(link => {
  link.addEventListener('click', ensureClientIdentification);
});

let currentRotation = 0;
spinBtn.addEventListener('click', () => {
  spinBtn.disabled = true;
  cashbackResult.textContent = '';

  const possible = [400, 420, 450, 470, 500];
  currentCashback = possible[Math.floor(Math.random() * possible.length)];

  currentRotation += 1440 + Math.floor(Math.random() * 720);
  wheel.style.transform = `rotate(${currentRotation}deg)`;

  setTimeout(() => {
    cashbackResult.textContent = `Seu cashback: ${brl.format(currentCashback)}`;
    spinBtn.disabled = false;
    updateWhatsAppLinks(getProjection());
  }, 3250);
});

render();
