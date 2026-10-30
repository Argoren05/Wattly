import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { errorMessage } from '../../../api/errors';
import { readingApi } from '../../../api/endpoints';
import { ReadingForm } from '../../../components/ReadingForm';
import { Body, Button, Card, ErrorState, Field, KeyValue, Loading, Notice, Screen, SectionTitle } from '../../../components/ui';
import { importRegisters, keys, useInvalidateEnergyData, useMeters } from '../../../hooks/queries';
import { useRequiredProperty } from '../../../state/PropertyContext';
import { formatDateTime, formatKwh } from '../../../utils/format';

/** Polish labels of reading states. */
const statusLabel = { Active: 'Aktywny', Superseded: 'Zastąpiony korektą', Voided: 'Anulowany' } as const;

/** Reading details with correction (keeps history) and cancellation. */
export default function ReadingDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const property = useRequiredProperty();
  const meters = useMeters(property.id);
  const invalidate = useInvalidateEnergyData();
  const reading = useQuery({ queryKey: keys.reading(id), queryFn: () => readingApi.get(id) });
  const [mode, setMode] = useState<'view' | 'correct' | 'void'>('view');
  const [reason, setReason] = useState('');

  const voidMutation = useMutation({
    mutationFn: () => readingApi.void(id, reason.trim() || null),
    onSuccess: async () => {
      await invalidate(property.id);
      router.back();
    },
  });

  if (reading.isLoading || meters.isLoading) return <Loading />;
  if (reading.error || !reading.data) return <Screen><ErrorState error={reading.error} onRetry={() => reading.refetch()} /></Screen>;
  const r = reading.data;
  const register = importRegisters(meters.data).find((x) => x.id === r.registerId);

  return (
    <Screen>
      <Card>
        <KeyValue label="Rejestr" value={register ? `${register.meterName}: ${register.name}` : '–'} />
        <KeyValue label="Wskazanie" value={formatKwh(r.value)} />
        <KeyValue label="Data" value={formatDateTime(r.readingAt)} />
        <KeyValue label="Zużycie od poprzedniego odczytu" value={formatKwh(r.consumptionSincePrevious)} />
        <KeyValue label="Status" value={statusLabel[r.status]} />
        <KeyValue label="Dodano" value={formatDateTime(r.createdAt)} />
        {r.note ? <Body muted>Notatka: {r.note}</Body> : null}
        {r.voidReason ? <Body muted>Powód anulowania: {r.voidReason}</Body> : null}
        {r.supersedesReadingId ? <Body muted>To jest korekta wcześniejszego odczytu – oryginał pozostaje w historii.</Body> : null}
      </Card>

      {r.status === 'Active' && mode === 'view' ? (
        <>
          <Button title="Skoryguj odczyt" icon="create-outline" variant="secondary" onPress={() => setMode('correct')} />
          <Button title="Anuluj odczyt" icon="close-circle-outline" variant="danger" onPress={() => setMode('void')} />
        </>
      ) : null}

      {mode === 'correct' && register ? (
        <Card>
          <SectionTitle>Korekta</SectionTitle>
          <Body muted>Oryginalny odczyt zostanie zachowany w historii jako zastąpiony.</Body>
          <ReadingForm
            registers={[register]}
            initial={{ readingAt: new Date(r.readingAt), value: r.value, note: r.note }}
            submitLabel="Zapisz korektę"
            save={(_, request) => readingApi.correct(r.id, request)}
            onSaved={async () => {
              await invalidate(property.id);
              router.back();
            }}
          />
        </Card>
      ) : null}

      {mode === 'void' ? (
        <Card>
          <Field label="Powód (opcjonalnie)" value={reason} onChangeText={setReason} maxLength={500} />
          {voidMutation.error ? <Notice tone="danger">{errorMessage(voidMutation.error)}</Notice> : null}
          <Button title="Potwierdź anulowanie" variant="danger" onPress={() => voidMutation.mutate()} loading={voidMutation.isPending} />
          <Button title="Wróć" variant="ghost" onPress={() => setMode('view')} />
        </Card>
      ) : null}
    </Screen>
  );
}
