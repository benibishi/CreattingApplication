/**
 * PROFILE VIEW
 * Extracted from app.js
 */
async function renderProfile() {
    try {
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
    } catch (err) {
        console.error('Error rendering profile:', err);
        UI.container.innerHTML = '<div class="rugged-card"><h3 class="hazard-text">ERROR</h3><p>Failed to load profile. Please refresh.</p></div>';
    }
}
