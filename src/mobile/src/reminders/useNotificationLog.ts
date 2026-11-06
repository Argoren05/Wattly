import { useQuery } from '@tanstack/react-query';

import { loadLog } from './center';

/** Query key of the notification history. */
export const NOTIFICATIONS_QUERY = ['notifications'] as const;

/** Notification history (newest first) and the number of unread entries. */
export function useNotificationLog() {
  const query = useQuery({ queryKey: NOTIFICATIONS_QUERY, queryFn: () => loadLog() });
  const unread = query.data?.filter((e) => !e.read).length ?? 0;
  return { ...query, unread };
}
