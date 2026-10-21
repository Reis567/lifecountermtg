// ===== Ranking e histórico =====
// A fonte da verdade é o SERVIDOR (lifecounter.mreis.site): toda partida
// encerrada vira um POST /api/matches/ (via fila offline em sync.ts), e o
// ranking/histórico mostrados no app vêm de /api/ranking/ e /api/matches/.
// O localStorage guarda uma cópia local só pra não ficar em branco sem rede.
//
// Pontuação: 1º = N pontos, 2º = N-1, ..., último = 1 (N = jogadores na partida).
// Identidade do jogador é o PERFIL (profileId); sem perfil cai no nome.
import { apiRanking, apiListMatches, apiDeleteMatch, apiSource, deviceId } from './api.js';
import { enqueueMatch } from './sync.js';
const KEY = 'lc_rankings_v1';
function readAll() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function writeAll(list) {
    try {
        localStorage.setItem(KEY, JSON.stringify(list));
    }
    catch {
        /* localStorage cheio/desabilitado: ignora */
    }
}
function toPayload(r) {
    return {
        client_id: r.id,
        started_at_ms: r.startedAt,
        ended_at_ms: r.endedAt,
        duration_ms: r.durationMs,
        mode: r.mode,
        manual: r.manual,
        player_count: r.placements.length,
        starting_life: r.startingLife || 40,
        source: apiSource(),
        device: deviceId(),
        events: Array.isArray(r.events) ? r.events.slice(0, 500) : [],
        placements: r.placements.map((p) => ({
            profile_id: p.profileId ?? null,
            name: p.name,
            place: p.place,
            points: p.points,
            final_life: p.finalLife ?? null,
            eliminated_by: p.eliminatedBy || '',
            commander_deaths: p.commanderDeaths || 0,
        })),
    };
}
// Salva localmente (cópia) e manda pro servidor (fila offline).
export function saveResult(r) {
    const list = readAll();
    if (list.find((x) => x.id === r.id))
        return; // dedup pela id
    // Cópia local sem o log de eventos (pesado) — o completo vai pro servidor.
    const { events, ...local } = r;
    list.push({ ...local, synced: false });
    list.sort((a, b) => b.endedAt - a.endedAt);
    writeAll(list.slice(0, 300));
    void enqueueMatch(toPayload(r)).then((ok) => {
        if (!ok)
            return;
        const cur = readAll();
        const item = cur.find((x) => x.id === r.id);
        if (item) {
            item.synced = true;
            writeAll(cur);
        }
    });
}
export function getAll() {
    return readAll();
}
export function deleteResult(id) {
    writeAll(readAll().filter((r) => r.id !== id));
}
export function clearAll() {
    writeAll([]);
}
function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
// Agregado LOCAL (fallback sem rede).
export function aggregate(period, ref = new Date()) {
    const list = readAll();
    const cutoff = period === 'today' ? startOfDay(ref)
        : period === 'month' || period === 'season' ? startOfMonth(ref)
            : period === 'year' ? new Date(ref.getFullYear(), 0, 1).getTime()
                : 0;
    const map = {};
    for (const r of list) {
        if (r.endedAt < cutoff)
            continue;
        for (const p of r.placements) {
            const key = p.profileId != null ? `p${p.profileId}` : 'n:' + (p.name || '').trim().toLowerCase();
            if (key === 'n:')
                continue;
            if (!map[key])
                map[key] = { name: p.name, points: 0, matches: 0, wins: 0, profileId: p.profileId ?? null };
            map[key].points += p.points;
            map[key].matches += 1;
            if (p.place === 1)
                map[key].wins += 1;
        }
    }
    return Object.values(map).sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
}
// Agregado do SERVIDOR; se falhar, cai no local.
export async function aggregateRemote(period) {
    try {
        const data = await apiRanking(period);
        const rows = data.rows.map((r) => ({
            name: r.name, points: r.points, matches: r.matches, wins: r.wins, profileId: r.profile_id, photoUrl: r.photo_url,
        }));
        return { rows, remote: true, totalMatches: data.total_matches, raw: data.rows, label: data.label, tiebreak: data.tiebreak };
    }
    catch (e) {
        console.warn('ranking: servidor indisponível, usando local', e);
        const rows = aggregate(period);
        return { rows, remote: false, totalMatches: readAll().length };
    }
}
// Histórico de partidas do servidor (com fallback local convertido pro mesmo formato).
export async function listMatchesRemote(opts = {}) {
    try {
        const data = await apiListMatches({ limit: opts.limit || 40, offset: opts.offset || 0, profile: opts.profile, period: opts.period });
        return { results: data.results, count: data.count, remote: true };
    }
    catch (e) {
        console.warn('histórico: servidor indisponível, usando local', e);
        const local = readAll().map((r, i) => ({
            id: -(i + 1),
            client_id: r.id,
            started_at: new Date(r.startedAt).toISOString(),
            ended_at: new Date(r.endedAt).toISOString(),
            duration_ms: r.durationMs,
            mode: r.mode,
            manual: r.manual,
            player_count: r.placements.length,
            starting_life: r.startingLife || 40,
            source: apiSource(),
            device: '',
            placements: r.placements.map((p) => ({ profile_id: p.profileId ?? null, name: p.name, place: p.place, points: p.points })),
            created_at: new Date(r.endedAt).toISOString(),
        }));
        return { results: local.slice(opts.offset || 0, (opts.offset || 0) + (opts.limit || 40)), count: local.length, remote: false };
    }
}
export async function deleteMatchRemote(serverId, clientId) {
    if (serverId > 0)
        await apiDeleteMatch(serverId);
    if (clientId)
        deleteResult(clientId);
}
function placementFor(p, idx, N, eliminatedBy) {
    const place = idx + 1;
    return {
        name: p ? p.name : `Jogador ${idx + 1}`,
        place,
        points: N - place + 1,
        profileId: p?.profileId ?? null,
        finalLife: p?.life ?? null,
        commanderDeaths: p?.commanderDeaths || 0,
        eliminatedBy: eliminatedBy || '',
    };
}
// Constrói o resultado automaticamente quando há um vencedor no estado.
// Ordem: vencedor = 1º; eliminados em ORDEM INVERSA (último eliminado = 2º, ...,
// primeiro eliminado = último colocado). Pontos = N - place + 1.
// Obs.: GameState.history guarda o MAIS RECENTE PRIMEIRO (unshift), então o
// primeiro `player_eliminated` encontrado é o último a cair.
export function buildAutoResult(state) {
    if (!state.winner)
        return null;
    const N = state.players.length;
    if (N < 1)
        return null;
    const winnerId = state.winner;
    const order = [];
    if (state.players.some((p) => p.id === winnerId))
        order.push(winnerId);
    const eliminatedBy = {};
    const eliminations = (state.history || []).filter((e) => e.type === 'player_eliminated' && e.playerId);
    for (const e of eliminations) {
        const id = e.playerId;
        if (!order.includes(id))
            order.push(id);
        const from = e.details?.fromPlayerId;
        if (from && !eliminatedBy[id]) {
            const killer = state.players.find((p) => p.id === from);
            if (killer)
                eliminatedBy[id] = killer.name;
        }
    }
    for (const p of state.players)
        if (!order.includes(p.id))
            order.push(p.id);
    const placements = order.map((id, idx) => placementFor(state.players.find((x) => x.id === id), idx, N, eliminatedBy[id]));
    const startedAt = state.gameStartTime || Date.now();
    return {
        id: 'm_' + startedAt,
        startedAt,
        endedAt: Date.now(),
        durationMs: Math.max(0, Date.now() - startedAt),
        mode: state.gameMode || 'standard',
        placements,
        manual: false,
        startingLife: state.settings?.startingLife,
        events: (state.history || []).slice().reverse(), // cronológico
    };
}
// Versão "manual" (vinda do modal de pódio quando a partida foi resetada sem vencedor).
export function buildManualResult(placements, state) {
    const startedAt = state.gameStartTime || Date.now();
    return {
        id: 'mm_' + startedAt + '_' + Date.now(),
        startedAt,
        endedAt: Date.now(),
        durationMs: Math.max(0, Date.now() - startedAt),
        mode: state.gameMode || 'standard',
        placements,
        manual: true,
        startingLife: state.settings?.startingLife,
        events: (state.history || []).slice().reverse(),
    };
}
// Atribui pontos a uma ordem de jogadores: posição 1..N.
export function placementsFromOrder(ordered) {
    const N = ordered.length;
    return ordered.map((p, idx) => placementFor(p, idx, N));
}
//# sourceMappingURL=ranking.js.map