// Dashboard com dados reais (API da Meta) e o painel de relatórios usado nos dois modos.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Wallet, MessageCircle, Target, Users, TrendingDown, AlertTriangle, ArrowUpRight, RotateCcw, FileBarChart, Calculator, Info } from 'lucide-react';
import Reveal from '../components/Reveal';
import { ChartTip, Kpi } from '../components/charts';
import { useAuth } from '../lib/auth';
import { brl, compact, int } from '../lib/data';
import { monthLabel } from '../lib/overview';
import { listSavedReports } from '../lib/report/library';

const RANGES = { '3M': 3, '6M': 6 };
const PIE = ['#F76000', '#FFA266', '#BD4C04', '#8A4A1F', '#5B6068'];

export function ReportsPanel() {
  const saved = listSavedReports().slice(0, 5);
  const dmy = (iso) => iso.split('-').reverse().join('/');
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Reveal className="glass p-5 sm:p-6 xl:col-span-2">
        <div className="flex items-center justify-between">
          <div><h2 className="text-lg font-semibold">Relatórios</h2><p className="text-xs text-white/45">Relatórios de desempenho Meta Ads salvos na plataforma</p></div>
          <Link to="/relatorios" className="flex items-center gap-1 text-sm text-brand-300 transition hover:text-brand-400">Novo relatório <ArrowUpRight className="h-4 w-4" /></Link>
        </div>
        <ul className="mt-5 space-y-2">
          {saved.map((r) => (
            <li key={r.client + r.periodStart} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand-300"><FileBarChart className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{r.client}</p><p className="text-xs text-white/45">{dmy(r.periodStart)} a {dmy(r.periodEnd)} · {r.campaigns} campanha(s) · {r.ads} anúncios</p></div>
              <span className="hidden text-xs text-white/40 sm:block">{r.source}</span>
            </li>
          ))}
          {!saved.length && <li className="text-sm text-white/45">Nenhum relatório salvo ainda.</li>}
        </ul>
      </Reveal>
      <Reveal delay={0.08} className="glass flex flex-col p-5 sm:p-6">
        <span className="grid h-10 w-10 place-items-center rounded-2xl border border-brand/30 bg-brand/10"><Calculator className="h-5 w-5 text-brand-300" /></span>
        <h2 className="mt-4 text-lg font-semibold">Calculadora de escala</h2>
        <p className="mt-1 text-sm text-white/50">Projeção de conversas, vendas e custo por venda para lojas de iPhone — a mesma usada com os clientes.</p>
        <a href="/calculadora/" className="mt-auto pt-5 text-sm font-medium text-brand-300 hover:text-brand-400">Abrir calculadora →</a>
      </Reveal>
    </div>
  );
}

