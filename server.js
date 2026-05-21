require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// ============================================================================
// JWT_SECRET — REQUIRED (fail fast)
// ============================================================================
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('[FATAL] JWT_SECRET is not set in .env');
    process.exit(1);
}

// ============================================================================
// CENTRALIZED CONFIG
// ============================================================================
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');
const STORAGE_MODE = process.env.STORAGE_MODE || 'local';
const DB_FILE = path.join(__dirname, 'db.json');

const config = {
    port: parseInt(process.env.PORT) || 3000,
    storageMode: STORAGE_MODE,
    jwtSecret: JWT_SECRET,
    corsOrigins: ALLOWED_ORIGINS,
    jwtExpiry: process.env.JWT_EXPIRY || '24h'
};

// ============================================================================
// EXPRESS + SOCKET.IO SETUP
// ============================================================================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: ALLOWED_ORIGINS }
});

// ============================================================================
// MIDDLEWARE
// ============================================================================
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate-limit auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many attempts, try again later' }
});
app.use('/api/auth', authLimiter);

// ============================================================================
// INPUT VALIDATION / SANITIZATION
// ============================================================================
function sanitizeHTML(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function validateStringField(value, fieldName, { minLen = 1, maxLen = 255, required = true } = {}) {
    if (value === undefined || value === null || String(value).trim() === '') {
        if (required) return `${fieldName} is required`;
        return null;
    }
    const trimmed = String(value).trim();
    if (trimmed.length < minLen) return `${fieldName} must be at least ${minLen} characters`;
    if (trimmed.length > maxLen) return `${fieldName} must be at most ${maxLen} characters`;
    return null;
}

function validateEmail(email) {
    if (!email) return 'Email is required';
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(String(email).trim())) return 'Invalid email format';
    return null;
}

// ============================================================================
// AUTH MIDDLEWARE
// ============================================================================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied. Token missing.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
};

// ============================================================================
// SUPABASE INITIALIZATION
// ============================================================================
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
            issues: [],
            trades: ['General Labour', 'Electrician', 'Plumber', 'Carpenter', 'Machine Operator', 'Scaffolder', 'Steel Fixer', 'Supervisor', 'Other']
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(defaults, null, 2));
    } else {
        // Ensure issues array exists in existing DB files
        const existingDB = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!existingDB.issues) {
            existingDB.issues = [];
            fs.writeFileSync(DB_FILE, JSON.stringify(existingDB, null, 2));
        }
    }
}

// ============================================================================
// LOCAL DB HELPERS (with write locking)
// ============================================================================
let dbWriteLock = false;

async function withDBLock(fn) {
    while (dbWriteLock) await new Promise(r => setTimeout(r, 10));
    dbWriteLock = true;
    try {
        return await fn();
    } finally {
        dbWriteLock = false;
    }
}

function getLocalDB() {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveLocalDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ============================================================================
// EMAIL TRANSPORTER (initialized once at startup)
// ============================================================================
let emailTransporter = null;

async function initEmailTransporter() {
    try {
        if (process.env.SMTP_HOST) {
            emailTransporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                secure: false,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });
            console.log('[EMAIL] Using configured SMTP server:', process.env.SMTP_HOST);
        } else {
            const testAccount = await nodemailer.createTestAccount();
            emailTransporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });
            console.log('[EMAIL] Using Ethereal test account');
        }
    } catch (err) {
        console.error('[EMAIL] Failed to initialize email transporter:', err.message);
    }
}

// ============================================================================
// API ROUTES
// ============================================================================

// HEALTH CHECK
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        mode: STORAGE_MODE,
        timestamp: new Date().toISOString()
    });
});

// CONFIG: Tell client what mode we are in
app.get('/api/config', (req, res) => {
    res.json({ mode: STORAGE_MODE });
});

