// ===== Atualização do APK pelo próprio app =====
// O app sabe a própria versão (APP_VERSION_* abaixo + ponte nativa LCApp no
// Android), pergunta ao servidor se há versão nova e, se houver, baixa e
// instala sem precisar sair pra buscar o APK. No site (navegador) a "versão"
// é só informativa: recarregar a página já traz a versão nova.
//
// Ponte nativa (MainActivity.kt -> window.LCApp):
//   getVersionCode(): number       getVersionName(): string
//   downloadAndInstall(url, name)  -> progresso via window.__lcUpdateStatus(json)

import { apiCheckUpdate, isAndroidApp, UpdateInfoDTO } from './api.js';

// Mantenha em sincronia com android/app/build.gradle.kts (versionCode/versionName).
export const APP_VERSION_CODE = 23;
export const APP_VERSION_NAME = '2.4.1';

const UPDATE_LAST_CHECK_KEY = 'lc_update_last_check_v1';
const UPDATE_SKIP_KEY = 'lc_update_skipped_code_v1';
const UPDATE_AUTO_CHECK_MS = 6 * 60 * 60 * 1000; // 6 h

interface AppBridge {
    getVersionCode(): number;
    getVersionName(): string;
    downloadAndInstall(url: string, versionName: string): void;
    installAgain?(): void;
}

function appBridge(): AppBridge | null {
    const b = (window as any).LCApp;
    return b && typeof b.getVersionCode === 'function' ? b as AppBridge : null;
}

export function currentVersionCode(): number {
    const b = appBridge();
    if (b) {
        try { const c = Number(b.getVersionCode()); if (c > 0) return c; } catch { /* ignore */ }
    }
    return APP_VERSION_CODE;
}

export function currentVersionName(): string {
    const b = appBridge();
    if (b) {
        try { const n = String(b.getVersionName() || ''); if (n) return n; } catch { /* ignore */ }
    }
    return APP_VERSION_NAME;
}

export function canSelfInstall(): boolean {
    const b = appBridge();
    return !!b && typeof b.downloadAndInstall === 'function';
}

let updateInfoCache: UpdateInfoDTO | null = null;

export async function checkForUpdate(): Promise<UpdateInfoDTO> {
    const info = await apiCheckUpdate(currentVersionCode());
    updateInfoCache = info;
    try { localStorage.setItem(UPDATE_LAST_CHECK_KEY, String(Date.now())); } catch { /* ignore */ }
    return info;
}

export function lastUpdateInfo(): UpdateInfoDTO | null {
    return updateInfoCache;
}

// ----- UI -----

