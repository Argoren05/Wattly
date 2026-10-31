import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { errorMessage, ValidationError } from '../../../api/errors';
import { propertyApi } from '../../../api/endpoints';
import { confirmAsync } from '../../../components/confirm';
import { DateField } from '../../../components/DateField';
import { PpeField, ppeError } from '../../../components/PpeField';
import { Body, Button, Card, Chips, Field, Notice, Screen, SectionTitle } from '../../../components/ui';
import { queryKeys, useProperty, useRequiredProperty } from '../../../state/PropertyContext';
import { parseDecimal, parseIsoDate } from '../../../utils/format';
import { normalizePpe } from '../../../utils/gs1';

/** Edits the property (name, city, PPE number, billing period, budget) and lets the user delete it. */
export default function PropertySettings() {
  const property = useRequiredProperty();
  const { properties, select } = useProperty();
  const queryClient = useQueryClient();
  const [name, setName] = useState(property.name);
  const [city, setCity] = useState(property.city ?? '');
  const [ppe, setPpe] = useState(property.ppeCode ?? '');
  const [months, setMonths] = useState(String(property.billingPeriodMonths));
  const [anchor, setAnchor] = useState(property.billingAnchorDate);
  const [budget, setBudget] = useState(property.monthlyBudget !== null ? String(property.monthlyBudget).replace('.', ',') : '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const date = parseIsoDate(anchor);
      const budgetValue = budget.trim() ? parseDecimal(budget) : null;
      if (!name.trim()) throw new ValidationError('Podaj nazwę nieruchomości.');
      if (!date) throw new ValidationError('Wybierz datę początku okresu rozliczeniowego.');
      if (budget.trim() && (budgetValue === null || budgetValue <= 0)) throw new ValidationError('Budżet musi być dodatnią kwotą.');
      const ppeProblem = ppeError(ppe);
      if (ppeProblem) throw new ValidationError(ppeProblem);
      return propertyApi.update(property.id, {
        name: name.trim(), city: city.trim() || null, billingPeriodMonths: Number(months), billingAnchorDate: date, monthlyBudget: budgetValue,
        timeZoneId: property.timeZoneId, currencyCode: property.currencyCode, countryCode: property.countryCode,
        addressLine: property.addressLine, postalCode: property.postalCode, ppeCode: normalizePpe(ppe) || null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.back();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const confirmed = await confirmAsync(`Usunąć „${property.name}”?`,
        'Zostaną trwale usunięte wszystkie dane tej nieruchomości: umowy, stawki, liczniki, odczyty, faktury i załączniki. Tej operacji nie można cofnąć.',
        'Usuń', { destructive: true });
      if (!confirmed) return false;
      await propertyApi.remove(property.id);
      return true;
    },
    onSuccess: async (deleted) => {
      if (!deleted) return;
      // Switch to another property before the list refreshes; with none left the entry screen starts the setup again.
      const next = properties.find((p) => p.id !== property.id);
      if (next) select(next.id);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== queryKeys.properties[0] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.properties });
      router.replace(next ? '/(app)/(tabs)/settings' : '/');
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Screen>
      <Card>
        <Field label="Nazwa" value={name} onChangeText={setName} />
        <Field label="Miejscowość (opcjonalnie)" value={city} onChangeText={setCity} />
        <PpeField value={ppe} onChange={setPpe} />
        <Chips label="Okres rozliczeniowy" value={months} onChange={setMonths}
          options={['1', '2', '3', '6', '12'].map((m) => ({ value: m, label: `${m} mies.` }))} />
        <DateField label="Początek okresu rozliczeniowego" value={anchor} onChange={setAnchor}
          hint="Dzień po końcu okresu z ostatniej faktury rozliczeniowej." />
        <Field label={`Miesięczny budżet brutto (${property.currencyCode})`} value={budget} onChangeText={setBudget} keyboardType="decimal-pad" />
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button title="Zapisz" onPress={() => save.mutate()} loading={save.isPending} />
      </Card>
      <Card>
        <SectionTitle>Usuwanie</SectionTitle>
        <Body muted>Usuwa nieruchomość razem ze wszystkimi jej danymi.</Body>
        <Button title="Usuń nieruchomość" variant="danger" icon="trash-outline" onPress={() => remove.mutate()} loading={remove.isPending} />
      </Card>
    </Screen>
  );
}
