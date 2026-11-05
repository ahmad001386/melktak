// @ts-nocheck
import { Router } from "express";
import { postgresDb } from "../../db/postgres.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { subscriptionEnforcementMiddleware } from "../../middleware/subscription.middleware.js";
import { storageService } from "../../storage/storage.service.js";
import {
  QuickAddPropertySchema,
  PropertyStatusSchema,
  UpdatePropertySchema,
  LinkPropertyOwnerSchema,
  AssignRecordSchema
} from "../../../shared/validation.js";

const propertiesRouter = Router();

propertiesRouter.use(authMiddleware);
propertiesRouter.use(subscriptionEnforcementMiddleware);

propertiesRouter.get("/", async (req, res, next) => {
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

    const { properties, total } = await postgresDb.getPropertiesPaginated(
      tenantId,
      {
        page,
        limit,
        status: statusParam,
        property_status: req.query.property_status as string,
        visibility: req.query.visibility as string,
        branch_id: branchId,
        search: req.query.search as string,
        district: req.query.district as string,
        neighborhood: req.query.neighborhood as string,
        property_type: req.query.property_type as string,
        listing_type: req.query.listing_type as string,
        min_price: req.query.min_price ? Number(req.query.min_price) : undefined,
        max_price: req.query.max_price ? Number(req.query.max_price) : undefined,
        min_area: req.query.min_area ? Number(req.query.min_area) : undefined,
        max_area: req.query.max_area ? Number(req.query.max_area) : undefined,
        bedrooms: req.query.bedrooms && req.query.bedrooms !== "ALL" ? Number(req.query.bedrooms) : undefined,
        has_parking: req.query.has_parking === "true",
        has_elevator: req.query.has_elevator === "true",
        has_storage: req.query.has_storage === "true",
        has_balcony: req.query.has_balcony === "true",
        sort: req.query.sort as string
      },
      req.user
    );

    return res.json({
      success: true,
      data: properties,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    next(error);
  }
});

propertiesRouter.get("/:id", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const property = await postgresDb.getPropertyById(tenantId, req.params.id, req.user);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: { code: "PROPERTY_NOT_FOUND", message: "ملک مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }
    return res.json({ success: true, data: property });
  } catch (error) {
    next(error);
  }
});

propertiesRouter.post("/", async (req, res, next) => {
  try {
    const validated = QuickAddPropertySchema.parse(req.body);
    const tenantId = req.tenant.id;
    const userId = req.user.id;
    let branchId = req.body.branch_id || req.user?.branch_id || undefined;

    // Branch managers and agents can only create within their assigned branch
    if (req.user.role_code === "BRANCH_MANAGER" || req.user.role_code === "AGENT") {
      branchId = req.user.branch_id || undefined;
    }

    const property = await postgresDb.createProperty(tenantId, userId, { ...validated, branch_id: branchId }, req.user.role_code);
    return res.status(201).json({
      success: true,
      data: property,
      message: `ملک با کد ${property.code} با موفقیت در پایگاه داده ثبت شد.`
    });
  } catch (error) {
    next(error);
  }
});

propertiesRouter.patch("/:id", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const userId = req.user.id;

    // Verify access first
    const existing = await postgresDb.getPropertyById(tenantId, req.params.id, req.user);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: "PROPERTY_NOT_FOUND", message: "ملک مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }

    const validated = UpdatePropertySchema.parse(req.body);
    let branchId = req.body.branch_id;
    if (req.user.role_code === "BRANCH_MANAGER" || req.user.role_code === "AGENT") {
      branchId = existing.branch_id; // prevent cross-branch moving
    }

    const updated = await postgresDb.updateProperty(
      tenantId,
      req.params.id,
      { ...validated, branch_id: branchId },
      userId,
      req.user.role_code
    );

    return res.json({
      success: true,
      data: updated,
      message: "اطلاعات ملک با موفقیت ویرایش گردید."
    });
  } catch (error) {
    next(error);
  }
});

propertiesRouter.patch("/:id/assign", async (req, res, next) => {
  try {
    const role = req.user.role_code;
    if (role !== "BRANCH_MANAGER" && role !== "ADMIN" && role !== "OWNER") {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "تنها مدیریت دفتر مجاز به تخصیص و واگذاری فایل به سایر مشاوران است."
        }
      });
    }

    const tenantId = req.tenant.id;
    const validated = AssignRecordSchema.parse(req.body);
    const targetAgentId = validated.assigned_to_user_id || validated.assigned_agent_id;

    const property = await postgresDb.getPropertyById(tenantId, req.params.id, req.user);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: { code: "PROPERTY_NOT_FOUND", message: "ملک مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }

    if (role === "BRANCH_MANAGER") {
      if (property.branch_id && property.branch_id !== req.user.branch_id) {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "مدیر شعبه تنها مجاز به مدیریت فایل‌های شعبه خود می‌باشد." }
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

    const updated = await postgresDb.assignProperty(tenantId, req.params.id, targetAgentId, req.user.id);
    return res.json({
      success: true,
      data: updated,
      message: "فایل ملک با موفقیت به مشاور جدید واگذار شد."
    });
  } catch (error) {
    next(error);
  }
});

