// ===== Comando de voz =====
// Dois jeitos de usar:
//  1) PUSH-TO-TALK (padrão): botão de microfone no meio da mesa. Toca, fala o
//     comando ("zé menos três"), o app aplica e para de ouvir sozinho.
//  2) MÃOS LIVRES (opcional, pelo menu Ferramentas > Comando de voz): microfone
//     fica ligado o tempo todo e só age depois da palavra "contador"; "tchau
//     contador" desarma.
// No navegador usa a Web Speech API. No APK Android usa uma ponte nativa
// (window.LCVoice + window.__lcVoiceResult) porque o WebView não tem Web Speech.

import { gameState } from './state.js';
import { getProfiles } from './profiles.js';
import { countdownToast } from './dialogs.js';

type VcMode = 'push' | 'ambient';
const VC_CONFIRM_MS = 2500; // comandos destrutivos: janela pra cancelar

// ----- Estado -----
let vcActive = false; // microfone ligado
let vcArmed = false; // comandos ativos (push: sempre; ambiente: depois de "contador")
let vcMode: VcMode = 'push';
let vcLastCmdKey = ''; // dedup: último comando aplicado
let vcLastCmdAt = 0;
let vcRec: any = null; // SpeechRecognition (web)
let vcOverlay: HTMLDivElement | null = null;
let vcFab: HTMLButtonElement | null = null;
let vcPushTimer: number | null = null; // auto-desliga no push-to-talk
let vcGameActive = false;
const VC_PUSH_SILENCE_MS = 8000; // sem fala final -> desliga
const VC_PUSH_AFTER_CMD_MS = 1800; // depois de aplicar um comando, dá tempo pra emendar outro

interface VoiceCommand {
    playerId?: string;
    delta?: number;
    setValue?: number;
    commander?: { targetId: string; sourceId: string; amount: number };
    death?: { targetId: string; killerId?: string };
    revive?: { playerId: string };
    counter?: { playerId: string; type: 'poison' | 'experience' | 'energy' | 'storm'; amount: number; reset?: boolean };
    commanderDeath?: { playerId: string; amount: number };
    monarch?: { playerId?: string; remove?: boolean };
    swap?: { aId: string; bId: string };
    theme?: string;
    music?: string;
    dice?: string;
    action?: 'randomStarter' | 'viado' | 'undo' | 'nextTurn' | 'ranking' | 'history' | 'profiles' | 'update'
        | 'settings' | 'tools' | 'fullscreen' | 'timerOn' | 'timerOff' | 'reset' | 'help' | 'stopVoice'
        | 'soundOn' | 'soundOff' | 'narratorOn' | 'narratorOff' | 'celebrate' | 'escandalosaOn' | 'escandalosaOff';
    massLife?: number;
    massSet?: number;
    query?: 'status' | 'life' | 'leader' | 'turn' | 'time';
    queryPlayerId?: string;
}

// Ações de UI que o voiceControl não consegue chamar direto (ficam no ui.ts).
export interface VoiceActions {
    randomStarter?: () => void;
    viado?: () => void;
    undo?: () => void;
    nextTurn?: () => void;
    dice?: (d: string) => void;
    theme?: (t: string) => void;
    music?: (t: string) => void;
    ranking?: () => void;
    history?: () => void;
    profiles?: () => void;
    update?: () => void;
    settings?: () => void;
    tools?: () => void;
    fullscreen?: () => void;
    reset?: () => void;
    celebrate?: (playerName: string) => void;
    revive?: (playerId: string) => void;
}
let vcActions: VoiceActions = {};

// ----- Detecção de suporte -----
function vcWebSpeech(): any {
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}
function vcNativeBridge(): any {
    return (window as any).LCVoice || null;
}
export function vcSupported(): boolean {
    return !!vcNativeBridge() || !!vcWebSpeech();
}

