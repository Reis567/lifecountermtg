// ===== Partida salva no servidor (retomar em outro aparelho) =====
// Enquanto a partida está em andamento, cada mudança (com debounce) manda o
// estado inteiro pro servidor. Na home, se existe uma partida salva que este
// aparelho não tem, aparece o cartão "Retomar". Se outro aparelho retomou a
// MESMA partida e seguiu jogando, o servidor responde 409 e a gente pergunta
// o que fazer (trazer a versão de lá ou continuar aqui, por cima).

import { gameState } from './state.js';
import { apiGetCurrentGame, apiPutCurrentGame, apiDeleteCurrentGame, deviceId, ApiError, type CurrentGameDTO } from './api.js';
import { confirmDialogFull } from './dialogs.js';

const CS_DEBOUNCE_MS = 1500;
let csRev = 0;
let csTimer: number | null = null;
let csPaused = false; // depois de um conflito até o usuário decidir
let csWasActive = false;
let csAsking = false;
let csOnNotice: ((msg: string, kind: 'success' | 'warning' | 'danger') => void) | null = null;

export function setupCloudSave(notice?: (msg: string, kind: 'success' | 'warning' | 'danger') => void): void {
    csOnNotice = notice || null;
    gameState.subscribe(onState);
    // Ao sair/trocar de aba, tenta mandar o que estiver pendente.
    document.addEventListener('visibilitychange', () => { if (document.hidden) void pushNow(); });
    window.addEventListener('pagehide', () => { void pushNow(); });
    onState(gameState.getState());
}

function snapshot(): unknown {
    const s = gameState.getState();
    // Sem a pilha de undo (snapshots inteiros, pesado e só faz sentido local).
    return { ...s, undoStack: [] };
}

function onState(s: { gameStarted: boolean; matchClosed: boolean }): void {
    const active = s.gameStarted && !s.matchClosed;
    if (!active) {
        if (csWasActive) {
            // Partida acabou ou voltou pro setup neste aparelho: limpa no servidor.
            csWasActive = false;
            if (!csPaused) apiDeleteCurrentGame().catch(() => { /* offline */ });
            csRev = 0;
            csPaused = false;
        }
        return;
    }
    csWasActive = true;
    if (csPaused) return;
    if (csTimer !== null) clearTimeout(csTimer);
    csTimer = window.setTimeout(() => { csTimer = null; void pushNow(); }, CS_DEBOUNCE_MS);
}

async function pushNow(force = false): Promise<void> {
    const s = gameState.getState();
    if (!s.gameStarted || s.matchClosed || (csPaused && !force)) return;
    if (csTimer !== null) { clearTimeout(csTimer); csTimer = null; }
    const myId = String(s.gameStartTime || '');
    try {
        const r = await apiPutCurrentGame({ state: snapshot(), rev: csRev, client_match_id: myId, force });
        csRev = r.rev;
        csPaused = false;
    } catch (e: any) {
        if (e instanceof ApiError && e.status === 409) {
            const remote = (e.body || {}) as CurrentGameDTO;
            // Outra PARTIDA (não a mesma retomada): a daqui assume a vaga sem perguntar.
            // Só existe uma vaga de "partida em andamento" por mesa; a mais recente vence.
            if (myId && remote.client_match_id && remote.client_match_id !== myId) {
                csRev = remote.rev || 0;
                try {
                    const r = await apiPutCurrentGame({ state: snapshot(), rev: csRev, client_match_id: myId, force: true });
                    csRev = r.rev;
                } catch { /* tenta na próxima mudança */ }
                return;
            }
            csPaused = true;
            void handleConflict(remote);
        }
        // offline/erro: tenta na próxima mudança
    }
}

async function handleConflict(remote: CurrentGameDTO): Promise<void> {
    if (csAsking) return;
    csAsking = true;
    try {
        const when = remote.saved_at ? new Date(remote.saved_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
        const st: any = remote.state || {};
        const res = await confirmDialogFull(
            `Esta partida continuou em OUTRO aparelho (salva às ${when}, turno ${st.currentTurn ?? '?'}). Quer trazer a versão de lá pra cá? Se cancelar, a versão deste aparelho passa por cima.`,
            { title: 'Partida em dois aparelhos', okText: 'Trazer de lá', cancelText: 'Continuar aqui' } as any,
        );
        if (res.ok && remote.state) {
            gameState.replaceState(remote.state);
            csRev = remote.rev || 0;
            csPaused = false;
            csOnNotice?.('Partida atualizada com a versão do outro aparelho.', 'success');
        } else {
            csRev = remote.rev || 0;
            csPaused = false;
            await pushNow(true);
            csOnNotice?.('Este aparelho assumiu a partida.', 'warning');
        }
    } finally {
        csAsking = false;
    }
}

// Home: existe partida em andamento no servidor que este aparelho não está jogando?
export async function cloudCheckResume(): Promise<CurrentGameDTO | null> {
    const local = gameState.getState();
    if (local.gameStarted && !local.matchClosed) return null;
    try {
        const g = await apiGetCurrentGame();
        const st: any = g.state;
        if (!st || !st.gameStarted || st.matchClosed) return null;
        // Partida velha demais (mais de 12 h) não vale retomar.
        if (st.gameStartTime && Date.now() - st.gameStartTime > 12 * 60 * 60 * 1000) return null;
        return g;
    } catch {
        return null;
    }
}

export function cloudResume(g: CurrentGameDTO): void {
    gameState.replaceState(g.state);
    csRev = g.rev || 0;
    csPaused = false;
    csWasActive = true;
}

export async function cloudDiscard(): Promise<void> {
    try { await apiDeleteCurrentGame(); } catch { /* offline */ }
}

export function cloudIsMine(g: CurrentGameDTO): boolean {
    return !!g.device && g.device === deviceId();
}
