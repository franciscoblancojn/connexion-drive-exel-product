<?php
defined('ABSPATH') || exit;

use franciscoblancojn\wordpress_utils\FWURespond;

if (!defined('IACON_KEY')) {
    return;
}

$aiProviders = array();
$aiConfig = array();
if (class_exists('IACON_USE_DATA_CONFIG')) {
    $IACON_USE_DATA_CONFIG = new IACON_USE_DATA_CONFIG();
    $aiConfig = $IACON_USE_DATA_CONFIG->get();
    if (!empty($aiConfig['gemini']['apikey']) && ($aiConfig['gemini']['enabled'] ?? false)) {
        $aiProviders[] = array('key' => 'gemini', 'title' => 'Gemini');
    }
    if ($aiConfig['kodee']['enabled'] ?? false) {
        $aiProviders[] = array('key' => 'kodee', 'title' => 'Hostinger Kodee');
    }
}

$cdepAiEnabled = get_option(CDEP_KEY . '_AI_ENABLED', '0');
$cdepAiProvider = get_option(CDEP_KEY . '_AI_PROVIDER', '');

if (isset($_POST['save']) && $_POST['save'] === 'cdep_ai_config') {
    check_admin_referer('cdep_ai_config_nonce');
    if (!current_user_can('manage_options')) {
        wp_die('Unauthorized');
    }

    $cdepAiEnabled = isset($_POST['cdep_ai_enabled']) ? '1' : '0';
    $cdepAiProvider = isset($_POST['cdep_ai_provider']) ? sanitize_text_field($_POST['cdep_ai_provider']) : '';

    update_option(CDEP_KEY . '_AI_ENABLED', $cdepAiEnabled);
    update_option(CDEP_KEY . '_AI_PROVIDER', $cdepAiProvider);

    FWURespond::render(array('status' => 'ok', 'message' => 'Configuraciones IA guardadas correctamente.'));
}
?>
<div class="cdep-section">
    <div class="cdep-card">
        <h2>Configuraciones IA</h2>
        <p>Configura la inteligencia artificial para generación de contenido en productos nuevos.</p>

        <form method="post">
            <?php wp_nonce_field('cdep_ai_config_nonce'); ?>
            <input type="hidden" name="save" value="cdep_ai_config">

            <table class="form-table" id="cdep-ai-settings-table">
                <tr>
                    <th scope="row"><label>Habilitar IA</label></th>
                    <td>
                        <label>
                            <input type="checkbox" id="cdep_ai_enabled" name="cdep_ai_enabled" value="1" <?= checked('1', $cdepAiEnabled, false) ?>>
                            Activar generación con IA para campos seleccionados
                        </label>
                        <p class="description">Cuando está activa, los campos de creación mostrarán la opción "Generar con IA" en sus selectores.</p>
                    </td>
                </tr>
                <tr id="cdep-ai-provider-row" style="<?= $cdepAiEnabled !== '1' ? 'display:none' : '' ?>">
                    <th scope="row"><label for="cdep_ai_provider">Proveedor de IA</label></th>
                    <td>
                        <select id="cdep_ai_provider" name="cdep_ai_provider" style="width:100%;max-width:400px">
                            <option value="">— Seleccionar IA —</option>
                            <?php foreach ($aiProviders as $ai): ?>
                            <option value="<?= esc_attr($ai['key']) ?>" <?= selected($cdepAiProvider, $ai['key'], false) ?>>
                                <?= esc_html($ai['title']) ?>
                            </option>
                            <?php endforeach; ?>
                        </select>
                        <?php if (empty($aiProviders)): ?>
                        <p class="description">No hay IAs configuradas. Ve a <a href="<?= esc_url(admin_url('admin.php?page=' . IACON_KEY . '_config')) ?>">IA Conector</a> para configurar un proveedor.</p>
                        <?php else: ?>
                        <p class="description">Selecciona qué proveedor de IA se usará para generar contenido.</p>
                        <?php endif; ?>
                    </td>
                </tr>
            </table>

            <p>
                <button type="submit" class="button button-primary">Guardar Configuraciones</button>
            </p>
        </form>
    </div>
</div>

<script>
jQuery(function ($) {
    $('#cdep_ai_enabled').on('change', function () {
        $('#cdep-ai-provider-row').toggle($(this).is(':checked'));
    });
});
</script>
