/**
 * Sound Effects Engine for Budget Bubby.
 * Provides resilient Web Audio synthesis for:
 * - Spend logging celebration ("cha-ching")
 * - Category budget nearing limit warning chime (80%)
 * - Category budget exceeded alert chime (100%+)
 * - Soft pop for routine taps (edit saved, triage, equip)
 * - Success chime for real milestones (stage up, inbox zero, couple day)
 *
 * Automatically unlocks AudioContext on first user interaction (touch, click, keydown)
 * to prevent autoplay restriction failures on iOS Safari & mobile browsers.
 */

let sharedAudioCtx: AudioContext | null = null;
let isAudioUnlocked = false;

function getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!sharedAudioCtx) {
        try {
            sharedAudioCtx = new AudioContextClass();
        } catch (err) {
            console.debug("Failed to initialize AudioContext:", err);
            return null;
        }
    }

    if (sharedAudioCtx.state === "suspended") {
        sharedAudioCtx.resume().catch(() => {});
    }

    return sharedAudioCtx;
}

// Global user gesture listener to unlock audio on first interaction
export function initAudioUnlock(): void {
    if (typeof window === "undefined" || isAudioUnlocked) return;

    const unlock = () => {
        const ctx = getAudioContext();
        if (ctx) {
            if (ctx.state === "suspended") {
                ctx.resume().catch(() => {});
            }
            isAudioUnlocked = true;
        }
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
        window.removeEventListener("touchstart", unlock);
    };

    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
}

// Auto-run unlock listener on module evaluation
if (typeof window !== "undefined") {
    initAudioUnlock();
}

/**
 * Check if sound effects are enabled in user notification preferences.
 */
export function isSoundEffectsEnabled(): boolean {
    if (typeof window === "undefined" || !window.localStorage) return true;
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("bb_notif_prefs_")) {
                const item = localStorage.getItem(key);
                if (item) {
                    const parsed = JSON.parse(item);
                    if (parsed && typeof parsed.sound_enabled === "boolean") {
                        return parsed.sound_enabled;
                    }
                }
            }
        }
    } catch {
        // fallback to enabled
    }
    return true;
}

/**
 * Play pleasant "cha-ching" celebratory cash chime.
 */
export function playChaChingSound(): void {
    if (!isSoundEffectsEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
        if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;

        // First bell chime (high E: ~1318.5 Hz sliding up to G6)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(1318.5, now);
        osc1.frequency.exponentialRampToValueAtTime(1567.98, now + 0.08);
        gain1.gain.setValueAtTime(0.2, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.35);

        // Second cash chime (higher C7: ~2093 Hz)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(2093.0, now + 0.09);
        gain2.gain.setValueAtTime(0.25, now + 0.09);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.09);
        osc2.stop(now + 0.55);
    } catch (err) {
        console.debug("Audio playback skipped:", err);
    }
}

/**
 * Play budget warning chime (gentle two-tone ascending alert for nearing 80% limit).
 */
export function playBudgetWarningSound(): void {
    if (!isSoundEffectsEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
        if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;

        // Tone 1: A4 (440 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(440, now);
        gain1.gain.setValueAtTime(0.15, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.2);

        // Tone 2: C#5 (554.37 Hz)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(554.37, now + 0.12);
        gain2.gain.setValueAtTime(0.18, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.4);
    } catch (err) {
        console.debug("Audio warning skipped:", err);
    }
}

/**
 * Play budget exceeded alert (distinct descending alert for >= 100% cap).
 */
export function playBudgetExceededSound(): void {
    if (!isSoundEffectsEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
        if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;

        // Tone 1: E5 (659.25 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "triangle";
        osc1.frequency.setValueAtTime(659.25, now);
        gain1.gain.setValueAtTime(0.2, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.22);

        // Tone 2: C5 (523.25 Hz)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(523.25, now + 0.16);
        gain2.gain.setValueAtTime(0.22, now + 0.16);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.16);
        osc2.stop(now + 0.45);
    } catch (err) {
        console.debug("Audio exceeded alert skipped:", err);
    }
}

/**
 * Play a tiny soft "pop" for routine feedback (~70ms sine blip, 880 to 660 Hz).
 */
