import re

with open('/app/applet/src/server/db/postgres.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update isOfficeAdmin, isBranchManager, isManagerUser
code = re.sub(
    r'isManagerUser\(user\)\{if\(!user\?\.role_code\)return false;return\["BRANCH_MANAGER","ADMIN","OWNER"\]\.includes\(user\.role_code\)\}isOfficeAdmin\(user\)\{if\(!user\?\.role_code\)return false;return\["ADMIN","OWNER"\]\.includes\(user\.role_code\)\}',
    '''isOfficeAdmin(user) {
    if (!user?.role_code) return false;
    return ["ADMIN", "OWNER", "SUPER_ADMIN"].includes(user.role_code);
  }
  isBranchManager(user) {
    if (!user?.role_code) return false;
    return user.role_code === "BRANCH_MANAGER";
  }
  isManagerUser(user) {
    return this.isOfficeAdmin(user) || this.isBranchManager(user);
  }
  canUserAccessBranch(user, branchId) {
    if (this.isOfficeAdmin(user)) return true;
    if (this.isBranchManager(user)) return user.branch_id === branchId;
    return false;
  }''',
    code
)

# 2. Update getPropertyById
code = re.sub(
    r'async getPropertyById\(tenantId,id,requestingUser=null\)\{[\s\S]*?prop\.media=await this\.getPropertyMedia\(tenantId,id\);',
    '''async getPropertyById(tenantId, id, requestingUser = null) {
    await this.init();
    const res = await this.pg.query(
      `SELECT p.*,
              (SELECT file_url FROM property_media pm WHERE pm.property_id = p.id AND pm.is_cover = true LIMIT 1) as cover_image,
              u_creator.display_name as created_by_name,
              u_assignee.display_name as assigned_agent_name
       FROM properties p
       LEFT JOIN users u_creator ON u_creator.id = p.created_by_user_id
       LEFT JOIN users u_assignee ON u_assignee.id = p.assigned_agent_id
       WHERE p.tenant_id = $1 AND p.id = $2
       LIMIT 1`,
      [tenantId, id]
    );
    if (res.rows.length === 0) return null;
    const prop = this.mapPropertyRow(res.rows[0]);

    if (requestingUser) {
      if (requestingUser.tenant_id && requestingUser.tenant_id !== tenantId) {
        return null;
      }
      if (!this.isOfficeAdmin(requestingUser)) {
        if (prop.visibility === "AGENCY") {
          // Permitted across tenant
        } else if (prop.visibility === "BRANCH") {
          const inSameBranch = requestingUser.branch_id && prop.branch_id === requestingUser.branch_id;
          const isOwner = prop.assigned_agent_id === requestingUser.id || prop.created_by_user_id === requestingUser.id;
          if (!inSameBranch && !isOwner) {
            return null;
          }
        } else if (prop.visibility === "PRIVATE") {
          if (this.isBranchManager(requestingUser)) {
            const inSameBranch = requestingUser.branch_id && prop.branch_id === requestingUser.branch_id;
            const isOwner = prop.assigned_agent_id === requestingUser.id || prop.created_by_user_id === requestingUser.id;
            if (!inSameBranch && !isOwner) {
              return null;
            }
          } else {
            if (prop.assigned_agent_id !== requestingUser.id && (prop.assigned_agent_id != null || prop.created_by_user_id !== requestingUser.id)) {
              return null;
            }
          }
        }
      }
    }
    prop.media = await this.getPropertyMedia(tenantId, id);''',
    code
)

# 3. Update getCustomerById
code = re.sub(
    r'async getCustomerById\(tenantId,id,requestingUser=null\)\{[\s\S]*?customer\.requirements=await this\.getCustomerRequirements\(tenantId,id\);',
    '''async getCustomerById(tenantId, id, requestingUser = null) {
    await this.init();
    const res = await this.pg.query(
      `SELECT c.*,
              u_creator.display_name as created_by_name,
              u_assignee.display_name as assigned_agent_name
       FROM customers c
       LEFT JOIN users u_creator ON u_creator.id = c.created_by_user_id
       LEFT JOIN users u_assignee ON u_assignee.id = c.assigned_agent_id
       WHERE c.tenant_id = $1 AND c.id = $2
       LIMIT 1`,
      [tenantId, id]
    );
    if (res.rows.length === 0) return null;
    const customer = this.mapCustomerRow(res.rows[0]);

    if (requestingUser) {
      if (requestingUser.tenant_id && requestingUser.tenant_id !== tenantId) {
        return null;
      }
      if (!this.isOfficeAdmin(requestingUser)) {
        if (customer.visibility === "AGENCY") {
          // Permitted across tenant
        } else if (customer.visibility === "BRANCH") {
          const inSameBranch = requestingUser.branch_id && customer.branch_id === requestingUser.branch_id;
          const isOwner = customer.assigned_agent_id === requestingUser.id || customer.created_by_user_id === requestingUser.id;
          if (!inSameBranch && !isOwner) {
            return null;
          }
        } else if (customer.visibility === "PRIVATE") {
          if (this.isBranchManager(requestingUser)) {
            const inSameBranch = requestingUser.branch_id && customer.branch_id === requestingUser.branch_id;
            const isOwner = customer.assigned_agent_id === requestingUser.id || customer.created_by_user_id === requestingUser.id;
            if (!inSameBranch && !isOwner) {
              return null;
            }
          } else {
            if (customer.assigned_agent_id !== requestingUser.id && (customer.assigned_agent_id != null || customer.created_by_user_id !== requestingUser.id)) {
              return null;
            }
          }
        }
      }
    }
    customer.requirements = await this.getCustomerRequirements(tenantId, id);''',
    code
)

# 4. Update getTransactions & getTransactionById
code = re.sub(
    r'async getTransactions\(tenantId,filters=\{\}\)\{[\s\S]*?return res\.rows\.map\(r=>\(\{[\s\S]*?\}\)\)\}async getTransactionById\(tenantId,transactionId\)\{[\s\S]*?return\{\.\.\.item,final_price:item\.final_price\?Number\(item\.final_price\):void 0,deposit_amount:item\.deposit_amount\?Number\(item\.deposit_amount\):void 0,rent_amount:item\.rent_amount\?Number\(item\.rent_amount\):void 0,documents:docs\.rows,documents_count:docs\.rows\.length\}\}',
    '''async getTransactions(tenantId, filters = {}, requestingUser = null) {
    await this.init();
    const conditions = ["t.tenant_id = $1", "t.is_archived = false"];
    const params = [tenantId];
    let idx = 2;

    if (requestingUser) {
      if (requestingUser.tenant_id && requestingUser.tenant_id !== tenantId) {
        return [];
      }
      if (this.isOfficeAdmin(requestingUser)) {
        if (filters.branch_id && filters.branch_id !== "ALL") {
          conditions.push(`t.branch_id = $${idx++}`);
          params.push(filters.branch_id);
        }
      } else if (this.isBranchManager(requestingUser)) {
        conditions.push(`t.branch_id = $${idx++}`);
        params.push(requestingUser.branch_id || "");
      } else {
        conditions.push(`t.agent_id = $${idx++}`);
        params.push(requestingUser.id);
      }
    } else if (filters.branch_id && filters.branch_id !== "ALL") {
      conditions.push(`t.branch_id = $${idx++}`);
      params.push(filters.branch_id);
    } else if (filters.branchId && filters.branchId !== "ALL") {
      conditions.push(`t.branch_id = $${idx++}`);
      params.push(filters.branchId);
    }

    if (filters.startDate) {
      conditions.push(`t.contract_date >= $${idx++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`t.contract_date <= $${idx++}`);
      params.push(filters.endDate);
    }
    if (filters.type) {
      conditions.push(`t.transaction_type = $${idx++}`);
      params.push(filters.type);
    }
    if (filters.status) {
      conditions.push(`t.status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.agentId && (!requestingUser || this.isOfficeAdmin(requestingUser) || this.isBranchManager(requestingUser))) {
      conditions.push(`t.agent_id = $${idx++}`);
      params.push(filters.agentId);
    }
    if (filters.propertyId) {
      conditions.push(`t.property_id = $${idx++}`);
      params.push(filters.propertyId);
    }
    if (filters.customerId) {
      conditions.push(`t.customer_id = $${idx++}`);
      params.push(filters.customerId);
    }

    const sql = `
      SELECT t.*,
             b.name as branch_name,
             p.title as property_title, p.code as property_code, p.city as property_city, p.neighborhood as property_neighborhood,
             u.display_name as agent_name, u.phone as agent_phone,
             (SELECT COUNT(*)::int FROM documents d WHERE d.transaction_id = t.id AND d.is_archived = false) AS documents_count
      FROM transactions t
      LEFT JOIN branches b ON b.id = t.branch_id
      LEFT JOIN properties p ON p.id = t.property_id
      LEFT JOIN users u ON u.id = t.agent_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY t.contract_date DESC
    `;
    const res = await this.pg.query(sql, params);
    return res.rows.map(r => ({
      ...r,
      final_price: r.final_price ? Number(r.final_price) : void 0,
      deposit_amount: r.deposit_amount ? Number(r.deposit_amount) : void 0,
      rent_amount: r.rent_amount ? Number(r.rent_amount) : void 0,
      documents_count: Number(r.documents_count || 0)
    }));
  }

  async getTransactionById(tenantId, transactionId, requestingUser = null) {
    await this.init();
    const res = await this.pg.query(
      `SELECT t.*,
              b.name as branch_name,
              p.title as property_title, p.code as property_code, p.city as property_city, p.neighborhood as property_neighborhood, p.area_sqm as property_area_sqm,
              u.display_name as agent_name, u.phone as agent_phone
       FROM transactions t
       LEFT JOIN branches b ON b.id = t.branch_id
       LEFT JOIN properties p ON p.id = t.property_id
       LEFT JOIN users u ON u.id = t.agent_id
       WHERE t.tenant_id = $1 AND t.id = $2
       LIMIT 1`,
      [tenantId, transactionId]
    );
    if (res.rows.length === 0) return null;
    const item = res.rows[0];

    if (requestingUser) {
      if (requestingUser.tenant_id && requestingUser.tenant_id !== tenantId) {
        return null;
      }
      if (!this.isOfficeAdmin(requestingUser)) {
        if (this.isBranchManager(requestingUser)) {
          if (item.branch_id !== requestingUser.branch_id) {
            return null;
          }
        } else {
          if (item.agent_id !== requestingUser.id) {
            return null;
          }
        }
      }
    }

    const docs = await this.pg.query(
      `SELECT d.*, u.display_name as uploaded_by_name
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploaded_by_user_id
       WHERE d.tenant_id = $1 AND d.transaction_id = $2 AND d.is_archived = false
       ORDER BY d.created_at DESC`,
      [tenantId, transactionId]
    );
    return {
      ...item,
      final_price: item.final_price ? Number(item.final_price) : void 0,
      deposit_amount: item.deposit_amount ? Number(item.deposit_amount) : void 0,
      rent_amount: item.rent_amount ? Number(item.rent_amount) : void 0,
      documents: docs.rows,
      documents_count: docs.rows.length
    };
  }''',
    code
)

# 5. Update search
code = re.sub(
    r'async search\(tenantId,rawQuery,requestingUser\)\{[\s\S]*?if\(requestingUser&&!this\.isManagerUser\(requestingUser\)\)\{[\s\S]*?\}\s*const\[propRes,custRes\]',
    '''async search(tenantId, rawQuery, requestingUser) {
    await this.init();
    const query = normalizeDigits(rawQuery.trim());
    const searchPattern = `%${query}%`;
    let propVisibilityWhere = "";
    let custVisibilityWhere = "";
    const propParams = [tenantId, searchPattern];
    const custParams = [tenantId, searchPattern];

    if (requestingUser && !this.isOfficeAdmin(requestingUser)) {
      if (this.isBranchManager(requestingUser)) {
        propParams.push(requestingUser.branch_id || "", requestingUser.id);
        propVisibilityWhere = ` AND (p.visibility = 'AGENCY' OR p.branch_id = $3 OR p.assigned_agent_id = $4 OR (p.assigned_agent_id IS NULL AND p.created_by_user_id = $4))`;
        custParams.push(requestingUser.branch_id || "", requestingUser.id);
        custVisibilityWhere = ` AND (c.visibility = 'AGENCY' OR c.branch_id = $3 OR c.assigned_agent_id = $4 OR (c.assigned_agent_id IS NULL AND c.created_by_user_id = $4))`;
      } else {
        propParams.push(requestingUser.branch_id || "", requestingUser.id);
        propVisibilityWhere = ` AND (p.visibility = 'AGENCY' OR (p.visibility = 'BRANCH' AND p.branch_id = $3) OR p.assigned_agent_id = $4 OR (p.assigned_agent_id IS NULL AND p.created_by_user_id = $4))`;
        custParams.push(requestingUser.branch_id || "", requestingUser.id);
        custVisibilityWhere = ` AND (c.visibility = 'AGENCY' OR (c.visibility = 'BRANCH' AND c.branch_id = $3) OR c.assigned_agent_id = $4 OR (c.assigned_agent_id IS NULL AND c.created_by_user_id = $4))`;
      }
    }
    const [propRes, custRes]''',
    code
)

# 6. Update createPlatformTenant default trialDays to 7
code = code.replace(
    'const trialDays=Number(data.trial_days||30);',
    'const trialDays=Number(data.trial_days||7);'
)

# 7. Update updatePlatformTenantSubscription to support approved durations
code = re.sub(
    r'async updatePlatformTenantSubscription\(tenantId,data,actorUserId\)\{[\s\S]*?return tenants\.find\(t=>t\.id===tenantId\)\}\}',
    '''async updatePlatformTenantSubscription(tenantId, data, actorUserId) {
    await this.init();
    const updates = [];
    const params = [tenantId];
    let idx = 2;

    let expiresAt = null;
    if (data.duration) {
      const now = new Date();
      if (data.duration === "1_week") {
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (data.duration === "1_month") {
        const d = new Date(now);
        d.setMonth(d.getMonth() + 1);
        expiresAt = d.toISOString();
      } else if (data.duration === "3_months") {
        const d = new Date(now);
        d.setMonth(d.getMonth() + 3);
        expiresAt = d.toISOString();
      } else if (data.duration === "6_months") {
        const d = new Date(now);
        d.setMonth(d.getMonth() + 6);
        expiresAt = d.toISOString();
      } else if (data.duration === "custom" && data.subscription_expires_at) {
        expiresAt = new Date(data.subscription_expires_at).toISOString();
      }
    } else if (data.subscription_expires_at) {
      expiresAt = new Date(data.subscription_expires_at).toISOString();
    }

    if (expiresAt) {
      updates.push(`subscription_expires_at = $${idx++}`);
      params.push(expiresAt);
    }

    if (data.subscription_start_at) {
      updates.push(`subscription_start_at = $${idx++}`);
      params.push(new Date(data.subscription_start_at).toISOString());
    }

    if (data.subscription_status) {
      updates.push(`subscription_status = $${idx++}`);
      params.push(data.subscription_status);
    } else if (expiresAt) {
      const isNowExpired = new Date(expiresAt) <= new Date();
      updates.push(`subscription_status = $${idx++}`);
      params.push(isNowExpired ? "EXPIRED" : "ACTIVE");
    }

    if (data.plan_code !== void 0) {
      updates.push(`plan_code = $${idx++}`);
      params.push(data.plan_code);
    }
    if (data.max_branches !== void 0) {
      updates.push(`max_branches = $${idx++}`);
      params.push(Number(data.max_branches));
    }
    if (data.max_agents !== void 0) {
      updates.push(`max_agents = $${idx++}`);
      params.push(Number(data.max_agents));
    }

    if (updates.length > 0) {
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      await this.pg.query(`UPDATE tenants SET ${updates.join(", ")} WHERE id = $1`, params);
      await this.addAuditLog(tenantId, actorUserId, "PLATFORM_TENANT_SUBSCRIPTION_UPDATED", "TENANT", tenantId, {
        ...data,
        effective_expires_at: expiresAt
      });
    }

    const tenants = await this.getAllTenantsWithStats();
    return tenants.find(t => t.id === tenantId);
  }

  // --- Platform Admin Identity & Session Methods (P0) ---
  async createPlatformAdmin(data) {
    await this.init();
    const id = crypto.randomUUID();
    const cleanUsername = data.username.trim().toLowerCase();
    await this.pg.query(
      `INSERT INTO platform_admins (id, username, password_hash, display_name, email, phone, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [id, cleanUsername, data.password_hash, data.display_name.trim(), data.email || null, data.phone || null]
    );
    return this.getPlatformAdminById(id);
  }

  async getPlatformAdminByUsername(username) {
    if (!username) return null;
    await this.init();
    const res = await this.pg.query(
      `SELECT * FROM platform_admins WHERE LOWER(username) = LOWER($1) AND is_active = true LIMIT 1`,
      [username.trim()]
    );
    return res.rows[0] || null;
  }

  async getPlatformAdminById(id) {
    if (!id) return null;
    await this.init();
    const res = await this.pg.query(
      `SELECT id, username, display_name, email, phone, is_active, created_at, updated_at
       FROM platform_admins WHERE id = $1 LIMIT 1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async createPlatformSession(adminId, ip = null, ua = null) {
    await this.init();
    const rawToken = "plat_" + crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 864e5).toISOString();
    const id = crypto.randomUUID();
    await this.pg.query(
      `INSERT INTO platform_sessions (id, admin_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, adminId, tokenHash, expiresAt, ip || null, ua || null]
    );
    return rawToken;
  }

  async getPlatformSessionByToken(rawToken) {
    if (!rawToken) return null;
    await this.init();
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const res = await this.pg.query(
      `SELECT ps.*, pa.username, pa.display_name, pa.email, pa.phone, pa.is_active
       FROM platform_sessions ps
       JOIN platform_admins pa ON pa.id = ps.admin_id
       WHERE ps.token_hash = $1 AND ps.expires_at > CURRENT_TIMESTAMP AND pa.is_active = true
       LIMIT 1`,
      [tokenHash]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      session: {
        id: row.id,
        admin_id: row.admin_id,
        token_hash: row.token_hash,
        expires_at: row.expires_at,
        ip_address: row.ip_address,
        user_agent: row.user_agent,
        created_at: row.created_at
      },
      admin: {
        id: row.admin_id,
        username: row.username,
        display_name: row.display_name,
        email: row.email,
        phone: row.phone,
        is_active: row.is_active
      }
    };
  }

  async revokePlatformSession(rawToken) {
    if (!rawToken) return;
    await this.init();
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    await this.pg.query(`DELETE FROM platform_sessions WHERE token_hash = $1`, [tokenHash]);
  }

  async bootstrapPlatformAdminIfConfigured() {
    try {
      const username = process.env.PLATFORM_ADMIN_USERNAME;
      const password = process.env.PLATFORM_ADMIN_PASSWORD;
      if (!username || !password) {
        return;
      }
      const existing = await this.getPlatformAdminByUsername(username);
      if (existing) return;
      const passwordHash = bcrypt.hashSync(password, 10);
      await this.createPlatformAdmin({
        username: username.trim().toLowerCase(),
        password_hash: passwordHash,
        display_name: process.env.PLATFORM_ADMIN_NAME || "مدیر کل پلتفرم",
        email: process.env.PLATFORM_ADMIN_EMAIL || "admin@amlak-os.ir",
        phone: process.env.PLATFORM_ADMIN_PHONE || "09120000000"
      });
      console.log("[Platform Admin] Initial administrator provisioned from secure environment.");
    } catch (err) {
      console.error("[Platform Admin] Bootstrap error:", err);
    }
  }

  // --- Platform Support Session Methods (P3) ---
  async createPlatformSupportSession(adminId, tenantId, reason, durationMinutes = 30) {
    await this.init();
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) {
      throw new Error("دفتر املاک مورد نظر یافت نشد.");
    }
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    await this.pg.query(
      `INSERT INTO platform_support_sessions (id, admin_id, tenant_id, reason, status, started_at, expires_at)
       VALUES ($1, $2, $3, $4, 'ACTIVE', CURRENT_TIMESTAMP, $5)`,
      [id, adminId, tenantId, reason.trim(), expiresAt]
    );
    await this.addSupportAuditLog(id, adminId, tenantId, "SUPPORT_SESSION_STARTED", "TENANT", tenantId, {
      reason: reason.trim(),
      duration_minutes: durationMinutes
    });
    return this.getPlatformSupportSessionById(id);
  }

  async getPlatformSupportSessionById(sessionId) {
    if (!sessionId) return null;
    await this.init();
    const res = await this.pg.query(
      `SELECT ss.*, t.name as tenant_name, t.agency_code, t.status as tenant_status,
              pa.username as admin_username, pa.display_name as admin_display_name
       FROM platform_support_sessions ss
       JOIN tenants t ON t.id = ss.tenant_id
       JOIN platform_admins pa ON pa.id = ss.admin_id
       WHERE ss.id = $1
       LIMIT 1`,
      [sessionId]
    );
    return res.rows[0] || null;
  }

  async endPlatformSupportSession(sessionId, adminId) {
    await this.init();
    const res = await this.pg.query(
      `UPDATE platform_support_sessions
       SET status = 'TERMINATED', ended_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND admin_id = $2 AND status = 'ACTIVE'
       RETURNING *`,
      [sessionId, adminId]
    );
    if (res.rows.length > 0) {
      const session = res.rows[0];
      await this.addSupportAuditLog(sessionId, adminId, session.tenant_id, "SUPPORT_SESSION_TERMINATED", "TENANT", session.tenant_id, {});
      return true;
    }
    return false;
  }

  async getActiveSupportSessionForAdmin(adminId) {
    if (!adminId) return null;
    await this.init();
    const res = await this.pg.query(
      `SELECT ss.*, t.name as tenant_name, t.agency_code, t.status as tenant_status
       FROM platform_support_sessions ss
       JOIN tenants t ON t.id = ss.tenant_id
       WHERE ss.admin_id = $1 AND ss.status = 'ACTIVE' AND ss.expires_at > CURRENT_TIMESTAMP
       ORDER BY ss.started_at DESC
       LIMIT 1`,
      [adminId]
    );
    return res.rows[0] || null;
  }

  async addSupportAuditLog(sessionId, adminId, tenantId, action, resourceType = null, resourceId = null, details = null, ip = null) {
    try {
      await this.init();
      await this.pg.query(
        `INSERT INTO support_audit_logs (id, support_session_id, admin_id, tenant_id, action, resource_type, resource_id, details, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [crypto.randomUUID(), sessionId, adminId, tenantId, action, resourceType, resourceId, details ? JSON.stringify(details) : null, ip]
      );
    } catch (err) {
      console.error("[SupportAudit] Failed to log:", err);
    }
  }
}''',
    code
)

with open('/app/applet/src/server/db/postgres.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print("Python patch applied successfully to postgres.ts!")
