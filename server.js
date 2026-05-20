require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const STORAGE_MODE = process.env.STORAGE_MODE || 'local';
const DB_FILE = path.join(__dirname, 'db.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Supabase Initialization
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (STORAGE_MODE === 'supabase') {
    if (!supabaseUrl || !supabaseKey) {
        console.error('[SERVER] MISSING SUPABASE CREDENTIALS IN .ENV');
    } else {
        supabase = createClient(supabaseUrl, supabaseKey);
        console.log('[SERVER] RUNNING IN SUPABASE MODE');
    }
} else {
    console.log('[SERVER] RUNNING IN LOCAL MODE (JSON DATABASE)');
    // Initialize Local DB if not exists
    if (!fs.existsSync(DB_FILE)) {
        const defaults = { 
            users: [], 
            sites: [], 
            signins: [], 
            trades: ['General Labour', 'Electrician', 'Plumber', 'Carpenter', 'Machine Operator', 'Scaffolder', 'Steel Fixer', 'Supervisor', 'Other'] 
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(defaults, null, 2));
    }
}

/**
 * LOCAL DB HELPERS
 */
function getLocalDB() {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveLocalDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

/**
 * API ROUTES
 */

// CONFIG: Tell client what mode we are in
app.get('/api/config', (req, res) => {
    res.json({ mode: STORAGE_MODE });
});

// AUTH: Local Register (Simple)
app.post('/api/auth/register', async (req, res) => {
    if (STORAGE_MODE !== 'local') return res.status(400).json({ error: 'Not in local mode' });
    try {
        const { email, password, full_name, username, role } = req.body;
        const db = getLocalDB();
        
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanUsername = (username || '').trim().toLowerCase();

        if (!cleanEmail || !password || !full_name) {
            return res.status(400).json({ error: 'Email, Full Name, and Password are required' });
        }

        if (db.users.find(u => u.email.trim().toLowerCase() === cleanEmail)) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        if (cleanUsername && db.users.find(u => (u.username || '').trim().toLowerCase() === cleanUsername)) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        const newUser = {
            id: 'u-' + Math.random().toString(36).substr(2, 9),
            email: cleanEmail,
            username: cleanUsername || cleanEmail.split('@')[0],
            password, // In a real app, hash this!
            full_name,
            role: role || 'supervisor',
            created_at: new Date().toISOString()
        };

        db.users.push(newUser);
        saveLocalDB(db);
        res.json({ user: newUser });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// AUTH: Local Login
app.post('/api/auth/login', async (req, res) => {
    if (STORAGE_MODE !== 'local') return res.status(400).json({ error: 'Not in local mode' });
    try {
        const { email, password } = req.body;
        const db = getLocalDB();
        
        // Match either the full email, the stored username, or the email split prefix (case-insensitively)
        const user = db.users.find(u => {
            const cleanInput = (email || '').trim().toLowerCase();
            const cleanEmail = u.email.trim().toLowerCase();
            const cleanUsername = (u.username || cleanEmail.split('@')[0]).trim().toLowerCase();
            
            const matchesIdentifier = (cleanEmail === cleanInput || cleanUsername === cleanInput);
            return matchesIdentifier && u.password === password;
        });
        
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// USERS: Get all users/supervisors (IT Admin function)
app.get('/api/users', async (req, res) => {
    try {
        if (STORAGE_MODE === 'supabase') {
            const { data: { users }, error } = await supabase.auth.admin.listUsers();
            if (error) throw error;
            const mappedUsers = users.map(u => ({
                id: u.id,
                email: u.email,
                username: u.user_metadata?.username || u.email.split('@')[0],
                full_name: u.user_metadata?.full_name || 'N/A',
                role: u.user_metadata?.role || 'supervisor',
                created_at: u.created_at
            }));
            return res.json(mappedUsers);
        } else {
            const db = getLocalDB();
            const safeUsers = db.users.map(u => ({
                id: u.id,
                email: u.email,
                username: u.username || u.email.split('@')[0],
                full_name: u.full_name || 'N/A',
                role: u.role,
                password: u.password, // Added password for IT Admin management
                created_at: u.created_at
            }));
            return res.json(safeUsers);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// USERS: Delete a user
app.delete('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (STORAGE_MODE === 'supabase') {
            const { error } = await supabase.auth.admin.deleteUser(id);
            if (error) throw error;
        } else {
            const db = getLocalDB();
            db.users = db.users.filter(u => u.id !== id);
            saveLocalDB(db);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// USERS: Update profile
app.patch('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, password, notifications_enabled } = req.body;
        
        if (STORAGE_MODE === 'supabase') {
            // Supabase auth updates are usually handled client-side with the user's session
            // But for metadata we can do it here if needed.
            res.status(501).json({ error: 'Supabase profile update should be handled client-side' });
        } else {
            const db = getLocalDB();
            const userIndex = db.users.findIndex(u => u.id === id);
            if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
            
            if (full_name) db.users[userIndex].full_name = full_name;
            if (password) db.users[userIndex].password = password;
            if (notifications_enabled !== undefined) db.users[userIndex].notifications_enabled = notifications_enabled;
            
            saveLocalDB(db);
            res.json({ user: db.users[userIndex] });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// NOTIFICATIONS: Get status
app.get('/api/users/:id/notifications', async (req, res) => {
    try {
        const { id } = req.params;
        const db = getLocalDB();
        const user = db.users.find(u => u.id === id);
        res.json({ enabled: user ? !!user.notifications_enabled : false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// NOTIFICATIONS: Set status
app.post('/api/users/:id/notifications', async (req, res) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;
        const db = getLocalDB();
        const userIndex = db.users.findIndex(u => u.id === id);
        if (userIndex !== -1) {
            db.users[userIndex].notifications_enabled = enabled;
            saveLocalDB(db);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SITES: Get all or by owner
app.get('/api/sites', async (req, res) => {
    try {
        const { ownerId } = req.query;
        if (STORAGE_MODE === 'supabase') {
            let query = supabase.from('sites').select('*');
            if (ownerId) query = query.eq('owner_id', ownerId);
            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            return res.json(data);
        } else {
            const db = getLocalDB();
            let sites = db.sites;
            if (ownerId) sites = sites.filter(s => s.owner_id === ownerId);
            return res.json(sites.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SITES: Create a new site
app.post('/api/sites', async (req, res) => {
    try {
        const { name, email, map, office, owner_id, map_pin_x, map_pin_y } = req.body;

        if (STORAGE_MODE === 'supabase') {
            const uploadImageSupabase = async (base64, folder) => {
                if (!base64 || !base64.startsWith('data:image')) return null;
                const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpg`;
                const buffer = Buffer.from(base64.split(',')[1], 'base64');
                const { error } = await supabase.storage.from('site-images').upload(fileName, buffer, { contentType: 'image/jpeg' });
                if (error) throw error;
                return supabase.storage.from('site-images').getPublicUrl(fileName).data.publicUrl;
            };

            const mapUrl = await uploadImageSupabase(map, 'maps');
            const officeUrl = await uploadImageSupabase(office, 'offices');

            const { data, error } = await supabase.from('sites').insert([{ 
                name, 
                email, 
                map_url: mapUrl, 
                office_url: officeUrl, 
                owner_id,
                map_pin_x: map_pin_x || null,
                map_pin_y: map_pin_y || null
            }]).select();
            if (error) throw error;
            res.json(data[0]);
        } else {
            const uploadImageLocal = async (base64, folder) => {
                if (!base64 || !base64.startsWith('data:image')) return null;
                const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpg`;
                const filePath = path.join(__dirname, 'public', 'uploads', folder, fileName);
                const buffer = Buffer.from(base64.split(',')[1], 'base64');
                fs.writeFileSync(filePath, buffer);
                return `/uploads/${folder}/${fileName}`;
            };

            const mapUrl = await uploadImageLocal(map, 'maps');
            const officeUrl = await uploadImageLocal(office, 'offices');

            const db = getLocalDB();
            const newSite = {
                id: 'site-' + Math.random().toString(36).substr(2, 9),
                name, email, map_url: mapUrl, office_url: officeUrl, owner_id,
                map_pin_x: map_pin_x || null,
                map_pin_y: map_pin_y || null,
                created_at: new Date().toISOString()
            };
            db.sites.push(newSite);
            saveLocalDB(db);
            res.json(newSite);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SITES: Delete site
app.delete('/api/sites/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (STORAGE_MODE === 'supabase') {
            const { error } = await supabase.from('sites').delete().eq('id', id);
            if (error) throw error;
        } else {
            const db = getLocalDB();
            db.sites = db.sites.filter(s => s.id !== id);
            db.signins = db.signins.filter(s => s.site_id !== id);
            saveLocalDB(db);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SIGN-INS: Record a log
app.post('/api/signins', async (req, res) => {
    try {
        const { site_id, first_name, last_name, company, trade_type } = req.body;
        if (STORAGE_MODE === 'supabase') {
            const { data, error } = await supabase.from('signins').insert([{ site_id, first_name, last_name, company, trade_type }]).select();
            if (error) throw error;
            res.json(data[0]);
        } else {
            const db = getLocalDB();
            const newLog = {
                id: 'log-' + Math.random().toString(36).substr(2, 9),
                site_id, first_name, last_name, company, trade_type,
                timestamp: new Date().toISOString()
            };
            db.signins.push(newLog);
            saveLocalDB(db);
            res.json(newLog);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SIGN-INS: Get logs
app.get('/api/signins', async (req, res) => {
    try {
        const { siteId } = req.query;
        if (STORAGE_MODE === 'supabase') {
            let query = supabase.from('signins').select('*, sites(name)');
            if (siteId) query = query.eq('site_id', siteId);
            const { data, error } = await query.order('timestamp', { ascending: false });
            if (error) throw error;
            res.json(data);
        } else {
            const db = getLocalDB();
            let logs = db.signins;
            if (siteId) logs = logs.filter(l => l.site_id === siteId);
            // Join with site name for display
            const enriched = logs.map(l => ({
                ...l,
                sites: { name: db.sites.find(s => s.id === l.site_id)?.name || 'N/A' }
            }));
            res.json(enriched.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// TRADES: Get list
app.get('/api/trades', async (req, res) => {
    try {
        if (STORAGE_MODE === 'supabase') {
            const { data, error } = await supabase.from('trades').select('name').order('name');
            if (error) throw error;
            res.json(data.map(t => t.name));
        } else {
            const db = getLocalDB();
            res.json(db.trades.sort());
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// TRADES: Add
app.post('/api/trades', async (req, res) => {
    try {
        const { name } = req.body;
        if (STORAGE_MODE === 'supabase') {
            const { data, error } = await supabase.from('trades').insert([{ name }]).select();
            if (error) throw error;
            res.json(data[0]);
        } else {
            const db = getLocalDB();
            if (!db.trades.includes(name)) {
                db.trades.push(name);
                saveLocalDB(db);
            }
            res.json({ name });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fallback for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`[SERVER] RUNNING ON http://localhost:${PORT} (${STORAGE_MODE.toUpperCase()} MODE)`);
});
