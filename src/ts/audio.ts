// ===== Audio Management =====

import { gameState } from './state.js';

class AudioManager {
    private sounds: Map<string, HTMLAudioElement>;
    private customSounds: Map<string, string>; // Base64 encoded audio
    private audioContext: AudioContext | null = null;
    private lastPlayTime: Map<string, number> = new Map();
    private readonly MIN_PLAY_INTERVAL = 50; // Minimum ms between same sound

    constructor() {
        this.sounds = new Map();
        this.customSounds = new Map();
        this.loadCustomSounds();
    }

    // Get or create audio context (reuse single instance)
    private getAudioContext(): AudioContext | null {
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            } catch (e) {
                console.warn('Failed to create AudioContext:', e);
                return null;
            }
        }
        // Resume if suspended (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        return this.audioContext;
    }

    // Check if sound can play (throttle rapid plays)
    private canPlaySound(soundName: string): boolean {
        const now = Date.now();
        const lastPlay = this.lastPlayTime.get(soundName) || 0;
        if (now - lastPlay < this.MIN_PLAY_INTERVAL) {
            return false;
        }
        this.lastPlayTime.set(soundName, now);
        return true;
    }

    // Load custom sounds from localStorage
    private loadCustomSounds(): void {
        try {
            const saved = localStorage.getItem('mtg-life-counter-sounds');
            if (saved) {
                const parsed = JSON.parse(saved);
                Object.entries(parsed).forEach(([key, value]) => {
                    this.customSounds.set(key, value as string);
                });
            }
        } catch (e) {
            console.warn('Failed to load custom sounds:', e);
        }
    }

    // Save custom sounds to localStorage
    private saveCustomSounds(): void {
        try {
            const obj: Record<string, string> = {};
            this.customSounds.forEach((value, key) => {
                obj[key] = value;
            });
            localStorage.setItem('mtg-life-counter-sounds', JSON.stringify(obj));
        } catch (e) {
            console.warn('Failed to save custom sounds:', e);
        }
    }

    // Play a sound effect
    play(soundName: string, playerId?: string): void {
        const state = gameState.getState();
        if (!state.settings.soundEnabled) return;

        // Throttle rapid plays of the same sound
        if (!this.canPlaySound(soundName)) return;

        const volume = state.settings.volume / 100;

        // Try custom sound first
        const customKey = playerId ? `${playerId}-${soundName}` : soundName;
        const customSound = this.customSounds.get(customKey);

        if (customSound) {
            this.playBase64Audio(customSound, volume);
            return;
        }

        // Play default sound
        this.playDefaultSound(soundName, volume);
    }

    // Play base64 encoded audio
    private playBase64Audio(base64: string, volume: number): void {
        try {
            const audio = new Audio(base64);
            audio.volume = volume;
            audio.play().catch(e => console.warn('Audio play failed:', e));
        } catch (e) {
            console.warn('Failed to play custom audio:', e);
        }
    }

    // Play default built-in sound
    private playDefaultSound(soundName: string, volume: number): void {
        // Get shared audio context
        const audioContext = this.getAudioContext();
        if (!audioContext) return;

        try {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            gainNode.gain.value = volume * 0.3;

            switch (soundName) {
                case 'damage':
                    oscillator.frequency.value = 200;
                    oscillator.type = 'sawtooth';
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.1);
                    break;

                case 'heal':
                    oscillator.frequency.value = 440;
                    oscillator.type = 'sine';
                    oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.15);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.2);
                    break;

                case 'death':
                    oscillator.frequency.value = 300;
                    oscillator.type = 'square';
                    oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.5);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.5);
                    break;

                case 'win':
                    // Play a simple victory fanfare
                    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
                    notes.forEach((freq, i) => {
                        const osc = audioContext.createOscillator();
                        const gain = audioContext.createGain();
                        osc.connect(gain);
                        gain.connect(audioContext.destination);
                        osc.frequency.value = freq;
                        osc.type = 'sine';
                        gain.gain.value = volume * 0.2;
                        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3 + i * 0.15);
                        osc.start(audioContext.currentTime + i * 0.15);
                        osc.stop(audioContext.currentTime + 0.3 + i * 0.15);
                    });
                    return;

                case 'click':
                    oscillator.frequency.value = 1000;
                    oscillator.type = 'sine';
                    gainNode.gain.value = volume * 0.1;
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.05);
                    break;

                case 'turn':
                    oscillator.frequency.value = 600;
                    oscillator.type = 'sine';
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.15);
                    break;

                case 'timer_warning':
                    oscillator.frequency.value = 800;
                    oscillator.type = 'square';
                    gainNode.gain.value = volume * 0.15;
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.1);
                    break;

                default:
                    oscillator.frequency.value = 440;
                    oscillator.type = 'sine';
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.1);
            }
        } catch (e) {
            console.warn('Failed to create audio:', e);
        }
    }

    // Upload custom sound from file
    async uploadSound(playerId: string, soundType: string, file: File): Promise<void> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const key = `${playerId}-${soundType}`;
                this.customSounds.set(key, reader.result as string);
                this.saveCustomSounds();
                resolve();
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    // Remove custom sound
    removeSound(playerId: string, soundType: string): void {
        const key = `${playerId}-${soundType}`;
        this.customSounds.delete(key);
        this.saveCustomSounds();
    }

    // Check if custom sound exists
    hasCustomSound(playerId: string, soundType: string): boolean {
        return this.customSounds.has(`${playerId}-${soundType}`);
    }
}

// Export singleton instance
export const audioManager = new AudioManager();
