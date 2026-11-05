import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { deliverDue, markRead, rescheduleAll } from './center';
import { NOTIFICATIONS_QUERY } from './useNotificationLog';

// Notifications arriving while the app is open are shown as a normal banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }),
});

/**
 * Root-level effects of the notification centre:
 * - tapping a notification marks it read in the history and opens its screen;
 * - on start notifications are re-planned (keeps the next weeks covered);
 * - when the app returns to the foreground, notifications shown meanwhile move to the history.
 */
export function useReminderLinks() {
  const response = Notifications.useLastNotificationResponse();
  const queryClient = useQueryClient();

  useEffect(() => {
    const request = response?.notification.request;
    if (!request) return;
    const url = request.content.data?.url;
    void markRead(request.identifier).then(() => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY })).catch(() => undefined);
    if (typeof url === 'string') router.push(url as Href);
  }, [response, queryClient]);

  useEffect(() => {
    void rescheduleAll().then(() => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY })).catch(() => undefined);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void deliverDue().then(() => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY })).catch(() => undefined);
    });
    return () => subscription.remove();
  }, [queryClient]);
}
