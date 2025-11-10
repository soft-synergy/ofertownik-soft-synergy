#!/bin/bash

echo "🧹 Czyszczenie wszystkich cache..."

# Zatrzymaj procesy node jeśli działają
pkill -f "react-scripts" 2>/dev/null || true
pkill -f "webpack" 2>/dev/null || true

# Wyczyść wszystkie cache
rm -rf node_modules/.cache
rm -rf .cache
rm -rf build
rm -rf ~/.npm/_cacache 2>/dev/null

# Wyczyść cache npm
npm cache clean --force

# Wyczyść cache webpack
rm -rf node_modules/.cache/webpack 2>/dev/null

echo "✅ Cache wyczyszczony!"
echo ""
echo "🚀 Uruchamianie serwera dev..."
echo "   Użyj Ctrl+C aby zatrzymać"
echo ""

# Uruchom z wyczyszczonym cache
GENERATE_SOURCEMAP=false WATCHPACK_POLLING=true npm start

