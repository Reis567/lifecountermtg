// ===== Cliente da API (lifecounter.mreis.site) =====
// Base única da mesa: perfis, partidas, ranking e versão do APK vivem no
// servidor (backend/ neste repo). Tanto o site quanto o APK falam com ele.
//
// Convenções:
// - Escritas mandam a chave compartilhada em X-LC-Key (não é segurança de
//   verdade, só evita lixo de fora — ver backend/config/settings.py).
// - Qualquer falha de rede vira exceção; quem chama decide o fallback.
export const API_BASE = (() => {
    const w = window;
    if (typeof w.LIFECOUNTER_API_BASE === 'string' && w.LIFECOUNTER_API_BASE) {
        return String(w.LIFECOUNTER_API_BASE).replace(/\/+$/, '');
    }
    return 'https://lifecounter.mreis.site';
})();
export const API_KEY = (() => {
    const w = window;
    return (typeof w.LIFECOUNTER_API_KEY === 'string' && w.LIFECOUNTER_API_KEY) ? w.LIFECOUNTER_API_KEY : 'lc-mesa-2026';
})();
const API_TIMEOUT_MS = 12000;
const API_DEVICE_KEY = 'lc_device_id_v1';
// Rodando dentro do APK (WebView carregando file://)?
export function isAndroidApp() {
    return location.protocol === 'file:' || !!window.LCApp;
}
export function apiSource() {
    return isAndroidApp() ? 'android' : 'web';
}
// ID estável por dispositivo/navegador, só pra saber de onde veio a partida.
export function deviceId() {
    try {
        let id = localStorage.getItem(API_DEVICE_KEY);
        if (!id) {
            const arr = new Uint32Array(2);
            crypto.getRandomValues(arr);
            id = (isAndroidApp() ? 'apk-' : 'web-') + arr[0].toString(36) + arr[1].toString(36);
            localStorage.setItem(API_DEVICE_KEY, id);
        }
        return id;
    }
    catch {
        return 'anon';
    }
}
export class ApiError extends Error {
    constructor(status, message, body) {
        super(message);
        this.status = status;
        this.body = body;
    }
}
async function apiFetch(path, init = {}, write = false) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? window.setTimeout(() => controller.abort(), API_TIMEOUT_MS) : null;
    const headers = { Accept: 'application/json', ...(init.headers || {}) };
    if (write) {
        headers['X-LC-Key'] = API_KEY;
        headers['X-LC-Device'] = deviceId();
    }
    try {
        const res = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: controller?.signal });
        if (res.status === 204)
            return undefined;
        const text = await res.text();
        let body = null;
        try {
            body = text ? JSON.parse(text) : null;
        }
        catch {
            body = text;
        }
        if (!res.ok) {
            const msg = typeof body === 'object' && body ? JSON.stringify(body) : String(body || res.statusText);
            throw new ApiError(res.status, msg, body);
        }
        return body;
    }
    finally {
        if (timer !== null)
            window.clearTimeout(timer);
    }
}
// ----- endpoints -----
export function apiHealth() {
    return apiFetch('/api/health/');
}
export function apiListProfiles(includeInactive = false) {
    return apiFetch(`/api/profiles/${includeInactive ? '?all=1' : ''}`);
}
export function apiCreateProfile(name, photo, color) {
    const fd = new FormData();
    fd.append('name', name);
    if (color)
        fd.append('color', color);
    if (photo)
        fd.append('photo', photo, 'foto.jpg');
    return apiFetch('/api/profiles/', { method: 'POST', body: fd }, true);
}
export function apiUpdateProfile(id, data) {
    const fd = new FormData();
    if (data.name !== undefined)
        fd.append('name', data.name);
    if (data.color !== undefined)
        fd.append('color', data.color);
    if (data.active !== undefined)
        fd.append('active', data.active ? '1' : '0');
    if (data.aliases !== undefined)
        fd.append('aliases', data.aliases.join(','));
    if (data.photo)
        fd.append('photo', data.photo, 'foto.jpg');
    return apiFetch(`/api/profiles/${id}/`, { method: 'PATCH', body: fd }, true);
}
export function apiProfileStats(id) {
    return apiFetch(`/api/profiles/${id}/stats/`);
}
export function apiGetSeasonSettings() {
    return apiFetch('/api/settings/season/');
}
export function apiSetSeasonSettings(data) {
    return apiFetch('/api/settings/season/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }, true);
}
export function apiNotifications(profileId, sinceIso, versionCode) {
    const q = new URLSearchParams();
    if (profileId)
        q.set('profile', String(profileId));
    if (sinceIso)
        q.set('since', sinceIso);
    q.set('version_code', String(versionCode));
    return apiFetch(`/api/notifications/?${q.toString()}`);
}
export function apiDeleteProfile(id) {
    return apiFetch(`/api/profiles/${id}/`, { method: 'DELETE' }, true);
}
export function apiCreateMatch(payload) {
    return apiFetch('/api/matches/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    }, true);
}
export function apiListMatches(opts = {}) {
    const q = new URLSearchParams();
    if (opts.limit)
        q.set('limit', String(opts.limit));
    if (opts.offset)
        q.set('offset', String(opts.offset));
    if (opts.profile)
        q.set('profile', String(opts.profile));
    if (opts.period)
        q.set('period', opts.period);
    if (opts.events)
        q.set('events', '1');
    const qs = q.toString();
    return apiFetch(`/api/matches/${qs ? '?' + qs : ''}`);
}
export function apiGetMatch(id) {
    return apiFetch(`/api/matches/${id}/`);
}
export function apiDeleteMatch(id) {
    return apiFetch(`/api/matches/${id}/`, { method: 'DELETE' }, true);
}
export function apiRanking(period) {
    return apiFetch(`/api/ranking/?period=${encodeURIComponent(period)}`);
}
export function apiCheckUpdate(versionCode) {
    return apiFetch(`/api/update/check/?version_code=${versionCode}&_=${Date.now()}`);
}
//# sourceMappingURL=api.js.map