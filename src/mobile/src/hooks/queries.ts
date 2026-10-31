import { useQuery, useQueryClient } from '@tanstack/react-query';

import { catalogApi, meterApi, propertyApi } from '../api/endpoints';
import type { Meter, Register } from '../api/types';

/** Query keys of server data; shared so mutations can invalidate them. */
export const keys = {
  meters: (propertyId: string) => ['meters', propertyId] as const,
  contract: (propertyId: string) => ['contract', propertyId] as const,
  ratePlans: (propertyId: string) => ['ratePlans', propertyId] as const,
  forecast: (propertyId: string) => ['forecast', propertyId] as const,
  readings: (registerId: string) => ['readings', registerId] as const,
  reading: (id: string) => ['reading', id] as const,
  series: (propertyId: string) => ['series', propertyId] as const,
  invoices: (propertyId: string) => ['invoices', propertyId] as const,
  invoice: (id: string) => ['invoice', id] as const,
  catalog: ['catalog'] as const,
};

/** Register together with the name of its meter (for pickers). */
export interface RegisterOption extends Register {
  meterName: string;
}

/**
 * Meters of a property.
 * @param propertyId Property.
 */
export function useMeters(propertyId: string) {
  return useQuery({ queryKey: keys.meters(propertyId), queryFn: () => meterApi.list(propertyId) });
}

/**
 * Registers of all active meters, flattened for pickers.
 * @param meters Meters (may be undefined while loading).
 */
export function importRegisters(meters: Meter[] | undefined): RegisterOption[] {
  return (meters ?? [])
    .filter((m) => m.isActive)
    .flatMap((m) => m.registers.map((r) => ({ ...r, meterName: m.name })));
}

/** Operators, suppliers and tariffs, cached for an hour (they rarely change). */
export function useCatalog() {
  return useQuery({
    queryKey: keys.catalog,
    queryFn: async () => {
      const [operators, suppliers, tariffs] = await Promise.all([catalogApi.operators(), catalogApi.suppliers(), catalogApi.tariffs()]);
      return { operators, suppliers, tariffs };
    },
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * Current contract of a property; null when none exists (404).
 * @param propertyId Property.
 */
export function useContract(propertyId: string) {
  return useQuery({
    queryKey: keys.contract(propertyId),
    queryFn: () => propertyApi.contract(propertyId).catch((e: { status?: number }) => (e.status === 404 ? null : Promise.reject(e))),
  });
}

/** Everything derived from readings or prices must be refreshed together. */
/** Returns a function refreshing everything derived from readings or prices. */
export function useInvalidateEnergyData() {
  const client = useQueryClient();
  return (propertyId: string) =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.forecast(propertyId) }),
      client.invalidateQueries({ queryKey: keys.series(propertyId) }),
      client.invalidateQueries({ queryKey: keys.invoices(propertyId) }),
      client.invalidateQueries({ queryKey: ['readings'] }),
    ]);
}
