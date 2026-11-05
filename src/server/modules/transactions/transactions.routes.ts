// @ts-nocheck
import { Router, Request, Response, NextFunction } from "express";
import { postgresDb } from "../../db/postgres.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { subscriptionEnforcementMiddleware } from "../../middleware/subscription.middleware.js";
import { CreateTransactionSchema, UpdateTransactionSchema } from "../../../shared/validation.js";
import { storageService } from "../../storage/storage.service.js";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

const transactionsRouter = Router();

transactionsRouter.use(authMiddleware);
transactionsRouter.use(subscriptionEnforcementMiddleware);

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
        message: "تنها مدیران شعبه و مدیریت دفتر مجاز به مشاهده گزارش عملکرد و آمار کلی هستند."
      }
    });
  }
  next();
}

// Performance report: Strictly restrict BRANCH_MANAGER to their assigned branch
transactionsRouter.get("/report/performance", requireManagerRole, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fromDate = (req.query.from as string) || thirtyDaysAgo.toISOString();
    const toDate = (req.query.to as string) || now.toISOString();
    let branchId = (req.query.branch_id as string) || (req.query.branchId as string) || undefined;

    // Enforce branch boundary for branch managers
    if (req.user.role_code === "BRANCH_MANAGER") {
      branchId = req.user.branch_id || "";
    }

    const report = await postgresDb.getAgentPerformanceReport(tenantId, fromDate, toDate, branchId);
    return res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
});

// Listing: Pass req.user to enforce agent, branch manager, and office admin authorization (Finding 5)
transactionsRouter.get("/", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const filters = {
      startDate: (req.query.from as string) || (req.query.startDate as string),
      endDate: (req.query.to as string) || (req.query.endDate as string),
      type: (req.query.type as string) || (req.query.transaction_type as string),
      status: req.query.status as string,
      agentId: (req.query.agent_id as string) || (req.query.agentId as string),
      propertyId: (req.query.property_id as string) || (req.query.propertyId as string),
      customerId: (req.query.customer_id as string) || (req.query.customerId as string),
      branch_id: (req.query.branch_id as string) || (req.query.branchId as string) || undefined
    };

    const transactions = await postgresDb.getTransactions(tenantId, filters, req.user);
    return res.json({ success: true, data: transactions });
  } catch (error) {
    next(error);
  }
});

// Single lookup: Pass req.user to enforce branch and ownership access control
transactionsRouter.get("/:id", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const transaction = await postgresDb.getTransactionById(tenantId, req.params.id, req.user);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "معامله مورد نظر یافت نشد." }
      });
    }
    return res.json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
});

// Create transaction
transactionsRouter.post("/", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const userId = req.user.id;
    const userRole = req.user.role_code;
    const isManager = ["BRANCH_MANAGER", "ADMIN", "OWNER"].includes(userRole);
    const validated = CreateTransactionSchema.parse(req.body);

    let assignedAgentId = validated.agent_id;
    if (!isManager || !assignedAgentId) {
      assignedAgentId = userId;
    }

    const property = await postgresDb.getPropertyById(tenantId, validated.property_id, req.user);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: { code: "PROPERTY_NOT_FOUND", message: "ملک انتخابی در سیستم یافت نشد یا دسترسی مجاز نیست." }
      });
    }

    if (userRole === "BRANCH_MANAGER" && property.branch_id && property.branch_id !== req.user.branch_id) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "مدیر شعبه تنها مجاز به ثبت معامله برای ملک‌های شعبه خود است." }
      });
    }

    if (validated.customer_id) {
      const customer = await postgresDb.getCustomerById(tenantId, validated.customer_id, req.user);
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: { code: "CUSTOMER_NOT_FOUND", message: "مشتری یا متقاضی انتخابی در سیستم یافت نشد یا دسترسی مجاز نیست." }
        });
      }
    }

    if (validated.owner_id) {
      const owner = await postgresDb.getOwnerById(tenantId, validated.owner_id);
      if (!owner) {
        return res.status(404).json({
          success: false,
          error: { code: "OWNER_NOT_FOUND", message: "مالک انتخابی در سیستم یافت نشد." }
        });
      }
    }

    const payload = {
      ...validated,
      agent_id: assignedAgentId,
      branch_id: property.branch_id || req.user.branch_id || null,
      document_ids: req.body.document_ids || []
    };

    const transaction = await postgresDb.createTransaction(tenantId, userId, payload);
    return res.status(201).json({
      success: true,
      data: transaction,
      message: "معامله با موفقیت در پایگاه داده ثبت و نهایی گردید."
    });
  } catch (error) {
    next(error);
  }
});

