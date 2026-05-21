/**
 * IT ADMIN MODULE - Dashboard, Supervisors, Sites Management
 * Extracted from app.js with enhancements.
 * References: store, UI, SoundEngine, Modal, currentUser
 */

/**
 * IT ADMIN DASHBOARD - Main entry with tabs
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

/**
 * IT OVERVIEW - Stats + Charts (Enhanced with 7-day line chart)
 */
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

        // --- CHART 1: Sign-ins per Site (Bar Chart) ---
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

        // --- CHART 2: Trade Distribution (Doughnut Chart) ---
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

        // --- ENHANCED CHART 3: Daily Sign-ins (Line Chart - Last 7 Days) ---
        const lineCtxEl = document.getElementById('daily-line-chart');
        if (lineCtxEl) {
            const lineCtx = lineCtxEl.getContext('2d');
            if (window.dailyLineChart) window.dailyLineChart.destroy();

            // Build last 7 days labels and data
            const last7Days = [];
            const last7Data = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                last7Days.push(d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
                last7Data.push(allSignIns.filter(s => s.timestamp && s.timestamp.startsWith(dateStr)).length);
            }

            window.dailyLineChart = new Chart(lineCtx, {
                type: 'line',
                data: {
                    labels: last7Days,
                    datasets: [{
                        label: 'DAILY SIGN-INS',
                        data: last7Data,
                        borderColor: '#4caf50',
                        backgroundColor: 'rgba(76, 175, 80, 0.15)',
                        borderWidth: 2,
                        pointBackgroundColor: '#4caf50',
                        pointBorderColor: '#fff',
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#aaa', stepSize: 1 } },
                        x: { grid: { display: false }, ticks: { color: '#aaa', font: { size: 10 } } }
                    },
                    plugins: {
                        legend: { display: true, labels: { color: '#aaa', font: { family: 'JetBrains Mono', size: 10 } } }
                    }
                }
            });
        }

        // --- Activity Feed ---
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

/**
 * IT SUPERVISORS - List with CRUD operations
 */
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
            const pwdVal = u.password || '******';
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
                    refreshITSites();
                } catch (err) {
                    SoundEngine.playAlarm();
                    Modal.alert('CREATION FAILED', err.message);
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

/**
 * IT SITES - All sites list with CRUD
 */
async function refreshITSites() {
    const list = document.getElementById('it-sites-list');
    list.innerHTML = '<tr><td colspan="4" style="text-align:center">RETRIEVING SITES...</td></tr>';
    
    try {
        const sites = await store.getAllSites();
        const users = await store.getAllUsers();
        
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
                    Modal.alert('MISSING FIELDS', 'ALL FIELDS ARE REQUIRED');
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
                    Modal.alert('CREATION FAILED', err.message);
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
 * GLOBAL WINDOW HANDLERS for IT Admin
 */
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
    Modal.prompt('CHANGE PASSWORD', 'ENTER NEW PASSWORD FOR THIS SUPERVISOR:', 'New password...', async (newPwd) => {
        try {
            await store.updateProfile(userId, { password: newPwd });
            SoundEngine.playSuccess();
            refreshITSupervisors();
        } catch (err) {
            SoundEngine.playAlarm();
            Modal.alert('ERROR', 'FAILED TO UPDATE PASSWORD: ' + err.message);
        }
    });
};

window.itDeleteUser = async (userId) => {
    Modal.confirm('DELETE SUPERVISOR', 'DELETE THIS SUPERVISOR? THIS WILL NOT DELETE THEIR ASSIGNED SITES.', async () => {
        const ok = await store.deleteUser(userId);
        if (ok) {
            SoundEngine.playSuccess();
            refreshITSupervisors();
            refreshITSites();
        } else {
            SoundEngine.playAlarm();
            Modal.alert('ERROR', 'FAILED TO DELETE USER');
        }
    });
};

window.itDeleteSite = async (siteId) => {
    Modal.confirm('DELETE SITE', 'DELETE THIS SITE? ALL WORKER SIGN-IN LOGS WILL BE REMOVED.', async () => {
        await store.deleteSite(siteId);
        SoundEngine.playSuccess();
        refreshITSites();
    });
};
