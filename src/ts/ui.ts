// ===== UI Management =====

import { gameState } from './state.js';
import { audioManager } from './audio.js';
import {
    GameState,
    Player,
    DEFAULT_PLAYER_COLORS,
    PRESET_COUNTERS,
    COMMANDER_DAMAGE_LETHAL,
    LAYOUT_PRESETS,
    THEMES,
    EASTER_EGG_MESSAGES,
    SPECIAL_MOMENTS,
    ThemePreset,
    RandomAnimationType,
} from './types.js';

// Current editing context
let currentEditingPlayerId: string | null = null;
let currentCountersPlayerId: string | null = null;
let currentCommanderDamagePlayerId: string | null = null;

// Hold timers for +/- buttons
let holdInterval: number | null = null;
let holdTimeout: number | null = null;

// Turn timer
let turnTimerInterval: number | null = null;

// Undo check interval
let undoCheckInterval: number | null = null;

// Random starter animation state
let randomStarterAnimationInterval: number | null = null;

// Color picker state
let currentHue = 0;
let currentSaturation = 100;
let currentLightness = 50;
let selectedCustomColor: string | null = null;

// Image search state
let imageSearchTarget: 'avatar' | 'background' = 'avatar';
let imageSearchType: 'gif' | 'image' = 'gif';
let pendingImageUrl: string | null = null;
let pendingImageType: 'gif' | 'image' = 'image';

// Media pause state per player
const playerMediaPaused: Map<string, { avatar: boolean; background: boolean }> = new Map();

// Collapsed counters state
const collapsedCounters: Set<string> = new Set();

// Initialize UI
export function initUI(): void {
    setupEventListeners();
    gameState.subscribe(render);
    render(gameState.getState());

    // Start undo check interval
    undoCheckInterval = window.setInterval(updateUndoButton, 1000);

    // Apply initial theme
    applyTheme(gameState.getState().settings.theme);
    applyAnimationIntensity(gameState.getState().settings.animationIntensity);
}

// Get element safely
function $(id: string): HTMLElement {
    return document.getElementById(id)!;
}

// Setup all event listeners
function setupEventListeners(): void {
    // Setup Screen Events
    setupSetupScreenListeners();

    // Game Screen Events
    setupGameScreenListeners();

    // Modal Events
    setupModalListeners();

    // Settings Events
    setupSettingsListeners();

    // Player Settings Events
    setupPlayerSettingsListeners();
}

function setupSetupScreenListeners(): void {
    // Player count buttons
    document.querySelectorAll('.count-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const count = parseInt(btn.getAttribute('data-count') || '4');
            document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gameState.setPlayerCount(count);
            renderLayoutPresets();
        });
    });

    // Life buttons
    document.querySelectorAll('.life-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const life = parseInt(btn.getAttribute('data-life') || '40');
            document.querySelectorAll('.life-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            (document.querySelector('.custom-life-input') as HTMLInputElement).value = '';
            gameState.setStartingLife(life);
        });
    });

    // Custom life input
    document.querySelector('.custom-life-input')?.addEventListener('change', (e) => {
        const life = parseInt((e.target as HTMLInputElement).value);
        if (life > 0) {
            document.querySelectorAll('.life-btn').forEach(b => b.classList.remove('active'));
            gameState.setStartingLife(life);
        }
    });

    // Theme buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.getAttribute('data-theme') as ThemePreset;
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gameState.setTheme(theme);
            applyTheme(theme);
        });
    });

    // Table mode checkbox
    $('table-mode-checkbox')?.addEventListener('change', (e) => {
        gameState.toggleTableMode((e.target as HTMLInputElement).checked);
    });

    // Start game button
    $('start-game-btn')?.addEventListener('click', () => {
        gameState.startGame();
    });
}

function setupGameScreenListeners(): void {
    // Menu button
    $('menu-btn')?.addEventListener('click', () => {
        openModal($('settings-modal'));
    });

    // Random starter button
    $('random-starter-btn')?.addEventListener('click', () => {
        startRandomStarterAnimation();
    });

    // Next turn button
    $('next-turn-btn')?.addEventListener('click', () => {
        audioManager.play('turn');
        gameState.nextTurn();
    });

    // Undo buttons
    $('undo-btn')?.addEventListener('click', performUndo);
    $('floating-undo-btn')?.addEventListener('click', performUndo);

    // Random starter overlay buttons
    $('random-starter-again-btn')?.addEventListener('click', () => {
        $('random-starter-result').style.display = 'none';
        $('random-starter-again-btn').style.display = 'none';
        $('random-starter-close-btn').style.display = 'none';
        startRandomStarterAnimation();
    });

    $('random-starter-close-btn')?.addEventListener('click', () => {
        $('random-starter-overlay').classList.remove('active');
    });

    // Winner overlay
    $('close-winner-btn')?.addEventListener('click', () => {
        $('winner-overlay').classList.remove('active');
    });

    // History panel
    $('close-history-btn')?.addEventListener('click', () => {
        $('history-panel').classList.remove('active');
    });
}

function setupModalListeners(): void {
    // Close modals on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal as HTMLElement);
            }
        });
    });

    // Close modal buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal') as HTMLElement;
            closeModal(modal);
        });
    });

    // Custom counter
    $('add-custom-counter-btn')?.addEventListener('click', () => {
        const input = $('custom-counter-name') as HTMLInputElement;
        const name = input.value.trim();
        if (name && currentCountersPlayerId) {
            gameState.addCustomCounter(currentCountersPlayerId, name);
            input.value = '';
        }
    });
}

function setupSettingsListeners(): void {
    // Sound settings
    $('sound-enabled')?.addEventListener('change', (e) => {
        gameState.updateSettings({ soundEnabled: (e.target as HTMLInputElement).checked });
    });

    $('volume-slider')?.addEventListener('input', (e) => {
        gameState.updateSettings({ volume: parseInt((e.target as HTMLInputElement).value) });
    });

    $('mute-all-btn')?.addEventListener('click', () => {
        gameState.updateSettings({ soundEnabled: false });
        ($('sound-enabled') as HTMLInputElement).checked = false;
    });

    // Animation settings
    $('animations-enabled')?.addEventListener('change', (e) => {
        const enabled = (e.target as HTMLInputElement).checked;
        gameState.updateSettings({ animationsEnabled: enabled });
        document.body.classList.toggle('no-animations', !enabled);
    });

    $('animation-intensity')?.addEventListener('change', (e) => {
        const intensity = (e.target as HTMLSelectElement).value as 'subtle' | 'normal' | 'intense';
        gameState.updateSettings({ animationIntensity: intensity });
        applyAnimationIntensity(intensity);
    });

    $('show-special-moments')?.addEventListener('change', (e) => {
        gameState.updateSettings({ showSpecialMoments: (e.target as HTMLInputElement).checked });
    });

    $('show-commander-deaths')?.addEventListener('change', (e) => {
        gameState.updateSettings({ showCommanderDeaths: (e.target as HTMLInputElement).checked });
    });

    $('easter-eggs-enabled')?.addEventListener('change', (e) => {
        gameState.updateSettings({ easterEggsEnabled: (e.target as HTMLInputElement).checked });
    });

    // GIF settings
    $('gif-paused')?.addEventListener('change', (e) => {
        gameState.toggleGifPause((e.target as HTMLInputElement).checked);
    });

    $('gif-fps-reduced')?.addEventListener('change', (e) => {
        gameState.toggleGifFpsReduction((e.target as HTMLInputElement).checked);
    });

    // Theme buttons in settings
    document.querySelectorAll('.theme-btn-sm').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.getAttribute('data-theme') as ThemePreset;
            document.querySelectorAll('.theme-btn-sm').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gameState.setTheme(theme);
            applyTheme(theme);
        });
    });

    // Table mode in settings
    $('table-mode-settings')?.addEventListener('change', (e) => {
        gameState.toggleTableMode((e.target as HTMLInputElement).checked);
    });

    // Timer settings
    $('turn-timer-enabled')?.addEventListener('change', (e) => {
        gameState.updateSettings({ turnTimerEnabled: (e.target as HTMLInputElement).checked });
    });

    $('timer-duration')?.addEventListener('change', (e) => {
        gameState.updateSettings({ turnTimerDuration: parseInt((e.target as HTMLInputElement).value) });
    });

    // Random starter animation
    $('random-starter-animation')?.addEventListener('change', (e) => {
        gameState.setRandomStarterAnimation((e.target as HTMLSelectElement).value as RandomAnimationType);
    });

    // Game mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode') as 'standard' | 'planechase' | 'archenemy';
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gameState.setGameMode(mode);
        });
    });

    // Reset and new game buttons
    $('reset-game-btn')?.addEventListener('click', () => {
        if (confirm('Tem certeza que deseja resetar a partida?')) {
            // Check if any player has commander deaths
            const state = gameState.getState();
            const hasCommanderDeaths = state.players.some(p => p.commanderDeaths > 0);

            let resetDeaths = false;
            if (hasCommanderDeaths) {
                resetDeaths = confirm('Deseja também zerar as mortes do comandante (Commander Tax)?');
            }

            gameState.resetGame(resetDeaths);
            closeAllModals();
        }
    });

    $('new-game-btn')?.addEventListener('click', () => {
        if (confirm('Tem certeza que deseja iniciar uma nova partida?')) {
            gameState.newGame();
            closeAllModals();
        }
    });
}

