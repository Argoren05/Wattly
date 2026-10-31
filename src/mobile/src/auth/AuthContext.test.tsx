/** Tests of the authentication provider. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';

import { authApi } from '../api/endpoints';
import { tokens } from '../test/fixtures';
import { AuthProvider, useAuth } from './AuthContext';

jest.mock('../api/endpoints');

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}><AuthProvider>{children}</AuthProvider></QueryClientProvider>
);

beforeEach(() => store.clear());

test('restores an existing session on start', async () => {
  store.set('wattly.tokens', JSON.stringify(tokens));

  const { result } = await renderHook(() => useAuth(), { wrapper });

  await waitFor(() => expect(result.current.isReady).toBe(true));
  expect(result.current.isSignedIn).toBe(true);
});

test('sign in stores tokens, sign out clears them even when the server fails', async () => {
  jest.mocked(authApi.login).mockResolvedValue(tokens);
  jest.mocked(authApi.logout).mockRejectedValue(new Error('offline'));
  const { result } = await renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.isReady).toBe(true));

  await act(() => result.current.signIn(' jan@example.com ', 'secret'));
  expect(authApi.login).toHaveBeenCalledWith('jan@example.com', 'secret');
  expect(result.current.isSignedIn).toBe(true);
  expect(store.has('wattly.tokens')).toBe(true);

  await act(() => result.current.signOut());
  expect(result.current.isSignedIn).toBe(false);
  expect(store.has('wattly.tokens')).toBe(false);
});

test('external sign-in stores the Wattly tokens returned for the provider token', async () => {
  jest.mocked(authApi.external).mockResolvedValue(tokens);
  const { result } = await renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.isReady).toBe(true));

  await act(() => result.current.signInExternal('google', 'id-token', 'nonce'));

  expect(authApi.external).toHaveBeenCalledWith('google', 'id-token', 'nonce');
  expect(result.current.isSignedIn).toBe(true);
  expect(store.get('wattly.tokens')).toBe(JSON.stringify(tokens));
});

test('sign up registers and signs in', async () => {
  jest.mocked(authApi.register).mockResolvedValue(undefined);
  jest.mocked(authApi.login).mockResolvedValue(tokens);
  const { result } = await renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.isReady).toBe(true));

  await act(() => result.current.signUp('a@b.c', 'Password123'));

  expect(authApi.register).toHaveBeenCalledWith('a@b.c', 'Password123');
  expect(result.current.isSignedIn).toBe(true);
});

test('hook outside provider throws', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await expect(renderHook(() => useAuth())).rejects.toThrow('useAuth must be used inside AuthProvider');
});
