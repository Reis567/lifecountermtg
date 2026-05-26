// ===== Assistente de IA & Cartas =====
// Um único modal com 4 modos, todos usando o Gemini (aiClient) e o Scryfall:
//   - identify    : foto -> identifica a carta + dados oficiais (Scryfall, PT)
//   - translate   : tradução ao vivo (câmera contínua) do texto da carta
//   - interaction : 2 fotos -> explica como as cartas interagem
//   - judge        : pergunta em texto -> juiz de regras em PT
//
// Identificadores de módulo usam prefixo `cs`/`cardScan` (o build do Android
// concatena tudo num único escopo).

import { geminiGenerate, geminiText, jpegPart, isGeminiConfigured, parseJsonLoose } from './aiClient.js';

type CardScanMode = 'identify' | 'interaction' | 'judge';
type CardScanView = 'capture' | 'judge' | 'loading' | 'result' | 'error';

// ----- Estado -----
let cardScanStream: MediaStream | null = null;
let cardScanBusy = false;
let csMode: CardScanMode = 'identify';
let csShots: string[] = [];
let csLastCardName = '';
let csJudgeImage: string | null = null;

// ----- Tipos -----
interface CardScanIdentification {
    name_en: string;
    name_printed: string;
    lang: string;
    confidence: number;
    not_a_card: boolean;
    notes: string;
}

interface CardScanScryfall {
    name: string;
    printedName: string;
    typeLine: string;
    manaCost: string;
    oracleText: string;
    setName: string;
    imageUrl: string;
    scryfallUri: string;
    foundPt: boolean;
}

// ----- Helpers -----
function csEl(id: string): HTMLElement {
    return document.getElementById(id) as HTMLElement;
}

function csEsc(text: string): string {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
}

// Escapa HTML, aplica **negrito** e quebras de linha.
function csFormatText(text: string): string {
    let html = csEsc(text);
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    return html;
}

function csDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function csReadableSymbols(text: string): string {
    if (!text) return '';
    return text.replace(/\{([^}]+)\}/g, (_m, sym: string) => ` ${sym} `).replace(/\s+/g, ' ').trim();
}

// ===== Ciclo de vida do modal =====
export function openCardScanner(mode: CardScanMode = 'identify'): void {
    const modal = csEl('card-scan-modal');
    if (!modal) return;
    modal.classList.add('active');
    cardScanBusy = false;
    csSetMode(mode);
}

export function closeCardScanner(): void {
    csStopCamera();
    csEl('card-scan-modal')?.classList.remove('active');
}

export function setupCardScanner(): void {
    const modal = csEl('card-scan-modal');
    if (!modal) return;

    modal.querySelector('.modal-close')?.addEventListener('click', () => csStopCamera());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) csStopCamera();
    });

    // Tabs de modo
    modal.querySelectorAll('.cs-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            const mode = (tab as HTMLElement).dataset.mode as CardScanMode;
            if (mode) csSetMode(mode);
        });
    });

    csEl('cs-capture-btn')?.addEventListener('click', () => csCaptureFromVideo());
    csEl('cs-judge-btn')?.addEventListener('click', () => void csAskJudge());
    csEl('cs-judge-photo-btn')?.addEventListener('click', () => csPickFile(true));
    csEl('cs-retry-btn')?.addEventListener('click', () => csReturnToCapture());
    csEl('cs-error-retry-btn')?.addEventListener('click', () => csReturnToCapture());

    const fileInput = csEl('cs-file-input') as HTMLInputElement;
    csEl('cs-gallery-btn')?.addEventListener('click', () => csPickFile(false));
    fileInput?.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (file) {
            if (csMode !== 'judge') csStopCamera();
            void csHandleFile(file);
        }
        fileInput.value = '';
    });
}

// ===== Modos =====
function csSetMode(mode: CardScanMode): void {
    csMode = mode;
    csShots = [];

    // Tabs
    document.querySelectorAll('.cs-tab').forEach((tab) => {
        tab.classList.toggle('active', (tab as HTMLElement).dataset.mode === mode);
    });

    const captureBtn = csEl('cs-capture-btn') as HTMLButtonElement;
    const galleryBtn = csEl('cs-gallery-btn');
    const shots = csEl('cs-shots');
    const msg = csEl('cs-camera-msg');

    if (shots) {
        shots.style.display = 'none';
        shots.innerHTML = '';
    }

    if (mode === 'judge') {
        csStopCamera();
        csJudgeImage = null;
        csRenderJudgeShot();
        const answer = csEl('cs-judge-answer');
        if (answer) {
            answer.style.display = 'none';
            answer.innerHTML = '';
        }
        const ctx = csEl('cs-judge-context');
        if (ctx) {
            if (csLastCardName) {
                ctx.textContent = `Contexto: última carta vista "${csLastCardName}".`;
                ctx.style.display = '';
            } else {
                ctx.style.display = 'none';
            }
        }
        csShowView('judge');
        return;
    }

    // Modos com câmera
    csShowView('capture');
    if (mode === 'identify') {
        captureBtn.textContent = '📷 Capturar';
        if (msg) msg.textContent = 'Enquadre a carta e toque em Capturar.';
    } else if (mode === 'interaction') {
        captureBtn.textContent = '📷 Foto 1 de 2';
        if (shots) shots.style.display = 'flex';
        if (msg) msg.textContent = 'Fotografe a 1ª carta, depois a 2ª.';
    }
    captureBtn.style.display = '';
    if (galleryBtn) galleryBtn.style.display = '';
    void csStartCamera();
}

function csReturnToCapture(): void {
    csSetMode(csMode);
}

// ===== Câmera =====
async function csStartCamera(): Promise<void> {
    const video = csEl('cs-video') as HTMLVideoElement;
    const msg = csEl('cs-camera-msg');
    const captureBtn = csEl('cs-capture-btn') as HTMLButtonElement;
    if (!video) return;

    if (cardScanStream) {
        if (captureBtn) captureBtn.disabled = false;
        return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
        video.style.display = 'none';
        if (captureBtn) captureBtn.disabled = true;
        if (msg) msg.innerHTML = 'Câmera indisponível. Use <b>Galeria</b> para enviar uma foto.';
        return;
    }

    try {
        cardScanStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
        });
        video.srcObject = cardScanStream;
        await video.play().catch(() => { /* alguns WebViews iniciam sozinhos */ });
        video.style.display = '';
        if (captureBtn) captureBtn.disabled = false;
    } catch (e) {
        video.style.display = 'none';
        if (captureBtn) captureBtn.disabled = true;
        if (msg) msg.innerHTML = 'Não foi possível acessar a câmera. Use <b>Galeria</b> para enviar uma foto.';
        console.warn('Card scanner camera error:', e);
    }
}

function csStopCamera(): void {
    if (cardScanStream) {
        cardScanStream.getTracks().forEach((t) => t.stop());
        cardScanStream = null;
    }
    const video = csEl('cs-video') as HTMLVideoElement;
    if (video) video.srcObject = null;
}

function csGrabFrame(): string | null {
    const video = csEl('cs-video') as HTMLVideoElement;
    if (!cardScanStream || !video || video.videoWidth === 0) return null;
    return csDownscaleToJpeg(video, video.videoWidth, video.videoHeight, 1024);
}

function csCaptureFromVideo(): void {
    if (cardScanBusy) return;
    const base64 = csGrabFrame();
    if (!base64) return;
    if (csMode === 'interaction') {
        csAddShot(base64);
    } else {
        csStopCamera();
        void csIdentify(base64);
    }
}

// Abre o seletor de arquivo; com useCamera, pede a câmera (capture) — usado no Juiz.
function csPickFile(useCamera: boolean): void {
    const input = csEl('cs-file-input') as HTMLInputElement;
    if (!input) return;
    if (useCamera) input.setAttribute('capture', 'environment');
    else input.removeAttribute('capture');
    input.click();
}

async function csHandleFile(file: File): Promise<void> {
    if (cardScanBusy) return;
    const url = URL.createObjectURL(file);
    try {
        const img = await csLoadImage(url);
        const base64 = csDownscaleToJpeg(img, img.naturalWidth, img.naturalHeight, 1024);
        if (csMode === 'interaction') {
            csAddShot(base64);
        } else if (csMode === 'judge') {
            csSetJudgeImage(base64);
        } else {
            void csIdentify(base64);
        }
    } catch (e) {
        console.error('Card scanner file error:', e);
        csShowError('Não consegui ler essa imagem. Tente outra foto.');
    } finally {
        URL.revokeObjectURL(url);
    }
}

function csLoadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function csDownscaleToJpeg(source: CanvasImageSource, width: number, height: number, maxEdge: number): string {
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível');
    ctx.drawImage(source, 0, 0, w, h);
    return (canvas.toDataURL('image/jpeg', 0.85).split(',')[1]) ?? '';
}

// ===== Modo IDENTIFY =====
async function csIdentify(base64Jpeg: string): Promise<void> {
    if (!base64Jpeg) {
        csShowError('Não consegui capturar a imagem. Tente de novo.');
        return;
    }
    if (!isGeminiConfigured()) {
        csShowError('Chave do Gemini não configurada. Edite src/ts/config.ts e adicione sua chave.');
        return;
    }

    cardScanBusy = true;
    csShowLoading('Identificando carta...');

    try {
        const id = await csCallIdentify(base64Jpeg);

        if (id.not_a_card) {
            csShowError('Isso não parece ser uma carta de Magic. Tente novamente.');
            return;
        }
        if (!id.name_en && !id.name_printed) {
            csShowError('Não consegui identificar a carta. Tente uma foto mais nítida e bem iluminada.');
            return;
        }

        let scry: CardScanScryfall | null = null;
        if (id.name_en) {
            try {
                scry = await csFetchScryfall(id.name_en);
            } catch (e) {
                console.warn('Scryfall lookup failed:', e);
            }
        }

        csLastCardName = scry?.name || id.name_en || id.name_printed;
        csRenderResult(id, scry);
        csShowView('result');
    } catch (e) {
        console.error('Card identify error:', e);
        csShowError(e instanceof Error ? e.message : 'Erro ao identificar a carta.');
    } finally {
        cardScanBusy = false;
    }
}

async function csCallIdentify(base64Jpeg: string): Promise<CardScanIdentification> {
    const prompt = [
        'You are an expert Magic: The Gathering card identifier.',
        'The image shows a single MTG card, possibly printed in Japanese or another non-English language.',
        'Use the card art, mana cost, type line and any readable text to determine the exact card.',
        'Return ONLY a JSON object (no markdown) with this exact shape:',
        '{',
        '  "name_en": string,      // canonical English Oracle name, exactly. "" if you cannot identify it.',
        '  "name_printed": string, // the name exactly as printed in the photo. "" if unreadable.',
        '  "lang": string,         // ISO code of the printed language, e.g. "ja", "en", "pt". "" if unknown.',
        '  "confidence": number,   // 0..1, your confidence in name_en.',
        '  "not_a_card": boolean,  // true if the image is NOT a Magic: The Gathering card.',
        '  "notes": string         // short note if ambiguous. "" if none.',
        '}',
        'The English name MUST match the official Oracle name exactly so it can be looked up in a database.',
    ].join('\n');

    const text = await geminiGenerate([{ text: prompt }, jpegPart(base64Jpeg)], { temperature: 0, json: true });
    const parsed = parseJsonLoose(text);
    return {
        name_en: String(parsed.name_en ?? '').trim(),
        name_printed: String(parsed.name_printed ?? '').trim(),
        lang: String(parsed.lang ?? '').trim(),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        not_a_card: parsed.not_a_card === true,
        notes: String(parsed.notes ?? '').trim(),
    };
}

