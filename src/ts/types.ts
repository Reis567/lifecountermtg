// ===== Type Definitions =====

export interface Player {
    id: string;
    name: string;
    color: string;
    avatar: string | null;
    background: string | null; // Background image/GIF
    backgroundType: 'none' | 'image' | 'gif';
    emoji: string | null; // Personal emoji/icon
    tag: string | null; // Optional tag (ex: "Archenemy")
    life: number;
    isEliminated: boolean;
    isMonarch: boolean;
    counters: PlayerCounters;
    commanderDamage: Record<string, number>;
    commanderDeaths: number; // Number of times commander died (for Commander Tax)
    customSounds: PlayerSounds;
    rotation: number; // Rotation in degrees for table mode
}

export interface PlayerCounters {
    poison: number;
    experience: number;
    energy: number;
    storm: number;
    custom: CustomCounter[];
}

export interface CustomCounter {
    id: string;
    name: string;
    value: number;
    icon?: string;
}

export interface PlayerSounds {
    death: string | null;
    win: string | null;
    damage: string | null;
}

export interface LayoutConfig {
    rows: number[]; // Array of player counts per row, e.g., [3, 2] = 3 top, 2 bottom
    tableMode: boolean; // Enable rotation for table mode
    preset: string | null; // Preset name if using one
}

export interface GameSettings {
    startingLife: number;
    playerCount: number;
    soundEnabled: boolean;
    volume: number;
    animationsEnabled: boolean;
    animationIntensity: 'subtle' | 'normal' | 'intense';
    turnTimerEnabled: boolean;
    turnTimerDuration: number;
    theme: ThemePreset;
    layout: LayoutConfig;
    randomStarterAnimation: RandomAnimationType;
    confirmCriticalActions: boolean;
    showSpecialMoments: boolean;
    showCommanderDeaths: boolean; // Show commander death counter on player cards
    gifPaused: boolean;
    gifFpsReduced: boolean;
    easterEggsEnabled: boolean;
}

export type ThemePreset = 'casual' | 'dark' | 'streamer' | 'custom';
export type RandomAnimationType = 'highlight' | 'roulette' | 'flash';
export type GameMode = 'standard' | 'planechase' | 'archenemy';

export interface GameState {
    players: Player[];
    settings: GameSettings;
    currentTurn: number;
    activePlayerIndex: number;
    turnStartTime: number | null;
    gameStarted: boolean;
    winner: string | null;
    history: GameEvent[];
    undoStack: UndoAction[];
    gameMode: GameMode;
    randomStarterInProgress: boolean;
}

export interface UndoAction {
    id: string;
    timestamp: number;
    type: string;
    playerId: string;
    previousState: Partial<Player>;
    description: string;
}

export interface GameEvent {
    id: string;
    timestamp: number;
    type: EventType;
    playerId: string;
    details: EventDetails;
}

export type EventType =
    | 'life_change'
    | 'commander_damage'
    | 'counter_change'
    | 'player_eliminated'
    | 'player_win'
    | 'turn_change'
    | 'monarch_change'
    | 'random_starter'
    | 'undo';

export interface EventDetails {
    amount?: number;
    fromPlayerId?: string;
    counterType?: string;
    previousValue?: number;
    newValue?: number;
    message?: string;
}

export interface TablePreset {
    id: string;
    name: string;
    playerCount: number;
    layout: LayoutConfig;
    theme: ThemePreset;
}

// Default colors for players
export const DEFAULT_PLAYER_COLORS = [
    '#6366f1', // Indigo
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#22c55e', // Green
    '#3b82f6', // Blue
];

// Preset counters
export const PRESET_COUNTERS = [
    { id: 'poison', name: 'Veneno', icon: '☠️', lethalValue: 10 },
    { id: 'experience', name: 'Experiência', icon: '⭐', lethalValue: null },
    { id: 'energy', name: 'Energia', icon: '⚡', lethalValue: null },
    { id: 'storm', name: 'Storm', icon: '🌪️', lethalValue: null },
];

