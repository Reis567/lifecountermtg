// ===== Perfis da mesa =====
// Lista de jogadores (nome + foto) vinda do servidor, com cache em localStorage
// pra abrir o app sem rede. Os pré-setados (Zé, Reis, Laura, Mendas, Maria,
// Cabral, System) são criados pelo seed do backend; novos perfis são criados
// aqui mesmo (nome + foto da câmera/galeria).

import { apiCreateProfile, apiListProfiles, apiUpdateProfile, apiDeleteProfile, ProfileDTO } from './api.js';

const PROFILES_CACHE_KEY = 'lc_profiles_cache_v1';
const PROFILE_PHOTO_MAX_SIDE = 640;

let profilesMem: ProfileDTO[] | null = null;
let profilesLoadedFromServer = false;
const profileListeners = new Set<(list: ProfileDTO[]) => void>();

function readProfilesCache(): ProfileDTO[] {
    try {
        const raw = localStorage.getItem(PROFILES_CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeProfilesCache(list: ProfileDTO[]): void {
    try { localStorage.setItem(PROFILES_CACHE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

function setProfiles(list: ProfileDTO[]): void {
    profilesMem = list;
    writeProfilesCache(list);
    profileListeners.forEach((fn) => { try { fn(list); } catch (e) { console.warn(e); } });
}

export function onProfilesChange(fn: (list: ProfileDTO[]) => void): () => void {
    profileListeners.add(fn);
    return () => profileListeners.delete(fn);
}

// Lista atual (cache ou memória). Nunca bloqueia.
export function getProfiles(): ProfileDTO[] {
    if (!profilesMem) profilesMem = readProfilesCache();
    return profilesMem;
}

export function getProfileById(id: number | null | undefined): ProfileDTO | null {
    if (id === null || id === undefined) return null;
    return getProfiles().find((p) => p.id === id) || null;
}

export function profilesLoaded(): boolean {
    return profilesLoadedFromServer;
}

// Busca no servidor e atualiza o cache. Resolve com a lista (do servidor ou do cache em caso de erro).
export async function refreshProfiles(): Promise<ProfileDTO[]> {
    try {
        const list = await apiListProfiles();
        profilesLoadedFromServer = true;
        setProfiles(list);
        return list;
    } catch (e) {
        console.warn('perfis: usando cache (sem servidor)', e);
        return getProfiles();
    }
}

// Redimensiona uma imagem (File/Blob) pra JPEG de no máximo 640px antes de
// subir — fotos de celular vêm com 3-5 MB e não precisamos disso.
export function shrinkImage(file: Blob, maxSide = PROFILE_PHOTO_MAX_SIDE): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(file); return; }
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.86);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')); };
        img.src = url;
    });
}

export async function createProfile(name: string, photo: Blob | null, color?: string): Promise<ProfileDTO> {
    const small = photo ? await shrinkImage(photo) : null;
    const created = await apiCreateProfile(name.trim(), small, color);
    setProfiles([...getProfiles().filter((p) => p.id !== created.id), created]);
    return created;
}

export async function updateProfile(id: number, data: { name?: string; color?: string; photo?: Blob | null; aliases?: string[] }): Promise<ProfileDTO> {
    const small = data.photo ? await shrinkImage(data.photo) : null;
    const updated = await apiUpdateProfile(id, { ...data, photo: small });
    setProfiles(getProfiles().map((p) => (p.id === id ? updated : p)));
    return updated;
}

export async function deleteProfile(id: number): Promise<void> {
    await apiDeleteProfile(id);
    setProfiles(getProfiles().filter((p) => p.id !== id));
}

// Iniciais pra avatar sem foto ("Zé" -> "Z", "Maria Clara" -> "MC").
export function profileInitials(name: string): string {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function escapeHtml(s: string): string {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// HTML de um avatar redondo (foto ou iniciais coloridas).
export function avatarHtml(p: { name: string; photo_url?: string | null; color?: string | null }, cls = 'lc-avatar'): string {
    if (p.photo_url) {
        return `<img class="${cls}" src="${escapeHtml(p.photo_url)}" alt="${escapeHtml(p.name)}" loading="lazy">`;
    }
    const bg = p.color || '#6366f1';
    return `<span class="${cls} lc-avatar-initials" style="background:${escapeHtml(bg)}">${escapeHtml(profileInitials(p.name))}</span>`;
}
