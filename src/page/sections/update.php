<?php
defined('ABSPATH') || exit;

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
    <h2>Actualizar Productos</h2>

    <div class="cdep-card">
        <p>Archivo: <strong><?= esc_html($selected['file_name'] ?? '') ?></strong></p>

        <div id="cdep-update-container">
            <p>Define el mapeo de columnas en la pestaña <a href="?page=<?= CDEP_KEY ?>#tag-mapping">Mapear</a>
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