// Commander damage lethal threshold
export const COMMANDER_DAMAGE_LETHAL = 21;

// Layout presets for common player configurations
export const LAYOUT_PRESETS: Record<number, LayoutConfig[]> = {
    2: [
        { rows: [1, 1], tableMode: true, preset: '2-split' },
        { rows: [2], tableMode: false, preset: '2-row' },
    ],
    3: [
        { rows: [2, 1], tableMode: true, preset: '3-pyramid' },
        { rows: [1, 2], tableMode: true, preset: '3-inverted' },
        { rows: [3], tableMode: false, preset: '3-row' },
    ],
    4: [
        { rows: [2, 2], tableMode: true, preset: '4-square' },
        { rows: [3, 1], tableMode: true, preset: '4-triangle' },
        { rows: [1, 3], tableMode: true, preset: '4-inverted' },
        { rows: [4], tableMode: false, preset: '4-row' },
    ],
    5: [
        { rows: [3, 2], tableMode: true, preset: '5-standard' },
        { rows: [2, 3], tableMode: true, preset: '5-inverted' },
        { rows: [2, 1, 2], tableMode: true, preset: '5-diamond' },
    ],
    6: [
        { rows: [3, 3], tableMode: true, preset: '6-even' },
        { rows: [4, 2], tableMode: true, preset: '6-wide' },
        { rows: [2, 4], tableMode: true, preset: '6-narrow' },
        { rows: [2, 2, 2], tableMode: true, preset: '6-triple' },
    ],
    7: [
        { rows: [4, 3], tableMode: true, preset: '7-standard' },
        { rows: [3, 4], tableMode: true, preset: '7-inverted' },
        { rows: [3, 1, 3], tableMode: true, preset: '7-diamond' },
    ],
    8: [
        { rows: [4, 4], tableMode: true, preset: '8-even' },
        { rows: [3, 2, 3], tableMode: true, preset: '8-hourglass' },
        { rows: [2, 4, 2], tableMode: true, preset: '8-wide' },
    ],
};

// Theme configurations
export const THEMES: Record<ThemePreset, ThemeConfig> = {
    casual: {
        name: 'Casual',
        bgPrimary: '#1a1a2e',
        bgSecondary: '#16213e',
        bgCard: '#1f2937',
        textPrimary: '#ffffff',
        accent: '#6366f1',
    },
    dark: {
        name: 'Dark',
        bgPrimary: '#0a0a0a',
        bgSecondary: '#111111',
        bgCard: '#1a1a1a',
        textPrimary: '#e0e0e0',
        accent: '#8b5cf6',
    },
    streamer: {
        name: 'Streamer',
        bgPrimary: '#0f0f23',
        bgSecondary: '#1a1a3e',
        bgCard: '#252550',
        textPrimary: '#ffffff',
        accent: '#00d4ff',
    },
    custom: {
        name: 'Custom',
        bgPrimary: '#0f0f0f',
        bgSecondary: '#1a1a1a',
        bgCard: '#1e1e1e',
        textPrimary: '#ffffff',
        accent: '#6366f1',
    },
};

export interface ThemeConfig {
    name: string;
    bgPrimary: string;
    bgSecondary: string;
    bgCard: string;
    textPrimary: string;
    accent: string;
}

// Easter egg messages
export const EASTER_EGG_MESSAGES = [
    "Shuffling fate...",
    "Consulting the oracle...",
    "The planeswalkers convene...",
    "Destiny awaits...",
    "Rolling for initiative...",
    "The mana flows...",
];

// Special moment triggers
export const SPECIAL_MOMENTS = {
    NEAR_DEATH: 1,
    LOW_LIFE: 5,
    DANGER_ZONE: 10,
    COMMANDER_DANGER: 15,
    COMMANDER_LETHAL: 21,
};
