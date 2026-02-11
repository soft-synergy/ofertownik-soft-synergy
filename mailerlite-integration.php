<?php
/**
 * Plugin Name: MailerLite Integration for Elementor
 * Description: Automatycznie dodaje użytkowników z formularzy Elementor do grupy MailerLite "Zapisani do newslettera"
 * Version: 1.0
 * Author: Soft Synergy
 */

// Zapobiegaj bezpośredniemu dostępowi
if (!defined('ABSPATH')) {
    exit;
}

add_action('elementor_pro/forms/new_record', 'send_elementor_form_to_mailerlite', 10, 2);

function send_elementor_form_to_mailerlite($record, $handler) {
    // Sprawdź czy jesteśmy na stronie kontakt - jeśli tak, zakończ funkcję
    $current_url = home_url($_SERVER['REQUEST_URI']);
    $excluded_url = 'https://finkids.pl/kontakt/';
    
    // Sprawdź dokładny URL lub sprawdź czy kończy się na /kontakt/
    if ($current_url === $excluded_url || $current_url === rtrim($excluded_url, '/') || preg_match('/\/kontakt\/?$/', $current_url)) {
        error_log('MailerLite Integration: Pominięto wysyłanie - formularz na stronie kontakt');
        return;
    }
    
    // Alternatywnie można sprawdzać po slug strony
    global $post;
    if ($post && ($post->post_name === 'kontakt' || $post->post_slug === 'kontakt')) {
        error_log('MailerLite Integration: Pominięto wysyłanie - formularz na stronie kontakt (slug)');
        return;
    }

    // Twój klucz API MailerLite
    $api_key = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiNjY4MWNiNzA4MzY0YzI2NTVjYjNhMmRmMzA2MTRhOGE2MGUzNmUzNjY5OTgwMjdkYzE2NDM5MGE3N2FhMGM0M2I3OWM3Mjc1NjY5YTc1NTAiLCJpYXQiOjE3MzQ1MjYwOTcuNzkwMjc4LCJuYmYiOjE3MzQ1MjYwOTcuNzkwMjgyLCJleHAiOjQ4OTAxOTk2OTcuNzgyMzM3LCJzdWIiOiIxMjQ4MjAyIiwic2NvcGVzIjpbXX0.gdGQkbtGZnOuRgt4k0ukvehu3-WLGGsl4oP_hZkEjjlMzp880JgnNQzgfa2E_Waut8gYfJnk5g6uHAAX5kFWotaPl8MJiM1OlZde-BgT_Zm6c4TTfF-5mbPZkpLawD3yzeamPrcxIkspfQ1ZX2KzCS4xI2lM6OupXGMdk22npZe96hiVLWRJEJ00qKxO3Y0varxqOO23nz-JFz4fq5csuywBEMtgLMWmaRAD4resv6zvs20rs_-Kzr7qYB9QVLcfByS-Fn9sua5ybB4XnQ2LVURn_HTtLKw8gjE7SODXXTmlJi_-ajN07wyUslHIBwcWez13ryV8afdZncHB3sKkFhu1BkfmGf4Iv64Cu3DTgDwaQikSX9zRGJF71T0RLaK89nmRbHRIj0kSxCy8Snx55JVOAqNWzofUTbtT2gl9luSuEykYZumJ_WkNBjTQssDpACEfrFTm0tv3PcZXvs6tOhntxjkDcHIJiIvzSd1JLzJwEQe8GGeRup491G1_djQHoyJJyJvLqVX1Us0BmAz7G3e9jKcAUSNo_RP65RkwMUd6ltpuCQZwqEnwHJ7MfkfxnCe5sZd1AzCoatQVuSczbf1JXRnNgWzI5zzTLlgbXRsS2WzLVD2nj-o9WF_CbNKFJjNCzW_jbAb0dIDHdQ65OotGupqzcUW1royj1Oji09Q';

    // ID grupy "Zapisani do newslettera" - znalezione przez API
    $newsletter_group_id = '166328251758675554';

    try {
        // Pobierz dane z formularza
        $raw_fields = $record->get('fields');
        $form_name = $record->get_form_settings('form_name');

        // Przetwórz pola formularza
        $fields = array();
        foreach ($raw_fields as $id => $field) {
            $fields[$id] = $field['value'];
        }

        // Znajdź pole email - sprawdza różne możliwe nazwy
        $email = '';
        $possible_email_fields = array('email', 'e-mail', 'mail', 'email_address', 'user_email');
        
        foreach ($fields as $field_id => $field_value) {
            $field_id_lower = strtolower($field_id);
            foreach ($possible_email_fields as $email_field) {
                if (strpos($field_id_lower, $email_field) !== false && is_email($field_value)) {
                    $email = $field_value;
                    break 2;
                }
            }
        }

        // Jeśli nie znalazł emaila po nazwie pola, sprawdź wszystkie pola pod kątem formatu email
        if (empty($email)) {
            foreach ($fields as $field_value) {
                if (is_email($field_value)) {
                    $email = $field_value;
                    break;
                }
            }
        }

        if (empty($email)) {
            error_log('MailerLite Integration: Nie znaleziono emaila w formularzu');
            return;
        }

        // Znajdź imię i nazwisko
        $first_name = '';
        $last_name = '';
        
        foreach ($fields as $field_id => $field_value) {
            $field_id_lower = strtolower($field_id);
            
            // Sprawdź imię
            if (empty($first_name) && (
                strpos($field_id_lower, 'first_name') !== false ||
                strpos($field_id_lower, 'firstname') !== false ||
                strpos($field_id_lower, 'imie') !== false ||
                strpos($field_id_lower, 'imię') !== false ||
                strpos($field_id_lower, 'name') !== false
            )) {
                $first_name = sanitize_text_field($field_value);
            }
            
            // Sprawdź nazwisko
            if (empty($last_name) && (
                strpos($field_id_lower, 'last_name') !== false ||
                strpos($field_id_lower, 'lastname') !== false ||
                strpos($field_id_lower, 'nazwisko') !== false ||
                strpos($field_id_lower, 'surname') !== false
            )) {
                $last_name = sanitize_text_field($field_value);
            }
        }

        // Przygotuj dane do wysłania - DODAJEMY GRUPĘ!
        $subscriber_data = array(
            'email' => $email,
            'groups' => array($newsletter_group_id) // Automatycznie dodaj do grupy newsletter
        );

        // Dodaj imię i nazwisko jeśli są dostępne
        if (!empty($first_name) || !empty($last_name)) {
            $subscriber_data['fields'] = array();
            if (!empty($first_name)) {
                $subscriber_data['fields']['name'] = $first_name;
            }
            if (!empty($last_name)) {
                $subscriber_data['fields']['last_name'] = $last_name;
            }
        }

        // Dodaj niestandardowe pola z formularza
        $custom_fields = array();
        foreach ($fields as $field_id => $field_value) {
            // Pomiń pola email, imię i nazwisko - już je mamy
            $field_id_lower = strtolower($field_id);
            $skip_field = false;
            $skip_patterns = array('email', 'mail', 'first_name', 'firstname', 'last_name', 'lastname', 'imie', 'imię', 'nazwisko', 'surname');
            
            foreach ($skip_patterns as $pattern) {
                if (strpos($field_id_lower, $pattern) !== false) {
                    $skip_field = true;
                    break;
                }
            }
            
            if (!$skip_field && !empty($field_value) && !is_email($field_value)) {
                $custom_fields[$field_id] = sanitize_text_field($field_value);
            }
        }

        if (!empty($custom_fields)) {
            if (!isset($subscriber_data['fields'])) {
                $subscriber_data['fields'] = array();
            }
            $subscriber_data['fields'] = array_merge($subscriber_data['fields'], $custom_fields);
        }

        // Dodaj źródło formularza
        if (!empty($form_name)) {
            if (!isset($subscriber_data['fields'])) {
                $subscriber_data['fields'] = array();
            }
            $subscriber_data['fields']['source'] = 'Elementor Form: ' . $form_name;
        }

        // Wyślij do MailerLite
        $response = wp_remote_post('https://connect.mailerlite.com/api/subscribers', array(
            'method' => 'POST',
            'timeout' => 30,
            'headers' => array(
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
                'Authorization' => 'Bearer ' . $api_key,
            ),
            'body' => json_encode($subscriber_data)
        ));

        if (is_wp_error($response)) {
            error_log('MailerLite Integration Error: ' . $response->get_error_message());
            return false;
        }

        $response_code = wp_remote_retrieve_response_code($response);
        $response_body = wp_remote_retrieve_body($response);

        if ($response_code >= 200 && $response_code < 300) {
            error_log('MailerLite Integration: Pomyślnie dodano subskrybenta do grupy newsletter: ' . $email);
            
            // Opcjonalnie: zapisz w bazie danych informację o wysłaniu
            update_option('mailerlite_last_submission_' . md5($email), array(
                'email' => $email,
                'date' => current_time('mysql'),
                'form_name' => $form_name,
                'group_id' => $newsletter_group_id,
                'status' => 'success'
            ));
            
            return true;
        } else {
            $error_data = json_decode($response_body, true);
            $error_message = isset($error_data['message']) ? $error_data['message'] : 'Unknown error';
            error_log('MailerLite Integration Error: HTTP ' . $response_code . ' - ' . $error_message);
            
            // Zapisz błąd
            update_option('mailerlite_last_error', array(
                'email' => $email,
                'date' => current_time('mysql'),
                'error' => $error_message,
                'response_code' => $response_code
            ));
            
            return false;
        }

    } catch (Exception $e) {
        error_log('MailerLite Integration Exception: ' . $e->getMessage());
        return false;
    }
}

