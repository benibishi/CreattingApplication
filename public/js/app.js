/**
 * CORE APPLICATION — ROUTING & INITIALIZATION
 * All view rendering functions are in their respective modules:
 * auth.js, admin.js, itadmin.js, signin.js, incidents.js, profile.js
 */

const CONFIG = {
    CHECK_INTERVAL: 60000
};

let currentUser = null;
const socket = io();

// Real-time Event Handling
socket.on('new-signin', (data) => {
    console.log('[REAL-TIME] New Sign-in detected:', data);
    
    if (window.location.hash === '#it-admin') {
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab && activeTab.dataset.tab === 'it-overview') {
            refreshITOverview();
        }
    }
    
    if (window.location.hash === `#live-logs-${data.site_id}`) {
        renderLiveLogs(data.site_id);
    }

    SoundEngine.playSuccess();
});

socket.on('worker-checkout', (data) => {
    console.log('[REAL-TIME] Worker checkout:', data);
    const hash = window.location.hash;
    if (hash.startsWith('#live-logs-')) {
        const siteId = hash.replace('#live-logs-', '');
        renderLiveLogs(siteId);
    }
});

socket.on('new-issue', (data) => {
    console.log('[REAL-TIME] New issue reported:', data);
    SoundEngine.playAlarm();
});

socket.on('issue-updated', (data) => {
    console.log('[REAL-TIME] Issue updated:', data);
    const hash = window.location.hash;
    if (hash.startsWith('#incidents-')) {
        const siteId = hash.replace('#incidents-', '');
        renderIncidents(siteId);
    }
});

/**
 * AUTH LOGIC HELPER
 */
function setCurrentUser(user) {
    currentUser = user;
}

/**
 * UI CONTROLLER
 */
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
            this.loginNavBtn.textContent = I18n.t('login');
            this.loginNavBtn.onclick = () => {
                window.location.hash = '#admin-login';
            };
            this.profileNavBtn.classList.add('hidden');
        }
    }
};

/**
 * ROUTING LOGIC
 */
