// ===== Vitória Escandalosa =====
// Oito segundos de sirene, confete, flash, vibração e narrador gritando sem parar.
// É deliberadamente constrangedor em lugar público — esse é o ponto da feature.
// Desligável em Configurações > Visual > "Vitória escandalosa".
//
// Segurança: o strobe de tela pisca a ~2,4 Hz (abaixo do limite de 3 Hz das
// diretrizes de fotossensibilidade) e é suprimido em `prefers-reduced-motion`.
// Sirene, vibração e gritaria continuam nesse caso.

import { gameState } from './state.js';
import { narrator } from './audio.js';
import { narrateWinnerEscandaloso } from './aiNarrator.js';

const ESCANDALO_MS = 8000;

// Ponte nativa opcional (Android): lanterna, vibrador e TTS. Ver MainActivity.kt.
// No navegador ela não existe e tudo cai no equivalente web.
interface HypeBridge {
    strobe(durationMs: number): void;
    vibrate(durationMs: number): void;
    shout(text: string): void;
    isShouting(): boolean;
    shutUp(): void;
}

function hypeBridge(): Partial<HypeBridge> | null {
    const bridge = (window as any).LCHype;
    return bridge && typeof bridge.strobe === 'function' ? bridge as Partial<HypeBridge> : null;
}

// O TTS do WebView é instável; quando a ponte nativa existe, ela tem preferência.
function shoutLine(text: string): void {
    const bridge = hypeBridge();
    if (bridge?.shout) bridge.shout(text);
    else narrator.shout(text);
}

function shoutBusy(): boolean {
    const bridge = hypeBridge();
    if (bridge?.isShouting) return bridge.isShouting();
    return narrator.isBusy();
}

function shoutStop(): void {
    hypeBridge()?.shutUp?.();
    narrator.shutUp();
}

function escRandInt(max: number): number {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const arr = new Uint32Array(1);
        crypto.getRandomValues(arr);
        return arr[0] % max;
    }
    return Math.floor(Math.random() * max);
}

function reducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

// ===== Estado do escândalo em curso =====

let escandaloActive = false;
let escandaloTimers: number[] = [];
let escandaloCtx: AudioContext | null = null;
let sireneNodes: OscillatorNode[] = [];
let sireneGain: GainNode | null = null;

function escTimeout(fn: () => void, ms: number): void {
    escandaloTimers.push(window.setTimeout(fn, ms));
}

function escInterval(fn: () => void, ms: number): void {
    escandaloTimers.push(window.setInterval(fn, ms));
}

export function isEscandalosaEnabled(): boolean {
    return gameState.getState().settings.escandalosaEnabled !== false;
}

// ===== Sirene =====

function escandaloAudioCtx(): AudioContext | null {
    if (!escandaloCtx) {
        try {
            escandaloCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            console.warn('Sirene: sem AudioContext', e);
            return null;
        }
    }
    if (escandaloCtx.state === 'suspended') escandaloCtx.resume();
    return escandaloCtx;
}

function startSirene(volume: number): void {
    const ctx = escandaloAudioCtx();
    if (!ctx) return;

    const seconds = ESCANDALO_MS / 1000;
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
    // Sobe rápido, segura, e some no último meio segundo.
    master.gain.linearRampToValueAtTime(volume * 0.5, ctx.currentTime + 0.3);
    master.gain.setValueAtTime(volume * 0.5, ctx.currentTime + seconds - 0.5);
    master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + seconds);
    sireneGain = master;

    // Duas serras levemente desafinadas = sirene de ambulância brega.
    [0, 7].forEach((detune, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 620 + detune;

        const gain = ctx.createGain();
        gain.gain.value = i === 0 ? 0.5 : 0.32;
        osc.connect(gain);
        gain.connect(master);

        // LFO varrendo ~360 Hz -> ~880 Hz, o "uó-uó-uó".
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.95;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 260;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        osc.start();
        lfo.start();
        sireneNodes.push(osc, lfo);
    });

    // Buzina de estádio por cima, a cada 2 segundos.
    for (let t = 0.15; t < seconds - 0.8; t += 2) {
        const horn = ctx.createOscillator();
        const hornGain = ctx.createGain();
        horn.type = 'square';
        horn.frequency.value = 233; // Bb3
        hornGain.gain.value = 0;
        hornGain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        hornGain.gain.linearRampToValueAtTime(volume * 0.35, ctx.currentTime + t + 0.05);
        hornGain.gain.setValueAtTime(volume * 0.35, ctx.currentTime + t + 0.55);
        hornGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + t + 0.7);
        horn.connect(hornGain);
        hornGain.connect(ctx.destination);
        horn.start(ctx.currentTime + t);
        horn.stop(ctx.currentTime + t + 0.75);
        sireneNodes.push(horn);
    }
}

