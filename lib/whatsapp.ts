import { money, decimal } from './simulation.ts';
import type { Simulation } from './simulation.ts';

export function whatsappMessage(sim: Simulation, cashback: number) {
  const { input, scenarios, factor, alerts } = sim;
  const lines = [
    'Olá, equipe Sincerus Scale! Fiz minha simulação para uma loja de iPhone e quero dar o próximo passo.',
    '', '*Minha simulação*', `Investimento mensal em mídia: ${money(input.investment)}`,
    `Margem por aparelho: ${input.margin === undefined ? 'não informada' : money(input.margin)}`,
    `Capacidade de atendimento: ${input.capacity === undefined ? 'não informada' : decimal(input.capacity) + ' conversas/dia'}`,
    `Histórico próprio — custo/conversa: ${input.cost === undefined ? 'não informado' : money(input.cost)}; fechamento: ${input.closing === undefined ? 'não informado' : decimal(input.closing,2) + '%'}`,
    `Fator de escala: ${decimal(factor,4)}. Ritmo calculado em 30 dias/mês.`,
    '',
  ];
  for (const s of scenarios) {
    lines.push(`*${s.name}*`, `Conversas: ${decimal(s.conversations,0)} | Vendas estimadas: ${decimal(s.sales)} | CAC: ${money(s.cac)}`, `Ritmo: ${decimal(s.daily)} conversas/dia`, `Premissas: ${money(s.cost)} por conversa e ${decimal(s.closing,2)}% de fechamento`);
    if (s.revenue !== undefined) lines.push(`Lucro bruto: ${money(s.revenue)} | Lucro líquido: ${money(s.profit!)} | ROAS do modelo: ${decimal(s.roas!,2)}×`);
    lines.push('');
  }
  if (input.margin !== undefined) lines.push('Lucro bruto e ROAS do modelo usam margem por aparelho, não faturamento.');
  lines.push(...alerts.map(a=>`Atenção: ${a}`), '', `*Cashback exclusivo sorteado: ${money(cashback)}*`, 'Cashback separado da projeção de lucro. Condições de utilização a confirmar no fechamento.', '', 'Base: 9 lojas de iPhone · R$ 33.836 investidos · 6.408 conversas. Amostra de vendas: 3 lojas e 96 vendas confirmadas. Atualização: setembro de 2026.', 'Estimativa baseada em histórico real de 9 lojas. Não é garantia de resultado. Apenas vendas originadas em tráfego pago.', '', 'Quero aproveitar meu cashback e planejar minha campanha com vocês. Vamos alinhar as condições e fechar meu plano?');
  return lines.join('\n');
}
export function whatsappURL(phone: string, sim: Simulation, cashback: number) {
  if (!/^\d{10,15}$/.test(phone)) throw new Error('WhatsApp comercial não configurado.');
  return `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage(sim,cashback))}`;
}
