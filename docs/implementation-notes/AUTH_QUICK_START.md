# 🔐 Authentication Quick Reference

## Running the System

### Terminal 1 - Backend

```bash
cd backend
npm install  # First time only
npm run dev
# Server starts at http://localhost:3000
```

### Terminal 2 - Frontend

```bash
npm install  # First time only
npm run dev
# App opens at http://localhost:5173
```

## Key Files

| File                                     | Purpose                          |
| ---------------------------------------- | -------------------------------- |
| `backend/services/auth.ts`               | JWT & password hashing functions |
| `backend/controllers/auth.controller.ts` | Signup/signin logic              |
| `backend/middlewares/auth.middleware.ts` | JWT verification middleware      |
| `backend/services/api-server.ts`         | Express routes                   |
| `frontend/contexts/AuthContext.tsx`      | Global auth state                |
| `frontend/pages/LoginPage.tsx`           | Login form page                  |
| `frontend/pages/SignupPage.tsx`          | Signup form page                 |
| `frontend/pages/DashboardPage.tsx`       | Protected dashboard              |

## API Endpoints

```bash
# Register
POST /api/auth/signup
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John" // optional
}

# Login
POST /api/auth/signin
{
  "email": "user@example.com",
  "password": "password123"
}

# Get Current User (requires token)
GET /api/auth/me
Headers: Authorization: Bearer <token>

# Health Check
GET /api/health
```

## Common Tasks

### Add New Protected Route

```tsx
// In frontend/App.tsx
<Route
  path="/new-page"
  element={
    <ProtectedRoute>
      <NewPage />
    </ProtectedRoute>
  }
/>
```

### Access Auth Context

```tsx
import { useAuth } from "@/contexts/AuthContext";

function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth();

  return <div>{isAuthenticated && <p>Hello {user?.name}</p>}</div>;
}
```

### Make Authenticated API Call

```tsx
const response = await fetch("http://localhost:3000/api/some-endpoint", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

## Troubleshooting

### "Cannot find module" errors

```bash
# Reinstall dependencies
cd backend && npm install
npm install  # root level
```

### Database connection failed

```bash
# Check .env has correct DATABASE_URL
# Make sure PostgreSQL is running
# Run migrations
npx prisma migrate dev
```

### CORS errors

- Frontend is running on `http://localhost:5173`
- Backend should be on `http://localhost:3000`
- Both are configured in CORS middleware

### Token expired

- Default expiration: 7 days
- Change in `backend/services/auth.ts` line `JWT_EXPIRE = '7d'`

## Password Requirements

- Minimum 6 characters
- To change: edit validation in `backend/controllers/auth.controller.ts`

## Default Routes

- `/` → Redirects to `/dashboard`
- `/login` → Login page (public)
- `/signup` → Signup page (public)
- `/dashboard` → Dashboard (protected, requires login)

## Environment Variables

See `.env.example` for all options. Key ones:

```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
PORT=3000
NODE_ENV=development
```

## Quick Test

1. Go to http://localhost:5173/signup
2. Create account
3. Auto-redirected to dashboard
4. Click logout
5. Should be back at login page
