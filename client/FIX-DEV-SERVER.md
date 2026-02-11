# 🔧 Naprawa - przeglądarka ładuje stary bundle z produkcji

## Problem
Przeglądarka ładuje `https://ofertownik.soft-synergy.com/static/js/bundle.js` zamiast lokalnego dev servera.

## ✅ Rozwiązanie

### Krok 1: Upewnij się że dev server działa lokalnie
```bash
cd client
npm start
```

Powinieneś zobaczyć:
```
Compiled successfully!

You can now view ofertownik-client in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000
```

### Krok 2: Otwórz lokalny adres
**WAŻNE:** Otwórz `http://localhost:3000` a NIE `https://ofertownik.soft-synergy.com`

### Krok 3: Wyczyść cache przeglądarki
1. Otwórz DevTools (F12)
2. Kliknij prawym na przycisk odświeżania
3. Wybierz "Empty Cache and Hard Reload"

### Krok 4: Sprawdź w DevTools
1. Otwórz zakładkę **Network**
2. Zaznacz **"Disable cache"**
3. Odśwież stronę
4. Sprawdź czy pliki JS ładują się z `localhost:3000` a nie z `ofertownik.soft-synergy.com`

### Krok 5: Jeśli nadal ładuje z produkcji
Sprawdź czy masz przekierowanie w przeglądarce lub hosts file:
```bash
# Sprawdź hosts file (Mac/Linux)
cat /etc/hosts | grep ofertownik

# Sprawdź hosts file (Windows)
notepad C:\Windows\System32\drivers\etc\hosts
```

### Krok 6: Wyczyść wszystko i zacznij od nowa
```bash
cd client
rm -rf node_modules/.cache .cache build
npm cache clean --force
npm start
```

## ⚠️ UWAGA
Upewnij się że otwierasz `http://localhost:3000` a nie `https://ofertownik.soft-synergy.com`!

