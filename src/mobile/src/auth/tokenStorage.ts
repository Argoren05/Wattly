import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { TokenResponse } from '../api/types';

const KEY = 'wattly.tokens';

// Native: Keychain / Keystore via SecureStore. Web (development only): localStorage.
export async function loadTokens(): Promise<TokenResponse | null> {
  const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) ?? null : await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TokenResponse;
  } catch {
    return null;
  }
}

export async function saveTokens(tokens: TokenResponse | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (tokens) globalThis.localStorage?.setItem(KEY, JSON.stringify(tokens));
    else globalThis.localStorage?.removeItem(KEY);
    return;
  }
  if (tokens) await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
  else await SecureStore.deleteItemAsync(KEY);
}
