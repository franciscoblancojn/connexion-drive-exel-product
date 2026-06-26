---
name: cdep-plugin
description: >-
  Use ONLY when working on Connexion Drive Excel Product plugin features: Google
  Drive OAuth integration, Excel parsing with PhpSpreadsheet, column mapping
  (SKU/price/quantity), WooCommerce mass product update, or admin page UI.
  Contains plugin-specific validation rules, class references, and data flow
  constraints.
---

# CDEP Plugin — Reglas Especificas del Plugin

Activa esta skill cuando trabajes con funcionalidades propias del plugin Connexion Drive Excel Product.

---

## Clases Principales

### CDEP_DRIVE (`src/api/drive.php`)
| Metodo | Descripcion |
|---|---|
| `isConnected()` | Verifica si existen tokens validos |
| `saveConfig($clientId, $clientSecret, $redirectUri)` | Guarda credenciales OAuth en `CDEP_CONFIG` |
| `getConfig()` | Obtiene configuracion OAuth de `CDEP_CONFIG` |
| `getAuthUrl()` | Construye URL de autenticacion OAuth 2.0 |
| `connect($code)` | Intercambia codigo por tokens |
| `disconnect()` | Elimina tokens, archivo seleccionado y cache |
| `getAccessToken()` | Obtiene token valido (renueva si expiro) |
| `refreshAccessToken(&$tokens)` | (privado) Renueva token expirado |
| `listFiles($folderId, $pageToken)` | Lista archivos en carpeta de Drive |
| `downloadFile($fileId)` | Descarga contenido de archivo de Drive |
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
| `parseWithPhpSpreadsheet($filePath, $headerRow)` | Usa PhpSpreadsheet para .xlsx/.xls |
| `parseCSV($filePath, $headerRow)` | Lee CSV linea por linea |
| `detectColumns($headers)` | Detecta columnas SKU, precio, precio oferta, cantidad |

### CDEP_PRODUCTS (`src/api/products.php`)
| Metodo | Descripcion |
|---|---|
| `getFields()` | Retorna los 16 campos de producto disponibles |
| `sanitizeValue($value, $type)` | (privado) Sanitiza valor segun tipo |
| `getProductField($product, $field)` | (privado) Obtiene valor actual de un campo |
| `setProductField($product, $field, $value, $type)` | (privado) Asigna valor via WooCommerce setter |
| `validateMapping($allRows, $mapping)` | Valida mapeo y genera vista previa |
| `executeUpdate($allRows, $mapping, $offset, $limit)` | Ejecuta actualizacion por lotes |

---

## Flujo de Datos

### 1. Config OAuth -> POST estandar
```
connect.php: POST save=config -> CDEP_DRIVE::saveConfig() -> CDEP_CONFIG (wp_options)
```

### 2. Conexion Google Drive -> AJAX
```
JS ajax('cdep_get_auth_url') -> URL de Google -> usuario autoriza -> redirect con ?code=
-> JS detecta code (URLSearchParams) -> ajax('cdep_drive_connect', {code})
-> CDEP_DRIVE::connect() -> CDEP_TOKENS
```

### 3. Explorar archivos -> AJAX
```
JS ajax('cdep_drive_list', {folder_id}) -> CDEP_DRIVE::listFiles() -> JSON files
-> estado de navegacion guardado en localStorage('cdep_folder')
```

### 4. Seleccionar archivo -> AJAX
```
JS ajax('cdep_drive_select_file', {file_id, file_name, mime_type})
-> CDEP_DRIVE::downloadFile() o CDEP_DRIVE::exportFile() (Google Sheets)
-> guarda temporal en wp_upload_dir -> CDEP_EXCEL::parse()
-> CDEP_DRIVE::saveCachedData() -> CDEP_SELECTED_DATA
-> CDEP_DRIVE::saveSelectedFile() -> CDEP_SELECTED
```

### 5. Vista previa actualizacion -> AJAX
```
JS ajax('cdep_update_preview', {mapping}) -> CDEP_PRODUCTS::validateMapping()
-> stats: total, found, new_count, products[{sku, exists, product_id, status, fields}]
-> SKUs existentes renderizados como link a post.php?action=edit
```

### 6. Ejecutar actualizacion -> AJAX
**Masiva (SKUs seleccionados):**
```
JS recolecta SKUs checked -> ajax('cdep_update_batch_skus', {skus, mapping})
-> CDEP_PRODUCTS::executeUpdate() -> results: updated, created, errors, processed_skus
-> JS repite en lotes de 25
```
**Individual:**
```
JS ajax('cdep_update_single', {sku, mapping})
-> CDEP_PRODUCTS::executeUpdate() -> results with processed_skus[0]
```

---

## AJAX Endpoints del Plugin

| Action | Handler | Ubicacion |
|---|---|---|
| `cdep_save_config` | Closure anonimo | `src/api/drive.php:278` |
| `cdep_get_auth_url` | Closure anonimo | `src/api/drive.php:293` |
| `cdep_drive_connect` | Closure anonimo | `src/api/drive.php:307` |
| `cdep_drive_disconnect` | Closure anonimo | `src/api/drive.php:326` |
| `cdep_drive_list` | Closure anonimo | `src/api/drive.php:336` |
| `cdep_get_cached_data` | Closure anonimo | `src/api/drive.php:353` |
| `cdep_refresh_cache` | Closure anonimo | `src/api/drive.php:375` |
| `cdep_reparse_file` | Closure anonimo | `src/api/drive.php:444` |
| `cdep_drive_select_file` | Closure anonimo | `src/api/drive.php:486` |
| `cdep_update_preview` | Closure anonimo | `src/api/products.php:333` |
| `cdep_update_execute` | Closure anonimo | `src/api/products.php:362` |
| `cdep_update_batch_skus` | Closure anonimo | `src/api/products.php:391` |
| `cdep_update_single` | Closure anonimo | `src/api/products.php:437` |

