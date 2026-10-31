# Wattly – rejestr decyzji projektowych

Dokument przechowuje zatwierdzone decyzje. Wpisy oznaczone jako „Propozycja” nie są jeszcze wiążące.

## DEC-001 – Nazwa produktu
- Status: Propozycja
- Decyzja: Wattly.
- Uzasadnienie: krótka, łatwa do zapamiętania nazwa związana z energią.

## DEC-002 – Platformy
- Status: Propozycja
- Decyzja: Android i iOS.
- Uzasadnienie: jedna baza kodu aplikacji mobilnej.

## DEC-003 – Frontend
- Status: Propozycja
- Decyzja: React Native + Expo + TypeScript.
- Do potwierdzenia: wymagania natywne, OCR, biblioteki wykresów i strategia aktualizacji.

## DEC-004 – Backend
- Status: Propozycja
- Decyzja: ASP.NET Core Web API, .NET 10.
- Uzasadnienie: wydzielona logika domenowa i możliwość rozwoju API.

## DEC-005 – Baza danych
- Status: Propozycja
- Decyzja: PostgreSQL + Entity Framework Core.

## DEC-006 – Architektura
- Status: Propozycja
- Decyzja: modularny monolit na początek, bez mikroserwisów.

## DEC-007 – Zakres MVP
- Status: Propozycja
- Decyzja: ręczne odczyty, konfiguracja taryf, kalkulacje, dashboard, wykresy, prognoza i ręczne faktury.

## DEC-008 – Źródła cen
- Status: Częściowo rozstrzygnięta – zob. DEC-017
- Opcje: cenniki wprowadzane przez administratora, własne stawki użytkownika, późniejsze integracje.
- Wymaganie: każda stawka ma źródło i okres obowiązywania.

## DEC-009 – OCR
- Status: Do decyzji
- Wymaganie: OCR zwraca propozycję, a użytkownik zatwierdza odczyt.

## DEC-010 – Tryb offline
- Status: Do decyzji (MVP działa online; aplikacja pokazuje stan braku połączenia)
- Wymaganie: jeżeli zostanie wdrożony, synchronizacja musi rozwiązywać konflikty i zapobiegać duplikatom.

## DEC-011 – Prognoza
- Status: Propozycja
- Decyzja: prognoza musi być oznaczona jako szacunkowa i prezentować założenia.

## DEC-012 – Rozszerzenie na inne media
- Status: Po MVP
- Decyzja: architektura powinna umożliwiać późniejszą obsługę gazu i wody, ale nie należy komplikować MVP.

## DEC-013 – Zaokrąglenia kwot
- Data: 2026-10-30
- Status: Propozycja
- Decyzja: kwota netto każdego składnika zaokrąglana do 0,01 (połowa od zera); VAT liczony od sumy netto dla każdej stawki VAT i zaokrąglany do 0,01; brutto = netto + VAT. Opłaty miesięczne proporcjonalnie do udziału dni w miesiącu kalendarzowym (czas lokalny nieruchomości). Ilości kWh – 3 miejsca, miesiące – 4 miejsca.
- Konsekwencje: wynik może różnić się o grosze od faktur sprzedawców stosujących inne reguły; zmiana reguł wymaga podbicia `CalculationVersion`.

## DEC-014 – Paginacja
- Data: 2026-10-30
- Status: Propozycja
- Decyzja: paginacja `page`/`pageSize` (domyślnie 50, maks. 200) z `totalCount` w odpowiedzi.

## DEC-015 – Uwierzytelnianie
- Data: 2026-10-30
- Status: Propozycja
- Decyzja: ASP.NET Core Identity z endpointami `MapIdentityApi` i tokenami bearer (access 30 min, refresh 30 dni). Wylogowanie unieważnia tokeny odświeżania przez zmianę security stamp. Tokeny w aplikacji mobilnej w SecureStore (Keychain/Keystore).
- Konsekwencje: tokeny są nieprzezroczyste (nie JWT) – przy przyszłym podziale na wiele usług może być potrzebna migracja na JWT/OIDC.

## DEC-016 – Wysyłka e-maili
- Status: Do decyzji
- Kontekst: reset hasła i potwierdzenie e-maila wymagają dostawcy poczty. W środowisku Development wiadomości trafiają do logu; w innych środowiskach nie są wysyłane.

