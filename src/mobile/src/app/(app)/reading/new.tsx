import { router, useLocalSearchParams } from 'expo-router';

import { readingApi } from '../../../api/endpoints';
import { ReadingForm } from '../../../components/ReadingForm';
import { EmptyState, ErrorState, Loading, Screen } from '../../../components/ui';
import { importRegisters, useInvalidateEnergyData, useMeters } from '../../../hooks/queries';
import { recordReadingForReminders } from '../../../reminders/reminders';
import { useRequiredProperty } from '../../../state/PropertyContext';

/** Modal adding a reading; an optional `registerId` route param preselects the register. */
export default function NewReading() {
  const property = useRequiredProperty();
  const { registerId } = useLocalSearchParams<{ registerId?: string }>();
  const meters = useMeters(property.id);
  const invalidate = useInvalidateEnergyData();

  if (meters.isLoading) return <Loading />;
  if (meters.error) return <Screen><ErrorState error={meters.error} onRetry={() => meters.refetch()} /></Screen>;
  const registers = importRegisters(meters.data);
  if (registers.length === 0) return <Screen><EmptyState icon="speedometer-outline" title="Brak licznika" description="Najpierw dodaj licznik w ustawieniach." /></Screen>;

  return (
    <Screen>
      <ReadingForm
        registers={registers}
        initialRegisterId={registerId}
        submitLabel="Zapisz odczyt"
        save={(id, request) => readingApi.create(id, request)}
        onSaved={async (saved) => {
          // Today's reminder is no longer needed once a reading for today is saved.
          void recordReadingForReminders(new Date(saved.reading.readingAt));
          await invalidate(property.id);
          router.back();
        }}
      />
    </Screen>
  );
}
