// @ts-nocheck
import { Router, Request, Response, NextFunction } from "express";
import { postgresDb } from "../../db/postgres.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { subscriptionEnforcementMiddleware } from "../../middleware/subscription.middleware.js";
import {
  CreateAgentSchema,
  UpdateAgentSchema,
  UpdateAgentStatusSchema,
  ResetPasswordSchema,
  TransferAssetsSchema,
  UpdateTenantSettingsSchema,
  CreateBranchSchema,
  UpdateBranchSchema
} from "../../../shared/validation.js";

const agencyRouter = Router();

function requireManagerRole(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "احراز هویت الزامی است." }
    });
  }
  const role = req.user.role_code;
  if (role !== "BRANCH_MANAGER" && role !== "ADMIN" && role !== "OWNER") {
    return res.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "تنها مدیر شعبه یا مدیر ارشد مجاز به انجام این عملیات است."
      }
    });
  }
  next();
}

function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "احراز هویت الزامی است." }
    });
  }
  const role = req.user.role_code;
  if (role !== "ADMIN" && role !== "OWNER") {
    return res.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "تنها مدیر ارشد دفتر املاک مجاز به دسترسی به این بخش است."
      }
    });
  }
  next();
}

agencyRouter.use(authMiddleware);
agencyRouter.use(subscriptionEnforcementMiddleware);

agencyRouter.get("/branches", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const status = (req.query.status as string) || undefined;
    const branches = await postgresDb.getBranches(tenantId, { status });
    return res.json({ success: true, data: branches });
  } catch (error) {
    next(error);
  }
});

agencyRouter.get("/branches/:id", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const branch = await postgresDb.getBranchById(tenantId, req.params.id);
    if (!branch) {
      return res.status(404).json({
        success: false,
        error: { code: "BRANCH_NOT_FOUND", message: "شعبه مورد نظر یافت نشد." }
      });
    }
    return res.json({ success: true, data: branch });
  } catch (error) {
    next(error);
  }
});

agencyRouter.post("/branches", requireAdminRole, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const actorUserId = req.user.id;
    const validated = CreateBranchSchema.parse(req.body);
    const newBranch = await postgresDb.createBranch(tenantId, actorUserId, validated);
    return res.status(201).json({
      success: true,
      data: newBranch,
      message: `شعبه «${newBranch.name}» با موفقیت ایجاد شد.`
    });
  } catch (error) {
    next(error);
  }
});

agencyRouter.patch("/branches/:id", requireAdminRole, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const actorUserId = req.user.id;
    const validated = UpdateBranchSchema.parse(req.body);
    const updated = await postgresDb.updateBranch(tenantId, actorUserId, req.params.id, validated);
    return res.json({
      success: true,
      data: updated,
      message: `اطلاعات شعبه «${updated.name}» با موفقیت بروزرسانی شد.`
    });
  } catch (error) {
    next(error);
  }
});

agencyRouter.delete("/branches/:id", requireAdminRole, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const actorUserId = req.user.id;
    const targetBranchId = req.query.target_branch_id || req.body?.target_branch_id || undefined;
    await postgresDb.deleteBranch(tenantId, actorUserId, req.params.id, targetBranchId);
    return res.json({ success: true, message: "شعبه مورد نظر با موفقیت غیرفعال شد." });
  } catch (error) {
    next(error);
  }
});

agencyRouter.post("/branches/:id/deactivate", requireAdminRole, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const actorUserId = req.user.id;
    const targetBranchId = req.body?.target_branch_id || req.query.target_branch_id || undefined;
    await postgresDb.deleteBranch(tenantId, actorUserId, req.params.id, targetBranchId);
    return res.json({
      success: true,
      message: "شعبه با موفقیت غیرفعال و در صورت تعیین، پرونده‌ها انتقال یافتند."
    });
  } catch (error) {
    next(error);
  }
});

agencyRouter.get("/agents", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    let branchId = (req.query.branch_id as string) || undefined;
    if (req.user.role_code === "BRANCH_MANAGER") {
      branchId = req.user.branch_id || undefined;
    }
    const agents = await postgresDb.getAgents(tenantId, { branch_id: branchId });
    return res.json({ success: true, data: agents });
  } catch (error) {
    next(error);
  }
});

agencyRouter.get("/agents/:id", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const agent = await postgresDb.getAgentById(tenantId, req.params.id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: { code: "AGENT_NOT_FOUND", message: "مشاور مورد نظر یافت نشد." }
      });
    }
    if (req.user.role_code === "BRANCH_MANAGER" && agent.branch_id !== req.user.branch_id) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "دسترسی به اطلاعات مشاوران سایر شعب مجاز نیست." }
      });
    }
    return res.json({ success: true, data: agent });
  } catch (error) {
    next(error);
  }
});

