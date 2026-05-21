/**
 * THEME MANAGER
 * Extracted from app.js
 */
const ThemeManager = {
    theme: 'dark',

    init() {
        // Sound toggle initial state
        const soundSaved = localStorage.getItem('TACTICAL_SOUND_ENABLED');
        if (soundSaved === 'false') {
            SoundEngine.enabled = false;
            const btn = document.getElementById('sound-toggle-btn');
            if (btn) {
                btn.classList.add('off');
                btn.innerHTML = '<i class="fas fa-volume-mute"></i> SOUND: OFF';
            }
        }

        const soundBtn = document.getElementById('sound-toggle-btn');
        if (soundBtn) {
            soundBtn.addEventListener('click', () => {
                SoundEngine.toggle();
            });
        }

        // Theme toggle initial state
        const themeSaved = localStorage.getItem('TACTICAL_THEME');
        if (themeSaved === 'daylight') {
            this.setTheme('daylight');
        }

        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const newTheme = this.theme === 'dark' ? 'daylight' : 'dark';
                this.setTheme(newTheme);
                SoundEngine.playClick();
            });
        }
    },

    setTheme(mode) {
        this.theme = mode;
        const btn = document.getElementById('theme-toggle-btn');
        if (mode === 'daylight') {
            document.documentElement.setAttribute('data-theme', 'daylight');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-moon"></i> DAYLIGHT MODE: ON';
                btn.classList.remove('off');
            }
        } else {
            document.documentElement.removeAttribute('data-theme');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-sun"></i> DAYLIGHT MODE: OFF';
                btn.classList.add('off');
            }
        }
        localStorage.setItem('TACTICAL_THEME', mode);
    }
};
