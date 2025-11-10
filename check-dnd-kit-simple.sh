#!/bin/bash

# Prosta komenda do sprawdzenia na produkcji
# Użyj: ./check-dnd-kit-simple.sh

echo "🔍 Sprawdzanie @dnd-kit na serwerze..."
echo ""

# Najprostsza wersja - sprawdź wszystkie pliki
grep -r "@dnd-kit\|dnd-kit\|DndContext\|SortableContext" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=.cache \
  . 2>/dev/null

if [ $? -eq 0 ]; then
  echo ""
  echo "⚠️  ZNALEZIONO REFERENCJE DO @dnd-kit!"
else
  echo ""
  echo "✅ Brak referencji do @dnd-kit"
fi

