<?php

// Prosty tester API hurtowni w PHP.
// Formularz HTML + wywołania GraphQL (login, koszyk, metody dostawy).

const API_URL = 'https://hurtownia.agrorami.pl/graphql';
const API_EMAIL = 'krobia.granit@wp.pl';
const API_PASSWORD = '@Api2024@';

function graphqlRequest(string $query, array $variables = null, string $token = null): array
{
    $ch = curl_init(API_URL);

    $payload = [
        'query' => $query,
        'variables' => $variables ?? new stdClass(),
    ];

    $headers = [
        'Content-Type: application/json',
    ];
    if ($token !== null) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 30,
    ]);

    $response = curl_exec($ch);
    if ($response === false) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('Błąd połączenia cURL: ' . $error);
    }
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode < 200 || $httpCode >= 300) {
        throw new RuntimeException('Błąd HTTP ' . $httpCode . ': ' . $response);
    }

    $data = json_decode($response, true);
    if (isset($data['errors'])) {
        throw new RuntimeException('GraphQL errors: ' . json_encode($data['errors'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    return $data['data'] ?? [];
}

function getCustomerToken(): string
{
    $query = <<<'GQL'
mutation ($email: String!, $password: String!) {
  generateCustomerToken(email: $email, password: $password) {
    token
  }
}
GQL;

    $variables = [
        'email' => API_EMAIL,
        'password' => API_PASSWORD,
    ];

    $data = graphqlRequest($query, $variables);
    return $data['generateCustomerToken']['token'];
}

function getDefaultAddresses(string $token): array
{
    $query = <<<'GQL'
{
  customer {
    addresses {
      id
      default_billing
      default_shipping
    }
  }
}
GQL;

    $data = graphqlRequest($query, null, $token);
    $addresses = $data['customer']['addresses'] ?? [];
    if (empty($addresses)) {
        throw new RuntimeException('Brak adresów przypisanych do klienta.');
    }

    $billingId = null;
    $shippingId = null;
    foreach ($addresses as $addr) {
        if (!empty($addr['default_billing'])) {
            $billingId = $addr['id'];
        }
        if (!empty($addr['default_shipping'])) {
            $shippingId = $addr['id'];
        }
    }

    if ($billingId === null) {
        $billingId = $addresses[0]['id'];
    }
    if ($shippingId === null) {
        $shippingId = $addresses[0]['id'];
    }

    return [$billingId, $shippingId];
}

function createEmptyCart(string $token): string
{
    $query = <<<'GQL'
mutation {
  createEmptyCart
}
GQL;

    $data = graphqlRequest($query, null, $token);
    return $data['createEmptyCart'];
}

function addProductToCart(string $token, string $cartId, string $sku, float $qty): bool
{
    $query = <<<'GQL'
mutation ($cartId: String!, $sku: String!, $qty: Float!) {
  addSimpleProductsToCart(
    input: {
      cart_id: $cartId
      cart_items: [
        {
          data: {
            quantity: $qty
            sku: $sku
          }
        }
      ]
    }
  ) {
    cart {
      items {
        id
        product {
          name
          sku
        }
        quantity
      }
    }
  }
}
GQL;

    $variables = [
        'cartId' => $cartId,
        'sku' => $sku,
        'qty' => $qty,
    ];

    try {
        graphqlRequest($query, $variables, $token);
        return true;
    } catch (RuntimeException $e) {
        // Np. produkty wymagające dodatkowego typu przesyłki zewnętrznej.
        throw new RuntimeException('Nie udało się dodać produktu do koszyka: ' . $e->getMessage());
    }
}

function setShippingAddress(string $token, string $cartId, int $shippingId): void
{
    $query = <<<'GQL'
mutation ($cartId: String!, $shippingId: Int!) {
  setShippingAddressesOnCart(
    input: {
      cart_id: $cartId
      shipping_addresses: [{
        customer_address_id: $shippingId
      }]
    }
  ) {
    cart {
      shipping_addresses {
        firstname
        lastname
      }
    }
  }
}
GQL;

    $variables = [
        'cartId' => $cartId,
        'shippingId' => $shippingId,
    ];

    graphqlRequest($query, $variables, $token);
}

function setBillingAddress(string $token, string $cartId, int $billingId, bool $sameAsShipping = false): void
{
    $query = <<<'GQL'
mutation ($cartId: String!, $billingId: Int!, $sameAsShipping: Boolean!) {
  setBillingAddressOnCart(
    input: {
      cart_id: $cartId
      billing_address: {
        customer_address_id: $billingId
        same_as_shipping: $sameAsShipping
      }
    }
  ) {
    cart {
      billing_address {
        firstname
        lastname
      }
    }
  }
}
GQL;

    $variables = [
        'cartId' => $cartId,
        'billingId' => $billingId,
        'sameAsShipping' => $sameAsShipping,
    ];

    graphqlRequest($query, $variables, $token);
}

function getShippingMethodsAndCost(string $token, string $cartId): array
{
    $query = <<<'GQL'
query ($cartId: String!) {
  cart(cart_id: $cartId) {
    shipping_addresses {
      available_shipping_methods {
        carrier_code
        carrier_title
        method_code
        method_title
        amount {
          value
          currency
        }
        price_excl_tax {
          value
          currency
        }
        price_incl_tax {
          value
          currency
        }
      }
    }
  }
}
GQL;

    $variables = [
        'cartId' => $cartId,
    ];

    $data = graphqlRequest($query, $variables, $token);
    $shippingAddresses = $data['cart']['shipping_addresses'] ?? [];
    if (empty($shippingAddresses)) {
        throw new RuntimeException('Brak adresów wysyłki na koszyku.');
    }

    $methods = $shippingAddresses[0]['available_shipping_methods'] ?? [];
    if (empty($methods)) {
        throw new RuntimeException('Brak dostępnych metod wysyłki dla tego koszyka.');
    }

    // Odfiltruj przesyłki za pobraniem i odbiór własny
    $filtered = array_values(array_filter($methods, static function (array $m): bool {
        $carrierTitle = mb_strtolower((string)($m['carrier_title'] ?? ''), 'UTF-8');
        $methodTitle  = mb_strtolower((string)($m['method_title'] ?? ''), 'UTF-8');
        $text = $carrierTitle . ' ' . $methodTitle;

        // frazy kluczowe: pobranie/pobran., odbiór/odbior
        if (str_contains($text, 'pobran')) {
            return false;
        }
        if (str_contains($text, 'odbiór') || str_contains($text, 'odbior')) {
            return false;
        }

        return true;
    }));

    if (empty($filtered)) {
        throw new RuntimeException('Brak dostępnych metod wysyłki po odfiltrowaniu pobrania i odbioru własnego.');
    }

    return $filtered;
}

// --- LOGIKA FORMULARZA ---

$result = null;
$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $sku = trim($_POST['sku'] ?? '');
    $quantityRaw = str_replace(',', '.', trim($_POST['quantity'] ?? '1'));
    $postcode = trim($_POST['postcode'] ?? '');
    $city = trim($_POST['city'] ?? '');
    $street = trim($_POST['street'] ?? '');

    if ($sku === '') {
        $error = 'SKU produktu jest wymagane.';
    } else {
        if (!is_numeric($quantityRaw) || (float)$quantityRaw <= 0) {
            $error = 'Ilość musi być dodatnią liczbą.';
        } else {
            $quantity = (float)$quantityRaw;
        }
    }

    if ($error === null) {
        try {
            $token = getCustomerToken();
            [$billingId, $shippingId] = getDefaultAddresses($token);

            $cartId = createEmptyCart($token);
            addProductToCart($token, $cartId, $sku, $quantity);
            setShippingAddress($token, $cartId, (int)$shippingId);
            setBillingAddress($token, $cartId, (int)$billingId, false);

            $methods = getShippingMethodsAndCost($token, $cartId);

            $result = [
                'input' => [
                    'sku' => $sku,
                    'quantity' => $quantity,
                    'postcode' => $postcode,
                    'city' => $city,
                    'street' => $street,
                ],
                'methods' => $methods,
            ];
        } catch (Throwable $e) {
            $error = $e->getMessage();
        }
    }
}

?>
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <title>Test API hurtowni – koszt dostawy</title>
    <style>
        body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #f3f4f6;
            margin: 0;
            padding: 40px 16px;
            color: #111827;
        }
        .container {
            max-width: 720px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
            padding: 24px 28px 28px;
        }
        h1 {
            margin-top: 0;
            font-size: 1.5rem;
            color: #111827;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        h1 span {
            font-size: 0.85rem;
            font-weight: normal;
            color: #6b7280;
        }
        form {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px 20px;
            margin-top: 12px;
        }
        .field {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .field.full {
            grid-column: 1 / -1;
        }
        label {
            font-size: 0.85rem;
            font-weight: 600;
            color: #374151;
        }
        input[type="text"], input[type="number"] {
            border-radius: 8px;
            border: 1px solid #d1d5db;
            padding: 8px 10px;
            font-size: 0.95rem;
            transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
            background: #f9fafb;
        }
        input[type="text"]:focus, input[type="number"]:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.3);
            background: #ffffff;
        }
        .hint {
            font-size: 0.75rem;
            color: #6b7280;
        }
        .actions {
            grid-column: 1 / -1;
            margin-top: 8px;
        }
        button {
            background: linear-gradient(to right, #2563eb, #4f46e5);
            border: none;
            color: white;
            padding: 9px 16px;
            font-size: 0.95rem;
            font-weight: 600;
            border-radius: 999px;
            cursor: pointer;
            box-shadow: 0 10px 15px rgba(37, 99, 235, 0.25);
            transition: transform 0.1s ease, box-shadow 0.1s ease, filter 0.1s ease;
        }
        button:hover {
            filter: brightness(1.05);
            box-shadow: 0 14px 22px rgba(37, 99, 235, 0.3);
            transform: translateY(-1px);
        }
        button:active {
            filter: brightness(0.98);
            box-shadow: 0 6px 12px rgba(37, 99, 235, 0.25);
            transform: translateY(0);
        }
        .alert {
            margin-top: 18px;
            padding: 10px 12px;
            border-radius: 8px;
            font-size: 0.9rem;
        }
        .alert.error {
            background: #fef2f2;
            color: #b91c1c;
            border: 1px solid #fecaca;
        }
        .alert.success {
            background: #ecfdf3;
            color: #166534;
            border: 1px solid #bbf7d0;
        }
        .methods {
            margin-top: 18px;
            border-top: 1px solid #e5e7eb;
            padding-top: 16px;
        }
        .methods h2 {
            margin: 0 0 8px;
            font-size: 1.05rem;
            color: #111827;
        }
        .methods-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .method-item {
            border-radius: 10px;
            padding: 10px 12px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
        }
        .method-main {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .method-title {
            font-weight: 600;
            color: #111827;
        }
        .method-subtitle {
            font-size: 0.8rem;
            color: #6b7280;
        }
        .method-price {
            font-weight: 700;
            font-size: 1rem;
            color: #111827;
        }
        .input-summary {
            margin-top: 10px;
            font-size: 0.85rem;
            color: #4b5563;
        }
        @media (max-width: 640px) {
            .container {
                padding: 18px 16px 20px;
            }
            form {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
<div class="container">
    <h1>
        Koszt dostawy – API hurtowni
        <span>SKU → koszyk → metody wysyłki</span>
    </h1>

    <form method="post">
        <div class="field">
            <label for="sku">SKU produktu *</label>
            <input type="text" id="sku" name="sku" required
                   value="<?php echo htmlspecialchars($_POST['sku'] ?? '', ENT_QUOTES, 'UTF-8'); ?>">
            <div class="hint">Wpisz dokładne SKU produktu z hurtowni.</div>
        </div>

        <div class="field">
            <label for="quantity">Ilość *</label>
            <input type="text" id="quantity" name="quantity" required
                   value="<?php echo htmlspecialchars($_POST['quantity'] ?? '1', ENT_QUOTES, 'UTF-8'); ?>">
            <div class="hint">Może być liczbą całkowitą lub z przecinkiem (np. 1.5).</div>
        </div>

        <div class="field">
            <label for="postcode">Kod pocztowy</label>
            <input type="text" id="postcode" name="postcode"
                   value="<?php echo htmlspecialchars($_POST['postcode'] ?? '', ENT_QUOTES, 'UTF-8'); ?>">
            <div class="hint">Informacyjnie – API używa domyślnych adresów z konta.</div>
        </div>

        <div class="field">
            <label for="city">Miasto</label>
            <input type="text" id="city" name="city"
                   value="<?php echo htmlspecialchars($_POST['city'] ?? '', ENT_QUOTES, 'UTF-8'); ?>">
        </div>

        <div class="field full">
            <label for="street">Ulica / adres</label>
            <input type="text" id="street" name="street"
                   value="<?php echo htmlspecialchars($_POST['street'] ?? '', ENT_QUOTES, 'UTF-8'); ?>">
        </div>

        <div class="actions">
            <button type="submit">Policz koszt dostawy</button>
        </div>
    </form>

    <?php if ($error !== null): ?>
        <div class="alert error">
            <strong>Błąd:</strong> <?php echo nl2br(htmlspecialchars($error, ENT_QUOTES, 'UTF-8')); ?>
        </div>
    <?php endif; ?>

    <?php if ($result !== null && $error === null): ?>
        <div class="alert success">
            <strong>Gotowe!</strong> Poniżej dostępne metody dostawy i ich ceny.
        </div>

        <div class="input-summary">
            <strong>Twoje dane:</strong>
            SKU: <code><?php echo htmlspecialchars($result['input']['sku'], ENT_QUOTES, 'UTF-8'); ?></code>,
            ilość: <?php echo htmlspecialchars((string)$result['input']['quantity'], ENT_QUOTES, 'UTF-8'); ?>,
            kod: <?php echo htmlspecialchars($result['input']['postcode'] ?: 'domyślny z konta', ENT_QUOTES, 'UTF-8'); ?>,
            miasto: <?php echo htmlspecialchars($result['input']['city'] ?: '—', ENT_QUOTES, 'UTF-8'); ?>,
            ulica: <?php echo htmlspecialchars($result['input']['street'] ?: '—', ENT_QUOTES, 'UTF-8'); ?>
        </div>

        <div class="methods">
            <h2>Dostępne metody wysyłki</h2>
            <ul class="methods-list">
                <?php foreach ($result['methods'] as $m): ?>
                    <li class="method-item">
                        <div class="method-main">
                            <div class="method-title">
                                <?php echo htmlspecialchars($m['carrier_title'] . ' – ' . $m['method_title'], ENT_QUOTES, 'UTF-8'); ?>
                            </div>
                            <div class="method-subtitle">
                                Kody: carrier <code><?php echo htmlspecialchars($m['carrier_code'], ENT_QUOTES, 'UTF-8'); ?></code>,
                                method <code><?php echo htmlspecialchars($m['method_code'], ENT_QUOTES, 'UTF-8'); ?></code>
                            </div>
                        </div>
                        <div class="method-price">
                            <?php
                            $val = $m['price_incl_tax']['value'] ?? $m['amount']['value'] ?? null;
                            $cur = $m['price_incl_tax']['currency'] ?? $m['amount']['currency'] ?? '';
                            if ($val !== null) {
                                echo htmlspecialchars(number_format((float)$val, 2, ',', ' '), ENT_QUOTES, 'UTF-8') . ' ' .
                                    htmlspecialchars($cur, ENT_QUOTES, 'UTF-8');
                            } else {
                                echo '—';
                            }
                            ?>
                        </div>
                    </li>
                <?php endforeach; ?>
            </ul>
        </div>
    <?php endif; ?>
</div>
</body>
</html>

