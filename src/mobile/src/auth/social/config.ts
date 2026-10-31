/**
 * Configuration of sign-in with external providers.
 *
 * Client identifiers are public values (not secrets). They are provided at build time through EAS environment
 * variables (EXPO_PUBLIC_*), copied into `extra.auth` by app.config.ts. A provider whose identifiers are missing
 * is simply not offered, so the app never shows a button that cannot work.
 */
import Constants from 'expo-constants';

/** Providers supported by the Wattly API. */
export type SocialProvider = 'google' | 'microsoft' | 'facebook' | 'apple';

/** Client identifiers of the providers. */
export interface SocialAuthConfig {
  /** Google OAuth "Web application" client ID – the audience of ID tokens verified by the API. */
  googleWebClientId?: string;
  /** Google OAuth iOS client ID (required on iOS only). */
  googleIosClientId?: string;
  /** Microsoft Entra application (client) ID. */
  microsoftClientId?: string;
  /** Meta (Facebook) application ID. */
  facebookAppId?: string;
  /** Whether Sign in with Apple is enabled (iOS only). */
  appleEnabled?: boolean;
}

/** Display order of the buttons. */
const ORDER: SocialProvider[] = ['apple', 'google', 'microsoft', 'facebook'];

/**
 * Reads the configuration baked into the bundle. EXPO_PUBLIC_* variables are inlined by the bundler on every
 * platform (also into OTA updates); they must be accessed literally (process.env.EXPO_PUBLIC_NAME) for that to work.
 * `extra.auth` from app config is a fallback (e.g. when a value is set only in app.config.ts).
 */
export function readSocialConfig(): SocialAuthConfig {
  const extra = (Constants.expoConfig?.extra?.auth as SocialAuthConfig | undefined) ?? {};
  return {
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || extra.googleWebClientId,
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || extra.googleIosClientId,
    microsoftClientId: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID || extra.microsoftClientId,
    facebookAppId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || extra.facebookAppId,
    appleEnabled: process.env.EXPO_PUBLIC_APPLE_SIGN_IN === 'true' || extra.appleEnabled === true,
  };
}

/**
 * Providers that can be offered on this device.
 * @param config Client identifiers.
 * @param platform React Native platform (`ios`, `android`, `web`).
 */
export function availableProviders(config: SocialAuthConfig, platform: string): SocialProvider[] {
  const enabled: Record<SocialProvider, boolean> = {
    apple: platform === 'ios' && config.appleEnabled === true,
    // Google Sign-In is a native SDK: Android needs the web client ID, iOS additionally its own client ID.
    google: platform !== 'web' && !!config.googleWebClientId && (platform !== 'ios' || !!config.googleIosClientId),
    microsoft: !!config.microsoftClientId,
    facebook: !!config.facebookAppId,
  };
  return ORDER.filter((provider) => enabled[provider]);
}

/**
 * iOS URL scheme of the Google client: "123-abc.apps.googleusercontent.com" → "com.googleusercontent.apps.123-abc".
 * @param iosClientId Google iOS client ID.
 * @returns The scheme, or undefined for an empty or malformed ID.
 */
export function googleIosUrlScheme(iosClientId: string | undefined): string | undefined {
  const match = /^(.+)\.apps\.googleusercontent\.com$/.exec(iosClientId?.trim() ?? '');
  return match ? `com.googleusercontent.apps.${match[1]}` : undefined;
}

/** Labels of the sign-in buttons. */
export const providerLabels: Record<SocialProvider, string> = {
  apple: 'Kontynuuj z Apple',
  google: 'Kontynuuj z Google',
  microsoft: 'Kontynuuj z Microsoft',
  facebook: 'Kontynuuj z Facebookiem',
};
