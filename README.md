# Connexion Drive Excel Product 🚀

**Version:** 1.1.19 | **License:** GPL2+

Conecta Google Drive, selecciona archivos Excel/CSV, mapea columnas a 16 campos de producto y actualiza productos WooCommerce de forma masiva.

---

## ✨ Caracteristicas

- 🔌 **Conexion Google Drive** — Autenticacion OAuth 2.0 con refresh token y renovacion automatica.
- 📂 **Explorador de Archivos** — Navega carpetas de Drive, soporta Excel (.xlsx, .xls), Google Sheets y CSV.
- 🗺️ **Mapeo de Columnas** — Detecta automaticamente columnas SKU, precio, precio oferta y cantidad. Mapeo a 16 campos del producto.
- 👁️ **Vista Previa** — Validacion con diffs (antes/despues), imagenes, badges de estado.
- ⚡ **Actualizacion Masiva** — Procesa en lotes de 25 con barra de progreso. Soporta actualizar productos existentes y crear nuevos.
- 🎯 **Actualizacion Individual** — Boton "Procesar" por fila para actualizar un solo producto.
- 🔗 **Enlace a Edicion** — SKUs existentes abren el editor de WooCommerce en nueva pestana.
- 🛡️ **Seguridad** — Nonces, capabilities `manage_options`, sanitizacion de inputs, escapado de outputs.

---

## 📋 Requisitos

- WordPress 5.0+
- PHP 7.0+
- WooCommerce 4.0+
- Google Cloud Platform project con Google Drive API habilitada
- PhpSpreadsheet (via Composer)

---

## ⚙️ Instalacion

