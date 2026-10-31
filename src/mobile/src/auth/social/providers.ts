/**
 * Obtains provider tokens on the device. Each function opens the provider's sign-in UI and returns the token
 * that the Wattly API verifies (ID token, or access token for Facebook), or null when the user cancels.
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';

import { ValidationError } from '../../api/errors';
import type { SocialAuthConfig, SocialProvider } from './config';

// Completes a pending browser sign-in when the app is reopened from the redirect (needed on web, harmless elsewhere).
WebBrowser.maybeCompleteAuthSession();

/** Token returned by a provider. */
export interface ProviderToken {
  /** Token for POST /auth/external. */
  token: string;
  /** Nonce sent to the provider (the API checks that the token carries it). */
  nonce?: string;
}

/** Microsoft identity platform endpoints (multi-tenant: personal, work and school accounts). */
export const microsoftDiscovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
};

/** Facebook Login dialog (unversioned endpoint: always the oldest Graph API version still supported for the app). */
export const facebookDiscovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://www.facebook.com/dialog/oauth',
};

/** Random value binding the provider token to this sign-in attempt (replay protection). */
function createNonce(): string {
  return Crypto.randomUUID();
}

/**
 * Google: native Google Sign-In SDK (account picker of the device). The ID token's audience is the web client ID.
 * @param config Client identifiers.
 */
export async function signInWithGoogle(config: SocialAuthConfig): Promise<ProviderToken | null> {
  GoogleSignin.configure({ webClientId: config.googleWebClientId, iosClientId: config.googleIosClientId });
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    if (!response.data.idToken) throw new ValidationError('Google nie zwrócił tokenu logowania. Sprawdź konfigurację klienta Google.');
    return { token: response.data.idToken };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return null;
    if (isErrorWithCode(error) && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new ValidationError('Usługi Google Play są niedostępne na tym urządzeniu.');
    }
    throw error;
  }
}

/**
 * Microsoft: OpenID Connect authorization code flow with PKCE in the system browser; the code is exchanged
 * on the device (public client, no secret) for an ID token.
 * @param config Client identifiers.
 */
export async function signInWithMicrosoft(config: SocialAuthConfig): Promise<ProviderToken | null> {
  const clientId = config.microsoftClientId!;
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'wattly', path: 'auth' });
  const nonce = createNonce();
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    usePKCE: true,
    extraParams: { nonce, prompt: 'select_account' },
  });

  const result = await request.promptAsync(microsoftDiscovery);
  if (result.type !== 'success') return null;

  const tokens = await AuthSession.exchangeCodeAsync(
    { clientId, code: result.params.code ?? '', redirectUri, extraParams: { code_verifier: request.codeVerifier ?? '' } },
    microsoftDiscovery,
  );
  if (!tokens.idToken) throw new ValidationError('Microsoft nie zwrócił tokenu logowania.');
  return { token: tokens.idToken, nonce };
}

/**
 * Facebook: Facebook Login dialog in the system browser returning a user access token, which the API verifies
 * with the Graph API (including that it was issued for our app).
 * @param config Client identifiers.
 */
export async function signInWithFacebook(config: SocialAuthConfig): Promise<ProviderToken | null> {
  const appId = config.facebookAppId!;
  const request = new AuthSession.AuthRequest({
    clientId: appId,
    redirectUri: `fb${appId}://authorize`,
    responseType: AuthSession.ResponseType.Token,
    scopes: ['public_profile', 'email'],
    usePKCE: false,
  });

  const result = await request.promptAsync(facebookDiscovery);
  if (result.type !== 'success' || !result.params.access_token) return null;
  return { token: result.params.access_token };
}

/** Apple: native Sign in with Apple sheet (iOS). */
export async function signInWithApple(): Promise<ProviderToken | null> {
  const nonce = createNonce();
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce,
    });
    if (!credential.identityToken) throw new ValidationError('Apple nie zwrócił tokenu logowania.');
    return { token: credential.identityToken, nonce };
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw error;
  }
}

/**
 * Runs the sign-in UI of a provider.
 * @param provider Provider chosen by the user.
 * @param config Client identifiers.
 * @returns Provider token, or null when the user cancelled.
 */
export function getProviderToken(provider: SocialProvider, config: SocialAuthConfig): Promise<ProviderToken | null> {
  switch (provider) {
    case 'google':
      return signInWithGoogle(config);
    case 'microsoft':
      return signInWithMicrosoft(config);
    case 'facebook':
      return signInWithFacebook(config);
    case 'apple':
      return signInWithApple();
  }
}
