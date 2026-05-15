#!/bin/bash
# Deploy produkcyjny Ofertownika.
#
# Odpalaj na serwerze z katalogu repo: bash scripts/deploy.sh
# Wykonuje: git pull, npm ci (jeśli lock się zmienił), build frontu, pm2 reload backendu.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log() { printf "\033[0;34m[deploy]\033[0m %s\n" "$*"; }
ok()  { printf "\033[0;32m[ ok ]\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m[warn]\033[0m %s\n" "$*"; }

# 1. Git pull
log "git pull"
git pull --ff-only

# 2. Backend deps (root package.json)
if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -q '^package-lock.json$\|^package.json$'; then
    log "Zmienił się root package-lock — npm ci"
    npm ci --omit=dev=false
else
    log "Root package-lock bez zmian — skip npm ci"
fi

# 3. Frontend deps
if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -q '^client/package-lock.json$\|^client/package.json$'; then
    log "Zmienił się client/package-lock — npm ci w client/"
    (cd client && npm ci)
else
    log "client/package-lock bez zmian — skip"
fi

# 4. Build frontu (z ograniczeniem pamięci dla małych VPSów)
log "Buduję frontend (client/build/)"
(cd client && NODE_OPTIONS=--max-old-space-size=2048 GENERATE_SOURCEMAP=false CI=false npm run build)
ok "Frontend zbudowany: $(du -sh client/build | cut -f1)"

# 5. Backend reload
if command -v pm2 >/dev/null 2>&1; then
    if pm2 describe ofertownik-server >/dev/null 2>&1; then
        log "pm2 reload ofertownik-server (zero-downtime)"
        pm2 reload ofertownik-server --update-env
    else
        log "pm2 start ecosystem.config.js --env production"
        pm2 start ecosystem.config.js --env production
        pm2 save
    fi
    ok "PM2 status:"
    pm2 list | grep ofertownik-server || true
else
    warn "PM2 niezainstalowany — pomijam restart backendu"
fi

ok "Deploy zakończony. Sprawdź: curl -I https://ofertownik.soft-synergy.com && curl -sI https://oferty.soft-synergy.com/api/auth/users -H 'X-API-Key: ...'"
