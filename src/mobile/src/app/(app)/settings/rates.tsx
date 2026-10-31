import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '../../../api/errors';
import { propertyApi } from '../../../api/endpoints';
import { RatePlanForm } from '../../../components/RatePlanForm';
import { Body, Button, Card, EmptyState, ErrorState, KeyValue, Loading, Notice, Screen, SectionTitle } from '../../../components/ui';
import { keys, useCatalog, useContract, useInvalidateEnergyData } from '../../../hooks/queries';
import { useRequiredProperty } from '../../../state/PropertyContext';
import { addDays, formatDate, toIsoDate } from '../../../utils/format';
import { unitLabel } from '../../../utils/rateTemplates';

/** Rate plans are immutable: a price change means ending the current plan and adding a new one. */
export default function RatesSettings() {
  const property = useRequiredProperty();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateEnergyData();
  const catalog = useCatalog();
  const contract = useContract(property.id);
  const plans = useQuery({ queryKey: keys.ratePlans(property.id), queryFn: () => propertyApi.ratePlans(property.id) });
  const [adding, setAdding] = useState(false);
  const [newFrom, setNewFrom] = useState(toIsoDate(new Date()));

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: keys.ratePlans(property.id) });
    await invalidate(property.id);
  };

  const create = useMutation({
    mutationFn: async (request: Parameters<typeof propertyApi.createRatePlan>[1]) => {
      // Close an open plan of the same tariff the day before the new one starts.
      const open = plans.data?.find((p) => p.tariffId === request.tariffId && p.validTo === null && p.validFrom < request.validFrom);
      if (open) await propertyApi.endRatePlan(open.id, toIsoDate(addDays(new Date(`${request.validFrom}T12:00:00`), -1)));
      return propertyApi.createRatePlan(property.id, request);
    },
    onSuccess: async () => {
      setAdding(false);
      await refresh();
    },
  });

  if (plans.isLoading || catalog.isLoading || contract.isLoading) return <Loading />;
  if (plans.error) return <Screen><ErrorState error={plans.error} onRetry={() => plans.refetch()} /></Screen>;
  const tariff = catalog.data?.tariffs.find((t) => t.id === contract.data?.tariffId);

  if (!tariff) {
    return <Screen><EmptyState icon="flash-outline" title="Brak umowy" description="Najpierw wybierz taryfę w ustawieniach umowy." /></Screen>;
  }

  return (
    <Screen>
      {adding ? (
        <Card>
          <SectionTitle>Nowe stawki ({tariff.code})</SectionTitle>
          <Body muted>Obecny cennik zostanie zakończony dzień przed datą obowiązywania nowego. Historyczne kalkulacje zachowają poprzednie stawki.</Body>
          <RatePlanForm tariff={tariff} defaultValidFrom={newFrom} submitLabel="Zapisz cennik" busy={create.isPending} onSubmit={(r) => create.mutate(r)} />
          {create.error ? <Notice tone="danger">{errorMessage(create.error)}</Notice> : null}
          <Button title="Anuluj" variant="ghost" onPress={() => setAdding(false)} />
        </Card>
      ) : (
        <Button title="Dodaj nowe stawki" icon="add-circle-outline" onPress={() => { setNewFrom(toIsoDate(new Date())); setAdding(true); }} />
      )}

      {plans.data?.length === 0 ? <Notice tone="warning">Brak stawek – koszty nie będą liczone.</Notice> : null}
      {plans.data?.map((plan) => (
        <Card key={plan.id}>
          <SectionTitle>{plan.name}</SectionTitle>
          <Body muted>
            {plan.tariffCode} · od {formatDate(plan.validFrom)} {plan.validTo ? `do ${formatDate(plan.validTo)}` : '(bezterminowo)'} · źródło: {plan.sourceReference}
          </Body>
          {plan.components.map((c) => (
            <KeyValue key={c.id} label={c.name} value={`${c.netRate.toLocaleString('pl-PL', { maximumFractionDigits: 6 })} ${unitLabel[c.unit]} + ${Math.round(c.taxRate * 100)}% VAT`} />
          ))}
        </Card>
      ))}
    </Screen>
  );
}
