<?php
defined('ABSPATH') || exit;

class CDEP_DRIVE {
    const OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
    const TOKEN_URL = 'https://oauth2.googleapis.com/token';
    const DRIVE_API = 'https://www.googleapis.com/drive/v3';
    const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

    public static function isConnected() {
        $tokens = get_option(CDEP_TOKENS, []);
        return !empty($tokens['access_token']) && !empty($tokens['refresh_token']);
    }

    public static function saveConfig($clientId, $clientSecret, $redirectUri) {
        $config = get_option(CDEP_CONFIG, []);
        $config['client_id'] = $clientId;
        $config['client_secret'] = $clientSecret;
        $config['redirect_uri'] = $redirectUri;
        update_option(CDEP_CONFIG, $config);
    }

    public static function getConfig() {
        return get_option(CDEP_CONFIG, []);
    }

    public static function getAuthUrl() {
        $config = self::getConfig();
        $clientId = $config['client_id'] ?? '';
        $redirectUri = $config['redirect_uri'] ?? '';

        if (empty($clientId) || empty($redirectUri)) {
            return false;
        }

        $params = [
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'response_type' => 'code',
            'scope' => self::SCOPE,
            'access_type' => 'offline',
            'prompt' => 'consent',
        ];

        return self::OAUTH_URL . '?' . http_build_query($params);
    }

