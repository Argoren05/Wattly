import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { keys } from '../hooks/queries';
import { autoSync } from './sync';

/**
 * Synchronises Tapo plugs when the app starts and whenever it returns to the foreground,
 * at most every few hours ({@link autoSync}); refreshes appliance data after a run. Errors are silent –
 * outside the home Wi-Fi the plugs are simply unreachable and the next run catches up.
 */
export function useTapoAutoSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const run = () => void autoSync().then((state) => {
      if (state) return queryClient.invalidateQueries({ queryKey: keys.appliancesAll });
    });
    run();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => subscription.remove();
  }, [queryClient]);
}
