import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, resetMetaStatus } from './api';

// Login validado no servidor (server/auth.mjs): usuários na variável AUTH_USERS, sessão em cookie httpOnly.
// Nenhuma senha ou hash fica no código do navegador.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api('/auth/me').then(setUser).catch(() => setUser(null)).finally(() => setChecking(false));
  }, []);

  const login = useCallback(async (username, password, remember) => {
    try {
      const u = await api('/auth/login', { method: 'POST', body: { username, password, remember } });
      resetMetaStatus();
      setUser(u);
    } catch (e) {
      if (e.noServer) throw new Error('Servidor da plataforma indisponível. A área restrita precisa do servidor em execução (npm start).');
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* sessão já encerrada */ }
    resetMetaStatus();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, checking, login, logout }), [user, checking, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
