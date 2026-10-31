/**
 * Dynamic Expo configuration layered on top of app.json.
 *
 * Values come from EAS environment variables (expo.dev → project → Environment variables), which are available
 * both to EAS Build (via the `environment` of the build profile in eas.json) and to `eas update --environment`:
 * - EXPO_PUBLIC_API_URL – public address of the Wattly API;
 * - EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID – Google Sign-In;
 * - EXPO_PUBLIC_MICROSOFT_CLIENT_ID – Microsoft (Entra ID);
 * - EXPO_PUBLIC_FACEBOOK_APP_ID – Facebook Login;
 * - EXPO_PUBLIC_APPLE_SIGN_IN=true – Sign in with Apple (iOS).
 * All of them are public identifiers, not secrets. Unset values disable the corresponding feature.
 *
 * Over-the-air updates are served by EAS Update; the project id is stored in app.json (`extra.eas.projectId`)
 * and can be overridden with EAS_PROJECT_ID, e.g. for a fork.
 */
import type { ConfigContext, ExpoConfig } from 'expo/config';

/** Reads an environment variable; CI passes unset variables as empty strings, which count as missing. */
const env = (name: string): string | undefined => process.env[name]?.trim() || undefined;

/**
 * iOS URL scheme of a Google client ID ("123-abc.apps.googleusercontent.com" → "com.googleusercontent.apps.123-abc").
 * Kept in sync with googleIosUrlScheme() in src/auth/social/config.ts (this file runs in Node and cannot import app code).
 */
const googleIosUrlScheme = (clientId?: string) => {
  const match = /^(.+)\.apps\.googleusercontent\.com$/.exec(clientId ?? '');
  return match ? `com.googleusercontent.apps.${match[1]}` : undefined;
};

export default ({ config }: ConfigContext): ExpoConfig => {
  // `||` instead of `??`: unset CI values are empty strings.
  const projectId: string | undefined = env('EAS_PROJECT_ID') || config.extra?.eas?.projectId;

  const auth = {
    googleWebClientId: env('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'),
    googleIosClientId: env('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'),
    microsoftClientId: env('EXPO_PUBLIC_MICROSOFT_CLIENT_ID'),
    facebookAppId: env('EXPO_PUBLIC_FACEBOOK_APP_ID'),
    appleEnabled: env('EXPO_PUBLIC_APPLE_SIGN_IN') === 'true',
  };
  const googleScheme = googleIosUrlScheme(auth.googleIosClientId);

  // Native configuration is added only for configured providers, so builds without them stay unchanged.
  const plugins: ExpoConfig['plugins'] = [
    ...(config.plugins ?? []),
    ...(googleScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme: googleScheme }] as [string, unknown]] : []),
    ...(auth.appleEnabled ? ['expo-apple-authentication'] : []),
  ];

  // Facebook Login redirects back to the app with fb<APP_ID>://authorize.
  const baseScheme = typeof config.scheme === 'string' ? [config.scheme] : config.scheme ?? [];
  const scheme = auth.facebookAppId ? [...baseScheme, `fb${auth.facebookAppId}`] : baseScheme;

  return {
    ...(config as ExpoConfig),
    scheme,
    plugins,
    ios: { ...config.ios, ...(auth.appleEnabled ? { usesAppleSignIn: true } : {}) },
    extra: {
      ...config.extra,
      // Base URL of the Wattly API baked into the build (overridable at runtime with EXPO_PUBLIC_API_URL).
      apiUrl: env('EXPO_PUBLIC_API_URL') || config.extra?.apiUrl,
      auth,
      ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}),
    },
    updates: projectId
      ? {
          url: `https://u.expo.dev/${projectId}`,
          enabled: true,
          // Check on every cold start but never block the launch: the update is applied on the next start
          // or when the user taps "Uruchom ponownie" in the in-app banner.
          checkAutomatically: 'ON_LOAD',
          fallbackToCacheTimeout: 0,
        }
      : { enabled: false },
  };
};
