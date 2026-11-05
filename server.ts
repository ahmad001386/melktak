import { getPlatformPath, validateRuntimeConfig } from "./src/server/config/runtime.js";
var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});import express from"express";import cookieParser from"cookie-parser";import helmet from"helmet";import path from"path";import fs from"fs";import{fileURLToPath}from"url";import{createServer as createViteServer}from"vite";import{postgresDb}from"./src/server/db/postgres.js";import{authRouter}from"./src/server/modules/auth/auth.routes.js";import{agentRouter}from"./src/server/modules/agent/agent.routes.js";import{propertiesRouter}from"./src/server/modules/properties/properties.routes.js";import{customersRouter}from"./src/server/modules/customers/customers.routes.js";import{tasksRouter}from"./src/server/modules/tasks/tasks.routes.js";import{ownersRouter}from"./src/server/modules/owners/owners.routes.js";import{searchRouter}from"./src/server/modules/search/search.routes.js";import{healthRouter}from"./src/server/modules/health/health.routes.js";import{publicRouter}from"./src/server/modules/public/public.routes.js";import{agencyRouter}from"./src/server/modules/agency/agency.routes.js";import{documentsRouter}from"./src/server/modules/documents/documents.routes.js";import{transactionsRouter}from"./src/server/modules/transactions/transactions.routes.js";import{platformRouter}from"./src/server/modules/platform/platform.routes.js";import{platformUiRouter}from"./src/server/modules/platform/platform.ui.js";import{errorMiddleware}from"./src/server/middleware/error.middleware.js";const __filename=fileURLToPath(import.meta.url);const __dirname=path.dirname(__filename);async function startServer(){validateRuntimeConfig();await postgresDb.init();const app=express();if(process.env.TRUST_PROXY)app.set("trust proxy",process.env.TRUST_PROXY.split(",").map(v=>v.trim()));let PORT=process.env.PORT?parseInt(process.env.PORT,10):3e3;const portArgIndex=process.argv.indexOf("--port");if(portArgIndex!==-1&&process.argv[portArgIndex+1]){const parsed=parseInt(process.argv[portArgIndex+1],10);if(!isNaN(parsed)){PORT=parsed}}const isProd=process.env.NODE_ENV==="production";app.use(helmet({
    frameguard: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:", "https:"],
        frameAncestors: ["*"]
      }
    }
  }));
  app.use(express.json({ limit: "20mb" }));
  app.use(cookieParser());
  app.use("/api", (req, res, next) => {
    const method = req.method.toUpperCase();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const origin = req.headers.origin;
      if (origin) {
        try {
          const originUrl = new URL(origin);
          const originHost = originUrl.hostname.toLowerCase();
          const host = (req.headers.host || "").split(":")[0].toLowerCase();
          const forwardedHost = ((req.headers["x-forwarded-host"] as string) || "").split(",")[0].trim().split(":")[0].toLowerCase();

          const isLocal = originHost === "localhost" || originHost === "127.0.0.1";
          const matchesHost = originHost === host || (forwardedHost !== "" && originHost === forwardedHost);
          const isGoogleCloudRun = originHost.endsWith(".run.app");
          const isGoogleAiStudio = originHost.endsWith(".googleusercontent.com") || originHost.endsWith(".aistudio.google.com") || originHost.endsWith(".google.com");
          const isWebHosting = originHost.endsWith(".web.app") || originHost.endsWith(".firebaseapp.com");

          if (!isLocal && !matchesHost && !isGoogleCloudRun && !isGoogleAiStudio && !isWebHosting) {
            return res.status(403).json({
              success: false,
              error: { code: "CSRF_DETECTED", message: "درخواست نامعتبر بین‌سایتی مسدود گردید." }
            });
          }
        } catch {
          return res.status(403).json({
            success: false,
            error: { code: "CSRF_DETECTED", message: "مبدأ درخواست نامعتبر است." }
          });
        }
      }
    }
    next();
  });
  const propertyMediaDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"), "uploads", "properties");
  if (!fs.existsSync(propertyMediaDir)) {
    fs.mkdirSync(propertyMediaDir, { recursive: true });
  }
  app.use("/uploads/properties", express.static(propertyMediaDir));app.use("/api/v1/public",publicRouter);app.use("/api/v1/auth",authRouter);app.use("/api/v1/agent",agentRouter);app.use("/api/v1/agency",agencyRouter);app.use("/api/v1/properties",propertiesRouter);app.use("/api/v1/customers",customersRouter);app.use("/api/v1/owners",ownersRouter);app.use("/api/v1/tasks",tasksRouter);app.use("/api/v1/search",searchRouter);app.use("/api/v1/health",healthRouter);app.use("/api/v1/documents",documentsRouter);app.use("/api/v1/transactions",transactionsRouter);app.use("/api/v1/platform",platformRouter);app.use(getPlatformPath(),platformUiRouter);if(getPlatformPath()!=="/platform")app.use("/platform",(req,res)=>res.sendStatus(404));app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/' || req.path.includes('/assets/')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});
app.use("/assets", express.static(path.resolve(__dirname, "public", "assets")));
app.use("/assets", express.static(path.resolve(__dirname, "dist", "assets")));
app.use(express.static(path.resolve(__dirname, "public")));
app.use(express.static(path.resolve(__dirname, "dist")));app.all("/api/*",(req,res)=>{return res.status(404).json({success:false,error:{code:"NOT_FOUND",message:`\u0645\u0633\u06CC\u0631 \u062F\u0631\u062E\u0648\u0627\u0633\u062A\u06CC \u06CC\u0627\u0641\u062A \u0646\u0634\u062F: ${req.method} ${req.originalUrl}`}})});app.use("/api",errorMiddleware);if(!isProd){const vite=await createViteServer({server:{middlewareMode:true},appType:"spa"});app.use(vite.middlewares);app.use("*",async(req,res,next)=>{if(req.originalUrl.startsWith("/api")){return next()}try{const indexPath=path.resolve(__dirname,"index.html");let template=fs.readFileSync(indexPath,"utf-8");template=await vite.transformIndexHtml(req.originalUrl,template);res.status(200).set({"Content-Type":"text/html"}).end(template)}catch(e){vite.ssrFixStacktrace(e);next(e)}})}else{app.use(express.static(path.resolve(__dirname,"dist")));app.get("*",(req,res)=>{res.sendFile(path.resolve(__dirname,"dist","index.html"))})}const server=app.listen(PORT,"0.0.0.0",()=>{console.log(`[Amlak OS] Server listening at http://0.0.0.0:${PORT} in ${isProd?"production":"development"} mode`)});
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 25000);
  deadline.unref();
  server.close(async () => {
    try { await postgresDb.pg.close(); clearTimeout(deadline); process.exit(0); }
    catch { process.exit(1); }
  });
});
}__name(startServer,"startServer");process.on("uncaughtException",err=>{console.error("[Amlak OS] Uncaught exception:",err)});process.on("unhandledRejection",reason=>{console.error("[Amlak OS] Unhandled rejection:",reason)});startServer().catch(err=>{console.error("[Amlak OS] Critical startup failure:",err);process.exit(1)});
