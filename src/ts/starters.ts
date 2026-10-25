// ===== Mais jeitos de sortear quem começa =====
// Além do "Sorteio" (destaque nos cards) e "Pelos dedos" (fingerPicker.ts):
//   - Roleta: roda com o nome de cada jogador; gira e para num.
//   - Dado de cada um: todo mundo rola um d20 ao mesmo tempo; maior começa
//     (empate re-rola só entre os empatados).
//   - Reflexo: a tela fica vermelha ("esperem"), vira verde num momento
//     aleatório e o primeiro dedo que encostar começa. Quem encosta antes
//     queima a largada.
// Todos usam um overlay próprio (classe .st-overlay), sem modal.

import { gameState } from './state.js';
import { audioManager } from './audio.js';
import { avatarHtml, escapeHtml } from './profiles.js';

interface StPlayer { id: string; name: string; color: string; avatar: string | null }

let stOverlay: HTMLDivElement | null = null;
let stTimers: number[] = [];

function stPlayers(): StPlayer[] {
    return gameState.getState().players.map((p) => ({ id: p.id, name: p.name, color: p.color, avatar: p.avatar }));
}

function stRand(max: number): number {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const a = new Uint32Array(1);
        crypto.getRandomValues(a);
        return Math.floor((a[0] / (0xFFFFFFFF + 1)) * max);
    }
    return Math.floor(Math.random() * max);
}

function stLater(fn: () => void, ms: number): void {
    stTimers.push(window.setTimeout(fn, ms));
}

export function stClose(): void {
    stTimers.forEach((t) => clearTimeout(t));
    stTimers = [];
    stOverlay?.remove();
    stOverlay = null;
}

function stOpen(extraClass = ''): HTMLDivElement {
    stClose();
    const el = document.createElement('div');
    el.className = `st-overlay ${extraClass}`;
    el.innerHTML = '<button type="button" class="st-close" aria-label="Fechar">&times;</button>';
    el.querySelector('.st-close')?.addEventListener('click', (e) => { e.stopPropagation(); stClose(); });
    document.body.appendChild(el);
    stOverlay = el;
    return el;
}

function stResultHtml(p: StPlayer, title: string): string {
    return `
        <div class="st-result">
            <div class="st-result-name">
                ${avatarHtml({ name: p.name, photo_url: p.avatar, color: p.color }, 'lc-avatar')}
                <div>${escapeHtml(p.name)} começa!</div>
            </div>
        </div>
        <div class="st-sub">${escapeHtml(title)}</div>`;
}

function stActions(onAgain: () => void): string {
    return `
        <div class="st-actions">
            <button type="button" class="st-btn" data-st="again">De novo</button>
            <button type="button" class="st-btn st-btn-primary" data-st="done">Fechar</button>
        </div>`;
}

function stBindActions(root: HTMLElement, onAgain: () => void): void {
    root.querySelector('[data-st="again"]')?.addEventListener('click', (e) => { e.stopPropagation(); onAgain(); });
    root.querySelector('[data-st="done"]')?.addEventListener('click', (e) => { e.stopPropagation(); stClose(); });
}

function stMarkActive(p: StPlayer): void {
    // Deixa o sorteado como jogador ativo (igual ao Sorteio dos cards).
    const idx = gameState.getState().players.findIndex((x) => x.id === p.id);
    if (idx >= 0) gameState.setActivePlayer(idx);
}

