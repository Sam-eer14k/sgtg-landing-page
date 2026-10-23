# Builds index.html (single file, CSS and JS inline) at the repo root and the
# WordPress theme from the sources in src/. Run:
#
#   powershell -ExecutionPolicy Bypass -File build.ps1
#
# Edit src/_head.html, src/_body.html, src/css/theme.css or src/js/main.js.
# Never edit index.html or the theme's style.css, front-page.php or main.js:
# they are generated and will be overwritten.
#
# Hero video: put "SGTG Hero Background.mp4" on the Desktop (or any video at
# assets/video/source.mp4) and run this script. It encodes web versions into
# assets/video/ and adds the video to the hero. Without a video the hero shows
# its blueprint background.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$src = Join-Path $root 'src'
$utf8 = New-Object System.Text.UTF8Encoding($false)

# CONFIRM: the inbox that receives callback requests on the static site.
# sgtechgroup.com publishes no email address. While this is empty the static
# form shows the phone number instead of opening an email app. The WordPress
# theme sends real email either way (see functions.php).
$LeadEmail = ''

function Read-Src($name) { [IO.File]::ReadAllText((Join-Path $src $name), $utf8) }
function Write-Out($path, $text) {
  $dir = Split-Path $path
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
  [IO.File]::WriteAllText($path, $text.Replace("`r`n", "`n"), $utf8)
}
function Invoke-Ffmpeg([string]$argLine) {
  $p = Start-Process ffmpeg -ArgumentList "-hide_banner -v error -y $argLine" -NoNewWindow -Wait -PassThru
  if ($p.ExitCode -ne 0) { throw "ffmpeg failed: $argLine" }
}

# ---------------- hero video ----------------
$videoDir = Join-Path $root 'assets\video'
$videoOut = Join-Path $videoDir 'sgtg-hero.mp4'
$videoSrc = @((Join-Path $videoDir 'source.mp4'), (Join-Path ([Environment]::GetFolderPath('Desktop')) 'SGTG Hero Background.mp4')) |
  Where-Object { Test-Path $_ } | Select-Object -First 1
if ($videoSrc -and (-not (Test-Path $videoOut) -or (Get-Item $videoSrc).LastWriteTime -gt (Get-Item $videoOut).LastWriteTime)) {
  New-Item -ItemType Directory -Force $videoDir | Out-Null
  # One desktop MP4 (phones get the poster only). It sits under a dark overlay,
  # so CRF 30 at 1600px looks the same and keeps the file small.
  "Encoding hero video from $videoSrc (a few minutes)..."
  Invoke-Ffmpeg "-i `"$videoSrc`" -an -sn -vf `"scale='min(1600,iw)':-2,fps=30`" -c:v libx264 -preset slow -crf 30 -pix_fmt yuv420p -movflags +faststart `"$videoOut`""
  $img = Join-Path $root 'assets\images'
  Invoke-Ffmpeg "-ss 4 -i `"$videoSrc`" -frames:v 1 -vf `"scale=1920:-2`" -c:v libwebp -quality 72 `"$(Join-Path $img 'hero-poster.webp')`""
  Invoke-Ffmpeg "-ss 4 -i `"$videoSrc`" -frames:v 1 -vf `"scale=960:-2`" -c:v libwebp -quality 70 `"$(Join-Path $img 'hero-poster-sm.webp')`""
  $staged = Join-Path $videoDir 'source.mp4'
  if (Test-Path $staged) { Remove-Item $staged }
}
$hasVideo = Test-Path $videoOut
$videoTag = ''
if ($hasVideo) {
  # No src until main.js decides to load it (desktop, no reduced motion, no data saver).
  $videoTag = '<video class="hero__video" muted loop playsinline preload="none" data-src="{{A}}video/sgtg-hero.mp4"></video>'
}

$head = Read-Src '_head.html'
$body = Read-Src '_body.html'
$css  = Read-Src 'css\theme.css'
$js   = Read-Src 'js\main.js'
$body = $body.Replace('<!--HERO-VIDEO-->', $videoTag)

# Conservative minifiers for the copy inlined into index.html (src/ stays readable).
function Minify-Css($s) {
  $s = [regex]::Replace($s, '(?s)/\*.*?\*/', '')
  $s = [regex]::Replace($s, '\s+', ' ')
  $s = [regex]::Replace($s, '\s*([{};,>])\s*', '$1')
  $s = [regex]::Replace($s, '([^\s(]):\s+', '$1:')
  $s = $s.Replace(';}', '}')
  return $s.Trim()
}
# JS: drop block comments, whole-line // comments, indentation and blank lines.
# Line breaks are kept so automatic semicolon insertion can't change behaviour.
function Minify-Js($s) {
  $s = [regex]::Replace($s, '(?s)/\*.*?\*/', '')
  $lines = $s -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('//') }
  return ($lines -join "`n")
}
$cssMin = Minify-Css $css
$jsMin  = Minify-Js $js

