// ===== Glossário no toque =====
// Palavras-chave de Magic (em inglês, como vêm do Scryfall, e em português)
// viram termos tocáveis dentro do texto da carta; o toque abre a explicação em
// português vinda de MTG_KEYWORDS (types.ts). Sem rede, sem IA.
import { MTG_KEYWORDS } from './types.js';
let glRegex = null;
const glIndex = new Map();
function glBuild() {
    if (glRegex)
        return;
    const terms = [];
    for (const k of MTG_KEYWORDS) {
        const names = [k.reminder, k.name].filter((x) => !!x);
        for (const n of names) {
            const key = n.toLowerCase();
            if (!glIndex.has(key))
                glIndex.set(key, k);
            terms.push(n);
        }
    }
    // Mais longos primeiro ("first strike" antes de "strike"), sem acento no regex via alternância literal.
    terms.sort((a, b) => b.length - a.length);
    const esc = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    glRegex = new RegExp(`(?<![\\p{L}])(${esc.join('|')})(?![\\p{L}])`, 'giu');
}
export function glossaryLookup(term) {
    glBuild();
    return glIndex.get(term.toLowerCase()) || null;
}
// Recebe texto JÁ escapado (HTML) e devolve com os termos envolvidos em <span class="gl-term">.
export function glossaryHtml(escapedText) {
    glBuild();
    if (!escapedText)
        return '';
    return escapedText.replace(glRegex, (m) => `<span class="gl-term" data-term="${m.replace(/"/g, '&quot;')}">${m}</span>`);
}
// Liga o toque nos termos (uma vez, delegação no documento).
let glBound = false;
export function setupGlossary(askJudge) {
    if (glBound)
        return;
    glBound = true;
    document.addEventListener('click', (e) => {
        const t = e.target.closest('.gl-term');
        if (!t)
            return;
        e.preventDefault();
        e.stopPropagation();
        const term = t.dataset.term || t.textContent || '';
        const k = glossaryLookup(term);
        document.getElementById('gl-pop')?.remove();
        const pop = document.createElement('div');
        pop.id = 'gl-pop';
        pop.className = 'gl-pop';
        const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        pop.innerHTML = `
            <div class="gl-pop-card">
                <div class="gl-pop-head"><span class="gl-pop-term">${esc(k?.name || term)}</span>${k?.reminder && k.reminder.toLowerCase() !== (k.name || '').toLowerCase() ? `<span class="gl-pop-en">${esc(k.reminder)}</span>` : ''}</div>
                <div class="gl-pop-body">${esc(k?.description || 'Sem explicação curta pra esse termo.')}</div>
                <div class="gl-pop-actions">
                    ${askJudge ? `<button type="button" class="cs-gallery-btn" id="gl-ask">Perguntar ao juiz</button>` : ''}
                    <button type="button" class="cs-gallery-btn" id="gl-close">Fechar</button>
                </div>
            </div>`;
        document.body.appendChild(pop);
        const close = () => pop.remove();
        pop.addEventListener('click', (ev) => { if (ev.target === pop)
            close(); });
        pop.querySelector('#gl-close')?.addEventListener('click', close);
        pop.querySelector('#gl-ask')?.addEventListener('click', () => { close(); askJudge?.(`como funciona ${k?.reminder || term}?`); });
    }, true);
}
//# sourceMappingURL=glossary.js.map