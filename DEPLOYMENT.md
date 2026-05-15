# Deployment — Ofertownik Soft Synergy (produkcja)

Aktualny stan produkcji: VPS `admin@193.180.211.30` (Ubuntu 24.04), domeny `oferty.soft-synergy.com` (backend) + `ofertownik.soft-synergy.com` (frontend).

## Architektura

```
                      ┌───────────────────────────────────────┐
                      │  ofertownik.soft-synergy.com (HTTPS)  │
                      │  nginx → static /client/build/        │  ← React SPA (build)
                      └───────────────────────────────────────┘
                                       │
                                       │ fetch
                                       ▼
                      ┌───────────────────────────────────────┐
                      │  oferty.soft-synergy.com (HTTPS)      │
                      │  nginx → 127.0.0.1:5001               │  ← Express + Mongo
                      │  PM2: ofertownik-server (cluster)     │
                      └───────────────────────────────────────┘
                                       │
                                       ▼
                              MongoDB (zewnętrzne, MONGODB_URI z .env)
                              Brevo SMTP (development@soft-synergy.com)
```

- **Backend**: Node 20, Express, MongoDB (zewnętrzne), Brevo SMTP. Trzymany przez PM2 (cluster, 1 instancja). Plik PM2: `ecosystem.config.js`.
- **Frontend**: React (CRA / react-scripts). Buduje się do `client/build/`. Serwowany statycznie przez nginx — żadnych dev serverów na produkcji.
- **Reverse proxy**: nginx 1.29, dwa osobne vhosty (referencyjne kopie w `nginx/*.conf` w repo). Certyfikaty Let's Encrypt (managed by certbot).
- **Persystencja procesów**: `pm2 startup systemd` + `pm2 save` — przeżywa reboot serwera.

## Lokalizacje na serwerze

| Co | Gdzie |
|---|---|
| Kod | `/var/www/html/oferty/ofertownik-soft-synergy/` |
| Frontend build | `/var/www/html/oferty/ofertownik-soft-synergy/client/build/` |
| .env | `/var/www/html/oferty/ofertownik-soft-synergy/.env` |
| Logi PM2 | `/var/www/html/oferty/ofertownik-soft-synergy/logs/{out,err,combined}-2.log` |
| Nginx vhost | `/etc/nginx/sites-enabled/11` (jeden plik z wieloma server blokami) |
| SSL | `/etc/letsencrypt/live/{oferty,ofertownik}.soft-synergy.com/` |
| Uploady | `/var/www/html/oferty/ofertownik-soft-synergy/uploads/*` |

## Pierwsze uruchomienie produkcyjne (bootstrap)

Jednorazowe — w nowym środowisku. W typowym deploy wystarcza sekcja "Codzienny deploy".

1. **System packages**

   ```bash
   sudo apt-get update
   sudo apt-get install -y nginx git curl
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo npm install -g pm2
   ```

2. **Klon repo**

   ```bash
   sudo mkdir -p /var/www/html/oferty
   sudo chown $USER:$USER /var/www/html/oferty
   cd /var/www/html/oferty
   git clone https://github.com/soft-synergy/ofertownik-soft-synergy.git
   cd ofertownik-soft-synergy
   ```

3. **Konfiguracja `.env`** — skopiuj `env.example` do `.env` i wypełnij:

   ```bash
   cp env.example .env
   # Wymagane:
   #   MONGODB_URI=mongodb+srv://...
   #   JWT_SECRET=...               # openssl rand -base64 32
   #   SMTP_HOST=smtp-relay.brevo.com
   #   SMTP_PORT=587
   #   SMTP_USER=...
   #   SMTP_PASS=...
   #   CLAUDE_API_KEY=...
   #   CLAUDE_API_SCOPES=tasks:read,tasks:write,projects:read,users:read,documents:read,documents:write,portfolio:read,mail:send
   #   CLAUDE_MAIL_ALLOWED_RECIPIENTS=info@soft-synergy.com
   ```

4. **Instalacja zależności**

   ```bash
   npm ci
   (cd client && npm ci)
   ```

5. **Build frontu**

   ```bash
   (cd client && NODE_OPTIONS=--max-old-space-size=2048 GENERATE_SOURCEMAP=false CI=false npm run build)
   ```

6. **Backend pod PM2**

   ```bash
   pm2 start ecosystem.config.js --env production
   pm2 save
   sudo env PATH=$PATH:/usr/bin $(which pm2) startup systemd -u $USER --hp $HOME
   ```

7. **Nginx + SSL**

   - Skopiuj zawartość `nginx/ofertownik.soft-synergy.com.conf` i `nginx/oferty.soft-synergy.com.conf` do `/etc/nginx/sites-available/ofertownik` i utwórz symlink w `sites-enabled`. (Na obecnym VPS są one wpięte w zbiorczy plik `/etc/nginx/sites-enabled/11` — edytuj w miejscu, nie dubluj server bloków.)
   - SSL: `sudo certbot --nginx -d ofertownik.soft-synergy.com -d oferty.soft-synergy.com`
   - Test + reload: `sudo nginx -t && sudo systemctl reload nginx`

