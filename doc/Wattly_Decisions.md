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
- Status: Do decyzji
- Opcje: cenniki wprowadzane przez administratora, własne stawki użytkownika, późniejsze integracje.
- Wymaganie: każda stawka ma źródło i okres obowiązywania.

## DEC-009 – OCR
- Status: Do decyzji
- Wymaganie: OCR zwraca propozycję, a użytkownik zatwierdza odczyt.

## DEC-010 – Tryb offline
- Status: Do decyzji
- Wymaganie: jeżeli zostanie wdrożony, synchronizacja musi rozwiązywać konflikty i zapobiegać duplikatom.

## DEC-011 – Prognoza
- Status: Propozycja
- Decyzja: prognoza musi być oznaczona jako szacunkowa i prezentować założenia.

## DEC-012 – Rozszerzenie na inne media
- Status: Po MVP
- Decyzja: architektura powinna umożliwiać późniejszą obsługę gazu i wody, ale nie należy komplikować MVP.

## Szablon nowej decyzji

### DEC-XXX – Tytuł
- Data:
- Status: Propozycja / Zatwierdzona / Odrzucona / Zastąpiona
- Kontekst:
- Rozważane opcje:
- Decyzja:
- Konsekwencje:
