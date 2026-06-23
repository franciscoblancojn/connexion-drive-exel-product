---
name: cdep-plugin
description: >-
  Use ONLY when working on Connexion Drive Excel Product plugin features: Google
  Drive OAuth integration, Excel parsing with PhpSpreadsheet, column mapping
  (SKU/price/quantity), WooCommerce mass product update, or admin page UI.
  Contains plugin-specific validation rules, class references, and data flow
  constraints.
---

# CDEP Plugin — Reglas Específicas del Plugin

Actíva esta skill cuando trabajes con funcionalidades propias del plugin Connexion Drive Excel Product.

---

## Clases Principales

### CDEP_DRIVE (`src/api/drive.php`)
| Método | Descripción |
|---|---|
| `isConnected()` | Verifica si existen tokens válidos |
| `saveConfig($clientId, $clientSecret, $redirectUri)` | Guarda credenciales OAuth en `CDEP_CONFIG` |
| `getConfig()` | Obtiene configuración OAuth de `CDEP_CONFIG` |
| `getAuthUrl()` | Construye URL de autenticación OAuth 2.0 |
| `connect($code)` | Intercambia código por tokens |
| `disconnect()` | Elimina tokens y archivo seleccionado |
| `getAccessToken()` | Obtiene token válido (renueva si expiró) |
| `listFiles($folderId, $pageToken)` | Lista archivos en carpeta de Drive |
| `downloadFile($fileId)` | Descarga contenido de archivo de Drive |
| `saveSelectedFile($fileId, $fileName)` | Guarda datos del archivo seleccionado |
| `getSelectedFile()` | Obtiene datos del archivo seleccionado |

### CDEP_EXCEL (`src/api/excel.php`)
| Método | Descripción |
|---|---|
| `parse($filePath)` | Detecta extensión y parsea Excel/CSV |
| `parseWithPhpSpreadsheet($filePath)` | Usa PhpSpreadsheet para .xlsx/.xls |
| `parseCSV($filePath)` | Lee CSV línea por línea |
| `detectColumns($headers)` | Detecta columnas SKU, precio, cantidad |

### CDEP_PRODUCTS (`src/api/products.php`)
| Método | Descripción |
|---|---|
| `validateMapping($allRows, $headers, $mapping)` | Valida mapeo y genera vista previa |
| `executeUpdate($allRows, $mapping, $offset, $limit)` | Ejecuta actualización por lotes |

---

## Flujo de Datos

### 1. Config OAuth → POST estándar
```
connect.php: POST save=config → CDEP_DRIVE::saveConfig() → CDEP_CONFIG (wp_options)
```

### 2. Conexión Google Drive → AJAX
```
JS ajax('cdep_get_auth_url') → URL de Google → usuario autoriza → redirect con ?code=
→ JS detecta code → ajax('cdep_drive_connect', {code}) → CDEP_DRIVE::connect() → CDEP_TOKENS
```

### 3. Explorar archivos → AJAX
```
JS ajax('cdep_drive_list', {folder_id}) → CDEP_DRIVE::listFiles() → JSON files
```

### 4. Seleccionar archivo → AJAX
```
JS ajax('cdep_drive_select_file', {file_id, file_name}) → CDEP_DRIVE::downloadFile()
→ guarda temporal en wp_upload_dir → CDEP_EXCEL::parse() → headers, sample, detected
→ CDEP_DRIVE::saveSelectedFile() → CDEP_SELECTED
```

### 5. Vista previa actualización → AJAX
```
JS ajax('cdep_update_preview', {mapping}) → CDEP_PRODUCTS::validateMapping()
→ stats: total, found, not_found, skipped, errors, changes
```

### 6. Ejecutar actualización → AJAX (lotes de 25)
```
JS ajax('cdep_update_execute', {mapping, offset, limit}) → CDEP_PRODUCTS::executeUpdate()
→ results: updated, errors, completed, next_offset
→ JS repite hasta completed === true
```

---

## AJAX Endpoints del Plugin

