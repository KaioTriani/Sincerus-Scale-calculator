// Dados fictícios do modo demonstração (sem API da Meta). Nomes e valores inventados.

export const CATEGORIES = ['Automotivo', 'Eletrônicos', 'Serviços', 'Varejo'];
export const STATUSES = ['Ativo', 'Onboarding', 'Pausado', 'Em risco'];
export const PLANS = ['Essencial', 'Performance', 'Scale'];

export const STATUS_STYLE = {
  Ativo: { dot: 'bg-emerald-400', text: 'text-emerald-300', ring: 'ring-emerald-400/30' },
  Onboarding: { dot: 'bg-sky-400', text: 'text-sky-300', ring: 'ring-sky-400/30' },
  Pausado: { dot: 'bg-zinc-400', text: 'text-zinc-300', ring: 'ring-zinc-400/30' },
  'Em risco': { dot: 'bg-rose-400', text: 'text-rose-300', ring: 'ring-rose-400/30' },
};
export const PLAN_STYLE = {
  Essencial: 'border-white/15 text-white/70',
  Performance: 'border-brand/40 text-brand-300',
  Scale: 'border-brand bg-brand/15 text-white',
};

export const CLIENTS = [
  { id: 'auto-prime', name: 'Auto Prime', category: 'Automotivo', status: 'Ativo', plan: 'Scale', city: 'João Pessoa · PB', since: 'jul/2026', manager: 'Kaio', objective: 'Conversas no WhatsApp', spend: 3150, results: 268, resultLabel: 'conversas', trend: [1800, 2100, 2350, 2600, 2900, 3201], campaigns: 2, ads: 29 },
  { id: 'veloz-motors', name: 'Veloz Motors', category: 'Automotivo', status: 'Ativo', plan: 'Performance', city: 'João Pessoa · PB', since: 'mai/2026', manager: 'Matheus', objective: 'Conversas no WhatsApp', spend: 2200, results: 290, resultLabel: 'conversas', trend: [1500, 1700, 1650, 1900, 2100, 2245], campaigns: 1, ads: 11 },
  { id: 'nova-garagem', name: 'Nova Garagem', category: 'Automotivo', status: 'Onboarding', plan: 'Essencial', city: 'Campina Grande · PB', since: 'set/2026', manager: 'Kaio', objective: 'Conversas no WhatsApp', spend: 160, results: 90, resultLabel: 'conversas', trend: [0, 0, 0, 0, 60, 152], campaigns: 1, ads: 7 },
  { id: 'apple-point', name: 'Apple Point', category: 'Eletrônicos', status: 'Em risco', plan: 'Performance', city: 'Recife · PE', since: 'jun/2026', manager: 'Matheus', objective: 'Geração de leads', spend: 430, results: 9, resultLabel: 'leads', trend: [520, 610, 580, 470, 450, 424], campaigns: 1, ads: 9 },
  { id: 'prime-motors', name: 'Prime Motors', category: 'Automotivo', status: 'Ativo', plan: 'Performance', city: 'Natal · RN', since: 'abr/2026', manager: 'Kaio', objective: 'Conversas no WhatsApp', spend: 1680.4, results: 212, resultLabel: 'conversas', trend: [1200, 1350, 1400, 1520, 1600, 1680], campaigns: 2, ads: 14 },
  { id: 'casa-nova', name: 'Casa Nova Imóveis', category: 'Serviços', status: 'Ativo', plan: 'Scale', city: 'João Pessoa · PB', since: 'fev/2026', manager: 'Matheus', objective: 'Geração de leads', spend: 2890.0, results: 146, resultLabel: 'leads', trend: [2400, 2500, 2650, 2700, 2820, 2890], campaigns: 3, ads: 18 },
  { id: 'vitta', name: 'Vitta Clínica', category: 'Serviços', status: 'Pausado', plan: 'Essencial', city: 'Cabedelo · PB', since: 'mar/2026', manager: 'Kaio', objective: 'Agendamentos', spend: 0, results: 0, resultLabel: 'agendamentos', trend: [640, 700, 680, 520, 210, 0], campaigns: 1, ads: 6 },
  { id: 'urban-store', name: 'Urban Store', category: 'Varejo', status: 'Ativo', plan: 'Performance', city: 'Recife · PE', since: 'jan/2026', manager: 'Matheus', objective: 'Vendas no site', spend: 1975.3, results: 131, resultLabel: 'vendas', trend: [1500, 1620, 1750, 1800, 1900, 1975], campaigns: 2, ads: 12 },
  { id: 'nexo-tech', name: 'Nexo Tech', category: 'Eletrônicos', status: 'Onboarding', plan: 'Essencial', city: 'Fortaleza · CE', since: 'out/2026', manager: 'Kaio', objective: 'Mensagens no Instagram', spend: 310.5, results: 54, resultLabel: 'conversas', trend: [0, 0, 0, 0, 0, 310], campaigns: 1, ads: 4 },
];

export const initials = (n) => n.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
export const cpr = (c) => (c.results ? c.spend / c.results : null);

export const MONTHLY = [
  { m: 'Mai', investimento: 9800, resultados: 820, receita: 61000 },
  { m: 'Jun', investimento: 10600, resultados: 905, receita: 66500 },
  { m: 'Jul', investimento: 11300, resultados: 990, receita: 70800 },
  { m: 'Ago', investimento: 11900, resultados: 1062, receita: 77200 },
  { m: 'Set', investimento: 12650, resultados: 1140, receita: 82900 },
  { m: 'Out', investimento: 12881.09, resultados: 1230, receita: 88400 },
];

const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const intFmt = new Intl.NumberFormat('pt-BR');
export const brl = (v) => (v == null ? '—' : brlFmt.format(v));
export const int = (v) => (v == null ? '—' : intFmt.format(v));
export const compact = (v) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
