// ===== Cliente da API (lifecounter.mreis.site) =====
// Base única da mesa: perfis, partidas, ranking e versão do APK vivem no
// servidor (backend/ neste repo). Tanto o site quanto o APK falam com ele.
//
// Convenções:
// - Escritas mandam a chave compartilhada em X-LC-Key (não é segurança de
//   verdade, só evita lixo de fora — ver backend/config/settings.py).
// - Qualquer falha de rede vira exceção; quem chama decide o fallback.

export const API_BASE: string = (() => {
    const w = window as any;
    if (typeof w.LIFECOUNTER_API_BASE === 'string' && w.LIFECOUNTER_API_BASE) {
        return String(w.LIFECOUNTER_API_BASE).replace(/\/+$/, '');
    }
    return 'https://lifecounter.mreis.site';
})();

export const API_KEY: string = (() => {
    const w = window as any;
    return (typeof w.LIFECOUNTER_API_KEY === 'string' && w.LIFECOUNTER_API_KEY) ? w.LIFECOUNTER_API_KEY : 'lc-mesa-2026';
})();

const API_TIMEOUT_MS = 12000;
const API_DEVICE_KEY = 'lc_device_id_v1';

export interface ProfileDTO {
    id: number;
    name: string;
    slug: string;
    photo_url: string | null;
    color: string;
    is_preset: boolean;
    active: boolean;
    aliases?: string[]; // apelidos pro comando de voz
    sounds?: Partial<Record<'death' | 'win' | 'damage', string>>; // URLs no servidor
    decks?: DeckDTO[];
}

export interface DeckDTO {
    id: number;
    profile: number;
    name: string;
    commander: string;
    colors: string; // WUBRG
    image_url: string;
    scryfall_id: string;
    active: boolean;
}

export interface EloRowDTO {
    rank: number;
    profile_id: number;
    name: string;
    photo_url: string | null;
    elo: number;
    matches: number;
    history: Array<{ match_id: number; at: string; elo: number }>;
}

export interface SeasonSummaryDTO {
    label: string;
    start: string;
    end: string;
    current: boolean;
    matches: number;
    champion: RankingRowDTO | null;
    top: RankingRowDTO[];
}

export interface LiveTableDTO {
    code: string;
    allow_edits: boolean;
    state: LiveState;
    version: number;
    active: boolean;
    updated_at?: string;
    unchanged?: boolean;
    host_token?: string;
}

// Estado publicado da mesa ao vivo (só o que o convidado precisa ver).
export interface LiveState {
    players: Array<{ id: string; name: string; life: number; avatar: string | null; color: string; isEliminated: boolean; isMonarch: boolean; poison: number; commanderDamage: Record<string, number> }>;
    turn: number;
    activePlayerId: string | null;
    winner: string | null;
    startingLife: number;
    startedAt: number | null;
    hostName?: string;
}

export interface LiveActionDTO {
    id: number;
    device: string;
    type: 'life' | 'commander' | 'counter';
    playerId: string;
    delta?: number;
    sourceId?: string;
    counter?: string;
}

export interface AchievementDTO {
    key: string;
    title: string;
    description: string;
    icon: string;
    earned_at: string;
    match_id: number | null;
}

export interface ProfileStatsDTO {
    profile: ProfileDTO;
    points: number;
    matches: number;
    wins: number;
    podiums: number;
    last_places: number;
    win_rate: number;
    avg_place: number | null;
    current_streak: number;
    best_streak: number;
    avg_duration_ms: number;
    nemesis: Array<{ name: string; profile_id: number | null; times: number }>;
    victims: Array<{ name: string; profile_id: number | null; times: number }>;
    recent: Array<{ match_id: number; ended_at: string; place: number; points: number; players: number }>;
    achievements: AchievementDTO[];
    rank_all: number | null;
    rank_season: number | null;
    elo: number;
    elo_history: Array<{ match_id: number; at: string; elo: number }>;
    trophies: Array<{ label: string; start: string; points: number }>;
    deck_stats: Array<{ deck_id: number | null; name: string; colors: string; matches: number; wins: number; win_rate: number }>;
    color_stats: Array<{ color: string; matches: number; wins: number; win_rate: number }>;
}

export type ScoringMode = 'placement' | 'winner_only' | 'podium' | 'elo';

export interface SeasonSettingsDTO {
    season_months: number; // 1, 3, 6, 12
    season_start: string; // YYYY-MM-DD (âncora)
    tiebreak: 'points' | 'wins';
    scoring_mode: ScoringMode;
    current_season: { start: string; end: string; label: string };
}

export interface NotificationDTO {
    id: string;
    kind: 'update' | 'season_closed' | 'overtaken' | 'achievement';
    title: string;
    body: string;
    at: string;
}

