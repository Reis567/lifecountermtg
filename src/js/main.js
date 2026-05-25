// ===== Main Entry Point =====
import { initUI } from './ui.js';
// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('MTG Life Counter initialized');
    initUI();
});
// Handle visibility change to pause/resume timer sounds
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Pause audio when tab is hidden
        console.log('Tab hidden - pausing sounds');
    }
    else {
        // Resume when visible
        console.log('Tab visible - resuming');
    }
});
// Register service worker for PWA (instalável + offline). Caminho relativo para
// funcionar em subpastas (ex.: GitHub Pages). Falha silenciosa no WebView (file://).
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
            console.warn('Service worker não registrado:', err);
        });
    });
}
//# sourceMappingURL=main.js.map