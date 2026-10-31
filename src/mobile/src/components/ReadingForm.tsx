import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { ApiError, errorMessage } from '../api/errors';
import { readingApi } from '../api/endpoints';
import type { ReadingRequest, ReadingSaved } from '../api/types';
import type { RegisterOption } from '../hooks/queries';
import { keys } from '../hooks/queries';
import { formatDateTime, formatKwh, parseDecimal, parseLocalDateTime, toLocalDateTimeText } from '../utils/format';
import { spacing } from '../theme/theme';
import { confirmAsync } from './confirm';
import { DateField } from './DateField';
import { Button, Card, Chips, Field, KeyValue, Notice } from './ui';

/**
 * Shared form for new readings and corrections. The preview compares the value with the readings right before and after
 * the chosen moment (so back-dated readings are checked correctly) and unusual values need confirmation.
 */
export function ReadingForm({ registers, initialRegisterId, initial, submitLabel, save, onSaved }: {
  registers: RegisterOption[];
  initialRegisterId?: string;
  initial?: { readingAt: Date; value: number; note: string | null };
  submitLabel: string;
  save: (registerId: string, request: ReadingRequest) => Promise<ReadingSaved>;
  onSaved: (saved: ReadingSaved) => void;
}) {
  const [registerId, setRegisterId] = useState(initialRegisterId ?? registers[0]?.id ?? '');
  const [when, setWhen] = useState(toLocalDateTimeText(initial?.readingAt ?? new Date()));
  const [value, setValue] = useState(initial ? String(initial.value).replace('.', ',') : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [errors, setErrors] = useState<{ when?: string; value?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const register = registers.find((r) => r.id === registerId);
  // Neighbours of the chosen moment: a back-dated reading is compared with the readings around it, not the newest one.
  const readingAtIso = parseLocalDateTime(when);
  const around = useQuery({
    queryKey: [...keys.readings(registerId), 'neighbors', readingAtIso],
    queryFn: () => readingApi.neighbors(registerId, readingAtIso!),
    enabled: !!registerId && !!readingAtIso && !initial,
  });
  const previous = around.data?.previous ?? null;
  const following = around.data?.next ?? null;
  const parsedValue = parseDecimal(value);
  const diff = previous && parsedValue !== null ? parsedValue - previous.value : null;
  const diffToNext = following && parsedValue !== null ? following.value - parsedValue : null;

  /** Validates input, saves and handles anomaly confirmation and server errors. */
  async function submit() {
    const readingAt = parseLocalDateTime(when);
    const next: typeof errors = {};
    if (!readingAt) next.when = 'Użyj formatu RRRR-MM-DD GG:MM.';
    if (parsedValue === null) next.value = 'Podaj wskazanie licznika.';
    else if (parsedValue < 0) next.value = 'Wskazanie nie może być ujemne.';
    setErrors(next);
    if (Object.keys(next).length > 0 || !readingAt || parsedValue === null) return;

    const request: ReadingRequest = { readingAt, value: parsedValue, source: 'Manual', note: note.trim() || null };
    setBusy(true);
    try {
      onSaved(await save(registerId, request));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'reading.anomaly_requires_confirmation') {
        if (await confirmAsync('Nietypowy odczyt', e.message.replace(/ Aby zapisać.*$/, ''), 'Zapisz mimo to', { cancelLabel: 'Popraw' })) {
          try {
            onSaved(await save(registerId, { ...request, confirmAnomaly: true }));
          } catch (e2) {
            setErrors({ form: errorMessage(e2) });
          }
        }
      } else if (e instanceof ApiError && e.status === 400) {
        setErrors({ value: e.field('Value'), when: e.field('ReadingAt'), form: e.field('Value') || e.field('ReadingAt') ? undefined : errorMessage(e) });
      } else {
        setErrors({ form: errorMessage(e) });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: spacing.md }}>
      {registers.length > 1 && !initial ? (
        <Chips label="Licznik i rejestr" value={registerId} onChange={setRegisterId}
          options={registers.map((r) => ({ value: r.id, label: `${r.meterName}: ${r.name}` }))} />
      ) : null}
      <DateField label="Data i godzina" mode="datetime" value={when} onChange={setWhen} error={errors.when} maximumDate={new Date()} />
      <Field
        label={`Wskazanie (${register?.unit ?? 'kWh'})`}
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
        error={errors.value}
        hint={register ? `Maks. ${register.decimalPlaces} miejsc po przecinku.` : undefined}
        autoFocus={!initial}
      />
      <Field label="Notatka (opcjonalnie)" value={note} onChangeText={setNote} maxLength={500} />

      {(previous || following) && !initial ? (
        <Card>
          {previous ? (
            <>
              <KeyValue label="Poprzedni odczyt" value={`${formatKwh(previous.value)} · ${formatDateTime(previous.readingAt)}`} />
              <KeyValue label="Zużycie od poprzedniego odczytu" value={diff === null ? '–' : formatKwh(diff)} />
            </>
          ) : null}
          {following ? (
            <>
              <KeyValue label="Następny odczyt" value={`${formatKwh(following.value)} · ${formatDateTime(following.readingAt)}`} />
              <KeyValue label="Zużycie do następnego odczytu" value={diffToNext === null ? '–' : formatKwh(diffToNext)} />
            </>
          ) : null}
          {diff !== null && diff < 0 ? <Notice tone="warning">Wskazanie jest niższe niż poprzedni odczyt.</Notice> : null}
          {diffToNext !== null && diffToNext < 0 ? <Notice tone="warning">Wskazanie jest wyższe niż następny odczyt.</Notice> : null}
        </Card>
      ) : null}

      {errors.form ? <Notice tone="danger">{errors.form}</Notice> : null}
      <Button title={submitLabel} icon="checkmark" onPress={submit} loading={busy} disabled={!registerId} />
    </View>
  );
}
