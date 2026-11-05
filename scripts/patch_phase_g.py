import re

with open('src/server/db/postgres.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Patch linkPropertyOwner to verify both property and owner belong to tenant
old_link = re.search(r'async linkPropertyOwner\(tenantId,propertyId,ownerId,percentage=100,isPrimary=true,notes=null\)\{[\s\S]*?return owners\.find\(o=>o\.owner_id===ownerId\)\}', content)
if old_link:
    new_link = '''async linkPropertyOwner(tenantId, propertyId, ownerId, percentage = 100, isPrimary = true, notes = null) {
    await this.init();
    const propCheck = await this.pg.query(
      `SELECT id FROM properties WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [tenantId, propertyId]
    );
    if (propCheck.rows.length === 0) {
      const err = new Error("ملک مورد نظر در این دفتر یافت نشد.");
      err.status = 404;
      err.code = "PROPERTY_NOT_FOUND";
      throw err;
    }
    const ownerCheck = await this.pg.query(
      `SELECT id FROM owners WHERE tenant_id = $1 AND id = $2 AND is_archived = false LIMIT 1`,
      [tenantId, ownerId]
    );
    if (ownerCheck.rows.length === 0) {
      const err = new Error("مالک مورد نظر در این دفتر یافت نشد.");
      err.status = 404;
      err.code = "OWNER_NOT_FOUND";
      throw err;
    }
    const id = crypto.randomUUID();
    await this.pg.query(
      `INSERT INTO property_owners (id, tenant_id, property_id, owner_id, ownership_percentage, is_primary_owner, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (property_id, owner_id)
       DO UPDATE SET ownership_percentage = $5, is_primary_owner = $6, notes = $7`,
      [id, tenantId, propertyId, ownerId, percentage, isPrimary, notes || null]
    );
    const owners = await this.getPropertyOwners(tenantId, propertyId);
    return owners.find((o) => o.owner_id === ownerId);
  }'''
    content = content.replace(old_link.group(0), new_link)
    print("Patched linkPropertyOwner")
else:
    print("Could not find linkPropertyOwner")

# 2. Patch createCustomerRequirement to verify customer belongs to tenant
old_req = re.search(r'async createCustomerRequirement\(tenantId,customerId,data,userId=null\)\{[\s\S]*?const req=await this\.getCustomerRequirementById\(tenantId,id\);return req\}', content)
if old_req:
    new_req = '''async createCustomerRequirement(tenantId, customerId, data, userId = null) {
    await this.init();
    const custCheck = await this.pg.query(
      `SELECT id FROM customers WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [tenantId, customerId]
    );
    if (custCheck.rows.length === 0) {
      const err = new Error("متقاضی مورد نظر در این دفتر یافت نشد.");
      err.status = 404;
      err.code = "CUSTOMER_NOT_FOUND";
      throw err;
    }
    const id = crypto.randomUUID();
    const listingType = data.transaction_type || data.listing_type || "SALE";
    const city = data.city || data.preferred_city || null;
    const neighborhoods = data.neighborhoods || data.preferred_neighborhoods || null;
    await this.pg.query(
      `INSERT INTO customer_requirements (
        id, tenant_id, customer_id, property_type, listing_type,
        min_budget, max_budget, min_area, max_area, min_bedrooms, max_bedrooms,
        preferred_city, preferred_neighborhoods, needs_parking, needs_elevator,
        needs_storage, needs_balcony, required_features, preferred_features, excluded_features,
        must_have, deal_breakers, priority, notes, is_active
       ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, true
       )`,
      [
        id, tenantId, customerId, data.property_type, listingType,
        data.min_budget || null, data.max_budget || null, data.min_area || null, data.max_area || null, data.min_bedrooms || null, data.max_bedrooms || null,
        city, neighborhoods ? JSON.stringify(neighborhoods) : null,
        data.needs_parking !== void 0 ? Boolean(data.needs_parking) : null,
        data.needs_elevator !== void 0 ? Boolean(data.needs_elevator) : null,
        data.needs_storage !== void 0 ? Boolean(data.needs_storage) : null,
        data.needs_balcony !== void 0 ? Boolean(data.needs_balcony) : null,
        data.required_features ? JSON.stringify(data.required_features) : null,
        data.preferred_features ? JSON.stringify(data.preferred_features) : null,
        data.excluded_features ? JSON.stringify(data.excluded_features) : null,
        data.must_have || null, data.deal_breakers || null, data.priority || "MEDIUM", data.notes || null
      ]
    );
    if (userId) {
      await this.createInteraction(tenantId, customerId, userId, {
        interaction_type: "REQUIREMENT_CREATED",
        title: "ثبت نیازمندی جدید ملک",
        description: `درخواست ${listingType === "SALE" ? "خرید" : "اجاره"} ${data.property_type} با بودجه تا ${data.max_budget ? Number(data.max_budget).toLocaleString("fa-IR") : "آزاد"} تومان`
      });
      await this.addAuditLog(tenantId, userId, "REQUIREMENT_CREATED", "CUSTOMER_REQUIREMENT", id, { customer_id: customerId });
    }
    const req = await this.getCustomerRequirementById(tenantId, id);
    return req;
  }'''
    content = content.replace(old_req.group(0), new_req)
    print("Patched createCustomerRequirement")
else:
    print("Could not find createCustomerRequirement")

# 3. Patch createTask to strictly validate customer_id, property_id, and assigned_to_user_id
old_task = re.search(r'async createTask\(tenantId,userId,data\)\{[\s\S]*?return tasks\.find\(t=>t\.id===id\)\|\|null\}', content)
if old_task:
    new_task = '''async createTask(tenantId, userId, data) {
    await this.init();
    const id = crypto.randomUUID();
    let customerName = data.customer_name || null;
    let customerPhone = data.customer_phone || null;
    let branchId = data.branch_id || null;

    if (data.customer_id) {
      const cust = await this.getCustomerById(tenantId, data.customer_id);
      if (!cust) {
        const err = new Error("متقاضی مرتبط در این دفتر یافت نشد.");
        err.status = 404;
        err.code = "CUSTOMER_NOT_FOUND";
        throw err;
      }
      customerName = cust.display_name;
      customerPhone = cust.phone;
      if (!branchId) branchId = cust.branch_id;
    }

    let propTitle = null;
    let propCode = null;
    if (data.property_id) {
      const prop = await this.getPropertyById(tenantId, data.property_id);
      if (!prop) {
        const err = new Error("ملک مرتبط در این دفتر یافت نشد.");
        err.status = 404;
        err.code = "PROPERTY_NOT_FOUND";
        throw err;
      }
      propTitle = prop.title;
      propCode = prop.code;
      if (!branchId) branchId = prop.branch_id;
    }

    const assignedUserId = data.assigned_to_user_id || data.assigned_user_id || userId;
    const assignedUser = await this.getUserById(assignedUserId);
    if (!assignedUser || assignedUser.tenant_id !== tenantId || !assignedUser.is_active) {
      const err = new Error("مشاور یا کاربر مسئول در این دفتر یافت نشد یا غیرفعال است.");
      err.status = 400;
      err.code = "INVALID_ASSIGNED_USER";
      throw err;
    }

    if (!branchId) {
      branchId = assignedUser.branch_id || null;
    }
    if (!branchId) {
      const u = await this.getUserById(userId);
      branchId = u?.branch_id || null;
    }
    if (!branchId) {
      const branches = await this.getBranches(tenantId);
      branchId = branches.find(b => b.is_main)?.id || branches[0]?.id || null;
    }

    const type = data.type || "FOLLOW_UP";
    const endAt = data.end_at || null;
    const status = data.status || "TODO";

    await this.pg.query(
      `INSERT INTO tasks (
        id, tenant_id, branch_id, assigned_user_id, customer_id, customer_name, customer_phone,
        property_id, property_title, property_code, title, description, due_at,
        priority, status, created_by_user_id, type, end_at
       ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18
       )`,
      [
        id, tenantId, branchId, assignedUserId, data.customer_id || null, customerName, customerPhone,
        data.property_id || null, propTitle, propCode, data.title, data.description || null, data.due_at,
        data.priority || "MEDIUM", status, userId, type, endAt
      ]
    );

    await this.addAuditLog(tenantId, userId, "TASK_CREATED", "TASK", id, {
      title: data.title,
      due_at: data.due_at,
      branch_id: branchId
    });

    const tasks = await this.getTasks(tenantId);
    return tasks.find(t => t.id === id) || null;
  }'''
    content = content.replace(old_task.group(0), new_task)
    print("Patched createTask")
else:
    print("Could not find createTask")

with open('src/server/db/postgres.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patching complete!")
