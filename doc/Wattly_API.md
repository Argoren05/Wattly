# Wattly – kontrakt REST API

> Stan: zaimplementowane w `src/backend/Wattly.Api` (wersja `v1`). W środowisku Development specyfikacja OpenAPI jest dostępna pod `/openapi/v1.json`.

## 1. Konwencje

- Prefiks: `/api/v1`
- Format: JSON, nazwy pól w camelCase, enumy jako tekst (np. `"Manual"`).
- Daty dzienne: `YYYY-MM-DD`; chwile: ISO 8601 z offsetem – API zapisuje je w UTC.
- Identyfikatory: UUID (v7).
- Kwoty: liczby dziesiętne; waluta w polu `currencyCode` nieruchomości/wyniku.
- Listy: paginacja `page` / `pageSize` (domyślnie 50, maks. 200), odpowiedź `{ items, page, pageSize, totalCount }` (DEC-014).
- Błędy: Problem Details (RFC 9457) z `traceId`; walidacja → `400` z `errors` (pole → komunikaty); konflikty → `409` z polem `code`.
- Autoryzacja: nagłówek `Authorization: Bearer <accessToken>` (DEC-015).
- Nagłówek `X-Correlation-ID` jest przyjmowany lub generowany i zwracany w odpowiedzi.
- Dostęp do cudzych zasobów zwraca `404` (bez ujawniania, że zasób istnieje).

### Kody błędów domenowych (`code`)

| Kod | Znaczenie |
|---|---|
| `reading.duplicate` | Aktywny odczyt rejestru z tą samą chwilą już istnieje |
| `reading.not_monotonic` | Wskazanie mniejsze od poprzedniego lub większe od następnego |
| `reading.anomaly_requires_confirmation` | Nietypowy skok – ponów z `confirmAnomaly: true` |
| `reading.not_active` | Korekta/anulowanie odczytu, który nie jest aktywny |
| `rate_plan.overlap` | Cennik w tym samym zakresie nakłada się okresem obowiązywania |
| `contract.overlap` | Umowa nakłada się na późniejszą umowę |
| `catalog.duplicate_code` | Kod operatora/sprzedawcy/taryfy już istnieje |
| `external.invalid_token` | Token dostawcy logowania nieprawidłowy, wygasły lub wydany dla innej aplikacji |
| `external.email_missing` | Dostawca nie udostępnił adresu e-mail |
| `external.email_in_use` | Istnieje konto z tym adresem, a dostawca nie potwierdził adresu – zaloguj się hasłem |

## 2. Konto (`/auth`, limit 10 żądań/min/IP)

Endpointy ASP.NET Core Identity (`MapIdentityApi`):
- `POST /auth/register` `{ email, password }`
- `POST /auth/login` `{ email, password }` → `{ tokenType, accessToken, expiresIn, refreshToken }`
- `POST /auth/refresh` `{ refreshToken }`
- `POST /auth/forgotPassword`, `POST /auth/resetPassword`, `POST /auth/manage/info` i pozostałe endpointy Identity
- `POST /auth/external` `{ provider: "google" | "microsoft" | "apple" | "facebook", token, nonce? }` → te same tokeny co `/auth/login` (DEC-024)
  - `token` – ID token (Google, Microsoft, Apple) albo access token użytkownika (Facebook)
  - błędy: `401 external.invalid_token`, `401 external.email_missing`, `409 external.email_in_use` (konto z tym adresem już istnieje, a dostawca nie potwierdził adresu), `400` – nieznany lub nieskonfigurowany dostawca, `403` – konto zablokowane
- `POST /auth/logout` – unieważnia tokeny odświeżania użytkownika
- `GET /users/me` → `{ id, email, roles }`

## 3. Nieruchomości

- `GET /properties`
- `POST /properties` `{ name, addressLine?, postalCode?, city?, countryCode?, timeZoneId?, currencyCode?, billingPeriodMonths?, billingAnchorDate?, monthlyBudget? }`
- `GET /properties/{propertyId}`
- `PUT /properties/{propertyId}`
- `DELETE /properties/{propertyId}` – usuwa nieruchomość wraz z licznikami, odczytami, umowami, cennikami własnymi, fakturami i załącznikami

## 4. Katalog, umowy i cenniki

- `GET /catalog/operators`, `GET /catalog/suppliers`, `GET /catalog/tariffs`, `GET /catalog/tariffs/{tariffId}`
- `GET /catalog/tariffs/{tariffId}/rate-plans` – cenniki katalogowe
- `GET /properties/{propertyId}/energy-contract` – umowa obowiązująca dziś (lub ostatnia)
- `PUT /properties/{propertyId}/energy-contract` `{ supplierId?, operatorId?, tariffId, contractedPowerKw?, validFrom, validTo? }` – umowa z tym samym `validFrom` jest aktualizowana, wcześniejsza otwarta umowa zamykana dzień wcześniej
- `GET /properties/{propertyId}/energy-contracts` – historia umów
- `GET /properties/{propertyId}/rate-plans`, `POST /properties/{propertyId}/rate-plans` – cenniki własne użytkownika
- `GET /rate-plans/{ratePlanId}`
- `POST /rate-plans/{ratePlanId}/end` `{ validTo }` – skrócenie okresu obowiązywania (cenniki są niezmienne)

Przykład cennika:
```json
{
  "tariffId": "…",
  "name": "Stawki z faktury 10/2026",
  "validFrom": "2026-10-01",
  "sourceReference": "Faktura FV/123/2026",
  "components": [
    { "componentType": "Energy", "name": "Energia – dzień", "zoneCode": "DAY", "unit": "Kwh", "netRate": 0.62, "taxRate": 0.23 },
    { "componentType": "FixedDistribution", "name": "Opłata stała", "unit": "Month", "netRate": 10.5, "taxRate": 0.23 }
  ]
}
```

