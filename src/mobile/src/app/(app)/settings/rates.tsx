import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { errorMessage } from '../../../api/errors';
import { propertyApi } from '../../../api/endpoints';
import type { RatePlan, RatePlanRequest } from '../../../api/types';
import { confirmAsync } from '../../../components/confirm';
import { RatePlanForm } from '../../../components/RatePlanForm';
import { Body, Button, Card, EmptyState, ErrorState, KeyValue, Loading, Notice, Screen, SectionTitle } from '../../../components/ui';
import { keys, useCatalog, useContract, useInvalidateEnergyData } from '../../../hooks/queries';
import { useRequiredProperty } from '../../../state/PropertyContext';
import { spacing } from '../../../theme/theme';
import { addDays, formatDate, toIsoDate } from '../../../utils/format';
import { unitLabel } from '../../../utils/rateTemplates';

/** What the screen is editing: nothing, a new plan, or a correction of a saved one. */
type Mode = { kind: 'list' } | { kind: 'new' } | { kind: 'edit'; plan: RatePlan };

/**
 * The user's own rate plans (DEC-028):
 * - "Nowe stawki od…" – a real price change: the current plan ends the day before, history is kept;
 * - "Popraw" – fixes a mistake (wrong date or rate) in a saved plan;
 * - "Usuń" – removes a plan entered by mistake.
 * Saved calculations keep a copy of the rates they used, so corrections only affect forecasts and new calculations.
 */
export default function RatesSettings() {
  const property = useRequiredProperty();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateEnergyData();
  const catalog = useCatalog();
  const contract = useContract(property.id);
  const plans = useQuery({ queryKey: keys.ratePlans(property.id), queryFn: () => propertyApi.ratePlans(property.id) });
  const [mode, setMode] = useState<Mode>({ kind: 'list' });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: keys.ratePlans(property.id) });
    await invalidate(property.id);
  };

  const save = useMutation({
    mutationFn: async (request: RatePlanRequest) => {
      if (mode.kind === 'edit') return propertyApi.updateRatePlan(mode.plan.id, request);
      // Close an open plan of the same tariff the day before the new one starts.
      const open = plans.data?.find((p) => p.tariffId === request.tariffId && p.validTo === null && p.validFrom < request.validFrom);
      if (open) await propertyApi.endRatePlan(open.id, toIsoDate(addDays(new Date(`${request.validFrom}T12:00:00`), -1)));
      return propertyApi.createRatePlan(property.id, request);
    },
    onSuccess: async () => {
      setMode({ kind: 'list' });
      await refresh();
    },
  });

  const remove = useMutation({
    mutationFn: async (plan: RatePlan) => {
      const confirmed = await confirmAsync(`Usunąć cennik „${plan.name}”?`,
        'Prognozy przestaną uwzględniać te stawki. Zapisane kalkulacje zachowają swoje kopie stawek.', 'Usuń', { destructive: true });
      if (confirmed) await propertyApi.removeRatePlan(plan.id);
    },
    onSuccess: refresh,
  });

  if (plans.isLoading || catalog.isLoading || contract.isLoading) return <Loading />;
  if (plans.error) return <Screen><ErrorState error={plans.error} onRetry={() => plans.refetch()} /></Screen>;
  const contractTariff = catalog.data?.tariffs.find((t) => t.id === contract.data?.tariffId);

  if (!contractTariff) {
    return <Screen><EmptyState icon="flash-outline" title="Brak umowy" description="Najpierw wybierz taryfę w ustawieniach umowy." /></Screen>;
  }

  if (mode.kind !== 'list') {
    const editing = mode.kind === 'edit' ? mode.plan : undefined;
    const tariff = catalog.data?.tariffs.find((t) => t.id === editing?.tariffId) ?? contractTariff;
    return (
      <Screen>
        <Card>
          <SectionTitle>{editing ? `Popraw cennik (${tariff.code})` : `Nowe stawki (${tariff.code})`}</SectionTitle>
          <Body muted>
            {editing
              ? 'Popraw daty lub stawki, jeśli zostały wpisane z błędem. Prognozy zostaną przeliczone.'
              : 'Obecny cennik zostanie zakończony dzień przed datą obowiązywania nowego. Historia zostanie zachowana.'}
          </Body>
          <RatePlanForm key={editing?.id ?? 'new'} tariff={tariff} initial={editing} defaultValidFrom={toIsoDate(new Date())}
            submitLabel={editing ? 'Zapisz poprawki' : 'Zapisz cennik'} busy={save.isPending} onSubmit={(r) => save.mutate(r)} />
          {save.error ? <Notice tone="danger">{errorMessage(save.error)}</Notice> : null}
          <Button title="Anuluj" variant="ghost" onPress={() => { save.reset(); setMode({ kind: 'list' }); }} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Button title="Nowe stawki od…" icon="add-circle-outline" onPress={() => setMode({ kind: 'new' })}
        accessibilityHint="Dodaje cennik obowiązujący od wybranej daty, np. po zmianie cen" />
      {remove.error ? <Notice tone="danger">{errorMessage(remove.error)}</Notice> : null}

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
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button title="Popraw" variant="secondary" icon="create-outline" onPress={() => setMode({ kind: 'edit', plan })} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Usuń" variant="danger" icon="trash-outline" onPress={() => remove.mutate(plan)} loading={remove.isPending && remove.variables?.id === plan.id} />
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
