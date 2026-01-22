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
    teamId: string | null; // Team ID for Two-Headed Giant mode
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

export interface Team {
    id: string;
    name: string;
    color: string;
    playerIds: string[];
    life: number;
    isEliminated: boolean;
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
    animatedBgEnabled: boolean;
    animatedBgStyle: AnimatedBgStyle;
    fontStyle: FontStyle;
    ambientMusicEnabled: boolean;
    ambientMusicVolume: number;
    ambientMusicTrack: AmbientMusicTrack;
    narratorEnabled: boolean;
    narratorVoice: string;
    narratorSpeed: number;
    soundPack: SoundPack;
}

export type AmbientMusicTrack = 'none' | 'epic' | 'dark' | 'nature' | 'mystical';
export type SoundPack = 'default' | 'medieval' | 'scifi' | 'horror' | 'arcade';

export type AnimatedBgStyle = 'none' | 'stars' | 'mana' | 'sparks' | 'bubbles' | 'matrix';
export type FontStyle = 'default' | 'beleren' | 'pixel' | 'gothic' | 'elegant' | 'rounded';

export type ThemePreset = 'casual' | 'dark' | 'streamer' | 'custom' | 'mana-white' | 'mana-blue' | 'mana-black' | 'mana-red' | 'mana-green' | 'high-contrast';
export type RandomAnimationType = 'highlight' | 'roulette' | 'flash';
export type GameMode = 'standard' | 'planechase' | 'archenemy' | 'two-headed';

