// Gera o bundle.js do Android a partir dos módulos compilados em src/js.
//
// O WebView do Android carrega um único script clássico (sem ES modules), então
// concatenamos os módulos compilados removendo os `import`/`export`. Rode `tsc`
// antes (ou use `npm run build:android`, que faz os dois).

import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Ordem importa: dependências de execução em nível de módulo primeiro,
// main.js por último (registra o DOMContentLoaded que chama initUI).
const order = ['config', 'aiClient', 'types', 'state', 'audio', 'fingerPicker', 'aiNarrator', 'cardScanner', 'androidPromo', 'ui', 'main'];

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

const bundlePath = resolve(root, 'android/app/src/main/assets/src/js/bundle.js');
writeFileSync(bundlePath, out);
console.log(`bundle.js gerado (${out.length} bytes) -> ${bundlePath}`);

// Mantém o CSS do Android em sincronia com o da web.
const cssSrc = resolve(root, 'src/styles/main.css');
const cssDst = resolve(root, 'android/app/src/main/assets/src/styles/main.css');
copyFileSync(cssSrc, cssDst);
console.log(`main.css copiado -> ${cssDst}`);
