# Connexion Drive Excel Product — Contexto para IAs

> Plug-in WordPress v1.0.0 — Generado automáticamente para que IAs entren en contexto rápido.

---

## ¿Qué hace este plugin?

Conecta Google Drive vía OAuth 2.0, navega por archivos Excel/CSV, mapea columnas (SKU, precio, cantidad) y actualiza productos WooCommerce de forma masiva. Usa PhpSpreadsheet para parsear Excel y la API REST de Google Drive para listar/descargar archivos.

---

## Constantes globales

| Constante | Valor | Dónde se usa |
|---|---|---|
| `CDEP_KEY` | `'CDEP'` | Prefijo de opciones, slugs de página, nonces |
| `CDEP_CONFIG` | `'CDEP_CONFIG'` | `wp_options` → configuración OAuth (client_id, client_secret, redirect_uri) |
| `CDEP_TOKENS` | `'CDEP_TOKENS'` | `wp_options` → tokens OAuth (access_token, refresh_token, expires_in, created) |
| `CDEP_SELECTED` | `'CDEP_SELECTED'` | `wp_options` → archivo seleccionado (file_id, file_name, selected_at) |
| `CDEP_DIR` | `plugin_dir_path(__FILE__)` | Ruta absoluta del plugin |
| `CDEP_URL` | `plugin_dir_url(__FILE__)` | URL base del plugin |
| `CDEP_BASENAME` | `plugin_basename(__FILE__)` | Base name del plugin |
| `CDEP_MODE_DEV` | `true` en dev hosts | Habilita modo desarrollo |

---

## Estructura de archivos

```
index.php               → Plugin header, constantes, auto-updater GitHub (vía Composer)
libs/                   → Composer vendor (franciscoblancojn/wordpress_utils, phpoffice/phpspreadsheet)
src/
  _.php                 → Cargador maestro (require data/_.php, api/_.php, page/_.php)
  api/
    _.php               → Cargador API (require drive.php, excel.php, products.php)
    drive.php           → CDEP_DRIVE: OAuth Google Drive, CRUD archivos (listFiles, downloadFile)
    excel.php           → CDEP_EXCEL: Parseo Excel/CSV con PhpSpreadsheet
    products.php        → CDEP_PRODUCTS: Validación y actualización masiva productos WooCommerce
  css/
    admin.css           → Estilos admin: .cdep-* clases
  data/
    _.php               → Cargador data (require base.php)
    base.php            → CDEP_USE_DATA_BASE: CRUD genérico wp_options
  js/
    admin.js            → Frontend JS: OAuth callback, file browser, mapping, update progress
  page/
    _.php               → Cargador page (require add.php)
    add.php             → add_menu_page('Drive Excel Product'), enqueue assets, tab rendering con FWUPage
    sections/
      connect.php       → Config OAuth + estado conexión (POST save, FWUCollapse, FWUTooltip, FWURespond)
      browse.php        → Explorador archivos Google Drive (tree navigation)
      mapping.php       → Mapeo columnas SKU/precio/cantidad (select preview)
      update.php        → Ejecución actualización masiva con barra de progreso
```

---

## Clases y métodos clave

### CDEP_DRIVE (`src/api/drive.php`)
| Método | Descripción |
|---|---|
| `isConnected()` | Verifica si existen tokens de acceso válidos |
| `saveConfig($clientId, $clientSecret, $redirectUri)` | Guarda credenciales OAuth en `CDEP_CONFIG` |
| `getConfig()` | Obtiene configuración OAuth de `CDEP_CONFIG` |
| `getAuthUrl()` | Construye URL de autenticación OAuth 2.0 de Google |
| `connect($code)` | Intercambia código de autorización por tokens |
| `disconnect()` | Elimina tokens y archivo seleccionado |
| `getAccessToken()` | Obtiene token válido (renueva si expiró via refresh) |
| `listFiles($folderId, $pageToken)` | Lista archivos/carpetas en una carpeta de Drive |
| `downloadFile($fileId)` | Descarga contenido de un archivo de Drive |
| `saveSelectedFile($fileId, $fileName)` | Guarda datos del archivo seleccionado en `CDEP_SELECTED` |
| `getSelectedFile()` | Obtiene datos del archivo seleccionado |