function setupPlayerSettingsListeners(): void {
    // Color options
    document.querySelectorAll('.color-option').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });

    // Emoji options
    document.querySelectorAll('.emoji-option').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.emoji-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });

    // Tag options
    document.querySelectorAll('.tag-option').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tag-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            ($('custom-tag-input') as HTMLInputElement).value = '';
        });
    });

    // Avatar upload
    $('avatar-upload-btn')?.addEventListener('click', () => {
        ($('avatar-input') as HTMLInputElement).click();
    });

    $('avatar-input')?.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const preview = $('avatar-preview') as HTMLImageElement;
                const container = $('avatar-preview-container');
                const placeholder = $('avatar-placeholder');
                const controls = $('avatar-controls');
                const typeBadge = $('avatar-type-badge');

                preview.src = reader.result as string;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
                container.classList.add('has-media');
                $('avatar-clear-btn').style.display = 'flex';

                // Check if it's a GIF
                const isGif = file.type === 'image/gif';
                if (isGif) {
                    controls.style.display = 'flex';
                    typeBadge.textContent = 'GIF';
                    typeBadge.className = 'media-type-badge gif';
                } else {
                    controls.style.display = 'none';
                    typeBadge.textContent = 'Imagem';
                    typeBadge.className = 'media-type-badge image';
                }
                typeBadge.style.display = 'inline';
            };
            reader.readAsDataURL(file);
        }
    });

    $('avatar-clear-btn')?.addEventListener('click', () => {
        ($('avatar-input') as HTMLInputElement).value = '';
        const preview = $('avatar-preview') as HTMLImageElement;
        const container = $('avatar-preview-container');
        const placeholder = $('avatar-placeholder');
        const controls = $('avatar-controls');
        const typeBadge = $('avatar-type-badge');

        preview.src = '';
        preview.style.display = 'none';
        placeholder.style.display = 'flex';
        container.classList.remove('has-media');
        controls.style.display = 'none';
        $('avatar-clear-btn').style.display = 'none';
        typeBadge.style.display = 'none';
    });

    // Background upload
    $('background-upload-btn')?.addEventListener('click', () => {
        ($('background-input') as HTMLInputElement).click();
    });

    $('background-input')?.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const preview = $('background-preview') as HTMLImageElement;
                const container = $('background-preview-container');
                const placeholder = $('background-placeholder');
                const controls = $('background-controls');
                const typeBadge = $('background-type-badge');

                preview.src = reader.result as string;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
                container.classList.add('has-media');
                $('background-clear-btn').style.display = 'flex';

                // Check if it's a GIF
                const isGif = file.type === 'image/gif';
                if (isGif) {
                    controls.style.display = 'flex';
                    typeBadge.textContent = 'GIF';
                    typeBadge.className = 'media-type-badge gif';
                } else {
                    controls.style.display = 'none';
                    typeBadge.textContent = 'Imagem';
                    typeBadge.className = 'media-type-badge image';
                }
                typeBadge.style.display = 'inline';
            };
            reader.readAsDataURL(file);
        }
    });

    $('background-clear-btn')?.addEventListener('click', () => {
        ($('background-input') as HTMLInputElement).value = '';
        const preview = $('background-preview') as HTMLImageElement;
        const container = $('background-preview-container');
        const placeholder = $('background-placeholder');
        const controls = $('background-controls');
        const typeBadge = $('background-type-badge');

        preview.src = '';
        preview.style.display = 'none';
        placeholder.style.display = 'flex';
        container.classList.remove('has-media');
        controls.style.display = 'none';
        $('background-clear-btn').style.display = 'none';
        typeBadge.style.display = 'none';
    });

    // Sound uploads
    document.querySelectorAll('.upload-btn-sm').forEach(btn => {
        btn.addEventListener('click', () => {
            const soundType = btn.getAttribute('data-sound');
            const input = $(`${soundType}-sound-input`) as HTMLInputElement;
            input?.click();
        });
    });

    // Save player settings
    $('save-player-settings-btn')?.addEventListener('click', savePlayerSettings);

    // Color picker modal
    $('open-color-picker-btn')?.addEventListener('click', openColorPicker);
    $('apply-color-btn')?.addEventListener('click', applyCustomColor);

    // Color picker canvas interactions
    setupColorPickerCanvas();

    // Color input listeners
    $('color-hex-input')?.addEventListener('input', (e) => {
        const hex = (e.target as HTMLInputElement).value;
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
            updateColorFromHex(hex);
        }
    });

    ['color-r-input', 'color-g-input', 'color-b-input'].forEach(id => {
        $(id)?.addEventListener('input', updateColorFromRGB);
    });

    // Image search buttons
    $('avatar-search-btn')?.addEventListener('click', () => {
        imageSearchTarget = 'avatar';
        imageSearchType = 'gif';
        openImageSearch('Buscar GIF para Avatar');
    });

    $('background-search-btn')?.addEventListener('click', () => {
        imageSearchTarget = 'background';
        imageSearchType = 'image';
        openImageSearch('Buscar Imagem para Fundo');
    });

    // Image search
    $('image-search-btn')?.addEventListener('click', performImageSearch);
    $('image-search-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performImageSearch();
    });

    // Image search tabs
    document.querySelectorAll('.image-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.image-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            imageSearchType = tab.getAttribute('data-type') as 'gif' | 'image';
            // Re-search if there's a query
            const query = ($('image-search-input') as HTMLInputElement).value.trim();
            if (query) performImageSearch();
        });
    });

    // Suggestion chips
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const query = chip.getAttribute('data-query') || '';
            ($('image-search-input') as HTMLInputElement).value = query;
            performImageSearch();
        });
    });

    // Preview actions
    $('cancel-image-btn')?.addEventListener('click', cancelImageSelection);
    $('apply-image-btn')?.addEventListener('click', applySelectedImage);

    // Media pause controls in player settings
    $('avatar-pause-btn')?.addEventListener('click', () => toggleMediaPreviewPause('avatar'));
    $('background-pause-btn')?.addEventListener('click', () => toggleMediaPreviewPause('background'));
}

// Apply theme
function applyTheme(theme: ThemePreset): void {
    document.body.setAttribute('data-theme', theme);
}

// Apply animation intensity
function applyAnimationIntensity(intensity: 'subtle' | 'normal' | 'intense'): void {
    document.body.setAttribute('data-anim-intensity', intensity);
}

// Render the entire UI based on state
function render(state: GameState): void {
    if (state.gameStarted) {
        renderGame(state);
    } else {
        renderSetup(state);
    }
}

