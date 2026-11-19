// Seletor de período no estilo do Gerenciador de Anúncios: atalhos à esquerda, calendário de dois meses,
// "Comparar" com um segundo período, e Cancelar / Atualizar. Datas no formato AAAA-MM-DD (dia local).
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const fmtDay = (s) => { const d = parse(s); return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`; };
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000) + 1;

// Atalhos (mesmas regras do Gerenciador: "Últimos N dias" termina ontem; semana começa na segunda)
export function presetRange(key, today = new Date()) {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const y = add(t, -1);
  const monday = add(t, -((t.getDay() + 6) % 7));
  switch (key) {
    case 'today': return [iso(t), iso(t)];
    case 'yesterday': return [iso(y), iso(y)];
    case 'today_yesterday': return [iso(y), iso(t)];
    case 'last_7d': return [iso(add(t, -7)), iso(y)];
    case 'last_14d': return [iso(add(t, -14)), iso(y)];
    case 'last_28d': return [iso(add(t, -28)), iso(y)];
    case 'last_30d': return [iso(add(t, -30)), iso(y)];
    case 'this_week': return [iso(monday), iso(t)];
    case 'last_week': return [iso(add(monday, -7)), iso(add(monday, -1))];
    case 'this_month': return [iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(t)];
    case 'last_month': return [iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), iso(new Date(t.getFullYear(), t.getMonth(), 0))];
    case 'maximum': return [iso(new Date(t.getFullYear(), t.getMonth() - 37, 1)), iso(t)];
    default: return null;
  }
}
export const PRESETS = [
  ['today', 'Hoje'], ['yesterday', 'Ontem'], ['today_yesterday', 'Hoje e ontem'], ['last_7d', 'Últimos 7 dias'], ['last_14d', 'Últimos 14 dias'],
  ['last_28d', 'Últimos 28 dias'], ['last_30d', 'Últimos 30 dias'], ['this_week', 'Esta semana'], ['last_week', 'Semana passada'],
  ['this_month', 'Este mês'], ['last_month', 'Mês passado'], ['maximum', 'Máximo'], ['custom', 'Personalizado'],
];
const presetLabel = (k) => PRESETS.find(([key]) => key === k)?.[1] || 'Personalizado';

// Período de comparação
export function compareRange(mode, [s, e]) {
  const start = parse(s);
  const n = daysBetween(s, e);
  if (mode === 'previous') return [iso(add(start, -n)), iso(add(start, -1))];
  if (mode === 'prev_month') return [iso(new Date(start.getFullYear(), start.getMonth() - 1, 1)), iso(new Date(start.getFullYear(), start.getMonth(), 0))];
  if (mode === 'prev_month2') return [iso(new Date(start.getFullYear(), start.getMonth() - 2, 1)), iso(new Date(start.getFullYear(), start.getMonth() - 1, 0))];
  return null;
}
const COMPARE = [['previous', 'Período anterior'], ['prev_month', 'Mês anterior completo'], ['prev_month2', 'Dois meses antes (completo)'], ['custom', 'Personalizado']];
export const compareLabel = ([s, e]) => {
  const a = parse(s), b = parse(e);
  const full = a.getDate() === 1 && add(b, 1).getDate() === 1 && a.getMonth() === b.getMonth();
  return full ? MESES_LONGO[a.getMonth()][0].toUpperCase() + MESES_LONGO[a.getMonth()].slice(1) : `${pad(a.getDate())}/${pad(a.getMonth() + 1)} a ${pad(b.getDate())}/${pad(b.getMonth() + 1)}`;
};

function Month({ year, month, range, hover, onPick, onHover, max }) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // semana começa na segunda
  const days = new Date(year, month + 1, 0).getDate();
  const [s, e] = range;
  const end = e || hover;
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => iso(new Date(year, month, i + 1)))];
  return (
    <div className="w-[15.5rem]">
      <div className="grid grid-cols-7 text-center text-[11px] text-white/45">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => <span key={d} className="py-1">{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center text-sm">
        {cells.map((d, i) => {
          if (!d) return <span key={`x${i}`} />;
          const lo = s && end ? (s < end ? s : end) : s;
          const hi = s && end ? (s < end ? end : s) : s;
          const edge = d === lo || d === hi;
          const inside = lo && hi && d > lo && d < hi;
          const disabled = d > max;
          return (
            <button key={d} type="button" disabled={disabled} onClick={() => onPick(d)} onMouseEnter={() => onHover(d)}
              className={`h-8 transition ${edge ? 'rounded-md bg-[#1877F2] font-semibold text-white' : inside ? 'bg-[#1877F2]/25 text-white' : 'rounded-md text-white/85 hover:bg-white/10'} disabled:cursor-not-allowed disabled:opacity-25`}>
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// value: { preset, range: [ini, fim], compare: null | { mode, range } }
export default function DateRangePicker({ value, onChange, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [picking, setPicking] = useState(null); // primeiro clique de um novo intervalo
  const [hover, setHover] = useState(null);
  const [view, setView] = useState(() => { const d = parse(value.range[1]); return new Date(d.getFullYear(), d.getMonth() - 1, 1); });
  const ref = useRef(null);
  const today = iso(new Date());

  useEffect(() => { if (open) { setDraft(value); setPicking(null); const d = parse(value.range[1]); setView(new Date(d.getFullYear(), d.getMonth() - 1, 1)); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const setRange = (range, preset = 'custom') => setDraft((d) => ({ ...d, preset, range, compare: d.compare ? { ...d.compare, range: d.compare.mode === 'custom' ? d.compare.range : compareRange(d.compare.mode, range) } : null }));
  const pick = (d) => {
    if (!picking) { setPicking(d); setDraft((x) => ({ ...x, preset: 'custom', range: [d, null] })); return; }
    const r = picking < d ? [picking, d] : [d, picking];
    setPicking(null); setRange(r);
  };
  const months = [view, new Date(view.getFullYear(), view.getMonth() + 1, 1)];
  const label = useMemo(() => `${presetLabel(value.preset)}: ${fmtDay(value.range[0])} a ${fmtDay(value.range[1])}`, [value]);
  const ready = draft.range[0] && draft.range[1];

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={`flex w-full items-center gap-2 rounded-xl border bg-white/[0.04] px-3 py-2.5 text-left text-sm transition ${open ? 'border-[#1877F2]' : 'border-white/10 hover:border-white/20'}`}>
        <CalendarDays className="h-4 w-4 shrink-0 text-white/60" />
        <span className="min-w-0 flex-1 truncate">{label}{value.compare ? <span className="text-white/45"> · comparar com {compareLabel(value.compare.range)}</span> : null}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-white/50 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute z-40 mt-2 flex max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-carbon-800 shadow-2xl sm:flex-row ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <div className="scrollbar-thin max-h-48 overflow-y-auto border-b border-white/[0.07] py-2 sm:max-h-[26rem] sm:w-44 sm:border-b-0 sm:border-r">
            <p className="px-4 pb-1 text-[11px] font-semibold text-white/45">Usados recentemente</p>
            {PRESETS.map(([k, l]) => (
              <button key={k} type="button" onClick={() => (k === 'custom' ? setDraft((d) => ({ ...d, preset: 'custom' })) : setRange(presetRange(k), k))}
                className="flex w-full items-center gap-2.5 px-4 py-1.5 text-left text-sm text-white/85 hover:bg-white/[0.06]">
                <span className={`grid h-4 w-4 place-items-center rounded-full border ${draft.preset === k ? 'border-[#1877F2]' : 'border-white/30'}`}>{draft.preset === k && <span className="h-2 w-2 rounded-full bg-[#1877F2]" />}</span>{l}
              </button>
            ))}
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between pb-2">
              <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} className="rounded-lg p-1 text-white/70 hover:bg-white/10" aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></button>
              <div className="flex flex-1 justify-around text-sm font-semibold">{months.map((m, i) => <span key={m.getMonth()} className={i === 0 ? "hidden lg:inline" : ""}>{MESES[m.getMonth()]} {m.getFullYear()}</span>)}</div>
              <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} className="rounded-lg p-1 text-white/70 hover:bg-white/10" aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row" onMouseLeave={() => setHover(null)}>
              {months.map((m, i) => <div key={m.toISOString()} className={i === 0 ? "hidden lg:block" : ""}><Month year={m.getFullYear()} month={m.getMonth()} range={draft.range} hover={picking ? hover : null} onPick={pick} onHover={setHover} max={today} /></div>)}
            </div>
            <div className="mt-4 space-y-2 border-t border-white/[0.07] pt-3 text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-white/85">
                <input type="checkbox" checked={!!draft.compare} onChange={(e) => setDraft((d) => ({ ...d, compare: e.target.checked && d.range[1] ? { mode: 'prev_month', range: compareRange('prev_month', d.range) } : null }))} className="accent-[#1877F2]" />
                Comparar
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#1877F2]/60" />
                <span className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs">{draft.range[0] ? fmtDay(draft.range[0]) : '—'}</span>
                <span className="text-white/40">–</span>
                <span className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs">{draft.range[1] ? fmtDay(draft.range[1]) : 'escolha o fim'}</span>
              </div>
              {draft.compare && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-brand/70" />
                  <select value={draft.compare.mode} onChange={(e) => { const mode = e.target.value; setDraft((d) => ({ ...d, compare: { mode, range: mode === 'custom' ? d.compare.range : compareRange(mode, d.range) } })); }}
                    className="rounded-lg border border-white/10 bg-carbon-700 px-2 py-1.5 text-xs outline-none">
                    {COMPARE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <input type="date" value={draft.compare.range[0]} max={today} onChange={(e) => setDraft((d) => ({ ...d, compare: { mode: 'custom', range: [e.target.value, d.compare.range[1]] } }))} className="rounded-lg border border-white/10 bg-carbon-700 px-2 py-1 text-xs" />
                  <input type="date" value={draft.compare.range[1]} max={today} onChange={(e) => setDraft((d) => ({ ...d, compare: { mode: 'custom', range: [d.compare.range[0], e.target.value] } }))} className="rounded-lg border border-white/10 bg-carbon-700 px-2 py-1 text-xs" />
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-[11px] text-white/35">Fuso horário das datas: o da conta de anúncios</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/15 px-3.5 py-1.5 text-sm text-white/85 hover:bg-white/[0.06]">Cancelar</button>
                <button type="button" disabled={!ready} onClick={() => { onChange(draft); setOpen(false); }} className="rounded-lg bg-[#1877F2] px-3.5 py-1.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40">Atualizar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