export interface PlacementDTO {
    profile_id: number | null;
    name: string;
    place: number;
    points: number;
    deck_id?: number | null;
    deck_name?: string;
    deck_colors?: string;
    final_life?: number | null;
    eliminated_by?: string;
    commander_deaths?: number;
    photo_url?: string | null;
}

export interface MatchDTO {
    new_achievements?: AchievementDTO[]; // só na resposta do POST
    id: number;
    client_id: string;
    started_at: string;
    ended_at: string;
    duration_ms: number;
    mode: string;
    manual: boolean;
    player_count: number;
    starting_life: number;
    source: string;
    device: string;
    events?: unknown[];
    placements: PlacementDTO[];
    created_at: string;
}

export interface MatchPayload {
    client_id: string;
    started_at_ms: number;
    ended_at_ms: number;
    duration_ms: number;
    mode: string;
    manual: boolean;
    player_count: number;
    starting_life: number;
    source: string;
    device: string;
    events: unknown[];
    placements: PlacementDTO[];
}

export interface RankingRowDTO {
    rank: number;
    profile_id: number | null;
    name: string;
    photo_url: string | null;
    points: number;
    matches: number;
    wins: number;
    podiums: number;
    last_places: number;
    win_rate: number;
    last_played: string | null;
}

export interface RankingDTO {
    period: string;
    since: string | null;
    total_matches: number;
    rows: RankingRowDTO[];
}

export interface UpdateInfoDTO {
    update_available: boolean;
    current_version_code: number;
    version_code?: number;
    version_name?: string;
    changelog?: string;
    mandatory?: boolean;
    download_url?: string | null;
    file_size?: number;
}

// Rodando dentro do APK (WebView carregando file://)?
export function isAndroidApp(): boolean {
    return location.protocol === 'file:' || !!(window as any).LCApp;
}

export function apiSource(): string {
    return isAndroidApp() ? 'android' : 'web';
}

// ID estável por dispositivo/navegador, só pra saber de onde veio a partida.
export function deviceId(): string {
    try {
        let id = localStorage.getItem(API_DEVICE_KEY);
        if (!id) {
            const arr = new Uint32Array(2);
            crypto.getRandomValues(arr);
            id = (isAndroidApp() ? 'apk-' : 'web-') + arr[0].toString(36) + arr[1].toString(36);
            localStorage.setItem(API_DEVICE_KEY, id);
        }
        return id;
    } catch {
        return 'anon';
    }
}

export class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, message: string, body?: unknown) {
        super(message);
        this.status = status;
        this.body = body;
    }
}

async function apiFetch<T>(path: string, init: RequestInit = {}, write = false): Promise<T> {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? window.setTimeout(() => controller.abort(), API_TIMEOUT_MS) : null;
    const headers: Record<string, string> = { Accept: 'application/json', ...(init.headers as Record<string, string> || {}) };
    if (write) {
        headers['X-LC-Key'] = API_KEY;
        headers['X-LC-Device'] = deviceId();
    }
    try {
        const res = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: controller?.signal });
        if (res.status === 204) return undefined as unknown as T;
        const text = await res.text();
        let body: unknown = null;
        try { body = text ? JSON.parse(text) : null; } catch { body = text; }
        if (!res.ok) {
            const msg = typeof body === 'object' && body ? JSON.stringify(body) : String(body || res.statusText);
            throw new ApiError(res.status, msg, body);
        }
        return body as T;
    } finally {
        if (timer !== null) window.clearTimeout(timer);
    }
}

// ----- endpoints -----

export function apiHealth(): Promise<{ ok: boolean; profiles: number; matches: number }> {
    return apiFetch('/api/health/');
}

export function apiListProfiles(includeInactive = false): Promise<ProfileDTO[]> {
    return apiFetch(`/api/profiles/${includeInactive ? '?all=1' : ''}`);
}

export function apiCreateProfile(name: string, photo: Blob | null, color?: string): Promise<ProfileDTO> {
    const fd = new FormData();
    fd.append('name', name);
    if (color) fd.append('color', color);
    if (photo) fd.append('photo', photo, 'foto.jpg');
    return apiFetch('/api/profiles/', { method: 'POST', body: fd }, true);
}

export function apiUpdateProfile(id: number, data: { name?: string; color?: string; photo?: Blob | null; active?: boolean; aliases?: string[] }): Promise<ProfileDTO> {
    const fd = new FormData();
    if (data.name !== undefined) fd.append('name', data.name);
    if (data.color !== undefined) fd.append('color', data.color);
    if (data.active !== undefined) fd.append('active', data.active ? '1' : '0');
    if (data.aliases !== undefined) fd.append('aliases', data.aliases.join(','));
    if (data.photo) fd.append('photo', data.photo, 'foto.jpg');
    return apiFetch(`/api/profiles/${id}/`, { method: 'PATCH', body: fd }, true);
}

export function apiProfileStats(id: number): Promise<ProfileStatsDTO> {
    return apiFetch(`/api/profiles/${id}/stats/`);
}

