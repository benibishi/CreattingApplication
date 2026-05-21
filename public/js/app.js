/**
 * CORE APPLICATION LOGIC (SUPABASE VERSION)
 */

const CONFIG = {
    CHECK_INTERVAL: 60000 
};

let currentUser = null;

/**
 * SOUND ENGINE (WEB AUDIO API SYNTHESIZER)
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

/**
 * THEME MANAGER
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

// Global mechanical tap sound player for all interactables
document.addEventListener('click', (e) => {
    const target = e.target.closest('button, .tab-btn, select, option, .theme-dot, a');
    if (target && !target.closest('#sound-toggle-btn')) {
        SoundEngine.playClick();
    }
});

const UI = {
    container: document.getElementById('view-container'),
    timeDisplay: document.getElementById('current-time'),
    loginNavBtn: document.getElementById('nav-login-btn'),
    profileNavBtn: document.getElementById('nav-profile-btn'),
    
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

        if (currentUser) {
            this.loginNavBtn.textContent = `LOGOUT (${currentUser.username})`;
            this.loginNavBtn.onclick = async () => {
                await store.logout();
                setCurrentUser(null);
                window.location.hash = '#admin-login';
                this.updateNav();
            };
            
            this.profileNavBtn.classList.remove('hidden');
            this.profileNavBtn.onclick = () => {
                window.location.hash = '#profile';
            };
        } else {
            this.loginNavBtn.textContent = 'LOGIN';
            this.loginNavBtn.onclick = () => {
                window.location.hash = '#admin-login';
            };
            this.profileNavBtn.classList.add('hidden');
        }
    }
};

/**
 * AUTH LOGIC HELPER
 */
function setCurrentUser(user) {
    currentUser = user;
}

/**
 * ROUTING LOGIC
 */
async function handleRouting() {
    const hash = window.location.hash;
    
    // Ensure store is initialized (knows its mode)
    if (!store.initialized) {
        await store.init();
        store.initialized = true;
    }

    // Sync session on every route change
    currentUser = await store.getCurrentSession();

    console.log('[ROUTING] HASH:', hash, '| USER:', currentUser ? currentUser.username : 'GUEST');
    
    if (hash.startsWith('#site-')) {
        const siteId = hash.substring(1);
        renderSignInFlow(siteId);
    } else if (hash === '#admin-sites') {
        if (!currentUser) return window.location.hash = '#admin-login';
        if (currentUser.role === 'it-admin') return window.location.hash = '#it-admin';
        renderAdminSites();
    } else if (hash === '#it-admin') {
        if (!currentUser || currentUser.role !== 'it-admin') return window.location.hash = '#admin-login';
        renderITAdmin();
    } else if (hash === '#admin-setup') {
        if (!currentUser) return window.location.hash = '#admin-login';
        renderAdminSetup();
    } else if (hash === '#admin-trades') {
        if (!currentUser) return window.location.hash = '#admin-login';
        renderAdminTrades();
    } else if (hash === '#profile') {
        if (!currentUser) return window.location.hash = '#admin-login';
        renderProfile();
    } else if (hash === '#admin-login' || hash === '#admin-register') {
        if (currentUser) return window.location.hash = currentUser.role === 'it-admin' ? '#it-admin' : '#admin-sites';
        hash === '#admin-login' ? renderAdminLogin() : renderAdminRegister();
    } else if (hash.startsWith('#live-logs-')) {
        const siteId = hash.replace('#live-logs-', '');
        renderLiveLogs(siteId);
    } else if (hash.startsWith('#poster-')) {
        const siteId = hash.replace('#poster-', '');
        renderPoster(siteId);
    } else if (hash === '#home' || !hash) {
        renderHome();
    } else {
        window.location.hash = '#home';
    }
    UI.updateNav();
}

/**
 * HOME VIEW
 */
function renderHome() {
    UI.render('tpl-home');
    const loginBtn = document.getElementById('home-login-btn');
    if (loginBtn) {
        loginBtn.onclick = () => window.location.hash = '#admin-login';
    }
}

/**
 * IT ADMIN DASHBOARD
 */
async function renderITAdmin() {
    UI.render('tpl-it-admin');
    
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.add('hidden'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.remove('hidden');
        };
    });

    refreshITOverview();
    refreshITSupervisors();
    refreshITSites();
}

