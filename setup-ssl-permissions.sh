#!/bin/bash

# Skrypt do bezpiecznego ustawienia uprawnień SSL i Certbot
# Uruchom jako: chmod +x setup-ssl-permissions.sh && sudo ./setup-ssl-permissions.sh

set -e  # Zatrzymaj przy błędzie

# Kolory
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Sprawdź czy skrypt jest uruchomiony jako root
if [ "$EUID" -ne 0 ]; then 
    log_error "Ten skrypt musi być uruchomiony jako root (użyj sudo)"
    exit 1
fi

log_info "🔒 Konfiguracja uprawnień SSL i Certbot"
echo ""

# 1. Znajdź użytkownika Node.js
log_info "Szukanie użytkownika Node.js..."

# Sprawdź PM2
NODE_USER=""
if command -v pm2 &> /dev/null; then
    PM2_USER=$(pm2 prettylist 2>/dev/null | grep -oP 'username.*:\s*\K[^\s]+' | head -1 || echo "")
    if [ ! -z "$PM2_USER" ]; then
        NODE_USER="$PM2_USER"
        log_success "Znaleziono użytkownika PM2: $NODE_USER"
    fi
fi

# Jeśli nie znaleziono przez PM2, sprawdź procesy Node.js
if [ -z "$NODE_USER" ]; then
    NODE_PID=$(pgrep -f "node.*server/index.js" | head -1 || echo "")
    if [ ! -z "$NODE_PID" ]; then
        NODE_USER=$(ps -o user= -p "$NODE_PID" 2>/dev/null | tr -d ' ' || echo "")
        if [ ! -z "$NODE_USER" ]; then
            log_success "Znaleziono użytkownika z procesu Node.js: $NODE_USER"
        fi
    fi
fi

