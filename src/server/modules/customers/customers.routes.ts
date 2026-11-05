// @ts-nocheck
import { Router } from "express";
import { postgresDb } from "../../db/postgres.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { subscriptionEnforcementMiddleware } from "../../middleware/subscription.middleware.js";
import {
  QuickAddCustomerSchema,
  UpdateCustomerSchema,
  CreateCustomerRequirementSchema,
  CreateInteractionSchema,
  AssignRecordSchema
} from "../../../shared/validation.js";

const customersRouter = Router();

customersRouter.use(authMiddleware);
customersRouter.use(subscriptionEnforcementMiddleware);

customersRouter.get("/", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || "200"), 10) || 200));
    const statusParam = req.query.status ? String(req.query.status) : (req.query.include_archived === "true" ? "archived" : "all");
    let branchId = (req.query.branch_id as string) || (req.query.branchId as string) || undefined;

    // Enforce branch boundary for branch managers and agents
    if (req.user.role_code === "BRANCH_MANAGER" || req.user.role_code === "AGENT") {
      branchId = req.user.branch_id || undefined;
    }

    const { customers, total } = await postgresDb.getCustomersPaginated(
      tenantId,
      {
        page,
        limit,
        status: statusParam,
        visibility: req.query.visibility as string,
        branch_id: branchId,
        search: req.query.search as string,
        customer_type: req.query.customer_type as string,
        lead_status: req.query.lead_status as string,
        temperature: req.query.temperature as string,
        assigned_agent_id: req.query.assigned_agent_id as string,
        sort_by: req.query.sort_by as string
      },
      req.user
    );

    return res.json({
      success: true,
      data: customers,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit) || 1
      }
    });
  } catch (err) {
    next(err);
  }
});

customersRouter.get("/:id", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const customer = await postgresDb.getCustomerById(tenantId, req.params.id, req.user);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: { code: "CUSTOMER_NOT_FOUND", message: "متقاضی مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }
    return res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
});

customersRouter.post("/", async (req, res, next) => {
  try {
    const validated = QuickAddCustomerSchema.parse(req.body);
    const tenantId = req.tenant.id;
    const userId = req.user.id;
    let branchId = req.body.branch_id || req.user?.branch_id || undefined;

    // Branch managers and agents can only create within their assigned branch
    if (req.user.role_code === "BRANCH_MANAGER" || req.user.role_code === "AGENT") {
      branchId = req.user.branch_id || undefined;
    }

    const customer = await postgresDb.createCustomer(tenantId, userId, { ...validated, branch_id: branchId }, req.user.role_code);
    return res.status(201).json({
      success: true,
      data: customer,
      message: `متقاضی «${customer.display_name}» با موفقیت در پایگاه داده ثبت شد.`
    });
  } catch (error) {
    next(error);
  }
});

customersRouter.patch("/:id", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const userId = req.user.id;

    // Verify customer access with req.user before update
    const existing = await postgresDb.getCustomerById(tenantId, req.params.id, req.user);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: "CUSTOMER_NOT_FOUND", message: "متقاضی مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }

    const validated = UpdateCustomerSchema.parse(req.body);
    let branchId = req.body.branch_id;
    if (req.user.role_code === "BRANCH_MANAGER" || req.user.role_code === "AGENT") {
      branchId = existing.branch_id; // prevent cross-branch moving
    }

    const updated = await postgresDb.updateCustomer(
      tenantId,
      req.params.id,
      { ...validated, branch_id: branchId },
      userId,
      req.user.role_code
    );

    return res.json({
      success: true,
      data: updated,
      message: "مشخصات متقاضی با موفقیت به‌روزرسانی شد."
    });
  } catch (error) {
    next(error);
  }
});