# ---------------- static HTML ----------------
if ($LeadEmail) { $formAction = "mailto:$LeadEmail"; $formMode = 'mailto' } else { $formAction = '#contact'; $formMode = 'none' }
$htmlBody = $body.Replace('{{A}}', 'assets/').Replace('{{FORM_ACTION}}', $formAction).Replace('{{FORM_MODE}}', $formMode)
$htmlBody = [regex]::Replace($htmlBody, '<!--WP:[a-z-]+-->', '')
$htmlHead = $head + "<link rel=""preload"" as=""image"" type=""image/webp"" href=""assets/images/hero-poster.webp"" media=""(min-width: 768px)"">`n<link rel=""preload"" as=""image"" type=""image/webp"" href=""assets/images/hero-poster-sm.webp"" media=""(max-width: 767px)"">`n"
$html = "<!doctype html>`n<html lang=""en"">`n<head>`n$htmlHead<style>$cssMin</style>`n</head>`n<body>`n$htmlBody`n<script>`n$jsMin`n</script>`n</body>`n</html>`n"
Write-Out (Join-Path $root 'index.html') $html
"index.html  $([math]::Round($html.Length / 1KB)) KB  (hero video: $(if ($hasVideo) { 'yes' } else { 'not supplied yet' }); form: $formMode)"

# ---------------- WordPress theme ----------------
$theme = Join-Path $root 'wordpress-theme'

$styleHeader = @'
/*
Theme Name: SG Technology Group
Author: Zaphyre
Description: One-page landing theme for SG Technology Group, an IT services firm serving businesses in New York, Connecticut and New Jersey. Set a static front page under Settings > Reading.
Version: 1.0.0
Requires at least: 6.0
Requires PHP: 7.4
License: GNU General Public License v2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Text Domain: sgtg
*/

/* WordPress admin bar offset for the sticky header. */
body.admin-bar .site-head { top: 32px; }
@media screen and (max-width: 782px) { body.admin-bar .site-head { top: 46px; } }
@media screen and (max-width: 600px) { body.admin-bar .site-head { top: 0; } }

'@
Write-Out (Join-Path $theme 'style.css') ($styleHeader + $css)
Write-Out (Join-Path $theme 'assets\js\main.js') $js

$wp = $body.Replace('{{A}}', '<?php echo esc_url( $sgtg_a ); ?>')
$wp = $wp.Replace('action="{{FORM_ACTION}}"', 'action="<?php echo esc_url( admin_url( ''admin-post.php'' ) ); ?>"')
$wp = $wp.Replace('data-mode="{{FORM_MODE}}"', 'data-mode="wp"')
$wp = $wp.Replace('<!--WP:contact-fields-->', '<input type="hidden" name="action" value="sgtg_contact"><?php wp_nonce_field( ''sgtg_contact'', ''sgtg_nonce'' ); ?>')
$wp = $wp.Replace('<!--WP:contact-status-->', '<?php echo esc_html( $sgtg_status[1] ); ?>')
$wp = $wp.Replace('class="form__status" id="form-status"', 'class="form__status <?php echo esc_attr( $sgtg_status[0] ); ?>" id="form-status"')
if ($wp -match '<!--WP:') { throw 'Unreplaced WP marker in body' }
if ($wp -match '\{\{') { throw 'Unreplaced {{ }} placeholder in body' }

$frontPage = @'
<?php
/**
 * Front page. Generated by build.ps1 from src/_body.html: edit the source, not this file.
 *
 * @package SGTG
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$sgtg_a      = trailingslashit( get_theme_file_uri( 'assets' ) );
$sgtg_status = sgtg_form_status();
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

'@ + $wp + @'

<?php wp_footer(); ?>
</body>
</html>

'@
Write-Out (Join-Path $theme 'front-page.php') $frontPage

foreach ($sub in @('images', 'video')) {
  $from = Join-Path $root "assets\$sub"
  $dst = Join-Path $theme "assets\$sub"
  # Mirror the folder so files removed from assets/ also leave the theme.
  if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
  if (Test-Path $from) {
    New-Item -ItemType Directory -Force $dst | Out-Null
    Copy-Item (Join-Path $from '*') $dst -Force
  }
}
"wordpress-theme regenerated"
