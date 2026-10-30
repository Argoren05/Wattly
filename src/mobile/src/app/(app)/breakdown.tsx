import { useQuery } from '@tanstack/react-query';

import { analyticsApi } from '../../api/endpoints';
import type { CostCategory } from '../../api/types';
import { Body, Card, EstimateBadge, ErrorState, KeyValue, Loading, Notice, Screen, SectionTitle } from '../../components/ui';
import { keys, useCatalog, useContract } from '../../hooks/queries';
import { useRequiredProperty } from '../../state/PropertyContext';
import { formatDate, formatKwh, formatMoney } from '../../utils/format';
import { unitLabel } from '../../utils/rateTemplates';

const categoryLabel: Record<CostCategory, string> = { Energy: 'Energia', Distribution: 'Dystrybucja', Other: 'Pozostałe opłaty' };

/** Explains the forecast for the current billing period component by component. */
export default function Breakdown() {
  const property = useRequiredProperty();
  const catalog = useCatalog();
  const contract = useContract(property.id);
  const zones = catalog.data?.tariffs.find((t) => t.id === contract.data?.tariffId)?.zones ?? [];
  const zoneName = (code: string | null) => zones.find((z) => z.code === code)?.name ?? code ?? '';
  const forecast = useQuery({ queryKey: keys.forecast(property.id), queryFn: () => analyticsApi.forecast(property.id) });
  const period = forecast.data;
  const calc = useQuery({
    queryKey: [...keys.forecast(property.id), 'breakdown', period?.periodStart],
    enabled: !!period,
    // Same instants as the forecast, so both screens always show identical totals.
    queryFn: () => analyticsApi.preview(property.id, period!.periodStartAt, period!.periodEndAt),
  });

  if (forecast.isLoading || calc.isLoading) return <Loading />;
  const error = forecast.error ?? calc.error;
  if (error || !calc.data) return <Screen><ErrorState error={error} onRetry={() => calc.refetch()} /></Screen>;
  const r = calc.data;
  const money = (v: number) => formatMoney(v, r.currencyCode);

  return (
    <Screen>
      <Card>
        <SectionTitle>Okres {formatDate(period?.periodStart)} – {formatDate(period?.periodEnd)}</SectionTitle>
        {r.isEstimate ? <EstimateBadge label="Prognoza – nie jest fakturą" /> : null}
        <KeyValue label="Zużycie" value={formatKwh(r.consumptionKwh)} />
        {r.consumptionByZone.map((z) => <KeyValue key={z.zoneCode ?? '-'} label={`  strefa ${zoneName(z.zoneCode).toLowerCase()}`} value={formatKwh(z.consumptionKwh)} />)}
        <KeyValue label="Energia (netto)" value={money(r.energyCostNet)} />
        <KeyValue label="Dystrybucja (netto)" value={money(r.distributionCostNet)} />
        <KeyValue label="Pozostałe (netto)" value={money(r.otherCostNet)} />
        <KeyValue label="Razem netto" value={money(r.totalNet)} />
        <KeyValue label="VAT" value={money(r.taxAmount)} />
        <KeyValue label="Razem brutto" value={money(r.totalGross)} />
        {!r.isComplete ? <Notice tone="warning">Kalkulacja jest niepełna – sprawdź założenia poniżej.</Notice> : null}
      </Card>

      {(['Energy', 'Distribution', 'Other'] as const).map((category) => {
        const lines = r.lines.filter((l) => l.category === category);
        if (lines.length === 0) return null;
        return (
          <Card key={category}>
            <SectionTitle>{categoryLabel[category]}</SectionTitle>
            {lines.map((l, idx) => (
              <KeyValue
                key={`${l.componentName}-${l.segmentStart}-${idx}`}
                label={`${l.componentName}: ${l.quantity.toLocaleString('pl-PL')} × ${l.netRate.toLocaleString('pl-PL')} ${unitLabel[l.unit]}`}
                value={money(l.netAmount)}
              />
            ))}
          </Card>
        );
      })}

      <Card>
        <SectionTitle>Źródło stawek</SectionTitle>
        {r.ratePlans.map((p) => <Body key={p.id} muted>• {p.name}{p.sourceReference ? ` – ${p.sourceReference}` : ''}</Body>)}
        <SectionTitle>Założenia</SectionTitle>
        {r.assumptions.map((a) => <Body key={a} muted>• {a}</Body>)}
      </Card>
    </Screen>
  );
}
