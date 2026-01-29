# Mobile App Demo & Testing Guide

This guide demonstrates how to test the mobile app functionality.

## Testing Prerequisites

1. Backend server running on port 3001
2. Database initialized with schema
3. Mobile app dependencies installed
4. iOS Simulator or physical device ready

## Manual Testing Checklist

### 1. Authentication Flow

#### Test Signup
- [ ] Open the app
- [ ] Should see Login screen by default
- [ ] Tap "Sign Up" link
- [ ] Enter test email (e.g., `test@example.com`)
- [ ] Enter password (min 6 characters)
- [ ] Confirm password matches
- [ ] Optionally enter name
- [ ] Tap "Sign Up" button
- [ ] Should redirect to Chat screen
- [ ] Verify user is logged in

#### Test Login
- [ ] Logout from Chat screen
- [ ] Should return to Login screen
- [ ] Enter same email and password
- [ ] Tap "Sign In" button
- [ ] Should redirect to Chat screen
- [ ] Verify correct user is loaded

#### Test Validation
- [ ] Try signup with password < 6 characters (should fail)
- [ ] Try signup with mismatched passwords (should fail)
- [ ] Try signup with existing email (should fail)
- [ ] Try login with wrong password (should fail)
- [ ] Try login with non-existent email (should fail)

### 2. Chat Functionality

#### Test Basic Chat
- [ ] Login to the app
- [ ] See empty chat state with placeholder text
- [ ] Type a simple message: "Hello"
- [ ] Tap Send button
- [ ] Message appears in chat as user message (blue bubble, right-aligned)
- [ ] See streaming indicator for AI response
- [ ] AI response appears token by token
- [ ] Response completes (streaming stops)
- [ ] Message appears as assistant message (white bubble, left-aligned)

#### Test Chat Features
- [ ] Send multiple messages in sequence
- [ ] Verify conversation history is maintained
- [ ] Verify messages auto-scroll to bottom
- [ ] Test long messages (multi-line)
- [ ] Test sending while previous message is streaming (should be disabled)
- [ ] Verify empty messages cannot be sent

#### Test Chat UI
- [ ] Test keyboard behavior (should push up chat)
- [ ] Verify message input grows with multi-line text
- [ ] Verify scrolling works for long conversations
- [ ] Test message timestamps (if visible)
- [ ] Verify message bubbles layout correctly

### 3. Session Persistence

#### Test Auth Persistence
- [ ] Login to the app
- [ ] Close the app completely (force quit)
- [ ] Reopen the app
- [ ] Should automatically go to Chat screen (no login required)
- [ ] Verify user is still logged in

#### Test Logout
- [ ] From Chat screen, tap Logout button
- [ ] Confirm logout in alert dialog
- [ ] Should return to Login screen
- [ ] Close and reopen app
- [ ] Should show Login screen (not auto-login)

### 4. Error Handling

#### Test Network Errors
- [ ] Stop the backend server
- [ ] Try to send a chat message
- [ ] Should see error alert
- [ ] Restart backend
- [ ] Try to send message again
- [ ] Should work normally

#### Test API Errors
- [ ] Configure wrong API URL in .env
- [ ] Try to login
- [ ] Should see connection error
- [ ] Fix API URL
- [ ] Should work normally

### 5. Platform-Specific (iOS)

#### Test iOS Features
- [ ] Verify safe area insets (notch handling)
- [ ] Test keyboard dismissal (tap outside)
- [ ] Test return key on keyboard
- [ ] Verify scroll behavior
- [ ] Test app in portrait orientation
- [ ] Test on different iOS devices/simulators (if available)

## Automated Testing

Currently, the app doesn't have automated tests. To add them:

```bash
# Install testing dependencies
npm install --save-dev @testing-library/react-native jest

# Run tests
npm test
```

## Performance Testing

### Things to Monitor

1. **App Startup Time**: Should load within 2-3 seconds
2. **Login Response Time**: Should complete within 1-2 seconds (with good network)
3. **Chat Response Start**: First token should arrive within 1-2 seconds
4. **Memory Usage**: Monitor for memory leaks during long chats
5. **Scroll Performance**: Should be smooth with 50+ messages

## Known Limitations

1. No conversation persistence (messages cleared on logout)
2. No message editing or deletion
3. No image/file attachments
4. No offline support
5. No push notifications
6. Chat history not synced with web app

## Reporting Issues

When reporting issues, include:
- Device/simulator details (iOS version, device model)
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if UI-related
- Console logs if applicable
- Backend logs if relevant

## Demo Script

For demonstrating the app to others:

1. **Introduction** (30 seconds)
   - "This is the Second Brain AI mobile app"
   - "It provides chat access to your AI assistant on iOS/Android"

2. **Show Authentication** (1 minute)
   - Open app, show login screen
   - Sign up with new account
   - Show automatic redirect to chat

3. **Demonstrate Chat** (2 minutes)
   - Send simple question: "What can you help me with?"
   - Show streaming response
   - Send follow-up question
   - Demonstrate conversation flow

4. **Show Logout** (30 seconds)
   - Click logout button
   - Show return to login screen
   - Reopen app to show login required

5. **Conclusion** (30 seconds)
   - "Simple, focused mobile experience"
   - "Real-time streaming responses"
   - "Secure authentication"

Total demo time: ~4-5 minutes

## Next Steps

After testing, consider:
- Adding automated tests
- Implementing conversation persistence
- Adding offline support
- Implementing push notifications
- Adding more chat features (voice input, etc.)