// ----- Normalização / parsing -----
function vcNorm(s: string): string {
    return (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // tira acentos
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const VC_UNITS: Record<string, number> = {
    zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
    seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
    quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
    dezoito: 18, dezenove: 19,
};
const VC_TENS: Record<string, number> = {
    vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
    setenta: 70, oitenta: 80, noventa: 90,
};
const VC_MINUS = ['menos', 'perde', 'perdeu', 'perder', 'tomou', 'toma', 'tomar', 'dano', 'leva', 'levou', 'tira', 'tirar', 'tirou', 'baixa', 'diminui', 'caiu', 'apanha', 'apanhou'];
const VC_PLUS = ['mais', 'ganha', 'ganhou', 'ganhar', 'soma', 'somar', 'cura', 'curou', 'curar', 'recupera', 'recuperou', 'sobe', 'aumenta', 'subiu'];
const VC_SET = ['vida', 'igual', 'fica', 'define', 'definir', 'setar', 'seta', 'vale', 'com'];

// Converte palavras-número em dígitos: "jogador um mais dois" -> "jogador 1 mais 2",
// "menos vinte e um" -> "menos 21". Resolve nomes com número ("Jogador 1") ditos por extenso.
function vcDigitize(text: string): string {
    const tokens = text.split(' ').filter(Boolean);
    const out: string[] = [];
    let i = 0;
    while (i < tokens.length) {
        const t = tokens[i];
        if (t in VC_TENS) {
            let val = VC_TENS[t];
            let consumed = 1;
            let j = i + 1;
            if (tokens[j] === 'e') j++;
            if (tokens[j] !== undefined && tokens[j] in VC_UNITS) {
                val += VC_UNITS[tokens[j]];
                consumed = (j - i) + 1;
            }
            out.push(String(val));
            i += consumed;
        } else if (t in VC_UNITS) {
            out.push(String(VC_UNITS[t]));
            i++;
        } else if (t === 'cem' || t === 'cento') {
            out.push('100');
            i++;
        } else {
            out.push(t);
            i++;
        }
    }
    return out.join(' ');
}

// Apelidos comuns que o reconhecedor devolve diferente do nome cadastrado.
const VC_ALIASES: Record<string, string[]> = {
    ze: ['jose', 'zeca', 'zezinho', 'se', 'ser'],
    reis: ['rei', 'reiss', 'kings', 'matheus', 'mateus'],
    cabral: ['cabrau', 'leo', 'leonardo'],
    mendas: ['mendes', 'menda'],
    system: ['sistema', 'sistem', 'sisten'],
    laura: ['lara', 'laurinha'],
    maria: ['mariinha', 'mari'],
};

function vcMatchPlayer(text: string, exclude?: string): { id: string; matched: string } | null {
    const players = gameState.getState().players.filter((p) => p.id !== exclude);
    let best: { id: string; matched: string } | null = null;

    // 1) nome completo (já em dígitos) como substring (ex.: "jogador 1", "joao silva")
    for (const p of players) {
        const n = vcDigitize(vcNorm(p.name));
        if (n && text.includes(n) && (!best || n.length > best.matched.length)) {
            best = { id: p.id, matched: n };
        }
    }
    if (best) return best;

    // 2) qualquer palavra do nome com 2+ letras (evita casar com o dígito do nome)
    const tokens = text.split(' ');
    for (const p of players) {
        const words = vcDigitize(vcNorm(p.name)).split(' ');
        const candidates = words.slice();
        for (const w of words) for (const a of (VC_ALIASES[w] || [])) candidates.push(a);
        // Apelidos cadastrados no perfil (servidor): "Zezinho", "Cabralzinho"...
        if (p.profileId !== null && p.profileId !== undefined) {
            const prof = getProfiles().find(x => x.id === p.profileId);
            for (const a of (prof?.aliases || [])) {
                const na = vcDigitize(vcNorm(a));
                if (na && text.includes(na) && (!best || na.length > best.matched.length)) best = { id: p.id, matched: na };
                for (const w of na.split(' ')) candidates.push(w);
            }
        }
        for (const w of candidates) {
            if (w.length >= 2 && /[a-z]/.test(w) && tokens.includes(w) && (!best || w.length > best.matched.length)) {
                best = { id: p.id, matched: w };
            }
        }
    }
    if (best) return best;

    // 3) "jogador N" / "o N" pela posição na mesa
    const pos = text.match(/\bjogador (\d)\b/);
    if (pos) {
        const p = gameState.getState().players[parseInt(pos[1], 10) - 1];
        if (p && p.id !== exclude) return { id: p.id, matched: pos[0] };
    }
    // 4) "eu"/"me" = jogador ativo da vez
    if (/\b(eu|me|minha|meu)\b/.test(text)) {
        const s = gameState.getState();
        const p = s.players[s.activePlayerIndex];
        if (p && p.id !== exclude) return { id: p.id, matched: 'eu' };
    }
    return null;
}

// Dano de comandante: "<alvo> <N> de comandante do <fonte>"
// ex.: "jogador 1 15 de comandante do jogador 2", "jose 10 de comandante do reis".
function vcParseCommander(tokens: string[], idx: number): VoiceCommand | null {
    const beforeText = tokens.slice(0, idx).join(' ');
    const after = tokens.slice(idx + 1);
    const preps = ['do', 'da', 'de', 'dos', 'das', 'o', 'a'];
    while (after.length && preps.includes(after[0])) after.shift();
    const sourceText = after.join(' ');

    const target = vcMatchPlayer(beforeText);
    const source = vcMatchPlayer(sourceText, target?.id);
    if (!target || !source || target.id === source.id) return null;

    const restBefore = beforeText.replace(target.matched, ' ');
    const m = restBefore.match(/\d+/); // quantidade (depois de tirar o nome do alvo)
    if (!m) return null;

    return { commander: { targetId: target.id, sourceId: source.id, amount: parseInt(m[0], 10) } };
}

// ----- Reconhecimento de tema / música / dado / contador -----
const VC_THEME: Array<[RegExp, string]> = [
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
function vcTheme(text: string): string | null {
    for (const [re, val] of VC_THEME) if (re.test(text)) return val;
    return null;
}

const VC_MUSIC: Array<[RegExp, string]> = [
    [/parar|sem musica|deslig|silencio|nenhuma|para a musica|pausa/, 'none'],
    [/epic|epica/, 'epic'],
    [/sombri|soturna|tensa|dark/, 'dark'],
    [/natur|floresta/, 'nature'],
    [/mistic|misteri|mystical/, 'mystical'],
];
function vcMusic(text: string): string {
    for (const [re, val] of VC_MUSIC) if (re.test(text)) return val;
    return 'epic';
}

function vcDice(text: string): string {
    if (/moeda|cara ou coroa|cara e coroa/.test(text)) return 'coin';
    if (/planar/.test(text)) return 'planar';
    const dm = text.match(/\bd\s?(\d{1,3})\b/) || text.match(/\b(\d{1,3})\b/);
    if (dm && ['4', '6', '8', '10', '12', '20', '100'].includes(dm[1])) return dm[1];
    return '20';
}

function vcCounterType(text: string): 'poison' | 'experience' | 'energy' | 'storm' | null {
    if (/veneno|poison|envenen/.test(text)) return 'poison';
    if (/energia|energy/.test(text)) return 'energy';
    if (/experiencia|experience|\bexp\b/.test(text)) return 'experience';
    if (/storm|tempestade/.test(text)) return 'storm';
    return null;
}

// Comandos que não dependem de um jogador específico.
function vcParseGlobal(text: string): VoiceCommand | null {
    if (/\b(ajuda|help|o que voce faz|quais comandos|comandos)\b/.test(text)) return { action: 'help' };
    if (/\b(para de ouvir|parar de ouvir|desliga o microfone|chega)\b/.test(text)) return { action: 'stopVoice' };

    if (text.includes('tema')) {
        const t = vcTheme(text);
        if (t) return { theme: t };
    }
    if (/musica|trilha|som ambiente/.test(text)) return { music: vcMusic(text) };
    if (/\b(rola|rolar|dado|dados|moeda)\b/.test(text) || /\bd\d{1,3}\b/.test(text) || /cara ou coroa/.test(text)) {
        return { dice: vcDice(text) };
    }
    if (/quem comeca|sortear inicial|quem inicia|quem joga primeiro/.test(text)
        || (/sorteia|sortear|sorteio/.test(text) && /comeca|inicio|primeiro/.test(text))) {
        return { action: 'randomStarter' };
    }
    if (/viado/.test(text)) return { action: 'viado' };
    if (/proximo turno|passa o turno|passar o turno|passa a vez|passar a vez|proxima vez|vira o turno|fim do turno|acabou o turno/.test(text)) {
        return { action: 'nextTurn' };
    }
    if (/\bdesfaz|desfazer\b|volta atras|cancela isso/.test(text)) return { action: 'undo' };
    if (/\branking\b|\bplacar\b|classificacao/.test(text)) return { action: 'ranking' };
    if (/historico|partidas anteriores/.test(text)) return { action: 'history' };
    if (/\bperfis\b|\bperfil\b/.test(text)) return { action: 'profiles' };
    if (/atualiza|nova versao|versao nova|update/.test(text)) return { action: 'update' };
    if (/configurac|ajustes|opcoes/.test(text)) return { action: 'settings' };
    if (/ferramentas|menu/.test(text)) return { action: 'tools' };
    if (/tela cheia|tela inteira|fullscreen/.test(text)) return { action: 'fullscreen' };
    if (/\b(timer|cronometro|relogio)\b/.test(text)) {
        return { action: /desliga|para|tira|sem/.test(text) ? 'timerOff' : 'timerOn' };
    }
    if (/\b(som|sons|audio)\b/.test(text) && /desliga|muta|mudo|silenci|sem/.test(text)) return { action: 'soundOff' };
    if (/\b(som|sons|audio)\b/.test(text) && /liga|ativa|volta/.test(text)) return { action: 'soundOn' };
    if (/narrador/.test(text)) return { action: /desliga|cala|para|sem|mudo/.test(text) ? 'narratorOff' : 'narratorOn' };
    if (/escandal/.test(text)) return { action: /desliga|sem|tira/.test(text) ? 'escandalosaOff' : 'escandalosaOn' };
    if (/\b(reinicia|reiniciar|resetar|reseta|recomeca|recomecar|zera a partida|nova partida)\b/.test(text)) return { action: 'reset' };

    // Perguntas: "como ta a mesa", "quem ta ganhando", "que turno"
    if (/como (ta|esta) a mesa|status|situacao|resumo/.test(text)) return { query: 'status' };
    if (/quem (ta|esta) (ganhando|na frente|liderando)|quem lidera/.test(text)) return { query: 'leader' };
    if (/que turno|qual turno|turno atual|de quem e a vez|vez de quem/.test(text)) return { query: 'turn' };
    if (/quanto tempo|tempo de jogo|duracao/.test(text)) return { query: 'time' };

    if (/\btodos\b|todo mundo|\bgeral\b|mesa toda|todas/.test(text)) {
        const sign = /menos|perde|tira|dano|leva/.test(text) ? -1 : (/mais|ganha|cura|sobe/.test(text) ? 1 : 0);
        const m = text.match(/\d+/);
        if (sign !== 0 && m) return { massLife: sign * parseInt(m[0], 10) };
        if (m && /vida|igual|fica|com/.test(text)) return { massSet: parseInt(m[0], 10) };
    }
    return null;
}

function vcParse(raw: string): VoiceCommand | null {
    // Converte palavras-número em dígitos PRIMEIRO (nome "jogador 1"/"jogador um" sai inteiro).
    const text = vcDigitize(vcNorm(raw));
    if (!text) return null;

    // 1) Comandos globais (sem jogador): tema, música, dado, sorteio, viado, turno, desfazer, massa.
    const global = vcParseGlobal(text);
    if (global) return global;

    // 2) Dano de comandante.
    const cmdTokens = text.split(' ');
    const cmdIdx = cmdTokens.indexOf('comandante');
    if (cmdIdx !== -1 && !/morr|morte|mortes|tax/.test(text)) return vcParseCommander(cmdTokens, cmdIdx);

    // 2b) Morte do COMANDANTE (commander tax): "comandante do zé morreu", "zé mais 1 morte do comandante".
    if (cmdIdx !== -1) {
        const p = vcMatchPlayer(text);
        if (!p) return null;
        const amount = /tira|menos|remove|volta/.test(text) ? -1 : 1;
        return { commanderDeath: { playerId: p.id, amount } };
    }

    // 3) Troca de vida: "troca a vida do zé com a do reis".
    if (/\btroca|trocar|inverte|inverter\b/.test(text) && /vida/.test(text)) {
        const a = vcMatchPlayer(text);
        const b = a ? vcMatchPlayer(text.replace(a.matched, ' '), a.id) : null;
        if (a && b) return { swap: { aId: a.id, bId: b.id } };
        return null;
    }

    // 4) Reviver: "revive o zé", "zé voltou".
    if (/\brevive|reviver|ressuscita|voltou pro jogo|volta pro jogo\b/.test(text)) {
        const p = vcMatchPlayer(text);
        if (p) return { revive: { playerId: p.id } };
        return null;
    }

    // 5) Morte: "A matou B" -> B morre (por A); "fulano morre/morreu".
    if (text.includes('matou') || text.includes('mataram')) {
        const sep = text.includes('mataram') ? 'mataram' : 'matou';
        const parts = text.split(sep);
        const killer = vcMatchPlayer(parts[0] || '');
        const victim = vcMatchPlayer(parts[1] || '', killer?.id);
        if (victim) {
            const killerId = killer && killer.id !== victim.id ? killer.id : undefined;
            return { death: { targetId: victim.id, killerId } };
        }
        return null;
    }
    if (/\bmorr|\bmorto\b|\bmorta\b|elimin|\bperdeu o jogo\b|\bsaiu\b/.test(text)) {
        const dead = vcMatchPlayer(text);
        if (dead) return { death: { targetId: dead.id } };
        return null;
    }

    // 6) Monarca: "monarca pro fulano" / "coroa pro fulano"; "tira o monarca" remove.
    if (/monarc|coroa/.test(text)) {
        if (/tira|sem |remove|remova|sai /.test(text)) return { monarch: { remove: true } };
        const mp = vcMatchPlayer(text);
        if (mp) return { monarch: { playerId: mp.id } };
        return null;
    }

    // 7) A partir daqui precisa de um jogador.
    const player = vcMatchPlayer(text);
    if (!player) return null;

    // 8) Perguntas sobre um jogador: "quanto de vida tem o zé".
    if (/quanto|quantos|qual a vida|como (ta|esta) o|como (ta|esta) a/.test(text) && !/\d/.test(text.replace(player.matched, ''))) {
        return { query: 'life', queryPlayerId: player.id };
    }

    // 9) Contador (veneno / energia / experiência / storm).
    const ctype = vcCounterType(text);
    if (ctype) {
        const restc = text.replace(player.matched, ' ');
        if (/\bzera|zerar|limpa|limpar\b/.test(restc)) return { counter: { playerId: player.id, type: ctype, amount: 0, reset: true } };
        const csign = /menos|tira|remove|cura|tirar/.test(restc) ? -1 : 1;
        const cm = restc.match(/\d+/);
        const camount = (cm ? parseInt(cm[0], 10) : 1) * csign;
        return { counter: { playerId: player.id, type: ctype, amount: camount } };
    }

    // 10) Vida (delta ou definir), incluindo "metade" e "dobro".
    const rest = text.replace(player.matched, ' ').replace(/\s+/g, ' ').trim();
    if (/metade/.test(rest)) {
        const life = gameState.getState().players.find((p) => p.id === player.id)?.life ?? 0;
        return { playerId: player.id, setValue: Math.ceil(life / 2) };
    }
    if (/dobro|dobra|duplica/.test(rest)) {
        const life = gameState.getState().players.find((p) => p.id === player.id)?.life ?? 0;
        return { playerId: player.id, setValue: life * 2 };
    }
    const tokens = rest.split(' ');

    let sign = 0;
    let isSet = false;
    for (const t of tokens) {
        if (VC_MINUS.includes(t)) sign = -1;
        else if (VC_PLUS.includes(t)) sign = 1;
        else if (VC_SET.includes(t)) isSet = true;
    }

    const m = rest.match(/\d+/);
    if (!m) return null;
    const num = parseInt(m[0], 10);

    if (isSet && sign === 0) return { playerId: player.id, setValue: num };
    if (sign === 0) return null;
    return { playerId: player.id, delta: sign * num };
}

// ----- Fala de resposta (perguntas) -----
function vcSpeak(text: string): void {
    const hype = (window as any).LCHype;
    try {
        if (hype && typeof hype.shout === 'function') { hype.shout(text); return; }
        const synth = window.speechSynthesis;
        if (!synth) return;
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'pt-BR';
        u.rate = 1.05;
        synth.speak(u);
    } catch { /* ignore */ }
}

function vcStatusText(): string {
    const s = gameState.getState();
    const alive = s.players.filter((p) => !p.isEliminated);
    const dead = s.players.filter((p) => p.isEliminated);
    const parts = alive.map((p) => `${p.name} ${p.life}`);
    let txt = `Turno ${s.currentTurn}. ${parts.join(', ')}.`;
    if (dead.length) txt += ` Fora: ${dead.map((p) => p.name).join(', ')}.`;
    return txt;
}

// ----- Aplicação -----
function vcApply(cmd: VoiceCommand): void {
    const players = gameState.getState().players;
    const vib = (ms: number): void => { try { navigator.vibrate?.(ms); } catch { /* ignore */ } };

    // Perguntas: responde por voz + toast.
    if (cmd.query) {
        const s = gameState.getState();
        let txt = '';
        if (cmd.query === 'status') txt = vcStatusText();
        else if (cmd.query === 'life') {
            const p = players.find((x) => x.id === cmd.queryPlayerId);
            txt = p ? `${p.name} está com ${p.life} de vida${p.counters.poison ? ` e ${p.counters.poison} de veneno` : ''}.` : 'Não achei o jogador.';
        } else if (cmd.query === 'leader') {
            const alive = players.filter((p) => !p.isEliminated).sort((a, b) => b.life - a.life);
            txt = alive.length ? `${alive[0].name} lidera com ${alive[0].life}.` : 'Ninguém vivo.';
        } else if (cmd.query === 'turn') {
            const ap = s.players[s.activePlayerIndex];
            txt = `Turno ${s.currentTurn}, vez de ${ap?.name || '?'}.`;
        } else if (cmd.query === 'time') {
            const min = s.gameStartTime ? Math.round((Date.now() - s.gameStartTime) / 60000) : 0;
            txt = `${min} minutos de partida.`;
        }
        vcToast(`🗣️ ${txt}`, true);
        vcSpeak(txt);
        return;
    }

    // Ações de UI (delegadas ao ui.ts).
    if (cmd.action) {
        const a = cmd.action;
        if (a === 'randomStarter') { vcActions.randomStarter?.(); vcToast('🎲 Sorteando quem começa', true); }
        else if (a === 'viado') { vcActions.viado?.(); vcToast('🏳️‍🌈 Sorteando o viado', true); }
        else if (a === 'undo') { vcActions.undo?.(); vcToast('↩️ Desfeito', true); }
        else if (a === 'nextTurn') { vcActions.nextTurn?.(); vcToast('▶️ Próximo turno', true); }
        else if (a === 'ranking') { vcActions.ranking?.(); vcToast('🏆 Ranking', true); }
        else if (a === 'history') { vcActions.history?.(); vcToast('🕐 Histórico', true); }
        else if (a === 'profiles') { vcActions.profiles?.(); vcToast('👥 Perfis', true); }
        else if (a === 'update') { vcActions.update?.(); vcToast('⬆️ Atualização', true); }
        else if (a === 'settings') { vcActions.settings?.(); vcToast('⚙️ Configurações', true); }
        else if (a === 'tools') { vcActions.tools?.(); vcToast('🛠️ Ferramentas', true); }
        else if (a === 'fullscreen') { vcActions.fullscreen?.(); vcToast('⛶ Tela cheia', true); }
        else if (a === 'timerOn') { gameState.updateSettings({ turnTimerEnabled: true }); vcToast('⏱️ Timer ligado', true); }
        else if (a === 'timerOff') { gameState.updateSettings({ turnTimerEnabled: false }); vcToast('⏱️ Timer desligado', true); }
        else if (a === 'soundOn') { gameState.updateSettings({ soundEnabled: true }); vcToast('🔊 Som ligado', true); }
        else if (a === 'soundOff') { gameState.updateSettings({ soundEnabled: false }); vcToast('🔇 Som desligado', true); }
        else if (a === 'narratorOn') { gameState.updateSettings({ narratorEnabled: true }); vcToast('🎙️ Narrador ligado', true); }
        else if (a === 'narratorOff') { gameState.updateSettings({ narratorEnabled: false }); vcToast('🤐 Narrador desligado', true); }
        else if (a === 'escandalosaOn') { gameState.updateSettings({ escandalosaEnabled: true }); vcToast('🚨 Vitória escandalosa ligada', true); }
        else if (a === 'escandalosaOff') { gameState.updateSettings({ escandalosaEnabled: false }); vcToast('🤫 Vitória escandalosa desligada', true); }
        else if (a === 'reset') { vcActions.reset?.(); }
        else if (a === 'help') { vcOpenHelp(); }
        else if (a === 'stopVoice') { vcStop(); }
        else if (a === 'celebrate') { vcActions.celebrate?.(''); }
        return;
    }
    if (cmd.theme) { vcActions.theme?.(cmd.theme); vcToast('🎨 Tema alterado', true); return; }
    if (cmd.music) { vcActions.music?.(cmd.music); vcToast(cmd.music === 'none' ? '🔇 Música parada' : '🎵 Música trocada', true); return; }
    if (cmd.dice) { vcActions.dice?.(cmd.dice); vcToast(`🎲 Rolando ${cmd.dice === 'coin' ? 'moeda' : 'd' + cmd.dice}`, true); return; }
    if (cmd.monarch) {
        if (cmd.monarch.remove) {
            gameState.removeMonarch();
            vcToast('👑 Sem monarca', true);
        } else if (cmd.monarch.playerId) {
            gameState.setMonarch(cmd.monarch.playerId);
            const mp = players.find((p) => p.id === cmd.monarch!.playerId);
            vcToast(`👑 ${mp?.name} é o monarca`, true);
        }
        vib(40);
        return;
    }
    if (cmd.counter) {
        const cp = players.find((p) => p.id === cmd.counter!.playerId);
        const icons: Record<string, string> = { poison: '☠️', energy: '⚡', experience: '⭐', storm: '🌪️' };
        if (cmd.counter.reset) {
            const cur = cp?.counters[cmd.counter.type] || 0;
            if (cur) gameState.changeCounter(cmd.counter.playerId, cmd.counter.type, -cur);
            vcToast(`${icons[cmd.counter.type] || ''} ${cp?.name} zerado`, true);
        } else {
            gameState.changeCounter(cmd.counter.playerId, cmd.counter.type, cmd.counter.amount);
            vcToast(`${icons[cmd.counter.type] || ''} ${cp?.name} ${cmd.counter.amount > 0 ? '+' : ''}${cmd.counter.amount}`, true);
        }
        vib(40);
        return;
    }
    if (cmd.commanderDeath) {
        gameState.changeCommanderDeaths(cmd.commanderDeath.playerId, cmd.commanderDeath.amount);
        const p = players.find((x) => x.id === cmd.commanderDeath!.playerId);
        const deaths = gameState.getState().players.find((x) => x.id === cmd.commanderDeath!.playerId)?.commanderDeaths ?? 0;
        vcToast(`⚰️ Comandante de ${p?.name}: ${deaths} morte(s) (tax ${deaths * 2})`, true);
        vib(40);
        return;
    }
    if (cmd.swap) {
        const a = players.find((p) => p.id === cmd.swap!.aId);
        const b = players.find((p) => p.id === cmd.swap!.bId);
        if (a && b) {
            const la = a.life, lb = b.life;
            gameState.setLife(a.id, lb);
            gameState.setLife(b.id, la);
            vcToast(`🔁 ${a.name} ${lb} ⇄ ${b.name} ${la}`, true);
            vib(60);
        }
        return;
    }
    if (cmd.massLife !== undefined) {
        players.filter((p) => !p.isEliminated).forEach((p) => gameState.changeLife(p.id, cmd.massLife!));
        vcToast(`Todos ${cmd.massLife > 0 ? '+' : ''}${cmd.massLife}`, true);
        vib(40);
        return;
    }
    if (cmd.massSet !== undefined) {
        players.filter((p) => !p.isEliminated).forEach((p) => gameState.setLife(p.id, cmd.massSet!));
        vcToast(`Todos = ${cmd.massSet}`, true);
        vib(40);
        return;
    }
    if (cmd.revive) {
        const p = players.find((x) => x.id === cmd.revive!.playerId);
        if (vcActions.revive) vcActions.revive(cmd.revive.playerId);
        else gameState.revivePlayer(cmd.revive.playerId, true);
        vcToast(`😇 ${p?.name} voltou`, true);
        vib(60);
        return;
    }

    // Morte / "matou" — vai pro histórico (player_eliminated) e dispara som/roast.
    if (cmd.death) {
        const victim = players.find((p) => p.id === cmd.death!.targetId);
        const killer = cmd.death.killerId ? players.find((p) => p.id === cmd.death!.killerId) : null;
        gameState.eliminatePlayer(cmd.death.targetId, killer ? `morto por ${killer.name}` : 'morreu', killer?.id);
        vcToast(`💀 ${victim?.name}${killer ? ` (por ${killer.name})` : ' morreu'}`, true);
        vib(60);
        return;
    }

    // Dano de comandante (já reduz vida e checa eliminação no state).
    if (cmd.commander) {
        const { targetId, sourceId, amount } = cmd.commander;
        gameState.addCommanderDamage(targetId, sourceId, amount);
        const t = players.find((p) => p.id === targetId);
        const s = players.find((p) => p.id === sourceId);
        vcToast(`${t?.name} ⚔️ ${amount} de comandante de ${s?.name}`, true);
        vib(40);
        return;
    }

    const player = players.find((p) => p.id === cmd.playerId);
    if (!player || !cmd.playerId) return;

    if (cmd.setValue !== undefined) {
        gameState.setLife(cmd.playerId, cmd.setValue);
    } else if (cmd.delta !== undefined) {
        gameState.changeLife(cmd.playerId, cmd.delta);
    }

    const novo = gameState.getState().players.find((p) => p.id === cmd.playerId)?.life;
    const txt = cmd.setValue !== undefined
        ? `${player.name} = ${cmd.setValue}`
        : `${player.name} ${cmd.delta! > 0 ? '+' : ''}${cmd.delta} → ${novo}`;
    vcToast(txt, true);
    vib(40);
}

// Palavra-chave de ativação (só no modo mãos livres). O reconhecedor é pt-BR,
// então "life counter" costuma sair mastigado — "contador" é o gatilho confiável.
const VC_WAKE = /(life|laife|laif|laifi|lifi|live|leite)\s*(counter|conter|caunter|kaunter|county|conta)|contad/;
const VC_BYE = /\b(tchau|chau|xau|adeus|fechar|fecha|parar|para|encerra|desativa)\b/;

function vcHandleTranscript(raw: string, final: boolean): void {
    vcSetHeard(raw);
    if (!final) return;
    const n = vcNorm(raw);

    if (vcMode === 'ambient') {
        // Palavra-chave tem prioridade sobre comandos.
        if (VC_WAKE.test(n)) {
            if (VC_BYE.test(n)) vcDisarm();
            else vcArm();
            return;
        }
        if (!vcArmed) return; // modo ambiente: só age depois de ouvir "contador"
    } else if (!vcHolding) {
        vcSchedulePushStop(VC_PUSH_SILENCE_MS);
    }

    const cmd = vcParse(raw);
    if (!cmd) {
        vcSetHeard(`"${raw}" — não entendi (diga "ajuda")`);
        return;
    }

    // Dedup: o reconhecedor às vezes entrega o mesmo final 2x (causava aplicar em dobro).
    const key = vcCmdKey(cmd);
    const now = Date.now();
    if (key === vcLastCmdKey && now - vcLastCmdAt < 1500) return;
    vcLastCmdKey = key;
    vcLastCmdAt = now;

    // Comandos destrutivos: mostra o que vai fazer por 2,5 s com botão Cancelar.
    const destructiveLabel = vcDestructiveLabel(cmd);
    if (destructiveLabel) {
        vcBeep('warn');
        void countdownToast(`🎙️ ${destructiveLabel}`, VC_CONFIRM_MS, () => vcToast('Cancelado', false)).then((go) => {
            if (go) vcApply(cmd);
        });
    } else {
        vcApply(cmd);
    }
    // Push-to-talk: aplicou, dá um tempinho pra emendar outro comando e desliga
    // (se o dedo ainda estiver segurando o botão, continua ouvindo até soltar).
    if (vcMode === 'push' && vcActive && !vcHolding && cmd.action !== 'stopVoice' && cmd.action !== 'help') {
        vcSchedulePushStop(cmd.query ? VC_PUSH_SILENCE_MS : VC_PUSH_AFTER_CMD_MS);
    }
}

// Texto de confirmação para comandos que mudam muito a mesa (null = aplica direto).
function vcDestructiveLabel(cmd: VoiceCommand): string | null {
    const players = gameState.getState().players;
    const nameOf = (id?: string): string => players.find(p => p.id === id)?.name || '?';
    if (cmd.death) return `${nameOf(cmd.death.targetId)} vai ser eliminado${cmd.death.killerId ? ` por ${nameOf(cmd.death.killerId)}` : ''}`;
    if (cmd.action === 'reset') return 'Reiniciar a partida';
    if (cmd.massLife !== undefined) return `Todos ${cmd.massLife > 0 ? '+' : ''}${cmd.massLife} de vida`;
    if (cmd.massSet !== undefined) return `Todos com ${cmd.massSet} de vida`;
    if (cmd.swap) return `Trocar vida de ${nameOf(cmd.swap.aId)} com ${nameOf(cmd.swap.bId)}`;
    if (cmd.setValue !== undefined && cmd.playerId) return `${nameOf(cmd.playerId)} com ${cmd.setValue} de vida`;
    if (cmd.delta !== undefined && Math.abs(cmd.delta) >= 15 && cmd.playerId) return `${nameOf(cmd.playerId)} ${cmd.delta > 0 ? '+' : ''}${cmd.delta} de vida`;
    return null;
}

// Beep curto (WebAudio) ao abrir/fechar o microfone e antes de confirmação.
let vcBeepCtx: AudioContext | null = null;
function vcBeep(kind: 'on' | 'off' | 'warn'): void {
    try {
        if (gameState.getState().settings.silentMode) return;
        if (!vcBeepCtx) vcBeepCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const ctx = vcBeepCtx;
        if (ctx.state === 'suspended') void ctx.resume();
        const notes = kind === 'on' ? [660, 880] : kind === 'off' ? [880, 520] : [520, 520];
        notes.forEach((f, i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = f;
            g.gain.value = 0.0001;
            osc.connect(g);
            g.connect(ctx.destination);
            const t = ctx.currentTime + i * 0.09;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
            osc.start(t);
            osc.stop(t + 0.09);
        });
    } catch { /* ignore */ }
}

function vcCmdKey(cmd: VoiceCommand): string {
    if (cmd.query) return `q:${cmd.query}:${cmd.queryPlayerId || ''}`;
    if (cmd.action) return `ac:${cmd.action}`;
    if (cmd.theme) return `th:${cmd.theme}`;
    if (cmd.music) return `mu:${cmd.music}`;
    if (cmd.dice) return `di:${cmd.dice}`;
    if (cmd.monarch) return `mo:${cmd.monarch.remove ? 'rm' : cmd.monarch.playerId}`;
    if (cmd.counter) return `ct:${cmd.counter.playerId}:${cmd.counter.type}:${cmd.counter.amount}:${cmd.counter.reset ? 'z' : ''}`;
    if (cmd.commanderDeath) return `cd:${cmd.commanderDeath.playerId}:${cmd.commanderDeath.amount}`;
    if (cmd.swap) return `sw:${cmd.swap.aId}:${cmd.swap.bId}`;
    if (cmd.revive) return `rv:${cmd.revive.playerId}`;
    if (cmd.massLife !== undefined) return `ml:${cmd.massLife}`;
    if (cmd.massSet !== undefined) return `ms:${cmd.massSet}`;
    if (cmd.death) return `k:${cmd.death.targetId}`;
    if (cmd.commander) return `c:${cmd.commander.targetId}:${cmd.commander.sourceId}:${cmd.commander.amount}`;
    if (cmd.setValue !== undefined) return `s:${cmd.playerId}:${cmd.setValue}`;
    return `d:${cmd.playerId}:${cmd.delta}`;
}

// ===== UI =====
export function setupVoiceControl(actions: VoiceActions = {}): void {
    vcActions = actions;
    if (!vcSupported()) {
        // Sem reconhecimento de voz (ex.: web sem suporte): esconde os botões.
        ['voice-btn', 'voice-btn-left'].forEach((id) => {
            const b = document.getElementById(id);
            if (b) b.style.display = 'none';
        });
        return;
    }
    // Menu Ferramentas: modo mãos livres (liga/desliga a escuta contínua com "contador").
    document.getElementById('voice-btn')?.addEventListener('click', () => vcToggleAmbient());
    document.getElementById('voice-btn-left')?.addEventListener('click', () => vcToggleAmbient());
    (window as any).__lcVoiceResult = (txt: string, final?: boolean) => vcHandleTranscript(txt, final !== false);
    // Diagnóstico: a ponte nativa manda status/erros do reconhecedor pra aparecer no overlay.
    (window as any).__lcVoiceStatus = (msg: string) => { if (!vcArmed) vcSetHeard(msg); };
    vcEnsureFab();
}

// Chamado pelo ui.ts a cada render: o botão de microfone só aparece na mesa.
export function vcSetGameActive(active: boolean): void {
    vcGameActive = active;
    vcEnsureFab();
    if (vcFab) vcFab.style.display = active && vcSupported() ? '' : 'none';
    if (!active && vcActive) vcStop();
}

// Botão de microfone no centro do campo (dentro do grid de jogadores, não por
// cima de modais). Funciona como áudio do WhatsApp: SEGURA pra falar, solta e
// ele para (com ~1 s de folga pra pegar a última palavra). Toque rápido liga e
// fica ouvindo até o próximo toque ou até o comando ser aplicado.
const VC_TAP_MS = 350;
const VC_RELEASE_GRACE_MS = 1000;
let vcHoldStartedAt = 0;
let vcHolding = false;

function vcEnsureFab(): void {
    if (vcFab || !vcSupported()) return;
    const grid = document.getElementById('players-grid');
    if (!grid) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'voice-fab';
    btn.className = 'voice-fab';
    btn.title = 'Segure e fale um comando (ex.: "Zé menos 3"); toque rápido liga/desliga';
    btn.innerHTML = '<svg class="ic"><use href="#ic-mic"/></svg>';
    btn.style.display = vcGameActive ? '' : 'none';
    btn.setAttribute('aria-label', 'Comando de voz');

    btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { btn.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        vcHoldStartedAt = Date.now();
        vcHolding = true;
        if (vcPushTimer !== null) { clearTimeout(vcPushTimer); vcPushTimer = null; }
        if (!vcActive) vcStart('push');
        else if (vcMode === 'ambient') { vcStop(); vcStart('push'); }
        btn.classList.add('voice-fab-holding');
    });
    const release = (e: PointerEvent): void => {
        if (!vcHolding) return;
        vcHolding = false;
        btn.classList.remove('voice-fab-holding');
        try { btn.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        const held = Date.now() - vcHoldStartedAt;
        if (e.type === 'pointercancel') { vcStop(); return; }
        if (held < VC_TAP_MS) {
            // Toque rápido: se já estava ouvindo antes do toque, desliga; senão fica ouvindo.
            if (vcTapShouldStop) { vcStop(); vcTapShouldStop = false; return; }
            vcTapShouldStop = true;
            vcSchedulePushStop(VC_PUSH_SILENCE_MS);
            return;
        }
        // Soltou depois de segurar: folga curta pra chegar o resultado final e para.
        vcTapShouldStop = false;
        vcSetTitle('Processando…');
        vcSchedulePushStop(VC_RELEASE_GRACE_MS);
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    grid.appendChild(btn);
    vcFab = btn;
}
let vcTapShouldStop = false;

function vcToggleAmbient(): void {
    if (vcActive && vcMode === 'ambient') vcStop();
    else { if (vcActive) vcStop(); vcStart('ambient'); }
}

// Compatibilidade: a escuta NÃO liga mais sozinha (era o comportamento antigo).
export function maybeAutoStartVoice(): void { /* desativado: agora é push-to-talk */ }

export function vcToggle(): void {
    if (vcActive) vcStop();
    else vcStart('push');
}

function vcSchedulePushStop(ms: number): void {
    if (vcPushTimer !== null) clearTimeout(vcPushTimer);
    vcPushTimer = window.setTimeout(() => { vcPushTimer = null; if (vcActive && vcMode === 'push') vcStop(); }, ms);
}

function vcStart(mode: VcMode): void {
    if (vcActive) return;
    vcActive = true;
    vcMode = mode;
    vcArmed = mode === 'push';
    vcLastCmdKey = '';
    vcShowOverlay();
    vcBtnClass(true, vcArmed);
    vcBeep('on');
    if (mode === 'push') {
        vcSetTitle(vcHolding ? 'Segure e fale… solte pra aplicar' : 'Pode falar…');
        if (!vcHolding) vcSchedulePushStop(VC_PUSH_SILENCE_MS);
        try { navigator.vibrate?.(30); } catch { /* ignore */ }
    } else {
        vcSetTitle('Mãos livres · diga "contador" p/ ativar');
    }

    const native = vcNativeBridge();
    if (native) {
        try { native.start(); } catch (e) { console.warn('Voice native start error', e); }
        return;
    }

    const SR = vcWebSpeech();
    if (!SR) { vcStop(); return; }
    vcRec = new SR();
    vcRec.lang = 'pt-BR';
    vcRec.continuous = true;
    vcRec.interimResults = true;
    vcRec.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            vcHandleTranscript(r[0].transcript, r.isFinal);
        }
    };
    vcRec.onend = () => { if (vcActive) { try { vcRec.start(); } catch { /* já rodando */ } } };
    vcRec.onerror = (e: any) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            vcSetHeard('Microfone bloqueado. Permita o acesso.');
            vcStop();
        } else if (e.error !== 'no-speech') {
            vcSetHeard(`voz: ${e.error}`);
        }
    };
    try { vcRec.start(); } catch { /* ignore */ }
}

