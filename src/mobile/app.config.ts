/**
 * Dynamic Expo configuration layered on top of app.json.
 *
 * Over-the-air updates are served by EAS Update and need the EAS project id, which is created once with
 * `npx eas-cli init` and passed as EAS_PROJECT_ID (locally in .env.local, in CI as a secret). Without it the app
 * still builds and runs – automatic updates are simply disabled (e.g. for local development).
 */
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EAS_PROJECT_ID;

  return {
    ...(config as ExpoConfig),
    extra: {
      ...config.extra,
      // Base URL of the Wattly API baked into the build (overridable at runtime with EXPO_PUBLIC_API_URL).
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? config.extra?.apiUrl,
      ...(projectId ? { eas: { projectId } } : {}),
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
