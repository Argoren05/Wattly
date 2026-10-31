import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../auth/AuthContext';
import { ErrorState, Loading, Screen } from '../../components/ui';
import { useProperty } from '../../state/PropertyContext';
import { useTheme } from '../../theme/theme';

/**
 * Guard for every screen that needs a signed-in user and a selected property.
 * Handles deep links and web refreshes, where these screens can be opened before data is loaded.
 */
export default function AppLayout() {
  const { colors } = useTheme();
  const { isReady, isSignedIn } = useAuth();
  const { property, isLoading, error, refetch } = useProperty();

  if (!isReady) return <Loading />;
  if (!isSignedIn) return <Redirect href="/login" />;
  if (isLoading) return <Loading label="Wczytywanie nieruchomości…" />;
  if (error) return <Screen scroll={false}><ErrorState error={error} onRetry={refetch} /></Screen>;
  if (!property) return <Redirect href="/onboarding" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: 'Wstecz',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="reading/new" options={{ title: 'Dodaj odczyt', presentation: 'modal' }} />
      <Stack.Screen name="reading/[id]" options={{ title: 'Odczyt' }} />
      <Stack.Screen name="invoice/new" options={{ title: 'Dodaj fakturę', presentation: 'modal' }} />
      <Stack.Screen name="invoice/[id]" options={{ title: 'Faktura' }} />
      <Stack.Screen name="breakdown" options={{ title: 'Rozbicie kosztów' }} />
      <Stack.Screen name="settings/property" options={{ title: 'Nieruchomość' }} />
      <Stack.Screen name="settings/contract" options={{ title: 'Umowa i taryfa' }} />
      <Stack.Screen name="settings/rates" options={{ title: 'Stawki' }} />
      <Stack.Screen name="settings/meters" options={{ title: 'Liczniki' }} />
    </Stack>
  );
}
