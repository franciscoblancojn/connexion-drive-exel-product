jQuery(function ($) {
    var cdep = {
        currentFolder: 'root',
        folderHistory: [],
        headers: [],
        mapping: {},
        totalRows: 0,
        selectedFileId: '',
    };

    function ajax(action, data, success, error) {
        $.ajax({
            url: cdep_ajax.ajaxurl,
            type: 'POST',
            data: $.extend({
                action: action,
                nonce: cdep_ajax.nonce,
            }, data),
            success: function (resp) {
                if (resp.success) {
                    if (success) success(resp.data);
                } else {
                    if (error) error(resp.data);
                    else showMessage('#cdep-config-message', resp.data, 'error');
                }
            },
            error: function () {
                if (error) error('Error de conexión');
                else showMessage('#cdep-config-message', 'Error de conexión', 'error');
            },
        });
    }

    function showMessage(selector, msg, type) {
        var el = $(selector);
        if (typeof msg === 'object') msg = msg.message || JSON.stringify(msg);
        el.html('<div class="notice notice-' + type + ' inline"><p>' + msg + '</p></div>');
        setTimeout(function () { el.empty(); }, 8000);
    }

    // === CONNECT TAB ===

    $('#cdep-config-form').on('submit', function (e) {
        e.preventDefault();
        ajax('cdep_save_config', {
            client_id: $('#client_id').val(),
            client_secret: $('#client_secret').val(),
            redirect_uri: $('#redirect_uri').val(),
        }, function (data) {
            showMessage('#cdep-config-message', data.message, 'success');
        }, function (msg) {
            showMessage('#cdep-config-message', msg, 'error');
        });
    });

    $('#cdep-drive-connect').on('click', function () {
        ajax('cdep_get_auth_url', {}, function (data) {
            if (data.url) {
                window.location.href = data.url;
            }
        }, function (msg) {
            showMessage('#cdep-connect-message', msg, 'error');
        });
    });

    $('#cdep-drive-disconnect').on('click', function () {
        if (!confirm('¿Estás seguro de desconectar Google Drive?')) return;
        ajax('cdep_drive_disconnect', {}, function (data) {
            showMessage('#cdep-connect-message', data.message, 'success');
            setTimeout(function () { location.reload(); }, 1500);
        }, function (msg) {
            showMessage('#cdep-connect-message', msg, 'error');
        });
    });

    // Handle OAuth callback
    (function () {
        var params = new URLSearchParams(window.location.search);
        var code = params.get('code');
        if (code) {
            showMessage('#cdep-connect-message', 'Conectando a Google Drive...', 'success');
            ajax('cdep_drive_connect', { code: code }, function (data) {
                showMessage('#cdep-connect-message', data.message, 'success');
                setTimeout(function () {
                    window.location.href = '?page=CDEP&tab=browse';
                }, 1500);
            }, function (msg) {
                showMessage('#cdep-connect-message', msg, 'error');
            });
        }
    })();

    // === BROWSE TAB ===

    function loadFiles(folderId, pageToken) {
        cdep.currentFolder = folderId;
        $('#cdep-file-list').html('<p class="cdep-loading">Cargando archivos...</p>');

        ajax('cdep_drive_list', {
            folder_id: folderId,
            page_token: pageToken || '',
        }, function (data) {
            var html = '';
            if (data.files.length === 0) {
                html = '<p class="cdep-empty">Esta carpeta está vacía</p>';
            } else {
                html = '<table class="wp-list-table widefat fixed striped">';
                html += '<thead><tr><th>Nombre</th><th>Tipo</th><th>Tamaño</th><th>Acción</th></tr></thead><tbody>';
                $.each(data.files, function (i, file) {
                    var isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                    var isExcel = file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                        || file.mimeType === 'application/vnd.ms-excel'
                        || file.name.match(/\.(xlsx|xls|csv)$/i);
                    var icon = isFolder ? '📁' : (isExcel ? '📊' : '📄');
                    var size = file.size ? formatSize(parseInt(file.size)) : '-';

                    html += '<tr class="' + (isFolder ? 'cdep-folder-row' : '') + '">';
                    html += '<td>' + icon + ' ' + escHtml(file.name) + '</td>';
                    html += '<td>' + (isFolder ? 'Carpeta' : (isExcel ? 'Excel' : file.mimeType)) + '</td>';
                    html += '<td>' + size + '</td>';
                    html += '<td>';
                    if (isFolder) {
                        html += '<a href="#" class="button button-small cdep-folder-link" data-folder="' + file.id + '">Abrir</a>';
                    } else if (isExcel) {
                        html += '<a href="#" class="button button-primary button-small cdep-select-file" data-fileid="' + file.id + '" data-filename="' + escHtml(file.name) + '">Seleccionar</a>';
                    }
                    html += '</td></tr>';
                });
                html += '</tbody></table>';
            }
            $('#cdep-file-list').html(html);
        }, function (msg) {
            $('#cdep-file-list').html('<p class="cdep-error">' + msg + '</p>');
        });
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function escHtml(str) {
        return $('<span>').text(str).html();
    }

    $(document).on('click', '.cdep-folder-link', function (e) {
        e.preventDefault();
        var folderId = $(this).data('folder');
        if (folderId === 'root') {
            cdep.folderHistory = [];
            $('.cdep-current-folder').text('');
        } else {
            cdep.folderHistory.push(cdep.currentFolder);
            $('.cdep-current-folder').text($(this).closest('tr').find('td:first').text().trim());
        }
        loadFiles(folderId);
        $('#cdep-selected-file-info').hide();
    });

    $(document).on('click', '.cdep-select-file', function (e) {
        e.preventDefault();
        var btn = $(this);
        var fileId = btn.data('fileid');
        var fileName = btn.data('filename');

        btn.text('Cargando...').prop('disabled', true);

        ajax('cdep_drive_select_file', {
            file_id: fileId,
            file_name: fileName,
        }, function (data) {
            cdep.headers = data.headers;
            cdep.totalRows = data.total_rows;
            cdep.selectedFileId = fileId;

            $('#cdep-selected-file-name').text(fileName);
            $('#cdep-selected-file-rows').text(data.total_rows);
            $('#cdep-selected-file-info').show();
            $('#cdep-file-list-message').html(
                '<div class="notice notice-success inline"><p>Archivo cargado: ' + fileName
                + ' (' + data.total_rows + ' filas)</p></div>'
            );

            // Store data for mapping tab
            window.cdepParsedData = data;
            btn.text('Seleccionado').prop('disabled', false);
        }, function (msg) {
            $('#cdep-file-list-message').html(
                '<div class="notice notice-error inline"><p>' + msg + '</p></div>'
            );
            btn.text('Seleccionar').prop('disabled', false);
        });
    });

    // Load initial file list if on browse tab
    if ($('#cdep-file-list').length) {
        loadFiles('root');
    }

    // === MAPPING TAB ===

    function loadMapping() {
        if (window.cdepParsedData) {
            renderMapping(window.cdepParsedData);
            return;
        }

        // If no data in memory, we need to re-select the file
        ajax('cdep_drive_list', {
            folder_id: 'root',
        }, function (data) {
            $('#cdep-mapping-container').html(
                '<p class="cdep-notice">Los datos del archivo no están disponibles. '
                + 'Ve a la pestaña <a href="?page=CDEP&tab=browse">Explorar</a> '
                + 'y selecciona el archivo nuevamente.</p>'
            );
        });
    }

    function renderMapping(data) {
        $('#cdep-mapping-container').html('');

        if (data.sample && data.sample.length > 0) {
            var html = '<h3>Vista previa de datos (primeras ' + data.sample.length + ' filas)</h3>';
            html += '<div class="cdep-table-scroll"><table class="wp-list-table widefat fixed striped">';
            html += '<thead><tr>';
            $.each(data.headers, function (i, h) {
                html += '<th>' + escHtml(h.name) + '</th>';
            });
            html += '</tr></thead><tbody>';
            $.each(data.sample, function (ri, row) {
                html += '<tr>';
                $.each(row, function (ci, cell) {
                    html += '<td>' + escHtml(cell) + '</td>';
                });
                html += '</tr>';
            });
            html += '</tbody></table></div>';
            html += '<p>Total de filas: <strong>' + data.total_rows + '</strong></p>';
            $('#cdep-mapping-container').html(html);
        }

        // Populate selects
        var selects = ['#mapping-sku', '#mapping-price', '#mapping-quantity'];
        $.each(selects, function (si, sel) {
            var $sel = $(sel);
            $sel.find('option:not(:first)').remove();
            $.each(data.headers, function (i, h) {
                $sel.append('<option value="' + h.index + '">' + escHtml(h.name) + '</option>');
            });
        });

        // Auto-select detected columns
        if (data.detected.sku !== null) {
            $('#mapping-sku').val(data.detected.sku);
        }
        if (data.detected.price !== null) {
            $('#mapping-price').val(data.detected.price);
        }
        if (data.detected.quantity !== null) {
            $('#mapping-quantity').val(data.detected.quantity);
        }

        $('#cdep-mapping-form').show();
        $('#cdep-preview-update').prop('disabled', false);
    }

    $('#cdep-preview-update').on('click', function () {
        var mapping = {
            sku: $('#mapping-sku').val(),
            price: $('#mapping-price').val(),
            quantity: $('#mapping-quantity').val(),
        };

        if (!mapping.sku) {
            showMessage('#cdep-preview-result', 'Debes seleccionar la columna SKU', 'error');
            return;
        }

        if (!mapping.price && !mapping.quantity) {
            showMessage('#cdep-preview-result', 'Debes seleccionar al menos Precio o Cantidad', 'error');
            return;
        }

        cdep.mapping = mapping;

        $(this).prop('disabled', true).text('Procesando...');

        ajax('cdep_update_preview', {
            mapping: mapping,
        }, function (data) {
            var html = '<h3>Resultado de la Vista Previa</h3>';
            html += '<table class="wp-list-table widefat fixed striped">';
            html += '<tr><td><strong>Total de filas en Excel</strong></td><td>' + data.total + '</td></tr>';
            html += '<tr><td><strong>Productos encontrados</strong></td><td>' + data.found + '</td></tr>';
            html += '<tr><td><strong>Productos no encontrados</strong></td><td>' + data.not_found + '</td></tr>';
            html += '<tr><td><strong>Filas sin SKU</strong></td><td>' + data.skipped + '</td></tr>';
            html += '</table>';

            if (data.errors && data.errors.length > 0) {
                html += '<h4>Errores de validación</h4>';
                html += '<table class="wp-list-table widefat fixed striped">';
                html += '<thead><tr><th>Fila</th><th>SKU</th><th>Error</th></tr></thead><tbody>';
                $.each(data.errors.slice(0, 20), function (i, err) {
                    html += '<tr><td>' + err.row + '</td><td>' + escHtml(err.sku) + '</td><td>' + escHtml(err.error) + '</td></tr>';
                });
                if (data.errors.length > 20) {
                    html += '<tr><td colspan="3">... y ' + (data.errors.length - 20) + ' más</td></tr>';
                }
                html += '</tbody></table>';
            }

            if (data.changes) {
                html += '<h4>Cambios a realizar (primeros 10)</h4>';
                html += '<table class="wp-list-table widefat fixed striped">';
                html += '<thead><tr><th>SKU</th>';
                html += mapping.price ? '<th>Precio Actual</th><th>Nuevo Precio</th>' : '';
                html += mapping.quantity ? '<th>Stock Actual</th><th>Nuevo Stock</th>' : '';
                html += '</tr></thead><tbody>';
                var count = 0;
                $.each(data.changes, function (sku, ch) {
                    if (count >= 10) return;
                    html += '<tr><td>' + escHtml(sku) + '</td>';
                    if (ch.price) {
                        html += '<td>' + ch.price.old + '</td><td><strong>' + ch.price.new + '</strong></td>';
                    } else if (mapping.price) {
                        html += '<td colspan="2">-</td>';
                    }
                    if (ch.quantity) {
                        html += '<td>' + (ch.quantity.old !== null ? ch.quantity.old : 'N/A') + '</td><td><strong>' + ch.quantity.new + '</strong></td>';
                    } else if (mapping.quantity) {
                        html += '<td colspan="2">-</td>';
                    }
                    html += '</tr>';
                    count++;
                });
                if (Object.keys(data.changes).length > 10) {
                    html += '<tr><td colspan="4">... y ' + (Object.keys(data.changes).length - 10) + ' más</td></tr>';
                }
                html += '</tbody></table>';
            }

            html += '<p>Archivo: <strong>' + escHtml(data.file_name) + '</strong></p>';
            html += '<p><a href="?page=CDEP&tab=update" class="button button-primary">Ir a Actualizar</a></p>';

            $('#cdep-preview-result').html(html);
            $('#cdep-preview-update').prop('disabled', false).text('Vista Previa de Actualización');

            // Enable update button
            $('#cdep-start-update').prop('disabled', false).data('mapping', mapping);
        }, function (msg) {
            showMessage('#cdep-preview-result', msg, 'error');
            $('#cdep-preview-update').prop('disabled', false).text('Vista Previa de Actualización');
        });
    });

    // Load mapping data when tab is active
    if ($('#cdep-mapping-container').length) {
        loadMapping();
    }

    // === UPDATE TAB ===

    $('#cdep-start-update').on('click', function () {
        var mapping = $(this).data('mapping');
        if (!mapping) {
            showMessage('#cdep-update-result', 'Primero haz una vista previa en la pestaña "Mapear"', 'error');
            return;
        }

        var btn = $(this);
        btn.prop('disabled', true).text('Actualizando...');
        $('#cdep-update-progress').show();
        $('#cdep-update-result').html('');

        var totalUpdated = 0;
        var allErrors = [];
        var offset = 0;
        var limit = 25;

        function processBatch() {
            ajax('cdep_update_execute', {
                mapping: mapping,
                offset: offset,
                limit: limit,
            }, function (data) {
                totalUpdated += data.updated;
                if (data.errors) {
                    allErrors = allErrors.concat(data.errors);
                }

                var progress = Math.min(100, Math.round((offset + limit) / cdep.totalRows * 100));
                $('.cdep-progress-fill').css('width', progress + '%');
                $('.cdep-progress-text').text(totalUpdated + ' / ' + cdep.totalRows + ' productos actualizados');

                if (data.completed) {
                    // Done
                    btn.prop('disabled', false).text('Iniciar Actualización Masiva');
                    var html = '<div class="notice notice-success inline"><p>';
                    html += '<strong>Actualización completada</strong><br>';
                    html += 'Productos actualizados: ' + totalUpdated + '<br>';
                    if (allErrors.length > 0) {
                        html += 'Errores: ' + allErrors.length;
                    }
                    html += '</p></div>';

                    if (allErrors.length > 0) {
                        html += '<h4>Errores</h4>';
                        html += '<table class="wp-list-table widefat fixed striped">';
                        html += '<thead><tr><th>Fila</th><th>SKU</th><th>Error</th></tr></thead><tbody>';
                        $.each(allErrors.slice(0, 50), function (i, err) {
                            html += '<tr><td>' + err.row + '</td><td>' + escHtml(err.sku) + '</td><td>' + escHtml(err.error) + '</td></tr>';
                        });
                        if (allErrors.length > 50) {
                            html += '<tr><td colspan="3">... y ' + (allErrors.length - 50) + ' más</td></tr>';
                        }
                        html += '</tbody></table>';
                    }

                    $('#cdep-update-result').html(html);
                    $('.cdep-progress-text').text('Completado: ' + totalUpdated + ' productos actualizados');
                } else {
                    offset = data.next_offset || (offset + limit);
                    processBatch();
                }
            }, function (msg) {
                btn.prop('disabled', false).text('Iniciar Actualización Masiva');
                showMessage('#cdep-update-result', msg, 'error');
            });
        }

        processBatch();
    });

    // === TAB SWITCHING ===
    var currentQueryString = window.location.search;
    if (currentQueryString.indexOf('code=') !== -1 || currentQueryString.indexOf('tab=connect') !== -1) {
    }
});
