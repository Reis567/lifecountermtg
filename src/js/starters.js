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
let stOverlay = null;
let stTimers = [];
function stPlayers() {
    return gameState.getState().players.map((p) => ({ id: p.id, name: p.name, color: p.color, avatar: p.avatar }));
}
function stRand(max) {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const a = new Uint32Array(1);
        crypto.getRandomValues(a);
        return Math.floor((a[0] / (0xFFFFFFFF + 1)) * max);
    }
    return Math.floor(Math.random() * max);
}
function stLater(fn, ms) {
    stTimers.push(window.setTimeout(fn, ms));
}
export function stClose() {
    stTimers.forEach((t) => clearTimeout(t));
    stTimers = [];
    stOverlay?.remove();
    stOverlay = null;
}
function stOpen(extraClass = '') {
    stClose();
    const el = document.createElement('div');
    el.className = `st-overlay ${extraClass}`;
    el.innerHTML = '<button type="button" class="st-close" aria-label="Fechar">&times;</button>';
    el.querySelector('.st-close')?.addEventListener('click', (e) => { e.stopPropagation(); stClose(); });
    document.body.appendChild(el);
    stOverlay = el;
    return el;
}
function stResultHtml(p, title) {
    return `
        <div class="st-result">
            <div class="st-result-name">
                ${avatarHtml({ name: p.name, photo_url: p.avatar, color: p.color }, 'lc-avatar')}
                <div>${escapeHtml(p.name)} começa!</div>
            </div>
        </div>
        <div class="st-sub">${escapeHtml(title)}</div>`;
}
function stActions(onAgain) {
    return `
        <div class="st-actions">
            <button type="button" class="st-btn" data-st="again">De novo</button>
            <button type="button" class="st-btn st-btn-primary" data-st="done">Fechar</button>
        </div>`;
}
function stBindActions(root, onAgain) {
    root.querySelector('[data-st="again"]')?.addEventListener('click', (e) => { e.stopPropagation(); onAgain(); });
    root.querySelector('[data-st="done"]')?.addEventListener('click', (e) => { e.stopPropagation(); stClose(); });
}
function stMarkActive(p) {
    // Deixa o sorteado como jogador ativo (igual ao Sorteio dos cards).
    const idx = gameState.getState().players.findIndex((x) => x.id === p.id);
    if (idx >= 0)
        gameState.setActivePlayer(idx);
}
// ---------------------------------------------------------------- Roleta
export function openRouletteStarter() {
    const players = stPlayers();
    if (players.length < 2)
        return;
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
    const wheel = el.querySelector('#st-wheel');
    const out = el.querySelector('#st-out');
    const sub = el.querySelector('#st-sub');
    let spinning = false;
    let angle = 0;
    const spin = () => {
        if (spinning)
            return;
        spinning = true;
        out.innerHTML = '';
        sub.textContent = 'Girando…';
        const winner = stRand(n);
        // Ângulo final: o centro do setor vencedor tem que ficar embaixo do ponteiro (topo).
        const sectorDeg = 360 / n;
        const target = 360 - (winner * sectorDeg + sectorDeg / 2) + (stRand(Math.floor(sectorDeg * 0.6)) - sectorDeg * 0.3);
        angle += 360 * (5 + stRand(3)) + ((target - (angle % 360) + 360) % 360);
        wheel.style.transform = `rotate(${angle}deg)`;
        audioManager.play('click');
        stLater(() => {
            spinning = false;
            const p = players[winner];
            audioManager.play('turn');
            try {
                navigator.vibrate?.([40, 60, 80]);
            }
            catch { /* ignore */ }
            sub.textContent = '';
            out.innerHTML = stResultHtml(p, 'A roleta decidiu') + stActions(spin);
            stBindActions(out, spin);
            stMarkActive(p);
        }, 4300);
    };
    el.querySelector('.st-wheel-wrap')?.addEventListener('click', spin);
}
// ---------------------------------------------------------- Dado de cada um
export function openDiceStarter() {
    const players = stPlayers();
    if (players.length < 2)
        return;
    const el = stOpen();
    el.insertAdjacentHTML('beforeend', `
        <div class="st-title">Dado de cada um</div>
        <div class="st-sub" id="st-sub">Cada jogador rola um d20 · maior começa</div>
        <div class="st-dice-list" id="st-dice"></div>
        <div id="st-out"><div class="st-actions"><button type="button" class="st-btn st-btn-primary" id="st-roll">Rolar todos</button></div></div>`);
    const list = el.querySelector('#st-dice');
    const out = el.querySelector('#st-out');
    const sub = el.querySelector('#st-sub');
    let alive = players.slice();
    const vals = new Map();
    const render = () => {
        list.innerHTML = players.map((p) => `
            <div class="st-die ${alive.includes(p) ? '' : 'out'}" data-id="${p.id}">
                ${avatarHtml({ name: p.name, photo_url: p.avatar, color: p.color }, 'lc-avatar')}
                <div class="st-die-name">${escapeHtml(p.name)}</div>
                <div class="st-die-val">${vals.has(p.id) ? vals.get(p.id) : '–'}</div>
            </div>`).join('');
    };
    const roll = () => {
        out.innerHTML = '';
        alive.forEach((p) => vals.delete(p.id));
        render();
        const dies = alive.map((p) => list.querySelector(`.st-die[data-id="${p.id}"]`));
        dies.forEach((d) => d.classList.add('rolling'));
        audioManager.play('click');
        // Números piscando por ~1,4 s, depois cada um "para" em sequência.
        const tick = window.setInterval(() => {
            dies.forEach((d) => { const v = d.querySelector('.st-die-val'); if (v)
                v.textContent = String(1 + stRand(20)); });
        }, 70);
        stTimers.push(tick);
        stLater(() => {
            clearInterval(tick);
            alive.forEach((p, i) => {
                stLater(() => {
                    const v = 1 + stRand(20);
                    vals.set(p.id, v);
                    const d = dies[i];
                    d.classList.remove('rolling');
                    const ve = d.querySelector('.st-die-val');
                    if (ve)
                        ve.textContent = String(v);
                    audioManager.play('click');
                    if (i === alive.length - 1)
                        stLater(finish, 450);
                }, 260 * i);
            });
        }, 1400);
    };
    const finish = () => {
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
        try {
            navigator.vibrate?.([40, 60, 80]);
        }
        catch { /* ignore */ }
        sub.textContent = '';
        out.innerHTML = stResultHtml(p, `Tirou ${best} no d20`) + stActions(() => { alive = players.slice(); vals.clear(); roll(); });
        stBindActions(out, () => { alive = players.slice(); vals.clear(); render(); roll(); });
        stMarkActive(p);
    };
    render();
    el.querySelector('#st-roll')?.addEventListener('click', roll);
}
// ------------------------------------------------- Áreas por jogador (zonas)
// Reflexo e Corrida de toques dividem a tela em uma área por jogador (cor e
// nome de cada um), que funciona bem com o celular deitado no meio da mesa.
function stZonesHtml(players) {
    const n = players.length;
    const cols = n <= 2 ? n : n <= 6 ? Math.ceil(n / 2) : Math.ceil(n / 3);
    return `<div class="st-zones" style="--cols:${cols}">${players.map((p) => `
        <div class="st-zone" data-id="${p.id}" style="--zc:${p.color}">
            ${avatarHtml({ name: p.name, photo_url: p.avatar, color: p.color }, 'lc-avatar st-zone-avatar')}
            <div class="st-zone-name">${escapeHtml(p.name)}</div>
            <div class="st-zone-sub" data-sub="${p.id}"></div>
        </div>`).join('')}</div>`;
}
function stZoneOf(e) {
    return e.target.closest('.st-zone');
}
// ------------------------------------------------------------------ Reflexo
// Cada um deixa o dedo perto da própria área. A tela conta 3-2-1, fica vermelha
// ("esperem") e, num momento aleatório, VERDE: o primeiro a tocar na própria
// área começa. Quem toca antes do verde queima a largada (e o jogo recomeça).
export function openReflexStarter() {
    const players = stPlayers();
    if (players.length < 2)
        return;
    const el = stOpen('st-zoned st-reflex');
    el.insertAdjacentHTML('beforeend', `
        <div class="st-zoned-top">
            <div class="st-title">Reflexo</div>
            <div class="st-sub" id="st-sub">Cada um perto da sua área. Toque em qualquer lugar pra começar.</div>
        </div>
        ${stZonesHtml(players)}
        <div class="st-banner" id="st-banner"></div>
        <div class="st-zoned-bottom" id="st-out"></div>`);
    const sub = el.querySelector('#st-sub');
    const banner = el.querySelector('#st-banner');
    const out = el.querySelector('#st-out');
    let phase = 'idle';
    const setBanner = (txt, cls = '') => { banner.textContent = txt; banner.className = `st-banner ${cls} ${txt ? 'on' : ''}`; };
    const reset = () => {
        el.querySelectorAll('.st-zone').forEach((z) => z.classList.remove('winner', 'early', 'dim'));
        el.classList.remove('wait', 'go', 'early');
        out.innerHTML = '';
        setBanner('');
    };
    const arm = () => {
        reset();
        phase = 'count';
        sub.textContent = 'Preparar…';
        const steps = ['3', '2', '1'];
        steps.forEach((s, i) => stLater(() => { if (phase === 'count') {
            setBanner(s);
            audioManager.play('click');
        } }, 600 * i));
        stLater(() => {
            if (phase !== 'count')
                return;
            phase = 'wait';
            el.classList.add('wait');
            setBanner('ESPEREM…', 'wait');
            sub.textContent = 'Vermelho: dedo parado. Verde: toque na SUA área.';
            stLater(() => {
                if (phase !== 'wait')
                    return;
                phase = 'go';
                el.classList.remove('wait');
                el.classList.add('go');
                setBanner('AGORA!', 'go');
                audioManager.play('turn');
                try {
                    navigator.vibrate?.(60);
                }
                catch { /* ignore */ }
            }, 1500 + stRand(3500));
        }, 600 * steps.length);
    };
    el.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.st-close, .st-btn'))
            return;
        if (phase === 'idle') {
            arm();
            return;
        }
        const zone = stZoneOf(e);
        if (!zone)
            return;
        const p = players.find((x) => x.id === zone.dataset.id);
        if (phase === 'wait' || phase === 'count') {
            phase = 'done';
            el.classList.remove('wait');
            el.classList.add('early');
            zone.classList.add('early');
            setBanner(`${p.name} queimou a largada!`, 'early');
            sub.textContent = 'Recomeçando…';
            audioManager.play('damage');
            try {
                navigator.vibrate?.([80, 60, 80]);
            }
            catch { /* ignore */ }
            stLater(() => { phase = 'idle'; arm(); }, 1800);
            return;
        }
        if (phase === 'go') {
            phase = 'done';
            el.classList.remove('go');
            el.querySelectorAll('.st-zone').forEach((z) => z.classList.toggle('dim', z !== zone));
            zone.classList.add('winner');
            setBanner(`${p.name} começa!`, 'win');
            sub.textContent = 'Reflexo mais rápido da mesa.';
            audioManager.play('turn');
            try {
                navigator.vibrate?.([30, 40, 90]);
            }
            catch { /* ignore */ }
            out.innerHTML = stActions(arm);
            stBindActions(out, () => { phase = 'idle'; arm(); });
            stMarkActive(p);
        }
    });
}
// --------------------------------------------------------- Corrida de toques
// 5 segundos: cada um toca na própria área o mais rápido que conseguir. Quem
// tocar mais vezes começa.
export function openTapRaceStarter() {
    const players = stPlayers();
    if (players.length < 2)
        return;
    const el = stOpen('st-zoned st-race');
    el.insertAdjacentHTML('beforeend', `
        <div class="st-zoned-top">
            <div class="st-title">Corrida de toques</div>
            <div class="st-sub" id="st-sub">5 segundos: toque na SUA área o mais rápido que der. Toque em qualquer lugar pra começar.</div>
        </div>
        ${stZonesHtml(players)}
        <div class="st-banner" id="st-banner"></div>
        <div class="st-zoned-bottom" id="st-out"></div>`);
    const sub = el.querySelector('#st-sub');
    const banner = el.querySelector('#st-banner');
    const out = el.querySelector('#st-out');
    const counts = new Map();
    let phase = 'idle';
    const DURATION = 5000;
    const setBanner = (txt, cls = '') => { banner.textContent = txt; banner.className = `st-banner ${cls} ${txt ? 'on' : ''}`; };
    const paint = () => {
        players.forEach((p) => {
            const s = el.querySelector(`[data-sub="${p.id}"]`);
            if (s)
                s.textContent = `${counts.get(p.id) || 0}`;
        });
    };
    const start = () => {
        el.querySelectorAll('.st-zone').forEach((z) => z.classList.remove('winner', 'dim', 'tied'));
        out.innerHTML = '';
        counts.clear();
        paint();
        phase = 'count';
        ['3', '2', '1'].forEach((s, i) => stLater(() => { if (phase === 'count') {
            setBanner(s);
            audioManager.play('click');
        } }, 600 * i));
        stLater(() => {
            if (phase !== 'count')
                return;
            phase = 'run';
            el.classList.add('go');
            setBanner('VAI!', 'go');
            sub.textContent = 'Toca, toca, toca!';
            audioManager.play('turn');
            const t0 = Date.now();
            const tick = window.setInterval(() => {
                const left = Math.max(0, DURATION - (Date.now() - t0));
                setBanner(`${(left / 1000).toFixed(1)} s`, 'go');
                if (left <= 0) {
                    clearInterval(tick);
                    finish();
                }
            }, 100);
            stTimers.push(tick);
        }, 1800);
    };
    const finish = () => {
        phase = 'done';
        el.classList.remove('go');
        const best = Math.max(...players.map((p) => counts.get(p.id) || 0));
        const top = players.filter((p) => (counts.get(p.id) || 0) === best);
        if (best === 0 || top.length > 1) {
            top.forEach((p) => el.querySelector(`.st-zone[data-id="${p.id}"]`)?.classList.add('tied'));
            setBanner(best === 0 ? 'Ninguém tocou!' : `Empate em ${best}!`, 'early');
            sub.textContent = 'De novo?';
            out.innerHTML = stActions(start);
            stBindActions(out, start);
            return;
        }
        const p = top[0];
        el.querySelectorAll('.st-zone').forEach((z) => z.classList.toggle('dim', z.dataset.id !== p.id));
        el.querySelector(`.st-zone[data-id="${p.id}"]`)?.classList.add('winner');
        setBanner(`${p.name} começa!`, 'win');
        sub.textContent = `${best} toques em 5 segundos.`;
        audioManager.play('turn');
        try {
            navigator.vibrate?.([30, 40, 90]);
        }
        catch { /* ignore */ }
        out.innerHTML = stActions(start);
        stBindActions(out, start);
        stMarkActive(p);
    };
    el.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.st-close, .st-btn'))
            return;
        if (phase === 'idle') {
            start();
            return;
        }
        if (phase !== 'run')
            return;
        const zone = stZoneOf(e);
        if (!zone)
            return;
        const id = zone.dataset.id;
        counts.set(id, (counts.get(id) || 0) + 1);
        zone.classList.add('pulse');
        window.setTimeout(() => zone.classList.remove('pulse'), 90);
        paint();
    });
}
// ----------------------------------------------------------- Mata-mata (moeda)
// Eliminatória: a cada rodada, uma moeda tira um jogador. Quem sobrar começa.
export function openBracketStarter() {
    const players = stPlayers();
    if (players.length < 2)
        return;
    const el = stOpen();
    el.insertAdjacentHTML('beforeend', `
        <div class="st-title">Mata-mata</div>
        <div class="st-sub" id="st-sub">A cada rodada a moeda elimina um. Quem sobrar começa.</div>
        <div class="st-bracket" id="st-bracket"></div>
        <div class="st-coin-wrap" id="st-coin"><div class="st-coin"><div class="st-coin-face st-coin-a"></div><div class="st-coin-face st-coin-b"></div></div></div>
        <div id="st-out"><div class="st-actions"><button type="button" class="st-btn st-btn-primary" id="st-flip">Jogar a moeda</button></div></div>`);
    const sub = el.querySelector('#st-sub');
    const list = el.querySelector('#st-bracket');
    const coinWrap = el.querySelector('#st-coin');
    const coin = el.querySelector('.st-coin');
    const out = el.querySelector('#st-out');
    let alive = players.slice();
    let flipping = false;
    const render = () => {
        list.innerHTML = players.map((p) => `
            <div class="st-brk ${alive.includes(p) ? '' : 'out'}" data-id="${p.id}">
                ${avatarHtml({ name: p.name, photo_url: p.avatar, color: p.color }, 'lc-avatar')}
                <span>${escapeHtml(p.name)}</span>
            </div>`).join('');
    };
    const flip = () => {
        if (flipping || alive.length < 2)
            return;
        flipping = true;
        out.innerHTML = '';
        // Duelo: dois da vez (os dois primeiros vivos, rotacionando); perdedor sai.
        const a = alive[0], b = alive[1];
        const faceA = coinWrap.querySelector('.st-coin-a');
        const faceB = coinWrap.querySelector('.st-coin-b');
        faceA.style.background = a.color;
        faceA.textContent = a.name.slice(0, 2).toUpperCase();
        faceB.style.background = b.color;
        faceB.textContent = b.name.slice(0, 2).toUpperCase();
        sub.textContent = `${a.name} × ${b.name}`;
        const loserIsA = stRand(2) === 0;
        // Gira várias voltas e para na face do VENCEDOR.
        const turns = 5 + stRand(3);
        const end = turns * 360 + (loserIsA ? 180 : 0);
        coin.style.transition = 'none';
        coin.style.transform = 'rotateY(0deg)';
        void coin.offsetWidth;
        coin.style.transition = 'transform 1.8s cubic-bezier(0.2, 0.8, 0.2, 1)';
        coin.style.transform = `rotateY(${end}deg)`;
        audioManager.play('click');
        stLater(() => {
            const loser = loserIsA ? a : b;
            const winner = loserIsA ? b : a;
            alive = alive.filter((p) => p !== loser);
            // vencedor vai pro fim da fila (duela de novo só quando precisar)
            alive = alive.filter((p) => p !== winner).concat(winner);
            render();
            audioManager.play('damage');
            flipping = false;
            if (alive.length === 1) {
                const p = alive[0];
                sub.textContent = '';
                out.innerHTML = stResultHtml(p, 'Sobreviveu ao mata-mata') + stActions(() => { alive = players.slice(); render(); });
                stBindActions(out, () => { alive = players.slice(); render(); sub.textContent = 'A cada rodada a moeda elimina um. Quem sobrar começa.'; out.innerHTML = `<div class="st-actions"><button type="button" class="st-btn st-btn-primary" id="st-flip">Jogar a moeda</button></div>`; out.querySelector('#st-flip')?.addEventListener('click', flip); });
                stMarkActive(p);
            }
            else {
                sub.textContent = `${loser.name} caiu! Faltam ${alive.length}.`;
                out.innerHTML = `<div class="st-actions"><button type="button" class="st-btn st-btn-primary" id="st-flip">Próxima moeda</button></div>`;
                out.querySelector('#st-flip')?.addEventListener('click', flip);
            }
        }, 1900);
    };
    render();
    el.querySelector('#st-flip')?.addEventListener('click', flip);
}
//# sourceMappingURL=starters.js.map