async function refreshITOverview() {
    try {
        const sites = await store.getAllSites();
        const allSignIns = await store.getAllSignIns();
        const users = await store.getAllUsers();
        const supervisors = users.filter(u => u.role === 'supervisor');
        
        const today = new Date().toISOString().split('T')[0];
        const todaySignIns = allSignIns.filter(s => s.timestamp.startsWith(today));

        document.getElementById('stat-total-sites').textContent = sites.length;
        document.getElementById('stat-today-signins').textContent = todaySignIns.length;
        document.getElementById('stat-total-users').textContent = supervisors.length;

        // --- RENDER CHARTS ---
        
        // 1. Sign-ins per Site (Bar Chart)
        const siteLabels = sites.map(s => s.name);
        const siteData = sites.map(site => allSignIns.filter(log => log.site_id === site.id).length);

        const barCtx = document.getElementById('sites-bar-chart').getContext('2d');
        if (window.siteBarChart) window.siteBarChart.destroy();
        window.siteBarChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: siteLabels,
                datasets: [{
                    label: 'TOTAL SIGN-INS',
                    data: siteData,
                    backgroundColor: 'rgba(255, 174, 0, 0.6)',
                    borderColor: 'rgba(255, 174, 0, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#aaa' } },
                    x: { grid: { display: false }, ticks: { color: '#aaa' } }
                },
                plugins: { legend: { display: false } }
            }
        });

        // 2. Trade Distribution (Pie Chart)
        const tradeCounts = {};
        allSignIns.forEach(log => {
            tradeCounts[log.trade_type] = (tradeCounts[log.trade_type] || 0) + 1;
        });

        const pieCtx = document.getElementById('trades-pie-chart').getContext('2d');
        if (window.tradePieChart) window.tradePieChart.destroy();
        window.tradePieChart = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(tradeCounts),
                datasets: [{
                    data: Object.values(tradeCounts),
                    backgroundColor: [
                        '#ffae00', '#ff6f00', '#ffeb3b', '#4caf50', '#2196f3', '#9c27b0', '#f44336', '#009688'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: '#aaa', font: { family: 'JetBrains Mono', size: 10 } } }
                }
            }
        });

        const feed = document.getElementById('global-activity-feed');
        feed.innerHTML = '';
        
        const recent = [...allSignIns].slice(0, 20);
        recent.forEach(s => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${s.sites ? s.sites.name : 'N/A'}</td>
                <td>${s.first_name} ${s.last_name}</td>
                <td>${s.company}</td>
                <td>${new Date(s.timestamp).toLocaleTimeString()}</td>
            `;
            feed.appendChild(row);
        });
    } catch (err) {
        console.error('Error refreshing IT overview:', err);
    }
}

async function refreshITSupervisors() {
    const list = document.getElementById('it-users-list');
    list.innerHTML = '<tr><td colspan="4" style="text-align:center">RETRIEVING SUPERVISORS...</td></tr>';
    
    try {
        const users = await store.getAllUsers();
        const supervisors = users.filter(u => u.role === 'supervisor');
        list.innerHTML = '';
        
        if (supervisors.length === 0) {
            list.innerHTML = '<tr><td colspan="4" style="text-align:center">NO SUPERVISORS FOUND</td></tr>';
            return;
        }
        
        supervisors.forEach(u => {
            const row = document.createElement('tr');
            const pwdVal = u.password || '******'; // Fallback for Supabase or missing data
            row.innerHTML = `
                <td><strong>${u.username.toUpperCase()}</strong> (${u.full_name})<br><small style="color: #888;">${u.email}</small></td>
                <td>
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <input type="password" value="${pwdVal}" readonly class="rugged-input small" style="width: 100px; padding: 2px 5px; font-size: 0.7rem;" id="pwd-${u.id}">
                        <button class="rugged-button secondary small" style="margin: 0; width: auto; font-size: 0.6rem; padding: 2px 5px;" onclick="itTogglePwd('${u.id}')">SHOW</button>
                    </div>
                </td>
                <td>${new Date(u.created_at).toLocaleDateString()}</td>
                <td>
                    <div style="display: flex; gap: 5px;">
                        <button class="rugged-button primary small" style="margin: 0;" onclick="itChangePassword('${u.id}')">EDIT PWD</button>
                        <button class="rugged-button hazard-btn small" style="margin: 0;" onclick="itDeleteUser('${u.id}')">DELETE</button>
                    </div>
                </td>
            `;
            list.appendChild(row);
        });

        window.itTogglePwd = (userId) => {
            const input = document.getElementById(`pwd-${userId}`);
            const btn = event.target;
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = 'HIDE';
            } else {
                input.type = 'password';
                btn.textContent = 'SHOW';
            }
        };

        window.itChangePassword = async (userId) => {
            const newPwd = prompt("ENTER NEW PASSWORD FOR THIS SUPERVISOR:");
            if (newPwd) {
                try {
                    await store.updateProfile(userId, { password: newPwd });
                    SoundEngine.playSuccess();
                    refreshITSupervisors();
                } catch (err) {
                    SoundEngine.playAlarm();
                    alert("FAILED TO UPDATE PASSWORD: " + err.message);
                }
            }
        };

        window.itDeleteUser = async (userId) => {
            if (confirm("DELETE THIS SUPERVISOR? THIS WILL NOT DELETE THEIR ASSIGNED SITES.")) {
                const ok = await store.deleteUser(userId);
                if (ok) {
                    SoundEngine.playSuccess();
                    refreshITSupervisors();
                    refreshITSites();
                } else {
                    SoundEngine.playAlarm();
                    alert("FAILED TO DELETE USER");
                }
            }
        };

        // Setup supervisor creation form listener
        const userForm = document.getElementById('it-user-create-form');
        if (userForm) {
            userForm.onsubmit = async (e) => {
                e.preventDefault();
                const fullName = document.getElementById('it-reg-fullname').value;
                const email = document.getElementById('it-reg-email').value;
                const username = document.getElementById('it-reg-username').value;
                const password = document.getElementById('it-reg-password').value;

                const submitBtn = userForm.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.textContent = 'CREATING...';

                try {
                    await store.register(email, password, fullName, username);
                    SoundEngine.playSuccess();
                    userForm.reset();
                    refreshITSupervisors();
                    refreshITSites(); // To update supervisor dropdown
                } catch (err) {
                    SoundEngine.playAlarm();
                    alert("CREATION FAILED: " + err.message);
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'CREATE SUPERVISOR';
                }
            };
        }
    } catch (err) {
        list.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--hazard-red)">ERROR: ${err.message.toUpperCase()}</td></tr>`;
    }
}

