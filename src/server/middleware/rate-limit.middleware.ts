// @ts-nocheck
import { Request, Response, NextFunction } from "express";

interface RateRecord {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, RateRecord>();

// Periodic cleanup of expired rate limit entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attempts.entries()) {
    if (now > record.resetAt) {
      attempts.delete(key);
    }
  }
}, 60000).unref();

export function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function authRateLimiter(options = { maxAttempts: 5, maxIpAttempts: 20, windowMs: 15 * 60 * 1000 }) {
  const maxAttempts = options.maxAttempts || 5;
  const maxIpAttempts = options.maxIpAttempts || 20;
  const windowMs = options.windowMs || 15 * 60 * 1000;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const username = req.body?.username ? String(req.body.username).toLowerCase().trim() : "";
    const ipKey = `auth_ip:${ip}`;
    const userKey = username ? `auth_user:${ip}:${username}` : null;
    const now = Date.now();

    // Check IP-wide spray limit
    const ipRecord = attempts.get(ipKey);
    if (ipRecord && ipRecord.count >= maxIpAttempts && now <= ipRecord.resetAt) {
      const remainingMinutes = Math.ceil((ipRecord.resetAt - now) / 60000);
      return res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: `تعداد تلاش‌های ناموفق از این آدرس بیش از حد مجاز است. لطفاً ${remainingMinutes} دقیقه دیگر دوباره تلاش کنید.`
        }
      });
    }

    // Check targeted user limit
    if (userKey) {
      const userRecord = attempts.get(userKey);
      if (userRecord && userRecord.count >= maxAttempts && now <= userRecord.resetAt) {
        const remainingMinutes = Math.ceil((userRecord.resetAt - now) / 60000);
        return res.status(429).json({
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: `تعداد تلاش‌های ناموفق برای این حساب کاربری بیش از حد مجاز است. لطفاً ${remainingMinutes} دقیقه دیگر دوباره تلاش کنید.`
          }
        });
      }
    }

    res.on("finish", () => {
      if (res.statusCode === 401) {
        // Increment IP counter
        const curIp = attempts.get(ipKey);
        if (curIp && Date.now() <= curIp.resetAt) {
          curIp.count += 1;
        } else {
          attempts.set(ipKey, { count: 1, resetAt: Date.now() + windowMs });
        }

        // Increment User counter
        if (userKey) {
          const curUser = attempts.get(userKey);
          if (curUser && Date.now() <= curUser.resetAt) {
            curUser.count += 1;
          } else {
            attempts.set(userKey, { count: 1, resetAt: Date.now() + windowMs });
          }
        }
      } else if (res.statusCode < 400 && userKey) {
        // Reset targeted user attempts on successful login
        attempts.delete(userKey);
      }
    });

    next();
  };
}
