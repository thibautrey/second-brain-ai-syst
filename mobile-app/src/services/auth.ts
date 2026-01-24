/**
 * Authentication Service
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_ENDPOINTS } from './config';
import { AuthResponse, LoginCredentials, SignupCredentials, User } from '../types';

const TOKEN_KEY = '@auth_token';

export class AuthService {
  private static instance: AuthService;
  private token: string | null = null;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.token = await AsyncStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.error('Failed to load token:', error);
    }
  }

  async signin(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await axios.post<AuthResponse>(
        `${API_BASE_URL}${API_ENDPOINTS.AUTH.SIGNIN}`,
        credentials
      );
      
      await this.setToken(response.data.token);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  }

  async signup(credentials: SignupCredentials): Promise<AuthResponse> {
    try {
      const response = await axios.post<AuthResponse>(
        `${API_BASE_URL}${API_ENDPOINTS.AUTH.SIGNUP}`,
        credentials
      );
      
      await this.setToken(response.data.token);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Signup failed');
    }
  }

  async getProfile(): Promise<User> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No token found');
      }

      const response = await axios.get<User>(
        `${API_BASE_URL}${API_ENDPOINTS.AUTH.PROFILE}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch profile');
    }
  }

  async logout(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
    this.token = null;
  }

  async getToken(): Promise<string | null> {
    if (!this.token) {
      this.token = await AsyncStorage.getItem(TOKEN_KEY);
    }
    return this.token;
  }

  private async setToken(token: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    this.token = token;
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }
}

export const authService = AuthService.getInstance();