// Render setup screen
function renderSetup(state: GameState): void {
    $('setup-screen').classList.add('active');
    $('game-screen').classList.remove('active');

    // Update player count button
    document.querySelectorAll('.count-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.getAttribute('data-count') || '0') === state.settings.playerCount);
    });

    // Render layout presets
    renderLayoutPresets();

    // Update player setup list
    const playerList = $('player-setup-list');
    playerList.innerHTML = state.players.map((player, index) => `
        <div class="player-setup-item" data-player-id="${player.id}">
            <div class="player-color-dot"
                 style="background: ${player.color}"
                 data-action="edit-player">
                ${player.emoji || ''}
            </div>
            <input type="text"
                   class="player-setup-input"
                   value="${player.name}"
                   placeholder="Jogador ${index + 1}"
                   data-action="edit-name">
            ${player.tag ? `<span class="player-setup-tag">${player.tag}</span>` : ''}
        </div>
    `).join('');

    // Add event listeners for player setup
    playerList.querySelectorAll('.player-setup-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            const item = target.closest('.player-setup-item') as HTMLElement;
            const playerId = item.dataset.playerId!;
            gameState.updatePlayerSetup(playerId, { name: target.value || `Jogador` });
        });
    });

    playerList.querySelectorAll('.player-color-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
            const item = (e.target as HTMLElement).closest('.player-setup-item') as HTMLElement;
            const playerId = item.dataset.playerId!;
            openPlayerSettings(playerId);
        });
    });
}

// Render layout presets
function renderLayoutPresets(): void {
    const state = gameState.getState();
    const presets = LAYOUT_PRESETS[state.settings.playerCount] || [];
    const currentPreset = state.settings.layout.preset;

    const presetsHtml = presets.map(preset => {
        const label = preset.rows.join(' / ');
        return `
            <button class="layout-preset-btn ${preset.preset === currentPreset ? 'active' : ''}"
                    data-preset="${preset.preset}">
                ${label}
            </button>
        `;
    }).join('');

    const layoutPresetsEl = $('layout-presets');
    if (layoutPresetsEl) {
        layoutPresetsEl.innerHTML = presetsHtml;

        // Add event listeners
        layoutPresetsEl.querySelectorAll('.layout-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const presetName = btn.getAttribute('data-preset')!;
                gameState.setLayoutPreset(presetName);
                renderLayoutPresets();
            });
        });
    }

    // Also update settings modal layout presets
    const settingsLayoutPresets = $('layout-presets-settings');
    if (settingsLayoutPresets) {
        settingsLayoutPresets.innerHTML = presetsHtml.replace(/layout-preset-btn/g, 'layout-preset-btn');
        settingsLayoutPresets.querySelectorAll('.layout-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const presetName = btn.getAttribute('data-preset')!;
                gameState.setLayoutPreset(presetName);
            });
        });
    }
}

// Render game screen
function renderGame(state: GameState): void {
    $('setup-screen').classList.remove('active');
    $('game-screen').classList.add('active');

    // Update turn indicator
    $('turn-count').textContent = `Turno ${state.currentTurn}`;
    const activePlayer = state.players[state.activePlayerIndex];
    $('active-player-name').textContent = activePlayer ? activePlayer.name : '';

    // Update players grid layout
    const grid = $('players-grid');
    updateGridLayout(grid, state);
    renderPlayers(state);

    // Update settings controls
    updateSettingsControls(state);

    // Handle turn timer
    updateTurnTimer(state);

    // Check for winner
    if (state.winner) {
        const winner = state.players.find(p => p.id === state.winner);
        if (winner) {
            showWinner(winner);
        }
    }

    // Update modals if open
    if (currentCommanderDamagePlayerId) {
        renderCommanderDamageModal(state, currentCommanderDamagePlayerId);
    }
    if (currentCountersPlayerId) {
        renderCountersModal(state, currentCountersPlayerId);
    }
}

// Update grid layout based on layout config
function updateGridLayout(grid: HTMLElement, state: GameState): void {
    const { layout } = state.settings;
    const rows = layout.rows;

    // Set grid template rows
    grid.className = `players-grid layout-rows-${rows.length}`;

    // Calculate grid template columns for each row
    let gridTemplateAreas = '';
    let playerIndex = 0;
    const areas: string[][] = [];

    for (let r = 0; r < rows.length; r++) {
        const playersInRow = rows[r];
        const maxInRow = Math.max(...rows);
        const rowAreas: string[] = [];

        for (let c = 0; c < maxInRow; c++) {
            if (c < playersInRow) {
                rowAreas.push(`p${playerIndex}`);
                playerIndex++;
            } else {
                // Fill with previous player to span
                rowAreas.push(rowAreas[rowAreas.length - 1] || '.');
            }
        }
        areas.push(rowAreas);
    }

    // Build grid template
    const maxCols = Math.max(...rows);
    grid.style.gridTemplateColumns = `repeat(${maxCols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${rows.length}, 1fr)`;
    grid.style.gridTemplateAreas = areas.map(row => `"${row.join(' ')}"`).join(' ');
}

// Render player cards
function renderPlayers(state: GameState): void {
    const grid = $('players-grid');
    const { layout } = state.settings;

    grid.innerHTML = state.players.map((player, index) => {
        const isActive = index === state.activePlayerIndex;
        const isLowLife = player.life <= SPECIAL_MOMENTS.DANGER_ZONE && player.life > SPECIAL_MOMENTS.LOW_LIFE;
        const isCriticalLife = player.life <= SPECIAL_MOMENTS.LOW_LIFE && player.life > 0;
        const hasLethalCommanderDamage = Object.values(player.commanderDamage).some(d => d >= COMMANDER_DAMAGE_LETHAL);

        const classes = [
            'player-card',
            isActive ? 'active-turn' : '',
            isLowLife && !player.isEliminated ? 'low-life' : '',
            isCriticalLife && !player.isEliminated ? 'critical-life' : '',
            player.isEliminated ? 'eliminated' : '',
            player.id === state.winner ? 'winner' : '',
            state.settings.gifPaused ? 'gif-paused' : '',
        ].filter(Boolean).join(' ');

        const rotation = layout.tableMode ? player.rotation : 0;
        const countersHtml = renderPlayerCountersBadges(player);
        const backgroundStyle = player.background ?
            `background-image: url(${player.background});` : '';

        const reviveHtml = player.isEliminated ? `
            <div class="revive-overlay">
                <button class="revive-btn" data-action="revive">Reviver</button>
            </div>
        ` : '';

        const countersCollapsed = collapsedCounters.has(player.id);

        return `
            <div class="player-card ${classes}"
                 data-player-id="${player.id}"
                 data-rotation="${rotation}"
                 style="--player-color: ${player.color}; grid-area: p${index};">
                ${player.background ? `<div class="player-card-background has-background" style="${backgroundStyle}"></div>` : ''}
                <div class="player-header">
                    <div class="player-info">
                        ${player.emoji ? `<span class="player-emoji">${player.emoji}</span>` :
                          player.avatar ? `<img src="${player.avatar}" class="player-avatar" alt="${player.name}">` :
                          `<div class="player-avatar" style="background: ${player.color}"></div>`}
                        <span class="player-name">${player.name}</span>
                        ${player.tag ? `<span class="player-tag">${player.tag}</span>` : ''}
                        ${player.isMonarch ? '<span class="player-emoji">👑</span>' : ''}
                    </div>
                    <div class="player-actions">
                        <button class="player-action-btn" data-action="commander" title="Dano de Comandante">⚔️</button>
                        <button class="player-action-btn" data-action="counters" title="Contadores">📊</button>
                        <button class="player-action-btn" data-action="settings" title="Config">⚙️</button>
                    </div>
                </div>
                <div class="player-life-container">
                    <button class="life-control minus" data-action="life" data-amount="-1">−</button>
                    <div class="life-display">
                        <span class="life-value">${player.life}</span>
                        <span class="life-label">Vida</span>
                    </div>
                    <button class="life-control plus" data-action="life" data-amount="1">+</button>
                    <div class="life-change-indicator"></div>
                </div>
                <div class="player-footer ${countersCollapsed ? 'collapsed' : ''}" data-player-id="${player.id}">
                    ${countersHtml}
                </div>
                ${reviveHtml}
            </div>
        `;
    }).join('');

    // Add event listeners for player cards
    grid.querySelectorAll('.player-card').forEach(card => {
        const playerId = (card as HTMLElement).dataset.playerId!;

        // Life controls with hold support
        card.querySelectorAll('.life-control').forEach(btn => {
            const amount = parseInt((btn as HTMLElement).dataset.amount || '0');

            btn.addEventListener('mousedown', (e) => startLifeChange(playerId, amount, e));
            btn.addEventListener('touchstart', (e) => startLifeChange(playerId, amount, e), { passive: true });
            btn.addEventListener('mouseup', stopLifeChange);
            btn.addEventListener('mouseleave', stopLifeChange);
            btn.addEventListener('touchend', stopLifeChange);
            btn.addEventListener('touchcancel', stopLifeChange);
        });

        // Action buttons
        card.querySelector('[data-action="commander"]')?.addEventListener('click', () => {
            openCommanderDamageModal(playerId);
        });

        card.querySelector('[data-action="counters"]')?.addEventListener('click', () => {
            openCountersModal(playerId);
        });

        card.querySelector('[data-action="settings"]')?.addEventListener('click', () => {
            openPlayerSettings(playerId);
        });

        // Revive button
        card.querySelector('[data-action="revive"]')?.addEventListener('click', () => {
            handleRevivePlayer(playerId);
        });

        // Commander deaths badge click (increment)
        const commanderDeathsBadge = card.querySelector('[data-action="commander-deaths"]');
        if (commanderDeathsBadge) {
            commanderDeathsBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                handleCommanderDeathChange(playerId, 1);
            });
            // Right click or long press to decrement
            commanderDeathsBadge.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCommanderDeathChange(playerId, -1);
            });
            // Long press for mobile
            let longPressTimer: number | null = null;
            commanderDeathsBadge.addEventListener('touchstart', () => {
                longPressTimer = window.setTimeout(() => {
                    handleCommanderDeathChange(playerId, -1);
                }, 500);
            }, { passive: true });
            commanderDeathsBadge.addEventListener('touchend', () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            });
        }

        // Counter footer collapse toggle (double tap)
        const footer = card.querySelector('.player-footer') as HTMLElement;
        if (footer) {
            let lastTap = 0;
            footer.addEventListener('touchend', (e) => {
                // Don't collapse if clicking on a badge
                if ((e.target as HTMLElement).closest('.counter-badge')) return;
                const now = Date.now();
                if (now - lastTap < 300) {
                    toggleCountersCollapse(playerId);
                }
                lastTap = now;
            });
            footer.addEventListener('dblclick', (e) => {
                // Don't collapse if clicking on a badge
                if ((e.target as HTMLElement).closest('.counter-badge')) return;
                toggleCountersCollapse(playerId);
            });
        }
    });
}

