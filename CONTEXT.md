# Connexion Drive Excel Product — Contexto para IAs

> Plugin WordPress v1.1.21 — Contexto actualizado automaticamente para que IAs entren en contexto rapido.

---

## Que hace este plugin?

Conecta Google Drive via OAuth 2.0, navega por archivos Excel/CSV/Google Sheets, mapea columnas a 16 campos de producto WooCommerce (SKU, precio, cantidad, peso, etc.) y actualiza productos de forma masiva o individual. Usa PhpSpreadsheet para parsear Excel y la API REST de Google Drive para listar/descargar/exportar archivos.

---

## Constantes globales

| Constante | Valor | Donde se usa |
|---|---|---|
| `CDEP_KEY` | `'CDEP'` | Prefijo de opciones, slugs de pagina, nonces |
| `CDEP_CONFIG` | `'CDEP_CONFIG'` | `wp_options` -> configuracion OAuth |
| `CDEP_TOKENS` | `'CDEP_TOKENS'` | `wp_options` -> tokens OAuth |
| `CDEP_SELECTED` | `'CDEP_SELECTED'` | `wp_options` -> archivo seleccionado |
| `CDEP_SELECTED_DATA` | `'CDEP_SELECTED_DATA'` | `wp_options` -> datos parseados en cache |
| `CDEP_DIR` | `plugin_dir_path(__FILE__)` | Ruta absoluta del plugin |
| `CDEP_URL` | `plugin_dir_url(__FILE__)` | URL base del plugin |
| `CDEP_BASENAME` | `plugin_basename(__FILE__)` | Base name del plugin |
| `CDEP_MODE_DEV` | `true` en dev hosts | Habilita modo desarrollo |

---

## Estructura de archivos

```
index.php               -> Plugin header, constantes, auto-updater GitHub
libs/                   -> Composer vendor (wordpress_utils, phpspreadsheet)
src/
  _.php                 -> Cargador maestro (require data/_.php, api/_.php, page/_.php)
  api/
    _.php               -> Cargador API (require drive.php, excel.php, products.php)
    drive.php           -> CDEP_DRIVE: OAuth, CRUD archivos, cache
    excel.php           -> CDEP_EXCEL: Parseo Excel/CSV con PhpSpreadsheet
    products.php        -> CDEP_PRODUCTS: Validacion y actualizacion WooCommerce
  css/
    admin.css           -> Estilos admin: .cdep-* clases
  data/
    _.php               -> Cargador data (require base.php)
    base.php            -> CDEP_USE_DATA_BASE: CRUD generico wp_options
  js/
    admin.js            -> Frontend JS (~1000 lineas): OAuth, browse, mapping, update
  page/
    _.php               -> Cargador page (require add.php)
    add.php             -> add_menu_page(), enqueue assets, tabs con FWUPage
    sections/
      connect.php       -> Config OAuth + estado conexion
      browse.php        -> Explorador archivos Google Drive
      mapping.php       -> Mapeo columnas + campos del producto
      update.php        -> (Legacy, no se usa como tab)
```

---

## Clases y metodos clave

### CDEP_DRIVE (`src/api/drive.php`)
| Metodo | Descripcion |
|---|---|
| `isConnected()` | Verifica si existen tokens de acceso validos |
| `saveConfig($clientId, $clientSecret, $redirectUri)` | Guarda credenciales OAuth en `CDEP_CONFIG` |
| `getConfig()` | Obtiene configuracion OAuth de `CDEP_CONFIG` |
| `getAuthUrl()` | Construye URL de autenticacion OAuth 2.0 de Google |
| `connect($code)` | Intercambia codigo de autorizacion por tokens |
| `disconnect()` | Elimina tokens, archivo seleccionado y cache |
| `getAccessToken()` | Obtiene token valido (renueva si expiro via refresh) |
| `refreshAccessToken(&$tokens)` | (privado) Renueva token expirado |
| `listFiles($folderId, $pageToken)` | Lista archivos/carpetas en una carpeta de Drive |
| `downloadFile($fileId)` | Descarga contenido de un archivo de Drive |
| `exportFile($fileId, $exportMimeType)` | Exporta Google Sheet como xlsx |
| `saveSelectedFile($fileId, $fileName, $mimeType)` | Guarda datos del archivo seleccionado en `CDEP_SELECTED` |
| `getSelectedFile()` | Obtiene datos del archivo seleccionado |
| `saveCachedData($data)` | Guarda datos parseados en `CDEP_SELECTED_DATA` |
| `getCachedData()` | Obtiene datos parseados de `CDEP_SELECTED_DATA` |
| `clearCachedData()` | Elimina datos parseados de `CDEP_SELECTED_DATA` |