// Funkcja pomocnicza do debugowania - usuń po testach
function mailerlite_debug_last_submission() {
    if (current_user_can('manage_options')) {
        $last_error = get_option('mailerlite_last_error');
        if ($last_error) {
            echo '<div class="notice notice-error"><p><strong>MailerLite Last Error:</strong> ' . esc_html($last_error['error']) . ' (' . esc_html($last_error['date']) . ')</p></div>';
        }
    }
}

add_action('admin_notices', 'mailerlite_debug_last_submission');

// Menu w panelu admina do sprawdzania statusu
add_action('admin_menu', 'mailerlite_integration_menu');

function mailerlite_integration_menu() {
    add_options_page(
        'MailerLite Integration',
        'MailerLite Status',
        'manage_options',
        'mailerlite-status',
        'mailerlite_status_page'
    );
}

function mailerlite_status_page() {
    $last_error = get_option('mailerlite_last_error');
    ?>
    <div class="wrap">
        <h1>MailerLite Integration Status</h1>
        
        <div class="notice notice-info">
            <p><strong>Grupa docelowa:</strong> Zapisani do newslettera (ID: 166328251758675554)</p>
            <p><strong>Wykluczenia:</strong> Integracja NIE działa na stronie: https://finkids.pl/kontakt/</p>
        </div>

        <?php if ($last_error): ?>
        <div class="notice notice-error">
            <p><strong>Ostatni błąd:</strong></p>
            <p>Email: <?php echo esc_html($last_error['email']); ?></p>
            <p>Data: <?php echo esc_html($last_error['date']); ?></p>
            <p>Błąd: <?php echo esc_html($last_error['error']); ?></p>
            <p>Kod odpowiedzi: <?php echo esc_html($last_error['response_code']); ?></p>
        </div>
        <?php else: ?>
        <div class="notice notice-success">
            <p>Brak błędów w integracji z MailerLite</p>
        </div>
        <?php endif; ?>

        <h2>Jak to działa:</h2>
        <ul>
            <li>Kod automatycznie przechwytuje wszystkie formularze Elementor Pro</li>
            <li><strong>GRUPA:</strong> Wszyscy użytkownicy są automatycznie dodawani do grupy "Zapisani do newslettera"</li>
            <li><strong>WYJĄTEK:</strong> Nie działa na stronie kontakt (/kontakt/)</li>
            <li>Wyszukuje pole email w formularzu</li>
            <li>Próbuje znaleźć imię i nazwisko</li>
            <li>Wysyła wszystkie dane do MailerLite z przypisaniem do grupy</li>
            <li>Zapisuje logi błędów w przypadku problemów</li>
        </ul>

        <h2>Testowanie:</h2>
        <p>Wypełnij dowolny formularz Elementor na swojej stronie (oprócz strony kontakt). Sprawdź logi błędów powyżej lub w konsoli przeglądarki.</p>

        <h2>Pola automatycznie rozpoznawane:</h2>
        <ul>
            <li><strong>Email:</strong> email, e-mail, mail, email_address, user_email</li>
            <li><strong>Imię:</strong> first_name, firstname, imie, imię, name</li>
            <li><strong>Nazwisko:</strong> last_name, lastname, nazwisko, surname</li>
        </ul>

        <h2>Grupa docelowa:</h2>
        <ul>
            <li><strong>Nazwa:</strong> Zapisani do newslettera</li>
            <li><strong>ID:</strong> 166328251758675554</li>
        </ul>

        <h2>Wykluczenia:</h2>
        <ul>
            <li><strong>URL:</strong> https://finkids.pl/kontakt/</li>
            <li><strong>Slug strony:</strong> kontakt</li>
        </ul>
    </div>
    <?php
}


