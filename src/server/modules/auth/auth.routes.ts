// @ts-nocheck
import { Router } from "express";
import bcrypt from "bcryptjs";
import { postgresDb } from "../../db/postgres.js";
import { LoginSchema, UpdateProfileSchema, ChangePasswordSchema } from "../../../shared/validation.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { authRateLimiter } from "../../middleware/rate-limit.middleware.js";
import { normalizeDigits } from "../../../shared/normalization.js";

const authRouter = Router();

authRouter.post("/login", authRateLimiter(), async (req, res, next) => {
  try {
    const validated = LoginSchema.parse(req.body);
    const agencyCode = normalizeDigits(validated.agency_code || "").trim().toUpperCase();

    if (!agencyCode) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "کد آژانس نامعتبر است." }
      });
    }

    const tenant = await postgresDb.getTenantByAgencyCode(agencyCode);
    if (!tenant) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "کد آژانس یا مشخصات ورود نامعتبر است." }
      });
    }

    // Immediately reject any login attempt if agency is suspended
    const isSuspended = tenant.subscription_status === "SUSPENDED" || tenant.status === "SUSPENDED";
    if (isSuspended) {
      await postgresDb.addAuditLog(tenant.id, null, "LOGIN_BLOCKED_SUSPENDED", "TENANT", tenant.id);
      return res.status(403).json({
        success: false,
        error: {
          code: "AGENCY_SUSPENDED",
          message: "دفتر املاک در حالت تعلیق قرار دارد و دسترسی کلیه کاربران و مدیران مسدود می‌باشد."
        }
      });
    }

    // Reject login if subscription has expired
    const now = new Date();
    const expiresAt = tenant.subscription_expires_at ? new Date(tenant.subscription_expires_at) : null;
    const isExpired = (expiresAt && expiresAt <= now) || tenant.subscription_status === "EXPIRED";
    if (isExpired) {
      await postgresDb.addAuditLog(tenant.id, null, "LOGIN_BLOCKED_EXPIRED", "TENANT", tenant.id);
      return res.status(402).json({
        success: false,
        error: {
          code: "SUBSCRIPTION_EXPIRED",
          message: "مهلت اشتراک دفتر املاک شما به پایان رسیده است. جهت تمدید اشتراک با مدیریت پلتفرم تماس بگیرید."
        }
      });
    }

    const inputUser = validated.username.trim();
    const cleanUser = normalizeDigits(inputUser).toLowerCase();
    let user = await postgresDb.getUserByTenantAndUsername(tenant.id, cleanUser);
    if (!user && cleanUser !== inputUser.toLowerCase()) {
      user = await postgresDb.getUserByTenantAndUsername(tenant.id, inputUser.toLowerCase());
    }

    if (!user) {
      await postgresDb.addAuditLog(tenant.id, null, "LOGIN_FAILED", "USER", null);
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "نام کاربری یا رمز عبور اشتباه است." }
      });
    }

    if (!user.is_active) {
      await postgresDb.addAuditLog(tenant.id, user.id, "LOGIN_BLOCKED_INACTIVE", "USER", user.id);
      return res.status(403).json({
        success: false,
        error: { code: "ACCOUNT_DISABLED", message: "حساب کاربری شما غیرفعال شده است." }
      });
    }

    // Secure password comparison using bcrypt only (NO hardcoded password bypasses)
    const isPasswordValid = bcrypt.compareSync(validated.password, user.password_hash) ||
                            bcrypt.compareSync(normalizeDigits(validated.password), user.password_hash);

    if (!isPasswordValid) {
      await postgresDb.addAuditLog(tenant.id, user.id, "LOGIN_FAILED", "USER", user.id);
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "نام کاربری یا رمز عبور اشتباه است." }
      });
    }

    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];
    const rawToken = await postgresDb.createSession(user.id, tenant.id, clientIp, userAgent);

    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
    res.cookie("amlak_session", rawToken, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax",
      path: "/",
      maxAge: 14 * 24 * 60 * 60 * 1000
    });

    await postgresDb.addAuditLog(tenant.id, user.id, "LOGIN_SUCCESS", "USER", user.id);
    const { password_hash, ...safeUser } = user;
    return res.json({
      success: true,
      data: { token: rawToken, user: safeUser, tenant }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (req, res) => {
  let token = req.cookies?.amlak_session;
  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (token) {
    await postgresDb.revokeSession(token);
  }
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  res.clearCookie("amlak_session", {
    path: "/",
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? "none" : "lax"
  });
  return res.json({
    success: true,
    data: { message: "با موفقیت از سامانه خارج شدید." }
  });
});

authRouter.get("/me", authMiddleware, (req, res) => {
  return res.json({
    success: true,
    data: { user: req.user, tenant: req.tenant }
  });
});

authRouter.patch("/profile", authMiddleware, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const userId = req.user.id;
    const validated = UpdateProfileSchema.parse(req.body);
    const updatedUser = await postgresDb.updateUserProfile(tenantId, userId, validated);
    const { password_hash, ...safeUser } = updatedUser || req.user;
    return res.json({
      success: true,
      data: safeUser,
      message: "پروفایل کاربری با موفقیت بروزرسانی شد."
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/change-password", authMiddleware, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const userId = req.user.id;
    const validated = ChangePasswordSchema.parse(req.body);
    await postgresDb.changeUserPassword(tenantId, userId, validated.current_password, validated.new_password);
    return res.json({
      success: true,
      message: "رمز عبور با موفقیت تغییر یافت. لطفاً با رمز جدید وارد شوید."
    });
  } catch (error) {
    next(error);
  }
});

export { authRouter };
