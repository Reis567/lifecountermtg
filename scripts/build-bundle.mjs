// Gera o bundle.js do Android a partir dos módulos compilados em src/js.
//
// O WebView do Android carrega um único script clássico (sem ES modules), então
// concatenamos os módulos compilados removendo os `import`/`export`. Rode `tsc`
// antes (ou use `npm run build:android`, que faz os dois).

import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Ordem importa: dependências de execução em nível de módulo primeiro,
// main.js por último (registra o DOMContentLoaded que chama initUI).
const order = ['aiClient', 'api', 'profiles', 'sync', 'updater', 'notifications', 'dialogs', 'types', 'state', 'audio', 'fingerPicker', 'aiNarrator', 'victory', 'mechanics', 'cardScanner', 'voiceControl', 'ranking', 'androidPromo', 'ui', 'main'];

const chunks = [];
for (const name of order) {
    const file = resolve(root, 'src/js', `${name}.js`);
    let code = readFileSync(file, 'utf8');

    // Remove imports de módulo (todos em uma linha no output do tsc).
    code = code.replace(/^\s*import\s+[^\n]*?from\s*['"][^'"]+['"];\s*$/gm, '');
    // Remove o prefixo `export ` (mantém `const`/`function`).
    code = code.replace(/^(\s*)export\s+/gm, '$1');
    // Remove comentários de sourcemap.
    code = code.replace(/^\/\/# sourceMappingURL=.*$/gm, '');

    chunks.push(`// ===== ${name}.js =====\n${code.trim()}\n`);
}

const banner =
    '// AUTO-GERADO por scripts/build-bundle.mjs — NÃO edite à mão.\n' +
    '// Bundle clássico (sem ES modules) para o WebView do Android.\n';

const out = `${banner}\n${chunks.join('\n')}`;

// Trava de segurança: o bundle é UM escopo só, em sloppy mode (script clássico).
// Dois módulos declarando o mesmo `const`/`let`/`class` no topo viram SyntaxError
// e o app nem abre no WebView — melhor quebrar aqui do que com o APK na mão.
// `new Function` só compila (não executa) e usa o mesmo sloppy mode do WebView,
// então o que passa aqui passa lá.
try {
    new Function(out);
} catch (e) {
    console.error(`ERRO: bundle inválido — ${e.message}`);
    console.error('Provável causa: dois módulos declarando o mesmo identificador no topo.');
    process.exit(1);
}

const bundlePath = resolve(root, 'android/app/src/main/assets/src/js/bundle.js');
writeFileSync(bundlePath, out);
console.log(`bundle.js gerado (${out.length} bytes) -> ${bundlePath}`);

// Mantém o CSS do Android em sincronia com o da web.
const cssSrc = resolve(root, 'src/styles/main.css');
const cssDst = resolve(root, 'android/app/src/main/assets/src/styles/main.css');
copyFileSync(cssSrc, cssDst);
console.log(`main.css copiado -> ${cssDst}`);

// Mantém os áudios do Android em sincronia com os da raiz (dano/ze/viado/...).
const assetsDir = resolve(root, 'android/app/src/main/assets');
for (const mp3 of readdirSync(root).filter(f => f.endsWith('.mp3'))) {
    copyFileSync(resolve(root, mp3), resolve(assetsDir, mp3));
    console.log(`${mp3} copiado -> ${assetsDir}`);
}

// Copia a chave (config.js) para os assets do Android, se existir. Sem ela o app
// roda, mas a IA fica desligada. (config.js é gitignored.)
const cfgSrc = resolve(root, 'config.js');
const cfgDst = resolve(root, 'android/app/src/main/assets/config.js');
if (existsSync(cfgSrc)) {
    copyFileSync(cfgSrc, cfgDst);
    console.log(`config.js copiado -> ${cfgDst}`);
} else {
    console.warn('AVISO: config.js não encontrado — IA ficará desligada no APK.');
}