async function refreshITSites() {
    const list = document.getElementById('it-sites-list');
    list.innerHTML = '<tr><td colspan="4" style="text-align:center">RETRIEVING SITES...</td></tr>';
    
    try {
        const sites = await store.getAllSites();
        const users = await store.getAllUsers();
        
        // Build user map for easy owner name display
        const userMap = {};
        users.forEach(u => {
            userMap[u.id] = `${u.full_name} (${u.username})`;
        });
        
        list.innerHTML = '';
        
        if (sites.length === 0) {
            list.innerHTML = '<tr><td colspan="4" style="text-align:center">NO SITES FOUND</td></tr>';
        } else {
            sites.forEach(site => {
                const row = document.createElement('tr');
                const ownerDisplay = userMap[site.owner_id] || site.owner_id;
                row.innerHTML = `
                    <td><strong>${site.name}</strong><br><small style="color: #888;">${site.email}</small></td>
                    <td>${ownerDisplay}</td>
                    <td>${new Date(site.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="rugged-button hazard-btn small" style="margin-bottom: 0;" onclick="itDeleteSite('${site.id}')">DELETE SITE</button>
                    </td>
                `;
                list.appendChild(row);
            });
        }

        window.itDeleteSite = async (siteId) => {
            if (confirm("DELETE THIS SITE? ALL WORKER SIGN-IN LOGS WILL BE REMOVED.")) {
                await store.deleteSite(siteId);
                SoundEngine.playSuccess();
                refreshITSites();
            }
        };

        // Populate the Supervisor dropdown for site creation
        const ownerSelect = document.getElementById('it-site-owner');
        if (ownerSelect) {
            ownerSelect.innerHTML = '<option value="" disabled selected>-- SELECT SUPERVISOR --</option>';
            const supervisors = users.filter(u => u.role === 'supervisor');
            supervisors.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.id;
                opt.textContent = `${u.full_name} (${u.username})`;
                ownerSelect.appendChild(opt);
            });
        }

        // Setup site creation form listener
        const form = document.getElementById('it-site-create-form');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const ownerId = document.getElementById('it-site-owner').value;
                const name = document.getElementById('it-site-name').value;
                const email = document.getElementById('it-site-email').value;

                if (!ownerId || !name || !email) {
                    SoundEngine.playAlarm();
                    alert("ALL FIELDS ARE REQUIRED");
                    return;
                }

                const submitBtn = form.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.textContent = 'CREATING...';

                try {
                    await store.createSite({
                        name,
                        email,
                        map: null,
                        office: null
                    }, ownerId);

                    SoundEngine.playSuccess();
                    form.reset();
                    refreshITSites();
                } catch (err) {
                    SoundEngine.playAlarm();
                    alert("CREATION FAILED: " + err.message);
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'CREATE SITE';
                }
            };
        }
    } catch (err) {
        list.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--hazard-red)">ERROR: ${err.message.toUpperCase()}</td></tr>`;
    }
}

