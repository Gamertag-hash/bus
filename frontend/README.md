# Bus Tracker Full Stack App

This project contains two parts:
- `frontend`: React + Vite web application
- `backend`: Node.js + Express + Prisma API server

## Setup

1. Copy `.env.example` to `.env` in `backend/` and set real values.
2. Install dependencies:
   - `cd backend && npm install`
   - `cd ../frontend && npm install`
3. Initialize the database:
   - `cd ../backend && npx prisma migrate dev --name init`
4. Start both apps:
   - `cd backend && npm run dev`
   - `cd ../frontend && npm run dev`

## Notes

- Default admin is automatically created on backend startup.
- The frontend calls backend APIs at `http://localhost:4000/api`.