export interface GameState {
    players: Player[];
    teams: Team[];
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
    'mana-white': {
        name: 'White Mana',
        bgPrimary: '#f5f5f0',
        bgSecondary: '#e8e8e0',
        bgCard: '#ffffff',
        textPrimary: '#1a1a1a',
        accent: '#f9e076',
    },
    'mana-blue': {
        name: 'Blue Mana',
        bgPrimary: '#0a1628',
        bgSecondary: '#0f2744',
        bgCard: '#1a3a5c',
        textPrimary: '#ffffff',
        accent: '#0ea5e9',
    },
    'mana-black': {
        name: 'Black Mana',
        bgPrimary: '#0a0a0a',
        bgSecondary: '#121212',
        bgCard: '#0f0f0f',
        textPrimary: '#ffffff',
        accent: '#a855f7',
    },
    'mana-red': {
        name: 'Red Mana',
        bgPrimary: '#1a0a0a',
        bgSecondary: '#2a1010',
        bgCard: '#2d1212',
        textPrimary: '#ffffff',
        accent: '#ef4444',
    },
    'mana-green': {
        name: 'Green Mana',
        bgPrimary: '#0a1a0a',
        bgSecondary: '#102810',
        bgCard: '#122d12',
        textPrimary: '#ffffff',
        accent: '#22c55e',
    },
    'high-contrast': {
        name: 'High Contrast',
        bgPrimary: '#000000',
        bgSecondary: '#0a0a0a',
        bgCard: '#000000',
        textPrimary: '#ffffff',
        accent: '#ffff00',
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

// Taunt phrases (friendly provocations)
export const TAUNT_PHRASES = {
    // When taking big damage (5+ at once)
    bigDamage: [
        "Isso vai deixar marca! 💥",
        "Ui, isso doeu! 🤕",
        "Alguém chamou uma ambulância? 🚑",
        "F no chat! 📉",
        "Brutal! Sem piedade! 😈",
        "Ouch! Ninguém merece! 😬",
        "Cuidado, está sangrando! 🩸",
    ],
    // When healing a lot (5+ at once)
    bigHeal: [
        "De volta ao jogo! 💚",
        "Ainda não acabou! 🏥",
        "Que recuperação! 🌟",
        "Nunca subestime a cura! ✨",
        "Vida é vida! 💪",
    ],
    // When a player gets eliminated
    elimination: [
        "GG! Até a próxima! 👋",
        "Caiu mais um! 💀",
        "Descanse em paz... até a revanche! ⚰️",
        "Eliminated! 🎯",
        "Better luck next time! 🍀",
        "De férias! 🏖️",
    ],
    // When reaching critical life (5 or less)
    criticalLife: [
        "Tá suando frio! 😰",
        "Modo sobrevivência ativado! 🆘",
        "Uma topdeckada e já era! 🎴",
        "Vida por um fio! 🧵",
        "Hora de rezar! 🙏",
    ],
    // When someone becomes the Monarch
    monarch: [
        "Longa vida ao rei! 👑",
        "A coroa pesa... 🏰",
        "Draw extra, baby! 🎴",
        "Quem quer ser rei? 👑",
    ],
    // Random comebacks when at low life
    comeback: [
        "A virada está chegando! 🔄",
        "Ainda tenho 1 de vida! 😤",
        "Nunca desista! 💪",
    ],
    // When rolling a nat 20
    criticalRoll: [
        "NAT 20! Lendário! 🎯",
        "Os deuses te abençoaram! ⚡",
        "Crítico perfeito! 🌟",
    ],
    // When rolling a 1
    criticalFail: [
        "NAT 1! Oof... 😅",
        "Os dados te odeiam! 🎲",
        "Melhor tentar de novo... 🤷",
    ],
};

// MTG Keywords and Rules
export interface MTGKeyword {
    name: string;
    description: string;
    category: 'combat' | 'mana' | 'abilities' | 'counters' | 'other';
    reminder?: string;
}

export const MTG_KEYWORDS: MTGKeyword[] = [
    // Combat Keywords
    { name: 'Primeiro Ataque', description: 'Esta criatura causa dano de combate antes de criaturas sem primeiro ataque.', category: 'combat', reminder: 'First Strike' },
    { name: 'Golpe Duplo', description: 'Esta criatura causa dano tanto no passo de primeiro ataque quanto no passo normal.', category: 'combat', reminder: 'Double Strike' },
    { name: 'Vigilância', description: 'Atacar não faz esta criatura ser virada.', category: 'combat', reminder: 'Vigilance' },
    { name: 'Atropelar', description: 'Dano em excesso ao bloqueador é causado ao jogador defensor.', category: 'combat', reminder: 'Trample' },
    { name: 'Voar', description: 'Esta criatura só pode ser bloqueada por criaturas com voar ou alcance.', category: 'combat', reminder: 'Flying' },
    { name: 'Alcance', description: 'Esta criatura pode bloquear criaturas com voar.', category: 'combat', reminder: 'Reach' },
    { name: 'Toque Mortífero', description: 'Qualquer quantidade de dano que esta criatura cause a uma criatura é suficiente para destruí-la.', category: 'combat', reminder: 'Deathtouch' },
    { name: 'Vínculo com a Vida', description: 'O dano causado por esta criatura também faz você ganhar essa quantidade de vida.', category: 'combat', reminder: 'Lifelink' },
    { name: 'Iniciativa', description: 'Quando esta criatura entra ou causa dano de combate, você pega a iniciativa e entra na dungeon.', category: 'combat', reminder: 'Initiative' },
    { name: 'Provocar', description: 'Todas as criaturas capazes de bloquear esta criatura devem fazê-lo.', category: 'combat', reminder: 'Menace' },
    { name: 'Ameaçar', description: 'Esta criatura não pode ser bloqueada exceto por duas ou mais criaturas.', category: 'combat', reminder: 'Menace' },
    { name: 'Inquebrável', description: 'Dano e efeitos que dizem "destrua" não destroem esta permanente.', category: 'combat', reminder: 'Indestructible' },
    { name: 'Proteção', description: 'Esta permanente não pode ser alvo, bloqueada, encantada ou equipada pelo tipo especificado.', category: 'combat', reminder: 'Protection from X' },
    { name: 'Hexproof', description: 'Esta permanente não pode ser alvo de mágicas ou habilidades que seus oponentes controlam.', category: 'combat', reminder: 'Hexproof' },
    { name: 'Ímpeto', description: 'Esta criatura pode atacar e usar habilidades de virar assim que entra sob seu controle.', category: 'combat', reminder: 'Haste' },
    { name: 'Defensor', description: 'Esta criatura não pode atacar.', category: 'combat', reminder: 'Defender' },

    // Mana Keywords
    { name: 'Florescer', description: 'Se você gastou mana de cores diferentes para conjurar esta mágica, ela ganha efeitos adicionais.', category: 'mana', reminder: 'Converge' },
    { name: 'Devoção', description: 'Conta símbolos de mana de uma cor específica no custo de mana de permanentes que você controla.', category: 'mana', reminder: 'Devotion' },
    { name: 'Affinity', description: 'Esta mágica custa menos para conjurar para cada permanente do tipo especificado.', category: 'mana', reminder: 'Affinity' },
    { name: 'Convocação', description: 'Suas criaturas podem ajudar a conjurar esta mágica. Cada criatura virada paga 1 ou mana de sua cor.', category: 'mana', reminder: 'Convoke' },
    { name: 'Delve', description: 'Cada card exilado do seu cemitério paga 1 mana genérico.', category: 'mana', reminder: 'Delve' },
    { name: 'Improvise', description: 'Seus artefatos podem ajudar a conjurar esta mágica. Cada artefato virado paga 1 mana genérico.', category: 'mana', reminder: 'Improvise' },

    // Abilities Keywords
    { name: 'Lampejo', description: 'Você pode conjurar esta mágica a qualquer momento que poderia conjurar um instantâneo.', category: 'abilities', reminder: 'Flash' },
    { name: 'Retornar', description: 'Você pode conjurar este card do seu cemitério pelo custo de retornar.', category: 'abilities', reminder: 'Flashback' },
    { name: 'Cascata', description: 'Quando você conjura esta mágica, exile cards até exilar um não-terreno com custo menor, e conjure-o sem pagar seu custo.', category: 'abilities', reminder: 'Cascade' },
    { name: 'Tempestade', description: 'Quando você conjura esta mágica, copie-a para cada mágica conjurada antes dela neste turno.', category: 'abilities', reminder: 'Storm' },
    { name: 'Kicker', description: 'Você pode pagar um custo adicional ao conjurar esta mágica para efeitos extras.', category: 'abilities', reminder: 'Kicker' },
    { name: 'Replicar', description: 'Quando conjurar, você pode pagar o custo de replicar várias vezes e copiar a mágica.', category: 'abilities', reminder: 'Replicate' },
    { name: 'Transmutar', description: 'Pague o custo, descarte este card: Busque um card com o mesmo custo de mana.', category: 'abilities', reminder: 'Transmute' },
    { name: 'Embalsamar', description: 'Exile este card do seu cemitério: Crie uma cópia token dele, exceto que é um Zumbi branco.', category: 'abilities', reminder: 'Embalm' },
    { name: 'Eternizar', description: 'Exile este card do seu cemitério: Crie uma cópia token 4/4 preta Zumbi dele.', category: 'abilities', reminder: 'Eternalize' },
    { name: 'Escape', description: 'Você pode conjurar este card do seu cemitério pelo custo de escape.', category: 'abilities', reminder: 'Escape' },
    { name: 'Transformar', description: 'Este card tem duas faces e pode se transformar na outra face.', category: 'abilities', reminder: 'Transform' },
    { name: 'Ward', description: 'Sempre que esta permanente se tornar alvo, o oponente deve pagar um custo ou a habilidade é anulada.', category: 'abilities', reminder: 'Ward' },

    // Counter Keywords
    { name: 'Infeccionar', description: 'Esta criatura causa dano a jogadores na forma de contadores de veneno e a criaturas na forma de contadores -1/-1.', category: 'counters', reminder: 'Infect' },
    { name: 'Veneno', description: 'Dano causado a jogadores resulta em contadores de veneno. 10 contadores de veneno = derrota.', category: 'counters', reminder: 'Poison' },
    { name: 'Murchar', description: 'Esta criatura causa dano a criaturas na forma de contadores -1/-1.', category: 'counters', reminder: 'Wither' },
    { name: 'Modular', description: 'Esta criatura entra com contadores +1/+1. Quando morre, você pode mover esses contadores.', category: 'counters', reminder: 'Modular' },
    { name: 'Persistir', description: 'Quando esta criatura morre, se não tinha contadores -1/-1, retorne-a com um contador -1/-1.', category: 'counters', reminder: 'Persist' },
    { name: 'Inextinguível', description: 'Quando esta criatura morre, se tinha contadores +1/+1, retorne-a com um contador +1/+1 a menos.', category: 'counters', reminder: 'Undying' },
    { name: 'Energia', description: 'Contadores de energia são um recurso do jogador usados para pagar custos.', category: 'counters', reminder: 'Energy' },
    { name: 'Experiência', description: 'Contadores de experiência no jogador, frequentemente usados por comandantes.', category: 'counters', reminder: 'Experience' },

    // Other/General
    { name: 'Lendário', description: 'Você só pode controlar uma permanente lendária com o mesmo nome.', category: 'other', reminder: 'Legendary' },
    { name: 'Dano de Comandante', description: 'Dano de combate causado por um comandante é rastreado separadamente. 21 dano de um comandante = derrota.', category: 'other', reminder: 'Commander Damage' },
    { name: 'Commander Tax', description: 'Cada vez que você conjura seu comandante da zona de comando, custa 2 mana a mais.', category: 'other', reminder: 'Commander Tax' },
    { name: 'Parceiro', description: 'Você pode ter dois comandantes se ambos tiverem parceiro.', category: 'other', reminder: 'Partner' },
    { name: 'Monarch', description: 'O monarca compra um card extra no fim do turno. Dano de combate rouba a coroa.', category: 'other', reminder: 'Monarch' },
    { name: 'Annihilator', description: 'Sempre que esta criatura ataca, o defensor sacrifica permanentes.', category: 'other', reminder: 'Annihilator' },
    { name: 'Affinidade', description: 'Custa menos mana para conjurar baseado em permanentes que você controla.', category: 'other', reminder: 'Affinity' },
];
