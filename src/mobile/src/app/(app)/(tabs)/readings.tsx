import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { readingApi } from '../../../api/endpoints';
import type { Reading } from '../../../api/types';
import { Button, Card, Chips, EmptyState, ErrorState, Loading, Screen } from '../../../components/ui';
import { importRegisters, keys, useMeters } from '../../../hooks/queries';
import { useRequiredProperty } from '../../../state/PropertyContext';
import { spacing, useTheme } from '../../../theme/theme';
import { formatDateTime, formatKwh } from '../../../utils/format';

const sourceLabel: Record<Reading['source'], string> = { Manual: 'Ręczny', Ocr: 'OCR', Import: 'Import', Integration: 'Integracja' };
const statusLabel: Record<Reading['status'], string> = { Active: '', Superseded: 'Skorygowany', Voided: 'Anulowany' };

export default function Readings() {
  const property = useRequiredProperty();
  const { colors } = useTheme();
  const meters = useMeters(property.id);
  const registers = importRegisters(meters.data);
  const [registerId, setRegisterId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const activeRegister = registers.find((r) => r.id === registerId) ?? registers[0];

  const readings = useQuery({
    queryKey: [...keys.readings(activeRegister?.id ?? ''), showHistory],
    queryFn: () => readingApi.list(activeRegister!.id, 1, showHistory),
    enabled: !!activeRegister,
  });

  if (meters.isLoading) return <Loading />;
  if (meters.error) return <Screen><ErrorState error={meters.error} onRetry={() => meters.refetch()} /></Screen>;
  if (!activeRegister) {
    return (
      <Screen>
        <EmptyState icon="speedometer-outline" title="Brak licznika" description="Dodaj licznik w ustawieniach, aby wprowadzać odczyty."
          action={<Button title="Ustawienia liczników" variant="secondary" onPress={() => router.push('/settings/meters')} />} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={readings.isRefetching} onRefresh={() => readings.refetch()}>
      <Button title="Dodaj odczyt" icon="add-circle-outline" onPress={() => router.push({ pathname: '/reading/new', params: { registerId: activeRegister.id } })} />
      {registers.length > 1 ? (
        <Chips value={activeRegister.id} onChange={setRegisterId} options={registers.map((r) => ({ value: r.id, label: `${r.name}` }))} />
      ) : null}
      <Chips value={showHistory ? 'all' : 'active'} onChange={(v) => setShowHistory(v === 'all')}
        options={[{ value: 'active', label: 'Aktualne' }, { value: 'all', label: 'Z historią zmian' }]} />

      {readings.isLoading ? <Loading /> : readings.error ? <ErrorState error={readings.error} onRetry={() => readings.refetch()} /> :
        readings.data?.items.length === 0 ? (
          <EmptyState icon="list-outline" title="Brak odczytów" description="Dodaj pierwszy odczyt tego rejestru." />
        ) : (
          <Card style={{ padding: 0, gap: 0 }}>
            {readings.data?.items.map((r, i) => (
              <Pressable
                key={r.id}
                onPress={() => router.push({ pathname: '/reading/[id]', params: { id: r.id } })}
                accessibilityRole="button"
                accessibilityLabel={`Odczyt ${formatKwh(r.value)} z ${formatDateTime(r.readingAt)}`}
                style={({ pressed }) => ({
                  padding: spacing.lg, gap: 2, opacity: pressed ? 0.7 : r.status === 'Active' ? 1 : 0.6,
                  borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border,
                })}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, textDecorationLine: r.status === 'Active' ? 'none' : 'line-through' }}>
                    {formatKwh(r.value)}
                  </Text>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>
                    {r.consumptionSincePrevious !== null ? `+${formatKwh(r.consumptionSincePrevious)}` : ''}
                  </Text>
                </View>
                <Text style={{ color: colors.textMuted }}>
                  {formatDateTime(r.readingAt)} · {sourceLabel[r.source]}
                  {r.daysSincePrevious !== null ? ` · ${r.daysSincePrevious.toLocaleString('pl-PL')} dni` : ''}
                  {r.supersedesReadingId ? ' · korekta' : ''}
                  {statusLabel[r.status] ? ` · ${statusLabel[r.status]}` : ''}
                </Text>
              </Pressable>
            ))}
          </Card>
        )}
    </Screen>
  );
}
