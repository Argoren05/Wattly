import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Switch, Text, View } from 'react-native';

import { DateField } from '../../../components/DateField';
import { Body, Button, Card, Chips, Field, Loading, Notice, Screen, SectionTitle } from '../../../components/ui';
import { loadReminderSettings, saveReminderSettings } from '../../../reminders/reminders';
import { describeReminders, weekdayLabel, type ReminderFrequency, type ReminderSettings } from '../../../reminders/schedule';
import { spacing, useTheme } from '../../../theme/theme';

/** Frequencies offered in the form. */
const FREQUENCIES: { value: ReminderFrequency; label: string }[] = [
  { value: 'off', label: 'Wyłączone' },
  { value: 'daily', label: 'Codziennie' },
  { value: 'weekly', label: 'Co tydzień' },
  { value: 'monthly', label: 'Co miesiąc' },
];

/** Loads the saved settings, then shows the form. */
export default function RemindersSettings() {
  const saved = useQuery({ queryKey: ['reminders'], queryFn: loadReminderSettings });
  if (saved.isLoading || !saved.data) return <Loading />;
  return <RemindersForm initial={saved.data} />;
}

/** Reading reminders: frequency, time, days and skipping days with a reading. Kept on this phone. */
function RemindersForm({ initial }: { initial: ReminderSettings }) {
  const { colors } = useTheme();
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  /** Changes settings and hides the previous error. */
  const update = (patch: Partial<ReminderSettings>) => {
    setError(null);
    setSettings((s) => ({ ...s, ...patch }));
  };

  const save = useMutation({
    mutationFn: async () => {
      const day = Number(settings.dayOfMonth);
      if (settings.frequency === 'daily' && settings.weekdays.length === 0) throw new Error('Wybierz co najmniej jeden dzień tygodnia.');
      if (settings.frequency === 'monthly' && !(Number.isInteger(day) && day >= 1 && day <= 28)) throw new Error('Dzień miesiąca musi być z zakresu 1–28.');
      return saveReminderSettings(settings);
    },
    onSuccess: (permission) => {
      if (permission === 'granted') return router.back();
      setBlocked(permission === 'blocked');
      setError(permission === 'blocked'
        ? 'Powiadomienia dla Wattly są wyłączone w ustawieniach telefonu. Włącz je, aby dostawać przypomnienia.'
        : 'Bez zgody na powiadomienia przypomnienia nie będą wyświetlane.');
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Nie udało się zapisać przypomnień.'),
  });

  /** Adds or removes a day of week of daily reminders. */
  const toggleDay = (day: number) =>
    update({ weekdays: settings.weekdays.includes(day) ? settings.weekdays.filter((d) => d !== day) : [...settings.weekdays, day].sort() });

  return (
    <Screen>
      <Card>
        <SectionTitle>Przypomnienie o odczycie</SectionTitle>
        <Body muted>Telefon przypomni Ci o spisaniu licznika. Dotknięcie powiadomienia otwiera dodawanie odczytu.</Body>
        <Chips<ReminderFrequency> label="Jak często" value={settings.frequency} onChange={(frequency) => update({ frequency })} options={FREQUENCIES} />

        {settings.frequency !== 'off' ? (
          <>
            <DateField label="Godzina" mode="time" value={settings.time} onChange={(time) => update({ time })} />

            {settings.frequency === 'daily' ? (
              <View style={{ gap: spacing.xs }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Dni tygodnia</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                    const selected = settings.weekdays.includes(day);
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

            {settings.frequency === 'weekly' ? (
              <Chips label="Dzień tygodnia" value={String(settings.weekday)} onChange={(d) => update({ weekday: Number(d) })}
                options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: String(d), label: weekdayLabel(d) }))} />
            ) : null}

            {settings.frequency === 'monthly' ? (
              <Field label="Dzień miesiąca (1–28)" value={String(settings.dayOfMonth || '')} keyboardType="number-pad" maxLength={2}
                onChangeText={(t) => update({ dayOfMonth: Number(t.replace(/\D/g, '')) || 0 })} />
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Text style={{ flex: 1, color: colors.text }}>Pomiń, jeśli tego dnia dodano już odczyt</Text>
              <Switch accessibilityLabel="Pomiń, jeśli tego dnia dodano już odczyt" value={settings.skipWhenRead}
                onValueChange={(skipWhenRead) => update({ skipWhenRead })} />
            </View>
            <Body muted>{describeReminders(settings)}. Przypomnienia działają na tym telefonie, także bez internetu; Android może je opóźnić o kilka minut, aby oszczędzać baterię.</Body>
          </>
        ) : null}

        {error ? <Notice tone="warning">{error}</Notice> : null}
        {blocked ? <Button title="Otwórz ustawienia telefonu" variant="secondary" icon="settings-outline" onPress={() => void Linking.openSettings()} /> : null}
        <Button title="Zapisz" onPress={() => save.mutate()} loading={save.isPending} />
      </Card>
    </Screen>
  );
}
