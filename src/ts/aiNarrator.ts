// ===== Narrador com persona + roast (IA) =====
// Gera falas curtas no estilo da persona escolhida e fala via o narrador (TTS).
// Persona "classic" usa as frases fixas do narrador (sem custo de IA).

import { gameState } from './state.js';
import { narrator } from './audio.js';
import { geminiText, isGeminiConfigured } from './aiClient.js';
import { NarratorPersona } from './types.js';

const PERSONA_STYLE: Record<NarratorPersona, string> = {
    classic: '',
    futebol: 'Você é um locutor de futebol brasileiro, eufórico, à beira do grito de "GOOOL".',
    galvao: 'Você é o Galvão Bueno narrando: bordões como "Bem amigos!" e "Haja coração!", nostálgico e exagerado.',
    novela: 'Você é um narrador de novela das 9: dramático, pausado, pomposo e melodramático.',
    caze: 'Você é o Casimiro (CazéTV) reagindo: gíria de internet, muita zoeira, informal e engraçado.',
};

function getPersona(): NarratorPersona {
    return (gameState.getState().settings.narratorPersona ?? 'classic') as NarratorPersona;
}

// ----- Contexto da mesa (vem do servidor no início da partida) -----
// Por jogador: nêmesis, sequência atual, últimas colocações, vitórias totais.
// Entra nos prompts pra zoeira ter base ("Zé perdeu as três últimas pro Reis").
export interface NarratorPlayerContext {
    name: string;
    wins: number;
    matches: number;
    currentStreak: number;
    bestStreak: number;
    nemesis: string | null;
    recentPlaces: number[]; // mais recente primeiro
    elo?: number;
    rankSeason?: number | null;
}

let narratorContext: Record<string, NarratorPlayerContext> = {}; // chave: nome do jogador (lowercase)

export function setNarratorContext(list: NarratorPlayerContext[]): void {
    narratorContext = {};
    list.forEach((c) => { narratorContext[c.name.trim().toLowerCase()] = c; });
}

function contextLine(playerName: string): string {
    const c = narratorContext[playerName.trim().toLowerCase()];
    if (!c || !c.matches) return '';
    const parts: string[] = [`${c.wins} vitória(s) em ${c.matches} partida(s)`];
    if (c.currentStreak >= 2) parts.push(`vem de ${c.currentStreak} vitórias seguidas`);
    const lastLosses = c.recentPlaces.findIndex((p) => p === 1);
    const losses = lastLosses === -1 ? c.recentPlaces.length : lastLosses;
    if (losses >= 2 && c.currentStreak === 0) parts.push(`perdeu as últimas ${losses}`);
    if (c.nemesis) parts.push(`o nêmesis dele é ${c.nemesis}`);
    if (c.rankSeason) parts.push(`${c.rankSeason}º no ranking da temporada`);
    return `Contexto real de "${playerName}": ${parts.join('; ')}. Use isso na fala se fizer graça, sem inventar números.`;
}

function tableContext(): string {
    const names = gameState.getState().players.map((p) => p.name);
    const lines = names.map(contextLine).filter(Boolean);
    return lines.length ? lines.join('\n') : '';
}

function narratorOn(): boolean {
    return gameState.getState().settings.narratorEnabled === true;
}

async function speakPersona(persona: NarratorPersona, situation: string): Promise<void> {
    const prompt = [
        PERSONA_STYLE[persona],
        'Comente em português, em UMA frase curta e impactante (máx ~20 palavras), pronta para ser falada em voz alta.',
        'Não use emojis, asteriscos nem aspas.',
        situation,
    ].join('\n');
    try {
        const line = await geminiText(prompt, { temperature: 0.95, maxOutputTokens: 120 });
        narrator.speak(line.replace(/["*_#]/g, '').trim());
    } catch (e) {
        console.warn('aiNarrator error:', e);
    }
}

export function narrateElimination(playerName: string): void {
    if (!narratorOn()) return;
    const persona = getPersona();
    if (persona === 'classic' || !isGeminiConfigured()) {
        narrator.announceElimination(playerName);
        return;
    }
    void speakPersona(
        persona,
        `Situação: o jogador "${playerName}" acabou de ser ELIMINADO da partida de Magic. Solte uma zoeira/roast curto com ele (brincadeira leve entre amigos).\n${contextLine(playerName)}`,
    );
}

export function narrateWinner(playerName: string): void {
    if (!narratorOn()) return;
    const persona = getPersona();
    if (persona === 'classic' || !isGeminiConfigured()) {
        narrator.announceWinner(playerName);
        return;
    }
    void speakPersona(persona, `Situação: "${playerName}" VENCEU a partida de Magic. Faça a narração épica da vitória.\n${contextLine(playerName)}\n${tableContext()}`);
}

// Vitória escandalosa: em vez de UMA frase, pede uma metralhadora de gritos para
// cobrir os 8 segundos de escândalo. Retorna [] se a IA estiver desligada — nesse
// caso o victory.ts usa o repertório fixo dele.
export async function narrateWinnerEscandaloso(playerName: string): Promise<string[]> {
    const persona = getPersona();
    if (persona === 'classic' || !isGeminiConfigured()) return [];

    const prompt = [
        PERSONA_STYLE[persona],
        `Situação: "${playerName}" VENCEU a partida de Magic e o aplicativo está fazendo um escândalo de 8 segundos: sirene, confete, flash e vibração.`,
        contextLine(playerName),
        'Narre a vitória GRITANDO, no auge do exagero, como se fosse o gol da final.',
        'Responda com 5 frases curtas (máx ~12 palavras cada), UMA POR LINHA.',
        'Sem numeração, sem emojis, sem aspas, sem asteriscos.',
    ].join('\n');

    try {
        const text = await geminiText(prompt, { temperature: 1, maxOutputTokens: 300 });
        return text
            .split('\n')
            .map(line => line.replace(/^[\s\-*\d.)]+/, '').replace(/["*_#]/g, '').trim())
            .filter(Boolean)
            .slice(0, 6);
    } catch (e) {
        console.warn('aiNarrator escandalosa error:', e);
        return [];
    }
}

export function narrateStarter(playerName: string): void {
    if (!narratorOn()) return;
    const persona = getPersona();
    if (persona === 'classic' || !isGeminiConfigured()) {
        narrator.announceRandomStarter(playerName);
        return;
    }
    void speakPersona(persona, `Situação: "${playerName}" foi sorteado para COMEÇAR a partida de Magic. Anuncie com empolgação.`);
}
