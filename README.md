# RouteTrack — Delivery & Route Tracker

A full-stack delivery management app for dispatchers and drivers.

**Developer:** Vukona Ngwenya

## Features
- JWT login with two roles: **dispatcher** and **driver**
- Dispatchers create deliveries, add drivers, and assign/reassign drivers
- Drivers see only their own deliveries and move them through
  `pending → in transit → delivered`
- Status rules enforced on the server (no skipping or going backwards)
- Full status history (audit trail) for every delivery
- Dashboard with live counts, filters by status and driver, and search

## Tech stack
React 18 (Vite) · Node.js / Express · MySQL · JWT · bcrypt

## Run locally
1. `mysql -u root -p < server/schema.sql`
2. `cd server && npm install`
3. Copy `.env.example` to `.env` (`cp .env.example .env` in Git Bash, or `copy .env.example .env` in Command Prompt) and fill in your DB password and JWT secret
4. `npm run seed && npm run dev`
5. New terminal: `cd client && npm install && npm run dev`
6. Open http://localhost:5173

Demo logins (password `password123`): `dispatcher@demo.com`, `sipho@demo.com`, `lerato@demo.com`