### CDEP_EXCEL (`src/api/excel.php`)
| Metodo | Descripcion |
|---|---|
| `parse($filePath, $headerRow)` | Detecta extension y parsea Excel/CSV con fila de encabezados configurable |
| `parseWithPhpSpreadsheet($filePath, $headerRow)` | Usa PhpSpreadsheet para leer .xlsx/.xls |
| `parseCSV($filePath, $headerRow)` | Lee archivos CSV linea por linea |
| `detectColumns($headers)` | Detecta automaticamente columnas SKU, precio, precio oferta y cantidad |

### CDEP_PRODUCTS (`src/api/products.php`)
| Metodo | Descripcion |
|---|---|
| `getFields()` | Retorna los 16 campos de producto disponibles |
| `sanitizeValue($value, $type)` | (privado) Sanitiza valor segun tipo |
| `getProductField($product, $field)` | (privado) Obtiene valor actual de un campo |
| `setProductField($product, $field, $value, $type)` | (privado) Asigna valor a un campo via WooCommerce setter |
| `resolveTemplate($template, $row, $headers, $configVars)` | (privado) Reemplaza `{var}` con valores de columna o config |
| `validateMapping($allRows, $mapping, $headers, $configVars)` | Valida mapeo con vista previa; acepta headers y config_vars |
| `executeUpdate($allRows, $mapping, $offset, $limit, $headers, $configVars)` | Ejecuta actualizacion por lotes (default 25) |

### CDEP_USE_DATA_BASE (`src/data/base.php`)
| Metodo | Descripcion |
|---|---|
| `get()` | Retorna todos los datos |
| `set($DATA)` | Reemplaza todos los datos |
| `setField($k, $v)` | Actualiza un campo especifico |
| `add($DATA)` | Mergea datos nuevos con existentes |

---

## wp_options Keys

| Option Key | Proposito |
|---|---|
| `CDEP_CONFIG` | Config OAuth: client_id, client_secret, redirect_uri |
| `CDEP_TOKENS` | Tokens OAuth: access_token, refresh_token, expires_in, created |
| `CDEP_SELECTED` | Archivo seleccionado: file_id, file_name, mime_type, selected_at |
| `CDEP_SELECTED_DATA` | Datos parseados en cache: headers, sample, all_rows, detected, total_rows, header_row, file_id, file_name |

---

## AJAX Endpoints

| Action | Handler | Linea | Proposito |
|---|---|---|---|
| `cdep_save_config` | Closure en `drive.php` | 278 | Guarda credenciales OAuth |
| `cdep_get_auth_url` | Closure en `drive.php` | 293 | Obtiene URL de autenticacion Google |
| `cdep_drive_connect` | Closure en `drive.php` | 307 | Intercambia codigo OAuth por tokens |
| `cdep_drive_disconnect` | Closure en `drive.php` | 326 | Desconecta Google Drive |
| `cdep_drive_list` | Closure en `drive.php` | 336 | Lista archivos/carpetas de Drive |
| `cdep_get_cached_data` | Closure en `drive.php` | 353 | Obtiene datos parseados en cache |
| `cdep_refresh_cache` | Closure en `drive.php` | 375 | Redescarga y re-parsea archivo |
| `cdep_reparse_file` | Closure en `drive.php` | 444 | Re-parsea con nueva fila de encabezados |
| `cdep_drive_select_file` | Closure en `drive.php` | 486 | Descarga + parsea + cachea archivo |
| `cdep_update_preview` | Closure en `products.php` | 413 | Validacion de mapeo con vista previa |
| `cdep_update_execute` | Closure en `products.php` | 443 | Ejecuta actualizacion por lotes (offset) |
| `cdep_update_batch_skus` | Closure en `products.php` | 473 | Actualiza SKUs especificos |
| `cdep_update_single` | Closure en `products.php` | 520 | Actualiza un solo producto |

