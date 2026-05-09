/**
 * CORE APPLICATION LOGIC
 */

const CONFIG = {
    CHECK_INTERVAL: 60000 // Check background tasks every minute
};

let currentUser = JSON.parse(sessionStorage.getItem('SITE_SECURE_USER')) || null;

const UI = {
    container: document.getElementById('view-container'),
    timeDisplay: document.getElementById('current-time'),
    loginNavBtn: document.getElementById('nav-login-btn'),
    dashboardNavBtn: document.getElementById('nav-dashboard-btn'),
    
    render(templateId, data = {}) {
        const template = document.getElementById(templateId);
        if (!template) {
            console.error(`Template not found: ${templateId}`);
            return;
        }
        const clone = template.content.cloneNode(true);
        this.container.innerHTML = '';
        this.container.appendChild(clone);
        return this.container;
    },

    updateNav() {
        const hash = window.location.hash;
        const isDashboardPage = ['#admin-sites', '#admin-setup', '#admin-trades'].includes(hash);

        if (currentUser) {
            this.loginNavBtn.textContent = `LOGOUT (${currentUser.username})`;
            this.loginNavBtn.onclick = () => {
                setCurrentUser(null);
                window.location.hash = '#home';
                this.updateNav();
            };
            
            // Show dashboard button if logged in AND not on a dashboard page
            if (!isDashboardPage) {
                this.dashboardNavBtn.classList.remove('hidden');
            } else {
                this.dashboardNavBtn.classList.add('hidden');
            }
        } else {
            this.loginNavBtn.textContent = 'LOGIN';
            this.loginNavBtn.onclick = () => {
                window.location.hash = '#admin-login';
            };
            this.dashboardNavBtn.classList.add('hidden');
        }
    }
};

/**
 * AUTH LOGIC HELPER
 */
function setCurrentUser(user) {
    console.log('[SYSTEM] SETTING CURRENT USER:', user ? user.username : 'NULL');
    currentUser = user;
    if (user) {
        sessionStorage.setItem('SITE_SECURE_USER', JSON.stringify(user));
    } else {
        sessionStorage.removeItem('SITE_SECURE_USER');
    }
}

/**
 * ROUTING LOGIC
 */
function handleRouting() {
    const hash = window.location.hash;
    const sites = store.getAllSites();
    console.log('[ROUTING] HASH:', hash, '| USER:', currentUser ? currentUser.username : 'GUEST');
    
    if (hash.startsWith('#site-')) {
        const siteId = hash.substring(1);
        renderSignInFlow(siteId);
    } else if (hash === '#admin-sites') {
        if (!currentUser) {
            console.warn('[ROUTING] UNAUTHORIZED ACCESS TO DASHBOARD - REDIRECTING');
            return window.location.hash = '#admin-login';
        }
        renderAdminSites();
    } else if (hash === '#admin-setup') {
        if (!currentUser) {
            console.warn('[ROUTING] UNAUTHORIZED ACCESS TO DASHBOARD - REDIRECTING');
            return window.location.hash = '#admin-login';
        }
        renderAdminSetup();
    } else if (hash === '#admin-trades') {
        if (!currentUser) {
            console.warn('[ROUTING] UNAUTHORIZED ACCESS TO DASHBOARD - REDIRECTING');
            return window.location.hash = '#admin-login';
        }
        renderAdminTrades();
    } else if (hash === '#admin-dashboard') {
        window.location.hash = '#admin-sites';
    } else if (hash === '#admin-login' || hash === '#admin-register') {
        if (currentUser) {
            console.log('[ROUTING] USER ALREADY LOGGED IN - REDIRECTING TO DASHBOARD');
            return window.location.hash = '#admin-sites';
        }
        hash === '#admin-login' ? renderAdminLogin() : renderAdminRegister();
    } else if (hash.startsWith('#live-logs-')) {
        const siteId = hash.replace('#live-logs-', '');
        renderLiveLogs(siteId);
    } else if (hash.startsWith('#poster-')) {
        const siteId = hash.replace('#poster-', '');
        renderPoster(siteId);
    } else {
        // DEFAULT LANDING: Trade Sign-In Priority
        if (sites.length === 0) {
            renderSetupRequired();
        } else if (sites.length === 1) {
            window.location.hash = `#${sites[0].id}`;
        } else {
            renderSiteSelection(sites);
        }
    }
    UI.updateNav();
}