8. **Konto admina** — jeśli baza pusta:

   ```bash
   node server/scripts/create-admin.js
   ```

## Codzienny deploy (po zmianach w repo)

Najprostsza ścieżka — odpal skrypt z repo:

```bash
ssh admin@193.180.211.30
cd /var/www/html/oferty/ofertownik-soft-synergy
bash scripts/deploy.sh
```

Skrypt robi:
1. `git pull --ff-only`
2. `npm ci` w roocie i w `client/` — tylko jeśli `package-lock.json` się zmienił
3. `npm run build` w `client/` (z limitem RAM dla małych VPSów)
4. `pm2 reload ofertownik-server --update-env` (zero-downtime cluster reload)

Jeśli zmieniony był nginx vhost — trzeba ręcznie zsynchronizować z `/etc/nginx/sites-enabled/` i wywołać `sudo nginx -t && sudo systemctl reload nginx`.

## Operacje codzienne

```bash
# Status
pm2 list
pm2 logs ofertownik-server --lines 100

# Restart po zmianie .env
pm2 restart ofertownik-server --update-env

# Hot reload kodu bez przerwy (cluster mode)
pm2 reload ofertownik-server

# Smoke testy
curl -I https://ofertownik.soft-synergy.com                # 200 + index.html
curl -s https://oferty.soft-synergy.com/api/mail/config \
  -H "X-API-Key: $CLAUDE_API_KEY"                          # 200 + JSON

# Nginx logi
sudo tail -f /var/log/nginx/ofertownik.soft-synergy.com.access.log
sudo tail -f /var/log/nginx/oferty.soft-synergy.com.error.log
```

## Endpointy publiczne i private

- `https://ofertownik.soft-synergy.com/*` — SPA (logowanie wymagane do większości widoków).
- `https://oferty.soft-synergy.com/api/*` — REST API, autoryzacja JWT (logowanie) lub `X-API-Key` (klucz Claude).
- `https://oferty.soft-synergy.com/dokumenty/<slug>` — publiczne dokumenty/playbooki.
- `https://oferty.soft-synergy.com/generated-offers/<id>` — wygenerowane oferty PDF/HTML.

## Co Claude może robić przez API key

Scope domyślny (`CLAUDE_API_SCOPES` w `.env`):
- `tasks:read`, `tasks:write` — pełne CRUD tasków + komentarze.
- `projects:read` — tylko odczyt projektów.
- `users:read` — lista pracowników.
- `documents:read`, `documents:write` — pełne CRUD dokumentów i playbooków.
- `portfolio:read` — portfolio.
- `mail:send` — wysyłka maila przez `POST /api/mail/send` (whitelista w `CLAUDE_MAIL_ALLOWED_RECIPIENTS`, default `info@soft-synergy.com`).

Pełna ściąga z endpointów jest w skillu `ofertownik` w Claude Code.

## Troubleshooting

**`pm2 list` nie pokazuje `ofertownik-server`** — `pm2 start ecosystem.config.js --env production && pm2 save`.

**Port 5001 zajęty po deploy** — szukaj osieroconych procesów (stary screen / nodemon):
```bash
screen -ls
ps -ef | grep server/index | grep -v grep
ss -tlnp | grep :5001
```
Jeśli jest stary screen — `screen -S <name> -X quit`, potem `pm2 start ecosystem.config.js --env production`.

**Frontend 404 na każdej podstronie po refresh** — brakuje SPA fallbacku w nginx. Sprawdź `try_files $uri /index.html;` w `location /` w sekcji `ofertownik.soft-synergy.com`.

**`mail:send` zwraca 403** — `.env` → `CLAUDE_API_SCOPES` musi zawierać `mail:send`. Po edycie `pm2 restart ofertownik-server --update-env`.

**Build CRA OOM na VPS** — buduj z `NODE_OPTIONS=--max-old-space-size=2048 GENERATE_SOURCEMAP=false CI=false`. Skrypt `scripts/deploy.sh` już to robi. W ostateczności zbuduj lokalnie i `rsync client/build/` na serwer.

**SSL wygasa** — `sudo certbot renew --dry-run`. Certbot ma automatyczny timer (`systemctl status certbot.timer`).

## Plik referencyjny — nginx

Aktualne vhosty są w repo jako kopie do podglądu:
- `nginx/ofertownik.soft-synergy.com.conf` — frontend SPA (statyk + SPA fallback).
- `nginx/oferty.soft-synergy.com.conf` — backend proxy do `127.0.0.1:5001`.

Na serwerze są one obecnie wpięte w zbiorczy plik `/etc/nginx/sites-enabled/11`. Jeśli planujesz refaktor — rozdziel je do osobnych plików w `sites-available` i podlinkuj.
