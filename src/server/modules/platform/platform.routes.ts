// @ts-nocheck
import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { platformAdminAllowed } from "../../config/runtime.js";
import { authRateLimiter } from "../../middleware/rate-limit.middleware.js";
import { postgresDb } from "../../db/postgres.js";

const platformRouter = Router();

// Middleware: Strictly enforce Platform Administrator identity
export async function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;
  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token && req.headers["x-platform-token"]) {
    token = req.headers["x-platform-token"] as string;
  }
  if (!token && req.cookies?.amlak_platform_session) {
    token = req.cookies.amlak_platform_session;
  }
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/amlak_platform_session=([^;]+)/);
    if (match && match[1]) {
      token = decodeURIComponent(match[1].trim());
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: "PLATFORM_UNAUTHORIZED",
        message: "احراز هویت مدیر کلان پلتفرم الزامی است. لطفاً وارد حساب مدیریت پلتفرم شوید."
      }
    });
  }

  const result = await postgresDb.getPlatformSessionByToken(token);
  if (!result || !result.admin || !result.admin.is_active || !platformAdminAllowed(result.admin.username)) {
    return res.status(401).json({
      success: false,
      error: {
        code: "PLATFORM_SESSION_EXPIRED",
        message: "نشست مدیریت پلتفرم منقضی یا باطل شده است. لطفاً مجدداً وارد شوید."
      }
    });
  }

  req.platformAdmin = result.admin;
  next();
}

// --- Platform Admin Dedicated Auth Router ---
const platformAuthRouter = Router();

platformAuthRouter.post("/login", authRateLimiter(), async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || typeof password !== "string" || !username || !password || password.length > 256) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "نام کاربری و رمز عبور الزامی است." }
      });
    }

    const admin = await postgresDb.getPlatformAdminByUsername(username.trim().toLowerCase());
    if (!admin || !admin.is_active || !platformAdminAllowed(admin.username)) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "نام کاربری یا رمز عبور اشتباه است." }
      });
    }

    const isMatch = bcrypt.compareSync(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "نام کاربری یا رمز عبور اشتباه است." }
      });
    }

    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];
    const rawToken = await postgresDb.createPlatformSession(admin.id, clientIp, userAgent);

    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
    res.cookie("amlak_platform_session", rawToken, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const { password_hash, ...safeAdmin } = admin;
    return res.json({
      success: true,
      data: {
        admin: safeAdmin
      },
      message: "ورود به پنل مدیریت کلان پلتفرم با موفقیت انجام شد."
    });
  } catch (err) {
    next(err);
  }
});

platformAuthRouter.post("/logout", async (req, res, next) => {
  try {
    let token = req.cookies?.amlak_platform_session;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (token) {
      await postgresDb.revokePlatformSession(token);
    }
    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
    res.clearCookie("amlak_platform_session", {
      path: "/",
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax"
    });
    return res.json({
      success: true,
      data: { message: "با موفقیت از پنل مدیریت پلتفرم خارج شدید." }
    });
  } catch (err) {
    next(err);
  }
});

platformAuthRouter.get("/me", requirePlatformAdmin, (req, res) => {
  return res.json({
    success: true,
    data: { admin: req.platformAdmin }
  });
});

platformRouter.use("/auth", platformAuthRouter);

// ALL endpoints below this point require authenticated Platform Admin session!
platformRouter.use(requirePlatformAdmin);

