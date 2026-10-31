# Wattly – konfiguracja serwera: Neon + Google Cloud krok po kroku

Kompletna instrukcja połączenia aplikacji Wattly z bazą **Neon** (PostgreSQL) i serwerem **Google Cloud Run**. Wszystkie kroki da się wykonać w przeglądarce telefonu. Opisuje dokładnie tę konfigurację, która działa w projekcie (DEC-027), wraz z błędami napotkanymi przy pierwszym uruchomieniu.

Jak działa ten układ i ile kosztuje: [Wattly_Deployment_CloudRun.md](Wattly_Deployment_CloudRun.md).

## Spis kroków

| # | Krok | Gdzie | Czas |
|---|---|---|---|
| 1 | Baza danych | neon.com | 5 min |
| 2 | Projekt i limit wydatków | console.cloud.google.com | 10 min |
| 3 | Usługi i uprawnienia | Cloud Shell | 5 min |
| 4 | Adres bazy jako sekret | Secret Manager | 3 min |
| 5 | Automatyczne wdrażanie z GitHuba | Cloud Build | 10 min + 5–8 min budowania |
| 6 | Sprawdzenie serwera | przeglądarka | 1 min |
| 7 | Połączenie aplikacji | expo.dev + GitHub Actions | 5 min (+ instalator) |

**Zasada bezpieczeństwa:** adres bazy zawiera hasło. Trafia **tylko** do Secret Manager (krok 4). Nie wklejaj go do czatu, repozytorium, zrzutów ekranu ani poleceń terminala, które zostają w historii.

---

## 1. Baza danych – Neon

1. Wejdź na **https://neon.com** (wpisz adres ręcznie – nie myl z innymi serwisami o podobnej nazwie) i załóż konto przez Google lub GitHub. Plan: **Free**.
2. Kreator nowego projektu:
   - nazwa: `Wattly`;
   - region: **AWS Europe Central 1 (Frankfurt)** – najbliżej Polski i serwera Google, dane w UE. Regionu nie da się później zmienić;
   - wersja Postgresa: domyślna (najnowsza);
   - „What else does your app need?” → **Just Postgres for now** (logowanie, pliki i reszta są po stronie serwera Wattly).
3. Ekran „Paste this prompt into Claude Code…” / `npx neon …` **pomiń** – to narzędzia dla aplikacji Node.js. Wattly sam łączy się z bazą i zakłada tabele przy pierwszym starcie. Kliknij **My app is connected**, aby przejść do projektu.
4. Na stronie projektu: **Connect** → okno *Connection details*:
   - Branch: `production`, Database: `neondb`, Role: `neondb_owner`;
   - przełącznik **Connection pooling: WYŁĄCZONY** – w adresie po `@` **nie może** być `-pooler` (pooler działa w trybie transakcyjnym, w którym nie działają migracje);
   - **Copy snippet** – kopiuje pełny adres razem z hasłem (gwiazdki na ekranie nie przeszkadzają).
5. Adres ma postać `postgresql://neondb_owner:HASŁO@ep-xxxx.c-8.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`. Serwer obsługuje oba parametry (`sslmode`, `channel_binding`).

> Jeśli hasło gdzieś wyciekło (czat, zrzut ekranu, historia terminala): **Connect → Reset password**, skopiuj nowy adres i dodaj go jako nową wersję sekretu (krok 4).

## 2. Projekt Google Cloud i limit wydatków

1. **https://console.cloud.google.com** → wybór projektu (u góry) → **New project** → nazwa `wattly` → **Create**.
2. Zapisz **Project ID** (np. `wattly-513315`) – jest potrzebny w poleceniach poniżej. Nie jest tajny.
3. **Billing** → podepnij konto rozliczeniowe (karta). Przy 3 osobach koszt mieści się w darmowych limitach.
4. **Billing → Budgets & alerts → Create budget**: projekt `wattly`, kwota np. **5 zł**, powiadomienia 50% / 90% / 100%. Budżet tylko powiadamia; twardym limitem jest `--max-instances=1` w `src/backend/cloudbuild.yaml`.

## 3. Usługi i uprawnienia – Cloud Shell

Cloud Shell to terminal w przeglądarce: ikona **`>_`** w prawym górnym rogu konsoli (na telefonie pojawia się ostrzeżenie o przeglądarkach mobilnych – działa mimo to). Przy pierwszym poleceniu kliknij **Authorize**.

Wklej całość, zmieniając tylko pierwszą linię:

