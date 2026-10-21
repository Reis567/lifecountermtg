// ===== Mesa ao vivo =====
// HOST (quem cria a mesa): gera um código, publica o estado a cada mudança
// (debounce) e, a cada 2 s, puxa as ações pedidas pelos convidados e aplica
// no gameState (só se "permitir edições" estiver ligado).
// CONVIDADO (outro celular, site ou APK): entra com o código, vê a mesa ao
// vivo (polling de 2 s) e, se permitido, usa +/− que viram ações na fila.

import { gameState } from './state.js';
import { apiLiveCreate, apiLiveGet, apiLivePush, apiLiveAction, LiveState, LiveActionDTO, API_BASE } from './api.js';
import { avatarHtml, escapeHtml } from './profiles.js';

const LIVE_HOST_KEY = 'lc_live_host_v1';
const LIVE_PUSH_DEBOUNCE_MS = 400;
const LIVE_POLL_MS = 2000;

interface HostSession { code: string; token: string; allowEdits: boolean }

let hostSession: HostSession | null = null;
let hostPushTimer: number | null = null;
let hostPollTimer: number | null = null;
let hostLastVersion = 0;
let hostStatusListeners = new Set<(s: HostSession | null) => void>();

export function liveHostSession(): HostSession | null {
    return hostSession;
}

export function onLiveHostChange(fn: (s: HostSession | null) => void): void {
    hostStatusListeners.add(fn);
}

function emitHost(): void {
    hostStatusListeners.forEach((fn) => { try { fn(hostSession); } catch (e) { console.warn(e); } });
}

export function liveStateFromGame(): LiveState {
    const s = gameState.getState();
    return {
        players: s.players.map((p) => ({
            id: p.id, name: p.name, life: p.life, avatar: p.avatar, color: p.color, isEliminated: p.isEliminated,
            isMonarch: p.isMonarch, poison: p.counters.poison, commanderDamage: p.commanderDamage,
        })),
        turn: s.currentTurn,
        activePlayerId: s.players[s.activePlayerIndex]?.id ?? null,
        winner: s.winner,
        startingLife: s.settings.startingLife,
        startedAt: s.gameStartTime,
    };
}

export async function liveHostStart(allowEdits: boolean): Promise<HostSession> {
    const created = await apiLiveCreate(allowEdits, liveStateFromGame());
    hostSession = { code: created.code, token: created.host_token || '', allowEdits };
    hostLastVersion = created.version;
    try { localStorage.setItem(LIVE_HOST_KEY, JSON.stringify(hostSession)); } catch { /* ignore */ }
    startHostLoops();
    emitHost();
    return hostSession;
}

export async function liveHostStop(): Promise<void> {
    if (!hostSession) return;
    const s = hostSession;
    hostSession = null;
    stopHostLoops();
    try { localStorage.removeItem(LIVE_HOST_KEY); } catch { /* ignore */ }
    emitHost();
    try { await apiLivePush(s.code, s.token, { active: false }); } catch { /* ignore */ }
}

export async function liveHostSetAllowEdits(allow: boolean): Promise<void> {
    if (!hostSession) return;
    hostSession.allowEdits = allow;
    try { localStorage.setItem(LIVE_HOST_KEY, JSON.stringify(hostSession)); } catch { /* ignore */ }
    emitHost();
    try { await apiLivePush(hostSession.code, hostSession.token, { allow_edits: allow }); } catch { /* ignore */ }
}

// Chamado a cada render da mesa: publica (com debounce) o estado novo.
export function liveHostNotify(): void {
    if (!hostSession) return;
    if (hostPushTimer !== null) window.clearTimeout(hostPushTimer);
    hostPushTimer = window.setTimeout(() => { hostPushTimer = null; void hostPush(); }, LIVE_PUSH_DEBOUNCE_MS);
}

async function hostPush(): Promise<void> {
    if (!hostSession) return;
    try {
        const res = await apiLivePush(hostSession.code, hostSession.token, { state: liveStateFromGame() });
        hostLastVersion = res.version;
        applyGuestActions(res.actions);
    } catch (e) {
        console.warn('live host push:', e);
    }
}

function applyGuestActions(actions: LiveActionDTO[]): void {
    if (!hostSession || !hostSession.allowEdits || !actions.length) return;
    const s = gameState.getState();
    for (const a of actions) {
        const p = s.players.find((x) => x.id === a.playerId);
        if (!p) continue;
        const delta = Math.max(-50, Math.min(50, Math.round(a.delta || 0)));
        if (!delta) continue;
        if (a.type === 'life') gameState.changeLife(p.id, delta, 'auto');
        else if (a.type === 'commander' && a.sourceId) gameState.addCommanderDamage(p.id, a.sourceId, delta);
        else if (a.type === 'counter' && a.counter === 'poison') gameState.changeCounter(p.id, 'poison', delta);
        showLiveToast(`📡 ${p.name} ${delta > 0 ? '+' : ''}${delta} (convidado)`);
    }
}

function startHostLoops(): void {
    stopHostLoops();
    hostPollTimer = window.setInterval(() => { void hostPush(); }, LIVE_POLL_MS);
}

function stopHostLoops(): void {
    if (hostPollTimer !== null) { window.clearInterval(hostPollTimer); hostPollTimer = null; }
    if (hostPushTimer !== null) { window.clearTimeout(hostPushTimer); hostPushTimer = null; }
}

// Retoma a sessão de host ao reabrir o app (mesma partida).
export function liveHostResume(): void {
    try {
        const raw = localStorage.getItem(LIVE_HOST_KEY);
        if (!raw) return;
        const s = JSON.parse(raw) as HostSession;
        if (!s.code || !s.token) return;
        hostSession = s;
        startHostLoops();
        emitHost();
    } catch { /* ignore */ }
}