# Jeśli nadal nie znaleziono, sprawdź właściciela katalogu projektu
if [ -z "$NODE_USER" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    NODE_USER=$(stat -c '%U' "$SCRIPT_DIR" 2>/dev/null || stat -f '%Su' "$SCRIPT_DIR" 2>/dev/null || echo "")
    if [ ! -z "$NODE_USER" ] && [ "$NODE_USER" != "root" ]; then
        log_success "Znaleziono użytkownika z katalogu projektu: $NODE_USER"
    fi
fi

# Jeśli nadal nie znaleziono, zapytaj użytkownika
if [ -z "$NODE_USER" ] || [ "$NODE_USER" = "root" ]; then
    log_warning "Nie udało się automatycznie znaleźć użytkownika Node.js"
    read -p "Podaj nazwę użytkownika, pod którym działa Node.js: " NODE_USER
    if [ -z "$NODE_USER" ]; then
        log_error "Użytkownik nie może być pusty"
        exit 1
    fi
fi

# Sprawdź czy użytkownik istnieje
if ! id "$NODE_USER" &>/dev/null; then
    log_error "Użytkownik '$NODE_USER' nie istnieje"
    exit 1
fi

log_success "Używanie użytkownika: $NODE_USER"
echo ""

# 2. Sprawdź czy certbot jest zainstalowany
log_info "Sprawdzanie instalacji Certbot..."
CERTBOT_PATH=""
if command -v certbot &> /dev/null; then
    CERTBOT_PATH=$(which certbot)
    log_success "Certbot znaleziony: $CERTBOT_PATH"
else
    log_warning "Certbot nie jest zainstalowany"
    read -p "Czy chcesz zainstalować Certbot? (t/n): " INSTALL_CERTBOT
    if [ "$INSTALL_CERTBOT" = "t" ] || [ "$INSTALL_CERTBOT" = "T" ] || [ "$INSTALL_CERTBOT" = "y" ] || [ "$INSTALL_CERTBOT" = "Y" ]; then
        log_info "Instalowanie Certbot..."
        if command -v apt-get &> /dev/null; then
            apt-get update
            apt-get install -y certbot
            CERTBOT_PATH=$(which certbot)
            log_success "Certbot zainstalowany: $CERTBOT_PATH"
        elif command -v yum &> /dev/null; then
            yum install -y certbot
            CERTBOT_PATH=$(which certbot)
            log_success "Certbot zainstalowany: $CERTBOT_PATH"
        else
            log_error "Nie znaleziono menedżera pakietów (apt-get lub yum)"
            exit 1
        fi
    else
        log_warning "Pomijanie instalacji Certbot"
    fi
fi

# 3. Konfiguracja sudoers
log_info "Konfiguracja uprawnień sudo..."

SUDOERS_FILE="/etc/sudoers.d/ssl-certbot-$NODE_USER"
BACKUP_FILE="${SUDOERS_FILE}.backup.$(date +%Y%m%d_%H%M%S)"

# Utwórz backup istniejącego pliku
if [ -f "$SUDOERS_FILE" ]; then
    log_info "Tworzenie kopii zapasowej: $BACKUP_FILE"
    cp "$SUDOERS_FILE" "$BACKUP_FILE"
    chmod 600 "$BACKUP_FILE"
fi

# Sprawdź czy wpisy już istnieją
CERTBOT_CMD=""
if [ ! -z "$CERTBOT_PATH" ]; then
    CERTBOT_CMD="$CERTBOT_PATH"
else
    CERTBOT_CMD="/usr/bin/certbot"
fi

NGINX_RELOAD_EXISTS=false
CERTBOT_RENEW_EXISTS=false
CERTBOT_CERTONLY_EXISTS=false

if [ -f "$SUDOERS_FILE" ]; then
    if grep -q "systemctl reload nginx" "$SUDOERS_FILE" 2>/dev/null; then
        NGINX_RELOAD_EXISTS=true
    fi
    if grep -q "certbot renew" "$SUDOERS_FILE" 2>/dev/null; then
        CERTBOT_RENEW_EXISTS=true
    fi
    if grep -q "certbot certonly" "$SUDOERS_FILE" 2>/dev/null; then
        CERTBOT_CERTONLY_EXISTS=true
    fi
fi

# Utwórz nowy plik sudoers
TEMP_SUDOERS=$(mktemp)
trap "rm -f $TEMP_SUDOERS" EXIT

# Dodaj nagłówek
cat > "$TEMP_SUDOERS" << EOF
# Uprawnienia SSL i Certbot dla użytkownika $NODE_USER
# Wygenerowane automatycznie przez setup-ssl-permissions.sh
# Data: $(date)

EOF

# Dodaj uprawnienia do certbot renew (jeśli nie istnieją)
if [ "$CERTBOT_RENEW_EXISTS" = false ]; then
    echo "# Odnawianie certyfikatów SSL" >> "$TEMP_SUDOERS"
    echo "$NODE_USER ALL=(ALL) NOPASSWD: $CERTBOT_CMD renew *" >> "$TEMP_SUDOERS"
    echo "" >> "$TEMP_SUDOERS"
    log_info "Dodano uprawnienia do: certbot renew"
fi

# Dodaj uprawnienia do certbot certonly (jeśli nie istnieją)
if [ "$CERTBOT_CERTONLY_EXISTS" = false ]; then
    echo "# Generowanie nowych certyfikatów SSL" >> "$TEMP_SUDOERS"
    echo "$NODE_USER ALL=(ALL) NOPASSWD: $CERTBOT_CMD certonly *" >> "$TEMP_SUDOERS"
    echo "" >> "$TEMP_SUDOERS"
    log_info "Dodano uprawnienia do: certbot certonly"
fi

# Dodaj uprawnienia do nginx reload (jeśli nie istnieją)
if [ "$NGINX_RELOAD_EXISTS" = false ]; then
    echo "# Przeładowanie nginx po odnowieniu certyfikatu" >> "$TEMP_SUDOERS"
    echo "$NODE_USER ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx" >> "$TEMP_SUDOERS"
    echo "$NODE_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl reload nginx" >> "$TEMP_SUDOERS"
    echo "" >> "$TEMP_SUDOERS"
    log_info "Dodano uprawnienia do: systemctl reload nginx"
fi

# Sprawdź składnię sudoers przed zapisem
if visudo -c -f "$TEMP_SUDOERS" 2>/dev/null; then
    # Połącz z istniejącym plikiem (jeśli istnieje)
    if [ -f "$SUDOERS_FILE" ]; then
        # Usuń duplikaty i dodaj nowe wpisy
        cat "$SUDOERS_FILE" "$TEMP_SUDOERS" | sort -u > "${TEMP_SUDOERS}.merged"
        mv "${TEMP_SUDOERS}.merged" "$TEMP_SUDOERS"
    fi
    
    # Sprawdź ponownie składnię
    if visudo -c -f "$TEMP_SUDOERS" 2>/dev/null; then
        # Ustaw poprawne uprawnienia i zapisz
        chmod 440 "$TEMP_SUDOERS"
        chown root:root "$TEMP_SUDOERS"
        mv "$TEMP_SUDOERS" "$SUDOERS_FILE"
        log_success "Plik sudoers zaktualizowany: $SUDOERS_FILE"
    else
        log_error "Błąd składni w pliku sudoers!"
        rm -f "$TEMP_SUDOERS"
        exit 1
    fi
else
    log_error "Błąd składni w pliku sudoers!"
    rm -f "$TEMP_SUDOERS"
    exit 1
fi

# 4. Ustaw uprawnienia do katalogów Let's Encrypt
log_info "Konfiguracja uprawnień do katalogów Let's Encrypt..."

LETSENCRYPT_DIR="/etc/letsencrypt"
if [ -d "$LETSENCRYPT_DIR" ]; then
    # Sprawdź obecne uprawnienia
    CURRENT_PERMS=$(stat -c '%a' "$LETSENCRYPT_DIR" 2>/dev/null || stat -f '%A' "$LETSENCRYPT_DIR" 2>/dev/null || echo "")
    
    # Ustaw uprawnienia do odczytu dla wszystkich (certyfikaty Let's Encrypt są publiczne)
    # Katalog live powinien być dostępny do odczytu
    if [ -d "$LETSENCRYPT_DIR/live" ]; then
        chmod 755 "$LETSENCRYPT_DIR/live" 2>/dev/null || true
        log_info "Ustawiono uprawnienia do $LETSENCRYPT_DIR/live"
    fi
    
    # Upewnij się, że użytkownik może czytać certyfikaty
    # Certyfikaty Let's Encrypt są domyślnie dostępne do odczytu dla wszystkich
    find "$LETSENCRYPT_DIR/live" -type f -name "*.pem" -exec chmod 644 {} \; 2>/dev/null || true
    find "$LETSENCRYPT_DIR/live" -type d -exec chmod 755 {} \; 2>/dev/null || true
    
    log_success "Uprawnienia do katalogów Let's Encrypt skonfigurowane"
else
    log_warning "Katalog $LETSENCRYPT_DIR nie istnieje (może być pierwsza instalacja)"
fi

# 5. Sprawdź dostępność nginx
log_info "Sprawdzanie nginx..."
if command -v nginx &> /dev/null || systemctl list-unit-files | grep -q nginx.service; then
    log_success "Nginx jest dostępny"
    
    # Sprawdź czy nginx działa
    if systemctl is-active --quiet nginx 2>/dev/null; then
        log_success "Nginx jest aktywny"
    else
        log_warning "Nginx nie jest aktywny (ale to OK, jeśli nie jest jeszcze skonfigurowany)"
    fi
else
    log_warning "Nginx nie jest zainstalowany lub niedostępny"
fi

# 6. Test uprawnień
log_info "Testowanie uprawnień..."

# Test certbot (jeśli jest dostępny)
if [ ! -z "$CERTBOT_PATH" ]; then
    if sudo -u "$NODE_USER" sudo -n "$CERTBOT_PATH" --version &>/dev/null; then
        log_success "Test certbot: OK"
    else
        log_warning "Nie można przetestować certbot (może wymagać interakcji)"
    fi
fi

# Test nginx reload (jeśli nginx jest dostępny)
if systemctl list-unit-files | grep -q nginx.service; then
    if sudo -u "$NODE_USER" sudo -n systemctl reload nginx &>/dev/null 2>&1; then
        log_success "Test nginx reload: OK"
    else
        # To może się nie udać, jeśli nginx nie działa - to OK
        log_info "Test nginx reload: Pominięty (nginx może nie być skonfigurowany)"
    fi
fi

# Test odczytu certyfikatów
if [ -d "$LETSENCRYPT_DIR/live" ]; then
    TEST_CERT=$(find "$LETSENCRYPT_DIR/live" -name "fullchain.pem" -type f | head -1)
    if [ ! -z "$TEST_CERT" ]; then
        if sudo -u "$NODE_USER" test -r "$TEST_CERT" 2>/dev/null; then
            log_success "Test odczytu certyfikatów: OK"
        else
            log_warning "Użytkownik $NODE_USER nie może czytać certyfikatów"
            log_info "Ustawianie uprawnień do odczytu..."
            chmod 755 "$LETSENCRYPT_DIR/live" 2>/dev/null || true
            find "$LETSENCRYPT_DIR/live" -type d -exec chmod 755 {} \; 2>/dev/null || true
            find "$LETSENCRYPT_DIR/live" -type f -exec chmod 644 {} \; 2>/dev/null || true
        fi
    else
        log_info "Brak certyfikatów do testowania (to OK, jeśli jeszcze nie są wygenerowane)"
    fi
fi

echo ""
log_success "✅ Konfiguracja uprawnień SSL zakończona pomyślnie!"
echo ""
log_info "Podsumowanie:"
echo "  - Użytkownik: $NODE_USER"
if [ ! -z "$CERTBOT_PATH" ]; then
    echo "  - Certbot: $CERTBOT_PATH"
fi
echo "  - Plik sudoers: $SUDOERS_FILE"
if [ -f "$BACKUP_FILE" ]; then
    echo "  - Backup: $BACKUP_FILE"
fi
echo ""
log_info "Następne kroki:"
echo "  1. Zrestartuj serwer aplikacji Node.js"
echo "  2. Sprawdź logi, czy monitoring SSL działa"
echo "  3. Użyj przycisku 'Skanuj SSL' w panelu admina, aby znaleźć certyfikaty"
echo ""

