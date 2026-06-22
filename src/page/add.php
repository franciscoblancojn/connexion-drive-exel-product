<?php
defined('ABSPATH') || exit;

add_action('admin_menu', function () {
    add_menu_page(
        'Connexion Drive Excel Product',
        'Drive Excel Product',
        'manage_options',
        CDEP_KEY,
        'CDEP_render_page',
        'dashicons-update'
    );
});

add_action('admin_enqueue_scripts', function ($hook) {
    if ($hook !== 'toplevel_page_' . CDEP_KEY) {
        return;
    }

    wp_enqueue_style('cdep-admin', CDEP_URL . 'src/css/admin.css', [], '1.0.0');
    wp_enqueue_script('cdep-admin', CDEP_URL . 'src/js/admin.js', ['jquery'], '1.0.0', true);
    wp_localize_script('cdep-admin', 'cdep', [
        'ajaxurl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('cdep_nonce'),
        'is_connected' => CDEP_DRIVE::isConnected(),
        'config' => CDEP_DRIVE::getConfig(),
        'selected_file' => CDEP_DRIVE::getSelectedFile(),
        'oauth_url' => admin_url('admin.php?page=' . CDEP_KEY),
    ]);
});

function CDEP_render_page() {
    $config = CDEP_DRIVE::getConfig();
    $isConnected = CDEP_DRIVE::isConnected();
    $selected = CDEP_DRIVE::getSelectedFile();

    $activeTab = isset($_GET['tab']) ? sanitize_key($_GET['tab']) : 'connect';

    $tabs = [
        'connect' => 'Conectar',
        'browse' => 'Explorar',
        'mapping' => 'Mapear',
        'update' => 'Actualizar',
    ];

    ?>
    <div class="wrap cdep-wrap">
        <h1>Connexion Drive Excel Product</h1>

        <nav class="nav-tab-wrapper">
            <?php foreach ($tabs as $key => $label): ?>
                <a href="?page=<?= CDEP_KEY ?>&tab=<?= $key ?>"
                   class="nav-tab <?= $activeTab === $key ? 'nav-tab-active' : '' ?>"
                   data-tab="<?= $key ?>">
                    <?= esc_html($label) ?>
                </a>
            <?php endforeach; ?>
        </nav>

        <div class="cdep-tab-content">
            <?php
            switch ($activeTab) {
                case 'connect':
                    CDEP_render_connect_tab($config, $isConnected);
                    break;
                case 'browse':
                    CDEP_render_browse_tab($isConnected);
                    break;
                case 'mapping':
                    CDEP_render_mapping_tab($isConnected, $selected);
                    break;
                case 'update':
                    CDEP_render_update_tab($isConnected, $selected);
                    break;
            }
            ?>
        </div>
    </div>
    <?php
}

function CDEP_render_connect_tab($config, $isConnected) {
    $redirectUri = admin_url('admin.php?page=' . CDEP_KEY);
    ?>
    <div class="cdep-section">
        <h2>Configuración de Google Drive</h2>

        <div class="cdep-card">
            <h3>Credenciales de Google API</h3>
            <p>Para conectar con Google Drive, necesitas crear credenciales en
                <a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a>.</p>
            <ol>
                <li>Crea un proyecto en Google Cloud Console</li>
                <li>Habilita la API de Google Drive</li>
                <li>Configura la pantalla de consentimiento OAuth</li>
                <li>Crea credenciales OAuth 2.0 (Tipo: Aplicación web)</li>
                <li>Agrega esta URI de redireccionamiento: <code><?= esc_html($redirectUri) ?></code></li>
            </ol>

            <form id="cdep-config-form">
                <table class="form-table">
                    <tr>
                        <th><label for="client_id">Client ID</label></th>
                        <td>
                            <input type="text" id="client_id" name="client_id"
                                   value="<?= esc_attr($config['client_id'] ?? '') ?>"
                                   class="regular-text" required>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="client_secret">Client Secret</label></th>
                        <td>
                            <input type="password" id="client_secret" name="client_secret"
                                   value="<?= esc_attr($config['client_secret'] ?? '') ?>"
                                   class="regular-text" required>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="redirect_uri">Redirect URI</label></th>
                        <td>
                            <input type="text" id="redirect_uri" name="redirect_uri"
                                   value="<?= esc_attr($config['redirect_uri'] ?? $redirectUri) ?>"
                                   class="regular-text" required>
                        </td>
                    </tr>
                </table>
                <p class="submit">
                    <button type="submit" class="button button-primary">Guardar Configuración</button>
                </p>
            </form>

            <div id="cdep-config-message"></div>
        </div>

        <div class="cdep-card">
            <h3>Estado de la Conexión</h3>
            <?php if ($isConnected): ?>
                <p><span class="cdep-status connected">● Conectado</span></p>
                <p><button id="cdep-drive-connect" class="button" style="display:none">Conectar a Google Drive</button></p>
                <p><button id="cdep-drive-disconnect" class="button button-secondary">Desconectar</button></p>
            <?php else: ?>
                <p><span class="cdep-status disconnected">● Desconectado</span></p>
                <p><button id="cdep-drive-connect" class="button button-primary">Conectar a Google Drive</button></p>
                <p><button id="cdep-drive-disconnect" class="button button-secondary" style="display:none">Desconectar</button></p>
            <?php endif; ?>
            <div id="cdep-connect-message"></div>
        </div>
    </div>
    <?php
}

