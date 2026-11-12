// Peças de gráfico compartilhadas pelos dashboards (demonstração e dados reais)
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import Reveal from './Reveal';
import Sparkline from './Sparkline';
import { int } from '../lib/data';

export function ChartTip({ active, payload, label, fmt = int }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-2xl! px-3.5 py-2.5 text-xs">
      {label && <p className="mb-1 font-semibold text-white/80">{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-white/70">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload.fill }} />
          {p.name}: <b className="text-white">{fmt(p.value, p.dataKey)}</b>
        </p>
      ))}
    </div>
  );
}

export function Kpi({ icon: Icon, label, value, delta, spark, delay, lowerIsBetter = false }) {
  const up = delta >= 0;
  const good = lowerIsBetter ? !up : up;
  return (
    <Reveal delay={delay}>
      <motion.div whileHover={{ y: -4 }} className="glass group relative h-full overflow-hidden p-5">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand/10 blur-2xl transition duration-700 group-hover:bg-brand/25" />
        <div className="relative flex items-start justify-between">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.05]"><Icon className="h-[18px] w-[18px] text-brand-300" /></span>
          {delta != null && Number.isFinite(delta) && (
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${good ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'}`}>
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(delta).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
            </span>
          )}
        </div>
        <p className="relative mt-5 text-xs font-medium uppercase tracking-wider text-white/45">{label}</p>
        <div className="relative mt-1 flex items-end justify-between gap-2">
          <p className="font-display text-2xl font-bold sm:text-[1.7rem]">{value}</p>
          <Sparkline data={spark} width={84} height={30} />
        </div>
      </motion.div>
    </Reveal>
  );
}
