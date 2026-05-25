// ===== Narrador com persona + roast (IA) =====
// Gera falas curtas no estilo da persona escolhida e fala via o narrador (TTS).
// Persona "classic" usa as frases fixas do narrador (sem custo de IA).
import { gameState } from './state.js';
import { narrator } from './audio.js';
import { geminiText, isGeminiConfigured } from './aiClient.js';
const PERSONA_STYLE = {
    classic: '',
    futebol: 'Você é um locutor de futebol brasileiro, eufórico, à beira do grito de "GOOOL".',
    galvao: 'Você é o Galvão Bueno narrando: bordões como "Bem amigos!" e "Haja coração!", nostálgico e exagerado.',
    novela: 'Você é um narrador de novela das 9: dramático, pausado, pomposo e melodramático.',
    caze: 'Você é o Casimiro (CazéTV) reagindo: gíria de internet, muita zoeira, informal e engraçado.',
};
function getPersona() {
    return (gameState.getState().settings.narratorPersona ?? 'classic');
}
function narratorOn() {
    return gameState.getState().settings.narratorEnabled === true;
}
async function speakPersona(persona, situation) {
    const prompt = [
        PERSONA_STYLE[persona],
        'Comente em português, em UMA frase curta e impactante (máx ~20 palavras), pronta para ser falada em voz alta.',
        'Não use emojis, asteriscos nem aspas.',
        situation,
    ].join('\n');
    try {
        const line = await geminiText(prompt, { temperature: 0.95, maxOutputTokens: 90 });
        narrator.speak(line.replace(/["*_#]/g, '').trim());
    }
    catch (e) {
        console.warn('aiNarrator error:', e);
    }
}
export function narrateElimination(playerName) {
    if (!narratorOn())
        return;
    const persona = getPersona();
    if (persona === 'classic' || !isGeminiConfigured()) {
        narrator.announceElimination(playerName);
        return;
    }
    void speakPersona(persona, `Situação: o jogador "${playerName}" acabou de ser ELIMINADO da partida de Magic. Solte uma zoeira/roast curto com ele (brincadeira leve entre amigos).`);
}
export function narrateWinner(playerName) {
    if (!narratorOn())
        return;
    const persona = getPersona();
    if (persona === 'classic' || !isGeminiConfigured()) {
        narrator.announceWinner(playerName);
        return;
    }
    void speakPersona(persona, `Situação: "${playerName}" VENCEU a partida de Magic. Faça a narração épica da vitória.`);
}
export function narrateStarter(playerName) {
    if (!narratorOn())
        return;
    const persona = getPersona();
    if (persona === 'classic' || !isGeminiConfigured()) {
        narrator.announceRandomStarter(playerName);
        return;
    }
    void speakPersona(persona, `Situação: "${playerName}" foi sorteado para COMEÇAR a partida de Magic. Anuncie com empolgação.`);
}
//# sourceMappingURL=aiNarrator.js.map