// Render counter badges for player footer
function renderPlayerCountersBadges(player: Player): string {
    const badges: string[] = [];
    const state = gameState.getState();

    // Commander Deaths (Tax) - show first if enabled
    if (state.settings.showCommanderDeaths && player.commanderDeaths >= 0) {
        const tax = player.commanderDeaths * 2;
        const taxDisplay = tax > 0 ? `<span class="tax-value">+${tax}</span>` : '';
        badges.push(`<span class="counter-badge commander-deaths" data-action="commander-deaths" data-player-id="${player.id}" title="Mortes: ${player.commanderDeaths} | Tax: +${tax}">🪦 ${player.commanderDeaths}${taxDisplay}</span>`);
    }

    if (player.counters.poison > 0) {
        const isLethal = player.counters.poison >= 10;
        badges.push(`<span class="counter-badge poison ${isLethal ? 'lethal' : ''}">☠️ ${player.counters.poison}</span>`);
    }

    if (player.counters.experience > 0) {
        badges.push(`<span class="counter-badge experience">⭐ ${player.counters.experience}</span>`);
    }

    if (player.counters.energy > 0) {
        badges.push(`<span class="counter-badge energy">⚡ ${player.counters.energy}</span>`);
    }

    if (player.counters.storm > 0) {
        badges.push(`<span class="counter-badge storm">🌪️ ${player.counters.storm}</span>`);
    }

    if (player.isMonarch) {
        badges.push(`<span class="counter-badge monarch">👑</span>`);
    }

    const totalCommanderDamage = Object.values(player.commanderDamage).reduce((a, b) => a + b, 0);
    if (totalCommanderDamage > 0) {
        const maxDamage = Math.max(...Object.values(player.commanderDamage));
        const isLethal = maxDamage >= COMMANDER_DAMAGE_LETHAL;
        badges.push(`<span class="counter-badge commander-damage ${isLethal ? 'lethal' : ''}">⚔️ ${totalCommanderDamage}</span>`);
    }

    player.counters.custom.forEach(counter => {
        if (counter.value > 0) {
            badges.push(`<span class="counter-badge">${counter.icon || '🔢'} ${counter.value}</span>`);
        }
    });

    return badges.join('');
}

// Update settings controls with current state
function updateSettingsControls(state: GameState): void {
    ($('sound-enabled') as HTMLInputElement).checked = state.settings.soundEnabled;
    ($('volume-slider') as HTMLInputElement).value = state.settings.volume.toString();
    ($('animations-enabled') as HTMLInputElement).checked = state.settings.animationsEnabled;
    ($('animation-intensity') as HTMLSelectElement).value = state.settings.animationIntensity;
    ($('show-special-moments') as HTMLInputElement).checked = state.settings.showSpecialMoments;
    ($('show-commander-deaths') as HTMLInputElement).checked = state.settings.showCommanderDeaths;
    ($('easter-eggs-enabled') as HTMLInputElement).checked = state.settings.easterEggsEnabled;
    ($('gif-paused') as HTMLInputElement).checked = state.settings.gifPaused;
    ($('gif-fps-reduced') as HTMLInputElement).checked = state.settings.gifFpsReduced;
    ($('turn-timer-enabled') as HTMLInputElement).checked = state.settings.turnTimerEnabled;
    ($('timer-duration') as HTMLInputElement).value = state.settings.turnTimerDuration.toString();
    ($('random-starter-animation') as HTMLSelectElement).value = state.settings.randomStarterAnimation;
    ($('table-mode-settings') as HTMLInputElement).checked = state.settings.layout.tableMode;

    // Update theme buttons
    document.querySelectorAll('.theme-btn-sm').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-theme') === state.settings.theme);
    });

    // Update mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-mode') === state.gameMode);
    });
}

// Life change with hold support
function startLifeChange(playerId: string, baseAmount: number, event: Event): void {
    event.preventDefault();
    const state = gameState.getState();
    const player = state.players.find(p => p.id === playerId);
    if (!player || player.isEliminated) return;

    changeLifeWithFeedback(playerId, baseAmount);

    let holdCount = 0;
    holdTimeout = window.setTimeout(() => {
        holdInterval = window.setInterval(() => {
            holdCount++;
            const multiplier = holdCount > 20 ? 10 : holdCount > 10 ? 5 : 1;
            changeLifeWithFeedback(playerId, baseAmount * multiplier);
        }, 100);
    }, 300);
}

function stopLifeChange(): void {
    if (holdTimeout) {
        clearTimeout(holdTimeout);
        holdTimeout = null;
    }
    if (holdInterval) {
        clearInterval(holdInterval);
        holdInterval = null;
    }
}

function changeLifeWithFeedback(playerId: string, amount: number): void {
    const card = $('players-grid').querySelector(`[data-player-id="${playerId}"]`);
    if (!card) return;

    const lifeValue = card.querySelector('.life-value') as HTMLElement;
    const indicator = card.querySelector('.life-change-indicator') as HTMLElement;

    const state = gameState.getState();
    const playerBefore = state.players.find(p => p.id === playerId);
    const lifeBefore = playerBefore?.life || 0;

    gameState.changeLife(playerId, amount);

    audioManager.play(amount < 0 ? 'damage' : 'heal', playerId);

    const newState = gameState.getState();
    if (newState.settings.animationsEnabled) {
        lifeValue.classList.remove('damage', 'heal', 'changed');
        void lifeValue.offsetWidth;
        lifeValue.classList.add(amount < 0 ? 'damage' : 'heal');

        indicator.textContent = (amount > 0 ? '+' : '') + amount;
        indicator.className = `life-change-indicator show ${amount > 0 ? 'positive' : 'negative'}`;
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 800);
    }

    // Check for special moments
    const playerAfter = newState.players.find(p => p.id === playerId);
    if (playerAfter && newState.settings.showSpecialMoments) {
        if (playerAfter.life === SPECIAL_MOMENTS.NEAR_DEATH && lifeBefore > SPECIAL_MOMENTS.NEAR_DEATH) {
            showSpecialMoment(`${playerAfter.name} está com 1 de vida!`, 'danger');
        }
    }
}

