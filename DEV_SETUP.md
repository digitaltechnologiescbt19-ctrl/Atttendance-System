# Development Setup - Unified Dev Command

## Quick Start

Run the unified dev command from the workspace root:

```bash
npm run dev
```

This will start both services simultaneously:
- **Backend**: http://localhost:5000 (Express API)
- **Frontend**: http://localhost:5173 (Vite dev server)

## What Happens

The `npm run dev` command from the root `package.json`:
1. Starts the backend in the background using `tsx watch` with hot-reload
2. Starts the frontend with Vite dev server in the foreground
3. Both services are now running concurrently

## Individual Commands

If you need to run services separately:

```bash
# Backend only (from workspace root)
npm run dev:backend

# Frontend only (from workspace root)
npm run dev:frontend

# Or cd into each folder and run:
cd backend && npm run dev
cd frontend && npm run dev
```

## Troubleshooting

### Backend won't start
- Check if port 5000 is in use: `netstat -ano | findstr :5000`
- Verify `.env` file exists in backend folder with DATABASE_URL
- Ensure PostgreSQL is running on localhost:5432

### Frontend won't start
- Check if port 5173 is in use: `netstat -ano | findstr :5173`
- Run `npm install` in frontend folder if dependencies missing
- Check vite.config.ts for correct proxy settings to `http://localhost:5000`

### API calls failing
- Backend must be running first
- Check CORS settings in `backend/src/app.ts`
- Verify Vite proxy config in `frontend/vite.config.ts` has `target: "http://localhost:5000"`

## Build for Production

```bash
npm run build
```

This will build both backend and frontend:
- Backend: Runs TypeScript compiler to generate dist/ folder
- Frontend: Creates optimized production build

## Install Dependencies

If this is a fresh clone:

```bash
npm run install:all
```

This installs dependencies for root, backend, and frontend in one command.

## Environment Files

- Backend: Create `.env` in `backend/` with:
  ```
  DATABASE_URL=postgres://postgres:password@localhost:5432/nbi_attendance
  JWT_SECRET=your_secret_key_here
  NODE_ENV=development
  GEMINI_API_KEY=optional_for_ai_features
  ```

- Frontend: No `.env` needed; configure in `frontend/vite.config.ts`

## Architecture

- **Workspace Root**: Orchestration (npm scripts, this guide)
- **Backend**: Express API on port 5000, TypeScript with tsx watch
- **Frontend**: React + Vite on port 5173, proxies API calls to backend
- **Database**: PostgreSQL on localhost:5432

Enjoy unified development! 🚀
