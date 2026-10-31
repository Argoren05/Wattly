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

Szacunkowo **0 zł miesięcznie**; w najgorszym razie grosze za transfer danych między Google a Neon. Aktualne limity: https://cloud.google.com/run/pricing, https://cloud.google.com/build/pricing, https://neon.com/pricing. Google wymaga podpięcia karty, dlatego w konfiguracji ustawiamy alert budżetu, a w konfiguracji wdrożenia twardy limit: najwyżej 1 instancja serwera.

Co zostało zrobione w kodzie, żeby zużycie było jak najmniejsze:

- serwer zamyka nieużywane połączenia z bazą po 60 s, więc Neon może się uśpić;
- kod jest kompilowany z wyprzedzeniem (ReadyToRun), a Cloud Run dostaje dodatkowy procesor tylko na czas startu – wybudzenie trwa ok. 3 s;
- aplikacja na telefonie sama ponawia pierwsze zapytanie, gdy serwer się budzi;
- załączniki faktur i klucze szyfrujące tokeny logowania są w bazie – kontener nie potrzebuje dysku, a uśpienie serwera nie wylogowuje użytkowników.

## Konfiguracja krok po kroku

Pełna instrukcja (Neon, projekt Google Cloud, uprawnienia, sekret, Cloud Build, połączenie aplikacji, utrzymanie i rozwiązywanie problemów): **[Wattly_Konfiguracja_Neon_GoogleCloud.md](Wattly_Konfiguracja_Neon_GoogleCloud.md)**.

Pliki w repozytorium:
- `src/backend/Dockerfile` – obraz serwera (ReadyToRun);
- `src/backend/cloudbuild.yaml` – budowanie i wdrożenie (region `europe-west4`, 0–1 instancji, CPU tylko podczas żądań, sekret `wattly-database-url`).

## Kontrola zużycia

- **Cloud Run → wattly-api → Metrics**: liczba instancji (spada do 0, gdy nikt nie używa aplikacji), pamięć, czasy odpowiedzi.
- **Billing → Reports**: koszt w bieżącym miesiącu.
- **Neon → Monitoring**: czas pracy bazy; przy braku ruchu baza ma stan *Idle*.

Rozwiązywanie problemów: [Wattly_Konfiguracja_Neon_GoogleCloud.md](Wattly_Konfiguracja_Neon_GoogleCloud.md#rozwiązywanie-problemów-z-pierwszego-uruchomienia).
