// ===== State Management =====

import {
    GameState,
    GameSettings,
    Player,
    PlayerCounters,
    GameEvent,
    EventType,
    EventDetails,
    UndoAction,
    LayoutConfig,
    GameMode,
    ThemePreset,
    RandomAnimationType,
    Team,
    TableMechanics,
    DEFAULT_PLAYER_COLORS,
    COMMANDER_DAMAGE_LETHAL,
    LAYOUT_PRESETS,
} from './types.js';

// Two-Headed Giant starting life per team
export const TWO_HEADED_GIANT_STARTING_LIFE = 30;

// Generate unique ID
export function generateId(): string {
    // Use crypto for better randomness
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const array = new Uint32Array(2);
        crypto.getRandomValues(array);
        return array[0].toString(36) + array[1].toString(36);
    }
    return Math.random().toString(36).substring(2, 11);
}

// Cryptographically secure random number between 0 and 1
export function secureRandom(): number {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return array[0] / (0xFFFFFFFF + 1);
    }
    return Math.random();
}

// Secure random integer from 0 to max-1 (unbiased)
export function secureRandomInt(max: number): number {
    if (max <= 0) return 0;
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        // Use rejection sampling to avoid modulo bias
        const maxValid = Math.floor(0xFFFFFFFF / max) * max;
        let value: number;
        do {
            const array = new Uint32Array(1);
            crypto.getRandomValues(array);
            value = array[0];
        } while (value >= maxValid);
        return value % max;
    }
    return Math.floor(Math.random() * max);
}