    public static function connect($code) {
        $config = self::getConfig();
        $clientId = $config['client_id'] ?? '';
        $clientSecret = $config['client_secret'] ?? '';
        $redirectUri = $config['redirect_uri'] ?? '';

        if (empty($clientId) || empty($clientSecret) || empty($redirectUri)) {
            return new WP_Error('missing_config', 'Configuration incomplete');
        }

        $response = wp_remote_post(self::TOKEN_URL, [
            'body' => [
                'code' => $code,
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'redirect_uri' => $redirectUri,
                'grant_type' => 'authorization_code',
            ],
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        if (!empty($body['error'])) {
            return new WP_Error('oauth_error', $body['error_description'] ?? $body['error']);
        }

        $tokens = [
            'access_token' => $body['access_token'],
            'refresh_token' => $body['refresh_token'] ?? '',
            'expires_in' => $body['expires_in'] ?? 3600,
            'created' => time(),
        ];

        update_option(CDEP_TOKENS, $tokens);
        return true;
    }

    public static function disconnect() {
        delete_option(CDEP_TOKENS);
        delete_option(CDEP_SELECTED);
    }

    public static function getAccessToken() {
        $tokens = get_option(CDEP_TOKENS, []);

        if (empty($tokens['access_token'])) {
            return false;
        }

        $expiresAt = ($tokens['created'] ?? 0) + ($tokens['expires_in'] ?? 3600);

        if ($expiresAt > time() + 60) {
            return $tokens['access_token'];
        }

        if (empty($tokens['refresh_token'])) {
            return false;
        }

        return self::refreshAccessToken($tokens);
    }

    private static function refreshAccessToken(&$tokens) {
        $config = self::getConfig();
        $clientId = $config['client_id'] ?? '';
        $clientSecret = $config['client_secret'] ?? '';

        if (empty($clientId) || empty($clientSecret)) {
            return false;
        }

        $response = wp_remote_post(self::TOKEN_URL, [
            'body' => [
                'refresh_token' => $tokens['refresh_token'],
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'grant_type' => 'refresh_token',
            ],
        ]);

        if (is_wp_error($response)) {
            return false;
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        if (!empty($body['error'])) {
            return false;
        }

        $tokens['access_token'] = $body['access_token'];
        $tokens['created'] = time();

        if (!empty($body['expires_in'])) {
            $tokens['expires_in'] = $body['expires_in'];
        }

        update_option(CDEP_TOKENS, $tokens);
        return $tokens['access_token'];
    }

    public static function listFiles($folderId = 'root', $pageToken = '') {
        $accessToken = self::getAccessToken();
        if (!$accessToken) {
            return new WP_Error('not_connected', 'Not connected to Google Drive');
        }

        $query = "'{$folderId}' in parents and trashed = false";
        $url = self::DRIVE_API . '/files?q=' . urlencode($query)
            . '&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)'
            . '&orderBy=folder,name'
            . '&pageSize=100';

        if (!empty($pageToken)) {
            $url .= '&pageToken=' . urlencode($pageToken);
        }

        $response = wp_remote_get($url, [
            'headers' => [
                'Authorization' => 'Bearer ' . $accessToken,
            ],
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        if (!empty($body['error'])) {
            return new WP_Error('drive_error', $body['error']['message'] ?? 'Unknown error');
        }

        return [
            'files' => $body['files'] ?? [],
            'nextPageToken' => $body['nextPageToken'] ?? '',
        ];
    }

    public static function downloadFile($fileId) {
        $accessToken = self::getAccessToken();
        if (!$accessToken) {
            return new WP_Error('not_connected', 'Not connected to Google Drive');
        }

        $url = self::DRIVE_API . '/files/' . urlencode($fileId) . '?alt=media';

        $response = wp_remote_get($url, [
            'headers' => [
                'Authorization' => 'Bearer ' . $accessToken,
            ],
            'timeout' => 120,
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code($response);
        if ($code !== 200) {
            return new WP_Error('download_error', 'Failed to download file. HTTP ' . $code);
        }

        return wp_remote_retrieve_body($response);
    }

    public static function saveSelectedFile($fileId, $fileName) {
        $selected = [
            'file_id' => $fileId,
            'file_name' => $fileName,
            'selected_at' => time(),
        ];
        update_option(CDEP_SELECTED, $selected);
        return $selected;
    }

    public static function getSelectedFile() {
        return get_option(CDEP_SELECTED, []);
    }
}

add_action('wp_ajax_cdep_save_config', function () {
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Unauthorized');
    }
    check_ajax_referer('cdep_nonce', 'nonce');

    CDEP_DRIVE::saveConfig(
        sanitize_text_field($_POST['client_id']),
        sanitize_text_field($_POST['client_secret']),
        sanitize_text_field($_POST['redirect_uri'])
    );

    wp_send_json_success(['message' => 'Configuración guardada']);
});

add_action('wp_ajax_cdep_get_auth_url', function () {
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Unauthorized');
    }
    check_ajax_referer('cdep_nonce', 'nonce');

    $url = CDEP_DRIVE::getAuthUrl();
    if (!$url) {
        wp_send_json_error('Complete la configuración primero');
    }

    wp_send_json_success(['url' => $url]);
});

add_action('wp_ajax_cdep_drive_connect', function () {
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Unauthorized');
    }
    check_ajax_referer('cdep_nonce', 'nonce');

    $code = sanitize_text_field($_POST['code'] ?? '');
    if (empty($code)) {
        wp_send_json_error('Código de autorización vacío');
    }

    $result = CDEP_DRIVE::connect($code);
    if (is_wp_error($result)) {
        wp_send_json_error($result->get_error_message());
    }

    wp_send_json_success(['message' => 'Conectado a Google Drive exitosamente']);
});

add_action('wp_ajax_cdep_drive_disconnect', function () {
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Unauthorized');
    }
    check_ajax_referer('cdep_nonce', 'nonce');

    CDEP_DRIVE::disconnect();
    wp_send_json_success(['message' => 'Desconectado de Google Drive']);
});

add_action('wp_ajax_cdep_drive_list', function () {
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Unauthorized');
    }
    check_ajax_referer('cdep_nonce', 'nonce');

    $folderId = sanitize_text_field($_POST['folder_id'] ?? 'root');
    $pageToken = sanitize_text_field($_POST['page_token'] ?? '');

    $result = CDEP_DRIVE::listFiles($folderId, $pageToken);
    if (is_wp_error($result)) {
        wp_send_json_error($result->get_error_message());
    }

    wp_send_json_success($result);
});

add_action('wp_ajax_cdep_drive_select_file', function () {
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Unauthorized');
    }
    check_ajax_referer('cdep_nonce', 'nonce');

    $fileId = sanitize_text_field($_POST['file_id'] ?? '');
    $fileName = sanitize_text_field($_POST['file_name'] ?? '');

    if (empty($fileId)) {
        wp_send_json_error('Seleccione un archivo');
    }

    $content = CDEP_DRIVE::downloadFile($fileId);
    if (is_wp_error($content)) {
        wp_send_json_error($content->get_error_message());
    }

    $uploadDir = wp_upload_dir();
    $tempFile = $uploadDir['path'] . '/' . sanitize_file_name($fileName);

    file_put_contents($tempFile, $content);

    CDEP_DRIVE::saveSelectedFile($fileId, $fileName);

    try {
        $result = CDEP_EXCEL::parse($tempFile);
        wp_send_json_success([
            'headers' => $result['headers'],
            'sample' => $result['sample'],
            'detected' => $result['detected'],
            'total_rows' => $result['total_rows'],
            'temp_file' => $tempFile,
        ]);
    } catch (Exception $e) {
        @unlink($tempFile);
        wp_send_json_error('Error al parsear Excel: ' . $e->getMessage());
    }
});