export function playSoftPop(): void {
    if (!isSoundEffectsEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.07);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
    } catch (err) {
        console.debug("Soft pop skipped:", err);
    }
}

/**
 * Play the milestone success chime: a bright C6-E6-G6 arpeggio (~420ms).
 */
export function playSuccessSound(): void {
    if (!isSoundEffectsEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
        const now = ctx.currentTime;
        const notes = [1046.5, 1318.51, 1567.98];
        notes.forEach((freq, i) => {
            const start = now + i * 0.09;
            const end = start + (i === notes.length - 1 ? 0.24 : 0.16);
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = i === notes.length - 1 ? "triangle" : "sine";
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.setValueAtTime(0.16, start);
            gain.gain.exponentialRampToValueAtTime(0.001, end);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(end);
        });
    } catch (err) {
        console.debug("Success chime skipped:", err);
    }
}

/**
 * Play a crisp eggshell crack sound using short bandpass-filtered noise snaps
 * and a subtle hollow shell knock. Higher intensity adds extra crack snaps.
 */
export function playEggCrack(intensity: 1 | 2 | 3 = 1): void {
    if (!isSoundEffectsEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
        if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        const snapOffsets =
            intensity === 1
                ? [0]
                : intensity === 2
                  ? [0, 0.045]
                  : [0, 0.035, 0.075];

        snapOffsets.forEach((offset, idx) => {
            const start = now + offset;
            const dur = 0.035;
            const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * dur));
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                // Sharp front-loaded decay for a dry shell snap
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2.2);
            }

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = "bandpass";
            filter.frequency.setValueAtTime(2600 + idx * 550, start);
            filter.Q.setValueAtTime(1.8, start);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.32 + intensity * 0.06, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            noise.start(start);
            noise.stop(start + dur);
        });

        // Subtle hollow shell "tok"
        const tok = ctx.createOscillator();
        const tokGain = ctx.createGain();
        tok.type = "triangle";
        tok.frequency.setValueAtTime(520 + intensity * 70, now);
        tok.frequency.exponentialRampToValueAtTime(240, now + 0.04);
        tokGain.gain.setValueAtTime(0.14, now);
        tokGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        tok.connect(tokGain);
        tokGain.connect(ctx.destination);
        tok.start(now);
        tok.stop(now + 0.05);
    } catch (err) {
        console.debug("Egg crack skipped:", err);
    }
}

/**
 * Play a cute, joyful celebration fanfare when Bubby hatches from its egg:
 * bright ascending C5-E5-G5-A5-C6 chime with a warm sparkly final chord.
 */
export function playHatchFanfare(): void {
    if (!isSoundEffectsEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
        if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime + 0.09;
        const melody = [
            { freq: 523.25, t: 0.0, dur: 0.14, gain: 0.16 }, // C5
            { freq: 659.25, t: 0.09, dur: 0.14, gain: 0.17 }, // E5
            { freq: 783.99, t: 0.18, dur: 0.14, gain: 0.18 }, // G5
            { freq: 880.0, t: 0.27, dur: 0.15, gain: 0.18 }, // A5
            { freq: 1046.5, t: 0.37, dur: 0.48, gain: 0.22 }, // C6 (hero note)
        ];

        melody.forEach((n, i) => {
            const start = now + n.t;
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = i === melody.length - 1 ? "triangle" : "sine";
            osc.frequency.setValueAtTime(n.freq, start);
            g.gain.setValueAtTime(0.0001, start);
            g.gain.linearRampToValueAtTime(n.gain, start + 0.015);
            g.gain.exponentialRampToValueAtTime(0.001, start + n.dur);
            osc.connect(g);
            g.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + n.dur + 0.02);
        });

        // Soft sparkly chord shimmer on the final C6
        [1318.51, 1567.98].forEach((freq) => {
            const start = now + 0.39;
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, start);
            g.gain.setValueAtTime(0.0001, start);
            g.gain.linearRampToValueAtTime(0.09, start + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
            osc.connect(g);
            g.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.48);
        });
    } catch (err) {
        console.debug("Hatch fanfare skipped:", err);
    }
}
