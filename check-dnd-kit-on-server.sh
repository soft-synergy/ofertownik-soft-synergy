#!/bin/bash

echo "🔍 Sprawdzanie referencji do @dnd-kit na serwerze..."
echo ""

# Sprawdź w plikach JavaScript/JSX
echo "📁 Sprawdzanie plików .js, .jsx, .json:"
grep -r "@dnd-kit\|dnd-kit\|DndContext\|SortableContext\|useSortable\|arrayMove\|@dnd-kit/core\|@dnd-kit/sortable\|@dnd-kit/utilities" \
  --include="*.js" \
  --include="*.jsx" \
  --include="*.json" \
  --include="*.ts" \
  --include="*.tsx" \
  . 2>/dev/null | grep -v node_modules | grep -v ".git" || echo "✅ Brak referencji w plikach JS/JSX/JSON"

echo ""
echo "📦 Sprawdzanie package.json i package-lock.json:"
find . -name "package.json" -o -name "package-lock.json" | xargs grep -l "@dnd-kit" 2>/dev/null | while read file; do
  echo "⚠️  Znaleziono w: $file"
  grep "@dnd-kit" "$file"
done || echo "✅ Brak @dnd-kit w package.json"

echo ""
echo "📄 Sprawdzanie zbudowanych plików (build/):"
if [ -d "build" ] || [ -d "client/build" ]; then
  find build client/build -name "*.js" -type f 2>/dev/null | head -5 | xargs grep -l "@dnd-kit\|dnd-kit" 2>/dev/null | while read file; do
    echo "⚠️  Znaleziono w build: $file"
  done || echo "✅ Brak @dnd-kit w zbudowanych plikach"
else
  echo "ℹ️  Folder build nie znaleziony"
fi

echo ""
echo "✅ Sprawdzanie zakończone!"

