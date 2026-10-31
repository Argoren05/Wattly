import { http } from './client';
import type {
  Attachment, CalculationResult, CatalogEntry, EnergyContract, EnergyContractRequest, Forecast, Granularity, Invoice,
  InvoiceRequest, Meter, MobileRelease, MeterRequest, PagedResult, Property, PropertyRequest, RatePlan, RatePlanRequest, Reading,
  ReadingRequest, ReadingSaved, Series, Tariff, TokenResponse, User,
} from './types';

/** Account endpoints (ASP.NET Core Identity). */
export const authApi = {
  register: (email: string, password: string) => http.post<void>('/auth/register', { email, password }),
  login: (email: string, password: string) => http.post<TokenResponse>('/auth/login', { email, password }),
  /** Exchanges a Google/Microsoft/Apple/Facebook token for Wattly session tokens. */
  external: (provider: string, token: string, nonce?: string) =>
    http.post<TokenResponse>('/auth/external', { provider, token, nonce: nonce ?? null }),
  logout: () => http.post<void>('/auth/logout'),
  forgotPassword: (email: string) => http.post<void>('/auth/forgotPassword', { email }),
  me: () => http.get<User>('/users/me'),
};

/** Catalog of operators, suppliers and tariffs. */
export const catalogApi = {
  operators: () => http.get<CatalogEntry[]>('/catalog/operators'),
  suppliers: () => http.get<CatalogEntry[]>('/catalog/suppliers'),
  tariffs: () => http.get<Tariff[]>('/catalog/tariffs'),
};

/** Properties, energy contracts and the user's own rate plans. */
export const propertyApi = {
  list: () => http.get<Property[]>('/properties'),
  get: (id: string) => http.get<Property>(`/properties/${id}`),
  create: (body: PropertyRequest) => http.post<Property>('/properties', body),
  update: (id: string, body: PropertyRequest) => http.put<Property>(`/properties/${id}`, body),
  remove: (id: string) => http.delete(`/properties/${id}`),
  contract: (id: string) => http.get<EnergyContract>(`/properties/${id}/energy-contract`),
  setContract: (id: string, body: EnergyContractRequest) => http.put<EnergyContract>(`/properties/${id}/energy-contract`, body),
  contracts: (id: string) => http.get<EnergyContract[]>(`/properties/${id}/energy-contracts`),
  /** Corrects an existing contract in place (e.g. a wrong start date). */
  updateContract: (contractId: string, body: EnergyContractRequest) => http.put<EnergyContract>(`/energy-contracts/${contractId}`, body),
  removeContract: (contractId: string) => http.delete(`/energy-contracts/${contractId}`),
  ratePlans: (id: string) => http.get<RatePlan[]>(`/properties/${id}/rate-plans`),
  createRatePlan: (id: string, body: RatePlanRequest) => http.post<RatePlan>(`/properties/${id}/rate-plans`, body),
  endRatePlan: (planId: string, validTo: string) => http.post<RatePlan>(`/rate-plans/${planId}/end`, { validTo }),
  /** Corrects the user's own rate plan (dates and all rates are replaced). */
  updateRatePlan: (planId: string, body: RatePlanRequest) => http.put<RatePlan>(`/rate-plans/${planId}`, body),
  removeRatePlan: (planId: string) => http.delete(`/rate-plans/${planId}`),
};

/** Meters and their registers. */
export const meterApi = {
  list: (propertyId: string) => http.get<Meter[]>(`/properties/${propertyId}/meters`),
  create: (propertyId: string, body: MeterRequest) => http.post<Meter>(`/properties/${propertyId}/meters`, body),
};

/** Meter readings: list, add, correct and void. */
export const readingApi = {
  list: (registerId: string, page = 1, includeInactive = false) =>
    http.get<PagedResult<Reading>>(`/registers/${registerId}/readings?page=${page}&pageSize=50&includeInactive=${includeInactive}`),
  get: (id: string) => http.get<Reading>(`/readings/${id}`),
  /**
   * Active readings right before and right after a moment – used to preview a new (possibly back-dated) reading.
   * The API lists newest first, so the next reading is the last item of the readings from `at` onwards.
   * @param registerId Register.
   * @param at ISO instant of the new reading.
   */
  neighbors: async (registerId: string, at: string): Promise<{ previous: Reading | null; next: Reading | null }> => {
    const base = `/registers/${registerId}/readings?pageSize=1`;
    const before = await http.get<PagedResult<Reading>>(`${base}&to=${encodeURIComponent(at)}`);
    const after = await http.get<PagedResult<Reading>>(`${base}&from=${encodeURIComponent(at)}`);
    const previous = before.items[0] ?? null;
    let next = after.totalCount > 0 ? (after.totalCount === 1 ? after.items[0] ?? null : null) : null;
    if (after.totalCount > 1) next = (await http.get<PagedResult<Reading>>(`${base}&from=${encodeURIComponent(at)}&page=${after.totalCount}`)).items[0] ?? null;
    // A reading at exactly the same moment is a duplicate (reported by the API on save), not a later reading.
    if (next && previous && next.id === previous.id) next = null;
    return { previous, next };
  },
  create: (registerId: string, body: ReadingRequest) => http.post<ReadingSaved>(`/registers/${registerId}/readings`, body),
  correct: (id: string, body: ReadingRequest) => http.put<ReadingSaved>(`/readings/${id}`, body),
  void: (id: string, reason: string | null) => http.post<Reading>(`/readings/${id}/void`, { reason }),
};

/** Forecast, consumption/cost series and calculation previews. */
export const analyticsApi = {
  forecast: (propertyId: string) => http.get<Forecast>(`/properties/${propertyId}/forecast`),
  consumption: (propertyId: string, from: string, to: string, granularity: Granularity) =>
    http.get<Series>(`/properties/${propertyId}/analytics/consumption?from=${from}&to=${to}&granularity=${granularity}`),
  costs: (propertyId: string, from: string, to: string, granularity: Granularity) =>
    http.get<Series>(`/properties/${propertyId}/analytics/costs?from=${from}&to=${to}&granularity=${granularity}`),
  preview: (propertyId: string, from: string, to: string) =>
    http.post<CalculationResult>(`/properties/${propertyId}/calculations/preview`, { from, to }),
};

/** Invoices and their attachments. */
export const invoiceApi = {
  list: (propertyId: string) => http.get<Invoice[]>(`/properties/${propertyId}/invoices`),
  get: (id: string) => http.get<Invoice>(`/invoices/${id}`),
  create: (propertyId: string, body: InvoiceRequest) => http.post<Invoice>(`/properties/${propertyId}/invoices`, body),
  remove: (id: string) => http.delete(`/invoices/${id}`),
  attach: (id: string, file: FormData) => http.post<Attachment>(`/invoices/${id}/attachments`, file),
};

/** Endpoints used by the app itself (no sign-in required). */
export const appApi = {
  /** Native installer status for the installed version. */
  release: (platform: 'android' | 'ios', version: string) =>
    http.get<MobileRelease>(`/app/release?platform=${platform}&version=${encodeURIComponent(version)}`),
};
