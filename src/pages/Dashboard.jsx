import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Wallet, MessageCircle, Target, Users, TrendingUp, TrendingDown, AlertTriangle, ArrowUpRight, Rocket, RotateCcw, FileBarChart, Calculator, Loader2, Info } from 'lucide-react';
import Reveal from '../components/Reveal';
import Sparkline from '../components/Sparkline';
import { useAuth } from '../lib/auth';
import { CATEGORIES, CLIENTS, MONTHLY, brl, compact, cpr, int } from '../lib/data';
import { useOverview } from '../lib/overview';
import { ChartTip, Kpi } from '../components/charts';
import { LiveDashboard, ReportsPanel } from './DashboardLive';

const PIE_COLORS = ['#F76000', '#FFA266', '#BD4C04', '#5B6068'];
const RANGES = { '3M': 3, '6M': 6 };

function DemoDashboard() {
  const { user } = useAuth();
  const [range, setRange] = useState('6M');
  const series = MONTHLY.slice(-RANGES[range]);
  const last = MONTHLY.at(-1), prev = MONTHLY.at(-2);
  const pct = (a, b) => ((a - b) / b) * 100;
  const active = CLIENTS.filter((c) => c.status === 'Ativo' || c.status === 'Onboarding');

  const byCategory = useMemo(
    () => CATEGORIES.map((cat) => ({ name: cat, value: CLIENTS.filter((c) => c.category === cat).reduce((s, c) => s + c.spend, 0) })).filter((d) => d.value > 0),
    [],
  );
  const totalSpend = byCategory.reduce((s, d) => s + d.value, 0);
  const topClients = useMemo(() => [...CLIENTS].filter((c) => c.spend > 0).sort((a, b) => b.spend - a.spend).slice(0, 6).map((c) => ({ name: c.name, spend: c.spend })), []);
  const alerts = CLIENTS.filter((c) => c.status === 'Em risco' || c.status === 'Pausado');

  return (
    <div className="space-y-6">
      <Reveal className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-white/50">Olá, {user?.name?.split(' ')[0]} 👋</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Visão geral da carteira</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-white/40 sm:block">Dados de demonstração</span>
          <div className="relative flex rounded-full border border-white/10 bg-white/[0.04] p-1 text-sm">
            {Object.keys(RANGES).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={`relative rounded-full px-4 py-1.5 font-medium transition-colors ${range === r ? 'text-white' : 'text-white/50 hover:text-white'}`}>
                {range === r && <motion.span layoutId="range" className="absolute inset-0 rounded-full bg-brand/25 ring-1 ring-brand/50" />}
                <span className="relative">{r}</span>
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Wallet} label="Investimento no mês" value={brl(last.investimento)} delta={pct(last.investimento, prev.investimento)} spark={MONTHLY.map((m) => m.investimento)} delay={0} />
        <Kpi icon={MessageCircle} label="Resultados" value={int(last.resultados)} delta={pct(last.resultados, prev.resultados)} spark={MONTHLY.map((m) => m.resultados)} delay={0.05} />
        <Kpi icon={Target} label="Custo por resultado" value={brl(last.investimento / last.resultados)} delta={pct(last.investimento / last.resultados, prev.investimento / prev.resultados)} spark={MONTHLY.map((m) => m.investimento / m.resultados)} delay={0.1} lowerIsBetter />
        <Kpi icon={Users} label="Clientes ativos" value={`${active.length} / ${CLIENTS.length}`} delta={12.5} spark={[5, 5, 6, 6, 7, active.length]} delay={0.15} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Reveal className="glass p-5 sm:p-6 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Crescimento</h2>
              <p className="text-xs text-white/45">Investimento × resultados por mês</p>
            </div>
            <div className="flex gap-4 text-xs text-white/60">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" />Investimento</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/80" />Resultados</span>
            </div>
          </div>
          <div className="mt-6 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: -10, right: 4, top: 8 }}>
                <defs>
                  <linearGradient id="gInv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F76000" stopOpacity={0.45} /><stop offset="100%" stopColor="#F76000" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity={0.18} /><stop offset="100%" stopColor="#fff" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                <XAxis dataKey="m" tick={{ fill: 'rgba(255,255,255,.45)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" tick={{ fill: 'rgba(255,255,255,.4)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={compact} domain={[0, 'auto']} />
                <YAxis yAxisId="r" orientation="right" hide domain={[0, 'auto']} />
                <Tooltip content={<ChartTip fmt={(v, k) => (k === 'investimento' ? brl(v) : int(v))} />} cursor={{ stroke: 'rgba(247,96,0,.4)', strokeDasharray: 4 }} />
                <Area yAxisId="l" type="monotone" dataKey="investimento" name="Investimento" stroke="#F76000" strokeWidth={2.5} fill="url(#gInv)" animationDuration={1400} />
                <Area yAxisId="r" type="monotone" dataKey="resultados" name="Resultados" stroke="rgba(255,255,255,.85)" strokeWidth={2} fill="url(#gRes)" animationDuration={1600} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Reveal>

        <Reveal delay={0.08} className="glass p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Investimento por nicho</h2>
          <p className="text-xs text-white/45">Distribuição no mês</p>
          <div className="relative mt-4 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="92%" paddingAngle={3} stroke="none" cornerRadius={6} animationDuration={1300}>
                  {byCategory.map((d, i) => <Cell key={d.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTip fmt={brl} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div><p className="text-[11px] uppercase tracking-wider text-white/45">Total</p><p className="font-display text-lg font-bold">{brl(totalSpend)}</p></div>
            </div>
          </div>
          <ul className="mt-4 space-y-2.5">
            {byCategory.map((d, i) => (
              <li key={d.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-white/70"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />{d.name}</span>
                <span className="font-medium">{((d.value / totalSpend) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Reveal className="glass p-5 sm:p-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Maiores investimentos</h2>
              <p className="text-xs text-white/45">Top clientes no mês</p>
            </div>
            <Link to="/clientes" className="flex items-center gap-1 text-sm text-brand-300 transition hover:text-brand-400">Ver clientes <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-6 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topClients} layout="vertical" margin={{ left: 0, right: 16 }}>
                <defs>
                  <linearGradient id="gBar" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#BD4C04" /><stop offset="100%" stopColor="#FF7A1F" /></linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'rgba(255,255,255,.4)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={compact} domain={[0, 'auto']} />
                <YAxis type="category" dataKey="name" width={118} tick={{ fill: 'rgba(255,255,255,.7)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip fmt={brl} />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                <Bar dataKey="spend" name="Investimento" fill="url(#gBar)" radius={[0, 10, 10, 0]} barSize={16} animationDuration={1300} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Reveal>

        <Reveal delay={0.08} className="glass flex flex-col p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Atenção agora</h2>
          <p className="text-xs text-white/45">Clientes que pedem ação</p>
          <ul className="mt-5 space-y-3">
            {alerts.map((c) => (
              <li key={c.id} className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3.5">
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${c.status === 'Em risco' ? 'bg-rose-400/15 text-rose-300' : 'bg-zinc-400/15 text-zinc-300'}`}><AlertTriangle className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="text-xs leading-relaxed text-white/50">
                    {c.status === 'Em risco' ? `Custo por ${c.resultLabel.replace(/s$/, '')} em ${brl(cpr(c))} e investimento caindo há 3 meses.` : 'Campanhas pausadas — sem veiculação no mês.'}
                  </p>
                </div>
              </li>
            ))}
            <li className="flex items-start gap-3 rounded-2xl border border-brand/25 bg-brand/[0.07] p-3.5">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand/20 text-brand-300"><Rocket className="h-4 w-4" /></span>
              <div>
                <p className="text-sm font-semibold">Oportunidade de escala</p>
                <p className="text-xs leading-relaxed text-white/50">Veloz Motors e Auto Prime com custo por conversa abaixo da média da carteira.</p>
              </div>
            </li>
          </ul>
        </Reveal>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const ov = useOverview();
  if (ov.loading && !ov.live) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-brand-300" /></div>;
  if (ov.live) return <LiveDashboard ov={ov} />;
  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100/90">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        {ov.error ? `Não foi possível ler a API da Meta: ${ov.error}` : 'Modo demonstração: a API da Meta não está configurada no servidor. Os números abaixo são fictícios.'}
      </p>
      <DemoDashboard />
      <ReportsPanel />
    </div>
  );
}
