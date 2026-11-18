// HTML → PDF no servidor com Chrome sem tela (puppeteer-core).
// Ordem: CHROME_PATH (variável de ambiente) → Chrome/Edge instalados (Windows/macOS/Linux) → @sparticuz/chromium (Linux, Hostinger).
import fs from 'node:fs';

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
];

async function launch() {
  const { default: puppeteer } = await import('puppeteer-core');
  const local = process.env.CHROME_PATH || CANDIDATES.find((p) => fs.existsSync(p));
  if (local) return puppeteer.launch({ executablePath: local, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  let chromium;
  try { ({ default: chromium } = await import('@sparticuz/chromium')); } catch {
    throw new Error('Nenhum Chrome disponível para gerar PDF (defina CHROME_PATH ou instale @sparticuz/chromium).');
  }
  return puppeteer.launch({ executablePath: await chromium.executablePath(), headless: true, args: chromium.args, defaultViewport: chromium.defaultViewport });
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
