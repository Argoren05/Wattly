import { router } from 'expo-router';
import { useState } from 'react';

import { ApiError, errorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { Body, Button, Card, Field, Notice, Screen } from '../components/ui';

export default function Register() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Podaj prawidłowy adres e-mail.');
    if (password.length < 10) return setError('Hasło musi mieć co najmniej 10 znaków.');
    if (password !== confirm) return setError('Hasła nie są identyczne.');

    setBusy(true);
    setError(null);
    try {
      await signUp(email, password);
      router.replace('/');
    } catch (e) {
      // Identity returns errors keyed by codes such as "DuplicateEmail" or "PasswordRequiresUpper".
      setError(e instanceof ApiError && Object.keys(e.fieldErrors).some((k) => k.includes('Duplicate'))
        ? 'Konto z tym adresem już istnieje.'
        : e instanceof ApiError && Object.keys(e.fieldErrors).some((k) => k.startsWith('Password'))
          ? 'Hasło musi zawierać małą i wielką literę oraz cyfrę.'
          : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Hasło" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" hint="Min. 10 znaków, mała i wielka litera oraz cyfra." />
        <Field label="Powtórz hasło" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button title="Załóż konto" onPress={submit} loading={busy} />
      </Card>
      <Body muted>
        Wattly służy do szacowania kosztów energii. Wyniki nie zastępują faktury sprzedawcy.
      </Body>
    </Screen>
  );
}
