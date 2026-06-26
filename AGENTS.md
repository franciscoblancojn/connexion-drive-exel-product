# Connexion Drive Excel Product — Reglas para IAs

Este archivo contiene las reglas, validaciones y convenciones que toda IA debe seguir al programar en este proyecto.

---

## 1. Estándares de Código

### PHP
- **WordPress Coding Standards**: Sigue los estándares de codificación de WordPress para PHP.
- **PHP 7.0+**: No uses sintaxis moderna de PHP (nullsafe `?->`, named arguments, match, readonly properties, typed properties, arrow functions, union types, spread en arrays).
- **Nombrado**: Clases con prefijo `CDEP_` (ej: `CDEP_DRIVE`, `CDEP_EXCEL`). Funciones con prefijo `CDEP_`. Métodos en `camelCase`. Constantes en `UPPER_SNAKE`.
- **Sanitización**: Toda entrada debe sanitizarse (`sanitize_text_field`, `intval`, `esc_url_raw`). Toda salida debe escaparse (`esc_html`, `esc_attr`, `esc_url`).
- **Nonces**: Todo formulario y AJAX debe verificar nonce con `check_ajax_referer('cdep_nonce', 'nonce')`.
- **Capabilities**: Toda operación admin debe verificar `current_user_can('manage_options')`.

### JavaScript
- **ES5**: Usa ES5 (`var`, `function`, no arrow functions, no `let`/`const`, no template literals). Excepción conocida: `URLSearchParams` se usa en el callback OAuth (admin.js).
- **jQuery**: Usa `jQuery(function($){ ... })` para DOM ready.
- **Objeto global**: Usa `window.cdep` (localizado via `wp_localize_script`) para `ajaxurl`, `nonce`, `config`, `is_connected`, `selected_file`, `oauth_url`, `productFields`.
- **AJAX**: Toda llamada AJAX usa la función helper `ajax(action, data, success, error)` definida en admin.js.
- **Respuestas**: Espera `resp.success` + `resp.data` (estándar WordPress AJAX).
- **localStorage**: Se usan dos keys: `cdep_folder` (estado de navegación) y `cdep_mapping_config` (mapeo de columnas).

### CSS
- **Prefijo**: Todas las clases CSS deben llevar prefijo `cdep-`.
- **FWU**: Clases de librería usan prefijo `fwue-` (ej: `fwue-message`, `fwue-message.ok`, `fwue-message.error`).

---

## 2. Arquitectura del Plugin

### Sistema de Archivos
- `index.php` → Plugin header y constantes globales. No agregues lógica aquí.
- `src/_.php` → Cargador maestro (`require` de `data/_.php`, `api/_.php`, `page/_.php`).
- `src/api/` → Clases CDEP_DRIVE, CDEP_EXCEL, CDEP_PRODUCTS + handlers AJAX como closures.
- `src/data/` → Capa de datos (CDEP_USE_DATA_BASE).
- `src/page/` → Página admin con tabs (Conectar, Explorar, Mapear).
- `src/js/admin.js` → Todo el JavaScript del admin.
- `src/css/admin.css` → Estilos admin.

### Constantes
Usa las constantes definidas en `index.php`:
- `CDEP_KEY` para slugs y prefijos
- `CDEP_CONFIG` para configuración de OAuth
- `CDEP_TOKENS` para tokens de acceso
- `CDEP_SELECTED` para archivo seleccionado
- `CDEP_SELECTED_DATA` para datos parseados en caché
- Nunca hardcodees strings como `'CDEP'` o `'CDEP_CONFIG'`

### wp_options
- `CDEP_CONFIG` → Array: `client_id`, `client_secret`, `redirect_uri`
- `CDEP_TOKENS` → Array: `access_token`, `refresh_token`, `expires_in`, `created`
- `CDEP_SELECTED` → Array: `file_id`, `file_name`, `mime_type`, `selected_at`
- `CDEP_SELECTED_DATA` → Array: `file_id`, `file_name`, `headers`, `sample`, `detected`, `total_rows`, `all_rows`, `header_row`

---

## 3. Validaciones de Seguridad

1. **Nunca** hardcodees client_secret o tokens en el código.
2. **Siempre** sanitiza input: `$_POST`, `$_GET` deben pasar por `sanitize_text_field()`, `intval()`, etc.
3. **Siempre** valida nonces en handlers AJAX (`check_ajax_referer('cdep_nonce', 'nonce')`).
4. **Siempre** valida capabilities: `current_user_can('manage_options')` antes de cualquier operación admin.
5. **Siempre** escapa output en HTML con `esc_attr()`, `esc_html()`, `esc_url()`.
6. **Tokens sensibles**: Los tokens OAuth se guardan en wp_options — nunca los expongas en JS o HTML.

---

## 4. Convenciones del Proyecto

### AJAX Endpoints
- Action registrada: `wp_ajax_{action}` donde action usa prefijo `cdep_`.
- Nonce action: `cdep_nonce`.
- Los handlers son closures anónimos en `src/api/` (drive.php, products.php).
- Respuesta siempre en JSON: `wp_send_json_success($data)` o `wp_send_json_error($message)`.
- Cuando FWURespond espera `{ status: 'ok', message: '...' }`, usa `wp_send_json_success(['status' => 'ok', 'message' => '...'])`.

### Hooks
- Acciones: `add_action('hook', 'callback', priority)`.
- No registres hooks en el scope global. Deben estar dentro de closures o funciones.
- AJAX handlers como closures anónimas directamente en `add_action`.

### Config Form
- La configuración se guarda via POST estándar (`<form method="post">`) no AJAX.
- `$_POST['save'] === 'config'` dispara el guardado en connect.php.

### Librería wordpress_utils
- `FWUPage::tabs()`, `FWUPage::css()`, `FWUPage::js()` para tabs y layout.
- `FWUCollapse::render()` para secciones colapsables.
- `FWUTooltip::render()` para tooltips.
- `FWURespond::render()` para mensajes de respuesta.
- `FWUUpdate::init()` para auto-update vía GitHub.

### Logging
- Usa `FWUSystemLog::add(CDEP_KEY, $message)` para errores.
- No uses `error_log()`, `var_dump()`, `print_r()` en producción.

---

## 5. Datos del Producto en Vista Previa

La respuesta de `cdep_update_preview` devuelve por cada producto (`products[]`):

| Campo | Tipo | Descripción |
|---|---|---|
| `sku` | string | SKU del producto |
| `row` | int | Número de fila en el Excel |
| `exists` | bool | Si el producto existe en WooCommerce |
| `product_id` | int | ID del producto (0 si no existe) |
| `status` | string | `pending` o `new` |
| `name` | string | Nombre actual del producto |
| `image` | string | HTML de la imagen thumbnail |
| `categories` | string | Categorías del producto |
| `fields` | object | Mapa de campo → `{current, new, changed}` |

---

## 6. Git Workflow

1. **Commits**: No hacer commits automáticamente, solo dar sugerencias de commits.

---

## 7. Lo que NO debes hacer

- ✗ NO modifiques `index.php` (plugin header).
- ✗ NO elimines el prefijo `CDEP_` de ninguna clase/función.
- ✗ NO agregues dependencias npm/composer sin autorización explícita.
- ✗ NO edites archivos en `libs/` (vendor de Composer).
- ✗ NO uses sintaxis moderna de PHP (>=7.0).
- ✗ NO hardcodees URLs o paths — usa `CDEP_URL`, `CDEP_DIR`.
- ✗ NO añadas archivos nuevos sin `require` desde `src/_.php` o subcarpetas.