## DEC-017 – Źródła cen (realizacja DEC-008)
- Data: 2026-10-30
- Status: Propozycja
- Decyzja: obsługiwane są cenniki katalogowe (administrator) oraz własne cenniki użytkownika dla nieruchomości. Jeżeli nieruchomość ma własny cennik dla taryfy z umowy obowiązujący danego dnia – używany jest wyłącznie on; w przeciwnym razie sumowane są cenniki katalogowe pasujące do taryfy, sprzedawcy i operatora. Seed nie zawiera żadnych stawek. Cenniki są niezmienne – zmiana cen = zakończenie obowiązywania i nowy cennik. Zapisane kalkulacje przechowują migawkę stawek.
- Do decyzji: czy dopuszczać łączenie własnych stawek energii z katalogowymi stawkami dystrybucji.

## DEC-018 – Układ repozytorium
- Data: 2026-10-30
- Status: Zatwierdzona
- Decyzja: cały kod i konfiguracja projektu w `src/` (w tym testy i docker-compose), dokumentacja w `doc/`. Wyjątki w katalogu głównym: `.github/workflows` (wymóg GitHub) oraz krótki `README.md` jako strona startowa repozytorium z odnośnikami do `doc/`.

## DEC-019 – Estymacja zużycia
- Data: 2026-10-30
- Status: Propozycja
- Decyzja: odczyty są źródłem prawdy; między odczytami – interpolacja liniowa, po ostatnim odczycie – ekstrapolacja średnią dzienną z ostatnich 90 dni. Przed pierwszym odczytem zużycie jest nieznane (okres przycinany). Każdy taki wynik jest oznaczony jako szacunkowy i opisany w założeniach.

## DEC-020 – Walidacja odczytów
- Data: 2026-10-30
- Status: Propozycja
- Decyzja: blokowane są wartości ujemne, duplikaty czasu i naruszenie monotoniczności względem sąsiednich odczytów. Nietypowy skok (ponad 3× średnia dzienna i > 5 kWh lub > 200 kWh/dzień) wymaga potwierdzenia (`confirmAnomaly`). Korekta tworzy nowy odczyt i oznacza poprzedni jako `Superseded`; anulowanie – `Voided`. Wymiana licznika = nowy licznik.

## DEC-021 – Dystrybucja aplikacji mobilnej
- Data: 2026-10-30
- Status: Propozycja
- Decyzja: instalatory budowane przez EAS Build. Profil `preview` tworzy APK do bezpośredniej instalacji, profil `production` tworzy AAB i build iOS do sklepów. Brak instalatorów desktopowych (.exe).
- Konsekwencje: wymagane konto Expo (darmowy plan wystarcza na start) oraz sekret `EXPO_TOKEN` (token robota z rolą Developer) w CI; identyfikator projektu EAS jest w `app.json`. iOS wymaga konta Apple Developer.

## DEC-022 – Automatyczne aktualizacje
- Data: 2026-10-30
- Status: Propozycja
- Decyzja: dwa poziomy. (1) OTA przez expo-updates/EAS Update z `runtimeVersion: fingerprint`: sprawdzenie przy starcie i powrocie do aplikacji, pobranie w tle, restart po potwierdzeniu użytkownika. (2) Nowe instalatory: endpoint `/api/v1/app/release` z konfigurowalną wersją najnowszą i minimalną (baner lub ekran blokujący).
- Odrzucone: automatyczny restart bez pytania (ryzyko utraty danych w formularzu); własny serwer aktualizacji (większy koszt utrzymania).

## DEC-023 – Komentarze i testy jako bramka jakości
- Data: 2026-10-30
- Status: Zatwierdzona
- Decyzja: dokumentacja kodu wymuszana narzędziowo (XML docs w .NET, ESLint JSDoc w aplikacji mobilnej). Testy jednostkowe obejmują wszystkie warstwy, a CI blokuje build i publikację aktualizacji przy błędach.