function updEscape(s: string): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtBytes(n?: number): string {
    if (!n) return '';
    if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${Math.round(n / 1024)} KB`;
}

let updateModalEl: HTMLElement | null = null;

export function openUpdateModal(prefetched?: UpdateInfoDTO | null): void {
    if (updateModalEl) updateModalEl.remove();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'update-modal-dyn';
    updateModalEl = modal;
    const android = isAndroidApp();
    modal.innerHTML = `
        <div class="modal-content update-modal-content">
            <div class="modal-header">
                <h2><svg class="ic ic-title"><use href="#ic-update"/></svg>Atualização</h2>
                <button class="modal-close" type="button">&times;</button>
            </div>
            <div class="update-body">
                <div class="update-current">Versão instalada: <strong>${updEscape(currentVersionName())}</strong> <span class="update-muted">(${currentVersionCode()})</span></div>
                <div class="update-status" id="update-status">Verificando…</div>
                <div class="update-progress" id="update-progress" style="display:none"><div class="update-progress-bar" id="update-progress-bar"></div></div>
                <div class="update-changelog" id="update-changelog" style="display:none"></div>
                <div class="update-actions">
                    <button class="cs-gallery-btn" id="update-recheck" type="button">Verificar de novo</button>
                    <button class="primary-btn" id="update-install" type="button" style="display:none">Baixar e instalar</button>
                    ${android ? '' : '<a class="primary-btn" id="update-apk-link" style="display:none" rel="noopener">⬇️ Baixar APK</a>'}
                </div>
                ${android ? '' : '<p class="update-muted update-note">No site, basta recarregar a página para usar a versão mais nova. O APK é para quem usa o app Android.</p>'}
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const statusEl = modal.querySelector('#update-status') as HTMLElement;
    const changelogEl = modal.querySelector('#update-changelog') as HTMLElement;
    const installBtn = modal.querySelector('#update-install') as HTMLButtonElement;
    const apkLink = modal.querySelector('#update-apk-link') as HTMLAnchorElement | null;
    const progress = modal.querySelector('#update-progress') as HTMLElement;
    const progressBar = modal.querySelector('#update-progress-bar') as HTMLElement;

    const close = (): void => { modal.remove(); if (updateModalEl === modal) updateModalEl = null; };
    modal.querySelector('.modal-close')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    const show = (info: UpdateInfoDTO): void => {
        if (info.update_available && info.download_url) {
            statusEl.innerHTML = `Nova versão disponível: <strong>v${updEscape(info.version_name || '')}</strong> <span class="update-muted">(${info.version_code}) · ${fmtBytes(info.file_size)}</span>`;
            if (info.changelog) {
                changelogEl.style.display = '';
                changelogEl.innerHTML = updEscape(info.changelog).replace(/\n/g, '<br>');
            }
            if (canSelfInstall()) {
                installBtn.style.display = '';
                installBtn.onclick = () => startInstall(info);
            } else if (apkLink) {
                apkLink.style.display = '';
                apkLink.href = info.download_url;
            } else {
                // APK antigo sem a ponte de instalação: abre o link no navegador.
                installBtn.style.display = '';
                installBtn.textContent = 'Abrir download';
                installBtn.onclick = () => { window.open(info.download_url!, '_blank'); };
            }
        } else {
            statusEl.textContent = 'Você já está na versão mais recente. ✅';
            installBtn.style.display = 'none';
            if (apkLink) apkLink.style.display = 'none';
        }
    };

    const startInstall = (info: UpdateInfoDTO): void => {
        installBtn.disabled = true;
        progress.style.display = '';
        progressBar.style.width = '2%';
        statusEl.textContent = 'Baixando…';
        (window as any).__lcUpdateStatus = (json: string) => {
            try {
                const s = JSON.parse(json) as { state: string; percent?: number; message?: string };
                if (s.state === 'progress') {
                    progressBar.style.width = `${Math.max(2, Math.min(100, s.percent || 0))}%`;
                    statusEl.textContent = `Baixando… ${Math.round(s.percent || 0)}%`;
                } else if (s.state === 'installing') {
                    progressBar.style.width = '100%';
                    statusEl.textContent = 'Download concluído. Confirme a instalação na tela do Android.';
                    installBtn.disabled = false;
                    installBtn.textContent = 'Instalar de novo';
                    installBtn.onclick = () => { appBridge()?.installAgain?.(); };
                } else if (s.state === 'error') {
                    statusEl.textContent = `Falhou: ${s.message || 'erro desconhecido'}`;
                    installBtn.disabled = false;
                    if (/Instalar de novo/i.test(s.message || '')) {
                        installBtn.textContent = 'Instalar de novo';
                        installBtn.onclick = () => { appBridge()?.installAgain?.(); };
                    }
                }
            } catch { /* ignore */ }
        };
        try {
            appBridge()!.downloadAndInstall(info.download_url!, info.version_name || '');
        } catch (e: any) {
            statusEl.textContent = `Não consegui iniciar o download: ${e?.message || e}`;
            installBtn.disabled = false;
        }
    };

    const run = async (): Promise<void> => {
        statusEl.textContent = 'Verificando…';
        try {
            show(prefetched || await checkForUpdate());
            prefetched = null;
        } catch (e: any) {
            statusEl.textContent = `Sem conexão com o servidor (${e?.message || e}).`;
        }
    };
    modal.querySelector('#update-recheck')?.addEventListener('click', () => { prefetched = null; void run(); });
    void run();
}

// Banner discreto no topo quando há versão nova (só no APK, onde faz sentido instalar).
function showUpdateBanner(info: UpdateInfoDTO): void {
    if (document.getElementById('update-banner')) return;
    const bar = document.createElement('div');
    bar.id = 'update-banner';
    bar.className = 'update-banner';
    bar.innerHTML = `
        <span>⬆️ Nova versão <strong>v${updEscape(info.version_name || '')}</strong> disponível</span>
        <button type="button" class="update-banner-btn" id="update-banner-open">Atualizar</button>
        <button type="button" class="update-banner-x" id="update-banner-skip" title="Agora não">&times;</button>
    `;
    document.body.appendChild(bar);
    bar.querySelector('#update-banner-open')?.addEventListener('click', () => { bar.remove(); openUpdateModal(info); });
    bar.querySelector('#update-banner-skip')?.addEventListener('click', () => {
        try { localStorage.setItem(UPDATE_SKIP_KEY, String(info.version_code || 0)); } catch { /* ignore */ }
        bar.remove();
    });
}

// Checagem automática ao abrir (no máximo a cada 6 h), silenciosa se não houver nada.
export function setupUpdater(): void {
    const label = document.getElementById('app-version-label');
    if (label) label.textContent = `v${currentVersionName()}${isAndroidApp() ? ' · APK' : ' · web'}`;

    if (!isAndroidApp()) return;
    let last = 0;
    try { last = Number(localStorage.getItem(UPDATE_LAST_CHECK_KEY) || 0); } catch { /* ignore */ }
    if (Date.now() - last < UPDATE_AUTO_CHECK_MS) return;

    window.setTimeout(() => {
        checkForUpdate().then((info) => {
            if (!info.update_available) return;
            let skipped = 0;
            try { skipped = Number(localStorage.getItem(UPDATE_SKIP_KEY) || 0); } catch { /* ignore */ }
            if (!info.mandatory && skipped === (info.version_code || 0)) return;
            showUpdateBanner(info);
        }).catch(() => { /* sem rede: silêncio */ });
    }, 2500);
}