| Action | Handler | Ubicación |
|---|---|---|
| `cdep_save_config` | Closure anónimo | `src/api/drive.php:233` |
| `cdep_get_auth_url` | Closure anónimo | `src/api/drive.php:248` |
| `cdep_drive_connect` | Closure anónimo | `src/api/drive.php:262` |
| `cdep_drive_disconnect` | Closure anónimo | `src/api/drive.php:281` |
| `cdep_drive_list` | Closure anónimo | `src/api/drive.php:291` |
| `cdep_drive_select_file` | Closure anónimo | `src/api/drive.php:308` |
| `cdep_update_preview` | Closure anónimo | `src/api/products.php:166` |
| `cdep_update_execute` | Closure anónimo | `src/api/products.php:205` |

Todos los AJAX deben:
- Verificar nonce con `check_ajax_referer('cdep_nonce', 'nonce')`
- Verificar `current_user_can('manage_options')`
- Responder con `wp_send_json_success()` / `wp_send_json_error()`
- Para FWURespond: `wp_send_json_success(['status' => 'ok', 'message' => '...'])`

---

## Config Form (NO es AJAX)

La configuración se guarda via POST estándar en `connect.php`:
```php
if (isset($_POST['save']) && $_POST['save'] === 'config') {
    CDEP_DRIVE::saveConfig(...);
    $respond = ['status' => 'ok', 'message' => '...'];
    $config = CDEP_DRIVE::getConfig();       // Recargar después de guardar
    $isConnected = CDEP_DRIVE::isConnected(); // Recargar estado
}
```

---

## wp_options Keys del Plugin

| Key | Propósito | Formato |
|---|---|---|
| `CDEP_CONFIG` | Config OAuth | `['client_id' => string, 'client_secret' => string, 'redirect_uri' => string]` |
| `CDEP_TOKENS` | Tokens OAuth | `['access_token' => string, 'refresh_token' => string, 'expires_in' => int, 'created' => int]` |
| `CDEP_SELECTED` | Archivo seleccionado | `['file_id' => string, 'file_name' => string, 'selected_at' => int]` |

---

## Google Drive API

### OAuth 2.0
- Auth URL: `https://accounts.google.com/o/oauth2/v2/auth`
- Token URL: `https://oauth2.googleapis.com/token`
- Scope: `https://www.googleapis.com/auth/drive.readonly`
- `access_type=offline` + `prompt=consent` para asegurar refresh token
- Refresh token automático en `getAccessToken()` si el token expiró

### Drive API v3
- List files: `GET /drive/v3/files?q='{folderId}' in parents and trashed=false`
- Download: `GET /drive/v3/files/{fileId}?alt=media`
- Headers: `Authorization: Bearer {accessToken}`

---

## PhpSpreadsheet

### Column Detection Patterns

SKU:
- `/sku/i`, `/código/i`, `/codigo/i`, `/cod/i`, `/referencia/i`, `/ref/i`, `/product.*id/i`, `/id.*product/i`, `/item.*id/i`

Price:
- `/price/i`, `/precio/i`, `/cost/i`, `/costo/i`, `/pvp/i`, `/precio_venta/i`, `/precio_neto/i`, `/neto/i`, `/importe/i`, `/valor/i`

Quantity:
- `/quantity/i`, `/cantidad/i`, `/stock/i`, `/qty/i`, `/inventario/i`, `/existencia/i`, `/unidades/i`, `/inventory/i`

---

## WooCommerce

- `wc_get_product_id_by_sku($sku)` → ID del producto por SKU
- `wc_get_product($productId)` → objeto `WC_Product`
- `$product->set_regular_price($price)` — actualiza precio regular
- `$product->set_stock_quantity($qty)` — actualiza cantidad en stock
- `$product->set_stock_status('instock'|'outofstock')` — actualiza estado de stock
- `$product->set_manage_stock(true)` — habilita gestión de stock
- `$product->save()` — persiste cambios

---

## Convenciones JS (admin.js)

- Helper global `ajax(action, data, success, error)` para todas las peticiones
- Objeto `state` con: `currentFolder`, `folderHistory`, `headers`, `mapping`, `totalRows`, `selectedFileId`
- `window.cdepParsedData` para pasar datos de browse a mapping tab
- Las respuestas AJAX esperan `resp.success` + `resp.data`
- FWURespond espera `{ status: 'ok', message: '...' }` en el success
- CSS classes: `fwue-message ok` y `fwue-message error` para mensajes