/**
 * DEFAULT VIEWS
 */
function renderSetupRequired() {
    UI.container.innerHTML = `
        <section class="view">
            <h2 class="section-title">SYSTEM READY</h2>
            <div class="rugged-card warning">
                <p class="large-text">NO ACTIVE SITES FOUND</p>
                <p>Supervisor setup is required before trades can sign in.</p>
                <div style="margin-top: 2rem;">
                    <button onclick="window.location.hash='#admin-login'" class="rugged-button primary">SUPERVISOR LOGIN</button>
                </div>
            </div>
        </section>
    `;
}

function renderSiteSelection(sites) {
    UI.container.innerHTML = `
        <section class="view">
            <h2 class="section-title">SELECT SITE</h2>
            <div class="rugged-card large-view">
                <label for="site-dropdown" style="font-size: 1.2rem; margin-bottom: 1rem;">SELECT THE SITE YOU ARE SIGNING IN:</label>
                <select id="site-dropdown" class="rugged-input large">
                    <option value="" disabled selected>-- CHOOSE A SITE --</option>
                    ${sites.map(site => `<option value="${site.id}">${site.name}</option>`).join('')}
                </select>
                <div style="margin-top: 2rem;">
                    <button id="go-to-site-btn" class="rugged-button primary large hidden">CONTINUE TO SIGN-IN</button>
                </div>
            </div>
        </section>
    `;
    
    const dropdown = document.getElementById('site-dropdown');
    const btn = document.getElementById('go-to-site-btn');

    dropdown.onchange = () => {
        if (dropdown.value) {
            btn.classList.remove('hidden');
        }
    };

    btn.onclick = () => {
        if (dropdown.value) {
            window.location.hash = `#${dropdown.value}`;
        }
    };
}

/**
 * AUTH VIEWS
 */
function renderAdminLogin() {
    UI.render('tpl-admin-pin');
    const userInp = document.getElementById('admin-user-input');
    const pinInp = document.getElementById('admin-pin-input');
    const loginBtn = document.getElementById('admin-login-btn');
    const goToRegBtn = document.getElementById('go-to-register-btn');
    const pinToggleBtn = document.getElementById('pin-toggle-btn');
    const error = document.getElementById('auth-error');

    // PIN Toggle logic
    pinToggleBtn.onclick = () => {
        const isPassword = pinInp.type === 'password';
        pinInp.type = isPassword ? 'text' : 'password';
        pinToggleBtn.textContent = isPassword ? 'HIDE' : 'SHOW';
    };

    goToRegBtn.onclick = () => {
        window.location.hash = '#admin-register';
    };

    const clearValidation = () => {
        userInp.classList.remove('invalid');
        pinInp.classList.remove('invalid');
    };

    const validateFields = () => {
        clearValidation();
        let isValid = true;
        error.classList.add('hidden');
        
        if (!userInp.value.trim()) { 
            userInp.classList.add('invalid'); 
            isValid = false; 
        }
        
        if (!pinInp.value || pinInp.value.length < 4) { 
            pinInp.classList.add('invalid'); 
            isValid = false;
            error.textContent = 'PASSWORD MUST BE AT LEAST 4 CHARACTERS';
            error.classList.remove('hidden');
        }
        return isValid;
    };

    loginBtn.onclick = async () => {
        if (!validateFields()) return;

        loginBtn.disabled = true;
        const originalText = loginBtn.textContent;
        loginBtn.textContent = 'CONNECTING...';

        // Simulate network delay
        await new Promise(r => setTimeout(r, 1000));

        const user = store.authenticate(userInp.value, pinInp.value);
        if (user) {
            setCurrentUser(user);
            window.location.hash = '#admin-sites';
        } else {
            console.warn('[AUTH] LOGIN FAILED FOR USER:', userInp.value);
            error.classList.remove('hidden');
            error.textContent = 'INVALID CREDENTIALS // ACCESS DENIED';
            loginBtn.disabled = false;
            loginBtn.textContent = originalText;
        }
    };
}

