/**
 * HYBRID DATA STORE (LOCAL & SUPABASE)
 * Dynamically switches behavior based on server configuration.
 */

// Placeholder for Supabase Credentials - Only used in Supabase mode
const SUPABASE_URL = 'https://hmagcdawjiigrswaleot.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtYWdjZGF3amlpZ3Jzd2FsZW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODU2MjQsImV4cCI6MjA5NDQ2MTYyNH0.8jVaC553aLhhAuGChhO5nKWPY4kulmVfVlg3TB8X1YY';

// Global Supabase Instance
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class DataStore {
    constructor() {
        this.apiBase = '/api';
        this.mode = 'local'; // Default, will be updated by init()
        this.token = localStorage.getItem('SITE_SECURE_TOKEN');
    }

    async init() {
        try {
            const res = await fetch(`${this.apiBase}/config`);
            const config = await res.json();
            this.mode = config.mode;
            console.log(`[STORE] INITIALIZED IN ${this.mode.toUpperCase()} MODE`);
        } catch (e) {
            console.error('[STORE] FAILED TO FETCH CONFIG, DEFAULTING TO LOCAL');
        }
    }

    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    /**
     * AUTHENTICATION
     */
    async login(email, password) {
        if (this.mode === 'supabase') {
            const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            return {
                id: data.user.id,
                username: data.user.email.split('@')[0],
                email: data.user.email,
                role: data.user.user_metadata.role || 'supervisor'
            };
        } else {
            const res = await fetch(`${this.apiBase}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Login failed');
            }
            const data = await res.json();
            
            // Store token
            this.token = data.token;
            localStorage.setItem('SITE_SECURE_TOKEN', data.token);
            sessionStorage.setItem('SITE_SECURE_USER', JSON.stringify(data.user));

            return data.user;
        }
    }

    async register(email, password, fullName, username) {
        if (this.mode === 'supabase') {
            const { data, error } = await _supabase.auth.signUp({
                email, password,
                options: { data: { full_name: fullName, role: 'supervisor', username: username } }
            });
            if (error) throw error;
            return data.user;
        } else {
            const res = await fetch(`${this.apiBase}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, full_name: fullName, username })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Registration failed');
            }
            const data = await res.json();
            
            // Store token
            this.token = data.token;
            localStorage.setItem('SITE_SECURE_TOKEN', data.token);
            sessionStorage.setItem('SITE_SECURE_USER', JSON.stringify(data.user));

            return data;
        }
    }

    async logout() {
        if (this.mode === 'supabase') {
            await _supabase.auth.signOut();
        }
        this.token = null;
        localStorage.removeItem('SITE_SECURE_TOKEN');
        sessionStorage.removeItem('SITE_SECURE_USER');
    }

    async getCurrentSession() {
        if (this.mode === 'supabase') {
            const { data: { session } } = await _supabase.auth.getSession();
            if (!session) return null;
            return {
                id: session.user.id,
                username: session.user.email.split('@')[0],
                email: session.user.email,
                role: session.user.user_metadata.role || 'supervisor'
            };
        } else {
            const saved = sessionStorage.getItem('SITE_SECURE_USER');
            return saved ? JSON.parse(saved) : null;
        }
    }

    async getAllUsers() {
        const res = await fetch(`${this.apiBase}/users`, { headers: this.getHeaders() });
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                this.logout();
                window.location.hash = '#admin-login';
            }
            const err = await res.json();
            throw new Error(err.error || 'Failed to fetch users');
        }
        return res.json();
    }

    async deleteUser(userId) {
        const res = await fetch(`${this.apiBase}/users/${userId}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        return res.ok;
    }

    /**
     * DATA METHODS (Mostly shared since server handles branching)
     */
    async getTrades() {
        const res = await fetch(`${this.apiBase}/trades`);
        return res.json();
    }

    async addTrade(name) {
        const res = await fetch(`${this.apiBase}/trades`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ name })
        });
        return res.ok;
    }

    async deleteTrade(name) {
        const res = await fetch(`${this.apiBase}/trades/${encodeURIComponent(name)}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        return res.ok;
    }

    async getAllSites() {
        const res = await fetch(`${this.apiBase}/sites`);
        return res.json();
    }

    async getSitesForUser(ownerId) {
        const res = await fetch(`${this.apiBase}/sites?ownerId=${ownerId}`);
        return res.json();
    }

    async getSite(siteId) {
        const sites = await this.getAllSites();
        return sites.find(s => s.id === siteId);
    }

    async createSite(siteData, ownerId) {
        const res = await fetch(`${this.apiBase}/sites`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ ...siteData, owner_id: ownerId })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to create site');
        }
        const data = await res.json();
        return data.id;
    }

    async deleteSite(siteId) {
        const res = await fetch(`${this.apiBase}/sites/${siteId}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        return res.ok;
    }

    async recordSignIn(siteId, userData) {
        const res = await fetch(`${this.apiBase}/signins`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                site_id: siteId,
                first_name: userData.firstName,
                last_name: userData.lastName,
                company: userData.company,
                trade_type: userData.tradeType
            })
        });
        return res.json();
    }

    async getSignInsForSite(siteId) {
        const res = await fetch(`${this.apiBase}/signins?siteId=${siteId}`);
        return res.json();
    }

    async getAllSignIns() {
        const res = await fetch(`${this.apiBase}/signins`);
        return res.json();
    }

    async updateProfile(userId, updates) {
        if (this.mode === 'supabase') {
            const { data, error } = await _supabase.auth.updateUser({
                data: { full_name: updates.full_name },
                password: updates.password || undefined
            });
            if (error) throw error;
            return data.user;
        } else {
            const res = await fetch(`${this.apiBase}/users/${userId}`, {
                method: 'PATCH',
                headers: this.getHeaders(),
                body: JSON.stringify(updates)
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            return data.user;
        }
    }

    async getNotificationStatus(userId) {
        const res = await fetch(`${this.apiBase}/users/${userId}/notifications`);
        const data = await res.json();
        return data.enabled;
    }

    async setNotificationStatus(userId, enabled) {
        const res = await fetch(`${this.apiBase}/users/${userId}/notifications`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ enabled })
        });
        return res.ok;
    }

    async checkoutSignIn(signInId) {
        const res = await fetch(`${this.apiBase}/signins/${signInId}/checkout`, {
            method: 'PATCH', headers: this.getHeaders()
        });
        return res.json();
    }

    async getOnSiteWorkers(siteId) {
        const res = await fetch(`${this.apiBase}/signins?siteId=${siteId}&status=checked_in`);
        return res.json();
    }

    async createIssue(issueData) {
        const res = await fetch(`${this.apiBase}/issues`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(issueData)
        });
        return res.json();
    }

    async getIssues(siteId) {
        let url = `${this.apiBase}/issues`;
        if (siteId) url += `?siteId=${siteId}`;
        const res = await fetch(url);
        return res.json();
    }

    async resolveIssue(issueId) {
        const res = await fetch(`${this.apiBase}/issues/${issueId}`, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify({ status: 'resolved' })
        });
        return res.json();
    }
}

const store = new DataStore();