// Fisher-Yates shuffle with secure random
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = secureRandomInt(i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Create default player
export function createPlayer(index: number, startingLife: number, totalPlayers: number): Player {
    // Calculate rotation based on position for table mode
    const rotation = calculatePlayerRotation(index, totalPlayers);

    return {
        id: generateId(),
        name: `Jogador ${index + 1}`,
        color: DEFAULT_PLAYER_COLORS[index % DEFAULT_PLAYER_COLORS.length],
        avatar: null,
        profileId: null,
        background: null,
        backgroundType: 'none',
        emoji: null,
        tag: null,
        life: startingLife,
        isEliminated: false,
        isMonarch: false,
        counters: {
            poison: 0,
            experience: 0,
            energy: 0,
            storm: 0,
            custom: [],
        },
        commanderDamage: {},
        commanderDeaths: 0,
        customSounds: {
            death: null,
            win: null,
            damage: null,
        },
        rotation,
        teamId: null,
    };
}

// Calculate rotation for table mode based on player position
function calculatePlayerRotation(index: number, totalPlayers: number): number {
    // For 2 players: top player rotated 180°
    if (totalPlayers === 2) {
        return index === 0 ? 180 : 0;
    }

    // For more players, calculate based on position
    // Top row players: 180°, bottom row: 0°, sides: 90° or 270°
    const defaultLayout = LAYOUT_PRESETS[totalPlayers]?.[0];
    if (!defaultLayout) return 0;

    let playerIndex = 0;
    for (let rowIdx = 0; rowIdx < defaultLayout.rows.length; rowIdx++) {
        const playersInRow = defaultLayout.rows[rowIdx];
        if (index < playerIndex + playersInRow) {
            // Player is in this row
            if (rowIdx === 0) return 180; // Top row
            if (rowIdx === defaultLayout.rows.length - 1) return 0; // Bottom row
            return 0; // Middle rows
        }
        playerIndex += playersInRow;
    }

    return 0;
}

// Get default layout for player count
function getDefaultLayout(playerCount: number): LayoutConfig {
    const presets = LAYOUT_PRESETS[playerCount];
    if (presets && presets.length > 0) {
        return { ...presets[0] };
    }
    // Fallback: all players in rows of 2
    const rows: number[] = [];
    let remaining = playerCount;
    while (remaining > 0) {
        rows.push(Math.min(remaining, 2));
        remaining -= 2;
    }
    return { rows, tableMode: true, preset: null };
}

// Create default settings
export function createDefaultSettings(playerCount: number = 4): GameSettings {
    return {
        startingLife: 40,
        playerCount,
        soundEnabled: true,
        volume: 50,
        animationsEnabled: true,
        animationIntensity: 'normal',
        turnTimerEnabled: false,
        turnTimerDuration: 120,
        theme: 'dark',
        layout: getDefaultLayout(playerCount),
        randomStarterAnimation: 'highlight',
        confirmCriticalActions: false,
        showSpecialMoments: true,
        showCommanderDeaths: true,
        gifPaused: false,
        gifFpsReduced: false,
        easterEggsEnabled: true,
        escandalosaEnabled: true,
        animatedBgEnabled: false,
        animatedBgStyle: 'none',
        fontStyle: 'default',
        ambientMusicEnabled: false,
        ambientMusicVolume: 30,
        ambientMusicTrack: 'none',
        narratorEnabled: false,
        narratorVoice: 'default',
        narratorSpeed: 1,
        narratorVolume: 80,
        silentMode: false,
        narratorPersona: 'classic',
        soundPack: 'default',
    };
}

// Create initial game state
export function createInitialState(): GameState {
    const settings = createDefaultSettings();
    return {
        players: Array.from({ length: settings.playerCount }, (_, i) =>
            createPlayer(i, settings.startingLife, settings.playerCount)
        ),
        teams: [],
        settings,
        currentTurn: 1,
        activePlayerIndex: 0,
        turnStartTime: null,
        gameStartTime: null,
        gameStarted: false,
        winner: null,
        matchClosed: false,
        history: [],
        undoStack: [],
        gameMode: 'standard',
        randomStarterInProgress: false,
        viadoPlayerId: null,
        mechanics: createDefaultMechanics(),
    };
}

export function createDefaultMechanics(): TableMechanics {
    return {
        dayNight: 'none',
        planeDeck: [],
        planeDiscard: [],
        currentPlane: null,
        phenomenonActive: null,
        schemeDeck: [],
        schemeDiscard: [],
        currentScheme: null,
        ongoingSchemes: [],
        archenemyPlayerId: null,
    };
}

// State management class
class GameStateManager {
    private state: GameState;
    private listeners: Set<(state: GameState) => void>;
    private storageKey = 'mtg-life-counter-state';
    private undoTimeWindow = 10000; // 10 seconds to undo

    constructor() {
        this.state = this.loadState() || createInitialState();
        this.listeners = new Set();
        // Ensure rotations are consistent with current layout
        this.updatePlayerRotations();
        // Clean old undo actions periodically
        setInterval(() => this.cleanOldUndoActions(), 5000);
    }

    // Get current state
    getState(): GameState {
        return this.state;
    }

    // Subscribe to state changes
    subscribe(listener: (state: GameState) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    // Notify all listeners
    private notify(): void {
        this.listeners.forEach(listener => listener(this.state));
        this.saveState();
    }

    // Save state to localStorage
    private saveState(): void {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (e) {
            console.warn('Failed to save state:', e);
        }
    }

    // Load state from localStorage
    private loadState(): GameState | null {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Ensure new properties exist
                if (!parsed.undoStack) parsed.undoStack = [];
                if (parsed.matchClosed === undefined) parsed.matchClosed = false;
                if (!parsed.mechanics) parsed.mechanics = createDefaultMechanics();
                // Partida salva antes da base única (jogadores sem perfil) ou velha demais
                // (mais de 12 h): fica "encerrada" para nunca entrar no ranking por engano.
                const legacyPlayers = Array.isArray(parsed.players) && parsed.players.some((p: any) => p.profileId === null || p.profileId === undefined);
                const tooOld = parsed.gameStartTime && Date.now() - parsed.gameStartTime > 12 * 60 * 60 * 1000;
                if (parsed.gameStarted && (legacyPlayers || tooOld)) parsed.matchClosed = true;
                if (!parsed.gameMode) parsed.gameMode = 'standard';
                if (parsed.randomStarterInProgress === undefined) parsed.randomStarterInProgress = false;
                if (parsed.viadoPlayerId === undefined) parsed.viadoPlayerId = null;
                if (!parsed.teams) parsed.teams = [];
                if (!parsed.settings.layout) {
                    parsed.settings.layout = getDefaultLayout(parsed.settings.playerCount);
                }
                if (!parsed.settings.theme) parsed.settings.theme = 'dark';
                if (!parsed.settings.randomStarterAnimation) parsed.settings.randomStarterAnimation = 'highlight';
                if (!parsed.settings.animationIntensity) parsed.settings.animationIntensity = 'normal';
                if (parsed.settings.showCommanderDeaths === undefined) parsed.settings.showCommanderDeaths = true;
                if (parsed.settings.escandalosaEnabled === undefined) parsed.settings.escandalosaEnabled = true;
                if (parsed.settings.animatedBgEnabled === undefined) parsed.settings.animatedBgEnabled = false;
                if (!parsed.settings.animatedBgStyle) parsed.settings.animatedBgStyle = 'none';
                if (!parsed.settings.fontStyle) parsed.settings.fontStyle = 'default';
                if (parsed.settings.ambientMusicEnabled === undefined) parsed.settings.ambientMusicEnabled = false;
                if (parsed.settings.ambientMusicVolume === undefined) parsed.settings.ambientMusicVolume = 30;
                if (!parsed.settings.ambientMusicTrack) parsed.settings.ambientMusicTrack = 'none';
                if (parsed.settings.narratorEnabled === undefined) parsed.settings.narratorEnabled = false;
                if (!parsed.settings.narratorVoice) parsed.settings.narratorVoice = 'default';
                if (parsed.settings.narratorSpeed === undefined) parsed.settings.narratorSpeed = 1;
                if (parsed.settings.narratorVolume === undefined) parsed.settings.narratorVolume = 80;
                if (parsed.settings.silentMode === undefined) parsed.settings.silentMode = false;
                if (!parsed.settings.soundPack) parsed.settings.soundPack = 'default';
                // Ensure all players have new properties (migration for older saves)
                parsed.players = parsed.players.map((p: Player) => ({
                    ...p,
                    profileId: p.profileId ?? null,
                    deckId: p.deckId ?? null,
                    deckName: p.deckName ?? null,
                    manualRotation: p.manualRotation ?? 0,
                    background: p.background ?? null,
                    backgroundType: p.backgroundType ?? 'none' as const,
                    emoji: p.emoji ?? null,
                    tag: p.tag ?? null,
                    rotation: p.rotation ?? 0,
                    commanderDeaths: p.commanderDeaths ?? 0,
                    teamId: p.teamId ?? null,
                }));
                return parsed;
            }
        } catch (e) {
            console.warn('Failed to load state:', e);
        }
        return null;
    }

    // Clear saved state
    clearSavedState(): void {
        localStorage.removeItem(this.storageKey);
    }

    // Add event to history (mais recente primeiro). O log é COMPLETO: a partida
    // inteira vai pro servidor no fim (histórico, gráfico, conquistas).
    private addEvent(type: EventType, playerId: string, details: EventDetails): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (details.fromPlayerId && !details.fromPlayerName) {
            details.fromPlayerName = this.state.players.find(p => p.id === details.fromPlayerId)?.name;
        }
        const event: GameEvent = {
            id: generateId(),
            timestamp: Date.now(),
            type,
            playerId,
            details,
            turn: this.state.currentTurn,
            playerName: player?.name,
        };
        this.state.history.unshift(event);
        // Trava de segurança só pra não estourar o localStorage (uma partida real fica bem abaixo disso).
        if (this.state.history.length > 5000) {
            this.state.history = this.state.history.slice(0, 5000);
        }
    }

    // ===== Undo System (por snapshot) =====
    // Antes de cada ação guardamos uma cópia da mesa inteira. Desfazer = voltar
    // a cópia. Cobre vida, comandante, contadores (inclusive custom), veneno,
    // monarca, morte/revive — tudo que mexe nos jogadores.

    private addUndoAction(type: string, playerId: string, _previousState: Partial<Player>, description: string): void {
        const now = Date.now();
        const action: UndoAction = {
            id: generateId(),
            timestamp: now,
            type,
            playerId,
            description,
            snapshot: {
                players: JSON.parse(JSON.stringify(this.state.players)),
                teams: JSON.parse(JSON.stringify(this.state.teams)),
                winner: this.state.winner,
                viadoPlayerId: this.state.viadoPlayerId,
                activePlayerIndex: this.state.activePlayerIndex,
                currentTurn: this.state.currentTurn,
                historyLength: this.state.history.length,
            },
        };
        this.state.undoStack.push(action);
        if (this.state.undoStack.length > 30) {
            this.state.undoStack = this.state.undoStack.slice(-30);
        }
    }

    private cleanOldUndoActions(): void {
        const now = Date.now();
        const before = this.state.undoStack.length;
        this.state.undoStack = this.state.undoStack.filter(
            action => now - action.timestamp < this.undoTimeWindow
        );
        // Snapshots são pesados: salva o estado sem eles assim que expiram.
        if (before !== this.state.undoStack.length) this.saveState();
    }

    canUndo(): boolean {
        const now = Date.now();
        return this.state.undoStack.some(
            action => now - action.timestamp < this.undoTimeWindow
        );
    }

    lastUndoDescription(): string | null {
        const now = Date.now();
        for (let i = this.state.undoStack.length - 1; i >= 0; i--) {
            const a = this.state.undoStack[i];
            if (now - a.timestamp < this.undoTimeWindow) return a.description;
        }
        return null;
    }

    undo(): UndoAction | null {
        const now = Date.now();
        for (let i = this.state.undoStack.length - 1; i >= 0; i--) {
            const action = this.state.undoStack[i];
            if (now - action.timestamp >= this.undoTimeWindow) continue;
            this.state.undoStack.splice(i, 1);

            if (action.snapshot) {
                const s = action.snapshot;
                // Preserva as fotos/perfis atuais (não fazem parte da jogada).
                this.state.players = s.players.map(sp => {
                    const cur = this.state.players.find(p => p.id === sp.id);
                    return cur ? { ...sp, name: cur.name, avatar: cur.avatar, profileId: cur.profileId, color: cur.color, emoji: cur.emoji, background: cur.background, backgroundType: cur.backgroundType } : sp;
                });
                this.state.teams = s.teams;
                this.state.winner = s.winner;
                this.state.viadoPlayerId = s.viadoPlayerId;
                this.state.activePlayerIndex = s.activePlayerIndex;
                this.state.currentTurn = s.currentTurn;
                // Remove do log os eventos gerados pela ação desfeita.
                const extra = this.state.history.length - s.historyLength;
                if (extra > 0) this.state.history = this.state.history.slice(extra);
            } else if (action.previousState) {
                // Formato antigo (save anterior à versão com snapshot).
                const player = this.state.players.find(p => p.id === action.playerId);
                if (player) {
                    Object.assign(player, action.previousState);
                    if (action.previousState.life !== undefined && action.previousState.life > 0) {
                        player.isEliminated = false;
                    }
                }
                this.state.winner = null;
            }

            this.addEvent('undo', action.playerId, { message: action.description });
            this.notify();
            return action;
        }
        return null;
    }

    // ===== Setup Actions =====

    setPlayerCount(count: number): void {
        const currentCount = this.state.players.length;
        if (count > currentCount) {
            for (let i = currentCount; i < count; i++) {
                this.state.players.push(createPlayer(i, this.state.settings.startingLife, count));
            }
        } else if (count < currentCount) {
            this.state.players = this.state.players.slice(0, count);
        }
        this.state.settings.playerCount = count;
        this.state.settings.layout = getDefaultLayout(count);

        // Recalculate rotations
        this.updatePlayerRotations();
        this.notify();
    }

    setStartingLife(life: number): void {
        this.state.settings.startingLife = life;
        if (!this.state.gameStarted) {
            this.state.players.forEach(player => {
                player.life = life;
            });
        }
        this.notify();
    }

    updatePlayerSetup(playerId: string, updates: Partial<Player>): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (player) {
            Object.assign(player, updates);
            this.notify();
        }
    }

    // ===== Layout Actions =====

    setLayout(layout: LayoutConfig): void {
        this.state.settings.layout = layout;
        this.updatePlayerRotations();
        this.notify();
    }

    setLayoutPreset(presetName: string): void {
        const presets = LAYOUT_PRESETS[this.state.settings.playerCount];
        if (presets) {
            const preset = presets.find(p => p.preset === presetName);
            if (preset) {
                this.setLayout({ ...preset });
            }
        }
    }

    toggleTableMode(enabled: boolean): void {
        this.state.settings.layout.tableMode = enabled;
        this.updatePlayerRotations();
        this.notify();
    }

    setCustomLayout(rows: number[]): void {
        const total = rows.reduce((a, b) => a + b, 0);
        if (total === this.state.settings.playerCount) {
            this.state.settings.layout = {
                rows,
                tableMode: this.state.settings.layout.tableMode,
                preset: null,
            };
            this.updatePlayerRotations();
            this.notify();
        }
    }

    private updatePlayerRotations(): void {
        const { layout, playerCount } = this.state.settings;
        if (!layout.tableMode) {
            this.state.players.forEach(p => p.rotation = 0);
            return;
        }

        let playerIndex = 0;
        for (let rowIdx = 0; rowIdx < layout.rows.length; rowIdx++) {
            const playersInRow = layout.rows[rowIdx];
            for (let i = 0; i < playersInRow; i++) {
                if (playerIndex < this.state.players.length) {
                    // Top row: 180°, Bottom row: 0°
                    if (rowIdx === 0) {
                        this.state.players[playerIndex].rotation = 180;
                    } else if (rowIdx === layout.rows.length - 1) {
                        this.state.players[playerIndex].rotation = 0;
                    } else {
                        // Middle rows: could be sides
                        this.state.players[playerIndex].rotation = 0;
                    }
                    playerIndex++;
                }
            }
        }
    }

    // ===== Theme Actions =====

    setTheme(theme: ThemePreset): void {
        this.state.settings.theme = theme;
        this.notify();
    }

    // ===== Game Mode Actions =====

    setGameMode(mode: GameMode): void {
        this.state.gameMode = mode;

        // If switching to Two-Headed Giant, setup teams
        if (mode === 'two-headed') {
            this.setupTwoHeadedGiant();
        } else {
            // Clear teams when leaving Two-Headed Giant
            this.clearTeams();
        }

        this.notify();
    }

    // ===== Two-Headed Giant Mode =====

    setupTwoHeadedGiant(): void {
        // Two-Headed Giant requires 4 players in 2 teams
        if (this.state.settings.playerCount !== 4) {
            this.setPlayerCount(4);
        }

        // Create 2 teams
        const team1Id = generateId();
        const team2Id = generateId();

        const team1: Team = {
            id: team1Id,
            name: 'Time 1',
            color: '#6366f1',
            playerIds: [this.state.players[0].id, this.state.players[1].id],
            life: TWO_HEADED_GIANT_STARTING_LIFE,
            isEliminated: false,
        };

        const team2: Team = {
            id: team2Id,
            name: 'Time 2',
            color: '#ec4899',
            playerIds: [this.state.players[2].id, this.state.players[3].id],
            life: TWO_HEADED_GIANT_STARTING_LIFE,
            isEliminated: false,
        };

        this.state.teams = [team1, team2];

        // Assign players to teams and set their life to team life
        this.state.players[0].teamId = team1Id;
        this.state.players[1].teamId = team1Id;
        this.state.players[0].life = TWO_HEADED_GIANT_STARTING_LIFE;
        this.state.players[1].life = TWO_HEADED_GIANT_STARTING_LIFE;
        this.state.players[0].tag = 'Time 1';
        this.state.players[1].tag = 'Time 1';

        this.state.players[2].teamId = team2Id;
        this.state.players[3].teamId = team2Id;
        this.state.players[2].life = TWO_HEADED_GIANT_STARTING_LIFE;
        this.state.players[3].life = TWO_HEADED_GIANT_STARTING_LIFE;
        this.state.players[2].tag = 'Time 2';
        this.state.players[3].tag = 'Time 2';

        // Set starting life to team life for settings
        this.state.settings.startingLife = TWO_HEADED_GIANT_STARTING_LIFE;

        // Use 2x2 layout
        this.state.settings.layout = { rows: [2, 2], tableMode: true, preset: '4-square' };
        this.updatePlayerRotations();
    }

    clearTeams(): void {
        this.state.teams = [];
        this.state.players.forEach(p => {
            p.teamId = null;
        });
    }

    getTeamForPlayer(playerId: string): Team | null {
        const player = this.state.players.find(p => p.id === playerId);
        if (!player || !player.teamId) return null;
        return this.state.teams.find(t => t.id === player.teamId) || null;
    }

    getTeammateId(playerId: string): string | null {
        const team = this.getTeamForPlayer(playerId);
        if (!team) return null;
        return team.playerIds.find(id => id !== playerId) || null;
    }

    // Sync team life when a player's life changes in Two-Headed Giant
    private syncTeamLife(playerId: string): void {
        if (this.state.gameMode !== 'two-headed') return;

        const team = this.getTeamForPlayer(playerId);
        if (!team) return;

        const player = this.state.players.find(p => p.id === playerId);
        if (!player) return;

        // Update team life to match player's life
        team.life = player.life;

        // Sync teammate's life
        const teammateId = this.getTeammateId(playerId);
        if (teammateId) {
            const teammate = this.state.players.find(p => p.id === teammateId);
            if (teammate) {
                teammate.life = player.life;
            }
        }

        // Check team elimination
        if (team.life <= 0 && !team.isEliminated) {
            team.isEliminated = true;
            team.playerIds.forEach(pid => {
                const p = this.state.players.find(pl => pl.id === pid);
                if (p && !p.isEliminated) {
                    p.isEliminated = true;
                    this.addEvent('player_eliminated', pid, { message: `${team.name} eliminado` });
                }
            });

            // Check for winner
            const aliveTeams = this.state.teams.filter(t => !t.isEliminated);
            if (aliveTeams.length === 1) {
                // All players in the winning team win
                const winningTeam = aliveTeams[0];
                this.state.winner = winningTeam.playerIds[0]; // First player as winner reference
                this.addEvent('player_win', winningTeam.playerIds[0], { message: `${winningTeam.name} venceu!` });
            }
        }
    }

    // ===== Random Starter =====

    setRandomStarterInProgress(inProgress: boolean): void {
        this.state.randomStarterInProgress = inProgress;
        this.notify();
    }

    selectRandomStarter(): number {
        const alivePlayers = this.state.players
            .map((p, i) => ({ player: p, index: i }))
            .filter(({ player }) => !player.isEliminated);

        if (alivePlayers.length === 0) return 0;

        // Shuffle first, then pick - double randomization for fairness
        const shuffled = shuffleArray(alivePlayers);
        const randomIndex = secureRandomInt(shuffled.length);
        const selected = shuffled[randomIndex];

        this.state.activePlayerIndex = selected.index;
        this.addEvent('random_starter', selected.player.id, {});
        this.notify();

        return selected.index;
    }

    setRandomStarterAnimation(type: RandomAnimationType): void {
        this.state.settings.randomStarterAnimation = type;
        this.notify();
    }

    // ===== Sortear Viado =====

    // Names that cannot be selected (case insensitive)
    private readonly protectedNames = ['reis', 'kings', 'matheus'];

    sortearViado(): Player | null {
        // Filter out players with protected names
        const eligiblePlayers = this.state.players.filter(player => {
            const nameLower = player.name.toLowerCase();
            return !this.protectedNames.some(protectedName => nameLower.includes(protectedName));
        });

        if (eligiblePlayers.length === 0) {
            return null; // No eligible players
        }

        // Shuffle first, then pick - double randomization for fairness
        const shuffled = shuffleArray(eligiblePlayers);
        const randomIndex = secureRandomInt(shuffled.length);
        const selected = shuffled[randomIndex];

        this.state.viadoPlayerId = selected.id;
        this.notify();

        return selected;
    }

    clearViado(): void {
        this.state.viadoPlayerId = null;
        this.notify();
    }

    getViado(): Player | null {
        if (!this.state.viadoPlayerId) return null;
        return this.state.players.find(p => p.id === this.state.viadoPlayerId) || null;
    }

    // ===== Game Actions =====

    startGame(): void {
        this.state.players.forEach(player => {
            player.commanderDamage = {};
            this.state.players.forEach(otherPlayer => {
                if (otherPlayer.id !== player.id) {
                    player.commanderDamage[otherPlayer.id] = 0;
                }
            });
        });
        // Recalculate rotations to ensure they match current layout
        this.updatePlayerRotations();
        this.state.gameStarted = true;
        this.state.gameStartTime = Date.now();
        this.state.currentTurn = 1;
        this.state.turnStartTime = Date.now();
        this.state.winner = null;
        this.state.matchClosed = false;
        this.state.history = [];
        this.state.undoStack = [];
        this.state.mechanics = { ...createDefaultMechanics(), dayNight: this.state.mechanics?.dayNight === 'none' ? 'none' : 'none' };
        this.notify();
    }

    resetGame(resetCommanderDeaths: boolean = false): void {
        this.state.players.forEach(player => {
            player.life = this.state.settings.startingLife;
            player.isEliminated = false;
            player.isMonarch = false;
            player.counters = {
                poison: 0,
                experience: 0,
                energy: 0,
                storm: 0,
                custom: [],
            };
            player.commanderDamage = {};
            this.state.players.forEach(otherPlayer => {
                if (otherPlayer.id !== player.id) {
                    player.commanderDamage[otherPlayer.id] = 0;
                }
            });
            // Optionally reset commander deaths
            if (resetCommanderDeaths) {
                player.commanderDeaths = 0;
            }
        });
        this.state.currentTurn = 1;
        this.state.activePlayerIndex = 0;
        this.state.turnStartTime = Date.now();
        this.state.gameStartTime = Date.now(); // Reset game timer
        this.state.winner = null;
        this.state.matchClosed = false;
        this.state.viadoPlayerId = null; // Clear viado marker
        this.state.history = [];
        this.state.undoStack = [];
        this.state.mechanics = createDefaultMechanics();
        this.notify();
    }

    newGame(): void {
        const playerCount = this.state.settings.playerCount;
        // Mantém quem estava na mesa (perfil, nome, foto, cor): a identidade é
        // obrigatória pra iniciar, então não faz sentido pedir tudo de novo.
        const roster = this.state.players.map(p => ({
            profileId: p.profileId ?? null, name: p.name, avatar: p.avatar, color: p.color, emoji: p.emoji,
            deckId: p.deckId ?? null, deckName: p.deckName ?? null,
        }));
        this.state = createInitialState();
        this.state.settings.playerCount = playerCount;
        this.state.settings.layout = getDefaultLayout(playerCount);
        this.state.players = Array.from({ length: playerCount }, (_, i) => {
            const player = createPlayer(i, this.state.settings.startingLife, playerCount);
            const prev = roster[i];
            if (prev && prev.profileId !== null) {
                player.profileId = prev.profileId;
                player.name = prev.name;
                player.avatar = prev.avatar;
                player.color = prev.color;
                player.emoji = prev.emoji;
                player.deckId = prev.deckId;
                player.deckName = prev.deckName;
            }
            return player;
        });
        this.notify();
    }

    // ===== Life Actions =====

    // source: de onde veio o toque (tap/hold/voice/shortcut); fromPlayerId: quem
    // causou (quando se sabe, ex.: "A matou B" por voz). Tudo vai pro log.
    changeLife(playerId: string, amount: number, source: EventDetails['source'] = 'tap', fromPlayerId?: string): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (player && !player.isEliminated) {
            // Save for undo
            this.addUndoAction('life_change', playerId, { life: player.life },
                `${player.name}: ${amount > 0 ? '+' : ''}${amount} vida`);

            const previousLife = player.life;
            player.life += amount;

            this.addEvent('life_change', playerId, {
                amount,
                previousValue: previousLife,
                newValue: player.life,
                source,
                fromPlayerId,
            });

            // Sync team life in Two-Headed Giant mode
            this.syncTeamLife(playerId);

            this.checkEliminationConditions(playerId);
            this.notify();
        }
    }

    setLife(playerId: string, value: number, source: EventDetails['source'] = 'modal'): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (player && !player.isEliminated) {
            this.addUndoAction('life_set', playerId, { life: player.life },
                `${player.name}: vida definida para ${value}`);

            const previousLife = player.life;
            player.life = value;

            this.addEvent('life_change', playerId, {
                amount: value - previousLife,
                previousValue: previousLife,
                newValue: value,
                source,
            });

            // Sync team life in Two-Headed Giant mode
            this.syncTeamLife(playerId);

            this.checkEliminationConditions(playerId);
            this.notify();
        }
    }

    // ===== Commander Damage Actions =====

    addCommanderDamage(targetPlayerId: string, sourcePlayerId: string, amount: number): void {
        const targetPlayer = this.state.players.find(p => p.id === targetPlayerId);
        if (targetPlayer && !targetPlayer.isEliminated) {
            const previousDamage = targetPlayer.commanderDamage[sourcePlayerId] || 0;
            const previousLife = targetPlayer.life;

            this.addUndoAction('commander_damage', targetPlayerId, {
                commanderDamage: { ...targetPlayer.commanderDamage },
                life: targetPlayer.life,
            }, `Dano de comandante: ${amount > 0 ? '+' : ''}${amount}`);

            const newDamage = Math.max(0, previousDamage + amount);
            targetPlayer.commanderDamage[sourcePlayerId] = newDamage;

            // Adjust life based on actual damage change
            // actualChange is positive when adding damage (life decreases)
            // actualChange is negative when removing damage (life increases)
            const actualChange = newDamage - previousDamage;
            targetPlayer.life -= actualChange;

            this.addEvent('commander_damage', targetPlayerId, {
                amount: actualChange,
                fromPlayerId: sourcePlayerId,
                previousValue: previousDamage,
                newValue: newDamage,
                source: 'commander',
            });

            this.syncTeamLife(targetPlayerId);
            this.checkEliminationConditions(targetPlayerId);
            this.notify();
        }
    }

    // ===== Counter Actions =====

    changeCounter(playerId: string, counterType: keyof Omit<PlayerCounters, 'custom'>, amount: number): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (player) {
            const previousValue = player.counters[counterType] as number;

            this.addUndoAction('counter_change', playerId, {
                counters: { ...player.counters },
            }, `${counterType}: ${amount > 0 ? '+' : ''}${amount}`);

            (player.counters[counterType] as number) = Math.max(0, previousValue + amount);
            const newValue = player.counters[counterType] as number;

            this.addEvent('counter_change', playerId, {
                amount,
                counterType,
                previousValue,
                newValue,
            });

            if (counterType === 'poison' && newValue >= 10) {
                this.eliminatePlayer(playerId, 'poison', undefined, true);
            }

            this.notify();
        }
    }

    addCustomCounter(playerId: string, name: string, icon?: string): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (player) {
            player.counters.custom.push({
                id: generateId(),
                name,
                value: 0,
                icon,
            });
            this.notify();
        }
    }

    changeCustomCounter(playerId: string, counterId: string, amount: number): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (player) {
            const counter = player.counters.custom.find(c => c.id === counterId);
            if (counter) {
                this.addUndoAction('custom_counter', playerId, {}, `${player.name}: ${counter.name} ${amount > 0 ? '+' : ''}${amount}`);
                const previousValue = counter.value;
                counter.value = Math.max(0, counter.value + amount);
                this.addEvent('custom_counter', playerId, {
                    amount,
                    counterType: counter.id,
                    counterName: counter.name,
                    previousValue,
                    newValue: counter.value,
                });
                this.notify();
            }
        }
    }

    removeCustomCounter(playerId: string, counterId: string): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (player) {
            player.counters.custom = player.counters.custom.filter(c => c.id !== counterId);
            this.notify();
        }
    }

    // ===== Monarch Actions =====

    setMonarch(playerId: string): void {
        const target = this.state.players.find(p => p.id === playerId);
        if (!target || target.isMonarch) return;
        this.addUndoAction('monarch', playerId, {}, `${target.name} virou o monarca`);
        this.state.players.forEach(player => {
            player.isMonarch = player.id === playerId;
        });
        this.addEvent('monarch_change', playerId, {});
        this.notify();
    }

    removeMonarch(): void {
        const current = this.state.players.find(p => p.isMonarch);
        if (!current) return;
        this.addUndoAction('monarch', current.id, {}, `${current.name} deixou de ser monarca`);
        this.state.players.forEach(player => {
            player.isMonarch = false;
        });
        this.addEvent('monarch_removed', current.id, {});
        this.notify();
    }

    // ===== Commander Deaths (Tax) Actions =====

    changeCommanderDeaths(playerId: string, amount: number): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (player) {
            const previousValue = player.commanderDeaths;
            const newValue = Math.max(0, player.commanderDeaths + amount);

            this.addUndoAction('commander_deaths', playerId, {
                commanderDeaths: previousValue,
            }, `${player.name}: Mortes do comandante ${amount > 0 ? '+' : ''}${amount}`);

            player.commanderDeaths = newValue;

            this.addEvent('commander_death', playerId, {
                amount,
                counterType: 'commanderDeaths',
                previousValue,
                newValue,
            });

            this.notify();
        }
    }

    resetCommanderDeaths(playerId: string): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (player && player.commanderDeaths > 0) {
            const previousValue = player.commanderDeaths;

            this.addUndoAction('commander_deaths', playerId, {
                commanderDeaths: previousValue,
            }, `${player.name}: Mortes do comandante resetadas`);

            player.commanderDeaths = 0;
            this.notify();
        }
    }

    resetAllCommanderDeaths(): void {
        this.state.players.forEach(player => {
            player.commanderDeaths = 0;
        });
        this.notify();
    }

    // ===== Turn Actions =====

    // Calculate clockwise turn order based on layout
    private getClockwiseTurnOrder(): number[] {
        const { layout, playerCount } = this.state.settings;
        const rows = layout.rows;

        // For single row layouts, just return linear order
        if (rows.length === 1) {
            return Array.from({ length: playerCount }, (_, i) => i);
        }

        // For multi-row layouts, calculate clockwise order
        // Top row goes left to right, bottom row goes right to left
        const order: number[] = [];
        let playerIndex = 0;

        // Build a 2D map of player positions
        const grid: number[][] = [];
        for (const playersInRow of rows) {
            const row: number[] = [];
            for (let i = 0; i < playersInRow; i++) {
                row.push(playerIndex++);
            }
            grid.push(row);
        }

        // For 2 rows: top left→right, then bottom right→left (clockwise)
        if (grid.length === 2) {
            // Top row: left to right
            order.push(...grid[0]);
            // Bottom row: right to left
            order.push(...grid[1].slice().reverse());
        }
        // For 3+ rows: top row left→right, middle rows alternate, bottom row right→left
        else {
            // Top row: left to right
            order.push(...grid[0]);
            // Middle rows and bottom: traverse clockwise (right side down, bottom right→left, left side up)
            // Simplified: for now just do top L→R, bottom R→L
            for (let r = 1; r < grid.length; r++) {
                if (r === grid.length - 1) {
                    // Bottom row: right to left
                    order.push(...grid[r].slice().reverse());
                } else {
                    // Middle rows: just add last element (right side)
                    order.push(grid[r][grid[r].length - 1]);
                }
            }
            // Add remaining middle row elements going up on the left side
            for (let r = grid.length - 2; r >= 1; r--) {
                for (let c = grid[r].length - 2; c >= 0; c--) {
                    order.push(grid[r][c]);
                }
            }
        }

        return order;
    }

    private getNextPlayerInClockwiseOrder(currentIndex: number): number {
        const order = this.getClockwiseTurnOrder();
        const currentPos = order.indexOf(currentIndex);

        if (currentPos === -1) {
            // Fallback to linear order
            return (currentIndex + 1) % this.state.players.length;
        }

        // Find next non-eliminated player in clockwise order
        let nextPos = (currentPos + 1) % order.length;
        let iterations = 0;

        while (this.state.players[order[nextPos]].isEliminated && iterations < order.length) {
            nextPos = (nextPos + 1) % order.length;
            iterations++;
        }

        return order[nextPos];
    }

    nextTurn(): void {
        const currentIndex = this.state.activePlayerIndex;
        const nextIndex = this.getNextPlayerInClockwiseOrder(currentIndex);

        // Check if we completed a full round (back to first player or earlier in order)
        const order = this.getClockwiseTurnOrder();
        const currentPos = order.indexOf(currentIndex);
        const nextPos = order.indexOf(nextIndex);

        if (nextPos <= currentPos) {
            this.state.currentTurn++;
        }

        this.state.activePlayerIndex = nextIndex;
        this.state.turnStartTime = Date.now();

        this.addEvent('turn_change', this.state.players[nextIndex].id, {
            newValue: this.state.currentTurn,
        });

        this.notify();
    }

    setActivePlayer(index: number): void {
        if (index >= 0 && index < this.state.players.length) {
            this.state.activePlayerIndex = index;
            this.state.turnStartTime = Date.now();
            this.notify();
        }
    }

    setGameStartTime(time: number): void {
        this.state.gameStartTime = time;
        this.notify();
    }

    // ===== Elimination & Win Conditions =====

    private checkEliminationConditions(playerId: string): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (!player || player.isEliminated) return;

        if (player.life <= 0) {
            this.eliminatePlayer(playerId, 'life', undefined, true);
            return;
        }

        for (const [sourceId, damage] of Object.entries(player.commanderDamage)) {
            if (damage >= COMMANDER_DAMAGE_LETHAL) {
                this.eliminatePlayer(playerId, 'commander', sourceId, true);
                return;
            }
        }
    }

    // byPlayerId: quem causou a eliminação (dano de comandante / "A matou B"),
    // vai no evento como fromPlayerId e alimenta o "eliminado por" do ranking.
    // internal: chamada de dentro de outra ação (changeLife/changeCounter), cujo
    // snapshot de undo já cobre a eliminação — não cria um passo de undo próprio.
    eliminatePlayer(playerId: string, reason: string, byPlayerId?: string, internal = false): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (player && !player.isEliminated) {
            if (!internal) this.addUndoAction('eliminate', playerId, {}, `${player.name} eliminado`);
            player.isEliminated = true;

            this.addEvent('player_eliminated', playerId, { message: reason, fromPlayerId: byPlayerId });

            const alivePlayers = this.state.players.filter(p => !p.isEliminated);
            if (alivePlayers.length === 1) {
                this.declareWinner(alivePlayers[0].id);
            }

            this.notify();
        }
    }

    revivePlayer(playerId: string, restoreLife: boolean = true): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (player && player.isEliminated) {
            this.addUndoAction('revive', playerId, {}, `${player.name} revivido`);
            player.isEliminated = false;

            if (restoreLife) {
                // Restore to a safe life total if they died from life loss
                if (player.life <= 0) {
                    player.life = 1;
                }

                // Check and reduce commander damage if it was lethal
                for (const [sourceId, damage] of Object.entries(player.commanderDamage)) {
                    if (damage >= COMMANDER_DAMAGE_LETHAL) {
                        player.commanderDamage[sourceId] = COMMANDER_DAMAGE_LETHAL - 1;
                    }
                }

                // Reduce poison if lethal
                if (player.counters.poison >= 10) {
                    player.counters.poison = 9;
                }
            }

            this.state.winner = null;
            this.addEvent('revive', playerId, { message: `${player.name} voltou ao jogo` });
            this.notify();
        }
    }

    declareWinner(playerId: string): void {
        this.state.winner = playerId;
        this.addEvent('player_win', playerId, {});
        this.notify();
    }

    // Encerramento explícito: o resultado foi salvo no ranking; a mesa fica
    // "congelada" (sem novo salvamento) até reset/nova partida.
    closeMatch(): void {
        if (this.state.matchClosed) return;
        this.state.matchClosed = true;
        const winnerId = this.state.winner || this.state.players.find(p => !p.isEliminated)?.id || this.state.players[0]?.id || '';
        this.addEvent('game_end', winnerId, { message: 'partida encerrada' });
        this.notify();
    }

    // ===== Mecânicas de mesa (Day/Night, Planechase, Archenemy) =====

    updateMechanics(patch: Partial<TableMechanics>, event?: { type: EventType; playerId?: string; details?: EventDetails }): void {
        Object.assign(this.state.mechanics, patch);
        if (event) {
            const pid = event.playerId || this.state.players[this.state.activePlayerIndex]?.id || '';
            this.addEvent(event.type, pid, event.details || {});
        }
        this.notify();
    }

    // ===== Settings Actions =====

    updateSettings(updates: Partial<GameSettings>): void {
        Object.assign(this.state.settings, updates);
        this.notify();
    }

    // ===== GIF Controls =====

    toggleGifPause(paused: boolean): void {
        this.state.settings.gifPaused = paused;
        this.notify();
    }

    toggleGifFpsReduction(reduced: boolean): void {
        this.state.settings.gifFpsReduced = reduced;
        this.notify();
    }
}

// Export singleton instance
export const gameState = new GameStateManager();
