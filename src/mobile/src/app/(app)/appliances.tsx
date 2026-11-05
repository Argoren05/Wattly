import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { applianceApi } from '../../api/endpoints';
import type { ApplianceBreakdown, BreakdownItem } from '../../api/types';
import { Body, Button, Card, Chips, EmptyState, ErrorState, EstimateBadge, Loading, Notice, Screen, SectionTitle } from '../../components/ui';
import { keys } from '../../hooks/queries';
import { useRequiredProperty } from '../../state/PropertyContext';
import { radius, spacing, useTheme } from '../../theme/theme';
import { addDays, formatDate, formatKwh, formatMoney, formatPercent, toIsoDate } from '../../utils/format';

/** Selectable ranges; all end yesterday, because today's data are still incomplete. */
type RangeName = 'days30' | 'lastMonth' | 'days90';

/**
 * First and last day of a range.
 * @param name Range.
 * @param today Current day.
 */
export function rangeDates(name: RangeName, today: Date): [string, string] {
  const yesterday = addDays(today, -1);
  if (name === 'lastMonth') {
    return [toIsoDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)), toIsoDate(new Date(today.getFullYear(), today.getMonth(), 0))];
  }
  return [toIsoDate(addDays(yesterday, name === 'days30' ? -29 : -89)), toIsoDate(yesterday)];
}

/** One appliance (or "the rest") with a share bar. */
function ItemRow({ item, data, color }: { item: BreakdownItem; data: ApplianceBreakdown; color: string }) {
  const { colors } = useTheme();
  const share = item.sharePercent ?? 0;
  const partial = item.applianceId !== null && item.coveredDays < data.days;
  const details = [
    formatKwh(item.energyKwh, 1),
    item.costGross !== null ? `≈ ${formatMoney(item.costGross, data.currencyCode)}` : null,
    item.sharePercent !== null ? formatPercent(item.sharePercent) : null,
  ].filter(Boolean).join(' · ');
  return (
    <View style={{ gap: spacing.xs, paddingVertical: spacing.xs }} accessible accessibilityLabel={`${item.name}: ${details}${partial ? `, dane z ${item.coveredDays} z ${data.days} dni` : ''}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text style={{ color: colors.text, fontWeight: '600', flexShrink: 1 }}>{item.name}</Text>
        <Text style={{ color: colors.text }}>{details}</Text>
      </View>
      <View style={{ height: 8, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
        <View style={{ height: 8, width: `${Math.min(100, Math.max(0, share))}%`, backgroundColor: color }} />
      </View>
      {partial ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>Dane z {item.coveredDays} z {data.days} dni</Text> : null}
    </View>
  );
}

/**
 * "What uses the electricity": consumption of measured appliances against the meter for a range,
 * with the estimated cost at the average gross price per kWh of the tariff (DEC-034).
 */
export default function AppliancesBreakdown() {
  const property = useRequiredProperty();
  const { colors } = useTheme();
  const [today] = useState(() => new Date());
  const [range, setRange] = useState<RangeName>('days30');
  const [from, to] = rangeDates(range, today);
  const breakdown = useQuery({ queryKey: keys.applianceBreakdown(property.id, from, to), queryFn: () => applianceApi.breakdown(property.id, from, to) });
  const data = breakdown.data;

  return (
    <Screen refreshing={breakdown.isRefetching} onRefresh={() => void breakdown.refetch()}>
      <Chips value={range} onChange={setRange} options={[
        { value: 'days30', label: '30 dni' },
        { value: 'lastMonth', label: 'Poprzedni miesiąc' },
        { value: 'days90', label: '90 dni' },
      ]} />
      {breakdown.isLoading ? <Loading /> : breakdown.error ? <ErrorState error={breakdown.error} onRetry={() => breakdown.refetch()} /> : data ? (
        data.items.length === 0 ? (
          <EmptyState icon="hardware-chip-outline" title="Brak danych o urządzeniach"
            description="Dodaj gniazdko Tapo albo wpisz zużycie urządzenia, aby zobaczyć, na co schodzi prąd."
            action={<Button title="Urządzenia" icon="add-circle-outline" onPress={() => router.push('/settings/appliances')} />} />
        ) : (
          <>
            <Card>
              <SectionTitle>{formatDate(data.from)} – {formatDate(data.to)}</SectionTitle>
              {data.meterKwh !== null ? (
                <>
                  <Body>Licznik: {formatKwh(data.meterKwh, 1)}{data.pricePerKwhGross !== null ? ` · średnio ${formatMoney(data.pricePerKwhGross, data.currencyCode)}/kWh` : ''}</Body>
                  {data.meterIsEstimate ? <EstimateBadge label="Zużycie z licznika częściowo szacowane" /> : null}
                </>
              ) : (
                <Notice tone="warning">Brak odczytów licznika w tym okresie – widać tylko zużycie urządzeń, bez udziału i kosztu.</Notice>
              )}
              {data.items.map((item) => <ItemRow key={item.applianceId} item={item} data={data} color={colors.primary} />)}
              {data.other ? <ItemRow item={data.other} data={data} color={colors.textMuted} /> : null}
              {data.appliancesExceedMeter ? (
                <Notice tone="warning">Urządzenia zużyły więcej niż pokazuje licznik – sprawdź odczyty licznika i wpisy ręczne w tym okresie.</Notice>
              ) : null}
            </Card>
            <Body muted>
              Koszt urządzeń to szacunek: zużycie × średnia cena brutto 1 kWh z Twojej taryfy w tym okresie (bez opłat stałych).
              „Pozostałe” to różnica między licznikiem a zmierzonymi urządzeniami.
            </Body>
            <Button title="Zarządzaj urządzeniami" variant="secondary" icon="settings-outline" onPress={() => router.push('/settings/appliances')} />
          </>
        )
      ) : null}
    </Screen>
  );
}
