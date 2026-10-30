/** Tests of token persistence (SecureStore on native platforms). */
import * as SecureStore from 'expo-secure-store';

import { tokens } from '../test/fixtures';
import { loadTokens, saveTokens } from './tokenStorage';

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

beforeEach(() => store.clear());

test('saves, loads and deletes tokens in secure storage', async () => {
  await saveTokens(tokens);
  expect(store.get('wattly.tokens')).toBe(JSON.stringify(tokens));
  await expect(loadTokens()).resolves.toEqual(tokens);

  await saveTokens(null);
  await expect(loadTokens()).resolves.toBeNull();
});

test('corrupted value is treated as no session', async () => {
  store.set('wattly.tokens', '{not json');
  await expect(loadTokens()).resolves.toBeNull();
});