### CDEP_EXCEL (`src/api/excel.php`)
| Método | Descripción |
|---|---|
| `parse($filePath)` | Detecta extensión y parsea Excel/CSV |
| `parseWithPhpSpreadsheet($filePath)` | Usa PhpSpreadsheet para leer .xlsx/.xls |
| `parseCSV($filePath)` | Lee archivos CSV línea por línea |
| `detectColumns($headers)` | Detecta automáticamente columnas SKU, precio, cantidad por patrones |

### CDEP_PRODUCTS (`src/api/products.php`)
| Método | Descripción |
|---|---|
| `validateMapping($allRows, $headers, $mapping)` | Valida mapeo y genera vista previa de cambios |
| `executeUpdate($allRows, $mapping, $offset, $limit)` | Ejecuta actualización masiva por lotes de 25 |

### CDEP_USE_DATA_BASE (`src/data/base.php`)
| Método | Descripción |
|---|---|
| `get()` | Retorna todos los datos |
| `set($DATA)` | Reemplaza todos los datos |
| `setField($k, $v)` | Actualiza un campo específico |
| `add($DATA)` | Mergea datos nuevos con existentes |

---

## wp_options Keys

| Option Key | Propósito |
|---|---|
| `CDEP_CONFIG` | Config OAuth: client_id, client_secret, redirect_uri |
| `CDEP_TOKENS` | Tokens OAuth: access_token, refresh_token, expires_in, created |
| `CDEP_SELECTED` | Archivo seleccionado: file_id, file_name, selected_at |

---

## AJAX Endpoints

| Action | Handler | Propósito |
|---|---|---|
| `cdep_save_config` | Closure anónimo en `drive.php:233` | Guarda credenciales OAuth |
| `cdep_get_auth_url` | Closure anónimo en `drive.php:248` | Obtiene URL de autenticación Google |
| `cdep_drive_connect` | Closure anónimo en `drive.php:262` | Intercambia código OAuth por tokens |
| `cdep_drive_disconnect` | Closure anónimo en `drive.php:281` | Desconecta Google Drive |
| `cdep_drive_list` | Closure anónimo en `drive.php:291` | Lista archivos/carpetas de Drive |
| `cdep_drive_select_file` | Closure anónimo en `drive.php:308` | Descarga + parsea archivo Excel |
| `cdep_update_preview` | Closure anónimo en `products.php:166` | Validación de mapeo con vista previa |
| `cdep_update_execute` | Closure anónimo en `products.php:205` | Ejecuta actualización por lotes |

Todos los AJAX:
- Verifican nonce con `check_ajax_referer('cdep_nonce', 'nonce')`
- Verifican `current_user_can('manage_options')`
- Responden con `wp_send_json_success()` / `wp_send_json_error()`

---

## Hooks de WordPress

### Acciones
```php
add_action('admin_menu', function() { ... })                → Registra menú principal
add_action('admin_enqueue_scripts', function($hook) { ... }) → Encola CSS/JS en página del plugin
add_action('wp_ajax_*', ...)                                 → Todos los AJAX (ver tabla arriba)
```

### Sin filtros ni hooks de frontend
El plugin no usa `wp_head`, `the_content`, ni ningún filtro de frontend. Solo opera en el admin.

---

## Flujo de datos

### 1. Configuración OAuth
1. Usuario ingresa `client_id`, `client_secret`, `redirect_uri` en formulario POST
2. `connect.php` procesa POST y llama a `CDEP_DRIVE::saveConfig()`
3. Datos guardados en `wp_options` con key `CDEP_CONFIG`

