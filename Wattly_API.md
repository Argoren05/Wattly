# Wattly – wstępny kontrakt REST API

> Dokument opisuje proponowane endpointy. Nie są one jeszcze zaimplementowane. Nazwy i formaty należy zatwierdzić przed rozpoczęciem kodowania.

## 1. Konwencje

- Prefiks: `/api/v1`
- Format: JSON
- Daty: ISO 8601 z informacją o strefie/offset, gdy dotyczy.
- Identyfikatory: UUID.
- Kwoty: wartości dziesiętne z walutą.
- Listy: paginacja przez `page` i `pageSize` lub cursor – do decyzji.
- Błędy: jednolity format Problem Details.
- Autoryzacja: bezpieczna sesja/token; szczegóły zależne od wybranego modelu mobilnego.

## 2. Konto

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /users/me`

## 3. Nieruchomości

- `GET /properties`
- `POST /properties`
- `GET /properties/{propertyId}`
- `PUT /properties/{propertyId}`
- `DELETE /properties/{propertyId}`

## 4. Operatorzy, sprzedawcy i taryfy

- `GET /catalog/operators`
- `GET /catalog/suppliers`
- `GET /catalog/tariffs`
- `GET /catalog/tariffs/{tariffId}/rate-plans`
- `GET /properties/{propertyId}/energy-contract`
- `PUT /properties/{propertyId}/energy-contract`

Endpoint kontraktu powinien pozwalać wskazać sprzedawcę, operatora dystrybucyjnego, taryfę i daty obowiązywania.

## 5. Liczniki i rejestry

- `GET /properties/{propertyId}/meters`
- `POST /properties/{propertyId}/meters`
- `GET /meters/{meterId}`
- `PUT /meters/{meterId}`
- `GET /meters/{meterId}/registers`
- `POST /meters/{meterId}/registers`

## 6. Odczyty

- `GET /registers/{registerId}/readings?from=&to=&page=`
- `POST /registers/{registerId}/readings`
- `GET /readings/{readingId}`
- `PUT /readings/{readingId}`
- `POST /readings/{readingId}/void`

Przykładowy payload:
```json
{
  "readingAt": "2026-10-30T18:00:00+01:00",
  "value": 4821.6,
  "source": "Manual",
  "note": null
}
```

API powinno zwrócić informację o walidacji oraz ewentualnym nietypowym skoku wskazania. Nietypowy odczyt nie zawsze musi być blokowany – może wymagać potwierdzenia.

## 7. Kalkulacje i analityka

- `POST /properties/{propertyId}/calculations/preview`
- `GET /properties/{propertyId}/calculations`
- `GET /calculations/{calculationId}`
- `GET /properties/{propertyId}/analytics/consumption`
- `GET /properties/{propertyId}/analytics/costs`
- `GET /properties/{propertyId}/forecast`

Każda odpowiedź kalkulacji powinna zawierać:
- okres;
- zużycie;
- źródłowe odczyty;
- użyty cennik i jego wersję;
- rozbicie składników;
- kwotę netto, podatek i brutto, jeśli można je wyliczyć;
- informację, czy wynik jest szacunkowy;
- założenia i ograniczenia.

## 8. Faktury

- `GET /properties/{propertyId}/invoices`
- `POST /properties/{propertyId}/invoices`
- `GET /invoices/{invoiceId}`
- `PUT /invoices/{invoiceId}`
- `DELETE /invoices/{invoiceId}`
- `POST /invoices/{invoiceId}/attachments`

## 9. OCR – przyszły etap

- `POST /ocr/meter-reading`
- `POST /ocr/invoice`

OCR powinien zwracać propozycję danych i poziom pewności. Nie powinien automatycznie zatwierdzać odczytu ani faktury bez potwierdzenia użytkownika.

## 10. Bezpieczeństwo API

- Każdy endpoint sprawdza uprawnienia do wskazanej nieruchomości/licznika.
- Nie ufać identyfikatorom przekazanym przez klienta bez weryfikacji własności.
- Walidować typ, rozmiar i zawartość załączników.
- Stosować limity żądań dla logowania i kosztownych operacji.
- Nie ujawniać w błędach danych innych użytkowników.
- Rejestrować ważne operacje administracyjne.
