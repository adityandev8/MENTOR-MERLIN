import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { STAFF_ROLES, type AuthResult, type LoginInput, type PublicUser, type RegisterInput } from '@hotel/shared';
import { authApi } from '../api/endpoints';
import { configureHttp } from '../api/http';

const TOKEN_KEY = 'mentormerlin.session';

interface AuthState {
  user: PublicUser | null;
  /** True while a stored session is being restored on first load. */
  restoring: boolean;
  isStaff: boolean;
  login: (input: LoginInput) => Promise<PublicUser>;
  register: (input: RegisterInput) => Promise<PublicUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the session simply won't survive a reload.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(readToken);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [restoring, setRestoring] = useState<boolean>(() => readToken() !== null);

  const logout = useCallback(() => {
    writeToken(null);
    setToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  // The token is read at call time so requests always use the current session.
  configureHttp({ getToken: () => token, onUnauthenticated: logout });

  useEffect(() => {
    if (!token || user) {
      setRestoring(false);
      return;
    }
    let cancelled = false;
    authApi
      .me()
      .then((u) => !cancelled && setUser(u))
      .catch(() => !cancelled && logout())
      .finally(() => !cancelled && setRestoring(false));
    return () => {
      cancelled = true;
    };
  }, [token, user, logout]);

  const accept = useCallback(
    (result: AuthResult) => {
      queryClient.clear();
      writeToken(result.token);
      setToken(result.token);
      setUser(result.user);
      return result.user;
    },
    [queryClient],
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      restoring,
      isStaff: !!user && STAFF_ROLES.includes(user.role),
      login: async (input) => accept(await authApi.login(input)),
      register: async (input) => accept(await authApi.register(input)),
      logout,
    }),
    [user, restoring, accept, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