function stopSirene(): void {
    sireneNodes.forEach(node => {
        try { node.stop(); } catch (e) { /* já parado */ }
    });
    sireneNodes = [];
    if (sireneGain) {
        try { sireneGain.disconnect(); } catch (e) { /* já desconectado */ }
        sireneGain = null;
    }
}

// ===== Flash (tela + lanterna) =====

function flashLayer(): HTMLElement {
    let layer = document.getElementById('escandalo-flash');
    if (!layer) {
        layer = document.createElement('div');
        layer.id = 'escandalo-flash';
        layer.className = 'escandalo-flash';
        document.body.appendChild(layer);
    }
    return layer;
}

function startFlash(): void {
    // Lanterna do celular (só via ponte nativa do Android).
    hypeBridge()?.strobe?.(ESCANDALO_MS);

    if (reducedMotion()) return;

    const layer = flashLayer();
    // Ciclo de 410 ms (~2,4 flashes/s): abaixo dos 3 Hz das diretrizes de
    // fotossensibilidade, e ainda assim insuportável.
    escInterval(() => {
        layer.classList.add('on');
        escTimeout(() => layer.classList.remove('on'), 90);
    }, 410);
}

function stopFlash(): void {
    hypeBridge()?.strobe?.(0); // 0 = apaga a lanterna no lado nativo
    document.getElementById('escandalo-flash')?.classList.remove('on');
}

// ===== Vibração =====

function startVibracao(): void {
    const bridge = hypeBridge();
    if (bridge?.vibrate) {
        bridge.vibrate(ESCANDALO_MS);
        return;
    }
    if (!navigator.vibrate) return;

    // ~8 s de vibração em rajadas crescentes.
    const pattern: number[] = [];
    for (let i = 0; i < 12; i++) {
        pattern.push(200 + i * 25, 120);
    }
    pattern.push(1200); // fechamento longo
    navigator.vibrate(pattern);
}

function stopVibracao(): void {
    const bridge = hypeBridge();
    if (bridge?.vibrate) bridge.vibrate(0); // 0 = cancela no lado nativo
    navigator.vibrate?.(0);
}

// ===== Confete e fogos (tempestade) =====

const CONFETTI_COLORS = ['#f43f5e', '#ec4899', '#8b5cf6', '#6366f1', '#3b82f6', '#22c55e', '#eab308', '#f97316', '#ffffff'];
const CONFETTI_SHAPES = ['square', 'circle', 'ribbon'];

function confettiWave(container: Element, count: number): void {
    for (let i = 0; i < count; i++) {
        const piece = document.createElement('div');
        const color = CONFETTI_COLORS[escRandInt(CONFETTI_COLORS.length)];
        const shape = CONFETTI_SHAPES[escRandInt(CONFETTI_SHAPES.length)];
        const duration = 1.6 + escRandInt(160) / 100;

        piece.className = `confetti-piece ${shape} escandalo-mega`;
        piece.style.cssText = `
            left: ${escRandInt(100)}%;
            background: ${color};
            --delay: ${escRandInt(60) / 100}s;
            --fall-duration: ${duration}s;
        `;
        piece.addEventListener('animationend', () => piece.remove());
        container.appendChild(piece);
    }
}

function fireworkBurst(container: Element): void {
    const centerX = 10 + escRandInt(80);
    const centerY = 10 + escRandInt(60);

    for (let i = 0; i < 24; i++) {
        const particle = document.createElement('div');
        const color = CONFETTI_COLORS[escRandInt(CONFETTI_COLORS.length)];
        const angle = (i / 24) * 2 * Math.PI;
        const distance = 60 + escRandInt(120);

        particle.className = 'firework';
        particle.style.cssText = `
            left: ${centerX}%;
            top: ${centerY}%;
            background: ${color};
            box-shadow: 0 0 8px ${color};
            --tx: ${Math.cos(angle) * distance}px;
            --ty: ${Math.sin(angle) * distance}px;
        `;
        particle.addEventListener('animationend', () => particle.remove());
        container.appendChild(particle);
    }
}

