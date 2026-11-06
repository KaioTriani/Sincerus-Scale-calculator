// Leitura da exportação do Gerenciador de Anúncios (CSV ou XLSX) — fidelidade acima de tudo:
// nada é estimado; o que não dá para ler vira aviso para o usuário confirmar.

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// chave -> prefixos aceitos (pt-BR e en). A ordem importa: o primeiro que casar vence.
const HEADERS = {
  name: ['nome do anuncio', 'ad name'],
  campaignStatus: ['veiculacao da campanha', 'campaign delivery'],
  status: ['veiculacao do anuncio', 'veiculacao', 'ad delivery', 'delivery', 'status do anuncio'],
  campaign: ['nome da campanha', 'campaign name'],
  adset: ['nome do conjunto de anuncios', 'ad set name'],
  spend: ['valor usado', 'valor gasto', 'amount spent'],
  imp: ['impressoes', 'impressions'],
  reach: ['alcance', 'reach'],
  results: ['resultados', 'results'],
  resultType: ['indicador de resultados', 'indicador de resultado', 'result indicator', 'tipo de resultado'],
  cpr: ['custo por resultado', 'cost per result'],
  freq: ['frequencia', 'frequency'],
  cpm: ['cpm'],
  clicks: ['cliques no link', 'link clicks'],
  ctr: ['ctr'],
  start: ['inicio dos relatorios', 'reporting starts'],
  end: ['termino dos relatorios', 'reporting ends'],
  q: ['classificacao de qualidade', 'quality ranking'],
  e: ['classificacao da taxa de engajamento', 'engagement rate ranking'],
  cv: ['classificacao da taxa de conversao', 'conversion rate ranking'],
};
export const NUMERIC = ['spend', 'imp', 'reach', 'results', 'cpr', 'freq', 'cpm', 'clicks', 'ctr'];

export function mapHeaders(headers) {
  const n = headers.map(norm);
  const map = {};
  for (const [key, prefixes] of Object.entries(HEADERS)) {
    for (const p of prefixes) {
      const i = n.findIndex((h, idx) => h.startsWith(p) && !Object.values(map).includes(idx));
      if (i >= 0) { map[key] = i; break; }
    }
  }
  return map;
}

// Detecta o separador decimal do arquivo inteiro olhando para valores sem ambiguidade
export function detectDecimal(values) {
  let comma = 0, dot = 0;
  for (const raw of values) {
    const v = String(raw ?? '').replace(/[^\d.,-]/g, '');
    if (!v) continue;
    const lc = v.lastIndexOf(','), ld = v.lastIndexOf('.');
    if (lc >= 0 && ld >= 0) (lc > ld ? comma++ : dot++);
    else if (lc >= 0 && v.length - lc - 1 !== 3) comma++;
    else if (ld >= 0 && v.length - ld - 1 !== 3) dot++;
  }
  if (comma && !dot) return ',';
  if (dot && !comma) return '.';
  return null; // ambíguo ou sem evidência: o usuário confirma
}

export function parseNumber(raw, decimal) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim();
  if (!s || s === '—' || s === '-' || s === '--') return null;
  let v = s.replace(/[^\d.,-]/g, '');
  if (!v) return null;
  if (decimal === ',') v = v.replace(/\./g, '').replace(',', '.');
  else v = v.replace(/,/g, '');
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delim = [';', '\t', ','].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

async function parseXlsx(buffer) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  const rows = [];
  ws.eachRow({ includeEmpty: false }, (r) => {
    const vals = [];
    r.eachCell({ includeEmpty: true }, (c, col) => {
      let v = c.value;
      if (v && typeof v === 'object') v = v.result ?? v.text ?? (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
      vals[col - 1] = v ?? '';
    });
    rows.push(vals);
  });
  return rows;
}

export async function readTable(file) {
  if (/\.xlsx$/i.test(file.name)) return parseXlsx(await file.arrayBuffer());
  return parseCsv((await file.text()).replace(/^﻿/, ''));
}

const toISO = (v) => {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s;
};