## DEC-024 – Logowanie kontami Google, Microsoft, Facebook i Apple
- Data: 2026-10-31
- Status: Propozycja
- Decyzja: aplikacja pobiera token dostawcy na urządzeniu. Google przez natywne SDK (`@react-native-google-signin/google-signin`), Microsoft przez OpenID Connect z PKCE, Facebook przez okno logowania w przeglądarce systemowej, Apple przez `expo-apple-authentication` na iOS. Token trafia do `POST /api/v1/auth/external`. Backend weryfikuje podpis, wystawcę, odbiorcę, ważność i nonce (Google, Microsoft, Apple) lub sprawdza token przez Graph API `debug_token` (Facebook), a następnie wydaje własne tokeny Wattly – takie same jak przy logowaniu hasłem.
- Wiązanie kont: konto z tym samym adresem e-mail jest łączone tylko wtedy, gdy dostawca potwierdza, że adres jest zweryfikowany (Google, Apple, Facebook). Microsoft nie gwarantuje weryfikacji, więc przy istniejącym koncie zwracany jest błąd `external.email_in_use`, a nie przejęcie konta. Konto bez adresu e-mail jest odrzucane (`external.email_missing`).
- Konfiguracja: identyfikatory klientów są publiczne i ustawiane jako zmienne środowiskowe EAS (`EXPO_PUBLIC_*`); sekret Facebooka tylko po stronie API. Dostawca bez konfiguracji nie jest pokazywany.
- Odrzucone: przestarzałe moduły `expo-auth-session/providers/google` i `facebook`; `react-native-fbsdk-next` (brak aktualizacji od 8 miesięcy, niepewna zgodność z React Native 0.88).
- Konsekwencje: na iOS z logowaniem Google lub Facebook App Store wymaga też „Zaloguj przez Apple” (`EXPO_PUBLIC_APPLE_SIGN_IN=true`).

## DEC-025 – Zmienne środowiskowe EAS jako jedyne źródło konfiguracji aplikacji
- Data: 2026-10-31
- Status: Propozycja
- Decyzja: adres API i identyfikatory klientów logowania są zmiennymi środowiskowymi EAS (expo.dev → projekt → Environment variables), wybieranymi przez pole `environment` profilu w `eas.json` (build) i `eas update --environment` (aktualizacje OTA).
- Powód: zmienne z runnera GitHub nie docierają do buildu na serwerach Expo; wcześniejsza zmienna `WATTLY_API_URL` działałaby tylko w aktualizacjach OTA.

## DEC-026 – Hosting na Railway o minimalnym zużyciu
- Data: 2026-10-31
- Status: Zatwierdzona
- Kontekst: 3 użytkowników, opłaty naliczane za faktycznie zużytą pamięć i procesor.
- Decyzja: Railway (plan Hobby). Serwer API w trybie *Serverless* (usypianie po bezczynności), baza PostgreSQL działa stale, załączniki faktur w bazie (`Storage:Provider=Database`) zamiast osobnego dysku.
- Zmiany w kodzie, które to umożliwiają:
  - obsługa `PORT` i `DATABASE_URL`;
  - pula połączeń z krótkim czasem bezczynności (60 s) i maks. 10 połączeniami – otwarte połączenia blokowałyby uśpienie;
  - zaufanie do nagłówków `X-Forwarded-*` od proxy Railway, żeby limit logowań liczył się per użytkownik, a nie dla całego proxy;
  - oszczędne ustawienia środowiska .NET (Workstation GC, ConserveMemory, Invariant Globalization);
  - jednokrotne ponowienie zapytania w aplikacji przy 502/503 (wybudzanie serwera).
- Odrzucone: trwały dysk Railway na załączniki (montowany jako root – wymagałby uruchamiania kontenera z uprawnieniami roota); usypianie bazy (zgłaszane problemy z wybudzaniem); plan Free (1 USD zużycia nie wystarcza na stale działającą bazę).
- Konsekwencje: pierwsze zapytanie po przerwie trwa kilka sekund dłużej; `railway.json` nie jest używany (Railway wycofuje *Config as Code* dla nowych usług), więc ustawienia usług są opisane w `Wattly_Deployment_Railway.md`.

## Szablon nowej decyzji

### DEC-XXX – Tytuł
- Data:
- Status: Propozycja / Zatwierdzona / Odrzucona / Zastąpiona
- Kontekst:
- Rozważane opcje:
- Decyzja:
- Konsekwencje:
