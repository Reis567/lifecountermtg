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

// ===== Voz por IA (Gemini TTS) =====
// O narrador pode falar com uma voz do Gemini em vez do TTS do aparelho: cada
// persona tem uma voz e uma instrução de estilo. A API devolve PCM 16-bit 24 kHz
// em base64; embrulhamos num WAV e tocamos com <audio>. Falhou → quem chamou
// cai pro TTS do aparelho.
export const GEMINI_TTS_VOICES: Record<string, { voice: string; style: string }> = {
    classic: { voice: 'Kore', style: 'Fale de forma clara e animada, como um narrador de jogo' },
    futebol: { voice: 'Puck', style: 'Fale como um locutor de futebol brasileiro eufórico, rápido e empolgado' },
    galvao: { voice: 'Fenrir', style: 'Fale como um narrador esportivo veterano, dramático e nostálgico' },
    novela: { voice: 'Aoede', style: 'Fale como uma narradora de novela, pausada, grave e melodramática' },
    caze: { voice: 'Charon', style: 'Fale como um streamer brasileiro reagindo, informal, rindo, zoando' },
};

function pcm16ToWav(pcm: Uint8Array, sampleRate = 24000): Blob {
    const header = new ArrayBuffer(44);
    const v = new DataView(header);
    const w = (o: number, s: string): void => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true); w(8, 'WAVE');
    w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, pcm.length, true);
    const body = new ArrayBuffer(pcm.length);
    new Uint8Array(body).set(pcm);
    return new Blob([header, body], { type: 'audio/wav' });
}

const ttsCache = new Map<string, string>(); // texto+voz -> object URL

export async function geminiSpeak(text: string, persona: string, volume = 0.8): Promise<HTMLAudioElement> {
    if (!isGeminiConfigured()) throw new Error('Chave do Gemini não configurada.');
    const cfg = GEMINI_TTS_VOICES[persona] || GEMINI_TTS_VOICES.classic;
    const key = `${cfg.voice}|${text}`;
    let url = ttsCache.get(key);
    if (!url) {
        const model = (typeof window !== 'undefined' && (window as any).LIFECOUNTER_GEMINI_TTS_MODEL) || 'gemini-2.5-flash-preview-tts';
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cfgKey())}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: `${cfg.style}, em português do Brasil: ${text}` }] }],
                generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.voice } } },
                },
            }),
        });
        const data: any = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error?.message || `TTS HTTP ${res.status}`);
        const part = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
        if (!part) throw new Error('Sem áudio na resposta.');
        const mime: string = part.inlineData.mimeType || '';
        const rate = Number((mime.match(/rate=(\d+)/) || [])[1] || 24000);
        const bin = atob(part.inlineData.data);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        let blob: Blob;
        if (mime.startsWith('audio/L16') || mime.includes('pcm') || !mime) {
            blob = pcm16ToWav(bytes, rate);
        } else {
            const raw = new ArrayBuffer(bytes.length);
            new Uint8Array(raw).set(bytes);
            blob = new Blob([raw], { type: mime });
        }
        url = URL.createObjectURL(blob);
        if (ttsCache.size > 40) { const first = ttsCache.keys().next().value; if (first) { URL.revokeObjectURL(ttsCache.get(first)!); ttsCache.delete(first); } }
        ttsCache.set(key, url);
    }
    const audio = new Audio(url);
    audio.volume = Math.max(0, Math.min(1, volume));
    await audio.play();
    return audio;
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
