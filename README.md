# Construction Hub — SITE-SECURE

A **construction site management system** for tracking worker sign-ins, managing sites, and ensuring safety compliance. Built with Node.js/Express, featuring real-time updates via Socket.IO, QR code-based sign-in, and a premium glassmorphism UI.

## Features

- **QR Code Sign-In** — Workers scan a QR code to sign into a construction site
- **Orientation Check** — Ensures workers have been orientated before entering
- **PPE Checklist** — Verifies personal protective equipment compliance
- **Live Headcount** — Real-time dashboard showing who's currently on site
- **Worker Check-Out** — Track when workers leave the site
- **Safety Incidents** — Report and track safety issues per site
- **IT Admin Panel** — Full oversight with analytics, user management, and system tools
- **Multi-Site Support** — Supervisors can manage multiple construction sites
- **Real-Time Notifications** — Socket.IO powered live updates + email alerts
- **CSV Export** — Export sign-in logs with date filtering
- **QR Poster Generation** — Print posters with QR codes for each site
- **Dark/Light Theme** — Premium glassmorphism design with theme toggle
- **Sound Effects** — Web Audio API synthesized UI sounds
- **Multi-Language** — English, Spanish, and French support
- **Offline PWA** — Works offline and syncs when connectivity returns
- **Dual Storage** — Local JSON database or Supabase cloud

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/benibishi/CreattingApplication.git
cd CreattingApplication

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start the server
npm start
```

The app will be running at **http://localhost:3000**.

### Development Mode (auto-restart)

```bash
npm run dev
```

## Environment Variables

Create a `.env` file in the project root:

```env
# Required
JWT_SECRET=your-secure-random-secret-here

# Storage Mode: "local" (JSON file) or "supabase" (cloud)
STORAGE_MODE=local

# Server Port
PORT=3000

# CORS Origins (comma-separated)
CORS_ORIGINS=http://localhost:3000

# Supabase (only if STORAGE_MODE=supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Email Notifications (optional, uses Ethereal test emails if not set)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## Default Credentials

| Role | Username | Password |
|------|----------|----------|
| IT Admin | `admin@construction.com` | `admin123` |

## Project Structure

```
CreattingApplication/
├── server.js              # Express server with all API routes
├── package.json           # Dependencies and scripts
├── schema.sql             # Supabase database schema
├── db.json                # Local JSON database (auto-created)
├── .env                   # Environment variables (not committed)
├── Dockerfile             # Docker containerization
├── public/                # Frontend static files
│   ├── index.html         # Main SPA entry point
│   ├── manifest.json      # PWA manifest
│   ├── sw.js              # Service worker for offline support
│   ├── css/
│   │   └── style.css      # Complete design system
│   ├── js/
│   │   ├── store.js       # Data layer (API + Supabase)
│   │   ├── i18n.js        # Internationalization (EN/ES/FR)
│   │   ├── sound.js       # Web Audio API sound engine
│   │   ├── theme.js       # Dark/light theme manager
│   │   ├── modals.js      # Custom modal dialogs
│   │   ├── auth.js        # Login and registration
│   │   ├── admin.js       # Site management & trades
│   │   ├── itadmin.js     # IT Admin dashboard & analytics
│   │   ├── signin.js      # Worker sign-in/out flow
│   │   ├── incidents.js   # Safety incident reporting
│   │   ├── profile.js     # User profile settings
│   │   └── app.js         # Main routing & initialization
│   └── uploads/           # User-uploaded site images
│       ├── maps/
│       └── offices/
└── setup-supabase.html    # Supabase setup guide
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create a new supervisor account |
| POST | `/api/auth/login` | Sign in with email/username + password |

### Sites
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sites` | Get all sites (optional `?ownerId=`) |
| POST | `/api/sites` | Create a new site |
| DELETE | `/api/sites/:id` | Delete a site |

### Sign-Ins
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/signins` | Get sign-in logs (optional `?siteId=`, `?status=`) |
| POST | `/api/signins` | Record a new sign-in |
| PATCH | `/api/signins/:id/checkout` | Check out a worker |

### Issues
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/issues` | Get issues (optional `?siteId=`) |
| POST | `/api/issues` | Report a new safety issue |
| PATCH | `/api/issues/:id` | Update issue status |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Get server configuration |
| GET | `/api/trades` | Get trade list |
| POST | `/api/trades` | Add a trade |
| DELETE | `/api/trades/:name` | Remove a trade |
| GET | `/api/users` | List users (IT Admin only) |
| DELETE | `/api/users/:id` | Delete user (IT Admin only) |
| PATCH | `/api/users/:id` | Update user profile |
| GET | `/api/health` | Health check |

## User Roles

| Role | Capabilities |
|------|-------------|
| **IT Admin** | Full system access: manage all users, sites, trades, view analytics, backup/restore |
| **Supervisor** | Manage own sites, view sign-in logs, generate QR posters, export CSV |
| **Worker** | Sign in/out via QR code (no account needed) |

## Docker

```bash
# Build
docker build -t construction-hub .

# Run
docker run -p 3000:3000 --env-file .env construction-hub
```

## Tech Stack

- **Backend**: Node.js, Express, Socket.IO, JWT, bcrypt, Nodemailer
- **Frontend**: Vanilla HTML/CSS/JS, Chart.js, QRCode.js, Font Awesome
- **Database**: Local JSON / Supabase (PostgreSQL)
- **Design**: Glassmorphism, Inter + JetBrains Mono fonts
- **PWA**: Service Worker, Web App Manifest

## License

MIT
