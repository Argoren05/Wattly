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

Testy jednostkowe (serwisy na EF Core InMemory, domena, infrastruktura, middleware) nie wymagają bazy. Testy integracyjne tworzą tymczasową bazę na serwerze PostgreSQL wskazanym w `WATTLY_TEST_POSTGRES` (domyślnie `Host=localhost;Port=5432;Username=postgres;Password=postgres`) i usuwają ją po zakończeniu.

## Aplikacja mobilna

```bash
cd src/mobile
npm install
cp .env.example .env.local     # EXPO_PUBLIC_API_URL
npx expo start
```

- Na fizycznym telefonie ustaw `EXPO_PUBLIC_API_URL` na adres IP komputera w sieci LAN (np. `http://192.168.1.10:5103`), a nie `localhost`.
- Kontrole jakości: `npm run typecheck`, `npm run lint` (wymusza JSDoc), `npm test` (Jest), `npm run test:coverage`.
- Nowe moduły natywne instaluj przez `npx expo install <pakiet>`, aby wersje były zgodne z SDK.

## Instalator na telefon (EAS Build)

Instalatory są budowane w chmurze Expo (EAS Build) – nie są potrzebne Android Studio ani Xcode, a projekt nie zawiera plików .exe ani instalatorów desktopowych.

| Profil (`src/mobile/eas.json`) | Wynik | Zastosowanie |
|---|---|---|
| `preview` | plik **APK** | instalacja bezpośrednio na telefonie z Androidem (link / kod QR) |
| `production` | AAB (Android) + build iOS | Google Play i App Store |
| `development` | development build | praca deweloperska z natywnymi modułami |

### Jednorazowa konfiguracja

1. Załóż darmowe konto na https://expo.dev i utwórz projekt **Wattly**. Konto (`owner`: `argoren`) i identyfikator projektu (`extra.eas.projectId`) są zapisane w `src/mobile/app.json` – nie są tajne.
2. W ustawieniach projektu Expo, w sekcji **GitHub**, połącz repozytorium i ustaw **Base directory** na `src/mobile`.
3. W ustawieniach konta Expo, w sekcji **Access tokens**, utwórz **robota** z rolą *Developer* i wygeneruj dla niego token. Lepiej nie używać tokenu osobistego, który daje pełny dostęp do konta. Token zapisz w GitHubie (**Settings → Secrets and variables → Actions**) jako sekret `EXPO_TOKEN`.
4. Na expo.dev, w projekcie Wattly, otwórz **Environment variables** i dodaj zmienne dla środowisk *preview* i *production* (widoczność *Plain text*; to publiczne identyfikatory, nie sekrety):

   | Zmienna | Wartość |
   |---|---|
   | `EXPO_PUBLIC_API_URL` | publiczny adres API, np. `https://api.twojadomena.pl` |
   | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google – identyfikator klienta typu *Web application* |
   | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google – identyfikator klienta *iOS* (tylko dla iOS) |
   | `EXPO_PUBLIC_MICROSOFT_CLIENT_ID` | Microsoft Entra – *Application (client) ID* |
   | `EXPO_PUBLIC_FACEBOOK_APP_ID` | Meta – *App ID* |
   | `EXPO_PUBLIC_APPLE_SIGN_IN` | `true`, aby włączyć „Zaloguj przez Apple” (iOS) |

   Builder EAS i `eas update` pobierają te zmienne zgodnie z polem `environment` w `eas.json`. Zmienne z GitHuba **nie** docierają do buildu na serwerach Expo (DEC-025). Opcjonalnie sekret `EAS_PROJECT_ID` nadpisuje identyfikator z `app.json` (np. w forku).

### Logowanie kontami zewnętrznymi (DEC-024)

Przycisk dostawcy pojawia się w aplikacji dopiero po ustawieniu jego identyfikatora (pkt 4). API musi znać te same identyfikatory – ustaw je w konfiguracji API (zmienne środowiskowe serwera):