Todos los AJAX deben:
- Verificar nonce con `check_ajax_referer('cdep_nonce', 'nonce')`
- Verificar `current_user_can('manage_options')`
- Responder con `wp_send_json_success()` / `wp_send_json_error()`
- Para FWURespond: `wp_send_json_success(['status' => 'ok', 'message' => '...'])`

---

## Config Form (NO es AJAX)

La configuracion se guarda via POST estandar en `connect.php`:
```php
if (isset($_POST['save']) && $_POST['save'] === 'config') {
    CDEP_DRIVE::saveConfig(...);
    $respond = ['status' => 'ok', 'message' => '...'];
    $config = CDEP_DRIVE::getConfig();
    $isConnected = CDEP_DRIVE::isConnected();
}
```

---

## wp_options Keys del Plugin

| Key | Proposito | Formato |
|---|---|---|
| `CDEP_CONFIG` | Config OAuth | `[client_id => string, client_secret => string, redirect_uri => string]` |
| `CDEP_TOKENS` | Tokens OAuth | `[access_token => string, refresh_token => string, expires_in => int, created => int]` |
| `CDEP_SELECTED` | Archivo seleccionado | `[file_id => string, file_name => string, mime_type => string, selected_at => int]` |
| `CDEP_SELECTED_DATA` | Datos parseados en cache | `[file_id, file_name, headers, sample, all_rows, detected, total_rows, header_row]` |

---

## Google Drive API

### OAuth 2.0
- Auth URL: `https://accounts.google.com/o/oauth2/v2/auth`
- Token URL: `https://oauth2.googleapis.com/token`
- Scope: `https://www.googleapis.com/auth/drive.readonly`
- `access_type=offline` + `prompt=consent` para asegurar refresh token
- Refresh token automatico en `getAccessToken()` si el token expiro

### Drive API v3
- List files: `GET /drive/v3/files?q='{folderId}' in parents and trashed=false`
- Download: `GET /drive/v3/files/{fileId}?alt=media`
- Export: `GET /drive/v3/files/{fileId}/export?mimeType=...`
- Headers: `Authorization: Bearer {accessToken}`

---

## PhpSpreadsheet

### Column Detection Patterns

SKU:
- `/sku/i`, `/codigo/i`, `/codigo/i`, `/cod/i`, `/referencia/i`, `/ref/i`, `/product.*id/i`, `/id.*product/i`, `/item.*id/i`

Price:
- `/price/i`, `/precio/i`, `/cost/i`, `/costo/i`, `/pvp/i`, `/precio_venta/i`, `/precio_neto/i`, `/neto/i`, `/importe/i`, `/valor/i`

Quantity:
- `/quantity/i`, `/cantidad/i`, `/stock/i`, `/qty/i`, `/inventario/i`, `/existencia/i`, `/unidades/i`, `/inventory/i`

---

## WooCommerce

- `wc_get_product_id_by_sku($sku)` -> ID del producto por SKU
- `wc_get_product($productId)` -> objeto `WC_Product`
- Setters disponibles: `set_regular_price()`, `set_sale_price()`, `set_stock_quantity()`, `set_stock_status()`, `set_weight()`, `set_length()`, `set_width()`, `set_height()`, `set_manage_stock()`, `set_backorders()`, `set_tax_status()`, `set_tax_class()`, `set_status()`, `set_name()`, `set_short_description()`, `set_description()`
- `$product->save()` -> persiste cambios

---

## Convenciones JS (admin.js)

- Helper global `ajax(action, data, success, error)` para todas las peticiones
- Objeto `state` con: `currentFolder`, `folderHistory`, `headers`, `mapping`, `totalRows`, `selectedFileId`
- `window.cdepParsedData` para pasar datos de browse a mapping tab
- `localStorage` keys: `cdep_folder` (navegacion), `cdep_mapping_config` (mapeo columnas)
- Las respuestas AJAX esperan `resp.success` + `resp.data`
- FWURespond espera `{ status: 'ok', message: '...' }` en el success
- CSS classes: `fwue-message ok` y `fwue-message error` para mensajes
- `window.cdep` contiene: `ajaxurl`, `nonce`, `is_connected`, `config`, `selected_file`, `oauth_url`, `productFields`
- `URLSearchParams` usado para detectar `?code=` en OAuth callback (excepcion a ES5)
- `renderStatusBadge(status)` --> `pending/new/updated/created/error`
- `renderFieldCell(fieldData, exists)` --> diff HTML con old/new values

### Datos de producto en vista previa
Cada item en `products[]` devuelto por `cdep_update_preview`:
```json
{
  "sku": "ABC123",
  "row": 5,
  "exists": true,
  "product_id": 123,
  "status": "pending",
  "name": "Producto Nombre",
  "image": "<img ...>",
  "categories": "Cat1, Cat2",
  "fields": {
    "regular_price": { "current": "$10.00", "new": "$12.00", "changed": true },
    "stock_quantity": { "current": "5", "new": "10", "changed": true }
  }
}
```
