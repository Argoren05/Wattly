import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { errorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { SocialSignIn } from '../components/SocialSignIn';
import { Body, Button, Card, Field, Notice, Screen, Title } from '../components/ui';
import { spacing, useTheme } from '../theme/theme';

/** Sign-in screen. */
export default function Login() {
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Validates input and signs in; wrong credentials get a generic message (no account enumeration). */
  async function submit() {
    if (!email.trim() || !password) {
      setError('Podaj e-mail i hasło.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (e) {
      setError(errorMessage(e).includes('błąd') ? errorMessage(e) : 'Nieprawidłowy e-mail lub hasło.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ gap: spacing.sm, marginTop: spacing.xxl }}>
          <Text style={{ fontSize: 40, fontWeight: '900', color: colors.primary }}>Wattly</Text>
          <Title>Monitoruj zużycie. Kontroluj koszty. Przewiduj rachunki.</Title>
        </View>
        <Card>
          <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
          <Field label="Hasło" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Button title="Zaloguj się" onPress={submit} loading={busy} />
          <SocialSignIn />
        </Card>
        <Body muted style={{ textAlign: 'center' }}>
          Nie masz konta? <Link href="/register" style={{ color: colors.primary, fontWeight: '700' }}>Załóż konto</Link>
        </Body>
      </Screen>
    </KeyboardAvoidingView>
  );
}
