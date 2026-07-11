import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const jwtSecret = process.env.JWT_SECRET || 'secret';

type JwtPayload = {
  userId: number;
  role: string;
};

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export const authenticate: RequestHandler = (req, res, next) => {
  const authReq = req as AuthRequest;
  const token = authReq.cookies?.token || authReq.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, jwtSecret) as JwtPayload;
    authReq.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export const authorize = (roles: string[]): RequestHandler => (req, res, next) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!roles.includes(authReq.user.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};
