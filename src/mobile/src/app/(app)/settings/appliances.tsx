import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { applianceApi } from '../../../api/endpoints';
import { errorMessage } from '../../../api/errors';
import type { Appliance } from '../../../api/types';
import { Body, Button, Card, EmptyState, ErrorState, Field, Loading, Notice, PasswordField, Screen, SectionTitle } from '../../../components/ui';
import { keys } from '../../../hooks/queries';
import { useRequiredProperty } from '../../../state/PropertyContext';
import { TapoError, tapoErrorMessage } from '../../../tapo/client';
import { linkPlug, loadAccount, loadPlugs, loadSyncState, saveAccount, syncAll } from '../../../tapo/sync';
import { spacing, useTheme } from '../../../theme/theme';
import { formatDate, formatDateTime } from '../../../utils/format';

/** Local Tapo configuration (account, plug addresses, last sync) – kept on the phone only. */
const TAPO_QUERY = ['tapo', 'local'] as const;

/** Simple IPv4 check for the plug address. */
const isIpv4 = (value: string) => /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(value.trim())
  && value.trim().split('.').every((p) => Number(p) <= 255);

/** Row of the appliance list. */
function ApplianceRow({ appliance, host }: { appliance: Appliance; host?: string }) {
  const { colors } = useTheme();
  const source = appliance.source === 'Tapo' ? `Tapo ${appliance.model ?? ''}${host ? ` · ${host}` : ' · brak adresu na tym telefonie'}` : 'Wpisywane ręcznie';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${appliance.name}, ${source}`}
      onPress={() => router.push({ pathname: '/settings/appliance', params: { id: appliance.id } })}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={appliance.source === 'Tapo' ? 'flash-outline' : 'create-outline'} size={22} color={appliance.isHidden ? colors.textMuted : colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: appliance.isHidden ? colors.textMuted : colors.text, fontWeight: '600', fontSize: 16 }}>
          {appliance.name}{appliance.isHidden ? ' (ukryte)' : ''}
        </Text>
        <Text style={{ color: colors.textMuted }}>{source}</Text>
        <Text style={{ color: colors.textMuted }}>Dane do: {appliance.lastUsageDate ? formatDate(appliance.lastUsageDate) : 'brak'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

/**
 * Appliances of the property: Tapo account and plugs (read directly in the home Wi-Fi), manually entered
 * appliances (e.g. a fridge reporting consumption in its own app) and synchronisation (DEC-034).
 */
export default function AppliancesSettings() {
  const property = useRequiredProperty();
  const queryClient = useQueryClient();
  const appliances = useQuery({ queryKey: keys.appliances(property.id), queryFn: () => applianceApi.list(property.id) });
  const local = useQuery({
    queryKey: TAPO_QUERY,
    queryFn: async () => {
      const [account, plugs, lastSync] = await Promise.all([loadAccount(), loadPlugs(), loadSyncState()]);
      return { email: account?.email ?? null, plugs, lastSync };
    },
  });
  const [form, setForm] = useState<'none' | 'account' | 'tapo' | 'manual'>('none');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [host, setHost] = useState('');
  const [name, setName] = useState('');
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: TAPO_QUERY }),
    queryClient.invalidateQueries({ queryKey: keys.appliancesAll }),
  ]);

  const saveAccountMutation = useMutation({
    mutationFn: (remove: boolean) => saveAccount(remove ? null : { email, password }),
    onSuccess: async () => {
      setForm('none');
      setPassword('');
      await refresh();
    },
  });
  const addPlug = useMutation({
    mutationFn: async () => {
      const account = await loadAccount();
      if (!account) throw new Error('Najpierw zapisz konto Tapo.');
      return linkPlug(property.id, host, account);
    },
    onSuccess: async () => {
      setForm('none');
      setHost('');
      await refresh();
      void syncAll().then(refresh);
    },
  });
  const addManual = useMutation({
    mutationFn: () => applianceApi.create(property.id, { name: name.trim(), source: 'Manual' }),
    onSuccess: async (appliance) => {
      setForm('none');
      setName('');
      await refresh();
      router.push({ pathname: '/settings/appliance', params: { id: appliance.id } });
    },
  });
  const sync = useMutation({ mutationFn: () => syncAll(), onSuccess: refresh });

  if (appliances.isLoading || local.isLoading) return <Loading />;
  if (appliances.error) return <Screen><ErrorState error={appliances.error} onRetry={() => appliances.refetch()} /></Screen>;
  const list = appliances.data ?? [];
  const plugs = local.data?.plugs ?? {};
  const lastSync = sync.data ?? local.data?.lastSync ?? null;
  const nameOf = (id: string) => list.find((a) => a.id === id)?.name ?? 'Usunięte urządzenie';

  return (
    <Screen>
      <Body muted>
        Zużycie poszczególnych sprzętów pokazuje, na co schodzi prąd. Gniazdka Tapo P110/P115 są odczytywane
        bezpośrednio przez telefon w domowej sieci Wi-Fi; inne urządzenia (np. lodówkę z własną aplikacją) wpisujesz ręcznie.
      </Body>

      <Card>
        <SectionTitle>Urządzenia</SectionTitle>
        {list.length === 0
          ? <EmptyState icon="hardware-chip-outline" title="Brak urządzeń" description="Dodaj gniazdko Tapo albo urządzenie wpisywane ręcznie." />
          : list.map((a) => <ApplianceRow key={a.id} appliance={a} host={plugs[a.id]?.host} />)}
      </Card>

      {form === 'tapo' ? (
        <Card>
          <SectionTitle>Dodaj gniazdko Tapo</SectionTitle>
          <Field label="Adres IP gniazdka" value={host} onChangeText={setHost} keyboardType="numbers-and-punctuation" autoCapitalize="none"
            placeholder="192.168.1.50" hint="Znajdziesz go w aplikacji Tapo: gniazdko → ⚙ → Informacje o urządzeniu. Ustaw w routerze stały adres (rezerwacja DHCP)."
            error={host && !isIpv4(host) ? 'Wpisz adres w postaci 192.168.1.50.' : undefined} />
          {addPlug.error ? <Notice tone="danger">{addPlug.error instanceof TapoError ? tapoErrorMessage(addPlug.error) : errorMessage(addPlug.error)}</Notice> : null}
          <Button title="Połącz i dodaj" icon="link-outline" disabled={!isIpv4(host)} loading={addPlug.isPending} onPress={() => addPlug.mutate()} />
          <Button title="Anuluj" variant="ghost" onPress={() => setForm('none')} />
        </Card>
      ) : form === 'manual' ? (
        <Card>
          <SectionTitle>Dodaj urządzenie ręcznie</SectionTitle>
          <Field label="Nazwa" value={name} onChangeText={setName} placeholder="np. Lodówka" maxLength={100} />
          {addManual.error ? <Notice tone="danger">{errorMessage(addManual.error)}</Notice> : null}
          <Button title="Dodaj" disabled={!name.trim()} loading={addManual.isPending} onPress={() => addManual.mutate()} />
          <Button title="Anuluj" variant="ghost" onPress={() => setForm('none')} />
        </Card>
      ) : (
        <Card>
          <Button title="Dodaj gniazdko Tapo" icon="flash-outline" variant="secondary" disabled={!local.data?.email}
            accessibilityHint={local.data?.email ? undefined : 'Najpierw zapisz konto Tapo'} onPress={() => setForm('tapo')} />
          <Button title="Dodaj urządzenie ręcznie" icon="create-outline" variant="secondary" onPress={() => setForm('manual')} />
        </Card>
      )}

      <Card>
        <SectionTitle>Konto Tapo</SectionTitle>
        {form === 'account' ? (
          <>
            <Field label="E-mail konta Tapo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <PasswordField label="Hasło konta Tapo" value={password} onChangeText={setPassword} />
            <Body muted>Hasło jest zapisywane w bezpiecznym magazynie tego telefonu i nigdy nie trafia na serwer Wattly. Gniazdka sprawdzają je przy każdym połączeniu.</Body>
            {saveAccountMutation.error ? <Notice tone="danger">{errorMessage(saveAccountMutation.error)}</Notice> : null}
            <Button title="Zapisz konto" disabled={!email.trim() || !password} loading={saveAccountMutation.isPending} onPress={() => saveAccountMutation.mutate(false)} />
            <Button title="Anuluj" variant="ghost" onPress={() => setForm('none')} />
          </>
        ) : local.data?.email ? (
          <>
            <Body>{local.data.email}</Body>
            <Button title="Zmień" variant="secondary" icon="create-outline" onPress={() => { setEmail(local.data?.email ?? ''); setForm('account'); }} />
            <Button title="Usuń z telefonu" variant="ghost" onPress={() => saveAccountMutation.mutate(true)} />
          </>
        ) : (
          <>
            <Body muted>Gniazdka Tapo wymagają danych konta, na które są zarejestrowane w aplikacji Tapo.</Body>
            <Button title="Podaj konto Tapo" icon="key-outline" onPress={() => setForm('account')} />
          </>
        )}
      </Card>

      {Object.keys(plugs).length > 0 ? (
        <Card>
          <SectionTitle>Synchronizacja</SectionTitle>
          <Body muted>Aplikacja odczytuje gniazdka sama po otwarciu (co najwyżej co 6 godzin), gdy telefon jest w domowej sieci. Gniazdka pamiętają historię z bieżącego i poprzedniego kwartału, więc przerwy niczego nie gubią.</Body>
          {lastSync ? (
            <>
              <Body>Ostatnio: {formatDateTime(lastSync.at)}</Body>
              {lastSync.results.map((r) => (
                <Notice key={r.applianceId} tone={r.ok ? 'info' : 'warning'} title={nameOf(r.applianceId)}>
                  {r.ok ? `Zapisano ${r.days} dni.` : r.error ?? 'Błąd'}
                </Notice>
              ))}
            </>
          ) : null}
          {sync.error ? <Notice tone="danger">{errorMessage(sync.error)}</Notice> : null}
          <Button title="Synchronizuj teraz" icon="sync-outline" loading={sync.isPending} onPress={() => sync.mutate()} />
        </Card>
      ) : null}
    </Screen>
  );
}
