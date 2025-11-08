# Monitor Certyfikatów SSL

System automatycznego monitorowania i odnawiania certyfikatów SSL Let's Encrypt.

## Funkcje

- ✅ **Automatyczne wykrywanie certyfikatów** - skanuje `/etc/letsencrypt/live/` w poszukiwaniu certyfikatów
- ✅ **Sprawdzanie statusu** - monitoruje daty wygaśnięcia certyfikatów
- ✅ **Automatyczne odnawianie** - odnawia certyfikaty, gdy są blisko wygaśnięcia (domyślnie 30 dni)
- ✅ **Powiadomienia** - alarmy dla wygasających lub wygasłych certyfikatów
- ✅ **API** - pełne API do zarządzania certyfikatami
- ✅ **Dashboard** - wyświetlanie statusu certyfikatów w panelu admina

## Wymagania

1. **Certbot** - musi być zainstalowany na serwerze
2. **Uprawnienia sudo** - aplikacja musi mieć możliwość uruchamiania `sudo certbot renew`
3. **OpenSSL** - musi być zainstalowany (zwykle jest domyślnie)
4. **Let's Encrypt certyfikaty** - certyfikaty muszą być w `/etc/letsencrypt/live/`

## Konfiguracja

### 1. Instalacja Certbot (jeśli nie jest zainstalowany)

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot

# Sprawdź instalację
certbot --version
```

### 2. Konfiguracja sudo (bez hasła dla certbot)

Aby aplikacja mogła automatycznie odnawiać certyfikaty, musisz skonfigurować sudo bez hasła dla użytkownika Node.js:

```bash
# Edytuj sudoers
sudo visudo

# Dodaj linię (zamień 'node-user' na użytkownika, pod którym działa Node.js):
node-user ALL=(ALL) NOPASSWD: /usr/bin/certbot renew *
```

Aby znaleźć użytkownika Node.js:
```bash
# Jeśli używasz PM2
ps aux | grep node

# Lub sprawdź właściciela procesu
ps -p $(pgrep -f "node.*server/index.js") -o user=
```

### 3. Konfiguracja Nginx reload (opcjonalnie)

Jeśli używasz nginx, możesz automatycznie przeładować nginx po odnowieniu certyfikatu:

```bash
# Dodaj do sudoers
node-user ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx
```

### 4. Dodanie domen do monitoringu

Monitor automatycznie wykrywa certyfikaty przy starcie, ale możesz również dodać domeny ręcznie przez API:

```bash
# Przez API (wymaga autoryzacji admina)
POST /api/ssl
{
  "domain": "example.com",
  "autoRenew": true,
  "renewalThreshold": 30
}
```

Lub przez automatyczne wykrywanie:

```bash
POST /api/ssl/discover
```

## Użycie API

### Pobierz wszystkie certyfikaty

```bash
GET /api/ssl
Authorization: Bearer <token>
```

### Pobierz status certyfikatu

```bash
GET /api/ssl/:domain
Authorization: Bearer <token>
```

### Sprawdź certyfikat ręcznie

```bash
POST /api/ssl/check/:domain
Authorization: Bearer <token>
```

### Sprawdź wszystkie certyfikaty

```bash
POST /api/ssl/check-all
Authorization: Bearer <token>
```

### Odnów certyfikat ręcznie

```bash
POST /api/ssl/renew/:domain
Authorization: Bearer <token>
```

### Pobierz statystyki

```bash
GET /api/ssl/stats/summary
Authorization: Bearer <token>
```

### Wykryj certyfikaty

```bash
POST /api/ssl/discover
Authorization: Bearer <token>
```

### Potwierdź alarm

```bash
POST /api/ssl/:domain/acknowledge
Authorization: Bearer <token>
```

## Statusy certyfikatów

- **valid** - certyfikat jest ważny (więcej niż 30 dni do wygaśnięcia)
- **expiring_soon** - certyfikat wygasa wkrótce (30 dni lub mniej)
- **expired** - certyfikat wygasł
- **not_found** - certyfikat nie został znaleziony
- **error** - wystąpił błąd podczas sprawdzania

## Automatyczne odnawianie

System automatycznie odnawia certyfikaty, gdy:
- `autoRenew` jest ustawione na `true` (domyślnie)
- `daysUntilExpiry <= renewalThreshold` (domyślnie 30 dni)
- Certyfikat nie wygasł jeszcze

## Harmonogram sprawdzania

- **Domyślnie**: sprawdzanie co 24 godziny
- **Pierwsze sprawdzenie**: 10 sekund po uruchomieniu serwera
- **Automatyczne odnawianie**: gdy certyfikat jest blisko wygaśnięcia

## Troubleshooting

### Certbot nie jest dostępny

```bash
# Sprawdź instalację
which certbot
certbot --version

# Jeśli nie jest zainstalowany
sudo apt install certbot
```

### Brak uprawnień do certbota

```bash
# Sprawdź uprawnienia sudo
sudo certbot renew --dry-run

# Jeśli wymaga hasła, skonfiguruj sudoers (patrz wyżej)
```

### Certyfikat nie został znaleziony

```bash
# Sprawdź lokalizację certyfikatów
ls -la /etc/letsencrypt/live/

# Sprawdź ścieżkę do certyfikatu
ls -la /etc/letsencrypt/live/your-domain/fullchain.pem
```

### Błąd odczytu certyfikatu

```bash
# Sprawdź uprawnienia do plików
ls -la /etc/letsencrypt/live/your-domain/

# Użytkownik Node.js musi mieć uprawnienia do odczytu
# Zwykle certyfikaty Let's Encrypt są dostępne do odczytu dla wszystkich
```

### Nginx nie przeładowuje się po odnowieniu

```bash
# Sprawdź uprawnienia sudo dla systemctl
sudo systemctl reload nginx

# Jeśli wymaga hasła, dodaj do sudoers:
node-user ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx
```

## Bezpieczeństwo

- Wszystkie endpointy wymagają autoryzacji admina
- Certbot działa tylko z uprawnieniami sudo (bez hasła tylko dla konkretnych komend)
- Certyfikaty są przechowywane tylko w `/etc/letsencrypt/` (standardowa lokalizacja)
- Brak zapisywania prywatnych kluczy w bazie danych

## Logi

Monitor SSL loguje wszystkie działania do konsoli:
- Sprawdzanie certyfikatów
- Odnawianie certyfikatów
- Błędy i ostrzeżenia

Sprawdź logi aplikacji (PM2, systemd, itp.) aby zobaczyć szczegóły.

## Integracja z frontendem

Status certyfikatów SSL można wyświetlić w panelu admina. Dodaj komponent do wyświetlania certyfikatów:

```javascript
// Przykład użycia API
const response = await fetch('/api/ssl', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const certificates = await response.json();
```

## Wsparcie

W przypadku problemów:
1. Sprawdź logi aplikacji
2. Sprawdź uprawnienia sudo
3. Sprawdź czy certbot jest zainstalowany
4. Sprawdź czy certyfikaty istnieją w `/etc/letsencrypt/live/`

