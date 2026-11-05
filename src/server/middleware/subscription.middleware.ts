// @ts-nocheck
import { Request, Response, NextFunction } from "express";
 
export function subscriptionEnforcementMiddleware(req: Request, res: Response, next: NextFunction) {
  // If request is from an authorized support session, bypass subscription block for investigation
  if (req.supportSession) {
    return next();
  }
 
  const tenant = req.tenant;
  if (!tenant) {
    return next();
  }
 
  const expiry = tenant.subscription_expires_at ? new Date(tenant.subscription_expires_at).getTime() : null;
  const blocked = ["EXPIRED", "SUSPENDED", "CANCELLED"].includes(tenant.subscription_status)
    || (expiry !== null && (!Number.isFinite(expiry) || Date.now() >= expiry));
  if (blocked) {
    return res.status(403).json({ success: false, error: {
      code: "SUBSCRIPTION_EXPIRED",
      message: "اشتراک این دفتر فعال نیست. برای تمدید با مدیریت پلتفرم تماس بگیرید."
    } });
  }
  next();
}
 