// Undo functionality
function performUndo(): void {
    const result = gameState.undo();
    if (result) {
        audioManager.play('click');
        updateUndoButton();
    }
}

function updateUndoButton(): void {
    const canUndo = gameState.canUndo();
    const undoBtn = $('undo-btn');
    const floatingUndoBtn = $('floating-undo-btn');

    if (undoBtn) {
        undoBtn.style.display = canUndo ? 'flex' : 'none';
        undoBtn.classList.toggle('has-undo', canUndo);
    }

    if (floatingUndoBtn) {
        floatingUndoBtn.style.display = canUndo ? 'flex' : 'none';
    }
}

// Random Starter Animation
function startRandomStarterAnimation(): void {
    const state = gameState.getState();
    const overlay = $('random-starter-overlay');
    const display = $('random-starter-display');
    const message = $('random-starter-message');

    // Show easter egg message occasionally
    if (state.settings.easterEggsEnabled && Math.random() < 0.2) {
        const randomMessage = EASTER_EGG_MESSAGES[Math.floor(Math.random() * EASTER_EGG_MESSAGES.length)];
        message.textContent = randomMessage;
    } else {
        message.textContent = 'Quem comeca?';
    }

    overlay.classList.add('active');

    // Create player icons
    const alivePlayers = state.players.filter(p => !p.isEliminated);
    display.innerHTML = alivePlayers.map(player => `
        <div class="random-starter-player" data-player-id="${player.id}">
            <div class="player-icon" style="background: ${player.color}">
                ${player.emoji || ''}
            </div>
            <div class="player-name">${player.name}</div>
        </div>
    `).join('');

    // Start animation
    const animationType = state.settings.randomStarterAnimation;
    let currentIndex = 0;
    const duration = animationType === 'flash' ? 1500 : 3000;
    const intervalTime = animationType === 'flash' ? 50 : animationType === 'roulette' ? 100 : 150;

    audioManager.play('click');

    randomStarterAnimationInterval = window.setInterval(() => {
        const playerElements = display.querySelectorAll('.random-starter-player');

        // Clear previous highlights
        playerElements.forEach(el => el.classList.remove('highlight'));

        // Highlight current
        if (animationType === 'highlight') {
            playerElements[currentIndex]?.classList.add('highlight');
            currentIndex = (currentIndex + 1) % alivePlayers.length;
        } else if (animationType === 'roulette') {
            playerElements[currentIndex]?.classList.add('highlight');
            currentIndex = (currentIndex + 1) % alivePlayers.length;
        } else if (animationType === 'flash') {
            const randomIdx = Math.floor(Math.random() * alivePlayers.length);
            playerElements[randomIdx]?.classList.add('highlight');
        }

        audioManager.play('click');
    }, intervalTime);

    // End animation and show result
    setTimeout(() => {
        if (randomStarterAnimationInterval) {
            clearInterval(randomStarterAnimationInterval);
            randomStarterAnimationInterval = null;
        }

        // Select random winner
        const winnerIndex = gameState.selectRandomStarter();
        const winner = gameState.getState().players[winnerIndex];

        // Show winner
        const playerElements = display.querySelectorAll('.random-starter-player');
        playerElements.forEach(el => el.classList.remove('highlight'));

        const winnerElement = display.querySelector(`[data-player-id="${winner.id}"]`);
        winnerElement?.classList.add('winner');

        $('random-starter-result').style.display = 'block';
        $('random-starter-winner').textContent = winner.name;
        $('random-starter-again-btn').style.display = 'inline-block';
        $('random-starter-close-btn').style.display = 'inline-block';

        audioManager.play('win');
    }, duration);
}

// Commander Damage Modal
function openCommanderDamageModal(playerId: string): void {
    currentCommanderDamagePlayerId = playerId;
    const state = gameState.getState();
    renderCommanderDamageModal(state, playerId);
    openModal($('commander-damage-modal'));
}

function renderCommanderDamageModal(state: GameState, playerId: string): void {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    const otherPlayers = state.players.filter(p => p.id !== playerId);

    $('commander-damage-grid').innerHTML = otherPlayers.map(source => {
        const damage = player.commanderDamage[source.id] || 0;
        const isLethal = damage >= COMMANDER_DAMAGE_LETHAL;
        const isDanger = damage >= SPECIAL_MOMENTS.COMMANDER_DANGER && !isLethal;

        return `
            <div class="commander-damage-item ${isLethal ? 'lethal' : isDanger ? 'danger' : ''}" data-source-id="${source.id}">
                <div class="commander-color-indicator" style="background: ${source.color}"></div>
                <div class="commander-damage-info">
                    <div class="commander-name">${source.name}</div>
                    <div class="commander-damage-label">Dano de Comandante</div>
                </div>
                <div class="commander-damage-controls">
                    <button class="damage-btn" data-action="decrease">−</button>
                    <span class="commander-damage-value ${isLethal ? 'lethal' : isDanger ? 'danger' : ''}">${damage}</span>
                    <button class="damage-btn" data-action="increase">+</button>
                </div>
            </div>
        `;
    }).join('');

    // Add event listeners
    $('commander-damage-grid').querySelectorAll('.commander-damage-item').forEach(item => {
        const sourceId = (item as HTMLElement).dataset.sourceId!;

        item.querySelector('[data-action="decrease"]')?.addEventListener('click', () => {
            gameState.addCommanderDamage(playerId, sourceId, -1);
        });

        item.querySelector('[data-action="increase"]')?.addEventListener('click', () => {
            gameState.addCommanderDamage(playerId, sourceId, 1);
            audioManager.play('damage', playerId);
        });
    });
}

// Counters Modal
function openCountersModal(playerId: string): void {
    currentCountersPlayerId = playerId;
    const state = gameState.getState();
    renderCountersModal(state, playerId);
    openModal($('counters-modal'));
}