function vcStop(): void {
    if (vcActive) vcBeep('off');
    vcActive = false;
    vcArmed = false;
    vcTapShouldStop = false;
    vcHolding = false;
    vcFab?.classList.remove('voice-fab-holding');
    if (vcPushTimer !== null) { clearTimeout(vcPushTimer); vcPushTimer = null; }
    vcBtnClass(false, false);
    const native = vcNativeBridge();
    if (native) { try { native.stop(); } catch { /* ignore */ } }
    if (vcRec) { try { vcRec.stop(); } catch { /* ignore */ } vcRec = null; }
    vcHideOverlay();
}

function vcBtnClass(listening: boolean, armed: boolean): void {
    ['voice-btn', 'voice-btn-left'].forEach((id) => {
        const b = document.getElementById(id);
        if (!b) return;
        b.classList.toggle('voice-listening', listening && vcMode === 'ambient' && !armed);
        b.classList.toggle('voice-armed', listening && vcMode === 'ambient' && armed);
    });
    if (vcFab) {
        vcFab.classList.toggle('voice-fab-listening', listening && armed);
        vcFab.classList.toggle('voice-fab-ambient', listening && !armed);
    }
}

function vcSetTitle(text: string): void {
    const el = document.getElementById('voice-title');
    if (el) el.textContent = text;
}

