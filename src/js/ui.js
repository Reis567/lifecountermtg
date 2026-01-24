// ===== UI Management =====
import { gameState } from './state.js';
import { audioManager, ambientMusic, narrator } from './audio.js';
import { DEFAULT_PLAYER_COLORS, PRESET_COUNTERS, COMMANDER_DAMAGE_LETHAL, LAYOUT_PRESETS, EASTER_EGG_MESSAGES, SPECIAL_MOMENTS, TAUNT_PHRASES, MTG_KEYWORDS, } from './types.js';
class AnimatedBackground {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.animationId = null;
        this.style = 'none';
        this.enabled = false;
        this.animate = () => {
            if (!this.enabled || this.style === 'none')
                return;
            this.update();
            this.draw();
            this.animationId = requestAnimationFrame(this.animate);
        };
    }
    init() {
        this.canvas = document.getElementById('animated-bg-canvas');
        if (!this.canvas)
            return;
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    resize() {
        if (!this.canvas)
            return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    setStyle(style) {
        this.style = style;
        this.particles = [];
        if (style !== 'none' && this.enabled) {
            this.createParticles();
        }
    }
    setEnabled(enabled) {
        this.enabled = enabled;
        if (this.canvas) {
            this.canvas.classList.toggle('hidden', !enabled || this.style === 'none');
        }
        if (enabled && this.style !== 'none') {
            this.createParticles();
            this.start();
        }
        else {
            this.stop();
        }
    }
    createParticles() {
        if (!this.canvas)
            return;
        this.particles = [];
        const count = this.getParticleCount();
        for (let i = 0; i < count; i++) {
            this.particles.push(this.createParticle());
        }
    }
    getParticleCount() {
        const baseCount = Math.floor((window.innerWidth * window.innerHeight) / 15000);
        switch (this.style) {
            case 'stars': return Math.min(baseCount * 2, 200);
            case 'mana': return Math.min(baseCount, 60);
            case 'sparks': return Math.min(baseCount * 1.5, 100);
            case 'bubbles': return Math.min(baseCount, 50);
            case 'matrix': return Math.min(baseCount * 3, 300);
            default: return 0;
        }
    }
    createParticle() {
        const w = this.canvas?.width || window.innerWidth;
        const h = this.canvas?.height || window.innerHeight;
        switch (this.style) {
            case 'stars':
                return {
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: (Math.random() - 0.5) * 0.3,
                    size: Math.random() * 2 + 1,
                    color: `hsl(${Math.random() * 60 + 200}, 80%, 70%)`,
                    alpha: Math.random() * 0.5 + 0.5,
                };
            case 'mana':
                const manaColors = ['#f9e076', '#0ea5e9', '#a855f7', '#ef4444', '#22c55e'];
                return {
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 0.8,
                    vy: -Math.random() * 0.5 - 0.2,
                    size: Math.random() * 6 + 3,
                    color: manaColors[Math.floor(Math.random() * manaColors.length)],
                    alpha: Math.random() * 0.6 + 0.3,
                };
            case 'sparks':
                return {
                    x: Math.random() * w,
                    y: h + 10,
                    vx: (Math.random() - 0.5) * 2,
                    vy: -Math.random() * 3 - 1,
                    size: Math.random() * 3 + 1,
                    color: `hsl(${Math.random() * 60 + 15}, 100%, 60%)`,
                    alpha: 1,
                };
            case 'bubbles':
                return {
                    x: Math.random() * w,
                    y: h + Math.random() * 50,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: -Math.random() * 1 - 0.5,
                    size: Math.random() * 20 + 10,
                    color: `hsl(${Math.random() * 60 + 180}, 70%, 70%)`,
                    alpha: Math.random() * 0.3 + 0.1,
                };
            case 'matrix':
                return {
                    x: Math.random() * w,
                    y: Math.random() * -h,
                    vx: 0,
                    vy: Math.random() * 3 + 1,
                    size: Math.random() * 8 + 10,
                    color: '#22c55e',
                    alpha: Math.random() * 0.7 + 0.3,
                    char: String.fromCharCode(0x30A0 + Math.random() * 96),
                };
            default:
                return { x: 0, y: 0, vx: 0, vy: 0, size: 0, color: '#fff', alpha: 0 };
        }
    }
    update() {
        if (!this.canvas)
            return;
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.particles.forEach((p, i) => {
            p.x += p.vx;
            p.y += p.vy;
            // Style-specific updates
            switch (this.style) {
                case 'stars':
                    p.alpha = 0.3 + Math.sin(Date.now() / 1000 + i) * 0.3;
                    if (p.x < 0)
                        p.x = w;
                    if (p.x > w)
                        p.x = 0;
                    if (p.y < 0)
                        p.y = h;
                    if (p.y > h)
                        p.y = 0;
                    break;
                case 'mana':
                    p.alpha -= 0.003;
                    if (p.y < 0 || p.alpha <= 0) {
                        Object.assign(p, this.createParticle());
                        p.y = h + 10;
                    }
                    break;
                case 'sparks':
                    p.vy += 0.02; // gravity
                    p.alpha -= 0.01;
                    if (p.alpha <= 0 || p.y > h) {
                        Object.assign(p, this.createParticle());
                    }
                    break;
                case 'bubbles':
                    p.vx = Math.sin(Date.now() / 2000 + i) * 0.3;
                    if (p.y < -p.size) {
                        Object.assign(p, this.createParticle());
                    }
                    break;
                case 'matrix':
                    if (p.y > h) {
                        p.y = -20;
                        p.x = Math.random() * w;
                        p.char = String.fromCharCode(0x30A0 + Math.random() * 96);
                    }
                    if (Math.random() < 0.05) {
                        p.char = String.fromCharCode(0x30A0 + Math.random() * 96);
                    }
                    break;
            }
        });
    }
    draw() {
        if (!this.ctx || !this.canvas)
            return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.alpha;
            if (this.style === 'matrix') {
                this.ctx.fillStyle = p.color;
                this.ctx.font = `${p.size}px monospace`;
                this.ctx.fillText(p.char || '0', p.x, p.y);
            }
            else if (this.style === 'bubbles') {
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.strokeStyle = p.color;
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
            else {
                this.ctx.fillStyle = p.color;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });
        this.ctx.globalAlpha = 1;
    }
    start() {
        if (this.animationId)
            return;
        this.animate();
    }
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
}
const animatedBg = new AnimatedBackground();
// Current editing context
let currentEditingPlayerId = null;
let currentCountersPlayerId = null;
let currentCommanderDamagePlayerId = null;
// Hold timers for +/- buttons
let holdInterval = null;
let holdTimeout = null;
let activeLifeShortcutsPlayerId = null;
// Turn timer
let turnTimerInterval = null;
// Undo check interval
let undoCheckInterval = null;
// Random starter animation state
let randomStarterAnimationInterval = null;
// Winner animation state - track to avoid re-showing animation
let lastShownWinnerId = null;
// Color picker state
let currentHue = 0;
let currentSaturation = 100;
let currentLightness = 50;
let selectedCustomColor = null;
// Image search state
let imageSearchTarget = 'avatar';
let imageSearchType = 'gif';
let pendingImageUrl = null;
let pendingImageType = 'image';
// Media pause state per player
const playerMediaPaused = new Map();
// Collapsed counters state
const collapsedCounters = new Set();
// Dice roller history
const diceHistory = [];
// Debounce for life changes (mobile touch sensitivity fix)
let lastLifeChangeTime = 0;
const LIFE_CHANGE_DEBOUNCE_MS = 150;
// Generic button debounce to prevent double-clicks
const buttonDebounceMap = new Map();
const BUTTON_DEBOUNCE_MS = 300;
function isButtonDebounced(buttonId) {
    const now = Date.now();
    const lastClick = buttonDebounceMap.get(buttonId) || 0;
    if (now - lastClick < BUTTON_DEBOUNCE_MS) {
        return true;
    }
    buttonDebounceMap.set(buttonId, now);
    return false;
}
// Shake detection for "Shake to Roll"
let lastShakeTime = 0;
const SHAKE_THRESHOLD = 15;
const SHAKE_TIMEOUT = 1000;
let shakeCount = 0;
let lastAcceleration = { x: 0, y: 0, z: 0 };
function setupShakeDetection() {
    if (!('DeviceMotionEvent' in window))
        return;
    // Request permission for iOS 13+
    const requestPermission = DeviceMotionEvent.requestPermission;
    if (typeof requestPermission === 'function') {
        // Will be triggered by user gesture
        document.body.addEventListener('click', async () => {
            try {
                const permission = await requestPermission();
                if (permission === 'granted') {
                    window.addEventListener('devicemotion', handleDeviceMotion);
                }
            }
            catch (e) {
                console.warn('DeviceMotion permission denied');
            }
        }, { once: true });
    }
    else {
        window.addEventListener('devicemotion', handleDeviceMotion);
    }
}
function handleDeviceMotion(event) {
    const state = gameState.getState();
    if (!state.gameStarted)
        return; // Only work during game
    const acceleration = event.accelerationIncludingGravity;
    if (!acceleration || acceleration.x === null || acceleration.y === null || acceleration.z === null)
        return;
    const deltaX = Math.abs(acceleration.x - lastAcceleration.x);
    const deltaY = Math.abs(acceleration.y - lastAcceleration.y);
    const deltaZ = Math.abs(acceleration.z - lastAcceleration.z);
    lastAcceleration = {
        x: acceleration.x || 0,
        y: acceleration.y || 0,
        z: acceleration.z || 0
    };
    const totalDelta = deltaX + deltaY + deltaZ;
    if (totalDelta > SHAKE_THRESHOLD) {
        const now = Date.now();
        if (now - lastShakeTime > 100) {
            shakeCount++;
            lastShakeTime = now;
            // Trigger after 3 shakes within timeout
            if (shakeCount >= 3) {
                shakeCount = 0;
                triggerShakeRoll();
            }
            // Reset count after timeout
            setTimeout(() => {
                shakeCount = 0;
            }, SHAKE_TIMEOUT);
        }
    }
}
function triggerShakeRoll() {
    if (isRandomStarterRunning)
        return;
    // Vibrate if available
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
    }
    audioManager.play('click');
    startRandomStarterAnimation();
}
// Initialize UI
export function initUI() {
    setupEventListeners();
    gameState.subscribe(render);
    render(gameState.getState());
    // Start undo check interval
    undoCheckInterval = window.setInterval(updateUndoButton, 1000);
    // Setup shake detection for "Shake to Roll"
    setupShakeDetection();
    // Apply initial theme
    applyTheme(gameState.getState().settings.theme);
    applyAnimationIntensity(gameState.getState().settings.animationIntensity);
    applyFontStyle(gameState.getState().settings.fontStyle);
    // Initialize animated background
    animatedBg.init();
    const state = gameState.getState();
    animatedBg.setStyle(state.settings.animatedBgStyle);
    animatedBg.setEnabled(state.settings.animatedBgEnabled);
    // Initialize ambient music
    ambientMusic.setVolume(state.settings.ambientMusicVolume);
    ambientMusic.setTrack(state.settings.ambientMusicTrack);
    if (state.settings.ambientMusicEnabled) {
        ambientMusic.toggle(true);
    }
    // Initialize narrator
    narrator.setEnabled(state.settings.narratorEnabled);
    narrator.setSpeed(state.settings.narratorSpeed);
    // Initialize sound pack
    audioManager.setSoundPack(state.settings.soundPack);
}
// Get element safely
function $(id) {
    return document.getElementById(id);
}
// Setup all event listeners
function setupEventListeners() {
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
function setupSetupScreenListeners() {
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
            document.querySelector('.custom-life-input').value = '';
            gameState.setStartingLife(life);
        });
    });
    // Custom life input
    document.querySelector('.custom-life-input')?.addEventListener('change', (e) => {
        const life = parseInt(e.target.value);
        if (life > 0) {
            document.querySelectorAll('.life-btn').forEach(b => b.classList.remove('active'));
            gameState.setStartingLife(life);
        }
    });
    // Theme buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.getAttribute('data-theme');
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gameState.setTheme(theme);
            applyTheme(theme);
        });
    });
    // Table mode checkbox
    $('table-mode-checkbox')?.addEventListener('change', (e) => {
        gameState.toggleTableMode(e.target.checked);
    });
    // Toggle player setup section (for mobile)
    $('toggle-player-setup')?.addEventListener('click', () => {
        const section = document.querySelector('.setup-section-players');
        if (section) {
            section.classList.toggle('collapsed');
            // Mark as user-expanded to prevent auto-collapse
            if (!section.classList.contains('collapsed')) {
                section.classList.add('user-expanded');
            }
            else {
                section.classList.remove('user-expanded');
            }
        }
    });
    // Auto-collapse player setup on mobile landscape
    const checkMobileLandscape = () => {
        const isLandscape = window.matchMedia('(orientation: landscape) and (max-height: 500px)').matches;
        const section = document.querySelector('.setup-section-players');
        if (isLandscape && section && !section.classList.contains('user-expanded')) {
            section.classList.add('collapsed');
        }
    };
    checkMobileLandscape();
    window.addEventListener('resize', checkMobileLandscape);
    window.addEventListener('orientationchange', checkMobileLandscape);
    // Start game button
    $('start-game-btn')?.addEventListener('click', () => {
        if (isButtonDebounced('start-game-btn'))
            return;
        gameState.startGame();
    });
}
function setupGameScreenListeners() {
    // Menu button
    $('menu-btn')?.addEventListener('click', () => {
        openModal($('settings-modal'));
    });
    // Random starter button
    $('random-starter-btn')?.addEventListener('click', () => {
        if (isButtonDebounced('random-starter-btn'))
            return;
        startRandomStarterAnimation();
    });
    // Next turn button
    $('next-turn-btn')?.addEventListener('click', () => {
        if (isButtonDebounced('next-turn-btn'))
            return;
        audioManager.play('turn');
        gameState.nextTurn();
    });
    // Undo buttons
    $('undo-btn')?.addEventListener('click', performUndo);
    $('floating-undo-btn')?.addEventListener('click', performUndo);
    // Fullscreen button
    $('fullscreen-btn')?.addEventListener('click', toggleFullscreen);
    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', updateFullscreenIcon);
    document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);
    // Random starter overlay buttons
    $('random-starter-again-btn')?.addEventListener('click', () => {
        if (isButtonDebounced('random-starter-again-btn'))
            return;
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
    $('history-btn')?.addEventListener('click', () => {
        renderHistory();
        $('history-panel').classList.add('active');
    });
    $('close-history-btn')?.addEventListener('click', () => {
        $('history-panel').classList.remove('active');
    });
    // Dice roller button
    $('dice-roller-btn')?.addEventListener('click', () => {
        openModal($('dice-roller-modal'));
    });
    // Share result button
    $('share-result-btn')?.addEventListener('click', openShareModal);
    // Share modal buttons
    $('share-download-btn')?.addEventListener('click', downloadImage);
    $('share-native-btn')?.addEventListener('click', shareImage);
    $('share-copy-btn')?.addEventListener('click', copyImageToClipboard);
    // Dice options
    document.querySelectorAll('.dice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const dice = btn.dataset.dice;
            if (dice) {
                rollDice(dice);
            }
        });
    });
    // Global click handler to close life shortcuts popup
    document.addEventListener('click', (e) => {
        const target = e.target;
        // Don't close if clicking on the popup itself or life controls
        if (!target.closest('.life-shortcuts-popup') && !target.closest('.life-control')) {
            hideLifeShortcutsPopup();
        }
    });
    // === Left Sidebar Buttons (landscape mode) ===
    $('menu-btn-left')?.addEventListener('click', () => {
        openModal($('settings-modal'));
    });
    $('undo-btn-left')?.addEventListener('click', performUndo);
    $('history-btn-left')?.addEventListener('click', () => {
        renderHistory();
        $('history-panel').classList.add('active');
    });
    $('dice-roller-btn-left')?.addEventListener('click', () => {
        openModal($('dice-roller-modal'));
    });
    $('random-starter-btn-left')?.addEventListener('click', () => {
        if (isButtonDebounced('random-starter-btn-left'))
            return;
        startRandomStarterAnimation();
    });
    // === Right Sidebar Buttons (landscape mode) ===
    $('fullscreen-btn-right')?.addEventListener('click', toggleFullscreen);
    $('next-turn-btn-right')?.addEventListener('click', () => {
        if (isButtonDebounced('next-turn-btn-right'))
            return;
        audioManager.play('turn');
        gameState.nextTurn();
    });
    $('share-result-btn-right')?.addEventListener('click', openShareModal);
}
function setupModalListeners() {
    // Close modals on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });
    // Close modal buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            closeModal(modal);
        });
    });
    // Custom counter
    $('add-custom-counter-btn')?.addEventListener('click', () => {
        const input = $('custom-counter-name');
        const name = input.value.trim();
        if (name && currentCountersPlayerId) {
            gameState.addCustomCounter(currentCountersPlayerId, name);
            input.value = '';
        }
    });
}
function setupSettingsListeners() {
    // Sound settings
    $('sound-enabled')?.addEventListener('change', (e) => {
        gameState.updateSettings({ soundEnabled: e.target.checked });
    });
    $('volume-slider')?.addEventListener('input', (e) => {
        gameState.updateSettings({ volume: parseInt(e.target.value) });
    });
    $('sound-pack')?.addEventListener('change', (e) => {
        const pack = e.target.value;
        gameState.updateSettings({ soundPack: pack });
        audioManager.setSoundPack(pack);
    });
    $('mute-all-btn')?.addEventListener('click', () => {
        gameState.updateSettings({ soundEnabled: false });
        $('sound-enabled').checked = false;
    });
    // Animation settings
    $('animations-enabled')?.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        gameState.updateSettings({ animationsEnabled: enabled });
        document.body.classList.toggle('no-animations', !enabled);
    });
    $('animation-intensity')?.addEventListener('change', (e) => {
        const intensity = e.target.value;
        gameState.updateSettings({ animationIntensity: intensity });
        applyAnimationIntensity(intensity);
    });
    $('show-special-moments')?.addEventListener('change', (e) => {
        gameState.updateSettings({ showSpecialMoments: e.target.checked });
    });
    $('show-commander-deaths')?.addEventListener('change', (e) => {
        gameState.updateSettings({ showCommanderDeaths: e.target.checked });
    });
    $('easter-eggs-enabled')?.addEventListener('change', (e) => {
        gameState.updateSettings({ easterEggsEnabled: e.target.checked });
    });
    // Animated background settings
    $('animated-bg-enabled')?.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        gameState.updateSettings({ animatedBgEnabled: enabled });
        animatedBg.setEnabled(enabled);
    });
    $('animated-bg-style')?.addEventListener('change', (e) => {
        const style = e.target.value;
        gameState.updateSettings({ animatedBgStyle: style });
        animatedBg.setStyle(style);
        if (style !== 'none' && gameState.getState().settings.animatedBgEnabled) {
            animatedBg.setEnabled(true);
        }
    });
    // Font style
    $('font-style')?.addEventListener('change', (e) => {
        const fontStyle = e.target.value;
        gameState.updateSettings({ fontStyle });
        applyFontStyle(fontStyle);
    });
    // Ambient music settings
    $('ambient-music-enabled')?.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        gameState.updateSettings({ ambientMusicEnabled: enabled });
        ambientMusic.toggle(enabled);
    });
    $('ambient-music-track')?.addEventListener('change', (e) => {
        const track = e.target.value;
        gameState.updateSettings({ ambientMusicTrack: track });
        ambientMusic.setTrack(track);
        if (track !== 'none' && gameState.getState().settings.ambientMusicEnabled) {
            ambientMusic.toggle(true);
        }
    });
    $('music-volume-slider')?.addEventListener('input', (e) => {
        const volume = parseInt(e.target.value);
        gameState.updateSettings({ ambientMusicVolume: volume });
        ambientMusic.setVolume(volume);
    });
    // Narrator settings
    $('narrator-enabled')?.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        gameState.updateSettings({ narratorEnabled: enabled });
        narrator.setEnabled(enabled);
    });
    $('narrator-speed')?.addEventListener('change', (e) => {
        const speed = parseFloat(e.target.value);
        gameState.updateSettings({ narratorSpeed: speed });
        narrator.setSpeed(speed);
    });
    // GIF settings
    $('gif-paused')?.addEventListener('change', (e) => {
        gameState.toggleGifPause(e.target.checked);
    });
    $('gif-fps-reduced')?.addEventListener('change', (e) => {
        gameState.toggleGifFpsReduction(e.target.checked);
    });
    // Theme buttons in settings
    document.querySelectorAll('.theme-btn-sm').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.getAttribute('data-theme');
            document.querySelectorAll('.theme-btn-sm').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gameState.setTheme(theme);
            applyTheme(theme);
        });
    });
    // Table mode in settings
    $('table-mode-settings')?.addEventListener('change', (e) => {
        gameState.toggleTableMode(e.target.checked);
    });
    // Timer settings
    $('turn-timer-enabled')?.addEventListener('change', (e) => {
        gameState.updateSettings({ turnTimerEnabled: e.target.checked });
    });
    $('timer-duration')?.addEventListener('change', (e) => {
        gameState.updateSettings({ turnTimerDuration: parseInt(e.target.value) });
    });
    // Random starter animation
    $('random-starter-animation')?.addEventListener('change', (e) => {
        gameState.setRandomStarterAnimation(e.target.value);
    });
    // Game mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gameState.setGameMode(mode);
        });
    });
    // Rules & Keywords button
    $('rules-keywords-btn')?.addEventListener('click', () => {
        closeModal($('settings-modal'));
        openRulesModal();
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
            hideShareButtons();
            closeAllModals();
        }
    });
    $('new-game-btn')?.addEventListener('click', () => {
        if (confirm('Tem certeza que deseja iniciar uma nova partida?')) {
            gameState.newGame();
            hideShareButtons();
            closeAllModals();
        }
    });
}
// Hide share buttons (shown only when there's a winner)
function hideShareButtons() {
    const shareBtn = $('share-result-btn');
    const shareBtnRight = $('share-result-btn-right');
    if (shareBtn)
        shareBtn.style.display = 'none';
    if (shareBtnRight)
        shareBtnRight.style.display = 'none';
    lastShownWinnerId = null;
}
function setupPlayerSettingsListeners() {
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
            $('custom-tag-input').value = '';
        });
    });
    // Avatar upload
    $('avatar-upload-btn')?.addEventListener('click', () => {
        $('avatar-input').click();
    });
    $('avatar-input')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const preview = $('avatar-preview');
                const container = $('avatar-preview-container');
                const placeholder = $('avatar-placeholder');
                const controls = $('avatar-controls');
                const typeBadge = $('avatar-type-badge');
                preview.src = reader.result;
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
                }
                else {
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
        $('avatar-input').value = '';
        const preview = $('avatar-preview');
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
        $('background-input').click();
    });
    $('background-input')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const preview = $('background-preview');
                const container = $('background-preview-container');
                const placeholder = $('background-placeholder');
                const controls = $('background-controls');
                const typeBadge = $('background-type-badge');
                preview.src = reader.result;
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
                }
                else {
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
        $('background-input').value = '';
        const preview = $('background-preview');
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
            const input = $(`${soundType}-sound-input`);
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
        const hex = e.target.value;
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
        if (e.key === 'Enter')
            performImageSearch();
    });
    // Image search tabs
    document.querySelectorAll('.image-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.image-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            imageSearchType = tab.getAttribute('data-type');
            // Re-search if there's a query
            const query = $('image-search-input').value.trim();
            if (query)
                performImageSearch();
        });
    });
    // Suggestion chips
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const query = chip.getAttribute('data-query') || '';
            $('image-search-input').value = query;
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
function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
}
// Apply animation intensity
function applyAnimationIntensity(intensity) {
    document.body.setAttribute('data-anim-intensity', intensity);
}
// Apply font style
function applyFontStyle(fontStyle) {
    document.body.setAttribute('data-font', fontStyle);
}
// Render history panel
function renderHistory() {
    const state = gameState.getState();
    const historyList = $('history-list');
    if (state.history.length === 0) {
        historyList.innerHTML = '<div class="history-empty">Nenhum evento ainda</div>';
        return;
    }
    const getPlayerName = (playerId) => {
        const player = state.players.find(p => p.id === playerId);
        return player?.name || 'Jogador';
    };
    const getPlayerColor = (playerId) => {
        const player = state.players.find(p => p.id === playerId);
        return player?.color || '#6366f1';
    };
    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };
    const getEventIcon = (type) => {
        switch (type) {
            case 'life_change': return '❤️';
            case 'commander_damage': return '⚔️';
            case 'counter_change': return '📊';
            case 'player_eliminated': return '💀';
            case 'player_win': return '🏆';
            case 'turn_change': return '▶️';
            case 'monarch_change': return '👑';
            case 'undo': return '↩️';
            case 'random_starter': return '🎲';
            default: return '📝';
        }
    };
    const getEventDescription = (event) => {
        const playerName = getPlayerName(event.playerId);
        const details = event.details;
        switch (event.type) {
            case 'life_change':
                const amount = details.amount;
                return `${playerName}: ${amount > 0 ? '+' : ''}${amount} vida (${details.previousValue} → ${details.newValue})`;
            case 'commander_damage':
                const dmgAmount = details.amount;
                const sourceName = getPlayerName(details.fromPlayerId);
                return `${playerName} recebeu ${dmgAmount > 0 ? '+' : ''}${dmgAmount} dano de comandante de ${sourceName}`;
            case 'counter_change':
                const counterType = details.counterType;
                const counterAmount = details.amount;
                const counterNames = {
                    poison: 'Veneno',
                    experience: 'Experiencia',
                    energy: 'Energia',
                    storm: 'Storm',
                    commanderDeaths: 'Mortes do Comandante'
                };
                return `${playerName}: ${counterAmount > 0 ? '+' : ''}${counterAmount} ${counterNames[counterType] || counterType}`;
            case 'player_eliminated':
                return `${playerName} foi eliminado (${details.message})`;
            case 'player_win':
                return `${playerName} venceu a partida!`;
            case 'turn_change':
                return `Turno ${details.newValue} - vez de ${playerName}`;
            case 'monarch_change':
                return `${playerName} se tornou o Monarca`;
            case 'undo':
                return `Acao desfeita: ${details.message}`;
            case 'random_starter':
                return `${playerName} foi sorteado para comecar`;
            default:
                return `${playerName}: ${event.type}`;
        }
    };
    historyList.innerHTML = state.history.map(event => `
        <div class="history-item" style="--player-color: ${getPlayerColor(event.playerId)}">
            <span class="history-icon">${getEventIcon(event.type)}</span>
            <span class="history-text">${getEventDescription(event)}</span>
            <span class="history-time">${formatTime(event.timestamp)}</span>
        </div>
    `).join('');
}
// Render the entire UI based on state
function render(state) {
    if (state.gameStarted) {
        renderGame(state);
    }
    else {
        renderSetup(state);
    }
}
// Render setup screen
function renderSetup(state) {
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
            const target = e.target;
            const item = target.closest('.player-setup-item');
            const playerId = item.dataset.playerId;
            gameState.updatePlayerSetup(playerId, { name: target.value || `Jogador` });
        });
    });
    playerList.querySelectorAll('.player-color-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
            const item = e.target.closest('.player-setup-item');
            const playerId = item.dataset.playerId;
            openPlayerSettings(playerId);
        });
    });
}
// Render layout presets
function renderLayoutPresets() {
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
                const presetName = btn.getAttribute('data-preset');
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
                const presetName = btn.getAttribute('data-preset');
                gameState.setLayoutPreset(presetName);
            });
        });
    }
}
// Render game screen
function renderGame(state) {
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
    // Check for winner - show share buttons and winner animation
    if (state.winner) {
        // Show share buttons when there's a winner
        const shareBtn = $('share-result-btn');
        const shareBtnRight = $('share-result-btn-right');
        if (shareBtn)
            shareBtn.style.display = 'flex';
        if (shareBtnRight)
            shareBtnRight.style.display = 'flex';
        // Show winner animation only once per winner
        if (state.winner !== lastShownWinnerId) {
            const winner = state.players.find(p => p.id === state.winner);
            if (winner) {
                showWinner(winner);
                lastShownWinnerId = state.winner;
            }
        }
    }
    else {
        // Hide share buttons when there's no winner
        hideShareButtons();
        lastShownWinnerId = null;
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
function updateGridLayout(grid, state) {
    const { layout, playerCount } = state.settings;
    const rows = layout.rows;
    // Set grid template rows and player count
    grid.className = `players-grid layout-rows-${rows.length}`;
    grid.setAttribute('data-players', playerCount.toString());
    // Calculate grid template columns for each row
    let gridTemplateAreas = '';
    let playerIndex = 0;
    const areas = [];
    for (let r = 0; r < rows.length; r++) {
        const playersInRow = rows[r];
        const maxInRow = Math.max(...rows);
        const rowAreas = [];
        for (let c = 0; c < maxInRow; c++) {
            if (c < playersInRow) {
                rowAreas.push(`p${playerIndex}`);
                playerIndex++;
            }
            else {
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
function renderPlayers(state) {
    const grid = $('players-grid');
    const { layout } = state.settings;
    grid.innerHTML = state.players.map((player, index) => {
        const isActive = index === state.activePlayerIndex;
        const isLowLife = player.life <= SPECIAL_MOMENTS.DANGER_ZONE && player.life > SPECIAL_MOMENTS.LOW_LIFE;
        const isCriticalLife = player.life <= SPECIAL_MOMENTS.LOW_LIFE && player.life > 0;
        const hasLethalCommanderDamage = Object.values(player.commanderDamage).some(d => d >= COMMANDER_DAMAGE_LETHAL);
        // Team info for Two-Headed Giant
        const team = state.gameMode === 'two-headed' ? state.teams.find(t => t.playerIds.includes(player.id)) : null;
        const teamIndex = team ? state.teams.indexOf(team) + 1 : 0;
        const classes = [
            'player-card',
            isActive ? 'active-turn' : '',
            isLowLife && !player.isEliminated ? 'low-life' : '',
            isCriticalLife && !player.isEliminated ? 'critical-life' : '',
            player.isEliminated ? 'eliminated' : '',
            player.id === state.winner ? 'winner' : '',
            player.isMonarch ? 'is-monarch' : '',
            state.settings.gifPaused ? 'gif-paused' : '',
            team ? `team-${teamIndex}` : '',
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
        const monarchCrown = player.isMonarch ? '<div class="monarch-crown">👑</div>' : '';
        return `
            <div class="player-card ${classes}"
                 data-player-id="${player.id}"
                 data-rotation="${rotation}"
                 style="--player-color: ${player.color}; grid-area: p${index};">
                ${monarchCrown}
                ${player.background ? `<div class="player-card-background has-background" style="${backgroundStyle}"></div>` : ''}
                <div class="player-header">
                    <div class="player-info">
                        ${player.emoji ? `<span class="player-emoji">${player.emoji}</span>` :
            player.avatar ? `<img src="${player.avatar}" class="player-avatar" alt="${player.name}">` :
                `<div class="player-avatar" style="background: ${player.color}"></div>`}
                        <span class="player-name">${player.name}</span>
                        ${player.tag ? `<span class="player-tag">${player.tag}</span>` : ''}
                        ${team ? `<span class="team-badge team-${teamIndex}">🤝 ${team.name}</span>` : ''}
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
                    <div class="life-shortcuts-popup" data-player-id="${player.id}">
                        <button class="life-shortcut-btn" data-amount="-10">-10</button>
                        <button class="life-shortcut-btn" data-amount="-5">-5</button>
                        <button class="life-shortcut-btn" data-amount="+5">+5</button>
                        <button class="life-shortcut-btn" data-amount="+10">+10</button>
                    </div>
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
        const playerId = card.dataset.playerId;
        // Life controls with hold support
        card.querySelectorAll('.life-control').forEach(btn => {
            const amount = parseInt(btn.dataset.amount || '0');
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
            let longPressTimer = null;
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
        // Counter badges click (increment) - poison, experience, energy, storm
        card.querySelectorAll('[data-action="counter"]').forEach(badge => {
            const counterType = badge.dataset.counterType;
            const badgePlayerId = badge.dataset.playerId;
            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                gameState.changeCounter(badgePlayerId, counterType, 1);
                // Play type-specific sound
                const soundName = counterType === 'poison' ? 'poison' :
                    counterType === 'energy' ? 'energy' :
                        counterType === 'experience' ? 'experience' : 'click';
                audioManager.play(soundName, badgePlayerId);
                // Create particles based on counter type
                const particleType = counterType === 'poison' ? 'poison' :
                    counterType === 'energy' ? 'energy' :
                        counterType === 'experience' ? 'experience' : 'fire';
                createParticles(badgePlayerId, particleType, 5);
            });
            // Right click or long press to decrement
            badge.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                gameState.changeCounter(badgePlayerId, counterType, -1);
                audioManager.play('click');
            });
            // Long press for mobile
            let counterLongPressTimer = null;
            badge.addEventListener('touchstart', () => {
                counterLongPressTimer = window.setTimeout(() => {
                    gameState.changeCounter(badgePlayerId, counterType, -1);
                    audioManager.play('click');
                }, 500);
            }, { passive: true });
            badge.addEventListener('touchend', () => {
                if (counterLongPressTimer) {
                    clearTimeout(counterLongPressTimer);
                    counterLongPressTimer = null;
                }
            });
        });
        // Counter footer collapse toggle (double tap)
        const footer = card.querySelector('.player-footer');
        if (footer) {
            let lastTap = 0;
            footer.addEventListener('touchend', (e) => {
                // Don't collapse if clicking on a badge
                if (e.target.closest('.counter-badge'))
                    return;
                const now = Date.now();
                if (now - lastTap < 300) {
                    toggleCountersCollapse(playerId);
                }
                lastTap = now;
            });
            footer.addEventListener('dblclick', (e) => {
                // Don't collapse if clicking on a badge
                if (e.target.closest('.counter-badge'))
                    return;
                toggleCountersCollapse(playerId);
            });
        }
    });
}
// Render counter badges for player footer
function renderPlayerCountersBadges(player) {
    const badges = [];
    const state = gameState.getState();
    // Commander Deaths (Tax) - show first if enabled
    if (state.settings.showCommanderDeaths && player.commanderDeaths >= 0) {
        const tax = player.commanderDeaths * 2;
        const taxDisplay = tax > 0 ? `<span class="tax-value">+${tax}</span>` : '';
        badges.push(`<span class="counter-badge commander-deaths" data-action="commander-deaths" data-player-id="${player.id}" title="Mortes: ${player.commanderDeaths} | Tax: +${tax}">💀 ${player.commanderDeaths}${taxDisplay}</span>`);
    }
    if (player.counters.poison > 0) {
        const isLethal = player.counters.poison >= 10;
        badges.push(`<span class="counter-badge poison clickable ${isLethal ? 'lethal' : ''}" data-action="counter" data-counter-type="poison" data-player-id="${player.id}" title="Clique: +1 | Segurar: -1">☠️ ${player.counters.poison}</span>`);
    }
    if (player.counters.experience > 0) {
        badges.push(`<span class="counter-badge experience clickable" data-action="counter" data-counter-type="experience" data-player-id="${player.id}" title="Clique: +1 | Segurar: -1">⭐ ${player.counters.experience}</span>`);
    }
    if (player.counters.energy > 0) {
        badges.push(`<span class="counter-badge energy clickable" data-action="counter" data-counter-type="energy" data-player-id="${player.id}" title="Clique: +1 | Segurar: -1">⚡ ${player.counters.energy}</span>`);
    }
    if (player.counters.storm > 0) {
        badges.push(`<span class="counter-badge storm clickable" data-action="counter" data-counter-type="storm" data-player-id="${player.id}" title="Clique: +1 | Segurar: -1">🌪️ ${player.counters.storm}</span>`);
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
function updateSettingsControls(state) {
    $('sound-enabled').checked = state.settings.soundEnabled;
    $('volume-slider').value = state.settings.volume.toString();
    $('animations-enabled').checked = state.settings.animationsEnabled;
    $('animation-intensity').value = state.settings.animationIntensity;
    $('show-special-moments').checked = state.settings.showSpecialMoments;
    $('show-commander-deaths').checked = state.settings.showCommanderDeaths;
    $('easter-eggs-enabled').checked = state.settings.easterEggsEnabled;
    $('animated-bg-enabled').checked = state.settings.animatedBgEnabled;
    $('animated-bg-style').value = state.settings.animatedBgStyle;
    $('font-style').value = state.settings.fontStyle;
    $('ambient-music-enabled').checked = state.settings.ambientMusicEnabled;
    $('ambient-music-track').value = state.settings.ambientMusicTrack;
    $('music-volume-slider').value = state.settings.ambientMusicVolume.toString();
    $('narrator-enabled').checked = state.settings.narratorEnabled;
    $('narrator-speed').value = state.settings.narratorSpeed.toString();
    $('sound-pack').value = state.settings.soundPack;
    $('gif-paused').checked = state.settings.gifPaused;
    $('gif-fps-reduced').checked = state.settings.gifFpsReduced;
    $('turn-timer-enabled').checked = state.settings.turnTimerEnabled;
    $('timer-duration').value = state.settings.turnTimerDuration.toString();
    $('random-starter-animation').value = state.settings.randomStarterAnimation;
    $('table-mode-settings').checked = state.settings.layout.tableMode;
    // Update layout presets in settings modal
    renderLayoutPresets();
    // Update theme buttons
    document.querySelectorAll('.theme-btn-sm').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-theme') === state.settings.theme);
    });
    // Update mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-mode') === state.gameMode);
    });
}
// Life change with hold support - shows shortcuts popup on hold
function startLifeChange(playerId, baseAmount, event) {
    event.preventDefault();
    // Debounce to prevent multiple rapid touches on mobile
    const now = Date.now();
    if (now - lastLifeChangeTime < LIFE_CHANGE_DEBOUNCE_MS) {
        return;
    }
    lastLifeChangeTime = now;
    const state = gameState.getState();
    const player = state.players.find(p => p.id === playerId);
    if (!player || player.isEliminated)
        return;
    changeLifeWithFeedback(playerId, baseAmount);
    // Show shortcuts popup after holding for 300ms
    holdTimeout = window.setTimeout(() => {
        showLifeShortcutsPopup(playerId);
    }, 300);
}
// Show life shortcuts popup
function showLifeShortcutsPopup(playerId) {
    // Hide any existing popup first
    hideLifeShortcutsPopup();
    activeLifeShortcutsPlayerId = playerId;
    const popup = document.querySelector(`.life-shortcuts-popup[data-player-id="${playerId}"]`);
    if (popup) {
        popup.classList.add('visible');
        // Add click listeners to shortcut buttons
        popup.querySelectorAll('.life-shortcut-btn').forEach(btn => {
            const amount = parseInt(btn.dataset.amount || '0');
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                changeLifeWithFeedback(playerId, amount);
                hideLifeShortcutsPopup();
                audioManager.play('click');
            }, { once: true });
        });
        // Vibrate to indicate popup appeared
        if (navigator.vibrate) {
            navigator.vibrate(30);
        }
        audioManager.play('click');
    }
}
// Hide life shortcuts popup
function hideLifeShortcutsPopup() {
    if (activeLifeShortcutsPlayerId) {
        const popup = document.querySelector(`.life-shortcuts-popup[data-player-id="${activeLifeShortcutsPlayerId}"]`);
        if (popup) {
            popup.classList.remove('visible');
        }
        activeLifeShortcutsPlayerId = null;
    }
    // Also hide any visible popup
    document.querySelectorAll('.life-shortcuts-popup.visible').forEach(popup => {
        popup.classList.remove('visible');
    });
}
function stopLifeChange() {
    if (holdTimeout) {
        clearTimeout(holdTimeout);
        holdTimeout = null;
    }
    if (holdInterval) {
        clearInterval(holdInterval);
        holdInterval = null;
    }
    // Note: Don't hide popup here - let user interact with it
}
// Fullscreen functionality
function toggleFullscreen() {
    const doc = document;
    const docEl = document.documentElement;
    const isFullscreen = !!(document.fullscreenElement || doc.webkitFullscreenElement);
    if (isFullscreen) {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
        else if (doc.webkitExitFullscreen) {
            doc.webkitExitFullscreen();
        }
    }
    else {
        if (docEl.requestFullscreen) {
            docEl.requestFullscreen();
        }
        else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen();
        }
    }
}
function updateFullscreenIcon() {
    const doc = document;
    const isFullscreen = !!(document.fullscreenElement || doc.webkitFullscreenElement);
    // Update main header fullscreen icon
    const enterIcon = $('fullscreen-icon');
    const exitIcon = $('exit-fullscreen-icon');
    if (enterIcon && exitIcon) {
        enterIcon.style.display = isFullscreen ? 'none' : 'block';
        exitIcon.style.display = isFullscreen ? 'block' : 'none';
    }
    // Update right sidebar fullscreen icon
    const enterIconRight = $('fullscreen-icon-right');
    const exitIconRight = $('exit-fullscreen-icon-right');
    if (enterIconRight && exitIconRight) {
        enterIconRight.style.display = isFullscreen ? 'none' : 'block';
        exitIconRight.style.display = isFullscreen ? 'block' : 'none';
    }
}
function changeLifeWithFeedback(playerId, amount) {
    const card = $('players-grid').querySelector(`[data-player-id="${playerId}"]`);
    if (!card)
        return;
    const lifeValue = card.querySelector('.life-value');
    const indicator = card.querySelector('.life-change-indicator');
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
        // Create particles based on damage/heal amount
        const particleCount = Math.min(Math.abs(amount) * 2, 15);
        if (amount < 0) {
            createParticles(playerId, 'fire', particleCount);
        }
        else if (amount > 0) {
            createParticles(playerId, 'heal', particleCount);
        }
    }
    // Check for special moments and taunts
    const playerAfter = newState.players.find(p => p.id === playerId);
    if (playerAfter && newState.settings.showSpecialMoments) {
        // Near death special message
        if (playerAfter.life === SPECIAL_MOMENTS.NEAR_DEATH && lifeBefore > SPECIAL_MOMENTS.NEAR_DEATH) {
            showSpecialMoment(`${playerAfter.name} está com 1 de vida!`, 'danger');
        }
        // Big damage taunt (5+ damage at once)
        else if (amount <= -5) {
            showTaunt('bigDamage');
        }
        // Big heal taunt (5+ heal at once)
        else if (amount >= 5) {
            showTaunt('bigHeal');
        }
        // Critical life taunt (entered danger zone)
        else if (playerAfter.life <= SPECIAL_MOMENTS.LOW_LIFE && lifeBefore > SPECIAL_MOMENTS.LOW_LIFE && playerAfter.life > 0) {
            showTaunt('criticalLife');
        }
    }
}
// Undo functionality
function performUndo() {
    const result = gameState.undo();
    if (result) {
        audioManager.play('click');
        updateUndoButton();
    }
}
function updateUndoButton() {
    const canUndo = gameState.canUndo();
    const undoBtn = $('undo-btn');
    const floatingUndoBtn = $('floating-undo-btn');
    const undoBtnLeft = $('undo-btn-left');
    if (undoBtn) {
        undoBtn.style.display = canUndo ? 'flex' : 'none';
        undoBtn.classList.toggle('has-undo', canUndo);
    }
    if (floatingUndoBtn) {
        floatingUndoBtn.style.display = canUndo ? 'flex' : 'none';
    }
    // Update left sidebar undo button
    if (undoBtnLeft) {
        undoBtnLeft.style.display = canUndo ? 'flex' : 'none';
        undoBtnLeft.classList.toggle('has-undo', canUndo);
    }
}
// Random Starter Animation
let isRandomStarterRunning = false;
function startRandomStarterAnimation() {
    // Prevent double-click - if animation is already running, ignore
    if (isRandomStarterRunning)
        return;
    isRandomStarterRunning = true;
    // Clear any existing animation interval
    if (randomStarterAnimationInterval) {
        clearInterval(randomStarterAnimationInterval);
        randomStarterAnimationInterval = null;
    }
    const state = gameState.getState();
    const overlay = $('random-starter-overlay');
    const display = $('random-starter-display');
    const message = $('random-starter-message');
    const resultDiv = $('random-starter-result');
    // Hide result from previous run
    resultDiv.style.display = 'none';
    $('random-starter-again-btn').style.display = 'none';
    $('random-starter-close-btn').style.display = 'none';
    // Disable buttons during animation
    const againBtn = $('random-starter-again-btn');
    const closeBtn = $('random-starter-close-btn');
    if (againBtn)
        againBtn.disabled = true;
    if (closeBtn)
        closeBtn.disabled = true;
    // Show easter egg message occasionally
    if (state.settings.easterEggsEnabled && Math.random() < 0.2) {
        const randomMessage = EASTER_EGG_MESSAGES[Math.floor(Math.random() * EASTER_EGG_MESSAGES.length)];
        message.textContent = randomMessage;
    }
    else {
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
        }
        else if (animationType === 'roulette') {
            playerElements[currentIndex]?.classList.add('highlight');
            currentIndex = (currentIndex + 1) % alivePlayers.length;
        }
        else if (animationType === 'flash') {
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
        // Re-enable buttons and reset flag
        const againBtn = $('random-starter-again-btn');
        const closeBtn = $('random-starter-close-btn');
        if (againBtn)
            againBtn.disabled = false;
        if (closeBtn)
            closeBtn.disabled = false;
        isRandomStarterRunning = false;
        audioManager.play('win');
    }, duration);
}
// Commander Damage Modal
function openCommanderDamageModal(playerId) {
    currentCommanderDamagePlayerId = playerId;
    const state = gameState.getState();
    renderCommanderDamageModal(state, playerId);
    openModal($('commander-damage-modal'));
}
function renderCommanderDamageModal(state, playerId) {
    const player = state.players.find(p => p.id === playerId);
    if (!player)
        return;
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
        const sourceId = item.dataset.sourceId;
        item.querySelector('[data-action="decrease"]')?.addEventListener('click', () => {
            gameState.addCommanderDamage(playerId, sourceId, -1);
        });
        item.querySelector('[data-action="increase"]')?.addEventListener('click', () => {
            gameState.addCommanderDamage(playerId, sourceId, 1);
            audioManager.play('commander_damage', playerId);
        });
    });
}
// Counters Modal
function openCountersModal(playerId) {
    currentCountersPlayerId = playerId;
    const state = gameState.getState();
    renderCountersModal(state, playerId);
    openModal($('counters-modal'));
}
function renderCountersModal(state, playerId) {
    const player = state.players.find(p => p.id === playerId);
    if (!player)
        return;
    // Commander Deaths (Tax) section - always first
    const commanderTax = player.commanderDeaths * 2;
    const commanderDeathsHtml = `
        <div class="counter-item commander-deaths-item" data-counter-id="commanderDeaths">
            <div class="counter-icon">💀</div>
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
        const value = player.counters[preset.id] || 0;
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
        const counterId = item.dataset.counterId;
        if (counterId === 'commanderDeaths') {
            item.querySelector('[data-action="decrease"]')?.addEventListener('click', () => {
                gameState.changeCommanderDeaths(playerId, -1);
            });
            item.querySelector('[data-action="increase"]')?.addEventListener('click', () => {
                gameState.changeCommanderDeaths(playerId, 1);
            });
        }
        else if (counterId === 'monarch') {
            item.querySelector('[data-action="toggle-monarch"]')?.addEventListener('click', () => {
                const p = gameState.getState().players.find(p => p.id === playerId);
                if (p?.isMonarch) {
                    gameState.removeMonarch();
                }
                else {
                    gameState.setMonarch(playerId);
                    audioManager.play('monarch', playerId);
                }
            });
        }
        else if (item.classList.contains('custom')) {
            item.querySelector('[data-action="decrease"]')?.addEventListener('click', () => {
                gameState.changeCustomCounter(playerId, counterId, -1);
            });
            item.querySelector('[data-action="increase"]')?.addEventListener('click', () => {
                gameState.changeCustomCounter(playerId, counterId, 1);
            });
            item.querySelector('[data-action="remove"]')?.addEventListener('click', () => {
                gameState.removeCustomCounter(playerId, counterId);
            });
        }
        else {
            const validCounterTypes = ['poison', 'experience', 'energy', 'storm'];
            if (validCounterTypes.includes(counterId)) {
                item.querySelector('[data-action="decrease"]')?.addEventListener('click', () => {
                    gameState.changeCounter(playerId, counterId, -1);
                });
                item.querySelector('[data-action="increase"]')?.addEventListener('click', () => {
                    gameState.changeCounter(playerId, counterId, 1);
                    // Play type-specific sound
                    const soundName = counterId === 'poison' ? 'poison' :
                        counterId === 'energy' ? 'energy' :
                            counterId === 'experience' ? 'experience' : 'click';
                    audioManager.play(soundName, playerId);
                });
            }
        }
    });
}
// Player Settings Modal
function openPlayerSettings(playerId) {
    currentEditingPlayerId = playerId;
    const state = gameState.getState();
    const player = state.players.find(p => p.id === playerId);
    if (!player)
        return;
    $('player-name-input').value = player.name;
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
    $('custom-tag-input').value = '';
    // Setup avatar preview
    const avatarPreview = $('avatar-preview');
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
        }
        else {
            avatarControls.style.display = 'none';
            avatarTypeBadge.textContent = 'Imagem';
            avatarTypeBadge.className = 'media-type-badge image';
        }
        avatarTypeBadge.style.display = 'inline';
    }
    else {
        avatarPreview.style.display = 'none';
        avatarPlaceholder.style.display = 'flex';
        avatarContainer.classList.remove('has-media');
        avatarControls.style.display = 'none';
        $('avatar-clear-btn').style.display = 'none';
        avatarTypeBadge.style.display = 'none';
    }
    // Setup background preview
    const bgPreview = $('background-preview');
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
        }
        else {
            bgControls.style.display = 'none';
            bgTypeBadge.textContent = 'Imagem';
            bgTypeBadge.className = 'media-type-badge image';
        }
        bgTypeBadge.style.display = 'inline';
    }
    else {
        bgPreview.style.display = 'none';
        bgPlaceholder.style.display = 'flex';
        bgContainer.classList.remove('has-media');
        bgControls.style.display = 'none';
        $('background-clear-btn').style.display = 'none';
        bgTypeBadge.style.display = 'none';
    }
    openModal($('player-settings-modal'));
}
function savePlayerSettings() {
    if (!currentEditingPlayerId)
        return;
    const name = $('player-name-input').value.trim() || 'Jogador';
    // Check for custom color first, then preset color
    let color;
    const customColorPreview = $('custom-color-preview');
    if (customColorPreview && customColorPreview.style.display !== 'none' && selectedCustomColor) {
        color = selectedCustomColor;
    }
    else {
        const selectedColor = document.querySelector('.color-option.selected');
        color = selectedColor?.getAttribute('data-color') || DEFAULT_PLAYER_COLORS[0];
    }
    const selectedEmoji = document.querySelector('.emoji-option.selected');
    const emoji = selectedEmoji?.getAttribute('data-emoji') || null;
    const selectedTag = document.querySelector('.tag-option.selected');
    let tag = selectedTag?.getAttribute('data-tag') || null;
    const customTag = $('custom-tag-input').value.trim();
    if (customTag)
        tag = customTag;
    const avatar = $('avatar-preview').style.display !== 'none' ? $('avatar-preview').src : null;
    const background = $('background-preview').style.display !== 'none' ? $('background-preview').src : null;
    // Determine background type from the badge
    let backgroundType = 'none';
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
        backgroundType: backgroundType,
    });
    // Reset custom color state
    selectedCustomColor = null;
    if (customColorPreview)
        customColorPreview.style.display = 'none';
    closeModal($('player-settings-modal'));
    currentEditingPlayerId = null;
}
// Turn Timer
function updateTurnTimer(state) {
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
        if (!currentState.turnStartTime)
            return;
        const elapsed = (Date.now() - currentState.turnStartTime) / 1000;
        const remaining = Math.max(0, currentState.settings.turnTimerDuration - elapsed);
        const minutes = Math.floor(remaining / 60);
        const seconds = Math.floor(remaining % 60);
        timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        timerDisplay.classList.remove('warning', 'danger');
        if (remaining <= 10) {
            timerDisplay.classList.add('danger');
        }
        else if (remaining <= 30) {
            timerDisplay.classList.add('warning');
        }
    };
    updateTimer();
    turnTimerInterval = window.setInterval(updateTimer, 100);
}
// Taunt system
let lastTauntTime = 0;
const TAUNT_COOLDOWN = 3000; // 3 seconds between taunts
function getRandomTaunt(category) {
    const phrases = TAUNT_PHRASES[category];
    return phrases[Math.floor(Math.random() * phrases.length)];
}
function showTaunt(category) {
    const state = gameState.getState();
    if (!state.settings.showSpecialMoments)
        return;
    const now = Date.now();
    if (now - lastTauntTime < TAUNT_COOLDOWN)
        return;
    lastTauntTime = now;
    const taunt = getRandomTaunt(category);
    const type = category === 'bigHeal' || category === 'monarch' || category === 'criticalRoll'
        ? 'success'
        : category === 'comeback'
            ? 'warning'
            : 'danger';
    showSpecialMoment(taunt, type);
}
// Special moments
function showSpecialMoment(message, type = 'danger') {
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
// Dice roller functionality
let isRolling = false;
function rollDice(diceType) {
    if (isRolling)
        return;
    const resultEl = $('dice-result');
    const valueEl = $('dice-result-value');
    if (!resultEl || !valueEl)
        return;
    isRolling = true;
    resultEl.classList.add('rolling');
    valueEl.textContent = '';
    valueEl.className = 'dice-result-value';
    audioManager.play('click');
    // Vibrate while rolling
    if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50, 30, 50]);
    }
    // Rolling animation duration
    setTimeout(() => {
        resultEl.classList.remove('rolling');
        isRolling = false;
        let result;
        let emoji;
        let isCrit = false;
        let isFail = false;
        if (diceType === 'coin') {
            result = Math.random() < 0.5 ? 'Cara' : 'Coroa';
            emoji = result === 'Cara' ? '😀' : '🦅';
        }
        else {
            const max = parseInt(diceType);
            result = Math.floor(Math.random() * max) + 1;
            emoji = getDiceEmoji(max);
            // Check for critical success or failure (D20 specific)
            if (max === 20) {
                if (result === 20)
                    isCrit = true;
                if (result === 1)
                    isFail = true;
            }
            else {
                if (result === max)
                    isCrit = true;
                if (result === 1)
                    isFail = true;
            }
        }
        resultEl.textContent = emoji;
        valueEl.textContent = String(result);
        if (isCrit) {
            valueEl.classList.add('crit');
            audioManager.play('win');
            // Show taunt for critical roll (D20 only)
            if (diceType === '20') {
                showTaunt('criticalRoll');
            }
        }
        else if (isFail) {
            valueEl.classList.add('fail');
            audioManager.play('damage');
            // Show taunt for critical fail (D20 only)
            if (diceType === '20') {
                showTaunt('criticalFail');
            }
        }
        // Add to history
        addDiceHistory(diceType, result, isCrit, isFail);
    }, 800);
}
function getDiceEmoji(sides) {
    switch (sides) {
        case 4: return '🔻';
        case 6: return '🎲';
        case 8: return '🔷';
        case 10: return '🔶';
        case 12: return '⭐';
        case 20: return '🎯';
        default: return '🎲';
    }
}
function addDiceHistory(diceType, result, isCrit, isFail) {
    const historyList = $('dice-history-list');
    if (!historyList)
        return;
    // Add to beginning of history
    diceHistory.unshift({ dice: diceType, result });
    // Keep only last 8 rolls
    if (diceHistory.length > 8) {
        diceHistory.pop();
    }
    // Render history
    historyList.innerHTML = diceHistory.map((item, index) => {
        const label = item.dice === 'coin' ? '💰' : `D${item.dice}`;
        let className = 'dice-history-item';
        if (index === 0) {
            if (isCrit)
                className += ' crit';
            if (isFail)
                className += ' fail';
        }
        return `<span class="${className}">${label}: ${item.result}</span>`;
    }).join('');
}
function createParticles(playerId, type, count = 8) {
    const state = gameState.getState();
    if (!state.settings.animationsEnabled)
        return;
    const card = document.querySelector(`.player-card[data-player-id="${playerId}"]`);
    if (!card)
        return;
    // Create or get particle container
    let container = card.querySelector('.particle-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'particle-container';
        card.appendChild(container);
    }
    // Create particles
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = `particle ${type}`;
        // Random position within card
        const x = 20 + Math.random() * 60; // 20-80% of card width
        const y = 30 + Math.random() * 40; // 30-70% of card height
        const delay = Math.random() * 0.3;
        particle.style.left = `${x}%`;
        particle.style.top = `${y}%`;
        particle.style.animationDelay = `${delay}s`;
        // Type-specific customizations
        if (type === 'heal') {
            const tx = -20 + Math.random() * 40; // Random horizontal drift
            particle.style.setProperty('--tx', `${tx}px`);
        }
        else if (type === 'energy') {
            const rot = -30 + Math.random() * 60;
            particle.style.setProperty('--rot', `${rot}deg`);
        }
        else if (type === 'experience') {
            particle.textContent = '⭐';
        }
        container.appendChild(particle);
    }
    // Clean up particles after animation
    setTimeout(() => {
        container.querySelectorAll('.particle').forEach(p => {
            if (p.parentNode === container) {
                p.remove();
            }
        });
    }, 1500);
}
// Winner display with epic animations
function showWinner(player) {
    $('winner-name').textContent = player.name;
    $('winner-overlay').classList.add('active');
    audioManager.play('win', player.id);
    // Show share buttons when there's a winner
    const shareBtn = $('share-result-btn');
    const shareBtnRight = $('share-result-btn-right');
    if (shareBtn)
        shareBtn.style.display = 'flex';
    if (shareBtnRight)
        shareBtnRight.style.display = 'flex';
    // Create epic confetti
    createConfetti();
    // Create firework bursts
    setTimeout(() => createFireworks(), 200);
    setTimeout(() => createFireworks(), 600);
    setTimeout(() => createFireworks(), 1000);
    // Vibrate for celebration
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200]);
    }
}
// Create confetti particles
function createConfetti() {
    const container = document.querySelector('.winner-confetti');
    if (!container)
        return;
    // Clear existing confetti
    container.innerHTML = '';
    const colors = ['#f43f5e', '#ec4899', '#8b5cf6', '#6366f1', '#3b82f6', '#22c55e', '#eab308', '#f97316'];
    const shapes = ['square', 'circle', 'ribbon'];
    for (let i = 0; i < 100; i++) {
        const piece = document.createElement('div');
        const color = colors[Math.floor(Math.random() * colors.length)];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const leftPos = Math.random() * 100;
        const delay = Math.random() * 2;
        const duration = 2 + Math.random() * 2;
        piece.className = `confetti-piece ${shape}`;
        piece.style.cssText = `
            left: ${leftPos}%;
            background: ${color};
            --delay: ${delay}s;
            --fall-duration: ${duration}s;
        `;
        container.appendChild(piece);
    }
    // Clean up after animation
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}
// Create firework burst
function createFireworks() {
    const container = document.querySelector('.winner-confetti');
    if (!container)
        return;
    const colors = ['#f43f5e', '#ec4899', '#8b5cf6', '#22c55e', '#eab308', '#3b82f6'];
    const centerX = 20 + Math.random() * 60; // Random X between 20-80%
    const centerY = 20 + Math.random() * 40; // Random Y between 20-60%
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        const color = colors[Math.floor(Math.random() * colors.length)];
        const angle = (i / 20) * 2 * Math.PI;
        const distance = 50 + Math.random() * 100;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        particle.className = 'firework';
        particle.style.cssText = `
            left: ${centerX}%;
            top: ${centerY}%;
            background: ${color};
            box-shadow: 0 0 6px ${color};
            --tx: ${tx}px;
            --ty: ${ty}px;
        `;
        container.appendChild(particle);
    }
}
// Modal helpers
function openModal(modal) {
    modal.classList.add('active');
}
function closeModal(modal) {
    modal.classList.remove('active');
    if (modal === $('commander-damage-modal')) {
        currentCommanderDamagePlayerId = null;
    }
    else if (modal === $('counters-modal')) {
        currentCountersPlayerId = null;
    }
    else if (modal === $('player-settings-modal')) {
        currentEditingPlayerId = null;
    }
}
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        closeModal(modal);
    });
}
// ===== Rules & Keywords Modal =====
let currentRulesCategory = 'all';
let currentRulesSearch = '';
function openRulesModal() {
    openModal($('rules-modal'));
    renderRulesKeywords();
    setupRulesListeners();
}
function setupRulesListeners() {
    // Search input
    const searchInput = $('rules-search-input');
    searchInput?.addEventListener('input', (e) => {
        currentRulesSearch = e.target.value.toLowerCase();
        renderRulesKeywords();
    });
    // Category buttons
    document.querySelectorAll('.rules-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.rules-cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRulesCategory = btn.dataset.category || 'all';
            renderRulesKeywords();
        });
    });
}
function renderRulesKeywords() {
    const list = $('rules-list');
    if (!list)
        return;
    let keywords = MTG_KEYWORDS;
    // Filter by category
    if (currentRulesCategory !== 'all') {
        keywords = keywords.filter(k => k.category === currentRulesCategory);
    }
    // Filter by search
    if (currentRulesSearch) {
        keywords = keywords.filter(k => k.name.toLowerCase().includes(currentRulesSearch) ||
            k.description.toLowerCase().includes(currentRulesSearch) ||
            (k.reminder && k.reminder.toLowerCase().includes(currentRulesSearch)));
    }
    if (keywords.length === 0) {
        list.innerHTML = '<div class="rules-empty">Nenhuma keyword encontrada</div>';
        return;
    }
    list.innerHTML = keywords.map(keyword => `
        <div class="rules-item" data-category="${keyword.category}">
            <div class="rules-item-header">
                <span class="rules-item-name">${keyword.name}</span>
                ${keyword.reminder ? `<span class="rules-item-reminder">(${keyword.reminder})</span>` : ''}
            </div>
            <p class="rules-item-description">${keyword.description}</p>
        </div>
    `).join('');
}
// ===== Color Picker Functions =====
function openColorPicker() {
    openModal($('color-picker-modal'));
    initColorPickerCanvas();
}
function setupColorPickerCanvas() {
    const mainCanvas = $('color-picker-canvas');
    const hueCanvas = $('hue-picker-canvas');
    if (!mainCanvas || !hueCanvas)
        return;
    // Main color picker interactions
    let isDraggingMain = false;
    mainCanvas.addEventListener('mousedown', (e) => {
        isDraggingMain = true;
        handleMainCanvasClick(e);
    });
    mainCanvas.addEventListener('mousemove', (e) => {
        if (isDraggingMain)
            handleMainCanvasClick(e);
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
        if (isDraggingHue)
            handleHueCanvasClick(e);
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
function initColorPickerCanvas() {
    drawHueBar();
    drawMainCanvas();
    updateColorDisplay();
}
function drawHueBar() {
    const canvas = $('hue-picker-canvas');
    if (!canvas)
        return;
    const ctx = canvas.getContext('2d');
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
function drawMainCanvas() {
    const canvas = $('color-picker-canvas');
    if (!canvas)
        return;
    const ctx = canvas.getContext('2d');
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
function handleMainCanvasClick(e) {
    const canvas = $('color-picker-canvas');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentSaturation = Math.max(0, Math.min(100, (x / canvas.width) * 100));
    currentLightness = Math.max(0, Math.min(100, (1 - y / canvas.height) * 100));
    drawMainCanvas();
    updateColorDisplay();
}
function handleMainCanvasTouch(e) {
    const canvas = $('color-picker-canvas');
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    currentSaturation = Math.max(0, Math.min(100, (x / canvas.width) * 100));
    currentLightness = Math.max(0, Math.min(100, (1 - y / canvas.height) * 100));
    drawMainCanvas();
    updateColorDisplay();
}
function handleHueCanvasClick(e) {
    const canvas = $('hue-picker-canvas');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    currentHue = Math.max(0, Math.min(360, (x / canvas.width) * 360));
    drawHueBar();
    drawMainCanvas();
    updateColorDisplay();
}
function handleHueCanvasTouch(e) {
    const canvas = $('hue-picker-canvas');
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    currentHue = Math.max(0, Math.min(360, (x / canvas.width) * 360));
    drawHueBar();
    drawMainCanvas();
    updateColorDisplay();
}
function updateColorDisplay() {
    const color = hslToHex(currentHue, currentSaturation, currentLightness);
    selectedCustomColor = color;
    const resultDiv = $('color-picker-result');
    if (resultDiv)
        resultDiv.style.background = color;
    const hexInput = $('color-hex-input');
    if (hexInput)
        hexInput.value = color;
    const rgb = hexToRgb(color);
    if (rgb) {
        $('color-r-input').value = rgb.r.toString();
        $('color-g-input').value = rgb.g.toString();
        $('color-b-input').value = rgb.b.toString();
    }
}
function updateColorFromHex(hex) {
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
function updateColorFromRGB() {
    const r = parseInt($('color-r-input').value) || 0;
    const g = parseInt($('color-g-input').value) || 0;
    const b = parseInt($('color-b-input').value) || 0;
    const hsl = rgbToHsl(r, g, b);
    currentHue = hsl.h;
    currentSaturation = hsl.s;
    currentLightness = hsl.l;
    drawHueBar();
    drawMainCanvas();
    selectedCustomColor = rgbToHex(r, g, b);
    const resultDiv = $('color-picker-result');
    if (resultDiv)
        resultDiv.style.background = selectedCustomColor;
    $('color-hex-input').value = selectedCustomColor;
}
function applyCustomColor() {
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
function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}
function rgbToHex(r, g, b) {
    return `#${[r, g, b].map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('')}`;
}
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
}
// ===== Share Result Functions =====
function openShareModal() {
    generateShareImage();
    openModal($('share-modal'));
}
function generateShareImage() {
    const canvas = $('share-canvas');
    const ctx = canvas.getContext('2d');
    const state = gameState.getState();
    // Set canvas size
    canvas.width = 600;
    canvas.height = 400;
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Header
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    const winner = state.players.find(p => p.id === state.winner);
    if (winner) {
        ctx.fillText('🏆 VITÓRIA! 🏆', canvas.width / 2, 50);
        ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = winner.color;
        ctx.fillText(winner.name, canvas.width / 2, 85);
    }
    else {
        ctx.fillText('⚔️ Resultado da Partida ⚔️', canvas.width / 2, 50);
    }
    // Game info
    ctx.font = '14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText(`Turno ${state.currentTurn} • ${state.gameMode === 'two-headed' ? 'Two-Headed Giant' : state.gameMode === 'standard' ? 'Standard' : state.gameMode}`, canvas.width / 2, 110);
    // Players grid
    const playerCount = state.players.length;
    const cols = playerCount <= 2 ? playerCount : Math.ceil(playerCount / 2);
    const rows = playerCount <= 2 ? 1 : 2;
    const cardWidth = 130;
    const cardHeight = 100;
    const startX = (canvas.width - (cols * (cardWidth + 20))) / 2 + 10;
    const startY = 140;
    state.players.forEach((player, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (cardWidth + 20);
        const y = startY + row * (cardHeight + 15);
        // Card background
        ctx.fillStyle = player.isEliminated ? '#2d1f1f' : 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.roundRect(x, y, cardWidth, cardHeight, 8);
        ctx.fill();
        // Player color bar
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.roundRect(x, y, 6, cardHeight, [8, 0, 0, 8]);
        ctx.fill();
        // Winner highlight
        if (player.id === state.winner) {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(x, y, cardWidth, cardHeight, 8);
            ctx.stroke();
        }
        // Player name
        ctx.fillStyle = player.isEliminated ? '#666' : '#fff';
        ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(truncateText(player.name, ctx, cardWidth - 20), x + 15, y + 25);
        // Life total
        ctx.fillStyle = player.isEliminated ? '#ef4444' : player.life <= 5 ? '#ef4444' : player.life <= 10 ? '#f59e0b' : '#22c55e';
        ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(player.isEliminated ? '💀' : player.life.toString(), x + cardWidth / 2, y + 60);
        // Status indicators
        ctx.font = '11px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#888';
        const statusParts = [];
        if (player.counters.poison > 0)
            statusParts.push(`☠️${player.counters.poison}`);
        if (player.isMonarch)
            statusParts.push('👑');
        if (player.id === state.winner)
            statusParts.push('🏆');
        if (statusParts.length > 0) {
            ctx.fillText(statusParts.join(' '), x + cardWidth / 2, y + 85);
        }
    });
    // Footer
    ctx.fillStyle = '#555';
    ctx.font = '12px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MTG Life Counter', canvas.width / 2, canvas.height - 20);
}
function truncateText(text, ctx, maxWidth) {
    let truncated = text;
    while (ctx.measureText(truncated).width > maxWidth && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
    }
    return truncated === text ? text : truncated + '...';
}
async function shareImage() {
    const canvas = $('share-canvas');
    try {
        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(b => b ? resolve(b) : reject(new Error('Failed to create blob')), 'image/png');
        });
        const file = new File([blob], 'mtg-result.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: 'MTG Life Counter - Resultado',
                text: 'Confira o resultado da nossa partida!',
                files: [file]
            });
        }
        else {
            // Fallback: download the image
            downloadImage();
        }
    }
    catch (e) {
        console.warn('Share failed:', e);
        downloadImage();
    }
}
function downloadImage() {
    const canvas = $('share-canvas');
    const link = document.createElement('a');
    link.download = `mtg-result-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}
async function copyImageToClipboard() {
    const canvas = $('share-canvas');
    try {
        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(b => b ? resolve(b) : reject(new Error('Failed to create blob')), 'image/png');
        });
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);
        // Show feedback
        const btn = $('share-copy-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>✓</span> Copiado!';
        setTimeout(() => btn.innerHTML = originalText, 2000);
    }
    catch (e) {
        console.warn('Copy failed:', e);
        alert('Não foi possível copiar. Tente salvar a imagem.');
    }
}
// ===== Image Search Functions =====
function openImageSearch(title) {
    $('image-search-title').textContent = title;
    $('image-search-input').value = '';
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
    setTimeout(() => $('image-search-input').focus(), 100);
}
async function performImageSearch() {
    const query = $('image-search-input').value.trim();
    if (!query)
        return;
    const resultsDiv = $('image-search-results');
    const loadingDiv = $('image-search-loading');
    resultsDiv.innerHTML = '';
    loadingDiv.style.display = 'flex';
    try {
        let images = [];
        if (imageSearchType === 'gif') {
            // Use Tenor API (free, no API key required for limited usage)
            images = await searchTenorGifs(query);
        }
        else {
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
                const url = item.dataset.url;
                selectSearchImage(url);
            });
        });
    }
    catch (error) {
        loadingDiv.style.display = 'none';
        resultsDiv.innerHTML = '<div class="image-search-placeholder">Erro ao buscar. Tente novamente.</div>';
        console.error('Image search error:', error);
    }
}
async function searchTenorGifs(query) {
    // Tenor API v2 - using anonymous access
    const apiKey = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ'; // Google's public Tenor API key
    const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${apiKey}&limit=18&media_filter=gif,tinygif`;
    const response = await fetch(url);
    const data = await response.json();
    return (data.results || []).map((item) => ({
        url: item.media_formats?.gif?.url || item.media_formats?.mediumgif?.url || '',
        preview: item.media_formats?.tinygif?.url || item.media_formats?.nanogif?.url || ''
    })).filter((img) => img.url);
}
async function searchUnsplashImages(query) {
    // Using Lorem Picsum as fallback (no API key needed)
    // For production, use Unsplash API with proper key
    const images = [];
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
function selectSearchImage(url) {
    // Show preview section instead of applying directly
    pendingImageUrl = url;
    pendingImageType = imageSearchType;
    const previewSection = $('image-preview-section');
    const previewImg = $('selected-image-preview');
    const typeBadge = $('preview-type-badge');
    previewImg.src = url;
    typeBadge.textContent = imageSearchType === 'gif' ? 'GIF' : 'Imagem';
    typeBadge.className = `preview-type-badge ${imageSearchType}`;
    previewSection.style.display = 'block';
    // Scroll preview into view
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function cancelImageSelection() {
    $('image-preview-section').style.display = 'none';
    pendingImageUrl = null;
}
function applySelectedImage() {
    if (!pendingImageUrl)
        return;
    if (imageSearchTarget === 'avatar') {
        const preview = $('avatar-preview');
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
        }
        else {
            controls.style.display = 'none';
            typeBadge.textContent = 'Imagem';
            typeBadge.className = 'media-type-badge image';
        }
        typeBadge.style.display = 'inline';
    }
    else {
        const preview = $('background-preview');
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
        }
        else {
            controls.style.display = 'none';
            typeBadge.textContent = 'Imagem';
            typeBadge.className = 'media-type-badge image';
        }
        typeBadge.style.display = 'inline';
    }
    pendingImageUrl = null;
    closeModal($('image-search-modal'));
}
function toggleMediaPreviewPause(type) {
    const img = $(type === 'avatar' ? 'avatar-preview' : 'background-preview');
    const btn = $(type === 'avatar' ? 'avatar-pause-btn' : 'background-pause-btn');
    if (img.classList.contains('paused')) {
        img.classList.remove('paused');
        btn.classList.remove('active');
        btn.textContent = '⏸️';
    }
    else {
        img.classList.add('paused');
        btn.classList.add('active');
        btn.textContent = '▶️';
    }
}
// ===== Revive Player Functions =====
function renderReviveButton(player) {
    if (!player.isEliminated)
        return '';
    return `
        <div class="revive-overlay">
            <button class="revive-btn" data-player-id="${player.id}">
                Reviver Jogador
            </button>
        </div>
    `;
}
function handleRevivePlayer(playerId) {
    const state = gameState.getState();
    if (state.settings.confirmCriticalActions) {
        if (!confirm('Reviver este jogador?'))
            return;
    }
    gameState.revivePlayer(playerId, true);
    audioManager.play('heal', playerId);
}
// ===== Collapsible Counters =====
function toggleCountersCollapse(playerId) {
    if (collapsedCounters.has(playerId)) {
        collapsedCounters.delete(playerId);
    }
    else {
        collapsedCounters.add(playerId);
    }
    render(gameState.getState());
}
// ===== Commander Deaths Functions =====
function handleCommanderDeathChange(playerId, amount) {
    gameState.changeCommanderDeaths(playerId, amount);
    // Animation feedback
    if (amount > 0) {
        const badge = document.querySelector(`[data-action="commander-deaths"][data-player-id="${playerId}"]`);
        if (badge) {
            badge.classList.remove('pulse');
            void badge.offsetWidth; // Trigger reflow
            badge.classList.add('pulse');
            audioManager.play('click');
        }
    }
}
//# sourceMappingURL=ui.js.map