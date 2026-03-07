// ===== Audio Management =====
import { gameState } from './state.js';
class AudioManager {
    constructor() {
        this.audioContext = null;
        this.lastPlayTime = new Map();
        this.MIN_PLAY_INTERVAL = 50; // Minimum ms between same sound
        this.soundPack = 'default';
        // Sound files mapping (sound name -> file path)
        this.soundFiles = {
            damage: 'dano.mp3',
            viado: 'viado.mp3', // "eu não nasci gay a culpa é do meu pai"
            fluminense: 'fluminense.mp3', // Hino do Fluminense (easter egg)
            monark: 'monark.mp3', // Monark "acorda cara" (easter egg)
        };
        this.sounds = new Map();
        this.customSounds = new Map();
        this.loadCustomSounds();
        this.preloadSoundFiles();
    }
    // Preload sound files for better performance
    preloadSoundFiles() {
        for (const [name, path] of Object.entries(this.soundFiles)) {
            const audio = new Audio(path);
            audio.preload = 'auto';
            this.sounds.set(name, audio);
        }
    }
    setSoundPack(pack) {
        this.soundPack = pack;
    }
    // Get or create audio context (reuse single instance)
    getAudioContext() {
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            catch (e) {
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
    canPlaySound(soundName) {
        const now = Date.now();
        const lastPlay = this.lastPlayTime.get(soundName) || 0;
        if (now - lastPlay < this.MIN_PLAY_INTERVAL) {
            return false;
        }
        this.lastPlayTime.set(soundName, now);
        return true;
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
    // Check if name matches José/Zé variants
    isJoseVariant(name) {
        const nameLower = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const joseVariants = ['jose', 'ze', 'zezinwhisky', 'zezinho', 'zezin', 'zeca', 'josue', 'joseph', 'zeze', 'djze'];
        return joseVariants.some(variant => nameLower.includes(variant));
    }
    // Play a sound effect
    play(soundName, playerId, winnerName) {
        const state = gameState.getState();
        if (!state.settings.soundEnabled)
            return;
        // Throttle rapid plays of the same sound
        if (!this.canPlaySound(soundName))
            return;
        const volume = state.settings.volume / 100;
        // Special handling for viado sound
        if (soundName === 'viado' && state.settings.easterEggsEnabled) {
            // If winner name is José/Zé variant, 100% Fluminense
            if (winnerName && this.isJoseVariant(winnerName)) {
                if (this.playSoundFile('fluminense', volume)) {
                    console.log('🎵 EASTER EGG: Hino do Fluminense! (José detected)');
                    return;
                }
            }
            else {
                // 50/50 chance: Fluminense or normal viado sound
                if (Math.random() < 0.5) {
                    if (this.playSoundFile('fluminense', volume)) {
                        console.log('🎵 EASTER EGG: Hino do Fluminense!');
                        return;
                    }
                }
            }
        }
        // Special handling for monarch sound - 50% chance of Monark "acorda cara"
        if (soundName === 'monarch' && state.settings.easterEggsEnabled) {
            if (Math.random() < 0.5) {
                // Play Monark "acorda cara" instead!
                if (this.playSoundFile('monark', volume)) {
                    console.log('🎵 EASTER EGG: Monark - Acorda cara!');
                    return;
                }
            }
        }
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
    // Get sound parameters based on pack
    getSoundConfig(soundName) {
        const packConfigs = {
            default: {
                damage: { freq: 200, type: 'sawtooth', duration: 0.1 },
                heal: { freq: 440, type: 'sine', duration: 0.2, freqEnd: 880 },
                click: { freq: 1000, type: 'sine', duration: 0.05 },
            },
            medieval: {
                damage: { freq: 150, type: 'square', duration: 0.15 },
                heal: { freq: 330, type: 'triangle', duration: 0.25, freqEnd: 660 },
                click: { freq: 800, type: 'triangle', duration: 0.08 },
            },
            scifi: {
                damage: { freq: 100, type: 'sawtooth', duration: 0.15, freqEnd: 400 },
                heal: { freq: 600, type: 'sine', duration: 0.2, freqEnd: 1200 },
                click: { freq: 2000, type: 'square', duration: 0.03 },
            },
            horror: {
                damage: { freq: 80, type: 'sawtooth', duration: 0.2 },
                heal: { freq: 200, type: 'triangle', duration: 0.3, freqEnd: 400 },
                click: { freq: 300, type: 'square', duration: 0.1 },
            },
            arcade: {
                damage: { freq: 300, type: 'square', duration: 0.08 },
                heal: { freq: 523, type: 'square', duration: 0.15, freqEnd: 784 },
                click: { freq: 1500, type: 'square', duration: 0.02 },
            },
        };
        return packConfigs[this.soundPack]?.[soundName] || packConfigs.default[soundName] || { freq: 440, type: 'sine', duration: 0.1 };
    }
    // Play a sound file
    playSoundFile(soundName, volume) {
        const audio = this.sounds.get(soundName);
        if (!audio)
            return false;
        try {
            // Clone the audio to allow overlapping plays
            const audioClone = audio.cloneNode();
            audioClone.volume = volume;
            audioClone.play().catch(e => console.warn('Audio play failed:', e));
            return true;
        }
        catch (e) {
            console.warn('Failed to play sound file:', e);
            return false;
        }
    }
    // Play default built-in sound
    playDefaultSound(soundName, volume) {
        // Try to play sound file first
        if (this.playSoundFile(soundName, volume)) {
            return;
        }
        // Fall back to synthesized sound
        const audioContext = this.getAudioContext();
        if (!audioContext)
            return;
        try {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            gainNode.gain.value = volume * 0.3;
            // Use pack-specific config for basic sounds
            const config = this.getSoundConfig(soundName);
            switch (soundName) {
                case 'damage':
                    oscillator.frequency.value = config.freq;
                    oscillator.type = config.type;
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + config.duration);
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + config.duration);
                    break;
                case 'heal':
                    oscillator.frequency.value = config.freq;
                    oscillator.type = config.type;
                    if (config.freqEnd) {
                        oscillator.frequency.exponentialRampToValueAtTime(config.freqEnd, audioContext.currentTime + config.duration * 0.75);
                    }
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + config.duration);
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + config.duration);
                    break;
                case 'death':
                    // "Fon fon fon fooooom" - funny fail/sad trombone sound
                    const deathNotes = [
                        { freq: 392, duration: 0.15 }, // G4 - fon
                        { freq: 349.23, duration: 0.15 }, // F4 - fon
                        { freq: 329.63, duration: 0.15 }, // E4 - fon
                        { freq: 155.56, duration: 0.6 }, // Eb3 - fooooom (low and long)
                    ];
                    let deathTime = audioContext.currentTime;
                    deathNotes.forEach((note, i) => {
                        const osc = audioContext.createOscillator();
                        const gain = audioContext.createGain();
                        osc.connect(gain);
                        gain.connect(audioContext.destination);
                        osc.type = 'square';
                        osc.frequency.value = note.freq;
                        gain.gain.value = volume * 0.25;
                        // Add vibrato to the last note
                        if (i === 3) {
                            const vibrato = audioContext.createOscillator();
                            const vibratoGain = audioContext.createGain();
                            vibrato.frequency.value = 5;
                            vibratoGain.gain.value = 8;
                            vibrato.connect(vibratoGain);
                            vibratoGain.connect(osc.frequency);
                            vibrato.start(deathTime);
                            vibrato.stop(deathTime + note.duration);
                        }
                        gain.gain.exponentialRampToValueAtTime(0.01, deathTime + note.duration);
                        osc.start(deathTime);
                        osc.stop(deathTime + note.duration);
                        deathTime += note.duration;
                    });
                    return;
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
                case 'commander_damage':
                    // Demonic sound - deep growl with dissonance
                    const demonFreqs = [65, 68, 73]; // Low dissonant chord
                    demonFreqs.forEach((freq, i) => {
                        const demonOsc = audioContext.createOscillator();
                        const demonGain = audioContext.createGain();
                        demonOsc.connect(demonGain);
                        demonGain.connect(audioContext.destination);
                        demonOsc.type = 'sawtooth';
                        demonOsc.frequency.value = freq;
                        demonGain.gain.value = volume * 0.2;
                        // Add growling LFO
                        const growl = audioContext.createOscillator();
                        const growlGain = audioContext.createGain();
                        growl.frequency.value = 8 + i * 2;
                        growlGain.gain.value = 15;
                        growl.connect(growlGain);
                        growlGain.connect(demonOsc.frequency);
                        growl.start();
                        growl.stop(audioContext.currentTime + 0.5);
                        demonGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                        demonOsc.start();
                        demonOsc.stop(audioContext.currentTime + 0.5);
                    });
                    // Add a deep impact
                    oscillator.frequency.value = 40;
                    oscillator.type = 'sine';
                    gainNode.gain.value = volume * 0.5;
                    oscillator.frequency.exponentialRampToValueAtTime(25, audioContext.currentTime + 0.4);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.4);
                    break;
                case 'revive':
                    // Angelic choir - ethereal ascending sound
                    const angelNotes = [
                        { freq: 523.25, delay: 0 }, // C5
                        { freq: 659.25, delay: 0.05 }, // E5
                        { freq: 783.99, delay: 0.1 }, // G5
                        { freq: 1046.5, delay: 0.15 }, // C6
                    ];
                    angelNotes.forEach(note => {
                        const angelOsc = audioContext.createOscillator();
                        const angelGain = audioContext.createGain();
                        angelOsc.connect(angelGain);
                        angelGain.connect(audioContext.destination);
                        angelOsc.type = 'sine';
                        angelOsc.frequency.value = note.freq;
                        // Soft attack, longer release
                        angelGain.gain.setValueAtTime(0, audioContext.currentTime + note.delay);
                        angelGain.gain.linearRampToValueAtTime(volume * 0.2, audioContext.currentTime + note.delay + 0.1);
                        angelGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + note.delay + 0.8);
                        // Add shimmer with slight detune
                        const shimmer = audioContext.createOscillator();
                        const shimmerGain = audioContext.createGain();
                        shimmer.type = 'sine';
                        shimmer.frequency.value = note.freq * 1.005; // Slight detune for chorus
                        shimmerGain.gain.setValueAtTime(0, audioContext.currentTime + note.delay);
                        shimmerGain.gain.linearRampToValueAtTime(volume * 0.15, audioContext.currentTime + note.delay + 0.1);
                        shimmerGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + note.delay + 0.8);
                        shimmer.connect(shimmerGain);
                        shimmerGain.connect(audioContext.destination);
                        angelOsc.start(audioContext.currentTime + note.delay);
                        angelOsc.stop(audioContext.currentTime + note.delay + 0.8);
                        shimmer.start(audioContext.currentTime + note.delay);
                        shimmer.stop(audioContext.currentTime + note.delay + 0.8);
                    });
                    return;
                case 'poison':
                    // Sinister bubbling sound
                    oscillator.frequency.value = 300;
                    oscillator.type = 'triangle';
                    gainNode.gain.value = volume * 0.25;
                    // Create wobble effect
                    const lfo = audioContext.createOscillator();
                    const lfoGain = audioContext.createGain();
                    lfo.frequency.value = 15;
                    lfoGain.gain.value = 50;
                    lfo.connect(lfoGain);
                    lfoGain.connect(oscillator.frequency);
                    lfo.start();
                    lfo.stop(audioContext.currentTime + 0.3);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.3);
                    break;
                case 'energy':
                    // Electric zap sound
                    oscillator.frequency.value = 880;
                    oscillator.type = 'square';
                    gainNode.gain.value = volume * 0.2;
                    oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.1);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.15);
                    break;
                case 'experience':
                    // Magical chime - ascending
                    oscillator.frequency.value = 660;
                    oscillator.type = 'sine';
                    gainNode.gain.value = volume * 0.25;
                    oscillator.frequency.exponentialRampToValueAtTime(990, audioContext.currentTime + 0.2);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.25);
                    break;
                case 'monarch':
                    // Royal trumpet fanfare - "God Save the King" style
                    const royalNotes = [
                        { freq: 392, duration: 0.15 }, // G4
                        { freq: 392, duration: 0.15 }, // G4
                        { freq: 440, duration: 0.15 }, // A4
                        { freq: 392, duration: 0.2 }, // G4
                        { freq: 493.88, duration: 0.2 }, // B4
                        { freq: 523.25, duration: 0.4 }, // C5 (hold)
                    ];
                    let royalTime = audioContext.currentTime;
                    royalNotes.forEach((note) => {
                        // Main trumpet
                        const trumpet = audioContext.createOscillator();
                        const trumpetGain = audioContext.createGain();
                        trumpet.connect(trumpetGain);
                        trumpetGain.connect(audioContext.destination);
                        trumpet.type = 'sawtooth';
                        trumpet.frequency.value = note.freq;
                        trumpetGain.gain.value = volume * 0.15;
                        trumpetGain.gain.exponentialRampToValueAtTime(0.01, royalTime + note.duration);
                        trumpet.start(royalTime);
                        trumpet.stop(royalTime + note.duration);
                        // Harmony (fifth above)
                        const harmony = audioContext.createOscillator();
                        const harmonyGain = audioContext.createGain();
                        harmony.connect(harmonyGain);
                        harmonyGain.connect(audioContext.destination);
                        harmony.type = 'sawtooth';
                        harmony.frequency.value = note.freq * 1.5; // Perfect fifth
                        harmonyGain.gain.value = volume * 0.08;
                        harmonyGain.gain.exponentialRampToValueAtTime(0.01, royalTime + note.duration);
                        harmony.start(royalTime);
                        harmony.stop(royalTime + note.duration);
                        royalTime += note.duration;
                    });
                    return;
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
class AmbientMusicManager {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.oscillators = [];
        this.gains = [];
        this.isPlaying = false;
        this.currentTrack = 'none';
        this.volume = 0.3;
    }
    getAudioContext() {
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            catch (e) {
                console.warn('Failed to create AudioContext for ambient music:', e);
                return null;
            }
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        return this.audioContext;
    }
    setVolume(volume) {
        this.volume = volume / 100;
        if (this.masterGain) {
            this.masterGain.gain.value = this.volume * 0.15; // Keep ambient quiet
        }
    }
    setTrack(track) {
        if (track === this.currentTrack)
            return;
        this.stop();
        this.currentTrack = track;
        if (track !== 'none' && this.isPlaying) {
            this.play();
        }
    }
    play() {
        if (this.currentTrack === 'none')
            return;
        this.isPlaying = true;
        const ctx = this.getAudioContext();
        if (!ctx)
            return;
        this.stop(); // Clean up any existing
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = this.volume * 0.15;
        this.masterGain.connect(ctx.destination);
        switch (this.currentTrack) {
            case 'epic':
                this.playEpicTrack(ctx);
                break;
            case 'dark':
                this.playDarkTrack(ctx);
                break;
            case 'nature':
                this.playNatureTrack(ctx);
                break;
            case 'mystical':
                this.playMysticalTrack(ctx);
                break;
        }
    }
    playEpicTrack(ctx) {
        // Low drone with subtle rhythm
        const drone = ctx.createOscillator();
        const droneGain = ctx.createGain();
        drone.type = 'sawtooth';
        drone.frequency.value = 55; // A1
        droneGain.gain.value = 0.3;
        drone.connect(droneGain);
        droneGain.connect(this.masterGain);
        drone.start();
        this.oscillators.push(drone);
        this.gains.push(droneGain);
        // Fifth harmony
        const fifth = ctx.createOscillator();
        const fifthGain = ctx.createGain();
        fifth.type = 'sine';
        fifth.frequency.value = 82.4; // E2
        fifthGain.gain.value = 0.2;
        fifth.connect(fifthGain);
        fifthGain.connect(this.masterGain);
        fifth.start();
        this.oscillators.push(fifth);
        this.gains.push(fifthGain);
        // LFO for movement
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.1;
        lfoGain.gain.value = 5;
        lfo.connect(lfoGain);
        lfoGain.connect(drone.frequency);
        lfo.start();
        this.oscillators.push(lfo);
    }
    playDarkTrack(ctx) {
        // Deep bass drone
        const bass = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bass.type = 'sine';
        bass.frequency.value = 36.7; // D1
        bassGain.gain.value = 0.4;
        bass.connect(bassGain);
        bassGain.connect(this.masterGain);
        bass.start();
        this.oscillators.push(bass);
        this.gains.push(bassGain);
        // Dissonant overtone
        const dissonant = ctx.createOscillator();
        const disGain = ctx.createGain();
        dissonant.type = 'triangle';
        dissonant.frequency.value = 38.9; // Slightly detuned
        disGain.gain.value = 0.15;
        dissonant.connect(disGain);
        disGain.connect(this.masterGain);
        dissonant.start();
        this.oscillators.push(dissonant);
        this.gains.push(disGain);
        // Slow LFO for unsettling effect
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.05;
        lfoGain.gain.value = 3;
        lfo.connect(lfoGain);
        lfoGain.connect(bass.frequency);
        lfo.start();
        this.oscillators.push(lfo);
    }
    playNatureTrack(ctx) {
        // White noise for wind/water
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = 400;
        const noiseGain = ctx.createGain();
        noiseGain.gain.value = 0.2;
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start();
        // Gentle pad
        const pad = ctx.createOscillator();
        const padGain = ctx.createGain();
        pad.type = 'sine';
        pad.frequency.value = 220; // A3
        padGain.gain.value = 0.1;
        pad.connect(padGain);
        padGain.connect(this.masterGain);
        pad.start();
        this.oscillators.push(pad);
        this.gains.push(padGain);
    }
    playMysticalTrack(ctx) {
        // Ethereal pads
        const notes = [261.6, 329.6, 392]; // C4, E4, G4
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.value = 0.15;
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            this.oscillators.push(osc);
            this.gains.push(gain);
            // Slow detune for shimmer
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            lfo.frequency.value = 0.2 + i * 0.1;
            lfoGain.gain.value = 2;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            lfo.start();
            this.oscillators.push(lfo);
        });
    }
    stop() {
        this.oscillators.forEach(osc => {
            try {
                osc.stop();
            }
            catch (e) { }
        });
        this.oscillators = [];
        this.gains = [];
        if (this.masterGain) {
            this.masterGain.disconnect();
            this.masterGain = null;
        }
    }
    toggle(enabled) {
        this.isPlaying = enabled;
        if (enabled && this.currentTrack !== 'none') {
            this.play();
        }
        else {
            this.stop();
        }
    }
}
export const ambientMusic = new AmbientMusicManager();
// ===== Event Narrator =====
class EventNarrator {
    constructor() {
        this.enabled = false;
        this.speed = 1;
        this.synthesis = null;
        this.voice = null;
        if ('speechSynthesis' in window) {
            this.synthesis = window.speechSynthesis;
            // Load voices when ready
            if (this.synthesis.onvoiceschanged !== undefined) {
                this.synthesis.onvoiceschanged = () => this.loadVoice();
            }
            setTimeout(() => this.loadVoice(), 100);
        }
    }
    loadVoice() {
        if (!this.synthesis)
            return;
        const voices = this.synthesis.getVoices();
        // Try to find a Portuguese voice
        this.voice = voices.find(v => v.lang.startsWith('pt')) ||
            voices.find(v => v.lang.startsWith('en')) ||
            voices[0] || null;
    }
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    setSpeed(speed) {
        this.speed = speed;
    }
    speak(text) {
        if (!this.enabled || !this.synthesis)
            return;
        // Cancel any ongoing speech
        this.synthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        if (this.voice) {
            utterance.voice = this.voice;
        }
        utterance.rate = this.speed;
        utterance.pitch = 1;
        utterance.volume = 0.8;
        this.synthesis.speak(utterance);
    }
    // Announce game events
    announceLifeChange(playerName, amount, newLife) {
        if (amount > 0) {
            this.speak(`${playerName} ganha ${amount} de vida. Agora tem ${newLife}.`);
        }
        else {
            this.speak(`${playerName} perde ${Math.abs(amount)} de vida. Agora tem ${newLife}.`);
        }
    }
    announceElimination(playerName) {
        this.speak(`${playerName} foi eliminado!`);
    }
    announceWinner(playerName) {
        this.speak(`${playerName} venceu a partida! Parabéns!`);
    }
    announceTurnChange(playerName, turnNumber) {
        this.speak(`Turno ${turnNumber}. Vez de ${playerName}.`);
    }
    announceMonarch(playerName) {
        this.speak(`${playerName} é agora o Monarca!`);
    }
    announceRandomStarter(playerName) {
        this.speak(`${playerName} começa a partida!`);
    }
    announceCommanderDamage(targetName, sourceName, damage) {
        this.speak(`${targetName} recebe ${damage} de dano de comandante de ${sourceName}.`);
    }
    announcePoisonDanger(playerName, counters) {
        if (counters >= 10) {
            this.speak(`${playerName} foi envenenado até a morte!`);
        }
        else if (counters >= 7) {
            this.speak(`${playerName} está com ${counters} marcadores de veneno. Cuidado!`);
        }
    }
}
export const narrator = new EventNarrator();
//# sourceMappingURL=audio.js.map