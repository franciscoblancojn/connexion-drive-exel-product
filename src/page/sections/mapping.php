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
endif; ?>
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
                        <p class="description">Columna que contiene el precio regular del producto</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="mapping-sale-price">Columna Precio de Oferta</label></th>
                    <td>
                        <select id="mapping-sale-price" class="cdep-mapping-select">
                            <option value="">— No actualizar —</option>
                        </select>
                        <p class="description">Columna que contiene el precio de oferta (sale price)</p>
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