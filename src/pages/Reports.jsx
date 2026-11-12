import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  FileUp, FileText, FileSpreadsheet, Plus, Trash2, ChevronDown, Landmark, AlertTriangle, CheckCircle2,
  X, Printer, Loader2, RotateCcw, Info, Search, Check, Building2, CalendarClock, Megaphone,
} from 'lucide-react';
import Reveal from '../components/Reveal';
import Button from '../components/Button';
import { readTable, tableToCampaigns, parseNumber, identifyCar } from '../lib/report/parse';
import { compute, isActive, carro } from '../lib/report/compute';
import { draftToReport, fetchPtax, shortResult } from '../lib/report/build';
import { listClients, addClient, loadClientCampaigns, saveCampaigns, setClientCurrency } from '../lib/report/library';
import { metaAvailable } from '../lib/api';
import ActiveAdsPanel from '../components/ActiveAdsPanel';

const DRAFT_KEY = 'sincerus.report.draft.v2';
const uid = () => Math.random().toString(36).slice(2, 9);
const monthRange = () => {
  const d = new Date(); d.setDate(0); // último dia do mês passado
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
  return [`${y}-${m}-01`, `${y}-${m}-${String(d.getDate()).padStart(2, '0')}`];
};
const EMPTY = () => {
  const [s, e] = monthRange();
  return { clientId: '', client: '', periodStart: s, periodEnd: e, currency: 'USD', rate: '', rateSource: '', campaigns: [], hidden: [], loadInfo: null };
};
const withKeys = (c) => ({ key: uid(), open: true, ...c, ads: c.ads.map((a) => ({ key: uid(), ...a })) });
const nfmt = (v, d = 2) => (v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d }));

function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
    if (d?.campaigns) return { ...d, hidden: (d.hidden || []).map((c) => (c.hid ? c : { ...c, hid: uid() })) };
  } catch { /* sem rascunho */ }
  return EMPTY();
}

