<?php
/**
 * Fallback template. The site is a single front page (front-page.php); any other
 * request is sent there.
 *
 * @package SGTG
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! is_front_page() ) {
	wp_safe_redirect( home_url( '/' ) );
	exit;
}

require get_theme_file_path( 'front-page.php' );
