import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { analyticsApi } from '../../../api/endpoints';
import { BarChart } from '../../../components/BarChart';
import { Body, Button, Card, EmptyState, ErrorState, Loading, Notice, Row, Screen, SectionTitle, Stat } from '../../../components/ui';
import { keys } from '../../../hooks/queries';
import { useRequiredProperty } from '../../../state/PropertyContext';
import { spacing, useTheme } from '../../../theme/theme';
import { addDays, formatDate, formatDateTime, formatKwh, formatMoney, formatPercent, toIsoDate } from '../../../utils/format';

export default function Dashboard() {
  const property = useRequiredProperty();
  const { colors } = useTheme();
  const [showAssumptions, setShowAssumptions] = useState(false);

  const forecast = useQuery({ queryKey: keys.forecast(property.id), queryFn: () => analyticsApi.forecast(property.id) });
  const today = new Date();
  const from = toIsoDate(addDays(today, -29));
  const to = toIsoDate(today);
  const series = useQuery({
    queryKey: [...keys.series(property.id), 'dashboard', from],
    queryFn: () => analyticsApi.consumption(property.id, from, to, 'Day'),
  });

  if (forecast.isLoading) return <Loading />;
  if (forecast.error || !forecast.data) return <Screen><ErrorState error={forecast.error} onRetry={() => forecast.refetch()} /></Screen>;

  const f = forecast.data;
  const refresh = () => {
    void forecast.refetch();
    void series.refetch();
  };
  const addReading = <Button title="Dodaj odczyt" icon="add-circle-outline" onPress={() => router.push('/reading/new')} />;

  if (f.readingsCount === 0) {
    return (
      <Screen>
        <EmptyState icon="speedometer-outline" title="Brak odczytów" description="Dodaj pierwszy odczyt licznika, aby zobaczyć zużycie i prognozę rachunku." action={addReading} />
      </Screen>
    );
  }

  // A single reading gives no consumption yet – show "–" instead of a misleading 0.
  const insufficient = !f.isComplete && f.forecastConsumptionKwh === 0;
  const money = (value: number) => (insufficient ? '–' : formatMoney(value, f.currencyCode));
  const hasChartData = series.data?.points.some((p) => p.consumptionKwh !== null) ?? false;
  const budgetTone = f.budgetUsagePercent !== null && f.budgetUsagePercent > 100 ? 'danger' : 'warning';

  return (
    <Screen refreshing={forecast.isRefetching} onRefresh={refresh}>
      {!f.hasContract ? (
        <Notice tone="warning" title="Brak umowy" action={<Button title="Skonfiguruj umowę" variant="secondary" onPress={() => router.push('/settings/contract')} />}>
          Bez taryfy i umowy Wattly pokaże tylko zużycie, bez kosztów.
        </Notice>
      ) : !f.hasRatePlans ? (
        <Notice tone="warning" title="Brak stawek" action={<Button title="Wprowadź stawki" variant="secondary" onPress={() => router.push('/settings/rates')} />}>
          Uzupełnij stawki z faktury, aby szacować koszty.
        </Notice>
      ) : null}
      {insufficient && f.hasContract ? (
        <Notice title="Potrzebny kolejny odczyt">
          Zużycie i prognozę wyliczymy po dodaniu drugiego odczytu licznika (lub odczytu z początku okresu rozliczeniowego).
        </Notice>
      ) : null}

      <Card>
        <Body muted>Okres rozliczeniowy {formatDate(f.periodStart)} – {formatDate(f.periodEnd)} · dzień {f.daysElapsed} z {f.daysTotal}</Body>
        <Row>
          <Stat label="Prognoza rachunku" value={money(f.forecastCostGross)} estimate caption="brutto, do końca okresu" />
          <Stat label="Szacowany koszt" value={money(f.costToDateGross)} estimate caption="do ostatniego odczytu" />
        </Row>
        <Row>
          <Stat label="Zużycie" value={insufficient ? '–' : formatKwh(f.consumptionToDateKwh)} caption="od początku okresu" />
          <Stat label="Średnio dziennie" value={formatKwh(f.averageDailyKwh, 2)} caption={f.averageDailyCostGross !== null ? formatMoney(f.averageDailyCostGross, f.currencyCode) : undefined} />
        </Row>
        <Body muted>Ostatni odczyt: {formatDateTime(f.lastReadingAt)}</Body>
        {f.budgetForPeriod !== null && !insufficient ? (
          <View style={{ gap: spacing.xs }}>
            <Body>Budżet okresu: {formatMoney(f.budgetForPeriod, f.currencyCode)} · prognoza {formatPercent(f.budgetUsagePercent)}</Body>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceMuted }} accessibilityLabel={`Prognoza wykorzystania budżetu ${formatPercent(f.budgetUsagePercent)}`}>
              <View style={{ height: 8, borderRadius: 4, width: `${Math.min(f.budgetUsagePercent ?? 0, 100)}%`, backgroundColor: (f.budgetUsagePercent ?? 0) > 100 ? colors.danger : colors.primary }} />
            </View>
            {(f.budgetUsagePercent ?? 0) > 90 ? <Notice tone={budgetTone}>Prognoza zbliża się do budżetu lub go przekracza.</Notice> : null}
          </View>
        ) : null}
        {addReading}
        <Button title="Rozbicie kosztów" variant="secondary" icon="list-outline" onPress={() => router.push('/breakdown')} />
      </Card>

      <Card>
        <SectionTitle>Zużycie – ostatnie 30 dni</SectionTitle>
        {series.data && !hasChartData ? (
          <Body muted>Za mało odczytów, aby pokazać wykres. Dodaj kolejny odczyt.</Body>
        ) : series.data ? (
          <BarChart
            unit="kWh"
            summary={`Wykres dziennego zużycia, łącznie ${formatKwh(series.data.totalConsumptionKwh)} w ostatnich 30 dniach`}
            data={series.data.points.map((p) => ({
              key: p.periodStart,
              label: formatDate(p.periodStart).slice(0, 5),
              value: p.consumptionKwh,
              estimate: p.isEstimate,
              description: `${formatDate(p.periodStart)}: ${formatKwh(p.consumptionKwh, 2)}${p.isEstimate ? ' (estymacja)' : ''}`,
            }))}
          />
        ) : series.error ? <ErrorState error={series.error} onRetry={() => series.refetch()} /> : <Loading />}
        {series.data?.isEstimate ? <Body muted>Przy rzadkich odczytach rozkład dzienny jest estymacją liniową.</Body> : null}
      </Card>

      <Card>
        <Button title={showAssumptions ? 'Ukryj założenia prognozy' : 'Pokaż założenia prognozy'} variant="ghost" icon="information-circle-outline"
          onPress={() => setShowAssumptions((v) => !v)} />
        {showAssumptions ? f.assumptions.map((a) => <Body key={a} muted>• {a}</Body>) : null}
      </Card>
    </Screen>
  );
}