// ---------- pequenos componentes ----------
const inputCls = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none transition placeholder:text-white/30 focus:border-brand/60';
function Label({ children, hint }) {
  return <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/45">{children}{hint && <span className="ml-1 normal-case tracking-normal text-white/30">{hint}</span>}</span>;
}
function Card({ step, title, sub, children, right, className = "" }) {
  return (
    <Reveal className={`glass p-5 sm:p-6 ${className}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-brand/40 bg-brand/10 font-display text-xs font-bold text-brand-300">{step}</span>
          <div><h2 className="text-lg font-semibold">{title}</h2>{sub && <p className="text-xs text-white/45">{sub}</p>}</div>
        </div>
        {right}
      </div>
      {children}
    </Reveal>
  );
}
// Célula numérica: edita como texto e só converte ao sair do campo (aceita 1.234,56)
function NumCell({ value, onCommit, int }) {
  const [txt, setTxt] = useState(nfmt(value, int ? 0 : 4));
  useEffect(() => setTxt(nfmt(value, int ? 0 : 4)), [value, int]);
  return (
    <input
      value={txt}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => { const n = txt.trim() === '' ? null : parseNumber(txt, ','); if (n !== value) onCommit(n); else setTxt(nfmt(value, int ? 0 : 4)); }}
      inputMode="decimal"
      placeholder="—"
      className="w-full min-w-[70px] rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-right text-[13px] tabular-nums outline-none transition hover:border-white/10 focus:border-brand/60 focus:bg-white/[0.04]"
    />
  );
}
function TextCell({ value, onCommit, className = '' }) {
  return (
    <input
      defaultValue={value}
      key={value}
      onBlur={(e) => e.target.value !== value && onCommit(e.target.value)}
      className={`w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[13px] outline-none transition hover:border-white/10 focus:border-brand/60 focus:bg-white/[0.04] ${className}`}
    />
  );
}

// ---------- importação ----------
function ImportPanel({ result, onConfirm, onCancel, onReparse }) {
  const groups = useMemo(() => result.campaigns.flatMap((c) => {
    const sets = c.adsets.length ? c.adsets : [''];
    return sets.map((s) => ({ id: `${c.name}|${s}`, campaign: c.name, adset: s, ads: c.ads.filter((a) => !s || a.adset === s), resultType: c.resultType }));
  }), [result]);
  const [sel, setSel] = useState(() => new Set(groups.map((g) => g.id)));
  useEffect(() => setSel(new Set(groups.map((g) => g.id))), [groups]);
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 rounded-2xl border border-brand/30 bg-brand/[0.05] p-4 sm:p-5">
      <p className="font-semibold">Conferir importação · {result.fileName}</p>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <div><Label>Moeda da coluna de gasto</Label><p>{result.currency ?? 'não indicada no arquivo'}</p></div>
        <div>
          <Label>Separador decimal</Label>
          <select value={result.decimal} onChange={(e) => onReparse(e.target.value)} className={inputCls}>
            <option value=",">1.234,56 (vírgula decimal)</option>
            <option value=".">1,234.56 (ponto decimal)</option>
          </select>
          {!result.decimalDetected && <p className="mt-1 text-xs text-amber-300">Não detectado com certeza — confirme.</p>}
        </div>
        <div><Label>Período no arquivo</Label><p>{result.periods.length ? result.periods.map(([s, e]) => `${s?.split('-').reverse().join('/')} a ${e?.split('-').reverse().join('/')}`).join('; ') : 'sem datas — você confirma depois'}</p></div>
      </div>
      {result.warnings.map((w) => <p key={w} className="mt-3 flex items-start gap-2 text-xs text-amber-200"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}</p>)}
      <p className="mt-4 text-xs text-white/55">Campanhas e conjuntos encontrados. Marque só o que entra no relatório — linhas de outros conjuntos ficam de fora.</p>
      <ul className="mt-2 space-y-2">
        {groups.map((g) => (
          <li key={g.id}>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
              <input type="checkbox" checked={sel.has(g.id)} onChange={() => setSel((s) => { const n = new Set(s); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n; })} className="mt-1 accent-[#F76000]" />
              <span className="min-w-0 text-sm">
                <b className="block truncate">{g.campaign}</b>
                <span className="block truncate text-xs text-white/50">Conjunto: {g.adset || 'não informado'} · {g.ads.length} anúncios · gasto {nfmt(g.ads.reduce((s, a) => s + (a.spend ?? 0), 0))}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => onConfirm(groups.filter((g) => sel.has(g.id)), groups.filter((g) => !sel.has(g.id)))} disabled={!sel.size}>Adicionar ao relatório</Button>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </motion.div>
  );
}

// ---------- campanha ----------
function CampaignEditor({ c, idx, currency, update, remove }) {
  const set = (patch) => update({ ...c, ...patch });
  const setAd = (key, patch) => set({ ads: c.ads.map((a) => (a.key === key ? { ...a, ...patch, edited: c.source === 'file' ? true : a.edited } : a)) });
  const spend = c.ads.reduce((s, a) => s + (a.spend ?? 0), 0);
  const ativos = c.ads.filter((a) => isActive(a.status)).length;
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-carbon-900/40">
      <button onClick={() => set({ open: !c.open })} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="font-display text-sm font-bold text-brand-300">{String(idx + 1).padStart(2, '0')}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{c.name || 'Campanha sem nome'}</span>
          <span className="block truncate text-xs text-white/45">{c.adset || 'conjunto não informado'} · {c.ads.length} anúncios ({ativos} ativos) · gasto {currency === 'USD' ? 'US$' : 'R$'} {nfmt(spend)}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-white/50 transition ${c.open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {c.open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-4 border-t border-white/[0.06] p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label><Label>Nome da campanha</Label><input value={c.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} /></label>
                <label><Label hint="(título curto no PDF)">Rótulo</Label><input value={c.label ?? ''} onChange={(e) => set({ label: e.target.value })} placeholder="ex.: Engajamento WhatsApp" className={inputCls} /></label>
                <label><Label>Conjunto de anúncios</Label><input value={c.adset} onChange={(e) => set({ adset: e.target.value })} className={inputCls} /></label>
                <label><Label>Tipo de resultado</Label><input value={c.resultType} onChange={(e) => set({ resultType: e.target.value, resultShort: shortResult(e.target.value) })} placeholder="ex.: Conversas por mensagem iniciadas" className={inputCls} /></label>
                <label><Label>Atribuição</Label><input value={c.attribution ?? ''} onChange={(e) => set({ attribution: e.target.value })} placeholder="ex.: Clique de 7 dias" className={inputCls} /></label>
                <label><Label>Orçamento</Label><input value={c.budget ?? ''} onChange={(e) => set({ budget: e.target.value })} placeholder="opcional" className={inputCls} /></label>
              </div>
              <div className="grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 md:grid-cols-[1fr_1fr_1.4fr]">
                <label><Label hint="(linha de total)">Gasto total no Gerenciador</Label><input value={c.printSpend ?? ''} onChange={(e) => set({ printSpend: e.target.value })} placeholder="para conferir a soma" className={inputCls} /></label>
                <label><Label>Impressões totais no Gerenciador</Label><input value={c.printImp ?? ''} onChange={(e) => set({ printImp: e.target.value })} placeholder="opcional" className={inputCls} /></label>
                <div className="flex items-end">
                  {c.filePeriods?.length ? (
                    <p className="text-xs text-white/50">Período lido do arquivo.</p>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-white/75">
                      <input type="checkbox" checked={!!c.periodConfirmed} onChange={(e) => set({ periodConfirmed: e.target.checked })} className="accent-[#F76000]" />
                      Confirmo que os dados são do período do relatório
                    </label>
                  )}
                </div>
              </div>
              {c.notes?.length > 0 && (
                <ul className="space-y-1.5">{c.notes.map((n) => <li key={n} className="flex items-start gap-2 text-xs text-amber-200/90"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{n}</li>)}</ul>
              )}

              <div className="scrollbar-thin -mx-4 overflow-x-auto px-4">
                <table className="w-full min-w-[980px] text-sm">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase tracking-wider text-white/40">
                      <th className="px-2 py-2">Anúncio</th><th className="px-2 py-2">Carro (marca · modelo · ano)</th><th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2 text-right">Gasto</th><th className="px-2 py-2 text-right">Impressões</th><th className="px-2 py-2 text-right">Alcance</th>
                      <th className="px-2 py-2 text-right">Resultados</th><th className="px-2 py-2 text-right">Custo/res.</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {c.ads.map((a) => (
                      <tr key={a.key} className="border-t border-white/[0.05]">
                        <td className="w-[26%] px-1"><TextCell value={a.name} onCommit={(v) => setAd(a.key, { name: v, ...identifyCar(v) })} /></td>
                        <td className="w-[22%] px-2 text-xs text-white/55">{carro(a)}</td>
                        <td className="w-[11%] px-1">
                          <TextCell value={a.status} onCommit={(v) => setAd(a.key, { status: v })} className={isActive(a.status) ? 'text-emerald-300' : 'text-white/60'} />
                        </td>
                        <td className="px-1"><NumCell value={a.spend} onCommit={(v) => setAd(a.key, { spend: v ?? 0 })} /></td>
                        <td className="px-1"><NumCell int value={a.imp} onCommit={(v) => setAd(a.key, { imp: v })} /></td>
                        <td className="px-1"><NumCell int value={a.reach} onCommit={(v) => setAd(a.key, { reach: v })} /></td>
                        <td className="px-1"><NumCell int value={a.results} onCommit={(v) => setAd(a.key, { results: v })} /></td>
                        <td className="px-1"><NumCell value={a.cpr} onCommit={(v) => setAd(a.key, { cpr: v })} /></td>
                        <td className="w-8 px-1">
                          <button onClick={() => set({ ads: c.ads.filter((x) => x.key !== a.key) })} className="rounded-lg p-1.5 text-white/30 transition hover:bg-rose-400/10 hover:text-rose-300" aria-label="Remover anúncio"><Trash2 className="h-3.5 w-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button onClick={() => set({ ads: [...c.ads, { key: uid(), name: 'ADS - ', status: 'Ativo', spend: 0, imp: null, reach: null, results: null, cpr: null, edited: true, brand: null, model: null, year: null }] })} className="chip"><Plus className="h-3.5 w-3.5" /> Adicionar anúncio</button>
                <button onClick={remove} className="chip hover:border-rose-400/40! hover:text-rose-300!"><Trash2 className="h-3.5 w-3.5" /> Remover campanha</button>
              </div>
              <p className="text-[11px] text-white/35">Status "Ativo", "Aprendizado" ou "Aprendizado limitado" contam como ativos; os demais, como não ativos. Números aceitam 1.234,56.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- prévia ----------
function Preview({ html, fileName, onClose }) {
  const ref = useRef(null);
  const print = () => {
    const prev = document.title;
    document.title = fileName;
    ref.current?.contentWindow?.focus();
    ref.current?.contentWindow?.print();
    setTimeout(() => (document.title = prev), 1000);
  };
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex flex-col bg-carbon-950/95 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <FileText className="h-5 w-5 text-brand-300" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{fileName}.pdf</p>
        <Button onClick={print} icon={Printer}>Salvar PDF</Button>
        <button onClick={onClose} className="rounded-full border border-white/10 p-2.5 text-white/70 transition hover:text-white" aria-label="Fechar prévia"><X className="h-4 w-4" /></button>
      </div>
      <p className="border-b border-white/5 px-6 py-2 text-xs text-white/45">Na janela de impressão, escolha <b className="text-white/70">Salvar como PDF</b>. O tamanho do papel e as cores já vêm configurados.</p>
      <iframe ref={ref} title="Prévia do relatório" srcDoc={html} className="w-full flex-1 bg-[#2A2D33]" />
    </motion.div>,
    document.body,
  );
}

async function logoDataUrl() {
  const blob = await (await fetch('/logo-report.png')).blob();
  return new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
}

// ---------- menu de clientes ----------
const fmtPeriod = ([s, e]) => `${s.split('-').reverse().join('/')} a ${e.split('-').reverse().join('/')}`;
function ClientMenu({ value, onSelect }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [cur, setCur] = useState('BRL');
  const [clients, setClients] = useState([]);
  const [loadErr, setLoadErr] = useState('');
  const ref = useRef(null);
  const refresh = () => listClients().then((l) => { setClients(l); setLoadErr(''); }).catch((e) => setLoadErr(e.message));
  useEffect(() => { refresh(); }, []);
  useEffect(() => { if (open) refresh(); }, [open]);
  const fromMeta = clients.some((c) => c.source === 'meta');
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const sel = clients.find((c) => c.id === value);
  const list = clients.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const create = async () => {
    if (name.trim().length < 2) return;
    const id = addClient(name, cur);
    const list = await listClients();
    setClients(list); setAdding(false); setName(''); setOpen(false);
    onSelect(list.find((x) => x.id === id));
  };
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={`flex w-full items-center gap-3 rounded-2xl border bg-white/[0.04] px-3 py-2.5 text-left transition ${open ? 'border-brand/60' : 'border-white/10 hover:border-white/20'}`}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand-400 to-brand-700 text-xs font-bold">{sel ? sel.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() : <Building2 className="h-4 w-4" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{sel ? sel.name : 'Selecione o cliente'}</span>
          <span className="block truncate text-xs text-white/45">{sel ? `Conta em ${sel.currency === 'USD' ? 'dólar' : 'real'}${sel.account ? ` · ${sel.account}` : ''}` : `${clients.length} clientes cadastrados`}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-white/50 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} className="glass-strong absolute left-0 right-0 z-30 mt-2 bg-carbon-800! p-2 shadow-2xl">
            <label className="relative mb-1 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente" className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm outline-none focus:border-brand/50" />
            </label>
            <ul className="scrollbar-thin max-h-[min(18rem,50vh)] overflow-y-auto overscroll-contain pr-1">
              {list.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => { setOpen(false); onSelect(c); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06] ${c.id === value ? 'bg-brand/10' : ''}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="block truncate text-[11px] text-white/45">{c.source === 'meta' ? `${c.status} · conta ${c.account}` : c.lastPeriod ? `Dados até ${fmtPeriod(c.lastPeriod)}` : 'Sem dados importados'}</span>
                    </span>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/60">{c.currency === 'USD' ? 'US$' : 'R$'}</span>
                    {c.id === value && <Check className="h-4 w-4 text-brand-300" />}
                  </button>
                </li>
              ))}
              {!list.length && <li className="px-3 py-3 text-sm text-white/45">{loadErr || 'Nenhum cliente encontrado.'}</li>}
            </ul>
            {fromMeta ? (
              <p className="mt-1 border-t border-white/[0.07] px-3 pt-2 text-[11px] text-white/40">Contas de anúncio do Business Manager, via API da Meta.</p>
            ) : (
            <div className="mt-1 border-t border-white/[0.07] pt-2">
              {adding ? (
                <div className="flex flex-wrap gap-2 p-1">
                  <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="Nome do cliente" className={`${inputCls} flex-1`} />
                  <select value={cur} onChange={(e) => setCur(e.target.value)} className={`${inputCls} w-auto`}><option value="BRL">Conta em R$</option><option value="USD">Conta em US$</option></select>
                  <Button onClick={create} className="py-2!">Adicionar</Button>
                </div>
              ) : (
                <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-brand-300 transition hover:bg-white/[0.05]"><Plus className="h-4 w-4" /> Novo cliente</button>
              )}
            </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- página ----------
export default function Reports() {
  const [draft, setDraft] = useState(loadDraft);
  const [imp, setImp] = useState(null); // resultado da importação aguardando conferência
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);
  const lastRows = useRef(null);
  const [activeOpen, setActiveOpen] = useState(false);
  const [metaOn, setMetaOn] = useState(false);
  useEffect(() => { metaAvailable().then((s) => setMetaOn(!!s.configured)).catch(() => setMetaOn(false)); }, []);

  useEffect(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* sem armazenamento */ } }, [draft]);
  const patch = (p) => { setDraft((d) => ({ ...d, ...p })); setConfirmed(false); };
  const updateCampaign = (key, c) => patch({ campaigns: draft.campaigns.map((x) => (x.key === key ? c : x)) });

  // Ao escolher o cliente (ou mudar o período), as campanhas ativas aparecem com todos os anúncios
  const isMeta = /^act_\d+$/.test(draft.clientId || '');
  const reload = async (clientId, start, end, opts) => {
    if (!clientId || !start || !end) return;
    setBusy('load'); setError('');
    let r;
    try { r = await loadClientCampaigns(clientId, start, end, opts); }
    catch (e) { setError(e.message); setBusy(''); return; }
    const act = r.campaigns.filter((c) => c.active);
    const ina = r.campaigns.filter((c) => !c.active);
    setDraft((d) => ({
      ...d,
      campaigns: act.map((c) => withKeys({ ...c, open: act.length === 1 })),
      hidden: ina.map((c) => ({ ...c, hid: uid() })), // id próprio: há conjuntos com o mesmo nome de campanha
      loadInfo: r.found ? { savedAt: r.savedAt, source: r.source } : { missing: true, others: r.others },
    }));
    setConfirmed(false); setImp(null); setBusy('');
  };
  const selectClient = (c) => {
    patch({ clientId: c.id, client: c.name, currency: c.currency });
    reload(c.id, draft.periodStart, draft.periodEnd);
  };
  const setPeriod = (k, v) => {
    const nd = { ...draft, [k]: v };
    patch({ [k]: v });
    reload(draft.clientId, nd.periodStart, nd.periodEnd);
  };
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('cliente');
    if (!id || (id === draft.clientId && draft.campaigns.length)) return;
    listClients().then((l) => { const c = l.find((x) => x.id === id); if (c) selectClient(c); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // "+" tira a campanha da lista de sugestões e a coloca entre as campanhas do relatório; ao remover, ela volta para as sugestões
  const includeHidden = (list) => {
    const ids = new Set(list.map((c) => c.hid));
    patch({ campaigns: [...draft.campaigns, ...list.map((c) => withKeys({ ...c, open: list.length === 1 }))], hidden: (draft.hidden || []).filter((x) => !ids.has(x.hid)) });
  };
  const removeCampaign = (c) => {
    const { key, open, ...rest } = c;
    patch({
      campaigns: draft.campaigns.filter((x) => x.key !== c.key),
      hidden: c.hid ? [...(draft.hidden || []), { ...rest, ads: rest.ads.map(({ key: _k, ...a }) => a) }] : draft.hidden,
    });
  };
  const persist = (campaigns, source) => draft.clientId && !isMeta && saveCampaigns(draft.clientId, draft.periodStart, draft.periodEnd, campaigns, source);

  const onFile = async (file) => {
    if (!file) return;
    setError(''); setBusy('import');
    try {
      const rows = await readTable(file);
      lastRows.current = { rows, fileName: file.name };
      const r = tableToCampaigns(rows);
      setImp({ ...r, fileName: file.name });
      if (r.currency === 'USD' || r.currency === 'BRL') patch({ currency: r.currency });
    } catch (e) { setError(e.message || 'Não consegui ler o arquivo.'); } finally { setBusy(''); if (fileRef.current) fileRef.current.value = ''; }
  };
  const reparse = (decimal) => { const { rows, fileName } = lastRows.current; setImp({ ...tableToCampaigns(rows, { decimalOverride: decimal }), fileName }); };
  const confirmImport = (chosen, left) => {
    const notes = [...imp.warnings];
    if (left.length) notes.push(`Ficaram de fora (outros conjuntos/campanhas do arquivo): ${left.map((g) => `${g.campaign} · ${g.adset || 'sem conjunto'} (${g.ads.length} anúncios)`).join('; ')}.`);
    // a linha de total do arquivo só serve para conferir se todas as linhas do arquivo entraram em uma única campanha
    const useTotals = imp.totalsRow && chosen.length === 1 && !left.length;
    if (useTotals) notes.push('Linha de total encontrada no arquivo e usada para conferir a soma.');
    const news = chosen.map((g) => withKeys({
      name: g.campaign, label: '', adset: g.adset, resultType: g.resultType, resultShort: shortResult(g.resultType), attribution: '', budget: '',
      source: 'file', filePeriods: imp.periods, periodConfirmed: false, notes,
      printSpend: useTotals ? String(imp.totalsRow.spend).replace('.', ',') : '',
      printImp: useTotals && imp.totalsRow.imp != null ? String(imp.totalsRow.imp) : '',
      ads: g.ads.map(({ adset, resultType, ...a }) => ({ ...a, ...identifyCar(a.name) })),
    }));
    patch({ campaigns: [...draft.campaigns, ...news], loadInfo: { savedAt: new Date().toISOString().slice(0, 10), source: `importação ${imp.fileName}` } });
    persist(news, `importação ${imp.fileName}`);
    setImp(null);
  };

  const getPtax = async () => {
    setError(''); setBusy('ptax');
    try { const r = await fetchPtax(draft.periodStart, draft.periodEnd); patch({ rate: String(r.rate).replace('.', ','), rateSource: r.source }); }
    catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const report = useMemo(() => draftToReport(draft), [draft]);
  const blockers = [
    !draft.clientId && 'Selecione o cliente.',
    (!draft.periodStart || !draft.periodEnd || draft.periodEnd < draft.periodStart) && 'Período inválido.',
    !(report.rate > 0) && 'Informe a cotação USD→BRL (ou busque a PTAX) — o relatório mostra US$ e R$.',
    !draft.campaigns.length && 'Adicione ao menos uma campanha.',
    draft.campaigns.some((c) => !c.ads.length) && 'Há campanha sem anúncios.',
    report.campaigns.some((c) => c.periodStatus !== 'ok') && 'Há campanha com período não confirmado ou diferente do relatório.',
  ].filter(Boolean);

  const generate = async (kind) => {
    setError(''); setBusy(kind);
    try {
      persist(draft.campaigns, 'conferido na plataforma');
      const computed = compute(report);
      if (kind === 'pdf') {
        const { buildReportHtml } = await import('../lib/report/html');
        setPreview({ html: buildReportHtml(report, computed, await logoDataUrl()), fileName: report.fileName });
      } else {
        const { buildXlsx } = await import('../lib/report/xlsx');
        const blob = await buildXlsx(report, computed);
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${report.fileName}.xlsx` });
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }
    } catch (e) { console.error(e); setError('Falha ao gerar: ' + (e.message || e)); } finally { setBusy(''); }
  };

  const totalSpend = draft.campaigns.reduce((s, c) => s + c.ads.reduce((t, a) => t + (a.spend ?? 0), 0), 0);

  return (
    <div className="space-y-6">
      <Reveal className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-white/50">Meta Ads</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Relatórios</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/50">Escolha o cliente: as campanhas ativas do período aparecem com todos os anúncios. Confira e gere o PDF Sincerus e a planilha — sempre com gasto em dólar e em real.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {metaOn && <Button onClick={() => setActiveOpen(true)} icon={Megaphone}>Anúncios ativos (todos os clientes)</Button>}
          <button onClick={() => { if (confirm('Limpar o rascunho atual?')) { setDraft(EMPTY()); setConfirmed(false); } }} className="chip"><RotateCcw className="h-3.5 w-3.5" /> Novo</button>
        </div>
      </Reveal>
      <ActiveAdsPanel
        open={activeOpen}
        onClose={() => setActiveOpen(false)}
        onPreview={({ html, fileName }) => setPreview({ html, fileName })}
        getLogo={logoDataUrl}
      />

      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}
          </motion.p>
        )}
      </AnimatePresence>

      <Card step="1" title="Cliente e período" sub="Selecione o cliente para carregar as campanhas ativas" className="relative z-20">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr_1.2fr]">
          <div className="md:col-span-2 xl:col-span-1"><Label>Cliente</Label><ClientMenu value={draft.clientId} onSelect={selectClient} /></div>
          <label><Label>Início</Label><input type="date" value={draft.periodStart} onChange={(e) => setPeriod('periodStart', e.target.value)} className={inputCls} /></label>
          <label><Label>Fim</Label><input type="date" value={draft.periodEnd} onChange={(e) => setPeriod('periodEnd', e.target.value)} className={inputCls} /></label>
          <div>
            <Label hint="(no Gerenciador)">Moeda da conta</Label>
            <div className="flex rounded-xl border border-white/10 bg-white/[0.04] p-1 text-sm">
              {[['USD', 'Dólar (US$)'], ['BRL', 'Real (R$)']].map(([k, l]) => (
                <button key={k} onClick={() => { patch({ currency: k }); if (draft.clientId && !isMeta) setClientCurrency(draft.clientId, k); }} className={`relative flex-1 rounded-lg py-1.5 font-medium transition-colors ${draft.currency === k ? 'text-white' : 'text-white/50 hover:text-white'}`}>
                  {draft.currency === k && <motion.span layoutId="cur" className="absolute inset-0 rounded-lg bg-brand/25 ring-1 ring-brand/50" />}
                  <span className="relative">{l}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        {(
          <div className="mt-4 grid gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 md:grid-cols-[220px_1fr]">
            <div>
              <Label>Cotação USD→BRL</Label>
              <div className="flex gap-2">
                <input value={draft.rate} onChange={(e) => patch({ rate: e.target.value, rateSource: 'Cotação informada pelo usuário.' })} placeholder="ex.: 5,1294" className={inputCls} />
              </div>
              <button onClick={getPtax} disabled={busy === 'ptax'} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-brand-300 transition hover:text-brand-400 disabled:opacity-50">
                {busy === 'ptax' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Landmark className="h-3.5 w-3.5" />} Buscar PTAX média do período (BCB)
              </button>
            </div>
            <div className="text-xs leading-relaxed text-white/50">
              <Label>Fonte da cotação</Label>
              <p>{draft.rateSource || 'Digite a cotação ou busque a PTAX de venda média do período no Banco Central. Nunca use uma cotação de memória.'}</p>
              <p className="mt-2 text-white/35">O relatório sempre mostra o gasto em US$ e em R$, com a mesma cotação para todos os valores. {draft.currency === 'BRL' ? 'Conta em real: R$ são os valores do Gerenciador e US$ a conversão.' : 'Conta em dólar: R$ = US$ × cotação, com a nota sobre IOF, spread e câmbio.'}</p>
            </div>
          </div>
        )}
      </Card>

      <Card
        step="2"
        title="Campanhas e anúncios"
        sub={!draft.clientId ? 'Selecione um cliente no passo 1' : draft.campaigns.length ? `${draft.campaigns.length} campanha(s) no relatório · ${draft.campaigns.reduce((s, c) => s + c.ads.length, 0)} anúncios · gasto ${draft.currency === 'USD' ? 'US$' : 'R$'} ${nfmt(totalSpend)}` : 'Nenhuma campanha carregada'}
        right={
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.tsv,.txt" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            {isMeta
              ? <Button onClick={() => reload(draft.clientId, draft.periodStart, draft.periodEnd, { refresh: true })} loading={busy === 'load'} icon={RotateCcw}>Atualizar da Meta</Button>
              : <Button onClick={() => fileRef.current?.click()} loading={busy === 'import'} disabled={!draft.clientId} icon={FileUp}>{draft.loadInfo?.missing ? 'Importar CSV/XLSX' : 'Atualizar dados'}</Button>}
            <Button variant="ghost" icon={Plus} disabled={!draft.clientId} onClick={() => patch({ campaigns: [...draft.campaigns, withKeys({ name: '', label: '', adset: '', resultType: '', resultShort: '', attribution: '', budget: '', source: 'manual', periodConfirmed: false, notes: [], printSpend: '', printImp: '', ads: [] })] })}>Manual</Button>
          </div>
        }
      >
        {!isMeta && <details className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs text-white/55">
          <summary className="cursor-pointer select-none font-medium text-white/70">Como exportar do Gerenciador de Anúncios</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>No Gerenciador, abra a aba <b>Anúncios</b> e filtre a campanha e o conjunto.</li>
            <li>Defina o período (ex.: 1 a 31 do mês) — evite "Máximo".</li>
            <li>Use as colunas de <b>Desempenho</b> (Veiculação, Resultados, Alcance, Impressões, Custo por resultado, Valor usado).</li>
            <li>Clique em <b>Exportar → Exportar dados da tabela</b> e escolha .csv ou .xlsx.</li>
          </ol>
        </details>}

        {busy === 'load' && <p className="mt-4 flex items-center gap-2 text-sm text-white/55"><Loader2 className="h-4 w-4 animate-spin" /> Carregando campanhas…</p>}
        {draft.clientId && draft.loadInfo && !draft.loadInfo.missing && (
          <p className="mt-4 flex items-center gap-2 text-xs text-white/50"><CalendarClock className="h-3.5 w-3.5 text-brand-300" /> Dados de {draft.client} para {fmtPeriod([draft.periodStart, draft.periodEnd])} · fonte: {draft.loadInfo.source} · salvos em {draft.loadInfo.savedAt?.split('-').reverse().join('/')}</p>
        )}
        {draft.clientId && draft.loadInfo?.missing && (
          <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-4 text-sm text-amber-100">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Sem dados de {draft.client} para {fmtPeriod([draft.periodStart, draft.periodEnd])}.</p>
            <p className="mt-1 text-xs text-amber-100/70">{isMeta ? 'A API da Meta não retornou campanhas com gasto ou ativas nesse período.' : 'Importe a exportação do Gerenciador desse período. Enquanto a API da Meta não estiver configurada, os dados vêm das importações.'}</p>
            {draft.loadInfo.others?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {draft.loadInfo.others.map(([s, e]) => <button key={s + e} onClick={() => { patch({ periodStart: s, periodEnd: e }); reload(draft.clientId, s, e); }} className="chip">Usar {fmtPeriod([s, e])}</button>)}
              </div>
            )}
          </div>
        )}
        {draft.hidden?.length > 0 && (
          <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-white/55">{draft.hidden.length} campanha(s) sem anúncios ativos agora — clique em + para incluir no relatório:</p>
              {draft.hidden.length > 1 && <button onClick={() => includeHidden(draft.hidden)} className="chip"><Plus className="h-3.5 w-3.5" /> Incluir todas</button>}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <AnimatePresence initial={false}>
                {draft.hidden.map((c, i) => {
                  const spend = c.ads.reduce((t, a) => t + (a.spend ?? 0), 0);
                  return (
                    <motion.button
                      layout key={c.hid || `${c.name}|${c.adset}|${i}`}
                      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => includeHidden([c])}
                      className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-brand/50 hover:bg-brand/10"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/15 text-brand-300 transition group-hover:border-brand/60"><Plus className="h-3.5 w-3.5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-white/85">{c.name}</span>
                        <span className="block truncate text-[11px] text-white/45">{c.adset || 'sem conjunto'} · {c.ads.length} anúncio(s) · {draft.currency === 'USD' ? 'US$' : 'R$'} {nfmt(spend)}</span>
                      </span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        {imp && <ImportPanel result={imp} onConfirm={confirmImport} onCancel={() => setImp(null)} onReparse={reparse} />}

        <div className="mt-5 space-y-3">
          {draft.campaigns.map((c, i) => (
            <CampaignEditor key={c.key} c={c} idx={i} currency={draft.currency} update={(nc) => updateCampaign(c.key, nc)} remove={() => removeCampaign(c)} />
          ))}
          {draft.clientId && !draft.campaigns.length && !imp && busy !== 'load' && (
            <button onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }} className="grid w-full place-items-center gap-2 rounded-2xl border border-dashed border-white/15 py-12 text-sm text-white/50 transition hover:border-brand/50 hover:text-white">
              <FileUp className="h-6 w-6 text-brand-300" />
              Solte aqui ou clique para importar a exportação do Gerenciador
            </button>
          )}
        </div>
      </Card>

      <Card step="3" title="Conferir e gerar" sub="O relatório só é gerado depois da sua confirmação">
        {blockers.length ? (
          <ul className="space-y-2">{blockers.map((b) => <li key={b} className="flex items-center gap-2 text-sm text-amber-200"><AlertTriangle className="h-4 w-4" />{b}</li>)}</ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Tudo preenchido. Revise os números das campanhas antes de gerar.</p>
        )}
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-white/80">
          <input type="checkbox" checked={confirmed} disabled={!!blockers.length} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-[#F76000]" />
          Conferi os dados de todas as campanhas contra o Gerenciador (nomes, status, gasto, impressões, alcance e resultados).
        </label>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button icon={FileText} loading={busy === 'pdf'} disabled={!confirmed || !!blockers.length} onClick={() => generate('pdf')}>Gerar PDF</Button>
          <Button variant="ghost" icon={FileSpreadsheet} loading={busy === 'xlsx'} disabled={!confirmed || !!blockers.length} onClick={() => generate('xlsx')}>Baixar planilha XLSX</Button>
        </div>
        <p className="mt-3 text-[11px] text-white/35">Ao gerar, as correções feitas nas campanhas ficam salvas no cliente para os próximos relatórios.</p>
      </Card>

      <AnimatePresence>{preview && <Preview html={preview.html} fileName={preview.fileName} onClose={() => setPreview(null)} />}</AnimatePresence>
    </div>
  );
}

