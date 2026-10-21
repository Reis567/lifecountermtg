// ===== Diálogos próprios (no lugar de confirm()/alert() nativos) =====
// O confirm() do WebView tira o app da tela cheia e no iOS vem com a cara do
// sistema. Estes modais seguem o visual do app e devolvem Promise.
function dlgEscape(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
let dlgOpenCount = 0;
export function confirmDialogFull(message, opts = {}) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal active lc-dialog';
        modal.style.zIndex = String(3000 + dlgOpenCount++);
        modal.innerHTML = `
            <div class="modal-content lc-dialog-content ${opts.danger ? 'lc-dialog-danger' : ''}" role="dialog" aria-modal="true">
                ${opts.title ? `<div class="lc-dialog-title">${dlgEscape(opts.title)}</div>` : ''}
                <div class="lc-dialog-message">${dlgEscape(message).replace(/\n/g, '<br>')}</div>
                ${opts.checkbox ? `<label class="lc-dialog-check"><input type="checkbox" id="lc-dialog-cb" ${opts.checkbox.checked ? 'checked' : ''}> ${dlgEscape(opts.checkbox.label)}</label>` : ''}
                <div class="lc-dialog-actions">
                    <button type="button" class="cs-gallery-btn lc-dialog-cancel">${dlgEscape(opts.cancelText || 'Cancelar')}</button>
                    <button type="button" class="${opts.danger ? 'danger-btn' : 'primary-btn'} lc-dialog-ok">${dlgEscape(opts.okText || 'OK')}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        const finish = (ok) => {
            const cb = modal.querySelector('#lc-dialog-cb');
            modal.remove();
            dlgOpenCount = Math.max(0, dlgOpenCount - 1);
            resolve({ ok, checkbox: !!cb?.checked });
        };
        modal.querySelector('.lc-dialog-ok')?.addEventListener('click', () => finish(true));
        modal.querySelector('.lc-dialog-cancel')?.addEventListener('click', () => finish(false));
        modal.addEventListener('click', (e) => { if (e.target === modal)
            finish(false); });
        const onKey = (e) => {
            if (e.key === 'Escape') {
                finish(false);
                document.removeEventListener('keydown', onKey);
            }
            if (e.key === 'Enter') {
                finish(true);
                document.removeEventListener('keydown', onKey);
            }
        };
        document.addEventListener('keydown', onKey);
        modal.querySelector('.lc-dialog-ok')?.focus();
    });
}
export async function confirmDialog(message, opts = {}) {
    return (await confirmDialogFull(message, opts)).ok;
}
// Pergunta um valor (número ou texto). Resolve null se cancelar.
export function promptDialog(message, opts = {}) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal active lc-dialog';
        modal.style.zIndex = String(3000 + dlgOpenCount++);
        modal.innerHTML = `
            <div class="modal-content lc-dialog-content" role="dialog" aria-modal="true">
                ${opts.title ? `<div class="lc-dialog-title">${dlgEscape(opts.title)}</div>` : ''}
                <div class="lc-dialog-message">${dlgEscape(message)}</div>
                <input class="lc-dialog-input" type="${opts.type || 'text'}" value="${dlgEscape(opts.value || '')}" placeholder="${dlgEscape(opts.placeholder || '')}" ${opts.type === 'number' ? 'inputmode="numeric"' : ''}>
                <div class="lc-dialog-actions">
                    <button type="button" class="cs-gallery-btn lc-dialog-cancel">Cancelar</button>
                    <button type="button" class="primary-btn lc-dialog-ok">${dlgEscape(opts.okText || 'OK')}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        const input = modal.querySelector('.lc-dialog-input');
        const finish = (ok) => {
            const v = input.value;
            modal.remove();
            dlgOpenCount = Math.max(0, dlgOpenCount - 1);
            resolve(ok ? v : null);
        };
        modal.querySelector('.lc-dialog-ok')?.addEventListener('click', () => finish(true));
        modal.querySelector('.lc-dialog-cancel')?.addEventListener('click', () => finish(false));
        modal.addEventListener('click', (e) => { if (e.target === modal)
            finish(false); });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter')
            finish(true); if (e.key === 'Escape')
            finish(false); });
        input.focus();
        input.select();
    });
}
export function alertDialog(message, title) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal active lc-dialog';
        modal.style.zIndex = String(3000 + dlgOpenCount++);
        modal.innerHTML = `
            <div class="modal-content lc-dialog-content" role="alertdialog" aria-modal="true">
                ${title ? `<div class="lc-dialog-title">${dlgEscape(title)}</div>` : ''}
                <div class="lc-dialog-message">${dlgEscape(message).replace(/\n/g, '<br>')}</div>
                <div class="lc-dialog-actions">
                    <button type="button" class="primary-btn lc-dialog-ok">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        const finish = () => { modal.remove(); dlgOpenCount = Math.max(0, dlgOpenCount - 1); resolve(); };
        modal.querySelector('.lc-dialog-ok')?.addEventListener('click', finish);
        modal.addEventListener('click', (e) => { if (e.target === modal)
            finish(); });
    });
}
// Toast "aplicando em N s… [cancelar]" — usado pelos comandos de voz destrutivos.
export function countdownToast(message, ms, onCancel) {
    return new Promise((resolve) => {
        document.getElementById('lc-countdown-toast')?.remove();
        const el = document.createElement('div');
        el.id = 'lc-countdown-toast';
        el.className = 'lc-countdown';
        el.innerHTML = `
            <span class="lc-countdown-msg">${dlgEscape(message)}</span>
            <span class="lc-countdown-bar"><span class="lc-countdown-fill" style="animation-duration:${ms}ms"></span></span>
            <button type="button" class="lc-countdown-cancel">Cancelar</button>
        `;
        document.body.appendChild(el);
        let done = false;
        const timer = window.setTimeout(() => { if (done)
            return; done = true; el.remove(); resolve(true); }, ms);
        el.querySelector('.lc-countdown-cancel')?.addEventListener('click', () => {
            if (done)
                return;
            done = true;
            window.clearTimeout(timer);
            el.remove();
            onCancel?.();
            resolve(false);
        });
    });
}
// ===== Wake Lock (tela acesa no site/PWA) =====
let wakeLockSentinel = null;
let wakeLockWanted = false;
export async function requestWakeLock() {
    wakeLockWanted = true;
    const nav = navigator;
    if (!nav.wakeLock || wakeLockSentinel)
        return;
    try {
        wakeLockSentinel = await nav.wakeLock.request('screen');
        wakeLockSentinel.addEventListener?.('release', () => { wakeLockSentinel = null; });
    }
    catch (e) {
        // Sem permissão/aba em background: tenta de novo quando voltar visível.
        wakeLockSentinel = null;
    }
}
export function releaseWakeLock() {
    wakeLockWanted = false;
    try {
        wakeLockSentinel?.release?.();
    }
    catch { /* ignore */ }
    wakeLockSentinel = null;
}
export function setupWakeLock() {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && wakeLockWanted && !wakeLockSentinel)
            void requestWakeLock();
    });
}
//# sourceMappingURL=dialogs.js.map