// ---------------------------------------------------------------- Roleta
export function openRouletteStarter(): void {
    const players = stPlayers();
    if (players.length < 2) return;
    const el = stOpen();
    const n = players.length;
    const R = 180;
    const sectors = players.map((p, i) => {
        const a0 = (i / n) * 2 * Math.PI - Math.PI / 2;
        const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
        const x0 = R + R * Math.cos(a0), y0 = R + R * Math.sin(a0);
        const x1 = R + R * Math.cos(a1), y1 = R + R * Math.sin(a1);
        const mid = (a0 + a1) / 2;
        const tx = R + R * 0.62 * Math.cos(mid), ty = R + R * 0.62 * Math.sin(mid);
        const rot = (mid * 180) / Math.PI;
        const label = p.name.length > 10 ? p.name.slice(0, 9) + '…' : p.name;
        return `
            <path d="M${R},${R} L${x0.toFixed(1)},${y0.toFixed(1)} A${R},${R} 0 ${n === 2 ? 1 : 0},1 ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${p.color}" stroke="rgba(0,0,0,0.35)" stroke-width="2"/>
            <text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" font-size="${n > 6 ? 13 : 16}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rot.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)})">${escapeHtml(label)}</text>`;
    }).join('');
    el.insertAdjacentHTML('beforeend', `
        <div class="st-title">Roleta</div>
        <div class="st-sub" id="st-sub">Toque na roda pra girar</div>
        <div class="st-wheel-wrap">
            <div class="st-pointer"></div>
            <svg class="st-wheel" id="st-wheel" viewBox="0 0 ${R * 2} ${R * 2}">${sectors}</svg>
            <div class="st-wheel-center">GIRAR</div>
        </div>
        <div id="st-out"></div>`);
    const wheel = el.querySelector('#st-wheel') as SVGElement;
    const out = el.querySelector('#st-out') as HTMLElement;
    const sub = el.querySelector('#st-sub') as HTMLElement;
    let spinning = false;
    let angle = 0;
    const spin = (): void => {
        if (spinning) return;
        spinning = true;
        out.innerHTML = '';
        sub.textContent = 'Girando…';
        const winner = stRand(n);
        // Ângulo final: o centro do setor vencedor tem que ficar embaixo do ponteiro (topo).
        const sectorDeg = 360 / n;
        const target = 360 - (winner * sectorDeg + sectorDeg / 2) + (stRand(Math.floor(sectorDeg * 0.6)) - sectorDeg * 0.3);
        angle += 360 * (5 + stRand(3)) + ((target - (angle % 360) + 360) % 360);
        (wheel as any).style.transform = `rotate(${angle}deg)`;
        audioManager.play('click');
        stLater(() => {
            spinning = false;
            const p = players[winner];
            audioManager.play('turn');
            try { navigator.vibrate?.([40, 60, 80]); } catch { /* ignore */ }
            sub.textContent = '';
            out.innerHTML = stResultHtml(p, 'A roleta decidiu') + stActions(spin);
            stBindActions(out, spin);
            stMarkActive(p);
        }, 4300);
    };
    el.querySelector('.st-wheel-wrap')?.addEventListener('click', spin);
}

// ---------------------------------------------------------- Dado de cada um
export function openDiceStarter(): void {
    const players = stPlayers();
    if (players.length < 2) return;
    const el = stOpen();
    el.insertAdjacentHTML('beforeend', `
        <div class="st-title">Dado de cada um</div>
        <div class="st-sub" id="st-sub">Cada jogador rola um d20 · maior começa</div>
        <div class="st-dice-list" id="st-dice"></div>
        <div id="st-out"><div class="st-actions"><button type="button" class="st-btn st-btn-primary" id="st-roll">Rolar todos</button></div></div>`);
    const list = el.querySelector('#st-dice') as HTMLElement;
    const out = el.querySelector('#st-out') as HTMLElement;
    const sub = el.querySelector('#st-sub') as HTMLElement;
    let alive = players.slice();
    const vals = new Map<string, number>();
    const render = (): void => {
        list.innerHTML = players.map((p) => `
            <div class="st-die ${alive.includes(p) ? '' : 'out'}" data-id="${p.id}">
                ${avatarHtml({ name: p.name, photo_url: p.avatar, color: p.color }, 'lc-avatar')}
                <div class="st-die-name">${escapeHtml(p.name)}</div>
                <div class="st-die-val">${vals.has(p.id) ? vals.get(p.id) : '–'}</div>
            </div>`).join('');
    };
    const roll = (): void => {
        out.innerHTML = '';
        alive.forEach((p) => vals.delete(p.id));
        render();
        const dies = alive.map((p) => list.querySelector(`.st-die[data-id="${p.id}"]`) as HTMLElement);
        dies.forEach((d) => d.classList.add('rolling'));
        audioManager.play('click');
        // Números piscando por ~1,4 s, depois cada um "para" em sequência.
        const tick = window.setInterval(() => {
            dies.forEach((d) => { const v = d.querySelector('.st-die-val'); if (v) v.textContent = String(1 + stRand(20)); });
        }, 70);
        stTimers.push(tick as unknown as number);
        stLater(() => {
            clearInterval(tick);
            alive.forEach((p, i) => {
                stLater(() => {
                    const v = 1 + stRand(20);
                    vals.set(p.id, v);
                    const d = dies[i];
                    d.classList.remove('rolling');
                    const ve = d.querySelector('.st-die-val');
                    if (ve) ve.textContent = String(v);
                    audioManager.play('click');
                    if (i === alive.length - 1) stLater(finish, 450);
                }, 260 * i);
            });
        }, 1400);
    };
    const finish = (): void => {
        const best = Math.max(...alive.map((p) => vals.get(p.id) || 0));
        const top = alive.filter((p) => vals.get(p.id) === best);
        if (top.length > 1) {
            alive = top;
            players.forEach((p) => list.querySelector(`.st-die[data-id="${p.id}"]`)?.classList.toggle('tied', top.includes(p)));
            players.forEach((p) => list.querySelector(`.st-die[data-id="${p.id}"]`)?.classList.toggle('out', !top.includes(p)));
            sub.textContent = `Empate em ${best}! ${top.map((p) => p.name).join(' e ')} rolam de novo`;
            out.innerHTML = `<div class="st-actions"><button type="button" class="st-btn st-btn-primary" id="st-roll">Desempatar</button></div>`;
            out.querySelector('#st-roll')?.addEventListener('click', roll);
            return;
        }
        const p = top[0];
        list.querySelector(`.st-die[data-id="${p.id}"]`)?.classList.add('winner');
        audioManager.play('turn');
        try { navigator.vibrate?.([40, 60, 80]); } catch { /* ignore */ }
        sub.textContent = '';
        out.innerHTML = stResultHtml(p, `Tirou ${best} no d20`) + stActions(() => { alive = players.slice(); vals.clear(); roll(); });
        stBindActions(out, () => { alive = players.slice(); vals.clear(); render(); roll(); });
        stMarkActive(p);
    };
    render();
    el.querySelector('#st-roll')?.addEventListener('click', roll);
}