export function apiGetSeasonSettings(): Promise<SeasonSettingsDTO> {
    return apiFetch('/api/settings/season/');
}

export function apiElo(): Promise<{ rows: EloRowDTO[] }> {
    return apiFetch('/api/elo/');
}

export function apiSeasons(): Promise<{ seasons: SeasonSummaryDTO[] }> {
    return apiFetch('/api/seasons/');
}

export function apiCreateDeck(profileId: number, data: { name: string; commander?: string; colors?: string; image_url?: string; scryfall_id?: string }): Promise<DeckDTO> {
    return apiFetch(`/api/profiles/${profileId}/decks/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }, true);
}

export function apiDeleteDeck(deckId: number): Promise<void> {
    return apiFetch(`/api/decks/${deckId}/`, { method: 'DELETE' }, true);
}

export function apiUploadProfileSound(profileId: number, kind: 'death' | 'win' | 'damage', file: Blob, filename: string): Promise<ProfileDTO> {
    const fd = new FormData();
    fd.append('file', file, filename);
    return apiFetch(`/api/profiles/${profileId}/sounds/${kind}/`, { method: 'PUT', body: fd }, true);
}

export function apiDeleteProfileSound(profileId: number, kind: 'death' | 'win' | 'damage'): Promise<void> {
    return apiFetch(`/api/profiles/${profileId}/sounds/${kind}/`, { method: 'DELETE' }, true);
}

// ----- mesa ao vivo -----
export function apiLiveCreate(allowEdits: boolean, state: LiveState): Promise<LiveTableDTO> {
    return apiFetch('/api/live/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ allow_edits: allowEdits, state }),
    }, true);
}

export function apiLiveGet(code: string, version?: number): Promise<LiveTableDTO> {
    return apiFetch(`/api/live/${encodeURIComponent(code)}/${version !== undefined ? `?version=${version}` : ''}`);
}

export function apiLivePush(code: string, hostToken: string, data: { state?: LiveState; allow_edits?: boolean; active?: boolean }): Promise<{ version: number; actions: LiveActionDTO[] }> {
    return apiFetch(`/api/live/${encodeURIComponent(code)}/state/`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-LC-Host': hostToken }, body: JSON.stringify(data),
    });
}

export function apiLiveAction(code: string, action: { type: 'life' | 'commander' | 'counter'; playerId: string; delta: number; sourceId?: string; counter?: string }): Promise<{ ok: boolean }> {
    return apiFetch(`/api/live/${encodeURIComponent(code)}/actions/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LC-Device': deviceId() }, body: JSON.stringify(action),
    });
}

export function apiSetSeasonSettings(data: { season_months?: number; season_start?: string; tiebreak?: 'points' | 'wins'; scoring_mode?: ScoringMode }): Promise<SeasonSettingsDTO> {
    return apiFetch('/api/settings/season/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }, true);
}

export function apiNotifications(profileId: number | null, sinceIso: string | null, versionCode: number): Promise<{ notifications: NotificationDTO[]; now: string }> {
    const q = new URLSearchParams();
    if (profileId) q.set('profile', String(profileId));
    if (sinceIso) q.set('since', sinceIso);
    q.set('version_code', String(versionCode));
    return apiFetch(`/api/notifications/?${q.toString()}`);
}

export function apiDeleteProfile(id: number): Promise<void> {
    return apiFetch(`/api/profiles/${id}/`, { method: 'DELETE' }, true);
}

export function apiCreateMatch(payload: MatchPayload): Promise<MatchDTO> {
    return apiFetch('/api/matches/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    }, true);
}

export function apiListMatches(opts: { limit?: number; offset?: number; profile?: number; period?: string; events?: boolean } = {}): Promise<{ count: number; results: MatchDTO[] }> {
    const q = new URLSearchParams();
    if (opts.limit) q.set('limit', String(opts.limit));
    if (opts.offset) q.set('offset', String(opts.offset));
    if (opts.profile) q.set('profile', String(opts.profile));
    if (opts.period) q.set('period', opts.period);
    if (opts.events) q.set('events', '1');
    const qs = q.toString();
    return apiFetch(`/api/matches/${qs ? '?' + qs : ''}`);
}

export function apiGetMatch(id: number): Promise<MatchDTO> {
    return apiFetch(`/api/matches/${id}/`);
}

export function apiDeleteMatch(id: number): Promise<void> {
    return apiFetch(`/api/matches/${id}/`, { method: 'DELETE' }, true);
}

export function apiRanking(period: string): Promise<RankingDTO> {
    return apiFetch(`/api/ranking/?period=${encodeURIComponent(period)}`);
}

export function apiCheckUpdate(versionCode: number): Promise<UpdateInfoDTO> {
    return apiFetch(`/api/update/check/?version_code=${versionCode}&_=${Date.now()}`);
}