export function LiveDashboard({ ov }) {
  const { user } = useAuth();
  const [range, setRange] = useState('6M');
  const months = ov.months.slice(-RANGES[range]);
  const lastM = ov.months.at(-1), prevM = ov.months.at(-2);
  const sum = (m, k) => ov.accounts.reduce((s, a) => s + (a.byMonth[m]?.[k] ?? 0), 0);
  const spend = (m) => sum(m, 'spendBRL');
  const conv = (m) => sum(m, 'conversations');
  // custo por conversa só com as contas que geraram conversa (as demais têm outros objetivos)
  const convSpend = (m) => ov.accounts.reduce((s, a) => s + (a.byMonth[m]?.conversations ? a.byMonth[m].spendBRL ?? 0 : 0), 0);
  const cpc = (m) => (conv(m) ? convSpend(m) / conv(m) : null);
  const pct = (a, b) => (b ? ((a - b) / b) * 100 : null);
  const running = (m) => ov.accounts.filter((a) => a.byMonth[m]?.spend > 0).length;
  const series = months.map((m) => ({ m: monthLabel(m), investimento: spend(m), resultados: conv(m) }));
  const byClient = ov.accounts.map((a) => ({ name: a.name, value: a.byMonth[lastM]?.spendBRL ?? 0 })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const top = byClient.slice(0, 6);
  const pie = [...byClient.slice(0, 4), ...(byClient.length > 4 ? [{ name: 'Outros', value: byClient.slice(4).reduce((s, d) => s + d.value, 0) }] : [])];
  const totalLast = spend(lastM);
  const noSpend = ov.accounts.filter((a) => a.active && !(a.byMonth[lastM]?.spend > 0));
  const drops = ov.accounts.filter((a) => a.byMonth[prevM]?.spendBRL > 0 && a.byMonth[lastM]?.spend > 0 && a.byMonth[lastM].spendBRL < a.byMonth[prevM].spendBRL * 0.7);
  const missingRate = ov.accounts.some((a) => a.currency !== 'BRL' && ov.months.some((m) => a.byMonth[m]?.spend > 0 && a.byMonth[m]?.spendBRL == null));

  return (
    <div className="space-y-6">
      <Reveal className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-white/50">Olá, {user?.name?.split(' ')[0]}</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Visão geral da carteira</h1>
          <p className="mt-1 text-xs text-white/40">Meta Ads ao vivo · {monthLabel(ov.months[0])} a {monthLabel(lastM)} · contas em US$ convertidas pela PTAX média de venda de cada mês</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={ov.refresh} className="chip"><RotateCcw className="h-3.5 w-3.5" /> Atualizar</button>
          <div className="relative flex rounded-full border border-white/10 bg-white/[0.04] p-1 text-sm">
            {Object.keys(RANGES).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={`relative rounded-full px-4 py-1.5 font-medium transition-colors ${range === r ? 'text-white' : 'text-white/50 hover:text-white'}`}>
                {range === r && <motion.span layoutId="range-live" className="absolute inset-0 rounded-full bg-brand/25 ring-1 ring-brand/50" />}
                <span className="relative">{r}</span>
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Wallet} label={`Investimento · ${monthLabel(lastM)}`} value={brl(totalLast)} delta={pct(totalLast, spend(prevM))} spark={ov.months.map(spend)} delay={0} />
        <Kpi icon={MessageCircle} label="Conversas iniciadas" value={int(conv(lastM))} delta={pct(conv(lastM), conv(prevM))} spark={ov.months.map(conv)} delay={0.05} />
        <Kpi icon={Target} label="Custo por conversa" value={cpc(lastM) == null ? '—' : brl(cpc(lastM))} delta={cpc(prevM) && cpc(lastM) ? pct(cpc(lastM), cpc(prevM)) : null} spark={ov.months.map((m) => cpc(m) ?? 0)} delay={0.1} lowerIsBetter />
        <Kpi icon={Users} label="Contas com veiculação" value={`${running(lastM)} / ${ov.accounts.length}`} delta={null} spark={ov.months.map(running)} delay={0.15} />
      </div>
      {missingRate && <p className="flex items-center gap-2 text-xs text-amber-200/80"><Info className="h-3.5 w-3.5" /> A PTAX de algum mês não pôde ser consultada; gastos em dólar desse mês ficaram fora dos totais em real.</p>}

      <div className="grid gap-4 xl:grid-cols-3">
        <Reveal className="glass p-5 sm:p-6 xl:col-span-2">
          <h2 className="text-lg font-semibold">Crescimento</h2>
          <p className="text-xs text-white/45">Investimento (R$) × conversas iniciadas por mês</p>
          <div className="mt-6 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: -10, right: 4, top: 8 }}>
                <defs>
                  <linearGradient id="lInv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F76000" stopOpacity={0.45} /><stop offset="100%" stopColor="#F76000" stopOpacity={0} /></linearGradient>
                  <linearGradient id="lRes" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity={0.18} /><stop offset="100%" stopColor="#fff" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                <XAxis dataKey="m" tick={{ fill: 'rgba(255,255,255,.45)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" tick={{ fill: 'rgba(255,255,255,.4)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={compact} domain={[0, 'auto']} />
                <YAxis yAxisId="r" orientation="right" hide domain={[0, 'auto']} />
                <Tooltip content={<ChartTip fmt={(v, k) => (k === 'investimento' ? brl(v) : int(v))} />} cursor={{ stroke: 'rgba(247,96,0,.4)', strokeDasharray: 4 }} />
                <Area yAxisId="l" type="monotone" dataKey="investimento" name="Investimento" stroke="#F76000" strokeWidth={2.5} fill="url(#lInv)" />
                <Area yAxisId="r" type="monotone" dataKey="resultados" name="Conversas" stroke="rgba(255,255,255,.85)" strokeWidth={2} fill="url(#lRes)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Reveal>
        <Reveal delay={0.08} className="glass p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Investimento por cliente</h2>
          <p className="text-xs text-white/45">{monthLabel(lastM)}</p>
          <div className="relative mt-4 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="92%" paddingAngle={3} stroke="none" cornerRadius={6}>
                  {pie.map((d, i) => <Cell key={d.name} fill={PIE[i % PIE.length]} />)}
                </Pie>
                <Tooltip content={<ChartTip fmt={brl} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="text-[11px] uppercase tracking-wider text-white/45">Total</p><p className="font-display text-lg font-bold">{brl(totalLast)}</p></div></div>
          </div>
          <ul className="mt-4 space-y-2.5">
            {pie.map((d, i) => (
              <li key={d.name} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-white/70"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIE[i % PIE.length] }} /><span className="truncate">{d.name}</span></span>
                <span className="font-medium">{totalLast ? ((d.value / totalLast) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : 0}%</span>
              </li>
            ))}
            {!pie.length && <li className="text-sm text-white/45">Sem gasto no mês.</li>}
          </ul>
        </Reveal>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Reveal className="glass p-5 sm:p-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div><h2 className="text-lg font-semibold">Maiores investimentos</h2><p className="text-xs text-white/45">{monthLabel(lastM)} · em R$</p></div>
            <Link to="/clientes" className="flex items-center gap-1 text-sm text-brand-300 transition hover:text-brand-400">Ver clientes <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-6 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top} layout="vertical" margin={{ left: 0, right: 16 }}>
                <defs><linearGradient id="lBar" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#BD4C04" /><stop offset="100%" stopColor="#FF7A1F" /></linearGradient></defs>
                <CartesianGrid stroke="rgba(255,255,255,.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'rgba(255,255,255,.4)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={compact} domain={[0, 'auto']} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fill: 'rgba(255,255,255,.7)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip fmt={brl} />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                <Bar dataKey="value" name="Investimento" fill="url(#lBar)" radius={[0, 10, 10, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Reveal>
        <Reveal delay={0.08} className="glass flex flex-col p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Atenção agora</h2>
          <p className="text-xs text-white/45">Com base nos números da Meta</p>
          <ul className="mt-5 space-y-3">
            {noSpend.slice(0, 4).map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3.5">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-zinc-400/15 text-zinc-300"><AlertTriangle className="h-4 w-4" /></span>
                <div className="min-w-0"><p className="truncate text-sm font-semibold">{a.name}</p><p className="text-xs text-white/50">Conta ativa sem gasto em {monthLabel(lastM)}.</p></div>
              </li>
            ))}
            {drops.slice(0, 4).map((a) => (
              <li key={a.id + 'd'} className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3.5">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-rose-400/15 text-rose-300"><TrendingDown className="h-4 w-4" /></span>
                <div className="min-w-0"><p className="truncate text-sm font-semibold">{a.name}</p><p className="text-xs text-white/50">Investimento caiu {Math.round((1 - a.byMonth[lastM].spendBRL / a.byMonth[prevM].spendBRL) * 100)}% em relação a {monthLabel(prevM)}.</p></div>
              </li>
            ))}
            {!noSpend.length && !drops.length && <li className="text-sm text-white/45">Nenhum alerta no mês.</li>}
          </ul>
        </Reveal>
      </div>

      <ReportsPanel />
    </div>
  );
}
