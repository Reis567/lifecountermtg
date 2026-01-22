// ===== State Management =====
import { DEFAULT_PLAYER_COLORS, COMMANDER_DAMAGE_LETHAL, LAYOUT_PRESETS, } from './types.js';
// Generate unique ID
export function generateId() {
    return Math.random().toString(36).substring(2, 11);
}
// Create default player
export function createPlayer(index, startingLife, totalPlayers) {
    // Calculate rotation based on position for table mode
    const rotation = calculatePlayerRotation(index, totalPlayers);
    return {
        id: generateId(),
        name: `Jogador ${index + 1}`,
        color: DEFAULT_PLAYER_COLORS[index % DEFAULT_PLAYER_COLORS.length],
        avatar: null,
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
    };
}
// Calculate rotation for table mode based on player position
function calculatePlayerRotation(index, totalPlayers) {
    // For 2 players: top player rotated 180°
    if (totalPlayers === 2) {
        return index === 0 ? 180 : 0;
    }
    // For more players, calculate based on position
    // Top row players: 180°, bottom row: 0°, sides: 90° or 270°
    const defaultLayout = LAYOUT_PRESETS[totalPlayers]?.[0];
    if (!defaultLayout)
        return 0;
    let playerIndex = 0;
    for (let rowIdx = 0; rowIdx < defaultLayout.rows.length; rowIdx++) {
        const playersInRow = defaultLayout.rows[rowIdx];
        if (index < playerIndex + playersInRow) {
            // Player is in this row
            if (rowIdx === 0)
                return 180; // Top row
            if (rowIdx === defaultLayout.rows.length - 1)
                return 0; // Bottom row
            return 0; // Middle rows
        }
        playerIndex += playersInRow;
    }
    return 0;
}
// Get default layout for player count
function getDefaultLayout(playerCount) {
    const presets = LAYOUT_PRESETS[playerCount];
    if (presets && presets.length > 0) {
        return { ...presets[0] };
    }
    // Fallback: all players in rows of 2
    const rows = [];
    let remaining = playerCount;
    while (remaining > 0) {
        rows.push(Math.min(remaining, 2));
        remaining -= 2;
    }
    return { rows, tableMode: true, preset: null };
}
// Create default settings
export function createDefaultSettings(playerCount = 4) {
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
    };
}
// Create initial game state
export function createInitialState() {
    const settings = createDefaultSettings();
    return {
        players: Array.from({ length: settings.playerCount }, (_, i) => createPlayer(i, settings.startingLife, settings.playerCount)),
        settings,
        currentTurn: 1,
        activePlayerIndex: 0,
        turnStartTime: null,
        gameStarted: false,
        winner: null,
        history: [],
        undoStack: [],
        gameMode: 'standard',
        randomStarterInProgress: false,
    };
}
// State management class
class GameStateManager {
    constructor() {
        this.storageKey = 'mtg-life-counter-state';
        this.undoTimeWindow = 10000; // 10 seconds to undo
        this.state = this.loadState() || createInitialState();
        this.listeners = new Set();
        // Clean old undo actions periodically
        setInterval(() => this.cleanOldUndoActions(), 5000);
    }
    // Get current state
    getState() {
        return this.state;
    }
    // Subscribe to state changes
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    // Notify all listeners
    notify() {
        this.listeners.forEach(listener => listener(this.state));
        this.saveState();
    }
    // Save state to localStorage
    saveState() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        }
        catch (e) {
            console.warn('Failed to save state:', e);
        }
    }
    // Load state from localStorage
    loadState() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Ensure new properties exist
                if (!parsed.undoStack)
                    parsed.undoStack = [];
                if (!parsed.gameMode)
                    parsed.gameMode = 'standard';
                if (parsed.randomStarterInProgress === undefined)
                    parsed.randomStarterInProgress = false;
                if (!parsed.settings.layout) {
                    parsed.settings.layout = getDefaultLayout(parsed.settings.playerCount);
                }
                if (!parsed.settings.theme)
                    parsed.settings.theme = 'dark';
                if (!parsed.settings.randomStarterAnimation)
                    parsed.settings.randomStarterAnimation = 'highlight';
                if (!parsed.settings.animationIntensity)
                    parsed.settings.animationIntensity = 'normal';
                if (parsed.settings.showCommanderDeaths === undefined)
                    parsed.settings.showCommanderDeaths = true;
                // Ensure all players have new properties (migration for older saves)
                parsed.players = parsed.players.map((p) => ({
                    ...p,
                    background: p.background ?? null,
                    backgroundType: p.backgroundType ?? 'none',
                    emoji: p.emoji ?? null,
                    tag: p.tag ?? null,
                    rotation: p.rotation ?? 0,
                    commanderDeaths: p.commanderDeaths ?? 0,
                }));
                return parsed;
            }
        }
        catch (e) {
            console.warn('Failed to load state:', e);
        }
        return null;
    }
    // Clear saved state
    clearSavedState() {
        localStorage.removeItem(this.storageKey);
    }
    // Add event to history
    addEvent(type, playerId, details) {
        const event = {
            id: generateId(),
            timestamp: Date.now(),
            type,
            playerId,
            details,
        };
        this.state.history.unshift(event);
        if (this.state.history.length > 100) {
            this.state.history = this.state.history.slice(0, 100);
        }
    }
    // ===== Undo System =====
    addUndoAction(type, playerId, previousState, description) {
        const action = {
            id: generateId(),
            timestamp: Date.now(),
            type,
            playerId,
            previousState,
            description,
        };
        this.state.undoStack.push(action);
        // Keep only last 20 undo actions
        if (this.state.undoStack.length > 20) {
            this.state.undoStack = this.state.undoStack.slice(-20);
        }
    }
    cleanOldUndoActions() {
        const now = Date.now();
        this.state.undoStack = this.state.undoStack.filter(action => now - action.timestamp < this.undoTimeWindow);
    }
    canUndo() {
        const now = Date.now();
        return this.state.undoStack.some(action => now - action.timestamp < this.undoTimeWindow);
    }
    undo() {
        const now = Date.now();
        // Find the most recent valid undo action
        for (let i = this.state.undoStack.length - 1; i >= 0; i--) {
            const action = this.state.undoStack[i];
            if (now - action.timestamp < this.undoTimeWindow) {
                // Remove this action from stack
                this.state.undoStack.splice(i, 1);
                // Apply the previous state
                const player = this.state.players.find(p => p.id === action.playerId);
                if (player) {
                    Object.assign(player, action.previousState);
                    // If player was eliminated, check if we should un-eliminate
                    if (action.previousState.life !== undefined && action.previousState.life > 0) {
                        player.isEliminated = false;
                    }
                }
                this.addEvent('undo', action.playerId, { message: action.description });
                this.state.winner = null; // Clear winner on undo
                this.notify();
                return action;
            }
        }
        return null;
    }
    // ===== Setup Actions =====
    setPlayerCount(count) {
        const currentCount = this.state.players.length;
        if (count > currentCount) {
            for (let i = currentCount; i < count; i++) {
                this.state.players.push(createPlayer(i, this.state.settings.startingLife, count));
            }
        }
        else if (count < currentCount) {
            this.state.players = this.state.players.slice(0, count);
        }
        this.state.settings.playerCount = count;
        this.state.settings.layout = getDefaultLayout(count);
        // Recalculate rotations
        this.updatePlayerRotations();
        this.notify();
    }
    setStartingLife(life) {
        this.state.settings.startingLife = life;
        if (!this.state.gameStarted) {
            this.state.players.forEach(player => {
                player.life = life;
            });
        }
        this.notify();
    }
    updatePlayerSetup(playerId, updates) {
        const player = this.state.players.find(p => p.id === playerId);
        if (player) {
            Object.assign(player, updates);
            this.notify();
        }
    }
    // ===== Layout Actions =====
    setLayout(layout) {
        this.state.settings.layout = layout;
        this.updatePlayerRotations();
        this.notify();
    }
    setLayoutPreset(presetName) {
        const presets = LAYOUT_PRESETS[this.state.settings.playerCount];
        if (presets) {
            const preset = presets.find(p => p.preset === presetName);
            if (preset) {
                this.setLayout({ ...preset });
            }
        }
    }
    toggleTableMode(enabled) {
        this.state.settings.layout.tableMode = enabled;
        this.updatePlayerRotations();
        this.notify();
    }
    setCustomLayout(rows) {
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
    updatePlayerRotations() {
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
                    }
                    else if (rowIdx === layout.rows.length - 1) {
                        this.state.players[playerIndex].rotation = 0;
                    }
                    else {
                        // Middle rows: could be sides
                        this.state.players[playerIndex].rotation = 0;
                    }
                    playerIndex++;
                }
            }
        }
    }
    // ===== Theme Actions =====
    setTheme(theme) {
        this.state.settings.theme = theme;
        this.notify();
    }
    // ===== Game Mode Actions =====
    setGameMode(mode) {
        this.state.gameMode = mode;
        this.notify();
    }
    // ===== Random Starter =====
    setRandomStarterInProgress(inProgress) {
        this.state.randomStarterInProgress = inProgress;
        this.notify();
    }
    selectRandomStarter() {
        const alivePlayers = this.state.players
            .map((p, i) => ({ player: p, index: i }))
            .filter(({ player }) => !player.isEliminated);
        if (alivePlayers.length === 0)
            return 0;
        const randomIndex = Math.floor(Math.random() * alivePlayers.length);
        const selected = alivePlayers[randomIndex];
        this.state.activePlayerIndex = selected.index;
        this.addEvent('random_starter', selected.player.id, {});
        this.notify();
        return selected.index;
    }
    setRandomStarterAnimation(type) {
        this.state.settings.randomStarterAnimation = type;
        this.notify();
    }
    // ===== Game Actions =====
    startGame() {
        this.state.players.forEach(player => {
            player.commanderDamage = {};
            this.state.players.forEach(otherPlayer => {
                if (otherPlayer.id !== player.id) {
                    player.commanderDamage[otherPlayer.id] = 0;
                }
            });
        });
        this.state.gameStarted = true;
        this.state.currentTurn = 1;
        this.state.turnStartTime = Date.now();
        this.state.winner = null;
        this.state.history = [];
        this.state.undoStack = [];
        this.notify();
    }
    resetGame(resetCommanderDeaths = false) {
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
        this.state.winner = null;
        this.state.history = [];
        this.state.undoStack = [];
        this.notify();
    }
    newGame() {
        const playerCount = this.state.settings.playerCount;
        this.state = createInitialState();
        this.state.settings.playerCount = playerCount;
        this.state.settings.layout = getDefaultLayout(playerCount);
        this.state.players = Array.from({ length: playerCount }, (_, i) => createPlayer(i, this.state.settings.startingLife, playerCount));
        this.notify();
    }
    // ===== Life Actions =====
    changeLife(playerId, amount) {
        const player = this.state.players.find(p => p.id === playerId);
        if (player && !player.isEliminated) {
            // Save for undo
            this.addUndoAction('life_change', playerId, { life: player.life }, `${player.name}: ${amount > 0 ? '+' : ''}${amount} vida`);
            const previousLife = player.life;
            player.life += amount;
            this.addEvent('life_change', playerId, {
                amount,
                previousValue: previousLife,
                newValue: player.life,
            });
            this.checkEliminationConditions(playerId);
            this.notify();
        }
    }
    setLife(playerId, value) {
        const player = this.state.players.find(p => p.id === playerId);
        if (player && !player.isEliminated) {
            this.addUndoAction('life_set', playerId, { life: player.life }, `${player.name}: vida definida para ${value}`);
            const previousLife = player.life;
            player.life = value;
            this.addEvent('life_change', playerId, {
                amount: value - previousLife,
                previousValue: previousLife,
                newValue: value,
            });
            this.checkEliminationConditions(playerId);
            this.notify();
        }
    }
    // ===== Commander Damage Actions =====
    addCommanderDamage(targetPlayerId, sourcePlayerId, amount) {
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
            });
            this.checkEliminationConditions(targetPlayerId);
            this.notify();
        }
    }
    // ===== Counter Actions =====
    changeCounter(playerId, counterType, amount) {
        const player = this.state.players.find(p => p.id === playerId);
        if (player) {
            const previousValue = player.counters[counterType];
            this.addUndoAction('counter_change', playerId, {
                counters: { ...player.counters },
            }, `${counterType}: ${amount > 0 ? '+' : ''}${amount}`);
            player.counters[counterType] = Math.max(0, previousValue + amount);
            const newValue = player.counters[counterType];
            this.addEvent('counter_change', playerId, {
                amount,
                counterType,
                previousValue,
                newValue,
            });
            if (counterType === 'poison' && newValue >= 10) {
                this.eliminatePlayer(playerId, 'poison');
            }
            this.notify();
        }
    }
    addCustomCounter(playerId, name, icon) {
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
    changeCustomCounter(playerId, counterId, amount) {
        const player = this.state.players.find(p => p.id === playerId);
        if (player) {
            const counter = player.counters.custom.find(c => c.id === counterId);
            if (counter) {
                counter.value = Math.max(0, counter.value + amount);
                this.notify();
            }
        }
    }
    removeCustomCounter(playerId, counterId) {
        const player = this.state.players.find(p => p.id === playerId);
        if (player) {
            player.counters.custom = player.counters.custom.filter(c => c.id !== counterId);
            this.notify();
        }
    }
    // ===== Monarch Actions =====
    setMonarch(playerId) {
        this.state.players.forEach(player => {
            const wasMonarch = player.isMonarch;
            player.isMonarch = player.id === playerId;
            if (player.isMonarch && !wasMonarch) {
                this.addEvent('monarch_change', playerId, {});
            }
        });
        this.notify();
    }
    removeMonarch() {
        this.state.players.forEach(player => {
            player.isMonarch = false;
        });
        this.notify();
    }
    // ===== Commander Deaths (Tax) Actions =====
    changeCommanderDeaths(playerId, amount) {
        const player = this.state.players.find(p => p.id === playerId);
        if (player) {
            const previousValue = player.commanderDeaths;
            const newValue = Math.max(0, player.commanderDeaths + amount);
            this.addUndoAction('commander_deaths', playerId, {
                commanderDeaths: previousValue,
            }, `${player.name}: Mortes do comandante ${amount > 0 ? '+' : ''}${amount}`);
            player.commanderDeaths = newValue;
            this.addEvent('counter_change', playerId, {
                amount,
                counterType: 'commanderDeaths',
                previousValue,
                newValue,
            });
            this.notify();
        }
    }
    resetCommanderDeaths(playerId) {
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
    resetAllCommanderDeaths() {
        this.state.players.forEach(player => {
            player.commanderDeaths = 0;
        });
        this.notify();
    }
    // ===== Turn Actions =====
    nextTurn() {
        let nextIndex = (this.state.activePlayerIndex + 1) % this.state.players.length;
        let iterations = 0;
        while (this.state.players[nextIndex].isEliminated && iterations < this.state.players.length) {
            nextIndex = (nextIndex + 1) % this.state.players.length;
            iterations++;
        }
        if (nextIndex <= this.state.activePlayerIndex) {
            this.state.currentTurn++;
        }
        this.state.activePlayerIndex = nextIndex;
        this.state.turnStartTime = Date.now();
        this.addEvent('turn_change', this.state.players[nextIndex].id, {
            newValue: this.state.currentTurn,
        });
        this.notify();
    }
    setActivePlayer(index) {
        if (index >= 0 && index < this.state.players.length) {
            this.state.activePlayerIndex = index;
            this.state.turnStartTime = Date.now();
            this.notify();
        }
    }
    // ===== Elimination & Win Conditions =====
    checkEliminationConditions(playerId) {
        const player = this.state.players.find(p => p.id === playerId);
        if (!player || player.isEliminated)
            return;
        if (player.life <= 0) {
            this.eliminatePlayer(playerId, 'life');
            return;
        }
        for (const [sourceId, damage] of Object.entries(player.commanderDamage)) {
            if (damage >= COMMANDER_DAMAGE_LETHAL) {
                this.eliminatePlayer(playerId, 'commander');
                return;
            }
        }
    }
    eliminatePlayer(playerId, reason) {
        const player = this.state.players.find(p => p.id === playerId);
        if (player && !player.isEliminated) {
            player.isEliminated = true;
            this.addEvent('player_eliminated', playerId, { message: reason });
            const alivePlayers = this.state.players.filter(p => !p.isEliminated);
            if (alivePlayers.length === 1) {
                this.declareWinner(alivePlayers[0].id);
            }
            this.notify();
        }
    }
    revivePlayer(playerId, restoreLife = true) {
        const player = this.state.players.find(p => p.id === playerId);
        if (player && player.isEliminated) {
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
            this.addEvent('undo', playerId, { message: `${player.name} foi revivido` });
            this.notify();
        }
    }
    declareWinner(playerId) {
        this.state.winner = playerId;
        this.addEvent('player_win', playerId, {});
        this.notify();
    }
    // ===== Settings Actions =====
    updateSettings(updates) {
        Object.assign(this.state.settings, updates);
        this.notify();
    }
    // ===== GIF Controls =====
    toggleGifPause(paused) {
        this.state.settings.gifPaused = paused;
        this.notify();
    }
    toggleGifFpsReduction(reduced) {
        this.state.settings.gifFpsReduced = reduced;
        this.notify();
    }
}
// Export singleton instance
export const gameState = new GameStateManager();
//# sourceMappingURL=state.js.map