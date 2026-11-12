// Painel "Anúncios ativos": todos os anúncios veiculando agora, de todos os clientes (API da Meta).
// Agrupado por cliente → campanha → conjunto → anúncios, com busca, atualização e exportação CSV.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Search, RotateCcw, Download, ChevronDown, Megaphone, AlertTriangle, Loader2, FileText, Layers } from 'lucide-react';
import { api } from '../lib/api';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fmtDateTime = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// Filtra mantendo a hierarquia: o termo pode bater no cliente, na campanha, no conjunto ou no anúncio
function filterTree(accounts, q) {
  const t = norm(q.trim());
  if (!t) return accounts;
  return accounts.map((a) => {
    if (norm(a.name).includes(t)) return a;
    const campaigns = a.campaigns.map((c) => {
      if (norm(c.name).includes(t)) return c;
      const adsets = c.adsets.map((s) => (norm(s.name).includes(t) ? s : { ...s, ads: s.ads.filter((ad) => norm(ad.name).includes(t)) })).filter((s) => s.ads.length);
      return { ...c, adsets };
    }).filter((c) => c.adsets.length);
    return { ...a, campaigns };
  }).filter((a) => a.campaigns.length);
}

const countAds = (a) => a.campaigns.reduce((t, c) => t + c.adsets.reduce((u, s) => u + s.ads.length, 0), 0);

function downloadCsv(accounts, fetchedAt) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Cliente', 'Conta', 'Campanha', 'Conjunto', 'Anúncio', 'ID do anúncio', 'Criado em'].map(esc).join(';')];
  for (const a of accounts) for (const c of a.campaigns) for (const s of c.adsets) for (const ad of s.ads) {
    lines.push([a.name, a.id.replace('act_', ''), c.name, s.name, ad.name, ad.id, ad.created.split('-').reverse().join('/')].map(esc).join(';'));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `anuncios-ativos-${fetchedAt.slice(0, 10)}.csv` });
  link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

function ClientBlock({ a, open, toggle, onReport }) {
  const ads = countAds(a);
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button onClick={toggle} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand-400 to-brand-700 text-xs font-bold">{a.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{a.name}</span>
            <span className="block truncate text-[11px] text-white/45">{a.campaigns.length} campanha(s) · {ads} anúncio(s) ativo(s) · conta {a.id.replace('act_', '')}{a.business ? ` · ${a.business}` : ''}</span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-white/50 transition ${open ? 'rotate-180' : ''}`} />
        </button>
        <button onClick={() => onReport(a)} className="chip"><FileText className="h-3.5 w-3.5" /> Gerar relatório</button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3 border-t border-white/[0.06] px-4 py-3">
              {a.campaigns.map((c) => (
                <div key={c.id}>
                  <p className="flex items-start gap-2 text-sm font-medium text-white/90"><Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-300" /><span className="min-w-0 break-words">{c.name}</span></p>
                  <div className="mt-1.5 space-y-2 pl-5">
                    {c.adsets.map((s) => (
                      <div key={s.id}>
                        <p className="flex items-start gap-1.5 text-[11px] text-white/45"><Layers className="mt-0.5 h-3 w-3 shrink-0" /><span className="min-w-0 break-words">{s.name}</span></p>
                        <ul className="mt-1 flex flex-wrap gap-1.5">
                          {s.ads.map((ad) => (
                            <li key={ad.id} className="flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-2 py-1 text-xs text-white/85" title={`ID ${ad.id}${ad.created ? ` · criado em ${ad.created.split('-').reverse().join('/')}` : ''}`}>
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />{ad.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ActiveAdsPanel({ open, onClose, onReport }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState({});

  const load = async (refresh) => {
    setBusy(true); setError('');
    try {
      const r = await api(`/meta/active-ads${refresh ? '?refresh=1' : ''}`);
      setData(r);
      setExpanded(Object.fromEntries(r.accounts.map((a) => [a.id, true])));
    } catch (e) { setError(e.message || 'Não consegui buscar os anúncios.'); } finally { setBusy(false); }
  };
  useEffect(() => { if (open && !data && !busy) load(false); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  const withAds = useMemo(() => (data?.accounts || []).filter((a) => a.campaigns.length), [data]);
  const without = useMemo(() => (data?.accounts || []).filter((a) => !a.campaigns.length), [data]);
  const shown = useMemo(() => filterTree(withAds, q), [withAds, q]);
  const totals = useMemo(() => ({
    clients: shown.length,
    campaigns: shown.reduce((t, a) => t + a.campaigns.length, 0),
    ads: shown.reduce((t, a) => t + countAds(a), 0),
  }), [shown]);
  const allOpen = shown.length > 0 && shown.every((a) => expanded[a.id]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.aside
            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            role="dialog" aria-modal="true" aria-label="Anúncios ativos de todos os clientes"
            className="flex h-full w-full max-w-3xl flex-col border-l border-white/10 bg-carbon-900 shadow-2xl"
          >
            <header className="border-b border-white/[0.07] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-white/45">Meta Ads · agora</p>
                  <h2 className="text-xl font-bold">Anúncios ativos de todos os clientes</h2>
                  <p className="mt-1 text-xs text-white/45">
                    {data ? `${totals.clients} cliente(s) · ${totals.campaigns} campanha(s) · ${totals.ads} anúncio(s) ativo(s) · atualizado ${fmtDateTime(data.fetchedAt)}` : 'Buscando nas contas de anúncio…'}
                  </p>
                </div>
                <button onClick={onClose} aria-label="Fechar" className="rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <label className="relative min-w-[200px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, campanha ou anúncio" className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm outline-none focus:border-brand/50" />
                </label>
                <button onClick={() => load(true)} disabled={busy} className="chip disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Atualizar</button>
                <button onClick={() => data && downloadCsv(shown, data.fetchedAt)} disabled={!data || !totals.ads} className="chip disabled:opacity-50"><Download className="h-3.5 w-3.5" /> Baixar CSV</button>
                <button onClick={() => setExpanded(Object.fromEntries(shown.map((a) => [a.id, !allOpen])))} disabled={!shown.length} className="chip disabled:opacity-50">{allOpen ? 'Recolher todos' : 'Expandir todos'}</button>
              </div>
            </header>

            <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-5">
              {error && <p className="flex items-start gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
              {busy && !data && <p className="flex items-center gap-2 text-sm text-white/55"><Loader2 className="h-4 w-4 animate-spin" /> Consultando todas as contas na Meta. Com muitas contas, pode levar alguns segundos…</p>}
              {data && !shown.length && <p className="text-sm text-white/50">{q ? 'Nada encontrado para essa busca.' : 'Nenhum anúncio ativo agora.'}</p>}
              {shown.map((a) => (
                <ClientBlock key={a.id} a={a} open={!!expanded[a.id] || !!q} toggle={() => setExpanded((x) => ({ ...x, [a.id]: !x[a.id] }))} onReport={onReport} />
              ))}
              {data && without.length > 0 && !q && (
                <details className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-4 py-3 text-xs text-white/50">
                  <summary className="cursor-pointer select-none font-medium text-white/65">{without.length} conta(s) sem anúncios ativos agora</summary>
                  <ul className="mt-2 space-y-1">
                    {without.map((a) => <li key={a.id}>{a.name} <span className="text-white/35">· {a.status}{a.error ? ` · erro: ${a.error}` : ''}</span></li>)}
                  </ul>
                </details>
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
