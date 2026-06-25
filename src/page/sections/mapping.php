<?php
defined('ABSPATH') || exit;
$isConnected ??= false;
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

$productFields = CDEP_PRODUCTS::getFields();
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
                    <th><label for="cdep-header-row">Fila de encabezados</label></th>
                    <td>
                        <input type="number" id="cdep-header-row" class="small-text" value="0" min="0">
                        <button id="cdep-apply-header-row" class="button">Aplicar</button>
                        <p class="description">Número de fila que contiene los nombres de columna (0 = primera fila)</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="mapping-sku">Columna SKU <span style="color:#d63638">*</span></label></th>
                    <td>
                        <select id="mapping-sku" class="cdep-mapping-select">
                            <option value="">— Seleccionar columna SKU —</option>
                        </select>
                        <p class="description">Columna que contiene el SKU del producto (obligatorio)</p>
                    </td>
                </tr>
            </table>

            <h3>Mapeo de campos del producto</h3>
            <p class="description">Selecciona qué columna del archivo corresponde a cada campo del producto. Deja en "— No mapear —" para los campos que no quieras actualizar.</p>

            <table class="wp-list-table widefat striped" id="cdep-field-mapping-table">
                <thead>
                    <tr>
                        <th style="width:40%">Campo del producto</th>
                        <th style="width:60%">Columna en el archivo</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($productFields as $fieldKey => $fieldInfo): ?>
                    <tr>
                        <td><strong><?= esc_html($fieldInfo['label']) ?></strong></td>
                        <td>
                            <select class="cdep-field-select" data-field="<?= esc_attr($fieldKey) ?>" style="width:100%;max-width:400px">
                                <option value="">— No mapear —</option>
                            </select>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>

            <p>
                <button id="cdep-preview-update" class="button button-primary">
                    Vista Previa de Actualización
                </button>
                <button id="cdep-refresh-file" class="button">
                    Actualizar Archivo
                </button>
            </p>

            <div id="cdep-preview-result"></div>
        </div>
    </div>
</div>
