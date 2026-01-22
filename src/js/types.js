// ===== Type Definitions =====
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
export const LAYOUT_PRESETS = {
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
export const THEMES = {
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
//# sourceMappingURL=types.js.map