# Authentication System Setup Guide

This guide explains how to set up and run the authentication system for the Second Brain AI System.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+ running locally
- Environment variables configured (see below)

## Environment Setup

1. **Copy the example environment file**:

   ```bash
   cp .env.example .env.local
   ```

2. **Update `.env.local` with your configuration**:

   ```env
   # Backend Configuration
   NODE_ENV=development
   PORT=3000
   DATABASE_URL=postgresql://user:password@localhost:5432/second_brain
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

   # Frontend Configuration
   VITE_API_URL=http://localhost:3000
   ```

3. **Create the database**:
   ```bash
   createdb second_brain
   ```

## Backend Setup

1. **Navigate to backend directory**:

   ```bash
   cd backend
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Run database migrations**:

   ```bash
   npm run migrate
   ```

4. **Start the backend server**:

   ```bash
   npm run dev
   ```

   The backend should now be running at `http://localhost:3000`

## Frontend Setup

1. **In the root directory, install dependencies**:

   ```bash
   npm install
   ```

2. **Start the frontend development server**:

   ```bash
   npm run dev
   ```

   The frontend should now be running at `http://localhost:5173`

## API Endpoints

### Authentication Routes

#### POST `/api/auth/signup`

Create a new user account.

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe" // optional
}
```

**Response** (201 Created):

```json
{
  "user": {
    "id": "user_id_here",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2026-01-22T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### POST `/api/auth/signin`

Authenticate user and get JWT token.

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response** (200 OK):

```json
{
  "user": {
    "id": "user_id_here",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2026-01-22T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### GET `/api/auth/me`

Get current user profile (requires authentication).

**Headers**:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response** (200 OK):

```json
{
  "id": "user_id_here",
  "email": "user@example.com",
  "name": "John Doe",
  "createdAt": "2026-01-22T10:00:00Z",
  "updatedAt": "2026-01-22T10:00:00Z"
}
```

#### GET `/api/health`

Health check endpoint.

**Response**:

```json
{
  "status": "ok"
}
```

## Frontend Pages

### Login Page (`/login`)

- Sign in with email and password
- Redirects to dashboard on successful login
- Shows error messages for invalid credentials

### Signup Page (`/signup`)

- Create a new account
- Optional name field
- Password confirmation
- Auto-login after signup

### Dashboard Page (`/dashboard`)

- Protected route (requires authentication)
- Shows user profile information
- Navigation sidebar with menu items
- Quick start widgets for core features

## Authentication Flow

1. **User Registration**:
   - User fills signup form with email, password, and optional name
   - Password is hashed using bcrypt (10 salt rounds)
   - User is created in database
   - JWT token is generated and returned

2. **User Login**:
   - User fills login form with email and password
   - Password is compared with stored hash
   - JWT token is generated and returned
   - Token is stored in localStorage

3. **Protected Routes**:
   - Token is verified on each protected page load
   - `ProtectedRoute` component redirects to login if not authenticated
   - Token is sent in `Authorization: Bearer <token>` header for API calls

4. **Logout**:
   - Token is removed from localStorage
   - User is redirected to login page

## Security Features

- **Password Hashing**: Bcrypt with 10 salt rounds
- **JWT Tokens**: Expire after 7 days (configurable via `JWT_EXPIRE`)
- **CORS**: Enabled for frontend requests
- **Protected Routes**: Requires valid JWT token
- **Middleware**: Auth middleware validates tokens on protected endpoints

## Database Schema

### Users Table

```sql
CREATE TABLE users (
    id                  TEXT PRIMARY KEY,
    email               TEXT UNIQUE NOT NULL,
    password            TEXT NOT NULL,
    name                TEXT,
    createdAt           TIMESTAMP DEFAULT NOW(),
    updatedAt           TIMESTAMP DEFAULT NOW()
);
```

The User model includes relationships for:

- ProcessedInputs
- SpeakerProfiles
- AudioStreamSessions
- AudioBatches
- InputProcessingMetrics

## Troubleshooting

### "Connection refused" error

- Ensure PostgreSQL is running
- Check `DATABASE_URL` in `.env.local`
- Verify database exists: `psql -l`

### "JWT_SECRET not found" error

- Ensure `JWT_SECRET` is set in `.env.local`
- If not set, the system defaults to "your-secret-key-change-in-production"

### "User already exists" error

- Email is already registered
- Try signing up with a different email or reset the database

### CORS errors

- Ensure backend is running on port 3000
- Check `VITE_API_URL` matches backend URL
- Verify CORS middleware is enabled in `api-server.ts`

## Development Tips

### Reset Database

```bash
cd backend
npm run migrate reset
```

### View Database Contents

```bash
cd backend
npm run studio
```

### Debug API Calls

Open browser DevTools (F12) and check Network tab for API requests and responses.

### Check Token

Decode JWT tokens at [jwt.io](https://jwt.io) to verify token contents.

## Next Steps

1. **Add password reset functionality**
2. **Implement email verification**
3. **Add OAuth/Social login**
4. **Setup refresh token rotation**
5. **Add rate limiting on auth endpoints**
6. **Implement account recovery**

## Resources

- [Express.js Documentation](https://expressjs.com/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Bcrypt Security](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [React Router](https://reactrouter.com/)
- [Prisma ORM](https://www.prisma.io/docs/)
