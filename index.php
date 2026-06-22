<?php
/*
Plugin Name: Connexion Drive Excel Product
Plugin URI: https://github.com/franciscoblancojn/connexion-drive-exel-product
Description: Connect to Google Drive, select Excel files, map columns (SKU, price, quantity), and mass update WooCommerce products.
Version: 1.0.0
Author: franciscoblancojn
Author URI: https://franciscoblanco.vercel.app/
License: GPL2+
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Text Domain: connexion-drive-exel-product
*/

defined('ABSPATH') || exit;

define("CDEP_KEY", 'CDEP');
define("CDEP_MODE_DEV", in_array($_SERVER['HTTP_HOST'] ?? '', ['wordpress.local', 'localhost', '127.0.0.1',]));
define("CDEP_DIR", plugin_dir_path(__FILE__));
define("CDEP_URL", plugin_dir_url(__FILE__));
define("CDEP_BASENAME", plugin_basename(__FILE__));
define("CDEP_CONFIG", 'CDEP_CONFIG');
define("CDEP_TOKENS", 'CDEP_TOKENS');
define("CDEP_SELECTED", 'CDEP_SELECTED');

if (file_exists(CDEP_DIR . 'libs/autoload.php')) {
    require_once CDEP_DIR . 'libs/autoload.php';
}

require_once CDEP_DIR . 'src/_.php';
