<?php
/**
 * SG Technology Group theme functions.
 *
 * @package SGTG
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SGTG_VERSION', '1.0.0' );

/**
 * Where callback requests go. Change it under Settings > General > "SGTG callback email".
 * Falls back to the site admin email until it is set.
 */
function sgtg_lead_email() {
	$email = get_option( 'sgtg_lead_email' );
	return is_email( $email ) ? $email : get_option( 'admin_email' );
}

/**
 * URL of a file inside the theme.
 */
function sgtg_asset( $path ) {
	return esc_url( get_theme_file_uri( $path ) );
}

/* ------------------------------------------------------------------
 * Theme setup
 * ------------------------------------------------------------------ */
function sgtg_setup() {
	add_theme_support( 'title-tag' );
	add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script' ) );
}
add_action( 'after_setup_theme', 'sgtg_setup' );

function sgtg_document_title( $title ) {
	if ( is_front_page() ) {
		$title['title']   = 'SG Technology Group';
		$title['tagline'] = 'IT Services for Businesses in NY, CT & NJ';
		unset( $title['site'] );
	}
	return $title;
}
add_filter( 'document_title_parts', 'sgtg_document_title' );

function sgtg_title_separator() {
	return '|';
}
add_filter( 'document_title_separator', 'sgtg_title_separator' );

/* ------------------------------------------------------------------
 * Styles and scripts
 * ------------------------------------------------------------------ */
function sgtg_enqueue() {
	wp_enqueue_style(
		'sgtg-fonts',
		'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Kumbh+Sans:wght@400;500;600;700&family=Saira:wdth,wght@100..125,500..800&display=swap',
		array(),
		null
	);
	wp_enqueue_style( 'sgtg-style', get_stylesheet_uri(), array( 'sgtg-fonts' ), SGTG_VERSION );
	wp_enqueue_script( 'sgtg-main', get_theme_file_uri( 'assets/js/main.js' ), array(), SGTG_VERSION, array( 'in_footer' => true, 'strategy' => 'defer' ) );
}
add_action( 'wp_enqueue_scripts', 'sgtg_enqueue' );

function sgtg_resource_hints( $urls, $relation ) {
	if ( 'preconnect' === $relation ) {
		$urls[] = 'https://fonts.googleapis.com';
		$urls[] = array(
			'href'        => 'https://fonts.gstatic.com',
			'crossorigin' => 'anonymous',
		);
	}
	return $urls;
}
add_filter( 'wp_resource_hints', 'sgtg_resource_hints', 10, 2 );

/* ------------------------------------------------------------------
 * Head: favicons, meta, structured data
 * ------------------------------------------------------------------ */
function sgtg_head_meta() {
	// Theme favicons are used until a Site Icon is set in the Customizer.
	if ( ! has_site_icon() ) {
		?>
		<link rel="icon" href="<?php echo sgtg_asset( 'assets/images/favicon.ico' ); ?>" sizes="any">
		<link rel="icon" type="image/png" sizes="32x32" href="<?php echo sgtg_asset( 'assets/images/favicon-32x32.png' ); ?>">
		<link rel="icon" type="image/png" sizes="16x16" href="<?php echo sgtg_asset( 'assets/images/favicon-16x16.png' ); ?>">
		<link rel="apple-touch-icon" sizes="180x180" href="<?php echo sgtg_asset( 'assets/images/apple-touch-icon.png' ); ?>">
		<?php
	}
	?>
	<meta name="theme-color" content="#060a24">
	<?php
	if ( ! is_front_page() ) {
		return;
	}
	?>
	<link rel="preload" as="image" type="image/webp" href="<?php echo sgtg_asset( 'assets/images/hero-poster.webp' ); ?>" media="(min-width: 768px)">
	<link rel="preload" as="image" type="image/webp" href="<?php echo sgtg_asset( 'assets/images/hero-poster-sm.webp' ); ?>" media="(max-width: 767px)">
	<meta name="description" content="SG Technology Group plans, builds, secures and supports business IT across New York, Connecticut and New Jersey. Repairs come with a 100% money-back guarantee. Call 347.674.8324.">
	<meta property="og:site_name" content="SG Technology Group">
	<meta property="og:title" content="SG Technology Group | IT services for businesses">
	<meta property="og:description" content="IT strategy, infrastructure, cloud, cybersecurity, project management, process improvement, training and support for businesses in NY, CT and NJ.">
	<meta property="og:type" content="website">
	<meta property="og:image" content="<?php echo sgtg_asset( 'assets/images/og-image.jpg' ); ?>">
	<meta name="twitter:card" content="summary_large_image">
	<meta name="twitter:site" content="@SGTechGroup">
	<script type="application/ld+json">
	<?php
	echo wp_json_encode(
		array(
			'@context'    => 'https://schema.org',
			'@type'       => 'ProfessionalService',
			'name'        => 'SG Technology Group',
			'description' => 'IT consulting, infrastructure, cloud, cybersecurity, training and support for businesses.',
			'telephone'   => '+1-347-674-8324',
			'url'         => home_url( '/' ),
			'areaServed'  => array( 'New York', 'Connecticut', 'New Jersey' ),
			'founder'     => array(
				'@type'    => 'Person',
				'name'     => 'Solomon Greene',
				'jobTitle' => 'CEO',
			),
			'sameAs'      => array(
				'https://www.facebook.com/SGTechGroup',
				'https://twitter.com/SGTechGroup',
			),
		),
		JSON_UNESCAPED_SLASHES
	);
	?>
	</script>
	<?php
}
add_action( 'wp_head', 'sgtg_head_meta', 2 );

