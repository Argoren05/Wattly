import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { propertyApi } from '../api/endpoints';
import type { Property } from '../api/types';
import { useAuth } from '../auth/AuthContext';

interface PropertyState {
  properties: Property[];
  property: Property | null;
  isLoading: boolean;
  error: unknown;
  select(id: string): void;
  refetch(): void;
}

const PropertyContext = createContext<PropertyState | null>(null);

export const queryKeys = {
  properties: ['properties'] as const,
  property: (id: string) => ['property', id] as const,
};

export function PropertyProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useQuery({ queryKey: queryKeys.properties, queryFn: propertyApi.list, enabled: isSignedIn });

  const value = useMemo<PropertyState>(() => {
    const properties = query.data ?? [];
    const property = properties.find((p) => p.id === selectedId) ?? properties[0] ?? null;
    return {
      properties,
      property,
      isLoading: query.isLoading,
      error: query.error,
      select: setSelectedId,
      refetch: () => void query.refetch(),
    };
  }, [query, selectedId]);

  return <PropertyContext.Provider value={value}>{children}</PropertyContext.Provider>;
}

export function useProperty(): PropertyState {
  const context = useContext(PropertyContext);
  if (!context) throw new Error('useProperty must be used inside PropertyProvider');
  return context;
}

/** Selected property; screens using it are rendered only after onboarding created one. */
export function useRequiredProperty(): Property {
  const { property } = useProperty();
  if (!property) throw new Error('No property selected');
  return property;
}
