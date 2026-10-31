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
  ratePlans: (id: string) => http.get<RatePlan[]>(`/properties/${id}/rate-plans`),
  createRatePlan: (id: string, body: RatePlanRequest) => http.post<RatePlan>(`/properties/${id}/rate-plans`, body),
  endRatePlan: (planId: string, validTo: string) => http.post<RatePlan>(`/rate-plans/${planId}/end`, { validTo }),
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
