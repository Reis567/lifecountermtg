// ===== Audio Management =====
import { gameState } from './state.js';
class AudioManager {
    constructor() {
        this.sounds = new Map();
        this.customSounds = new Map();
        this.loadCustomSounds();
    }
    // Load custom sounds from localStorage
    loadCustomSounds() {
        try {
            const saved = localStorage.getItem('mtg-life-counter-sounds');
            if (saved) {
                const parsed = JSON.parse(saved);
                Object.entries(parsed).forEach(([key, value]) => {
                    this.customSounds.set(key, value);
                });
            }
        }
        catch (e) {
            console.warn('Failed to load custom sounds:', e);
        }
    }
    // Save custom sounds to localStorage
    saveCustomSounds() {
        try {
            const obj = {};
            this.customSounds.forEach((value, key) => {
                obj[key] = value;
            });
            localStorage.setItem('mtg-life-counter-sounds', JSON.stringify(obj));
        }
        catch (e) {
            console.warn('Failed to save custom sounds:', e);
        }
    }
    // Play a sound effect
    play(soundName, playerId) {
        const state = gameState.getState();
        if (!state.settings.soundEnabled)
            return;
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
    playBase64Audio(base64, volume) {
        try {
            const audio = new Audio(base64);
            audio.volume = volume;
            audio.play().catch(e => console.warn('Audio play failed:', e));
        }
        catch (e) {
            console.warn('Failed to play custom audio:', e);
        }
    }
    // Play default built-in sound
    playDefaultSound(soundName, volume) {
        // Create simple oscillator-based sounds
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
        }
        catch (e) {
            console.warn('Failed to create audio:', e);
        }
    }
    // Upload custom sound from file
    async uploadSound(playerId, soundType, file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const key = `${playerId}-${soundType}`;
                this.customSounds.set(key, reader.result);
                this.saveCustomSounds();
                resolve();
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }
    // Remove custom sound
    removeSound(playerId, soundType) {
        const key = `${playerId}-${soundType}`;
        this.customSounds.delete(key);
        this.saveCustomSounds();
    }
    // Check if custom sound exists
    hasCustomSound(playerId, soundType) {
        return this.customSounds.has(`${playerId}-${soundType}`);
    }
}
// Export singleton instance
export const audioManager = new AudioManager();
//# sourceMappingURL=audio.js.map