```bash
PROJECT_ID=wattly-513315   # <- ID Twojego projektu
gcloud config set project "$PROJECT_ID"

# Usługi wdrożenia (compute tworzy domyślne konto serwisowe używane niżej).
gcloud services enable compute.googleapis.com run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com

# Domyślne konto serwisowe buduje, wdraża i uruchamia serwer.
SA="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
for ROLE in run.admin iam.serviceAccountUser artifactregistry.admin secretmanager.secretAccessor logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA" \
    --role="roles/$ROLE" --condition=None --quiet >/dev/null
done
echo "Gotowe: $SA"
```

Na końcu musi się pojawić `Gotowe: <numer>-compute@developer.gserviceaccount.com`. Polecenie można bezpiecznie uruchomić ponownie.

| Rola | Po co |
|---|---|
| Cloud Run Admin | wdrożenie nowej wersji i publiczny dostęp do API |
| Service Account User | uruchomienie serwera jako to konto |
| Artifact Registry Administrator | repozytorium obrazów i polityka czyszczenia (zostają 2 najnowsze) |
| Secret Manager Secret Accessor | odczyt adresu bazy przez serwer |
| Logs Writer | logi budowania |

## 4. Adres bazy jako sekret – Secret Manager

**Zalecane (telefon): przez stronę.**
1. Otwórz `https://console.cloud.google.com/security/secret-manager?project=<PROJECT_ID>`.
2. **+ Create secret** → nazwa dokładnie `wattly-database-url` → w **Secret value** wklej adres z Neona → **Create secret**.
3. Gdy sekret już istnieje (np. po nieudanej próbie): kliknij go → **+ New version** → wklej adres → **Add new version**. Starą wersję wyłącz: ⋮ → **Destroy**.

**Alternatywa: Cloud Shell** (na telefonie wklejanie do `read` bywa zawodne – wtedy adres trafia do terminala jako zwykłe polecenie):

```bash
read -rs DB_URL      # Enter, wklej adres, Enter (nic się nie wyświetla)
printf '%s' "$DB_URL" | gcloud secrets create wattly-database-url --replication-policy=automatic --data-file=-
unset DB_URL
```

Jeśli adres pojawił się w terminalu jako polecenie: zmień hasło w Neonie (krok 1), dodaj nową wersję sekretu i wyczyść historię: `history -c && history -w`.

## 5. Automatyczne wdrażanie z GitHuba – Cloud Build

1. `https://console.cloud.google.com/cloud-build/triggers?project=<PROJECT_ID>` → region **global** → **Connect repository**.
2. **1st gen** → **GitHub (Cloud Build GitHub App)** → zaloguj się do GitHuba → zainstaluj aplikację **Google Cloud Build** tylko dla repozytorium `Argoren05/Wattly` → zaznacz repozytorium → **Connect**. Propozycję utworzenia triggera pomiń (**Done**).
3. **Create trigger**:

   | Pole | Wartość |
   |---|---|
   | Name | `wattly-api` |
   | Region | `global` |
   | Event | *Push to a branch* |
   | Repository | `Argoren05/Wattly` (1st gen) |
   | Branch | `^main$` |
   | Included files filter (*Show included and ignored files filters*) | `src/backend/**` |
   | Configuration | *Cloud Build configuration file*, lokalizacja *Repository* |
   | Plik | `src/backend/cloudbuild.yaml` |
   | Service account | `<numer>-compute@developer.gserviceaccount.com` (z kroku 3) |

4. **Create**, potem przy triggerze **Run** (gałąź `main`). Postęp: **Cloud Build → History** (5–8 min).

Od teraz każdy merge do `main`, który zmienia `src/backend/**`, wdraża się sam. Przed scaleniem PR ten sam obraz buduje CI GitHuba (job `backend-image`), więc błąd w `Dockerfile` wychodzi w PR, a nie przy wdrożeniu.

Szczegóły nieudanego budowania (Cloud Shell):

```bash
B=$(gcloud builds list --limit=1 --format='value(id)'); gcloud builds describe $B --format='table(steps.id,steps.status)'; gcloud builds log $B | tail -40
```

## 6. Sprawdzenie serwera

```bash
gcloud run services describe wattly-api --region=europe-west4 --format='value(status.url)'
```

Wynik to adres API, np. `https://wattly-api-<numer>.europe-west4.run.app` (także w **Cloud Run → wattly-api**, pole **URL**). Otwórz w przeglądarce `<adres>/health/ready` – ma się wyświetlić **Healthy**. Pierwsze otwarcie trwa kilka sekund: serwer się budzi i przy pierwszym starcie zakłada tabele w bazie.

## 7. Połączenie aplikacji z serwerem

1. **expo.dev** → projekt **wattly** → **Environment variables** → **Add**:
   - Name: `EXPO_PUBLIC_API_URL`, Value: adres z kroku 6 **bez** `/` na końcu;
   - Environments: **preview** i **production**; Visibility: *Plain text* (adres nie jest tajny).
