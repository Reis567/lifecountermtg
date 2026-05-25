// ===== Cliente Gemini compartilhado =====
// Helper único usado pelo scanner de cartas, juiz de regras, explicador de
// interação, tradução ao vivo e narrador com persona.

import { GEMINI_API_KEY, GEMINI_MODEL } from './config.js';

export type GeminiPart =
    | { text: string }
    | { inline_data: { mime_type: string; data: string } };

export interface GeminiOptions {
    temperature?: number;
    json?: boolean; // força responseMimeType = application/json
    maxOutputTokens?: number;
    model?: string;
}

export function isGeminiConfigured(): boolean {
    return !!GEMINI_API_KEY && GEMINI_API_KEY !== 'COLE_SUA_CHAVE_GEMINI_AQUI';
}

// Parte de imagem JPEG (base64 sem o prefixo data:).
export function jpegPart(base64: string): GeminiPart {
    return { inline_data: { mime_type: 'image/jpeg', data: base64 } };
}

export async function geminiGenerate(parts: GeminiPart[], opts: GeminiOptions = {}): Promise<string> {
    if (!isGeminiConfigured()) {
        throw new Error('Chave do Gemini não configurada. Edite src/ts/config.ts e adicione sua chave.');
    }

    const model = opts.model || GEMINI_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

    const generationConfig: Record<string, unknown> = {
        temperature: opts.temperature ?? 0.4,
    };
    if (opts.json) generationConfig.responseMimeType = 'application/json';
    if (opts.maxOutputTokens) generationConfig.maxOutputTokens = opts.maxOutputTokens;

    const body = {
        contents: [{ role: 'user', parts }],
        generationConfig,
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const data: any = await response.json().catch(() => null);

    if (!response.ok) {
        const apiMsg = data?.error?.message || `HTTP ${response.status}`;
        if (response.status === 400 || response.status === 403) {
            throw new Error(`Falha na chave do Gemini: ${apiMsg}`);
        }
        if (response.status === 429) {
            throw new Error('Limite de uso do Gemini atingido. Tente mais tarde.');
        }
        throw new Error(`Gemini: ${apiMsg}`);
    }

    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        const blocked = data?.promptFeedback?.blockReason;
        throw new Error(blocked ? `Conteúdo bloqueado (${blocked}).` : 'Resposta vazia do Gemini.');
    }
    return text;
}

export async function geminiText(prompt: string, opts: GeminiOptions = {}): Promise<string> {
    return geminiGenerate([{ text: prompt }], opts);
}

// Extrai o primeiro objeto JSON de um texto (caso o modelo embrulhe em markdown).
export function parseJsonLoose(text: string): any {
    try {
        return JSON.parse(text);
    } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('Resposta em formato inesperado.');
        return JSON.parse(match[0]);
    }
}
