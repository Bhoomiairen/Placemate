import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, token } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token.get()));

  useEffect(() => {
    if (!token.get()) return;
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => token.clear())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('placemate:logout', onLogout);
    return () => window.removeEventListener('placemate:logout', onLogout);
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { email, password } });
    token.set(d.token);
    setUser(d.user);
  }, []);

  const register = useCallback(async (name, email, password) => {
    const d = await api('/auth/register', { method: 'POST', body: { name, email, password } });
    token.set(d.token);
    setUser(d.user);
  }, []);

  const logout = useCallback(() => {
    token.clear();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
