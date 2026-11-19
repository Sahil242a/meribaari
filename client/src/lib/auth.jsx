import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from './api.js';
import { AuthCtx, useAuth } from './authContext.js';

/** Holds the logged-in staff session (undefined = loading, null = logged out). */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);

  const refresh = useCallback(
    () =>
      api('/auth/me')
        .then(setSession)
        .catch(() => setSession(null)),
    []
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) =>
    setSession(await api('/auth/login', { method: 'POST', body: { email, password } }));
  const register = async (body) => setSession(await api('/auth/register', { method: 'POST', body }));
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setSession(null);
  };

  return (
    <AuthCtx.Provider value={{ session, setSession, login, register, logout, refresh }}>{children}</AuthCtx.Provider>
  );
}

/** Route guard for staff pages. */
export function RequireStaff({ children }) {
  const { session } = useAuth();
  if (session === undefined)
    return (
      <p className="shell muted" style={{ padding: 40 }}>
        Loading...
      </p>
    );
  if (!session) return <Navigate to="/staff/login" replace />;
  return children;
}