1. Descarga el plugin desde [GitHub](https://github.com/franciscoblancojn/connexion-drive-exel-product).
2. Sube la carpeta `connexion-drive-exel-product` a `/wp-content/plugins/`.
3. Ejecuta `composer install --no-dev --optimize-autoloader` dentro del plugin.
4. Activa el plugin desde **Plugins** de WordPress.
5. Ve a **Drive Excel Product > Conectar** e ingresa tus credenciales OAuth 2.0 de Google Cloud.

---

## 🗂️ Estructura del Plugin

```
connexion-drive-exel-product/
  index.php                     # Plugin header, constantes, auto-updater
  composer.json                 # Dependencias Composer
  package.json                  # Scripts de release/versionado
  libs/                         # Dependencias (Composer vendor renombrado)
  src/
    _.php                       # Cargador maestro
    api/
      _.php                     # Cargador de API
      drive.php                 # CDEP_DRIVE - OAuth Google Drive, CRUD archivos
      excel.php                 # CDEP_EXCEL - Parseo Excel/CSV con PhpSpreadsheet
      products.php              # CDEP_PRODUCTS - Validacion y actualizacion WooCommerce
    css/
      admin.css                 # Estilos admin (cdep-* clases)
    data/
      _.php                     # Cargador de data
      base.php                  # CDEP_USE_DATA_BASE - CRUD generico wp_options
    js/
      admin.js                  # Frontend JS: OAuth, file browser, mapping, update
    page/
      _.php                     # Cargador de page
      add.php                   # Registro menu + enqueue assets
      sections/
        connect.php             # Config OAuth + estado conexion
        browse.php              # Explorador de archivos Google Drive
        mapping.php             # Mapeo de columnas y campos del producto
        update.php              # (Legacy) Ejecucion de actualizacion masiva
```

---

## 🧠 Clases Principales

| Clase | Archivo | Funcion |
|---|---|---|
| `CDEP_DRIVE` | `src/api/drive.php` | Autenticacion OAuth, gestion de tokens, listado/descarga/exportacion de archivos |
| `CDEP_EXCEL` | `src/api/excel.php` | Parseo de Excel (.xlsx, .xls) y CSV con PhpSpreadsheet |
| `CDEP_PRODUCTS` | `src/api/products.php` | Validacion de mapeo y actualizacion masiva/individual de productos |
| `CDEP_USE_DATA_BASE` | `src/data/base.php` | CRUD generico para wp_options (no instanciado directamente) |

---

## 🖥️ Paginas del Admin

| Tab | Descripcion |
|---|---|
| 🔌 **Conectar** | Configuracion de credenciales OAuth 2.0, conectar/desconectar Google Drive |
| 📂 **Explorar** | Navegacion por carpetas de Drive y seleccion de archivo |
| 🗺️ **Mapear** | Seleccion de fila de encabezados, mapeo de columnas a 16 campos, vista previa con diffs |

---

## 🔌 AJAX Endpoints

| Action | Handler | Proposito |
|---|---|---|
| `cdep_save_config` | Closure en `drive.php:278` | Guarda credenciales OAuth |
| `cdep_get_auth_url` | Closure en `drive.php:293` | Obtiene URL de autenticacion Google |
| `cdep_drive_connect` | Closure en `drive.php:307` | Intercambia codigo OAuth por tokens |
| `cdep_drive_disconnect` | Closure en `drive.php:326` | Elimina tokens y desconecta Drive |
| `cdep_drive_list` | Closure en `drive.php:336` | Lista archivos/carpetas en una carpeta de Drive |
| `cdep_get_cached_data` | Closure en `drive.php:353` | Obtiene datos parseados en cache |
| `cdep_refresh_cache` | Closure en `drive.php:375` | Redescarga archivo y re-parsea |
| `cdep_reparse_file` | Closure en `drive.php:444` | Re-parsea archivo temporal con nueva fila de encabezados |
| `cdep_drive_select_file` | Closure en `drive.php:486` | Descarga, parsea y cachea archivo seleccionado |
| `cdep_update_preview` | Closure en `products.php:333` | Valida mapeo y genera vista previa |
| `cdep_update_execute` | Closure en `products.php:362` | Ejecuta actualizacion por lotes (offset) |
| `cdep_update_batch_skus` | Closure en `products.php:391` | Actualiza SKUs especificos por lote |
| `cdep_update_single` | Closure en `products.php:437` | Actualiza un solo producto por SKU |

---

## 📋 Campos del Producto Soportados

| Campo | Tipo | WooCommerce Setter |
|---|---|---|
| `regular_price` | float | `set_regular_price()` |
| `sale_price` | float | `set_sale_price()` |
| `stock_quantity` | int | `set_stock_quantity()` |
| `stock_status` | string | `set_stock_status()` |
| `weight` | float | `set_weight()` |
| `length` | float | `set_length()` |
| `width` | float | `set_width()` |
| `height` | float | `set_height()` |
| `manage_stock` | bool | `set_manage_stock()` |
| `backorders` | string | `set_backorders()` |
| `tax_status` | string | `set_tax_status()` |
| `tax_class` | string | `set_tax_class()` |
| `post_status` | string | `set_status()` |
| `product_name` | string | `set_name()` |
| `short_description` | string | `set_short_description()` |
| `description` | string | `set_description()` |

---

## 🔒 Seguridad

- ✅ Todas las peticiones AJAX verifican nonce con `check_ajax_referer('cdep_nonce', 'nonce')`
- ✅ Todas las operaciones admin verifican `current_user_can('manage_options')`
- ✅ Input sanitizado con `sanitize_text_field()`, `intval()`, `sanitize_key()`, `sanitize_file_name()`
- ✅ Output escapado con `esc_attr()`, `esc_html()`, `esc_url()`, `esc_textarea()`
- ✅ Tokens almacenados en `wp_options`, no expuestos al frontend
- ✅ Archivos temporales se almacenan en `wp_upload_dir()` con nombre sanitizado

---

## 📦 Constantes Globales

| Constante | Valor | Uso |
|---|---|---|
| `CDEP_KEY` | `'CDEP'` | Prefijo de opciones, slugs y keys |
| `CDEP_CONFIG` | `'CDEP_CONFIG'` | Opcion de configuracion OAuth |
| `CDEP_TOKENS` | `'CDEP_TOKENS'` | Opcion de tokens OAuth |
| `CDEP_SELECTED` | `'CDEP_SELECTED'` | Opcion de archivo seleccionado |
| `CDEP_SELECTED_DATA` | `'CDEP_SELECTED_DATA'` | Opcion de datos parseados en cache |
| `CDEP_DIR` | `plugin_dir_path(__FILE__)` | Ruta absoluta del plugin |
| `CDEP_URL` | `plugin_dir_url(__FILE__)` | URL base del plugin |
| `CDEP_BASENAME` | `plugin_basename(__FILE__)` | Base name del plugin |
| `CDEP_MODE_DEV` | `true` en dev hosts | Habilita modo desarrollo |

---

## 📄 Licencia

GPL2+ — Ver [LICENSE](https://www.gnu.org/licenses/gpl-2.0.html) para mas detalles.

---

## 👤 Developer

- **Name:** Francisco Blanco
- **Website:** https://franciscoblanco.vercel.app/
- **Email:** blancofrancisco34@gmail.com
