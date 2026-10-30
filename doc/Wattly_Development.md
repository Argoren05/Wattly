# Wattly – uruchomienie i development

## Wymagania

- .NET SDK 10
- Node.js 22 + npm
- PostgreSQL 16 (lokalnie lub przez Docker Compose)
- Aplikacja Expo Go lub development build na telefonie / emulatorze

## Backend

### Baza danych przez Docker Compose

```bash
cp src/.env.example src/.env        # ustaw POSTGRES_PASSWORD
docker compose -f src/docker-compose.yml up --build
```

API: `http://localhost:5103`, migracje stosowane automatycznie (`Database__MigrateOnStartup=true`).

### Lokalnie (bez Dockera)

1. Utwórz bazę i użytkownika zgodnie z `src/backend/Wattly.Api/appsettings.Development.json` (lub nadpisz connection string przez user-secrets / zmienną `ConnectionStrings__Wattly`):
   ```sql
   CREATE ROLE wattly LOGIN PASSWORD 'wattly_dev_password';
   CREATE DATABASE wattly OWNER wattly;
   ```
2. Uruchom API:
   ```bash
   cd src/backend
   dotnet run --project Wattly.Api
   ```
   W trybie Development migracje stosują się przy starcie, a seed tworzy katalog operatorów, sprzedawców i taryf (bez stawek).
3. Opcjonalnie pierwszy administrator: zmienne `Seed__AdminEmail` i `Seed__AdminPassword` (nie commituj ich).

### Migracje

```bash
cd src/backend
dotnet tool restore
dotnet ef migrations add <Nazwa> -p Wattly.Infrastructure -s Wattly.Api -o Persistence/Migrations
```

### Testy

```bash
cd src/backend
dotnet test
```

Testy integracyjne tworzą tymczasową bazę na serwerze PostgreSQL wskazanym w `WATTLY_TEST_POSTGRES` (domyślnie `Host=localhost;Port=5432;Username=postgres;Password=postgres`) i usuwają ją po zakończeniu.

## Aplikacja mobilna

```bash
cd src/mobile
npm install
cp .env.example .env.local     # EXPO_PUBLIC_API_URL
npx expo start
```

- Na fizycznym telefonie ustaw `EXPO_PUBLIC_API_URL` na adres IP komputera w sieci LAN (np. `http://192.168.1.10:5103`), a nie `localhost`.
- Kontrole jakości: `npm run typecheck`, `npm run lint`, `npm test`.
- Nowe moduły natywne instaluj przez `npx expo install <pakiet>`, aby wersje były zgodne z SDK.

## Konfiguracja (najważniejsze klucze API)

| Klucz | Opis |
|---|---|
| `ConnectionStrings:Wattly` | Połączenie z PostgreSQL |
| `Database:MigrateOnStartup` | Migracje przy starcie (zalecane tylko dev/test; na produkcji krok wdrożenia) |
| `Auth:AccessTokenMinutes`, `Auth:RefreshTokenDays` | Czas życia tokenów |
| `RateLimiting:AuthPerMinute`, `RateLimiting:GlobalPerMinute` | Limity żądań |
| `Storage:LocalPath` | Katalog załączników (poza web root) |
| `Cors:AllowedOrigins` | Dozwolone originy (tylko dla wersji web) |
| `Http:RedirectToHttps` | Przekierowanie na HTTPS (gdy TLS nie kończy się na proxy) |

Sekrety (hasła, connection stringi produkcyjne) przekazuj przez zmienne środowiskowe lub menedżer sekretów – nigdy przez repozytorium.

## Znane ograniczenia MVP

- Brak wysyłki e-maili (reset hasła) poza logiem w Development – DEC-016.
- Powiadomienia, OCR, eksport, tryb offline – kolejne etapy roadmapy.
- Rejestry oddawania energii (PV) są przechowywane, ale nie wchodzą do kalkulacji kosztów.
- Godziny stref taryfowych nie są modelowane – zużycie stref pochodzi z rejestrów licznika.
- Storage załączników jest lokalny (jedna instancja API); przy skalowaniu potrzebny storage obiektowy zgodny z `IFileStorage`.