function vcArm(): void {
    if (vcArmed) return;
    vcArmed = true;
    vcBtnClass(true, true);
    vcSetTitle('Ouvindo comandos · diga "tchau contador" p/ sair');
    vcToast('🎙️ Comandos de voz ativados', true);
    try { navigator.vibrate?.(60); } catch { /* ignore */ }
}

function vcDisarm(): void {
    vcArmed = false;
    vcBtnClass(true, false);
    vcSetTitle('Mãos livres · diga "contador" p/ ativar');
    vcToast('🎙️ Comandos pausados', false);
    try { navigator.vibrate?.(30); } catch { /* ignore */ }
}

function vcShowOverlay(): void {
    if (vcOverlay) return;
    const el = document.createElement('div');
    el.className = 'voice-overlay';
    el.innerHTML = `
        <div class="voice-mic">🎙️</div>
        <div class="voice-text">
            <div class="voice-title" id="voice-title">Pode falar…</div>
            <div class="voice-heard" id="voice-heard"></div>
        </div>
        <button class="voice-help-btn" id="voice-help-btn" type="button" title="Comandos">?</button>
        <button class="voice-stop" id="voice-stop-btn" type="button">Parar</button>
    `;
    document.body.appendChild(el);
    vcOverlay = el;
    document.getElementById('voice-stop-btn')?.addEventListener('click', () => vcStop());
    document.getElementById('voice-help-btn')?.addEventListener('click', () => vcOpenHelp());
}

