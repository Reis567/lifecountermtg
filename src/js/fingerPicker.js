// ===== Finger Picker ("quem começa" pelos dedos) =====
// Cada jogador encosta 1 dedo. Quando o número de dedos == número de jogadores,
// inicia a contagem e sorteia 1 — estilo Chwazi. Overlay criado via JS.
import { gameState } from './state.js';
import { DEFAULT_PLAYER_COLORS } from './types.js';
import { audioManager } from './audio.js';
let fpOverlay = null;
let fpPointers = new Map();
let fpTarget = 4;
let fpCountdownTimer = null;
let fpResolved = false;
const FP_COUNTDOWN_MS = 2500;
function fpRandomInt(max) {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const a = new Uint32Array(1);
        crypto.getRandomValues(a);
        return Math.floor((a[0] / (0xFFFFFFFF + 1)) * max);
    }
    return Math.floor(Math.random() * max);
}
function fpColorFor(index) {
    return DEFAULT_PLAYER_COLORS[index % DEFAULT_PLAYER_COLORS.length];
}
export function openFingerPicker() {
    fpTarget = Math.max(1, gameState.getState().players.length || 2);
    fpClose();
    const overlay = document.createElement('div');
    overlay.className = 'finger-picker-overlay active';
    overlay.style.touchAction = 'none';
    overlay.innerHTML = `
        <div class="fp-instructions" id="fp-instructions">
            <h2>Quem começa?</h2>
            <p id="fp-hint">Cada jogador encosta 1 dedo na tela</p>
        </div>
        <button class="fp-close" id="fp-close-btn" aria-label="Fechar">✕</button>
        <div class="fp-status" id="fp-status"></div>
    `;
    document.body.appendChild(overlay);
    fpOverlay = overlay;
    fpPointers = new Map();
    fpResolved = false;
    overlay.addEventListener('pointerdown', fpOnDown);
    overlay.addEventListener('pointermove', fpOnMove);
    overlay.addEventListener('pointerup', fpOnUp);
    overlay.addEventListener('pointercancel', fpOnUp);
    document.getElementById('fp-close-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        fpClose();
    });
    fpUpdateHint();
}
function fpPositionDot(el, x, y) {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
}
function fpIsControl(target) {
    return target instanceof HTMLElement && target.closest('.fp-close, .fp-btn') !== null;
}
function fpOnDown(e) {
    if (fpResolved || !fpOverlay)
        return;
    if (fpIsControl(e.target))
        return;
    if (fpPointers.has(e.pointerId))
        return;
    const color = fpColorFor(fpPointers.size);
    const el = document.createElement('div');
    el.className = 'fp-dot';
    el.style.background = color;
    el.style.boxShadow = `0 0 28px 6px ${color}`;
    fpOverlay.appendChild(el);
    fpPositionDot(el, e.clientX, e.clientY);
    fpPointers.set(e.pointerId, { el, color });
    fpOnPointersChanged();
}
function fpOnMove(e) {
    const p = fpPointers.get(e.pointerId);
    if (!p)
        return;
    fpPositionDot(p.el, e.clientX, e.clientY);
}
function fpOnUp(e) {
    if (fpResolved)
        return;
    const p = fpPointers.get(e.pointerId);
    if (!p)
        return;
    p.el.remove();
    fpPointers.delete(e.pointerId);
    fpOnPointersChanged();
}
function fpOnPointersChanged() {
    if (fpCountdownTimer !== null) {
        clearTimeout(fpCountdownTimer);
        fpCountdownTimer = null;
    }
    fpOverlay?.classList.remove('fp-counting');
    if (fpPointers.size === fpTarget && fpTarget >= 1) {
        // Número certo de dedos → conta e sorteia.
        fpOverlay?.classList.add('fp-counting');
        const status = document.getElementById('fp-status');
        if (status)
            status.textContent = 'Não tirem os dedos... sorteando!';
        fpCountdownTimer = window.setTimeout(() => fpResolve(), FP_COUNTDOWN_MS);
    }
    else {
        fpUpdateHint();
    }
}
function fpUpdateHint() {
    const hint = document.getElementById('fp-hint');
    const status = document.getElementById('fp-status');
    if (status)
        status.textContent = '';
    if (!hint)
        return;
    const diff = fpTarget - fpPointers.size;
    if (diff > 0) {
        hint.innerHTML = `Cada jogador encosta 1 dedo<br><b>${fpPointers.size}/${fpTarget}</b> dedos`;
    }
    else if (diff < 0) {
        hint.innerHTML = `Dedos demais! Tire <b>${-diff}</b><br><b>${fpPointers.size}/${fpTarget}</b>`;
    }
}
function fpResolve() {
    fpCountdownTimer = null;
    fpResolved = true;
    fpOverlay?.classList.remove('fp-counting');
    const ids = Array.from(fpPointers.keys());
    if (ids.length === 0) {
        fpResolved = false;
        fpUpdateHint();
        return;
    }
    const winnerId = ids[fpRandomInt(ids.length)];
    fpPointers.forEach((p, id) => {
        p.el.classList.add(id === winnerId ? 'fp-winner' : 'fp-loser');
    });
    audioManager.play('turn');
    const instr = document.getElementById('fp-instructions');
    if (instr)
        instr.style.display = 'none';
    const status = document.getElementById('fp-status');
    if (status) {
        status.innerHTML = `
            <div class="fp-result">Esse dedo começa! 🎉</div>
            <div class="fp-result-actions">
                <button id="fp-again-btn" class="fp-btn">Sortear de novo</button>
                <button id="fp-done-btn" class="fp-btn fp-btn-primary">Fechar</button>
            </div>
        `;
        document.getElementById('fp-again-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            fpRestart();
        });
        document.getElementById('fp-done-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            fpClose();
        });
    }
}
function fpRestart() {
    if (fpCountdownTimer !== null) {
        clearTimeout(fpCountdownTimer);
        fpCountdownTimer = null;
    }
    fpPointers.forEach((p) => p.el.remove());
    fpPointers = new Map();
    fpResolved = false;
    fpOverlay?.classList.remove('fp-counting');
    const instr = document.getElementById('fp-instructions');
    if (instr)
        instr.style.display = '';
    const status = document.getElementById('fp-status');
    if (status)
        status.innerHTML = '';
    fpUpdateHint();
}
function fpClose() {
    if (fpCountdownTimer !== null) {
        clearTimeout(fpCountdownTimer);
        fpCountdownTimer = null;
    }
    if (fpOverlay) {
        fpOverlay.remove();
        fpOverlay = null;
    }
    fpPointers = new Map();
    fpResolved = false;
}
//# sourceMappingURL=fingerPicker.js.map