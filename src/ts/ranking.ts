// ===== Ranking persistente =====
// Salva o resultado de cada partida no localStorage e agrega pontuações
// por jogador (1º = N pontos, 2º = N-1, ..., último = 1) com cortes por
// dia / mês / geral. Identidade do jogador é pelo NOME (normalizado).

const KEY = 'lc_rankings_v1';

export interface MatchPlacement {
    name: string;
    place: number;
    points: number;
}

export interface MatchResult {
    id: string;
    startedAt: number;
    endedAt: number;
    durationMs: number;
    mode: string;
    placements: MatchPlacement[]; // ordenado por place asc (1, 2, 3, ...)
    manual: boolean;
}

export interface AggregateRow {
    name: string;
    points: number;
    matches: number;
    wins: number;
}

export type RankingPeriod = 'today' | 'month' | 'all';

function readAll(): MatchResult[] {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeAll(list: MatchResult[]): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
        /* localStorage cheio/desabilitado: ignora */
    }
}

export function saveResult(r: MatchResult): void {
    const list = readAll();
    if (list.find((x) => x.id === r.id)) return; // dedup pela id
    list.push(r);
    // Mantém os mais recentes primeiro pra debug
    list.sort((a, b) => b.endedAt - a.endedAt);
    writeAll(list);
}

export function getAll(): MatchResult[] {
    return readAll();
}

export function deleteResult(id: string): void {
    writeAll(readAll().filter((r) => r.id !== id));
}

export function clearAll(): void {
    writeAll([]);
}

function startOfDay(d: Date): number {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function startOfMonth(d: Date): number {
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function aggregate(period: RankingPeriod, ref: Date = new Date()): AggregateRow[] {
    const list = readAll();
    const cutoff = period === 'today' ? startOfDay(ref) : period === 'month' ? startOfMonth(ref) : 0;
    const map: Record<string, AggregateRow> = {};

    for (const r of list) {
        if (r.endedAt < cutoff) continue;
        for (const p of r.placements) {
            const key = (p.name || '').trim().toLowerCase();
            if (!key) continue;
            if (!map[key]) map[key] = { name: p.name, points: 0, matches: 0, wins: 0 };
            map[key].points += p.points;
            map[key].matches += 1;
            if (p.place === 1) map[key].wins += 1;
        }
    }
    return Object.values(map).sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
}

// Constrói o resultado automaticamente quando há um vencedor no estado.
// Ordem: vencedor = 1º; eliminados em ORDEM INVERSA (último eliminado = 2º, ...,
// primeiro eliminado = último colocado). Pontos = N - place + 1.
export function buildAutoResult(state: {
    winner: string | null;
    players: Array<{ id: string; name: string }>;
    history: Array<{ type: string; playerId?: string; timestamp?: number }>;
    gameStartTime: number | null;
    gameMode?: string;
}): MatchResult | null {
    if (!state.winner) return null;
    const N = state.players.length;
    if (N < 1) return null;

    const winnerId = state.winner;
    const order: string[] = [];
    if (state.players.some((p) => p.id === winnerId)) order.push(winnerId);

    const eliminations = (state.history || []).filter((e) => e.type === 'player_eliminated' && e.playerId) as Array<{ playerId: string }>;
    for (let i = eliminations.length - 1; i >= 0; i--) {
        const id = eliminations[i].playerId;
        if (id && !order.includes(id)) order.push(id);
    }
    for (const p of state.players) if (!order.includes(p.id)) order.push(p.id);

    const placements: MatchPlacement[] = order.map((id, idx) => {
        const p = state.players.find((x) => x.id === id);
        const place = idx + 1;
        return { name: p ? p.name : `Jogador ${idx + 1}`, place, points: N - place + 1 };
    });

    const startedAt = state.gameStartTime || Date.now();
    return {
        id: 'm_' + startedAt,
        startedAt,
        endedAt: Date.now(),
        durationMs: Math.max(0, Date.now() - startedAt),
        mode: state.gameMode || 'standard',
        placements,
        manual: false,
    };
}

// Versão "manual" (vinda do modal de pódio quando a partida foi resetada sem vencedor).
export function buildManualResult(
    placements: MatchPlacement[],
    state: { gameStartTime: number | null; gameMode?: string },
): MatchResult {
    const startedAt = state.gameStartTime || Date.now();
    return {
        id: 'mm_' + startedAt + '_' + Date.now(),
        startedAt,
        endedAt: Date.now(),
        durationMs: Math.max(0, Date.now() - startedAt),
        mode: state.gameMode || 'standard',
        placements,
        manual: true,
    };
}

// Atribui pontos a uma ordem de jogadores: posição 1..N.
export function placementsFromOrder(orderedNames: string[]): MatchPlacement[] {
    const N = orderedNames.length;
    return orderedNames.map((name, idx) => ({ name, place: idx + 1, points: N - idx }));
}
