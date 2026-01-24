# Mobile App Quick Start Guide

This guide will help you get started with the Second Brain AI mobile app.

## Prerequisites

- Backend server running (see main README.md for setup)
- Node.js 18+ installed
- For iOS development: macOS with Xcode (optional if using Expo Go)
- For testing: iOS Simulator or physical device with Expo Go app

## Setup Steps

### 1. Install Dependencies

```bash
cd mobile-app
npm install
```

### 2. Configure API Connection

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` and set the API URL:

**For iOS Simulator:**
```
EXPO_PUBLIC_API_URL=http://localhost:3001
```

**For Physical Device:**
```
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:3001
```
Replace `YOUR_COMPUTER_IP` with your computer's local IP address (e.g., `192.168.1.100`).

### 3. Start the Backend

Make sure the backend server is running:
```bash
# From the main repository directory
cd backend
npm run dev
```

### 4. Start the Mobile App

```bash
# From the mobile-app directory
npm start
```

This will open the Expo developer tools in your browser.

### 5. Run on Device/Simulator

**Option A: iOS Simulator (macOS only)**
```bash
npm run ios
```

**Option B: Physical Device**
1. Install "Expo Go" app from the App Store
2. Scan the QR code shown in the terminal/browser
3. The app will open in Expo Go

## Using the App

### First Time Setup

1. **Sign Up**: Create a new account
   - Enter your email
   - Create a password (minimum 6 characters)
   - Optionally add your name
   - Tap "Sign Up"

2. **Login** (if you already have an account):
   - Enter your email and password
   - Tap "Sign In"

### Using the Chat

1. After logging in, you'll see the chat interface
2. Type your message in the input field at the bottom
3. Tap "Send" to send your message
4. Watch as the AI assistant responds in real-time
5. Continue the conversation naturally

### Logout

Tap the "Logout" button in the top-right corner of the chat screen.

## Troubleshooting

### Can't Connect to Backend

**Problem**: "Network request failed" or similar errors

**Solutions**:
- Verify the backend is running (`npm run dev` in the backend directory)
- Check that your `.env` file has the correct API URL
- For physical devices:
  - Make sure your phone and computer are on the same WiFi network
  - Use your computer's IP address, not `localhost`
  - Check firewall settings aren't blocking port 3001

### Finding Your Computer's IP Address

**macOS/Linux:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter.

### App Won't Start

**Problem**: Metro bundler fails or app crashes on startup

**Solutions**:
- Clear the cache: `npm start -- --clear`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Make sure React Native/Expo CLI is up to date

### Authentication Issues

**Problem**: Login or signup fails

**Solutions**:
- Check that the backend database is properly initialized
- Verify the backend API is responding (test with curl or Postman)
- Check the backend console for error messages
- Ensure email/password meet requirements (password >= 6 characters)

## Features

✅ User authentication (signup/login)
✅ Real-time streaming chat responses
✅ Clean, native mobile UI
✅ Persistent authentication (stays logged in)
✅ Conversation history within session
✅ iOS and Android support

## Development

### Project Structure

```
mobile-app/
├── src/
│   ├── contexts/         # React contexts (Auth)
│   ├── navigation/       # App navigation
│   ├── screens/         # Screen components
│   ├── services/        # API services
│   └── types/           # TypeScript types
├── App.tsx              # Root component
└── package.json
```

### Adding New Features

1. Create new screens in `src/screens/`
2. Add routes to `src/navigation/AppNavigator.tsx`
3. Add API calls to appropriate service in `src/services/`
4. Update types in `src/types/index.ts`

## Building for Production

See the mobile-app [README.md](README.md) for detailed build instructions.

## Need Help?

- Check the [main README](../README.md) for backend setup
- Review the [mobile app README](README.md) for detailed documentation
- Consult the [Expo documentation](https://docs.expo.dev/)
