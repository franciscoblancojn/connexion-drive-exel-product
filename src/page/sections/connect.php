<?php
defined('ABSPATH') || exit;

use franciscoblancojn\wordpress_utils\FWUCollapse;
use franciscoblancojn\wordpress_utils\FWUTooltip;
use franciscoblancojn\wordpress_utils\FWURespond;

$redirectUri = admin_url('admin.php?page=' . CDEP_KEY);
$respond = [];

if (isset($_POST['save']) && $_POST['save'] === 'config') {
    CDEP_DRIVE::saveConfig(
        sanitize_text_field($_POST['client_id'] ?? ''),
        sanitize_text_field($_POST['client_secret'] ?? ''),
        sanitize_text_field($_POST['redirect_uri'] ?? '')
    );
    $respond = ['status' => 'ok', 'message' => 'Configuración guardada'];
    $config = CDEP_DRIVE::getConfig();
    $isConnected = CDEP_DRIVE::isConnected();
}
?>
<div class="cdep-section">

    <div class="cdep-card">
        <h3>Credenciales de Google API</h3>

        <?php
        FWUCollapse::render(
            'Instrucciones de configuración',
            '<ol>
                <li>Crea un proyecto en <a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a></li>
                <li>Habilita la API de Google Drive</li>
                <li>Configura la pantalla de consentimiento OAuth</li>
                <li>Crea credenciales OAuth 2.0 (Tipo: Aplicación web)</li>
                <li>Agrega esta URI de redireccionamiento: <code>' . esc_html($redirectUri) . '</code></li>
            </ol>'
        );
        ?>

        <form method="post">
            <?php FWURespond::render($respond); ?>
            <input type="hidden" name="save" value="config">
            <table class="form-table">
                <tr>
                    <th>
                        <?php FWUTooltip::render('Client ID', 'El identificador de cliente OAuth 2.0 de Google Cloud'); ?>
                    </th>
                    <td>
                        <input type="text" id="client_id" name="client_id"
                               value="<?= esc_attr($config['client_id'] ?? '') ?>"
                               class="regular-text" required>
                    </td>
                </tr>
                <tr>
                    <th>
                        <?php FWUTooltip::render('Client Secret', 'El secreto de cliente OAuth 2.0 de Google Cloud'); ?>
                    </th>
                    <td>
                        <input type="password" id="client_secret" name="client_secret"
                               value="<?= esc_attr($config['client_secret'] ?? '') ?>"
                               class="regular-text" required>
                    </td>
                </tr>
                <tr>
                    <th>
                        <?php FWUTooltip::render('Redirect URI', 'La URI de redireccionamiento configurada en Google Cloud Console'); ?>
                    </th>
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
