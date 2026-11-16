// Painel do "Relatório para cliente" (modelo de performance Sincerus, 2 páginas A4 por cliente).
// 1) marque um ou mais clientes  2) escolha o período (filtro estilo Gerenciador)  3) busque os dados,
// revise os textos de cada cliente nas abas  4) gere um PDF único com todos.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Loader2, FileText, AlertTriangle, Plus, Trash2, Search, Sparkles, Check, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import { listClients } from '../lib/report/library';
import { fetchPtax } from '../lib/report/build';
import { computeClientReport, draftTexts, buildClientReportsHtml } from '../lib/report/clientReport';
import DateRangePicker, { presetRange, compareLabel } from './DateRangePicker';

const MANUAL = 'Cotação informada pelo usuário.';
const inputCls = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none transition placeholder:text-white/30 focus:border-brand/60';
const num = (s) => { const v = parseFloat(String(s).replace(/\./g, '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fmt = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const Label = ({ children, right }) => <span className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-white/45"><span>{children}</span>{right}</span>;
// nome amigável sugerido: sem sufixos de conta ("- DOL", "CA - ")
const friendly = (n) => String(n).replace(/^\s*(ca|ac)\s*-\s*/i, '').replace(/\s*-\s*dol\s*$/i, '').replace(/\s+dol\s*$/i, '').trim();

function Box({ checked, partial }) {
  return (
    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${checked || partial ? 'border-brand bg-brand text-black' : 'border-white/25'}`}>
      {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : partial ? <span className="h-0.5 w-2.5 rounded bg-black" /> : null}
    </span>
  );
}

function ItemList({ items, onChange, addLabel, titlePh, textPh }) {
  const set = (i, k, v) => onChange(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
          <span className="mt-2 w-6 shrink-0 text-center text-xs font-bold text-brand-300">{String(i + 1).padStart(2, '0')}</span>
          <div className="flex-1 space-y-1.5">
            <input value={it.title} onChange={(e) => set(i, 'title', e.target.value)} placeholder={titlePh} className={`${inputCls} font-semibold`} />
            <textarea value={it.text} onChange={(e) => set(i, 'text', e.target.value)} placeholder={textPh} rows={3} className={`${inputCls} resize-y`} />
          </div>
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="self-start rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-rose-300" aria-label="Remover"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <button onClick={() => onChange([...items, { title: '', text: '' }])} className="chip"><Plus className="h-3.5 w-3.5" /> {addLabel}</button>
    </div>
  );
}

export default function ClientReportPanel({ open, onClose, onPreview, initialClient }) {
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(() => new Set(initialClient ? [initialClient] : []));
  const [dates, setDates] = useState(() => ({ preset: 'last_7d', range: presetRange('last_7d'), compare: null }));
  const [showRefs, setShowRefs] = useState(false);
  const [ceiling, setCeiling] = useState('6,00');
  const [responseRef, setResponseRef] = useState('1,00');
  const [freqLimit, setFreqLimit] = useState('3,0');
  const [rate, setRate] = useState('');
  const [rateSource, setRateSource] = useState('');
  const [entries, setEntries] = useState([]); // [{ id, data, name, texts, error }]
  const [tab, setTab] = useState('');
  const [busy, setBusy] = useState(null); // { done, total }
  const [error, setError] = useState('');

  useEffect(() => { if (open && !clients.length) listClients().then((l) => setClients(l.filter((c) => c.source === 'meta'))).catch((e) => setError(e.message)); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === 'Escape' && !document.querySelector('iframe[title="Prévia do relatório"]') && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  const shown = useMemo(() => clients.filter((c) => norm(c.name).includes(norm(q.trim()))), [clients, q]);
  const nSel = clients.filter((c) => selected.has(c.id)).length;
  const allShownSel = shown.length > 0 && shown.every((c) => selected.has(c.id));
  const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleShown = () => setSelected((s) => { const n = new Set(s); shown.forEach((c) => (allShownSel ? n.delete(c.id) : n.add(c.id))); return n; });

  const baseOpts = useMemo(() => ({
    rate: num(rate), rateSource, ceiling: num(ceiling), responseRef: num(responseRef) != null ? num(responseRef) / 100 : null, freqLimit: num(freqLimit),
    compareName: dates.compare ? compareLabel(dates.compare.range) : null,
  }), [rate, rateSource, ceiling, responseRef, freqLimit, dates.compare]);
  const modelOf = (e) => (e?.data && e.data.campaigns.length && (e.data.currency !== 'USD' || baseOpts.rate > 0) ? computeClientReport(e.data, { ...baseOpts, clientName: e.name }) : null);
  const ready = entries.filter((e) => e.texts && modelOf(e));
  const cur = entries.find((e) => e.id === tab);
  const curModel = useMemo(() => modelOf(cur), [cur, baseOpts]); // eslint-disable-line react-hooks/exhaustive-deps
  const patchEntry = (id, p) => setEntries((list) => list.map((e) => (e.id === id ? { ...e, ...p } : e)));

  const load = async () => {
    const list = clients.filter((c) => selected.has(c.id));
    if (!list.length) { setError('Marque pelo menos um cliente.'); return; }
    setError(''); setBusy({ done: 0, total: list.length });
    const [s, e] = dates.range;
    const c = dates.compare?.range;
    try {
      let rt = num(rate);
      if (list.some((x) => x.currency === 'USD') && !(rt > 0)) {
        let p;
        try { p = await fetchPtax(s, e); } catch { const d = new Date(e + 'T12:00'); d.setDate(d.getDate() - 7); p = await fetchPtax(d.toISOString().slice(0, 10), e); }
        rt = p.rate; setRate(String(p.rate).replace('.', ',')); setRateSource(p.source);
      }
      const out = new Array(list.length);
      let next = 0, done = 0;
      await Promise.all(Array.from({ length: Math.min(3, list.length) }, async () => {
        while (next < list.length) {
          const k = next++;
          const cl = list[k];
          const prev = entries.find((x) => x.id === cl.id);
          const name = prev?.name || friendly(cl.name);
          try {
            const data = await api(`/meta/client-report?account=${cl.id}&since=${s}&until=${e}${c ? `&cmpSince=${c[0]}&cmpUntil=${c[1]}` : ''}`);
            const ok = data.campaigns.length > 0;
            out[k] = { id: cl.id, account: cl.name, name, data, texts: ok ? draftTexts(computeClientReport(data, { ...baseOpts, rate: rt, clientName: name })) : null, error: ok ? '' : 'Sem veiculação no período' };
          } catch (err) { out[k] = { id: cl.id, account: cl.name, name, data: null, texts: null, error: err.message }; }
          setBusy({ done: ++done, total: list.length });
        }
      }));
      setEntries(out);
      setTab((out.find((x) => x.texts) || out[0]).id);
    } catch (err) { setError(err.message || 'Não consegui buscar os dados.'); } finally { setBusy(null); }
  };

  const generate = () => {
    const list = ready.map((e) => ({ model: modelOf(e), texts: e.texts }));
    if (list.length) onPreview(buildClientReportsHtml(list));
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            role="dialog" aria-modal="true" aria-label="Relatório para cliente" className="flex h-full w-full max-w-4xl flex-col border-l border-white/10 bg-carbon-900 shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
              <div>
                <h2 className="text-xl font-bold">Relatório para cliente</h2>
                <p className="mt-0.5 text-xs text-white/45">Escolha os clientes e o período. Cada cliente sai com as suas 2 páginas no mesmo PDF.</p>
              </div>
              <button onClick={onClose} aria-label="Fechar" className="rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
            </header>

            <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto p-5">
              {/* 1. clientes */}
              <div>
                <Label right={<span className="normal-case tracking-normal text-white/40">{nSel} selecionado(s)</span>}>1. Clientes</Label>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
                  <div className="flex items-center gap-2 border-b border-white/[0.07] p-2">
                    <label className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente" className="w-full rounded-xl bg-transparent py-2 pl-9 pr-3 text-sm outline-none placeholder:text-white/30" />
                    </label>
                    <button type="button" onClick={toggleShown} disabled={!shown.length} className="chip disabled:opacity-40">{allShownSel ? 'Desmarcar todos' : 'Selecionar todos'}</button>
                  </div>
                  <ul className="scrollbar-thin max-h-56 overflow-y-auto overscroll-contain p-1.5">
                    {shown.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => toggle(c.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/[0.05] ${selected.has(c.id) ? 'bg-brand/[0.08]' : ''}`}>
                          <Box checked={selected.has(c.id)} />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                          {!c.active && <span className="text-[10px] text-white/35">{c.status}</span>}
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/55">{c.currency === 'USD' ? 'US$' : 'R$'}</span>
                        </button>
                      </li>
                    ))}
                    {!shown.length && <li className="px-3 py-3 text-sm text-white/45">{clients.length ? 'Nenhum cliente encontrado.' : 'Carregando clientes…'}</li>}
                  </ul>
                </div>
              </div>

              {/* 2. período */}
              <div><Label>2. Período</Label><DateRangePicker value={dates} onChange={(v) => { setDates(v); setEntries([]); if (rateSource !== MANUAL) { setRate(''); setRateSource(''); } }} /></div>

              {/* referências (opcional) */}
              <div className="rounded-2xl border border-white/[0.07]">
                <button type="button" onClick={() => setShowRefs((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-white/75">
                  <SlidersHorizontal className="h-4 w-4 text-white/45" />
                  <span className="flex-1">Referências do nicho e câmbio <span className="text-white/40">· custo até R$ {ceiling} · resposta {responseRef}% · frequência {freqLimit}x{rate ? ` · US$ 1 = R$ ${rate}` : ''}</span></span>
                  <ChevronDown className={`h-4 w-4 text-white/45 transition ${showRefs ? 'rotate-180' : ''}`} />
                </button>
                {showRefs && (
                  <div className="grid gap-3 border-t border-white/[0.07] p-4 sm:grid-cols-4">
                    <label><Label>Teto do custo (R$)</Label><input value={ceiling} onChange={(e) => setCeiling(e.target.value)} className={inputCls} /></label>
                    <label><Label>Resposta esperada (%)</Label><input value={responseRef} onChange={(e) => setResponseRef(e.target.value)} className={inputCls} /></label>
                    <label><Label>Frequência máx. (mês)</Label><input value={freqLimit} onChange={(e) => setFreqLimit(e.target.value)} className={inputCls} /></label>
                    <label><Label>US$ 1 = R$</Label><input value={rate} onChange={(e) => { setRate(e.target.value); setRateSource(MANUAL); }} placeholder="PTAX automática" className={inputCls} /></label>
                    <p className="text-[11px] text-white/40 sm:col-span-4">Valem para todos os clientes do relatório. O câmbio só é usado nas contas em dólar.{rateSource && rateSource !== MANUAL ? ` ${rateSource}` : ''}</p>
                  </div>
                )}
              </div>

              <button onClick={load} disabled={!nSel || !!busy} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/15 disabled:opacity-40">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {busy ? `Buscando… ${busy.done} de ${busy.total}` : `3. Buscar dados${nSel ? ` (${nSel} cliente${nSel > 1 ? 's' : ''})` : ''}`}
              </button>

              {error && <p className="flex items-start gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}

              {/* 4. revisão por cliente */}
              {entries.length > 0 && (
                <div className="space-y-4">
                  <Label>4. Revise cada cliente</Label>
                  <div className="flex flex-wrap gap-2">
                    {entries.map((e) => (
                      <button key={e.id} onClick={() => setTab(e.id)} className={`rounded-xl border px-3 py-1.5 text-sm transition ${e.id === tab ? 'border-brand bg-brand/15 text-white' : 'border-white/10 text-white/70 hover:border-white/25'} ${e.texts ? '' : 'opacity-50'}`}>
                        {e.name}{!e.texts && <span className="ml-1.5 text-[10px] text-white/50">({e.error || 'sem dados'})</span>}
                      </button>
                    ))}
                  </div>

                  {cur && !cur.texts && <p className="text-sm text-white/50">{cur.account}: {cur.error || 'sem dados'} — fica fora do PDF.</p>}
                  {cur && cur.texts && curModel && (
                    <div className="space-y-4">
                      <label className="block max-w-sm"><Label>Nome no relatório</Label><input value={cur.name} onChange={(e) => patchEntry(cur.id, { name: e.target.value })} className={inputCls} /></label>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {[['Valor gasto', `R$ ${fmt(curModel.spendBrl)}`], [curModel.resShort, fmt(curModel.results, 0)], ['Alcance', fmt(curModel.T.reach, 0)], ['Frequência', `${fmt(curModel.T.freq)}x`], ['Impressões', fmt(curModel.T.imp, 0)]].map(([l, v]) => (
                          <div key={l} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3"><p className="truncate text-[10px] uppercase tracking-wider text-white/45">{l}</p><p className="mt-1 text-lg font-bold">{v}</p></div>
                        ))}
                      </div>
                      <p className="text-xs text-white/45">Rascunho feito só com os números da Meta. Revise antes de enviar. Use **negrito** e ==destaque==.</p>
                      <div><Label>Leitura do período</Label><textarea value={cur.texts.leitura} onChange={(e) => patchEntry(cur.id, { texts: { ...cur.texts, leitura: e.target.value } })} rows={3} className={`${inputCls} resize-y`} /></div>
                      <div><Label>Destaques</Label><ItemList items={cur.texts.destaques} onChange={(d) => patchEntry(cur.id, { texts: { ...cur.texts, destaques: d } })} addLabel="Adicionar destaque" titlePh="Título do destaque" textPh="Explicação com os números" /></div>
                      <div><Label>Plano de ação</Label><ItemList items={cur.texts.plano} onChange={(p) => patchEntry(cur.id, { texts: { ...cur.texts, plano: p } })} addLabel="Adicionar ação" titlePh="Ação (ex.: Publicar duas variações de criativo)" textPh="Meta / motivo" /></div>
                      <button onClick={() => patchEntry(cur.id, { texts: draftTexts(curModel) })} className="chip"><Sparkles className="h-3.5 w-3.5" /> Refazer rascunho deste cliente</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-white/[0.07] p-4">
              <span className="text-xs text-white/45">{ready.length ? `${ready.length} cliente(s) prontos para o PDF` : 'Busque os dados para gerar o PDF'}</span>
              <button onClick={generate} disabled={!ready.length} className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-40">
                <FileText className="h-4 w-4" /> Gerar PDF{ready.length > 1 ? ` (${ready.length} clientes)` : ''}
              </button>
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