/**
 * AUTH VIEWS
 */
function renderAdminLogin() {
    UI.render('tpl-admin-pin');
    const form = document.getElementById('admin-login-form');
    const userInp = document.getElementById('admin-user-input');
    const pinInp = document.getElementById('admin-pin-input');
    const loginBtn = document.getElementById('admin-login-btn');
    const goToRegBtn = document.getElementById('go-to-register-btn');
    const pinToggleBtn = document.getElementById('pin-toggle-btn');
    const error = document.getElementById('auth-error');

    // Navigation to Register
    if (goToRegBtn) {
        goToRegBtn.onclick = () => window.location.hash = '#admin-register';
    }

    // PIN Toggle logic
    if (pinToggleBtn) {
        pinToggleBtn.onclick = () => {
            const isPassword = pinInp.type === 'password';
            pinInp.type = isPassword ? 'text' : 'password';
            pinToggleBtn.textContent = isPassword ? 'HIDE' : 'SHOW';
        };
    }

    form.onsubmit = async (e) => {
        e.preventDefault();
        try {
            loginBtn.disabled = true;
            loginBtn.textContent = 'AUTHENTICATING...';
            const user = await store.login(userInp.value, pinInp.value);
            setCurrentUser(user);
            window.location.hash = '#admin-sites';
        } catch (err) {
            error.textContent = err.message.toUpperCase();
            error.classList.remove('hidden');
            loginBtn.disabled = false;
            loginBtn.textContent = 'SIGN IN';
        }
    };
}

function renderAdminRegister() {
    UI.render('tpl-admin-register');
    const fullNameInp = document.getElementById('reg-fullname');
    const emailInp = document.getElementById('reg-email');
    const usernameInp = document.getElementById('reg-username');
    const passInp = document.getElementById('reg-password');
    const regBtn = document.getElementById('admin-register-btn');
    const backBtn = document.getElementById('back-to-login-btn');
    const regError = document.getElementById('reg-error');

    // Navigation back to Login
    if (backBtn) {
        backBtn.onclick = () => window.location.hash = '#admin-login';
    }

    regBtn.onclick = async () => {
        if (regError) {
            regError.classList.add('hidden');
        }
        
        const fullName = (fullNameInp.value || '').trim();
        const email = (emailInp.value || '').trim();
        const username = (usernameInp.value || '').trim();
        const password = passInp.value;

        if (!fullName || !email || !password) {
            SoundEngine.playAlarm();
            if (regError) {
                regError.textContent = 'FULL NAME, EMAIL, AND PASSWORD ARE REQUIRED';
                regError.classList.remove('hidden');
            }
            return;
        }

        try {
            regBtn.disabled = true;
            regBtn.textContent = 'CREATING ACCOUNT...';
            
            const regResult = await store.register(email, password, fullName, username);
            
            // Auto login after successful registration
            let loggedInUser;
            if (store.mode === 'supabase') {
                loggedInUser = await store.login(email, password);
            } else {
                const userObj = regResult.user;
                loggedInUser = {
                    id: userObj.id,
                    username: userObj.username || userObj.email.split('@')[0],
                    email: userObj.email,
                    role: userObj.role
                };
                sessionStorage.setItem('SITE_SECURE_USER', JSON.stringify(loggedInUser));
            }
            
            setCurrentUser(loggedInUser);
            SoundEngine.playSuccess();
            window.location.hash = '#admin-sites';
        } catch (err) {
            SoundEngine.playAlarm();
            const errMsg = err.message.toUpperCase();
            if (regError) {
                regError.textContent = errMsg;
                regError.classList.remove('hidden');
            } else {
                alert(errMsg);
            }
            regBtn.disabled = false;
            regBtn.textContent = 'REGISTER & SIGN IN';
        }
    };
}

