import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { confirmAsync } from '../../components/confirm';
import { Button, Card, EmptyState, Loading, Screen } from '../../components/ui';
import { clearLog, markRead, type LogEntry } from '../../reminders/center';
import type { NotificationKind } from '../../reminders/planner';
import { NOTIFICATIONS_QUERY, useNotificationLog } from '../../reminders/useNotificationLog';
import { spacing, useTheme } from '../../theme/theme';
import { formatDateTime } from '../../utils/format';

/** Icon of each kind of notification. */
const ICONS: Record<NotificationKind, ComponentProps<typeof Ionicons>['name']> = {
  reading: 'speedometer-outline',
  payment: 'card-outline',
  budget: 'wallet-outline',
  usage: 'trending-up-outline',
};

/** History of notifications shown by the app (kept on this phone, at most 100). */
export default function NotificationHistory() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const log = useNotificationLog();
  const refresh = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY });
  const read = useMutation({ mutationFn: markRead, onSuccess: refresh });
  const clear = useMutation({
    mutationFn: async () => {
      if (await confirmAsync('Wyczyścić historię?', 'Zostaną usunięte wszystkie wpisy historii powiadomień na tym telefonie.', 'Wyczyść', { destructive: true })) await clearLog();
    },
    onSuccess: refresh,
  });

  if (log.isLoading) return <Loading />;
  const entries = log.data ?? [];
  if (entries.length === 0) {
    return <Screen><EmptyState icon="notifications-off-outline" title="Brak powiadomień" description="Tu pojawią się przypomnienia o odczycie, terminach płatności i alerty." /></Screen>;
  }

  /** Opens the screen of an entry and marks it read. */
  const open = (entry: LogEntry) => {
    read.mutate(entry.id);
    if (entry.url) router.push(entry.url as Href);
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button title="Oznacz jako przeczytane" variant="secondary" icon="checkmark-done-outline" disabled={log.unread === 0} onPress={() => read.mutate(undefined)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Wyczyść" variant="ghost" icon="trash-outline" onPress={() => clear.mutate()} />
        </View>
      </View>
      <Card>
        {entries.map((entry) => (
          <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={`${entry.read ? '' : 'Nieprzeczytane: '}${entry.title}`}
            onPress={() => open(entry)} style={({ pressed }) => ({ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm, opacity: pressed ? 0.7 : 1 })}>
            <Ionicons name={ICONS[entry.kind]} size={22} color={entry.read ? colors.textMuted : colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.text, fontWeight: entry.read ? '400' : '700' }}>{entry.title}</Text>
              <Text style={{ color: colors.textMuted }}>{entry.body}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{formatDateTime(entry.at)}</Text>
            </View>
            {entry.read ? null : <View accessibilityElementsHidden style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 }} />}
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}