function renderCountersModal(state: GameState, playerId: string): void {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    // Commander Deaths (Tax) section - always first
    const commanderTax = player.commanderDeaths * 2;
    const commanderDeathsHtml = `
        <div class="counter-item commander-deaths-item" data-counter-id="commanderDeaths">
            <div class="counter-icon">🪦</div>
            <div class="counter-info">
                <div class="counter-name">Mortes do Comandante</div>
                <div class="counter-tax-info">Commander Tax: <strong>+${commanderTax}</strong> incolor</div>
            </div>
            <div class="counter-controls">
                <button class="counter-btn" data-action="decrease">−</button>
                <span class="counter-value">${player.commanderDeaths}</span>
                <button class="counter-btn" data-action="increase">+</button>
            </div>
        </div>
    `;

    const presetHtml = PRESET_COUNTERS.map(preset => {
        const value = player.counters[preset.id as keyof typeof player.counters] as number || 0;
        const isLethal = preset.lethalValue !== null && value >= preset.lethalValue;

        return `
            <div class="counter-item" data-counter-id="${preset.id}">
                <div class="counter-icon">${preset.icon}</div>
                <div class="counter-info">
                    <div class="counter-name">${preset.name}</div>
                    ${preset.lethalValue !== null ? `<div class="counter-lethal-info">${preset.lethalValue}+ = Eliminado</div>` : ''}
                </div>
                <div class="counter-controls">
                    <button class="counter-btn" data-action="decrease">−</button>
                    <span class="counter-value ${isLethal ? 'lethal' : ''}">${value}</span>
                    <button class="counter-btn" data-action="increase">+</button>
                </div>
            </div>
        `;
    }).join('');

    const monarchHtml = `
        <div class="counter-item" data-counter-id="monarch">
            <div class="counter-icon">👑</div>
            <div class="counter-info">
                <div class="counter-name">Monarquia</div>
            </div>
            <button class="counter-toggle ${player.isMonarch ? 'active' : ''}" data-action="toggle-monarch"></button>
        </div>
    `;

    const customHtml = player.counters.custom.map(counter => `
        <div class="counter-item custom" data-counter-id="${counter.id}">
            <div class="counter-icon">${counter.icon || '🔢'}</div>
            <div class="counter-info">
                <div class="counter-name">${counter.name}</div>
            </div>
            <div class="counter-controls">
                <button class="counter-btn" data-action="decrease">−</button>
                <span class="counter-value">${counter.value}</span>
                <button class="counter-btn" data-action="increase">+</button>
                <button class="counter-btn remove" data-action="remove">×</button>
            </div>
        </div>
    `).join('');

    $('counters-list').innerHTML = commanderDeathsHtml + presetHtml + monarchHtml + customHtml;

    // Add event listeners
    $('counters-list').querySelectorAll('.counter-item').forEach(item => {
        const counterId = (item as HTMLElement).dataset.counterId!;

        if (counterId === 'commanderDeaths') {
            item.querySelector('[data-action="decrease"]')?.addEventListener('click', () => {
                gameState.changeCommanderDeaths(playerId, -1);
            });
            item.querySelector('[data-action="increase"]')?.addEventListener('click', () => {
                gameState.changeCommanderDeaths(playerId, 1);
            });
        } else if (counterId === 'monarch') {
            item.querySelector('[data-action="toggle-monarch"]')?.addEventListener('click', () => {
                const p = gameState.getState().players.find(p => p.id === playerId);
                if (p?.isMonarch) {
                    gameState.removeMonarch();
                } else {
                    gameState.setMonarch(playerId);
                }
            });
        } else if (item.classList.contains('custom')) {
            item.querySelector('[data-action="decrease"]')?.addEventListener('click', () => {
                gameState.changeCustomCounter(playerId, counterId, -1);
            });
            item.querySelector('[data-action="increase"]')?.addEventListener('click', () => {
                gameState.changeCustomCounter(playerId, counterId, 1);
            });
            item.querySelector('[data-action="remove"]')?.addEventListener('click', () => {
                gameState.removeCustomCounter(playerId, counterId);
            });
        } else {
            const validCounterTypes = ['poison', 'experience', 'energy', 'storm'] as const;
            type CounterType = typeof validCounterTypes[number];
            if (validCounterTypes.includes(counterId as CounterType)) {
                item.querySelector('[data-action="decrease"]')?.addEventListener('click', () => {
                    gameState.changeCounter(playerId, counterId as CounterType, -1);
                });
                item.querySelector('[data-action="increase"]')?.addEventListener('click', () => {
                    gameState.changeCounter(playerId, counterId as CounterType, 1);
                });
            }
        }
    });
}

// Player Settings Modal
function openPlayerSettings(playerId: string): void {
    currentEditingPlayerId = playerId;
    const state = gameState.getState();
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    ($('player-name-input') as HTMLInputElement).value = player.name;

    // Select current color
    document.querySelectorAll('.color-option').forEach(btn => {
        const color = btn.getAttribute('data-color');
        btn.classList.toggle('selected', color === player.color);
    });

    // Select current emoji
    document.querySelectorAll('.emoji-option').forEach(btn => {
        const emoji = btn.getAttribute('data-emoji');
        btn.classList.toggle('selected', emoji === (player.emoji || ''));
    });

    // Select current tag
    document.querySelectorAll('.tag-option').forEach(btn => {
        const tag = btn.getAttribute('data-tag');
        btn.classList.toggle('selected', tag === (player.tag || ''));
    });
    ($('custom-tag-input') as HTMLInputElement).value = '';

    // Setup avatar preview
    const avatarPreview = $('avatar-preview') as HTMLImageElement;
    const avatarContainer = $('avatar-preview-container');
    const avatarPlaceholder = $('avatar-placeholder');
    const avatarControls = $('avatar-controls');
    const avatarTypeBadge = $('avatar-type-badge');

    if (player.avatar) {
        avatarPreview.src = player.avatar;
        avatarPreview.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
        avatarContainer.classList.add('has-media');
        $('avatar-clear-btn').style.display = 'flex';

        // Determine if it's a GIF
        const isGif = player.avatar.includes('.gif') || player.avatar.includes('image/gif') || player.avatar.includes('tenor');
        if (isGif) {
            avatarControls.style.display = 'flex';
            avatarTypeBadge.textContent = 'GIF';
            avatarTypeBadge.className = 'media-type-badge gif';
        } else {
            avatarControls.style.display = 'none';
            avatarTypeBadge.textContent = 'Imagem';
            avatarTypeBadge.className = 'media-type-badge image';
        }
        avatarTypeBadge.style.display = 'inline';
    } else {
        avatarPreview.style.display = 'none';
        avatarPlaceholder.style.display = 'flex';
        avatarContainer.classList.remove('has-media');
        avatarControls.style.display = 'none';
        $('avatar-clear-btn').style.display = 'none';
        avatarTypeBadge.style.display = 'none';
    }

    // Setup background preview
    const bgPreview = $('background-preview') as HTMLImageElement;
    const bgContainer = $('background-preview-container');
    const bgPlaceholder = $('background-placeholder');
    const bgControls = $('background-controls');
    const bgTypeBadge = $('background-type-badge');

    if (player.background) {
        bgPreview.src = player.background;
        bgPreview.style.display = 'block';
        bgPlaceholder.style.display = 'none';
        bgContainer.classList.add('has-media');
        $('background-clear-btn').style.display = 'flex';

        // Determine if it's a GIF
        const isGif = player.backgroundType === 'gif' || player.background.includes('.gif') || player.background.includes('image/gif') || player.background.includes('tenor');
        if (isGif) {
            bgControls.style.display = 'flex';
            bgTypeBadge.textContent = 'GIF';
            bgTypeBadge.className = 'media-type-badge gif';
        } else {
            bgControls.style.display = 'none';
            bgTypeBadge.textContent = 'Imagem';
            bgTypeBadge.className = 'media-type-badge image';
        }
        bgTypeBadge.style.display = 'inline';
    } else {
        bgPreview.style.display = 'none';
        bgPlaceholder.style.display = 'flex';
        bgContainer.classList.remove('has-media');
        bgControls.style.display = 'none';
        $('background-clear-btn').style.display = 'none';
        bgTypeBadge.style.display = 'none';
    }

    openModal($('player-settings-modal'));
}

function savePlayerSettings(): void {
    if (!currentEditingPlayerId) return;

    const name = ($('player-name-input') as HTMLInputElement).value.trim() || 'Jogador';

    // Check for custom color first, then preset color
    let color: string;
    const customColorPreview = $('custom-color-preview');
    if (customColorPreview && customColorPreview.style.display !== 'none' && selectedCustomColor) {
        color = selectedCustomColor;
    } else {
        const selectedColor = document.querySelector('.color-option.selected');
        color = selectedColor?.getAttribute('data-color') || DEFAULT_PLAYER_COLORS[0];
    }

    const selectedEmoji = document.querySelector('.emoji-option.selected');
    const emoji = selectedEmoji?.getAttribute('data-emoji') || null;

    const selectedTag = document.querySelector('.tag-option.selected');
    let tag = selectedTag?.getAttribute('data-tag') || null;
    const customTag = ($('custom-tag-input') as HTMLInputElement).value.trim();
    if (customTag) tag = customTag;

    const avatar = $('avatar-preview').style.display !== 'none' ? ($('avatar-preview') as HTMLImageElement).src : null;
    const background = $('background-preview').style.display !== 'none' ? ($('background-preview') as HTMLImageElement).src : null;

    // Determine background type from the badge
    let backgroundType: 'none' | 'image' | 'gif' = 'none';
    if (background) {
        const bgTypeBadge = $('background-type-badge');
        backgroundType = bgTypeBadge?.textContent?.toLowerCase() === 'gif' ? 'gif' : 'image';
    }

    gameState.updatePlayerSetup(currentEditingPlayerId, {
        name,
        color,
        emoji,
        tag,
        avatar,
        background,
        backgroundType: backgroundType as 'none' | 'image' | 'gif',
    });

    // Reset custom color state
    selectedCustomColor = null;
    if (customColorPreview) customColorPreview.style.display = 'none';

    closeModal($('player-settings-modal'));
    currentEditingPlayerId = null;
}

