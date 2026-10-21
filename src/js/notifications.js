// ===== Notificações =====
// Fonte: GET /api/notifications/?profile=&since=&version_code= (nova versão,
// temporada fechada, "fulano te ultrapassou", conquistas).
// - Em primeiro plano (site e APK): ao abrir e a cada 30 min, mostra como
//   cartões na tela.
// - Em segundo plano (só APK): o NotificationWorker nativo consulta o mesmo
//   endpoint a cada ~1 h e mostra notificação do sistema. Ele precisa saber
//   qual é o "meu perfil" neste aparelho — guardado aqui e repassado via LCApp.
import { apiNotifications, isAndroidApp } from './api.js';
import { currentVersionCode } from './updater.js';
import { getProfiles, onProfilesChange } from './profiles.js';
const NOTIF_MY_PROFILE_KEY = 'lc_my_profile_v1';
const NOTIF_LAST_CHECK_KEY = 'lc_notif_last_check_v1';
const NOTIF_SEEN_KEY = 'lc_notif_seen_v1';
const NOTIF_INTERVAL_MS = 30 * 60 * 1000;
export function getMyProfileId() {
    try {
        const v = localStorage.getItem(NOTIF_MY_PROFILE_KEY);
        return v ? Number(v) : null;
    }
    catch {
        return null;
    }
}
export function setMyProfileId(id) {
    try {
        if (id)
            localStorage.setItem(NOTIF_MY_PROFILE_KEY, String(id));
        else
            localStorage.removeItem(NOTIF_MY_PROFILE_KEY);
    }
    catch { /* ignore */ }
    pushMyProfileToNative();
}
function pushMyProfileToNative() {
    const bridge = window.LCApp;
    if (!bridge || typeof bridge.setMyProfile !== 'function')
        return;
    const id = getMyProfileId();
    const name = id ? (getProfiles().find(p => p.id === id)?.name || '') : '';
    try {
        bridge.setMyProfile(id || 0, name);
    }
    catch { /* ignore */ }
}
let notifHandler = null;
export function onNotification(fn) {
    notifHandler = fn;
}
export async function checkNotificationsNow() {
    let since = null;
    let seen = [];
    try {
        since = localStorage.getItem(NOTIF_LAST_CHECK_KEY);
        seen = JSON.parse(localStorage.getItem(NOTIF_SEEN_KEY) || '[]');
    }
    catch { /* ignore */ }
    const res = await apiNotifications(getMyProfileId(), since, currentVersionCode());
    const fresh = res.notifications.filter((n) => !seen.includes(n.id));
    try {
        localStorage.setItem(NOTIF_LAST_CHECK_KEY, res.now);
        localStorage.setItem(NOTIF_SEEN_KEY, JSON.stringify([...seen, ...fresh.map(n => n.id)].slice(-200)));
    }
    catch { /* ignore */ }
    fresh.forEach((n) => { try {
        notifHandler?.(n);
    }
    catch (e) {
        console.warn(e);
    } });
    return fresh;
}
export function setupNotifications() {
    onProfilesChange(() => pushMyProfileToNative());
    pushMyProfileToNative();
    // Primeira checagem alguns segundos depois de abrir (deixa o resto carregar).
    window.setTimeout(() => { void checkNotificationsNow().catch(() => { }); }, 4000);
    window.setInterval(() => { void checkNotificationsNow().catch(() => { }); }, NOTIF_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && isAndroidApp())
            void checkNotificationsNow().catch(() => { });
    });
}
//# sourceMappingURL=notifications.js.map