// Transforma a tabela lida em campanhas + avisos
export function tableToCampaigns(rows, { decimalOverride } = {}) {
  const warnings = [];
  const headerIdx = rows.findIndex((r) => { const m = mapHeaders(r); return m.name != null && m.spend != null; });
  if (headerIdx < 0) throw new Error('Não encontrei as colunas "Nome do anúncio" e "Valor usado" no arquivo. Exporte a tabela no nível de anúncio.');
  const headers = rows[headerIdx].map(String);
  const map = mapHeaders(headers);
  const currency = /\((usd|brl|eur)\)/i.exec(headers[map.spend])?.[1]?.toUpperCase() ?? null;
  const body = rows.slice(headerIdx + 1);

  const numericCells = body.flatMap((r) => NUMERIC.filter((k) => map[k] != null).map((k) => r[map[k]]).filter((v) => typeof v === 'string'));
  const detected = detectDecimal(numericCells);
  const decimal = decimalOverride ?? detected ?? ',';
  if (!decimalOverride && !detected && numericCells.length) warnings.push('Não consegui ter certeza do separador decimal (ex.: "1.234" pode ser mil ou 1,234). Confirme o formato abaixo.');

  const missing = ['imp', 'reach', 'results'].filter((k) => map[k] == null);
  if (missing.length) warnings.push(`Colunas ausentes no arquivo: ${missing.map((k) => ({ imp: 'Impressões', reach: 'Alcance', results: 'Resultados' })[k]).join(', ')}. Elas ficarão como "n/d".`);

  const periods = new Set();
  const groups = new Map();
  let totalsRow = null;
  for (const r of body) {
    const name = String(r[map.name] ?? '').trim();
    const get = (k) => (map[k] == null ? undefined : r[map[k]]);
    const num = (k) => (map[k] == null ? undefined : parseNumber(get(k), decimal));
    if (!name || /^(total|resultados de \d+)/i.test(name)) {
      // linha de total do Gerenciador: usada só para conferir a soma
      if (num('spend') != null) totalsRow = { spend: num('spend'), imp: num('imp') ?? null, reach: num('reach') ?? null, results: num('results') ?? null };
      continue;
    }
    if (map.start != null || map.end != null) periods.add(`${toISO(get('start'))}|${toISO(get('end'))}`);
    const campaign = map.campaign != null ? String(get('campaign') || '').trim() || '(sem nome de campanha)' : '(campanha do arquivo)';
    if (!groups.has(campaign)) groups.set(campaign, []);
    groups.get(campaign).push({
      name,
      campaignStatus: map.campaignStatus != null ? String(get('campaignStatus') ?? '').trim() : '',
      status: String(get('status') ?? '').trim() || 'não informado',
      adset: map.adset != null ? String(get('adset') ?? '').trim() : '',
      resultType: map.resultType != null ? String(get('resultType') ?? '').trim() : '',
      spend: num('spend') ?? 0,
      imp: num('imp') ?? null,
      reach: num('reach') ?? null,
      results: num('results') ?? null,
      cpr: num('cpr') ?? null,
      freq: num('freq') ?? null,
      cpm: num('cpm') ?? null,
      clicks: num('clicks') ?? null,
      ctr: num('ctr') ?? null,
      q: map.q != null ? String(get('q') ?? '').trim() || null : null,
      e: map.e != null ? String(get('e') ?? '').trim() || null : null,
      cv: map.cv != null ? String(get('cv') ?? '').trim() || null : null,
    });
  }

  const campaigns = [...groups.entries()].map(([name, ads]) => {
    const adsets = [...new Set(ads.map((a) => a.adset).filter(Boolean))];
    const types = [...new Set(ads.map((a) => a.resultType).filter(Boolean))];
    return { name, adsets, ads, resultType: types.join(' / '), campaignStatus: ads.find((a) => a.campaignStatus)?.campaignStatus ?? '' };
  });

  return {
    campaigns,
    currency,
    decimal,
    decimalDetected: detected,
    periods: [...periods].map((p) => p.split('|')),
    totalsRow: groups.size === 1 ? totalsRow : null,
    hasCols: Object.fromEntries(Object.keys(HEADERS).map((k) => [k, map[k] != null])),
    warnings,
  };
}

// ---------- Identificação do carro pelo nome do anúncio ----------
const BRANDS = ['Fiat', 'Nissan', 'GWM', 'BYD', 'Kia', 'Toyota', 'Jeep', 'Honda', 'Hyundai', 'Chevrolet', 'Volkswagen', 'VW', 'Ford', 'Renault', 'Peugeot', 'Citroën', 'Citroen', 'Jetour', 'BMW', 'Mercedes-Benz', 'Mercedes', 'Audi', 'Haval', 'Caoa Chery', 'Chery', 'Mitsubishi', 'Volvo', 'Land Rover', 'Porsche', 'RAM', 'Dodge', 'Suzuki', 'JAC', 'Omoda', 'Zeekr'];

export function identifyCar(name) {
  let rest = ` ${name.replace(/^ADS\s*[-–]\s*/i, '')} `;
  let brand = null;
  for (const b of BRANDS) {
    const re = new RegExp(`\\s${b.replace(/[-]/g, '\\-')}\\s`, 'i');
    if (re.test(rest)) { brand = b; rest = rest.replace(re, ' '); break; }
  }
  const years = [...rest.matchAll(/\b(19[89]\d|20[0-4]\d)\b/g)].map((m) => m[1]);
  const year = years.length > 1 ? `${years[0]}–${years.at(-1)}` : years[0] ?? null;
  rest = rest.replace(/\b(19[89]\d|20[0-4]\d)\b/g, ' ').replace(/\s[-–]\s/g, ' ').replace(/\s+/g, ' ').trim();
  // nomes que descrevem um grupo de carros ou uma peça, não um modelo
  const generic = /^(el[eé]tricos|suvs?|seminovos|ofertas?.*|entrega.*|mini .*|colet[aâ]nea|.*carrossel.*|venda.*|estoque.*)$/i;
  const model = rest && !generic.test(rest) ? rest : null;
  return { brand, model, year };
}
