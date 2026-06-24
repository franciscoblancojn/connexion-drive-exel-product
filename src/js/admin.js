jQuery(function ($) {
    var state = {
        currentFolder: 'root',
        folderHistory: [],
        headers: [],
        mapping: {},
        totalRows: 0,
        selectedFileId: '',
    };
    var cdep = window.cdep;

    function ajax(action, data, success, error) {
        $.ajax({
            url: cdep.ajaxurl,
            type: 'POST',
            data: $.extend({
                action: action,
                nonce: cdep.nonce,
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
        el.html('<p class="fwue-message ' + type + '">' + msg + '</p>');
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
            showMessage('#cdep-config-message', data.message, 'ok');
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
            showMessage('#cdep-connect-message', data.message, 'ok');
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
            showMessage('#cdep-connect-message', 'Conectando a Google Drive...', 'ok');
            ajax('cdep_drive_connect', { code: code }, function (data) {
                showMessage('#cdep-connect-message', data.message, 'ok');
                setTimeout(function () {
                    window.location.href = '?page=CDEP#tag-browse';
                }, 1500);
            }, function (msg) {
                showMessage('#cdep-connect-message', msg, 'error');
            });
        }
    })();

    // === BROWSE TAB ===

    function saveFolderState() {
        try {
            localStorage.setItem('cdep_folder', JSON.stringify({
                currentFolder: state.currentFolder,
                folderHistory: state.folderHistory,
                folderName: $('.cdep-current-folder').text(),
            }));
        } catch (e) {}
    }

    function restoreFolderState() {
        try {
            var saved = localStorage.getItem('cdep_folder');
            if (saved) {
                var data = JSON.parse(saved);
                if (data.currentFolder && data.currentFolder !== 'root') {
                    state.currentFolder = data.currentFolder;
                    state.folderHistory = data.folderHistory || [];
                    if (data.currentFolder === 'shared') {
                        $('.cdep-breadcrumb-sub').addClass('visible');
                    } else if (data.folderName) {
                        $('.cdep-current-folder').text(data.folderName);
                        $('.cdep-breadcrumb-sub').addClass('visible');
                    }
                    return true;
                }
            }
        } catch (e) {}
        return false;
    }

    function clearFolderState() {
        try {
            localStorage.removeItem('cdep_folder');
        } catch (e) {}
    }

    function loadFiles(folderId, pageToken) {
        state.currentFolder = folderId;
        $('#cdep-file-list').html('<p class="cdep-loading">Cargando archivos...</p>');

        ajax('cdep_drive_list', {
            folder_id: folderId,
            page_token: pageToken || '',
        }, function (data) {
            var html = '';
            // Filter: only folders + spreadsheet files
            var filtered = [];
            $.each(data.files, function (i, file) {
                var isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                var isSpreadsheet = file.mimeType === 'application/vnd.google-apps.spreadsheet'
                    || file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    || file.mimeType === 'application/vnd.ms-excel'
                    || file.name.match(/\.(xlsx|xls|csv)$/i);
                if (isFolder || isSpreadsheet) {
                    file._isFolder = isFolder;
                    file._isSpreadsheet = isSpreadsheet;
                    filtered.push(file);
                }
            });
            // Sort: folders first, then by name
            filtered.sort(function (a, b) {
                if (a._isFolder && !b._isFolder) return -1;
                if (!a._isFolder && b._isFolder) return 1;
                return a.name.localeCompare(b.name);
            });
            if (filtered.length === 0) {
                html = '<p class="cdep-empty">Esta carpeta está vacía</p>';
            } else {
                html = '<table class="wp-list-table widefat fixed striped">';
                html += '<thead><tr><th>Nombre</th><th>Tipo</th><th>Tamaño</th><th>Acción</th></tr></thead><tbody>';
                $.each(filtered, function (i, file) {
                    var icon = file._isFolder ? '📁' : '📊';
                    var size = file.size ? formatSize(parseInt(file.size)) : '-';
                    var typeLabel = file._isFolder ? 'Carpeta' : (file.mimeType === 'application/vnd.google-apps.spreadsheet' ? 'Google Sheets' : 'Excel');

                    html += '<tr class="' + (file._isFolder ? 'cdep-folder-row' : '') + '" data-folder="' + (file._isFolder ? file.id : '') + '">';
                    html += '<td class="cdep-folder-name">' + icon + ' ' + escHtml(file.name) + '</td>';
                    html += '<td>' + typeLabel + '</td>';
                    html += '<td>' + size + '</td>';
                    html += '<td>';
                    if (file._isFolder) {
                        html += '<a href="#" class="button button-small cdep-folder-link" data-folder="' + file.id + '">Abrir</a>';
                    } else {
                        html += '<a href="#" class="button button-primary button-small cdep-select-file" data-fileid="' + file.id + '" data-filename="' + escHtml(file.name) + '" data-mimetype="' + file.mimeType + '">Seleccionar</a>';
                    }
                    html += '</td></tr>';
                });
                html += '</tbody></table>';
            }
            $('#cdep-file-list').html(html);
            saveFolderState();
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
        openFolder(folderId, $(this).closest('tr').find('td:first').text().trim());
    });

    $(document).on('click', '.cdep-folder-row td.cdep-folder-name', function (e) {
        var folderId = $(this).closest('tr').data('folder');
        if (folderId) {
            openFolder(folderId, $(this).text().trim());
        }
    });

    function openFolder(folderId, folderName) {
        if (folderId === 'root' || folderId === 'shared') {
            state.folderHistory = [];
            $('.cdep-current-folder').text('');
            $('.cdep-breadcrumb-sub').removeClass('visible');
            if (folderId === 'shared') {
                $('.cdep-breadcrumb-sub').addClass('visible');
            }
            if (folderId === 'root') {
                clearFolderState();
            }
        } else {
            state.folderHistory.push(state.currentFolder);
            $('.cdep-current-folder').text(folderName);
            $('.cdep-breadcrumb-sub').addClass('visible');
        }
        loadFiles(folderId);
        $('#cdep-selected-file-info').hide();
    }

    $(document).on('click', '#cdep-refresh-cache', function (e) {
        e.preventDefault();
        var btn = $(this);
        btn.text('Actualizando...').prop('disabled', true);

        ajax('cdep_refresh_cache', {}, function (data) {
            state.headers = data.headers;
            state.totalRows = data.total_rows;
            window.cdepParsedData = data;

            $('#cdep-selected-file-rows').text(data.total_rows);
            $('#cdep-file-list-message').html(
                '<div class="notice notice-success inline"><p>Cache actualizado: '
                + data.total_rows + ' filas</p></div>'
            );
            btn.text('Actualizar').prop('disabled', false);
        }, function (msg) {
            $('#cdep-file-list-message').html(
                '<div class="notice notice-error inline"><p>' + msg + '</p></div>'
            );
            btn.text('Actualizar').prop('disabled', false);
        });
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
            mime_type: $(this).data('mimetype'),
        }, function (data) {
            state.headers = data.headers;
            state.totalRows = data.total_rows;
            state.selectedFileId = fileId;

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
    if ($('#cdep-file-list').length && $('#browse').is(':visible')) {
        if (!restoreFolderState()) {
            loadFiles('root');
        } else {
            loadFiles(state.currentFolder);
        }
    }

    // === MAPPING TAB ===

    function loadMapping() {
        if (window.cdepParsedData) {
            renderMapping(window.cdepParsedData);
            return;
        }

        ajax('cdep_get_cached_data', {}, function (data) {
            window.cdepParsedData = data;
            renderMapping(data);
        }, function (msg) {
            $('#cdep-mapping-container').html(
                '<p class="cdep-notice">Los datos del archivo no están disponibles. '
                + 'Ve a la pestaña <a href="#tag-browse">Explorar</a> '
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
        var selects = ['#mapping-sku', '#mapping-price', '#mapping-sale-price', '#mapping-quantity'];
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
        if (data.detected.sale_price !== null) {
            $('#mapping-sale-price').val(data.detected.sale_price);
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
            sale_price: $('#mapping-sale-price').val(),
            quantity: $('#mapping-quantity').val(),
        };

        if (!mapping.sku) {
            showMessage('#cdep-preview-result', 'Debes seleccionar la columna SKU', 'error');
            return;
        }

        if (!mapping.price && !mapping.sale_price && !mapping.quantity) {
            showMessage('#cdep-preview-result', 'Debes seleccionar al menos Precio, Precio de Oferta o Cantidad', 'error');
            return;
        }

        state.mapping = mapping;

        $(this).prop('disabled', true).text('Procesando...');

        ajax('cdep_update_preview', {
            mapping: mapping,
        }, function (data) {
            var html = '<div class="cdep-preview-summary">';
            html += '<p><strong>Total filas:</strong> ' + data.total + ' | ';
            html += '<strong>Productos encontrados:</strong> ' + data.found + ' | ';
            html += '<strong>No encontrados:</strong> ' + data.not_found_count + ' | ';
            html += '<strong>Sin SKU:</strong> ' + data.skipped + '</p>';
            html += '</div>';

            // Product table
            if (data.products && data.products.length > 0) {
                html += '<h3>Productos a actualizar</h3>';
                html += '<div class="cdep-table-scroll"><table class="wp-list-table widefat fixed striped" id="cdep-products-table">';
                html += '<thead><tr>';
                html += '<th>Imagen</th><th>SKU</th><th>Nombre</th><th>Categorías</th><th>Inventario</th>';
                html += '<th>Precio Actual</th><th>Nuevo Precio</th>';
                html += '<th>Precio Oferta Actual</th><th>Nuevo Precio Oferta</th>';
                html += '<th>Stock Actual</th><th>Nuevo Stock</th>';
                html += '<th>Estado</th>';
                html += '</tr></thead><tbody>';
                $.each(data.products, function (i, p) {
                    html += '<tr id="cdep-product-row-' + i + '">';
                    html += '<td>' + p.image + '</td>';
                    html += '<td><strong>' + escHtml(p.sku) + '</strong></td>';
                    html += '<td>' + escHtml(p.name) + '</td>';
                    html += '<td>' + escHtml(p.categories) + '</td>';
                    html += '<td>' + escHtml(p.stock_status) + '</td>';
                    html += '<td>' + escHtml(p.current_price) + '</td>';
                    html += '<td><strong>' + (p.new_price ? escHtml(p.new_price) : '— No actualizar') + '</strong></td>';
                    html += '<td>' + escHtml(p.current_sale_price) + '</td>';
                    html += '<td><strong>' + (p.new_sale_price ? escHtml(p.new_sale_price) : '— No actualizar') + '</strong></td>';
                    html += '<td>' + (p.current_stock !== null && p.current_stock !== '' ? p.current_stock : '-') + '</td>';
                    html += '<td><strong>' + (p.new_stock !== '' ? escHtml(p.new_stock) : '— No actualizar') + '</strong></td>';
                    html += '<td class="cdep-estado" data-product-idx="' + i + '"><span class="cdep-badge cdep-badge-pending">Pendiente</span></td>';
                    html += '</tr>';
                });
                html += '</tbody></table></div>';
            }

            // Not found SKUs
            if (data.not_found && data.not_found.length > 0) {
                html += '<h3>SKUs no encontrados en WooCommerce (' + data.not_found.length + ')</h3>';
                html += '<div class="cdep-table-scroll"><table class="wp-list-table widefat fixed striped">';
                html += '<thead><tr><th>Fila</th><th>SKU</th></tr></thead><tbody>';
                $.each(data.not_found, function (i, nf) {
                    html += '<tr><td>' + nf.row + '</td><td>' + escHtml(nf.sku) + '</td></tr>';
                });
                html += '</tbody></table></div>';
            }

            html += '<p>Archivo: <strong>' + escHtml(data.file_name) + '</strong></p>';

            // Update button and progress bar
            html += '<hr>';
            html += '<p><button id="cdep-start-update" class="button button-primary" data-mapping=\'' + JSON.stringify(mapping) + '\'>Iniciar Actualización Masiva</button></p>';
            html += '<div id="cdep-update-progress" style="display:none">';
            html += '<div class="cdep-progress-bar"><div class="cdep-progress-fill" style="width:0%"></div></div>';
            html += '<p class="cdep-progress-text">0 / ' + data.products.length + ' productos actualizados</p>';
            html += '</div>';
            html += '<div id="cdep-update-result"></div>';

            state.products = data.products;

            $('#cdep-preview-result').html(html);
            $('#cdep-preview-update').prop('disabled', false).text('Vista Previa de Actualización');
        }, function (msg) {
            showMessage('#cdep-preview-result', msg, 'error');
            $('#cdep-preview-update').prop('disabled', false).text('Vista Previa de Actualización');
        });
    });

    $(document).on('click', '#cdep-refresh-file', function (e) {
        e.preventDefault();
        var btn = $(this);
        btn.prop('disabled', true).text('Actualizando...');

        ajax('cdep_refresh_cache', {}, function (data) {
            window.cdepParsedData = data;
            $('#cdep-preview-result').html('');
            loadMapping();
            showMessage('#cdep-mapping-container', 'Archivo actualizado correctamente', 'ok');
            btn.prop('disabled', false).text('Actualizar Archivo');
        }, function (msg) {
            showMessage('#cdep-mapping-container', msg, 'error');
            btn.prop('disabled', false).text('Actualizar Archivo');
        });
    });

    // Load mapping data when tab is active
    if ($('#cdep-mapping-container').length && $('#mapping').is(':visible')) {
        loadMapping();
    }

    // === UPDATE EXECUTION (dentro de Mapping) ===

    $(document).on('click', '#cdep-start-update', function () {
        var btn = $(this);
        var mapping = btn.data('mapping');

        if (!mapping) {
            showMessage('#cdep-update-result', 'Primero haz una vista previa', 'error');
            return;
        }

        btn.prop('disabled', true).text('Actualizando...');
        $('#cdep-update-progress').show();
        $('#cdep-update-result').html('');

        var totalRows = $('#cdep-products-table tbody tr').length;
        var totalUpdated = 0;
        var allErrors = [];
        var offset = 0;
        var limit = 25;

        function updateEstado(sku, status, errorMsg) {
            var found = false;
            if (state.products) {
                $.each(state.products, function (idx, p) {
                    if (p.sku === sku) {
                        var estadoCell = $('.cdep-estado[data-product-idx="' + idx + '"]');
                        if (status === 'ok') {
                            estadoCell.html('<span class="cdep-badge cdep-badge-ok">Actualizado</span>');
                        } else {
                            estadoCell.html('<span class="cdep-badge cdep-badge-error">Error: ' + escHtml(errorMsg) + '</span>');
                        }
                        found = true;
                        return false;
                    }
                });
            }
        }

        function processBatch() {
            ajax('cdep_update_execute', {
                mapping: mapping,
                offset: offset,
                limit: limit,
            }, function (data) {
                totalUpdated += data.updated;

                if (data.processed_skus) {
                    $.each(data.processed_skus, function (i, sku) {
                        updateEstado(sku, 'ok');
                    });
                }

                if (data.errors) {
                    $.each(data.errors, function (i, err) {
                        updateEstado(err.sku, 'error', err.error);
                    });
                    allErrors = allErrors.concat(data.errors);
                }

                var doneCount = $('#cdep-products-table tbody tr .cdep-badge-ok, #cdep-products-table tbody tr .cdep-badge-error').length;
                var progress = Math.min(100, Math.round(doneCount / totalRows * 100));
                $('.cdep-progress-fill').css('width', progress + '%');
                $('.cdep-progress-text').text(doneCount + ' / ' + totalRows + ' productos procesados');

                if (data.completed) {
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
                        html += '<div class="cdep-table-scroll"><table class="wp-list-table widefat fixed striped">';
                        html += '<thead><tr><th>SKU</th><th>Error</th></tr></thead><tbody>';
                        $.each(allErrors.slice(0, 50), function (i, err) {
                            html += '<tr><td>' + escHtml(err.sku) + '</td><td>' + escHtml(err.error) + '</td></tr>';
                        });
                        if (allErrors.length > 50) {
                            html += '<tr><td colspan="2">... y ' + (allErrors.length - 50) + ' más</td></tr>';
                        }
                        html += '</tbody></table></div>';
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
    $(document).on('click', '.nav-tab', function () {
        var tab = $(this).data('tab');
        if (tab === 'mapping') {
            loadMapping();
        } else if (tab === 'browse') {
            if (!restoreFolderState()) {
                loadFiles('root');
            } else {
                loadFiles(state.currentFolder);
            }
        }
    });

    var currentQueryString = window.location.search;
    if (currentQueryString.indexOf('code=') !== -1 || currentQueryString.indexOf('tab=connect') !== -1) {
    }
});
