// @ts-nocheck
import { Router } from "express";
import { postgresDb } from "../../db/postgres.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { subscriptionEnforcementMiddleware } from "../../middleware/subscription.middleware.js";
import { QuickAddTaskSchema } from "../../../shared/validation.js";

import { taskSchedule } from "../../../shared/task-schedule.js";

const tasksRouter = Router();

tasksRouter.use(authMiddleware);
tasksRouter.use(subscriptionEnforcementMiddleware);

tasksRouter.get("/", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    let userId = req.user.id;
    let branchId = (req.query.branch_id as string) || (req.query.branchId as string) || undefined;

    // Constrain role boundaries
    if (req.user.role_code === "AGENT") {
      branchId = req.user.branch_id || undefined;
      userId = req.user.id;
    } else if (req.user.role_code === "BRANCH_MANAGER") {
      branchId = req.user.branch_id || undefined;
      userId = (req.query.user_id as string) || undefined;
    } else {
      userId = (req.query.user_id as string) || undefined;
    }

    const tasks = await postgresDb.getTasks(tenantId, { userId, branch_id: branchId });
    return res.json({ success: true, data: tasks, meta: { total: tasks.length } });
  } catch (error) {
    next(error);
  }
});

tasksRouter.get("/today", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    let userId = req.user.id;
    let branchId = (req.query.branch_id as string) || (req.query.branchId as string) || undefined;

    if (req.user.role_code === "AGENT") {
      branchId = req.user.branch_id || undefined;
      userId = req.user.id;
    } else if (req.user.role_code === "BRANCH_MANAGER") {
      branchId = req.user.branch_id || undefined;
      userId = (req.query.user_id as string) || undefined;
    } else {
      userId = (req.query.user_id as string) || undefined;
    }

    const allTasks = await postgresDb.getTasks(tenantId, { userId, branch_id: branchId });
    const { todayTasks } = taskSchedule(allTasks, new Date(), req.tenant.timezone || "Asia/Tehran");
    return res.json({ success: true, data: todayTasks });
  } catch (error) {
    next(error);
  }
});

tasksRouter.get("/overdue", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    let userId = req.user.id;
    let branchId = (req.query.branch_id as string) || (req.query.branchId as string) || undefined;

    if (req.user.role_code === "AGENT") {
      branchId = req.user.branch_id || undefined;
      userId = req.user.id;
    } else if (req.user.role_code === "BRANCH_MANAGER") {
      branchId = req.user.branch_id || undefined;
      userId = (req.query.user_id as string) || undefined;
    } else {
      userId = (req.query.user_id as string) || undefined;
    }

    const allTasks = await postgresDb.getTasks(tenantId, { userId, branch_id: branchId });
    const { overdueTasks } = taskSchedule(allTasks, new Date(), req.tenant.timezone || "Asia/Tehran");
    return res.json({ success: true, data: overdueTasks });
  } catch (error) {
    next(error);
  }
});

tasksRouter.post("/", async (req, res, next) => {
  try {
    const validated = QuickAddTaskSchema.parse(req.body);
    const tenantId = req.tenant.id;
    const userId = req.user.id;
    let branchId = req.body.branch_id || req.user?.branch_id || undefined;

    if (req.user.role_code === "BRANCH_MANAGER" || req.user.role_code === "AGENT") {
      branchId = req.user.branch_id || undefined;
    }

    // Verify customer belongs to tenant if specified
    if (validated.customer_id) {
      const cust = await postgresDb.getCustomerById(tenantId, validated.customer_id, req.user);
      if (!cust) {
        return res.status(404).json({
          success: false,
          error: { code: "CUSTOMER_NOT_FOUND", message: "متقاضی مرتبط در این دفتر یافت نشد یا دسترسی مجاز نیست." }
        });
      }
    }

    // Verify property belongs to tenant if specified
    if (validated.property_id) {
      const prop = await postgresDb.getPropertyById(tenantId, validated.property_id, req.user);
      if (!prop) {
        return res.status(404).json({
          success: false,
          error: { code: "PROPERTY_NOT_FOUND", message: "ملک مرتبط در این دفتر یافت نشد یا دسترسی مجاز نیست." }
        });
      }
    }

    const task = await postgresDb.createTask(tenantId, userId, {
      title: validated.title,
      description: validated.description,
      customer_id: validated.customer_id,
      property_id: validated.property_id,
      due_at: validated.due_at,
      end_at: validated.end_at,
      priority: validated.priority,
      type: validated.type,
      assigned_to_user_id: validated.assigned_to_user_id || userId,
      branch_id: branchId
    });

    return res.status(201).json({
      success: true,
      data: task,
      message: "پیگیری با موفقیت در پایگاه داده ثبت شد."
    });
  } catch (error) {
    next(error);
  }
});

tasksRouter.patch("/:id/complete", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const userId = req.user.id;
    const { visit_result } = req.body || {};

    const task = await postgresDb.completeTask(tenantId, req.params.id, userId, visit_result);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: { code: "TASK_NOT_FOUND", message: "پیگیری مورد نظر یافت نشد." }
      });
    }
    return res.json({
      success: true,
      data: task,
      message: "پیگیری با موفقیت انجام شد و به بایگانی منتقل گردید."
    });
  } catch (error) {
    next(error);
  }
});

tasksRouter.patch("/:id/cancel", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const userId = req.user.id;

    const task = await postgresDb.cancelTask(tenantId, req.params.id, userId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: { code: "TASK_NOT_FOUND", message: "پیگیری مورد نظر یافت نشد." }
      });
    }
    return res.json({
      success: true,
      data: task,
      message: "پیگیری با موفقیت لغو و بایگانی شد."
    });
  } catch (error) {
    next(error);
  }
});

tasksRouter.patch("/:id", async (req, res, next) => {
  try {
    const validated = QuickAddTaskSchema.partial().parse(req.body);
    const tenantId = req.tenant.id;
    const userId = req.user.id;

    const task = await postgresDb.updateTask(tenantId, req.params.id, userId, validated);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: { code: "TASK_NOT_FOUND", message: "پیگیری مورد نظر یافت نشد." }
      });
    }
    return res.json({
      success: true,
      data: task,
      message: "پیگیری با موفقیت بروزرسانی شد."
    });
  } catch (error) {
    next(error);
  }
});

export { tasksRouter };