Todos los AJAX:
- Verifican nonce con `check_ajax_referer('cdep_nonce', 'nonce')`
- Verifican `current_user_can('manage_options')`
- Responden con `wp_send_json_success()` / `wp_send_json_error()`

---

## Hooks de WordPress

### Acciones
```php
add_action('admin_menu', function() { ... })                -> Registra menu principal
add_action('admin_enqueue_scripts', function($hook) { ... }) -> Encola CSS/JS en pagina del plugin
add_action('wp_ajax_*', ...)                                 -> 13 AJAX endpoints (ver tabla)
```

### Sin filtros ni hooks de frontend
El plugin no usa `wp_head`, `the_content`, ni ningun filtro de frontend. Solo opera en el admin.

---

## Flujo de datos

### 1. Configuracion OAuth
1. Usuario ingresa `client_id`, `client_secret`, `redirect_uri` en formulario POST
2. `connect.php` procesa POST y llama a `CDEP_DRIVE::saveConfig()`
3. Datos guardados en `wp_options` con key `CDEP_CONFIG`

### 2. Conexion a Google Drive
1. JS pide URL de autenticacion via `cdep_get_auth_url` AJAX
2. Usuario autoriza en pantalla de Google
3. Google redirige con `?code=` a la pagina del plugin
4. JS detecta `code` en URL con `URLSearchParams` y llama a `cdep_drive_connect` AJAX
5. `CDEP_DRIVE::connect()` intercambia codigo por tokens
6. Tokens guardados en `CDEP_TOKENS`

### 3. Exploracion de archivos
1. JS llama a `cdep_drive_list` con `folder_id`
2. `CDEP_DRIVE::listFiles()` lista archivos en la carpeta
3. Usuario navega carpetas via clicks con guardado de estado en localStorage

### 4. Seleccion de archivo
1. Usuario hace click en "Seleccionar" en un archivo Excel/Google Sheets
2. JS llama a `cdep_drive_select_file` AJAX
3. Si es Google Sheet, se exporta via `CDEP_DRIVE::exportFile()`; si no, via `downloadFile()`
4. Archivo guardado en `wp_upload_dir()` como archivo temporal
5. `CDEP_EXCEL::parse()` parsea el archivo
6. Resultados guardados en cache (`CDEP_SELECTED_DATA`) y enviados al JS

### 5. Mapeo de columnas
1. JS renderiza tabla de vista previa con selects de columnas
2. Auto-selecciona columnas detectadas (SKU, precio, precio oferta, cantidad)
3. Usuario puede cambiar la fila de encabezados y re-parsear
4. Usuario selecciona que columna corresponde a cada campo del producto:
   - **Productos existentes (Actualizar)**: Solo 3 campos (regular_price, sale_price, stock_quantity) vía `.cdep-field-select`
   - **Productos nuevos (Crear)**: 16 campos vía `.cdep-field-select-create`, con soporte de "Personalizar" (templates con `{columna}`)
5. "Configuraciones de Creación" permite configurar valores fijos (ej: Marca desde `product_brand` taxonomy)
6. "Vista Previa" llama a `cdep_update_preview` AJAX
7. `CDEP_PRODUCTS::validateMapping()` cruza SKUs con WooCommerce, genera diffs
8. Resultados se muestran en tabs: "Productos a actualizar" y "Productos a crear"
9. SKUs y nombres existentes se muestran como link a `post.php?action=edit` en nueva pestana

### 6. Actualizacion masiva/individual
- **Masiva**: JS recolecta SKUs seleccionados, los envia en lotes via `cdep_update_batch_skus`
- **Individual**: Boton "Procesar" por fila via `cdep_update_single`
- `CDEP_PRODUCTS::executeUpdate()` actualiza precio, stock, peso, etc.
- Progreso mostrado en barra de progreso
- Resultados parciales acumulados hasta completar

---

## Flujo AJAX tipico (admin.js)

1. Helper `ajax(action, data, success, error)` envia POST con `action`, `nonce`, + data
2. PHP closure verifica nonce y capabilities
3. Procesa usando metodos de CDEP_DRIVE/CDEP_EXCEL/CDEP_PRODUCTS
4. Responde con `wp_send_json_success($data)` o `wp_send_json_error($msg)`
5. JS callback recibe `resp.data` en success o `resp.data` (mensaje) en error