// ------------------------------------------------------------------ Reflexo
export function openReflexStarter(): void {
    const el = stOpen('st-reflex');
    el.innerHTML += `
        <div class="st-title" id="st-title">Reflexo</div>
        <div class="st-reflex-big" id="st-big">PREPARAR</div>
        <div class="st-sub" id="st-sub">Dedos fora da tela. Quando ficar VERDE, o primeiro a encostar começa.</div>
        <div id="st-out"></div>`;
    const big = el.querySelector('#st-big') as HTMLElement;
    const sub = el.querySelector('#st-sub') as HTMLElement;
    const out = el.querySelector('#st-out') as HTMLElement;
    let phase: 'idle' | 'wait' | 'go' | 'done' = 'idle';
    const colors = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#22c55e', '#ef4444', '#3b82f6', '#a855f7'];
    const arm = (): void => {
        out.innerHTML = '';
        el.querySelectorAll('.st-tap').forEach((t) => t.remove());
        el.classList.remove('go', 'early');
        el.classList.add('wait');
        phase = 'wait';
        big.textContent = 'ESPEREM…';
        sub.textContent = 'Dedos fora da tela. Verde = pode encostar.';
        stLater(() => {
            if (phase !== 'wait') return;
            phase = 'go';
            el.classList.remove('wait');
            el.classList.add('go');
            big.textContent = 'AGORA!';
            audioManager.play('turn');
            try { navigator.vibrate?.(60); } catch { /* ignore */ }
        }, 1800 + stRand(3200));
    };
    el.addEventListener('pointerdown', (e) => {
        if ((e.target as HTMLElement).closest('.st-close, .st-btn')) return;
        if (phase === 'idle') { arm(); return; }
        if (phase === 'wait') {
            phase = 'done';
            el.classList.remove('wait');
            el.classList.add('early');
            big.textContent = 'QUEIMOU!';
            sub.textContent = 'Alguém encostou antes do verde. Toque pra tentar de novo.';
            audioManager.play('damage');
            stLater(() => { phase = 'idle'; }, 600);
            return;
        }
        if (phase === 'go') {
            phase = 'done';
            const dot = document.createElement('div');
            dot.className = 'st-tap';
            dot.style.left = `${e.clientX}px`;
            dot.style.top = `${e.clientY}px`;
            dot.style.background = colors[stRand(colors.length)];
            el.appendChild(dot);
            big.textContent = 'ESSE DEDO!';
            sub.textContent = 'O mais rápido começa.';
            audioManager.play('turn');
            try { navigator.vibrate?.([30, 40, 90]); } catch { /* ignore */ }
            out.innerHTML = stActions(arm);
            stBindActions(out, () => { phase = 'idle'; arm(); });
        }
    });
}
