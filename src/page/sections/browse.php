<?php
defined('ABSPATH') || exit;

if (!isset($isConnected) || !$isConnected): ?>
    <div class="cdep-section">
        <p class="cdep-notice">Primero debes conectarte a Google Drive en la pestaña "Conectar".</p>
    </div>
    <?php return;
endif; ?>
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
                <a href="#" id="cdep-refresh-cache" class="button">
                    Actualizar
                </a>
                <a href="?page=<?= CDEP_KEY ?>#tag-mapping" class="button button-primary">
                    Ir a Mapear Columnas
                </a>
            </p>
        </div>
    </div>
</div>
