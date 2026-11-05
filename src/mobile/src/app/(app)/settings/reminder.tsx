import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Switch, Text, View } from 'react-native';

import { DateField } from '../../../components/DateField';
import { Body, Button, Card, Chips, Field, Loading, Notice, Screen } from '../../../components/ui';
import { loadReminders, saveReminders } from '../../../reminders/center';
import { DEFAULT_REMINDERS, describeReminders, weekdayLabel, type Reminder, type ReminderFrequency } from '../../../reminders/schedule';
import { spacing, useTheme } from '../../../theme/theme';
import { NOTIFICATION_SETTINGS_QUERY } from './reminders';

/** Frequencies of a reminder. */
const FREQUENCIES: { value: ReminderFrequency; label: string }[] = [
  { value: 'daily', label: 'Codziennie' },
  { value: 'weekly', label: 'Co tydzień' },
  { value: 'monthly', label: 'Co miesiąc' },
];

/** Adds (`id=new`) or edits one reading reminder. */
export default function ReminderEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const list = useQuery({ queryKey: [...NOTIFICATION_SETTINGS_QUERY, 'reminders'], queryFn: loadReminders });
  if (list.isLoading || !list.data) return <Loading />;
  const existing = list.data.find((r) => r.id === id);
  const initial: Reminder = existing ?? { ...DEFAULT_REMINDERS, frequency: 'daily', id: '', label: '', enabled: true };
  return <ReminderForm all={list.data} initial={initial} isNew={!existing} />;
}

/** Form of one reminder. */
function ReminderForm({ all, initial, isNew }: { all: Reminder[]; initial: Reminder; isNew: boolean }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [reminder, setReminder] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  /** Changes the form and hides the previous error. */
  const update = (patch: Partial<Reminder>) => {
    setError(null);
    setReminder((r) => ({ ...r, ...patch }));
  };

  const save = useMutation({
    mutationFn: async () => {
      const day = Number(reminder.dayOfMonth);
      if (reminder.frequency === 'daily' && reminder.weekdays.length === 0) throw new Error('Wybierz co najmniej jeden dzień tygodnia.');
      if (reminder.frequency === 'monthly' && !(Number.isInteger(day) && day >= 1 && day <= 28)) throw new Error('Dzień miesiąca musi być z zakresu 1–28.');
      // A new reminder gets its id when it is saved (ids only need to be unique on this phone).
      const next = isNew ? [...all, { ...reminder, id: `r${Date.now()}` }] : all.map((r) => (r.id === reminder.id ? reminder : r));
      return saveReminders(next);
    },
    onSuccess: async (permission) => {
      await queryClient.invalidateQueries({ queryKey: NOTIFICATION_SETTINGS_QUERY });
      if (permission === 'granted') return router.back();
      setBlocked(permission === 'blocked');
      setError(permission === 'blocked'
        ? 'Powiadomienia dla Wattly są wyłączone w ustawieniach telefonu. Przypomnienie zapisano – włącz powiadomienia, aby je dostawać.'
        : 'Przypomnienie zapisano, ale bez zgody na powiadomienia nie będzie wyświetlane.');
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Nie udało się zapisać przypomnienia.'),
  });

  /** Adds or removes a day of week. */
  const toggleDay = (day: number) =>
    update({ weekdays: reminder.weekdays.includes(day) ? reminder.weekdays.filter((d) => d !== day) : [...reminder.weekdays, day].sort() });

  return (
    <Screen>
      <Card>
        <Chips<ReminderFrequency> label="Jak często" value={reminder.frequency} onChange={(frequency) => update({ frequency })} options={FREQUENCIES} />
        <DateField label="Godzina" mode="time" value={reminder.time} onChange={(time) => update({ time })} />

        {reminder.frequency === 'daily' ? (
          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Dni tygodnia</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const selected = reminder.weekdays.includes(day);
                return (
                  <Pressable key={day} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={weekdayLabel(day)}
                    onPress={() => toggleDay(day)}
                    style={{ minWidth: 44, minHeight: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
                      borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surface }}>
                    <Text style={{ color: selected ? colors.primaryText : colors.text, fontWeight: '600' }}>{weekdayLabel(day)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {reminder.frequency === 'weekly' ? (
          <Chips label="Dzień tygodnia" value={String(reminder.weekday)} onChange={(d) => update({ weekday: Number(d) })}
            options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: String(d), label: weekdayLabel(d) }))} />
        ) : null}

        {reminder.frequency === 'monthly' ? (
          <Field label="Dzień miesiąca (1–28)" value={String(reminder.dayOfMonth || '')} keyboardType="number-pad" maxLength={2}
            onChangeText={(t) => update({ dayOfMonth: Number(t.replace(/\D/g, '')) || 0 })} />
        ) : null}

        <Field label="Własna treść (opcjonalnie)" value={reminder.label} onChangeText={(label) => update({ label })} maxLength={80}
          placeholder="np. Spisz licznik do faktury" />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Text style={{ flex: 1, color: colors.text }}>Pomiń, jeśli tego dnia dodano już odczyt</Text>
          <Switch accessibilityLabel="Pomiń, jeśli tego dnia dodano już odczyt" value={reminder.skipWhenRead}
            onValueChange={(skipWhenRead) => update({ skipWhenRead })} />
        </View>
        <Body muted>{describeReminders(reminder)}. Android może opóźnić powiadomienie o kilka minut, aby oszczędzać baterię.</Body>

        {error ? <Notice tone="warning">{error}</Notice> : null}
        {blocked ? <Button title="Otwórz ustawienia telefonu" variant="secondary" icon="settings-outline" onPress={() => void Linking.openSettings()} /> : null}
        <Button title={isNew ? 'Dodaj przypomnienie' : 'Zapisz'} onPress={() => save.mutate()} loading={save.isPending} />
      </Card>
    </Screen>
  );
}