function CDEP_render_browse_tab($isConnected) {
    if (!$isConnected): ?>
        <div class="cdep-section">
            <p class="cdep-notice">Primero debes conectarte a Google Drive en la pestaña "Conectar".</p>
        </div>
        <?php return;
    endif;
    ?>
    <div class="cdep-section">
        <h2>Explorar Google Drive</h2>

        <div class="cdep-card">
            <div class="cdep-breadcrumb">
                <a href="#" class="cdep-folder-link" data-folder="root">Mi Unidad</a>
                <span class="cdep-breadcrumb-sep">/</span>
                <span class="cdep-current-folder"></span>
            </div>

            <div id="cdep-file-list">
                <p class="cdep-loading">Cargando archivos...</p>
            </div>

            <div id="cdep-file-list-message"></div>

            <div id="cdep-selected-file-info" style="display:none" class="cdep-selected-file">
                <h3>Archivo Seleccionado</h3>
                <p><strong>Nombre:</strong> <span id="cdep-selected-file-name"></span></p>
                <p><strong>Filas:</strong> <span id="cdep-selected-file-rows"></span></p>
                <p>
                    <a href="?page=<?= CDEP_KEY ?>&tab=mapping" class="button button-primary">
                        Ir a Mapear Columnas
                    </a>
                </p>
            </div>
        </div>
    </div>
    <?php
}

function CDEP_render_mapping_tab($isConnected, $selected) {
    if (!$isConnected): ?>
        <div class="cdep-section">
            <p class="cdep-notice">Primero debes conectarte a Google Drive en la pestaña "Conectar".</p>
        </div>
        <?php return;
    endif;

    if (empty($selected)): ?>
        <div class="cdep-section">
            <p class="cdep-notice">Primero debes seleccionar un archivo Excel en la pestaña "Explorar".</p>
        </div>
        <?php return;
    endif;
    ?>
    <div class="cdep-section">
        <h2>Mapeo de Columnas</h2>

        <div class="cdep-card">
            <p>Archivo seleccionado: <strong><?= esc_html($selected['file_name'] ?? '') ?></strong></p>

            <div id="cdep-mapping-container">
                <p class="cdep-loading">Cargando datos del archivo...</p>
            </div>

            <div id="cdep-mapping-form" style="display:none">
                <table class="form-table">
                    <tr>
                        <th><label for="mapping-sku">Columna SKU</label></th>
                        <td>
                            <select id="mapping-sku" class="cdep-mapping-select"></select>
                            <p class="description">Columna que contiene el SKU del producto</p>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="mapping-price">Columna Precio</label></th>
                        <td>
                            <select id="mapping-price" class="cdep-mapping-select">
                                <option value="">— No actualizar —</option>
                            </select>
                            <p class="description">Columna que contiene el precio del producto</p>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="mapping-quantity">Columna Cantidad</label></th>
                        <td>
                            <select id="mapping-quantity" class="cdep-mapping-select">
                                <option value="">— No actualizar —</option>
                            </select>
                            <p class="description">Columna que contiene la cantidad en stock</p>
                        </td>
                    </tr>
                </table>

                <p>
                    <button id="cdep-preview-update" class="button button-primary">
                        Vista Previa de Actualización
                    </button>
                </p>

                <div id="cdep-preview-result"></div>
            </div>
        </div>
    </div>
    <?php
}

function CDEP_render_update_tab($isConnected, $selected) {
    if (!$isConnected): ?>
        <div class="cdep-section">
            <p class="cdep-notice">Primero debes conectarte a Google Drive en la pestaña "Conectar".</p>
        </div>
        <?php return;
    endif;

    if (empty($selected)): ?>
        <div class="cdep-section">
            <p class="cdep-notice">Primero debes seleccionar un archivo Excel en la pestaña "Explorar".</p>
        </div>
        <?php return;
    endif;
    ?>
    <div class="cdep-section">
        <h2>Actualizar Productos</h2>

        <div class="cdep-card">
            <p>Archivo: <strong><?= esc_html($selected['file_name'] ?? '') ?></strong></p>

            <div id="cdep-update-container">
                <p>Define el mapeo de columnas en la pestaña <a href="?page=<?= CDEP_KEY ?>&tab=mapping">Mapear</a>
                    y luego vuelve aquí para ejecutar la actualización.</p>

                <p>
                    <button id="cdep-start-update" class="button button-primary" disabled>
                        Iniciar Actualización Masiva
                    </button>
                </p>

                <div id="cdep-update-progress" style="display:none">
                    <div class="cdep-progress-bar">
                        <div class="cdep-progress-fill" style="width:0%"></div>
                    </div>
                    <p class="cdep-progress-text">0 / 0 productos actualizados</p>
                </div>

                <div id="cdep-update-result"></div>
            </div>
        </div>
    </div>
    <?php
}