function vcHideOverlay(): void {
    vcOverlay?.remove();
    vcOverlay = null;
}

function vcSetHeard(text: string): void {
    const el = document.getElementById('voice-heard');
    if (el) el.textContent = text;
}

// Ajuda: lista de comandos (abre com "ajuda", pelo "?" do overlay ou segurando o microfone).
const VC_HELP: Array<[string, string[]]> = [
    ['Vida', ['"Zé menos 3" · "Laura mais 5"', '"Reis vida 40" · "Cabral com 12"', '"metade da vida do Zé" · "dobra a vida da Maria"', '"todos menos 2" · "todo mundo com 40"', '"troca a vida do Zé com a do Reis"']],
    ['Comandante', ['"Zé 7 de comandante do Reis"', '"comandante do Zé morreu" (tax)']],
    ['Morte', ['"Zé morreu" · "Reis matou o Zé"', '"revive o Zé"']],
    ['Contadores', ['"2 de veneno no Zé" · "Laura mais 1 de energia"', '"zera o veneno do Zé" · experiência · storm']],
    ['Monarca', ['"monarca pro Zé" · "tira o monarca"']],
    ['Mesa', ['"próximo turno" · "desfazer" · "quem começa"', '"sortear viado" · "rola um d20" · "cara ou coroa"', '"reiniciar partida" · "tela cheia" · "timer ligado"']],
    ['Perguntas', ['"como tá a mesa" · "quanto de vida tem o Zé"', '"quem tá ganhando" · "que turno" · "quanto tempo"']],
    ['Som e visual', ['"tema escuro/vermelho/streamer"', '"música épica/sombria/parar"', '"som desligado" · "narrador ligado"', '"vitória escandalosa desligada"']],
    ['Telas', ['"ranking" · "histórico" · "perfis"', '"configurações" · "ferramentas" · "atualização"']],
    ['Microfone', ['Segure o botão no meio da mesa, fale e solte (como áudio do WhatsApp).', 'Toque rápido: fica ouvindo até o próximo toque ou até aplicar o comando.', 'Mãos livres: Ferramentas › Comando de voz, aí diga "contador" antes de cada comando.']],
];

function vcOpenHelp(): void {
    document.getElementById('voice-help-dyn')?.remove();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'voice-help-dyn';
    modal.innerHTML = `
        <div class="modal-content voice-help-content">
            <div class="modal-header">
                <h2>🎙️ Comandos de voz</h2>
                <button class="modal-close" type="button">&times;</button>
            </div>
            <div class="voice-help-body">
                ${VC_HELP.map(([title, lines]) => `
                    <div class="voice-help-group">
                        <div class="podium-section-label">${title}</div>
                        ${lines.map((l) => `<div class="voice-help-line">${l}</div>`).join('')}
                    </div>`).join('')}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const close = (): void => modal.remove();
    modal.querySelector('.modal-close')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
}

let vcToastTimer: number | null = null;
function vcToast(text: string, ok: boolean): void {
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
    if (vcToastTimer !== null) clearTimeout(vcToastTimer);
    vcToastTimer = window.setTimeout(() => {
        toast?.classList.remove('voice-toast-show');
    }, 2600);
}