2. Nowa wartość trafia do aplikacji:
   - **aktualizacją OTA** – GitHub → **Actions → Mobile OTA update → Run workflow** (`main`); w aplikacji pojawi się baner „Nowa wersja aplikacji jest gotowa”;
   - **albo nowym instalatorem** – **Actions → Mobile build → Run workflow** (`main`, `preview`, `android`), potem pobranie APK z expo.dev → *Builds* i instalacja na starą aplikację (dane zostają na serwerze).
3. Aktualizacja OTA dociera tylko do instalatora zbudowanego z tym samym kodem natywnym (`runtimeVersion: fingerprint`). Gdy doszedł nowy moduł natywny (np. logowanie Google, kalendarz, aparat), restart aplikacji nic nie da – potrzebny jest nowy instalator.

## Ustawienia opcjonalne serwera

Zmienne dodane ręcznie zostają przy kolejnych wdrożeniach (`cloudbuild.yaml` używa `--update-env-vars`):

```bash
# Administrator katalogu taryf (zmień hasło po pierwszym logowaniu).
gcloud run services update wattly-api --region=europe-west4 \
  --update-env-vars=Seed__AdminEmail=ty@example.com,Seed__AdminPassword='DlugieHaslo123'

# Logowanie Google / Microsoft / Apple (identyfikatory z Wattly_Development.md).
gcloud run services update wattly-api --region=europe-west4 \
  --update-env-vars=Auth__External__Google__ClientIds__0=….apps.googleusercontent.com

# Informacja o nowym instalatorze w aplikacji (baner „Dostępna nowa wersja”).
gcloud run services update wattly-api --region=europe-west4 \
  --update-env-vars=MobileApp__Android__LatestVersion=1.1.0,MobileApp__Android__DownloadUrl=https://expo.dev/…
```

Sekrety (np. `Auth__External__Facebook__AppSecret`) – tak jak adres bazy: sekret w Secret Manager i `--update-secrets=NAZWA=nazwa-sekretu:latest`.

## Utrzymanie

| Zadanie | Jak |
|---|---|
| Zmiana hasła bazy | Neon → **Reset password** → nowa wersja sekretu `wattly-database-url` → Cloud Build → **Run** (nowa rewizja odczyta nowe hasło) |
| Logi serwera | **Cloud Run → wattly-api → Logs** |
| Powrót do poprzedniej wersji | **Cloud Run → wattly-api → Revisions** → poprzednia rewizja → **Manage traffic** → 100% |
| Koszty | **Billing → Reports**; Neon → **Monitoring** |
| Czy serwer usypia | **Cloud Run → Metrics**: liczba instancji spada do 0 po kilkunastu minutach bez ruchu |

## Rozwiązywanie problemów (z pierwszego uruchomienia)

| Objaw | Przyczyna i rozwiązanie |
|---|---|
| Neon proponuje `npx neon …` / prompt dla AI | nie dotyczy Wattly – pomiń, potrzebny jest tylko adres bazy |
| Adres zawiera `-pooler` | w oknie **Connect** wyłącz *Connection pooling* i skopiuj ponownie |
| `gcloud secrets create`: `already exists` | sekret istnieje (często pusty po nieudanej próbie) – dodaj nową wersję przez stronę Secret Manager (krok 4) |
| Po `read -rs` terminal pokazuje `No such file or directory` z adresem bazy | adres trafił do terminala jako polecenie – hasło jest jawne: zmień je w Neonie, dodaj nową wersję sekretu, `history -c && history -w` |
| Build: `NETSDK1094` (ReadyToRun) | naprawione w `Dockerfile` (`restore` z `-p:PublishReadyToRun=true`); przy innych błędach `Dockerfile` CI GitHuba (`backend-image`) pokazuje je w PR |
| Build: `PERMISSION_DENIED` | brak roli z kroku 3 albo trigger używa innego konta serwisowego |
| Build: `Secret … not found` | nazwa sekretu musi być dokładnie `wattly-database-url` |
| Kontener nie startuje | **Cloud Run → Logs**: zwykle zły adres bazy (pooler, literówka, stare hasło) |
| `/health/ready` → *Unhealthy* | baza nieosiągalna – sprawdź sekret i czy projekt Neon jest aktywny |
| Aplikacja: „Brak połączenia z serwerem” | brak `EXPO_PUBLIC_API_URL` na expo.dev albo aktualizacja nie dotarła – sprawdź punkt 3 kroku 7 |
| Pierwsze otwarcie po przerwie trwa kilka sekund | normalne – budzą się serwer i baza |
