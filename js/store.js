/**
 * DATA STORE INTERFACE
 * Modular design to allow easy database swap later.
 */
class DataStore {
    constructor() {
        this.STORAGE_KEY = 'SITE_SECURE_DATA';
        this.init();
    }

    init() {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        const defaults = {
            users: {}, 
            sites: {}, 
            signins: []
        };

        if (!raw) {
            this.saveRaw(defaults);
        } else {
            // Migration: Ensure all keys exist if the storage already has some data
            const current = JSON.parse(raw);
            const migrated = { ...defaults, ...current };
            this.saveRaw(migrated);
        }
    }

    getRaw() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            const data = raw ? JSON.parse(raw) : {};
            return {
                users: data.users || {},
                sites: data.sites || {},
                signins: data.signins || []
            };
        } catch (e) {
            console.error('[STORE] DATA CORRUPTION DETECTED, RESETTING...');
            return { users: {}, sites: {}, signins: [] };
        }
    }

    saveRaw(data) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    }

    // User Management
    createUser(username, pin, profileData = {}) {
        const data = this.getRaw();
        const normalizedUser = username.trim().toLowerCase();
        if (data.users[normalizedUser]) return { success: false, message: 'USERNAME ALREADY EXISTS' };
        data.users[normalizedUser] = { 
            username: normalizedUser, 
            pin,
            ...profileData,
            createdAt: new Date().toISOString()
        };
        this.saveRaw(data);
        return { success: true };
    }

    authenticate(username, pin) {
        const data = this.getRaw();
        const normalizedUser = username.trim().toLowerCase();
        const user = data.users[normalizedUser];
        if (user && user.pin === pin) return user;
        return null;
    }

    // Site Management
    createSite(siteData, ownerId) {
        const data = this.getRaw();
        const siteId = 'site-' + Math.random().toString(36).substr(2, 9);
        data.sites[siteId] = {
            ...siteData,
            id: siteId,
            ownerId: ownerId.trim().toLowerCase(),
            createdAt: new Date().toISOString()
        };
        this.saveRaw(data);
        return siteId;
    }

    getSite(siteId) {
        return this.getRaw().sites[siteId];
    }

    getSitesForUser(username) {
        const normalizedUser = username.trim().toLowerCase();
        return Object.values(this.getRaw().sites).filter(s => s.ownerId === normalizedUser);
    }

    deleteSite(siteId) {
        const data = this.getRaw();
        delete data.sites[siteId];
        // Also clean up sign-ins for this site
        data.signins = data.signins.filter(s => s.siteId !== siteId);
        this.saveRaw(data);
    }

    // Sign-In Management
    recordSignIn(siteId, userData) {
        const data = this.getRaw();
        data.signins.push({
            siteId,
            ...userData,
            timestamp: new Date().toISOString()
        });
        this.saveRaw(data);
    }

    getSignInsForSite(siteId) {
        return this.getRaw().signins.filter(s => s.siteId === siteId);
    }

    // Maintenance Tasks
    clearAllSignIns() {
        const data = this.getRaw();
        console.log(`[SYSTEM] CROSSING MIDNIGHT: CLEARING ${data.signins.length} ENTRIES.`);
        data.signins = [];
        this.saveRaw(data);
    }

    getAllSites() {
        return Object.values(this.getRaw().sites);
    }
}

const store = new DataStore();