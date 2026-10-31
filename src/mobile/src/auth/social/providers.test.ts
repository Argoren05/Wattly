/** Tests of obtaining provider tokens (native SDKs and browser flows are mocked). */
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';

import { ValidationError } from '../../api/errors';
import { facebookDiscovery, getProviderToken, microsoftDiscovery } from './providers';

const config = { googleWebClientId: 'web-id', googleIosClientId: 'ios-id', microsoftClientId: 'ms-id', facebookAppId: '999', appleEnabled: true };
const auth = AuthSession as unknown as { __promptAsync: jest.Mock; exchangeCodeAsync: jest.Mock; AuthRequest: { instances: { config: Record<string, unknown> }[] } };

beforeEach(() => {
  auth.AuthRequest.instances.length = 0;
});

describe('google', () => {
  test('returns the ID token from the native SDK', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValue({ type: 'success', data: { idToken: 'google-id-token' } } as never);

    await expect(getProviderToken('google', config)).resolves.toEqual({ token: 'google-id-token' });
    expect(GoogleSignin.configure).toHaveBeenCalledWith({ webClientId: 'web-id', iosClientId: 'ios-id' });
  });

  test('cancellation returns null, missing token and Play Services errors are explained', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce({ type: 'cancelled', data: null } as never);
    await expect(getProviderToken('google', config)).resolves.toBeNull();

    jest.mocked(GoogleSignin.signIn).mockRejectedValueOnce({ code: 'SIGN_IN_CANCELLED' });
    await expect(getProviderToken('google', config)).resolves.toBeNull();

    jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce({ type: 'success', data: { idToken: null } } as never);
    await expect(getProviderToken('google', config)).rejects.toBeInstanceOf(ValidationError);

    jest.mocked(GoogleSignin.signIn).mockRejectedValueOnce({ code: 'PLAY_SERVICES_NOT_AVAILABLE' });
    await expect(getProviderToken('google', config)).rejects.toThrow('Usługi Google Play');

    jest.mocked(GoogleSignin.signIn).mockRejectedValueOnce(new Error('boom'));
    await expect(getProviderToken('google', config)).rejects.toThrow('boom');
  });
});

describe('microsoft', () => {
  test('uses PKCE with a nonce and exchanges the code for an ID token', async () => {
    auth.__promptAsync.mockResolvedValue({ type: 'success', params: { code: 'auth-code' } });
    auth.exchangeCodeAsync.mockResolvedValue({ idToken: 'ms-id-token' });

    await expect(getProviderToken('microsoft', config)).resolves.toEqual({ token: 'ms-id-token', nonce: 'test-nonce' });

    const request = auth.AuthRequest.instances[0]!.config;
    expect(request).toEqual(expect.objectContaining({ clientId: 'ms-id', usePKCE: true, redirectUri: 'wattly://auth', scopes: ['openid', 'profile', 'email'] }));
    expect(auth.__promptAsync).toHaveBeenCalledWith(microsoftDiscovery);
    expect(auth.exchangeCodeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'auth-code', extraParams: { code_verifier: 'test-verifier' } }), microsoftDiscovery);
  });

  test('cancel returns null and a missing ID token is an error', async () => {
    auth.__promptAsync.mockResolvedValueOnce({ type: 'cancel' });
    await expect(getProviderToken('microsoft', config)).resolves.toBeNull();

    auth.__promptAsync.mockResolvedValueOnce({ type: 'success', params: { code: 'c' } });
    auth.exchangeCodeAsync.mockResolvedValueOnce({});
    await expect(getProviderToken('microsoft', config)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('facebook', () => {
  test('requests an access token with the fb<APP_ID> redirect', async () => {
    auth.__promptAsync.mockResolvedValue({ type: 'success', params: { access_token: 'fb-token' } });

    await expect(getProviderToken('facebook', config)).resolves.toEqual({ token: 'fb-token' });
    expect(auth.AuthRequest.instances[0]!.config).toEqual(expect.objectContaining({ redirectUri: 'fb999://authorize', responseType: 'token' }));
    expect(auth.__promptAsync).toHaveBeenCalledWith(facebookDiscovery);
  });

  test('cancel or missing token returns null', async () => {
    auth.__promptAsync.mockResolvedValueOnce({ type: 'dismiss' });
    await expect(getProviderToken('facebook', config)).resolves.toBeNull();
    auth.__promptAsync.mockResolvedValueOnce({ type: 'success', params: {} });
    await expect(getProviderToken('facebook', config)).resolves.toBeNull();
  });
});

describe('apple', () => {
  test('returns the identity token with the nonce', async () => {
    jest.mocked(AppleAuthentication.signInAsync).mockResolvedValue({ identityToken: 'apple-token' } as never);

    await expect(getProviderToken('apple', config)).resolves.toEqual({ token: 'apple-token', nonce: 'test-nonce' });
    expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith(expect.objectContaining({ nonce: 'test-nonce' }));
  });

  test('cancel returns null, other failures are reported', async () => {
    jest.mocked(AppleAuthentication.signInAsync).mockRejectedValueOnce({ code: 'ERR_REQUEST_CANCELED' });
    await expect(getProviderToken('apple', config)).resolves.toBeNull();

    jest.mocked(AppleAuthentication.signInAsync).mockResolvedValueOnce({ identityToken: null } as never);
    await expect(getProviderToken('apple', config)).rejects.toBeInstanceOf(ValidationError);

    jest.mocked(AppleAuthentication.signInAsync).mockRejectedValueOnce(new Error('apple down'));
    await expect(getProviderToken('apple', config)).rejects.toThrow('apple down');
  });
});