function renderAdminRegister() {
    UI.render('tpl-admin-register');
    const fullNameInp = document.getElementById('reg-fullname');
    const emailInp = document.getElementById('reg-email');
    const userInp = document.getElementById('reg-username');
    const passInp = document.getElementById('reg-password');
    const regBtn = document.getElementById('admin-register-btn');
    const backBtn = document.getElementById('back-to-login-btn');
    const error = document.getElementById('reg-error');

    backBtn.onclick = () => window.location.hash = '#admin-login';

    const validate = () => {
        let isValid = true;
        error.classList.add('hidden');
        [fullNameInp, emailInp, userInp, passInp].forEach(el => el.classList.remove('invalid'));

        if (!fullNameInp.value.trim()) { fullNameInp.classList.add('invalid'); isValid = false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInp.value)) { emailInp.classList.add('invalid'); isValid = false; }
        if (!userInp.value.trim()) { userInp.classList.add('invalid'); isValid = false; }
        if (!passInp.value || passInp.value.length < 4) { 
            passInp.classList.add('invalid'); 
            isValid = false;
            error.textContent = 'PASSWORD MUST BE AT LEAST 4 CHARACTERS';
            error.classList.remove('hidden');
        }

        return isValid;
    };

    regBtn.onclick = async () => {
        if (!validate()) return;

        regBtn.disabled = true;
        const originalText = regBtn.textContent;
        regBtn.textContent = 'CREATING ACCOUNT...';

        try {
            await new Promise(r => setTimeout(r, 1000));

            const res = store.createUser(userInp.value, passInp.value, {
                fullName: fullNameInp.value.trim(),
                email: emailInp.value.trim()
            });

            if (res.success) {
                console.log('[AUTH] REGISTRATION SUCCESSFUL, ATTEMPTING LOGIN...');
                const user = store.authenticate(userInp.value, passInp.value);
                if (user) {
                    setCurrentUser(user);
                    window.location.hash = '#admin-sites';
                } else {
                    throw new Error('AUTO-LOGIN FAILED AFTER REGISTRATION');
                }
            } else {
                throw new Error(res.message);
            }
        } catch (err) {
            console.error('[AUTH] REGISTRATION ERROR:', err);
            error.textContent = err.message || 'SYSTEM ERROR: UNABLE TO CREATE ACCOUNT';
            error.classList.remove('hidden');
            regBtn.disabled = false;
            regBtn.textContent = originalText;
        }
    };
}

/**
 * ADMIN DASHBOARD VIEWS
 */
function renderAdminSites() {
    UI.render('tpl-admin-sites');
    const sitesList = document.getElementById('active-sites-list');
    const alertBtn = document.getElementById('enable-notifications-btn');
    
    // Notification Setup
    if (Notification.permission === 'granted') {
        alertBtn.innerHTML = '<i class="fas fa-check"></i> ALERTS ACTIVE';
        alertBtn.classList.replace('primary', 'secondary');
        alertBtn.disabled = true;
    }

    alertBtn.onclick = async () => {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            alertBtn.innerHTML = '<i class="fas fa-check"></i> ALERTS ACTIVE';
            alertBtn.classList.replace('primary', 'secondary');
            alertBtn.disabled = true;
            new Notification("SITE-SECURE", { body: "Real-time supervisor alerts enabled.", icon: "favicon.ico" });
        }
    };

    // Display sites for this supervisor
    const sites = store.getSitesForUser(currentUser.username);
    if (sites.length > 0) {
        sitesList.innerHTML = '';
        sites.forEach(site => {
            const div = document.createElement('div');
            div.className = 'site-mini-card';
            div.innerHTML = `
                <div class="site-info">
                    <strong>${site.name}</strong>
                    <small>${site.email}</small>
                </div>
                <div class="mini-actions">
                    <button class="rugged-button secondary small" onclick="window.location.hash='#poster-${site.id}'">POSTER</button>
                    <button class="rugged-button primary small" onclick="window.location.hash='#live-logs-${site.id}'">LOGS</button>
                    <button class="rugged-button hazard-btn small" style="grid-column: span 2; background: var(--hazard-red); color: white;" onclick="confirmDeleteSite('${site.id}')">DELETE</button>
                </div>
            `;
            sitesList.appendChild(div);
        });
    } else {
        sitesList.innerHTML = '<div class="rugged-card warning" style="grid-column: 1/-1; text-align: center;">NO ACTIVE SITES MANAGED BY YOU</div>';
    }
}

