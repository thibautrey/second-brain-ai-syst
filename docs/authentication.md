# Authentication Setup Guide

This document explains the authentication system implemented in the Second Brain AI System.

## 🏗️ Architecture

### Backend

- **Express.js** API server with TypeScript
- **JWT** (JSON Web Tokens) for session management
- **Bcrypt** for password hashing
- **Prisma ORM** with PostgreSQL

### Frontend

- **React Router** for navigation
- **Context API** for state management (AuthContext)
- **Protected Routes** for authenticated pages
- **localStorage** for token persistence

## 📁 File Structure

```
backend/
├── controllers/
│   └── auth.controller.ts       # Signup/Signin logic
├── middlewares/
│   └── auth.middleware.ts       # JWT verification
├── services/
│   ├── auth.ts                  # Password hashing & JWT generation
│   └── api-server.ts            # Express server with auth routes
└── main.ts                      # Entry point

frontend/
├── contexts/
│   └── AuthContext.tsx          # Auth state management
├── pages/
│   ├── LoginPage.tsx            # Login form
│   ├── SignupPage.tsx           # Signup form
│   └── DashboardPage.tsx        # Protected dashboard
├── components/
│   ├── ProtectedRoute.tsx       # Route protection HOC
│   └── ui/
│       ├── button.tsx           # Reusable button component
│       └── input.tsx            # Reusable input component
└── App.tsx                      # Router setup
```

## 🚀 Getting Started

### 1. Install Dependencies

**Root:**

```bash
npm install
```

**Backend:**

```bash
cd backend
npm install
```

### 2. Setup Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/second_brain"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
PORT=3000
NODE_ENV=development
```

### 3. Setup Database

```bash
# Create migrations
cd backend
npx prisma migrate dev --name add_auth_fields

# View database with Prisma Studio (optional)
npx prisma studio
```

### 4. Start Development Servers

**Terminal 1 - Backend:**

```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**

```bash
npm run dev
```

The application will be available at:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

## 🔐 Authentication Flow

### Signup

1. User fills signup form (email, password, optional name)
2. Frontend validates form
3. POST to `/api/auth/signup`
4. Backend:
   - Validates email doesn't exist
   - Hashes password with bcrypt
   - Creates user in database
   - Generates JWT token
5. Frontend stores token in localStorage
6. Redirects to dashboard

### Login

1. User fills login form (email, password)
2. POST to `/api/auth/signin`
3. Backend:
   - Finds user by email
   - Compares password with hash
   - Generates JWT token if valid
4. Frontend stores token
5. Redirects to dashboard

### Protected Routes

1. ProtectedRoute component checks `useAuth()` hook
2. If not authenticated, redirects to `/login`
3. If loading, shows spinner
4. If authenticated, renders dashboard

### API Requests

Authenticated requests include JWT token:

```typescript
fetch("/api/auth/me", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

## 🔑 API Endpoints

### POST `/api/auth/signup`

Create new user account

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe" // optional
}
```

**Response:**

```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2026-01-22T..."
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### POST `/api/auth/signin`

Authenticate user

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "user": {...},
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### GET `/api/auth/me`

Get current user profile (protected)

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "id": "user-id",
  "email": "user@example.com",
  "name": "John Doe",
  "createdAt": "2026-01-22T...",
  "updatedAt": "2026-01-22T..."
}
```

## 🛡️ Security Features

- ✅ **Password Hashing**: Bcrypt with salt rounds = 10
- ✅ **JWT Expiration**: 7 days
- ✅ **Token Storage**: Secure localStorage (consider httpOnly cookies for production)
- ✅ **CORS**: Configured for local development
- ✅ **Protected Routes**: Frontend route protection
- ✅ **Token Verification**: Backend middleware verification

## ⚠️ Production Considerations

Before deploying:

1. **Change JWT_SECRET** - Use a strong random string
2. **Use HTTPS** - Always use HTTPS in production
3. **httpOnly Cookies** - Store JWT in httpOnly cookies instead of localStorage
4. **CORS Configuration** - Set specific allowed origins
5. **Password Requirements** - Implement stronger password rules
6. **Rate Limiting** - Add rate limiting to auth endpoints
7. **Email Verification** - Verify email addresses on signup
8. **Refresh Tokens** - Implement refresh token rotation
9. **Error Messages** - Don't leak user existence in error messages
10. **Logging** - Log auth events for security monitoring

## 🧪 Testing

Example test flow:

1. Navigate to `http://localhost:5173/signup`
2. Create account with test credentials
3. Should redirect to dashboard automatically
4. Click logout to return to login page
5. Login with same credentials
6. Should show dashboard with user info

## 📝 Notes

- Password must be at least 6 characters
- Email must be unique
- User name is auto-generated from email if not provided
- Token expires after 7 days
- Logging out clears local token and context

## 🔗 Related Documentation

- [Database Schema](../docs/database.md)
- [Architecture Overview](../agents.md)
- [Frontend Setup](../frontend)
- [Backend Setup](../backend)
