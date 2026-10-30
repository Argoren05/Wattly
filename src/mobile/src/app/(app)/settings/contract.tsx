import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { errorMessage, ValidationError } from '../../../api/errors';
import { propertyApi } from '../../../api/endpoints';
import type { CatalogEntry, EnergyContract, Tariff } from '../../../api/types';
import { Body, Button, Card, Chips, ErrorState, Field, Loading, Notice, Screen } from '../../../components/ui';
import { useCatalog, useContract } from '../../../hooks/queries';
import { useRequiredProperty } from '../../../state/PropertyContext';
import { parseDecimal, parseIsoDate, toIsoDate } from '../../../utils/format';

/** Loads the catalog and current contract, then renders the form. */
export default function ContractSettings() {
  const property = useRequiredProperty();
  const catalog = useCatalog();
  const contract = useContract(property.id);

  if (catalog.isLoading || contract.isLoading) return <Loading />;
  if (catalog.error || !catalog.data) return <Screen><ErrorState error={catalog.error} onRetry={() => catalog.refetch()} /></Screen>;
  return <ContractForm propertyId={property.id} contract={contract.data ?? null} {...catalog.data} />;
}

/** Contract form initialised once from the loaded contract. */
function ContractForm({ propertyId, contract, operators, suppliers, tariffs }: {
  propertyId: string;
  contract: EnergyContract | null;
  operators: CatalogEntry[];
  suppliers: CatalogEntry[];
  tariffs: Tariff[];
}) {
  const queryClient = useQueryClient();
  const [operatorId, setOperatorId] = useState<string | null>(contract?.operatorId ?? null);
  const [supplierId, setSupplierId] = useState<string | null>(contract?.supplierId ?? null);
  const [tariffId, setTariffId] = useState<string | null>(contract?.tariffId ?? null);
  const [power, setPower] = useState(contract?.contractedPowerKw != null ? String(contract.contractedPowerKw) : '');
  const [validFrom, setValidFrom] = useState(contract?.validFrom ?? toIsoDate(new Date()));
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const from = parseIsoDate(validFrom);
      const powerValue = power.trim() ? parseDecimal(power) : null;
      if (!tariffId) throw new ValidationError('Wybierz taryfę.');
      if (!from) throw new ValidationError('Podaj datę w formacie RRRR-MM-DD.');
      if (power.trim() && (powerValue === null || powerValue <= 0)) throw new ValidationError('Moc umowna musi być dodatnią liczbą.');
      return propertyApi.setContract(propertyId, { operatorId, supplierId, tariffId, contractedPowerKw: powerValue, validFrom: from, validTo: null });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.back();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Screen>
      <Card>
        <Chips label="Operator dystrybucyjny" value={operatorId} onChange={setOperatorId} options={operators.map((o) => ({ value: o.id, label: o.name }))} />
        <Chips label="Sprzedawca energii" value={supplierId} onChange={setSupplierId} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        <Chips label="Taryfa" value={tariffId} onChange={setTariffId} options={tariffs.map((t) => ({ value: t.id, label: t.code }))} />
        <Field label="Moc umowna kW (opcjonalnie)" value={power} onChangeText={setPower} keyboardType="decimal-pad" />
        <Field label="Obowiązuje od" value={validFrom} onChangeText={setValidFrom} placeholder="RRRR-MM-DD"
          hint="Nowa data utworzy kolejną umowę – poprzednia zostanie zamknięta dzień wcześniej." />
        <Body muted>Zmiana taryfy wymaga licznika z rejestrami dla jej stref oraz stawek dla nowej taryfy.</Body>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button title="Zapisz umowę" onPress={() => save.mutate()} loading={save.isPending} />
      </Card>
    </Screen>
  );
}
