// ===== Diálogos próprios (no lugar de confirm()/alert() nativos) =====
// O confirm() do WebView tira o app da tela cheia e no iOS vem com a cara do
// sistema. Estes modais seguem o visual do app e devolvem Promise.

interface ConfirmOptions {
    title?: string;
    okText?: string;
    cancelText?: string;
    danger?: boolean;
    // Terceira opção (ex.: "Também zerar mortes do comandante"): checkbox.
    checkbox?: { label: string; checked?: boolean };
}

export interface ConfirmResult {
    ok: boolean;
    checkbox: boolean;
}

function dlgEscape(s: string): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let dlgOpenCount = 0;

export function confirmDialogFull(message: string, opts: ConfirmOptions = {}): Promise<ConfirmResult> {
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
        const finish = (ok: boolean): void => {
            const cb = modal.querySelector('#lc-dialog-cb') as HTMLInputElement | null;
            modal.remove();
            dlgOpenCount = Math.max(0, dlgOpenCount - 1);
            resolve({ ok, checkbox: !!cb?.checked });
        };
        modal.querySelector('.lc-dialog-ok')?.addEventListener('click', () => finish(true));
        modal.querySelector('.lc-dialog-cancel')?.addEventListener('click', () => finish(false));
        modal.addEventListener('click', (e) => { if (e.target === modal) finish(false); });
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') { finish(false); document.removeEventListener('keydown', onKey); }
            if (e.key === 'Enter') { finish(true); document.removeEventListener('keydown', onKey); }
        };
        document.addEventListener('keydown', onKey);
        (modal.querySelector('.lc-dialog-ok') as HTMLButtonElement | null)?.focus();
    });
}

export async function confirmDialog(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
    return (await confirmDialogFull(message, opts)).ok;
}

// Pergunta um valor (número ou texto). Resolve null se cancelar.
export function promptDialog(message: string, opts: { title?: string; value?: string; type?: 'number' | 'text'; okText?: string; placeholder?: string } = {}): Promise<string | null> {
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
        const input = modal.querySelector('.lc-dialog-input') as HTMLInputElement;
        const finish = (ok: boolean): void => {
            const v = input.value;
            modal.remove();
            dlgOpenCount = Math.max(0, dlgOpenCount - 1);
            resolve(ok ? v : null);
        };
        modal.querySelector('.lc-dialog-ok')?.addEventListener('click', () => finish(true));
        modal.querySelector('.lc-dialog-cancel')?.addEventListener('click', () => finish(false));
        modal.addEventListener('click', (e) => { if (e.target === modal) finish(false); });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
        input.focus();
        input.select();
    });
}

export function alertDialog(message: string, title?: string): Promise<void> {
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
        const finish = (): void => { modal.remove(); dlgOpenCount = Math.max(0, dlgOpenCount - 1); resolve(); };
        modal.querySelector('.lc-dialog-ok')?.addEventListener('click', finish);
        modal.addEventListener('click', (e) => { if (e.target === modal) finish(); });
    });
}

// Toast "aplicando em N s… [cancelar]" — usado pelos comandos de voz destrutivos.
export function countdownToast(message: string, ms: number, onCancel?: () => void): Promise<boolean> {
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
        const timer = window.setTimeout(() => { if (done) return; done = true; el.remove(); resolve(true); }, ms);
        el.querySelector('.lc-countdown-cancel')?.addEventListener('click', () => {
            if (done) return;
            done = true;
            window.clearTimeout(timer);
            el.remove();
            onCancel?.();
            resolve(false);
        });
    });
}

// ===== Wake Lock (tela acesa no site/PWA) =====
let wakeLockSentinel: any = null;
let wakeLockWanted = false;

export async function requestWakeLock(): Promise<void> {
    wakeLockWanted = true;
    const nav = navigator as any;
    if (!nav.wakeLock || wakeLockSentinel) return;
    try {
        wakeLockSentinel = await nav.wakeLock.request('screen');
        wakeLockSentinel.addEventListener?.('release', () => { wakeLockSentinel = null; });
    } catch (e) {
        // Sem permissão/aba em background: tenta de novo quando voltar visível.
        wakeLockSentinel = null;
    }
}

export function releaseWakeLock(): void {
    wakeLockWanted = false;
    try { wakeLockSentinel?.release?.(); } catch { /* ignore */ }
    wakeLockSentinel = null;
}

export function setupWakeLock(): void {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && wakeLockWanted && !wakeLockSentinel) void requestWakeLock();
    });
}
