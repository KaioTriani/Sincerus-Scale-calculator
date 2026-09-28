const scenarios = [
  { key: 'conservative', name: 'Conservador', costConversation: 9.91, closeRate: 0.0456 },
  { key: 'base', name: 'Base', costConversation: 5.28, closeRate: 0.0504, reference: true },
  { key: 'optimistic', name: 'Otimista', costConversation: 4.12, closeRate: 0.0578 }
];

const investmentInput = document.getElementById('investment');
const investmentRange = document.getElementById('investmentRange');
const marginInput = document.getElementById('margin');
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

function updateQuickButtons(investment) {
  document.querySelectorAll('.quick-values button').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.value) === investment);
  });
}

function render() {
  const investment = clampInvestment(investmentInput.value);
  investmentInput.value = investment;
  investmentRange.value = investment;
  updateQuickButtons(investment);

  const results = scenarios.map(s => ({ s, values: calculateScenario(investment, s) }));
  scenarioGrid.innerHTML = results.map(({s, values}) => scenarioMarkup(s, values)).join('');

  const base = results.find(x => x.s.key === 'base').values;
  baseNote.innerHTML = `No cenário base, prepare sua equipe para <strong>${oneDecimal.format(base.conversationsPerDay)} conversas por dia.</strong> <span>30 dias / mês</span>`;

  const margin = Number(marginInput.value);
  if (Number.isFinite(margin) && margin > 0) {
    const grossProfit = base.sales * margin;
    const netProfit = grossProfit - investment;
    const roas = grossProfit / investment;
    grossProfitEl.textContent = brl.format(grossProfit);
    netProfitEl.textContent = brl.format(netProfit);
    roasEl.textContent = `${twoDecimals.format(roas)}x`;
    profitSection.classList.remove('hidden');
    profitHint.classList.add('hidden');
  } else {
    profitSection.classList.add('hidden');
    profitHint.classList.remove('hidden');
  }
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

document.querySelectorAll('.quick-values button').forEach(btn => {
  btn.addEventListener('click', () => {
    investmentInput.value = btn.dataset.value;
    render();
  });
});

document.getElementById('customizeBtn').addEventListener('click', () => {
  marginInput.focus();
  marginInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

let currentRotation = 0;
spinBtn.addEventListener('click', () => {
  spinBtn.disabled = true;
  cashbackResult.textContent = '';
  const possible = [400, 420, 450, 470, 500];
  const cashback = possible[Math.floor(Math.random() * possible.length)];
  currentRotation += 1440 + Math.floor(Math.random() * 720);
  wheel.style.transform = `rotate(${currentRotation}deg)`;
  setTimeout(() => {
    cashbackResult.textContent = `Seu cashback: ${brl.format(cashback)}`;
    spinBtn.disabled = false;
  }, 3250);
});

render();
