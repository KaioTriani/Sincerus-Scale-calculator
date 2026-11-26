import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Loader2, Info, Search, X, MapPin, CalendarDays, UserRound, Target, Megaphone, LayoutGrid, ChevronRight } from 'lucide-react';
import Reveal from '../components/Reveal';
import LiveClients from './ClientsLive';
import { useOverview } from '../lib/overview';
import Sparkline from '../components/Sparkline';
import { CATEGORIES, CLIENTS, PLANS, PLAN_STYLE, STATUSES, STATUS_STYLE, brl, cpr, initials, int } from '../lib/data';

const GROUPS = {
  status: { label: 'Status', order: STATUSES, key: 'status' },
  category: { label: 'Nicho', order: CATEGORIES, key: 'category' },
  plan: { label: 'Plano', order: [...PLANS].reverse(), key: 'plan' },
};
const MONTHS = ['Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out'];

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold ring-1 ${s.ring} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${status === 'Ativo' ? 'animate-pulse' : ''}`} />{status}
    </span>
  );
}

function ClientCard({ c, onOpen }) {
  const cost = cpr(c);
  return (
    <motion.button
      layout
      layoutId={`card-${c.id}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -5 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      onClick={() => onOpen(c)}
      className="glass group relative w-full overflow-hidden p-5 text-left"
    >
      <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-brand/0 blur-3xl transition duration-700 group-hover:bg-brand/20" />
      <div className="relative flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-brand-400/90 to-brand-700 font-display text-sm font-bold shadow-glow">{initials(c.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-semibold">{c.name}</p>
          <p className="truncate text-xs text-white/45">{c.category} · {c.city}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ${PLAN_STYLE[c.plan]}`}>{c.plan}</span>
      </div>
      <div className="relative mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-white/40">Investimento</p>
          <p className="font-display text-xl font-bold">{brl(c.spend)}</p>
        </div>
        <Sparkline data={c.trend} width={90} height={34} color={c.status === 'Em risco' ? '#FB7185' : '#F76000'} />
      </div>
      <div className="relative mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs">
        <StatusBadge status={c.status} />
        <span className="text-white/55">{int(c.results)} {c.resultLabel}{cost ? ` · ${brl(cost)}` : ''}</span>
      </div>
      <ChevronRight className="absolute bottom-5 right-4 hidden h-4 w-4 text-white/0 transition group-hover:text-white/40" />
    </motion.button>
  );
}

function Drawer({ c, onClose }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const data = c.trend.map((v, i) => ({ m: MONTHS[i], v }));
  const cost = cpr(c);
  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={c.name}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 32 }}
        className="scrollbar-thin fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-white/10 bg-carbon-900/90 p-6 backdrop-blur-2xl sm:p-8"
      >
        <button onClick={onClose} className="absolute right-5 top-5 rounded-full border border-white/10 p-2 text-white/60 transition hover:text-white" aria-label="Fechar"><X className="h-4 w-4" /></button>
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-linear-to-br from-brand-400 to-brand-700 font-display text-lg font-bold shadow-glow">{initials(c.name)}</span>
        <h2 className="mt-5 text-2xl font-bold">{c.name}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={c.status} />
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${PLAN_STYLE[c.plan]}`}>Plano {c.plan}</span>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3">
          {[['Investimento (mês)', brl(c.spend)], [`${c.resultLabel[0].toUpperCase()}${c.resultLabel.slice(1)}`, int(c.results)], ['Custo por resultado', cost ? brl(cost) : '—'], ['Campanhas · anúncios', `${c.campaigns} · ${c.ads}`]].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
              <p className="text-[11px] text-white/45">{k}</p>
              <p className="mt-1 font-display text-lg font-semibold">{v}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
          <p className="text-xs text-white/50">Investimento · últimos 6 meses</p>
          <div className="mt-3 h-36">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ left: 0, right: 0, top: 6 }}>
                <defs><linearGradient id="gD" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F76000" stopOpacity={0.45} /><stop offset="100%" stopColor="#F76000" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="m" tick={{ fill: 'rgba(255,255,255,.45)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: '#131519', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, fontSize: 12 }} labelStyle={{ color: '#fff' }} />
                <Area type="monotone" dataKey="v" name="Investimento" stroke="#F76000" strokeWidth={2.5} fill="url(#gD)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <ul className="mt-6 space-y-3 text-sm">
          {[[Target, 'Objetivo', c.objective], [MapPin, 'Cidade', c.city], [CalendarDays, 'Cliente desde', c.since], [UserRound, 'Gestor', c.manager], [Megaphone, 'Nicho', c.category]].map(([I, k, v]) => (
            <li key={k} className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.05]"><I className="h-4 w-4 text-brand-300" /></span>
              <span className="text-white/50">{k}</span>
              <span className="ml-auto font-medium">{v}</span>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-[11px] text-white/35">Dados de demonstração.</p>
      </motion.aside>
    </>
  );
}