---

## window.cdep (wp_localize_script)

| Propiedad | Descripcion |
|---|---|
| `ajaxurl` | `admin_url('admin-ajax.php')` |
| `nonce` | Nonce valido para `cdep_nonce` |
| `is_connected` | Bool: estado de conexion Drive |
| `config` | Array: configuracion OAuth |
| `selected_file` | Array: archivo seleccionado |
| `oauth_url` | URL de callback OAuth |
| `productFields` | Array: `{field_key => field_label}` de CDEP_PRODUCTS::getFields() |

---

## Dependencias

- **WordPress** 5.0+
- **PHP** 7.0+
- **WooCommerce** 4.0+ (obligatorio para actualizacion de productos)
- **Google Drive API** (OAuth 2.0, Google Cloud Platform)
- **Composer**: `franciscoblancojn/wordpress_utils` (FWUPage, FWUCollapse, FWUTooltip, FWURespond, FWUUpdate, FWUSystemLog)
- **Composer**: `phpoffice/phpspreadsheet` (lectura de archivos Excel)

---

### Mapping keys
`buildMapping()` retorna un objeto con:
- `sku` → indice de columna SKU
- `regular_price`, `sale_price`, `stock_quantity` → indices para actualizar existentes
- `create_{field}` → para campos de creacion (indice de columna o `custom:template`)
- `creation_brand` → nombre de la marca seleccionada
- `config_vars` → objeto `{varname: value}` para resolver `{varname}` en templates

### Templates personalizados
- Se almacenan con prefijo `custom:` (ej: `create_product_name = "custom:Reloj {marca} {name}"`)
- `{marca}` se resuelve via `config_vars` (valores del formulario de configuracion)
- `{nombre_columna}` se resuelve via `$headers` (nombres de columna del archivo)
- `resolveTemplate()` revisa config_vars primero, luego columnas

### Marca
- Select poblado desde taxonomy `product_brand`
- El valor usado es el **nombre** del termino, no el slug (tanto para `creation_brand` como para `config_vars.marca`)

### Product name como link
- Cuando un producto existe, tanto SKU como Nombre son links a `post.php?action=edit&post={product_id}`

---

## Notas importantes para debugging

- Los tokens OAuth expiran en 3600s - `getAccessToken()` renueva automaticamente via refresh token
- Si el refresh token falta, el usuario debe reconectar
- Los archivos temporales se guardan en `wp_upload_dir()` con nombre sanitizado
- La barra de progreso usa porcentaje calculado sobre total de SKUs seleccionados
- Admin.js usa `localStorage` para persistir: `cdep_folder` (navegacion) y `cdep_mapping_config` (mapeo)
- Admin.js expone `window.cdep` con `ajaxurl`, `nonce`, `is_connected`, `config`, `selected_file`, `oauth_url`, `productFields`
- Si hay errores de conexion, verificar que `redirect_uri` en Google Cloud coincida exactamente con `admin_url('admin.php?page=CDEP')`

### Config form via POST
La configuracion se guarda mediante `<form method="post">` estandar (no AJAX). El guardado ocurre en `connect.php`:
```php
if (isset($_POST['save']) && $_POST['save'] === 'config') {
    CDEP_DRIVE::saveConfig(...);
    $respond = ['status' => 'ok', 'message' => 'Configuracion guardada'];
    $config = CDEP_DRIVE::getConfig();
    $isConnected = CDEP_DRIVE::isConnected();
}
```
FWURespond usa el array `$respond` para mostrar mensajes. Las variables `$config` y `$isConnected` deben recargarse despues del POST para mantener los valores actualizados.

### Paginacion en el explorador
`listFiles()` soporta paginacion via `pageToken`. El JS actual no implementa paginacion pero la API lo soporta.

### Campos del producto en validateMapping
La respuesta de `cdep_update_preview` incluye por cada producto: `sku`, `row`, `exists`, `product_id`, `status`, `name`, `image`, `categories`, `fields` (mapa campo -> {current, new, changed}).

### Solo 3 tabs activos
Aunque `update.php` existe en disco, la UI solo tiene 3 tabs: Conectar, Explorar, Mapear. La actualizacion se ejecuta desde el tab de Mapear.