### 2. Conexión a Google Drive
1. JS pide URL de autenticación via `cdep_get_auth_url` AJAX
2. Usuario autoriza en pantalla de Google
3. Google redirige con `?code=` a la página del plugin
4. JS detecta `code` en URL y llama a `cdep_drive_connect` AJAX
5. `CDEP_DRIVE::connect()` intercambia código por tokens
6. Tokens guardados en `CDEP_TOKENS`

### 3. Exploración de archivos
1. JS llama a `cdep_drive_list` con `folder_id = 'root'`
2. `CDEP_DRIVE::listFiles()` lista archivos en la carpeta
3. Usuario navega carpetas via clicks en `.cdep-folder-link`

### 4. Selección de archivo
1. Usuario hace click en "Seleccionar" en un archivo Excel
2. JS llama a `cdep_drive_select_file` AJAX
3. `CDEP_DRIVE::downloadFile()` descarga el archivo de Drive
4. Archivo guardado en `wp_upload_dir()` como archivo temporal
5. `CDEP_EXCEL::parse()` parsea el archivo
6. Resultados (headers, sample data, detección) enviados al JS

### 5. Mapeo de columnas
1. JS renderiza selects con nombres de columnas
2. Auto-selecciona columnas detectadas (SKU, precio, cantidad)
3. Usuario ajusta mapeo si es necesario
4. "Vista Previa" llama a `cdep_update_preview` AJAX
5. `CDEP_PRODUCTS::validateMapping()` cruza SKUs con WooCommerce

### 6. Actualización masiva
1. JS llama a `cdep_update_execute` en lotes de 25 filas
2. `CDEP_PRODUCTS::executeUpdate()` actualiza precio y stock
3. Progreso mostrado en barra de progreso
4. Resultados parciales acumulados hasta completar

---

## Flujo AJAX típico (admin.js)

1. Helper `ajax(action, data, success, error)` envía POST con `action`, `nonce`, + data
2. PHP closure verifica nonce y capabilities
3. Procesa usando métodos de CDEP_DRIVE/CDEP_EXCEL/CDEP_PRODUCTS
4. Responde con `wp_send_json_success($data)` o `wp_send_json_error($msg)`
5. JS callback recibe `resp.data` en success o `resp.data` (mensaje) en error

---

## Dependencias

- **WordPress** 5.0+
- **PHP** 7.0+
- **WooCommerce** 4.0+ (obligatorio para actualización de productos)
- **Google Drive API** (OAuth 2.0, Google Cloud Platform)
- **Composer**: `franciscoblancojn/wordpress_utils` (FWUPage, FWUCollapse, FWUTooltip, FWURespond, FWUUpdate, FWUSystemLog)
- **Composer**: `phpoffice/phpspreadsheet` (lectura de archivos Excel)

---

## Notas importantes para debugging

- Los tokens OAuth expiran en 3600s — `getAccessToken()` renueva automáticamente via refresh token
- Si el refresh token falta, el usuario debe reconectar
- Los archivos temporales se guardan en `wp_upload_dir()` con nombre sanitizado
- `cdep_drive_select_file` descarga el archivo de Drive cada vez que se selecciona
- La barra de progreso usa porcentaje calculado sobre `state.totalRows`
- Admin.js expone `window.cdep` con `ajaxurl`, `nonce`, `is_connected`, `config`, `selected_file`, `oauth_url`
- Si hay errores de conexión, verificar que `redirect_uri` en Google Cloud coincida exactamente con `admin_url('admin.php?page=CDEP')`

### Config form vía POST
La configuración se guarda mediante `<form method="post">` estándar (no AJAX). El guardado ocurre en `connect.php`:
```php
if (isset($_POST['save']) && $_POST['save'] === 'config') {
    CDEP_DRIVE::saveConfig(...);
    $respond = ['status' => 'ok', 'message' => 'Configuración guardada'];
    $config = CDEP_DRIVE::getConfig();       // Recargar después de guardar
    $isConnected = CDEP_DRIVE::isConnected(); // Recargar estado
}
```
FWURespond usa el array `$respond` para mostrar mensajes. Las variables `$config` y `$isConnected` deben recargarse después del POST para mantener los valores actualizados.
