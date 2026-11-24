// Envio dos relatórios por e-mail (SMTP do e-mail do domínio na Hostinger).
// Variáveis: SMTP_HOST (padrão smtp.hostinger.com), SMTP_PORT (465), SMTP_USER, SMTP_PASS,
// EMAIL_FROM (padrão = SMTP_USER), REPORT_EMAILS (destinatários separados por vírgula).
// Sem SMTP_USER/SMTP_PASS/REPORT_EMAILS o e-mail fica desligado e nada quebra.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './paths.mjs';

const env = (k, d = '') => process.env[k] || d;
export const emailRecipients = () => env('REPORT_EMAILS').split(',').map((s) => s.trim()).filter(Boolean);
export const emailConfigured = () => !!(env('SMTP_USER') && env('SMTP_PASS') && emailRecipients().length);

let transport = null;
async function getTransport() {
  if (transport) return transport;
  const { default: nodemailer } = await import('nodemailer');
  const port = Number(env('SMTP_PORT', '465'));
  transport = nodemailer.createTransport({
    host: env('SMTP_HOST', 'smtp.hostinger.com'), port, secure: port === 465,
    auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') },
    connectionTimeout: 30000, socketTimeout: 120000,
  });
  return transport;
}

// confere login no servidor de e-mail (usado na verificação diária)
export async function verifyEmail() {
  if (!emailConfigured()) return { configured: false };
  await (await getTransport()).verify();
  return { configured: true, recipients: emailRecipients().length };
}

// envia para REPORT_EMAILS; tenta 3 vezes; anexos: [{ filename, content: Buffer }]
// dry: grava a prévia (HTML + lista de anexos) em DATA_DIR/email-previa-*.html e não envia
export async function sendEmail({ subject, html, text, attachments = [] }, { dry = false } = {}) {
  const size = attachments.reduce((t, a) => t + (a.content?.length || 0), 0);
  if (dry || !emailConfigured()) {
    const f = path.join(DATA_DIR, `email-previa-${subject.normalize('NFD').replace(/[^\w]+/g, '_').slice(0, 60)}.html`);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(f, `<!-- Assunto: ${subject} | anexos: ${attachments.map((a) => a.filename).join(', ') || 'nenhum'} -->\n${html}`);
    return { skipped: dry ? 'teste (não enviado)' : 'e-mail não configurado', preview: f, attachments: attachments.length, mb: +(size / 1048576).toFixed(1) };
  }
  if (size > 24 * 1048576) throw new Error(`anexos com ${(size / 1048576).toFixed(1)} MB passam do limite de 25 MB`);
  const t = await getTransport();
  let last;
  for (let i = 1; i <= 3; i++) {
    try {
      const info = await t.sendMail({ from: env('EMAIL_FROM', `Sincerus Scale <${env('SMTP_USER')}>`), to: emailRecipients().join(', '), subject, html, text: text || subject, attachments });
      return { ok: true, to: emailRecipients().length, attachments: attachments.length, mb: +(size / 1048576).toFixed(1), id: info.messageId };
    } catch (e) { last = e; await new Promise((r) => setTimeout(r, 10000 * i)); }
  }
  throw new Error(`e-mail não enviado: ${last?.message || last}`);
}

// ---------- modelo visual dos e-mails (HTML com estilos inline, funciona no Gmail/Outlook) ----------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export { esc as escHtml };
export function emailLayout({ title, subtitle, sections, footer }) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#F4F4F5;font-family:Arial,Helvetica,sans-serif;color:#12141A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:24px 0"><tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden">
<tr><td style="background:#12141A;padding:22px 28px"><div style="color:#F76000;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:bold">Sincerus Scale</div>
<div style="color:#ffffff;font-size:22px;font-weight:bold;margin-top:4px">${esc(title)}</div>${subtitle ? `<div style="color:#A9ADB4;font-size:13px;margin-top:4px">${esc(subtitle)}</div>` : ''}</td></tr>
${sections.map((s) => `<tr><td style="padding:22px 28px 6px">${s.heading ? `<div style="font-size:15px;font-weight:bold;border-bottom:2px solid #F76000;padding-bottom:6px;margin-bottom:12px">${esc(s.heading)}</div>` : ''}${s.html}</td></tr>`).join('')}
<tr><td style="padding:18px 28px 24px;color:#8A8F98;font-size:11px;line-height:1.5">${footer || 'Enviado automaticamente pela plataforma Sincerus Scale com dados da Meta Ads.'}</td></tr>
</table></td></tr></table></body></html>`;
}
