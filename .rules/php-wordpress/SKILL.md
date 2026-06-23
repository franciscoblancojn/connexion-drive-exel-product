---
name: php-wordpress
description: >-
  Use when writing or editing PHP code for WordPress. Covers WordPress Coding
  Standards, security best practices, WordPress APIs, and PHP compatibility
  requirements for this plugin (PHP 7.0+).
---

# WordPress PHP — Estándares y Buenas Prácticas

---

## PHP Compatibility (≥7.0)

El plugin requiere PHP 7.0+. Esto significa que NO puedes usar:

### Prohibido
```php
// ✗ NO: Nullsafe operator (PHP 8.0)
$value = $object?->method();

// ✗ NO: Named arguments (PHP 8.0)
sendMail(to: "user@example.com");

// ✗ NO: Match expression (PHP 8.0)
match($x) { 1 => 'a', 2 => 'b' };

// ✗ NO: Readonly properties (PHP 8.1)
readonly string $name;

// ✗ NO: First-class callable (PHP 8.1)
$fn = strlen(...);

// ✗ NO: Array unpacking with string keys (PHP 8.1)
$array = [...$array1, ...$array2];

// ✗ NO: Enums (PHP 8.1)
enum Status { case Active; }

// ✗ NO: Fibers (PHP 8.1)
// ✗ NO: never return type (PHP 8.1)

// ✗ NO: Union types (PHP 8.0)
function foo(int|string $x) {}

// ✗ NO: Constructor property promotion (PHP 8.0)
function __construct(public int $id) {}

// ✗ NO: Attributes (PHP 8.0)
#[Attribute]

// ✗ NO: Spread operator in arrays (PHP 8.1)
$arr = [$a, ...$b];

// ✗ NO: Arrow functions (PHP 7.4)
$fn = fn($x) => $x * 2;

// ✗ NO: Typed properties (PHP 7.4)
public int $count;
```

### Permitido
```php
// ✓ OK: Type declarations for arrays
function getData(array $filter): array {}

// ✓ OK: callable type
function handle(callable $callback) {}

// ✓ OK: Ternary and null coalescing
$value = $x ?: 'default';
$value = $x ?? 'default';

// ✓ OK: Anonymous functions (PHP 5.3+)
$fn = function($x) { return $x * 2; };

// ✓ OK: Closures
// ✓ OK: Namespaces (pero no en este plugin — las clases son globales)
// ✓ OK: Short array syntax (PHP 5.4)
$arr = [1, 2, 3];
// ✓ OK: Finally (PHP 5.5)
// ✓ OK: foreach with list() (PHP 5.5)
// ✓ OK: Variadic functions (PHP 5.6)
function foo(...$args) {}
```

---

## WordPress Coding Standards

### Nombrado
- **Clases**: `CDEP_` prefix, `UPPER_SNAKE` (e.g., `CDEP_DRIVE`, `CDEP_EXCEL`).
- **Funciones**: Prefijo `CDEP_`, `camelCase` (e.g., `CDEP_render_page`).
- **Constantes**: `CDEP_UPPER_SNAKE`.
- **Métodos**: `camelCase`.
- **Variables**: `$snake_case` o `$camelCase`.

### Hooks de WordPress
- Usa `add_action()` y `add_filter()`.
- Los AJAX handlers se registran como closures anónimos directamente en `add_action`.
- No registres hooks en scope global — usa closures o funciones.
- Priority por defecto: 10.

### Sanitización y Escapado
```php
// Input sanitization
$clean = sanitize_text_field($_POST['field']);
$id = intval($_POST['id']);
$url = esc_url_raw($_POST['url']);
$key = sanitize_key($_POST['key']);
$fileName = sanitize_file_name($_POST['file_name']);
$slug = sanitize_title($_POST['slug']);

// Output escaping
echo esc_html($title);
echo esc_attr($value);
echo esc_url($url);
echo esc_textarea($content);
```

### Nonces
```php
// Generar
wp_nonce_field('cdep_action', 'cdep_nonce');

// Verificar admin
if (!wp_verify_nonce($_POST['cdep_nonce'], 'cdep_action')) {
    wp_die('Security check');
}

// Verificar AJAX
check_ajax_referer('cdep_nonce', 'nonce');
```

### Capabilities
```php
// Admin pages
if (!current_user_can('manage_options')) {
    wp_die('Unauthorized');
}
```

---

## WordPress APIs

### Database
- Usa `get_option()`/`update_option()` para opciones (usando constantes `CDEP_*`).
- No uses `$wpdb` directamente — todo se almacena en wp_options.

### HTTP API
- Usa `wp_remote_get()`/`wp_remote_post()` en vez de `curl_*` directo.
- Para Google Drive API: `wp_remote_get()` con headers `Authorization: Bearer {token}`.

### AJAX
```php
add_action('wp_ajax_cdep_action', function () {
    check_ajax_referer('cdep_nonce', 'nonce');
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Unauthorized');
    }
    // ... process
    wp_send_json_success($data);
});
```

---

## Seguridad

1. **Input**: Nunca confíes en $_GET, $_POST, $_REQUEST, $_SERVER.
2. **Output**: Siempre escapa antes de imprimir en HTML.
3. **Nonces**: Siempre verifica en formularios y AJAX.
4. **Capabilities**: Siempre verifica `manage_options` en admin.
5. **Tokens OAuth**: Se guardan en wp_options — nunca los expongas en JS o HTML.
6. **Files**: Validar tipo y sanitizar nombre antes de guardar archivos temporales.
7. **CSRF**: Nonces protegen contra Cross-Site Request Forgery.