/* ------------------------------------------------------------------
 * Settings: callback email field under Settings > General
 * ------------------------------------------------------------------ */
function sgtg_register_settings() {
	register_setting(
		'general',
		'sgtg_lead_email',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_email',
			'default'           => '',
		)
	);
	add_settings_field(
		'sgtg_lead_email',
		'SGTG callback email',
		function () {
			printf(
				'<input type="email" name="sgtg_lead_email" id="sgtg_lead_email" class="regular-text" value="%s"><p class="description">Callback requests from the front page go to this address. Leave blank to use the site admin email.</p>',
				esc_attr( get_option( 'sgtg_lead_email' ) )
			);
		},
		'general'
	);
}
add_action( 'admin_init', 'sgtg_register_settings' );

/* ------------------------------------------------------------------
 * Form handler (admin-post.php)
 * ------------------------------------------------------------------ */
function sgtg_redirect_back( $status ) {
	$url = wp_get_referer() ? wp_get_referer() : home_url( '/' );
	$url = remove_query_arg( 'sgtg', $url );
	$url = preg_replace( '/#.*$/', '', $url );
	wp_safe_redirect( add_query_arg( 'sgtg', $status, $url ) . '#contact' );
	exit;
}

function sgtg_handle_contact() {
	if ( ! isset( $_POST['sgtg_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['sgtg_nonce'] ) ), 'sgtg_contact' ) ) {
		sgtg_redirect_back( 'error' );
	}
	// Honeypot: real visitors never see this field.
	if ( ! empty( $_POST['website'] ) ) {
		sgtg_redirect_back( 'sent' );
	}

	$field = function ( $key ) {
		return isset( $_POST[ $key ] ) ? sanitize_text_field( wp_unslash( $_POST[ $key ] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- nonce checked above.
	};
	$name    = $field( 'name' );
	$email   = isset( $_POST['email'] ) ? sanitize_email( wp_unslash( $_POST['email'] ) ) : '';
	$phone   = $field( 'phone' );
	$service = $field( 'service' );
	$message = isset( $_POST['message'] ) ? sanitize_textarea_field( wp_unslash( $_POST['message'] ) ) : '';

	if ( strlen( $name ) < 2 || ! is_email( $email ) || strlen( $message ) < 10 ) {
		sgtg_redirect_back( 'invalid' );
	}

	$body = implode(
		"\n",
		array(
			'Name: ' . $name,
			'Email: ' . $email,
			'Phone: ' . ( $phone ? $phone : 'Not given' ),
			'Service: ' . ( $service ? $service : 'Not sure yet' ),
			'',
			$message,
		)
	);

	$sent = wp_mail(
		sgtg_lead_email(),
		sprintf( 'Callback request: %s, %s', $service ? $service : 'General', $name ),
		$body,
		array( 'Reply-To: ' . $name . ' <' . $email . '>' )
	);

	sgtg_redirect_back( $sent ? 'sent' : 'error' );
}
add_action( 'admin_post_nopriv_sgtg_contact', 'sgtg_handle_contact' );
add_action( 'admin_post_sgtg_contact', 'sgtg_handle_contact' );

/**
 * Status message for the form after the redirect.
 *
 * @return array{0:string,1:string} [css class, message]
 */
function sgtg_form_status() {
	$status = isset( $_GET['sgtg'] ) ? sanitize_key( wp_unslash( $_GET['sgtg'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- display only.
	switch ( $status ) {
		case 'sent':
			return array( 'is-ok', 'Thanks. Your request is with us and we will call you back.' );
		case 'invalid':
			return array( '', 'Some details were missing. Enter your name, email and a line about what you need, then send again.' );
		case 'error':
			return array( '', 'That did not go through. Please call us at 347.674.8324.' );
	}
	return array( '', '' );
}
