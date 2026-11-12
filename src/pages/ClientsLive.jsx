// Carteira com as contas reais de anúncio (API da Meta)
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Search, X, FileBarChart, RotateCcw } from 'lucide-react';
import Reveal from '../components/Reveal';
import Button from '../components/Button';
import Sparkline from '../components/Sparkline';
import { brl, int, initials } from '../lib/data';
import { monthLabel } from '../lib/overview';

const usd = (v) => 'US$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const own = (a, v) => (a.currency === 'USD' ? usd(v) : brl(v));
const GROUPS = [
  { key: 'running', label: 'Com veiculação no mês', dot: 'bg-emerald-400' },
  { key: 'idle', label: 'Sem veiculação no mês', dot: 'bg-zinc-400' },
  { key: 'off', label: 'Conta não ativa', dot: 'bg-rose-400' },
];

function Drawer({ a, ov, onClose }) {
  const navigate = useNavigate();
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const data = ov.months.map((m) => ({ m: monthLabel(m), v: a.byMonth[m]?.spendBRL ?? 0 }));
  const last = a.byMonth[ov.months.at(-1)];
  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside role="dialog" aria-modal="true" aria-label={a.name} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 260, damping: 32 }}
        className="scrollbar-thin fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-white/10 bg-carbon-900/90 p-6 backdrop-blur-2xl sm:p-8">
        <button onClick={onClose} className="absolute right-5 top-5 rounded-full border border-white/10 p-2 text-white/60 transition hover:text-white" aria-label="Fechar"><X className="h-4 w-4" /></button>
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-linear-to-br from-brand-400 to-brand-700 font-display text-lg font-bold shadow-glow">{initials(a.name)}</span>
        <h2 className="mt-5 text-2xl font-bold">{a.name}</h2>
        <p className="mt-1 text-xs text-white/45">Conta {a.accountId} · {a.status} · moeda {a.currency}{a.business ? ` · ${a.business}` : ''}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {[[`Gasto ${monthLabel(ov.months.at(-1))}`, own(a, last?.spend ?? 0)], ['Em real', last?.spendBRL == null ? '—' : brl(last.spendBRL)], ['Impressões', int(last?.imp ?? 0)], ['Conversas iniciadas', int(last?.conversations ?? 0)]].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4"><p className="text-[11px] text-white/45">{k}</p><p className="mt-1 font-display text-lg font-semibold">{v}</p></div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
          <p className="text-xs text-white/50">Investimento em R$ · últimos {ov.months.length} meses</p>
          <div className="mt-3 h-36">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ left: 0, right: 0, top: 6 }}>
                <defs><linearGradient id="gLive" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F76000" stopOpacity={0.45} /><stop offset="100%" stopColor="#F76000" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="m" tick={{ fill: 'rgba(255,255,255,.45)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: '#131519', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, fontSize: 12 }} labelStyle={{ color: '#fff' }} />
                <Area type="monotone" dataKey="v" name="Investimento" stroke="#F76000" strokeWidth={2.5} fill="url(#gLive)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <Button icon={FileBarChart} className="mt-6 w-full" onClick={() => navigate(`/relatorios?cliente=${a.id}`)}>Gerar relatório deste cliente</Button>
      </motion.aside>
    </>
  );
}

export default function LiveClients({ ov }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);
  const lastM = ov.months.at(-1);
  const groupOf = (a) => (!a.active ? 'off' : a.byMonth[lastM]?.spend > 0 ? 'running' : 'idle');
  const filtered = useMemo(() => ov.accounts.filter((a) => a.name.toLowerCase().includes(query.trim().toLowerCase())), [ov.accounts, query]);

  return (
    <div className="space-y-6">
      <Reveal className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm text-white/50">Carteira · Meta Ads ao vivo</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Clientes</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {GROUPS.map((g) => (
            <span key={g.key} className="glass flex items-center gap-2 rounded-2xl! px-3.5 py-2 text-xs">
              <span className={`h-2 w-2 rounded-full ${g.dot}`} /><span className="text-white/60">{g.label}</span>
              <b className="font-display">{ov.accounts.filter((a) => groupOf(a) === g.key).length}</b>
            </span>
          ))}
          <button onClick={ov.refresh} className="chip"><RotateCcw className="h-3.5 w-3.5" /> Atualizar</button>
        </div>
      </Reveal>

      <Reveal delay={0.05} className="glass p-4 sm:p-5">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar conta de anúncio" className="w-full rounded-full border border-white/10 bg-white/[0.04] py-2.5 pl-11 pr-4 text-sm outline-none transition placeholder:text-white/35 focus:border-brand/50" />
        </label>
      </Reveal>

      {GROUPS.map((g) => {
        const items = filtered.filter((a) => groupOf(a) === g.key).sort((a, b) => (b.byMonth[lastM]?.spendBRL ?? 0) - (a.byMonth[lastM]?.spendBRL ?? 0));
        if (!items.length) return null;
        return (
          <section key={g.key}>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-lg font-semibold">{g.label}</h2>
              <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs text-white/60">{items.length}</span>
              <span className="h-px flex-1 bg-linear-to-r from-white/10 to-transparent" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((a) => {
                const m = a.byMonth[lastM] || {};
                return (
                  <motion.button key={a.id} whileHover={{ y: -5 }} onClick={() => setOpen(a)} className="glass group relative w-full overflow-hidden p-5 text-left">
                    <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-brand/0 blur-3xl transition duration-700 group-hover:bg-brand/20" />
                    <div className="relative flex items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-brand-400/90 to-brand-700 font-display text-sm font-bold shadow-glow">{initials(a.name)}</span>
                      <div className="min-w-0 flex-1"><p className="truncate font-display font-semibold">{a.name}</p><p className="truncate text-xs text-white/45">{a.status} · conta {a.accountId}</p></div>
                      <span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[10.5px] font-semibold text-white/70">{a.currency}</span>
                    </div>
                    <div className="relative mt-5 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-white/40">Gasto · {monthLabel(lastM)}</p>
                        <p className="font-display text-xl font-bold">{own(a, m.spend ?? 0)}</p>
                        {a.currency === 'USD' && <p className="text-xs text-white/45">{m.spendBRL == null ? '—' : brl(m.spendBRL)}</p>}
                      </div>
                      <Sparkline data={ov.months.map((x) => a.byMonth[x]?.spendBRL ?? 0)} width={90} height={34} />
                    </div>
                    <div className="relative mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs text-white/55">
                      <span>{int(m.imp ?? 0)} impressões</span><span>{int(m.conversations ?? 0)} conversas</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>
        );
      })}
      {!filtered.length && <div className="glass p-10 text-center text-sm text-white/50">Nenhuma conta encontrada.</div>}
      {createPortal(<AnimatePresence>{open && <Drawer a={open} ov={ov} onClose={() => setOpen(null)} />}</AnimatePresence>, document.body)}
    </div>
  );
}
