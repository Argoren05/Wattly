import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { loadReminderSettings, rescheduleReminders } from './reminders';

// Reminders arriving while the app is open are shown as a normal banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/**
 * Root-level effects of reading reminders:
 * - tapping a reminder opens the screen stored in its `url` (adding a reading);
 * - on start the reminders are re-planned (keeps the next weeks covered without opening Settings).
 */
export function useReminderLinks() {
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === 'string') router.push(url as Href);
  }, [response]);

  useEffect(() => {
    void loadReminderSettings()
      .then((s) => (s.frequency === 'off' ? 0 : rescheduleReminders()))
      .catch(() => undefined);
  }, []);
}
