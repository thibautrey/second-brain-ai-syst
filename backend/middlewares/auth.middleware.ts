import { Request, Response, NextFunction } from 'express';
import { extractToken, verifyToken } from '../services/auth.js';

export interface AuthRequest extends Request {
  userId?: string;
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches userId to request
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.userId = decoded.userId;
  next();
}

/**
 * Optional authentication middleware
 * Tries to verify token, but doesn't fail if not provided
 */
export function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractToken(req.headers.authorization);

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.userId = decoded.userId;
    }
  }

  next();
}