// Turn Timer
function updateTurnTimer(state: GameState): void {
    const timerDisplay = $('timer-display');

    if (!state.settings.turnTimerEnabled || !state.gameStarted) {
        timerDisplay.classList.remove('active');
        if (turnTimerInterval) {
            clearInterval(turnTimerInterval);
            turnTimerInterval = null;
        }
        return;
    }

    timerDisplay.classList.add('active');

    if (turnTimerInterval) {
        clearInterval(turnTimerInterval);
    }

    const updateTimer = () => {
        const currentState = gameState.getState();
        if (!currentState.turnStartTime) return;

        const elapsed = (Date.now() - currentState.turnStartTime) / 1000;
        const remaining = Math.max(0, currentState.settings.turnTimerDuration - elapsed);
        const minutes = Math.floor(remaining / 60);
        const seconds = Math.floor(remaining % 60);

        timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        timerDisplay.classList.remove('warning', 'danger');
        if (remaining <= 10) {
            timerDisplay.classList.add('danger');
        } else if (remaining <= 30) {
            timerDisplay.classList.add('warning');
        }
    };

    updateTimer();
    turnTimerInterval = window.setInterval(updateTimer, 100);
}

// Special moments
function showSpecialMoment(message: string, type: 'danger' | 'success' | 'warning' = 'danger'): void {
    const overlay = $('special-moment-overlay');
    const content = $('special-moment-content');

    content.textContent = message;
    content.style.color = type === 'danger' ? 'var(--danger)' :
                          type === 'success' ? 'var(--success)' : 'var(--warning)';

    overlay.classList.add('active');

    setTimeout(() => {
        overlay.classList.remove('active');
    }, 1500);
}

// Winner display
function showWinner(player: Player): void {
    $('winner-name').textContent = player.name;
    $('winner-overlay').classList.add('active');
    audioManager.play('win', player.id);
}

// Modal helpers
function openModal(modal: HTMLElement): void {
    modal.classList.add('active');
}

function closeModal(modal: HTMLElement): void {
    modal.classList.remove('active');

    if (modal === $('commander-damage-modal')) {
        currentCommanderDamagePlayerId = null;
    } else if (modal === $('counters-modal')) {
        currentCountersPlayerId = null;
    } else if (modal === $('player-settings-modal')) {
        currentEditingPlayerId = null;
    }
}

function closeAllModals(): void {
    document.querySelectorAll('.modal').forEach(modal => {
        closeModal(modal as HTMLElement);
    });
}

// ===== Color Picker Functions =====

function openColorPicker(): void {
    openModal($('color-picker-modal'));
    initColorPickerCanvas();
}

function setupColorPickerCanvas(): void {
    const mainCanvas = $('color-picker-canvas') as HTMLCanvasElement;
    const hueCanvas = $('hue-picker-canvas') as HTMLCanvasElement;

    if (!mainCanvas || !hueCanvas) return;

    // Main color picker interactions
    let isDraggingMain = false;
    mainCanvas.addEventListener('mousedown', (e) => {
        isDraggingMain = true;
        handleMainCanvasClick(e);
    });
    mainCanvas.addEventListener('mousemove', (e) => {
        if (isDraggingMain) handleMainCanvasClick(e);
    });
    document.addEventListener('mouseup', () => { isDraggingMain = false; });

    mainCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleMainCanvasTouch(e);
    }, { passive: false });
    mainCanvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        handleMainCanvasTouch(e);
    }, { passive: false });

    // Hue picker interactions
    let isDraggingHue = false;
    hueCanvas.addEventListener('mousedown', (e) => {
        isDraggingHue = true;
        handleHueCanvasClick(e);
    });
    hueCanvas.addEventListener('mousemove', (e) => {
        if (isDraggingHue) handleHueCanvasClick(e);
    });
    document.addEventListener('mouseup', () => { isDraggingHue = false; });

    hueCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleHueCanvasTouch(e);
    }, { passive: false });
    hueCanvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        handleHueCanvasTouch(e);
    }, { passive: false });
}

function initColorPickerCanvas(): void {
    drawHueBar();
    drawMainCanvas();
    updateColorDisplay();
}

