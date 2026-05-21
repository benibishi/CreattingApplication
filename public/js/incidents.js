/**
 * SAFETY INCIDENT REPORTING MODULE
 * Brand new module for construction site incident management.
 * References: store, UI, SoundEngine, Modal, currentUser
 */

/**
 * Render the incidents view for a site
 * Shows list of incidents with severity badges and status,
 * form to submit new incidents, and resolve button for open ones.
 */
async function renderIncidents(siteId) {
    UI.render('tpl-incidents');
    const site = await store.getSite(siteId);
    document.getElementById('incidents-site-name').textContent = site ? site.name : 'SITE';
    
    const issues = await store.getIssues(siteId);
    const list = document.getElementById('incidents-list');
    const openCount = document.getElementById('incidents-open-count');
    const openIssues = issues.filter(i => i.status === 'open' || i.status === 'in_progress');
    openCount.textContent = openIssues.length;
    
    list.innerHTML = '';
    if (issues.length === 0) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle" style="font-size:2rem;color:var(--success-green);margin-bottom:1rem;"></i><p>NO INCIDENTS REPORTED</p></div>';
    } else {
        issues.forEach(issue => {
            const card = document.createElement('div');
            card.className = 'incident-card';
            card.innerHTML = `
                <div class="incident-header">
                    <span class="severity-badge severity-${issue.severity}">${issue.severity.toUpperCase()}</span>
                    <span class="incident-status status-${issue.status}">${issue.status.toUpperCase().replace('_',' ')}</span>
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
            list.appendChild(card);
        });
    }
    
    // Setup form
    const form = document.getElementById('incident-form');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const desc = document.getElementById('incident-desc').value.trim();
            const severity = document.getElementById('incident-severity').value;
            if (!desc) return;
            
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'SUBMITTING...';
            
            try {
                await store.createIssue({
                    site_id: siteId,
                    description: desc,
                    severity: severity,
                    reported_by_name: currentUser ? currentUser.full_name : 'Anonymous'
                });
                SoundEngine.playSuccess();
                renderIncidents(siteId);
            } catch (err) {
                SoundEngine.playAlarm();
                Modal.alert('ERROR', 'Failed to submit incident: ' + err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'SUBMIT REPORT';
            }
        };
    }
}

window.resolveIncident = async (issueId) => {
    Modal.confirm('RESOLVE INCIDENT', 'Mark this incident as resolved?', async () => {
        try {
            await store.resolveIssue(issueId);
            SoundEngine.playSuccess();
            // Re-render current view
            const hash = window.location.hash;
            const siteId = hash.replace('#incidents-', '');
            renderIncidents(siteId);
        } catch (err) {
            SoundEngine.playAlarm();
            Modal.alert('ERROR', err.message);
        }
    });
};