// ============================================================================
// AUTH: Local Register
// ============================================================================
app.post('/api/auth/register', async (req, res) => {
    if (STORAGE_MODE !== 'local') return res.status(400).json({ error: 'Not in local mode' });
    try {
        const { email, password, full_name, username, role } = req.body;

        // Validate inputs
        const emailErr = validateEmail(email);
        if (emailErr) return res.status(400).json({ error: emailErr });

        const nameErr = validateStringField(full_name, 'Full Name', { maxLen: 100 });
        if (nameErr) return res.status(400).json({ error: nameErr });

        const passErr = validateStringField(password, 'Password', { minLen: 4, maxLen: 128 });
        if (passErr) return res.status(400).json({ error: passErr });

        const cleanEmail = sanitizeHTML(email.trim().toLowerCase());
        const cleanUsername = sanitizeHTML((username || '').trim().toLowerCase());
        const cleanFullName = sanitizeHTML(full_name.trim());

        const db = getLocalDB();

        if (db.users.find(u => u.email.trim().toLowerCase() === cleanEmail)) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        if (cleanUsername && db.users.find(u => (u.username || '').trim().toLowerCase() === cleanUsername)) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Hash Password
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            id: 'u-' + crypto.randomUUID(),
            email: cleanEmail,
            username: cleanUsername || cleanEmail.split('@')[0],
            password: hashedPassword,
            full_name: cleanFullName,
            role: role || 'supervisor',
            created_at: new Date().toISOString()
        };

        await withDBLock(async () => {
            const db2 = getLocalDB();
            db2.users.push(newUser);
            saveLocalDB(db2);
        });

        // Generate Token
        const token = jwt.sign({
            id: newUser.id,
            username: newUser.username,
            role: newUser.role
        }, JWT_SECRET, { expiresIn: config.jwtExpiry });

        res.json({
            user: {
                id: newUser.id,
                email: newUser.email,
                username: newUser.username,
                role: newUser.role,
                full_name: newUser.full_name
            },
            token
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// AUTH: Local Login
// ============================================================================
app.post('/api/auth/login', async (req, res) => {
    if (STORAGE_MODE !== 'local') return res.status(400).json({ error: 'Not in local mode' });
    try {
        const { email, password } = req.body;
        console.log(`[AUTH] LOGIN ATTEMPT: ${email}`);
        const db = getLocalDB();

        const cleanInput = (email || '').trim().toLowerCase();
        const user = db.users.find(u => {
            const cleanEmail = u.email.trim().toLowerCase();
            const cleanUsername = (u.username || cleanEmail.split('@')[0]).trim().toLowerCase();
            return cleanEmail === cleanInput || cleanUsername === cleanInput;
        });

        if (!user) {
            console.log(`[AUTH] LOGIN FAILED: USER NOT FOUND (${cleanInput})`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Compare Hashed Password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log(`[AUTH] LOGIN FAILED: INCORRECT PASSWORD FOR ${user.email}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log(`[AUTH] LOGIN SUCCESS: ${user.email} (ROLE: ${user.role})`);

        // Generate Token
        const token = jwt.sign({
            id: user.id,
            username: user.username,
            role: user.role
        }, JWT_SECRET, { expiresIn: config.jwtExpiry });

        res.json({
            user: {
                id: user.id,
                username: user.username || user.email.split('@')[0],
                email: user.email,
                role: user.role,
                full_name: user.full_name
            },
            token
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// USERS: Get all users/supervisors (IT Admin function)
// ============================================================================
app.get('/api/users', authenticateToken, async (req, res) => {
    // Only IT Admin can list users
    if (req.user.role !== 'it-admin') return res.status(403).json({ error: 'Forbidden' });
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
                created_at: u.created_at
            }));
            return res.json(safeUsers);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// USERS: Delete a user (IT Admin only)
// ============================================================================
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'it-admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        const { id } = req.params;
        if (STORAGE_MODE === 'supabase') {
            const { error } = await supabase.auth.admin.deleteUser(id);
            if (error) throw error;
        } else {
            await withDBLock(async () => {
                const db = getLocalDB();
                db.users = db.users.filter(u => u.id !== id);
                saveLocalDB(db);
            });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// USERS: Update profile
// ============================================================================
app.patch('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, password, notifications_enabled } = req.body;

        if (STORAGE_MODE === 'supabase') {
            // Supabase auth updates are usually handled client-side with the user's session
            // But for metadata we can do it here if needed.
            res.status(501).json({ error: 'Supabase profile update should be handled client-side' });
        } else {
            await withDBLock(async () => {
                const db = getLocalDB();
                const userIndex = db.users.findIndex(u => u.id === id);
                if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

                if (full_name) db.users[userIndex].full_name = sanitizeHTML(full_name.trim());
                if (password) db.users[userIndex].password = await bcrypt.hash(password, 10);
                if (notifications_enabled !== undefined) db.users[userIndex].notifications_enabled = notifications_enabled;

                saveLocalDB(db);
                const updatedUser = { ...db.users[userIndex] };
                delete updatedUser.password;
                res.json({ user: updatedUser });
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// NOTIFICATIONS: Get status
// ============================================================================
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

// ============================================================================
// NOTIFICATIONS: Set status
// ============================================================================
app.post('/api/users/:id/notifications', async (req, res) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;
        await withDBLock(async () => {
            const db = getLocalDB();
            const userIndex = db.users.findIndex(u => u.id === id);
            if (userIndex !== -1) {
                db.users[userIndex].notifications_enabled = enabled;
                saveLocalDB(db);
            }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// SITES: Get all or by owner
// ============================================================================
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

// ============================================================================
// SITES: Create a new site
// ============================================================================
app.post('/api/sites', async (req, res) => {
    try {
        const { name, email, map, office, owner_id, map_pin_x, map_pin_y } = req.body;

        // Validate inputs
        const nameErr = validateStringField(name, 'Site name', { maxLen: 200 });
        if (nameErr) return res.status(400).json({ error: nameErr });

        const cleanName = sanitizeHTML(name.trim());

        if (STORAGE_MODE === 'supabase') {
            const uploadImageSupabase = async (base64, folder) => {
                if (!base64 || !base64.startsWith('data:image')) return null;
                const fileName = `${folder}/${Date.now()}_${crypto.randomUUID().substr(0, 8)}.jpg`;
                const buffer = Buffer.from(base64.split(',')[1], 'base64');
                const { error } = await supabase.storage.from('site-images').upload(fileName, buffer, { contentType: 'image/jpeg' });
                if (error) throw error;
                return supabase.storage.from('site-images').getPublicUrl(fileName).data.publicUrl;
            };

            const mapUrl = await uploadImageSupabase(map, 'maps');
            const officeUrl = await uploadImageSupabase(office, 'offices');

            const { data, error } = await supabase.from('sites').insert([{
                name: cleanName,
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
                const fileName = `${Date.now()}_${crypto.randomUUID().substr(0, 8)}.jpg`;
                const filePath = path.join(__dirname, 'public', 'uploads', folder, fileName);
                const buffer = Buffer.from(base64.split(',')[1], 'base64');
                fs.writeFileSync(filePath, buffer);
                return `/uploads/${folder}/${fileName}`;
            };

            const mapUrl = await uploadImageLocal(map, 'maps');
            const officeUrl = await uploadImageLocal(office, 'offices');

            const newSite = {
                id: 'site-' + crypto.randomUUID(),
                name: cleanName, email, map_url: mapUrl, office_url: officeUrl, owner_id,
                map_pin_x: map_pin_x || null,
                map_pin_y: map_pin_y || null,
                created_at: new Date().toISOString()
            };

            await withDBLock(async () => {
                const db = getLocalDB();
                db.sites.push(newSite);
                saveLocalDB(db);
            });

            res.json(newSite);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// SITES: Delete site
// ============================================================================
app.delete('/api/sites/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (STORAGE_MODE === 'supabase') {
            const { error } = await supabase.from('sites').delete().eq('id', id);
            if (error) throw error;
        } else {
            await withDBLock(async () => {
                const db = getLocalDB();
                db.sites = db.sites.filter(s => s.id !== id);
                db.signins = db.signins.filter(s => s.site_id !== id);
                saveLocalDB(db);
            });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// SIGN-INS: Record a log
// ============================================================================
app.post('/api/signins', async (req, res) => {
    try {
        const { site_id, first_name, last_name, company, trade_type } = req.body;

        // Validate inputs
        const fnErr = validateStringField(first_name, 'First name', { maxLen: 100 });
        if (fnErr) return res.status(400).json({ error: fnErr });
        const lnErr = validateStringField(last_name, 'Last name', { maxLen: 100 });
        if (lnErr) return res.status(400).json({ error: lnErr });

        const cleanFirstName = sanitizeHTML(first_name.trim());
        const cleanLastName = sanitizeHTML(last_name.trim());
        const cleanCompany = sanitizeHTML((company || '').trim());
        const cleanTradeType = sanitizeHTML((trade_type || '').trim());

        let newLog;
        let siteName = 'Unknown Site';
        let ownerId = null;

        if (STORAGE_MODE === 'supabase') {
            const { data, error } = await supabase.from('signins').insert([{
                site_id,
                first_name: cleanFirstName,
                last_name: cleanLastName,
                company: cleanCompany,
                trade_type: cleanTradeType
            }]).select('*, sites(*)');
            if (error) throw error;
            newLog = data[0];
            siteName = newLog.sites.name;
            ownerId = newLog.sites.owner_id;
        } else {
            const db = getLocalDB();
            const site = db.sites.find(s => s.id === site_id);
            siteName = site ? site.name : 'Unknown Site';
            ownerId = site ? site.owner_id : null;

            newLog = {
                id: 'log-' + crypto.randomUUID(),
                site_id,
                first_name: cleanFirstName,
                last_name: cleanLastName,
                company: cleanCompany,
                trade_type: cleanTradeType,
                status: 'checked_in',
                timestamp: new Date().toISOString()
            };

            await withDBLock(async () => {
                const db2 = getLocalDB();
                db2.signins.push(newLog);
                saveLocalDB(db2);
            });
        }

        // --- EMAIL NOTIFICATION LOGIC ---
        if (ownerId && emailTransporter) {
            try {
                const db = getLocalDB();
                const owner = db.users.find(u => u.id === ownerId);

                if (owner && owner.notifications_enabled) {
                    const mailOptions = {
                        from: '"SITE-SECURE SYSTEM" <system@site-secure.com>',
                        to: owner.email,
                        subject: `NEW SIGN-IN: ${siteName.toUpperCase()}`,
                        html: `
                            <div style="font-family: monospace; background: #0f1115; color: #ffae00; padding: 20px; border: 2px solid #ffae00;">
                                <h2 style="border-bottom: 2px solid #ffae00; padding-bottom: 10px;">TACTICAL ALERT: NEW SITE ENTRY</h2>
                                <p><strong>SITE:</strong> ${siteName.toUpperCase()}</p>
                                <p><strong>NAME:</strong> ${cleanFirstName.toUpperCase()} ${cleanLastName.toUpperCase()}</p>
                                <p><strong>COMPANY:</strong> ${cleanCompany.toUpperCase()}</p>
                                <p><strong>TRADE:</strong> ${cleanTradeType.toUpperCase()}</p>
                                <p><strong>TIME:</strong> ${new Date(newLog.timestamp).toLocaleString()}</p>
                                <div style="margin-top: 20px; font-size: 0.8rem; color: #888;">
                                    SYSTEM LOG ID: ${newLog.id}
                                </div>
                            </div>
                        `
                    };

                    const info = await emailTransporter.sendMail(mailOptions);
                    console.log("[NOTIFY] EMAIL SENT: %s", info.messageId);
                    if (info.messageId && !process.env.SMTP_HOST) {
                        console.log("[NOTIFY] PREVIEW URL: %s", nodemailer.getTestMessageUrl(info));
                    }
                }
            } catch (emailErr) {
                console.error('[NOTIFY] Email notification failed:', emailErr.message);
                // Don't fail the sign-in just because email failed
            }
        }

        res.json(newLog);

        // Broadcast real-time update
        io.emit('new-signin', {
            site_id: site_id,
            log: newLog,
            site_name: siteName
        });
    } catch (err) {
        console.error('[ERROR] SIGN-IN / NOTIFY:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// SIGN-INS: Get logs (supports ?siteId= and ?status= filters)
// ============================================================================
app.get('/api/signins', async (req, res) => {
    try {
        const { siteId, status } = req.query;
        if (STORAGE_MODE === 'supabase') {
            let query = supabase.from('signins').select('*, sites(name)');
            if (siteId) query = query.eq('site_id', siteId);
            if (status) query = query.eq('status', status);
            const { data, error } = await query.order('timestamp', { ascending: false });
            if (error) throw error;
            res.json(data);
        } else {
            const db = getLocalDB();
            let logs = db.signins;
            if (siteId) logs = logs.filter(l => l.site_id === siteId);
            if (status) logs = logs.filter(l => l.status === status);
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

// ============================================================================
// SIGN-INS: Check-out
// ============================================================================
app.patch('/api/signins/:id/checkout', async (req, res) => {
    try {
        const { id } = req.params;
        if (STORAGE_MODE === 'supabase') {
            const { data, error } = await supabase
                .from('signins')
                .update({ checkout_time: new Date().toISOString(), status: 'checked_out' })
                .eq('id', id)
                .select();
            if (error) throw error;
            if (!data || data.length === 0) return res.status(404).json({ error: 'Sign-in record not found' });
            res.json(data[0]);
        } else {
            let result;
            await withDBLock(async () => {
                const db = getLocalDB();
                const idx = db.signins.findIndex(s => s.id === id);
                if (idx === -1) {
                    result = { notFound: true };
                    return;
                }
                db.signins[idx].checkout_time = new Date().toISOString();
                db.signins[idx].status = 'checked_out';
                saveLocalDB(db);
                result = db.signins[idx];
            });
            if (result.notFound) return res.status(404).json({ error: 'Sign-in record not found' });
            io.emit('worker-checkout', { log: result });
            res.json(result);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// ISSUES: Create
// ============================================================================
app.post('/api/issues', async (req, res) => {
    try {
        const { site_id, description, reported_by, severity } = req.body;

        const descErr = validateStringField(description, 'Description', { maxLen: 2000 });
        if (descErr) return res.status(400).json({ error: descErr });
        if (!site_id) return res.status(400).json({ error: 'site_id is required' });
        if (!reported_by) return res.status(400).json({ error: 'reported_by is required' });
        if (!severity) return res.status(400).json({ error: 'severity is required' });

        const validSeverities = ['low', 'medium', 'high', 'critical'];
        if (!validSeverities.includes(severity)) {
            return res.status(400).json({ error: `severity must be one of: ${validSeverities.join(', ')}` });
        }

        const newIssue = {
            id: 'issue-' + crypto.randomUUID(),
            site_id,
            description: sanitizeHTML(description.trim()),
            reported_by: sanitizeHTML(reported_by.trim()),
            severity,
            status: 'open',
            created_at: new Date().toISOString(),
            resolved_at: null
        };

        if (STORAGE_MODE === 'supabase') {
            const { data, error } = await supabase.from('issues').insert([newIssue]).select();
            if (error) throw error;
            io.emit('new-issue', { issue: data[0] });
            res.json(data[0]);
        } else {
            await withDBLock(async () => {
                const db = getLocalDB();
                if (!db.issues) db.issues = [];
                db.issues.push(newIssue);
                saveLocalDB(db);
            });
            io.emit('new-issue', { issue: newIssue });
            res.json(newIssue);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// ISSUES: Get all (optional ?siteId= filter)
// ============================================================================
app.get('/api/issues', async (req, res) => {
    try {
        const { siteId } = req.query;
        if (STORAGE_MODE === 'supabase') {
            let query = supabase.from('issues').select('*');
            if (siteId) query = query.eq('site_id', siteId);
            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            res.json(data);
        } else {
            const db = getLocalDB();
            let issues = db.issues || [];
            if (siteId) issues = issues.filter(i => i.site_id === siteId);
            res.json(issues.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// ISSUES: Update (resolve / change status)
// ============================================================================
app.patch('/api/issues/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) return res.status(400).json({ error: 'status is required' });
        const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
        }

        if (STORAGE_MODE === 'supabase') {
            const updatePayload = { status };
            if (status === 'resolved' || status === 'closed') {
                updatePayload.resolved_at = new Date().toISOString();
            }
            const { data, error } = await supabase
                .from('issues')
                .update(updatePayload)
                .eq('id', id)
                .select();
            if (error) throw error;
            if (!data || data.length === 0) return res.status(404).json({ error: 'Issue not found' });
            io.emit('issue-updated', { issue: data[0] });
            res.json(data[0]);
        } else {
            let result;
            await withDBLock(async () => {
                const db = getLocalDB();
                if (!db.issues) db.issues = [];
                const idx = db.issues.findIndex(i => i.id === id);
                if (idx === -1) {
                    result = { notFound: true };
                    return;
                }
                db.issues[idx].status = status;
                if (status === 'resolved' || status === 'closed') {
                    db.issues[idx].resolved_at = new Date().toISOString();
                }
                saveLocalDB(db);
                result = db.issues[idx];
            });
            if (result.notFound) return res.status(404).json({ error: 'Issue not found' });
            io.emit('issue-updated', { issue: result });
            res.json(result);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// TRADES: Get list
// ============================================================================
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

// ============================================================================
// TRADES: Add
// ============================================================================
app.post('/api/trades', async (req, res) => {
    try {
        const { name } = req.body;
        if (STORAGE_MODE === 'supabase') {
            const { data, error } = await supabase.from('trades').insert([{ name }]).select();
            if (error) throw error;
            res.json(data[0]);
        } else {
            await withDBLock(async () => {
                const db = getLocalDB();
                if (!db.trades.includes(name)) {
                    db.trades.push(name);
                    saveLocalDB(db);
                }
            });
            res.json({ name });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// TRADES: Delete
// ============================================================================
app.delete('/api/trades/:name', async (req, res) => {
    try {
        const { name } = req.params;
        if (STORAGE_MODE === 'supabase') {
            const { error } = await supabase.from('trades').delete().eq('name', name);
            if (error) throw error;
        } else {
            await withDBLock(async () => {
                const db = getLocalDB();
                db.trades = db.trades.filter(t => t !== name);
                saveLocalDB(db);
            });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// SPA FALLBACK
// ============================================================================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================================
// STARTUP
// ============================================================================
async function startServer() {
    await initEmailTransporter();

    server.listen(config.port, () => {
        console.log(`[SERVER] RUNNING ON http://localhost:${config.port} (${STORAGE_MODE.toUpperCase()} MODE)`);
    });
}

startServer().catch(err => {
    console.error('[FATAL] Failed to start server:', err);
    process.exit(1);
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================
process.on('SIGTERM', () => {
    console.log('[SERVER] SIGTERM received, shutting down gracefully...');
    server.close(() => { process.exit(0); });
});

process.on('SIGINT', () => {
    console.log('[SERVER] SIGINT received, shutting down...');
    server.close(() => { process.exit(0); });
});
