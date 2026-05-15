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
            signins: [],
            trades: ['General Labour', 'Electrician', 'Plumber', 'Carpenter', 'Machine Operator', 'Scaffolder', 'Steel Fixer', 'Supervisor', 'Other']
        };

        if (!raw) {
            this.saveRaw(defaults);
        } else {
            // Migration: Ensure all keys exist if the storage already has some data
            const current = JSON.parse(raw);
            const migrated = { ...defaults, ...current };
            
            // Migration: Ensure all existing users have a role
            Object.values(migrated.users).forEach(user => {
                if (!user.role) user.role = 'supervisor';
            });

            this.saveRaw(migrated);
        }

        // Create default IT Admin if not exists
        this.createITAdmin();
    }

    createITAdmin() {
        const data = this.getRaw();
        if (!data.users['itadmin']) {
            data.users['itadmin'] = {
                username: 'itadmin',
                pin: 'admin123',
                role: 'it-admin',
                createdAt: new Date().toISOString()
            };
            this.saveRaw(data);
            console.log('[STORE] DEFAULT IT ADMIN CREATED');
        }
    }

    getRaw() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            const data = raw ? JSON.parse(raw) : {};
            return {
                users: data.users || {},
                sites: data.sites || {},
                signins: data.signins || [],
                trades: data.trades || []
            };
        } catch (e) {
            console.error('[STORE] DATA CORRUPTION DETECTED, RESETTING...');
            return { users: {}, sites: {}, signins: [], trades: [] };
        }
    }

    saveRaw(data) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    }

    // Trade Management
    getTrades() {
        return this.getRaw().trades;
    }

    addTrade(tradeName) {
        const data = this.getRaw();
        if (!data.trades.includes(tradeName)) {
            data.trades.push(tradeName);
            data.trades.sort();
            this.saveRaw(data);
            return true;
        }
        return false;
    }

    deleteTrade(tradeName) {
        const data = this.getRaw();
        data.trades = data.trades.filter(t => t !== tradeName);
        this.saveRaw(data);
    }

    // User Management
    createUser(username, pin, profileData = {}, role = 'supervisor') {
        const data = this.getRaw();
        const normalizedUser = username.trim().toLowerCase();
        if (data.users[normalizedUser]) return { success: false, message: 'USERNAME ALREADY EXISTS' };
        data.users[normalizedUser] = { 
            username: normalizedUser, 
            pin,
            role,
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

    getAllUsers() {
        return Object.values(this.getRaw().users);
    }

    deleteUser(username) {
        const data = this.getRaw();
        const normalizedUser = username.trim().toLowerCase();
        
        // Remove user
        delete data.users[normalizedUser];
        
        // Remove sites owned by this user
        const siteIdsToDelete = Object.values(data.sites)
            .filter(s => s.ownerId === normalizedUser)
            .map(s => s.id);
            
        siteIdsToDelete.forEach(id => {
            delete data.sites[id];
            data.signins = data.signins.filter(s => s.siteId !== id);
        });
        
        this.saveRaw(data);
    }

    getAllSignIns() {
        return this.getRaw().signins;
    }

    restoreData(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            // Basic validation
            if (data.users && data.sites && data.trades) {
                this.saveRaw(data);
                return true;
            }
            return false;
        } catch (e) {
            console.error('[STORE] RESTORE FAILED:', e);
            return false;
        }
    }
}

const store = new DataStore();