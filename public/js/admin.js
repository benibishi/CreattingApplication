/**
 * ADMIN MODULE - Site Management, Trades, Poster, Live Logs
 * Extracted from app.js with enhancements.
 * References: store, UI, SoundEngine, Modal, currentUser, I18n
 */

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
 * ADMIN DASHBOARD - MANAGED SITES VIEW
 */
async function renderAdminSites() {
    UI.render('tpl-admin-sites');
    initSiteAlerts();
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
    Modal.confirm('DELETE SITE', 'ARE YOU SURE YOU WANT TO DELETE THIS SITE? THIS ACTION CANNOT BE UNDONE.', async () => {
        await store.deleteSite(siteId);
        SoundEngine.playSuccess();
        renderAdminSites();
    });
};

/**
 * ADMIN SITE SETUP - Create new site with map/office upload
 */
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

        setupMapPin.style.left = `${x}%`;
        setupMapPin.style.top = `${y}%`;
        setupMapPin.classList.remove('hidden');

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

            SoundEngine.playSuccess();
            window.location.hash = '#admin-sites';
        } catch (err) {
            SoundEngine.playAlarm();
            Modal.alert('UPLOAD FAILED', err.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'GENERATE SITE ACCESS';
        }
    };
}

/**
 * ADMIN TRADES MANAGEMENT
 */
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
        Modal.confirm('DELETE TRADE', `DELETE TRADE: "${tradeName.toUpperCase()}"? THIS ACTION CANNOT BE UNDONE.`, async () => {
            const ok = await store.deleteTrade(tradeName);
            if (ok) {
                SoundEngine.playSuccess();
                renderAdminTrades();
            } else {
                SoundEngine.playAlarm();
                Modal.alert('ERROR', 'FAILED TO DELETE TRADE');
            }
        });
    };

    document.getElementById('add-trade-form').onsubmit = async (e) => {
        e.preventDefault();
        const nameInp = document.getElementById('new-trade-name');
        const name = nameInp.value.trim();
        if (name) {
            await store.addTrade(name);
            nameInp.value = '';
            SoundEngine.playSuccess();
            renderAdminTrades();
        }
    };
}

/**
 * POSTER VIEW - QR Code generation for site access
 */
async function renderPoster(siteId) {
    const site = await store.getSite(siteId);
    UI.render('tpl-poster');
    document.getElementById('poster-site-name').textContent = site.name;
    const url = `${window.location.origin}#${siteId}`;
    new QRCode(document.getElementById('qrcode-container'), { text: url, width: 256, height: 256 });

    const previewBtn = document.getElementById('preview-site');
    if (previewBtn) {
        previewBtn.onclick = () => {
            window.location.hash = `#${siteId}`;
        };
    }
}

/**
 * LIVE LOGS VIEW - Enhanced with search, dual counts, and Modal-based CSV export
 */
async function renderLiveLogs(siteId) {
    let logs = await store.getSignInsForSite(siteId);
    UI.render('tpl-live-logs');
    
    const list = document.getElementById('log-entries');
    const logCountEl = document.getElementById('log-count');

    // --- ENHANCED: Dual counts ---
    // Create count display elements if not in template
    const countContainer = logCountEl ? logCountEl.parentElement : null;
    let onSiteCountEl = document.getElementById('on-site-count');
    let totalTodayEl = document.getElementById('total-today-count');

    // Calculate today's logs
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = logs.filter(l => l.timestamp && l.timestamp.startsWith(today));

    // Get current on-site workers
    let onSiteWorkers = [];
    try {
        onSiteWorkers = await store.getOnSiteWorkers(siteId);
    } catch (e) {
        console.warn('[LIVE-LOGS] Could not fetch on-site workers:', e);
    }

    // Update counts - use existing element or inject enhanced counts
    if (logCountEl) {
        logCountEl.innerHTML = '';
        logCountEl.insertAdjacentHTML('beforeend', 
            `<span style="color: var(--primary-amber); font-weight: bold;">${Array.isArray(onSiteWorkers) ? onSiteWorkers.length : 0}</span> CURRENT ON SITE &nbsp;|&nbsp; <span style="color: var(--success-green, #4caf50); font-weight: bold;">${todayLogs.length}</span> TOTAL TODAY`
        );
    }

    // --- ENHANCED: Search input ---
    const searchContainer = document.createElement('div');
    searchContainer.style.cssText = 'margin-bottom: 1rem;';
    searchContainer.innerHTML = `
        <input type="text" id="log-search-input" class="rugged-input" 
               placeholder="SEARCH BY NAME OR COMPANY..." 
               style="width: 100%; font-size: 0.8rem;">
    `;
    // Insert search before the table
    const tableEl = list ? list.closest('table') : null;
    if (tableEl && tableEl.parentElement) {
        tableEl.parentElement.insertBefore(searchContainer, tableEl);
    }

    const updateLogDisplay = (data) => {
        list.innerHTML = '';
        data.forEach(l => {
            const row = document.createElement('tr');
            const status = l.status || 'checked_in';
            const statusBadge = status === 'checked_in' 
                ? '<span style="color:var(--success-green, #4caf50);font-size:0.7rem;"><i class="fas fa-circle"></i> ON SITE</span>'
                : '<span style="color:#888;font-size:0.7rem;"><i class="far fa-circle"></i> LEFT</span>';
            row.innerHTML = `<td>${l.first_name} ${l.last_name}</td><td>${l.company}</td><td>${new Date(l.timestamp).toLocaleTimeString()}</td><td>${statusBadge}</td>`;
            list.appendChild(row);
        });
    };

    updateLogDisplay(logs);

    // --- ENHANCED: Real-time search filter ---
    const searchInput = document.getElementById('log-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim().toLowerCase();
            if (!query) {
                updateLogDisplay(logs);
                return;
            }
            const filtered = logs.filter(l => {
                const fullName = `${l.first_name} ${l.last_name}`.toLowerCase();
                const company = (l.company || '').toLowerCase();
                return fullName.includes(query) || company.includes(query);
            });
            updateLogDisplay(filtered);
        });
    }

    // --- ENHANCED: CSV Export with Modal.dateRange ---
    const exportBtn = document.getElementById('export-csv-btn');
    if (exportBtn) {
        exportBtn.onclick = () => {
            if (logs.length === 0) {
                SoundEngine.playAlarm();
                Modal.alert('NO DATA', 'NO LOGS AVAILABLE TO EXPORT.');
                return;
            }

            Modal.dateRange('EXPORT CSV', 'SELECT DATE RANGE FOR EXPORT', ({ startDate, endDate }) => {
                let filteredLogs = logs;
                if (startDate) {
                    const start = new Date(startDate);
                    filteredLogs = filteredLogs.filter(l => new Date(l.timestamp) >= start);
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59);
                    filteredLogs = filteredLogs.filter(l => new Date(l.timestamp) <= end);
                }

                if (filteredLogs.length === 0) {
                    SoundEngine.playAlarm();
                    Modal.alert('NO DATA', 'NO LOGS FOUND FOR THIS DATE RANGE.');
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
            });
        };
    }
}
