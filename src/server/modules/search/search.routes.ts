// @ts-nocheck
import { Router } from "express";
import { postgresDb } from "../../db/postgres.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { subscriptionEnforcementMiddleware } from "../../middleware/subscription.middleware.js";

const searchRouter = Router();

searchRouter.use(authMiddleware);
searchRouter.use(subscriptionEnforcementMiddleware);

searchRouter.get("/", async (req, res, next) => {
  try {
    const rawQ = req.query.q;
    const q = typeof rawQ === "string" ? rawQ.trim() : "";
    if (!q) {
      return res.json({ success: true, data: { properties: [], customers: [] } });
    }
    const tenantId = req.tenant.id;
    const results = await postgresDb.search(tenantId, q, req.user);
    return res.json({
      success: true,
      data: results,
      meta: {
        properties_count: results.properties.length,
        customers_count: results.customers.length
      }
    });
  } catch (error) {
    next(error);
  }
});

export { searchRouter };