/**
 * PROFILE VIEW
 */
async function renderProfile() {
    UI.render('tpl-profile');
    const form = document.getElementById('profile-form');
    const fullNameInp = document.getElementById('profile-fullname');
    const usernameInp = document.getElementById('profile-username');
    const emailInp = document.getElementById('profile-email');
    const passInp = document.getElementById('profile-password');
    const roleInp = document.getElementById('profile-role');
    const msg = document.getElementById('profile-msg');
    const err = document.getElementById('profile-error');

    // Populate current data
    if (!currentUser) {
        window.location.hash = '#admin-login';
        return;
    }

    // Display basic info from session first
    fullNameInp.value = currentUser.full_name || '';
    usernameInp.value = currentUser.username || '';
    emailInp.value = currentUser.email || '';
    roleInp.value = (currentUser.role || 'supervisor').toUpperCase();

    // If IT Admin, we can try to get more detailed info, but it's optional
    if (currentUser.role === 'it-admin') {
        try {
            const users = await store.getAllUsers();
            const fullUser = users.find(u => u.id === currentUser.id);
            if (fullUser) {
                fullNameInp.value = fullUser.full_name;
                usernameInp.value = fullUser.username;
                emailInp.value = fullUser.email;
                roleInp.value = fullUser.role.toUpperCase();
            }
        } catch (e) {
            console.error('Optional profile data fetch failed:', e);
        }
    }

    form.onsubmit = async (e) => {
        e.preventDefault();
        msg.classList.add('hidden');
        err.classList.add('hidden');

        try {
            const updates = {
                full_name: fullNameInp.value
            };
            if (passInp.value) updates.password = passInp.value;

            await store.updateProfile(currentUser.id, updates);
            
            // Update local session
            currentUser.full_name = updates.full_name;
            if (store.mode === 'local') {
                sessionStorage.setItem('SITE_SECURE_USER', JSON.stringify(currentUser));
            }

            SoundEngine.playSuccess();
            msg.classList.remove('hidden');
            passInp.value = '';
        } catch (e) {
            SoundEngine.playAlarm();
            err.textContent = 'ERROR: ' + e.message.toUpperCase();
            err.classList.remove('hidden');
        }
    };
}

/**
 * SITE ALERTS LOGIC
 */
async function initSiteAlerts() {
    const btn = document.getElementById('enable-notifications-btn');
    if (!btn) return;

    let enabled = await store.getNotificationStatus(currentUser.id);
    updateAlertsBtn(btn, enabled);

    btn.onclick = async () => {
        enabled = !enabled;
        await store.setNotificationStatus(currentUser.id, enabled);
        updateAlertsBtn(btn, enabled);
        SoundEngine.playSuccess();
        
        if (enabled) {
            // Request browser notification permission
            if ("Notification" in window) {
                const permission = await Notification.requestPermission();
                if (permission === "granted") {
                    new Notification("SITE ALERTS ENABLED", {
                        body: "You will receive notifications when workers sign into your sites.",
                        icon: "/favicon.ico"
                    });
                }
            }
        }
    };
}

function updateAlertsBtn(btn, enabled) {
    if (enabled) {
        btn.innerHTML = '<i class="fas fa-bell-slash"></i> DISABLE SITE ALERTS';
        btn.classList.remove('primary');
        btn.classList.add('hazard-btn');
    } else {
        btn.innerHTML = '<i class="fas fa-bell"></i> ENABLE SITE ALERTS';
        btn.classList.remove('hazard-btn');
        btn.classList.add('primary');
    }
}

/**
 * ADMIN DASHBOARD VIEWS
 */
