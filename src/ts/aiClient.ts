// ===== Cliente Gemini compartilhado =====
// Helper único usado pelo scanner de cartas, juiz de regras, explicador de
// interação e narrador com persona.
//
// A chave NÃO é importada como módulo (um import que dá 404 derruba o app
// inteiro). Ela vem de um <script> clássico opcional (config.js) que define
// window.LIFECOUNTER_GEMINI_KEY. Se faltar, a IA fica desligada e o app funciona.

function cfgKey(): string {
    return (typeof window !== 'undefined' && (window as any).LIFECOUNTER_GEMINI_KEY) || '';
}

function cfgModel(): string {
    return (typeof window !== 'undefined' && (window as any).LIFECOUNTER_GEMINI_MODEL) || 'gemini-2.5-flash';
}

export type GeminiPart =
    | { text: string }
    | { inline_data: { mime_type: string; data: string } };

export interface GeminiOptions {
    temperature?: number;
    json?: boolean; // força responseMimeType = application/json
    maxOutputTokens?: number;
    model?: string;
    // Gemini 2.5 é "pensante" e os tokens de thinking consomem o maxOutputTokens,
    // truncando a resposta. Padrão 0 = desliga o thinking (resposta completa).
    thinkingBudget?: number;
}

export function isGeminiConfigured(): boolean {
    const k = cfgKey();
    return !!k && k !== 'COLE_SUA_CHAVE_GEMINI_AQUI';
}

// Parte de imagem JPEG (base64 sem o prefixo data:).
export function jpegPart(base64: string): GeminiPart {
    return { inline_data: { mime_type: 'image/jpeg', data: base64 } };
}

export async function geminiGenerate(parts: GeminiPart[], opts: GeminiOptions = {}): Promise<string> {
    if (!isGeminiConfigured()) {
        throw new Error('Chave do Gemini não configurada (config.js).');
    }

    const model = opts.model || cfgModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cfgKey())}`;

    const generationConfig: Record<string, unknown> = {
        temperature: opts.temperature ?? 0.4,
        // Desliga (ou limita) o thinking do Gemini 2.5 para a resposta não ser
        // truncada pelos tokens de raciocínio interno.
        thinkingConfig: { thinkingBudget: opts.thinkingBudget ?? 0 },
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
