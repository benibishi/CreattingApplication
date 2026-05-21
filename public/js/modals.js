/**
 * CUSTOM MODAL SYSTEM
 * Replaces native confirm(), prompt(), and alert() calls
 * with styled glassmorphism modals matching the design system.
 */
const Modal = {
    /**
     * Show a confirmation dialog with CONFIRM/CANCEL buttons.
     * @param {string} title - Bold header text
     * @param {string} message - Body message
     * @param {Function} onConfirm - Called when user confirms
     */
    confirm(title, message, onConfirm) {
        this.close(); // Close any existing modal
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-content rugged-card">
                <h3 class="modal-title">${title}</h3>
                <p class="modal-body">${message}</p>
                <div class="modal-actions">
                    <button class="rugged-button secondary small modal-cancel-btn">CANCEL</button>
                    <button class="rugged-button hazard-btn small modal-confirm-btn">CONFIRM</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.modal-cancel-btn').onclick = () => {
            SoundEngine.playClick();
            this.close();
        };
        overlay.querySelector('.modal-confirm-btn').onclick = () => {
            SoundEngine.playClick();
            this.close();
            if (onConfirm) onConfirm();
        };
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });
    },

    /**
     * Show a prompt dialog with an input field and SUBMIT/CANCEL buttons.
     * @param {string} title - Bold header text
     * @param {string} message - Body message
     * @param {string} placeholder - Input placeholder text
     * @param {Function} onSubmit - Called with input value when submitted
     */
    prompt(title, message, placeholder, onSubmit) {
        this.close();
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-content rugged-card">
                <h3 class="modal-title">${title}</h3>
                <p class="modal-body">${message}</p>
                <input type="text" class="rugged-input modal-input" placeholder="${placeholder || ''}" />
                <div class="modal-actions">
                    <button class="rugged-button secondary small modal-cancel-btn">CANCEL</button>
                    <button class="rugged-button primary small modal-submit-btn">SUBMIT</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const input = overlay.querySelector('.modal-input');
        input.focus();

        const submitHandler = () => {
            const value = input.value.trim();
            if (value) {
                SoundEngine.playClick();
                this.close();
                if (onSubmit) onSubmit(value);
            } else {
                input.classList.add('invalid');
                SoundEngine.playAlarm();
            }
        };

        overlay.querySelector('.modal-cancel-btn').onclick = () => {
            SoundEngine.playClick();
            this.close();
        };
        overlay.querySelector('.modal-submit-btn').onclick = submitHandler;

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitHandler();
            if (e.key === 'Escape') this.close();
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });
    },

    /**
     * Show a prompt dialog with two date input fields for date range.
     * @param {string} title - Bold header text
     * @param {string} message - Body message
     * @param {Function} onSubmit - Called with {startDate, endDate} when submitted
     */
    dateRange(title, message, onSubmit) {
        this.close();
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-content rugged-card">
                <h3 class="modal-title">${title}</h3>
                <p class="modal-body">${message}</p>
                <div class="form-group" style="margin-bottom: 0.75rem;">
                    <label>START DATE (LEAVE BLANK FOR ALL)</label>
                    <input type="date" class="rugged-input modal-input" id="modal-start-date" />
                </div>
                <div class="form-group" style="margin-bottom: 0.75rem;">
                    <label>END DATE (LEAVE BLANK FOR ALL)</label>
                    <input type="date" class="rugged-input modal-input" id="modal-end-date" />
                </div>
                <div class="modal-actions">
                    <button class="rugged-button secondary small modal-cancel-btn">CANCEL</button>
                    <button class="rugged-button primary small modal-submit-btn">EXPORT</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.modal-cancel-btn').onclick = () => {
            SoundEngine.playClick();
            this.close();
        };
        overlay.querySelector('.modal-submit-btn').onclick = () => {
            SoundEngine.playClick();
            this.close();
            if (onSubmit) {
                onSubmit({
                    startDate: document.getElementById('modal-start-date').value,
                    endDate: document.getElementById('modal-end-date').value
                });
            }
        };
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });
    },

    /**
     * Show a simple alert modal with an OK button.
     * @param {string} title - Bold header text
     * @param {string} message - Body message
     */
    alert(title, message) {
        this.close();
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-content rugged-card">
                <h3 class="modal-title">${title}</h3>
                <p class="modal-body">${message}</p>
                <div class="modal-actions">
                    <button class="rugged-button primary small modal-ok-btn">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.modal-ok-btn').onclick = () => {
            SoundEngine.playClick();
            this.close();
        };
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });
    },

    /**
     * Remove any open modal overlay.
     */
    close() {
        const existing = document.querySelector('.modal-overlay');
        if (existing) {
            existing.classList.add('modal-closing');
            setTimeout(() => {
                if (existing.parentNode) existing.parentNode.removeChild(existing);
            }, 200);
        }
    }
};