agencyRouter.get("/agents/:id/workload", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const isSelf = req.user.id === req.params.id;
    const isOfficeAdmin = req.user.role_code === "ADMIN" || req.user.role_code === "OWNER";
    const isBranchManager = req.user.role_code === "BRANCH_MANAGER";

    if (!isSelf && !isOfficeAdmin && !isBranchManager) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "دسترسی به پرونده کاری سایر مشاوران مجاز نیست." }
      });
    }

    if (isBranchManager && !isSelf) {
      const targetAgent = await postgresDb.getAgentById(tenantId, req.params.id);
      if (!targetAgent || targetAgent.branch_id !== req.user.branch_id) {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "مدیر شعبه تنها مجاز به مشاهده کارتابل مشاوران شعبه خود است." }
        });
      }
    }

    const workload = await postgresDb.getAgentWorkload(tenantId, req.params.id);
    return res.json({ success: true, data: workload });
  } catch (error) {
    next(error);
  }
});

agencyRouter.post("/agents", requireManagerRole, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const actorUserId = req.user.id;
    const actorRole = req.user.role_code;
    const validated = CreateAgentSchema.parse(req.body);

    // Enforce branch manager boundary
    if (actorRole === "BRANCH_MANAGER") {
      if (validated.role_code && validated.role_code !== "AGENT") {
        return res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "مدیر شعبه تنها مجاز به ایجاد کاربر با نقش مشاور (AGENT) است."
          }
        });
      }
      // Force agent's branch to match manager's branch
      validated.branch_id = req.user.branch_id;
    }

    const newAgent = await postgresDb.createAgent(tenantId, actorUserId, validated);
    return res.status(201).json({
      success: true,
      data: newAgent,
      message: "مشاور جدید با موفقیت ایجاد و دسترسی ثبت گردید."
    });
  } catch (error) {
    next(error);
  }
});

agencyRouter.patch("/agents/:id", requireManagerRole, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const actorUserId = req.user.id;
    const actorRole = req.user.role_code;

    const targetAgent = await postgresDb.getAgentById(tenantId, req.params.id);
    if (!targetAgent) {
      return res.status(404).json({
        success: false,
        error: { code: "AGENT_NOT_FOUND", message: "مشاور مورد نظر یافت نشد." }
      });
    }

    // Branch manager constraints
    if (actorRole === "BRANCH_MANAGER") {
      if (targetAgent.branch_id !== req.user.branch_id) {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "مدیر شعبه تنها مجاز به ویرایش مشاوران شعبه خود است." }
        });
      }
      if (targetAgent.role_code === "ADMIN" || targetAgent.role_code === "OWNER") {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "امکان ویرایش حساب مدیریت دفتر برای مدیر شعبه وجود ندارد." }
        });
      }
      if (req.body.role_code && req.body.role_code !== "AGENT") {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "ارتقای نقش مشاور به مدیر شعبه یا مدیر دفتر مجاز نیست." }
        });
      }
      if (req.body.branch_id && req.body.branch_id !== req.user.branch_id) {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "تغییر شعبه مشاور به شعبه دیگر مجاز نیست." }
        });
      }
    }

    const validated = UpdateAgentSchema.parse(req.body);
    const updated = await postgresDb.updateAgent(tenantId, actorUserId, req.params.id, validated);
    return res.json({
      success: true,
      data: updated,
      message: "مشخصات مشاور با موفقیت بروزرسانی شد."
    });
  } catch (error) {
    next(error);
  }
});

agencyRouter.patch("/agents/:id/status", requireManagerRole, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const actorUserId = req.user.id;
    const actorRole = req.user.role_code;

    const targetAgent = await postgresDb.getAgentById(tenantId, req.params.id);
    if (!targetAgent) {
      return res.status(404).json({
        success: false,
        error: { code: "AGENT_NOT_FOUND", message: "مشاور مورد نظر یافت نشد." }
      });
    }

    if (actorRole === "BRANCH_MANAGER") {
      if (targetAgent.branch_id !== req.user.branch_id) {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "مدیر شعبه تنها مجاز به تغییر وضعیت مشاوران شعبه خود است." }
        });
      }
      if (targetAgent.role_code === "ADMIN" || targetAgent.role_code === "OWNER") {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "امکان تغییر وضعیت حساب مدیریت دفتر وجود ندارد." }
        });
      }
    }

    const validated = UpdateAgentStatusSchema.parse(req.body);
    const updated = await postgresDb.setAgentStatus(tenantId, actorUserId, req.params.id, validated.is_active);
    return res.json({
      success: true,
      data: updated,
      message: validated.is_active
        ? "حساب کاربری مشاور با موفقیت فعال شد."
        : "حساب کاربری مشاور با موفقیت غیرفعال و نشست‌های فعال آن باطل گردید."
    });
  } catch (error) {
    next(error);
  }
});