// Update transaction
transactionsRouter.patch("/:id", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const userId = req.user.id;

    // Verify existing transaction access before update
    const existing = await postgresDb.getTransactionById(tenantId, req.params.id, req.user);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "معامله مورد نظر یافت نشد." }
      });
    }

    const validated = UpdateTransactionSchema.parse(req.body);
    // Validate the complete resulting contract, including amounts when changing its type.
    CreateTransactionSchema.parse({ ...existing, contract_date: new Date(existing.contract_date).toISOString(), ...validated });
    const propertyId = validated.property_id || existing.property_id;
    const property = await postgresDb.getPropertyById(tenantId, propertyId, req.user);
    if (!property || (req.user.role_code === "BRANCH_MANAGER" && property.branch_id !== req.user.branch_id)) {
      return res.status(404).json({ success: false, error: { code: "PROPERTY_NOT_FOUND", message: "ملک انتخابی یافت نشد یا دسترسی مجاز نیست." } });
    }
    if (validated.customer_id && !await postgresDb.getCustomerById(tenantId, validated.customer_id, req.user)) {
      return res.status(404).json({ success: false, error: { code: "CUSTOMER_NOT_FOUND", message: "متقاضی انتخابی یافت نشد یا دسترسی مجاز نیست." } });
    }
    if (validated.owner_id && !await postgresDb.getOwnerById(tenantId, validated.owner_id)) {
      return res.status(404).json({ success: false, error: { code: "OWNER_NOT_FOUND", message: "مالک انتخابی یافت نشد." } });
    }
    if (validated.agent_id !== undefined) {
      const agent = validated.agent_id && await postgresDb.getUserById(validated.agent_id);
      const isManager = ["ADMIN", "OWNER", "BRANCH_MANAGER"].includes(req.user.role_code);
      if (!agent || agent.tenant_id !== tenantId || !agent.is_active ||
          (!isManager && agent.id !== req.user.id) ||
          (req.user.role_code === "BRANCH_MANAGER" && agent.branch_id !== req.user.branch_id)) {
        return res.status(403).json({ success: false, error: { code: "INVALID_AGENT", message: "مشاور انتخابی مجاز یا فعال نیست." } });
      }
    }
    validated.branch_id = property.branch_id || existing.branch_id;
    const updated = await postgresDb.updateTransaction(tenantId, userId, req.params.id, validated);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "معامله مورد نظر یافت نشد." }
      });
    }
    return res.json({
      success: true,
      data: updated,
      message: "اطلاعات معامله با موفقیت بروزرسانی شد."
    });
  } catch (error) {
    next(error);
  }
});

// Deletion follows the same tenant, branch and agent access rules as editing.
transactionsRouter.delete("/:id", async (req, res, next) => {
  try {
    const existing = await postgresDb.getTransactionById(req.tenant.id, req.params.id, req.user);
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "معامله مورد نظر یافت نشد." } });
    }
    await postgresDb.deleteTransaction(req.tenant.id, req.user.id, req.params.id);
    return res.json({ success: true, message: "معامله با موفقیت حذف شد." });
  } catch (error) {
    next(error);
  }
});

// Attach document to transaction
transactionsRouter.post(["/:id/documents", "/:id"], upload.single("file"), async (req, res, next) => {
  if (!req.file) {
    return next();
  }
  try {
    const tenantId = req.tenant.id;
    const userId = req.user.id;
    const transactionId = req.params.id;

    const transaction = await postgresDb.getTransactionById(tenantId, transactionId, req.user);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "معامله مورد نظر برای الصاق مدرک یافت نشد." }
      });
    }

    const displayName = req.body.display_name || req.file.originalname;
    const documentType = req.body.document_type || "CONTRACT";
    const description = req.body.description || "مدرک رسمی پیوست معامله";
    const storageKey = await storageService.saveFile(req.file.buffer, req.file.originalname, tenantId);

    const doc = await postgresDb.createDocument(tenantId, userId, {
      file_name: req.file.originalname,
      display_name: displayName,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      storage_key: storageKey,
      document_type: documentType,
      description,
      property_id: transaction.property_id,
      customer_id: transaction.customer_id,
      transaction_id: transactionId
    });

    return res.status(201).json({
      success: true,
      data: doc,
      message: "سند معامله با موفقیت بارگذاری و الصاق شد."
    });
  } catch (error) {
    next(error);
  }
});

export { transactionsRouter };
