/**
 * SIGN-IN MODULE - Worker Sign-in Flow, Site Selection, Setup Required
 * Extracted from app.js with enhancements.
 * References: store, UI, SoundEngine, Modal, I18n, currentUser
 */

/**
 * SIGN-IN FLOW - Enhanced with sign-out button, issue reporting
 */
async function renderSignInFlow(siteId) {
    const site = await store.getSite(siteId);
    if (!site) return UI.container.innerHTML = 'INVALID SITE';

    UI.render('tpl-signin');
    document.getElementById('signin-site-name').textContent = site.name;

    // --- ENHANCED: Add REPORT ISSUE button ---
    const signinHeader = document.querySelector('.signin-header, .section-title');
    if (signinHeader) {
        const reportBtn = document.createElement('button');
        reportBtn.className = 'rugged-button secondary small';
        reportBtn.style.cssText = 'margin-left: auto; font-size: 0.7rem;';
        reportBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> REPORT ISSUE';
        reportBtn.onclick = () => {
            window.location.hash = `#incidents-${siteId}`;
        };
        // Insert after header or in a flex container
        const headerParent = signinHeader.parentElement;
        if (headerParent) {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;';
            headerParent.insertBefore(wrapper, signinHeader);
            wrapper.appendChild(signinHeader);
            wrapper.appendChild(reportBtn);
        }
    }

    // Load trades
    const trades = await store.getTrades();
    const tradeSelect = document.getElementById('trade-type');
    tradeSelect.innerHTML = trades.map(t => `<option value="${t}">${t}</option>`).join('');

    const form = document.getElementById('signin-form');
    const choiceBtns = document.querySelectorAll('.choice-btn');
    
    // Track sign-in time for duration calculation
    let signInTime = null;
    let signInId = null;

    choiceBtns.forEach(btn => {
        btn.onclick = () => {
            choiceBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            if (btn.dataset.value === 'no') {
                SoundEngine.playAlarm();
                
                document.getElementById('signin-form-container').classList.add('hidden');
                document.getElementById('orientation-warning').classList.remove('hidden');
                document.getElementById('display-site-map').src = site.map_url;
                document.getElementById('display-office-photo').src = site.office_url;

                // Render Map pin if present in database
                const displayPin = document.getElementById('display-map-pin');
                if (displayPin && site.map_pin_x && site.map_pin_y) {
                    displayPin.style.left = `${site.map_pin_x}%`;
                    displayPin.style.top = `${site.map_pin_y}%`;
                    displayPin.classList.remove('hidden');
                } else if (displayPin) {
                    displayPin.classList.add('hidden');
                }
            } else {
                document.getElementById('ppe-section').classList.remove('hidden');
                document.getElementById('submit-signin').classList.remove('hidden');
            }
        };
    });

    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById('submit-signin');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'SIGNING IN...';
        }

        try {
            const response = await store.recordSignIn(siteId, {
                firstName: document.getElementById('fname').value,
                lastName: document.getElementById('lname').value,
                company: document.getElementById('company').value,
                tradeType: document.getElementById('trade-type').value
            });
            
            // --- ENHANCED: Store sign-in ID and time ---
            signInTime = new Date();
            signInId = response && response.id ? response.id : null;

            SoundEngine.playSuccess();
            
            document.getElementById('signin-form-container').classList.add('hidden');
            const successMsg = document.getElementById('success-msg');
            successMsg.classList.remove('hidden');
            document.getElementById('summary-name').textContent = document.getElementById('fname').value;

            // --- ENHANCED: Add SIGN OUT button to success screen ---
            let signOutContainer = document.getElementById('signout-container');
            if (!signOutContainer) {
                signOutContainer = document.createElement('div');
                signOutContainer.id = 'signout-container';
                signOutContainer.style.cssText = 'margin-top: 1.5rem; text-align: center;';
                successMsg.appendChild(signOutContainer);
            }

            signOutContainer.innerHTML = `
                <button id="sign-out-btn" class="rugged-button hazard-btn" style="margin-top: 1rem; font-size: 1rem; padding: 12px 24px;">
                    <i class="fas fa-sign-out-alt"></i> SIGN OUT
                </button>
                <p style="margin-top: 0.5rem; font-size: 0.7rem; color: #888;">TAP WHEN LEAVING SITE</p>
            `;

            const signOutBtn = document.getElementById('sign-out-btn');
            if (signOutBtn) {
                signOutBtn.onclick = async () => {
                    if (!signInId) {
                        Modal.alert('ERROR', 'SIGN-IN RECORD NOT FOUND. PLEASE CONTACT SUPERVISOR.');
                        return;
                    }

                    signOutBtn.disabled = true;
                    signOutBtn.textContent = 'SIGNING OUT...';

                    try {
                        await store.checkoutSignIn(signInId);
                        SoundEngine.playSuccess();

                        // Calculate duration
                        const signOutTime = new Date();
                        const durationMs = signOutTime - signInTime;
                        const hours = Math.floor(durationMs / 3600000);
                        const minutes = Math.floor((durationMs % 3600000) / 60000);
                        const durationStr = hours > 0 ? `${hours}H ${minutes}M` : `${minutes} MINUTES`;

                        signOutContainer.innerHTML = `
                            <div style="text-align: center; padding: 1rem;">
                                <i class="fas fa-check-circle" style="font-size: 2.5rem; color: var(--success-green, #4caf50); margin-bottom: 0.5rem;"></i>
                                <h3 style="color: var(--success-green, #4caf50); margin-bottom: 0.5rem;">SIGNED OUT SUCCESSFULLY</h3>
                                <p style="font-size: 0.85rem; color: #aaa;">TIME ON SITE: <strong style="color: var(--primary-amber, #ffae00);">${durationStr}</strong></p>
                                <p style="font-size: 0.7rem; color: #666; margin-top: 0.5rem;">THANK YOU FOR YOUR WORK TODAY</p>
                            </div>
                        `;
                    } catch (err) {
                        SoundEngine.playAlarm();
                        Modal.alert('SIGN-OUT ERROR', 'FAILED TO SIGN OUT: ' + err.message);
                        signOutBtn.disabled = false;
                        signOutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> SIGN OUT';
                    }
                };
            }
        } catch (err) {
            SoundEngine.playAlarm();
            Modal.alert('SIGN-IN ERROR', 'FAILED TO SIGN IN: ' + err.message);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'SIGN IN';
            }
        }
    };
}

/**
 * SITE SELECTION - Dropdown for multiple sites
 */
function renderSiteSelection(sites) {
    UI.container.innerHTML = `
        <section class="view">
            <h2 class="section-title">SELECT SITE</h2>
            <div class="rugged-card">
                <select id="site-dropdown" class="rugged-input">
                    ${sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                </select>
                <button id="go-btn" class="rugged-button primary">CONTINUE</button>
            </div>
        </section>
    `;
    document.getElementById('go-btn').onclick = () => {
        window.location.hash = `#${document.getElementById('site-dropdown').value}`;
    };
}

/**
 * SETUP REQUIRED - No sites found view
 */
function renderSetupRequired() {
    UI.container.innerHTML = '<section class="view"><h2 class="section-title">SYSTEM READY</h2><div class="rugged-card warning"><p>NO SITES FOUND. PLEASE LOG IN AS SUPERVISOR.</p><button onclick="window.location.hash=\'#admin-login\'" class="rugged-button primary">LOGIN</button></div></section>';
}
