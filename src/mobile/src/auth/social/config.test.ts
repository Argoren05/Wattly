/** Tests of provider availability and Google iOS URL scheme derivation. */
import { availableProviders, googleIosUrlScheme, providerLabels, readSocialConfig } from './config';

const full = {
  googleWebClientId: 'web.apps.googleusercontent.com',
  googleIosClientId: '123-abc.apps.googleusercontent.com',
  microsoftClientId: 'ms-client',
  facebookAppId: '999',
  appleEnabled: true,
};

test('all configured providers are offered on iOS in a fixed order', () => {
  expect(availableProviders(full, 'ios')).toEqual(['apple', 'google', 'microsoft', 'facebook']);
});

test('Apple is iOS only and Google needs native SDK and per-platform client IDs', () => {
  expect(availableProviders(full, 'android')).toEqual(['google', 'microsoft', 'facebook']);
  expect(availableProviders(full, 'web')).toEqual(['microsoft', 'facebook']);
  expect(availableProviders({ ...full, googleIosClientId: undefined }, 'ios')).not.toContain('google');
  expect(availableProviders({ ...full, googleIosClientId: undefined }, 'android')).toContain('google');
});

test('nothing is offered without configuration', () => {
  expect(availableProviders({}, 'ios')).toEqual([]);
  expect(availableProviders(readSocialConfig(), 'ios')).toEqual([]);
});

test('derives the Google iOS URL scheme', () => {
  expect(googleIosUrlScheme('123-abc.apps.googleusercontent.com')).toBe('com.googleusercontent.apps.123-abc');
  expect(googleIosUrlScheme('not-a-client-id')).toBeUndefined();
  expect(googleIosUrlScheme(undefined)).toBeUndefined();
});

test('every provider has a Polish label', () => {
  expect(Object.values(providerLabels).every((l) => l.startsWith('Kontynuuj z'))).toBe(true);
});
