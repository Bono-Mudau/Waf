import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthContext } from './authContext';
import * as auth from '../services/authServices';

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const sessionRevision = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const revision = ++sessionRevision.current;
    const isCurrent = () =>
      !controller.signal.aborted && revision === sessionRevision.current;
    auth
      .getSession({ signal: controller.signal })
      .then((current) => {
        if (isCurrent()) {
          setUser(current);
          setError('');
        }
      })
      .catch((failure) => {
        if (isCurrent()) {
          setUser(null);
          setError(failure.status === 401 ? '' : failure.message);
        }
      })
      .finally(() => {
        if (isCurrent()) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);

  const clearSession = useCallback(() => {
    sessionRevision.current += 1;
    setUser(null);
    setError('');
    setLoading(false);
  }, []);
  useEffect(() => {
    window.addEventListener('sqlishield:unauthorized', clearSession);
    return () =>
      window.removeEventListener('sqlishield:unauthorized', clearSession);
  }, [clearSession]);

  const refreshSession = useCallback(() => {
    sessionRevision.current += 1;
    setLoading(true);
    setError('');
    setAttempt((value) => value + 1);
  }, []);
  const signIn = async (credentials) => {
    const revision = ++sessionRevision.current;
    setError('');
    try {
      const current = await auth.login(credentials);
      if (revision === sessionRevision.current) setUser(current);
    } finally {
      if (revision === sessionRevision.current) setLoading(false);
    }
  };
  const signOut = async () => {
    await auth.logout();
    clearSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        error,
        refreshSession,
        signIn,
        signOut,
        clearSession,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
