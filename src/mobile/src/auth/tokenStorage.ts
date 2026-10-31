import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { TokenResponse } from '../api/types';

/** Storage key of the serialized tokens. */
const KEY = 'wattly.tokens';

// Native: Keychain / Keystore via SecureStore. Web (development only): localStorage.
/**
 * Loads tokens saved by a previous session.
 * @returns Tokens, or null when absent or unreadable.
 */
export async function loadTokens(): Promise<TokenResponse | null> {
  const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) ?? null : await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TokenResponse;
  } catch {
    return null;
  }
}

/**
 * Saves tokens, or removes them when null.
 * @param tokens Tokens to store.
 */
export async function saveTokens(tokens: TokenResponse | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (tokens) globalThis.localStorage?.setItem(KEY, JSON.stringify(tokens));
    else globalThis.localStorage?.removeItem(KEY);
    return;
  }
  if (tokens) await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
  else await SecureStore.deleteItemAsync(KEY);
}
