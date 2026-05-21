/**
 * SOUND ENGINE (WEB AUDIO API SYNTHESIZER)
 * Extracted from app.js
 */
const SoundEngine = {
    enabled: true,
    audioCtx: null,

    init() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    },

    toggle() {
        this.enabled = !this.enabled;
        const btn = document.getElementById('sound-toggle-btn');
        if (btn) {
            if (this.enabled) {
                btn.classList.remove('off');
                btn.innerHTML = '<i class="fas fa-volume-up"></i> SOUND: ON';
                this.playClick();
            } else {
                btn.classList.add('off');
                btn.innerHTML = '<i class="fas fa-volume-mute"></i> SOUND: OFF';
            }
        }
        localStorage.setItem('TACTICAL_SOUND_ENABLED', this.enabled);
    },

    playClick() {
        if (!this.enabled) return;
        this.init();
        try {
            const ctx = this.audioCtx;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.04);

            gain.gain.setValueAtTime(0.06, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

            filter.type = 'highpass';
            filter.frequency.setValueAtTime(400, ctx.currentTime);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.04);
        } catch (e) {
            console.error('Audio click error:', e);
        }
    },

    playSuccess() {
        if (!this.enabled) return;
        this.init();
        try {
            const ctx = this.audioCtx;
            const now = ctx.currentTime;
            
            const playTone = (freq, start, duration) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, start);
                
                gain.gain.setValueAtTime(0.06, start);
                gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.start(start);
                osc.stop(start + duration);
            };

            // Ascending high-tech arpeggio chime
            playTone(523.25, now, 0.1);       // C5
            playTone(659.25, now + 0.08, 0.1);  // E5
            playTone(783.99, now + 0.16, 0.1);  // G5
            playTone(1046.50, now + 0.24, 0.25); // C6
        } catch (e) {
            console.error('Audio success error:', e);
        }
    },

    playAlarm() {
        if (!this.enabled) return;
        this.init();
        try {
            const ctx = this.audioCtx;
            const now = ctx.currentTime;

            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(160, now);
            osc1.frequency.linearRampToValueAtTime(260, now + 0.15);
            osc1.frequency.linearRampToValueAtTime(160, now + 0.3);

            osc2.type = 'square';
            osc2.frequency.setValueAtTime(163, now);
            osc2.frequency.linearRampToValueAtTime(263, now + 0.15);
            osc2.frequency.linearRampToValueAtTime(163, now + 0.3);

            gain.gain.setValueAtTime(0.03, now);
            gain.gain.linearRampToValueAtTime(0.03, now + 0.25);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start();
            osc2.start();
            
            osc1.stop(now + 0.3);
            osc2.stop(now + 0.3);
        } catch (e) {
            console.error('Audio alarm error:', e);
        }
    }
};

// Global mechanical tap sound player for all interactables
document.addEventListener('click', (e) => {
    const target = e.target.closest('button, .tab-btn, select, option, .theme-dot, a');
    if (target && !target.closest('#sound-toggle-btn')) {
        SoundEngine.playClick();
    }
});
