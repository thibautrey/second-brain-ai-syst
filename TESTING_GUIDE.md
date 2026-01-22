# Testing the Authentication System

This guide provides step-by-step instructions for testing the complete authentication system.

## Prerequisites

- PostgreSQL running locally
- Backend server running on port 3000
- Frontend dev server running on port 5173

## Setup for Testing

### 1. Start Backend Server

```bash
# Navigate to backend directory
cd backend

# Install dependencies (if not done yet)
npm install

# Run database migrations
npm run migrate

# Start dev server
npm run dev
```

Expected output:

```
✓ Database connected
✓ API server running on http://localhost:3000
```

### 2. Start Frontend Server (in another terminal)

```bash
# From root directory
npm run dev
```

Expected output:

```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

### 3. Open Browser

Navigate to `http://localhost:5173` in your browser.

---

## Test Scenarios

### Test 1: Create New Account (Signup)

**Steps:**

1. Navigate to `http://localhost:5173` (should redirect to login)
2. Click "Create Account" link or go to `/signup`
3. Fill in the signup form:
   - Full Name: `John Doe`
   - Email: `john@example.com`
   - Password: `password123`
   - Confirm Password: `password123`
4. Click "Create Account" button

**Expected Result:**

- ✅ User is created in database
- ✅ Page redirects to `/dashboard`
- ✅ User name "John Doe" appears in top-right
- ✅ Sidebar shows user avatar with "J"

**Verify in Database:**

```bash
# In terminal with backend running
cd backend
npm run studio
# In Prisma Studio, check "users" table for new user
```

---

### Test 2: Login with Valid Credentials

**Steps:**

1. Go to `http://localhost:5173/login`
2. Fill in login form:
   - Email: `john@example.com`
   - Password: `password123`
3. Click "Sign In" button

**Expected Result:**

- ✅ Login succeeds
- ✅ Redirects to `/dashboard`
- ✅ User information displayed correctly
- ✅ JWT token stored in localStorage

**Verify Token in Browser:**

1. Open DevTools (F12)
2. Go to Application > Local Storage
3. Look for `authToken` key
4. Paste value at [jwt.io](https://jwt.io) to decode

---

### Test 3: Login with Invalid Password

**Steps:**

1. Go to `/login`
2. Enter correct email but wrong password:
   - Email: `john@example.com`
   - Password: `wrongpassword`
3. Click "Sign In"

**Expected Result:**

- ✅ Error message shows: "Invalid email or password"
- ✅ Page does not redirect
- ✅ Token is not created

---

### Test 4: Login with Non-existent Email

**Steps:**

1. Go to `/login`
2. Enter non-existent email:
   - Email: `nonexistent@example.com`
   - Password: `password123`
3. Click "Sign In"

**Expected Result:**

- ✅ Error message shows: "Invalid email or password"
- ✅ Page does not redirect

---

### Test 5: Duplicate Email Registration

**Steps:**

1. Go to `/signup`
2. Try to register with same email as Test 1:
   - Email: `john@example.com`
   - Password: `newpassword123`
3. Click "Create Account"

**Expected Result:**

- ✅ Error message shows: "User already exists"
- ✅ Page does not redirect

---

### Test 6: Password Validation

**Test 6a: Password Too Short**

1. Go to `/signup`
2. Enter password less than 6 characters:
   - Password: `pass`
3. Click "Create Account"

**Expected Result:**

- ✅ Frontend validation shows: "Password must be at least 6 characters"
- ✅ API call is not made

**Test 6b: Passwords Don't Match**

1. Go to `/signup`
2. Enter mismatched passwords:
   - Password: `password123`
   - Confirm Password: `password124`
3. Click "Create Account"

**Expected Result:**

- ✅ Frontend validation shows: "Passwords do not match"
- ✅ API call is not made

---

### Test 7: Protected Route Access

**Steps:**

1. Logout (if logged in)
2. Try to access `/dashboard` directly
3. Or clear localStorage and refresh

**Expected Result:**

- ✅ Redirected to `/login`
- ✅ Cannot access dashboard without token

---

### Test 8: Logout Functionality

**Steps:**

1. Login with valid credentials
2. Click "Logout" button in sidebar
3. Try to access dashboard

**Expected Result:**

- ✅ Redirected to `/login`
- ✅ localStorage token removed
- ✅ AuthContext state cleared

---

### Test 9: Session Persistence

**Steps:**

1. Login successfully
2. Refresh the page (F5)
3. Check if still logged in

**Expected Result:**

- ✅ Loading spinner briefly appears
- ✅ User remains logged in
- ✅ Dashboard loads with user info
- ✅ Token verified from localStorage

---

### Test 10: API Endpoint Testing (Optional)

Use curl or Postman to test API endpoints directly:

#### Signup

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

Expected Response (201 Created):

```json
{
  "user": {
    "id": "user_id_here",
    "email": "test@example.com",
    "name": "Test User",
    "createdAt": "2026-01-22T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Signin

```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

#### Get User Profile (Protected)

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

#### Health Check

```bash
curl http://localhost:3000/api/health
```

Expected Response:

```json
{
  "status": "ok"
}
```

---

## Debugging Tips

### View Network Requests

1. Open DevTools (F12)
2. Go to Network tab
3. Perform login/signup
4. Click on request to see details, headers, and response

### View Console Errors

1. Open DevTools (F12)
2. Go to Console tab
3. Look for error messages
4. Check AuthContext logs

### Check Database State

```bash
cd backend
npm run studio
```

Opens Prisma Studio UI to browse database tables.

### Check Backend Logs

Terminal where backend is running shows request logs:

```
POST /api/auth/signup - 201 Created
POST /api/auth/signin - 200 OK
GET /api/auth/me - 200 OK
```

---

## Test Checklist

- [ ] Signup with valid data
- [ ] Signup with duplicate email
- [ ] Signup with short password
- [ ] Signup with mismatched passwords
- [ ] Login with correct credentials
- [ ] Login with wrong password
- [ ] Login with non-existent email
- [ ] Access protected route without token
- [ ] Session persists after page refresh
- [ ] Logout clears session
- [ ] Dashboard displays user information
- [ ] User avatar shows first letter
- [ ] Sidebar navigation is present
- [ ] All quick start buttons are visible
- [ ] Stats cards are displayed

---

## Clean Database for Re-testing

If you need to start fresh:

```bash
cd backend

# Option 1: Reset database (deletes all data, re-runs migrations)
npm run migrate reset

# Option 2: Delete and recreate database
dropdb second_brain
createdb second_brain
npm run migrate
```

Then restart the backend server.

---

## Troubleshooting Tests

### Test fails with "Connection refused"

- ✅ Ensure PostgreSQL is running
- ✅ Check DATABASE_URL in .env.local
- ✅ Verify database exists: `psql -l`

### JWT Token showing as invalid

- ✅ Copy token from localStorage
- ✅ Paste at [jwt.io](https://jwt.io)
- ✅ Check expiration in payload

### User profile not showing on dashboard

- ✅ Check Network tab for `/api/auth/me` call
- ✅ Verify Authorization header includes token
- ✅ Check token is valid (not expired)

### Redirect loops

- ✅ Clear localStorage
- ✅ Clear browser cache
- ✅ Restart both backend and frontend servers

---

## Performance Notes

- Initial page load with valid token: ~500ms
- Login/Signup API call: ~100-200ms
- Token verification: ~50ms
- Database query: ~10-20ms

---

**Last Updated**: January 22, 2026  
**Version**: 0.1.0