platformRouter.get("/metrics", async (req, res, next) => {
  try {
    const metrics = await postgresDb.getPlatformOverviewMetrics();
    return res.json({ success: true, data: metrics });
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/tenants", async (req, res, next) => {
  try {
    const tenants = await postgresDb.getAllTenantsWithStats();
    return res.json({
      success: true,
      data: tenants,
      meta: { total: tenants.length }
    });
  } catch (error) {
    next(error);
  }
});

platformRouter.post("/tenants", async (req, res, next) => {
  try {
    const {
      agency_code,
      name,
      phone,
      email,
      address,
      plan_code,
      trial_days,
      admin_name,
      admin_username,
      admin_password,
      admin_phone
    } = req.body;

    if (!agency_code || !name) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "کد آژانس و نام دفتر املاک الزامی هستند." }
      });
    }

    const cleanUsername = (admin_username || "").trim();
    if (!cleanUsername || cleanUsername.length < 2) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "نام کاربری مدیر آژانس الزامی است (حداقل ۲ کاراکتر)." }
      });
    }

    const cleanPassword = (admin_password || "").trim();
    if (!cleanPassword || cleanPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "رمز عبور مدیر آژانس الزامی است (حداقل ۶ کاراکتر)." }
      });
    }

    // Default duration: 1 week (7 days) as required by P2!
    const created = await postgresDb.createPlatformTenant({
      agency_code,
      name,
      phone,
      email,
      address,
      plan_code: plan_code || "ENTERPRISE_PRO",
      trial_days: trial_days || 7,
      admin_name: (admin_name || "مدیر دفتر").trim(),
      admin_username: cleanUsername,
      admin_password: cleanPassword,
      admin_phone: admin_phone || phone
    }, req.platformAdmin.id);

    return res.status(201).json({
      success: true,
      data: created,
      message: `آژانس املاک جدید با کد ${agency_code} و مدیر ارشد «${cleanUsername}» با موفقیت در سامانه ایجاد شد.`
    });
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        error: { code: "DUPLICATE_AGENCY", message: "دفتر املاکی با این کد یا نام قبلاً ثبت شده است." }
      });
    }
    next(error);
  }
});

platformRouter.patch("/tenants/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status || !["ACTIVE", "SUSPENDED", "INACTIVE"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_STATUS", message: "وضعیت ارسالی نامعتبر است." }
      });
    }

    const updated = await postgresDb.updatePlatformTenantStatus(req.params.id, status, req.platformAdmin.id);
    return res.json({
      success: true,
      data: updated,
      message: `وضعیت دفتر املاک با موفقیت به ${status === "ACTIVE" ? "فعال" : "معلق"} تغییر یافت.`
    });
  } catch (error) {
    next(error);
  }
});

// Delete Tenant, Subscription and ALL related users/data completely
platformRouter.delete("/tenants/:id", async (req, res, next) => {
  try {
    const deleted = await postgresDb.deletePlatformTenant(req.params.id, req.platformAdmin.id);
    return res.json({
      success: true,
      data: deleted,
      message: `دفتر املاک «${deleted.name}» (کد: ${deleted.agency_code}) و کلیه اطلاعات کاربران، فایل‌ها و داده‌های مربوط به آن با موفقیت به طور کامل حذف شدند.`
    });
  } catch (error: any) {
    next(error);
  }
});

// P2 — Manual Subscription Management (1 week, 1 month, 3 months, 6 months, custom)
platformRouter.patch("/tenants/:id/subscription", async (req, res, next) => {
  try {
    const updated = await postgresDb.updatePlatformTenantSubscription(req.params.id, req.body, req.platformAdmin.id);
    return res.json({
      success: true,
      data: updated,
      message: "مشخصات و مهلت اشتراک دفتر املاک با موفقیت توسط مدیریت پلتفرم بروزرسانی شد."
    });
  } catch (error) {
    next(error);
  }
});

// Update Agency Manager Credentials & Details
platformRouter.patch("/tenants/:id/manager", async (req, res, next) => {
  try {
    const { admin_name, admin_username, admin_password, admin_phone } = req.body || {};
    if (admin_username && admin_username.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "نام کاربری مدیر باید حداقل ۲ کاراکتر باشد." }
      });
    }
    if (admin_password && admin_password.trim().length < 6) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "رمز عبور جدید باید حداقل ۶ کاراکتر باشد." }
      });
    }

    const updated = await postgresDb.updatePlatformTenantManager(req.params.id, {
      admin_name,
      admin_username,
      admin_password,
      admin_phone
    }, req.platformAdmin.id);

    return res.json({
      success: true,
      data: updated,
      message: "مشخصات و دسترسی مدیر آژانس با موفقیت بروزرسانی شد."
    });
  } catch (error) {
    next(error);
  }
});