async function renderAdminSites() {
    UI.render('tpl-admin-sites');
    initSiteAlerts(); // Initialize alerts button
    const sitesList = document.getElementById('active-sites-list');
    
    const sites = await store.getSitesForUser(currentUser.id);
    sitesList.innerHTML = '';
    
    if (sites.length === 0) {
        sitesList.innerHTML = '<div class="rugged-card warning">NO SITES FOUND</div>';
        return;
    }

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
                <button class="rugged-button hazard-btn small" style="grid-column: span 2" onclick="confirmDeleteSite('${site.id}')">DELETE</button>
            </div>
        `;
        sitesList.appendChild(div);
    });
}

window.confirmDeleteSite = async (siteId) => {
    if (confirm("DELETE THIS SITE?")) {
        await store.deleteSite(siteId);
        renderAdminSites();
    }
};

async function renderAdminSetup() {
    UI.render('tpl-admin-setup');
    const form = document.getElementById('site-setup-form');

    const mapInput = document.getElementById('site-map');
    const officeInput = document.getElementById('site-office-photo');
    const pinningSection = document.getElementById('map-pinning-section');
    const setupMapImg = document.getElementById('setup-map-image');
    const setupMapWrapper = document.getElementById('setup-map-wrapper');
    const setupMapPin = document.getElementById('setup-map-pin');
    const pinXInput = document.getElementById('setup-map-pin-x');
    const pinYInput = document.getElementById('setup-map-pin-y');

    let localMapBase64 = null;

    // Show preview when site map file is selected
    mapInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            localMapBase64 = await toBase64(file);
            setupMapImg.src = localMapBase64;
            pinningSection.classList.remove('hidden');
            
            // Set file pill details
            const pill = document.getElementById('site-map-preview');
            if (pill) {
                pill.querySelector('.pill-text').textContent = file.name;
                pill.classList.remove('hidden');
            }
        }
    });

    // Handle office photo file input visual pill
    officeInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const pill = document.getElementById('site-office-preview');
            if (pill) {
                pill.querySelector('.pill-text').textContent = file.name;
                pill.classList.remove('hidden');
            }
        }
    });

    // Handle map click to pin orientation office
    setupMapWrapper.addEventListener('click', (e) => {
        const rect = setupMapWrapper.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        // Position the pin
        setupMapPin.style.left = `${x}%`;
        setupMapPin.style.top = `${y}%`;
        setupMapPin.classList.remove('hidden');

        // Store coordinates
        pinXInput.value = x.toFixed(2);
        pinYInput.value = y.toFixed(2);
    });

    form.onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'UPLOADING TO CLOUD...';

        try {
            const mapBase64 = localMapBase64 || await toBase64(mapInput.files[0]);
            const officeBase64 = await toBase64(officeInput.files[0]);

            await store.createSite({
                name: document.getElementById('site-name').value,
                email: document.getElementById('site-email').value,
                map: mapBase64,
                office: officeBase64,
                map_pin_x: pinXInput.value || null,
                map_pin_y: pinYInput.value || null
            }, currentUser.id);

            window.location.hash = '#admin-sites';
        } catch (err) {
            alert("UPLOAD FAILED: " + err.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'GENERATE SITE ACCESS';
        }
    };
}

async function renderAdminTrades() {
    UI.render('tpl-admin-trades');
    const list = document.getElementById('trades-list');
    const trades = await store.getTrades();
    
    list.innerHTML = trades.map(t => `
        <div class="site-mini-card" style="display:flex; justify-content:center; align-items:center; padding: 25px 15px; text-align: center;">
            <strong style="font-size: 0.9rem; letter-spacing: 1px;">${t.toUpperCase()}</strong>
            <button class="delete-corner-btn" title="DELETE TRADE" onclick="confirmDeleteTrade('${t}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');

    window.confirmDeleteTrade = async (tradeName) => {
        if (confirm(`DELETE TRADE: "${tradeName.toUpperCase()}"?`)) {
            const ok = await store.deleteTrade(tradeName);
            if (ok) {
                SoundEngine.playSuccess();
                renderAdminTrades();
            } else {
                SoundEngine.playAlarm();
                alert("FAILED TO DELETE TRADE");
            }
        }
    };

    document.getElementById('add-trade-form').onsubmit = async (e) => {
        e.preventDefault();
        const nameInp = document.getElementById('new-trade-name');
        const name = nameInp.value.trim();
        if (name) {
            await store.addTrade(name);
            nameInp.value = '';
            renderAdminTrades();
        }
    };
}

/**
 * SIGN-IN FLOW
 */
async function renderSignInFlow(siteId) {
    const site = await store.getSite(siteId);
    if (!site) return UI.container.innerHTML = 'INVALID SITE';

    UI.render('tpl-signin');
    document.getElementById('signin-site-name').textContent = site.name;

    // Load trades
    const trades = await store.getTrades();
    const tradeSelect = document.getElementById('trade-type');
    tradeSelect.innerHTML = trades.map(t => `<option value="${t}">${t}</option>`).join('');

    const form = document.getElementById('signin-form');
    const choiceBtns = document.querySelectorAll('.choice-btn');
    
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
                document.getElementById('submit-signin').classList.remove('hidden');
            }
        };
    });

    form.onsubmit = async (e) => {
        e.preventDefault();
        await store.recordSignIn(siteId, {
            firstName: document.getElementById('fname').value,
            lastName: document.getElementById('lname').value,
            company: document.getElementById('company').value,
            tradeType: document.getElementById('trade-type').value
        });
        
        SoundEngine.playSuccess();
        
        document.getElementById('signin-form-container').classList.add('hidden');
        document.getElementById('success-msg').classList.remove('hidden');
        document.getElementById('summary-name').textContent = document.getElementById('fname').value;
    };
}

