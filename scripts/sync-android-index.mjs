// Gera android/app/src/main/assets/index.html a partir do index.html da raiz.
// Diferenças mantidas: viewport sem viewport-fit, sem bloco PWA, sem Google Fonts,
// e o bundle clássico (config.js + bundle.js) no lugar do módulo ES.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'index.html');
const dst = path.join(root, 'android', 'app', 'src', 'main', 'assets', 'index.html');

let html = fs.readFileSync(src, 'utf8');
const before = html;

html = html.replace(
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">',
);
// Bloco PWA (manifest, metas, ícone e config.js) — removido no APK.
html = html.replace(/\s*<!-- PWA -->[\s\S]*?<script src="config\.js"><\/script>\n/, '\n');
// Google Fonts — offline no APK.
html = html.replace(
    /\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*<link href="https:\/\/fonts\.googleapis\.com[^"]*" rel="stylesheet">/,
    '\n    <!-- Google Fonts removed for offline Android use -->',
);
// Script: módulo ES → bundle clássico.
html = html.replace(
    /<script type="module" src="src\/js\/main\.js[^"]*"><\/script>/,
    '<script src="config.js"></script>\n    <script src="src/js/bundle.js"></script>',
);

const checks = [
    [!html.includes('viewport-fit=cover'), 'viewport'],
    [!html.includes('manifest.webmanifest'), 'PWA'],
    [!html.includes('fonts.googleapis.com'), 'fonts'],
    [html.includes('src/js/bundle.js'), 'bundle'],
];
const failed = checks.filter(([ok]) => !ok).map(([, n]) => n);
if (failed.length) {
    console.error('sync-android-index: substituições falharam:', failed.join(', '));
    process.exit(1);
}
if (html === before) {
    console.error('sync-android-index: nada mudou (index.html da raiz já parece o do Android?)');
    process.exit(1);
}
fs.writeFileSync(dst, html);
console.log('android index.html sincronizado a partir do index.html da raiz');