propertiesRouter.patch("/:id/status", async (req, res, next) => {
  try {
    const status = PropertyStatusSchema.parse(req.body.status);
    if (!status) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_STATUS", message: "ارسال وضعیت معتبر الزامی است." }
      });
    }
    const tenantId = req.tenant.id;
    const userId = req.user.id;

    const property = await postgresDb.getPropertyById(tenantId, req.params.id, req.user);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: { code: "PROPERTY_NOT_FOUND", message: "ملک مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }

    const updated = await postgresDb.updatePropertyStatus(tenantId, req.params.id, userId, status);
    return res.json({
      success: true,
      data: updated,
      message: "وضعیت پرونده ملک با موفقیت به‌روزرسانی شد."
    });
  } catch (error) {
    next(error);
  }
});

propertiesRouter.post("/:id/archive", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const userId = req.user.id;

    const property = await postgresDb.getPropertyById(tenantId, req.params.id, req.user);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: { code: "PROPERTY_NOT_FOUND", message: "ملک مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }

    const archived = await postgresDb.archiveProperty(tenantId, req.params.id, userId);
    return res.json({
      success: true,
      data: archived,
      message: "فایل ملکی با موفقیت به بایگانی منتقل شد."
    });
  } catch (error) {
    next(error);
  }
});

propertiesRouter.get("/:id/media", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const property = await postgresDb.getPropertyById(tenantId, req.params.id, req.user);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: { code: "PROPERTY_NOT_FOUND", message: "ملک مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }
    const media = await postgresDb.getPropertyMedia(tenantId, req.params.id);
    return res.json({ success: true, data: media });
  } catch (error) {
    next(error);
  }
});

propertiesRouter.post("/:id/media", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const propertyId = req.params.id;

    const property = await postgresDb.getPropertyById(tenantId, propertyId, req.user);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: { code: "PROPERTY_NOT_FOUND", message: "ملک مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }

    const { file_name, file_url, base64, mime_type, media_type, file_size, is_cover } = req.body;
    let finalUrl = file_url;
    let finalFileName = file_name || "media";
    let finalMime = mime_type || "image/jpeg";
    let finalSize = file_size || 0;

    if (base64) {
      const pureBase64 = base64.replace(/^data:[^;]+;base64,/, "").trim();
      const buffer = Buffer.from(pureBase64, "base64");
      finalSize = buffer.length;
      const saved = await storageService.savePropertyMedia(tenantId, propertyId, finalFileName, finalMime, buffer);
      finalUrl = saved.url;
      finalFileName = saved.fileName;
    }

    if (!finalUrl) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_MEDIA", message: "آدرس یا محتوای فایل الزامی است." }
      });
    }

    const media = await postgresDb.addPropertyMedia(tenantId, propertyId, {
      file_name: finalFileName,
      file_url: finalUrl,
      thumbnail_url: finalUrl,
      media_type: media_type === "VIDEO" ? "VIDEO" : "IMAGE",
      mime_type: finalMime,
      file_size: finalSize,
      is_cover: Boolean(is_cover)
    });

    return res.status(201).json({
      success: true,
      data: media,
      message: "تصویر/رسانه با موفقیت ذخیره گردید."
    });
  } catch (error) {
    next(error);
  }
});

propertiesRouter.patch("/:id/media/:mediaId/cover", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const propertyId = req.params.id;
    const mediaId = req.params.mediaId;

    const property = await postgresDb.getPropertyById(tenantId, propertyId, req.user);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: { code: "PROPERTY_NOT_FOUND", message: "ملک مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }

    const updated = await postgresDb.updatePropertyMedia(tenantId, propertyId, mediaId, { is_cover: true });
    return res.json({
      success: true,
      data: updated,
      message: "تصویر شاخص ملک به‌روزرسانی شد."
    });
  } catch (error) {
    next(error);
  }
});

