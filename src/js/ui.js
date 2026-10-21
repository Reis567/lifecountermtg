// ===== UI Management =====
// secureRandom* vêm de state.js: duplicar as funções aqui quebrava o bundle do
// Android (script único = um só escopo, identificador declarado duas vezes).
import { gameState, secureRandomInt } from './state.js';
import { audioManager, ambientMusic, narrator } from './audio.js';
import { openCardScanner, setupCardScanner } from './cardScanner.js';
import { openFingerPicker } from './fingerPicker.js';
import { setupVoiceControl, vcSetGameActive } from './voiceControl.js';
import { narrateElimination, narrateWinner } from './aiNarrator.js';
import { startEscandalosa, stopEscandalosa, isEscandalosaEnabled } from './victory.js';
import { saveResult, buildAutoResult, buildManualResult, placementsFromOrder, aggregateRemote, listMatchesRemote, deleteMatchRemote, } from './ranking.js';
import { getProfiles, getProfileById, refreshProfiles, createProfile, updateProfile, deleteProfile, onProfilesChange, avatarHtml, escapeHtml, } from './profiles.js';
import { setupSync, getSyncStatus, onSyncChange, flushSyncQueue, onNewAchievements } from './sync.js';
import { apiProfileStats, apiGetSeasonSettings, apiSetSeasonSettings, apiGetMatch } from './api.js';
import { setupUpdater, openUpdateModal } from './updater.js';
import { confirmDialog, confirmDialogFull, alertDialog, requestWakeLock, releaseWakeLock, setupWakeLock } from './dialogs.js';
import { openMechanicsModal, renderMechanicsBadge } from './mechanics.js';
import { setupNotifications, onNotification, getMyProfileId, setMyProfileId } from './notifications.js';
import { DEFAULT_PLAYER_COLORS, PRESET_COUNTERS, COMMANDER_DAMAGE_LETHAL, LAYOUT_PRESETS, EASTER_EGG_MESSAGES, SPECIAL_MOMENTS, TAUNT_PHRASES, MANUAL_TAUNTS, MTG_KEYWORDS, } from './types.js';
// ===== Secure Random Functions =====
// Secure random integer from min to max (inclusive)
function secureRandomRange(min, max) {
    return min + secureRandomInt(max - min + 1);
}
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
// Track eliminated players to play death sound only once
const eliminatedPlayersShown = new Set();
// Damage shadow state - tracks accumulated damage/heal per player
const damageShadowAccumulator = new Map();
const damageShadowTimers = new Map();
const DAMAGE_SHADOW_TIMEOUT_MS = 3000;
// Update damage shadow display
function updateDamageShadow(playerId, amount, shadowElement) {
    if (!shadowElement)
        return;
    // Clear existing timer for this player
    const existingTimer = damageShadowTimers.get(playerId);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }
    // Get current accumulated value and add new amount
    const currentAccum = damageShadowAccumulator.get(playerId) || 0;
    const newAccum = currentAccum + amount;
    // If accumulated value is 0, hide the shadow
    if (newAccum === 0) {
        damageShadowAccumulator.delete(playerId);
        shadowElement.textContent = '';
        shadowElement.className = 'damage-shadow';
        return;
    }
    // Update accumulator
    damageShadowAccumulator.set(playerId, newAccum);
    // Update shadow display
    const isNegative = newAccum < 0;
    shadowElement.textContent = (newAccum > 0 ? '+' : '') + newAccum;
    shadowElement.className = `damage-shadow active ${isNegative ? 'damage' : 'heal'}`;
    // Force inline styles for visibility
    shadowElement.style.color = isNegative ? '#ff4444' : '#44ff44';
    shadowElement.style.display = 'inline';
    // Set timer to clear the shadow after timeout
    const timer = window.setTimeout(() => {
        damageShadowAccumulator.delete(playerId);
        damageShadowTimers.delete(playerId);
        shadowElement.textContent = '';
        shadowElement.className = 'damage-shadow';
        shadowElement.style.color = '';
        shadowElement.style.display = '';
    }, DAMAGE_SHADOW_TIMEOUT_MS);
    damageShadowTimers.set(playerId, timer);
}
// Clear all damage shadows (called on game reset)
function clearAllDamageShadows() {
    damageShadowTimers.forEach(timer => clearTimeout(timer));
    damageShadowTimers.clear();
    damageShadowAccumulator.clear();
    document.querySelectorAll('.damage-shadow').forEach(el => {
        el.textContent = '';
        el.className = 'damage-shadow';
    });
}
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
// Custom taunts (temporary, for current match only)
const customTaunts = [];
let currentTauntPlayerId = null;
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
// ===== Taunt System =====
function openTauntModal(playerId) {
    currentTauntPlayerId = playerId;
    const state = gameState.getState();
    const player = state.players.find(p => p.id === playerId);
    if (!player)
        return;
    const modal = $('taunt-modal');
    const playerName = $('taunt-player-name');
    const emojisGrid = $('taunt-emojis');
    const phrasesGrid = $('taunt-phrases');
    const customGrid = $('taunt-custom');
    if (playerName) {
        playerName.textContent = `Provocando como: ${player.name}`;
    }
    // Render emojis
    if (emojisGrid) {
        emojisGrid.innerHTML = MANUAL_TAUNTS.emojis.map(emoji => `<button class="taunt-btn" data-taunt="${emoji}">${emoji}</button>`).join('');
    }
    // Render phrases
    if (phrasesGrid) {
        phrasesGrid.innerHTML = MANUAL_TAUNTS.phrases.map(phrase => `<button class="taunt-btn" data-taunt="${phrase}">${phrase}</button>`).join('');
    }
    // Render custom taunts
    renderCustomTaunts();
    modal?.classList.add('active');
    setupTauntListeners();
}
function renderCustomTaunts() {
    const customGrid = $('taunt-custom');
    if (!customGrid)
        return;
    if (customTaunts.length === 0) {
        customGrid.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">Nenhum taunt customizado ainda</span>';
    }
    else {
        customGrid.innerHTML = customTaunts.map(taunt => `<button class="taunt-btn" data-taunt="${taunt}">${taunt}</button>`).join('');
    }
    // Re-setup listeners for new buttons
    setupTauntListeners();
}
function setupTauntListeners() {
    const modal = $('taunt-modal');
    if (!modal)
        return;
    // Taunt buttons
    modal.querySelectorAll('.taunt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const taunt = e.target.dataset.taunt;
            if (taunt && currentTauntPlayerId) {
                sendTaunt(currentTauntPlayerId, taunt);
                closeTauntModal();
            }
        });
    });
    // Add custom taunt button
    $('add-custom-taunt-btn')?.addEventListener('click', addCustomTaunt);
    // Enter key for custom taunt input
    const customInput = $('custom-taunt-input');
    customInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addCustomTaunt();
        }
    });
    // Close button
    modal.querySelector('.modal-close')?.addEventListener('click', closeTauntModal);
}
function addCustomTaunt() {
    const input = $('custom-taunt-input');
    if (!input)
        return;
    const taunt = input.value.trim();
    if (taunt && taunt.length > 0 && taunt.length <= 30) {
        if (!customTaunts.includes(taunt)) {
            customTaunts.push(taunt);
            renderCustomTaunts();
        }
        input.value = '';
    }
}
function closeTauntModal() {
    $('taunt-modal')?.classList.remove('active');
    currentTauntPlayerId = null;
}
function sendTaunt(playerId, taunt) {
    const state = gameState.getState();
    const player = state.players.find(p => p.id === playerId);
    if (!player)
        return;
    // Check if it's an LGBT/viado taunt - play fluminense
    const isLgbtTaunt = isViadoTaunt(taunt);
    if (isLgbtTaunt && state.settings.soundEnabled) {
        audioManager.play('viado', undefined, 'jose'); // Force fluminense by passing 'jose'
    }
    else {
        audioManager.play('click');
    }
    // Vibrate
    if (navigator.vibrate) {
        navigator.vibrate(100);
    }
    // Show taunt overlay
    showTauntOverlay(player.name, taunt, isLgbtTaunt);
}
function isViadoTaunt(taunt) {
    const lowerTaunt = taunt.toLowerCase();
    // Check for LGBT flag emoji or viado text
    return taunt.includes('🏳️‍🌈') ||
        taunt.includes('🦄') ||
        lowerTaunt.includes('viado') ||
        lowerTaunt.includes('gay') ||
        lowerTaunt.includes('lgbt');
}
function showTauntOverlay(playerName, taunt, isRainbow) {
    const overlay = $('taunt-overlay');
    const fromEl = $('taunt-from');
    const textEl = $('taunt-text');
    if (!overlay || !fromEl || !textEl)
        return;
    fromEl.textContent = `${playerName} diz:`;
    textEl.textContent = taunt;
    if (isRainbow) {
        textEl.classList.add('rainbow');
    }
    else {
        textEl.classList.remove('rainbow');
    }
    overlay.classList.add('active');
    // Auto-hide after 2 seconds
    setTimeout(() => {
        overlay.classList.remove('active');
    }, 2000);
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
    narrator.setVolume(state.settings.narratorVolume ?? 80);
    // Initialize sound pack
    audioManager.setSoundPack(state.settings.soundPack);
    // Initialize card scanner modal
    setupCardScanner();
    // Agrupa as seções do modal Configurações em abas (Som/Visual/Jogo).
    setupSettingsTabs();
    // Base única: fila de partidas pro servidor, perfis da mesa e auto-update do APK.
    setupSync();
    setupUpdater();
    setupWakeLock();
    onProfilesChange(() => {
        const s = gameState.getState();
        if (!s.gameStarted)
            renderSetup(s);
    });
    void refreshProfiles().then((list) => {
        // Se um perfil mudou de nome/foto no servidor, reflete nos jogadores já escolhidos.
        const s = gameState.getState();
        let changed = false;
        s.players.forEach((p) => {
            if (p.profileId === null)
                return;
            const prof = list.find((x) => x.id === p.profileId);
            if (!prof)
                return;
            if (prof.name !== p.name || (prof.photo_url || null) !== p.avatar) {
                p.name = prof.name;
                p.avatar = prof.photo_url || null;
                changed = true;
            }
        });
        if (changed)
            gameState.updatePlayerSetup(s.players[0].id, {});
    });
    onSyncChange((st) => {
        const el = document.getElementById('sync-status-label');
        if (!el)
            return;
        el.textContent = st.pending > 0 ? `⚠️ ${st.pending} partida(s) aguardando sincronizar` : '';
    });
    // Notificações (nova versão, temporada fechada, ultrapassado, conquistas).
    onNotification((n) => {
        showSpecialMoment(`${n.title}${n.body ? ` — ${n.body}` : ''}`, n.kind === 'overtaken' ? 'danger' : n.kind === 'update' ? 'warning' : 'success');
    });
    setupNotifications();
    // Conquistas novas: cartão na tela + narrador anuncia.
    onNewAchievements((list) => {
        list.forEach((a, i) => {
            window.setTimeout(() => {
                showSpecialMoment(`${a.icon} ${a.profile_name || ''}: ${a.title} — ${a.description}`, 'success');
                narrator.speak(`Conquista desbloqueada: ${a.profile_name || ''}, ${a.title}.`);
            }, i * 2600);
        });
    });
    // Initialize voice control (comando de vida por voz)
    setupVoiceControl({
        randomStarter: () => startRandomStarterAnimation(),
        viado: () => startViadoSelection(),
        undo: () => performUndo(),
        nextTurn: () => { audioManager.play('turn'); gameState.nextTurn(); },
        dice: (d) => { openModal($('dice-roller-modal')); rollDice(d); },
        theme: (t) => {
            gameState.updateSettings({ theme: t });
            applyTheme(t);
        },
        music: (t) => {
            gameState.updateSettings({ ambientMusicTrack: t, ambientMusicEnabled: t !== 'none' });
            ambientMusic.setTrack(t);
            ambientMusic.toggle(t !== 'none');
        },
        ranking: () => openRankingModal(),
        history: () => openRankingModal('history'),
        profiles: () => openProfilesModal(),
        update: () => openUpdateModal(),
        settings: () => openModal($('settings-modal')),
        tools: () => openModal($('tools-modal')),
        fullscreen: () => toggleFullscreen(),
        reset: () => $('reset-game-btn')?.click(),
        revive: (id) => handleRevivePlayer(id),
    });
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
    // Start game button — exige nome + foto (perfil) de cada jogador.
    $('start-game-btn')?.addEventListener('click', () => {
        if (isButtonDebounced('start-game-btn'))
            return;
        const state = gameState.getState();
        const missing = state.players.find((p) => p.profileId === null);
        if (missing) {
            showSpecialMoment('Escolha o perfil (nome + foto) de todos os jogadores antes de começar.', 'warning');
            document.querySelector('.setup-section-players')?.classList.remove('collapsed');
            openProfilePicker(missing.id);
            return;
        }
        const seen = new Set();
        const dup = state.players.find((p) => {
            if (seen.has(p.profileId))
                return true;
            seen.add(p.profileId);
            return false;
        });
        if (dup) {
            showSpecialMoment(`${dup.name} está escolhido duas vezes. Cada jogador precisa do próprio perfil.`, 'warning');
            openProfilePicker(dup.id);
            return;
        }
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
        stopEscandalosa(); // corta o escândalo na hora se ainda estiver rolando
        $('winner-overlay').classList.remove('active');
    });
    $('end-game-winner-btn')?.addEventListener('click', () => {
        stopEscandalosa();
        $('winner-overlay').classList.remove('active');
        finishMatch();
    });
    $('end-game-btn')?.addEventListener('click', () => {
        closeModal($('settings-modal'));
        finishMatch();
    });
    // Modo silencioso (um toque): corta efeitos, música e narrador.
    const toggleSilent = () => {
        const on = !gameState.getState().settings.silentMode;
        gameState.updateSettings({ silentMode: on });
        if (on)
            ambientMusic.toggle(false);
        else if (gameState.getState().settings.ambientMusicEnabled)
            ambientMusic.toggle(true);
        narrator.shutUp();
        showSpecialMoment(on ? '🔇 Modo silencioso ligado' : '🔊 Som de volta', 'warning');
    };
    $('silent-btn')?.addEventListener('click', toggleSilent);
    $('silent-btn-left')?.addEventListener('click', toggleSilent);
    // History panel
    $('history-btn')?.addEventListener('click', () => {
        renderHistory();
        $('history-panel').classList.add('active');
    });
    $('close-history-btn')?.addEventListener('click', () => {
        $('history-panel').classList.remove('active');
    });
    // Botão Ferramentas (menu agrupado) — header e sidebar
    $('tools-btn')?.addEventListener('click', () => openModal($('tools-modal')));
    $('tools-btn-left')?.addEventListener('click', () => openModal($('tools-modal')));
    // Entradas do modal Ferramentas
    $('open-dice')?.addEventListener('click', () => {
        closeModal($('tools-modal'));
        openModal($('dice-roller-modal'));
    });
    $('open-history')?.addEventListener('click', () => {
        closeModal($('tools-modal'));
        renderHistory();
        $('history-panel').classList.add('active');
    });
    $('open-cardscan')?.addEventListener('click', () => {
        closeModal($('tools-modal'));
        openCardScanner();
    });
    $('open-ranking')?.addEventListener('click', () => {
        closeModal($('tools-modal'));
        openRankingModal();
    });
    $('open-profiles')?.addEventListener('click', () => {
        closeModal($('tools-modal'));
        openProfilesModal();
    });
    $('open-update')?.addEventListener('click', () => {
        closeModal($('tools-modal'));
        openUpdateModal();
    });
    $('open-mechanics')?.addEventListener('click', () => {
        closeModal($('tools-modal'));
        openMechanicsModal();
    });
    $('open-ranking-home')?.addEventListener('click', () => openRankingModal());
    $('open-profiles-home')?.addEventListener('click', () => openProfilesModal());
    $('open-update-home')?.addEventListener('click', () => openUpdateModal());
    $('open-fingerpicker')?.addEventListener('click', () => {
        closeModal($('tools-modal'));
        openFingerPicker();
    });
    $('open-randomstarter')?.addEventListener('click', () => {
        if (isButtonDebounced('open-randomstarter'))
            return;
        closeModal($('tools-modal'));
        startRandomStarterAnimation();
    });
    // Voz: o voiceControl liga o toggle no #voice-btn; aqui só fechamos o modal.
    $('voice-btn')?.addEventListener('click', () => closeModal($('tools-modal')));
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
    // Initialize advanced dice roller features
    initDiceRoller();
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
    $('card-scan-btn-left')?.addEventListener('click', () => openCardScanner());
    $('finger-picker-btn-left')?.addEventListener('click', () => openFingerPicker());
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
// Agrupa as seções do modal Configurações em abas (Som / Visual / Jogo).
// Não toca no HTML — classifica cada .settings-group pelo texto do <h3> e
// mostra/esconde via JS. Idempotente.
function setupSettingsTabs() {
    const list = document.querySelector('.settings-modal-content .settings-list');
    if (!list || list.dataset.tabified === '1')
        return;
    list.dataset.tabified = '1';
    const tabFor = (h3text) => {
        const t = h3text.toLowerCase();
        if (/audio|som/.test(t))
            return 'som';
        if (/visual|tema|gif/.test(t))
            return 'visual';
        return 'jogo'; // comandante, layout, timer, sorteio, modo
    };
    const groups = Array.from(list.querySelectorAll('.settings-group'));
    if (groups.length === 0)
        return;
    groups.forEach((g) => {
        const h3 = g.querySelector('h3');
        g.dataset.tab = h3 ? tabFor(h3.textContent || '') : 'jogo';
    });
    // Cria a barra de abas e insere antes do primeiro .settings-group.
    const nav = document.createElement('div');
    nav.className = 'settings-tabs-nav';
    const tabs = [
        ['som', '🔊 Som'],
        ['visual', '🎨 Visual'],
        ['jogo', '🎮 Jogo'],
    ];
    tabs.forEach(([key, label], i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'settings-tab' + (i === 0 ? ' active' : '');
        btn.dataset.tab = key;
        btn.textContent = label;
        nav.appendChild(btn);
    });
    groups[0].parentNode?.insertBefore(nav, groups[0]);
    const setTab = (tab) => {
        nav.querySelectorAll('.settings-tab').forEach((b) => {
            b.classList.toggle('active', b.dataset.tab === tab);
        });
        groups.forEach((g) => {
            g.style.display = g.dataset.tab === tab ? '' : 'none';
        });
    };
    nav.addEventListener('click', (e) => {
        const btn = e.target.closest('.settings-tab');
        if (btn?.dataset.tab)
            setTab(btn.dataset.tab);
    });
    setTab('som');
}
// ===== Ranking / encerramento da partida =====
// Encerramento EXPLÍCITO: salva o resultado (automático se houver vencedor,
// senão pede o pódio) e congela a mesa. Chamado pelo botão "Encerrar partida"
// (overlay de vitória e Configurações) e, como último recurso, antes de
// resetar/nova partida quando ainda não foi encerrada.
function finishMatch(onDone) {
    const state = gameState.getState();
    if (!state.gameStarted || state.matchClosed || state.players.length < 2) {
        onDone?.();
        return;
    }
    if (state.winner) {
        const r = buildAutoResult(state);
        if (r)
            saveResult(r);
        gameState.closeMatch();
        showSpecialMoment('🏁 Partida encerrada e salva no ranking', 'success');
        onDone?.();
        return;
    }
    openPodiumModal(state.players.map((p) => ({ id: p.id, name: p.name, profileId: p.profileId, life: p.life, commanderDeaths: p.commanderDeaths, avatar: p.avatar, color: p.color })), (ordered) => {
        const r = buildManualResult(placementsFromOrder(ordered), state);
        saveResult(r);
        gameState.closeMatch();
        showSpecialMoment('🏁 Partida encerrada e salva no ranking', 'success');
        onDone?.();
    }, () => onDone?.());
}
function updateEndGameButtons(state) {
    const closed = state.matchClosed;
    const btn = document.getElementById('end-game-btn');
    if (btn) {
        btn.textContent = closed ? '🏁 Partida encerrada (salva)' : '🏁 Encerrar partida';
        btn.disabled = closed;
    }
    const wbtn = document.getElementById('end-game-winner-btn');
    if (wbtn)
        wbtn.style.display = closed ? 'none' : '';
    const badge = document.getElementById('match-closed-badge');
    if (badge)
        badge.style.display = closed ? '' : 'none';
}
// Antes de resetar/iniciar nova partida: se a mesa ainda não foi encerrada,
// encerra (salvando) e só então continua.
function maybeAskPodium(state, onContinue) {
    if (!state.gameStarted || state.matchClosed || state.players.length < 2) {
        onContinue();
        return;
    }
    if (state.winner) {
        finishMatch(onContinue);
        return;
    }
    openPodiumModal(state.players.map((p) => ({ id: p.id, name: p.name, profileId: p.profileId, life: p.life, commanderDeaths: p.commanderDeaths, avatar: p.avatar, color: p.color })), (ordered) => {
        const r = buildManualResult(placementsFromOrder(ordered), state);
        saveResult(r);
        gameState.closeMatch();
        onContinue();
    }, () => onContinue());
}
function openPodiumModal(players, onSave, onSkip) {
    const N = players.length;
    let slots = Array(N).fill(null);
    let chips = players.slice();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'podium-modal-dyn';
    modal.innerHTML = `
        <div class="modal-content podium-modal-content">
            <div class="modal-header">
                <h2>🏆 Quem ganhou?</h2>
                <button class="modal-close" type="button">&times;</button>
            </div>
            <div class="podium-body">
                <p class="podium-help">Toque no nome do jogador para colocar no próximo lugar. Toque num lugar preenchido para tirar.</p>
                <div class="podium-slots"></div>
                <div class="podium-section-label">Jogadores</div>
                <div class="podium-chips"></div>
                <div class="podium-actions">
                    <button class="cs-gallery-btn" id="podium-skip" type="button">Pular (não salvar)</button>
                    <button class="primary-btn" id="podium-save" type="button" disabled>Salvar pódio</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const slotsEl = modal.querySelector('.podium-slots');
    const chipsEl = modal.querySelector('.podium-chips');
    const saveBtn = modal.querySelector('#podium-save');
    const close = () => modal.remove();
    const medalFor = (place) => place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : `${place}º`;
    const render = () => {
        slotsEl.innerHTML = slots.map((s, i) => `
            <div class="podium-slot ${s ? 'filled' : ''}" data-idx="${i}">
                <span class="podium-place">${medalFor(i + 1)}</span>
                ${s ? avatarHtml({ name: s.name, photo_url: s.avatar, color: s.color }, 'lc-avatar lc-avatar-sm') : ''}
                <span class="podium-name">${s ? escapeHtml(s.name) : '—'}</span>
            </div>
        `).join('');
        chipsEl.innerHTML = chips.map((c) => `<button class="podium-chip" type="button" data-id="${c.id}">${avatarHtml({ name: c.name, photo_url: c.avatar, color: c.color }, 'lc-avatar lc-avatar-xs')}${escapeHtml(c.name)}</button>`).join('');
        const allFilled = slots.every((s) => s !== null);
        saveBtn.disabled = !allFilled;
    };
    slotsEl.addEventListener('click', (e) => {
        const slot = e.target.closest('.podium-slot');
        if (!slot)
            return;
        const idx = parseInt(slot.dataset.idx || '-1', 10);
        if (idx < 0 || !slots[idx])
            return;
        chips.push(slots[idx]);
        slots[idx] = null;
        render();
    });
    chipsEl.addEventListener('click', (e) => {
        const chip = e.target.closest('.podium-chip');
        if (!chip)
            return;
        const id = chip.dataset.id || '';
        const player = chips.find((c) => c.id === id);
        const firstEmpty = slots.findIndex((s) => s === null);
        if (!player || firstEmpty < 0)
            return;
        slots[firstEmpty] = player;
        chips = chips.filter((c) => c.id !== id);
        render();
    });
    modal.querySelector('.modal-close')?.addEventListener('click', () => { close(); onSkip(); });
    modal.querySelector('#podium-skip')?.addEventListener('click', () => { close(); onSkip(); });
    modal.querySelector('#podium-save')?.addEventListener('click', () => {
        const ordered = slots.filter((s) => s !== null);
        close();
        onSave(ordered);
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            close();
            onSkip();
        }
    });
    render();
}
function fmtDuration(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    if (h > 0)
        return `${h}h${String(m).padStart(2, '0')}`;
    return `${m} min`;
}
function fmtDateTime(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime()))
        return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' +
        d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
// Ranking (servidor) + histórico completo de partidas da mesa.
function openRankingModal(initialTab = 'today') {
    let tab = initialTab;
    let historyProfile = null;
    let historyPeriod = '';
    let seasonCfg = null;
    document.getElementById('ranking-modal-dyn')?.remove();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'ranking-modal-dyn';
    modal.innerHTML = `
        <div class="modal-content ranking-modal-content">
            <div class="modal-header">
                <h2>🏆 Ranking da mesa</h2>
                <button class="header-btn ranking-cfg-btn" id="ranking-cfg" type="button" title="Temporada e desempate">⚙️</button>
                <button class="modal-close" type="button">&times;</button>
            </div>
            <div class="ranking-body">
                <div class="ranking-tabs">
                    <button class="ranking-tab" data-p="today">Hoje</button>
                    <button class="ranking-tab" data-p="month">Mês</button>
                    <button class="ranking-tab" data-p="season">Temporada</button>
                    <button class="ranking-tab" data-p="year">Ano</button>
                    <button class="ranking-tab" data-p="all">Geral</button>
                    <button class="ranking-tab" data-p="history">Histórico</button>
                </div>
                <div class="ranking-source" id="ranking-source"></div>
                <div class="history-filters" id="history-filters" style="display:none">
                    <select id="history-filter-profile" class="history-select"><option value="">Todos os jogadores</option></select>
                    <select id="history-filter-period" class="history-select">
                        <option value="">Todo o período</option>
                        <option value="today">Hoje</option>
                        <option value="month">Este mês</option>
                        <option value="season">Temporada</option>
                        <option value="year">Este ano</option>
                    </select>
                </div>
                <div class="ranking-table" id="ranking-table"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const tableEl = modal.querySelector('#ranking-table');
    const sourceEl = modal.querySelector('#ranking-source');
    const filtersEl = modal.querySelector('#history-filters');
    const close = () => modal.remove();
    const medalFor = (place) => place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : `${place}º`;
    let renderToken = 0;
    const profSel = modal.querySelector('#history-filter-profile');
    getProfiles().forEach((p) => {
        const o = document.createElement('option');
        o.value = String(p.id);
        o.textContent = p.name;
        profSel.appendChild(o);
    });
    const setSource = (remote, extra = '') => {
        const st = getSyncStatus();
        const pending = st.pending > 0 ? ` · ⚠️ ${st.pending} partida(s) ainda não enviada(s)` : '';
        sourceEl.innerHTML = remote
            ? `☁️ Base única (servidor)${extra}${pending}`
            : `📴 Sem conexão — mostrando só o que está neste aparelho${pending}`;
    };
    const renderRanking = async () => {
        const token = ++renderToken;
        tableEl.innerHTML = '<div class="ranking-empty">Carregando…</div>';
        const { rows, remote, totalMatches, label, tiebreak } = await aggregateRemote(tab);
        if (token !== renderToken)
            return;
        const tb = tiebreak === 'wins' ? ' · desempate: vitórias' : '';
        setSource(remote, `${label ? ` · ${label}` : ''} · ${totalMatches} partida(s)${tb}`);
        if (rows.length === 0) {
            tableEl.innerHTML = '<div class="ranking-empty">Nenhuma partida registrada neste período.</div>';
            return;
        }
        const head = `<div class="ranking-row ranking-head"><span></span><span>Jogador</span><span>Pts</span><span>V</span><span>P</span></div>`;
        const body = rows.map((r, i) => {
            const prof = getProfileById(r.profileId ?? null);
            const photo = r.photoUrl ?? prof?.photo_url ?? null;
            return `
            <div class="ranking-row ${i === 0 ? 'ranking-leader' : ''} ${r.profileId ? 'ranking-clickable' : ''}" data-profile="${r.profileId ?? ''}">
                <span class="ranking-place">${medalFor(i + 1)}</span>
                <span class="ranking-name">${avatarHtml({ name: r.name, photo_url: photo, color: prof?.color }, 'lc-avatar lc-avatar-sm')}<span>${escapeHtml(r.name)}</span></span>
                <span class="ranking-pts">${r.points}</span>
                <span class="ranking-wins">${r.wins}</span>
                <span class="ranking-matches">${r.matches}</span>
            </div>`;
        }).join('');
        tableEl.innerHTML = head + body + '<div class="ranking-hint">Toque num jogador para ver o perfil completo.</div>';
    };
    const renderHistory = async () => {
        const token = ++renderToken;
        tableEl.innerHTML = '<div class="ranking-empty">Carregando…</div>';
        const { results, count, remote } = await listMatchesRemote({ limit: 80, profile: historyProfile || undefined, period: historyPeriod || undefined });
        if (token !== renderToken)
            return;
        setSource(remote, ` · ${count} partida(s)`);
        if (results.length === 0) {
            tableEl.innerHTML = '<div class="ranking-empty">Nenhuma partida registrada com esse filtro.</div>';
            return;
        }
        tableEl.innerHTML = results.map((m) => {
            const podium = m.placements.slice().sort((a, b) => a.place - b.place);
            const winner = podium[0];
            const winnerProf = getProfileById(winner?.profile_id ?? null);
            const others = podium.slice(1).map((p) => {
                const prof = getProfileById(p.profile_id ?? null);
                return `<span class="history-other" title="${p.place}º">${avatarHtml({ name: p.name, photo_url: p.photo_url ?? prof?.photo_url ?? null, color: prof?.color }, 'lc-avatar lc-avatar-xs')}<span>${p.place}º ${escapeHtml(p.name)}</span></span>`;
            }).join('');
            return `
            <div class="history-match ${m.id > 0 ? 'history-clickable' : ''}" data-id="${m.id}" data-client="${escapeHtml(m.client_id)}">
                <div class="history-head">
                    <span class="history-date">${fmtDateTime(m.ended_at)}</span>
                    <span class="history-meta">${m.player_count} jog. · ${fmtDuration(m.duration_ms)}${m.manual ? ' · pódio manual' : ''}${m.source === 'android' ? ' · 📱' : m.source === 'web' ? ' · 🌐' : ''}</span>
                    ${remote ? '<button type="button" class="history-del" title="Apagar partida">🗑️</button>' : ''}
                </div>
                <div class="history-winner">
                    ${winner ? avatarHtml({ name: winner.name, photo_url: winner.photo_url ?? winnerProf?.photo_url ?? null, color: winnerProf?.color }, 'lc-avatar lc-avatar-sm') : ''}
                    <span>🥇 <strong>${escapeHtml(winner?.name || '?')}</strong></span>
                </div>
                <div class="history-others">${others}</div>
            </div>`;
        }).join('');
    };
    const render = () => {
        modal.querySelectorAll('.ranking-tab').forEach((b) => b.classList.toggle('active', b.dataset.p === tab));
        filtersEl.style.display = tab === 'history' ? '' : 'none';
        if (tab === 'history')
            void renderHistory();
        else
            void renderRanking();
    };
    tableEl.addEventListener('click', async (e) => {
        const target = e.target;
        const del = target.closest('.history-del');
        if (del) {
            e.stopPropagation();
            const row = del.closest('.history-match');
            if (!await confirmDialog('Apagar esta partida do histórico de TODO MUNDO? Não dá pra desfazer.', { title: 'Apagar partida', okText: 'Apagar', danger: true }))
                return;
            try {
                await deleteMatchRemote(Number(row.dataset.id), row.dataset.client);
                row.remove();
            }
            catch (err) {
                showSpecialMoment(`Não deu pra apagar: ${err?.message || err}`, 'danger');
            }
            return;
        }
        const rrow = target.closest('.ranking-clickable');
        if (rrow && rrow.dataset.profile) {
            openProfilePage(Number(rrow.dataset.profile));
            return;
        }
        const mrow = target.closest('.history-clickable');
        if (mrow)
            openMatchDetail(Number(mrow.dataset.id));
    });
    modal.querySelector('.ranking-tabs')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.ranking-tab');
        if (!btn?.dataset.p)
            return;
        tab = btn.dataset.p;
        render();
    });
    profSel.addEventListener('change', () => { historyProfile = profSel.value ? Number(profSel.value) : null; void renderHistory(); });
    modal.querySelector('#history-filter-period').addEventListener('change', (e) => {
        historyPeriod = e.target.value;
        void renderHistory();
    });
    modal.querySelector('#ranking-cfg')?.addEventListener('click', () => openSeasonSettings(seasonCfg, (cfg) => { seasonCfg = cfg; render(); }));
    modal.querySelector('.modal-close')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal)
        close(); });
    void apiGetSeasonSettings().then((cfg) => { seasonCfg = cfg; }).catch(() => { });
    void flushSyncQueue().finally(render);
}
// Configuração de temporada (duração, âncora) e desempate — vale pra todo mundo.
function openSeasonSettings(current, onSaved) {
    document.getElementById('season-cfg-dyn')?.remove();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'season-cfg-dyn';
    modal.style.zIndex = '2100';
    const months = current?.season_months ?? 1;
    const tiebreak = current?.tiebreak ?? 'points';
    const start = current?.season_start ?? '2026-01-01';
    modal.innerHTML = `
        <div class="modal-content lc-dialog-content">
            <div class="lc-dialog-title">⚙️ Temporada e desempate</div>
            <div class="season-form">
                <label>Duração da temporada
                    <select id="season-months">
                        ${[1, 2, 3, 4, 6, 12].map(m => `<option value="${m}" ${m === months ? 'selected' : ''}>${m === 1 ? '1 mês' : m === 12 ? '1 ano' : `${m} meses`}</option>`).join('')}
                    </select>
                </label>
                <label>Início da contagem (âncora)
                    <input type="date" id="season-start" value="${escapeHtml(start)}">
                </label>
                <label>Desempate
                    <select id="season-tiebreak">
                        <option value="points" ${tiebreak === 'points' ? 'selected' : ''}>Pontos, depois vitórias</option>
                        <option value="wins" ${tiebreak === 'wins' ? 'selected' : ''}>Vitórias, depois pontos</option>
                    </select>
                </label>
                <div class="update-muted">${current ? `Temporada atual: ${escapeHtml(current.current_season.label)} (${current.current_season.start} → ${current.current_season.end})` : 'Sem conexão: não dá pra alterar agora.'}</div>
                <div class="lc-dialog-actions">
                    <button type="button" class="cs-gallery-btn" id="season-cancel">Cancelar</button>
                    <button type="button" class="primary-btn" id="season-save" ${current ? '' : 'disabled'}>Salvar</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('#season-cancel')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal)
        close(); });
    modal.querySelector('#season-save')?.addEventListener('click', async () => {
        const btn = modal.querySelector('#season-save');
        btn.disabled = true;
        try {
            const cfg = await apiSetSeasonSettings({
                season_months: Number(modal.querySelector('#season-months').value),
                season_start: modal.querySelector('#season-start').value,
                tiebreak: modal.querySelector('#season-tiebreak').value,
            });
            close();
            onSaved(cfg);
            showSpecialMoment(`Temporada: ${cfg.current_season.label}`, 'success');
        }
        catch (e) {
            btn.disabled = false;
            showSpecialMoment(`Não deu pra salvar: ${e?.message || e}`, 'danger');
        }
    });
}
// Página de perfil: foto grande, números, sequências, nêmesis, conquistas, últimas partidas.
function openProfilePage(profileId) {
    document.getElementById('profile-page-dyn')?.remove();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'profile-page-dyn';
    modal.style.zIndex = '2050';
    const cached = getProfileById(profileId);
    modal.innerHTML = `
        <div class="modal-content profile-page-content">
            <div class="modal-header">
                <h2>👤 ${escapeHtml(cached?.name || 'Perfil')}</h2>
                <button class="modal-close" type="button">&times;</button>
            </div>
            <div class="profile-page-body" id="profile-page-body"><div class="ranking-empty">Carregando…</div></div>
        </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal)
        close(); });
    const body = modal.querySelector('#profile-page-body');
    const medalFor = (place) => place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : `${place}º`;
    apiProfileStats(profileId).then((s) => {
        const p = s.profile;
        const stat = (label, value) => `<div class="pp-stat"><div class="pp-stat-value">${value}</div><div class="pp-stat-label">${label}</div></div>`;
        body.innerHTML = `
            <div class="pp-hero">
                ${avatarHtml({ name: p.name, photo_url: p.photo_url, color: p.color }, 'lc-avatar pp-avatar')}
                <div class="pp-hero-info">
                    <div class="pp-name">${escapeHtml(p.name)}</div>
                    <div class="pp-ranks">${s.rank_season ? `${medalFor(s.rank_season)} na temporada` : 'sem partidas na temporada'} · ${s.rank_all ? `${medalFor(s.rank_all)} geral` : ''}</div>
                    ${p.aliases?.length ? `<div class="pp-aliases">🎙️ ${p.aliases.map(escapeHtml).join(' · ')}</div>` : ''}
                </div>
            </div>
            <div class="pp-stats">
                ${stat('pontos', s.points)}${stat('partidas', s.matches)}${stat('vitórias', s.wins)}${stat('% vitórias', `${s.win_rate}%`)}
                ${stat('pódios', s.podiums)}${stat('lanternas', s.last_places)}${stat('colocação média', s.avg_place ?? '—')}${stat('duração média', fmtDuration(s.avg_duration_ms))}
                ${stat('sequência atual', `${s.current_streak}🔥`)}${stat('melhor sequência', s.best_streak)}
            </div>
            ${s.nemesis.length || s.victims.length ? `
            <div class="pp-section">
                ${s.nemesis.length ? `<div class="podium-section-label">Nêmesis (quem mais te venceu)</div><div class="pp-list">${s.nemesis.map(n => `<span class="pp-chip">${escapeHtml(n.name)} <b>${n.times}×</b></span>`).join('')}</div>` : ''}
                ${s.victims.length ? `<div class="podium-section-label">Vítimas (quem você mais eliminou)</div><div class="pp-list">${s.victims.map(n => `<span class="pp-chip">${escapeHtml(n.name)} <b>${n.times}×</b></span>`).join('')}</div>` : ''}
            </div>` : ''}
            <div class="pp-section">
                <div class="podium-section-label">Conquistas (${s.achievements.length})</div>
                ${s.achievements.length ? `<div class="pp-ach">${s.achievements.map(a => `<div class="pp-ach-item" title="${escapeHtml(a.description)}"><span class="pp-ach-icon">${a.icon}</span><span class="pp-ach-title">${escapeHtml(a.title)}</span><span class="pp-ach-date">${fmtDateTime(a.earned_at).slice(0, 8)}</span></div>`).join('')}</div>` : '<div class="update-muted">Nenhuma ainda. Jogue (e vença) pra desbloquear.</div>'}
            </div>
            <div class="pp-section">
                <div class="podium-section-label">Últimas partidas</div>
                ${s.recent.length ? s.recent.map(r => `<div class="pp-recent" data-id="${r.match_id}"><span>${medalFor(r.place)}</span><span class="pp-recent-date">${fmtDateTime(r.ended_at)}</span><span class="update-muted">${r.players} jog. · ${r.points} pts</span></div>`).join('') : '<div class="update-muted">Sem partidas.</div>'}
            </div>
        `;
        body.querySelectorAll('.pp-recent').forEach((el) => el.addEventListener('click', () => openMatchDetail(Number(el.dataset.id))));
    }).catch((e) => {
        body.innerHTML = `<div class="ranking-empty">Sem conexão com o servidor (${escapeHtml(String(e?.message || e))}).</div>`;
    });
}
// Detalhe de uma partida: pódio com vida final, quem eliminou quem, e o log completo.
function openMatchDetail(matchId) {
    if (!matchId || matchId < 0)
        return;
    document.getElementById('match-detail-dyn')?.remove();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'match-detail-dyn';
    modal.style.zIndex = '2060';
    modal.innerHTML = `
        <div class="modal-content profile-page-content">
            <div class="modal-header">
                <h2>🕐 Partida</h2>
                <button class="modal-close" type="button">&times;</button>
            </div>
            <div class="profile-page-body" id="match-detail-body"><div class="ranking-empty">Carregando…</div></div>
        </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal)
        close(); });
    const body = modal.querySelector('#match-detail-body');
    const medalFor = (place) => place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : `${place}º`;
    apiGetMatch(matchId).then((m) => {
        const podium = m.placements.slice().sort((a, b) => a.place - b.place);
        const events = (m.events || []);
        const nameOf = (id) => events.find(e => e.playerId === id)?.playerName || 'Jogador';
        let lastTurn = -1;
        const log = events.map((ev) => {
            const sep = ev.turn !== undefined && ev.turn !== lastTurn ? `<div class="history-turn-sep">Turno ${ev.turn}</div>` : '';
            lastTurn = ev.turn ?? lastTurn;
            return `${sep}<div class="md-event md-${ev.type}">${escapeHtml(describeEvent(ev, nameOf))}</div>`;
        }).join('');
        body.innerHTML = `
            <div class="md-head">${fmtDateTime(m.ended_at)} · ${m.player_count} jogadores · ${fmtDuration(m.duration_ms)} · vida inicial ${m.starting_life}${m.manual ? ' · pódio manual' : ''}</div>
            <div class="md-podium">
                ${podium.map(p => {
            const prof = getProfileById(p.profile_id ?? null);
            return `<div class="md-place">
                        <span class="md-medal">${medalFor(p.place)}</span>
                        ${avatarHtml({ name: p.name, photo_url: p.photo_url ?? prof?.photo_url ?? null, color: prof?.color }, 'lc-avatar lc-avatar-sm')}
                        <span class="md-name">${escapeHtml(p.name)}</span>
                        <span class="update-muted">${p.points} pts${p.final_life !== null && p.final_life !== undefined ? ` · ${p.final_life} vida` : ''}${p.eliminated_by ? ` · ☠️ por ${escapeHtml(p.eliminated_by)}` : ''}${p.commander_deaths ? ` · ⚰️ ${p.commander_deaths}` : ''}</span>
                    </div>`;
        }).join('')}
            </div>
            <div class="podium-section-label">Log da partida (${events.length} eventos)</div>
            <div class="md-log">${log || '<div class="update-muted">Sem log (partida salva por uma versão antiga).</div>'}</div>
        `;
    }).catch((e) => {
        body.innerHTML = `<div class="ranking-empty">Sem conexão com o servidor (${escapeHtml(String(e?.message || e))}).</div>`;
    });
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
    $('escandalosa-enabled')?.addEventListener('change', (e) => {
        const on = e.target.checked;
        if (!on)
            stopEscandalosa();
        gameState.updateSettings({ escandalosaEnabled: on });
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
    $('narrator-persona')?.addEventListener('change', (e) => {
        const persona = e.target.value;
        gameState.updateSettings({ narratorPersona: persona });
    });
    $('narrator-speed')?.addEventListener('change', (e) => {
        const speed = parseFloat(e.target.value);
        gameState.updateSettings({ narratorSpeed: speed });
        narrator.setSpeed(speed);
    });
    $('narrator-volume-slider')?.addEventListener('input', (e) => {
        const v = parseInt(e.target.value);
        gameState.updateSettings({ narratorVolume: v });
        narrator.setVolume(v);
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
    // Sortear Viado button
    $('sortear-viado-btn')?.addEventListener('click', () => {
        closeModal($('settings-modal'));
        startViadoSelection();
    });
    // Viado overlay buttons
    $('viado-again-btn')?.addEventListener('click', () => {
        startViadoSelection();
    });
    $('viado-close-btn')?.addEventListener('click', () => {
        closeViadoOverlay();
    });
    // Reset and new game buttons (encerram/salvam a partida atual antes, se ainda não foi)
    $('reset-game-btn')?.addEventListener('click', async () => {
        const state = gameState.getState();
        const hasCommanderDeaths = state.players.some(p => p.commanderDeaths > 0);
        const res = await confirmDialogFull('Resetar a partida? A mesa volta pra vida inicial com os mesmos jogadores.', {
            title: 'Resetar partida',
            okText: 'Resetar',
            danger: true,
            checkbox: hasCommanderDeaths ? { label: 'Zerar também as mortes do comandante (tax)' } : undefined,
        });
        if (!res.ok)
            return;
        maybeAskPodium(gameState.getState(), () => {
            gameState.resetGame(res.checkbox);
            hideShareButtons();
            clearAllDamageShadows();
            closeAllModals();
        });
    });
    $('new-game-btn')?.addEventListener('click', async () => {
        if (!await confirmDialog('Iniciar uma nova partida? Você volta pra tela de configuração.', { title: 'Nova partida', okText: 'Nova partida' }))
            return;
        maybeAskPodium(gameState.getState(), () => {
            gameState.newGame();
            hideShareButtons();
            clearAllDamageShadows();
            closeAllModals();
        });
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
    eliminatedPlayersShown.clear(); // Reset eliminated tracking
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
    // Trocar o perfil do jogador (funciona também no meio da partida).
    $('change-profile-btn')?.addEventListener('click', () => {
        const id = currentEditingPlayerId;
        if (!id)
            return;
        closeModal($('player-settings-modal'));
        currentEditingPlayerId = null;
        openProfilePicker(id);
    });
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
            case 'custom_counter': return '🔢';
            case 'commander_death': return '⚰️';
            case 'player_eliminated': return '💀';
            case 'revive': return '😇';
            case 'player_win': return '🏆';
            case 'game_end': return '🏁';
            case 'turn_change': return '▶️';
            case 'monarch_change': return '👑';
            case 'monarch_removed': return '👑';
            case 'undo': return '↩️';
            case 'random_starter': return '🎲';
            case 'day_night': return '🌗';
            case 'plane': return '🪐';
            case 'scheme': return '😈';
            default: return '📝';
        }
    };
    let lastTurn = -1;
    historyList.innerHTML = state.history.map(event => {
        const turnSep = event.turn !== undefined && event.turn !== lastTurn
            ? `<div class="history-turn-sep">Turno ${event.turn}</div>` : '';
        lastTurn = event.turn ?? lastTurn;
        return `${turnSep}
        <div class="history-item history-${event.type}" style="--player-color: ${getPlayerColor(event.playerId)}">
            <span class="history-icon">${getEventIcon(event.type)}</span>
            <span class="history-text">${escapeHtml(describeEvent(event, getPlayerName))}</span>
            <span class="history-time">${formatTime(event.timestamp)}</span>
        </div>`;
    }).join('');
}
// Descrição legível de um evento do log (usada no painel e no detalhe da partida).
export function describeEvent(event, nameOf) {
    const playerName = event.playerName || nameOf(event.playerId);
    const d = event.details || {};
    const from = d.fromPlayerName || (d.fromPlayerId ? nameOf(d.fromPlayerId) : '');
    const srcTxt = { voice: ' 🎙️', hold: '', tap: '', shortcut: '', modal: ' ✏️', commander: '', auto: '' };
    const src = d.source ? (srcTxt[d.source] || '') : '';
    const counterNames = {
        poison: 'veneno', experience: 'experiência', energy: 'energia', storm: 'storm', commanderDeaths: 'mortes do comandante',
    };
    switch (event.type) {
        case 'life_change': {
            const amount = d.amount || 0;
            const who = from ? ` (de ${from})` : '';
            return `${playerName}: ${amount > 0 ? '+' : ''}${amount} vida${who} · ${d.previousValue} → ${d.newValue}${src}`;
        }
        case 'commander_damage': {
            const amount = d.amount || 0;
            return `${playerName} ${amount > 0 ? 'recebeu' : 'removeu'} ${Math.abs(amount)} de comandante de ${from} · total ${d.newValue}`;
        }
        case 'counter_change': {
            const amount = d.amount || 0;
            return `${playerName}: ${amount > 0 ? '+' : ''}${amount} ${counterNames[d.counterType || ''] || d.counterType} · ${d.newValue}`;
        }
        case 'custom_counter': {
            const amount = d.amount || 0;
            return `${playerName}: ${amount > 0 ? '+' : ''}${amount} ${d.counterName || 'contador'} · ${d.newValue}`;
        }
        case 'commander_death': {
            const amount = d.amount || 0;
            return `Comandante de ${playerName} ${amount > 0 ? 'morreu' : 'voltou'} · ${d.newValue} morte(s), tax +${(d.newValue || 0) * 2}`;
        }
        case 'player_eliminated': {
            const how = { life: 'vida zerada', commander: 'dano de comandante', poison: 'veneno' };
            const reason = how[d.message || ''] || d.message || '';
            return `${playerName} foi eliminado${from ? ` por ${from}` : ''}${reason ? ` (${reason})` : ''}`;
        }
        case 'revive': return `${playerName} voltou ao jogo`;
        case 'player_win': return `${playerName} venceu a partida!${d.message ? ` ${d.message}` : ''}`;
        case 'game_end': return 'Partida encerrada e salva no ranking';
        case 'turn_change': return `Turno ${d.newValue} — vez de ${playerName}`;
        case 'monarch_change': return `${playerName} virou o Monarca`;
        case 'monarch_removed': return `${playerName} deixou de ser Monarca`;
        case 'undo': return `Desfeito: ${d.message}`;
        case 'random_starter': return `${playerName} foi sorteado para começar`;
        case 'day_night': return `${d.message}`;
        case 'plane': return `Planechase: ${d.message}`;
        case 'scheme': return `Archenemy: ${d.message}`;
        default: return `${playerName}: ${event.type}`;
    }
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
    vcSetGameActive(false);
    releaseWakeLock();
    // Update player count button
    document.querySelectorAll('.count-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.getAttribute('data-count') || '0') === state.settings.playerCount);
    });
    // Render layout presets
    renderLayoutPresets();
    // Update player setup list — cada jogador escolhe um PERFIL (nome + foto).
    const playerList = $('player-setup-list');
    playerList.innerHTML = state.players.map((player, index) => {
        const prof = getProfileById(player.profileId);
        const hasProfile = !!prof || (player.profileId !== null && !!player.avatar);
        const avatar = hasProfile
            ? avatarHtml({ name: player.name, photo_url: prof?.photo_url ?? player.avatar, color: player.color }, 'lc-avatar player-setup-avatar')
            : `<span class="lc-avatar player-setup-avatar player-setup-avatar-empty">+</span>`;
        return `
        <div class="player-setup-item ${hasProfile ? 'has-profile' : 'no-profile'}" data-player-id="${player.id}">
            <button type="button" class="player-profile-btn" data-action="pick-profile" title="Escolher perfil">
                ${avatar}
            </button>
            <div class="player-setup-main">
                <button type="button" class="player-setup-name" data-action="pick-profile">
                    ${hasProfile ? escapeHtml(player.name) : `<span class="player-setup-placeholder">Jogador ${index + 1} — escolher perfil</span>`}
                </button>
                ${player.tag ? `<span class="player-setup-tag">${escapeHtml(player.tag)}</span>` : ''}
            </div>
            <div class="player-color-dot"
                 style="background: ${player.color}"
                 data-action="edit-player"
                 title="Cor, emoji e fundo">
                ${player.emoji || ''}
            </div>
        </div>
    `;
    }).join('');
    playerList.querySelectorAll('[data-action="pick-profile"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.target.closest('.player-setup-item');
            openProfilePicker(item.dataset.playerId);
        });
    });
    playerList.querySelectorAll('.player-color-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
            const item = e.target.closest('.player-setup-item');
            const playerId = item.dataset.playerId;
            openPlayerSettings(playerId);
        });
    });
    const startBtn = $('start-game-btn');
    if (startBtn) {
        const ready = state.players.every((p) => p.profileId !== null);
        startBtn.classList.toggle('start-btn-waiting', !ready);
        startBtn.textContent = ready ? 'Iniciar Partida' : 'Escolha os perfis para iniciar';
    }
}
// ===== Perfis da mesa (nome + foto) =====
// Modal pra escolher o perfil de um jogador da mesa (ou criar um novo).
function openProfilePicker(playerId) {
    const state = gameState.getState();
    const player = state.players.find((p) => p.id === playerId);
    if (!player)
        return;
    const takenBy = new Map();
    state.players.forEach((p) => { if (p.id !== playerId && p.profileId !== null)
        takenBy.set(p.profileId, p.name); });
    document.getElementById('profile-picker-dyn')?.remove();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'profile-picker-dyn';
    modal.innerHTML = `
        <div class="modal-content profile-picker-content">
            <div class="modal-header">
                <h2>👤 Quem é o ${escapeHtml(player.profileId !== null ? player.name : 'jogador')}?</h2>
                <button class="modal-close" type="button">&times;</button>
            </div>
            <div class="profile-picker-body">
                <div class="profile-grid" id="profile-grid"></div>
                <div class="profile-new-form" id="profile-new-form" style="display:none">
                    <div class="podium-section-label">Novo perfil</div>
                    <div class="profile-new-row">
                        <label class="profile-new-photo" id="profile-new-photo-label" title="Tirar/escolher foto">
                            <input type="file" id="profile-new-photo" accept="image/*" capture="user" hidden>
                            <span class="lc-avatar profile-new-avatar lc-avatar-initials" id="profile-new-avatar">📷</span>
                            <span class="profile-new-photo-hint">foto</span>
                        </label>
                        <input type="text" id="profile-new-name" class="profile-new-name" maxlength="40" placeholder="Nome" autocomplete="off">
                    </div>
                    <div class="profile-new-error" id="profile-new-error"></div>
                    <div class="podium-actions">
                        <button class="cs-gallery-btn" id="profile-new-cancel" type="button">Voltar</button>
                        <button class="primary-btn" id="profile-new-save" type="button">Salvar e usar</button>
                    </div>
                </div>
                <div class="profile-picker-footer">
                    <button class="cs-gallery-btn" id="profile-unset" type="button" ${player.profileId === null ? 'disabled' : ''}>Tirar perfil deste jogador</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal)
        close(); });
    const grid = modal.querySelector('#profile-grid');
    const form = modal.querySelector('#profile-new-form');
    const renderGrid = () => {
        const list = getProfiles().filter((p) => p.active !== false);
        const cards = list.map((p) => {
            const taken = takenBy.get(p.id);
            const selected = player.profileId === p.id;
            return `
                <button type="button" class="profile-card ${selected ? 'selected' : ''} ${taken ? 'taken' : ''}" data-id="${p.id}" ${taken ? 'disabled' : ''}>
                    ${avatarHtml(p, 'lc-avatar profile-card-avatar')}
                    <span class="profile-card-name">${escapeHtml(p.name)}</span>
                    ${taken ? '<span class="profile-card-taken">já na mesa</span>' : ''}
                </button>`;
        }).join('');
        grid.innerHTML = cards + `
            <button type="button" class="profile-card profile-card-new" data-new="1">
                <span class="lc-avatar profile-card-avatar lc-avatar-initials">➕</span>
                <span class="profile-card-name">Novo perfil</span>
            </button>`;
        if (list.length === 0) {
            grid.insertAdjacentHTML('afterbegin', '<div class="ranking-empty">Sem perfis ainda (sem conexão com o servidor?). Crie um novo.</div>');
        }
    };
    const choose = (p) => {
        gameState.updatePlayerSetup(playerId, {
            profileId: p.id,
            name: p.name,
            avatar: p.photo_url || null,
            emoji: null,
            ...(p.color ? { color: p.color } : {}),
        });
        close();
    };
    grid.addEventListener('click', (e) => {
        const card = e.target.closest('.profile-card');
        if (!card)
            return;
        if (card.dataset.new) {
            grid.style.display = 'none';
            form.style.display = '';
            modal.querySelector('#profile-new-name').focus();
            return;
        }
        const id = Number(card.dataset.id);
        const p = getProfileById(id);
        if (p)
            choose(p);
    });
    // --- novo perfil ---
    let newPhoto = null;
    const photoInput = modal.querySelector('#profile-new-photo');
    const avatarEl = modal.querySelector('#profile-new-avatar');
    const errEl = modal.querySelector('#profile-new-error');
    photoInput.addEventListener('change', () => {
        newPhoto = photoInput.files?.[0] || null;
        if (newPhoto) {
            const url = URL.createObjectURL(newPhoto);
            avatarEl.outerHTML = `<img class="lc-avatar profile-new-avatar" id="profile-new-avatar" src="${url}" alt="">`;
        }
    });
    modal.querySelector('#profile-new-cancel')?.addEventListener('click', () => {
        form.style.display = 'none';
        grid.style.display = '';
    });
    modal.querySelector('#profile-new-save')?.addEventListener('click', async () => {
        const nameInput = modal.querySelector('#profile-new-name');
        const name = nameInput.value.trim();
        errEl.textContent = '';
        if (!name) {
            errEl.textContent = 'Digite o nome.';
            return;
        }
        if (!newPhoto) {
            errEl.textContent = 'Escolha uma foto (toque no círculo).';
            return;
        }
        const saveBtn = modal.querySelector('#profile-new-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando…';
        try {
            const created = await createProfile(name, newPhoto, player.color);
            choose(created);
        }
        catch (e) {
            errEl.textContent = `Não deu pra salvar no servidor: ${e?.message || e}`;
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar e usar';
        }
    });
    modal.querySelector('#profile-unset')?.addEventListener('click', () => {
        const idx = state.players.findIndex((p) => p.id === playerId);
        gameState.updatePlayerSetup(playerId, { profileId: null, avatar: null, name: `Jogador ${idx + 1}` });
        close();
    });
    renderGrid();
    void refreshProfiles().then(renderGrid);
}
// Gerenciar perfis: editar nome/foto, remover.
function openProfilesModal() {
    document.getElementById('profiles-modal-dyn')?.remove();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'profiles-modal-dyn';
    modal.innerHTML = `
        <div class="modal-content profile-picker-content">
            <div class="modal-header">
                <h2>👥 Perfis da mesa</h2>
                <button class="modal-close" type="button">&times;</button>
            </div>
            <div class="profile-picker-body">
                <p class="podium-help">Toque na foto para trocar. Nome e apelidos (comando de voz) podem ser editados direto. Perfis pré-setados não podem ser removidos.</p>
                <label class="my-profile-row">Eu neste aparelho (notificações):
                    <select id="my-profile-select"><option value="">— ninguém —</option></select>
                </label>
                <div class="profiles-manage" id="profiles-manage"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal)
        close(); });
    const listEl = modal.querySelector('#profiles-manage');
    const mySel = modal.querySelector('#my-profile-select');
    mySel.addEventListener('change', () => {
        setMyProfileId(mySel.value ? Number(mySel.value) : null);
        showSpecialMoment(mySel.value ? 'Você vai receber avisos de ranking e conquistas deste perfil.' : 'Avisos pessoais desligados.', 'success');
    });
    const render = () => {
        const list = getProfiles().filter((p) => p.active !== false);
        const my = getMyProfileId();
        mySel.innerHTML = '<option value="">— ninguém —</option>' + list.map((p) => `<option value="${p.id}" ${p.id === my ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('');
        if (list.length === 0) {
            listEl.innerHTML = '<div class="ranking-empty">Nenhum perfil (sem conexão com o servidor?).</div>';
            return;
        }
        listEl.innerHTML = list.map((p) => `
            <div class="profile-manage-row" data-id="${p.id}">
                <label class="profile-manage-photo" title="Trocar foto">
                    <input type="file" accept="image/*" capture="user" hidden data-role="photo">
                    ${avatarHtml(p, 'lc-avatar profile-manage-avatar')}
                </label>
                <div class="profile-manage-fields">
                    <input type="text" class="profile-manage-name" value="${escapeHtml(p.name)}" maxlength="40" data-role="name">
                    <input type="text" class="profile-manage-aliases" value="${escapeHtml((p.aliases || []).join(', '))}" maxlength="200" placeholder="apelidos p/ voz: Zezinho, Zeca" data-role="aliases">
                </div>
                <button type="button" class="profile-manage-stats" data-role="stats" title="Perfil completo">📊</button>
                ${p.is_preset ? '<span class="profile-manage-preset">fixo</span>' : '<button type="button" class="profile-manage-del" data-role="del" title="Remover">🗑️</button>'}
            </div>
        `).join('');
    };
    listEl.addEventListener('change', async (e) => {
        const target = e.target;
        const row = target.closest('.profile-manage-row');
        if (!row)
            return;
        const id = Number(row.dataset.id);
        try {
            if (target.dataset.role === 'photo' && target.files?.[0]) {
                row.classList.add('busy');
                await updateProfile(id, { photo: target.files[0] });
            }
            else if (target.dataset.role === 'name') {
                const name = target.value.trim();
                if (!name) {
                    render();
                    return;
                }
                row.classList.add('busy');
                await updateProfile(id, { name });
            }
            else if (target.dataset.role === 'aliases') {
                row.classList.add('busy');
                await updateProfile(id, { aliases: target.value.split(',').map(s => s.trim()).filter(Boolean) });
            }
            render();
        }
        catch (err) {
            row.classList.remove('busy');
            showSpecialMoment(`Não deu pra salvar: ${err?.message || err}`, 'danger');
        }
    });
    listEl.addEventListener('click', async (e) => {
        const statsBtn = e.target.closest('[data-role="stats"]');
        if (statsBtn) {
            const row = statsBtn.closest('.profile-manage-row');
            openProfilePage(Number(row.dataset.id));
            return;
        }
        const btn = e.target.closest('[data-role="del"]');
        if (!btn)
            return;
        const row = btn.closest('.profile-manage-row');
        const id = Number(row.dataset.id);
        const p = getProfileById(id);
        if (!p || !await confirmDialog(`Remover o perfil "${p.name}"? O histórico dele continua guardado.`, { title: 'Remover perfil', okText: 'Remover', danger: true }))
            return;
        try {
            await deleteProfile(id);
            render();
        }
        catch (err) {
            showSpecialMoment(`Não deu pra remover: ${err?.message || err}`, 'danger');
        }
    });
    render();
    void refreshProfiles().then(render);
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
    // Botão de microfone (push-to-talk) só aparece na mesa.
    vcSetGameActive(true);
    // Tela acesa durante a partida (site/PWA; no APK o nativo já segura).
    void requestWakeLock();
    // Sons prontos antes do primeiro dano (o WebView atrasa o primeiro play).
    audioManager.preload();
    audioManager.pruneOrphanSounds();
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
    // Check for newly eliminated players and play death sound
    state.players.forEach(player => {
        if (player.isEliminated && !eliminatedPlayersShown.has(player.id)) {
            eliminatedPlayersShown.add(player.id);
            audioManager.play('death', player.id); // "Fon fon fon fooooom"
            narrateElimination(player.name); // narrador/roast (IA) na morte
        }
        else if (!player.isEliminated && eliminatedPlayersShown.has(player.id)) {
            // Player was revived, remove from tracking
            eliminatedPlayersShown.delete(player.id);
        }
    });
    // O resultado só vai pro ranking no encerramento explícito (finishMatch),
    // nunca no instante do último eliminado — um undo ainda pode virar o jogo.
    updateEndGameButtons(state);
    renderMechanicsBadge();
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
                // Com a vitória escandalosa ligada, a gritaria dela já cobre a
                // narração (inclusive a da persona) — narrar de novo cortaria o grito.
                if (!isEscandalosaEnabled()) {
                    narrateWinner(winner.name); // narração de vitória (persona/IA)
                }
                lastShownWinnerId = state.winner;
            }
        }
    }
    else {
        // Hide share buttons when there's no winner
        hideShareButtons();
        stopEscandalosa(); // reset/nova partida no meio do escândalo
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
// ===== Render parcial dos cards =====
// Cada card tem uma "assinatura" do que entra no HTML dele. Se só a vida mudou,
// atualiza o número no lugar; se mudou algo estrutural (contadores, monarca,
// eliminado, avatar...), troca só aquele card. O grid inteiro só é refeito
// quando muda a lista de jogadores ou o layout. Resultado: GIFs e animações
// dos outros cards não reiniciam a cada +1/−1.
let lastCardSignatures = new Map();
let lastGridSignature = '';
function playerCardSignature(player, index, state) {
    const team = state.gameMode === 'two-headed' ? state.teams.find(t => t.playerIds.includes(player.id)) : null;
    return JSON.stringify([
        index, player.name, player.color, player.avatar, player.emoji, player.tag, player.background, player.backgroundType,
        player.isEliminated, player.isMonarch, player.id === state.winner, player.rotation,
        player.counters, player.commanderDeaths, player.commanderDamage,
        index === state.activePlayerIndex, state.viadoPlayerId === player.id, team?.id,
        state.settings.gifPaused, state.settings.showCommanderDeaths, state.settings.layout.tableMode,
        collapsedCounters.has(player.id),
        // faixas de vida (classes low-life/critical-life), não o valor em si
        player.life <= SPECIAL_MOMENTS.LOW_LIFE ? 'crit' : player.life <= SPECIAL_MOMENTS.DANGER_ZONE ? 'low' : 'ok',
    ]);
}
function renderPlayers(state) {
    const grid = $('players-grid');
    const gridSig = JSON.stringify([state.players.map(p => p.id), state.settings.layout, state.gameMode]);
    const existing = new Map();
    grid.querySelectorAll(':scope > .player-card').forEach(c => existing.set(c.dataset.playerId, c));
    if (gridSig === lastGridSignature && existing.size === state.players.length) {
        let changed = 0;
        state.players.forEach((player, index) => {
            const card = existing.get(player.id);
            const sig = playerCardSignature(player, index, state);
            if (sig !== lastCardSignatures.get(player.id)) {
                const html = renderPlayerCardHtml(player, index, state);
                const tmp = document.createElement('div');
                tmp.innerHTML = html;
                const fresh = tmp.firstElementChild;
                card.replaceWith(fresh);
                bindPlayerCard(fresh, player.id);
                lastCardSignatures.set(player.id, sig);
                changed++;
            }
            else {
                const lifeEl = card.querySelector('.life-value');
                if (lifeEl && lifeEl.textContent !== String(player.life))
                    lifeEl.textContent = String(player.life);
            }
        });
        if (changed === 0 || changed < state.players.length)
            return;
    }
    // Caminho completo (lista de jogadores/layout mudou ou primeira vez).
    lastGridSignature = gridSig;
    lastCardSignatures = new Map();
    grid.innerHTML = state.players.map((player, index) => {
        lastCardSignatures.set(player.id, playerCardSignature(player, index, state));
        return renderPlayerCardHtml(player, index, state);
    }).join('');
    grid.querySelectorAll('.player-card').forEach(card => bindPlayerCard(card, card.dataset.playerId));
}
function renderPlayerCardHtml(player, index, state) {
    const { layout } = state.settings;
    {
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
        return `
            <div class="player-card ${classes}"
                 data-player-id="${player.id}"
                 data-rotation="${rotation}"
                 style="--player-color: ${player.color}; grid-area: p${index};">
                ${player.background ? `<div class="player-card-background has-background" style="${backgroundStyle}"></div>` : ''}
                <div class="player-header">
                    <div class="player-info">
                        ${player.emoji ? `<span class="player-emoji">${escapeHtml(player.emoji)}</span>` :
            player.avatar ? `<img src="${escapeHtml(player.avatar)}" class="player-avatar" alt="${escapeHtml(player.name)}">` :
                `<div class="player-avatar" style="background: ${escapeHtml(player.color)}"></div>`}
                        <span class="player-name">${escapeHtml(player.name)}</span>
                        ${player.tag ? `<span class="player-tag">${escapeHtml(player.tag)}</span>` : ''}
                    </div>
                    <div class="player-status-badges">
                        ${player.isMonarch ? '<span class="monarch-badge-inline" title="Monarca">👑</span>' : ''}
                        ${state.viadoPlayerId === player.id ? '<span class="viado-badge" title="Viado">🏳️‍🌈</span>' : ''}
                        ${team ? `<span class="team-badge team-${teamIndex}" title="${team.name}">🤝</span>` : ''}
                    </div>
                    <div class="player-actions">
                        <button class="player-action-btn" data-action="taunt" title="Taunt / Provocação">💬</button>
                        <button class="player-action-btn" data-action="commander" title="Dano de Comandante">⚔️</button>
                        <button class="player-action-btn" data-action="counters" title="Contadores">📊</button>
                        <button class="player-action-btn" data-action="settings" title="Config">⚙️</button>
                    </div>
                </div>
                <div class="player-life-container">
                    <button class="life-control minus" data-action="life" data-amount="-1">−</button>
                    <div class="life-display">
                        <div class="life-value-row">
                            <span class="life-value">${player.life}</span>
                            <span class="damage-shadow"></span>
                        </div>
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
    }
}
// Liga os eventos de UM card (chamado no render completo e na troca parcial).
function bindPlayerCard(card, playerId) {
    {
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
        card.querySelector('[data-action="taunt"]')?.addEventListener('click', () => {
            openTauntModal(playerId);
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
    }
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
    $('escandalosa-enabled').checked = state.settings.escandalosaEnabled !== false;
    $('animated-bg-enabled').checked = state.settings.animatedBgEnabled;
    $('animated-bg-style').value = state.settings.animatedBgStyle;
    $('font-style').value = state.settings.fontStyle;
    $('ambient-music-enabled').checked = state.settings.ambientMusicEnabled;
    $('ambient-music-track').value = state.settings.ambientMusicTrack;
    $('music-volume-slider').value = state.settings.ambientMusicVolume.toString();
    const nv = $('narrator-volume-slider');
    if (nv)
        nv.value = String(state.settings.narratorVolume ?? 80);
    ['silent-btn', 'silent-btn-left'].forEach((id) => {
        const b = document.getElementById(id);
        if (b)
            b.classList.toggle('silent-on', !!state.settings.silentMode);
    });
    $('narrator-enabled').checked = state.settings.narratorEnabled;
    $('narrator-speed').value = state.settings.narratorSpeed.toString();
    const personaSel = $('narrator-persona');
    if (personaSel)
        personaSel.value = state.settings.narratorPersona ?? 'classic';
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
    // Update viado result display
    const viadoResult = $('viado-result');
    const viadoName = $('viado-name');
    const viado = gameState.getViado();
    if (viadoResult && viadoName) {
        if (viado) {
            viadoName.textContent = viado.name;
            viadoResult.style.display = 'flex';
        }
        else {
            viadoResult.style.display = 'none';
        }
    }
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
    const state = gameState.getState();
    const playerBefore = state.players.find(p => p.id === playerId);
    const lifeBefore = playerBefore?.life || 0;
    gameState.changeLife(playerId, amount);
    audioManager.play(amount < 0 ? 'damage' : 'heal', playerId);
    // Update damage shadow - get element AFTER render (gameState.changeLife triggers re-render)
    const newCard = $('players-grid').querySelector(`[data-player-id="${playerId}"]`);
    const damageShadow = newCard?.querySelector('.damage-shadow');
    updateDamageShadow(playerId, amount, damageShadow);
    // Get fresh references after re-render
    const lifeValue = newCard?.querySelector('.life-value');
    const indicator = newCard?.querySelector('.life-change-indicator');
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
    // Show easter egg message occasionally (20% chance)
    if (state.settings.easterEggsEnabled && secureRandomInt(5) === 0) {
        const randomMessage = EASTER_EGG_MESSAGES[secureRandomInt(EASTER_EGG_MESSAGES.length)];
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
            <div class="player-name">${escapeHtml(player.name)}</div>
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
            const randomIdx = secureRandomInt(alivePlayers.length);
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
// ===== Viado Selection =====
let isViadoSelectionRunning = false;
let viadoAnimationInterval = null;
function startViadoSelection() {
    if (isViadoSelectionRunning)
        return;
    isViadoSelectionRunning = true;
    if (viadoAnimationInterval) {
        clearInterval(viadoAnimationInterval);
        viadoAnimationInterval = null;
    }
    const state = gameState.getState();
    const overlay = $('viado-overlay');
    const animation = $('viado-animation');
    const title = overlay?.querySelector('.viado-overlay-title');
    const resultDiv = $('viado-overlay-result');
    // Get ALL players for the animation (so protected players appear in the roulette)
    const allPlayers = state.players;
    // Get eligible players (excluding protected names) - only these can win
    const protectedNames = ['reis', 'kings', 'matheus'];
    const eligiblePlayers = state.players.filter(player => {
        const nameLower = player.name.toLowerCase();
        return !protectedNames.some(p => nameLower.includes(p));
    });
    if (eligiblePlayers.length === 0) {
        void alertDialog('Nenhum jogador elegível para o sorteio!');
        isViadoSelectionRunning = false;
        return;
    }
    // Hide result from previous run
    if (resultDiv)
        resultDiv.style.display = 'none';
    $('viado-again-btn').style.display = 'none';
    $('viado-close-btn').style.display = 'none';
    if (title)
        title.textContent = '🎲 Sorteando...';
    overlay?.classList.add('active');
    // Create player icons - show ALL players in the animation
    if (animation) {
        animation.innerHTML = allPlayers.map(player => `
            <div class="player-option" data-player-id="${player.id}" style="background: ${player.color}">
                <span style="font-size: 1.5rem;">${player.emoji || '👤'}</span>
                <div class="name">${escapeHtml(player.name)}</div>
            </div>
        `).join('');
    }
    // Start animation - cycle through ALL players (so protected ones get highlighted too)
    let currentIndex = 0;
    const duration = 3000;
    const intervalTime = 120;
    audioManager.play('click');
    viadoAnimationInterval = window.setInterval(() => {
        const playerElements = animation?.querySelectorAll('.player-option');
        if (!playerElements)
            return;
        playerElements.forEach(el => el.classList.remove('highlight'));
        playerElements[currentIndex]?.classList.add('highlight');
        currentIndex = (currentIndex + 1) % allPlayers.length;
        audioManager.play('click');
    }, intervalTime);
    // End animation and show result
    setTimeout(() => {
        if (viadoAnimationInterval) {
            clearInterval(viadoAnimationInterval);
            viadoAnimationInterval = null;
        }
        // Select the viado (only from eligible players - protected ones never win)
        const winner = gameState.sortearViado();
        if (!winner) {
            isViadoSelectionRunning = false;
            return;
        }
        // Show winner
        const playerElements = animation?.querySelectorAll('.player-option');
        playerElements?.forEach(el => el.classList.remove('highlight'));
        const winnerElement = animation?.querySelector(`[data-player-id="${winner.id}"]`);
        winnerElement?.classList.add('selected');
        if (title)
            title.textContent = '🏳️‍🌈 Sorteado!';
        if (resultDiv)
            resultDiv.style.display = 'flex';
        $('viado-winner-name').textContent = winner.name;
        $('viado-again-btn').style.display = 'inline-block';
        $('viado-close-btn').style.display = 'inline-block';
        isViadoSelectionRunning = false;
        audioManager.play('viado', undefined, winner.name); // "eu não nasci gay" (100% Fluminense se José/Zé, senão 50/50)
    }, duration);
}
function closeViadoOverlay() {
    const overlay = $('viado-overlay');
    overlay?.classList.remove('active');
    if (viadoAnimationInterval) {
        clearInterval(viadoAnimationInterval);
        viadoAnimationInterval = null;
    }
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
                    <div class="commander-name">${escapeHtml(source.name)}</div>
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
    return phrases[secureRandomInt(phrases.length)];
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
// Planar die faces
const planarDieFaces = [
    { result: '⬜ Blank', emoji: '⬜', type: 'blank' },
    { result: '⬜ Blank', emoji: '⬜', type: 'blank' },
    { result: '⬜ Blank', emoji: '⬜', type: 'blank' },
    { result: '⬜ Blank', emoji: '⬜', type: 'blank' },
    { result: '⚙️ Chaos!', emoji: '⚙️', type: 'chaos' },
    { result: '🚪 Planeswalk', emoji: '🚪', type: 'planeswalk' },
];
// Helper to reset all 3D dice scenes
function resetAll3DScenes() {
    const scenes = ['dice-box-scene', 'coin-box-scene', 'planar-box-scene', 'dice-result'];
    scenes.forEach(id => {
        const el = $(id);
        if (el)
            el.style.display = 'none';
    });
    // Reset single die
    const singleDie = $('box-die-single');
    if (singleDie) {
        singleDie.classList.remove('rolling', 'settled', 'd4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100-tens');
        singleDie.style.display = 'block';
        singleDie.querySelectorAll('.box-die-face').forEach(f => f.textContent = '');
    }
    // Reset second die (D100)
    const secondDie = $('box-die-second');
    if (secondDie) {
        secondDie.classList.remove('rolling', 'settled', 'd100-ones');
        secondDie.style.display = 'none';
        secondDie.querySelectorAll('.box-die-face').forEach(f => f.textContent = '');
    }
    // Reset Coin
    const coin = $('box-coin');
    if (coin)
        coin.classList.remove('rolling', 'settled', 'show-heads', 'show-tails');
    // Reset Planar
    const planar = $('box-die-planar');
    if (planar)
        planar.classList.remove('rolling', 'settled');
}
function rollDice(diceType) {
    if (isRolling)
        return;
    const resultEl = $('dice-result');
    const valueEl = $('dice-result-value');
    const detailsEl = $('dice-result-details');
    if (!resultEl || !valueEl)
        return;
    // Get quantity and modifier
    const qtyInput = $('dice-quantity');
    const modInput = $('dice-modifier');
    const quantity = Math.min(20, Math.max(1, parseInt(qtyInput?.value || '1')));
    const modifier = parseInt(modInput?.value || '0');
    isRolling = true;
    valueEl.textContent = '';
    valueEl.className = 'dice-result-value';
    if (detailsEl)
        detailsEl.textContent = '';
    // Reset all 3D scenes
    resetAll3DScenes();
    // Determine which 3D element to use (only for single die, no modifier)
    const useSingle3D = quantity === 1 && modifier === 0;
    const max = parseInt(diceType) || 0;
    // Standard dice that use dice box (D4, D6, D8, D10, D12, D20)
    const standardDice = [4, 6, 8, 10, 12, 20];
    // Show and animate appropriate 3D element
    if (diceType === 'coin') {
        const scene = $('coin-box-scene');
        const coin = $('box-coin');
        if (scene && coin) {
            scene.style.display = 'flex';
            coin.classList.add('rolling');
        }
    }
    else if (diceType === 'planar') {
        const scene = $('planar-box-scene');
        const planar = $('box-die-planar');
        if (scene && planar) {
            scene.style.display = 'flex';
            planar.classList.add('rolling');
        }
    }
    else if (useSingle3D && standardDice.includes(max)) {
        // Use dice box for D4, D6, D8, D10, D12, D20
        const scene = $('dice-box-scene');
        const die = $('box-die-single');
        if (scene && die) {
            scene.style.display = 'flex';
            die.classList.add('rolling', `d${max}`);
        }
    }
    else if (useSingle3D && max === 100) {
        // D100 uses two dice
        const scene = $('dice-box-scene');
        const tens = $('box-die-single');
        const ones = $('box-die-second');
        if (scene && tens && ones) {
            scene.style.display = 'flex';
            tens.classList.add('rolling', 'd100-tens');
            ones.style.display = 'block';
            ones.classList.add('rolling', 'd100-ones');
        }
    }
    else {
        // Fallback to emoji for multiple dice or custom dice
        resultEl.style.display = 'block';
        resultEl.classList.add('rolling');
    }
    // Play dice sound
    audioManager.play('click');
    // Vibrate while rolling
    if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50, 30, 50]);
    }
    // Rolling animation duration
    setTimeout(() => {
        resultEl.classList.remove('rolling');
        isRolling = false;
        let finalResult;
        let emoji;
        let isCrit = false;
        let isFail = false;
        let details = '';
        let individualRolls = [];
        if (diceType === 'coin') {
            // Secure 50/50 coin flip
            finalResult = secureRandomInt(2) === 0 ? 'Cara' : 'Coroa';
            emoji = finalResult === 'Cara' ? '😀' : '🦅';
            // Show coin result in box
            const coin = $('box-coin');
            if (coin) {
                coin.classList.remove('rolling');
                coin.classList.add('settled', finalResult === 'Cara' ? 'show-heads' : 'show-tails');
            }
        }
        else if (diceType === 'planar') {
            // Planar die - 6 faces (secure random)
            const faceIndex = secureRandomInt(6);
            const face = planarDieFaces[faceIndex];
            finalResult = face.result;
            emoji = face.emoji;
            if (face.type === 'chaos') {
                isCrit = true;
                audioManager.play('energy');
            }
            else if (face.type === 'planeswalk') {
                audioManager.play('turn');
            }
            // Show planar die result in box
            const planar = $('box-die-planar');
            if (planar) {
                planar.classList.remove('rolling');
                planar.classList.add('settled');
                // Update visible face with result
                planar.querySelectorAll('.box-die-face').forEach(f => f.textContent = emoji);
            }
        }
        else {
            emoji = getDiceEmoji(max);
            // Roll multiple dice (secure random)
            let sum = 0;
            for (let i = 0; i < quantity; i++) {
                const roll = secureRandomRange(1, max);
                individualRolls.push(roll);
                sum += roll;
                // Check for crits on each roll (for D20)
                if (max === 20) {
                    if (roll === 20)
                        isCrit = true;
                    if (roll === 1)
                        isFail = true;
                }
            }
            // Apply modifier
            const total = sum + modifier;
            finalResult = total;
            // Show details for multiple dice or modifier
            if (quantity > 1 || modifier !== 0) {
                const rollsStr = individualRolls.join(' + ');
                if (modifier !== 0) {
                    const modStr = modifier > 0 ? `+ ${modifier}` : `- ${Math.abs(modifier)}`;
                    details = `(${rollsStr}) ${modStr} = ${total}`;
                }
                else {
                    details = `(${rollsStr}) = ${total}`;
                }
            }
            // Single die crit/fail check
            if (quantity === 1 && modifier === 0) {
                if (max === 20) {
                    if (sum === 20)
                        isCrit = true;
                    if (sum === 1)
                        isFail = true;
                }
                else {
                    if (sum === max)
                        isCrit = true;
                    if (sum === 1)
                        isFail = true;
                }
            }
            // Show dice result in box
            if (useSingle3D && standardDice.includes(max)) {
                const die = $('box-die-single');
                if (die) {
                    die.classList.remove('rolling');
                    die.classList.add('settled');
                    die.querySelectorAll('.box-die-face').forEach(f => f.textContent = String(sum));
                }
            }
            else if (useSingle3D && max === 100) {
                const tens = $('box-die-single');
                const ones = $('box-die-second');
                if (tens && ones) {
                    tens.classList.remove('rolling');
                    ones.classList.remove('rolling');
                    tens.classList.add('settled');
                    ones.classList.add('settled');
                    // Calculate tens (00-90) and ones (0-9) values
                    const tensValue = Math.floor((sum - 1) / 10) * 10;
                    const onesValue = sum === 100 ? 0 : sum % 10;
                    const tensDisplay = tensValue === 0 ? '00' : String(tensValue);
                    const onesDisplay = String(onesValue);
                    tens.querySelectorAll('.box-die-face').forEach(f => f.textContent = tensDisplay);
                    ones.querySelectorAll('.box-die-face').forEach(f => f.textContent = onesDisplay);
                }
            }
            else {
                resultEl.textContent = emoji;
            }
        }
        valueEl.textContent = String(finalResult);
        if (detailsEl)
            detailsEl.textContent = details;
        if (isCrit) {
            valueEl.classList.add('crit');
            audioManager.play('win');
            if (diceType === '20' && quantity === 1) {
                showTaunt('criticalRoll');
            }
        }
        else if (isFail) {
            valueEl.classList.add('fail');
            audioManager.play('damage');
            if (diceType === '20' && quantity === 1) {
                showTaunt('criticalFail');
            }
        }
        // Add to history
        const historyLabel = quantity > 1 ? `${quantity}d${diceType}` : diceType;
        addDiceHistory(historyLabel, finalResult, isCrit, isFail);
    }, 800);
}
// Roll custom dice
function rollCustomDice() {
    const customInput = $('dice-custom');
    const sides = parseInt(customInput?.value || '0');
    if (sides >= 2 && sides <= 1000) {
        rollDice(String(sides));
    }
    else {
        void alertDialog('Digite um número entre 2 e 1000');
    }
}
function getDiceEmoji(sides) {
    switch (sides) {
        case 4: return '🔻';
        case 6: return '🎲';
        case 8: return '🔷';
        case 10: return '🔶';
        case 12: return '⭐';
        case 20: return '🎯';
        case 100: return '💯';
        default: return '🎲';
    }
}
function addDiceHistory(diceType, result, isCrit, isFail) {
    const historyList = $('dice-history-list');
    if (!historyList)
        return;
    // Format label
    let label;
    if (diceType === 'coin') {
        label = '💰';
    }
    else if (diceType === 'planar') {
        label = '🌀';
    }
    else if (diceType.includes('d')) {
        label = diceType.toUpperCase();
    }
    else {
        label = `D${diceType}`;
    }
    // Add to beginning of history
    diceHistory.unshift({ dice: diceType, result });
    // Keep only last 10 rolls
    if (diceHistory.length > 10) {
        diceHistory.pop();
    }
    // Render history
    historyList.innerHTML = diceHistory.map((item, index) => {
        let itemLabel;
        if (item.dice === 'coin') {
            itemLabel = '💰';
        }
        else if (item.dice === 'planar') {
            itemLabel = '🌀';
        }
        else if (item.dice.includes('d')) {
            itemLabel = item.dice.toUpperCase();
        }
        else {
            itemLabel = `D${item.dice}`;
        }
        let className = 'dice-history-item';
        if (index === 0) {
            if (isCrit)
                className += ' crit';
            if (isFail)
                className += ' fail';
        }
        return `<span class="${className}">${itemLabel}: ${item.result}</span>`;
    }).join('');
}
// Initialize dice roller extras
function initDiceRoller() {
    // Custom dice roll button
    $('roll-custom-btn')?.addEventListener('click', rollCustomDice);
    // Enter key on custom dice input
    $('dice-custom')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            rollCustomDice();
        }
    });
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
    // Vitória escandalosa: sirene, tempestade de confete, flash, vibração longa e
    // narrador gritando por 8 s. Ela substitui a comemoração discreta abaixo.
    if (isEscandalosaEnabled()) {
        startEscandalosa(player.name);
        return;
    }
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
let gameTimerInterval = null;
function openModal(modal) {
    modal.classList.add('active');
    // Start game timer update when settings modal opens
    if (modal === $('settings-modal')) {
        startGameTimerUpdate();
    }
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
    else if (modal === $('settings-modal')) {
        stopGameTimerUpdate();
    }
}
// Game Timer functions
function startGameTimerUpdate() {
    const state = gameState.getState();
    const timerDisplay = $('game-timer-display');
    if (!timerDisplay)
        return;
    // Only show if game has started
    if (state.gameStarted) {
        timerDisplay.style.display = 'flex';
        // If gameStartTime is not set (old save), set it now
        if (!state.gameStartTime) {
            gameState.setGameStartTime(Date.now());
        }
        updateGameTimerDisplay();
        // Update every second
        gameTimerInterval = window.setInterval(updateGameTimerDisplay, 1000);
    }
    else {
        timerDisplay.style.display = 'none';
    }
}
function stopGameTimerUpdate() {
    if (gameTimerInterval) {
        clearInterval(gameTimerInterval);
        gameTimerInterval = null;
    }
}
function updateGameTimerDisplay() {
    const state = gameState.getState();
    const timerValue = $('game-timer-value');
    if (!timerValue || !state.gameStartTime)
        return;
    const elapsed = Date.now() - state.gameStartTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    timerValue.textContent =
        String(hours).padStart(2, '0') + ':' +
            String(minutes).padStart(2, '0') + ':' +
            String(seconds).padStart(2, '0');
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
        void alertDialog('Não foi possível copiar. Tente salvar a imagem.');
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
async function handleRevivePlayer(playerId) {
    const state = gameState.getState();
    if (state.settings.confirmCriticalActions) {
        const p = state.players.find(x => x.id === playerId);
        if (!await confirmDialog(`Reviver ${p?.name || 'este jogador'}?`, { okText: 'Reviver' }))
            return;
    }
    gameState.revivePlayer(playerId, true);
    audioManager.play('revive', playerId); // Angelic sound
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