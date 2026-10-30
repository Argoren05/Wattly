import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { errorMessage } from '../../../api/errors';
import { propertyApi } from '../../../api/endpoints';
import { Button, Card, Chips, Field, Notice, Screen } from '../../../components/ui';
import { useRequiredProperty } from '../../../state/PropertyContext';
import { parseDecimal, parseIsoDate } from '../../../utils/format';

export default function PropertySettings() {
  const property = useRequiredProperty();
  const queryClient = useQueryClient();
  const [name, setName] = useState(property.name);
  const [city, setCity] = useState(property.city ?? '');
  const [months, setMonths] = useState(String(property.billingPeriodMonths));
  const [anchor, setAnchor] = useState(property.billingAnchorDate);
  const [budget, setBudget] = useState(property.monthlyBudget !== null ? String(property.monthlyBudget).replace('.', ',') : '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const date = parseIsoDate(anchor);
      const budgetValue = budget.trim() ? parseDecimal(budget) : null;
      if (!date) throw new Error('Podaj datę w formacie RRRR-MM-DD.');
      if (budget.trim() && (budgetValue === null || budgetValue <= 0)) throw new Error('Budżet musi być dodatnią kwotą.');
      return propertyApi.update(property.id, {
        name: name.trim(), city: city.trim() || null, billingPeriodMonths: Number(months), billingAnchorDate: date, monthlyBudget: budgetValue,
        timeZoneId: property.timeZoneId, currencyCode: property.currencyCode, countryCode: property.countryCode,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.back();
    },
    onError: (e) => setError(e instanceof Error && !('status' in e) ? e.message : errorMessage(e)),
  });

  return (
    <Screen>
      <Card>
        <Field label="Nazwa" value={name} onChangeText={setName} />
        <Field label="Miejscowość (opcjonalnie)" value={city} onChangeText={setCity} />
        <Chips label="Okres rozliczeniowy" value={months} onChange={setMonths}
          options={['1', '2', '3', '6', '12'].map((m) => ({ value: m, label: `${m} mies.` }))} />
        <Field label="Początek okresu rozliczeniowego" value={anchor} onChangeText={setAnchor} placeholder="RRRR-MM-DD" />
        <Field label={`Miesięczny budżet brutto (${property.currencyCode})`} value={budget} onChangeText={setBudget} keyboardType="decimal-pad" />
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button title="Zapisz" onPress={() => save.mutate()} loading={save.isPending} />
      </Card>
    </Screen>
  );
}