export function liveJoinUrl(code: string): string {
    return `${API_BASE}/?mesa=${encodeURIComponent(code)}`;
}

let liveToastTimer: number | null = null;
function showLiveToast(text: string): void {
    let el = document.getElementById('live-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'live-toast';
        el.className = 'voice-toast';
        document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('voice-toast-show', 'voice-toast-ok');
    if (liveToastTimer !== null) window.clearTimeout(liveToastTimer);
    liveToastTimer = window.setTimeout(() => el?.classList.remove('voice-toast-show'), 2200);
}

// ===== Convidado =====

let guestCode: string | null = null;
let guestTimer: number | null = null;
let guestVersion = -1;
let guestState: LiveState | null = null;
let guestAllow = false;
let guestActive = true;

export function liveGuestOpen(code: string): void {
    guestCode = code.toUpperCase().trim();
    guestVersion = -1;
    guestState = null;
    document.getElementById('live-guest-screen')?.remove();
    const screen = document.createElement('div');
    screen.id = 'live-guest-screen';
    screen.className = 'live-guest';
    screen.innerHTML = `
        <div class="live-guest-header">
            <div><div class="live-guest-title">📡 Mesa <strong>${escapeHtml(guestCode)}</strong></div><div class="live-guest-sub" id="live-guest-sub">conectando…</div></div>
            <button type="button" class="cs-gallery-btn live-guest-leave" id="live-guest-leave">Sair</button>
        </div>
        <div class="live-guest-grid" id="live-guest-grid"></div>
    `;
    document.body.appendChild(screen);
    screen.querySelector('#live-guest-leave')?.addEventListener('click', liveGuestClose);
    screen.querySelector('#live-guest-grid')?.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('[data-delta]') as HTMLElement | null;
        if (!btn || !guestCode || !guestAllow) return;
        const playerId = btn.dataset.player || '';
        const delta = Number(btn.dataset.delta || 0);
        // Otimista: mostra na hora, o host confirma no próximo poll.
        const p = guestState?.players.find((x) => x.id === playerId);
        if (p) { p.life += delta; renderGuest(); }
        apiLiveAction(guestCode, { type: 'life', playerId, delta }).catch((err) => {
            const sub = document.getElementById('live-guest-sub');
            if (sub) sub.textContent = `não deu: ${err?.message || err}`;
        });
    });
    const poll = async (): Promise<void> => {
        if (!guestCode) return;
        try {
            const t = await apiLiveGet(guestCode, guestVersion);
            const sub = document.getElementById('live-guest-sub');
            guestAllow = !!t.allow_edits;
            guestActive = t.active !== false;
            if (!t.unchanged && t.state) {
                guestState = t.state;
                guestVersion = t.version;
                renderGuest();
            }
            if (sub) sub.textContent = !guestActive ? 'mesa encerrada pelo criador' : guestAllow ? 'ao vivo · você pode alterar a vida' : 'ao vivo · somente visualização';
        } catch (err: any) {
            const sub = document.getElementById('live-guest-sub');
            if (sub) sub.textContent = err?.status === 404 ? 'mesa não encontrada' : `sem conexão (${err?.message || err})`;
        }
    };
    void poll();
    guestTimer = window.setInterval(() => { void poll(); }, LIVE_POLL_MS);
}

export function liveGuestClose(): void {
    guestCode = null;
    if (guestTimer !== null) { window.clearInterval(guestTimer); guestTimer = null; }
    document.getElementById('live-guest-screen')?.remove();
    try {
        const url = new URL(location.href);
        if (url.searchParams.has('mesa')) { url.searchParams.delete('mesa'); history.replaceState(null, '', url.toString()); }
    } catch { /* ignore */ }
}

function renderGuest(): void {
    const grid = document.getElementById('live-guest-grid');
    if (!grid || !guestState) return;
    const s = guestState;
    grid.innerHTML = `
        <div class="live-guest-turn">Turno ${s.turn}${s.winner ? ' · 🏆 ' + escapeHtml(s.players.find(p => p.id === s.winner)?.name || '') : ''}</div>
        ${s.players.map((p) => `
            <div class="live-card ${p.isEliminated ? 'eliminated' : ''} ${p.id === s.activePlayerId ? 'active-turn' : ''}" style="--player-color:${escapeHtml(p.color)}">
                <div class="live-card-head">${avatarHtml({ name: p.name, photo_url: p.avatar, color: p.color }, 'lc-avatar lc-avatar-sm')}<span>${escapeHtml(p.name)}</span>${p.isMonarch ? ' 👑' : ''}${p.poison ? ` ☠️${p.poison}` : ''}</div>
                <div class="live-card-life">
                    ${guestAllow && guestActive && !p.isEliminated ? `<button type="button" class="live-btn" data-player="${p.id}" data-delta="-1">−</button>` : ''}
                    <span class="live-life ${p.life <= 5 ? 'low' : ''}">${p.isEliminated ? '💀' : p.life}</span>
                    ${guestAllow && guestActive && !p.isEliminated ? `<button type="button" class="live-btn" data-player="${p.id}" data-delta="1">+</button>` : ''}
                </div>
                ${guestAllow && guestActive && !p.isEliminated ? `<div class="live-card-quick"><button type="button" class="live-btn-sm" data-player="${p.id}" data-delta="-5">−5</button><button type="button" class="live-btn-sm" data-player="${p.id}" data-delta="5">+5</button></div>` : ''}
            </div>`).join('')}
    `;
}

// ?mesa=CODIGO na URL abre direto como convidado.
export function liveCheckUrl(): boolean {
    try {
        const code = new URL(location.href).searchParams.get('mesa');
        if (code) { liveGuestOpen(code); return true; }
    } catch { /* ignore */ }
    return false;
}
