import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError } from '../api/errors';
import { AuthProvider } from '../auth/AuthContext';
import { PropertyProvider } from '../state/PropertyContext';
import { UpdateGate } from '../components/UpdateBanner';
import { UpdateProvider } from '../updates/UpdateContext';
import { useTheme } from '../theme/theme';

/** Root of the app: query cache, session, selected property, automatic updates and navigation. */
export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
          },
        },
      }),
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PropertyProvider>
            <UpdateProvider>
              <UpdateGate>
                <Navigator />
              </UpdateGate>
            </UpdateProvider>
          </PropertyProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/** Top-level stack navigator with theme-aware headers. */
function Navigator() {
  const { colors, dark } = useTheme();
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.background },
          headerBackTitle: 'Wstecz',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'Logowanie', headerShown: false }} />
        <Stack.Screen name="register" options={{ title: 'Załóż konto' }} />
        <Stack.Screen name="onboarding" options={{ title: 'Konfiguracja', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
