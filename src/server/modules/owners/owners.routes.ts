// @ts-nocheck
import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { subscriptionEnforcementMiddleware } from "../../middleware/subscription.middleware.js";
import { postgresDb } from "../../db/postgres.js";
import { CreateOwnerSchema } from "../../../shared/validation.js";

const ownersRouter = Router();

ownersRouter.use(authMiddleware);
ownersRouter.use(subscriptionEnforcementMiddleware);

ownersRouter.get("/", async (req, res, next) => {
  try {
    const owners = await postgresDb.getOwners(req.tenant.id);
    return res.json({ success: true, data: owners });
  } catch (err) {
    next(err);
  }
});

ownersRouter.get("/:id", async (req, res, next) => {
  try {
    const owner = await postgresDb.getOwnerById(req.tenant.id, req.params.id);
    if (!owner) {
      return res.status(404).json({
        success: false,
        error: { code: "OWNER_NOT_FOUND", message: "مالک مورد نظر یافت نشد." }
      });
    }
    return res.json({ success: true, data: owner });
  } catch (err) {
    next(err);
  }
});

ownersRouter.post("/", async (req, res, next) => {
  try {
    const validated = CreateOwnerSchema.parse(req.body);
    const owner = await postgresDb.createOwner(req.tenant.id, validated, req.user.id);
    return res.status(201).json({
      success: true,
      data: owner,
      message: `مالک «${owner.display_name}» با موفقیت ثبت شد.`
    });
  } catch (err) {
    if (err.code === "DUPLICATE_OWNER") {
      return res.status(409).json({
        success: false,
        error: { code: "DUPLICATE_OWNER", message: err.message }
      });
    }
    next(err);
  }
});

export { ownersRouter };
