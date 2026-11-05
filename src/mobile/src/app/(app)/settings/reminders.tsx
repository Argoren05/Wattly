import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Switch, Text, View } from 'react-native';

import { confirmAsync } from '../../../components/confirm';
import { Body, Button, Card, Chips, Loading, Notice, Screen, SectionTitle } from '../../../components/ui';
import { loadPrefs, loadReminders, savePrefs, saveReminders, type PermissionState } from '../../../reminders/center';
import type { NotificationPrefs } from '../../../reminders/planner';
import { describeReminders, MAX_REMINDERS, type Reminder } from '../../../reminders/schedule';
import { spacing, useTheme } from '../../../theme/theme';

/** Query key of the notification settings (reminders + kinds). */
export const NOTIFICATION_SETTINGS_QUERY = ['notificationSettings'] as const;

/** Settings → Powiadomienia: list of reading reminders and the other kinds of notifications. */
export default function NotificationSettings() {
  const settings = useQuery({
    queryKey: NOTIFICATION_SETTINGS_QUERY,
    queryFn: async () => ({ reminders: await loadReminders(), prefs: await loadPrefs() }),
  });
  if (settings.isLoading || !settings.data) return <Loading />;
  return <NotificationSettingsForm reminders={settings.data.reminders} prefs={settings.data.prefs} />;
}

/** Row with a label and a switch. */
function SwitchRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>{label}</Text>
        {hint ? <Text style={{ color: colors.textMuted }}>{hint}</Text> : null}
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} />
    </View>
  );
}

/** The form: changes are saved immediately. */
function NotificationSettingsForm({ reminders, prefs }: { reminders: Reminder[]; prefs: NotificationPrefs }) {
  const queryClient = useQueryClient();
  const [permission, setPermission] = useState<PermissionState>('granted');

  const after = async (result: PermissionState) => {
    setPermission(result);
    await queryClient.invalidateQueries({ queryKey: NOTIFICATION_SETTINGS_QUERY });
  };
  const saveList = useMutation({ mutationFn: saveReminders, onSuccess: after });
  const saveKinds = useMutation({ mutationFn: savePrefs, onSuccess: after });

  /** Enables/disables one reminder. */
  const toggle = (id: string, enabled: boolean) => saveList.mutate(reminders.map((r) => (r.id === id ? { ...r, enabled } : r)));
  /** Deletes a reminder after confirmation. */
  const remove = async (reminder: Reminder) => {
    if (await confirmAsync('Usunąć przypomnienie?', describeReminders(reminder), 'Usuń', { destructive: true })) {
      saveList.mutate(reminders.filter((r) => r.id !== reminder.id));
    }
  };
  const updatePrefs = (patch: Partial<NotificationPrefs>) => saveKinds.mutate({ ...prefs, ...patch });

  return (
    <Screen>
      {permission !== 'granted' ? (
        <Notice tone="warning">
          {permission === 'blocked'
            ? 'Powiadomienia dla Wattly są wyłączone w ustawieniach telefonu – włącz je, aby je dostawać.'
            : 'Bez zgody na powiadomienia nie będą wyświetlane (zostaną tylko w historii).'}
        </Notice>
      ) : null}
      {permission === 'blocked' ? <Button title="Otwórz ustawienia telefonu" variant="secondary" icon="settings-outline" onPress={() => void Linking.openSettings()} /> : null}

      <Card>
        <SectionTitle>Przypomnienia o odczycie</SectionTitle>
        {reminders.length === 0 ? <Body muted>Brak przypomnień. Dodaj np. codzienne o 22:00 albo comiesięczne przed fakturą.</Body> : null}
        {reminders.map((reminder) => (
          <View key={reminder.id} style={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
            <SwitchRow label={reminder.label.trim() || 'Odczyt licznika'} hint={describeReminders(reminder)} value={reminder.enabled}
              onChange={(enabled) => toggle(reminder.id, enabled)} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button title="Edytuj" variant="secondary" icon="create-outline"
                  onPress={() => router.push({ pathname: '/settings/reminder', params: { id: reminder.id } })} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Usuń" variant="danger" icon="trash-outline" onPress={() => void remove(reminder)} />
              </View>
            </View>
          </View>
        ))}
        {reminders.length < MAX_REMINDERS ? (
          <Button title="Dodaj przypomnienie" icon="add-circle-outline" onPress={() => router.push({ pathname: '/settings/reminder', params: { id: 'new' } })} />
        ) : <Body muted>Osiągnięto limit {MAX_REMINDERS} przypomnień.</Body>}
      </Card>

      <Card>
        <SectionTitle>Inne powiadomienia</SectionTitle>
        <SwitchRow label="Termin płatności faktury" hint="Dla faktur z wpisanym terminem płatności." value={prefs.payments}
          onChange={(payments) => updatePrefs({ payments })} />
        {prefs.payments ? (
          <Chips label="Przypomnij" value={String(prefs.paymentDaysBefore)} onChange={(d) => updatePrefs({ paymentDaysBefore: Number(d) })}
            options={[{ value: '0', label: 'W dniu terminu' }, { value: '1', label: '1 dzień przed' }, { value: '3', label: '3 dni przed' }, { value: '7', label: '7 dni przed' }]} />
        ) : null}
        <SwitchRow label="Prognoza przekracza budżet" hint="Raz na okres rozliczeniowy, gdy ustawiony jest budżet." value={prefs.budget}
          onChange={(budget) => updatePrefs({ budget })} />
        <SwitchRow label="Nietypowo duże zużycie" hint="Po odczycie z wyraźnie większym zużyciem niż zwykle." value={prefs.usage}
          onChange={(usage) => updatePrefs({ usage })} />
        <Body muted>Powiadomienia działają na tym telefonie, także bez internetu. Alerty o budżecie i zużyciu pojawiają się po otwarciu aplikacji lub dodaniu odczytu.</Body>
      </Card>

      <Button title="Historia powiadomień" variant="ghost" icon="notifications-outline" onPress={() => router.push('/notifications')} />
    </Screen>
  );
}
