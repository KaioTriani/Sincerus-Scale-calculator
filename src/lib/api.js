// Cliente da API do servidor (server/index.mjs).
// Se o site estiver publicado só como arquivos estáticos, não há /api: NoServerError avisa a tela para usar o modo local.
export class NoServerError extends Error {
  constructor() { super('Servidor da plataforma indisponível.'); this.noServer = true; }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new NoServerError();
  }
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  if (!isJson) throw new NoServerError(); // hospedagem estática devolve HTML (ou nada) em /api
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.error || `Erro ${res.status}`), { status: res.status });
  return data;
}

let metaStatus = null;
// { configured: boolean } — memorizado por sessão de página
export async function metaAvailable() {
  if (metaStatus) return metaStatus;
  try { metaStatus = await api('/meta/status'); } catch { metaStatus = { configured: false }; }
  return metaStatus;
}
export const resetMetaStatus = () => { metaStatus = null; };