function startTempestade(): void {
    if (reducedMotion()) return;

    const container = document.querySelector('.winner-confetti');
    if (!container) return;

    confettiWave(container, 90);
    escInterval(() => confettiWave(container, 70), 700);
    escInterval(() => fireworkBurst(container), 450);
}

// ===== Gritaria do narrador =====

const GRITOS = [
    'ACABOU! ACABOU! {n} É O CAMPEÃO!',
    '{n} VENCEU! {n} VENCEU! {n} VENCEU!',
    'OLHA O TAMANHO DESSA VITÓRIA, SENHORAS E SENHORES!',
    'NÃO DÁ PRA ACREDITAR NO QUE ACABOU DE ACONTECER NESSA MESA!',
    'ESCREVAM O NOME: {n}! COM TODAS AS LETRAS!',
    'O RESTO DA MESA QUE SE EXPLIQUE EM CASA!',
    'ISSO NÃO É UMA PARTIDA, ISSO É UMA OBRA DE ARTE!',
    'GUARDEM ESSA DATA! GUARDEM ESSE NOME! {n}!',
    'ALGUÉM SEGURA O {n} QUE ELE NÃO CABE EM SI!',
    'É CAMPEÃO! É CAMPEÃO! É CAMPEÃO!',
];

function shuffled<T>(items: T[]): T[] {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = escRandInt(i + 1);
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function startGritaria(playerName: string): void {
    const pool = shuffled(GRITOS).map(line => line.replace(/\{n\}/g, playerName));
    let index = 0;

    // Só empurra a próxima fala quando a fila esvazia — o resultado é uma
    // gritaria contínua, sem sobreposição, pelos 8 segundos inteiros.
    const pump = () => {
        if (!escandaloActive || shoutBusy()) return;
        shoutLine(pool[index++ % pool.length]);
    };

    pump();
    escInterval(pump, 500);

    // Se a IA estiver ligada, a narração da persona entra na fila por cima do
    // repertório fixo (que já começou a tocar, sem esperar a rede).
    void narrateWinnerEscandaloso(playerName).then(lines => {
        if (!escandaloActive) return;
        lines.forEach(line => shoutLine(line));
    });
}

// ===== Palco (overlay em modo escândalo) =====

function startPalco(playerName: string): void {
    const overlay = document.getElementById('winner-overlay');
    if (!overlay) return;

    // O .winner-confetti mora dentro do .winner-content, que no modo escândalo
    // ganha um transform infinito — e transform em ancestral vira o bloco
    // contentor do position: fixed, prendendo o confete dentro da caixinha.
    // Sobe o container para o <body> (é fixed/inset:0, o lugar não muda nada).
    const confetti = document.querySelector('.winner-confetti');
    if (confetti && confetti.parentElement !== document.body) {
        document.body.appendChild(confetti);
    }

    overlay.classList.add('escandaloso');

    let banner = document.getElementById('escandalo-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'escandalo-banner';
        banner.className = 'escandalo-banner';
        overlay.appendChild(banner);
    }
    const grito = `${playerName.toUpperCase()} É CAMPEÃO`;
    const marquee = document.createElement('span');
    marquee.className = 'escandalo-marquee';
    marquee.textContent = `${[grito, grito, grito, grito].join(' ★ ')} ★ `;
    banner.innerHTML = '';
    banner.appendChild(marquee);
}

function stopPalco(): void {
    document.getElementById('winner-overlay')?.classList.remove('escandaloso');
    document.getElementById('escandalo-banner')?.remove();
}

// ===== API =====

export function startEscandalosa(playerName: string): void {
    if (!isEscandalosaEnabled()) return;

    stopEscandalosa(); // nunca dois escândalos ao mesmo tempo
    escandaloActive = true;

    const settings = gameState.getState().settings;
    if (settings.soundEnabled && !settings.silentMode) {
        startSirene(settings.volume / 100);
        startGritaria(playerName);
    }
    startPalco(playerName);
    startTempestade();
    startFlash();
    startVibracao();

    escTimeout(() => stopEscandalosa(), ESCANDALO_MS);
}

export function stopEscandalosa(): void {
    // Guarda: sem escândalo em curso não há o que limpar, e um shutUp() a cada
    // render cortaria a fala normal do narrador.
    if (!escandaloActive) return;
    escandaloActive = false;

    escandaloTimers.forEach(id => {
        window.clearTimeout(id);
        window.clearInterval(id);
    });
    escandaloTimers = [];

    stopSirene();
    stopFlash();
    stopVibracao();
    stopPalco();
    shoutStop();
}