| Dostawca | Gdzie utworzyć | Konfiguracja API |
|---|---|---|
| Google | Google Cloud Console → *APIs & Services → Credentials*: klient **Web application**, klient **Android** (pakiet `app.wattly.mobile` + odcisk SHA-1 klucza podpisu z expo.dev → *Credentials*) i opcjonalnie **iOS** (bundle `app.wattly.mobile`) | `Auth__External__Google__ClientIds__0` = identyfikator klienta *Web* |
| Microsoft | Microsoft Entra → *App registrations*: konta „dowolny katalog + osobiste konta Microsoft”, platforma *Mobile and desktop*, adres przekierowania `wattly://auth` | `Auth__External__Microsoft__ClientIds__0` = *Application (client) ID* |
| Facebook | Meta for Developers → aplikacja z produktem *Facebook Login*, prawidłowy adres przekierowania OAuth `fb<APP_ID>://authorize`, uprawnienia `public_profile` i `email` | `Auth__External__Facebook__AppId`, `Auth__External__Facebook__AppSecret` (sekret – tylko na serwerze) |
| Apple | Apple Developer → identyfikator `app.wattly.mobile` z funkcją *Sign in with Apple* (EAS Build może to ustawić automatycznie) | `Auth__External__Apple__ClientIds__0` = `app.wattly.mobile` |

Po zmianie identyfikatorów Google, Facebooka lub Apple potrzebny jest **nowy instalator** (zmieniają się ustawienia natywne). Pozostałe zmiany trafiają do telefonów jako aktualizacja OTA.

### Budowanie

- Z GitHub Actions: workflow **Mobile build** (ręcznie albo tagiem `mobile-v1.2.0`).
- Lokalnie: `cd src/mobile && npx eas-cli build --profile preview --platform android`.

Po zakończeniu buildu EAS udostępnia link i kod QR. Na telefonie należy otworzyć link, pobrać APK i zezwolić na instalację z tego źródła.

## Automatyczne aktualizacje

Aplikacja aktualizuje się na dwóch poziomach (DEC-022):

1. **Aktualizacje OTA (kod JavaScript/TypeScript, ekrany, logika)** – `expo-updates` + EAS Update.
   - Workflow **Mobile OTA update** publikuje aktualizację po każdym pushu do `main`, który zmienia `src/mobile`. Wcześniej uruchamia typecheck, lint i testy.
   - Aplikacja sprawdza aktualizacje przy każdym uruchomieniu i po powrocie na pierwszy plan (najczęściej co 30 min). Pobiera je w tle, a następnie pokazuje baner „Nowa wersja aplikacji jest gotowa – Uruchom ponownie”. Restart jest decyzją użytkownika, więc niezapisane formularze nie przepadają.
   - `runtimeVersion` używa polityki `fingerprint`: aktualizacja trafia wyłącznie do instalacji ze zgodnym kodem natywnym.
     Po dodaniu modułu natywnego (np. `expo-camera`, kalendarz) starsze instalatory przestają dostawać aktualizacje – trzeba zbudować nowy instalator (*Actions → Mobile build*), podnieść `version` i `android.versionCode` w `app.json` i zainstalować go na telefonach.
2. **Nowy instalator (zmiany natywne)** – endpoint `GET /api/v1/app/release` porównuje zainstalowaną wersję z konfiguracją API (`MobileApp:Android|Ios`):
   - `LatestVersion` nowsza od zainstalowanej → baner „Dostępna wersja X” z przyciskiem pobrania;
   - `MinimumVersion` nowsza od zainstalowanej → ekran blokujący „Wymagana aktualizacja”;
   - `DownloadUrl` – link do APK z EAS lub strona w sklepie.

Procedura wydania wersji natywnej: podnieś `version` w `src/mobile/app.json`, zbuduj instalator, a następnie ustaw w konfiguracji API `MobileApp__Android__LatestVersion`, `MobileApp__Android__DownloadUrl` i (opcjonalnie) `MinimumVersion`.

