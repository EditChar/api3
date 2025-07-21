import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import pool from '../config/database';
import { User } from '../models/User';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';

// --- Load secrets from .env and ensure they are defined ---
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN_STRING = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

if (!ACCESS_TOKEN_SECRET) {
  console.error('FATAL ERROR: ACCESS_TOKEN_SECRET is not defined in environment variables.');
  process.exit(1);
}
if (!REFRESH_TOKEN_SECRET) {
  console.error('FATAL ERROR: REFRESH_TOKEN_SECRET is not defined in environment variables.');
  process.exit(1);
}

const REFRESH_TOKEN_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000; // Bu sabit kalabilir veya .env'den parse edilebilir
const USER_ACTIVITY_THRESHOLD_MS = 1 * 60 * 60 * 1000; // Bu da sabit kalabilir

const generateAndSaveTokens = async (user: any, res: Response) => {
  const payload = { id: user.id, username: user.username, role: user.role };
  const secret = ACCESS_TOKEN_SECRET;
  const options: SignOptions = { 
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_EXPIRES_IN as any
  };

  const accessToken = jwt.sign(payload, secret, options);

  const refreshTokenValue = uuidv4();
  const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS);

  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [user.id, refreshTokenValue, refreshTokenExpiresAt]
  );
  
  await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [user.id]);

  return { accessToken, refreshToken: refreshTokenValue };
};

export const signup = async (req: Request, res: Response) => {
  const { username, password, email, first_name, last_name, age, country, gender } = req.body;

  if (!username || !password || !email || !first_name || !last_name || !age || !country || !gender) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (username, password, email, first_name, last_name, age, country, gender, role, last_active_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING id, username, email, first_name, last_name, age, country, gender, role, created_at, last_active_at',
      [username, hashedPassword, email, first_name, last_name, age, country, gender, req.body.role || 'user']
    );

    const user = result.rows[0];
    const tokens = await generateAndSaveTokens(user, res);

    res.status(201).json({ ...tokens, user: { id: user.id, username: user.username, email: user.email, first_name: user.first_name, last_name: user.last_name, age: user.age, country: user.country, gender: user.gender, role: user.role } });
  } catch (error: any) {
    if (error.code === '23505') { // unique_violation
      if (error.constraint === 'users_username_key') {
        return res.status(409).json({ message: 'Username already exists' });
      }
      if (error.constraint === 'users_email_key') {
        return res.status(409).json({ message: 'Email already exists' });
      }
    }
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
};

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials (user not found)' });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials (password mismatch)' });
    }

    const tokens = await generateAndSaveTokens(user, res);
    
    res.status(200).json({ ...tokens, user: { id: user.id, username: user.username, role: user.role } });

    // Login başarılı olduktan sonra
    if (user.id) {
      // 🔒 GÜVENLİK: Login sırasında kullanıcının eski notification'larını temizle
      try {
        await pool.query(`
          UPDATE notifications 
          SET is_read = true 
          WHERE user_id = $1 AND created_at < NOW() - INTERVAL '1 day'
        `, [user.id]);
        
        console.log(`🔒 Cleared old notifications for user ${user.id} on login`);
      } catch (cleanupError) {
        console.warn('Error cleaning old notifications on login:', cleanupError);
      }
    }

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
};

export const refreshTokenHandler = async (req: Request, res: Response) => {
  const { refreshToken: providedRefreshToken } = req.body;

  if (!providedRefreshToken) {
    return res.status(401).json({ message: 'Refresh token is required' });
  }

  try {
    const refreshTokenResult = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = $1',
      [providedRefreshToken]
    );

    if (refreshTokenResult.rows.length === 0) {
      return res.status(403).json({ message: 'Invalid or expired refresh token (not found)' });
    }

    const storedToken = refreshTokenResult.rows[0];

    if (new Date(storedToken.expires_at) < new Date()) {
      await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [storedToken.id]);
      return res.status(403).json({ message: 'Refresh token expired' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [storedToken.user_id]);
    if (userResult.rows.length === 0) {
      return res.status(403).json({ message: 'User associated with token not found' });
    }
    const user = userResult.rows[0];

    const payload = { id: user.id, username: user.username, role: user.role };
    const secret = ACCESS_TOKEN_SECRET;
    const options: SignOptions = { 
      algorithm: 'HS256',
      expiresIn: ACCESS_TOKEN_EXPIRES_IN as any
    };

    const newAccessToken = jwt.sign(payload, secret, options);

    let newRefreshTokenValue = providedRefreshToken;

    const lastActiveDate = user.last_active_at ? new Date(user.last_active_at) : new Date(0);
    const isActiveRecently = (Date.now() - lastActiveDate.getTime()) < USER_ACTIVITY_THRESHOLD_MS;

    if (isActiveRecently) {
      newRefreshTokenValue = uuidv4();
      await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [storedToken.id]);
      await pool.query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, newRefreshTokenValue, new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS)]
      );
      console.log(`User ${user.username} was active. Issued new refresh token.`);
    } else {
      console.log(`User ${user.username} was not recently active. Access token refreshed. Refresh token life not extended.`);
    }
    
    await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [user.id]);

    res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshTokenValue,
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ message: 'Error refreshing token' });
  }
};

// --- New Logout Handler ---
export const logout = async (req: AuthenticatedRequest, res: Response) => {
  // authMiddleware should have populated req.user
  const userId = req.user?.id;

  if (!userId) {
    // This case should ideally not be reached if authMiddleware is correctly applied before this handler
    return res.status(400).json({ message: 'User ID not found in request. Ensure authentication.' });
  }

  try {
    // Delete all refresh tokens for the user from the database
    const deleteResult = await pool.query(
      'DELETE FROM refresh_tokens WHERE user_id = $1',
      [userId]
    );

    console.log(`User ${userId} logged out. ${deleteResult.rowCount} refresh token(s) deleted.`);

    // 🔒 GÜVENLİK: Logout sırasında kullanıcının tüm FCM token'larını deaktif et
    await pool.query(`
      UPDATE device_tokens 
      SET is_active = false, updated_at = NOW()
      WHERE user_id = $1 AND is_active = true
    `, [userId]);

    // push_devices tablosundaki token'ları da deaktif et  
    await pool.query(`
      UPDATE push_devices 
      SET is_active = false, last_updated = NOW()
      WHERE user_id = $1 AND is_active = true
    `, [userId]);

    console.log(`🔒 Deactivated all FCM tokens for user ${userId} on logout`);

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Error logging out' });
  }
}; 