async function handleRouting() {
    const hash = window.location.hash;
    
    if (!store.initialized) {
        await store.init();
        store.initialized = true;
    }

    currentUser = await store.getCurrentSession();

    console.log('[ROUTING] HASH:', hash, '| USER:', currentUser ? currentUser.username : 'GUEST');
    
    try {
        if (hash.startsWith('#site-')) {
            const siteId = hash.substring(1);
            renderSignInFlow(siteId);
        } else if (hash.startsWith('#incidents-')) {
            const siteId = hash.replace('#incidents-', '');
            renderIncidents(siteId);
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
        } else if (hash === '#admin-incidents') {
            if (!currentUser) return window.location.hash = '#admin-login';
            renderAdminIncidents();
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
    } catch (err) {
        console.error('[ROUTING] Error rendering view:', err);
        UI.container.innerHTML = `
            <section class="view">
                <div class="rugged-card" style="text-align: center;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2.5rem; color: var(--hazard-red); margin-bottom: 1rem;"></i>
                    <h3 style="margin-bottom: 1rem;">SOMETHING WENT WRONG</h3>
                    <p style="color: var(--label-color); margin-bottom: 1.5rem;">${err.message || 'An unexpected error occurred'}</p>
                    <button class="rugged-button primary" onclick="window.location.hash='#home'">GO HOME</button>
                </div>
            </section>
        `;
    }
    UI.updateNav();
}

/**
 * ADMIN INCIDENTS VIEW
 */
async function renderAdminIncidents() {
    UI.render('tpl-admin-incidents');
    const select = document.getElementById('incident-site-select');
    const listContainer = document.getElementById('admin-incidents-list');
    
    try {
        const sites = await store.getSitesForUser(currentUser.id);
        sites.forEach(site => {
            const opt = document.createElement('option');
            opt.value = site.id;
            opt.textContent = site.name.toUpperCase();
            select.appendChild(opt);
        });
        
        select.onchange = async () => {
            const siteId = select.value;
            if (!siteId) return;
            
            const issues = await store.getIssues(siteId);
            listContainer.innerHTML = '';
            
            if (issues.length === 0) {
                listContainer.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle" style="font-size:2rem;color:var(--success-green);"></i><p style="margin-top:1rem;">NO INCIDENTS FOR THIS SITE</p></div>';
                return;
            }
            
            issues.forEach(issue => {
                const card = document.createElement('div');
                card.className = 'incident-card';
                card.innerHTML = `
                    <div class="incident-header">
                        <span class="severity-badge severity-${issue.severity}">${(issue.severity || 'medium').toUpperCase()}</span>
                        <span class="incident-status status-${issue.status}">${(issue.status || 'open').toUpperCase().replace('_', ' ')}</span>
                    </div>
                    <p class="incident-desc">${issue.description}</p>
                    <div class="incident-meta">
                        <span><i class="fas fa-user"></i> ${issue.reported_by_name || 'Anonymous'}</span>
                        <span><i class="fas fa-clock"></i> ${new Date(issue.created_at).toLocaleString()}</span>
                    </div>
                    ${issue.status !== 'resolved' && issue.status !== 'closed' ?
                        `<button class="rugged-button small primary" onclick="resolveIncident('${issue.id}')">RESOLVE</button>` :
                        '<span style="color:var(--success-green);font-size:0.75rem;"><i class="fas fa-check"></i> RESOLVED</span>'
                    }
                `;
                listContainer.appendChild(card);
            });
        };
    } catch (err) {
        listContainer.innerHTML = `<div class="empty-state"><p style="color:var(--hazard-red);">ERROR: ${err.message}</p></div>`;
    }
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
 * GLOBAL NAVIGATION
 */
window.goBackToDashboard = () => {
    if (currentUser) {
        window.location.hash = currentUser.role === 'it-admin' ? '#it-admin' : '#admin-sites';
    } else {
        window.location.hash = '#admin-login';
    }
};

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
    UI.timeDisplay.textContent = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
}

/**
 * OFFLINE DETECTION
 */
function updateOnlineStatus() {
    const banner = document.getElementById('offline-banner');
    if (banner) {
        if (!navigator.onLine) {
            banner.classList.add('visible');
        } else {
            banner.classList.remove('visible');
            // Sync any queued offline sign-ins
            const queue = JSON.parse(localStorage.getItem('OFFLINE_SIGNIN_QUEUE') || '[]');
            if (queue.length > 0 && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'SYNC_OFFLINE',
                    queue: queue
                });
                localStorage.removeItem('OFFLINE_SIGNIN_QUEUE');
                console.log(`[OFFLINE] Synced ${queue.length} queued sign-ins`);
            }
        }
    }
}

// Listen for offline sign-in queue messages from service worker
if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'OFFLINE_QUEUE') {
            const queue = JSON.parse(localStorage.getItem('OFFLINE_SIGNIN_QUEUE') || '[]');
            queue.push(event.data.data);
            localStorage.setItem('OFFLINE_SIGNIN_QUEUE', JSON.stringify(queue));
            console.log('[OFFLINE] Queued sign-in for later sync');
        }
    });
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

/**
 * LANGUAGE SELECTOR
 */
function initLanguageSelector() {
    const selector = document.getElementById('lang-selector');
    if (selector) {
        selector.value = I18n.currentLang;
        selector.onchange = () => {
            I18n.setLanguage(selector.value);
            SoundEngine.playClick();
            // Re-render current view
            handleRouting();
        };
    }
}

/**
 * INITIALIZATION
 */
I18n.init();
ThemeManager.init();
initLanguageSelector();
window.addEventListener('hashchange', handleRouting);

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('[PWA] Service Worker Registered', reg.scope))
            .catch(err => console.error('[PWA] Service Worker Failed', err));
    });
}

handleRouting();
setInterval(updateClock, 1000);
updateClock();
updateOnlineStatus();
