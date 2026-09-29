export const CAMPAIGN_PRIZES = [200, 300, 200, 300, 200, 300, 200, 300] as const;
export const CAMPAIGN_KEY = 'sincerus-roleta-tiktok-v1';
export function campaignDraw(random = () => crypto.getRandomValues(new Uint32Array(1))[0]) {
  const index = random() % CAMPAIGN_PRIZES.length;
  return { index, amount: CAMPAIGN_PRIZES[index], rotation: 2160 + 360 - (index * 45 + 22.5) };
}
export function campaignWhatsApp(phone: string, amount: number) {
  if (amount !== 200 && amount !== 300) throw new Error('Prêmio inválido');
  const message = `Olá, equipe Sincerus! Vim pela roleta exclusiva do TikTok e meu resultado foi R$ ${amount},00 de cashback. Quero confirmar as condições e aproveitar meu benefício. Vamos conversar?`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
