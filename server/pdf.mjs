// HTML → PDF no servidor com Chrome sem tela (puppeteer-core).
// Ordem: CHROME_PATH (variável de ambiente) → Chrome/Edge instalados (Windows/macOS/Linux) → @sparticuz/chromium (Linux, Hostinger).
// Na Hostinger o Chromium é descompactado numa pasta só deste app (server/data/chromium), não no /tmp compartilhado:
// assim não há conflito com arquivos de outra execução (erro "EEXIST") nem duas extrações ao mesmo tempo.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DATA_DIR } from './paths.mjs';

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
];
const PRIVATE = path.join(DATA_DIR, 'chromium');

let exePromise = null; // uma extração só, compartilhada por quem pedir ao mesmo tempo
async function extractChromium() {
  const exe = path.join(PRIVATE, 'chromium');
  if (fs.existsSync(exe) && fs.statSync(exe).size > 1e6) return exe;
  fs.rmSync(PRIVATE, { recursive: true, force: true });
  fs.mkdirSync(PRIVATE, { recursive: true });
  process.env.TMPDIR = PRIVATE; // o descompactador usa os.tmpdir()
  const pkgDir = path.dirname(createRequire(import.meta.url).resolve('@sparticuz/chromium'));
  const { default: LambdaFS } = await import(pathToFileURL(path.join(pkgDir, 'lambdafs.js')).href);
  const bin = path.join(pkgDir, '..', 'bin');
  await LambdaFS.inflate(path.join(bin, 'chromium.br'));
  await LambdaFS.inflate(path.join(bin, 'fonts.tar.br'));
  await LambdaFS.inflate(path.join(bin, 'swiftshader.tar.br'));
  if (!fs.existsSync(exe)) throw new Error(`Chromium não foi descompactado em ${exe}`);
  fs.chmodSync(exe, 0o755);
  return exe;
}

async function launch() {
  const { default: puppeteer } = await import('puppeteer-core');
  const local = process.env.CHROME_PATH || CANDIDATES.find((p) => fs.existsSync(p));
  if (local) return puppeteer.launch({ executablePath: local, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  let chromium;
  try { ({ default: chromium } = await import('@sparticuz/chromium')); } catch {
    throw new Error('Nenhum Chrome disponível para gerar PDF (defina CHROME_PATH ou instale @sparticuz/chromium).');
  }
  if (!exePromise) exePromise = extractChromium().catch((e) => { exePromise = null; throw new Error(`Falha ao preparar o Chromium: ${e.code || ''} ${e.message}`); });
  const executablePath = await exePromise;
  // fontes que vêm junto com o Chromium (o fontconfig procura em ~/.fonts)
  const fontsDir = path.join(PRIVATE, 'fonts'), home = path.join(PRIVATE, 'home');
  fs.mkdirSync(home, { recursive: true });
  try { if (fs.existsSync(fontsDir) && !fs.existsSync(path.join(home, '.fonts'))) fs.symlinkSync(fontsDir, path.join(home, '.fonts')); } catch { /* segue sem as fontes extras */ }
  return puppeteer.launch({
    executablePath, headless: true, args: chromium.args, defaultViewport: chromium.defaultViewport,
    env: { ...process.env, HOME: home, LD_LIBRARY_PATH: [PRIVATE, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') },
  });
}

let available = null; // cache do teste de disponibilidade
export async function pdfAvailable() {
  if (available != null) return available;
  try { const b = await launch(); await b.close(); available = true; } catch (e) { console.error('PDF indisponível:', e.message); available = false; }
  return available;
}

// Gera um PDF (Buffer) a partir do HTML de relatório (as folhas definem o tamanho via @page)
export async function htmlToPdf(html) {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.evaluate(() => document.fonts?.ready);
    return Buffer.from(await page.pdf({ printBackground: true, preferCSSPageSize: true }));
  } finally { await browser.close(); }
}