function DemoClients() {
  const [groupBy, setGroupBy] = useState('status');
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('Todos');
  const [open, setOpen] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CLIENTS.filter((c) => (cat === 'Todos' || c.category === cat) && (!q || `${c.name} ${c.city} ${c.category}`.toLowerCase().includes(q)));
  }, [query, cat]);
  const g = GROUPS[groupBy];
  const groups = g.order.map((name) => ({ name, items: filtered.filter((c) => c[g.key] === name).sort((a, b) => b.spend - a.spend) })).filter((x) => x.items.length);

  return (
    <div className="space-y-6">
      <Reveal className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm text-white/50">Carteira</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Clientes</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <span key={s} className="glass flex items-center gap-2 rounded-2xl! px-3.5 py-2 text-xs">
              <span className={`h-2 w-2 rounded-full ${STATUS_STYLE[s].dot}`} />
              <span className="text-white/60">{s}</span>
              <b className="font-display">{CLIENTS.filter((c) => c.status === s).length}</b>
            </span>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.05} className="glass flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, cidade ou nicho" className="w-full rounded-full border border-white/10 bg-white/[0.04] py-2.5 pl-11 pr-4 text-sm outline-none transition placeholder:text-white/35 focus:border-brand/50" />
        </label>
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-white/40" />
          <span className="text-xs text-white/50">Agrupar por</span>
          <div className="relative flex rounded-full border border-white/10 bg-white/[0.04] p-1 text-sm">
            {Object.entries(GROUPS).map(([k, v]) => (
              <button key={k} onClick={() => setGroupBy(k)} className={`relative rounded-full px-3.5 py-1.5 font-medium transition-colors ${groupBy === k ? 'text-white' : 'text-white/50 hover:text-white'}`}>
                {groupBy === k && <motion.span layoutId="groupby" className="absolute inset-0 rounded-full bg-brand/25 ring-1 ring-brand/50" />}
                <span className="relative">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.08} className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {['Todos', ...CATEGORIES].map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`chip shrink-0 ${cat === c ? 'chip-active' : ''}`}>{c}</button>
        ))}
      </Reveal>

      <LayoutGroup>
        <AnimatePresence mode="popLayout">
          {groups.map((grp) => (
            <motion.section key={`${groupBy}-${grp.name}`} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-lg font-semibold">{grp.name}</h2>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs text-white/60">{grp.items.length}</span>
                <span className="h-px flex-1 bg-linear-to-r from-white/10 to-transparent" />
                <span className="text-xs text-white/45">{brl(grp.items.reduce((s, c) => s + c.spend, 0))}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {grp.items.map((c) => <ClientCard key={c.id} c={c} onOpen={setOpen} />)}
                </AnimatePresence>
              </div>
            </motion.section>
          ))}
        </AnimatePresence>
      </LayoutGroup>

      {!groups.length && (
        <div className="glass p-10 text-center text-sm text-white/50">Nenhum cliente encontrado para “{query}”.</div>
      )}

      {/* Portal: a transição da página usa transform/filter, que prenderiam um "fixed" dentro dela */}
      {createPortal(<AnimatePresence>{open && <Drawer c={open} onClose={() => setOpen(null)} />}</AnimatePresence>, document.body)}
    </div>
  );
}

export default function Clients() {
  const ov = useOverview();
  if (ov.loading && !ov.live) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-brand-300" /></div>;
  if (ov.live) return <LiveClients ov={ov} />;
  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100/90">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        {ov.error ? `Não foi possível ler a API da Meta: ${ov.error}` : 'Modo demonstração: a API da Meta não está configurada no servidor. Os clientes abaixo são exemplos.'}
      </p>
      <DemoClients />
    </div>
  );
}
