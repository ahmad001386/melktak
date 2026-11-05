// @ts-nocheck
import { Request, Response, NextFunction } from "express";
import { postgresDb } from "../db/postgres.js";

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // --- Check Support Session (Phase P3) ---
  const supportSessionId = req.headers["x-support-session-id"] as string;
  if (supportSessionId) {
    const session = await postgresDb.getSupportSessionById(supportSessionId);
    if (!session || session.status !== "ACTIVE" || new Date(session.expires_at) < new Date()) {
      return res.status(403).json({
        success: false,
        error: { code: "SUPPORT_SESSION_INVALID", message: "نشست پشتیبانی نامعتبر است یا منقضی شده است." }
      });
    }

    // Support sessions are STRICTLY READ-ONLY (GET, HEAD, OPTIONS)
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase())) {
      return res.status(403).json({
        success: false,
        error: { code: "SUPPORT_READ_ONLY", message: "دسترسی در حالت پشتیبانی نظارتی صرفاً خواندنی است و امکان ثبت یا ویرایش داده وجود ندارد." }
      });
    }

    const tenant = await postgresDb.getTenantById(session.tenant_id);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: { code: "TENANT_NOT_FOUND", message: "آژانس مورد نظر یافت نشد." }
      });
    }

    req.tenant = tenant;
    req.supportSession = session;
    req.user = {
      id: "00000000-0000-0000-0000-000000000000",
      username: `support_${session.admin_username || "admin"}`,
      display_name: `ناظر پلتفرم (${session.admin_name || "پشتیبان"})`,
      role_code: "ADMIN",
      branch_id: null,
      is_support: true
    };

    // Log the read action
    postgresDb.logSupportAudit(session.id, session.admin_id, tenant.id, `${req.method} ${req.path}`, "API_ACCESS", null, { query: req.query }).catch(() => {});
    return next();
  }

  // --- Normal Tenant Staff Authentication ---
  let bearerToken: string | undefined;
  if (req.headers.authorization?.startsWith("Bearer ")) {
    bearerToken = req.headers.authorization.split(" ")[1];
  }
  let cookieToken = req.cookies?.amlak_token;
  let queryToken = typeof req.query?.token === "string" ? req.query.token : undefined;

  const token = bearerToken || cookieToken || queryToken;
  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "احراز هویت الزامی است. لطفاً وارد سیستم شوید." }
    });
  }

  const session = await postgresDb.getSessionByToken(token);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: { code: "SESSION_EXPIRED", message: "نشست کاری شما منقضی شده است. لطفاً دوباره وارد شوید." }
    });
  }

  const user = await postgresDb.getUserById(session.user_id);
  if (!user || !user.is_active) {
    return res.status(401).json({
      success: false,
      error: { code: "USER_DEACTIVATED", message: "حساب کاربری شما غیرفعال شده است." }
    });
  }

  const tenant = await postgresDb.getTenantById(user.tenant_id);
  if (!tenant || tenant.status !== "ACTIVE") {
    return res.status(403).json({
      success: false,
      error: { code: "TENANT_INACTIVE", message: "دسترسی این دفتر املاک موقتاً مسدود شده است." }
    });
  }

  req.user = user;
  req.tenant = tenant;
  next();
}
