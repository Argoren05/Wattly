import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { errorMessage, ValidationError } from '../../../api/errors';
import { propertyApi } from '../../../api/endpoints';
import type { CatalogEntry, EnergyContract, Tariff } from '../../../api/types';
import { confirmAsync } from '../../../components/confirm';
import { DateField } from '../../../components/DateField';
import { Body, Button, Card, Chips, ErrorState, Field, KeyValue, Loading, Notice, Screen, SectionTitle } from '../../../components/ui';
import { keys, useCatalog } from '../../../hooks/queries';
import { useRequiredProperty } from '../../../state/PropertyContext';
import { spacing } from '../../../theme/theme';
import { formatDate, parseDecimal, parseIsoDate, toIsoDate } from '../../../utils/format';

/** What the screen shows: the contract history, a new contract or a correction of a saved one. */
type Mode = { kind: 'list' } | { kind: 'new' } | { kind: 'edit'; contract: EnergyContract };

/**
 * Contract history of the property (DEC-028):
 * - "Nowa umowa od…" – a real change (new tariff or seller): the previous contract ends the day before;
 * - "Popraw" – fixes a saved contract, e.g. a wrong start date entered during setup;
 * - "Usuń" – removes a contract entered by mistake.
 */
export default function ContractSettings() {
  const property = useRequiredProperty();
  const queryClient = useQueryClient();
  const catalog = useCatalog();
  const contracts = useQuery({ queryKey: keys.contracts(property.id), queryFn: () => propertyApi.contracts(property.id) });
  const [mode, setMode] = useState<Mode>({ kind: 'list' });

  const remove = useMutation({
    mutationFn: async (contract: EnergyContract) => {
      const confirmed = await confirmAsync(`Usunąć umowę od ${formatDate(contract.validFrom)}?`,
        'Bez umowy w danym okresie koszty nie będą liczone. Zapisane kalkulacje się nie zmienią.', 'Usuń', { destructive: true });
      if (confirmed) await propertyApi.removeContract(contract.id);
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });

  if (catalog.isLoading || contracts.isLoading) return <Loading />;
  if (catalog.error || !catalog.data) return <Screen><ErrorState error={catalog.error} onRetry={() => catalog.refetch()} /></Screen>;
  if (contracts.error) return <Screen><ErrorState error={contracts.error} onRetry={() => contracts.refetch()} /></Screen>;
  const history = contracts.data ?? [];

  if (mode.kind !== 'list' || history.length === 0) {
    const editing = mode.kind === 'edit' ? mode.contract : undefined;
    return (
      <ContractForm key={editing?.id ?? 'new'} propertyId={property.id} contract={editing}
        template={editing ?? history[0]} defaultFrom={property.billingAnchorDate} {...catalog.data}
        onDone={() => setMode({ kind: 'list' })} canCancel={history.length > 0} />
    );
  }

  return (
    <Screen>
      <Button title="Nowa umowa od…" icon="add-circle-outline" onPress={() => setMode({ kind: 'new' })}
        accessibilityHint="Dodaje umowę od wybranej daty, np. po zmianie taryfy lub sprzedawcy" />
      {remove.error ? <Notice tone="danger">{errorMessage(remove.error)}</Notice> : null}
      {history.map((contract) => (
        <Card key={contract.id}>
          <SectionTitle>{`${contract.tariffCode} · od ${formatDate(contract.validFrom)}${contract.validTo ? ` do ${formatDate(contract.validTo)}` : ''}`}</SectionTitle>
          <KeyValue label="Operator" value={contract.operatorName ?? '–'} />
          <KeyValue label="Sprzedawca" value={contract.supplierName ?? '–'} />
          <KeyValue label="Moc umowna" value={contract.contractedPowerKw !== null ? `${String(contract.contractedPowerKw).replace('.', ',')} kW` : '–'} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button title="Popraw" variant="secondary" icon="create-outline" onPress={() => setMode({ kind: 'edit', contract })} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Usuń" variant="danger" icon="trash-outline" onPress={() => remove.mutate(contract)}
                loading={remove.isPending && remove.variables?.id === contract.id} />
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

/** Form of a new contract (pre-filled from the latest one) or a correction of `contract`. */
function ContractForm({ propertyId, contract, template, defaultFrom, operators, suppliers, tariffs, onDone, canCancel }: {
  propertyId: string;
  contract?: EnergyContract;
  template?: EnergyContract;
  defaultFrom: string;
  operators: CatalogEntry[];
  suppliers: CatalogEntry[];
  tariffs: Tariff[];
  onDone: () => void;
  canCancel: boolean;
}) {
  const queryClient = useQueryClient();
  const [operatorId, setOperatorId] = useState<string | null>(template?.operatorId ?? null);
  const [supplierId, setSupplierId] = useState<string | null>(template?.supplierId ?? null);
  const [tariffId, setTariffId] = useState<string | null>(template?.tariffId ?? null);
  const [power, setPower] = useState(template?.contractedPowerKw != null ? String(template.contractedPowerKw).replace('.', ',') : '');
  const [validFrom, setValidFrom] = useState(contract?.validFrom ?? (template ? toIsoDate(new Date()) : defaultFrom));
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const from = parseIsoDate(validFrom);
      const powerValue = power.trim() ? parseDecimal(power) : null;
      if (!tariffId) throw new ValidationError('Wybierz taryfę.');
      if (!from) throw new ValidationError('Wybierz datę początku umowy.');
      if (contract?.validTo && from > contract.validTo) throw new ValidationError('Początek umowy nie może być późniejszy niż jej koniec.');
      if (power.trim() && (powerValue === null || powerValue <= 0)) throw new ValidationError('Moc umowna musi być dodatnią liczbą.');
      const body = { operatorId, supplierId, tariffId, contractedPowerKw: powerValue, validFrom: from, validTo: contract?.validTo ?? null };
      return contract ? propertyApi.updateContract(contract.id, body) : propertyApi.setContract(propertyId, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      onDone();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Screen>
      <Card>
        <SectionTitle>{contract ? 'Popraw umowę' : 'Nowa umowa'}</SectionTitle>
        <Chips label="Operator dystrybucyjny" value={operatorId} onChange={setOperatorId} options={operators.map((o) => ({ value: o.id, label: o.name }))} />
        <Chips label="Sprzedawca energii" value={supplierId} onChange={setSupplierId} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        <Chips label="Taryfa" value={tariffId} onChange={setTariffId} options={tariffs.map((t) => ({ value: t.id, label: t.code }))} />
        <Field label="Moc umowna kW (opcjonalnie)" value={power} onChangeText={setPower} keyboardType="decimal-pad" />
        <DateField label="Obowiązuje od" value={validFrom} onChange={setValidFrom}
          hint={contract ? 'Zmień, jeśli data została wpisana z błędem.' : 'Poprzednia umowa zostanie zakończona dzień wcześniej.'} />
        <Body muted>Zmiana taryfy wymaga licznika z rejestrami dla jej stref oraz stawek dla nowej taryfy.</Body>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button title={contract ? 'Zapisz poprawki' : 'Zapisz umowę'} onPress={() => save.mutate()} loading={save.isPending} />
        {canCancel ? <Button title="Anuluj" variant="ghost" onPress={onDone} /> : null}
      </Card>
    </Screen>
  );
}
