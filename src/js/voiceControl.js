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
let vcRec = null; // SpeechRecognition (web)
let vcOverlay = null;
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
function vcParse(raw) {
    // Converte palavras-número em dígitos PRIMEIRO, para o nome ("jogador 1" / "jogador um")
    // ser removido inteiro e não sobrar o número do nome para somar com a quantidade.
    const text = vcDigitize(vcNorm(raw));
    if (!text)
        return null;
    // Dano de comandante tem prioridade (estrutura própria com "comandante").
    const cmdIdx = text.split(' ').indexOf('comandante');
    if (cmdIdx !== -1)
        return vcParseCommander(text.split(' '), cmdIdx);
    const player = vcMatchPlayer(text);
    if (!player)
        return null;
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
    const m = rest.match(/\d+/); // após remover o nome, sobra só a quantidade
    if (!m)
        return null;
    const num = parseInt(m[0], 10);
    if (isSet && sign === 0)
        return { playerId: player.id, setValue: num };
    if (sign === 0)
        return null; // sem "mais/menos" e sem "vida" -> ambíguo, ignora
    return { playerId: player.id, delta: sign * num };
}
// ----- Aplicação -----
function vcApply(cmd) {
    const players = gameState.getState().players;
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
// Palavra-chave de ativação: "life counter" arma; "tchau life counter" desarma.
// As variantes cobrem a pronúncia mastigada pelo reconhecedor pt-BR.
const VC_WAKE = /(life|laife|live|laif|laifi|lifi)\s*(counter|county|conter|kaunter)/;
const VC_BYE = /\b(tchau|chau|xau|adeus)\b/;
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
    if (cmd.commander)
        return `c:${cmd.commander.targetId}:${cmd.commander.sourceId}:${cmd.commander.amount}`;
    if (cmd.setValue !== undefined)
        return `s:${cmd.playerId}:${cmd.setValue}`;
    return `d:${cmd.playerId}:${cmd.delta}`;
}
// ===== UI =====
export function setupVoiceControl() {
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
}
export function vcToggle() {
    if (vcActive)
        vcStop();
    else
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
    vcSetTitle('Comandos ATIVOS — ex.: "fulano menos 3" · diga "tchau life counter" para sair');
    vcToast('🎙️ Comandos de voz ativados', true);
    try {
        navigator.vibrate?.(60);
    }
    catch { /* ignore */ }
}
function vcDisarm() {
    vcArmed = false;
    vcBtnClass(true, false);
    vcSetTitle('Diga "life counter" para ativar os comandos');
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
            <div class="voice-title" id="voice-title">Diga "life counter" para ativar os comandos</div>
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