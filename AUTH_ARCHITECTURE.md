# 🏗️ Authentication System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        SECOND BRAIN AI SYSTEM                    │
│                    User Authentication Flow                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────┐          ┌──────────────────────────┐
│      FRONTEND (React)       │          │    BACKEND (Express)     │
│   http://localhost:5173     │          │   http://localhost:3000  │
├─────────────────────────────┤          ├──────────────────────────┤
│                             │          │                          │
│  App.tsx                    │          │  api-server.ts           │
│  ├─ Router                  │          │  ├─ CORS Middleware      │
│  ├─ AuthProvider            │          │  ├─ Error Handler        │
│  └─ ProtectedRoute          │          │  └─ Routes               │
│                             │          │                          │
│  pages/                     │          │  controllers/            │
│  ├─ LoginPage.tsx      ────────────┬──────► auth.controller.ts   │
│  ├─ SignupPage.tsx     ────────────┼──────► (signup/signin)      │
│  └─ DashboardPage.tsx  ────────────┼──────┐                      │
│                             │      │     │  middlewares/          │
│  contexts/                  │      │     └──► auth.middleware.ts  │
│  └─ AuthContext.tsx    ◄───────────┘        (verify JWT)          │
│     ├─ login()              │                                     │
│     ├─ signup()             │          services/                  │
│     ├─ logout()             │          ├─ auth.ts                 │
│     └─ user state           │          │  (hash, JWT, verify)    │
│                             │          └─ Prisma Client           │
│  components/                │                                     │
│  ├─ ProtectedRoute          │                                     │
│  └─ ui/                     │                                     │
│     ├─ Button.tsx           │          ┌──────────────────────────┐
│     └─ Input.tsx            │          │   DATABASE (PostgreSQL)  │
│                             │          │   localhost:5432         │
│  localStorage               │          ├──────────────────────────┤
│  └─ authToken              │          │                          │
│                             │          │  users table             │
└─────────────────────────────┘          │  ├─ id                   │
                                         │  ├─ email                │
                                         │  ├─ password (hashed)    │
                                         │  ├─ name                 │
                                         │  ├─ createdAt            │
                                         │  └─ updatedAt            │
                                         │                          │
                                         └──────────────────────────┘
```

## Authentication Flows

### Sign Up Flow

```
User Input          Frontend Logic           Backend Logic         Database
(Signup Form)            │                        │                    │
      │                   │                        │                    │
      ├─────────────────▶ 1. Validate Form        │                    │
      │                   │  (email, password)     │                    │
      │                   │                        │                    │
      │                   2. POST /auth/signup     │                    │
      │                   ├──────────────────────▶ 3. Check email exists ◀─┤
      │                   │                        │   (find unique)     │
      │                   │                        │                    │
      │                   │                        4. Hash Password     │
      │                   │                        │   (bcrypt)          │
      │                   │                        │                    │
      │                   │                        5. Create User       │
      │                   │                        ├──────────────────▶ Insert User
      │                   │                        │                    │
      │                   │◀─────────────────────  6. Return User + JWT  ◀┤
      │◀─ 7. Receive Token │                       │                    │
      │   & User Data      │                       │                    │
      │                    │                       │                    │
      8. Store Token       │                       │                    │
      │   in localStorage  │                       │                    │
      │                    │                       │                    │
      9. Redirect to       │                       │                    │
         Dashboard         │                       │                    │
```

### Login Flow

```
User Input          Frontend Logic           Backend Logic         Database
(Login Form)             │                        │                    │
      │                  │                        │                    │
      ├───────────────▶  1. Validate Form        │                    │
      │                  │  (email, password)     │                    │
      │                  │                        │                    │
      │                  2. POST /auth/signin     │                    │
      │                  ├──────────────────────▶ 3. Find User by Email ◀─┤
      │                  │                        │                    │
      │                  │                        4. Compare Passwords  │
      │                  │                        │   (bcrypt.compare)  │
      │                  │                        │                    │
      │                  │                        5. Generate JWT      │
      │                  │◀─────────────────────  6. Return User + JWT
      │◀─ 7. Receive Token│                       │                    │
      │   & User Data    │                       │                    │
      │                  │                        │                    │
      8. Store Token     │                        │                    │
      │   in localStorage│                        │                    │
      │                  │                        │                    │
      9. Redirect to     │                        │                    │
         Dashboard       │                        │                    │
```

### Protected Route Access

```
User                 Frontend              Middleware             Backend
  │                    │                      │                     │
  ├─ Visit /dashboard  │                      │                     │
  │                    │                      │                     │
  │                    1. Check Auth Status   │                     │
  │                    │  (useAuth hook)      │                     │
  │                    │                      │                     │
  │         ┌──────────2. Is Authenticated?   │                     │
  │         │          │                      │                     │
  │         No      Redirect to /login        │                     │
  │                    │                      │                     │
  │         Yes     3. ProtectedRoute passes  │                     │
  │                    │                      │                     │
  │                    4. Render Dashboard    │                     │
  │◀─ Show Dashboard   │                      │                     │
  │                    │                      │                     │
  │ Click Get Profile  │                      │                     │
  │──────────────────▶ 5. Fetch /api/auth/me  │                     │
  │                    │  (with JWT token)    │                     │
  │                    │  Authorization       │                     │
  │                    │  Bearer: <token>     │                     │
  │                    │  ────────────────────▶ 6. Verify Token      │
  │                    │                      │   (auth middleware)  │
  │                    │  ◀─────────────────── 7. Extract userId     │
  │                    │                      │   from token         │
  │                    │  ────────────────────▶ 8. Query User by ID  ┌─┘
  │                    │                      │   from DB
  │                    │  ◀─────────────────── 9. Return User Data
  │◀────────────────── 10. Display Profile    │                     │
  │                        Data               │                     │
