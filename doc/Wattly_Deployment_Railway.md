# Wattly – wdrożenie serwera na Railway

Instrukcja uruchomienia API i bazy danych na [Railway](https://railway.com) w konfiguracji o **najmniejszym zużyciu** dla kilku użytkowników (DEC-026). Wszystko da się wyklikać w przeglądarce, także na telefonie.

## Jak to działa i ile kosztuje

- **Serwer API** działa w trybie *Serverless*. Po 5–10 minutach bez ruchu Railway go usypia i serwer nie zużywa wtedy pamięci ani procesora. Pierwsze otwarcie aplikacji po przerwie trwa kilka sekund dłużej, bo serwer się budzi; aplikacja sama ponawia pierwsze zapytanie.
- **Baza PostgreSQL** działa cały czas (ok. 50–100 MB RAM). Usypiania bazy nie włączamy, bo zgłaszano przypadki, w których baza się nie wybudzała.
- **Załączniki faktur** są zapisywane w bazie, więc nie trzeba osobnego dysku.
- **Koszt:** plan *Hobby* to 5 USD miesięcznie i obejmuje 5 USD zużycia. Dla 3 osób zużycie wyniesie szacunkowo 1–3 USD, więc rachunek zostaje na poziomie 5 USD, a reszta limitu jest wolna na inne projekty na tym koncie. Aktualne stawki: https://railway.com/pricing.

Zmierzone lokalnie zużycie serwera API przy pracy: ok. 110 MB pamięci prywatnej + ok. 80 MB wczytanych bibliotek .NET.

## 1. Konto i limit wydatków

1. Zaloguj się na https://railway.com przez **GitHub**.
2. Wybierz plan **Hobby** (ustawienia konta → *Plans* / *Billing*).
3. Ustaw limit wydatków (ustawienia workspace → **Usage** → *Usage limits*), np. powiadomienie przy 5 USD i twardy limit 10 USD. Po przekroczeniu twardego limitu Railway zatrzyma usługi zamiast naliczać więcej.

## 2. Baza danych

1. **New Project** → **Database** → **PostgreSQL**.
2. W ustawieniach usługi bazy wybierz region najbliższy Polsce (np. Europa – Amsterdam).

Nie włączaj trybu *Serverless* dla bazy.

## 3. Serwer API

1. W tym samym projekcie: **+ Create** → **GitHub Repo** → `Argoren05/Wattly`.
2. Ustawienia usługi (**Settings**):

   | Ustawienie | Wartość | Dlaczego |
   |---|---|---|
   | *Source → Root Directory* | `src/backend` | tam jest `Dockerfile` serwera |
   | *Source → Watch Paths* | `src/backend/**` | zmiany aplikacji mobilnej i dokumentacji nie przebudowują serwera |
   | *Deploy → Region* | ten sam co baza | szybsze połączenie |
   | *Deploy → Healthcheck Path* | `/health/ready` | nowa wersja dostaje ruch dopiero, gdy połączy się z bazą |
   | *Deploy → Serverless* | **włączone** | usypianie bez ruchu – główna oszczędność |
   | *Networking → Public Networking* | **Generate Domain** | publiczny adres HTTPS, np. `wattly-production.up.railway.app` |

3. Zmienne (**Variables**) usługi API:

   | Zmienna | Wartość |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (odwołanie do bazy z kroku 2; połączenie przez sieć prywatną Railway, bez opłat za transfer) |
   | `ASPNETCORE_ENVIRONMENT` | `Production` |
   | `Database__MigrateOnStartup` | `true` |
   | `Storage__Provider` | `Database` |
   | `Http__TrustForwardedHeaders` | `true` |

   Opcjonalnie: `Seed__AdminEmail` i `Seed__AdminPassword` (administrator katalogu taryf) oraz identyfikatory logowania `Auth__External__…` (zob. `Wattly_Development.md`). Sekrety wpisuj tylko w Railway, nigdy w repozytorium.

4. Zapisz zmienne. Railway zbuduje i uruchomi serwer, a pierwszy build trwa kilka minut.
5. Sprawdź w przeglądarce: `https://<twoja-domena>/health/ready` powinno pokazać **Healthy**.

## 4. Połączenie aplikacji z serwerem

1. Na expo.dev → projekt **Wattly** → **Environment variables** dodaj `EXPO_PUBLIC_API_URL` = `https://<twoja-domena>` (bez `/` na końcu) dla środowisk *preview* i *production*.
2. Na GitHubie: **Actions → Mobile OTA update → Run workflow** (gałąź `main`). Workflow opublikuje aktualizację z nowym adresem – nowy instalator nie jest potrzebny.
3. Na telefonie otwórz Wattly. Gdy pojawi się baner „Nowa wersja aplikacji jest gotowa”, dotknij **Uruchom ponownie** (albo zamknij i otwórz aplikację). Rejestracja konta zacznie działać.

## Kontrola zużycia

- Projekt → **Metrics**: pamięć i CPU każdej usługi; przy uśpionym serwerze wykres pamięci API spada do zera.
- Ustawienia workspace → **Usage**: bieżący koszt w miesiącu.
- Jeśli serwer nie usypia: sprawdź, czy *Serverless* jest włączony, i wykonaj ponowne wdrożenie (*Redeploy*), bo ustawienie zaczyna działać od następnego wdrożenia.

## Rozwiązywanie problemów

| Objaw | Przyczyna i rozwiązanie |
|---|---|
| Build kończy się błędem „Dockerfile not found” | *Root Directory* musi mieć wartość `src/backend` |
| `/health/ready` zwraca błąd lub *Unhealthy* | zmienna `DATABASE_URL` musi być odwołaniem `${{Postgres.DATABASE_URL}}`, a nazwa usługi bazy musi się zgadzać (domyślnie `Postgres`) |
| Aplikacja: „Brak połączenia z serwerem” | sprawdź `EXPO_PUBLIC_API_URL` na expo.dev i czy po jego ustawieniu uruchomiono *Mobile OTA update* |
| Pierwsze otwarcie po przerwie trwa kilka sekund | to normalne – serwer się budzi (tryb Serverless) |
