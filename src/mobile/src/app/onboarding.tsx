import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { errorMessage, ValidationError } from '../api/errors';
import { meterApi, propertyApi, readingApi } from '../api/endpoints';
import type { Meter, Property, Tariff } from '../api/types';
import { DateField } from '../components/DateField';
import { PpeField, ppeError } from '../components/PpeField';
import { RatePlanForm } from '../components/RatePlanForm';
import { Body, Button, Card, Chips, ErrorState, Field, Loading, Notice, Screen, SectionTitle, Title } from '../components/ui';
import { useCatalog } from '../hooks/queries';
import { queryKeys, useProperty } from '../state/PropertyContext';
import { spacing, useTheme } from '../theme/theme';
import { parseDecimal, parseIsoDate, parseLocalDateTime, toIsoDate, toLocalDateTimeText } from '../utils/format';
import { normalizePpe } from '../utils/gs1';

const STEPS = ['Nieruchomość', 'Operator', 'Sprzedawca', 'Taryfa', 'Licznik', 'Stawki', 'Pierwszy odczyt', 'Gotowe'] as const;

/** Short, skippable setup wizard (doc/Wattly_UI_UX.md §5). Each step is saved immediately. */
export default function Onboarding() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { select, properties } = useProperty();
  const catalog = useCatalog();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [property, setProperty] = useState<Property | null>(null);
  const [name, setName] = useState('Moje mieszkanie');
  const [months, setMonths] = useState('2');
  const [anchor, setAnchor] = useState(toIsoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [budget, setBudget] = useState('');

  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [power, setPower] = useState('');
  // Empty = same as the start of the billing period (the most common case); the user can pick another day.
  const [contractFrom, setContractFrom] = useState('');
  const [ppe, setPpe] = useState('');
  const [meter, setMeter] = useState<Meter | null>(null);
  const [serial, setSerial] = useState('');
  const [when, setWhen] = useState(toLocalDateTimeText(new Date()));
  const [values, setValues] = useState<Record<string, string>>({});

  const next = () => {
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const run = useMutation({
    mutationFn: async (action: () => Promise<void>) => action(),
    onSuccess: next,
    onError: (e) => setError(errorMessage(e)),
  });

  if (catalog.isLoading) return <Loading />;
  if (catalog.error || !catalog.data) return <Screen><ErrorState error={catalog.error} onRetry={() => catalog.refetch()} /></Screen>;
  const { operators, suppliers, tariffs } = catalog.data;

  const saveProperty = () => run.mutate(async () => {
    const date = parseIsoDate(anchor);
    const budgetValue = budget.trim() ? parseDecimal(budget) : null;
    if (!name.trim()) throw new ValidationError('Podaj nazwę nieruchomości.');
    if (!date) throw new ValidationError('Wybierz datę początku okresu rozliczeniowego.');
    if (budget.trim() && (budgetValue === null || budgetValue <= 0)) throw new ValidationError('Budżet musi być dodatnią kwotą.');
    const body = { name: name.trim(), billingPeriodMonths: Number(months), billingAnchorDate: date, monthlyBudget: budgetValue };
    setProperty(property ? await propertyApi.update(property.id, body) : await propertyApi.create(body));
  });

  const saveContract = () => run.mutate(async () => {
    if (!property || !tariff) throw new ValidationError('Wybierz taryfę.');
    const powerValue = power.trim() ? parseDecimal(power) : null;
    if (power.trim() && (powerValue === null || powerValue <= 0)) throw new ValidationError('Moc umowna musi być dodatnią liczbą.');
    await propertyApi.setContract(property.id, {
      tariffId: tariff.id, operatorId, supplierId, contractedPowerKw: powerValue, validFrom: contractFrom || property.billingAnchorDate, validTo: null,
    });
  });

  const saveMeter = () => run.mutate(async () => {
    if (!property || !tariff) return;
    const ppeProblem = ppeError(ppe);
    if (ppeProblem) throw new ValidationError(ppeProblem);
    const ppeCode = normalizePpe(ppe) || null;
    if (ppeCode !== property.ppeCode) {
      setProperty(await propertyApi.update(property.id, {
        name: property.name, city: property.city, billingPeriodMonths: property.billingPeriodMonths, billingAnchorDate: property.billingAnchorDate,
        monthlyBudget: property.monthlyBudget, timeZoneId: property.timeZoneId, currencyCode: property.currencyCode, countryCode: property.countryCode,
        ppeCode,
      }));
    }
    const registers = tariff.zones.length === 0
      ? [{ name: 'Pobór', registerType: 'Import' as const, zoneCode: null, code: '1.8.0' }]
      : tariff.zones.map((z, i) => ({ name: z.name, registerType: 'Import' as const, zoneCode: z.code, code: `1.8.${i + 1}` }));
    setMeter(meter ?? await meterApi.create(property.id, {
      name: 'Licznik główny', serialNumber: serial.trim() || null, meterType: 'Conventional', directionality: 'ImportOnly', registers,
    }));
  });

  const saveReadings = () => run.mutate(async () => {
    if (!meter) return;
    const readingAt = parseLocalDateTime(when);
    if (!readingAt) throw new ValidationError('Wybierz datę i godzinę odczytu.');
    for (const register of meter.registers) {
      const value = parseDecimal(values[register.id] ?? '');
      if (value === null || value < 0) throw new ValidationError(`Podaj wskazanie rejestru „${register.name}”.`);
    }
    for (const register of meter.registers) {
      await readingApi.create(register.id, { readingAt, value: parseDecimal(values[register.id] ?? '')!, source: 'Manual' });
    }
  });

  const finish = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.properties });
    // When adding another property, switch the app to the one just configured.
    if (property) select(property.id);
    router.replace('/(app)/(tabs)');
  };

  const skip = <Button title="Pomiń – uzupełnię później" variant="ghost" onPress={next} />;

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Text style={{ color: colors.textMuted, fontWeight: '600' }} accessibilityLabel={`Krok ${step + 1} z ${STEPS.length}`}>
          Krok {step + 1} z {STEPS.length}
        </Text>
        <Title>{STEPS[step]}</Title>
        <View style={{ height: 6, backgroundColor: colors.surfaceMuted, borderRadius: 3 }}>
          <View style={{ height: 6, width: `${((step + 1) / STEPS.length) * 100}%`, backgroundColor: colors.primary, borderRadius: 3 }} />
        </View>
      </View>

      <Card>
        {step === 0 && (
          <>
            <Field label="Nazwa" value={name} onChangeText={setName} />
            <Chips label="Okres rozliczeniowy" value={months} onChange={setMonths}
              options={[{ value: '1', label: '1 mies.' }, { value: '2', label: '2 mies.' }, { value: '6', label: '6 mies.' }, { value: '12', label: '12 mies.' }]} />
            <DateField label="Początek okresu rozliczeniowego" value={anchor} onChange={setAnchor}
              hint="Dzień po końcu okresu z ostatniej faktury rozliczeniowej – od niego liczone są kolejne okresy." />
            <Field label="Miesięczny budżet brutto (opcjonalnie)" value={budget} onChangeText={setBudget} keyboardType="decimal-pad" placeholder="np. 200" />
            <Button title="Dalej" onPress={saveProperty} loading={run.isPending} />
            {properties.length > 0 && !property ? <Button title="Anuluj" variant="ghost" onPress={() => router.back()} /> : null}
          </>
        )}

        {step === 1 && (
          <>
            <Body muted>Operator dystrybucyjny (OSD) dostarcza energię siecią – znajdziesz go na fakturze.</Body>
            <Chips value={operatorId} onChange={setOperatorId} options={operators.map((o) => ({ value: o.id, label: o.name }))} />
            <Button title="Dalej" onPress={next} disabled={!operatorId} />
            {skip}
          </>
        )}

        {step === 2 && (
          <>
            <Body muted>Sprzedawca energii to firma, z którą masz umowę sprzedaży. Może być inny niż operator.</Body>
            <Chips value={supplierId} onChange={setSupplierId} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
            <Button title="Dalej" onPress={next} disabled={!supplierId} />
            {skip}
          </>
        )}

        {step === 3 && (
          <>
            <Chips value={tariff?.id ?? null} onChange={(id) => setTariff(tariffs.find((t) => t.id === id) ?? null)}
              options={tariffs.map((t) => ({ value: t.id, label: t.code }))} />
            {tariff ? <Body muted>{tariff.name}. {tariff.description}</Body> : <Body muted>Grupę taryfową (np. G11, G12) znajdziesz na fakturze.</Body>}
            <Field label="Moc umowna kW (opcjonalnie)" value={power} onChangeText={setPower} keyboardType="decimal-pad" />
            <DateField label="Umowa obowiązuje od" value={contractFrom || property?.billingAnchorDate || anchor} onChange={setContractFrom}
              hint="Data zawarcia umowy lub zmiany taryfy. Jeśli nie wiesz – zostaw początek okresu rozliczeniowego." />
            <Button title="Dalej" onPress={saveContract} disabled={!tariff} loading={run.isPending} />
          </>
        )}

        {step === 4 && tariff && (
          <>
            <Body>
              {tariff.zones.length === 0
                ? 'Licznik jednostrefowy – jeden rejestr poboru.'
                : `Licznik ${tariff.zones.length}-strefowy – rejestry: ${tariff.zones.map((z) => z.name).join(', ')}.`}
            </Body>
            <Field label="Numer licznika (opcjonalnie)" value={serial} onChangeText={setSerial} />
            <PpeField value={ppe} onChange={setPpe} />
            <Button title="Dalej" onPress={saveMeter} loading={run.isPending} />
          </>
        )}

        {step === 5 && tariff && property && (
          <>
            <SectionTitle>Twoje stawki</SectionTitle>
            <Body muted>Przepisz stawki z ostatniej faktury, aby Wattly mógł liczyć koszty. Możesz to zrobić później w Ustawieniach.</Body>
            <RatePlanForm tariff={tariff} defaultValidFrom={contractFrom || property.billingAnchorDate} submitLabel="Zapisz stawki" busy={run.isPending}
              onSubmit={(request) => run.mutate(async () => { await propertyApi.createRatePlan(property.id, request); })} />
            {skip}
          </>
        )}

        {step === 6 && meter && (
          <>
            <Body muted>Wprowadź aktualne wskazanie licznika. To punkt startowy obliczeń.</Body>
            <DateField label="Data i godzina" mode="datetime" value={when} onChange={setWhen} maximumDate={new Date()} />
            {meter.registers.map((r) => (
              <Field key={r.id} label={`${r.name} (kWh)`} value={values[r.id] ?? ''} keyboardType="decimal-pad"
                onChangeText={(t) => setValues((v) => ({ ...v, [r.id]: t }))} />
            ))}
            <Button title="Zapisz odczyt" onPress={saveReadings} loading={run.isPending} />
            {skip}
          </>
        )}

        {step === 4 && !tariff && (
          <>
            <Notice tone="warning">Bez taryfy nie można skonfigurować rejestrów licznika.</Notice>
            <Button title="Wróć do wyboru taryfy" variant="secondary" onPress={() => setStep(3)} />
          </>
        )}
        {step === 5 && (!tariff || !property) ? <><Notice tone="warning">Najpierw wybierz taryfę.</Notice>{skip}</> : null}
        {step === 6 && !meter ? <><Notice tone="warning">Brak skonfigurowanego licznika – odczyt dodasz później.</Notice>{skip}</> : null}

        {step === 7 && (
          <>
            <Body>Konfiguracja zakończona.</Body>
            <Notice title="Prognoza będzie coraz dokładniejsza">
              Dodawaj odczyty regularnie – na podstawie co najmniej dwóch odczytów Wattly oszacuje zużycie i rachunek. Prognoza nie jest fakturą.
            </Notice>
            <Button title="Przejdź do aplikacji" onPress={finish} />
          </>
        )}

        {error ? <Notice tone="danger">{error}</Notice> : null}
      </Card>

      {step > 0 && step < 7 ? <Button title="Wstecz" variant="secondary" icon="arrow-back" onPress={() => setStep((s) => s - 1)} /> : null}
    </Screen>
  );
}