async function renderLiveLogs(siteId) {
    let logs = await store.getSignInsForSite(siteId);
    UI.render('tpl-live-logs');
    
    const list = document.getElementById('log-entries');
    const updateLogDisplay = (data) => {
        document.getElementById('log-count').textContent = data.length;
        list.innerHTML = '';
        data.forEach(l => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${l.first_name} ${l.last_name}</td><td>${l.company}</td><td>${new Date(l.timestamp).toLocaleTimeString()}</td>`;
            list.appendChild(row);
        });
    };

    updateLogDisplay(logs);

    // Handle CSV Export
    const exportBtn = document.getElementById('export-csv-btn');
    if (exportBtn) {
        exportBtn.onclick = () => {
            if (logs.length === 0) {
                SoundEngine.playAlarm();
                return;
            }

            // Simple Date Filter Prompt
            const startDateStr = prompt("ENTER START DATE (YYYY-MM-DD) OR LEAVE BLANK FOR ALL:", "");
            const endDateStr = prompt("ENTER END DATE (YYYY-MM-DD) OR LEAVE BLANK FOR ALL:", "");

            let filteredLogs = logs;
            if (startDateStr) {
                const start = new Date(startDateStr);
                filteredLogs = filteredLogs.filter(l => new Date(l.timestamp) >= start);
            }
            if (endDateStr) {
                const end = new Date(endDateStr);
                end.setHours(23, 59, 59); // End of the day
                filteredLogs = filteredLogs.filter(l => new Date(l.timestamp) <= end);
            }

            if (filteredLogs.length === 0) {
                alert("NO LOGS FOUND FOR THIS DATE RANGE");
                return;
            }

            const csvRows = [
                ['Full Name', 'Company', 'Trade', 'Time', 'Date'],
                ...filteredLogs.map(l => [
                    `${l.first_name} ${l.last_name}`, 
                    l.company, 
                    l.trade_type,
                    new Date(l.timestamp).toLocaleTimeString(),
                    new Date(l.timestamp).toLocaleDateString()
                ])
            ];
            const csvContent = "data:text/csv;charset=utf-8," 
                + csvRows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
            
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `headcount_${siteId}_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            SoundEngine.playSuccess();
        };
    }
}

async function renderPoster(siteId) {
    const site = await store.getSite(siteId);
    UI.render('tpl-poster');
    document.getElementById('poster-site-name').textContent = site.name;
    const url = `${window.location.origin}#${siteId}`;
    new QRCode(document.getElementById('qrcode-container'), { text: url, width: 256, height: 256 });

    // Handle preview-site button click
    const previewBtn = document.getElementById('preview-site');
    if (previewBtn) {
        previewBtn.onclick = () => {
            window.location.hash = `#${siteId}`;
        };
    }
}

// Define global function to go back to correct dashboard
window.goBackToDashboard = () => {
    if (currentUser) {
        window.location.hash = currentUser.role === 'it-admin' ? '#it-admin' : '#admin-sites';
    } else {
        window.location.hash = '#admin-login';
    }
};

function renderSetupRequired() {
    UI.container.innerHTML = '<section class="view"><h2 class="section-title">SYSTEM READY</h2><div class="rugged-card warning"><p>NO SITES FOUND. PLEASE LOG IN AS SUPERVISOR.</p><button onclick="window.location.hash=\'#admin-login\'" class="rugged-button primary">LOGIN</button></div></section>';
}

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
 * UTILS
 */
function toBase64(file, maxWidth = 800) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
                } else {
                    if (height > maxWidth) { width *= maxWidth / height; height = maxWidth; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

function updateClock() {
    const now = new Date();
    UI.timeDisplay.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// Initialize
ThemeManager.init();
window.addEventListener('hashchange', handleRouting);
handleRouting();
setInterval(updateClock, 1000);
updateClock();
