import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '../../../api/errors';
import { meterApi } from '../../../api/endpoints';
import { Body, Button, Card, Chips, ErrorState, Field, KeyValue, Loading, Notice, Screen, SectionTitle } from '../../../components/ui';
import { keys, useCatalog, useContract, useMeters } from '../../../hooks/queries';
import { useRequiredProperty } from '../../../state/PropertyContext';

export default function MetersSettings() {
  const property = useRequiredProperty();
  const queryClient = useQueryClient();
  const meters = useMeters(property.id);
  const catalog = useCatalog();
  const contract = useContract(property.id);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('Licznik');
  const [serial, setSerial] = useState('');
  const [direction, setDirection] = useState<'ImportOnly' | 'Bidirectional'>('ImportOnly');
  const tariff = catalog.data?.tariffs.find((t) => t.id === contract.data?.tariffId);

  const create = useMutation({
    mutationFn: () => {
      const zones = tariff?.zones ?? [];
      const registers = [
        ...(zones.length === 0
          ? [{ name: 'Pobór', registerType: 'Import' as const, zoneCode: null }]
          : zones.map((z) => ({ name: `Pobór – ${z.name}`, registerType: 'Import' as const, zoneCode: z.code }))),
        ...(direction === 'Bidirectional' ? [{ name: 'Oddawanie', registerType: 'Export' as const, zoneCode: null }] : []),
      ];
      return meterApi.create(property.id, { name: name.trim(), serialNumber: serial.trim() || null, meterType: 'Conventional', directionality: direction, registers });
    },
    onSuccess: async () => {
      setAdding(false);
      await queryClient.invalidateQueries({ queryKey: keys.meters(property.id) });
    },
  });

  if (meters.isLoading) return <Loading />;
  if (meters.error) return <Screen><ErrorState error={meters.error} onRetry={() => meters.refetch()} /></Screen>;

  return (
    <Screen>
      {meters.data?.map((m) => (
        <Card key={m.id}>
          <SectionTitle>{m.name}</SectionTitle>
          {m.serialNumber ? <KeyValue label="Numer" value={m.serialNumber} /> : null}
          <KeyValue label="Kierunek" value={m.directionality === 'Bidirectional' ? 'Dwukierunkowy' : 'Pobór'} />
          {m.registers.map((r) => (
            <KeyValue key={r.id} label={r.name} value={`${r.registerType === 'Import' ? 'pobór' : 'oddawanie'}${r.zoneCode ? ` · ${r.zoneCode}` : ''}`} />
          ))}
        </Card>
      ))}

      {adding ? (
        <Card>
          <Field label="Nazwa" value={name} onChangeText={setName} />
          <Field label="Numer licznika (opcjonalnie)" value={serial} onChangeText={setSerial} />
          <Chips label="Kierunek pracy" value={direction} onChange={setDirection}
            options={[{ value: 'ImportOnly', label: 'Tylko pobór' }, { value: 'Bidirectional', label: 'Dwukierunkowy (PV)' }]} />
          <Body muted>Rejestry zostaną utworzone dla stref taryfy {tariff?.code ?? '(brak umowy – jeden rejestr)'}.</Body>
          {create.error ? <Notice tone="danger">{errorMessage(create.error)}</Notice> : null}
          <Button title="Dodaj licznik" onPress={() => create.mutate()} loading={create.isPending} />
          <Button title="Anuluj" variant="ghost" onPress={() => setAdding(false)} />
        </Card>
      ) : (
        <Button title="Dodaj licznik" icon="add-circle-outline" variant="secondary" onPress={() => setAdding(true)} />
      )}
    </Screen>
  );
}
