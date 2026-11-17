// Gera arquivos PDF de verdade no navegador (sem janela de impressão): cada <section class="page"> vira uma
// página A4 retrato. Usado para baixar um arquivo por cliente (ou um .zip com todos).
const A4 = { w: 794, h: 1123 }; // px a 96 dpi

function renderFrame(html) {
  return new Promise((resolve, reject) => {
    const f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    Object.assign(f.style, { position: 'fixed', left: '-10000px', top: '0', width: `${A4.w}px`, height: `${A4.h}px`, border: '0' });
    f.onload = async () => {
      try {
        const doc = f.contentDocument;
        await doc.fonts?.ready;
        await new Promise((r) => setTimeout(r, 150));
        resolve(f);
      } catch (e) { f.remove(); reject(e); }
    };
    f.srcdoc = html;
    document.body.appendChild(f);
  });
}

// O html2canvas desenha o texto no documento principal: as fontes do relatório precisam estar carregadas aqui
// também, senão ele mede com a Poppins e desenha com outra fonte (letras encavaladas).
async function ensureFonts(html) {
  const links = [...html.matchAll(/<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  for (const href of links) {
    if (!document.querySelector(`link[data-pdf-font="${href}"]`)) {
      await new Promise((r) => { const l = Object.assign(document.createElement('link'), { rel: 'stylesheet', href, onload: r, onerror: r }); l.dataset.pdfFont = href; document.head.appendChild(l); });
    }
  }
  if (links.length && document.fonts) {
    await Promise.all(['300', '400', '500', '600', '700'].map((w) => document.fonts.load(`${w} 16px Poppins`).catch(() => null)));
  }
}

export async function htmlToPdfBlob(html) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  await ensureFonts(html);
  const f = await renderFrame(html);
  try {
    const doc = f.contentDocument;
    // tira o fundo/sombra do modo de tela antes de capturar
    doc.body.style.background = '#fff'; doc.body.style.padding = '0';
    // o html2canvas desloca o fundo de texto marcado: no arquivo baixado o destaque vira texto forte em rosa
    // destaque da leitura: sublinhado laranja (o html2canvas não aplica espessura/afastamento, mas mantém a cor)
    doc.head.appendChild(Object.assign(doc.createElement('style'), { textContent: 'mark{background:none!important;display:inline!important;padding:0!important}' }));
    const pages = [...doc.querySelectorAll('section.page, section.sheet')];
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    for (const [i, p] of pages.entries()) {
      p.style.margin = '0'; p.style.boxShadow = 'none';
      const canvas = await html2canvas(p, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: A4.w, windowHeight: A4.h, logging: false });
      if (i) pdf.addPage('a4', 'portrait');
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }
    return pdf.output('blob');
  } finally { f.remove(); }
}

const save = (blob, name) => {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};

// files: [{ fileName, html }] → 1 arquivo: baixa o PDF; vários: um .zip com um PDF por cliente
export async function downloadPdfs(files, zipName, onProgress) {
  const out = [];
  for (const [i, f] of files.entries()) {
    onProgress?.(i, files.length, f.fileName);
    out.push({ name: `${f.fileName}.pdf`, blob: await htmlToPdfBlob(f.html) });
  }
  onProgress?.(files.length, files.length, '');
  if (out.length === 1) { save(out[0].blob, out[0].name); return; }
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const used = new Set();
  for (const f of out) {
    let n = f.name, k = 2;
    while (used.has(n)) n = f.name.replace(/\.pdf$/, `_${k++}.pdf`);
    used.add(n); zip.file(n, f.blob);
  }
  save(await zip.generateAsync({ type: 'blob' }), `${zipName}.zip`);
}
