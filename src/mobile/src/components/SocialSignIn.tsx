/**
 * Sign-in buttons for Google, Microsoft, Facebook and Apple. Only providers configured in the build are shown;
 * without any configured provider the component renders nothing.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { ApiError, errorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { availableProviders, providerLabels, readSocialConfig, type SocialAuthConfig, type SocialProvider } from '../auth/social/config';
import { getProviderToken, type ProviderToken } from '../auth/social/providers';
import { radius, spacing, useTheme } from '../theme/theme';
import { Notice } from './ui';

/** Brand icon of each provider. */
const icons: Record<SocialProvider, ComponentProps<typeof Ionicons>['name']> = {
  apple: 'logo-apple',
  google: 'logo-google',
  microsoft: 'logo-microsoft',
  facebook: 'logo-facebook',
};

/** Dependencies replaceable in tests. */
export interface SocialSignInProps {
  /** Client identifiers (default: from the build configuration). */
  config?: SocialAuthConfig;
  /** Platform (default: the device platform). */
  platform?: string;
  /** Obtains the provider token (default: native/browser sign-in). */
  getToken?: (provider: SocialProvider, config: SocialAuthConfig) => Promise<ProviderToken | null>;
}

/**
 * "Kontynuuj z …" buttons followed by sign-in to Wattly. Cancelling the provider UI is silent;
 * errors are shown below the buttons.
 */
export function SocialSignIn({ config = readSocialConfig(), platform = Platform.OS, getToken = getProviderToken }: SocialSignInProps) {
  const { colors } = useTheme();
  const { signInExternal } = useAuth();
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const providers = availableProviders(config, platform);

  if (providers.length === 0) return null;

  /** Runs the provider sign-in, then exchanges the token for a Wattly session. */
  async function signIn(provider: SocialProvider) {
    setBusy(provider);
    setError(null);
    try {
      const result = await getToken(provider, config);
      if (!result) return;
      await signInExternal(provider, result.token, result.nonce);
      router.replace('/');
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'external.email_in_use'
        ? 'Konto z tym adresem e-mail już istnieje. Zaloguj się e-mailem i hasłem.'
        : errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }} accessible={false}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={{ color: colors.textMuted }}>lub</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>
      {providers.map((provider) => (
        <Pressable
          key={provider}
          accessibilityRole="button"
          accessibilityLabel={providerLabels[provider]}
          accessibilityState={{ disabled: busy !== null, busy: busy === provider }}
          disabled={busy !== null}
          onPress={() => void signIn(provider)}
          style={({ pressed }) => ({
            minHeight: 48,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            opacity: busy !== null && busy !== provider ? 0.5 : pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name={icons[provider]} size={20} color={colors.text} />
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
            {busy === provider ? 'Logowanie…' : providerLabels[provider]}
          </Text>
        </Pressable>
      ))}
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </View>
  );
}
