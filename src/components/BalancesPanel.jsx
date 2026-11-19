// Painel "Saldos das contas": saldo pré-pago, valor a cobrar no cartão e situação de pagamento de cada conta,
// com alertas (sem saldo, saldo baixo, pagamento pendente, carência) e PDF no padrão Sincerus.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Loader2, RotateCcw, Download, AlertTriangle, Wallet, CreditCard } from 'lucide-react';
import { api } from '../lib/api';
import { buildBalancesHtml, classify, money } from '../lib/report/balancesHtml';
import { downloadPdfs } from '../lib/report/pdfFiles';

const HIDDEN_KEY = 'sincerus.clients.hidden.v1'; // mesmos clientes ocultos do relatório para cliente
const readHidden = () => { try { return JSON.parse(localStorage.getItem(HIDDEN_KEY)) || []; } catch { return []; } };
const LEVEL = {
  crit: ['Urgente', 'border-rose-400/40 bg-rose-400/10 text-rose-200', 'bg-rose-400'],
  warn: ['Atenção', 'border-amber-300/40 bg-amber-300/10 text-amber-100', 'bg-amber-300'],
  ok: ['Em dia', 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200', 'bg-emerald-400'],
  idle: ['Sem uso', 'border-white/10 bg-white/[0.04] text-white/50', 'bg-white/30'],
};
const Pill = ({ level }) => <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${LEVEL[level][1]}`}>{LEVEL[level][0]}</span>;

export default function BalancesPanel({ open, onClose }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showIdle, setShowIdle] = useState(false);

  const load = async (refresh) => {
    setBusy('load'); setError('');
    try { setData(await api(`/meta/balances${refresh ? '?refresh=1' : ''}`)); }
    catch (e) { setError(e.message || 'Não consegui buscar os saldos.'); } finally { setBusy(''); }
  };
  useEffect(() => { if (open) load(false); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  const hidden = useMemo(() => (open ? readHidden() : []), [open]);
  const rows = useMemo(() => (data?.accounts || []).filter((a) => !hidden.includes(a.id)).map((a) => ({ ...a, ...classify(a) })), [data, hidden]);
  const shown = rows.filter((a) => showIdle || a.level !== 'idle');
  const alerts = shown.filter((a) => a.level === 'crit' || a.level === 'warn').sort((x, y) => (x.level === y.level ? 0 : x.level === 'crit' ? -1 : 1));
  const prepay = shown.filter((a) => a.prepay);
  const card = shown.filter((a) => !a.prepay);
  const total = (arr, k, cur) => arr.filter((a) => a.currency === cur).reduce((t, a) => t + (a[k] || 0), 0);

  const pdf = async () => {
    setBusy('pdf'); setError('');
    try { await downloadPdfs([buildBalancesHtml(data, { includeIdle: showIdle, hidden })], 'Saldos'); }
    catch (e) { setError(`Falha ao gerar o PDF: ${e.message || e}`); } finally { setBusy(''); }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            role="dialog" aria-modal="true" aria-label="Saldos das contas" className="flex h-full w-full max-w-3xl flex-col border-l border-white/10 bg-carbon-900 shadow-2xl">
            <header className="border-b border-white/[0.07] px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Saldos das contas</h2>
                  <p className="mt-0.5 text-xs text-white/45">{data ? `Situação em ${new Date(data.fetchedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · direto da Meta` : 'Buscando nas contas de anúncio…'}</p>
                </div>
                <button onClick={onClose} aria-label="Fechar" className="rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button onClick={() => load(true)} disabled={!!busy} className="chip disabled:opacity-50">{busy === 'load' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Atualizar</button>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-white/60"><input type="checkbox" checked={showIdle} onChange={(e) => setShowIdle(e.target.checked)} className="accent-[#F76000]" /> Mostrar contas sem uso</label>
                <button onClick={pdf} disabled={!data || !!busy} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-40">
                  {busy === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar PDF
                </button>
              </div>
            </header>

            <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto p-5">
              {error && <p className="flex items-start gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
              {busy === 'load' && !data && <p className="flex items-center gap-2 text-sm text-white/55"><Loader2 className="h-4 w-4 animate-spin" /> Consultando as contas…</p>}
              {data && (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3"><p className="text-[10px] uppercase tracking-wider text-white/45">Saldo pré-pago</p><p className="mt-1 text-base font-bold">{money(total(prepay, 'available', 'BRL'), 'BRL')}</p>{total(prepay, 'available', 'USD') > 0 && <p className="text-xs text-white/60">{money(total(prepay, 'available', 'USD'), 'USD')}</p>}</div>
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3"><p className="text-[10px] uppercase tracking-wider text-white/45">A cobrar no cartão</p><p className="mt-1 text-base font-bold">{money(total(card, 'due', 'USD'), 'USD')}</p><p className="text-xs text-white/60">{money(total(card, 'due', 'BRL'), 'BRL')}</p></div>
                    <div className="rounded-xl border border-rose-400/30 bg-rose-400/[0.07] p-3"><p className="text-[10px] uppercase tracking-wider text-rose-200/80">Urgente</p><p className="mt-1 text-xl font-bold text-rose-200">{alerts.filter((a) => a.level === 'crit').length}</p></div>
                    <div className="rounded-xl border border-amber-300/30 bg-amber-300/[0.07] p-3"><p className="text-[10px] uppercase tracking-wider text-amber-100/80">Atenção</p><p className="mt-1 text-xl font-bold text-amber-100">{alerts.filter((a) => a.level === 'warn').length}</p></div>
                  </div>

                  {alerts.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Precisa de atenção</p>
                      {alerts.map((a) => (
                        <div key={a.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${LEVEL[a.level][1]}`}>
                          <span className={`h-2 w-2 shrink-0 rounded-full ${LEVEL[a.level][2]}`} />
                          <span className="min-w-0 flex-1 truncate text-sm"><b className="font-semibold text-white">{a.name}</b> · {a.note}</span>
                          <span className="whitespace-nowrap text-sm font-semibold">{a.prepay ? `Saldo ${money(a.available, a.currency)}` : a.due ? `A cobrar ${money(a.due, a.currency)}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {[['Contas pré-pagas', prepay, Wallet], ['Contas no cartão', card, CreditCard]].map(([title, list, Icon]) => list.length > 0 && (
                    <div key={title}>
                      <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/45"><Icon className="h-3.5 w-3.5" /> {title}</p>
                      <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
                        {list.map((a) => (
                          <div key={a.id} className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-2.5 last:border-0">
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{a.name}</span><span className="block truncate text-[11px] text-white/40">{a.status}{!a.prepay ? ` · ${a.payment}` : ''}</span></span>
                            <span className="text-right text-sm font-semibold">{a.prepay ? money(a.available, a.currency) : money(a.due, a.currency)}<span className="block text-[10px] font-normal text-white/40">{a.prepay ? 'disponível' : 'a cobrar'}</span></span>
                            <Pill level={a.level} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-white/35">Pré-paga: saldo disponível para veicular. Cartão: valor acumulado que a Meta ainda vai cobrar. Saldo baixo: menos de R$ 100 ou US$ 20. Clientes ocultos no relatório para cliente também ficam fora daqui.</p>
                </>
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
