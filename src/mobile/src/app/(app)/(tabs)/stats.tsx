import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { analyticsApi } from '../../../api/endpoints';
import type { Granularity, Series } from '../../../api/types';
import { BarChart } from '../../../components/BarChart';
import { Body, Card, Chips, ErrorState, KeyValue, Loading, Screen, SectionTitle } from '../../../components/ui';
import { keys } from '../../../hooks/queries';
import { useRequiredProperty } from '../../../state/PropertyContext';
import { addDays, addMonths, formatDate, formatKwh, formatMoney, formatPercent, toIsoDate } from '../../../utils/format';

const ranges: Record<Granularity, { label: string; current: () => [Date, Date]; previous: () => [Date, Date] }> = {
  Day: { label: 'Dziennie', current: () => [addDays(new Date(), -29), new Date()], previous: () => [addDays(new Date(), -59), addDays(new Date(), -30)] },
  Week: { label: 'Tygodniowo', current: () => [addDays(new Date(), -7 * 12), new Date()], previous: () => [addDays(new Date(), -7 * 24), addDays(new Date(), -7 * 12 - 1)] },
  Month: { label: 'Miesięcznie', current: () => [addMonths(new Date(), -11), new Date()], previous: () => [addMonths(new Date(), -23), addMonths(new Date(), -12)] },
  Year: { label: 'Rocznie', current: () => [addMonths(new Date(), -12 * 4), new Date()], previous: () => [addMonths(new Date(), -12 * 9), addMonths(new Date(), -12 * 5)] },
};

function pointLabel(start: string, granularity: Granularity) {
  if (granularity === 'Year') return start.slice(0, 4);
  if (granularity === 'Month') return `${start.slice(5, 7)}.${start.slice(2, 4)}`;
  return formatDate(start).slice(0, 5);
}

export default function Stats() {
  const property = useRequiredProperty();
  const [granularity, setGranularity] = useState<Granularity>('Month');
  const [metric, setMetric] = useState<'consumption' | 'cost'>('consumption');

  const range = ranges[granularity];
  const [from, to] = range.current().map(toIsoDate) as [string, string];
  const [prevFrom, prevTo] = range.previous().map(toIsoDate) as [string, string];
  const fetchSeries = (f: string, t: string) => (metric === 'cost' ? analyticsApi.costs : analyticsApi.consumption)(property.id, f, t, granularity);

  const current = useQuery({ queryKey: [...keys.series(property.id), metric, granularity, from], queryFn: () => fetchSeries(from, to) });
  const previous = useQuery({ queryKey: [...keys.series(property.id), metric, granularity, prevFrom], queryFn: () => fetchSeries(prevFrom, prevTo) });

  const total = (s: Series | undefined) => (metric === 'cost' ? s?.totalCostGross ?? 0 : s?.totalConsumptionKwh ?? 0);
  const fmt = (v: number | null) => (metric === 'cost' ? formatMoney(v, property.currencyCode) : formatKwh(v));
  const change = previous.data && total(previous.data) > 0 ? ((total(current.data) - total(previous.data)) / total(previous.data)) * 100 : null;

  return (
    <Screen refreshing={current.isRefetching} onRefresh={() => { void current.refetch(); void previous.refetch(); }}>
      <Chips value={metric} onChange={setMetric} options={[{ value: 'consumption', label: 'Zużycie (kWh)' }, { value: 'cost', label: 'Koszt (brutto)' }]} />
      <Chips value={granularity} onChange={setGranularity}
        options={(Object.keys(ranges) as Granularity[]).map((g) => ({ value: g, label: ranges[g].label }))} />

      <Card>
        <SectionTitle>{metric === 'cost' ? 'Szacowany koszt' : 'Zużycie'}</SectionTitle>
        {current.isLoading ? <Loading /> : current.error ? <ErrorState error={current.error} onRetry={() => current.refetch()} /> : current.data ? (
          <BarChart
            unit={metric === 'cost' ? property.currencyCode : 'kWh'}
            summary={`Wykres ${metric === 'cost' ? 'kosztów' : 'zużycia'} ${range.label.toLowerCase()}, łącznie ${fmt(total(current.data))}`}
            data={current.data.points.map((p) => {
              const value = metric === 'cost' ? p.costGross : p.consumptionKwh;
              return {
                key: p.periodStart,
                label: pointLabel(p.periodStart, granularity),
                value,
                estimate: p.isEstimate,
                description: `${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)}: ${fmt(value)}${p.isEstimate ? ' (estymacja)' : ''}${p.isPartial ? ', okres niepełny' : ''}`,
              };
            })}
          />
        ) : null}
      </Card>

      <Card>
        <SectionTitle>Porównanie okresów</SectionTitle>
        <KeyValue label={`${formatDate(from)} – ${formatDate(to)}`} value={fmt(total(current.data))} />
        <KeyValue label={`${formatDate(prevFrom)} – ${formatDate(prevTo)}`} value={previous.isLoading ? '…' : fmt(total(previous.data))} />
        <KeyValue label="Zmiana" value={change === null ? '–' : `${change > 0 ? '+' : ''}${formatPercent(change)}`} />
        {current.data?.isEstimate || previous.data?.isEstimate ? <Body muted>Część wartości to dane szacunkowe.</Body> : null}
      </Card>

      {current.data && current.data.assumptions.length > 0 ? (
        <Card>
          <SectionTitle>Założenia</SectionTitle>
          {current.data.assumptions.map((a) => <Body key={a} muted>• {a}</Body>)}
        </Card>
      ) : null}
    </Screen>
  );
}
