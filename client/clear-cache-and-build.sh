#!/bin/bash

echo "🧹 Czyszczenie cache..."
rm -rf node_modules/.cache
rm -rf build
rm -rf .cache
npm cache clean --force

echo "📦 Przebudowywanie aplikacji..."
npm run build

echo "✅ Build zakończony!"
echo ""
echo "📝 Następne kroki:"
echo "1. Wdróż nowy build na serwer produkcyjny"
echo "2. Wyczyść cache przeglądarki (Ctrl+Shift+R lub Cmd+Shift+R)"
echo "3. Lub użyj trybu incognito do testowania"