customersRouter.patch("/:id/assign", async (req, res, next) => {
  try {
    const role = req.user.role_code;
    if (role !== "BRANCH_MANAGER" && role !== "ADMIN" && role !== "OWNER") {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "تنها مدیریت دفتر مجاز به تخصیص و واگذاری متقاضی به سایر مشاوران است."
        }
      });
    }

    const tenantId = req.tenant.id;
    const validated = AssignRecordSchema.parse(req.body);
    const targetAgentId = validated.assigned_to_user_id || validated.assigned_agent_id;

    // Verify existing customer exists and is accessible
    const existing = await postgresDb.getCustomerById(tenantId, req.params.id, req.user);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: "CUSTOMER_NOT_FOUND", message: "متقاضی مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }

    // Branch manager can only assign within their branch
    if (role === "BRANCH_MANAGER") {
      if (existing.branch_id && existing.branch_id !== req.user.branch_id) {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "مدیر شعبه تنها مجاز به واگذاری پرونده‌های شعبه خود می‌باشد." }
        });
      }
      const targetAgent = await postgresDb.getUserById(targetAgentId);
      if (!targetAgent || targetAgent.tenant_id !== tenantId || targetAgent.branch_id !== req.user.branch_id) {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "مشاور مقصد باید در همین شعبه فعالیت داشته باشد." }
        });
      }
    }

    const updated = await postgresDb.assignCustomer(tenantId, req.params.id, targetAgentId, req.user.id);
    return res.json({
      success: true,
      data: updated,
      message: "پرونده متقاضی با موفقیت به مشاور جدید واگذار شد."
    });
  } catch (error) {
    next(error);
  }
});

customersRouter.post("/:id/archive", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const userId = req.user.id;

    const existing = await postgresDb.getCustomerById(tenantId, req.params.id, req.user);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: "CUSTOMER_NOT_FOUND", message: "متقاضی مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }

    const archived = await postgresDb.archiveCustomer(tenantId, req.params.id, userId);
    return res.json({
      success: true,
      data: archived,
      message: "پرونده متقاضی با موفقیت بایگانی گردید."
    });
  } catch (error) {
    next(error);
  }
});

customersRouter.get("/:id/requirements", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const customer = await postgresDb.getCustomerById(tenantId, req.params.id, req.user);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: { code: "CUSTOMER_NOT_FOUND", message: "متقاضی مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }
    const reqs = await postgresDb.getCustomerRequirements(tenantId, req.params.id);
    return res.json({ success: true, data: reqs });
  } catch (err) {
    next(err);
  }
});

customersRouter.post("/:id/requirements", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const customer = await postgresDb.getCustomerById(tenantId, req.params.id, req.user);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: { code: "CUSTOMER_NOT_FOUND", message: "متقاضی مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }

    const validated = CreateCustomerRequirementSchema.parse(req.body);
    const requirement = await postgresDb.createCustomerRequirement(tenantId, req.params.id, validated, req.user.id);
    return res.status(201).json({
      success: true,
      data: requirement,
      message: "درخواست ملکی جدید متقاضی با موفقیت ثبت شد."
    });
  } catch (error) {
    next(error);
  }
});

customersRouter.get("/:id/timeline", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const customer = await postgresDb.getCustomerById(tenantId, req.params.id, req.user);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: { code: "CUSTOMER_NOT_FOUND", message: "متقاضی مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }
    const timeline = await postgresDb.getCustomerTimeline(tenantId, req.params.id);
    return res.json({ success: true, data: timeline });
  } catch (err) {
    next(err);
  }
});

customersRouter.post("/:id/interactions", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const customer = await postgresDb.getCustomerById(tenantId, req.params.id, req.user);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: { code: "CUSTOMER_NOT_FOUND", message: "متقاضی مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }

    const validated = CreateInteractionSchema.parse(req.body);
    if (validated.property_id) {
      const property = await postgresDb.getPropertyById(tenantId, validated.property_id, req.user);
      if (!property) {
        return res.status(404).json({
          success: false,
          error: { code: "PROPERTY_NOT_FOUND", message: "ملک انتخابی در سیستم یافت نشد یا دسترسی مجاز نیست." }
        });
      }
    }

    const userId = req.user.id;
    const interaction = await postgresDb.createInteraction(tenantId, req.params.id, userId, validated);
    return res.status(201).json({
      success: true,
      data: interaction,
      message: "تعامل و رویداد جدید با موفقیت به سوابق مشتری اضافه شد."
    });
  } catch (error) {
    next(error);
  }
});

customersRouter.get("/:id/matches", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const customer = await postgresDb.getCustomerById(tenantId, req.params.id, req.user);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: { code: "CUSTOMER_NOT_FOUND", message: "متقاضی مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }
    const matches = await postgresDb.getCustomerMatches(tenantId, req.params.id);
    return res.json({ success: true, data: matches, meta: { total: matches.length } });
  } catch (err) {
    next(err);
  }
});

export { customersRouter };
