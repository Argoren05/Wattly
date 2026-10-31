/**
 * Dynamic Expo configuration layered on top of app.json.
 *
 * Over-the-air updates are served by EAS Update and need the EAS project id. It is stored in app.json
 * (`extra.eas.projectId` – not a secret) and can be overridden with EAS_PROJECT_ID, e.g. for a fork.
 */
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  // `||` instead of `??`: CI passes unset secrets/variables as empty strings.
  const projectId: string | undefined = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId;

  return {
    ...(config as ExpoConfig),
    extra: {
      ...config.extra,
      // Base URL of the Wattly API baked into the build (overridable at runtime with EXPO_PUBLIC_API_URL).
      apiUrl: process.env.EXPO_PUBLIC_API_URL || config.extra?.apiUrl,
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
