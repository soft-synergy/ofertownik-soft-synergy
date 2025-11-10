# 🔧 Naprawa błędu "@dnd-kit/core" - Instrukcja

## Problem
Błąd `Cannot find module '@dnd-kit/core'` pojawia się nawet po usunięciu biblioteki, ponieważ:
1. **Cache przeglądarki** - ładuje stary bundle.js z serwera produkcyjnego
2. **Cache webpacka** - webpack w trybie dev używa starego cache
3. **Stary build na serwerze** - serwer produkcyjny ma stary build

## ✅ Rozwiązanie

### Krok 1: Wyczyść cache lokalnie
```bash
cd client
./fix-dev-cache.sh
```

Lub ręcznie:
```bash
cd client
rm -rf node_modules/.cache .cache build
npm cache clean --force
npm start
```

### Krok 2: Wyczyść cache przeglądarki

**Chrome/Edge:**
1. Otwórz DevTools (F12)
2. Kliknij prawym na przycisk odświeżania
3. Wybierz "Empty Cache and Hard Reload"

**Lub:**
- Windows/Linux: `Ctrl+Shift+Delete` → wybierz "Cached images and files" → "Clear data"
- Mac: `Cmd+Shift+Delete` → wybierz "Cached images and files" → "Clear data"

**Lub użyj trybu incognito:**
- Chrome: `Ctrl+Shift+N` (Windows) lub `Cmd+Shift+N` (Mac)
- Firefox: `Ctrl+Shift+P` (Windows) lub `Cmd+Shift+P` (Mac)

### Krok 3: Wymuś odświeżenie bez cache
- Windows/Linux: `Ctrl+Shift+R` lub `Ctrl+F5`
- Mac: `Cmd+Shift+R`

### Krok 4: Sprawdź w DevTools
1. Otwórz DevTools (F12)
2. Przejdź do zakładki **Network**
3. Zaznacz **"Disable cache"**
4. Odśwież stronę

### Krok 5: Dla produkcji - wdróż nowy build
```bash
cd client
npm run build
# Skopiuj folder build/ na serwer produkcyjny
```

## 🔍 Sprawdzenie czy działa

Po wyczyszczeniu cache, sprawdź w konsoli przeglądarki:
- Nie powinno być błędów z `@dnd-kit`
- Portfolio powinno mieć drag and drop (ikona uchwytu po lewej)

## ⚠️ Jeśli nadal nie działa

1. Sprawdź czy w kodzie nie ma referencji do @dnd-kit:
   ```bash
   cd client
   grep -r "@dnd-kit" src/
   ```
   (Powinno zwrócić 0 wyników)

2. Sprawdź package.json - nie powinno być @dnd-kit w dependencies

3. Zrestartuj serwer dev całkowicie:
   ```bash
   # Zatrzymaj (Ctrl+C)
   # Wyczyść cache
   rm -rf node_modules/.cache .cache
   # Uruchom ponownie
   npm start
   ```

