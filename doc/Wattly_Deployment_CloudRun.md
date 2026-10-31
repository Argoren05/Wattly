# Wattly – wdrożenie serwera na Google Cloud Run + Neon

Instrukcja uruchomienia API na [Google Cloud Run](https://cloud.google.com/run) i bazy na [Neon](https://neon.com) w konfiguracji o **najmniejszym zużyciu** dla kilku użytkowników (DEC-027). Wszystko da się zrobić w przeglądarce, także na telefonie – polecenia wpisuje się w **Cloud Shell** (terminal w przeglądarce, ikona `>_` w prawym górnym rogu konsoli Google Cloud).

## Jak to działa i ile kosztuje

| Element | Rola | Koszt przy 3 osobach |
|---|---|---|
| **Cloud Run** | serwer API; usypia się po kilkunastu minutach bez ruchu i wtedy nic nie kosztuje | w ramach darmowego limitu miesięcznego |
| **Cloud Build** | po każdej zmianie w `src/backend/**` na `main` buduje obraz i wdraża nową wersję | w ramach darmowych minut budowania |
| **Artifact Registry** | przechowuje obraz serwera; polityka czyszczenia zostawia tylko 2 najnowsze | w ramach darmowego limitu |
| **Secret Manager** | przechowuje adres bazy (z hasłem) | w ramach darmowego limitu |
| **Neon** (plan Free) | PostgreSQL; sam usypia się po 5 minutach bez zapytań | 0 zł |

Szacunkowo **0 zł miesięcznie**; w najgorszym razie grosze za transfer danych między Google a Neon. Aktualne limity: https://cloud.google.com/run/pricing, https://cloud.google.com/build/pricing, https://neon.com/pricing. Google wymaga podpięcia karty, dlatego w kroku 2 ustawiamy alert budżetu, a w konfiguracji wdrożenia twardy limit: najwyżej 1 instancja serwera.

Co zostało zrobione w kodzie, żeby zużycie było jak najmniejsze:

- serwer zamyka nieużywane połączenia z bazą po 60 s, więc Neon może się uśpić;
- kod jest kompilowany z wyprzedzeniem (ReadyToRun), a Cloud Run dostaje dodatkowy procesor tylko na czas startu – wybudzenie trwa ok. 3 s;
- aplikacja na telefonie sama ponawia pierwsze zapytanie, gdy serwer się budzi;
- załączniki faktur i klucze szyfrujące tokeny logowania są w bazie – kontener nie potrzebuje dysku, a uśpienie serwera nie wylogowuje użytkowników.

## 1. Baza danych w Neon

1. Załóż konto na https://neon.com (można przez Google lub GitHub) i wybierz plan **Free**.
2. **Create project**: nazwa `wattly`, PostgreSQL w najnowszej wersji, region **AWS Europe Central 1 (Frankfurt)**.
3. Na stronie projektu kliknij **Connect**. **Wyłącz** przełącznik *Connection pooling* (serwer ma własną pulę połączeń, a pooler Neona działa w trybie transakcyjnym, który nie nadaje się do migracji bazy).
4. Skopiuj adres w postaci `postgresql://neondb_owner:…@ep-….eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`. Adres zawiera hasło – nie wklejaj go nigdzie poza krokiem 4 (Secret Manager).

## 2. Projekt Google Cloud i limit wydatków

1. Wejdź na https://console.cloud.google.com i utwórz projekt, np. `wattly` (zapamiętaj jego **ID**, np. `wattly-123456`).
2. **Billing** → podepnij konto rozliczeniowe (karta). Nowe konta dostają zwykle darmowe środki na start.
3. **Billing → Budgets & alerts → Create budget**: zakres – projekt `wattly`, kwota np. **5 zł**, powiadomienia przy 50%, 90% i 100%. Budżet tylko powiadamia; twardym limitem jest `--max-instances=1` w `src/backend/cloudbuild.yaml`.

## 3. Usługi i uprawnienia (Cloud Shell)

Otwórz Cloud Shell i wklej (zamień `wattly-123456` na ID swojego projektu):

```bash
gcloud config set project wattly-123456

# Usługi używane przez wdrożenie.
# compute.googleapis.com tworzy domyślne konto serwisowe używane poniżej.
gcloud services enable compute.googleapis.com run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com

# Domyślne konto serwisowe: buduje i wdraża (Cloud Build) oraz uruchamia serwer (Cloud Run).
PROJECT_ID=$(gcloud config get-value project)
SA="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
for ROLE in run.admin iam.serviceAccountUser artifactregistry.admin secretmanager.secretAccessor logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA" \
    --role="roles/$ROLE" --condition=None --quiet >/dev/null
done
echo "Gotowe: $SA"
```

| Rola | Po co |
|---|---|
| Cloud Run Admin | wdrożenie nowej wersji i udostępnienie API publicznie |
| Service Account User | uruchomienie serwera jako to konto |
| Artifact Registry Administrator | utworzenie repozytorium obrazów i polityki czyszczenia |
| Secret Manager Secret Accessor | odczyt adresu bazy przez serwer |
| Logs Writer | zapis logów budowania |

## 4. Adres bazy w Secret Manager

W Cloud Shell:

```bash
read -rs DB_URL   # wklej adres z Neona i naciśnij Enter (nic się nie wyświetli)
printf '%s' "$DB_URL" | gcloud secrets create wattly-database-url --replication-policy=automatic --data-file=-
unset DB_URL
```

Adres trafia tylko do Secret Manager – nie ma go w repozytorium ani w historii poleceń. Zmiana hasła w przyszłości: `printf '%s' "$DB_URL" | gcloud secrets versions add wattly-database-url --data-file=-`, a potem ponowne wdrożenie (krok 5.4).

## 5. Automatyczne wdrażanie z GitHuba

1. Konsola → **Cloud Build → Repositories** (1st gen) → **Connect repository** → *GitHub (Cloud Build GitHub App)*, region **global**. Zaloguj się do GitHuba, zainstaluj aplikację Google Cloud Build dla repozytorium `Argoren05/Wattly` i je zaznacz.
2. **Cloud Build → Triggers → Create trigger** (region **global**):

   | Pole | Wartość |
   |---|---|
   | Name | `wattly-api` |
   | Event | *Push to a branch* |
   | Repository | `Argoren05/Wattly` (1st gen) |
   | Branch | `^main$` |
   | Included files filter | `src/backend/**` – zmiany aplikacji mobilnej i dokumentacji nie przebudowują serwera |
   | Configuration | *Cloud Build configuration file*, lokalizacja *Repository*: `src/backend/cloudbuild.yaml` |
   | Service account | `…-compute@developer.gserviceaccount.com` (z kroku 3) |

3. Zapisz, a potem przy triggerze kliknij **Run** (gałąź `main`) – pierwsze wdrożenie trwa ok. 5–8 minut. Postęp: **Cloud Build → History**.
4. Po zakończeniu: **Cloud Run → wattly-api** – u góry jest adres, np. `https://wattly-api-abc123-ez.a.run.app`. Otwórz `<adres>/health/ready` – powinno się pokazać **Healthy**. Pierwsze otwarcie trwa kilka sekund (start serwera i migracje bazy).

Każdy kolejny merge do `main` zmieniający `src/backend/**` wdraża się sam.

### Ustawienia opcjonalne

Zmienne dodane ręcznie zostają przy kolejnych wdrożeniach (wdrożenie używa `--update-env-vars`, które nie usuwa innych zmiennych):

```bash
# Administrator katalogu taryf (hasło lepiej zmienić po pierwszym logowaniu).
gcloud run services update wattly-api --region=europe-west4 \
  --update-env-vars=Seed__AdminEmail=ty@example.com,Seed__AdminPassword='DlugieHaslo123'

# Identyfikatory logowania Google/Microsoft/Apple (zob. Wattly_Development.md).
gcloud run services update wattly-api --region=europe-west4 \
  --update-env-vars=Auth__External__Google__ClientIds__0=….apps.googleusercontent.com
```

Sekret aplikacji Facebook trzymaj w Secret Manager, tak jak adres bazy: utwórz sekret `wattly-facebook-secret` i dodaj `--update-secrets=Auth__External__Facebook__AppSecret=wattly-facebook-secret:latest`.

Klienta OAuth Google do logowania w aplikacji można utworzyć w tym samym projekcie Google Cloud (*APIs & Services → Credentials*).

## 6. Połączenie aplikacji z serwerem

1. Na expo.dev → projekt **Wattly** → **Environment variables** dodaj `EXPO_PUBLIC_API_URL` = adres z kroku 5.4 (bez `/` na końcu) dla środowisk *preview* i *production*.
2. Na GitHubie: **Actions → Mobile OTA update → Run workflow** (gałąź `main`). Workflow opublikuje aktualizację z nowym adresem – nowy instalator nie jest potrzebny.
3. Na telefonie otwórz Wattly. Gdy pojawi się baner „Nowa wersja aplikacji jest gotowa”, dotknij **Uruchom ponownie** (albo zamknij i otwórz aplikację). Rejestracja konta zacznie działać.

## Kontrola zużycia

- **Cloud Run → wattly-api → Metrics**: liczba instancji (spada do 0, gdy nikt nie używa aplikacji), pamięć, czasy odpowiedzi.
- **Billing → Reports**: koszt w bieżącym miesiącu.
- **Neon → Monitoring**: czas pracy bazy; przy braku ruchu baza ma stan *Idle*.

## Rozwiązywanie problemów

| Objaw | Przyczyna i rozwiązanie |
|---|---|
| Build: `PERMISSION_DENIED` przy `artifacts` lub `run deploy` | brakuje roli z kroku 3 albo trigger używa innego konta serwisowego niż to z kroku 3 |
| Build: `Secret … wattly-database-url not found` | sekret z kroku 4 nie istnieje lub ma inną nazwę |
| Wdrożenie: kontener nie startuje (*failed to start and listen on the port*) | **Cloud Run → wattly-api → Logs**: zwykle błędny adres bazy (np. adres poolera z `-pooler` w nazwie hosta) |
| `/health/ready` zwraca *Unhealthy* | baza nieosiągalna – sprawdź adres w Secret Manager i czy projekt Neon jest aktywny |
| Wdrożenie: `allUsers` nie może zostać dodany (polityka organizacji) | dotyczy tylko kont firmowych Google Workspace; na prywatnym koncie nie występuje |
| Aplikacja: „Brak połączenia z serwerem” | sprawdź `EXPO_PUBLIC_API_URL` na expo.dev i czy po jego ustawieniu uruchomiono *Mobile OTA update* |
| Pierwsze otwarcie po przerwie trwa kilka sekund | to normalne – budzą się serwer i baza |
