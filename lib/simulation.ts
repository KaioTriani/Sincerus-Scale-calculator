export type Inputs = { investment: number; margin?: number; capacity?: number; cost?: number; closing?: number };
export type Scenario = { name: string; cost: number; closing: number; conversations: number; daily: number; sales: number; cac: number; revenue?: number; profit?: number; roas?: number };
export const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const decimal = (n: number, digits = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export function validate(input: Inputs) {
  if (!Number.isFinite(input.investment) || input.investment < 1500 || input.investment > 1e9) throw new Error('O investimento mínimo é R$ 1.500. Informe um valor até R$ 1 bilhão.');
  for (const field of ['margin', 'capacity', 'cost', 'closing'] as const) {
    const value = input[field];
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1e9 || ((field === 'cost' || field === 'closing') && value === 0))) throw new Error('Revise os dados: valores não podem ser negativos; custo e fechamento devem ser maiores que zero.');
  }
  if (input.closing !== undefined && input.closing > 100) throw new Error('A taxa de fechamento deve ser de até 100%.');
}
export function simulate(input: Inputs) {
  validate(input);
  const factor = 1 + 0.04 * Math.max(0, (input.investment - 3000) / 1000);
  const scenarios: Scenario[] = [
    { name: 'Conservador', cost: 9.91, closing: 4.56 },
    { name: 'Base', cost: input.cost ?? 5.28, closing: input.closing ?? 5.04 },
    { name: 'Otimista', cost: 4.12, closing: 5.78 },
  ].map(s => {
    const cost = s.cost * factor;
    const conversations = input.investment / cost;
    const sales = conversations * s.closing / 100;
    const revenue = input.margin === undefined ? undefined : sales * input.margin;
    return { ...s, cost, conversations, daily: conversations / 30, sales, cac: input.investment / sales, revenue, profit: revenue === undefined ? undefined : revenue - input.investment, roas: revenue === undefined ? undefined : revenue / input.investment };
  });
  const alerts: string[] = [];
  if (input.investment > 5000) alerts.push('Acima de R$ 5.000 o custo por conversa tende a subir — a projeção já considera isso.');
  if (input.investment > 8000) alerts.push('Nessa faixa a base tem uma única conta, e ela opera com frequência acima do saudável. Estimativa com menor confiança.');
  if (input.investment > 10000) alerts.push('Acima de R$ 10.000/mês, a base não tem contas nessa faixa operando com frequência saudável.');
  const busy = scenarios.filter(s => s.daily > 25);
  if (busy.length) alerts.push(`Mais de 25 conversas/dia nos cenários ${busy.map(s => s.name.toLowerCase()).join(', ')}. Confirme se a loja consegue responder nesse ritmo — sem atendimento, a taxa de fechamento cai.`);
  if (input.capacity !== undefined) {
    const over = scenarios.filter(s => s.daily > input.capacity!);
    if (over.length) alerts.push(`Capacidade de ${decimal(input.capacity)} conversas/dia excedida: ${over.map(s => s.name).join(', ')}. As vendas não foram reduzidas automaticamente: não há fórmula de ajuste na base.`);
  }
  if (input.margin === undefined) alerts.push('Sem a margem por aparelho não é possível calcular lucro nem ROAS.');
  if (input.cost !== undefined || input.closing !== undefined) alerts.push('O cenário base usa o histórico informado da sua loja. Conservador e otimista são referências fixas da carteira e podem não delimitar seu resultado.');
  return { input, factor, scenarios, alerts };
}
export type Simulation = ReturnType<typeof simulate>;
// O acréscimo acompanha a verba sem fazer os seis setores convergirem ao teto.
// Todos os seis setores são elegíveis, com a mesma probabilidade.
export function cashbackOptions(investment: number) {
  if (!Number.isFinite(investment) || investment < 1500) throw new Error('Investimento não elegível.');
  const bonus = Math.min(19, Math.floor((investment - 1500) * 0.01));
  return [400, 420, 440, 460, 480].map(base => base + bonus).concat(500);
}
export function wheelIndex(random = () => crypto.getRandomValues(new Uint32Array(1))[0], count = 6) {
  const limit = Math.floor(2 ** 32 / count) * count;
  let value: number;
  do { value = random(); } while (value >= limit);
  return value % count;
}
