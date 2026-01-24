# Second Brain AI - Mobile App

A simple iOS/Android mobile application for the Second Brain AI system built with React Native (Expo).

## Features

- User authentication (Login/Signup)
- Real-time chat with AI assistant
- Streaming chat responses
- Clean and intuitive UI

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development on macOS) or physical device with Expo Go app

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure the API endpoint:

Create a `.env` file in the mobile-app directory:
```
EXPO_PUBLIC_API_URL=http://your-backend-url:3001
```

For local development, you can use:
- iOS Simulator: `http://localhost:3001`
- Physical device: `http://YOUR_COMPUTER_IP:3001` (replace with your computer's IP address)

## Running the App

### Start the development server:
```bash
npm start
```

### Run on iOS Simulator (macOS only):
```bash
npm run ios
```

### Run on Android Emulator:
```bash
npm run android
```

### Run on physical device:
1. Install the Expo Go app from the App Store or Google Play
2. Run `npm start`
3. Scan the QR code with your camera (iOS) or Expo Go app (Android)

## Project Structure

```
mobile-app/
├── src/
│   ├── contexts/         # React contexts (Auth)
│   ├── navigation/       # Navigation setup
│   ├── screens/         # Screen components
│   │   ├── LoginScreen.tsx
│   │   ├── SignupScreen.tsx
│   │   └── ChatScreen.tsx
│   ├── services/        # API services
│   │   ├── auth.ts
│   │   ├── chat.ts
│   │   └── config.ts
│   └── types/           # TypeScript types
├── App.tsx              # Main app component
└── package.json
```

## API Integration

The app connects to the Second Brain AI backend API. Make sure the backend is running and accessible:

- Authentication: `/api/auth/signin`, `/api/auth/signup`
- Chat: `/api/chat` (Server-Sent Events)

## Building for Production

### iOS (requires macOS and Xcode):
```bash
npm run build:ios
```

### Android:
```bash
npm run build:android
```

For more details on building for production, see the [Expo documentation](https://docs.expo.dev/build/introduction/).

## Troubleshooting

### Can't connect to backend
- Make sure the backend is running
- Check that the API URL in `.env` is correct
- For physical devices, ensure your device and computer are on the same network
- Use your computer's IP address, not `localhost`

### Chat not streaming properly
- Verify the backend chat endpoint is working
- Check network connectivity
- Review browser/app console for errors

## License

Same as the main Second Brain AI project.
