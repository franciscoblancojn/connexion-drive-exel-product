# Connexion Drive Excel Product 🚀

**Version:** 1.1.12 | **License:** GPL2+

Conecta Google Drive, selecciona archivos Excel, mapea columnas (SKU, precio, cantidad) y actualiza productos WooCommerce de forma masiva.

---

## ✨ Características

- 🔌 **Conexión Google Drive** — Autenticación OAuth 2.0 con Google Drive. Soporta refresh tokens y renovación automática.
- 📂 **Explorador de Archivos** — Navega por las carpetas de tu Drive, selecciona archivos Excel/CSV.
- 🗺️ **Mapeo de Columnas** — Detecta automáticamente columnas SKU, precio y cantidad. Vista previa de actualización antes de ejecutar.
- ⚡ **Actualización Masiva** — Procesa productos en lotes de 25 con barra de progreso. Actualiza precio regular y cantidad en stock.
- 🛡️ **Seguridad** — Nonces, capabilities `manage_options`, sanitización de inputs, escapado de outputs.

---

## 📋 Requisitos

- WordPress 5.0+
- PHP 7.0+
- WooCommerce 4.0+
- Google Cloud Platform project con Google Drive API habilitada
- [PhpSpreadsheet](https://github.com/PHPOffice/PhpSpreadsheet) (vía Composer)

---

## ⚙️ Instalación

1. Descarga el plugin desde [GitHub](https://github.com/franciscoblancojn/connexion-drive-exel-product).
2. Sube la carpeta `connexion-drive-exel-product` a `/wp-content/plugins/`.
3. Ejecuta `composer install --no-dev --optimize-autoloader` dentro del plugin.
4. Activa el plugin desde **Plugins** de WordPress.
5. Ve a **Drive Excel Product → Conectar** e ingresa tus credenciales OAuth 2.0 de Google Cloud.

---

## 🗂️ Estructura del Plugin

```
connexion-drive-exel-product/
├── index.php                     # Plugin header, constantes, auto-updater
├── composer.json                 # Dependencias Composer
├── package.json                  # Scripts de release/versionado
├── libs/                         # Dependencias (Composer vendor renombrado)
├── src/
│   ├── _.php                     # Cargador maestro
│   ├── api/                      # API y handlers AJAX
│   │   ├── _.php                 # Cargador de API
│   │   ├── drive.php             # CDEP_DRIVE - OAuth Google Drive, CRUD archivos
│   │   ├── excel.php             # CDEP_EXCEL - Parseo de Excel/CSV con PhpSpreadsheet
│   │   └── products.php          # CDEP_PRODUCTS - Validación y actualización de productos WooCommerce
│   ├── css/
│   │   └── admin.css             # Estilos admin (cdep-* clases)
│   ├── data/                     # Capa de datos
│   │   ├── _.php                 # Cargador de data
│   │   └── base.php              # CDEP_USE_DATA_BASE - CRUD genérico wp_options
│   ├── js/
│   │   └── admin.js              # Frontend JS: OAuth, file browser, mapping, update
│   └── page/                     # Páginas admin
│       ├── _.php                 # Cargador de page
│       ├── add.php               # Registro menú + enqueue assets
│       └── sections/             # Secciones de cada tab
│           ├── connect.php       # Config OAuth + estado conexión
│           ├── browse.php        # Explorador de archivos Google Drive
│           ├── mapping.php       # Mapeo de columnas SKU/precio/cantidad
│           └── update.php        # Ejecución de actualización masiva
```

---

## 🧠 Clases Principales

| Clase | Archivo | Función |
|-------|---------|---------|
| `CDEP_DRIVE` | `src/api/drive.php` | 🔌 Autenticación OAuth, gestión de tokens, listado/descarga de archivos de Google Drive |
| `CDEP_EXCEL` | `src/api/excel.php` | 📊 Parseo de archivos Excel (.xlsx, .xls) y CSV con PhpSpreadsheet |
| `CDEP_PRODUCTS` | `src/api/products.php` | 🏷️ Validación de mapeo y actualización masiva de productos WooCommerce |

---

## 🖥️ Páginas del Admin

| Tab | Slug | Descripción |
|-----|------|-------------|
| 🔌 **Conectar** | `CDEP` (tab `connect`) | Configuración de credenciales OAuth 2.0, conectar/desconectar Google Drive |
| 📂 **Explorar** | `CDEP` (tab `browse`) | Navegación por carpetas de Drive y selección de archivo Excel |
| 🗺️ **Mapear** | `CDEP` (tab `mapping`) | Selección de columnas SKU, precio, cantidad con vista previa |
| ⚡ **Actualizar** | `CDEP` (tab `update`) | Ejecución de actualización masiva con barra de progreso |

---

## 🔌 AJAX Endpoints

| Action | Handler | Propósito |
|--------|---------|-----------|
| `cdep_save_config` | Closure en `drive.php` | Guarda credenciales OAuth (client_id, client_secret, redirect_uri) |
| `cdep_get_auth_url` | Closure en `drive.php` | Obtiene URL de autenticación OAuth de Google |
| `cdep_drive_connect` | Closure en `drive.php` | Intercambia código OAuth por tokens de acceso |
| `cdep_drive_disconnect` | Closure en `drive.php` | Elimina tokens y desconecta Drive |
| `cdep_drive_list` | Closure en `drive.php` | Lista archivos/carpetas en una carpeta de Drive |
| `cdep_drive_select_file` | Closure en `drive.php` | Descarga y parsea archivo Excel seleccionado |
| `cdep_update_preview` | Closure en `products.php` | Valida mapeo y genera vista previa de cambios |
| `cdep_update_execute` | Closure en `products.php` | Ejecuta actualización masiva por lotes |

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

| Constante | Valor | Propósito |
|-----------|-------|-----------|
| `CDEP_KEY` | `'CDEP'` | Prefijo de opciones, slugs y keys |
| `CDEP_CONFIG` | `'CDEP_CONFIG'` | Opción de configuración (client_id, client_secret, redirect_uri) |
| `CDEP_TOKENS` | `'CDEP_TOKENS'` | Opción de tokens OAuth (access_token, refresh_token) |
| `CDEP_SELECTED` | `'CDEP_SELECTED'` | Opción de archivo seleccionado (file_id, file_name) |
| `CDEP_DIR` | `plugin_dir_path(__FILE__)` | Ruta absoluta del plugin |
| `CDEP_URL` | `plugin_dir_url(__FILE__)` | URL base del plugin |
| `CDEP_BASENAME` | `plugin_basename(__FILE__)` | Base name del plugin |
| `CDEP_MODE_DEV` | `true` en dev hosts | Habilita modo desarrollo |

---

## 📄 Licencia

GPL2+ — Ver [LICENSE](https://www.gnu.org/licenses/gpl-2.0.html) para más detalles.

---

## 👤 Developer

- **Name:** Francisco Blanco
- **Website:** https://franciscoblanco.vercel.app/
- **Email:** blancofrancisco34@gmail.com