async function csFetchScryfall(nameEn: string): Promise<CardScanScryfall> {
    const enResp = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(nameEn)}`);
    if (!enResp.ok) throw new Error('Carta não encontrada no Scryfall.');
    const en: any = await enResp.json();

    const result: CardScanScryfall = {
        name: en.name ?? nameEn,
        printedName: '',
        typeLine: en.type_line ?? '',
        manaCost: en.mana_cost ?? csFaceField(en, 'mana_cost'),
        oracleText: en.oracle_text ?? csFaceField(en, 'oracle_text'),
        setName: en.set_name ?? '',
        imageUrl: csImageFromCard(en),
        scryfallUri: en.scryfall_uri ?? '',
        foundPt: false,
    };

    if (en.name) {
        try {
            await csDelay(120);
            const q = `!"${en.name}" lang:pt`;
            const ptResp = await fetch(
                `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&unique=prints&include_multilingual=true`,
            );
            if (ptResp.ok) {
                const ptData: any = await ptResp.json();
                const pt = ptData?.data?.[0];
                if (pt) {
                    result.foundPt = true;
                    result.printedName = pt.printed_name ?? '';
                    result.typeLine = pt.printed_type_line || result.typeLine;
                    result.oracleText = pt.printed_text || result.oracleText;
                    const ptImg = csImageFromCard(pt);
                    if (ptImg) result.imageUrl = ptImg;
                }
            }
        } catch (e) {
            console.warn('Scryfall PT lookup failed:', e);
        }
    }
    return result;
}

function csImageFromCard(card: any): string {
    if (card?.image_uris?.normal) return card.image_uris.normal;
    const face = card?.card_faces?.[0];
    if (face?.image_uris?.normal) return face.image_uris.normal;
    return '';
}

function csFaceField(card: any, field: string): string {
    const face = card?.card_faces?.[0];
    return face?.[field] ?? '';
}

function csRenderResult(id: CardScanIdentification, scry: CardScanScryfall | null): void {
    const container = csEl('cs-result');
    if (!container) return;

    const confidencePct = Math.round(Math.max(0, Math.min(1, id.confidence)) * 100);
    const confidenceClass = confidencePct >= 70 ? 'high' : confidencePct >= 40 ? 'mid' : 'low';
    const parts: string[] = [];

    if (scry?.imageUrl) {
        parts.push(`<img class="cs-card-img" src="${csEsc(scry.imageUrl)}" alt="${csEsc(scry.name)}">`);
    }
    parts.push('<div class="cs-card-info">');

    const mainName = scry?.printedName || scry?.name || id.name_en || id.name_printed;
    parts.push(`<h3 class="cs-card-name">${csEsc(mainName)}</h3>`);
    if (scry?.name && scry.name !== mainName) {
        parts.push(`<div class="cs-card-sub">EN: ${csEsc(scry.name)}</div>`);
    }
    if (id.name_printed && id.name_printed !== mainName && id.name_printed !== scry?.name) {
        parts.push(`<div class="cs-card-sub">Na carta: ${csEsc(id.name_printed)}</div>`);
    }

    if (scry) {
        if (scry.manaCost) parts.push(`<div class="cs-card-row"><span class="cs-label">Custo</span> ${csEsc(csReadableSymbols(scry.manaCost))}</div>`);
        if (scry.typeLine) parts.push(`<div class="cs-card-row"><span class="cs-label">Tipo</span> ${csEsc(scry.typeLine)}</div>`);
        if (scry.oracleText) parts.push(`<div class="cs-card-oracle">${csEsc(csReadableSymbols(scry.oracleText)).replace(/\n/g, '<br>')}</div>`);
        if (scry.setName) parts.push(`<div class="cs-card-set">${csEsc(scry.setName)}${scry.foundPt ? ' · PT' : ''}</div>`);
        if (scry.scryfallUri) parts.push(`<a class="cs-scryfall-link" href="${csEsc(scry.scryfallUri)}" target="_blank" rel="noopener">Ver no Scryfall ↗</a>`);
    } else {
        parts.push('<div class="cs-card-warn">Não encontrei essa carta no Scryfall — mostrando só o que identifiquei na foto.</div>');
    }
    if (id.notes) parts.push(`<div class="cs-card-note">${csEsc(id.notes)}</div>`);
    parts.push(`<div class="cs-confidence cs-confidence-${confidenceClass}">Confiança: ${confidencePct}%</div>`);
    parts.push('</div>');

    container.innerHTML = parts.join('');
}

// ===== Modo INTERACTION (2 cartas) =====
function csAddShot(base64: string): void {
    csShots.push(base64);
    const shots = csEl('cs-shots');
    if (shots) {
        const thumb = document.createElement('img');
        thumb.className = 'cs-shot-thumb';
        thumb.src = `data:image/jpeg;base64,${base64}`;
        shots.appendChild(thumb);
    }
    const captureBtn = csEl('cs-capture-btn') as HTMLButtonElement;

    if (csShots.length >= 2) {
        void csAnalyzeInteraction();
    } else {
        if (captureBtn) captureBtn.textContent = '📷 Foto 2 de 2';
        const msg = csEl('cs-camera-msg');
        if (msg) msg.textContent = 'Agora fotografe a 2ª carta.';
        void csStartCamera();
    }
}

// Identifica uma carta (Gemini) e busca o texto oficial (Scryfall), best-effort.
async function csIdentifyCardData(base64: string): Promise<{ name: string; oracle: string }> {
    try {
        const id = await csCallIdentify(base64);
        let name = id.name_printed || id.name_en;
        let oracle = '';
        if (id.name_en) {
            try {
                const s = await csFetchScryfall(id.name_en);
                name = s.name;
                oracle = s.oracleText;
            } catch { /* sem Scryfall: usa só o nome do Gemini */ }
        }
        return { name, oracle };
    } catch {
        return { name: '', oracle: '' };
    }
}

async function csAnalyzeInteraction(): Promise<void> {
    if (csShots.length < 2) return;
    csStopCamera();
    cardScanBusy = true;
    if (!isGeminiConfigured()) {
        csShowError('Chave do Gemini não configurada. Edite src/ts/config.ts e adicione sua chave.');
        cardScanBusy = false;
        csShots = [];
        return;
    }
    csShowLoading('Identificando as cartas...');

    try {
        // Identifica cada carta separadamente (mais confiável que mandar 2 fotos cruas).
        const [c1, c2] = await Promise.all([
            csIdentifyCardData(csShots[0]),
            csIdentifyCardData(csShots[1]),
        ]);
        csShowLoading('Analisando a interação...');

        const context = [
            c1.name ? `Carta 1: ${c1.name}${c1.oracle ? ` — ${c1.oracle}` : ''}` : 'Carta 1: (veja a imagem)',
            c2.name ? `Carta 2: ${c2.name}${c2.oracle ? ` — ${c2.oracle}` : ''}` : 'Carta 2: (veja a imagem)',
        ].join('\n');

        const prompt = [
            'Você é um juiz de Magic: The Gathering. Responda direto, sem saudação nem preâmbulo (não comece com "Olá"). Em português, objetivo (~150 palavras):',
            '1) o que cada carta faz; 2) se elas combam/sinergizam; 3) como a interação resolve nas regras (pilha, timing, prioridade).',
            'Dados das cartas (use as imagens caso falte algum texto):',
            context,
            'Pode usar **negrito** nos nomes.',
        ].join('\n');

        const text = await geminiGenerate(
            [{ text: prompt }, jpegPart(csShots[0]), jpegPart(csShots[1])],
            { temperature: 0.3, maxOutputTokens: 1100 },
        );

        const container = csEl('cs-result');
        if (container) {
            const header = (c1.name && c2.name)
                ? `<div class="cs-card-sub" style="margin-bottom:.4rem"><strong>${csEsc(c1.name)}</strong> + <strong>${csEsc(c2.name)}</strong></div>`
                : '';
            container.innerHTML = header + `<div class="cs-answer">${csFormatText(text.trim())}</div>`;
        }
        csShowView('result');
    } catch (e) {
        console.error('Interaction error:', e);
        csShowError(e instanceof Error ? e.message : 'Erro ao analisar a interação.');
    } finally {
        cardScanBusy = false;
        csShots = [];
    }
}

// ===== Modo JUDGE (texto + foto opcional) =====
function csSetJudgeImage(base64: string): void {
    csJudgeImage = base64;
    csRenderJudgeShot();
}

function csRenderJudgeShot(): void {
    const shot = csEl('cs-judge-shot');
    const btn = csEl('cs-judge-photo-btn');
    if (!shot) return;
    if (csJudgeImage) {
        shot.style.display = 'flex';
        shot.innerHTML =
            `<img class="cs-shot-thumb" src="data:image/jpeg;base64,${csJudgeImage}" alt="carta">` +
            '<button id="cs-judge-clear" class="cs-judge-clear" aria-label="Remover foto">✕</button>';
        shot.querySelector('#cs-judge-clear')?.addEventListener('click', () => {
            csJudgeImage = null;
            csRenderJudgeShot();
        });
        if (btn) btn.textContent = '📷 Trocar foto';
    } else {
        shot.style.display = 'none';
        shot.innerHTML = '';
        if (btn) btn.textContent = '📷 Foto da carta';
    }
}

async function csAskJudge(): Promise<void> {
    const input = csEl('cs-judge-input') as HTMLTextAreaElement;
    const answer = csEl('cs-judge-answer');
    const btn = csEl('cs-judge-btn') as HTMLButtonElement;
    if (!input || !answer) return;

    let question = input.value.trim();
    if (!question && csJudgeImage) question = 'O que essa carta faz? Explique as regras dela.';
    if (!question) {
        answer.style.display = '';
        answer.innerHTML = '<div class="cs-answer-error">Escreva uma pergunta ou anexe a foto de uma carta.</div>';
        return;
    }
    if (!isGeminiConfigured()) {
        answer.style.display = '';
        answer.innerHTML = '<div class="cs-answer-error">Chave do Gemini não configurada (src/ts/config.ts).</div>';
        return;
    }

    if (btn) btn.disabled = true;
    answer.style.display = '';
    answer.innerHTML = '<div class="loading-spinner"></div>';

    const prompt = [
        'Você é um juiz oficial de Magic: The Gathering. Responda em português, claro e correto segundo as regras atuais.',
        'Vá direto ao ponto, sem saudação nem preâmbulo (não comece com "Olá").',
        csJudgeImage
            ? 'A imagem anexada mostra uma carta (pode estar em japonês). Considere-a ao responder.'
            : (csLastCardName ? `Contexto: a última carta vista pelo jogador foi "${csLastCardName}".` : ''),
        'Se a pergunta for sobre uma carta específica, explique o que ela faz.',
        `Pergunta: ${question}`,
    ].filter(Boolean).join('\n');

    try {
        const text = csJudgeImage
            ? await geminiGenerate([{ text: prompt }, jpegPart(csJudgeImage)], { temperature: 0.3, maxOutputTokens: 1100 })
            : await geminiText(prompt, { temperature: 0.3, maxOutputTokens: 1100 });
        answer.innerHTML = `<div class="cs-answer">${csFormatText(text.trim())}</div>`;
    } catch (e) {
        console.error('Judge error:', e);
        const msg = e instanceof Error ? e.message : 'Erro ao consultar o Gemini.';
        answer.innerHTML = `<div class="cs-answer-error">${csEsc(msg)}</div>`;
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ===== Views =====
function csShowLoading(message: string): void {
    const el = csEl('cs-loading-msg');
    if (el) el.textContent = message;
    csShowView('loading');
}

function csShowView(view: CardScanView): void {
    const views: Record<CardScanView, string> = {
        capture: 'cs-view-capture',
        judge: 'cs-view-judge',
        loading: 'cs-view-loading',
        result: 'cs-view-result',
        error: 'cs-view-error',
    };
    (Object.keys(views) as CardScanView[]).forEach((key) => {
        const el = csEl(views[key]);
        if (el) el.style.display = key === view ? '' : 'none';
    });
}

function csShowError(message: string): void {
    const el = csEl('cs-error-msg');
    if (el) el.textContent = message;
    csShowView('error');
}
