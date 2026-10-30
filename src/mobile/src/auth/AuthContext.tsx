import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { configureTokenStore } from '../api/client';
import { authApi } from '../api/endpoints';
import type { TokenResponse } from '../api/types';
import { loadTokens, saveTokens } from './tokenStorage';

interface AuthState {
  isReady: boolean;
  isSignedIn: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const tokensRef = useRef<TokenResponse | null>(null);
  const [isReady, setReady] = useState(false);
  const [isSignedIn, setSignedIn] = useState(false);

  const setTokens = useCallback(async (tokens: TokenResponse | null) => {
    tokensRef.current = tokens;
    setSignedIn(tokens !== null);
    await saveTokens(tokens);
    if (!tokens) queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    configureTokenStore({ getTokens: () => tokensRef.current, setTokens });
    loadTokens()
      .then((tokens) => {
        tokensRef.current = tokens;
        setSignedIn(tokens !== null);
      })
      .finally(() => setReady(true));
  }, [setTokens]);

  const signIn = useCallback(async (email: string, password: string) => {
    await setTokens(await authApi.login(email.trim(), password));
  }, [setTokens]);

  const signUp = useCallback(async (email: string, password: string) => {
    await authApi.register(email.trim(), password);
    await signIn(email, password);
  }, [signIn]);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Local sign-out must succeed even when the server is unreachable.
    }
    await setTokens(null);
  }, [setTokens]);

  const value = useMemo(() => ({ isReady, isSignedIn, signIn, signUp, signOut }), [isReady, isSignedIn, signIn, signUp, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