propertiesRouter.delete("/:id/media/:mediaId", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const propertyId = req.params.id;
    const mediaId = req.params.mediaId;

    const property = await postgresDb.getPropertyById(tenantId, propertyId, req.user);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: { code: "PROPERTY_NOT_FOUND", message: "ملک مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }

    const deleted = await postgresDb.deletePropertyMedia(tenantId, propertyId, mediaId);
    return res.json({
      success: deleted,
      message: deleted ? "رسانه حذف گردید." : "رسانه یافت نشد."
    });
  } catch (error) {
    next(error);
  }
});

propertiesRouter.post("/:id/share", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const propertyId = req.params.id;
    const userId = req.user.id;
    const { customer_id, channel, notes } = req.body;

    const property = await postgresDb.getPropertyById(tenantId, propertyId, req.user);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: { code: "PROPERTY_NOT_FOUND", message: "ملک یافت نشد یا دسترسی مجاز نیست." }
      });
    }

    const token = await postgresDb.generateOrGetPropertyShareToken(tenantId, propertyId);
    const shareUrl = `/shared/property/${token}`;
    let interaction = null;

    if (customer_id) {
      const customer = await postgresDb.getCustomerById(tenantId, customer_id, req.user);
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: { code: "CUSTOMER_NOT_FOUND", message: "مشتری مورد نظر یافت نشد یا دسترسی مجاز نیست." }
        });
      }

      const channelLabel = channel === "WHATSAPP" ? "واتس‌اپ" : channel === "SMS" ? "پیامک" : "لینک اختصاصی";
      const interactionTitle = `ارسال مشخصات ملک کد ${property.code} (${property.title})`;
      const interactionDesc = notes
        ? `${notes} (کانال: ${channelLabel})`
        : `ارسال لینک آنلاین فایل ملکی از طریق ${channelLabel}`;

      interaction = await postgresDb.createInteraction(tenantId, customer_id, userId, {
        interaction_type: "PROPERTY_SENT",
        title: interactionTitle,
        description: interactionDesc,
        property_id: property.id
      });

      await postgresDb.addAuditLog(tenantId, userId, "PROPERTY_SHARED", "PROPERTY", property.id, {
        customer_id,
        customer_name: customer?.display_name,
        channel,
        share_token: token
      });
    }

    return res.json({
      success: true,
      data: {
        share_token: token,
        share_url: shareUrl,
        property_code: property.code,
        property_title: property.title,
        interaction
      },
      message: customer_id
        ? "لینک امن تولید و رویداد ارسال در سوابق و تایم‌لاین مشتری ثبت گردید."
        : "لینک امن اشتراک‌گذاری ملک با موفقیت ایجاد شد."
    });
  } catch (error) {
    next(error);
  }
});

propertiesRouter.get("/:id/matches", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const property = await postgresDb.getPropertyById(tenantId, req.params.id, req.user);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: { code: "PROPERTY_NOT_FOUND", message: "ملک مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }

    const matches = await postgresDb.getPropertyMatches(tenantId, req.params.id);
    return res.json({ success: true, data: matches, meta: { total: matches.length } });
  } catch (error) {
    next(error);
  }
});

propertiesRouter.get("/:id/owners", async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const property = await postgresDb.getPropertyById(tenantId, req.params.id, req.user);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: { code: "PROPERTY_NOT_FOUND", message: "ملک مورد نظر یافت نشد یا دسترسی مجاز نیست." }
      });
    }

    const owners = await postgresDb.getPropertyOwners(tenantId, req.params.id);
    return res.json({ success: true, data: owners });
  } catch (error) {
    next(error);
  }
});

propertiesRouter.post("/:id/owners", async (req, res, next) => {
  try {
    const validated = LinkPropertyOwnerSchema.parse(req.body);
    const tenantId = req.tenant.id;

    // Verify property belongs to tenant and user has access
    const property = await postgresDb.getPropertyById(tenantId, req.params.id, req.user);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: { code: "PROPERTY_NOT_FOUND", message: "ملک مورد نظر در این دفتر یافت نشد یا دسترسی مجاز نیست." }
      });
    }

    // Verify owner belongs to tenant
    const owner = await postgresDb.getOwnerById(tenantId, validated.owner_id);
    if (!owner) {
      return res.status(404).json({
        success: false,
        error: { code: "OWNER_NOT_FOUND", message: "مالک مورد نظر در این دفتر یافت نشد." }
      });
    }

    const linked = await postgresDb.linkPropertyOwner(
      tenantId,
      req.params.id,
      validated.owner_id,
      validated.ownership_percentage,
      validated.is_primary_owner,
      validated.notes
    );

    return res.status(201).json({
      success: true,
      data: linked,
      message: "ارتباط مالک با ملک با موفقیت برقرار شد."
    });
  } catch (error) {
    next(error);
  }
});

export { propertiesRouter };
