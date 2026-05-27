// ===== Promo do APK Android (só no navegador) =====
// Quando o app web é aberto no navegador de um Android, sugere baixar o APK
// (melhor experiência: câmera, sons, tela cheia). Não aparece dentro do próprio
// app (WebView/file://), nem se já estiver instalado como PWA, nem se dispensado.

// URL do APK: suba o arquivo numa GitHub Release e ajuste aqui se mudar o nome.
const APK_URL = 'https://github.com/Reis567/lifecountermtg/releases/latest/download/LifeCounter.apk';
const DISMISS_KEY = 'apkPromoDismissed';

export function maybeShowAndroidPromo(): void {
    try {
        if (location.protocol === 'file:') return; // rodando dentro do nosso APK (WebView)
        const ua = navigator.userAgent || '';
        if (!/Android/i.test(ua)) return; // só Android
        if (/; wv\)/.test(ua)) return; // já é uma WebView de app
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return; // já instalado
        if (localStorage.getItem(DISMISS_KEY) === '1') return; // já dispensou
    } catch {
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal apk-promo active';
    overlay.innerHTML = `
        <div class="modal-content apk-promo-content">
            <div class="apk-promo-emoji">📲</div>
            <h2>Baixe nosso app Android</h2>
            <p>Pra melhor experiência (câmera, sons e tela cheia), use o app instalado em vez do navegador.</p>
            <a class="primary-btn apk-promo-download" href="${APK_URL}" rel="noopener">⬇️ Baixar APK</a>
            <button class="apk-promo-dismiss" type="button">Agora não</button>
        </div>
    `;
    document.body.appendChild(overlay);

    const dismiss = () => {
        try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
        overlay.remove();
    };
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    overlay.querySelector('.apk-promo-download')?.addEventListener('click', dismiss);
    overlay.querySelector('.apk-promo-dismiss')?.addEventListener('click', dismiss);
}

// Botão fixo de download do APK na home (abaixo de "Iniciar Partida").
// Aparece no navegador (web); fica escondido dentro do próprio APK.
export function setupApkDownloadButton(): void {
    const btn = document.getElementById('apk-download-home') as HTMLAnchorElement | null;
    if (!btn) return;
    if (location.protocol === 'file:') {
        btn.style.display = 'none';
        return;
    }
    btn.href = APK_URL;
    btn.style.display = '';
}