function renderAdminSetup() {
    UI.render('tpl-admin-setup');
    const form = document.getElementById('site-setup-form');

    // File Preview Logic
    const handlePreview = (inputEl, previewId) => {
        const preview = document.getElementById(previewId);
        const pillText = preview.querySelector('.pill-text');
        
        inputEl.onchange = () => {
            if (inputEl.files && inputEl.files[0]) {
                const fileName = inputEl.files[0].name;
                pillText.textContent = fileName;
                preview.classList.remove('hidden');
            } else {
                preview.classList.add('hidden');
            }
        };
    };

    handlePreview(document.getElementById('site-map'), 'site-map-preview');
    handlePreview(document.getElementById('site-office-photo'), 'site-office-preview');

    form.onsubmit = async (e) => {
        e.preventDefault();
        const nameInp = document.getElementById('site-name');
        const emailInp = document.getElementById('site-email');
        const mapInp = document.getElementById('site-map');
        const officeInp = document.getElementById('site-office-photo');

        let isValid = true;
        [nameInp, emailInp, mapInp, officeInp].forEach(el => el.classList.remove('invalid'));

        if (!nameInp.value.trim()) { nameInp.classList.add('invalid'); isValid = false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInp.value)) { emailInp.classList.add('invalid'); isValid = false; }
        if (!mapInp.files[0]) { mapInp.classList.add('invalid'); isValid = false; }
        if (!officeInp.files[0]) { officeInp.classList.add('invalid'); isValid = false; }

        if (!isValid) return;

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'GENERATING SITE...';

        try {
            const [mapBase64, officeBase64] = await Promise.all([
                toBase64(mapInp.files[0]),
                toBase64(officeInp.files[0])
            ]);

            const siteId = store.createSite({
                name: nameInp.value, email: emailInp.value, map: mapBase64, office: officeBase64
            }, currentUser.username);

            window.location.hash = '#admin-sites';
        } catch (err) {
            console.error(err);
            alert("ERROR PROCESSING IMAGES. THEY MAY BE TOO LARGE.");
            submitBtn.disabled = false;
            submitBtn.textContent = 'GENERATE SITE ACCESS';
        }
    };
}

