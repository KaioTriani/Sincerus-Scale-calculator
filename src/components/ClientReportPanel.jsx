// Painel do "Relatório para cliente" (modelo de performance Sincerus, 2 páginas A4).
// Escolhe cliente e período (filtro estilo Gerenciador, com comparação), busca os números na Meta,
// mostra um rascunho dos textos para revisar e gera o PDF.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Loader2, FileText, AlertTriangle, Plus, Trash2, RotateCcw, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { listClients } from '../lib/report/library';
import { fetchPtax } from '../lib/report/build';
import { computeClientReport, draftTexts, buildClientReportHtml } from '../lib/report/clientReport';
import DateRangePicker, { presetRange, compareLabel } from './DateRangePicker';

const MANUAL = 'Cotação informada pelo usuário.';
const inputCls = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none transition placeholder:text-white/30 focus:border-brand/60';
const num = (s) => { const v = parseFloat(String(s).replace(/\./g, '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
const Label = ({ children }) => <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">{children}</span>;
const fmt = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));

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
  const [clientId, setClientId] = useState(initialClient || '');
  const [displayName, setDisplayName] = useState('');
  const [dates, setDates] = useState(() => ({ preset: 'last_7d', range: presetRange('last_7d'), compare: null }));
  const [ceiling, setCeiling] = useState('6,00');
  const [responseRef, setResponseRef] = useState('1,00');
  const [freqLimit, setFreqLimit] = useState('3,0');
  const [rate, setRate] = useState('');
  const [rateSource, setRateSource] = useState('');
  const [data, setData] = useState(null);
  const [texts, setTexts] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { if (open && !clients.length) listClients().then((l) => setClients(l.filter((c) => c.source === 'meta'))).catch((e) => setError(e.message)); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === 'Escape' && !document.querySelector('iframe[title="Prévia do relatório"]') && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  const client = clients.find((c) => c.id === clientId);
  const opts = useMemo(() => ({
    rate: num(rate), rateSource, ceiling: num(ceiling), responseRef: num(responseRef) != null ? num(responseRef) / 100 : null, freqLimit: num(freqLimit),
    clientName: displayName.trim() || client?.name, compareName: dates.compare ? compareLabel(dates.compare.range) : null,
  }), [rate, rateSource, ceiling, responseRef, freqLimit, displayName, client, dates.compare]);
  const model = useMemo(() => (data && (data.currency !== 'USD' || opts.rate > 0) ? computeClientReport(data, opts) : null), [data, opts]);

  const load = async () => {
    if (!clientId) { setError('Escolha o cliente.'); return; }
    setError(''); setBusy('load');
    try {
      const [s, e] = dates.range;
      const c = dates.compare?.range;
      const r = await api(`/meta/client-report?account=${clientId}&since=${s}&until=${e}${c ? `&cmpSince=${c[0]}&cmpUntil=${c[1]}` : ''}`);
      let rt = num(rate);
      if (r.currency === 'USD' && !(rt > 0)) {
        let p;
        try { p = await fetchPtax(s, e); } catch { const d = new Date(e + 'T12:00'); d.setDate(d.getDate() - 7); p = await fetchPtax(d.toISOString().slice(0, 10), e); }
        rt = p.rate; setRate(String(p.rate).replace('.', ',')); setRateSource(p.source);
      }
      setData(r);
      if (!r.campaigns.length) { setTexts(null); setError('Nenhuma campanha com veiculação nesse período.'); return; }
      setTexts(draftTexts(computeClientReport(r, { ...opts, rate: rt })));
    } catch (e) { setError(e.message || 'Não consegui buscar os dados.'); } finally { setBusy(''); }
  };

  const generate = () => { if (model && texts) onPreview(buildClientReportHtml(model, texts)); };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            role="dialog" aria-modal="true" aria-label="Relatório para cliente" className="flex h-full w-full max-w-4xl flex-col border-l border-white/10 bg-carbon-900 shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-white/[0.07] p-5">
              <div>
                <p className="text-xs text-white/45">Meta Ads · para enviar ao cliente</p>
                <h2 className="text-xl font-bold">Relatório para cliente</h2>
                <p className="mt-1 text-xs text-white/45">Resultados, alcance, frequência, impressões e valor gasto por campanha, no modelo de performance Sincerus.</p>
              </div>
              <button onClick={onClose} aria-label="Fechar" className="rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
            </header>

            <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <label><Label>Cliente</Label>
                  <select value={clientId} onChange={(e) => { setClientId(e.target.value); setDisplayName(''); setData(null); setTexts(null); setRate(''); }} className={`${inputCls} bg-carbon-800`}>
                    <option value="">Selecione…</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.currency === 'USD' ? 'US$' : 'R$'})</option>)}
                  </select>
                </label>
                <label><Label>Nome no relatório</Label><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={client?.name || 'Ex.: WebTech'} className={inputCls} /></label>
              </div>
              <div><Label>Período</Label><DateRangePicker value={dates} onChange={(v) => { setDates(v); setData(null); setTexts(null); if (client?.currency === 'USD' && rateSource !== MANUAL) { setRate(''); setRateSource(''); } }} /></div>
              <div className="grid gap-3 sm:grid-cols-4">
                <label><Label>Teto do custo (R$)</Label><input value={ceiling} onChange={(e) => setCeiling(e.target.value)} className={inputCls} /></label>
                <label><Label>Referência resposta (%)</Label><input value={responseRef} onChange={(e) => setResponseRef(e.target.value)} className={inputCls} /></label>
                <label><Label>Limite frequência (mês)</Label><input value={freqLimit} onChange={(e) => setFreqLimit(e.target.value)} className={inputCls} /></label>
                <label><Label>Câmbio US$→R$</Label><input value={rate} onChange={(e) => { setRate(e.target.value); setRateSource(MANUAL); }} placeholder={client?.currency === 'BRL' ? 'conta em real' : 'PTAX automática'} disabled={client?.currency === 'BRL'} className={`${inputCls} disabled:opacity-40`} /></label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={load} disabled={!clientId || busy === 'load'} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/15 disabled:opacity-40">
                  {busy === 'load' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} {data ? 'Buscar de novo' : 'Buscar dados'}
                </button>
                {rateSource && client?.currency === 'USD' && <span className="text-[11px] text-white/40">{rateSource}</span>}
              </div>

              {error && <p className="flex items-start gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}

              {model && texts && (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {[['Valor gasto', `R$ ${fmt(model.spendBrl)}`], [model.resultLabel, fmt(model.results, 0)], ['Alcance', fmt(model.T.reach, 0)], ['Frequência', `${fmt(model.T.freq)}x`], ['Impressões', fmt(model.T.imp, 0)]].map(([l, v]) => (
                      <div key={l} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3"><p className="truncate text-[10px] uppercase tracking-wider text-white/45">{l}</p><p className="mt-1 text-lg font-bold">{v}</p></div>
                    ))}
                  </div>
                  <p className="text-xs text-white/45">{model.camps.length} campanha(s) com veiculação · {model.idle.length} sem veiculação{model.cmp ? ` · comparando com ${model.cmp.name}` : ''}. Os números vêm da Meta; os textos abaixo são um rascunho feito só com esses números. Revise antes de enviar. Use **negrito** e ==destaque==.</p>

                  <div><Label>Leitura do período</Label><textarea value={texts.leitura} onChange={(e) => setTexts({ ...texts, leitura: e.target.value })} rows={3} className={`${inputCls} resize-y`} /></div>
                  <div><Label>Destaques</Label><ItemList items={texts.destaques} onChange={(d) => setTexts({ ...texts, destaques: d })} addLabel="Adicionar destaque" titlePh="Título do destaque" textPh="Explicação com os números" /></div>
                  <div><Label>Plano de ação</Label><ItemList items={texts.plano} onChange={(p) => setTexts({ ...texts, plano: p })} addLabel="Adicionar ação" titlePh="Ação (ex.: Publicar duas variações de criativo)" textPh="Meta / motivo" /></div>
                  <button onClick={() => setTexts(draftTexts(model))} className="chip"><Sparkles className="h-3.5 w-3.5" /> Refazer rascunho dos textos</button>
                </>
              )}
            </div>

            <footer className="flex items-center justify-end gap-3 border-t border-white/[0.07] p-4">
              <button onClick={generate} disabled={!model || !texts} className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-40">
                <FileText className="h-4 w-4" /> Gerar PDF do cliente
              </button>
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
