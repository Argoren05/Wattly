import { Redirect } from 'expo-router';

import { useAuth } from '../auth/AuthContext';
import { ErrorState, Loading, Screen } from '../components/ui';
import { useProperty } from '../state/PropertyContext';

/** Entry gate: sign-in → onboarding (no property yet) → main tabs. */
export default function Index() {
  const { isReady, isSignedIn } = useAuth();
  const { properties, isLoading, error, refetch } = useProperty();

  if (!isReady) return <Loading />;
  if (!isSignedIn) return <Redirect href="/login" />;
  if (isLoading) return <Loading label="Wczytywanie nieruchomości…" />;
  if (error) return <Screen scroll={false}><ErrorState error={error} onRetry={refetch} /></Screen>;
  if (properties.length === 0) return <Redirect href="/onboarding" />;
  return <Redirect href="/(app)/(tabs)" />;
}
