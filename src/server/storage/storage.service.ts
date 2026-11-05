import fs from "fs";
import path from "path";
import crypto from "crypto";

export class StorageService {
  private baseDir: string;
  private mediaDir: string;

  constructor() {
    this.baseDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"), "private_documents");
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    this.mediaDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"), "uploads", "properties");
    if (!fs.existsSync(this.mediaDir)) {
      fs.mkdirSync(this.mediaDir, { recursive: true });
    }
  }

  async saveFile(buffer: Buffer, originalName: string, tenantId: string): Promise<string> {
    const tenantDir = path.join(this.baseDir, tenantId);
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }
    const ext = path.extname(originalName) || "";
    const randomHex = crypto.randomBytes(16).toString("hex");
    const filename = `${Date.now()}_${randomHex}${ext}`;
    const filePath = path.join(tenantDir, filename);

    await fs.promises.writeFile(filePath, buffer);
    // Also save copy in root of privateDocsDir for flat basename lookup
    try {
      const flatPath = path.join(this.baseDir, filename);
      await fs.promises.copyFile(filePath, flatPath);
    } catch {}
    return path.join(tenantId, filename);
  }

  async savePropertyMedia(
    tenantId: string,
    propertyId: string,
    originalName: string,
    mimeType: string,
    buffer: Buffer
  ): Promise<{ url: string; fileName: string }> {
    if (!fs.existsSync(this.mediaDir)) {
      fs.mkdirSync(this.mediaDir, { recursive: true });
    }
    const rawExt = path.extname(originalName);
    const ext = rawExt || (mimeType.includes("png") ? ".png" : mimeType.includes("webp") ? ".webp" : mimeType.includes("svg") ? ".svg" : ".jpg");
    const randomHex = crypto.randomBytes(8).toString("hex");
    const safeBase = originalName ? path.basename(originalName, rawExt).replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, "_").slice(0, 30) : "media";
    const filename = `prop_${tenantId.slice(0, 8)}_${propertyId.slice(0, 8)}_${Date.now()}_${randomHex}${ext}`;
    const filePath = path.join(this.mediaDir, filename);

    await fs.promises.writeFile(filePath, buffer);
    return {
      url: `/uploads/properties/${filename}`,
      fileName: originalName || `${safeBase}${ext}`
    };
  }

  getFilePath(storageKey: string, tenantId: string): string | null {
    const safeKey = path.normalize(storageKey).replace(/^(\.\.[\/\\])+/, "");
    const baseName = path.basename(safeKey);
    const candidates = [
      path.join(this.baseDir, safeKey),
      path.join(this.baseDir, tenantId, baseName),
      path.join(this.baseDir, baseName),
      path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"), "uploads", safeKey),
      path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"), "uploads", baseName)
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }
    return null;
  }

  async deleteFile(storageKey: string, tenantId: string): Promise<boolean> {
    const filePath = this.getFilePath(storageKey, tenantId);
    if (!filePath) return false;
    try {
      await fs.promises.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export const storageService = new StorageService();
