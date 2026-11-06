import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';

import { applianceApi } from '../../../api/endpoints';
import { errorMessage } from '../../../api/errors';
import type { Appliance } from '../../../api/types';
import { DateField } from '../../../components/DateField';
import { Body, Button, Card, ErrorState, Field, KeyValue, Loading, Notice, Screen, SectionTitle } from '../../../components/ui';
import { keys } from '../../../hooks/queries';
import { useRequiredProperty } from '../../../state/PropertyContext';
import { loadPlugs, savePlug } from '../../../tapo/sync';
import { spacing, useTheme } from '../../../theme/theme';
import { addDays, formatDate, formatKwh, parseDecimal, toIsoDate } from '../../../utils/format';

/** Number of entries shown before "Pokaż wszystkie". */
const VISIBLE_ENTRIES = 14;

/** Name, visibility and removal of an appliance. */
function ApplianceForm({ appliance }: { appliance: Appliance }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [name, setName] = useState(appliance.name);
  const [hidden, setHidden] = useState(appliance.isHidden);
  const save = useMutation({
    mutationFn: () => applianceApi.update(appliance.id, { name: name.trim(), source: appliance.source, externalId: appliance.externalId, model: appliance.model, isHidden: hidden }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.appliancesAll }),
  });
  const remove = useMutation({
    mutationFn: async () => {
      await applianceApi.remove(appliance.id);
      await savePlug(appliance.id, null);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.appliancesAll });
      router.back();
    },
  });
  const confirmRemove = () => Alert.alert('Usunąć urządzenie?', 'Zostanie usunięta też cała zapisana historia zużycia tego urządzenia.', [
    { text: 'Anuluj', style: 'cancel' },
    { text: 'Usuń', style: 'destructive', onPress: () => remove.mutate() },
  ]);

  return (
    <Card>
      <Field label="Nazwa" value={name} onChangeText={setName} maxLength={100} />
      {appliance.model ? <KeyValue label="Model" value={appliance.model} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Text style={{ color: colors.text, flex: 1 }}>Ukryj w zestawieniu „Na co schodzi prąd”</Text>
        <Switch accessibilityLabel="Ukryj w zestawieniu" value={hidden} onValueChange={setHidden} />
      </View>
      {save.error ? <Notice tone="danger">{errorMessage(save.error)}</Notice> : null}
      {save.isSuccess && !save.isPending ? <Body muted>Zapisano.</Body> : null}
      <Button title="Zapisz" disabled={!name.trim()} loading={save.isPending} onPress={() => save.mutate()} />
      {remove.error ? <Notice tone="danger">{errorMessage(remove.error)}</Notice> : null}
      <Button title="Usuń urządzenie" variant="danger" icon="trash-outline" loading={remove.isPending} onPress={confirmRemove} />
    </Card>
  );
}