Dozwolone jednostki: `Energy`/`VariableDistribution` → `Kwh`; `FixedDistribution`/`Subscription` → `Month`/`Day`; `Capacity` → `Month`/`Kwh`/`Kw` (Kw × moc umowna); `Other` → dowolna. Strefę (`zoneCode`) można wskazać tylko dla `Kwh`.

### Administracja (rola `Admin`)

- `GET/POST /admin/operators`, `PUT /admin/operators/{id}`
- `GET/POST /admin/suppliers`, `PUT /admin/suppliers/{id}`
- `GET/POST /admin/tariffs`, `PUT /admin/tariffs/{id}`
- `POST /admin/tariffs/{tariffId}/rate-plans` – cennik katalogowy

## 5. Liczniki i rejestry

- `GET /properties/{propertyId}/meters`
- `POST /properties/{propertyId}/meters` `{ name, serialNumber?, meterType, directionality, installedAt?, registers?: [{ name, registerType, zoneCode?, code?, decimalPlaces? }] }` – bez `registers` tworzony jest jeden rejestr poboru
- `GET /meters/{meterId}`, `PUT /meters/{meterId}`
- `GET /meters/{meterId}/registers`, `POST /meters/{meterId}/registers`

## 6. Odczyty

- `GET /registers/{registerId}/readings?from=&to=&includeInactive=&page=&pageSize=` – każdy element zawiera `consumptionSincePrevious` i `daysSincePrevious`
- `POST /registers/{registerId}/readings`
- `GET /readings/{readingId}`
- `PUT /readings/{readingId}` – korekta: tworzy nowy odczyt, poprzedni otrzymuje status `Superseded`
- `POST /readings/{readingId}/void` `{ reason? }`

```json
{
  "readingAt": "2026-10-30T18:00:00+01:00",
  "value": 4821.6,
  "source": "Manual",
  "note": null,
  "confirmAnomaly": false
}
```

Odpowiedź `201`: `{ reading, warnings: [{ code, message }] }`.

## 7. Kalkulacje, analityka i prognoza

- `POST /properties/{propertyId}/calculations/preview` `{ from, to }` – bez zapisu
- `POST /properties/{propertyId}/calculations` `{ from, to }` – zapis z migawką stawek
- `GET /properties/{propertyId}/calculations?page=&pageSize=`
- `GET /calculations/{calculationId}` – zapisany wynik (stawki z migawki)
- `GET /properties/{propertyId}/analytics/consumption?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=Day|Week|Month|Year`
- `GET /properties/{propertyId}/analytics/costs?from=&to=&granularity=`
- `GET /properties/{propertyId}/forecast` – bieżący okres rozliczeniowy: zużycie i koszt do ostatniego odczytu, prognoza do końca okresu, średnie dzienne, budżet, kompletność konfiguracji

Wynik kalkulacji zawiera: okres, zużycie (łącznie i per strefa), wartości źródłowe rejestrów na granicach okresu z rodzajem (`Actual`/`Interpolated`/`Extrapolated`), użyte cenniki z ich źródłem, linie składników, podsumowanie VAT, kwoty netto/VAT/brutto, flagi `isEstimate` i `isComplete` oraz listę założeń.

## 8. Faktury

- `GET /properties/{propertyId}/invoices`, `POST /properties/{propertyId}/invoices`
- `GET /invoices/{invoiceId}`, `PUT /invoices/{invoiceId}`, `DELETE /invoices/{invoiceId}`
- `POST /invoices/{invoiceId}/attachments` – `multipart/form-data`, pole `file`; PDF/JPEG/PNG do 10 MB, typ weryfikowany sygnaturą pliku
- `GET /attachments/{attachmentId}` – pobranie (tylko właściciel)

Faktura zawiera `comparison` – szacunek Wattly dla okresu faktury i różnicę względem kwoty faktury.

## 9. Aplikacja mobilna (bez logowania)

- `GET /app/release?platform=android|ios&version=1.0.0` → `{ platform, currentVersion, latestVersion, minimumVersion, downloadUrl, releaseNotes, updateAvailable, updateRequired }`

Wartości pochodzą z konfiguracji `MobileApp:Android` i `MobileApp:Ios`. Błędna konfiguracja nigdy nie wymusza aktualizacji.

## 9a. Operacyjne

- `GET /health` – liveness
- `GET /health/ready` – gotowość (połączenie z bazą)

## 10. OCR – przyszły etap (niezaimplementowane)

- `POST /ocr/meter-reading`, `POST /ocr/invoice` – OCR ma zwracać propozycję i poziom pewności; zatwierdza użytkownik (DEC-009).

## 11. Bezpieczeństwo API

- Każdy endpoint (poza `/auth/*` i `/health*`) wymaga uwierzytelnienia; dane filtrowane są po właścicielu gospodarstwa.
- Identyfikatory od klienta są zawsze weryfikowane względem właściciela.
- Załączniki: limit rozmiaru, weryfikacja sygnatury, nazwa pliku sanityzowana, klucz storage generowany przez serwer.
- Limity żądań: logowanie/rejestracja 10/min/IP, globalnie 300/min na użytkownika.
- Błędy 5xx nie ujawniają szczegółów; logi bez haseł i tokenów.
- Zmiany umów, cenników, odczytów i faktur trafiają do `AuditEvents`.
