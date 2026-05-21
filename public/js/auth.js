/**
 * AUTH VIEWS
 * Extracted from app.js - renderAdminLogin, renderAdminRegister, setCurrentUser
 */

function setCurrentUser(user) {
    currentUser = user;
}

function renderAdminLogin() {
    try {
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
    } catch (err) {
        console.error('Error rendering login:', err);
        UI.container.innerHTML = '<div class="rugged-card"><h3 class="hazard-text">ERROR</h3><p>Failed to load login view. Please refresh.</p></div>';
    }
}

function renderAdminRegister() {
    try {
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
                    Modal.alert('ERROR', errMsg);
                }
                regBtn.disabled = false;
                regBtn.textContent = 'REGISTER & SIGN IN';
            }
        };
    } catch (err) {
        console.error('Error rendering register:', err);
        UI.container.innerHTML = '<div class="rugged-card"><h3 class="hazard-text">ERROR</h3><p>Failed to load registration view. Please refresh.</p></div>';
    }
}