function renderAdminTrades() {
    UI.render('tpl-admin-trades');
    const tradesList = document.getElementById('trades-list');
    const newTradeInp = document.getElementById('new-trade-name');
    const addTradeBtn = document.getElementById('add-trade-btn');

    const refreshTrades = () => {
        const trades = store.getTrades();
        tradesList.innerHTML = '';
        trades.forEach(trade => {
            const div = document.createElement('div');
            div.className = 'site-mini-card';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.innerHTML = `
                <span style="font-weight: 700; font-size: 0.9rem;">${trade.toUpperCase()}</span>
                <button class="rugged-button hazard-btn small" style="margin: 0; width: auto; background: var(--hazard-red); color: white;" onclick="deleteTradeItem('${trade}')">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            tradesList.appendChild(div);
        });
    };

    addTradeBtn.onclick = () => {
        const name = newTradeInp.value.trim();
        if (name) {
            if (store.addTrade(name)) {
                newTradeInp.value = '';
                refreshTrades();
            } else {
                alert("TRADE ALREADY EXISTS");
            }
        }
    };

    window.deleteTradeItem = (trade) => {
        if (confirm(`REMOVE "${trade.toUpperCase()}" FROM THE LIST?`)) {
            store.deleteTrade(trade);
            refreshTrades();
        }
    };

    refreshTrades();
}

function confirmDeleteSite(siteId) {
    if (confirm("WARNING: PERMANENTLY DELETE THIS SITE AND ALL DATA?")) {
        store.deleteSite(siteId);
        renderAdminSites();
    }
}

function renderPoster(siteId) {
    const site = store.getSite(siteId);
    UI.render('tpl-poster');
    document.getElementById('poster-site-name').textContent = site.name;
    document.getElementById('back-to-admin').onclick = () => window.location.hash = '#admin-sites';
    document.getElementById('preview-site').onclick = () => window.location.hash = `#${siteId}`;

    const url = `${window.location.origin}${window.location.pathname}#${siteId}`;
    new QRCode(document.getElementById('qrcode-container'), { text: url, width: 256, height: 256 });
}

/**
 * LIVE LOG VIEWER
 */
function renderLiveLogs(siteId) {
    const site = store.getSite(siteId);
    const signins = store.getSignInsForSite(siteId);
    
    UI.render('tpl-live-logs');
    document.getElementById('log-count').textContent = signins.length;
    document.getElementById('back-to-dashboard').onclick = () => window.location.hash = '#admin-sites';

    // Update Favicon with headcount
    updateDynamicFavicon(signins.length);

    // CSV Export Logic
    document.getElementById('export-csv-btn').onclick = () => exportToCSV(site.name, signins);

    const list = document.getElementById('log-entries');
    const tableHeader = document.querySelector('.rugged-table thead tr');
    
    // Add Trade header if not already there
    if (tableHeader.cells.length === 3) {
        const th = document.createElement('th');
        th.textContent = 'TRADE';
        tableHeader.insertBefore(th, tableHeader.cells[2]);
    }

    signins.forEach(s => {
        const row = document.createElement('tr');
        const time = new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        row.innerHTML = `
            <td>${s.firstName} ${s.lastName}</td>
            <td>${s.company}</td>
            <td>${s.tradeType || 'N/A'}</td>
            <td>${time}</td>
        `;
        list.appendChild(row);
    });
}

function exportToCSV(siteName, data) {
    if (data.length === 0) return alert("NO DATA TO EXPORT");

    const headers = ['NAME', 'COMPANY', 'TRADE', 'TIME'];
    const rows = data.map(s => [
        `"${s.firstName} ${s.lastName}"`,
        `"${s.company}"`,
        `"${s.tradeType || 'N/A'}"`,
        `"${new Date(s.timestamp).toLocaleTimeString()}"`
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `AttendanceLog_${siteName.replace(/\s+/g, '_')}_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * TRADE SIGN-IN FLOW
 */
function renderSignInFlow(siteId) {
    const site = store.getSite(siteId);
    if (!site) {
        UI.container.innerHTML = '<div class="rugged-card warning">INVALID SITE URL // REPORT TO SUPERVISOR</div>';
        return;
    }

    UI.render('tpl-signin');
    document.getElementById('signin-site-name').textContent = site.name;

    const tradeSelect = document.getElementById('trade-type');
    const trades = store.getTrades();
    tradeSelect.innerHTML = '<option value="" disabled selected>-- SELECT TRADE --</option>';
    trades.forEach(trade => {
        const opt = document.createElement('option');
        opt.value = trade;
        opt.textContent = trade;
        tradeSelect.appendChild(opt);
    });

    const form = document.getElementById('signin-form');
    const choiceBtns = document.querySelectorAll('.choice-btn');
    const submitBtn = document.getElementById('submit-signin');
    const warning = document.getElementById('orientation-warning');
    const formContainer = document.getElementById('signin-form-container');
    const successMsg = document.getElementById('success-msg');
    
    // Smooth transitions without reload
    document.getElementById('warning-back-btn').onclick = () => window.location.hash = '#home';
    document.getElementById('success-done-btn').onclick = () => window.location.hash = '#home';

    let isOrientated = null;

    choiceBtns.forEach(btn => {
        btn.onclick = () => {
            choiceBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            isOrientated = btn.dataset.value === 'yes';
            
            if (isOrientated === false) {
                const fname = document.getElementById('fname').value || 'New Worker';
                const lname = document.getElementById('lname').value || '';
                const siteName = site.name;
                
                sendNotification(`ORIENTATION ALERT: ${siteName}`, {
                    body: `Worker [${fname} ${lname}] needs orientation at the site office.`,
                    icon: "favicon.ico"
                });

                formContainer.classList.add('hidden');
                warning.classList.remove('hidden');
                document.getElementById('display-site-map').src = site.map;
                document.getElementById('display-office-photo').src = site.office;
            } else {
                submitBtn.classList.remove('hidden');
            }
        };
    });

    form.onsubmit = (e) => {
        e.preventDefault();
        const fname = document.getElementById('fname');
        const lname = document.getElementById('lname');
        const company = document.getElementById('company');
        const tradeType = document.getElementById('trade-type');

        let isValid = true;
        [fname, lname, company, tradeType].forEach(el => el.classList.remove('invalid'));
        if (!fname.value.trim()) { fname.classList.add('invalid'); isValid = false; }
        if (!lname.value.trim()) { lname.classList.add('invalid'); isValid = false; }
        if (!company.value.trim()) { company.classList.add('invalid'); isValid = false; }
        if (!tradeType.value) { tradeType.classList.add('invalid'); isValid = false; }

        if (!isValid) return;

        store.recordSignIn(siteId, {
            firstName: fname.value,
            lastName: lname.value,
            company: company.value,
            tradeType: tradeType.value
        });

        // Play Success Sound
        playSuccessSound();

        // Populate Summary
        document.getElementById('summary-name').textContent = `${fname.value.toUpperCase()} ${lname.value.toUpperCase()}`;
        document.getElementById('summary-company').textContent = company.value.toUpperCase();
        document.getElementById('summary-time').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        formContainer.classList.add('hidden');
        successMsg.classList.remove('hidden');
    };
}

/**
 * UTILS
 */
function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    UI.timeDisplay.textContent = `${hours}:${minutes}`;

    if (hours === '00' && minutes === '00') store.clearAllSignIns();
    if (hours === '12' && minutes === '00') generateNoonReports();
}

function generateNoonReports() {
    const sites = store.getAllSites();
    sites.forEach(site => {
        const attendees = store.getSignInsForSite(site.id);
        console.log(`--- REPORT: ${site.name} ---`, attendees);
    });
}

// Initialize
window.addEventListener('hashchange', handleRouting);
handleRouting();
setInterval(updateClock, 1000);
updateClock();

/**
 * VISUAL & AESTHETIC UTILITIES
 */
function initTheme() {
    const savedTheme = localStorage.getItem('SITE_SECURE_THEME') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        const icon = document.querySelector('#theme-toggle-btn i');
        if (icon) icon.className = 'fas fa-moon';
    }

    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
        btn.onclick = () => {
            const isLight = document.body.classList.toggle('light-theme');
            localStorage.setItem('SITE_SECURE_THEME', isLight ? 'light' : 'dark');
            const icon = btn.querySelector('i');
            icon.className = isLight ? 'fas fa-moon' : 'fas fa-sun';
        };
    }
}

function updateDynamicFavicon(count) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Background Circle
    ctx.fillStyle = '#ffd700'; // electric-yellow
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#000';
    ctx.font = 'bold 36px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(count > 99 ? '99+' : count, 32, 32);

    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.href = canvas.toDataURL('image/png');
}

function playSuccessSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Short mechanical "beep/click"
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High A
        osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
        console.warn('AUDIO FEEDBACK BLOCKED BY BROWSER POLICY');
    }
}

function sendNotification(title, options) {
    if (Notification.permission === 'granted') {
        new Notification(title, options);
    } else {
        console.log('[NOTIFICATION BLOCKED]', title, options.body);
    }
}

// Initialize Visuals
updateDynamicFavicon(0);