/** IP address of a Tapo plug, stored on this phone. */
function PlugAddress({ applianceId }: { applianceId: string }) {
  const queryClient = useQueryClient();
  const plugs = useQuery({ queryKey: ['tapo', 'local', 'plugs'], queryFn: loadPlugs });
  const [host, setHost] = useState<string | null>(null);
  const current = plugs.data?.[applianceId]?.host ?? '';
  const save = useMutation({
    mutationFn: () => savePlug(applianceId, (host ?? current).trim() || null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tapo'] }),
  });
  return (
    <Card>
      <SectionTitle>Gniazdko Tapo</SectionTitle>
      <Field label="Adres IP gniazdka" value={host ?? current} onChangeText={setHost} keyboardType="numbers-and-punctuation" autoCapitalize="none"
        hint="Zapisany tylko na tym telefonie. Puste pole – telefon przestanie odczytywać to gniazdko." />
      <Button title="Zapisz adres" variant="secondary" loading={save.isPending} onPress={() => save.mutate()} />
    </Card>
  );
}

/**
 * Details of an appliance: name and visibility, plug address (Tapo) and consumption entries. Manual appliances
 * get a form for the consumption of a period, e.g. a month read from the fridge's own app.
 */
export default function ApplianceDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const property = useRequiredProperty();
  const queryClient = useQueryClient();
  const appliances = useQuery({ queryKey: keys.appliances(property.id), queryFn: () => applianceApi.list(property.id) });
  const usage = useQuery({ queryKey: keys.applianceUsage(id), queryFn: () => applianceApi.usage(id) });
  const [from, setFrom] = useState(() => toIsoDate(addDays(new Date(), -30)));
  const [to, setTo] = useState(() => toIsoDate(addDays(new Date(), -1)));
  const [kwh, setKwh] = useState('');
  const [showAll, setShowAll] = useState(false);
  const energy = parseDecimal(kwh);
  const refresh = () => queryClient.invalidateQueries({ queryKey: keys.appliancesAll });

  const add = useMutation({
    mutationFn: () => applianceApi.saveUsage(id, [{ periodStart: from, periodEnd: to, energyKwh: energy ?? 0 }]),
    onSuccess: async () => {
      setKwh('');
      await refresh();
    },
  });
  const removeEntry = useMutation({ mutationFn: (usageId: string) => applianceApi.removeUsage(id, usageId), onSuccess: refresh });

  if (appliances.isLoading || usage.isLoading) return <Loading />;
  const appliance = appliances.data?.find((a) => a.id === id);
  if (appliances.error || usage.error || !appliance) {
    return <Screen><ErrorState error={appliances.error ?? usage.error ?? new Error('Nie znaleziono urządzenia.')} onRetry={() => { void appliances.refetch(); void usage.refetch(); }} /></Screen>;
  }
  const entries = usage.data ?? [];
  const visible = showAll ? entries : entries.slice(0, VISIBLE_ENTRIES);
  const isTapo = appliance.source === 'Tapo';

  return (
    <Screen>
      <ApplianceForm key={appliance.id} appliance={appliance} />
      {isTapo ? <PlugAddress applianceId={appliance.id} /> : null}

      <Card>
        <SectionTitle>{isTapo ? 'Zużycie z gniazdka' : 'Dodaj zużycie'}</SectionTitle>
        {isTapo ? (
          <Body muted>Dni są dopisywane automatycznie przy synchronizacji. Możesz też dodać okres ręcznie, np. sprzed podłączenia gniazdka.</Body>
        ) : (
          <Body muted>Wpisz, ile urządzenie zużyło w danym okresie – np. raz w miesiącu z jego aplikacji (SmartThings, Home Connect itp.).</Body>
        )}
        <DateField label="Od" value={from} onChange={setFrom} maximumDate={new Date()} />
        <DateField label="Do (włącznie)" value={to} onChange={setTo} maximumDate={new Date()} />
        <Field label="Zużycie (kWh)" value={kwh} onChangeText={setKwh} keyboardType="decimal-pad" placeholder="np. 24,5"
          error={kwh && energy === null ? 'Wpisz liczbę, np. 24,5.' : undefined} />
        {to < from ? <Notice tone="warning">Data „Do” nie może być wcześniejsza niż „Od”.</Notice> : null}
        {add.error ? <Notice tone="danger">{errorMessage(add.error)}</Notice> : null}
        <Button title="Zapisz zużycie" disabled={energy === null || energy < 0 || to < from} loading={add.isPending} onPress={() => add.mutate()} />
      </Card>

      <Card>
        <SectionTitle>Historia</SectionTitle>
        {entries.length === 0 ? <Body muted>Brak zapisanego zużycia.</Body> : visible.map((e) => (
          <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <KeyValue label={e.periodStart === e.periodEnd ? formatDate(e.periodStart) : `${formatDate(e.periodStart)} – ${formatDate(e.periodEnd)}`} value={formatKwh(e.energyKwh, 2)} />
            </View>
            {!isTapo ? <Button title="Usuń" variant="ghost" onPress={() => removeEntry.mutate(e.id)} /> : null}
          </View>
        ))}
        {removeEntry.error ? <Notice tone="danger">{errorMessage(removeEntry.error)}</Notice> : null}
        {entries.length > VISIBLE_ENTRIES && !showAll ? <Button title={`Pokaż wszystkie (${entries.length})`} variant="ghost" onPress={() => setShowAll(true)} /> : null}
      </Card>
    </Screen>
  );
}