// --- P3: Controlled Read-Only Support Access APIs ---
platformRouter.post("/support/start", async (req, res, next) => {
  try {
    const { tenant_id, reason, duration_minutes } = req.body || {};
    if (!tenant_id || !reason || typeof reason !== "string" || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "شناسه دفتر املاک و درج دلیل مستند (حداقل ۵ کاراکتر) برای ورود به حالت پشتیبانی الزامی است."
        }
      });
    }

    const duration = duration_minutes ? Math.min(120, Math.max(5, Number(duration_minutes))) : 30;
    const session = await postgresDb.createPlatformSupportSession(
      req.platformAdmin.id,
      tenant_id,
      reason.trim(),
      duration
    );

    return res.status(201).json({
      success: true,
      data: session,
      message: "نشست پشتیبانی فقط‌خواندنی با موفقیت آغاز شد."
    });
  } catch (err) {
    next(err);
  }
});

platformRouter.post("/support/end", async (req, res, next) => {
  try {
    const { session_id } = req.body || {};
    if (!session_id) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "شناسه نشست پشتیبانی الزامی است." }
      });
    }

    const ended = await postgresDb.endPlatformSupportSession(session_id, req.platformAdmin.id);
    if (!ended) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "نشست فعال پشتیبانی با این شناسه یافت نشد." }
      });
    }

    return res.json({
      success: true,
      message: "نشست پشتیبانی با موفقیت خاتمه یافت و کلیه دسترسی‌های مربوطه مسدود گردید."
    });
  } catch (err) {
    next(err);
  }
});

platformRouter.get("/support/current", async (req, res, next) => {
  try {
    const currentSession = await postgresDb.getActiveSupportSessionForAdmin(req.platformAdmin.id);
    return res.json({
      success: true,
      data: currentSession
    });
  } catch (err) {
    next(err);
  }
});

platformRouter.get("/support/audit-logs", async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const result = await postgresDb.pg.query(
      `SELECT sal.*, pa.username as admin_username, t.name as tenant_name
       FROM support_audit_logs sal
       JOIN platform_admins pa ON pa.id = sal.admin_id
       JOIN tenants t ON t.id = sal.tenant_id
       ORDER BY sal.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// --- Platform Data Backup & Restore (Export / Import) APIs ---
platformRouter.get("/tenants/:id/export", async (req, res, next) => {
  try {
    const backup = await postgresDb.exportTenantBackup(req.params.id);
    const agencyCode = backup.tenant.agency_code || "AGENCY";
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `backup-${agencyCode}-${dateStr}.json`;

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    next(err);
  }
});

platformRouter.get("/backup/export-all", async (req, res, next) => {
  try {
    const backup = await postgresDb.exportAllTenantsBackup();
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `system-full-backup-${dateStr}.json`;

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    next(err);
  }
});

platformRouter.post("/tenants/import", async (req, res, next) => {
  try {
    const { backup_data, target_tenant_id, override_agency_code, override_name, override_existing } = req.body || {};
    if (!backup_data) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "اطلاعات یا فایل بک‌آپ ارسال نشده است." }
      });
    }

    const result = await postgresDb.importTenantBackup(backup_data, {
      targetTenantId: target_tenant_id,
      overrideAgencyCode: override_agency_code,
      overrideName: override_name,
      overrideExisting: Boolean(override_existing)
    }, req.platformAdmin.id);

    return res.status(200).json({
      success: true,
      message: `اطلاعات دفتر املاک «${result.restored_tenant?.name || ''}» (${result.restored_tenant?.agency_code || ''}) با موفقیت بازیابی شد.`,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

platformRouter.post("/tenants/:id/import", async (req, res, next) => {
  try {
    const { backup_data } = req.body || {};
    if (!backup_data) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "اطلاعات فایل بک‌آپ ارسال نشده است." }
      });
    }

    const result = await postgresDb.importTenantBackup(backup_data, {
      targetTenantId: req.params.id,
      overrideExisting: true
    }, req.platformAdmin.id);

    return res.status(200).json({
      success: true,
      message: `اطلاعات با موفقیت روی دفتر املاک مورد نظر بازیابی شد.`,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

export { platformRouter };
