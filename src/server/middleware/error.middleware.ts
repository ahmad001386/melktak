// @ts-nocheck
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
 
export function errorMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    const issues = err.errors.map(e => ({
      field: e.path.join("."),
      message: e.message
    }));
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: issues[0]?.message || "داده‌های ورودی معتبر نیستند.",
        issues
      }
    });
  }
 
  console.error(`[API Error] ${req.method} ${req.url}:`, err);
 
  const status = err.status || err.statusCode || 500;
  const message = (process.env.NODE_ENV === "production" && status >= 500) ? "خطای داخلی سرور؛ لطفاً دوباره تلاش کنید." : err.message || "خطای غیرمنتظره در سرور رخ داده است.";
  const code = status >= 500 ? "INTERNAL_SERVER_ERROR" : err.code || "REQUEST_ERROR";
 
  return res.status(status).json({
    success: false,
    error: {
      code,
      message
    }
  });
}
 