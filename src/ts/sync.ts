// ===== Fila de sincronização (offline-first) =====
// Toda partida encerrada vira um POST /api/matches/. Se não tiver rede (ou o
// servidor estiver fora), a partida fica numa fila no localStorage e é
// reenviada quando a conexão volta, quando o app abre e a cada 60 s.
// O backend é idempotente pelo client_id, então reenviar nunca duplica.

import { apiCreateMatch, MatchPayload, AchievementDTO } from './api.js';

// Conquistas novas vindas do servidor ao salvar uma partida (pra anunciar na mesa).
type AchievementListener = (list: Array<AchievementDTO & { profile_name?: string | null }>) => void;
let achievementListener: AchievementListener | null = null;
export function onNewAchievements(fn: AchievementListener): void {
    achievementListener = fn;
}

const SYNC_QUEUE_KEY = 'lc_sync_queue_v1';
const SYNC_RETRY_MS = 60000;

interface QueueItem {
    payload: MatchPayload;
    attempts: number;
    queuedAt: number;
    lastError?: string;
}

let syncRunning = false;
let syncTimer: number | null = null;
const syncListeners = new Set<(status: SyncStatus) => void>();

export interface SyncStatus {
    pending: number;
    syncing: boolean;
    lastError: string | null;
    lastSuccessAt: number | null;
}

let syncLastError: string | null = null;
let syncLastSuccessAt: number | null = null;

function readQueue(): QueueItem[] {
    try {
        const raw = localStorage.getItem(SYNC_QUEUE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeQueue(items: QueueItem[]): void {
    try { localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

export function getSyncStatus(): SyncStatus {
    return { pending: readQueue().length, syncing: syncRunning, lastError: syncLastError, lastSuccessAt: syncLastSuccessAt };
}

export function onSyncChange(fn: (s: SyncStatus) => void): () => void {
    syncListeners.add(fn);
    return () => syncListeners.delete(fn);
}

function emitSync(): void {
    const s = getSyncStatus();
    syncListeners.forEach((fn) => { try { fn(s); } catch (e) { console.warn(e); } });
}

// Enfileira e tenta mandar na hora. Resolve com true se foi pro servidor agora.
export async function enqueueMatch(payload: MatchPayload): Promise<boolean> {
    const q = readQueue();
    if (!q.some((i) => i.payload.client_id === payload.client_id)) {
        q.push({ payload, attempts: 0, queuedAt: Date.now() });
        writeQueue(q);
    }
    emitSync();
    const before = readQueue().length;
    await flushSyncQueue();
    return readQueue().length < before;
}

export async function flushSyncQueue(): Promise<void> {
    if (syncRunning) return;
    const q = readQueue();
    if (q.length === 0) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    syncRunning = true;
    emitSync();
    try {
        for (const item of q) {
            try {
                const created = await apiCreateMatch(item.payload);
                const rest = readQueue().filter((i) => i.payload.client_id !== item.payload.client_id);
                writeQueue(rest);
                syncLastError = null;
                syncLastSuccessAt = Date.now();
                const newAch = (created as any)?.new_achievements;
                if (Array.isArray(newAch) && newAch.length && achievementListener) {
                    try { achievementListener(newAch); } catch (e) { console.warn(e); }
                }
            } catch (e: any) {
                // 4xx = o servidor rejeitou de vez (payload inválido): descarta pra não travar a fila.
                const status = typeof e?.status === 'number' ? e.status : 0;
                if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
                    console.warn('sync: partida rejeitada pelo servidor, descartando', item.payload.client_id, e.message);
                    writeQueue(readQueue().filter((i) => i.payload.client_id !== item.payload.client_id));
                    syncLastError = `Partida rejeitada: ${e.message}`;
                    continue;
                }
                const cur = readQueue();
                const idx = cur.findIndex((i) => i.payload.client_id === item.payload.client_id);
                if (idx >= 0) {
                    cur[idx].attempts += 1;
                    cur[idx].lastError = String(e?.message || e);
                    writeQueue(cur);
                }
                syncLastError = String(e?.message || e);
                break; // sem rede: para aqui, tenta de novo depois
            }
        }
    } finally {
        syncRunning = false;
        emitSync();
    }
}

export function setupSync(): void {
    window.addEventListener('online', () => { void flushSyncQueue(); });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) void flushSyncQueue();
    });
    if (syncTimer === null) {
        syncTimer = window.setInterval(() => { void flushSyncQueue(); }, SYNC_RETRY_MS);
    }
    void flushSyncQueue();
}
