// ===== Comando de vida por voz =====
// "fulano menos três" -> aplica -3 ao jogador. Mãos livres durante a partida.
// No navegador usa a Web Speech API. No APK Android usa uma ponte nativa
// (window.LCVoice + window.__lcVoiceResult) porque o WebView não tem Web Speech.
import { gameState } from './state.js';
// ----- Estado -----
let vcActive = false; // microfone ligado
let vcArmed = false; // comandos ativos (depois de "life counter")
let vcLastCmdKey = ''; // dedup: último comando aplicado
let vcLastCmdAt = 0;
let vcAutoTried = false; // já tentou ligar sozinho nesta sessão
let vcRec = null; // SpeechRecognition (web)
let vcOverlay = null;
let vcActions = {};
// ----- Detecção de suporte -----
function vcWebSpeech() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}
function vcNativeBridge() {
    return window.LCVoice || null;
}
export function vcSupported() {
    return !!vcNativeBridge() || !!vcWebSpeech();
}
// ----- Normalização / parsing -----
function vcNorm(s) {
    return (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // tira acentos
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
const VC_UNITS = {
    zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
    seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
    quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
    dezoito: 18, dezenove: 19,
};
const VC_TENS = {
    vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
    setenta: 70, oitenta: 80, noventa: 90,
};
const VC_MINUS = ['menos', 'perde', 'perdeu', 'perder', 'tomou', 'toma', 'tomar', 'dano', 'leva', 'levou', 'tira', 'tirar', 'tirou', 'baixa', 'diminui', 'caiu'];
const VC_PLUS = ['mais', 'ganha', 'ganhou', 'ganhar', 'soma', 'somar', 'cura', 'curou', 'curar', 'recupera', 'recuperou', 'sobe', 'aumenta', 'subiu'];
const VC_SET = ['vida', 'igual', 'fica', 'define', 'definir', 'setar', 'seta', 'vale'];
// Converte palavras-número em dígitos: "jogador um mais dois" -> "jogador 1 mais 2",
// "menos vinte e um" -> "menos 21". Resolve nomes com número ("Jogador 1") ditos por extenso.
function vcDigitize(text) {
    const tokens = text.split(' ').filter(Boolean);
    const out = [];
    let i = 0;
    while (i < tokens.length) {
        const t = tokens[i];
        if (t in VC_TENS) {
            let val = VC_TENS[t];
            let consumed = 1;
            let j = i + 1;
            if (tokens[j] === 'e')
                j++;
            if (tokens[j] !== undefined && tokens[j] in VC_UNITS) {
                val += VC_UNITS[tokens[j]];
                consumed = (j - i) + 1;
            }
            out.push(String(val));
            i += consumed;
        }
        else if (t in VC_UNITS) {
            out.push(String(VC_UNITS[t]));
            i++;
        }
        else if (t === 'cem' || t === 'cento') {
            out.push('100');
            i++;
        }
        else {
            out.push(t);
            i++;
        }
    }
    return out.join(' ');
}
function vcMatchPlayer(text) {
    const players = gameState.getState().players;
    let best = null;
    // 1) nome completo (já em dígitos) como substring (ex.: "jogador 1", "joao silva")
    for (const p of players) {
        const n = vcDigitize(vcNorm(p.name));
        if (n && text.includes(n) && (!best || n.length > best.matched.length)) {
            best = { id: p.id, matched: n };
        }
    }
    if (best)
        return best;
    // 2) qualquer palavra do nome com 2+ letras (evita casar com o dígito do nome)
    const tokens = text.split(' ');
    for (const p of players) {
        for (const w of vcDigitize(vcNorm(p.name)).split(' ')) {
            if (w.length >= 2 && /[a-z]/.test(w) && tokens.includes(w) && (!best || w.length > best.matched.length)) {
                best = { id: p.id, matched: w };
            }
        }
    }
    return best;
}
// Dano de comandante: "<alvo> <N> de comandante do <fonte>"
// ex.: "jogador 1 15 de comandante do jogador 2", "jose 10 de comandante do reis".
function vcParseCommander(tokens, idx) {
    const beforeText = tokens.slice(0, idx).join(' ');
    const after = tokens.slice(idx + 1);
    const preps = ['do', 'da', 'de', 'dos', 'das', 'o', 'a'];
    while (after.length && preps.includes(after[0]))
        after.shift();
    const sourceText = after.join(' ');
    const target = vcMatchPlayer(beforeText);
    const source = vcMatchPlayer(sourceText);
    if (!target || !source || target.id === source.id)
        return null;
    const restBefore = beforeText.replace(target.matched, ' ');
    const m = restBefore.match(/\d+/); // quantidade (depois de tirar o nome do alvo)
    if (!m)
        return null;
    return { commander: { targetId: target.id, sourceId: source.id, amount: parseInt(m[0], 10) } };
}
// ----- Reconhecimento de tema / música / dado / contador -----
const VC_THEME = [
    [/escur|dark|noturno/, 'dark'],
    [/casual|claro|padrao|normal/, 'casual'],
    [/streamer|transmiss|live/, 'streamer'],
    [/contraste/, 'high-contrast'],
    [/branco/, 'mana-white'],
    [/azul/, 'mana-blue'],
    [/preto|preta/, 'mana-black'],
    [/vermelh/, 'mana-red'],
    [/verde/, 'mana-green'],
];
function vcTheme(text) {
    for (const [re, val] of VC_THEME)
        if (re.test(text))
            return val;
    return null;
}
const VC_MUSIC = [
    [/parar|sem musica|deslig|silencio|nenhuma|para a musica/, 'none'],
    [/epic|epica/, 'epic'],
    [/sombri|soturna|tensa|dark/, 'dark'],
    [/natur|floresta/, 'nature'],
    [/mistic|misteri|mystical/, 'mystical'],
];
function vcMusic(text) {
    for (const [re, val] of VC_MUSIC)
        if (re.test(text))
            return val;
    return 'epic';
}
function vcDice(text) {
    if (/moeda|cara ou coroa|cara e coroa/.test(text))
        return 'coin';
    if (/planar/.test(text))
        return 'planar';
    const dm = text.match(/\bd\s?(\d{1,3})\b/) || text.match(/\b(\d{1,3})\b/);
    if (dm && ['4', '6', '8', '10', '12', '20', '100'].includes(dm[1]))
        return dm[1];
    return '20';
}
function vcCounterType(text) {
    if (/veneno|poison|envenen/.test(text))
        return 'poison';
    if (/energia|energy/.test(text))
        return 'energy';
    if (/experiencia|experience|\bexp\b/.test(text))
        return 'experience';
    if (/storm|tempestade/.test(text))
        return 'storm';
    return null;
}
// Comandos que não dependem de um jogador específico.
function vcParseGlobal(text) {
    if (text.includes('tema')) {
        const t = vcTheme(text);
        if (t)
            return { theme: t };
    }
    if (/musica|trilha|som ambiente/.test(text))
        return { music: vcMusic(text) };
    if (/\b(rola|rolar|dado|dados|moeda)\b/.test(text) || /\bd\d{1,3}\b/.test(text) || /cara ou coroa/.test(text)) {
        return { dice: vcDice(text) };
    }
    if (/quem comeca|sortear inicial|quem inicia|quem joga primeiro/.test(text)
        || (/sorteia|sortear|sorteio/.test(text) && /comeca|inicio|primeiro/.test(text))) {
        return { action: 'randomStarter' };
    }
    if (/viado/.test(text))
        return { action: 'viado' };
    if (/proximo turno|passa o turno|passar o turno|passa a vez|passar a vez|proxima vez|vira o turno/.test(text)) {
        return { action: 'nextTurn' };
    }
    if (/\bdesfaz|desfazer\b/.test(text))
        return { action: 'undo' };
    if (/\btodos\b|todo mundo|\bgeral\b|mesa toda/.test(text)) {
        const sign = /menos|perde|tira|dano|leva/.test(text) ? -1 : (/mais|ganha|cura|sobe/.test(text) ? 1 : 0);
        const m = text.match(/\d+/);
        if (sign !== 0 && m)
            return { massLife: sign * parseInt(m[0], 10) };
    }
    return null;
}
function vcParse(raw) {
    // Converte palavras-número em dígitos PRIMEIRO (nome "jogador 1"/"jogador um" sai inteiro).
    const text = vcDigitize(vcNorm(raw));
    if (!text)
        return null;
    // 1) Comandos globais (sem jogador): tema, música, dado, sorteio, viado, turno, desfazer, massa.
    const global = vcParseGlobal(text);
    if (global)
        return global;
    // 2) Dano de comandante.
    const cmdIdx = text.split(' ').indexOf('comandante');
    if (cmdIdx !== -1)
        return vcParseCommander(text.split(' '), cmdIdx);
    // 3) Morte: "A matou B" -> B morre (por A); "fulano morre/morreu".
    if (text.includes('matou') || text.includes('mataram')) {
        const sep = text.includes('mataram') ? 'mataram' : 'matou';
        const parts = text.split(sep);
        const killer = vcMatchPlayer(parts[0] || '');
        const victim = vcMatchPlayer(parts[1] || '');
        if (victim) {
            const killerId = killer && killer.id !== victim.id ? killer.id : undefined;
            return { death: { targetId: victim.id, killerId } };
        }
        return null;
    }
    if (/\bmorr|\bmorto\b|\bmorta\b|elimin/.test(text)) {
        const dead = vcMatchPlayer(text);
        if (dead)
            return { death: { targetId: dead.id } };
        return null;
    }
    // 4) Monarca: "monarca pro fulano" / "coroa pro fulano"; "tira o monarca" remove.
    if (/monarc|coroa/.test(text)) {
        if (/tira|sem |remove|remova|sai /.test(text))
            return { monarch: { remove: true } };
        const mp = vcMatchPlayer(text);
        if (mp)
            return { monarch: { playerId: mp.id } };
        return null;
    }
    // 5) A partir daqui precisa de um jogador.
    const player = vcMatchPlayer(text);
    if (!player)
        return null;
    // 6) Contador (veneno / energia / experiência / storm).
    const ctype = vcCounterType(text);
    if (ctype) {
        const restc = text.replace(player.matched, ' ');
        const csign = /menos|tira|remove|cura|tirar/.test(restc) ? -1 : 1;
        const cm = restc.match(/\d+/);
        const camount = (cm ? parseInt(cm[0], 10) : 1) * csign;
        return { counter: { playerId: player.id, type: ctype, amount: camount } };
    }
    // 7) Vida (delta ou definir).
    const rest = text.replace(player.matched, ' ').replace(/\s+/g, ' ').trim();
    const tokens = rest.split(' ');
    let sign = 0;
    let isSet = false;
    for (const t of tokens) {
        if (VC_MINUS.includes(t))
            sign = -1;
        else if (VC_PLUS.includes(t))
            sign = 1;
        else if (VC_SET.includes(t))
            isSet = true;
    }
    const m = rest.match(/\d+/);
    if (!m)
        return null;
    const num = parseInt(m[0], 10);
    if (isSet && sign === 0)
        return { playerId: player.id, setValue: num };
    if (sign === 0)
        return null;
    return { playerId: player.id, delta: sign * num };
}
// ----- Aplicação -----
function vcApply(cmd) {
    const players = gameState.getState().players;
    // Ações de UI (delegadas ao ui.ts).
    if (cmd.action) {
        if (cmd.action === 'randomStarter') {
            vcActions.randomStarter?.();
            vcToast('🎲 Sorteando quem começa', true);
        }
        else if (cmd.action === 'viado') {
            vcActions.viado?.();
            vcToast('🏳️‍🌈 Sorteando o viado', true);
        }
        else if (cmd.action === 'undo') {
            vcActions.undo?.();
            vcToast('↩️ Desfeito', true);
        }
        else if (cmd.action === 'nextTurn') {
            vcActions.nextTurn?.();
            vcToast('▶️ Próximo turno', true);
        }
        return;
    }
    if (cmd.theme) {
        vcActions.theme?.(cmd.theme);
        vcToast('🎨 Tema alterado', true);
        return;
    }
    if (cmd.music) {
        vcActions.music?.(cmd.music);
        vcToast(cmd.music === 'none' ? '🔇 Música parada' : '🎵 Música trocada', true);
        return;
    }
    if (cmd.dice) {
        vcActions.dice?.(cmd.dice);
        vcToast(`🎲 Rolando ${cmd.dice === 'coin' ? 'moeda' : 'd' + cmd.dice}`, true);
        return;
    }
    if (cmd.monarch) {
        if (cmd.monarch.remove) {
            gameState.removeMonarch();
            vcToast('👑 Sem monarca', true);
        }
        else if (cmd.monarch.playerId) {
            gameState.setMonarch(cmd.monarch.playerId);
            const mp = players.find((p) => p.id === cmd.monarch.playerId);
            vcToast(`👑 ${mp?.name} é o monarca`, true);
        }
        try {
            navigator.vibrate?.(40);
        }
        catch { /* ignore */ }
        return;
    }
    if (cmd.counter) {
        gameState.changeCounter(cmd.counter.playerId, cmd.counter.type, cmd.counter.amount);
        const cp = players.find((p) => p.id === cmd.counter.playerId);
        const icons = { poison: '☠️', energy: '⚡', experience: '⭐', storm: '🌪️' };
        vcToast(`${icons[cmd.counter.type] || ''} ${cp?.name} ${cmd.counter.amount > 0 ? '+' : ''}${cmd.counter.amount}`, true);
        try {
            navigator.vibrate?.(40);
        }
        catch { /* ignore */ }
        return;
    }
    if (cmd.massLife !== undefined) {
        players.filter((p) => !p.isEliminated).forEach((p) => gameState.changeLife(p.id, cmd.massLife));
        vcToast(`Todos ${cmd.massLife > 0 ? '+' : ''}${cmd.massLife}`, true);
        try {
            navigator.vibrate?.(40);
        }
        catch { /* ignore */ }
        return;
    }
    // Morte / "matou" — vai pro histórico (player_eliminated) e dispara som/roast.
    if (cmd.death) {
        const victim = players.find((p) => p.id === cmd.death.targetId);
        const killer = cmd.death.killerId ? players.find((p) => p.id === cmd.death.killerId) : null;
        gameState.eliminatePlayer(cmd.death.targetId, killer ? `morto por ${killer.name}` : 'morreu');
        vcToast(`💀 ${victim?.name}${killer ? ` (por ${killer.name})` : ' morreu'}`, true);
        try {
            navigator.vibrate?.(60);
        }
        catch { /* ignore */ }
        return;
    }
    // Dano de comandante (já reduz vida e checa eliminação no state).
    if (cmd.commander) {
        const { targetId, sourceId, amount } = cmd.commander;
        gameState.addCommanderDamage(targetId, sourceId, amount);
        const t = players.find((p) => p.id === targetId);
        const s = players.find((p) => p.id === sourceId);
        vcToast(`${t?.name} ⚔️ ${amount} de comandante de ${s?.name}`, true);
        try {
            navigator.vibrate?.(40);
        }
        catch { /* ignore */ }
        return;
    }
    const player = players.find((p) => p.id === cmd.playerId);
    if (!player || !cmd.playerId)
        return;
    if (cmd.setValue !== undefined) {
        gameState.setLife(cmd.playerId, cmd.setValue);
    }
    else if (cmd.delta !== undefined) {
        gameState.changeLife(cmd.playerId, cmd.delta);
    }
    const novo = gameState.getState().players.find((p) => p.id === cmd.playerId)?.life;
    const txt = cmd.setValue !== undefined
        ? `${player.name} = ${cmd.setValue}`
        : `${player.name} ${cmd.delta > 0 ? '+' : ''}${cmd.delta} → ${novo}`;
    vcToast(txt, true);
    try {
        navigator.vibrate?.(40);
    }
    catch { /* ignore */ }
}
// Palavra-chave de ativação. O reconhecedor é pt-BR, então "life counter" (inglês)
// costuma sair mastigado — por isso "contador" (PT) é o gatilho confiável, com
// "life counter" e variantes como alternativa. Desarma com "tchau"/"fechar"/"parar".
const VC_WAKE = /(life|laife|laif|laifi|lifi|live|leite)\s*(counter|conter|caunter|kaunter|county|conta)|contad/;
const VC_BYE = /\b(tchau|chau|xau|adeus|fechar|fecha|parar|para|encerra|desativa)\b/;
function vcHandleTranscript(raw, final) {
    vcSetHeard(raw);
    if (!final)
        return;
    const n = vcNorm(raw);
    // Palavra-chave tem prioridade sobre comandos.
    if (VC_WAKE.test(n)) {
        if (VC_BYE.test(n))
            vcDisarm();
        else
            vcArm();
        return;
    }
    if (!vcArmed)
        return; // modo ambiente: só age depois de ouvir "life counter"
    const cmd = vcParse(raw);
    if (!cmd) {
        vcSetHeard(`"${raw}" — não entendi`);
        return;
    }
    // Dedup: o reconhecedor às vezes entrega o mesmo final 2x (causava aplicar em dobro).
    const key = vcCmdKey(cmd);
    const now = Date.now();
    if (key === vcLastCmdKey && now - vcLastCmdAt < 1500)
        return;
    vcLastCmdKey = key;
    vcLastCmdAt = now;
    vcApply(cmd);
}
function vcCmdKey(cmd) {
    if (cmd.action)
        return `ac:${cmd.action}`;
    if (cmd.theme)
        return `th:${cmd.theme}`;
    if (cmd.music)
        return `mu:${cmd.music}`;
    if (cmd.dice)
        return `di:${cmd.dice}`;
    if (cmd.monarch)
        return `mo:${cmd.monarch.remove ? 'rm' : cmd.monarch.playerId}`;
    if (cmd.counter)
        return `ct:${cmd.counter.playerId}:${cmd.counter.type}:${cmd.counter.amount}`;
    if (cmd.massLife !== undefined)
        return `ml:${cmd.massLife}`;
    if (cmd.death)
        return `k:${cmd.death.targetId}`;
    if (cmd.commander)
        return `c:${cmd.commander.targetId}:${cmd.commander.sourceId}:${cmd.commander.amount}`;
    if (cmd.setValue !== undefined)
        return `s:${cmd.playerId}:${cmd.setValue}`;
    return `d:${cmd.playerId}:${cmd.delta}`;
}
// ===== UI =====
export function setupVoiceControl(actions = {}) {
    vcActions = actions;
    if (!vcSupported()) {
        // Sem reconhecimento de voz (ex.: web sem suporte): esconde os botões.
        ['voice-btn', 'voice-btn-left'].forEach((id) => {
            const b = document.getElementById(id);
            if (b)
                b.style.display = 'none';
        });
        return;
    }
    document.getElementById('voice-btn')?.addEventListener('click', () => vcToggle());
    document.getElementById('voice-btn-left')?.addEventListener('click', () => vcToggle());
    window.__lcVoiceResult = (txt, final) => vcHandleTranscript(txt, final !== false);
    // Diagnóstico: a ponte nativa manda status/erros do reconhecedor pra aparecer no overlay.
    window.__lcVoiceStatus = (msg) => { if (!vcArmed)
        vcSetHeard(msg); };
}
export function vcToggle() {
    if (vcActive)
        vcStop();
    else
        vcStart();
}
// Liga a escuta automaticamente (1x por sessão) ao entrar na partida, para o
// "contador" funcionar sem abrir o menu. No web, só vinga se chamado dentro de
// um gesto do usuário (o clique em "Iniciar Partida"); no APK funciona sempre.
export function maybeAutoStartVoice() {
    if (vcAutoTried || vcActive || !vcSupported())
        return;
    vcAutoTried = true;
    vcStart();
}
function vcStart() {
    if (vcActive)
        return;
    vcActive = true;
    vcArmed = false;
    vcShowOverlay();
    vcBtnClass(true, false);
    const native = vcNativeBridge();
    if (native) {
        try {
            native.start();
        }
        catch (e) {
            console.warn('Voice native start error', e);
        }
        return;
    }
    const SR = vcWebSpeech();
    if (!SR) {
        vcStop();
        return;
    }
    vcRec = new SR();
    vcRec.lang = 'pt-BR';
    vcRec.continuous = true;
    vcRec.interimResults = true;
    vcRec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            vcHandleTranscript(r[0].transcript, r.isFinal);
        }
    };
    vcRec.onend = () => { if (vcActive) {
        try {
            vcRec.start();
        }
        catch { /* já rodando */ }
    } };
    vcRec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            vcSetHeard('Microfone bloqueado. Permita o acesso.');
            vcStop();
        }
        else if (e.error !== 'no-speech') {
            vcSetHeard(`voz: ${e.error}`);
        }
    };
    try {
        vcRec.start();
    }
    catch { /* ignore */ }
}
function vcStop() {
    vcActive = false;
    vcArmed = false;
    vcBtnClass(false, false);
    const native = vcNativeBridge();
    if (native) {
        try {
            native.stop();
        }
        catch { /* ignore */ }
    }
    if (vcRec) {
        try {
            vcRec.stop();
        }
        catch { /* ignore */ }
        vcRec = null;
    }
    vcHideOverlay();
}
function vcBtnClass(listening, armed) {
    ['voice-btn', 'voice-btn-left'].forEach((id) => {
        const b = document.getElementById(id);
        if (!b)
            return;
        b.classList.toggle('voice-listening', listening && !armed);
        b.classList.toggle('voice-armed', armed);
    });
}
function vcSetTitle(text) {
    const el = document.getElementById('voice-title');
    if (el)
        el.textContent = text;
}
function vcArm() {
    if (vcArmed)
        return;
    vcArmed = true;
    vcBtnClass(true, true);
    vcSetTitle('Ouvindo comandos · diga "tchau contador" p/ sair');
    vcToast('🎙️ Comandos de voz ativados', true);
    try {
        navigator.vibrate?.(60);
    }
    catch { /* ignore */ }
}
function vcDisarm() {
    vcArmed = false;
    vcBtnClass(true, false);
    vcSetTitle('Diga "contador" p/ ativar');
    vcToast('🎙️ Comandos pausados', false);
    try {
        navigator.vibrate?.(30);
    }
    catch { /* ignore */ }
}
function vcShowOverlay() {
    if (vcOverlay)
        return;
    const el = document.createElement('div');
    el.className = 'voice-overlay';
    el.innerHTML = `
        <div class="voice-mic">🎙️</div>
        <div class="voice-text">
            <div class="voice-title" id="voice-title">Diga "contador" p/ ativar</div>
            <div class="voice-heard" id="voice-heard"></div>
        </div>
        <button class="voice-stop" id="voice-stop-btn" type="button">Parar</button>
    `;
    document.body.appendChild(el);
    vcOverlay = el;
    document.getElementById('voice-stop-btn')?.addEventListener('click', () => vcStop());
}
function vcHideOverlay() {
    vcOverlay?.remove();
    vcOverlay = null;
}
function vcSetHeard(text) {
    const el = document.getElementById('voice-heard');
    if (el)
        el.textContent = text;
}
let vcToastTimer = null;
function vcToast(text, ok) {
    let toast = document.getElementById('voice-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'voice-toast';
        toast.className = 'voice-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.toggle('voice-toast-ok', ok);
    toast.classList.add('voice-toast-show');
    if (vcToastTimer !== null)
        clearTimeout(vcToastTimer);
    vcToastTimer = window.setTimeout(() => {
        toast?.classList.remove('voice-toast-show');
    }, 2200);
}
//# sourceMappingURL=voiceControl.js.map