```

## Token Lifecycle

```
┌─────────────────────────────────────────────────────┐
│           JWT TOKEN LIFECYCLE                       │
└─────────────────────────────────────────────────────┘

1. GENERATION (Login/Signup)
   ┌─────────────────────┐
   │  Backend generates  │
   │    JWT token        │
   │  - userId: "abc123" │
   │  - exp: +7 days     │
   │  - signed with      │
   │    JWT_SECRET       │
   └────────────┬────────┘
                │
2. TRANSMISSION
                │
   ┌────────────▼─────────────┐
   │  Frontend receives token │
   │  in API response         │
   └────────────┬─────────────┘
                │
3. STORAGE
                │
   ┌────────────▼────────────────────┐
   │  Stored in localStorage          │
   │  key: "authToken"                │
   │  value: "eyJhbGciOiJIUzI1..." │
   └────────────┬────────────────────┘
                │
4. USAGE
                │
   ┌────────────▼──────────────────────────┐
   │  Included in every API request         │
   │  Header: Authorization: Bearer <token> │
   └────────────┬──────────────────────────┘
                │
5. VERIFICATION
                │
   ┌────────────▼───────────────────┐
   │  Backend middleware verifies:  │
   │  - Signature is valid          │
   │  - Token not expired           │
   │  - Extract userId              │
   └────────────┬───────────────────┘
                │
            VALID?
            /   \
          YES   NO
          /       \
    Continue   Return 401
    Request    Unauthorized

6. EXPIRATION
   └─ After 7 days: Token invalid
   └─ User must login again
   └─ New token generated
```

## Database Schema

```
┌─────────────────────────────────────┐
│          USERS TABLE                │
├─────────────────────────────────────┤
│ COLUMN      │ TYPE      │ NOTES     │
├─────────────┼───────────┼───────────┤
│ id          │ STRING    │ CUID PK   │
│ email       │ STRING    │ UNIQUE    │
│ password    │ STRING    │ Hashed    │
│ name        │ STRING    │ Optional  │
│ createdAt   │ DATETIME  │ Auto      │
│ updatedAt   │ DATETIME  │ Auto      │
└─────────────────────────────────────┘

EXAMPLE RECORD:
{
  id: "clrvw1z2j0000123abc",
  email: "user@example.com",
  password: "$2b$10$...", // bcrypt hash
  name: "John Doe",
  createdAt: 2026-01-22T10:30:00Z,
  updatedAt: 2026-01-22T10:30:00Z
}
```

## File Dependencies

```
frontend/App.tsx
├── react-router-dom (Router, Routes, Route, Navigate)
├── contexts/AuthContext.tsx
│   └── Provides: useAuth() hook
├── pages/LoginPage.tsx
│   ├── uses: useAuth().login()
│   └── uses: useNavigate()
├── pages/SignupPage.tsx
│   ├── uses: useAuth().signup()
│   └── uses: useNavigate()
├── pages/DashboardPage.tsx
│   ├── uses: useAuth() for user data
│   └── uses: useAuth().logout()
└── components/ProtectedRoute.tsx
    └── uses: useAuth() for protection

backend/main.ts
└── services/api-server.ts
    ├── services/auth.ts
    │   ├── bcrypt (hashPassword, comparePassword)
    │   └── jsonwebtoken (generateToken, verifyToken)
    ├── controllers/auth.controller.ts
    │   ├── PrismaClient (user operations)
    │   └── services/auth.ts functions
    └── middlewares/auth.middleware.ts
        └── services/auth.ts (verifyToken)
```

## Environment Variables

```bash
# .env
DATABASE_URL="postgresql://user:pass@localhost:5432/second_brain"
JWT_SECRET="your-secret-key-change-in-production"
PORT=3000
NODE_ENV=development
```

## Security Layers

```
┌─────────────────────────────────────────────┐
│         SECURITY IMPLEMENTATION             │
└─────────────────────────────────────────────┘

LAYER 1: PASSWORD SECURITY
└─ Input: "password123"
   │
   └─ bcrypt (salt rounds: 10)
   │
   └─ Hash: "$2b$10$..."
   │
   └─ Store in database (never plaintext)

LAYER 2: TOKEN GENERATION
└─ Input: userId
   │
   └─ JWT signing with JWT_SECRET
   │
   └─ Token: "eyJhbGciOiJIUzI1NiIs..."
   │
   └─ Expiration: +7 days

LAYER 3: REQUEST VALIDATION
└─ Check Authorization header exists
   │
   └─ Extract Bearer token
   │
   └─ Verify JWT signature
   │
   └─ Check token not expired
   │
   └─ Allow/Deny request

LAYER 4: ROUTE PROTECTION
└─ Frontend checks useAuth().isAuthenticated
   │
   └─ Routes redirect to /login if needed
   │
   └─ Backend also requires valid token
   │
   └─ Defense in depth strategy
```