Ustawienia → Aplikacja pokazują dwie wersje:
- **Instalator** – `version` i numer kompilacji (`android.versionCode` / `ios.buildNumber`) z `app.json`, np. `1.1.0 (kompilacja 2)`; zmienia się tylko z nowym instalatorem;
- **Aktualizacja** – data publikacji i pierwsze 8 znaków identyfikatora wgranej aktualizacji OTA (`Updates.createdAt`, `Updates.updateId`), np. `01.11.2026, 09:20 · 3f9a1c2b`, albo „wbudowana w instalator” przed pierwszą aktualizacją. Identyfikator jest widoczny na expo.dev → *Updates*.

Przypomnienia o odczycie (DEC-031) to powiadomienia lokalne `expo-notifications` – nie wymagają serwera ani tokenów push. Logika planowania: `src/mobile/src/reminders/schedule.ts` (czyste funkcje), obsługa systemu: `reminders.ts`, otwieranie ekranu po dotknięciu: `useReminderLinks.ts`.

W buildach deweloperskich i w Expo Go aktualizacje OTA są wyłączone. Ustawienia → Aplikacja pokazuje wtedy odpowiedni komunikat.

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
| `DATABASE_URL` | Alternatywa dla `ConnectionStrings:Wattly` w formacie `postgresql://…?sslmode=require` (Neon; na Cloud Run z Secret Manager) |
| `PORT` | Port nasłuchu ustawiany przez platformę hostingową |
| `Storage:Provider` | `Local` (katalog, domyślnie) lub `Database` (załączniki w PostgreSQL) |
| `Http:TrustForwardedHeaders` | `true` za zaufanym proxy (Cloud Run) – prawdziwy adres IP klienta dla limitów logowań |
| `MobileApp:Android:*`, `MobileApp:Ios:*` | Najnowsza i minimalna wersja instalatora, link do pobrania, opis zmian |
| `Auth:External:*` | Logowanie Google, Microsoft, Apple, Facebook (identyfikatory klientów; sekret Facebooka) |

Sekrety (hasła, connection stringi produkcyjne) przekazuj przez zmienne środowiskowe lub menedżer sekretów – nigdy przez repozytorium.

## Wdrożenie produkcyjne

Serwer na Google Cloud Run + baza Neon: [Wattly_Deployment_CloudRun.md](Wattly_Deployment_CloudRun.md), konfiguracja krok po kroku: [Wattly_Konfiguracja_Neon_GoogleCloud.md](Wattly_Konfiguracja_Neon_GoogleCloud.md). Konfiguracja budowania i wdrożenia: `src/backend/cloudbuild.yaml`.

Klucze szyfrujące tokeny logowania (ASP.NET Data Protection) są w tabeli `DataProtectionKeys`, więc restart lub uśpienie serwera nie wylogowuje użytkowników.

## Znane ograniczenia MVP

- Brak wysyłki e-maili (reset hasła) poza logiem w Development – DEC-016.
- Powiadomienia, OCR, eksport, tryb offline – kolejne etapy roadmapy.
- Rejestry oddawania energii (PV) są przechowywane, ale nie wchodzą do kalkulacji kosztów.
- Godziny stref taryfowych nie są modelowane – zużycie stref pochodzi z rejestrów licznika.
- Załączniki: katalog lokalny albo baza danych (`Storage:Provider`). Przy dużej liczbie użytkowników lepszy będzie magazyn obiektowy zgodny z `IFileStorage`.

## Standard komentarzy i testów (DEC-023)

- **Backend:** `GenerateDocumentationFile` + `TreatWarningsAsErrors` – brak komentarza XML przy publicznym typie lub składowej przerywa build.
- **Mobile:** reguła ESLint `jsdoc/require-jsdoc` – każda funkcja, komponent, eksportowana stała, interfejs i typ musi mieć JSDoc.
- Każda zmiana zachowania wymaga testu: backend – xUnit (`tests/Wattly.UnitTests`, `tests/Wattly.IntegrationTests`), mobile – Jest + Testing Library (`*.test.ts(x)` obok kodu; testy ekranów w `src/__tests__/screens`, bo pliki w `src/app` są trasami Expo Router).
