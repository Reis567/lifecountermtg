// ===== Main Entry Point =====

import { initUI } from './ui.js';
import { maybeShowAndroidPromo, setupApkDownloadButton } from './androidPromo.js';

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('MTG Life Counter initialized');
    initUI();
    setupApkDownloadButton();
    maybeShowAndroidPromo();
});

// Handle visibility change to pause/resume timer sounds
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Pause audio when tab is hidden
        console.log('Tab hidden - pausing sounds');
    } else {
        // Resume when visible
        console.log('Tab visible - resuming');
    }
});

// O service worker foi DESATIVADO: o cache cache-first travava o app (não dava
// pra clicar em nada após uma atualização). Aqui removemos qualquer SW antigo e
// limpamos os caches, destravando quem ficou preso. O sw.js virou auto-destrutivo.
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => { /* ignore */ });
}
if (typeof caches !== 'undefined' && caches.keys) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => { /* ignore */ });
}
