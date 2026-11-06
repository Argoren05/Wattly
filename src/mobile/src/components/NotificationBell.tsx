import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useNotificationLog } from '../reminders/useNotificationLog';
import { spacing, useTheme } from '../theme/theme';

/** Header button opening the notification history, with the number of unread notifications. */
export function NotificationBell() {
  const { colors } = useTheme();
  const { unread } = useNotificationLog();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={unread > 0 ? `Powiadomienia, nieprzeczytane: ${unread}` : 'Powiadomienia'}
      hitSlop={8} onPress={() => router.push('/notifications')} style={{ paddingHorizontal: spacing.md }}>
      <Ionicons name={unread > 0 ? 'notifications' : 'notifications-outline'} size={24} color={colors.text} />
      {unread > 0 ? (
        <View style={{ position: 'absolute', right: spacing.sm, top: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
          backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