agencyRouter.post("/agents/:id/reset-password", requireManagerRole, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const actorUserId = req.user.id;
    const actorRole = req.user.role_code;

    const targetAgent = await postgresDb.getAgentById(tenantId, req.params.id);
    if (!targetAgent) {
      return res.status(404).json({
        success: false,
        error: { code: "AGENT_NOT_FOUND", message: "مشاور مورد نظر یافت نشد." }
      });
    }

    if (actorRole === "BRANCH_MANAGER") {
      if (targetAgent.branch_id !== req.user.branch_id) {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "مدیر شعبه تنها مجاز به بازنشانی رمز مشاوران شعبه خود است." }
        });
      }
      if (targetAgent.role_code === "ADMIN" || targetAgent.role_code === "OWNER") {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "امکان بازنشانی رمز حساب مدیریت دفتر وجود ندارد." }
        });
      }
    }

    const validated = ResetPasswordSchema.parse(req.body);
    await postgresDb.resetAgentPassword(tenantId, actorUserId, req.params.id, validated.password);
    return res.json({
      success: true,
      message: "رمز عبور مشاور با موفقیت بازنشانی شد و نشست‌های قبلی منقضی شدند."
    });
  } catch (error) {
    next(error);
  }
});

agencyRouter.post("/agents/:id/transfer-assets", requireManagerRole, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const actorUserId = req.user.id;
    const sourceAgentId = req.params.id;
    const actorRole = req.user.role_code;
    const validated = TransferAssetsSchema.parse(req.body);

    if (actorRole === "BRANCH_MANAGER") {
      const [source, target] = await Promise.all([
        postgresDb.getAgentById(tenantId, sourceAgentId),
        postgresDb.getAgentById(tenantId, validated.target_agent_id)
      ]);
      if (!source || source.branch_id !== req.user.branch_id || !target || target.branch_id !== req.user.branch_id) {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "انتقال پرونده‌ها تنها بین مشاوران همان شعبه مجاز است." }
        });
      }
    }

    const result = await postgresDb.transferAgentAssets(
      tenantId,
      actorUserId,
      sourceAgentId,
      validated.target_agent_id,
      {
        transferProperties: validated.transfer_properties,
        transferCustomers: validated.transfer_customers,
        transferTasks: validated.transfer_tasks
      }
    );

    return res.json({
      success: true,
      data: result,
      message: `انتقال پرونده‌ها انجام شد: ${result.propertiesTransferred} ملک، ${result.customersTransferred} متقاضی، ${result.tasksTransferred} پیگیری.`
    });
  } catch (error) {
    next(error);
  }
});

agencyRouter.get("/info", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const agents = await postgresDb.getAgents(tenantId);
    const branches = await postgresDb.getBranches(tenantId);
    const activeCount = agents.filter(a => a.is_active).length;
    const inactiveCount = agents.filter(a => !a.is_active).length;
    return res.json({
      success: true,
      data: {
        tenant: req.tenant,
        statistics: {
          total_agents: agents.length,
          active_agents: activeCount,
          inactive_agents: inactiveCount,
          total_branches: branches.length,
          active_branches: branches.filter(b => b.status === "ACTIVE").length
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

agencyRouter.get("/audit-logs", requireManagerRole, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const logs = await postgresDb.getRecentActivities(tenantId, 50);
    return res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
});

// Agency settings MUST require office admin role, not branch manager!
agencyRouter.patch("/settings", requireAdminRole, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const actorUserId = req.user.id;
    const validated = UpdateTenantSettingsSchema.parse(req.body);
    const updatedTenant = await postgresDb.updateTenantSettings(tenantId, actorUserId, validated);
    return res.json({
      success: true,
      data: updatedTenant,
      message: "تنظیمات آژانس با موفقیت بروزرسانی شد."
    });
  } catch (error) {
    next(error);
  }
});

agencyRouter.get("/subscription", requireManagerRole, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const subscription = await postgresDb.getTenantSubscription(tenantId);
    return res.json({ success: true, data: subscription });
  } catch (error) {
    next(error);
  }
});

agencyRouter.post("/subscription/renew", requireManagerRole, async (req, res) => {
  return res.status(403).json({
    success: false,
    error: {
      code: "FORBIDDEN",
      message: "تمدید یا ارتقای پلن اشتراک تنها توسط مدیریت کلان پلتفرم امکان‌پذیر است. لطفاً جهت فعال‌سازی مجدد با پشتیبانی سامانه تماس حاصل فرمایید."
    }
  });
});

export { agencyRouter };
