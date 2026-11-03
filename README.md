# Flo Finance AI

Flo is an AI-powered personal finance platform for tracking spending, planning budgets, monitoring goals, and getting context-aware guidance from an intelligent finance assistant.

## What it does

- Track transactions, spending categories, recurring expenses, and financial cards.
- Set budgets and goals, then review progress through dashboard analytics.
- Generate monthly reports and due-date reminders.
- Ask the finance assistant questions about your own financial data.
- Protect account access with JWT-based authentication and refresh-token rotation.

## Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS, Recharts
- **Backend:** Next.js API routes, MongoDB with Mongoose
- **AI and services:** Groq, Resend
- **Testing:** Vitest and MongoDB Memory Server

## Run locally

### Prerequisites

- Node.js 18+
- MongoDB Atlas or a local MongoDB instance
- A Groq API key for the finance assistant
- A Resend API key if email reports or reminders are enabled

### Setup

```bash
git clone https://github.com/j22k/flo-finance-ai.git
cd flo-finance-ai
npm install
cp .env.local.example .env.local
```

Fill in `MONGODB_URI`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, and the service keys in `.env.local`, then start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm test
npm run build
```

This is an active portfolio project; credentials and deployment configuration are intentionally kept outside the repository.
