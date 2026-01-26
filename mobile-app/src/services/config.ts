/**
 * API Configuration
 */

// Default API URL - can be overridden via environment variable
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export const API_ENDPOINTS = {
  AUTH: {
    SIGNIN: '/api/auth/signin',
    SIGNUP: '/api/auth/signup',
    PROFILE: '/api/auth/profile',
  },
  CHAT: '/api/chat',
};