function drawHueBar(): void {
    const canvas = $('hue-picker-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    for (let i = 0; i <= 360; i += 30) {
        gradient.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update hue cursor position
    const cursor = $('hue-picker-cursor');
    if (cursor) {
        cursor.style.left = `${(currentHue / 360) * canvas.width}px`;
    }
}

function drawMainCanvas(): void {
    const canvas = $('color-picker-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // Draw saturation/lightness gradient
    const baseColor = `hsl(${currentHue}, 100%, 50%)`;

    // White to color horizontal gradient
    const gradientH = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradientH.addColorStop(0, '#ffffff');
    gradientH.addColorStop(1, baseColor);
    ctx.fillStyle = gradientH;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Transparent to black vertical gradient
    const gradientV = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradientV.addColorStop(0, 'rgba(0,0,0,0)');
    gradientV.addColorStop(1, '#000000');
    ctx.fillStyle = gradientV;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update cursor position
    const cursor = $('color-picker-cursor');
    if (cursor) {
        const x = (currentSaturation / 100) * canvas.width;
        const y = (1 - currentLightness / 100) * canvas.height;
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
    }
}

function handleMainCanvasClick(e: MouseEvent): void {
    const canvas = $('color-picker-canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    currentSaturation = Math.max(0, Math.min(100, (x / canvas.width) * 100));
    currentLightness = Math.max(0, Math.min(100, (1 - y / canvas.height) * 100));

    drawMainCanvas();
    updateColorDisplay();
}

function handleMainCanvasTouch(e: TouchEvent): void {
    const canvas = $('color-picker-canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    currentSaturation = Math.max(0, Math.min(100, (x / canvas.width) * 100));
    currentLightness = Math.max(0, Math.min(100, (1 - y / canvas.height) * 100));

    drawMainCanvas();
    updateColorDisplay();
}

function handleHueCanvasClick(e: MouseEvent): void {
    const canvas = $('hue-picker-canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    currentHue = Math.max(0, Math.min(360, (x / canvas.width) * 360));

    drawHueBar();
    drawMainCanvas();
    updateColorDisplay();
}

function handleHueCanvasTouch(e: TouchEvent): void {
    const canvas = $('hue-picker-canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;

    currentHue = Math.max(0, Math.min(360, (x / canvas.width) * 360));

    drawHueBar();
    drawMainCanvas();
    updateColorDisplay();
}

function updateColorDisplay(): void {
    const color = hslToHex(currentHue, currentSaturation, currentLightness);
    selectedCustomColor = color;

    const resultDiv = $('color-picker-result');
    if (resultDiv) resultDiv.style.background = color;

    const hexInput = $('color-hex-input') as HTMLInputElement;
    if (hexInput) hexInput.value = color;

    const rgb = hexToRgb(color);
    if (rgb) {
        ($('color-r-input') as HTMLInputElement).value = rgb.r.toString();
        ($('color-g-input') as HTMLInputElement).value = rgb.g.toString();
        ($('color-b-input') as HTMLInputElement).value = rgb.b.toString();
    }
}

function updateColorFromHex(hex: string): void {
    const rgb = hexToRgb(hex);
    if (rgb) {
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        currentHue = hsl.h;
        currentSaturation = hsl.s;
        currentLightness = hsl.l;
        drawHueBar();
        drawMainCanvas();
        updateColorDisplay();
    }
}

function updateColorFromRGB(): void {
    const r = parseInt(($('color-r-input') as HTMLInputElement).value) || 0;
    const g = parseInt(($('color-g-input') as HTMLInputElement).value) || 0;
    const b = parseInt(($('color-b-input') as HTMLInputElement).value) || 0;

    const hsl = rgbToHsl(r, g, b);
    currentHue = hsl.h;
    currentSaturation = hsl.s;
    currentLightness = hsl.l;
    drawHueBar();
    drawMainCanvas();

    selectedCustomColor = rgbToHex(r, g, b);
    const resultDiv = $('color-picker-result');
    if (resultDiv) resultDiv.style.background = selectedCustomColor;
    ($('color-hex-input') as HTMLInputElement).value = selectedCustomColor;
}

function applyCustomColor(): void {
    if (selectedCustomColor) {
        // Deselect preset colors
        document.querySelectorAll('.color-option').forEach(btn => btn.classList.remove('selected'));

        // Show custom color preview
        const preview = $('custom-color-preview');
        const swatch = $('color-preview-swatch');
        const hexText = $('color-preview-hex');

        if (preview && swatch && hexText) {
            preview.style.display = 'flex';
            swatch.style.background = selectedCustomColor;
            hexText.textContent = selectedCustomColor;
        }

        closeModal($('color-picker-modal'));
    }
}

// Color conversion helpers
function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHex(r: number, g: number, b: number): string {
    return `#${[r, g, b].map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
}

// ===== Image Search Functions =====

function openImageSearch(title: string): void {
    $('image-search-title').textContent = title;
    ($('image-search-input') as HTMLInputElement).value = '';
    $('image-search-results').innerHTML = `
        <div class="image-search-placeholder">
            <span class="placeholder-icon">🔍</span>
            <p>Digite um termo ou clique em uma sugestao</p>
        </div>
    `;

    // Hide preview section
    $('image-preview-section').style.display = 'none';
    pendingImageUrl = null;

    // Set active tab
    document.querySelectorAll('.image-tab').forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('data-type') === imageSearchType);
    });

    openModal($('image-search-modal'));
    setTimeout(() => ($('image-search-input') as HTMLInputElement).focus(), 100);
}

async function performImageSearch(): Promise<void> {
    const query = ($('image-search-input') as HTMLInputElement).value.trim();
    if (!query) return;

    const resultsDiv = $('image-search-results');
    const loadingDiv = $('image-search-loading');

    resultsDiv.innerHTML = '';
    loadingDiv.style.display = 'flex';

    try {
        let images: { url: string; preview: string }[] = [];

        if (imageSearchType === 'gif') {
            // Use Tenor API (free, no API key required for limited usage)
            images = await searchTenorGifs(query);
        } else {
            // Use Unsplash for images (free API)
            images = await searchUnsplashImages(query);
        }

        loadingDiv.style.display = 'none';

        if (images.length === 0) {
            resultsDiv.innerHTML = '<div class="image-search-placeholder">Nenhum resultado encontrado</div>';
            return;
        }

        resultsDiv.innerHTML = images.map((img, idx) => `
            <div class="image-result-item" data-url="${img.url}" data-idx="${idx}">
                <img src="${img.preview}" alt="Resultado ${idx + 1}" loading="lazy">
            </div>
        `).join('');

        // Add click listeners
        resultsDiv.querySelectorAll('.image-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const url = (item as HTMLElement).dataset.url!;
                selectSearchImage(url);
            });
        });
    } catch (error) {
        loadingDiv.style.display = 'none';
        resultsDiv.innerHTML = '<div class="image-search-placeholder">Erro ao buscar. Tente novamente.</div>';
        console.error('Image search error:', error);
    }
}

async function searchTenorGifs(query: string): Promise<{ url: string; preview: string }[]> {
    // Tenor API v2 - using anonymous access
    const apiKey = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ'; // Google's public Tenor API key
    const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${apiKey}&limit=18&media_filter=gif,tinygif`;

    const response = await fetch(url);
    const data = await response.json();

    return (data.results || []).map((item: any) => ({
        url: item.media_formats?.gif?.url || item.media_formats?.mediumgif?.url || '',
        preview: item.media_formats?.tinygif?.url || item.media_formats?.nanogif?.url || ''
    })).filter((img: { url: string }) => img.url);
}

async function searchUnsplashImages(query: string): Promise<{ url: string; preview: string }[]> {
    // Using Lorem Picsum as fallback (no API key needed)
    // For production, use Unsplash API with proper key
    const images: { url: string; preview: string }[] = [];

    // Generate pseudo-random images based on query
    const seed = query.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    for (let i = 0; i < 18; i++) {
        const id = (seed + i * 17) % 1000;
        images.push({
            url: `https://picsum.photos/seed/${id}/800/600`,
            preview: `https://picsum.photos/seed/${id}/200/200`
        });
    }

    return images;
}

function selectSearchImage(url: string): void {
    // Show preview section instead of applying directly
    pendingImageUrl = url;
    pendingImageType = imageSearchType;

    const previewSection = $('image-preview-section');
    const previewImg = $('selected-image-preview') as HTMLImageElement;
    const typeBadge = $('preview-type-badge');

    previewImg.src = url;
    typeBadge.textContent = imageSearchType === 'gif' ? 'GIF' : 'Imagem';
    typeBadge.className = `preview-type-badge ${imageSearchType}`;

    previewSection.style.display = 'block';

    // Scroll preview into view
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cancelImageSelection(): void {
    $('image-preview-section').style.display = 'none';
    pendingImageUrl = null;
}

function applySelectedImage(): void {
    if (!pendingImageUrl) return;

    if (imageSearchTarget === 'avatar') {
        const preview = $('avatar-preview') as HTMLImageElement;
        const container = $('avatar-preview-container');
        const placeholder = $('avatar-placeholder');
        const controls = $('avatar-controls');
        const typeBadge = $('avatar-type-badge');

        preview.src = pendingImageUrl;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
        container.classList.add('has-media');
        $('avatar-clear-btn').style.display = 'flex';

        // Show GIF controls if it's a GIF
        if (pendingImageType === 'gif') {
            controls.style.display = 'flex';
            typeBadge.textContent = 'GIF';
            typeBadge.className = 'media-type-badge gif';
        } else {
            controls.style.display = 'none';
            typeBadge.textContent = 'Imagem';
            typeBadge.className = 'media-type-badge image';
        }
        typeBadge.style.display = 'inline';
    } else {
        const preview = $('background-preview') as HTMLImageElement;
        const container = $('background-preview-container');
        const placeholder = $('background-placeholder');
        const controls = $('background-controls');
        const typeBadge = $('background-type-badge');

        preview.src = pendingImageUrl;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
        container.classList.add('has-media');
        $('background-clear-btn').style.display = 'flex';

        // Show GIF controls if it's a GIF
        if (pendingImageType === 'gif') {
            controls.style.display = 'flex';
            typeBadge.textContent = 'GIF';
            typeBadge.className = 'media-type-badge gif';
        } else {
            controls.style.display = 'none';
            typeBadge.textContent = 'Imagem';
            typeBadge.className = 'media-type-badge image';
        }
        typeBadge.style.display = 'inline';
    }

    pendingImageUrl = null;
    closeModal($('image-search-modal'));
}

function toggleMediaPreviewPause(type: 'avatar' | 'background'): void {
    const img = $(type === 'avatar' ? 'avatar-preview' : 'background-preview') as HTMLImageElement;
    const btn = $(type === 'avatar' ? 'avatar-pause-btn' : 'background-pause-btn');

    if (img.classList.contains('paused')) {
        img.classList.remove('paused');
        btn.classList.remove('active');
        btn.textContent = '⏸️';
    } else {
        img.classList.add('paused');
        btn.classList.add('active');
        btn.textContent = '▶️';
    }
}

// ===== Revive Player Functions =====

function renderReviveButton(player: Player): string {
    if (!player.isEliminated) return '';

    return `
        <div class="revive-overlay">
            <button class="revive-btn" data-player-id="${player.id}">
                Reviver Jogador
            </button>
        </div>
    `;
}

function handleRevivePlayer(playerId: string): void {
    const state = gameState.getState();

    if (state.settings.confirmCriticalActions) {
        if (!confirm('Reviver este jogador?')) return;
    }

    gameState.revivePlayer(playerId, true);
    audioManager.play('heal', playerId);
}

// ===== Collapsible Counters =====

function toggleCountersCollapse(playerId: string): void {
    if (collapsedCounters.has(playerId)) {
        collapsedCounters.delete(playerId);
    } else {
        collapsedCounters.add(playerId);
    }
    render(gameState.getState());
}

// ===== Commander Deaths Functions =====

function handleCommanderDeathChange(playerId: string, amount: number): void {
    gameState.changeCommanderDeaths(playerId, amount);

    // Animation feedback
    if (amount > 0) {
        const badge = document.querySelector(`[data-action="commander-deaths"][data-player-id="${playerId}"]`);
        if (badge) {
            badge.classList.remove('pulse');
            void (badge as HTMLElement).offsetWidth; // Trigger reflow
            badge.classList.add('pulse');
            audioManager.play('click');
        }
    }
}
