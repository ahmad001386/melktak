// @ts-nocheck
import { getPlatformCredentials } from "../config/runtime.js";
var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});var __defProp2=Object.defineProperty;var __name2=__name((target,value)=>__defProp2(target,"name",{value,configurable:true}),"__name");var __defProp22=Object.defineProperty;var __name22=__name2((target,value)=>__defProp22(target,"name",{value,configurable:true}),"__name");import fs from"fs";import path from"path";import crypto from"crypto";import bcrypt from"bcryptjs";import{PGlite}from"@electric-sql/pglite";import{normalizeIranianPhone,normalizeDigits}from"../../shared/normalization.js";class PostgresDatabase{public pg!: PGlite;static{__name(this,"PostgresDatabase")}static{__name2(this,"PostgresDatabase")}constructor(){this.isInitialized=false;this.initializationPromise=null}static{__name22(this,"PostgresDatabase")}async init(){if(this.isInitialized)return;if(this.initializationPromise)return this.initializationPromise;this.initializationPromise=this.initializeDatabase();try{await this.initializationPromise}catch(err){this.initializationPromise=null;throw err}}async initializeDatabase() {
    const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"), "amlak_postgres");
    getPlatformCredentials();
    if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO_DATA === "true") throw new Error("Demo seeding is forbidden in production.");
    fs.mkdirSync(dataDir, { recursive: true });
    try {
      this.pg = new PGlite(dataDir);
      await this.pg.waitReady;
      await this.applyMigrations();
      await this.removeDemoLogins();
      await this.bootstrapPlatformAdminIfConfigured();
      this.isInitialized = true;
    } catch (error) {
      if (this.pg) await this.pg.close().catch(() => {});
      // Never remove the database, PID files, or silently switch to memory.
      throw error;
    }
  }
  async removeDemoLogins() {
    // Preserve foreign-key references (contracts, documents, tasks and audit history).
    const tenantId = 'e2b17b3c-53f0-466d-9279-d102e5b7b001';
    const identities = [
      ['c1a11111-2222-3333-4444-555555555551', 'agent'],
      ['c1a11111-2222-3333-4444-555555555552', 'manager'],
      ['c1a11111-2222-3333-4444-555555555553', 'admin'],
      ['c1a11111-2222-3333-4444-555555555554', 'ahmadreza'],
      ['c1a11111-9999-9999-9999-999999999999', 'superadmin']
    ];
    await this.pg.transaction(async tx => {
      for (const [id, username] of identities) {
        const result = await tx.query(`UPDATE users SET
          username = $4, password_hash = $5, is_active = false,
          first_name = 'بایگانی', last_name = '', display_name = 'حساب نمونه حذف‌شده',
          phone = NULL, email = NULL, avatar_url = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND tenant_id = $2 AND username = $3 RETURNING id`,
          [id, tenantId, username, 'archived-' + id, bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10)]);
        if (result.rows.length) await tx.query('DELETE FROM sessions WHERE user_id = $1', [id]);
      }
    });
  }
  async withTenantContext(tenantId,callback){await this.init();try{await this.pg.query(`SELECT set_config('app.current_tenant_id', $1, false)`,[tenantId]);return await callback()}finally{await this.pg.query(`SELECT set_config('app.current_tenant_id', '', false)`).catch(()=>{})}}async applyMigrations(){await this.pg.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY,
        agency_code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(150),
        address TEXT,
        timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Tehran',
        locale VARCHAR(20) NOT NULL DEFAULT 'fa-IR',
        currency VARCHAR(10) NOT NULL DEFAULT 'IRR',
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        plan_code VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        username VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        display_name VARCHAR(200) NOT NULL,
        phone VARCHAR(50),
        avatar_url TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        role_code VARCHAR(50) NOT NULL DEFAULT 'AGENT',
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT users_tenant_username_unique UNIQUE (tenant_id, username)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS tenant_counters (
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        counter_type VARCHAR(50) NOT NULL,
        last_val BIGINT NOT NULL DEFAULT 1000,
        PRIMARY KEY (tenant_id, counter_type)
      );

      CREATE TABLE IF NOT EXISTS properties (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        branch_id UUID,
        code VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        property_type VARCHAR(50) NOT NULL,
        listing_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        price_total BIGINT,
        price_per_meter BIGINT,
        rent_amount BIGINT,
        deposit_amount BIGINT,
        area_sqm DECIMAL(10,2) NOT NULL,
        bedrooms SMALLINT,
        floor SMALLINT,
        year_built SMALLINT,
        has_parking BOOLEAN NOT NULL DEFAULT false,
        has_storage BOOLEAN NOT NULL DEFAULT false,
        has_elevator BOOLEAN NOT NULL DEFAULT false,
        has_balcony BOOLEAN NOT NULL DEFAULT false,
        description TEXT,
        province VARCHAR(100) NOT NULL DEFAULT '\u062A\u0647\u0631\u0627\u0646',
        city VARCHAR(100) NOT NULL DEFAULT '\u062A\u0647\u0631\u0627\u0646',
        neighborhood VARCHAR(150),
        street VARCHAR(150),
        location_precision VARCHAR(50) NOT NULL DEFAULT 'APPROXIMATE',
        assigned_agent_id UUID,
        created_by_user_id UUID NOT NULL,
        is_archived BOOLEAN NOT NULL DEFAULT false,
        archived_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT properties_tenant_code_unique UNIQUE (tenant_id, code)
      );

      CREATE TABLE IF NOT EXISTS owners (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        display_name VARCHAR(200) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        secondary_phone VARCHAR(50),
        email VARCHAR(150),
        national_id VARCHAR(50),
        address TEXT,
        notes TEXT,
        is_archived BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT owners_tenant_phone_unique UNIQUE (tenant_id, phone)
      );

      CREATE TABLE IF NOT EXISTS property_owners (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
        ownership_percentage DECIMAL(5, 2) DEFAULT 100.0,
        is_primary_owner BOOLEAN NOT NULL DEFAULT true,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT property_owners_unique UNIQUE (property_id, owner_id)
      );

      CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        branch_id UUID,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        display_name VARCHAR(200) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        secondary_phone VARCHAR(50),
        email VARCHAR(150),
        customer_type VARCHAR(50) NOT NULL DEFAULT 'BUYER',
        lead_status VARCHAR(50) NOT NULL DEFAULT 'NEW',
        temperature VARCHAR(20) NOT NULL DEFAULT 'WARM',
        budget_min BIGINT,
        budget_max BIGINT,
        preferred_city VARCHAR(100),
        preferred_area_text VARCHAR(255),
        notes TEXT,
        assigned_agent_id UUID,
        created_by_user_id UUID NOT NULL,
        is_archived BOOLEAN NOT NULL DEFAULT false,
        archived_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_interaction_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT customers_tenant_phone_unique UNIQUE (tenant_id, phone)
      );

      CREATE TABLE IF NOT EXISTS customer_requirements (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        property_type VARCHAR(50) NOT NULL,
        listing_type VARCHAR(50) NOT NULL,
        min_budget BIGINT,
        max_budget BIGINT,
        min_area DECIMAL(10,2),
        max_area DECIMAL(10,2),
        min_bedrooms SMALLINT,
        max_bedrooms SMALLINT,
        preferred_city VARCHAR(100),
        preferred_neighborhoods JSONB,
        needs_parking BOOLEAN,
        needs_elevator BOOLEAN,
        needs_storage BOOLEAN,
        needs_balcony BOOLEAN,
        must_have TEXT,
        deal_breakers TEXT,
        priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
        is_active BOOLEAN NOT NULL DEFAULT true,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        assigned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
        customer_name VARCHAR(200),
        customer_phone VARCHAR(50),
        property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
        property_title VARCHAR(255),
        property_code VARCHAR(50),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        due_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
        status VARCHAR(20) NOT NULL DEFAULT 'TODO',
        created_by_user_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS interactions (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
        interaction_type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        actor_user_id UUID,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(100),
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_properties_tenant ON properties(tenant_id, status);
      CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone ON customers(tenant_id, phone);
      CREATE INDEX IF NOT EXISTS idx_tasks_tenant_due ON tasks(tenant_id, assigned_user_id, due_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_owners_tenant_phone ON owners(tenant_id, phone);
      CREATE INDEX IF NOT EXISTS idx_property_owners ON property_owners(tenant_id, property_id, owner_id);
      CREATE INDEX IF NOT EXISTS idx_customer_requirements ON customer_requirements(tenant_id, customer_id);
      CREATE INDEX IF NOT EXISTS idx_interactions_customer ON interactions(tenant_id, customer_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);

      ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_shareable BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS share_token VARCHAR(64) UNIQUE;
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS district VARCHAR(150);
      CREATE INDEX IF NOT EXISTS idx_properties_district ON properties(tenant_id, district);

      CREATE TABLE IF NOT EXISTS property_media (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        thumbnail_url TEXT,
        media_type VARCHAR(20) NOT NULL DEFAULT 'IMAGE',
        mime_type VARCHAR(100) NOT NULL,
        file_size INT NOT NULL DEFAULT 0,
        width INT,
        height INT,
        sort_order INT NOT NULL DEFAULT 0,
        is_cover BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_property_media ON property_media(tenant_id, property_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_properties_share_token ON properties(share_token);

      -- Configure PostgreSQL Row-Level Security (RLS)
      ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
      ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
      ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
      ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
      ALTER TABLE property_owners ENABLE ROW LEVEL SECURITY;
      ALTER TABLE customer_requirements ENABLE ROW LEVEL SECURITY;
      ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE property_media ENABLE ROW LEVEL SECURITY;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rls_properties') THEN
          CREATE POLICY rls_properties ON properties FOR ALL USING (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            OR NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
          );
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rls_customers') THEN
          CREATE POLICY rls_customers ON customers FOR ALL USING (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            OR NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
          );
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rls_property_media') THEN
          CREATE POLICY rls_property_media ON property_media FOR ALL USING (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            OR NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
          );
        END IF;
      END $$;

      -- Phase 4: CRM Core Extensions
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150);
      CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role_code);
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS code VARCHAR(50);
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS lead_source VARCHAR(100) DEFAULT 'IN_PERSON';
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ;

      ALTER TABLE customer_requirements ADD COLUMN IF NOT EXISTS required_features JSONB;
      ALTER TABLE customer_requirements ADD COLUMN IF NOT EXISTS preferred_features JSONB;
      ALTER TABLE customer_requirements ADD COLUMN IF NOT EXISTS excluded_features JSONB;

      CREATE TABLE IF NOT EXISTS customer_property_interactions (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        interaction_type VARCHAR(50) NOT NULL DEFAULT 'SHARED',
        status VARCHAR(50) NOT NULL DEFAULT 'SENT',
        reaction VARCHAR(50),
        reaction_reason VARCHAR(100),
        reaction_notes TEXT,
        shared_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        viewed_at TIMESTAMPTZ,
        visited_at TIMESTAMPTZ,
        created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT customer_property_unique UNIQUE (tenant_id, customer_id, property_id)
      );

      CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(tenant_id, code);
      CREATE INDEX IF NOT EXISTS idx_customers_next_follow_up ON customers(tenant_id, next_follow_up_at);
      CREATE INDEX IF NOT EXISTS idx_cust_prop_interactions ON customer_property_interactions(tenant_id, customer_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_prop_cust_interactions ON customer_property_interactions(tenant_id, property_id);

      ALTER TABLE customer_property_interactions ENABLE ROW LEVEL SECURITY;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rls_cust_prop_interactions') THEN
          CREATE POLICY rls_cust_prop_interactions ON customer_property_interactions FOR ALL USING (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            OR NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
          );
        END IF;
      END $$;

      -- Phase B2: Data Visibility & Access Control
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'AGENCY';
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'AGENCY';
      CREATE INDEX IF NOT EXISTS idx_properties_visibility ON properties(tenant_id, visibility);
      CREATE INDEX IF NOT EXISTS idx_customers_visibility ON customers(tenant_id, visibility);
      CREATE INDEX IF NOT EXISTS idx_properties_assigned_agent ON properties(tenant_id, assigned_agent_id);
      CREATE INDEX IF NOT EXISTS idx_customers_assigned_agent ON customers(tenant_id, assigned_agent_id);
      CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(tenant_id, created_by_user_id);
      CREATE INDEX IF NOT EXISTS idx_customers_created_by ON customers(tenant_id, created_by_user_id);

      -- Phase C: Activities / Unified Follow-up System
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'FOLLOW_UP';
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS visit_result VARCHAR(100);
      CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(tenant_id, type);
      CREATE INDEX IF NOT EXISTS idx_tasks_start_at ON tasks(tenant_id, due_at);

      -- Phase D1: Secure Document Management
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size BIGINT NOT NULL,
        storage_key VARCHAR(500) NOT NULL,
        document_type VARCHAR(50) NOT NULL,
        description TEXT,
        property_id UUID REFERENCES properties(id) ON DELETE CASCADE NULL,
        customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NULL,
        transaction_id UUID NULL,
        uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        archived_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_documents_property ON documents(tenant_id, property_id);
      CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents(tenant_id, customer_id);
      CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(tenant_id, document_type);

      -- Phase E: Transactions
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        transaction_type VARCHAR(50) NOT NULL,
        customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
        customer_name VARCHAR(200) NOT NULL,
        customer_phone VARCHAR(50),
        owner_id UUID REFERENCES owners(id) ON DELETE SET NULL,
        owner_name VARCHAR(200),
        owner_phone VARCHAR(50),
        final_price BIGINT,
        deposit_amount BIGINT,
        rent_amount BIGINT,
        contract_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
        notes TEXT,
        created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        archived_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_transactions_tenant_status ON transactions(tenant_id, status);
      CREATE INDEX IF NOT EXISTS idx_transactions_property ON transactions(tenant_id, property_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(tenant_id, customer_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_agent_date ON transactions(tenant_id, agent_id, contract_date);
      CREATE INDEX IF NOT EXISTS idx_documents_transaction ON documents(tenant_id, transaction_id);

      ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rls_transactions') THEN
          CREATE POLICY rls_transactions ON transactions FOR ALL USING (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            OR NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
          );
        END IF;
      END $$;

      
      -- Phase F3: Subscription & Quota columns on tenants
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_start_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '60 days');
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_branches INTEGER NOT NULL DEFAULT 5;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_agents INTEGER NOT NULL DEFAULT 20;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) NOT NULL DEFAULT 'ANNUAL';

      CREATE TABLE IF NOT EXISTS branches (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        branch_code VARCHAR(50) NOT NULL,
        name VARCHAR(150) NOT NULL,
        phone VARCHAR(50),
        address TEXT,
        manager_user_id UUID,
        is_main BOOLEAN NOT NULL DEFAULT false,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT branches_tenant_code_unique UNIQUE (tenant_id, branch_code)
      );
      CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_branches_status ON branches(tenant_id, status);

      -- Auto-create main branch for any tenant lacking one
      INSERT INTO branches (id, tenant_id, branch_code, name, is_main, status, created_at, updated_at)
      SELECT 
        gen_random_uuid(),
        t.id,
        'MAIN',
        '\u0634\u0639\u0628\u0647 \u0645\u0631\u06A9\u0632\u06CC',
        true,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM tenants t
      WHERE NOT EXISTS (
        SELECT 1 FROM branches b WHERE b.tenant_id = t.id AND b.is_main = true
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_users_branch ON users(tenant_id, branch_id);

      ALTER TABLE properties ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_properties_branch ON properties(tenant_id, branch_id);

      ALTER TABLE customers ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_customers_branch ON customers(tenant_id, branch_id);

      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_tasks_branch ON tasks(tenant_id, branch_id);

      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_transactions_branch ON transactions(tenant_id, branch_id);

      ALTER TABLE documents ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_documents_branch ON documents(tenant_id, branch_id);

      CREATE TABLE IF NOT EXISTS platform_admins (
        id UUID PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(150) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS platform_sessions (
        id UUID PRIMARY KEY,
        admin_id UUID NOT NULL REFERENCES platform_admins(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) UNIQUE NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS platform_support_sessions (
        id UUID PRIMARY KEY,
        admin_id UUID NOT NULL REFERENCES platform_admins(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS support_audit_logs (
        id UUID PRIMARY KEY,
        support_session_id UUID NOT NULL REFERENCES platform_support_sessions(id) ON DELETE CASCADE,
        admin_id UUID NOT NULL REFERENCES platform_admins(id),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id VARCHAR(100),
        details JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_platform_sessions_token ON platform_sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_platform_support_sessions ON platform_support_sessions(tenant_id, status);
      CREATE INDEX IF NOT EXISTS idx_support_audit_logs_session ON support_audit_logs(support_session_id);

      -- Safely disable the seeded demo superadmin user identity and revoke its sessions
      UPDATE users SET is_active = false WHERE id = 'c1a11111-9999-9999-9999-999999999999' AND username = 'superadmin';
      DELETE FROM sessions WHERE user_id = 'c1a11111-9999-9999-9999-999999999999';


      -- Backfill records with NULL branch_id to the tenant's main branch
      UPDATE users u
      SET branch_id = (SELECT b.id FROM branches b WHERE b.tenant_id = u.tenant_id AND b.is_main = true LIMIT 1)
      WHERE u.branch_id IS NULL;

      UPDATE properties p
      SET branch_id = (SELECT b.id FROM branches b WHERE b.tenant_id = p.tenant_id AND b.is_main = true LIMIT 1)
      WHERE p.branch_id IS NULL;

      UPDATE customers c
      SET branch_id = (SELECT b.id FROM branches b WHERE b.tenant_id = c.tenant_id AND b.is_main = true LIMIT 1)
      WHERE c.branch_id IS NULL;

      UPDATE tasks t
      SET branch_id = (SELECT b.id FROM branches b WHERE b.tenant_id = t.tenant_id AND b.is_main = true LIMIT 1)
      WHERE t.branch_id IS NULL;

      UPDATE transactions tr
      SET branch_id = (SELECT b.id FROM branches b WHERE b.tenant_id = tr.tenant_id AND b.is_main = true LIMIT 1)
      WHERE tr.branch_id IS NULL;

      UPDATE documents d
      SET branch_id = (SELECT b.id FROM branches b WHERE b.tenant_id = d.tenant_id AND b.is_main = true LIMIT 1)
      WHERE d.branch_id IS NULL;
    `);await this.pg.query(`
      UPDATE properties SET visibility = 'AGENCY' WHERE visibility IS NULL;
      UPDATE customers SET visibility = 'AGENCY' WHERE visibility IS NULL;
    `).catch(()=>{});await this.pg.query(`
      UPDATE customers SET code = 'C-' || (1000 + sub.rn)
      FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
        FROM customers WHERE code IS NULL
      ) sub
      WHERE customers.id = sub.id AND customers.code IS NULL;
    `).catch(()=>{})
    await this.pg.query(`
      UPDATE users SET is_active = false WHERE id = 'c1a11111-9999-9999-9999-999999999999' OR (username = 'superadmin' AND tenant_id = 'e2b17b3c-53f0-466d-9279-d102e5b7b001');
      DELETE FROM sessions WHERE user_id = 'c1a11111-9999-9999-9999-999999999999';
    `).catch(()=>{});
}async getNextPropertyCode(tenantId){await this.init();const res=await this.pg.query(`INSERT INTO tenant_counters (tenant_id, counter_type, last_val)
       VALUES ($1, 'property_code', 1035)
       ON CONFLICT (tenant_id, counter_type)
       DO UPDATE SET last_val = tenant_counters.last_val + 1
       RETURNING last_val::text`,[tenantId]);return res.rows[0].last_val}async getTenantByAgencyCode(code){await this.init();const res=await this.pg.query(`SELECT * FROM tenants WHERE UPPER(agency_code) = UPPER($1) LIMIT 1`,[code.trim()]);return res.rows[0]||null}async getTenantById(id){await this.init();const res=await this.pg.query(`SELECT * FROM tenants WHERE id = $1 LIMIT 1`,[id]);return res.rows[0]||null}async getUserByTenantAndUsername(tenantId,username){await this.init();const clean=username.trim().toLowerCase();const res=await this.pg.query(`
      SELECT u.*, b.name as branch_name
      FROM users u
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE u.tenant_id = $1 
        AND (
          LOWER(u.username) = $2 
          OR LOWER(COALESCE(u.email, '')) = $2 
          OR u.phone = $2
        ) 
      LIMIT 1`,[tenantId,clean]);return res.rows[0]||null}async getUserById(id){await this.init();const res=await this.pg.query(`
      SELECT u.*, b.name as branch_name
      FROM users u
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE u.id = $1 LIMIT 1`,[id]);return res.rows[0]||null}async getAgents(tenantId,options={}){await this.init();let query=`
      SELECT 
        u.id, u.tenant_id, u.branch_id, b.name as branch_name,
        u.username, u.first_name, u.last_name, u.display_name,
        u.phone, u.email, u.avatar_url, u.is_active, u.role_code, u.last_login_at,
        u.created_at, u.updated_at,
        (SELECT COUNT(*)::int FROM properties p WHERE p.tenant_id = u.tenant_id AND p.assigned_agent_id = u.id AND p.is_archived = false AND p.status = 'ACTIVE') as properties_count,
        (SELECT COUNT(*)::int FROM customers c WHERE c.tenant_id = u.tenant_id AND c.assigned_agent_id = u.id AND c.is_archived = false) as customers_count,
        (SELECT COUNT(*)::int FROM tasks t WHERE t.tenant_id = u.tenant_id AND t.assigned_user_id = u.id AND t.status != 'COMPLETED') as active_tasks_count
      FROM users u
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE u.tenant_id = $1
    `;const params=[tenantId];if(options.branch_id&&options.branch_id!=="ALL"){params.push(options.branch_id);query+=` AND u.branch_id = $${params.length}`}query+=`
      ORDER BY 
        CASE WHEN u.role_code IN ('ADMIN', 'BRANCH_MANAGER') THEN 1 ELSE 2 END,
        u.created_at ASC
    `;const res=await this.pg.query(query,params);return res.rows}async getAgentById(tenantId,id){await this.init();const res=await this.pg.query(`
      SELECT 
        u.id, u.tenant_id, u.branch_id, b.name as branch_name,
        u.username, u.first_name, u.last_name, u.display_name,
        u.phone, u.email, u.avatar_url, u.is_active, u.role_code, u.last_login_at,
        u.created_at, u.updated_at,
        (SELECT COUNT(*)::int FROM properties p WHERE p.tenant_id = u.tenant_id AND p.assigned_agent_id = u.id AND p.is_archived = false AND p.status = 'ACTIVE') as properties_count,
        (SELECT COUNT(*)::int FROM customers c WHERE c.tenant_id = u.tenant_id AND c.assigned_agent_id = u.id AND c.is_archived = false) as customers_count,
        (SELECT COUNT(*)::int FROM tasks t WHERE t.tenant_id = u.tenant_id AND t.assigned_user_id = u.id AND t.status != 'COMPLETED') as active_tasks_count
      FROM users u
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE u.tenant_id = $1 AND u.id = $2
      LIMIT 1
    `,[tenantId,id]);return res.rows[0]||null}async createAgent(tenantId,actorUserId,data){await this.init();const id=crypto.randomUUID();const username=data.username.trim().toLowerCase();const normalizedPhone=normalizeIranianPhone(data.phone);const displayName=`${data.first_name.trim()} ${data.last_name.trim()}`.trim();const roleCode=data.role_code||"AGENT";const passwordHash=bcrypt.hashSync(data.password,10);const email=data.email?data.email.trim().toLowerCase():null;let branchId=data.branch_id||null;if(!branchId){const actor=await this.getUserById(actorUserId);branchId=actor?.branch_id||null;if(!branchId){const mb=await this.pg.query(`SELECT id FROM branches WHERE tenant_id = $1 AND is_main = true LIMIT 1`,[tenantId]);branchId=mb.rows[0]?.id||null}}const existing=await this.pg.query(`SELECT id FROM users WHERE tenant_id = $1 AND (LOWER(username) = $2 OR phone = $3)`,[tenantId,username,normalizedPhone]);if(existing.rows.length>0){const conflictErr=new Error("\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u06CC\u0627 \u0634\u0645\u0627\u0631\u0647 \u0647\u0645\u0631\u0627\u0647 \u0642\u0628\u0644\u0627\u064B \u062F\u0631 \u0627\u06CC\u0646 \u0622\u0698\u0627\u0646\u0633 \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A.");conflictErr.status=409;conflictErr.code="DUPLICATE_USER";throw conflictErr}await this.pg.query(`
      INSERT INTO users (
        id, tenant_id, branch_id, username, password_hash, first_name, last_name, display_name,
        phone, email, is_active, role_code, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,[id,tenantId,branchId,username,passwordHash,data.first_name.trim(),data.last_name.trim(),displayName,normalizedPhone,email,roleCode]);await this.addAuditLog(tenantId,actorUserId,"AGENT_CREATED","USER",id,{branch_id:branchId,role_code:roleCode});const user=await this.getUserById(id);const{password_hash,...safeUser}=user;return safeUser}async updateAgent(tenantId,actorUserId,agentId,data){await this.init();const agent=await this.getUserById(agentId);if(!agent||agent.tenant_id!==tenantId){const err=new Error("\u0645\u0634\u0627\u0648\u0631 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u062F\u0631 \u0627\u06CC\u0646 \u0622\u0698\u0627\u0646\u0633 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.");err.status=404;err.code="AGENT_NOT_FOUND";throw err}const updates=[];const params=[];let paramIdx=1;if(data.first_name!==void 0){updates.push(`first_name = $${paramIdx++}`);params.push(data.first_name.trim())}if(data.last_name!==void 0){updates.push(`last_name = $${paramIdx++}`);params.push(data.last_name.trim())}const firstName=data.first_name!==void 0?data.first_name.trim():agent.first_name;const lastName=data.last_name!==void 0?data.last_name.trim():agent.last_name;const displayName=`${firstName} ${lastName}`.trim();updates.push(`display_name = $${paramIdx++}`);params.push(displayName);if(data.username!==void 0){const username=data.username.trim().toLowerCase();const existing=await this.pg.query(`SELECT id FROM users WHERE tenant_id = $1 AND LOWER(username) = $2 AND id != $3`,[tenantId,username,agentId]);if(existing.rows.length>0){const conflictErr=new Error("\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0642\u0628\u0644\u0627\u064B \u062F\u0631 \u0627\u06CC\u0646 \u0622\u0698\u0627\u0646\u0633 \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A.");conflictErr.status=409;conflictErr.code="DUPLICATE_USER";throw conflictErr}updates.push(`username = $${paramIdx++}`);params.push(username)}if(data.phone!==void 0){const normalizedPhone=normalizeIranianPhone(data.phone);const existing=await this.pg.query(`SELECT id FROM users WHERE tenant_id = $1 AND phone = $2 AND id != $3`,[tenantId,normalizedPhone,agentId]);if(existing.rows.length>0){const conflictErr=new Error("\u0634\u0645\u0627\u0631\u0647 \u0647\u0645\u0631\u0627\u0647 \u0642\u0628\u0644\u0627\u064B \u062F\u0631 \u0627\u06CC\u0646 \u0622\u0698\u0627\u0646\u0633 \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A.");conflictErr.status=409;conflictErr.code="DUPLICATE_USER";throw conflictErr}updates.push(`phone = $${paramIdx++}`);params.push(normalizedPhone)}if(data.email!==void 0){const email=data.email?data.email.trim().toLowerCase():null;updates.push(`email = $${paramIdx++}`);params.push(email)}if(data.role_code!==void 0){updates.push(`role_code = $${paramIdx++}`);params.push(data.role_code)}if(data.branch_id!==void 0){updates.push(`branch_id = $${paramIdx++}`);params.push(data.branch_id||null)}if(updates.length>1){updates.push(`updated_at = CURRENT_TIMESTAMP`);params.push(agentId,tenantId);const query=`UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIdx++} AND tenant_id = $${paramIdx++}`;await this.pg.query(query,params);await this.addAuditLog(tenantId,actorUserId,"AGENT_UPDATED","USER",agentId,{updates:data})}const updated=await this.getUserById(agentId);const{password_hash,...safeUser}=updated;return safeUser}async setAgentStatus(tenantId,actorUserId,agentId,isActive){await this.init();const agent=await this.getUserById(agentId);if(!agent||agent.tenant_id!==tenantId){const err=new Error("\u0645\u0634\u0627\u0648\u0631 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u062F\u0631 \u0627\u06CC\u0646 \u0622\u0698\u0627\u0646\u0633 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.");err.status=404;err.code="AGENT_NOT_FOUND";throw err}if(agentId===actorUserId&&!isActive){const err=new Error("\u0627\u0645\u06A9\u0627\u0646 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC \u062E\u0648\u062F\u062A\u0627\u0646 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.");err.status=400;err.code="CANNOT_DEACTIVATE_SELF";throw err}await this.pg.query(`UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3`,[isActive,agentId,tenantId]);if(!isActive){await this.pg.query(`UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND tenant_id = $2 AND revoked_at IS NULL`,[agentId,tenantId]);await this.addAuditLog(tenantId,actorUserId,"AGENT_DEACTIVATED","USER",agentId)}else{await this.addAuditLog(tenantId,actorUserId,"AGENT_ACTIVATED","USER",agentId)}const updated=await this.getUserById(agentId);const{password_hash,...safeUser}=updated;return safeUser}async createSession(userId,tenantId,ip,ua){await this.init();const rawToken=crypto.randomBytes(32).toString("hex");const tokenHash=crypto.createHash("sha256").update(rawToken).digest("hex");const expiresAt=new Date(Date.now()+14*864e5).toISOString();const id=crypto.randomUUID();await this.pg.query(`INSERT INTO sessions (id, user_id, tenant_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,[id,userId,tenantId,tokenHash,expiresAt,ip||null,ua||null]);return rawToken}async getSessionByToken(rawToken){if(!rawToken)return null;await this.init();const tokenHash=crypto.createHash("sha256").update(rawToken).digest("hex");const res=await this.pg.query(`SELECT * FROM sessions WHERE token_hash = $1 AND revoked_at IS NULL LIMIT 1`,[tokenHash]);const session=res.rows[0];if(!session)return null;if(new Date(session.expires_at)<new Date){await this.revokeSession(rawToken);return null}this.pg.query(`UPDATE sessions SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1`,[session.id]).catch(()=>{});return session}async getSessionByTokenAny(rawToken){if(!rawToken)return null;await this.init();const tokenHash=crypto.createHash("sha256").update(rawToken).digest("hex");const res=await this.pg.query(`SELECT * FROM sessions WHERE token_hash = $1 LIMIT 1`,[tokenHash]);return res.rows[0]||null}async revokeSession(rawToken){if(!rawToken)return;await this.init();const tokenHash=crypto.createHash("sha256").update(rawToken).digest("hex");await this.pg.query(`UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1`,[tokenHash])}async getOwners(tenantId){await this.init();const res=await this.pg.query(`SELECT * FROM owners WHERE tenant_id = $1 AND is_archived = false ORDER BY created_at DESC`,[tenantId]);return res.rows}async getOwnerById(tenantId,id){await this.init();const res=await this.pg.query(`SELECT * FROM owners WHERE tenant_id = $1 AND id = $2 AND is_archived = false LIMIT 1`,[tenantId,id]);return res.rows[0]||null}async createOwner(tenantId,data){await this.init();const id=crypto.randomUUID();const normalizedPhone=normalizeIranianPhone(data.phone);const displayName=`${data.first_name} ${data.last_name}`.trim();try{await this.pg.query(`INSERT INTO owners (id, tenant_id, first_name, last_name, display_name, phone, secondary_phone, email, national_id, address, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,[id,tenantId,data.first_name.trim(),data.last_name.trim(),displayName,normalizedPhone,data.secondary_phone?normalizeIranianPhone(data.secondary_phone):null,data.email||null,data.national_id||null,data.address||null,data.notes||null])}catch(err){if(err.code==="23505"){const conflictErr=new Error(`\u0645\u0627\u0644\u06A9 \u0628\u0627 \u0634\u0645\u0627\u0631\u0647 \u062A\u0645\u0627\u0633 ${normalizedPhone} \u0642\u0628\u0644\u0627\u064B \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A.`);conflictErr.status=409;conflictErr.code="DUPLICATE_OWNER";throw conflictErr}throw err}await this.addAuditLog(tenantId,null,"OWNER_CREATED","OWNER",id);const owner=await this.getOwnerById(tenantId,id);return owner}async linkPropertyOwner(tenantId, propertyId, ownerId, percentage = 100, isPrimary = true, notes = null) {
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
  }async getPropertyOwners(tenantId,propertyId){await this.init();const res=await this.pg.query(`SELECT po.*, 
              o.first_name, o.last_name, o.display_name, o.phone, o.email 
       FROM property_owners po
       JOIN owners o ON po.owner_id = o.id
       WHERE po.tenant_id = $1 AND po.property_id = $2`,[tenantId,propertyId]);return res.rows.map(row=>({id:row.id,tenant_id:row.tenant_id,property_id:row.property_id,owner_id:row.owner_id,ownership_percentage:Number(row.ownership_percentage),is_primary_owner:Boolean(row.is_primary_owner),notes:row.notes,created_at:row.created_at,owner:{id:row.owner_id,tenant_id:row.tenant_id,first_name:row.first_name,last_name:row.last_name,display_name:row.display_name,phone:row.phone,email:row.email,is_archived:false,created_at:row.created_at,updated_at:row.created_at}}))}isOfficeAdmin(user) {
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
  }async getBranches(tenantId,options={}){await this.init();let query=`
      SELECT b.*,
             u.display_name as manager_name,
             (SELECT COUNT(*)::int FROM users u2 WHERE u2.tenant_id = b.tenant_id AND u2.branch_id = b.id AND u2.is_active = true) as members_count,
             (SELECT COUNT(*)::int FROM properties p WHERE p.tenant_id = b.tenant_id AND p.branch_id = b.id AND p.is_archived = false AND p.status = 'ACTIVE') as properties_count
      FROM branches b
      LEFT JOIN users u ON u.id = b.manager_user_id
      WHERE b.tenant_id = $1
    `;const params=[tenantId];if(options.status&&options.status!=="ALL"){params.push(options.status);query+=` AND b.status = ${params.length}`}query+=` ORDER BY b.is_main DESC, b.created_at ASC`;const res=await this.pg.query(query,params);return res.rows.map(row=>({id:row.id,tenant_id:row.tenant_id,branch_code:row.branch_code,name:row.name,phone:row.phone,address:row.address,manager_user_id:row.manager_user_id,manager_name:row.manager_name,is_main:Boolean(row.is_main),status:row.status,members_count:Number(row.members_count||0),properties_count:Number(row.properties_count||0),created_at:row.created_at,updated_at:row.updated_at}))}async getBranchById(tenantId,branchId){await this.init();const res=await this.pg.query(`
      SELECT b.*,
             u.display_name as manager_name,
             (SELECT COUNT(*)::int FROM users u2 WHERE u2.tenant_id = b.tenant_id AND u2.branch_id = b.id AND u2.is_active = true) as members_count,
             (SELECT COUNT(*)::int FROM properties p WHERE p.tenant_id = b.tenant_id AND p.branch_id = b.id AND p.is_archived = false AND p.status = 'ACTIVE') as properties_count
      FROM branches b
      LEFT JOIN users u ON u.id = b.manager_user_id
      WHERE b.tenant_id = $1 AND b.id = $2
      LIMIT 1
    `,[tenantId,branchId]);if(res.rows.length===0)return null;const row=res.rows[0];return{id:row.id,tenant_id:row.tenant_id,branch_code:row.branch_code,name:row.name,phone:row.phone,address:row.address,manager_user_id:row.manager_user_id,manager_name:row.manager_name,is_main:Boolean(row.is_main),status:row.status,members_count:Number(row.members_count||0),properties_count:Number(row.properties_count||0),created_at:row.created_at,updated_at:row.updated_at}}async createBranch(tenantId,actorUserId,data){await this.init();const id=crypto.randomUUID();const branchCode=data.branch_code.trim().toUpperCase();const name=data.name.trim();const existing=await this.pg.query(`SELECT id FROM branches WHERE tenant_id = $1 AND UPPER(branch_code) = UPPER($2) LIMIT 1`,[tenantId,branchCode]);if(existing.rows.length>0){const err=new Error(`\u06A9\u062F \u0634\u0639\u0628\u0647 \xAB${branchCode}\xBB \u0642\u0628\u0644\u0627\u064B \u062F\u0631 \u0627\u06CC\u0646 \u062F\u0641\u062A\u0631 \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A.`);err.status=409;err.code="DUPLICATE_BRANCH_CODE";throw err}const isMain=Boolean(data.is_main);if(isMain){await this.pg.query(`UPDATE branches SET is_main = false, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1`,[tenantId])}const managerId=data.manager_user_id||null;const status=data.status||"ACTIVE";await this.pg.query(`
      INSERT INTO branches (id, tenant_id, branch_code, name, phone, address, manager_user_id, is_main, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,[id,tenantId,branchCode,name,data.phone?.trim()||null,data.address?.trim()||null,managerId,isMain,status]);if(managerId){await this.pg.query(`
        UPDATE users SET branch_id = $1, role_code = CASE WHEN role_code = 'AGENT' THEN 'BRANCH_MANAGER' ELSE role_code END, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND tenant_id = $3
      `,[id,managerId,tenantId])}await this.addAuditLog(tenantId,actorUserId,"BRANCH_CREATED","BRANCH",id,{name,branch_code:branchCode,is_main:isMain,manager_user_id:managerId});return this.getBranchById(tenantId,id)}async updateBranch(tenantId,actorUserId,branchId,data){await this.init();const branch=await this.getBranchById(tenantId,branchId);if(!branch){const err=new Error("\u0634\u0639\u0628\u0647 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.");err.status=404;err.code="BRANCH_NOT_FOUND";throw err}const updates=[];const params=[];let idx=1;if(data.name!==void 0){updates.push(`name = ${idx++}`);params.push(data.name.trim())}if(data.branch_code!==void 0){const code=data.branch_code.trim().toUpperCase();const existing=await this.pg.query(`SELECT id FROM branches WHERE tenant_id = $1 AND UPPER(branch_code) = UPPER($2) AND id != $3 LIMIT 1`,[tenantId,code,branchId]);if(existing.rows.length>0){const err=new Error(`\u06A9\u062F \u0634\u0639\u0628\u0647 \xAB${code}\xBB \u062A\u06A9\u0631\u0627\u0631\u06CC \u0627\u0633\u062A.`);err.status=409;err.code="DUPLICATE_BRANCH_CODE";throw err}updates.push(`branch_code = ${idx++}`);params.push(code)}if(data.phone!==void 0){updates.push(`phone = ${idx++}`);params.push(data.phone?.trim()||null)}if(data.address!==void 0){updates.push(`address = ${idx++}`);params.push(data.address?.trim()||null)}if(data.manager_user_id!==void 0){const managerId=data.manager_user_id||null;updates.push(`manager_user_id = ${idx++}`);params.push(managerId);if(managerId){await this.pg.query(`
          UPDATE users SET branch_id = $1, role_code = CASE WHEN role_code = 'AGENT' THEN 'BRANCH_MANAGER' ELSE role_code END, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND tenant_id = $3
        `,[branchId,managerId,tenantId])}}if(data.is_main!==void 0){if(data.is_main===true){await this.pg.query(`UPDATE branches SET is_main = false, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND id != $2`,[tenantId,branchId]);updates.push(`is_main = ${idx++}`);params.push(true)}else if(data.is_main===false&&branch.is_main){const err=new Error("\u062F\u0641\u062A\u0631 \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06CC\u06A9 \u0634\u0639\u0628\u0647 \u0627\u0635\u0644\u06CC \u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F.");err.status=400;err.code="CANNOT_UNSET_ONLY_MAIN_BRANCH";throw err}}if(data.status!==void 0){if(data.status==="INACTIVE"&&branch.is_main){const err=new Error("\u0627\u0645\u06A9\u0627\u0646 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u0634\u0639\u0628\u0647 \u0627\u0635\u0644\u06CC \u062F\u0641\u062A\u0631 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.");err.status=400;err.code="CANNOT_DEACTIVATE_MAIN_BRANCH";throw err}updates.push(`status = ${idx++}`);params.push(data.status)}if(updates.length>0){updates.push(`updated_at = CURRENT_TIMESTAMP`);params.push(branchId,tenantId);await this.pg.query(`UPDATE branches SET ${updates.join(", ")} WHERE id = ${idx++} AND tenant_id = ${idx++}`,params);await this.addAuditLog(tenantId,actorUserId,"BRANCH_UPDATED","BRANCH",branchId,data)}return this.getBranchById(tenantId,branchId)}async deleteBranch(tenantId,actorUserId,branchId,targetBranchId){await this.init();const branch=await this.getBranchById(tenantId,branchId);if(!branch){const err=new Error("\u0634\u0639\u0628\u0647 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.");err.status=404;err.code="BRANCH_NOT_FOUND";throw err}if(branch.is_main){const err=new Error("\u0627\u0645\u06A9\u0627\u0646 \u062D\u0630\u0641 \u06CC\u0627 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u0634\u0639\u0628\u0647 \u0627\u0635\u0644\u06CC \u062F\u0641\u062A\u0631 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.");err.status=400;err.code="CANNOT_DELETE_MAIN_BRANCH";throw err}if(targetBranchId){const targetBranch=await this.getBranchById(tenantId,targetBranchId);if(!targetBranch||targetBranch.status!=="ACTIVE"){const err=new Error("\u0634\u0639\u0628\u0647 \u0645\u0642\u0635\u062F \u0628\u0631\u0627\u06CC \u0627\u0646\u062A\u0642\u0627\u0644 \u067E\u0631\u0648\u0646\u062F\u0647\u200C\u0647\u0627 \u0645\u0639\u062A\u0628\u0631 \u06CC\u0627 \u0641\u0639\u0627\u0644 \u0646\u06CC\u0633\u062A.");err.status=400;err.code="INVALID_TARGET_BRANCH";throw err}await this.pg.query(`UPDATE users SET branch_id = $1 WHERE tenant_id = $2 AND branch_id = $3`,[targetBranchId,tenantId,branchId]);await this.pg.query(`UPDATE properties SET branch_id = $1 WHERE tenant_id = $2 AND branch_id = $3`,[targetBranchId,tenantId,branchId]);await this.pg.query(`UPDATE customers SET branch_id = $1 WHERE tenant_id = $2 AND branch_id = $3`,[targetBranchId,tenantId,branchId]);await this.pg.query(`UPDATE tasks SET branch_id = $1 WHERE tenant_id = $2 AND branch_id = $3`,[targetBranchId,tenantId,branchId]);await this.pg.query(`UPDATE transactions SET branch_id = $1 WHERE tenant_id = $2 AND branch_id = $3`,[targetBranchId,tenantId,branchId]);await this.pg.query(`UPDATE documents SET branch_id = $1 WHERE tenant_id = $2 AND branch_id = $3`,[targetBranchId,tenantId,branchId])}await this.pg.query(`UPDATE branches SET status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2`,[branchId,tenantId]);await this.addAuditLog(tenantId,actorUserId,"BRANCH_DEACTIVATED","BRANCH",branchId,{target_branch_id:targetBranchId});return true}async getProperties(tenantId,filters={},requestingUser=null){await this.init();let query=`
      SELECT p.*,
             b.name as branch_name,
             (SELECT file_url FROM property_media pm WHERE pm.property_id = p.id AND pm.is_cover = true LIMIT 1) as cover_image,
             u_creator.display_name as created_by_name,
             u_assignee.display_name as assigned_agent_name
      FROM properties p 
      LEFT JOIN branches b ON b.id = p.branch_id
      LEFT JOIN users u_creator ON u_creator.id = p.created_by_user_id
      LEFT JOIN users u_assignee ON u_assignee.id = p.assigned_agent_id
      WHERE p.tenant_id = $1
    `;const params=[tenantId];if(requestingUser&&!this.isOfficeAdmin(requestingUser)){if(requestingUser.role_code==="BRANCH_MANAGER"){params.push(requestingUser.id,requestingUser.branch_id||null);query+=` AND (p.visibility = 'AGENCY' OR p.branch_id = $${params.length} OR p.assigned_agent_id = $${params.length-1} OR (p.assigned_agent_id IS NULL AND p.created_by_user_id = $${params.length-1}))`}else{params.push(requestingUser.id,requestingUser.branch_id||null);query+=` AND (p.visibility = 'AGENCY' OR (p.visibility = 'BRANCH' AND p.branch_id = $${params.length}) OR p.assigned_agent_id = $${params.length-1} OR (p.assigned_agent_id IS NULL AND p.created_by_user_id = $${params.length-1}))`}}else if(filters.visibility&&filters.visibility!=="ALL"){params.push(filters.visibility);query+=` AND p.visibility = $${params.length}`}if(filters.branch_id&&filters.branch_id!=="ALL"){params.push(filters.branch_id);query+=` AND p.branch_id = $${params.length}`}if(filters.status==="ALL"){}else if(filters.status==="INACTIVE"){query+=` AND (p.status IN ('SOLD', 'RENTED', 'ARCHIVED') OR p.is_archived = true)`}else if(filters.status&&filters.status!=="ACTIVE"){params.push(filters.status);query+=` AND p.status = $${params.length}`}else{query+=` AND p.is_archived = false AND p.status = 'ACTIVE'`}if(filters.property_type&&filters.property_type!=="ALL"){params.push(filters.property_type);query+=` AND p.property_type = $${params.length}`}if(filters.listing_type&&filters.listing_type!=="ALL"){params.push(filters.listing_type);query+=` AND p.listing_type = $${params.length}`}if(filters.min_price){params.push(filters.min_price);query+=` AND (p.price_total >= $${params.length} OR p.deposit_amount >= $${params.length})`}if(filters.max_price){params.push(filters.max_price);query+=` AND (p.price_total <= $${params.length} OR p.deposit_amount <= $${params.length})`}if(filters.min_area){params.push(filters.min_area);query+=` AND p.area_sqm >= $${params.length}`}if(filters.max_area){params.push(filters.max_area);query+=` AND p.area_sqm <= $${params.length}`}if(filters.bedrooms!==void 0&&filters.bedrooms!==""&&filters.bedrooms!=="ALL"){params.push(Number(filters.bedrooms));query+=` AND p.bedrooms = $${params.length}`}if(filters.has_parking===true||filters.has_parking==="true"){query+=` AND p.has_parking = true`}if(filters.has_elevator===true||filters.has_elevator==="true"){query+=` AND p.has_elevator = true`}if(filters.has_storage===true||filters.has_storage==="true"){query+=` AND p.has_storage = true`}if(filters.has_balcony===true||filters.has_balcony==="true"){query+=` AND p.has_balcony = true`}if(filters.neighborhood&&filters.neighborhood.trim()){params.push(`%${filters.neighborhood.trim()}%`);query+=` AND p.neighborhood ILIKE $${params.length}`}if(filters.search&&filters.search.trim()){params.push(`%${filters.search.trim()}%`);query+=` AND (p.code ILIKE $${params.length} OR p.title ILIKE $${params.length} OR p.neighborhood ILIKE $${params.length} OR p.city ILIKE $${params.length})`}if(filters.sort==="price_asc"){query+=` ORDER BY p.price_total ASC NULLS LAST, p.deposit_amount ASC NULLS LAST`}else if(filters.sort==="price_desc"){query+=` ORDER BY p.price_total DESC NULLS LAST, p.deposit_amount DESC NULLS LAST`}else if(filters.sort==="area_asc"){query+=` ORDER BY p.area_sqm ASC`}else if(filters.sort==="area_desc"){query+=` ORDER BY p.area_sqm DESC`}else{query+=` ORDER BY p.created_at DESC`}const res=await this.pg.query(query,params);return res.rows.map(this.mapPropertyRow)}async getPropertiesPaginated(tenantId,filters={},requestingUser=null){await this.init();let whereClause=`WHERE p.tenant_id = $1`;const params=[tenantId];if(requestingUser&&!this.isOfficeAdmin(requestingUser)){if(requestingUser.role_code==="BRANCH_MANAGER"){params.push(requestingUser.id,requestingUser.branch_id||null);whereClause+=` AND (p.visibility = 'AGENCY' OR p.branch_id = $${params.length} OR p.assigned_agent_id = $${params.length-1} OR (p.assigned_agent_id IS NULL AND p.created_by_user_id = $${params.length-1}))`}else{params.push(requestingUser.id,requestingUser.branch_id||null);whereClause+=` AND (p.visibility = 'AGENCY' OR (p.visibility = 'BRANCH' AND p.branch_id = $${params.length}) OR p.assigned_agent_id = $${params.length-1} OR (p.assigned_agent_id IS NULL AND p.created_by_user_id = $${params.length-1}))`}}if(filters.visibility&&filters.visibility!=="ALL"){params.push(filters.visibility);whereClause+=` AND p.visibility = $${params.length}`}if(filters.branch_id&&filters.branch_id!=="ALL"){params.push(filters.branch_id);whereClause+=` AND p.branch_id = $${params.length}`}const status=String(filters.status||"active").toLowerCase();if(status==="all"){}else if(status==="archived"){whereClause+=` AND (p.status = 'ARCHIVED' OR p.is_archived = true)`}else if(status==="active"){whereClause+=` AND p.is_archived = false AND p.status NOT IN ('ARCHIVED')`}else if(filters.status&&filters.status!=="ALL"){params.push(filters.status.toUpperCase());whereClause+=` AND p.status = $${params.length}`}if(filters.property_status && filters.property_status !== "ALL") {
  params.push(filters.property_status === "AVAILABLE" ? "ACTIVE" : filters.property_status === "UNDER_NEGOTIATION" ? "NEGOTIATION" : filters.property_status);
  whereClause += ` AND p.status = $${params.length}`;
}if(filters.property_type&&filters.property_type!=="ALL"){params.push(filters.property_type);whereClause+=` AND p.property_type = $${params.length}`}if(filters.listing_type&&filters.listing_type!=="ALL"){params.push(filters.listing_type);whereClause+=` AND p.listing_type = $${params.length}`}if(filters.min_price){params.push(filters.min_price);whereClause+=` AND (CASE WHEN p.listing_type = 'RENT' THEN p.deposit_amount ELSE p.price_total END) >= $${params.length}`}if(filters.max_price){params.push(filters.max_price);whereClause+=` AND (CASE WHEN p.listing_type = 'RENT' THEN p.deposit_amount ELSE p.price_total END) <= $${params.length}`}if(filters.min_area){params.push(filters.min_area);whereClause+=` AND p.area_sqm >= $${params.length}`}if(filters.max_area){params.push(filters.max_area);whereClause+=` AND p.area_sqm <= $${params.length}`}if(filters.bedrooms!==void 0&&filters.bedrooms!==""&&filters.bedrooms!=="ALL"){params.push(Number(filters.bedrooms));whereClause+=` AND p.bedrooms ${Number(filters.bedrooms) === 4 ? ">=" : "="} $${params.length}`}if(filters.has_parking===true||filters.has_parking==="true"){whereClause+=` AND p.has_parking = true`}if(filters.has_elevator===true||filters.has_elevator==="true"){whereClause+=` AND p.has_elevator = true`}if(filters.has_storage===true||filters.has_storage==="true"){whereClause+=` AND p.has_storage = true`}if(filters.has_balcony===true||filters.has_balcony==="true"){whereClause+=` AND p.has_balcony = true`}if(filters.district&&filters.district.trim()){params.push(`%${filters.district.trim()}%`);whereClause+=` AND (p.district ILIKE $${params.length} OR p.neighborhood ILIKE $${params.length})`}else if(filters.neighborhood&&filters.neighborhood.trim()){params.push(`%${filters.neighborhood.trim()}%`);whereClause+=` AND (p.neighborhood ILIKE $${params.length} OR p.district ILIKE $${params.length})`}if(filters.search&&filters.search.trim()){params.push(`%${filters.search.trim()}%`);whereClause+=` AND (
        p.code ILIKE $${params.length}
        OR p.title ILIKE $${params.length}
        OR p.neighborhood ILIKE $${params.length}
        OR p.district ILIKE $${params.length}
        OR p.city ILIKE $${params.length}
        OR p.description ILIKE $${params.length}
      )`}const countRes=await this.pg.query(`SELECT count(*)::text as count FROM properties p ${whereClause}`,params);const total=parseInt(countRes.rows[0]?.count||"0",10);let orderClause=` ORDER BY p.created_at DESC`;if(filters.sort==="price_asc"){orderClause=` ORDER BY p.price_total ASC NULLS LAST, p.deposit_amount ASC NULLS LAST`}else if(filters.sort==="price_desc"){orderClause=` ORDER BY p.price_total DESC NULLS LAST, p.deposit_amount DESC NULLS LAST`}else if(filters.sort==="area_asc"){orderClause=` ORDER BY p.area_sqm ASC`}else if(filters.sort==="area_desc"){orderClause=` ORDER BY p.area_sqm DESC`}orderClause += `, p.id DESC`;const page=Math.max(1,Number(filters.page)||1);const limit=Math.max(1,Number(filters.limit)||10);const offset=(page-1)*limit;const query=`
      SELECT p.*,
             b.name as branch_name,
             (SELECT file_url FROM property_media pm WHERE pm.property_id = p.id AND pm.is_cover = true LIMIT 1) as cover_image,
             u_creator.display_name as created_by_name,
             u_assignee.display_name as assigned_agent_name
      FROM properties p
      LEFT JOIN branches b ON b.id = p.branch_id
      LEFT JOIN users u_creator ON u_creator.id = p.created_by_user_id
      LEFT JOIN users u_assignee ON u_assignee.id = p.assigned_agent_id
      ${whereClause}
      ${orderClause}
      LIMIT $${params.length+1} OFFSET $${params.length+2}
    `;const res=await this.pg.query(query,[...params,limit,offset]);return{properties:res.rows.map(this.mapPropertyRow),total}}async getPropertyById(tenantId, id, requestingUser = null) {
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
    prop.media = await this.getPropertyMedia(tenantId, id);const propOwners=await this.getPropertyOwners(tenantId,id);prop.owners=propOwners.map(po=>po.owner).filter(Boolean);return prop}async getPropertyMedia(tenantId,propertyId){await this.init();const res=await this.pg.query(`SELECT * FROM property_media WHERE tenant_id = $1 AND property_id = $2 ORDER BY sort_order ASC, created_at ASC`,[tenantId,propertyId]);return res.rows.map(r=>({id:r.id,tenant_id:r.tenant_id,property_id:r.property_id,file_name:r.file_name,file_url:r.file_url,thumbnail_url:r.thumbnail_url||r.file_url,media_type:r.media_type,mime_type:r.mime_type,file_size:Number(r.file_size),width:r.width?Number(r.width):void 0,height:r.height?Number(r.height):void 0,sort_order:Number(r.sort_order),is_cover:Boolean(r.is_cover),created_at:r.created_at}))}async addPropertyMedia(tenantId,propertyId,data){await this.init();const id=crypto.randomUUID();const countRes=await this.pg.query(`SELECT count(*)::text as count FROM property_media WHERE tenant_id = $1 AND property_id = $2`,[tenantId,propertyId]);const sortOrder=Number(countRes.rows[0].count);const isFirst=sortOrder===0;const isCover=data.is_cover!==void 0?data.is_cover:isFirst;if(isCover){await this.pg.query(`UPDATE property_media SET is_cover = false WHERE tenant_id = $1 AND property_id = $2`,[tenantId,propertyId])}await this.pg.query(`INSERT INTO property_media (
        id, tenant_id, property_id, file_name, file_url, thumbnail_url, media_type, mime_type, file_size, width, height, sort_order, is_cover
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,[id,tenantId,propertyId,data.file_name,data.file_url,data.thumbnail_url||data.file_url,data.media_type,data.mime_type,data.file_size,data.width||null,data.height||null,sortOrder,isCover]);const mediaList=await this.getPropertyMedia(tenantId,propertyId);return mediaList.find(m=>m.id===id)}async updatePropertyMedia(tenantId,propertyId,mediaId,updates){await this.init();if(updates.is_cover){await this.pg.query(`UPDATE property_media SET is_cover = false WHERE tenant_id = $1 AND property_id = $2`,[tenantId,propertyId]);await this.pg.query(`UPDATE property_media SET is_cover = true WHERE tenant_id = $1 AND property_id = $2 AND id = $3`,[tenantId,propertyId,mediaId])}if(updates.sort_order!==void 0){await this.pg.query(`UPDATE property_media SET sort_order = $1 WHERE tenant_id = $2 AND property_id = $3 AND id = $4`,[updates.sort_order,tenantId,propertyId,mediaId])}const mediaList=await this.getPropertyMedia(tenantId,propertyId);return mediaList.find(m=>m.id===mediaId)}async deletePropertyMedia(tenantId,propertyId,mediaId){await this.init();const res=await this.pg.query(`DELETE FROM property_media WHERE tenant_id = $1 AND property_id = $2 AND id = $3 RETURNING id`,[tenantId,propertyId,mediaId]);return(res.rowCount||0)>0}async generateOrGetPropertyShareToken(tenantId,propertyId){await this.init();const prop=await this.getPropertyById(tenantId,propertyId);if(!prop){const err=new Error("\u0645\u0644\u06A9 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.");err.status=404;err.code="PROPERTY_NOT_FOUND";throw err}if(prop.share_token){return prop.share_token}const token=`p_${crypto.randomBytes(6).toString("hex")}`;await this.pg.query(`UPDATE properties SET share_token = $1, is_shareable = true WHERE tenant_id = $2 AND id = $3`,[token,tenantId,propertyId]);return token}async getPropertyByShareToken(shareToken){await this.init();const res=await this.pg.query(`SELECT p.*, 
              t.name as agency_name, t.phone as agency_phone,
              u.display_name as agent_name, u.phone as agent_phone
       FROM properties p
       JOIN tenants t ON p.tenant_id = t.id
       LEFT JOIN users u ON p.assigned_agent_id = u.id
       WHERE p.share_token = $1 AND p.is_shareable = true AND p.is_archived = false
       LIMIT 1`,[shareToken]);if(res.rows.length===0)return null;const row=res.rows[0];const mediaList=await this.pg.query(`SELECT id, file_url, thumbnail_url, media_type, is_cover 
       FROM property_media 
       WHERE property_id = $1 
       ORDER BY sort_order ASC, created_at ASC`,[row.id]);return{share_token:row.share_token,code:row.code,title:row.title,property_type:row.property_type,listing_type:row.listing_type,status:row.status,price_total:row.price_total?Number(row.price_total):void 0,price_per_meter:row.price_per_meter?Number(row.price_per_meter):void 0,rent_amount:row.rent_amount?Number(row.rent_amount):void 0,deposit_amount:row.deposit_amount?Number(row.deposit_amount):void 0,area_sqm:Number(row.area_sqm),bedrooms:row.bedrooms,floor:row.floor,has_parking:Boolean(row.has_parking),has_storage:Boolean(row.has_storage),has_elevator:Boolean(row.has_elevator),has_balcony:Boolean(row.has_balcony),description:row.description,province:row.province||"\u062A\u0647\u0631\u0627\u0646",city:row.city||"\u062A\u0647\u0631\u0627\u0646",neighborhood:row.neighborhood,media:mediaList.rows.map(m=>({id:m.id,url:m.file_url,thumbnail_url:m.thumbnail_url||m.file_url,media_type:m.media_type,is_cover:Boolean(m.is_cover)})),agency:{name:row.agency_name||"\u062F\u0641\u062A\u0631 \u0627\u0645\u0644\u0627\u06A9",phone:row.agency_phone||void 0},agent:{display_name:row.agent_name||"\u0645\u0634\u0627\u0648\u0631 \u0627\u0645\u0644\u0627\u06A9",phone:row.agent_phone||void 0}}}async createProperty(tenantId,userId,data,userRole){await this.init();const id=crypto.randomUUID();const nextCode=await this.getNextPropertyCode(tenantId);const shareToken=`p_${crypto.randomBytes(6).toString("hex")}`;const pricePerMeter=data.price_total&&data.area_sqm?Math.round(Number(data.price_total)/Number(data.area_sqm)):null;const district=data.district?.trim()||data.neighborhood?.trim()||null;const neighborhood=data.neighborhood?.trim()||data.district?.trim()||null;const visibility=data.visibility==="PRIVATE"?"PRIVATE":"AGENCY";const isManager=this.isManagerUser({role_code:userRole});const assignedAgentId=isManager&&(data.assigned_to_user_id||data.assigned_agent_id)?data.assigned_to_user_id||data.assigned_agent_id:userId;let propBranchId=data.branch_id||null;if(!propBranchId){const u=await this.getUserById(userId);propBranchId=u?.branch_id||null}if(!propBranchId){const mainB=await this.pg.query(`SELECT id FROM branches WHERE tenant_id = $1 AND is_main = true LIMIT 1`,[tenantId]);propBranchId=mainB.rows[0]?.id||null}try{await this.pg.query(`INSERT INTO properties (
          id, tenant_id, code, title, property_type, listing_type, status,
          price_total, price_per_meter, rent_amount, deposit_amount, area_sqm,
          bedrooms, floor, has_parking, has_elevator, has_storage, has_balcony,
          description, province, city, neighborhood, district,
          visibility, assigned_agent_id, created_by_user_id,
          share_token, is_shareable, branch_id
         ) VALUES (
          $1, $2, $3, $4, $5, $6, 'ACTIVE',
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17,
          $18, $19, $20, $21, $22,
          $23, $24, $25,
          $26, true, $27
         )`,[id,tenantId,nextCode,data.title.trim(),data.property_type,data.listing_type,data.price_total||null,pricePerMeter,data.rent_amount||null,data.deposit_amount||null,Number(data.area_sqm),data.bedrooms||null,data.floor||null,Boolean(data.has_parking),Boolean(data.has_elevator),Boolean(data.has_storage),Boolean(data.has_balcony),data.description||null,data.province||"\u062A\u0647\u0631\u0627\u0646",data.city||"\u062A\u0647\u0631\u0627\u0646",neighborhood,district,visibility,assignedAgentId,userId,shareToken,propBranchId])}catch(err){if(err.code==="23505"){const conflictErr=new Error(`\u0645\u0644\u06A9\u06CC \u0628\u0627 \u06A9\u062F ${nextCode} \u0642\u0628\u0644\u0627\u064B \u062F\u0631 \u0627\u06CC\u0646 \u0622\u0698\u0627\u0646\u0633 \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A.`);conflictErr.status=409;conflictErr.code="DUPLICATE_PROPERTY";throw conflictErr}throw err}if(data.owner_name&&data.owner_phone){try{const normalizedOwnerPhone=normalizeIranianPhone(data.owner_phone);let owner=await this.pg.query(`SELECT id FROM owners WHERE tenant_id = $1 AND phone = $2 LIMIT 1`,[tenantId,normalizedOwnerPhone]);let ownerId=owner.rows[0]?.id;if(!ownerId){const parts=data.owner_name.trim().split(" ");const fn=parts[0]||"\u0645\u0627\u0644\u06A9";const ln=parts.slice(1).join(" ")||"\u0645\u0644\u06A9";const newOwner=await this.createOwner(tenantId,{first_name:fn,last_name:ln,phone:normalizedOwnerPhone});ownerId=newOwner.id}await this.linkPropertyOwner(tenantId,id,ownerId)}catch{}}await this.addAuditLog(tenantId,userId,"PROPERTY_CREATED","PROPERTY",id,{code:nextCode,visibility});const p=await this.getPropertyById(tenantId,id);return p}async updateProperty(tenantId,propertyId,data,userId,userRole){await this.init();const isManager=this.isManagerUser({role_code:userRole});const existing=await this.getPropertyById(tenantId,propertyId,{id:userId,role_code:userRole||"AGENT"});if(!existing){const err=new Error("\u0645\u0644\u06A9 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F \u06CC\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0645\u062C\u0627\u0632 \u0646\u06CC\u0633\u062A.");err.status=404;err.code="PROPERTY_NOT_FOUND";throw err}if(!isManager&&existing.assigned_agent_id!==userId&&existing.created_by_user_id!==userId){const err=new Error("\u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0627\u06CC\u0646 \u0645\u0644\u06A9 \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.");err.status=403;err.code="FORBIDDEN";throw err}const priceTotal=data.price_total!==void 0?data.price_total:existing.price_total;const areaSqm=data.area_sqm!==void 0?Number(data.area_sqm):existing.area_sqm;const pricePerMeter=priceTotal&&areaSqm?Math.round(Number(priceTotal)/areaSqm):existing.price_per_meter;const visibility=data.visibility?data.visibility==="PRIVATE"?"PRIVATE":"AGENCY":existing.visibility||"AGENCY";let assignedAgentId=existing.assigned_agent_id;if(isManager&&(data.assigned_to_user_id||data.assigned_agent_id)){assignedAgentId=data.assigned_to_user_id||data.assigned_agent_id}await this.pg.query(`UPDATE properties SET
        title = COALESCE($1, title),
        property_type = COALESCE($2, property_type),
        listing_type = COALESCE($3, listing_type),
        price_total = $4,
        price_per_meter = $5,
        rent_amount = $6,
        deposit_amount = $7,
        area_sqm = $8,
        bedrooms = COALESCE($9, bedrooms),
        floor = COALESCE($10, floor),
        has_parking = COALESCE($11, has_parking),
        has_elevator = COALESCE($12, has_elevator),
        has_storage = COALESCE($13, has_storage),
        has_balcony = COALESCE($14, has_balcony),
        description = COALESCE($15, description),
        neighborhood = COALESCE($16, neighborhood),
        visibility = $17,
        assigned_agent_id = $18,
        status = COALESCE($21, status),
        is_archived = CASE WHEN $21::text IS NULL THEN is_archived ELSE $21 = 'ARCHIVED' END,
        archived_at = CASE WHEN $21::text IS NULL THEN archived_at WHEN $21 = 'ARCHIVED' THEN COALESCE(archived_at, CURRENT_TIMESTAMP) ELSE NULL END,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $19 AND tenant_id = $20`,[data.title,data.property_type,data.listing_type,priceTotal||null,pricePerMeter||null,data.rent_amount!==void 0?data.rent_amount:existing.rent_amount,data.deposit_amount!==void 0?data.deposit_amount:existing.deposit_amount,areaSqm,data.bedrooms,data.floor,data.has_parking,data.has_elevator,data.has_storage,data.has_balcony,data.description,data.neighborhood,visibility,assignedAgentId,propertyId,tenantId,data.status === "AVAILABLE" ? "ACTIVE" : data.status === "UNDER_NEGOTIATION" ? "NEGOTIATION" : data.status]);if(assignedAgentId!==existing.assigned_agent_id){await this.addAuditLog(tenantId,userId,"PROPERTY_ASSIGNED","PROPERTY",propertyId,{old_agent_id:existing.assigned_agent_id,new_agent_id:assignedAgentId})}await this.addAuditLog(tenantId,userId,"PROPERTY_UPDATED","PROPERTY",propertyId);return await this.getPropertyById(tenantId,propertyId,{id:userId,role_code:userRole||"AGENT"})}async assignProperty(tenantId,propertyId,newAgentId,managerUserId){await this.init();const existing=await this.getPropertyById(tenantId,propertyId);if(!existing){const err=new Error("\u0645\u0644\u06A9 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.");err.status=404;err.code="PROPERTY_NOT_FOUND";throw err}const agentRes=await this.pg.query(`SELECT id, is_active, display_name FROM users WHERE tenant_id = $1 AND id = $2 LIMIT 1`,[tenantId,newAgentId]);if(agentRes.rows.length===0||!agentRes.rows[0].is_active){const err=new Error("\u0645\u0634\u0627\u0648\u0631 \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647 \u0645\u0639\u062A\u0628\u0631 \u06CC\u0627 \u0641\u0639\u0627\u0644 \u0646\u06CC\u0633\u062A.");err.status=400;err.code="INVALID_AGENT";throw err}const oldAgentId=existing.assigned_agent_id;await this.pg.query(`UPDATE properties SET assigned_agent_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3`,[newAgentId,propertyId,tenantId]);await this.addAuditLog(tenantId,managerUserId,"PROPERTY_ASSIGNED","PROPERTY",propertyId,{old_agent_id:oldAgentId,new_agent_id:newAgentId,new_agent_name:agentRes.rows[0].display_name});return await this.getPropertyById(tenantId,propertyId)}async archiveProperty(tenantId,propertyId,userId){await this.init();await this.pg.query(`UPDATE properties
       SET is_archived = true, status = 'ARCHIVED', archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2`,[propertyId,tenantId]);await this.addAuditLog(tenantId,userId,"PROPERTY_ARCHIVED","PROPERTY",propertyId);return await this.getPropertyById(tenantId,propertyId)}async updatePropertyStatus(tenantId,propertyId,userId,newStatus){await this.init();const existing=await this.getPropertyById(tenantId,propertyId);if(!existing){const err=new Error("\u0645\u0644\u06A9 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.");err.status=404;err.code="PROPERTY_NOT_FOUND";throw err}newStatus = newStatus === "AVAILABLE" ? "ACTIVE" : newStatus === "UNDER_NEGOTIATION" ? "NEGOTIATION" : newStatus;const isArchived=newStatus==="ARCHIVED";const archivedAt=isArchived?new Date().toISOString():null;await this.pg.query(`UPDATE properties
       SET status = $1, is_archived = $2, archived_at = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND tenant_id = $5`,[newStatus,isArchived,archivedAt,propertyId,tenantId]);await this.addAuditLog(tenantId,userId,"PROPERTY_STATUS_CHANGED","PROPERTY",propertyId,{old_status:existing.status,new_status:newStatus});return await this.getPropertyById(tenantId,propertyId)}async getCustomers(tenantId,options={},requestingUser=null){await this.init();let query=`
      SELECT c.*,
             b.name as branch_name,
             u_creator.display_name as created_by_name,
             u_assignee.display_name as assigned_agent_name
      FROM customers c
      LEFT JOIN branches b ON b.id = c.branch_id
      LEFT JOIN users u_creator ON u_creator.id = c.created_by_user_id
      LEFT JOIN users u_assignee ON u_assignee.id = c.assigned_agent_id
      WHERE c.tenant_id = $1
    `;const params=[tenantId];let paramIndex=2;if(requestingUser&&!this.isOfficeAdmin(requestingUser)){if(requestingUser.role_code==="BRANCH_MANAGER"){params.push(requestingUser.id,requestingUser.branch_id||null);query+=` AND (c.visibility = 'AGENCY' OR c.branch_id = $${paramIndex+1} OR c.assigned_agent_id = $${paramIndex} OR (c.assigned_agent_id IS NULL AND c.created_by_user_id = $${paramIndex}))`;paramIndex+=2}else{params.push(requestingUser.id,requestingUser.branch_id||null);query+=` AND (c.visibility = 'AGENCY' OR (c.visibility = 'BRANCH' AND c.branch_id = $${paramIndex+1}) OR c.assigned_agent_id = $${paramIndex} OR (c.assigned_agent_id IS NULL AND c.created_by_user_id = $${paramIndex}))`;paramIndex+=2}}else if(options?.visibility&&options.visibility!=="ALL"){params.push(options.visibility);query+=` AND c.visibility = $${paramIndex++}`}if(options?.branch_id&&options.branch_id!=="ALL"){params.push(options.branch_id);query+=` AND c.branch_id = $${paramIndex++}`}if(!options?.include_archived){query+=` AND c.is_archived = false`}if(options?.customer_type&&options.customer_type!=="ALL"){query+=` AND c.customer_type = $${paramIndex++}`;params.push(options.customer_type)}if(options?.lead_status&&options.lead_status!=="ALL"){query+=` AND c.lead_status = $${paramIndex++}`;params.push(options.lead_status)}if(options?.temperature&&options.temperature!=="ALL"){query+=` AND c.temperature = $${paramIndex++}`;params.push(options.temperature)}if(options?.assigned_agent_id){query+=` AND c.assigned_agent_id = $${paramIndex++}`;params.push(options.assigned_agent_id)}if(options?.search&&options.search.trim()){const q=normalizeDigits(options.search.trim());const searchPattern=`%${q}%`;query+=` AND (
        c.display_name ILIKE $${paramIndex}
        OR c.phone ILIKE $${paramIndex}
        OR c.secondary_phone ILIKE $${paramIndex}
        OR c.code ILIKE $${paramIndex}
        OR c.preferred_area_text ILIKE $${paramIndex}
        OR c.notes ILIKE $${paramIndex}
      )`;params.push(searchPattern);paramIndex++}switch(options?.sort_by){case"next_follow_up":query+=` ORDER BY c.next_follow_up_at ASC NULLS LAST, c.created_at DESC`;break;case"priority":query+=` ORDER BY CASE c.temperature WHEN 'HOT' THEN 1 WHEN 'WARM' THEN 2 ELSE 3 END, c.created_at DESC`;break;case"created_at":query+=` ORDER BY c.created_at DESC`;break;case"latest_activity":default:query+=` ORDER BY COALESCE(c.last_interaction_at, c.created_at) DESC`;break}if(options?.limit){query+=` LIMIT $${paramIndex++}`;params.push(options.limit)}if(options?.offset){query+=` OFFSET $${paramIndex++}`;params.push(options.offset)}const res=await this.pg.query(query,params);return res.rows.map(this.mapCustomerRow)}async getCustomersPaginated(tenantId,options={},requestingUser=null){await this.init();let whereClause=`WHERE c.tenant_id = $1`;const params=[tenantId];let paramIndex=2;if(requestingUser&&!this.isOfficeAdmin(requestingUser)){if(requestingUser.role_code==="BRANCH_MANAGER"){params.push(requestingUser.id,requestingUser.branch_id||null);whereClause+=` AND (c.visibility = 'AGENCY' OR c.branch_id = $${paramIndex+1} OR c.assigned_agent_id = $${paramIndex} OR (c.assigned_agent_id IS NULL AND c.created_by_user_id = $${paramIndex}))`;paramIndex+=2}else{params.push(requestingUser.id,requestingUser.branch_id||null);whereClause+=` AND (c.visibility = 'AGENCY' OR (c.visibility = 'BRANCH' AND c.branch_id = $${paramIndex+1}) OR c.assigned_agent_id = $${paramIndex} OR (c.assigned_agent_id IS NULL AND c.created_by_user_id = $${paramIndex}))`;paramIndex+=2}}else if(options.visibility&&options.visibility!=="ALL"){params.push(options.visibility);whereClause+=` AND c.visibility = $${paramIndex++}`}if(options?.branch_id&&options.branch_id!=="ALL"){params.push(options.branch_id);whereClause+=` AND c.branch_id = $${paramIndex++}`}const status=String(options.status||(options.include_archived?"archived":"active")).toLowerCase();if(status==="archived"){whereClause+=` AND c.is_archived = true`}else if(status==="active"){whereClause+=` AND c.is_archived = false`}if(options.customer_type&&options.customer_type!=="ALL"){whereClause+=` AND c.customer_type = $${paramIndex++}`;params.push(options.customer_type)}if(options.lead_status&&options.lead_status!=="ALL"){whereClause+=` AND c.lead_status = $${paramIndex++}`;params.push(options.lead_status)}if(options.temperature&&options.temperature!=="ALL"){whereClause+=` AND c.temperature = $${paramIndex++}`;params.push(options.temperature)}if(options.assigned_agent_id){whereClause+=` AND c.assigned_agent_id = $${paramIndex++}`;params.push(options.assigned_agent_id)}if(options.search&&options.search.trim()){const q=normalizeDigits(options.search.trim());const searchPattern=`%${q}%`;whereClause+=` AND (
        c.display_name ILIKE $${paramIndex}
        OR c.phone ILIKE $${paramIndex}
        OR c.secondary_phone ILIKE $${paramIndex}
        OR c.code ILIKE $${paramIndex}
        OR c.preferred_area_text ILIKE $${paramIndex}
        OR c.notes ILIKE $${paramIndex}
      )`;params.push(searchPattern);paramIndex++}const countRes=await this.pg.query(`SELECT count(*)::text as count FROM customers c ${whereClause}`,params);const total=parseInt(countRes.rows[0]?.count||"0",10);let orderClause=` ORDER BY COALESCE(c.last_interaction_at, c.created_at) DESC`;switch(options.sort_by){case"next_follow_up":orderClause=` ORDER BY c.next_follow_up_at ASC NULLS LAST, c.created_at DESC`;break;case"priority":orderClause=` ORDER BY CASE c.temperature WHEN 'HOT' THEN 1 WHEN 'WARM' THEN 2 ELSE 3 END, c.created_at DESC`;break;case"created_at":orderClause=` ORDER BY c.created_at DESC`;break;case"latest_activity":default:orderClause=` ORDER BY COALESCE(c.last_interaction_at, c.created_at) DESC`;break}const page=Math.max(1,Number(options.page)||1);const limit=Math.max(1,Number(options.limit)||10);const offset=(page-1)*limit;const query=`
      SELECT c.*,
             b.name as branch_name,
             u_creator.display_name as created_by_name,
             u_assignee.display_name as assigned_agent_name
      FROM customers c
      LEFT JOIN branches b ON b.id = c.branch_id
      LEFT JOIN users u_creator ON u_creator.id = c.created_by_user_id
      LEFT JOIN users u_assignee ON u_assignee.id = c.assigned_agent_id
      ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;params.push(limit,offset);const res=await this.pg.query(query,params);return{customers:res.rows.map(this.mapCustomerRow),total}}async getCustomerById(tenantId, id, requestingUser = null) {
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
    customer.requirements = await this.getCustomerRequirements(tenantId, id);return customer}async checkDuplicateCustomer(tenantId,phone){await this.init();const normalizedPhone=normalizeIranianPhone(phone);const res=await this.pg.query(`SELECT * FROM customers WHERE tenant_id = $1 AND (phone = $2 OR secondary_phone = $2) LIMIT 1`,[tenantId,normalizedPhone]);if(res.rows.length>0){return{is_duplicate:true,existing_customer:this.mapCustomerRow(res.rows[0])}}return{is_duplicate:false}}async createCustomer(tenantId,userId,data,userRole){await this.init();const id=crypto.randomUUID();const normalizedPhone=normalizeIranianPhone(data.phone);const existing=await this.pg.query(`SELECT id, display_name, phone, code FROM customers WHERE tenant_id = $1 AND phone = $2 LIMIT 1`,[tenantId,normalizedPhone]);if(existing.rows.length>0){const err=new Error(`\u0627\u06CC\u0646 \u0634\u0645\u0627\u0631\u0647 \u0642\u0628\u0644\u0627\u064B \u062F\u0631 \u062F\u0641\u062A\u0631 \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A.`);err.status=409;err.code="DUPLICATE_CUSTOMER";err.existing_customer={id:existing.rows[0].id,display_name:existing.rows[0].display_name,phone:existing.rows[0].phone,code:existing.rows[0].code};throw err}let nextVal=1001;try{const counterRes=await this.pg.query(`SELECT current_value FROM tenant_counters WHERE tenant_id = $1 AND counter_name = 'customer_code' FOR UPDATE`,[tenantId]);if(counterRes.rows.length===0){await this.pg.query(`INSERT INTO tenant_counters (tenant_id, counter_name, current_value) VALUES ($1, 'customer_code', 1001)`,[tenantId])}else{nextVal=counterRes.rows[0].current_value+1;await this.pg.query(`UPDATE tenant_counters SET current_value = $1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $2 AND counter_name = 'customer_code'`,[nextVal,tenantId])}}catch{const countRes=await this.pg.query(`SELECT count(*)::text as count FROM customers WHERE tenant_id = $1`,[tenantId]);nextVal=1e3+Number(countRes.rows[0].count)+1}const customerCode=`C-${nextVal}`;const displayName=`${data.first_name} ${data.last_name}`.trim();const leadStatus=data.lead_status||"NEW";const temperature=data.temperature||"WARM";const visibility=data.visibility==="PRIVATE"?"PRIVATE":"AGENCY";const isManager=this.isManagerUser({role_code:userRole});const assignedAgentId=isManager&&(data.assigned_to_user_id||data.assigned_agent_id)?data.assigned_to_user_id||data.assigned_agent_id:data.assigned_agent_id||userId;let custBranchId=data.branch_id||null;if(!custBranchId){const u=await this.getUserById(userId);custBranchId=u?.branch_id||null}if(!custBranchId){const mainB=await this.pg.query(`SELECT id FROM branches WHERE tenant_id = $1 AND is_main = true LIMIT 1`,[tenantId]);custBranchId=mainB.rows[0]?.id||null}try{await this.pg.query(`INSERT INTO customers (
          id, tenant_id, code, first_name, last_name, display_name, phone, secondary_phone, email,
          customer_type, lead_status, temperature, lead_source, budget_min, budget_max,
          preferred_city, preferred_area_text, notes,
          visibility, assigned_agent_id, created_by_user_id, branch_id
         ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15,
          $16, $17, $18,
          $19, $20, $21, $22
         )`,[id,tenantId,customerCode,data.first_name.trim(),data.last_name.trim(),displayName,normalizedPhone,data.secondary_phone?normalizeIranianPhone(data.secondary_phone):null,data.email||null,data.customer_type||"BUYER",leadStatus,temperature,data.lead_source||"IN_PERSON",data.budget_min||null,data.budget_max||null,data.preferred_city||null,data.preferred_area_text||null,data.notes||null,visibility,assignedAgentId,userId,custBranchId])}catch(err){if(err.code==="23505"){const conflictErr=new Error(`\u0627\u06CC\u0646 \u0634\u0645\u0627\u0631\u0647 \u0642\u0628\u0644\u0627\u064B \u062F\u0631 \u062F\u0641\u062A\u0631 \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A.`);conflictErr.status=409;conflictErr.code="DUPLICATE_CUSTOMER";throw conflictErr}throw err}await this.createInteraction(tenantId,id,userId,{interaction_type:"NOTE",title:"\u062B\u0628\u062A \u067E\u0631\u0648\u0646\u062F\u0647 \u0645\u062A\u0642\u0627\u0636\u06CC",description:data.notes||`\u067E\u0631\u0648\u0646\u062F\u0647 \u0645\u0634\u062A\u0631\u06CC \u0628\u0627 \u06A9\u062F ${customerCode} \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062F\u0631 \u0633\u0627\u0645\u0627\u0646\u0647 \u0627\u06CC\u062C\u0627\u062F \u0634\u062F`});await this.addAuditLog(tenantId,userId,"CUSTOMER_CREATED","CUSTOMER",id,{code:customerCode,visibility});const c=await this.getCustomerById(tenantId,id);return c}async updateCustomer(tenantId,customerId,data,userId,userRole){await this.init();const isManager=this.isManagerUser({role_code:userRole});const existing=await this.getCustomerById(tenantId,customerId,{id:userId,role_code:userRole||"AGENT"});if(!existing){const err=new Error("\u0645\u0634\u062A\u0631\u06CC \u06CC\u0627\u0641\u062A \u0646\u0634\u062F \u06CC\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0645\u062C\u0627\u0632 \u0646\u06CC\u0633\u062A.");err.status=404;err.code="CUSTOMER_NOT_FOUND";throw err}if(!isManager&&existing.assigned_agent_id!==userId&&existing.created_by_user_id!==userId){const err=new Error("\u0634\u0645\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0627\u06CC\u0646 \u0645\u0634\u062A\u0631\u06CC \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.");err.status=403;err.code="FORBIDDEN";throw err}const firstName=data.first_name!==void 0?data.first_name.trim():existing.first_name;const lastName=data.last_name!==void 0?data.last_name.trim():existing.last_name;const displayName=`${firstName} ${lastName}`.trim();const visibility=data.visibility?data.visibility==="PRIVATE"?"PRIVATE":"AGENCY":existing.visibility||"AGENCY";let assignedAgentId=existing.assigned_agent_id;if(isManager&&(data.assigned_to_user_id||data.assigned_agent_id)){assignedAgentId=data.assigned_to_user_id||data.assigned_agent_id}if(data.lead_status&&data.lead_status!==existing.lead_status){const statusLabels={NEW:"\u062C\u062F\u06CC\u062F",CONTACTED:"\u062A\u0645\u0627\u0633 \u0627\u0648\u0644\u06CC\u0647",QUALIFIED:"\u062A\u0627\u06CC\u06CC\u062F \u0635\u0644\u0627\u062D\u06CC\u062A \u0648 \u0646\u06CC\u0627\u0632\u0633\u0646\u062C\u06CC",SEARCHING:"\u062F\u0631 \u062D\u0627\u0644 \u062C\u0633\u062A\u062C\u0648",REQUIREMENTS_MET:"\u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC \u0645\u0646\u0637\u0628\u0642 \u06CC\u0627\u0641\u062A \u0634\u062F",VISIT_SCHEDULED:"\u0647\u0645\u0627\u0647\u0646\u06AF\u06CC \u0628\u0627\u0632\u062F\u06CC\u062F",NEGOTIATING:"\u062F\u0631 \u062D\u0627\u0644 \u0645\u0630\u0627\u06A9\u0631\u0647",CLOSED_WON:"\u0642\u0631\u0627\u0631\u062F\u0627\u062F \u0646\u0647\u0627\u06CC\u06CC (\u0645\u0648\u0641\u0642)",CLOSED_LOST:"\u0628\u0627\u06CC\u06AF\u0627\u0646\u06CC / \u0645\u0646\u0635\u0631\u0641 \u0634\u062F\u0647",INACTIVE:"\u063A\u06CC\u0631\u0641\u0639\u0627\u0644"};await this.createInteraction(tenantId,customerId,userId,{interaction_type:"STATUS_CHANGED",title:"\u062A\u063A\u06CC\u06CC\u0631 \u0648\u0636\u0639\u06CC\u062A \u067E\u0631\u0648\u0646\u062F\u0647",description:`\u0648\u0636\u0639\u06CC\u062A \u0627\u0632 \xAB${statusLabels[existing.lead_status]||existing.lead_status}\xBB \u0628\u0647 \xAB${statusLabels[data.lead_status]||data.lead_status}\xBB \u0627\u0631\u062A\u0642\u0627 \u06CC\u0627\u0641\u062A`});await this.addAuditLog(tenantId,userId,"CUSTOMER_STATUS_CHANGED","CUSTOMER",customerId,{old_status:existing.lead_status,new_status:data.lead_status})}if(data.temperature&&data.temperature!==existing.temperature){const tempLabels={HOT:"\u062F\u0627\u063A (\u0641\u0648\u0631\u06CC \u0648 \u0627\u0648\u0644\u0648\u06CC\u062A \u0628\u0627\u0644\u0627)",WARM:"\u06AF\u0631\u0645 (\u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0639\u0627\u062F\u06CC)",COLD:"\u0633\u0631\u062F (\u0628\u062F\u0648\u0646 \u0641\u0648\u0631\u06CC\u062A)"};await this.createInteraction(tenantId,customerId,userId,{interaction_type:"TEMPERATURE_CHANGED",title:"\u062A\u063A\u06CC\u06CC\u0631 \u0627\u0648\u0644\u0648\u06CC\u062A \u0648 \u062D\u0631\u0627\u0631\u062A \u0645\u0634\u062A\u0631\u06CC",description:`\u062D\u0631\u0627\u0631\u062A \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0645\u0634\u062A\u0631\u06CC \u0628\u0647 \xAB${tempLabels[data.temperature]||data.temperature}\xBB \u062A\u063A\u06CC\u06CC\u0631 \u06CC\u0627\u0641\u062A`});await this.addAuditLog(tenantId,userId,"CUSTOMER_TEMPERATURE_CHANGED","CUSTOMER",customerId,{old_temp:existing.temperature,new_temp:data.temperature})}await this.pg.query(`UPDATE customers SET
        first_name = $1,
        last_name = $2,
        display_name = $3,
        customer_type = COALESCE($4, customer_type),
        lead_status = COALESCE($5, lead_status),
        temperature = COALESCE($6, temperature),
        lead_source = COALESCE($7, lead_source),
        budget_min = $8,
        budget_max = $9,
        preferred_city = COALESCE($10, preferred_city),
        preferred_area_text = COALESCE($11, preferred_area_text),
        notes = COALESCE($12, notes),
        visibility = $13,
        assigned_agent_id = $14,
        is_archived = COALESCE($15, is_archived),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $16 AND tenant_id = $17`,[firstName,lastName,displayName,data.customer_type,data.lead_status,data.temperature,data.lead_source,data.budget_min!==void 0?data.budget_min:existing.budget_min||null,data.budget_max!==void 0?data.budget_max:existing.budget_max||null,data.preferred_city,data.preferred_area_text,data.notes,visibility,assignedAgentId,data.is_archived,customerId,tenantId]);if(assignedAgentId!==existing.assigned_agent_id){await this.addAuditLog(tenantId,userId,"CUSTOMER_ASSIGNED","CUSTOMER",customerId,{old_agent_id:existing.assigned_agent_id,new_agent_id:assignedAgentId})}await this.addAuditLog(tenantId,userId,"CUSTOMER_UPDATED","CUSTOMER",customerId);return await this.getCustomerById(tenantId,customerId,{id:userId,role_code:userRole||"AGENT"})}async assignCustomer(tenantId,customerId,newAgentId,managerUserId){await this.init();const existing=await this.getCustomerById(tenantId,customerId);if(!existing){const err=new Error("\u0645\u0634\u062A\u0631\u06CC \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.");err.status=404;err.code="CUSTOMER_NOT_FOUND";throw err}const agentRes=await this.pg.query(`SELECT id, is_active, display_name FROM users WHERE tenant_id = $1 AND id = $2 LIMIT 1`,[tenantId,newAgentId]);if(agentRes.rows.length===0||!agentRes.rows[0].is_active){const err=new Error("\u0645\u0634\u0627\u0648\u0631 \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647 \u0645\u0639\u062A\u0628\u0631 \u06CC\u0627 \u0641\u0639\u0627\u0644 \u0646\u06CC\u0633\u062A.");err.status=400;err.code="INVALID_AGENT";throw err}const oldAgentId=existing.assigned_agent_id;await this.pg.query(`UPDATE customers SET assigned_agent_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3`,[newAgentId,customerId,tenantId]);await this.createInteraction(tenantId,customerId,managerUserId,{interaction_type:"STATUS_CHANGED",title:"\u0648\u0627\u06AF\u0630\u0627\u0631\u06CC \u067E\u0631\u0648\u0646\u062F\u0647 \u0645\u062A\u0642\u0627\u0636\u06CC",description:`\u067E\u0631\u0648\u0646\u062F\u0647 \u0645\u0634\u062A\u0631\u06CC \u0628\u0647 \u0645\u0634\u0627\u0648\u0631 \xAB${agentRes.rows[0].display_name}\xBB \u062A\u062E\u0635\u06CC\u0635 \u062F\u0627\u062F\u0647 \u0634\u062F.`});await this.addAuditLog(tenantId,managerUserId,"CUSTOMER_ASSIGNED","CUSTOMER",customerId,{old_agent_id:oldAgentId,new_agent_id:newAgentId,new_agent_name:agentRes.rows[0].display_name});return await this.getCustomerById(tenantId,customerId)}async archiveCustomer(tenantId,customerId,userId){await this.init();await this.pg.query(`UPDATE customers SET is_archived = true, archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2`,[customerId,tenantId]);await this.addAuditLog(tenantId,userId,"CUSTOMER_ARCHIVED","CUSTOMER",customerId);return await this.getCustomerById(tenantId,customerId)}async mergeCustomers(tenantId,sourceCustomerId,targetCustomerId,userId,reason){await this.init();if(sourceCustomerId===targetCustomerId){const err=new Error("\u0634\u0646\u0627\u0633\u0647 \u0645\u0634\u062A\u0631\u06CC \u0645\u0628\u062F\u0623 \u0648 \u0645\u0642\u0635\u062F \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u06CC\u06A9\u0633\u0627\u0646 \u0628\u0627\u0634\u062F.");err.status=400;throw err}const[source,target]=await Promise.all([this.getCustomerById(tenantId,sourceCustomerId),this.getCustomerById(tenantId,targetCustomerId)]);if(!source||!target){const err=new Error("\u06CC\u06A9\u06CC \u0627\u0632 \u0645\u0634\u062A\u0631\u06CC\u0627\u0646 \u0645\u0628\u062F\u0623 \u06CC\u0627 \u0645\u0642\u0635\u062F \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.");err.status=404;throw err}await this.pg.query("BEGIN");try{await this.pg.query(`UPDATE customer_requirements SET customer_id = $1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $2 AND customer_id = $3`,[targetCustomerId,tenantId,sourceCustomerId]);await this.pg.query(`UPDATE interactions SET customer_id = $1 WHERE tenant_id = $2 AND customer_id = $3`,[targetCustomerId,tenantId,sourceCustomerId]);await this.pg.query(`UPDATE tasks SET customer_id = $1, customer_name = $2, customer_phone = $3, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $4 AND customer_id = $5`,[targetCustomerId,target.display_name,target.phone,tenantId,sourceCustomerId]);await this.pg.query(`UPDATE customer_property_interactions SET customer_id = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE tenant_id = $2 AND customer_id = $3 AND property_id NOT IN (
           SELECT property_id FROM customer_property_interactions WHERE tenant_id = $2 AND customer_id = $1
         )`,[targetCustomerId,tenantId,sourceCustomerId]);await this.pg.query(`DELETE FROM customer_property_interactions WHERE tenant_id = $1 AND customer_id = $2`,[tenantId,sourceCustomerId]);const mergeNote=`
[\u067E\u0631\u0648\u0646\u062F\u0647 \u062F\u0631 \u062A\u0627\u0631\u06CC\u062E ${new Date().toLocaleDateString("fa-IR")} \u0628\u0627 \u067E\u0631\u0648\u0646\u062F\u0647 ${target.display_name} (${target.code||target.phone}) \u0627\u062F\u063A\u0627\u0645 \u06AF\u0631\u062F\u06CC\u062F. \u0639\u0644\u062A: ${reason||"\u0634\u0645\u0627\u0631\u0647 \u062A\u06A9\u0631\u0627\u0631\u06CC"}]`;await this.pg.query(`UPDATE customers SET is_archived = true, archived_at = CURRENT_TIMESTAMP, notes = COALESCE(notes, '') || $1 WHERE tenant_id = $2 AND id = $3`,[mergeNote,tenantId,sourceCustomerId]);await this.createInteraction(tenantId,targetCustomerId,userId,{interaction_type:"MERGED",title:"\u0627\u062F\u063A\u0627\u0645 \u067E\u0631\u0648\u0646\u062F\u0647 \u0645\u062A\u0642\u0627\u0636\u06CC",description:`\u0633\u0648\u0627\u0628\u0642\u060C \u0646\u06CC\u0627\u0632\u0645\u0646\u062F\u06CC\u200C\u0647\u0627 \u0648 \u067E\u06CC\u06AF\u06CC\u0631\u06CC\u200C\u0647\u0627\u06CC \u067E\u0631\u0648\u0646\u062F\u0647 \xAB${source.display_name}\xBB (${source.phone}) \u0628\u0647 \u0627\u06CC\u0646 \u067E\u0631\u0648\u0646\u062F\u0647 \u0645\u0646\u062A\u0642\u0644 \u0634\u062F. ${reason?`\u0639\u0644\u062A: ${reason}`:""}`});await this.addAuditLog(tenantId,userId,"CUSTOMER_MERGED","CUSTOMER",targetCustomerId,{source_id:sourceCustomerId,source_name:source.display_name,target_id:targetCustomerId,reason});await this.pg.query("COMMIT")}catch(e){await this.pg.query("ROLLBACK");throw e}await this.recalculateCustomerNextFollowUp(tenantId,targetCustomerId);return await this.getCustomerById(tenantId,targetCustomerId)}async getCustomerRequirements(tenantId,customerId,includeInactive=false){await this.init();const activeCondition=includeInactive?"":"AND is_active = true";const res=await this.pg.query(`SELECT * FROM customer_requirements WHERE tenant_id = $1 AND customer_id = $2 ${activeCondition} ORDER BY created_at DESC`,[tenantId,customerId]);return res.rows.map(row=>({id:row.id,tenant_id:row.tenant_id,customer_id:row.customer_id,property_type:row.property_type,listing_type:row.listing_type,transaction_type:row.listing_type,min_budget:row.min_budget?Number(row.min_budget):void 0,max_budget:row.max_budget?Number(row.max_budget):void 0,min_area:row.min_area?Number(row.min_area):void 0,max_area:row.max_area?Number(row.max_area):void 0,min_bedrooms:row.min_bedrooms,max_bedrooms:row.max_bedrooms,preferred_city:row.preferred_city,city:row.preferred_city,preferred_neighborhoods:row.preferred_neighborhoods,neighborhoods:row.preferred_neighborhoods,needs_parking:row.needs_parking,needs_elevator:row.needs_elevator,needs_storage:row.needs_storage,needs_balcony:row.needs_balcony,required_features:row.required_features||[],preferred_features:row.preferred_features||[],excluded_features:row.excluded_features||[],must_have:row.must_have,deal_breakers:row.deal_breakers,priority:row.priority,is_active:Boolean(row.is_active),notes:row.notes,created_at:row.created_at,updated_at:row.updated_at}))}async getCustomerRequirementById(tenantId,requirementId){await this.init();const res=await this.pg.query(`SELECT * FROM customer_requirements WHERE tenant_id = $1 AND id = $2 LIMIT 1`,[tenantId,requirementId]);if(res.rows.length===0)return null;const row=res.rows[0];return{id:row.id,tenant_id:row.tenant_id,customer_id:row.customer_id,property_type:row.property_type,listing_type:row.listing_type,transaction_type:row.listing_type,min_budget:row.min_budget?Number(row.min_budget):void 0,max_budget:row.max_budget?Number(row.max_budget):void 0,min_area:row.min_area?Number(row.min_area):void 0,max_area:row.max_area?Number(row.max_area):void 0,min_bedrooms:row.min_bedrooms,max_bedrooms:row.max_bedrooms,preferred_city:row.preferred_city,city:row.preferred_city,preferred_neighborhoods:row.preferred_neighborhoods,neighborhoods:row.preferred_neighborhoods,needs_parking:row.needs_parking,needs_elevator:row.needs_elevator,needs_storage:row.needs_storage,needs_balcony:row.needs_balcony,required_features:row.required_features||[],preferred_features:row.preferred_features||[],excluded_features:row.excluded_features||[],must_have:row.must_have,deal_breakers:row.deal_breakers,priority:row.priority,is_active:Boolean(row.is_active),notes:row.notes,created_at:row.created_at,updated_at:row.updated_at}}async createCustomerRequirement(tenantId, customerId, data, userId = null) {
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
  }async updateCustomerRequirement(tenantId,requirementId,data,userId){await this.init();const existing=await this.getCustomerRequirementById(tenantId,requirementId);if(!existing){const err=new Error("\u0646\u06CC\u0627\u0632\u0645\u0646\u062F\u06CC \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.");err.status=404;throw err}const listingType=data.transaction_type||data.listing_type||existing.listing_type;const propertyType=data.property_type||existing.property_type;const city=data.city||data.preferred_city||existing.preferred_city;const neighborhoods=data.neighborhoods||data.preferred_neighborhoods||existing.preferred_neighborhoods;await this.pg.query(`UPDATE customer_requirements SET
        property_type = $1,
        listing_type = $2,
        min_budget = $3,
        max_budget = $4,
        min_area = $5,
        max_area = $6,
        min_bedrooms = $7,
        max_bedrooms = $8,
        preferred_city = $9,
        preferred_neighborhoods = $10,
        needs_parking = $11,
        needs_elevator = $12,
        needs_storage = $13,
        needs_balcony = $14,
        required_features = $15,
        preferred_features = $16,
        excluded_features = $17,
        must_have = $18,
        deal_breakers = $19,
        priority = $20,
        notes = $21,
        is_active = COALESCE($22, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $23 AND tenant_id = $24`,[propertyType,listingType,data.min_budget!==void 0?data.min_budget:existing.min_budget||null,data.max_budget!==void 0?data.max_budget:existing.max_budget||null,data.min_area!==void 0?data.min_area:existing.min_area||null,data.max_area!==void 0?data.max_area:existing.max_area||null,data.min_bedrooms!==void 0?data.min_bedrooms:existing.min_bedrooms||null,data.max_bedrooms!==void 0?data.max_bedrooms:existing.max_bedrooms||null,city,neighborhoods?JSON.stringify(neighborhoods):null,data.needs_parking!==void 0?Boolean(data.needs_parking):existing.needs_parking,data.needs_elevator!==void 0?Boolean(data.needs_elevator):existing.needs_elevator,data.needs_storage!==void 0?Boolean(data.needs_storage):existing.needs_storage,data.needs_balcony!==void 0?Boolean(data.needs_balcony):existing.needs_balcony,data.required_features?JSON.stringify(data.required_features):null,data.preferred_features?JSON.stringify(data.preferred_features):null,data.excluded_features?JSON.stringify(data.excluded_features):null,data.must_have!==void 0?data.must_have:existing.must_have||null,data.deal_breakers!==void 0?data.deal_breakers:existing.deal_breakers||null,data.priority||existing.priority||"MEDIUM",data.notes!==void 0?data.notes:existing.notes||null,data.is_active,requirementId,tenantId]);if(userId&&existing.customer_id){await this.createInteraction(tenantId,existing.customer_id,userId,{interaction_type:"REQUIREMENT_UPDATED",title:"\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0646\u06CC\u0627\u0632\u0645\u0646\u062F\u06CC \u0645\u0644\u06A9",description:`\u062C\u0632\u0626\u06CC\u0627\u062A \u0634\u0631\u0627\u06CC\u0637 \u062F\u0631\u062E\u0648\u0627\u0633\u062A\u06CC \u0645\u062A\u0642\u0627\u0636\u06CC \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0634\u062F`});await this.addAuditLog(tenantId,userId,"REQUIREMENT_UPDATED","CUSTOMER_REQUIREMENT",requirementId)}return await this.getCustomerRequirementById(tenantId,requirementId)}async duplicateCustomerRequirement(tenantId,requirementId,userId){await this.init();const existing=await this.getCustomerRequirementById(tenantId,requirementId);if(!existing||!existing.customer_id){const err=new Error("\u0646\u06CC\u0627\u0632\u0645\u0646\u062F\u06CC \u0628\u0631\u0627\u06CC \u062A\u06A9\u0631\u0627\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.");err.status=404;throw err}const cloned=await this.createCustomerRequirement(tenantId,existing.customer_id,{...existing,notes:existing.notes?`${existing.notes} (\u06A9\u067E\u06CC)`:"\u06A9\u067E\u06CC \u0646\u06CC\u0627\u0632\u0645\u0646\u062F\u06CC"},userId);return cloned}async deleteCustomerRequirement(tenantId,requirementId,userId){await this.init();const existing=await this.getCustomerRequirementById(tenantId,requirementId);if(!existing)return false;await this.pg.query(`UPDATE customer_requirements SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2`,[requirementId,tenantId]);if(userId&&existing.customer_id){await this.createInteraction(tenantId,existing.customer_id,userId,{interaction_type:"NOTE",title:"\u0628\u0627\u06CC\u06AF\u0627\u0646\u06CC \u0646\u06CC\u0627\u0632\u0645\u0646\u062F\u06CC \u0645\u0644\u06A9",description:"\u06CC\u06A9\u06CC \u0627\u0632 \u0634\u0631\u0648\u0637 \u0648 \u062F\u0631\u062E\u0648\u0627\u0633\u062A\u200C\u0647\u0627\u06CC \u062F\u0631\u062E\u0648\u0627\u0633\u062A\u06CC \u0645\u062A\u0642\u0627\u0636\u06CC \u0628\u0647 \u0628\u0627\u06CC\u06AF\u0627\u0646\u06CC \u0645\u0646\u062A\u0642\u0644 \u0634\u062F"});await this.addAuditLog(tenantId,userId,"REQUIREMENT_DELETED","CUSTOMER_REQUIREMENT",requirementId)}return true}async getCustomerPropertyInteractions(tenantId,customerId,filterReaction){await this.init();let query=`
      SELECT cpi.*, 
             p.code as property_code, p.title as property_title, p.property_type, p.listing_type,
             p.price_total, p.rent_amount, p.deposit_amount, p.area_sqm, p.neighborhood, p.city, p.bedrooms,
             (SELECT file_url FROM property_media pm WHERE pm.property_id = p.id AND pm.is_cover = true LIMIT 1) as cover_image
      FROM customer_property_interactions cpi
      JOIN properties p ON cpi.property_id = p.id
      WHERE cpi.tenant_id = $1 AND cpi.customer_id = $2
    `;const params=[tenantId,customerId];if(filterReaction&&filterReaction!=="ALL"){if(filterReaction==="SENT"){query+=` AND cpi.status = 'SENT'`}else if(filterReaction==="VIEWED"){query+=` AND (cpi.status = 'VIEWED' OR cpi.viewed_at IS NOT NULL)`}else if(filterReaction==="INTERESTED"){query+=` AND cpi.reaction IN ('INTERESTED', 'VERY_INTERESTED')`}else if(filterReaction==="REJECTED"){query+=` AND cpi.reaction = 'REJECTED'`}else{query+=` AND cpi.reaction = $3`;params.push(filterReaction)}}query+=` ORDER BY cpi.updated_at DESC`;const res=await this.pg.query(query,params);return res.rows.map(row=>({id:row.id,tenant_id:row.tenant_id,customer_id:row.customer_id,property_id:row.property_id,property:{id:row.property_id,code:row.property_code,title:row.property_title,property_type:row.property_type,listing_type:row.listing_type,price_total:row.price_total?Number(row.price_total):void 0,rent_amount:row.rent_amount?Number(row.rent_amount):void 0,deposit_amount:row.deposit_amount?Number(row.deposit_amount):void 0,area_sqm:Number(row.area_sqm),neighborhood:row.neighborhood,city:row.city,bedrooms:row.bedrooms,cover_image:row.cover_image},interaction_type:row.interaction_type,status:row.status,reaction:row.reaction,reaction_reason:row.reaction_reason,reaction_notes:row.reaction_notes,shared_at:row.shared_at,viewed_at:row.viewed_at,visited_at:row.visited_at,created_at:row.created_at,updated_at:row.updated_at}))}async recordCustomerPropertyInteraction(tenantId,customerId,propertyId,userId,data){await this.init();const id=crypto.randomUUID();const interactionType=data.interaction_type||"SHARED";const status=data.status||"SENT";const res=await this.pg.query(`INSERT INTO customer_property_interactions (
        id, tenant_id, customer_id, property_id, interaction_type, status,
        reaction, reaction_reason, reaction_notes, visited_at, created_by_user_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (tenant_id, customer_id, property_id) DO UPDATE SET
        status = EXCLUDED.status,
        reaction = COALESCE(EXCLUDED.reaction, customer_property_interactions.reaction),
        reaction_reason = COALESCE(EXCLUDED.reaction_reason, customer_property_interactions.reaction_reason),
        reaction_notes = COALESCE(EXCLUDED.reaction_notes, customer_property_interactions.reaction_notes),
        visited_at = COALESCE(EXCLUDED.visited_at, customer_property_interactions.visited_at),
        updated_at = CURRENT_TIMESTAMP
       RETURNING *`,[id,tenantId,customerId,propertyId,interactionType,status,data.reaction||null,data.reaction_reason||null,data.reaction_notes||null,data.visited_at||null,userId]);const property=await this.getPropertyById(tenantId,propertyId);const reactionLabels={INTERESTED:"\u0639\u0644\u0627\u0642\u0647\u200C\u0645\u0646\u062F",VERY_INTERESTED:"\u0628\u0633\u06CC\u0627\u0631 \u0639\u0644\u0627\u0642\u0647\u200C\u0645\u0646\u062F (\u0627\u0648\u0644\u0648\u06CC\u062A \u0628\u0627\u0644\u0627)",NEEDS_REVIEW:"\u0646\u06CC\u0627\u0632 \u0628\u0647 \u0628\u0631\u0631\u0633\u06CC \u0628\u06CC\u0634\u062A\u0631",REJECTED:"\u0631\u062F \u0634\u062F",NOT_AVAILABLE:"\u0646\u0627\u0645\u0648\u062C\u0648\u062F",OTHER:"\u0633\u0627\u06CC\u0631"};if(data.reaction){await this.createInteraction(tenantId,customerId,userId,{interaction_type:data.reaction==="REJECTED"?"PROPERTY_REJECTED":"PROPERTY_LIKED",title:`\u0628\u0627\u0632\u062E\u0648\u0631\u062F \u0645\u0644\u06A9 \u06A9\u062F ${property?.code||""}: ${reactionLabels[data.reaction]||data.reaction}`,description:data.reaction_notes||(data.reaction_reason?`\u0639\u0644\u062A: ${data.reaction_reason}`:void 0),property_id:propertyId})}await this.addAuditLog(tenantId,userId,"CUSTOMER_PROPERTY_INTERACTION","CUSTOMER_PROPERTY",propertyId,{customer_id:customerId,reaction:data.reaction,status});return res.rows[0]}async updatePropertyReaction(tenantId,customerId,propertyId,userId,data){return this.recordCustomerPropertyInteraction(tenantId,customerId,propertyId,userId,{...data,interaction_type:"REACTION"})}async recalculateCustomerNextFollowUp(tenantId,customerId){await this.init();const res=await this.pg.query(`SELECT due_at FROM tasks 
       WHERE tenant_id = $1 AND customer_id = $2 AND status = 'TODO' AND due_at >= CURRENT_TIMESTAMP 
       ORDER BY due_at ASC LIMIT 1`,[tenantId,customerId]);const nextFollowUp=res.rows.length>0?res.rows[0].due_at:null;await this.pg.query(`UPDATE customers SET next_follow_up_at = $1 WHERE id = $2 AND tenant_id = $3`,[nextFollowUp,customerId,tenantId]);return nextFollowUp}async getCustomerTimeline(tenantId,customerId){await this.init();const res=await this.pg.query(`SELECT * FROM interactions WHERE tenant_id = $1 AND customer_id = $2 ORDER BY occurred_at DESC`,[tenantId,customerId]);return res.rows.map(row=>({id:row.id,tenant_id:row.tenant_id,customer_id:row.customer_id,user_id:row.user_id,property_id:row.property_id,interaction_type:row.interaction_type,title:row.title,description:row.description,occurred_at:row.occurred_at,created_at:row.created_at}))}async createInteraction(tenantId,customerId,userId,data){await this.init();const id=crypto.randomUUID();const occurredAt=data.occurred_at||new Date().toISOString();await this.pg.query(`INSERT INTO interactions (id, tenant_id, customer_id, user_id, property_id, interaction_type, title, description, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,[id,tenantId,customerId,userId,data.property_id||null,data.interaction_type,data.title,data.description||null,occurredAt]);await this.pg.query(`UPDATE customers SET last_interaction_at = $1 WHERE id = $2 AND tenant_id = $3`,[occurredAt,customerId,tenantId]);const timeline=await this.getCustomerTimeline(tenantId,customerId);return timeline.find(i=>i.id===id)}async getTasks(tenantId,userIdOrFilters=null){await this.init();let query=`
      SELECT t.*, b.name as branch_name
      FROM tasks t
      LEFT JOIN branches b ON b.id = t.branch_id
      WHERE t.tenant_id = $1
    `;const params=[tenantId];let paramIdx=2;let filters={};if(userIdOrFilters&&typeof userIdOrFilters==="string"){filters.userId=userIdOrFilters}else if(userIdOrFilters&&typeof userIdOrFilters==="object"){filters=userIdOrFilters}if(filters.userId){query+=` AND t.assigned_user_id = $${paramIdx++}`;params.push(filters.userId)}if(filters.branch_id&&filters.branch_id!=="ALL"){query+=` AND t.branch_id = $${paramIdx++}`;params.push(filters.branch_id)}if(filters.status){if(filters.status==="PENDING"||filters.status==="TODO"){query+=` AND t.status IN ('PENDING', 'TODO')`}else{query+=` AND t.status = $${paramIdx++}`;params.push(filters.status)}}if(filters.type&&filters.type!=="ALL"){query+=` AND t.type = $${paramIdx++}`;params.push(filters.type)}if(filters.customerId){query+=` AND t.customer_id = $${paramIdx++}`;params.push(filters.customerId)}if(filters.propertyId){query+=` AND t.property_id = $${paramIdx++}`;params.push(filters.propertyId)}if(filters.startDate){query+=` AND t.due_at >= $${paramIdx++}`;params.push(filters.startDate)}if(filters.endDate){query+=` AND t.due_at <= $${paramIdx++}`;params.push(filters.endDate)}query+=` ORDER BY t.due_at ASC`;const res=await this.pg.query(query,params);return res.rows.map(this.mapTaskRow)}async createTask(tenantId, userId, data) {
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
  }async completeTask(tenantId,taskId,userId,visitResult){await this.init();const completedAt=new Date().toISOString();const taskRes=await this.pg.query(`SELECT * FROM tasks WHERE id = $1 AND tenant_id = $2 LIMIT 1`,[taskId,tenantId]);if(taskRes.rows.length===0)return null;const task=taskRes.rows[0];const updateFields=[`status = 'COMPLETED'`,`completed_at = $1`];const params=[completedAt,taskId,tenantId];if(visitResult){updateFields.push(`visit_result = $4`);params.push(visitResult)}const query=`UPDATE tasks SET ${updateFields.join(", ")} WHERE id = $2 AND tenant_id = $3`;await this.pg.query(query,params);if(task.customer_id){const actionLabel=task.type==="VISIT"?"\u0628\u0627\u0632\u062F\u06CC\u062F \u0645\u0644\u06A9 \u0627\u0646\u062C\u0627\u0645 \u0634\u062F":"\u067E\u06CC\u06AF\u06CC\u0631\u06CC \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F";let detail=`\u0639\u0646\u0648\u0627\u0646: ${task.title}`;if(visitResult){const resultPersian={INTERESTED:"\u0639\u0644\u0627\u0642\u0647\u200C\u0645\u0646\u062F",NOT_INTERESTED:"\u0639\u062F\u0645 \u0639\u0644\u0627\u0642\u0647",NEED_FOLLOW_UP:"\u0646\u06CC\u0627\u0632 \u0628\u0647 \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0645\u062C\u062F\u062F",NEGOTIATION_STARTED:"\u0634\u0631\u0648\u0639 \u0645\u0630\u0627\u06A9\u0631\u0647"}[visitResult]||visitResult;detail+=` | \u0628\u0627\u0632\u062E\u0648\u0631\u062F: ${resultPersian}`}await this.createInteraction(tenantId,task.customer_id,userId,{interaction_type:task.type||"FOLLOW_UP",title:`${actionLabel}: ${task.title}`,description:(task.description?`${task.description}
`:"")+(visitResult?`\u0646\u062A\u06CC\u062C\u0647 \u0628\u0627\u0632\u062F\u06CC\u062F: ${detail}`:""),property_id:task.property_id||void 0,occurred_at:completedAt})}await this.addAuditLog(tenantId,userId,"TASK_COMPLETED","TASK",taskId);const tasks=await this.getTasks(tenantId);return tasks.find(t=>t.id===taskId)||null}async cancelTask(tenantId,taskId,userId){await this.init();const cancelledAt=new Date().toISOString();const taskRes=await this.pg.query(`SELECT * FROM tasks WHERE id = $1 AND tenant_id = $2 LIMIT 1`,[taskId,tenantId]);if(taskRes.rows.length===0)return null;const task=taskRes.rows[0];await this.pg.query(`UPDATE tasks SET status = 'CANCELLED', updated_at = $1 WHERE id = $2 AND tenant_id = $3`,[cancelledAt,taskId,tenantId]);if(task.customer_id){await this.createInteraction(tenantId,task.customer_id,userId,{interaction_type:task.type||"FOLLOW_UP",title:`\u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0644\u063A\u0648 \u0634\u062F: ${task.title}`,description:task.description||void 0,property_id:task.property_id||void 0,occurred_at:cancelledAt})}await this.addAuditLog(tenantId,userId,"TASK_CANCELLED","TASK",taskId);const tasks=await this.getTasks(tenantId);return tasks.find(t=>t.id===taskId)||null}async updateTask(tenantId,taskId,userId,data){await this.init();const taskRes=await this.pg.query(`SELECT * FROM tasks WHERE id = $1 AND tenant_id = $2 LIMIT 1`,[taskId,tenantId]);if(taskRes.rows.length===0)return null;const task=taskRes.rows[0];const updates=[];const params=[];let paramIdx=1;if(data.title!==void 0){updates.push(`title = $${paramIdx++}`);params.push(data.title)}if(data.description!==void 0){updates.push(`description = $${paramIdx++}`);params.push(data.description)}if(data.due_at!==void 0){updates.push(`due_at = $${paramIdx++}`);params.push(data.due_at)}if(data.end_at!==void 0){updates.push(`end_at = $${paramIdx++}`);params.push(data.end_at)}if(data.priority!==void 0){updates.push(`priority = $${paramIdx++}`);params.push(data.priority)}if(data.status!==void 0){updates.push(`status = $${paramIdx++}`);params.push(data.status)}if(data.type!==void 0){updates.push(`type = $${paramIdx++}`);params.push(data.type)}if(data.visit_result!==void 0){updates.push(`visit_result = $${paramIdx++}`);params.push(data.visit_result)}if(data.assigned_to_user_id!==void 0){updates.push(`assigned_user_id = $${paramIdx++}`);params.push(data.assigned_to_user_id)}else if(data.assigned_user_id!==void 0){updates.push(`assigned_user_id = $${paramIdx++}`);params.push(data.assigned_user_id)}if(updates.length>0){updates.push(`updated_at = CURRENT_TIMESTAMP`);params.push(taskId,tenantId);const query=`UPDATE tasks SET ${updates.join(", ")} WHERE id = $${paramIdx++} AND tenant_id = $${paramIdx++}`;await this.pg.query(query,params);if(task.customer_id){let desc=`\u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u067E\u06CC\u06AF\u06CC\u0631\u06CC: ${data.title||task.title}`;if(data.status==="COMPLETED"){desc=`\u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F: ${data.title||task.title}`}else if(data.status==="CANCELLED"){desc=`\u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0644\u063A\u0648 \u0634\u062F: ${data.title||task.title}`}else if(data.due_at&&data.due_at!==task.due_at){desc=`\u062A\u063A\u06CC\u06CC\u0631 \u0632\u0645\u0627\u0646 \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0628\u0647: ${new Date(data.due_at).toLocaleDateString("fa-IR")}`}await this.createInteraction(tenantId,task.customer_id,userId,{interaction_type:data.type||task.type,title:desc,description:data.description||void 0,property_id:task.property_id||void 0})}await this.addAuditLog(tenantId,userId,"TASK_UPDATED","TASK",taskId)}const tasks=await this.getTasks(tenantId);return tasks.find(t=>t.id===taskId)||null}async addAuditLog(tenantId,userId,action,entityType=null,entityId=null,metadata=null){try{await this.pg.query(`INSERT INTO audit_logs (id, tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,[crypto.randomUUID(),tenantId,userId,action,entityType,entityId,metadata?JSON.stringify(metadata):null])}catch{}}async getRecentActivities(tenantId,limit=8){await this.init();const res=await this.pg.query(`SELECT * FROM audit_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,[tenantId,limit]);return res.rows.map(row=>{let title="\u0641\u0639\u0627\u0644\u06CC\u062A \u062F\u0631 \u0633\u06CC\u0633\u062A\u0645";let description=`\u0639\u0645\u0644\u06CC\u0627\u062A ${row.action} \u0627\u0646\u062C\u0627\u0645 \u0634\u062F`;if(row.action==="PROPERTY_CREATED"){title="\u062B\u0628\u062A \u0645\u0644\u06A9 \u062C\u062F\u06CC\u062F";description="\u0641\u0627\u06CC\u0644 \u062C\u062F\u06CC\u062F \u062F\u0631 \u0633\u06CC\u0633\u062A\u0645 \u062B\u0628\u062A \u0648 \u0622\u0645\u0627\u062F\u0647 \u0628\u0627\u0632\u062F\u06CC\u062F \u0634\u062F"}else if(row.action==="CUSTOMER_CREATED"){title="\u062B\u0628\u062A \u0645\u062A\u0642\u0627\u0636\u06CC \u062C\u062F\u06CC\u062F";description="\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0645\u0634\u062A\u0631\u06CC \u0648 \u0645\u062D\u062F\u0648\u062F\u0647 \u0646\u06CC\u0627\u0632\u0645\u0646\u062F\u06CC \u062F\u0631 \u0633\u0627\u0645\u0627\u0646\u0647 \u0630\u062E\u06CC\u0631\u0647 \u06AF\u0631\u062F\u06CC\u062F"}else if(row.action==="TASK_COMPLETED"){title="\u062A\u06A9\u0645\u06CC\u0644 \u067E\u06CC\u06AF\u06CC\u0631\u06CC";description="\u0648\u0638\u06CC\u0641\u0647 \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u0646\u062C\u0627\u0645 \u0648 \u0628\u0647 \u0633\u0648\u0627\u0628\u0642 \u0645\u0646\u062A\u0642\u0644 \u06AF\u0631\u062F\u06CC\u062F"}else if(row.action==="TASK_CREATED"){title="\u062B\u0628\u062A \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u062C\u062F\u06CC\u062F";description="\u0645\u0648\u0639\u062F \u062A\u0645\u0627\u0633 \u0648 \u0627\u0642\u062F\u0627\u0645 \u062C\u062F\u06CC\u062F \u0628\u0631\u0627\u06CC \u0645\u0634\u062A\u0631\u06CC \u062A\u0646\u0638\u06CC\u0645 \u0634\u062F"}else if(row.action==="OWNER_CREATED"){title="\u062B\u0628\u062A \u0645\u0627\u0644\u06A9 \u062C\u062F\u06CC\u062F";description="\u0645\u0634\u062E\u0635\u0627\u062A \u0645\u0627\u0644\u06A9 \u0648 \u0627\u0633\u0646\u0627\u062F \u062F\u0631 \u0633\u06CC\u0633\u062A\u0645 \u0630\u062E\u06CC\u0631\u0647 \u06AF\u0631\u062F\u06CC\u062F"}else if(row.action==="SYSTEM_BOOT"){title="\u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC \u0633\u0627\u0645\u0627\u0646\u0647 \u0627\u0645\u0644\u0627\u06A9";description="\u0622\u0698\u0627\u0646\u0633 \u0641\u0639\u0627\u0644 \u0648 \u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC \u067E\u0627\u06CC\u0647 \u0628\u0627\u0631\u06AF\u0630\u0627\u0631\u06CC \u0634\u062F\u0646\u062F"}return{id:row.id,action:row.action,title,description,created_at:row.created_at,entity_type:row.entity_type,entity_id:row.entity_id||void 0}})}async calculateSmartMatches(tenantId,requestingUser){const properties=await this.getProperties(tenantId,{},requestingUser);const customers=await this.getCustomers(tenantId,{},requestingUser);const matches=[];for(const customer of customers){for(const property of properties){let score=0;const reasons=[];if(customer.customer_type==="BUYER"&&property.listing_type==="SALE"){score+=30;reasons.push("\u062A\u0637\u0627\u0628\u0642 \u0646\u0648\u0639 \u0645\u0639\u0627\u0645\u0644\u0647 (\u0641\u0631\u0648\u0634)")}else if(customer.customer_type==="TENANT"&&property.listing_type==="RENT"){score+=30;reasons.push("\u062A\u0637\u0627\u0628\u0642 \u0631\u0647\u0646 \u0648 \u0627\u062C\u0627\u0631\u0647")}if(customer.budget_max&&property.price_total){if(property.price_total<=customer.budget_max){score+=35;reasons.push("\u062F\u0631 \u0645\u062D\u062F\u0648\u062F\u0647 \u0628\u0648\u062F\u062C\u0647 \u0645\u062A\u0642\u0627\u0636\u06CC")}}else if(customer.budget_max&&property.deposit_amount){if(property.deposit_amount<=customer.budget_max){score+=35;reasons.push("\u0648\u062F\u06CC\u0639\u0647 \u062F\u0631 \u062A\u0648\u0627\u0646 \u0645\u0627\u0644\u06CC \u0645\u062A\u0642\u0627\u0636\u06CC")}}if(customer.preferred_area_text&&property.address?.neighborhood){if(customer.preferred_area_text.includes(property.address.neighborhood)){score+=25;reasons.push(`\u0645\u062D\u0644\u0647 \u0645\u0648\u0631\u062F \u0639\u0644\u0627\u0642\u0647 (${property.address.neighborhood})`)}}if(property.has_parking&&property.has_elevator){score+=10;reasons.push("\u062F\u0627\u0631\u0627\u06CC \u067E\u0627\u0631\u06A9\u06CC\u0646\u06AF \u0648 \u0622\u0633\u0627\u0646\u0633\u0648\u0631")}if(score>=60){matches.push({property,customer,matchScore:score,matchReasons:reasons})}}}return matches.slice(0,5)}async getCustomerMatches(tenantId,customerId){const customer=await this.getCustomerById(tenantId,customerId);if(!customer)return[];const requirements=await this.getCustomerRequirements(tenantId,customerId);const properties=await this.getProperties(tenantId);const activeProperties=properties.filter(p=>!p.is_archived&&p.status==="AVAILABLE");const results=[];for(const property of activeProperties){let score=0;const reasons=[];if(requirements.length>0){for(const req of requirements){if(!req.is_active)continue;let reqScore=0;const reqReasons=[];if(req.listing_type===property.listing_type){reqScore+=25;reqReasons.push(req.listing_type==="SALE"?"\u0645\u0639\u0627\u0645\u0644\u0647 \u0641\u0631\u0648\u0634":"\u0631\u0647\u0646 \u0648 \u0627\u062C\u0627\u0631\u0647")}if(req.property_type===property.property_type){reqScore+=20;reqReasons.push("\u0646\u0648\u0639 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0648 \u0645\u0644\u06A9")}if(req.max_budget){const propPrice=property.listing_type==="SALE"?property.price_total:property.deposit_amount;if(propPrice&&propPrice<=req.max_budget){reqScore+=25;reqReasons.push("\u0628\u0648\u062F\u062C\u0647 \u0645\u062A\u0646\u0627\u0633\u0628")}}if(req.min_area&&property.area_sqm>=req.min_area){reqScore+=15;reqReasons.push("\u0645\u062A\u0631\u0627\u0698 \u0645\u0637\u0644\u0648\u0628")}if(req.needs_parking&&property.has_parking){reqScore+=5;reqReasons.push("\u062F\u0627\u0631\u0627\u06CC \u067E\u0627\u0631\u06A9\u06CC\u0646\u06AF")}if(req.needs_elevator&&property.has_elevator){reqScore+=5;reqReasons.push("\u062F\u0627\u0631\u0627\u06CC \u0622\u0633\u0627\u0646\u0633\u0648\u0631")}if(req.needs_storage&&property.has_storage){reqScore+=5;reqReasons.push("\u062F\u0627\u0631\u0627\u06CC \u0627\u0646\u0628\u0627\u0631\u06CC")}if(req.needs_balcony&&property.has_balcony){reqScore+=5;reqReasons.push("\u062F\u0627\u0631\u0627\u06CC \u0628\u0627\u0644\u06A9\u0646")}if(reqScore>score){score=reqScore;reasons.splice(0,reasons.length,...reqReasons)}}}else{if(customer.customer_type==="BUYER"&&property.listing_type==="SALE"){score+=30;reasons.push("\u062A\u0637\u0627\u0628\u0642 \u062E\u0631\u06CC\u062F\u0627\u0631 \u0628\u0627 \u0641\u0631\u0648\u0634")}else if(customer.customer_type==="TENANT"&&property.listing_type==="RENT"){score+=30;reasons.push("\u062A\u0637\u0627\u0628\u0642 \u0645\u0633\u062A\u0623\u062C\u0631 \u0628\u0627 \u0631\u0647\u0646/\u0627\u062C\u0627\u0631\u0647")}if(customer.budget_max){const propPrice=property.listing_type==="SALE"?property.price_total:property.deposit_amount;if(propPrice&&propPrice<=customer.budget_max){score+=35;reasons.push("\u062F\u0631 \u0645\u062D\u062F\u0648\u062F\u0647 \u0628\u0648\u062F\u062C\u0647 \u0645\u062A\u0642\u0627\u0636\u06CC")}}if(customer.preferred_area_text&&property.address?.neighborhood){if(customer.preferred_area_text.includes(property.address.neighborhood)){score+=25;reasons.push(`\u0645\u062D\u0644\u0647 \u0627\u0646\u062A\u062E\u0627\u0628\u06CC (${property.address.neighborhood})`)}}if(property.has_parking&&property.has_elevator){score+=10;reasons.push("\u0627\u0645\u06A9\u0627\u0646\u0627\u062A \u06A9\u0627\u0645\u0644 (\u067E\u0627\u0631\u06A9\u06CC\u0646\u06AF \u0648 \u0622\u0633\u0627\u0646\u0633\u0648\u0631)")}}if(score>=40){results.push({property,score,reasons})}}return results.sort((a,b)=>b.score-a.score)}async getPropertyMatches(tenantId,propertyId){const property=await this.getPropertyById(tenantId,propertyId);if(!property)return[];const customers=await this.getCustomers(tenantId);const activeCustomers=customers.filter(c=>!c.is_archived);const results=[];for(const customer of activeCustomers){let score=0;const reasons=[];if(customer.customer_type==="BUYER"&&property.listing_type==="SALE"){score+=30;reasons.push("\u062A\u0637\u0627\u0628\u0642 \u0646\u0648\u0639 \u0645\u0639\u0627\u0645\u0644\u0647 (\u0641\u0631\u0648\u0634)")}else if(customer.customer_type==="TENANT"&&property.listing_type==="RENT"){score+=30;reasons.push("\u062A\u0637\u0627\u0628\u0642 \u0631\u0647\u0646 \u0648 \u0627\u062C\u0627\u0631\u0647")}if(customer.budget_max){const propPrice=property.listing_type==="SALE"?property.price_total:property.deposit_amount;if(propPrice&&propPrice<=customer.budget_max){score+=35;reasons.push("\u062F\u0631 \u0645\u062D\u062F\u0648\u062F\u0647 \u0628\u0648\u062F\u062C\u0647")}}if(customer.preferred_area_text&&property.address?.neighborhood){if(customer.preferred_area_text.includes(property.address.neighborhood)){score+=25;reasons.push(`\u0645\u062D\u0644\u0647 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 (${property.address.neighborhood})`)}}if(property.has_parking&&property.has_elevator){score+=10;reasons.push("\u062F\u0627\u0631\u0627\u06CC \u067E\u0627\u0631\u06A9\u06CC\u0646\u06AF \u0648 \u0622\u0633\u0627\u0646\u0633\u0648\u0631")}if(score>=40){results.push({customer,score,reasons})}}return results.sort((a,b)=>b.score-a.score)}async search(tenantId, rawQuery, requestingUser) {
    await this.init();
    const query = normalizeDigits(rawQuery.trim());
    const searchPattern = `%${query}%`;
    let propVisibilityWhere = "";
    let custVisibilityWhere = "";
    const propParams = [tenantId, searchPattern];
    const custParams = [tenantId, searchPattern];

    if (requestingUser && !this.isOfficeAdmin(requestingUser)) {
      if (this.isBranchManager(requestingUser)) {
        propParams.push(requestingUser.branch_id || null, requestingUser.id);
        propVisibilityWhere = ` AND (p.visibility = 'AGENCY' OR p.branch_id = $3 OR p.assigned_agent_id = $4 OR (p.assigned_agent_id IS NULL AND p.created_by_user_id = $4))`;
        custParams.push(requestingUser.branch_id || null, requestingUser.id);
        custVisibilityWhere = ` AND (c.visibility = 'AGENCY' OR c.branch_id = $3 OR c.assigned_agent_id = $4 OR (c.assigned_agent_id IS NULL AND c.created_by_user_id = $4))`;
      } else {
        propParams.push(requestingUser.branch_id || null, requestingUser.id);
        propVisibilityWhere = ` AND (p.visibility = 'AGENCY' OR (p.visibility = 'BRANCH' AND p.branch_id = $3) OR p.assigned_agent_id = $4 OR (p.assigned_agent_id IS NULL AND p.created_by_user_id = $4))`;
        custParams.push(requestingUser.branch_id || null, requestingUser.id);
        custVisibilityWhere = ` AND (c.visibility = 'AGENCY' OR (c.visibility = 'BRANCH' AND c.branch_id = $3) OR c.assigned_agent_id = $4 OR (c.assigned_agent_id IS NULL AND c.created_by_user_id = $4))`;
      }
    }
    const [propRes, custRes]=await Promise.all([this.pg.query(`SELECT p.*,
                (SELECT file_url FROM property_media pm WHERE pm.property_id = p.id AND pm.is_cover = true LIMIT 1) as cover_image,
                u_creator.display_name as created_by_name,
                u_assignee.display_name as assigned_agent_name
         FROM properties p 
         LEFT JOIN users u_creator ON u_creator.id = p.created_by_user_id
         LEFT JOIN users u_assignee ON u_assignee.id = p.assigned_agent_id
         WHERE p.tenant_id = $1 
           AND p.is_archived = false
           ${propVisibilityWhere}
           AND (
             p.code ILIKE $2 
             OR p.title ILIKE $2 
             OR p.neighborhood ILIKE $2 
             OR p.district ILIKE $2
             OR p.city ILIKE $2 
             OR p.description ILIKE $2
           )
         ORDER BY p.created_at DESC 
         LIMIT 20`,propParams),this.pg.query(`SELECT c.*,
                u_creator.display_name as created_by_name,
                u_assignee.display_name as assigned_agent_name
         FROM customers c 
         LEFT JOIN users u_creator ON u_creator.id = c.created_by_user_id
         LEFT JOIN users u_assignee ON u_assignee.id = c.assigned_agent_id
         WHERE c.tenant_id = $1 
           AND c.is_archived = false
           ${custVisibilityWhere}
           AND (
             c.display_name ILIKE $2 
             OR c.first_name ILIKE $2
             OR c.last_name ILIKE $2
             OR c.phone ILIKE $2 
             OR c.code ILIKE $2
             OR c.preferred_area_text ILIKE $2 
             OR c.notes ILIKE $2
           )
         ORDER BY c.created_at DESC 
         LIMIT 20`,custParams)]);return{properties:propRes.rows.map(this.mapPropertyRow),customers:custRes.rows.map(this.mapCustomerRow)}}mapPropertyRow(row){return{id:row.id,tenant_id:row.tenant_id,branch_id:row.branch_id,branch_name:row.branch_name,code:row.code,title:row.title,property_type:row.property_type,listing_type:row.listing_type,status:row.status,price_total:row.price_total?Number(row.price_total):void 0,price_per_meter:row.price_per_meter?Number(row.price_per_meter):void 0,rent_amount:row.rent_amount?Number(row.rent_amount):void 0,deposit_amount:row.deposit_amount?Number(row.deposit_amount):void 0,area_sqm:Number(row.area_sqm),bedrooms:row.bedrooms,floor:row.floor,year_built:row.year_built,has_parking:Boolean(row.has_parking),has_storage:Boolean(row.has_storage),has_elevator:Boolean(row.has_elevator),has_balcony:Boolean(row.has_balcony),description:row.description,address:{province:row.province||"\u062A\u0647\u0631\u0627\u0646",city:row.city||"\u062A\u0647\u0631\u0627\u0646",district:row.district||row.neighborhood,neighborhood:row.neighborhood||row.district,street:row.street,location_precision:row.location_precision||"APPROXIMATE"},visibility:row.visibility||"AGENCY",assigned_agent_id:row.assigned_agent_id,assigned_to_user_id:row.assigned_agent_id,assigned_agent_name:row.assigned_agent_name||void 0,created_by_user_id:row.created_by_user_id,created_by_name:row.created_by_name||void 0,cover_image:row.cover_image,is_archived:Boolean(row.is_archived),archived_at:row.archived_at,created_at:row.created_at,updated_at:row.updated_at}}mapCustomerRow(row){return{id:row.id,tenant_id:row.tenant_id,branch_id:row.branch_id,branch_name:row.branch_name,code:row.code||void 0,first_name:row.first_name,last_name:row.last_name,display_name:row.display_name,phone:row.phone,secondary_phone:row.secondary_phone,email:row.email,customer_type:row.customer_type,lead_status:row.lead_status,temperature:row.temperature,lead_source:row.lead_source||"IN_PERSON",budget_min:row.budget_min?Number(row.budget_min):void 0,budget_max:row.budget_max?Number(row.budget_max):void 0,preferred_city:row.preferred_city,preferred_area_text:row.preferred_area_text,notes:row.notes,visibility:row.visibility||"AGENCY",assigned_agent_id:row.assigned_agent_id,assigned_to_user_id:row.assigned_agent_id,assigned_agent_name:row.assigned_agent_name||void 0,created_by_user_id:row.created_by_user_id,created_by_name:row.created_by_name||void 0,is_archived:Boolean(row.is_archived),archived_at:row.archived_at,next_follow_up_at:row.next_follow_up_at||void 0,created_at:row.created_at,updated_at:row.updated_at,last_interaction_at:row.last_interaction_at}}mapTaskRow(row){return{id:row.id,tenant_id:row.tenant_id,branch_id:row.branch_id,branch_name:row.branch_name,assigned_user_id:row.assigned_user_id,customer_id:row.customer_id,customer_name:row.customer_name,customer_phone:row.customer_phone,property_id:row.property_id,property_title:row.property_title,property_code:row.property_code,title:row.title,description:row.description,due_at:row.due_at,completed_at:row.completed_at,priority:row.priority,status:row.status,created_at:row.created_at,type:row.type||"FOLLOW_UP",end_at:row.end_at,visit_result:row.visit_result}}async resetAgentPassword(tenantId,actorUserId,agentId,newPassword){await this.init();const agent=await this.getUserById(agentId);if(!agent||agent.tenant_id!==tenantId){const err=new Error("\u0645\u0634\u0627\u0648\u0631 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u062F\u0631 \u0627\u06CC\u0646 \u0622\u0698\u0627\u0646\u0633 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.");err.status=404;err.code="AGENT_NOT_FOUND";throw err}const passwordHash=bcrypt.hashSync(newPassword,10);await this.pg.query(`UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3`,[passwordHash,agentId,tenantId]);await this.pg.query(`UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND tenant_id = $2 AND revoked_at IS NULL`,[agentId,tenantId]);await this.addAuditLog(tenantId,actorUserId,"AGENT_PASSWORD_RESET","USER",agentId)}async getAgentWorkload(tenantId,agentId){await this.init();const agent=await this.getAgentById(tenantId,agentId);if(!agent){const err=new Error("\u0645\u0634\u0627\u0648\u0631 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u062F\u0631 \u0627\u06CC\u0646 \u0622\u0698\u0627\u0646\u0633 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.");err.status=404;err.code="AGENT_NOT_FOUND";throw err}const propRes=await this.pg.query(`SELECT p.*,
              (SELECT file_url FROM property_media pm WHERE pm.property_id = p.id AND pm.is_cover = true LIMIT 1) as cover_image,
              u_creator.display_name as created_by_name,
              u_assignee.display_name as assigned_agent_name
       FROM properties p
       LEFT JOIN users u_creator ON u_creator.id = p.created_by_user_id
       LEFT JOIN users u_assignee ON u_assignee.id = p.assigned_agent_id
       WHERE p.tenant_id = $1 AND p.is_archived = false
         AND (p.assigned_agent_id = $2 OR (p.created_by_user_id = $2 AND p.assigned_agent_id IS NULL))
       ORDER BY p.created_at DESC`,[tenantId,agentId]);const custRes=await this.pg.query(`SELECT c.*,
              u_creator.display_name as created_by_name,
              u_assignee.display_name as assigned_agent_name
       FROM customers c
       LEFT JOIN users u_creator ON u_creator.id = c.created_by_user_id
       LEFT JOIN users u_assignee ON u_assignee.id = c.assigned_agent_id
       WHERE c.tenant_id = $1 AND c.is_archived = false
         AND (c.assigned_agent_id = $2 OR (c.created_by_user_id = $2 AND c.assigned_agent_id IS NULL))
       ORDER BY c.created_at DESC`,[tenantId,agentId]);const taskRes=await this.pg.query(`SELECT t.* FROM tasks t
       WHERE t.tenant_id = $1 AND t.assigned_user_id = $2 AND t.status != 'COMPLETED' AND t.status != 'CANCELLED'
       ORDER BY t.due_at ASC`,[tenantId,agentId]);const actRes=await this.pg.query(`SELECT a.*, u.display_name as actor_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.actor_user_id
       WHERE a.tenant_id = $1 AND (a.actor_user_id::text = $2 OR a.entity_id = $2)
       ORDER BY a.created_at DESC LIMIT 15`,[tenantId,agentId]);const properties=propRes.rows.map(this.mapPropertyRow);const customers=custRes.rows.map(this.mapCustomerRow);const tasks=taskRes.rows.map(this.mapTaskRow);const privateProps=properties.filter(p=>p.visibility==="PRIVATE").length;const agencyProps=properties.filter(p=>p.visibility==="AGENCY").length;const privateCusts=customers.filter(c=>c.visibility==="PRIVATE").length;const agencyCusts=customers.filter(c=>c.visibility==="AGENCY").length;return{agent,metrics:{total_properties:properties.length,private_properties:privateProps,agency_properties:agencyProps,total_customers:customers.length,private_customers:privateCusts,agency_customers:agencyCusts,active_tasks_count:tasks.length},properties,customers,tasks,recent_activities:actRes.rows}}async transferAgentAssets(tenantId,actorUserId,sourceAgentId,targetAgentId,options={}){await this.init();if(sourceAgentId===targetAgentId){const err=new Error("\u0645\u0634\u0627\u0648\u0631 \u0645\u0628\u062F\u0623 \u0648 \u0645\u0642\u0635\u062F \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u0646\u062F \u06CC\u06A9\u0633\u0627\u0646 \u0628\u0627\u0634\u0646\u062F.");err.status=400;err.code="INVALID_TRANSFER_TARGET";throw err}const[sourceAgent,targetAgent]=await Promise.all([this.getUserById(sourceAgentId),this.getUserById(targetAgentId)]);if(!sourceAgent||sourceAgent.tenant_id!==tenantId){const err=new Error("\u0645\u0634\u0627\u0648\u0631 \u0645\u0628\u062F\u0623 \u062F\u0631 \u0627\u06CC\u0646 \u0622\u0698\u0627\u0646\u0633 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.");err.status=404;err.code="SOURCE_AGENT_NOT_FOUND";throw err}if(!targetAgent||targetAgent.tenant_id!==tenantId){const err=new Error("\u0645\u0634\u0627\u0648\u0631 \u0645\u0642\u0635\u062F \u062F\u0631 \u0627\u06CC\u0646 \u0622\u0698\u0627\u0646\u0633 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.");err.status=404;err.code="TARGET_AGENT_NOT_FOUND";throw err}if(!targetAgent.is_active){const err=new Error("\u0645\u0634\u0627\u0648\u0631 \u0645\u0642\u0635\u062F \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0627\u0633\u062A \u0648 \u0627\u0645\u06A9\u0627\u0646 \u0648\u0627\u06AF\u0630\u0627\u0631\u06CC \u0641\u0627\u06CC\u0644 \u0628\u0647 \u0622\u0646 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.");err.status=400;err.code="TARGET_AGENT_INACTIVE";throw err}const validTargetRoles=["AGENT","BRANCH_MANAGER","ADMIN","OWNER"];if(!validTargetRoles.includes(targetAgent.role_code)){const err=new Error("\u0646\u0642\u0634 \u0633\u0627\u0632\u0645\u0627\u0646\u06CC \u0645\u0634\u0627\u0648\u0631 \u0645\u0642\u0635\u062F \u0628\u0631\u0627\u06CC \u062A\u062D\u0648\u06CC\u0644 \u067E\u0631\u0648\u0646\u062F\u0647\u200C\u0647\u0627 \u0645\u062C\u0627\u0632 \u0646\u06CC\u0633\u062A.");err.status=400;err.code="TARGET_AGENT_INVALID_ROLE";throw err}const doProperties=options.transferProperties!==false;const doCustomers=options.transferCustomers!==false;const doTasks=options.transferTasks!==false;let propertiesTransferred=0;let customersTransferred=0;let tasksTransferred=0;await this.pg.exec("BEGIN");try{if(doProperties){const propUpdate=await this.pg.query(`WITH updated AS (
             UPDATE properties
             SET assigned_agent_id = $1, updated_at = CURRENT_TIMESTAMP
             WHERE tenant_id = $2
               AND is_archived = false
               AND (assigned_agent_id = $3 OR (created_by_user_id = $3 AND assigned_agent_id IS NULL))
             RETURNING id
           ) SELECT count(*)::text as count FROM updated`,[targetAgentId,tenantId,sourceAgentId]);propertiesTransferred=Number(propUpdate.rows[0]?.count||0)}if(doCustomers){const custUpdate=await this.pg.query(`UPDATE customers
           SET assigned_agent_id = $1, updated_at = CURRENT_TIMESTAMP
           WHERE tenant_id = $2
             AND is_archived = false
             AND (assigned_agent_id = $3 OR (created_by_user_id = $3 AND assigned_agent_id IS NULL))
           RETURNING id`,[targetAgentId,tenantId,sourceAgentId]);customersTransferred=custUpdate.rows.length;for(const row of custUpdate.rows){const interactionId=crypto.randomUUID();await this.pg.query(`INSERT INTO interactions (id, tenant_id, customer_id, user_id, interaction_type, title, description)
             VALUES ($1, $2, $3, $4, 'STATUS_CHANGED', '\u0627\u0646\u062A\u0642\u0627\u0644 \u0645\u0633\u0626\u0648\u0644 \u067E\u06CC\u06AF\u06CC\u0631\u06CC', $5)`,[interactionId,tenantId,row.id,actorUserId,`\u0645\u0633\u0626\u0648\u0644\u06CC\u062A \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0645\u062A\u0642\u0627\u0636\u06CC \u0627\u0632 ${sourceAgent.display_name} \u0628\u0647 ${targetAgent.display_name} \u0645\u0646\u062A\u0642\u0644 \u0634\u062F.`])}}if(doTasks){const taskUpdate=await this.pg.query(`WITH updated AS (
             UPDATE tasks
             SET assigned_user_id = $1, updated_at = CURRENT_TIMESTAMP
             WHERE tenant_id = $2
               AND assigned_user_id = $3
               AND status NOT IN ('COMPLETED', 'CANCELLED')
             RETURNING id
           ) SELECT count(*)::text as count FROM updated`,[targetAgentId,tenantId,sourceAgentId]);tasksTransferred=Number(taskUpdate.rows[0]?.count||0)}const auditId=crypto.randomUUID();await this.pg.query(`INSERT INTO audit_logs (id, tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, $3, 'ASSETS_TRANSFERRED', 'USER', $4, $5)`,[auditId,tenantId,actorUserId,sourceAgentId,JSON.stringify({source_agent_id:sourceAgentId,source_agent_name:sourceAgent.display_name,target_agent_id:targetAgentId,target_agent_name:targetAgent.display_name,properties_transferred:propertiesTransferred,customers_transferred:customersTransferred,tasks_transferred:tasksTransferred})]);await this.pg.exec("COMMIT")}catch(err){await this.pg.exec("ROLLBACK").catch(()=>{});throw err}return{propertiesTransferred,customersTransferred,tasksTransferred}}async getDocumentsByProperty(tenantId,propertyId){await this.init();const res=await this.pg.query(`SELECT d.*, u.display_name as uploaded_by_name
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploaded_by_user_id
       WHERE d.tenant_id = $1 AND d.property_id = $2 AND d.is_archived = false
       ORDER BY d.created_at DESC`,[tenantId,propertyId]);return res.rows}async getDocumentsByCustomer(tenantId,customerId){await this.init();const res=await this.pg.query(`SELECT d.*, u.display_name as uploaded_by_name
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploaded_by_user_id
       WHERE d.tenant_id = $1 AND d.customer_id = $2 AND d.is_archived = false
       ORDER BY d.created_at DESC`,[tenantId,customerId]);return res.rows}async getAllDocuments(tenantId,includeArchived=false){await this.init();const whereClause=includeArchived?"":"AND d.is_archived = false";const res=await this.pg.query(`SELECT d.*, u.display_name as uploaded_by_name,
              p.title as property_title, p.code as property_code,
              c.first_name as customer_first_name, c.last_name as customer_last_name, c.display_name as customer_display_name
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploaded_by_user_id
       LEFT JOIN properties p ON p.id = d.property_id
       LEFT JOIN customers c ON c.id = d.customer_id
       WHERE d.tenant_id = $1 ${whereClause}
       ORDER BY d.created_at DESC`,[tenantId]);return res.rows}async getDocumentById(tenantId,documentId){await this.init();const res=await this.pg.query(`SELECT d.*, u.display_name as uploaded_by_name
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploaded_by_user_id
       WHERE d.tenant_id = $1 AND d.id = $2 LIMIT 1`,[tenantId,documentId]);return res.rows[0]||null}async createDocument(tenantId,userId,data){await this.init();const id=crypto.randomUUID();await this.pg.query(`INSERT INTO documents (
         id, tenant_id, file_name, display_name, mime_type, file_size, storage_key,
         document_type, description, property_id, customer_id, transaction_id, uploaded_by_user_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,[id,tenantId,data.file_name,data.display_name,data.mime_type,data.file_size,data.storage_key,data.document_type||"OTHER",data.description||null,data.property_id||null,data.customer_id||null,data.transaction_id||null,userId]);await this.addAuditLog(tenantId,userId,"DOCUMENT_UPLOADED","DOCUMENT",id,{display_name:data.display_name,document_type:data.document_type,property_id:data.property_id,customer_id:data.customer_id});return this.getDocumentById(tenantId,id)}async updateDocument(tenantId,userId,documentId,data){await this.init();const doc=await this.getDocumentById(tenantId,documentId);if(!doc)return null;const updates=[];const params=[];let idx=1;if(data.display_name!==void 0){updates.push(`display_name = $${idx++}`);params.push(data.display_name)}if(data.document_type!==void 0){updates.push(`document_type = $${idx++}`);params.push(data.document_type)}if(data.description!==void 0){updates.push(`description = $${idx++}`);params.push(data.description)}if(updates.length>0){updates.push(`updated_at = CURRENT_TIMESTAMP`);params.push(documentId,tenantId);await this.pg.query(`UPDATE documents SET ${updates.join(", ")} WHERE id = $${idx++} AND tenant_id = $${idx++}`,params);await this.addAuditLog(tenantId,userId,"DOCUMENT_UPDATED","DOCUMENT",documentId)}return this.getDocumentById(tenantId,documentId)}async archiveDocument(tenantId,userId,documentId){await this.init();const doc=await this.getDocumentById(tenantId,documentId);if(!doc)return null;await this.pg.query(`UPDATE documents SET is_archived = true, archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2`,[documentId,tenantId]);await this.addAuditLog(tenantId,userId,"DOCUMENT_ARCHIVED","DOCUMENT",documentId,{display_name:doc.display_name});return true}async unarchiveDocument(tenantId,userId,documentId){await this.init();const doc=await this.getDocumentById(tenantId,documentId);if(!doc)return null;await this.pg.query(`UPDATE documents SET is_archived = false, archived_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2`,[documentId,tenantId]);await this.addAuditLog(tenantId,userId,"DOCUMENT_RESTORED","DOCUMENT",documentId,{display_name:doc.display_name});return true}async updateUserProfile(tenantId,userId,data){await this.init();const updates=[];const params=[];let idx=1;if(data.display_name!==void 0){updates.push(`display_name = $${idx++}`);params.push(data.display_name)}if(data.phone!==void 0){updates.push(`phone = $${idx++}`);params.push(data.phone)}if(updates.length>0){updates.push(`updated_at = CURRENT_TIMESTAMP`);params.push(userId,tenantId);await this.pg.query(`UPDATE users SET ${updates.join(", ")} WHERE id = $${idx++} AND tenant_id = $${idx++}`,params);await this.addAuditLog(tenantId,userId,"PROFILE_UPDATED","USER",userId)}return this.getUserById(userId)}async changeUserPassword(tenantId,userId,currentPass,newPass){await this.init();const user=await this.getUserById(userId);if(!user||user.tenant_id!==tenantId){const err=new Error("\u06A9\u0627\u0631\u0628\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.");err.status=404;err.code="USER_NOT_FOUND";throw err}const isValid=bcrypt.compareSync(currentPass,user.password_hash);if(!isValid){const err=new Error("\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0641\u0639\u0644\u06CC \u0627\u0634\u062A\u0628\u0627\u0647 \u0627\u0633\u062A.");err.status=400;err.code="INVALID_CURRENT_PASSWORD";throw err}const newHash=bcrypt.hashSync(newPass,10);await this.pg.query(`UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3`,[newHash,userId,tenantId]);await this.pg.query(`UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND tenant_id = $2 AND revoked_at IS NULL`,[userId,tenantId]);await this.addAuditLog(tenantId,userId,"PASSWORD_CHANGED","USER",userId);return true}async updateTenantSettings(tenantId,userId,data){await this.init();const updates=[];const params=[];let idx=1;if(data.name!==void 0){updates.push(`name = $${idx++}`);params.push(data.name)}if(data.phone!==void 0){updates.push(`phone = $${idx++}`);params.push(data.phone)}if(data.address!==void 0){updates.push(`address = $${idx++}`);params.push(data.address)}if(updates.length>0){updates.push(`updated_at = CURRENT_TIMESTAMP`);params.push(tenantId);await this.pg.query(`UPDATE tenants SET ${updates.join(", ")} WHERE id = $${idx++}`,params);await this.addAuditLog(tenantId,userId,"AGENCY_SETTINGS_UPDATED","TENANT",tenantId)}return this.getTenantById(tenantId)}async getTransactions(tenantId, filters = {}, requestingUser = null) {
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
        params.push(requestingUser.branch_id || null);
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
      final_price: r.final_price != null ? Number(r.final_price) : null,
      deposit_amount: r.deposit_amount != null ? Number(r.deposit_amount) : null,
      rent_amount: r.rent_amount != null ? Number(r.rent_amount) : null,
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
       WHERE t.tenant_id = $1 AND t.id = $2 AND t.is_archived = false
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
      final_price: item.final_price != null ? Number(item.final_price) : null,
      deposit_amount: item.deposit_amount != null ? Number(item.deposit_amount) : null,
      rent_amount: item.rent_amount != null ? Number(item.rent_amount) : null,
      documents: docs.rows,
      documents_count: docs.rows.length
    };
  }async createTransaction(tenantId,userId,data){await this.init();const id=crypto.randomUUID();const contractDate=data.contract_date||new Date().toISOString();const agentId=data.agent_id||userId;const status=data.status||"COMPLETED";let branchId=data.branch_id||null;if(!branchId&&data.property_id){const prop=await this.getPropertyById(tenantId,data.property_id);if(prop)branchId=prop.branch_id}if(!branchId){const u=await this.getUserById(userId);branchId=u?.branch_id||null}if(!branchId){const branches=await this.getBranches(tenantId);branchId=branches.find(b=>b.is_main)?.id||branches[0]?.id||null}await this.pg.query(`
      INSERT INTO transactions (
        id, tenant_id, branch_id, property_id, transaction_type,
        customer_id, customer_name, customer_phone,
        owner_id, owner_name, owner_phone,
        final_price, deposit_amount, rent_amount,
        contract_date, agent_id, status, notes,
        created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    `,[id,tenantId,branchId,data.property_id,data.transaction_type,data.customer_id||null,data.customer_name,data.customer_phone||null,data.owner_id||null,data.owner_name||null,data.owner_phone||null,data.final_price||null,data.deposit_amount||null,data.rent_amount||null,contractDate,agentId,status,data.notes||null,userId]);if(data.document_ids&&Array.isArray(data.document_ids)&&data.document_ids.length>0){await this.pg.query(`
        UPDATE documents
        SET transaction_id = $1, branch_id = $2, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $3 AND id = ANY($4)
      `,[id,branchId,tenantId,data.document_ids])}if(status==="COMPLETED"){await this.pg.query(`
        UPDATE properties
        SET status = 'DEAL', updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1 AND id = $2 AND is_archived = false AND status <> 'ARCHIVED'
      `,[tenantId,data.property_id])}await this.addAuditLog(tenantId,userId,"TRANSACTION_CREATED","TRANSACTION",id,{property_id:data.property_id,transaction_type:data.transaction_type,customer_name:data.customer_name,final_price:data.final_price,branch_id:branchId,status});return this.getTransactionById(tenantId,id)}async updateTransaction(tenantId, userId, transactionId, data) {
    await this.init();
    const existing = await this.getTransactionById(tenantId, transactionId);
    if (!existing) return null;
    const fields = ["property_id", "transaction_type", "customer_id", "customer_name", "customer_phone",
      "owner_id", "owner_name", "owner_phone", "final_price", "deposit_amount", "rent_amount",
      "contract_date", "agent_id", "branch_id", "notes", "status"];
    const entries = fields.filter(key => data[key] !== undefined).map(key => [key, data[key] === "" ? null : data[key]]);
    if (!entries.length) return existing;
    await this.pg.transaction(async tx => {
      const assignments = entries.map(([key], index) => `${key} = $${index + 1}`);
      await tx.query(`UPDATE transactions SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${entries.length + 1} AND tenant_id = $${entries.length + 2} AND is_archived = false`,
        [...entries.map(([, value]) => value), transactionId, tenantId]);
      const propertyId = data.property_id || existing.property_id;
      await this.syncTransactionProperty(tx, tenantId, existing.property_id);
      if (propertyId !== existing.property_id) await this.syncTransactionProperty(tx, tenantId, propertyId);
      await tx.query(`UPDATE documents SET property_id = $1, customer_id = $2, branch_id = $3,
        updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $4 AND transaction_id = $5`,
        [propertyId, data.customer_id === undefined ? existing.customer_id : data.customer_id || null,
          data.branch_id === undefined ? existing.branch_id : data.branch_id || null, tenantId, transactionId]);
      await tx.query(`INSERT INTO audit_logs (id, tenant_id, actor_user_id, action, entity_type, entity_id)
        VALUES ($1, $2, $3, 'TRANSACTION_UPDATED', 'TRANSACTION', $4)`,
        [crypto.randomUUID(), tenantId, userId, transactionId]);
    });
    return this.getTransactionById(tenantId, transactionId);
  }
  async syncTransactionProperty(tx, tenantId, propertyId) {
    // A second completed contract must keep the property closed. Manual archives stay archived.
    await tx.query(`UPDATE properties p SET
      status = CASE WHEN EXISTS (SELECT 1 FROM transactions t WHERE t.tenant_id = p.tenant_id
        AND t.property_id = p.id AND t.status = 'COMPLETED' AND t.is_archived = false)
        THEN 'DEAL' ELSE 'ACTIVE' END,
      updated_at = CURRENT_TIMESTAMP
      WHERE p.tenant_id = $1 AND p.id = $2 AND p.is_archived = false AND p.status <> 'ARCHIVED'
        AND (p.status = 'DEAL' OR EXISTS (SELECT 1 FROM transactions t WHERE t.tenant_id = p.tenant_id
          AND t.property_id = p.id AND t.status = 'COMPLETED' AND t.is_archived = false))`,
      [tenantId, propertyId]);
  }
  async deleteTransaction(tenantId, userId, transactionId) {
    await this.init();
    const existing = await this.getTransactionById(tenantId, transactionId);
    if (!existing) return false;
    await this.pg.transaction(async tx => {
      await tx.query(`UPDATE transactions SET is_archived = true, archived_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND id = $2`, [tenantId, transactionId]);
      await this.syncTransactionProperty(tx, tenantId, existing.property_id);
      await tx.query(`INSERT INTO audit_logs (id, tenant_id, actor_user_id, action, entity_type, entity_id)
        VALUES ($1, $2, $3, 'TRANSACTION_DELETED', 'TRANSACTION', $4)`,
        [crypto.randomUUID(), tenantId, userId, transactionId]);
    });
    return true;
  }
  async getAgentPerformanceReport(tenantId,fromDate,toDate,branchId){await this.init();const transSummaryRes=await this.pg.query(`
      SELECT
        COUNT(*)::int as total_finalized_transactions,
        COALESCE(SUM(CASE WHEN transaction_type IN ('SALE', 'PRE_SALE', 'EXCHANGE') THEN final_price ELSE 0 END), 0)::bigint as total_sale_volume,
        COUNT(DISTINCT agent_id)::int as active_agents_with_deals
      FROM transactions
      WHERE tenant_id = $1
        AND is_archived = false
        AND status = 'COMPLETED'
        AND contract_date >= $2
        AND contract_date <= $3
        ${branchId&&branchId!=="ALL"?"AND branch_id = $4":""}
    `,branchId&&branchId!=="ALL"?[tenantId,fromDate,toDate,branchId]:[tenantId,fromDate,toDate]);const taskSummaryRes=await this.pg.query(`
      SELECT
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int as total_completed_followups,
        COUNT(CASE WHEN type = 'VISIT' AND status = 'COMPLETED' THEN 1 END)::int as total_visits
      FROM tasks
      WHERE tenant_id = $1
        AND (
          (completed_at IS NOT NULL AND completed_at >= $2 AND completed_at <= $3)
          OR (status = 'COMPLETED' AND due_at >= $2 AND due_at <= $3)
        )
        ${branchId&&branchId!=="ALL"?"AND branch_id = $4":""}
    `,branchId&&branchId!=="ALL"?[tenantId,fromDate,toDate,branchId]:[tenantId,fromDate,toDate]);const inventoryRes=await this.pg.query(`
      SELECT
        (SELECT COUNT(*)::int FROM properties WHERE tenant_id = $1 AND is_archived = false AND status = 'ACTIVE' ${branchId&&branchId!=="ALL"?"AND branch_id = $2":""}) as total_active_properties,
        (SELECT COUNT(*)::int FROM customers WHERE tenant_id = $1 AND is_archived = false AND lead_status != 'CLOSED_LOST' ${branchId&&branchId!=="ALL"?"AND branch_id = $2":""}) as total_active_customers
    `,branchId&&branchId!=="ALL"?[tenantId,branchId]:[tenantId]);const officeSummary={total_finalized_transactions:Number(transSummaryRes.rows[0]?.total_finalized_transactions||0),total_sale_volume:Number(transSummaryRes.rows[0]?.total_sale_volume||0),active_agents_with_deals:Number(transSummaryRes.rows[0]?.active_agents_with_deals||0),total_completed_followups:Number(taskSummaryRes.rows[0]?.total_completed_followups||0),total_visits:Number(taskSummaryRes.rows[0]?.total_visits||0),total_active_properties:Number(inventoryRes.rows[0]?.total_active_properties||0),total_active_customers:Number(inventoryRes.rows[0]?.total_active_customers||0)};let agentQuery=`
      SELECT id, display_name, phone, role_code, is_active, branch_id
      FROM users
      WHERE tenant_id = $1
    `;const agentQueryParams=[tenantId];if(branchId&&branchId!=="ALL"){agentQuery+=` AND branch_id = $2`;agentQueryParams.push(branchId)}agentQuery+=` ORDER BY role_code ASC, display_name ASC`;const agentsRes=await this.pg.query(agentQuery,agentQueryParams);const agentMetrics=await Promise.all(agentsRes.rows.map(async ag=>{const agTransRes=await this.pg.query(`
        SELECT
          COUNT(*)::int as finalized_count,
          COALESCE(SUM(CASE WHEN transaction_type IN ('SALE', 'PRE_SALE', 'EXCHANGE') THEN final_price ELSE 0 END), 0)::bigint as sale_volume,
          MAX(contract_date) as last_transaction_date
        FROM transactions
        WHERE tenant_id = $1
          AND agent_id = $2
          AND is_archived = false
          AND status = 'COMPLETED'
          AND contract_date >= $3
          AND contract_date <= $4
      `,[tenantId,ag.id,fromDate,toDate]);const agTaskRes=await this.pg.query(`
        SELECT
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int as followups_count,
          COUNT(CASE WHEN type = 'VISIT' AND status = 'COMPLETED' THEN 1 END)::int as visits_count
        FROM tasks
        WHERE tenant_id = $1
          AND assigned_user_id = $2
          AND (
            (completed_at IS NOT NULL AND completed_at >= $3 AND completed_at <= $4)
            OR (status = 'COMPLETED' AND due_at >= $3 AND due_at <= $4)
          )
      `,[tenantId,ag.id,fromDate,toDate]);const agInvRes=await this.pg.query(`
        SELECT
          (SELECT COUNT(*)::int FROM properties WHERE tenant_id = $1 AND assigned_agent_id = $2 AND is_archived = false AND status = 'ACTIVE') as active_props,
          (SELECT COUNT(*)::int FROM customers WHERE tenant_id = $1 AND assigned_agent_id = $2 AND is_archived = false AND lead_status != 'CLOSED_LOST') as active_custs
      `,[tenantId,ag.id]);return{agent_id:ag.id,agent_name:ag.display_name,phone:ag.phone,role_code:ag.role_code,is_active:ag.is_active,finalized_transactions_count:Number(agTransRes.rows[0]?.finalized_count||0),final_sale_volume:Number(agTransRes.rows[0]?.sale_volume||0),completed_followups_count:Number(agTaskRes.rows[0]?.followups_count||0),visits_count:Number(agTaskRes.rows[0]?.visits_count||0),last_transaction_date:agTransRes.rows[0]?.last_transaction_date||null,active_properties_count:Number(agInvRes.rows[0]?.active_props||0),active_customers_count:Number(agInvRes.rows[0]?.active_custs||0)}}));const transactionsInPeriod=await this.getTransactions(tenantId,{startDate:fromDate,endDate:toDate,status:"COMPLETED",branch_id:branchId&&branchId!=="ALL"?branchId:void 0});return{period:{from:fromDate,to:toDate},summary:officeSummary,agents:agentMetrics,transactions:transactionsInPeriod}}async getTenantSubscription(tenantId){await this.init();const tenantRes=await this.pg.query(`
      SELECT id, agency_code, name, slug, phone, email, status, plan_code,
             subscription_status, subscription_start_at, subscription_expires_at,
             max_branches, max_agents, billing_cycle
      FROM tenants
      WHERE id = $1
      LIMIT 1
    `,[tenantId]);if(tenantRes.rows.length===0)return null;const t=tenantRes.rows[0];const countsRes=await this.pg.query(`
      SELECT
        (SELECT COUNT(*)::int FROM branches WHERE tenant_id = $1 AND status = 'ACTIVE') as active_branches,
        (SELECT COUNT(*)::int FROM users WHERE tenant_id = $1 AND is_active = true) as active_agents
    `,[tenantId]);const activeBranches=Number(countsRes.rows[0]?.active_branches||1);const activeAgents=Number(countsRes.rows[0]?.active_agents||1);const now=new Date;const expiresAt=t.subscription_expires_at?new Date(t.subscription_expires_at):new Date(now.getTime()+30*864e5);const msDiff=expiresAt.getTime()-now.getTime();const daysRemaining=Math.max(0,Math.ceil(msDiff/(1e3*60*60*24)));let status=t.subscription_status||"ACTIVE";if(daysRemaining<=0){status="EXPIRED"}const planCode=t.plan_code||"ENTERPRISE_PRO";const planDetails={FREE_TRIAL:{title:"\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u0631\u0627\u06CC\u06AF\u0627\u0646",price:0,description:"\u062F\u0648\u0631\u0647 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u06F1\u06F4 \u0631\u0648\u0632\u0647 \u0628\u0631\u0627\u06CC \u062A\u0633\u062A \u0627\u0645\u06A9\u0627\u0646\u0627\u062A \u0633\u0627\u0645\u0627\u0646\u0647"},STARTER:{title:"\u067E\u0644\u0646 \u067E\u0627\u06CC\u0647 (\u062A\u06A9 \u0634\u0639\u0628\u0647)",price:12e6,description:"\u0645\u0646\u0627\u0633\u0628 \u062F\u0641\u0627\u062A\u0631 \u0646\u0648\u067E\u0627 \u0628\u0627 \u06F1 \u0634\u0639\u0628\u0647 \u0648 \u062D\u062F\u0627\u06A9\u062B\u0631 \u06F5 \u0645\u0634\u0627\u0648\u0631"},PROFESSIONAL:{title:"\u067E\u0644\u0646 \u062D\u0631\u0641\u0647\u200C\u0627\u06CC (\u06F3 \u0634\u0639\u0628\u0647)",price:28e6,description:"\u0645\u0646\u0627\u0633\u0628 \u062F\u0641\u0627\u062A\u0631 \u062F\u0631 \u062D\u0627\u0644 \u062A\u0648\u0633\u0639\u0647 \u0628\u0627 \u06F3 \u0634\u0639\u0628\u0647 \u0648 \u06F1\u06F5 \u0645\u0634\u0627\u0648\u0631"},ENTERPRISE_PRO:{title:"\u067E\u0644\u0646 \u0633\u0627\u0632\u0645\u0627\u0646\u06CC \u067E\u06CC\u0634\u0631\u0641\u062A\u0647 (\u0686\u0646\u062F\u0634\u0639\u0628\u0647\u200C\u0627\u06CC \u0646\u0627\u0645\u062D\u062F\u0648\u062F)",price:49e6,description:"\u062F\u0641\u0627\u062A\u0631 \u0628\u0632\u0631\u06AF \u0628\u0627 \u0634\u0639\u0628 \u0646\u0627\u0645\u062D\u062F\u0648\u062F\u060C \u0627\u0633\u0646\u0627\u062F \u0627\u0645\u0646 \u0648 \u0647\u0648\u0634 \u062A\u0637\u0628\u06CC\u0642"}};const currentPlanMeta=planDetails[planCode]||planDetails.ENTERPRISE_PRO;return{tenant_id:t.id,agency_code:t.agency_code,name:t.name,plan_code:planCode,plan_title:currentPlanMeta.title,plan_price:currentPlanMeta.price,subscription_status:status,subscription_start_at:t.subscription_start_at||t.created_at,subscription_expires_at:expiresAt.toISOString(),days_remaining:daysRemaining,is_expired:daysRemaining<=0,max_branches:Number(t.max_branches||10),max_agents:Number(t.max_agents||50),active_branches_count:activeBranches,active_agents_count:activeAgents,billing_cycle:t.billing_cycle||"ANNUAL",features:["\u0633\u06CC\u0633\u062A\u0645 \u0686\u0646\u062F\u0634\u0639\u0628\u0647\u200C\u0627\u06CC \u0648 \u062A\u0641\u06A9\u06CC\u06A9 \u062F\u0633\u062A\u0631\u0633\u06CC \u0645\u062F\u06CC\u0631\u0627\u0646 \u0634\u0639\u0628","\u0628\u0627\u06CC\u06AF\u0627\u0646\u06CC \u0627\u0645\u0646 \u0627\u0633\u0646\u0627\u062F \u0648 \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u0647\u0627 \u0628\u0627 \u0627\u062D\u0631\u0627\u0632 \u0647\u0648\u06CC\u062A","\u0645\u0648\u062A\u0648\u0631 \u062A\u0637\u0628\u06CC\u0642 \u0647\u0648\u0634\u0645\u0646\u062F \u0644\u06CC\u062F\u0647\u0627 \u0628\u0627 \u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC \u0645\u0644\u06A9\u06CC (Smart Matching)","\u06AF\u0632\u0627\u0631\u0634\u200C\u06AF\u06CC\u0631\u06CC \u0639\u0645\u0644\u06A9\u0631\u062F \u0645\u0627\u0647\u0627\u0646\u0647 \u0645\u0634\u0627\u0648\u0631\u0627\u0646 \u0648 \u062D\u062C\u0645 \u0645\u0639\u0627\u0645\u0644\u0627\u062A","\u0627\u0634\u062A\u0631\u0627\u06A9\u200C\u06AF\u0630\u0627\u0631\u06CC \u0627\u0645\u0646 \u0641\u0627\u06CC\u0644 \u0645\u0644\u06A9\u06CC \u0628\u0627 \u062A\u0648\u06A9\u0646 \u0639\u0645\u0648\u0645\u06CC","\u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC \u0641\u0646\u06CC \u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u0648 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u200C\u06AF\u06CC\u0631\u06CC \u0627\u0628\u0631\u06CC \u062E\u0648\u062F\u06A9\u0627\u0631"],plans_catalog:[{code:"STARTER",title:"\u067E\u0644\u0646 \u067E\u0627\u06CC\u0647",price_annual:12e6,max_branches:1,max_agents:5,features:["\u06F1 \u0634\u0639\u0628\u0647 \u0641\u0639\u0627\u0644","\u06F5 \u0645\u0634\u0627\u0648\u0631 \u0641\u0639\u0627\u0644","\u062B\u0628\u062A \u0646\u0627\u0645\u062D\u062F\u0648\u062F \u0645\u0644\u06A9 \u0648 \u0645\u0634\u062A\u0631\u06CC","\u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0648\u0638\u0627\u06CC\u0641"]},{code:"PROFESSIONAL",title:"\u067E\u0644\u0646 \u062D\u0631\u0641\u0647\u200C\u0627\u06CC",price_annual:28e6,max_branches:3,max_agents:15,features:["\u06F3 \u0634\u0639\u0628\u0647 \u0645\u0633\u062A\u0642\u0644","\u06F1\u06F5 \u0645\u0634\u0627\u0648\u0631 \u0641\u0639\u0627\u0644","\u0628\u0627\u06CC\u06AF\u0627\u0646\u06CC \u0627\u0633\u0646\u0627\u062F \u0642\u0631\u0627\u0631\u062F\u0627\u062F","\u0647\u0648\u0634 \u062A\u0637\u0628\u06CC\u0642 \u0645\u0644\u06A9"]},{code:"ENTERPRISE_PRO",title:"\u067E\u0644\u0646 \u0633\u0627\u0632\u0645\u0627\u0646\u06CC \u0646\u0627\u0645\u062D\u062F\u0648\u062F",price_annual:49e6,max_branches:10,max_agents:50,features:["\u06F1\u06F0 \u0634\u0639\u0628\u0647 \u0641\u0639\u0627\u0644","\u06F5\u06F0 \u0645\u0634\u0627\u0648\u0631 \u0641\u0639\u0627\u0644","\u06AF\u0632\u0627\u0631\u0634\u200C\u0647\u0627\u06CC \u067E\u06CC\u0634\u0631\u0641\u062A\u0647 \u0645\u062F\u06CC\u0631\u06CC\u062A\u06CC","\u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC VIP"]}]}}async renewOrUpgradeSubscription(tenantId,actorUserId,data){await this.init();const durationMonths=Number(data.duration_months||12);const planCode=data.plan_code||"ENTERPRISE_PRO";let maxBranches=5;let maxAgents=20;if(planCode==="STARTER"){maxBranches=1;maxAgents=5}else if(planCode==="PROFESSIONAL"){maxBranches=3;maxAgents=15}else if(planCode==="ENTERPRISE_PRO"){maxBranches=10;maxAgents=50}const currentTenant=await this.pg.query(`SELECT subscription_expires_at FROM tenants WHERE id = $1`,[tenantId]);const currentExpiry=currentTenant.rows[0]?.subscription_expires_at?new Date(currentTenant.rows[0].subscription_expires_at):new Date;const baseDate=currentExpiry>new Date?currentExpiry:new Date;const newExpiry=new Date(baseDate.getTime()+durationMonths*30*864e5);await this.pg.query(`
      UPDATE tenants
      SET plan_code = $1,
          subscription_status = 'ACTIVE',
          subscription_expires_at = $2,
          max_branches = $3,
          max_agents = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `,[planCode,newExpiry.toISOString(),maxBranches,maxAgents,tenantId]);await this.addAuditLog(tenantId,actorUserId,"SUBSCRIPTION_RENEWED","TENANT",tenantId,{plan_code:planCode,duration_months:durationMonths,new_expires_at:newExpiry.toISOString()});return await this.getTenantSubscription(tenantId)}async getAllTenantsWithStats(){await this.init();const res=await this.pg.query(`
      SELECT t.*,
             (SELECT count(*)::int FROM branches b WHERE b.tenant_id = t.id AND b.status = 'ACTIVE') as branches_count,
             (SELECT count(*)::int FROM users u WHERE u.tenant_id = t.id AND u.is_active = true) as agents_count,
             (SELECT count(*)::int FROM properties p WHERE p.tenant_id = t.id AND p.is_archived = false) as properties_count,
             (SELECT count(*)::int FROM transactions tr WHERE tr.tenant_id = t.id AND tr.status = 'COMPLETED') as transactions_count,
             (SELECT COALESCE(SUM(tr.final_price), 0)::numeric FROM transactions tr WHERE tr.tenant_id = t.id AND tr.status = 'COMPLETED') as total_transaction_volume,
             (SELECT u.username FROM users u WHERE u.tenant_id = t.id AND u.role_code = 'ADMIN' ORDER BY u.created_at ASC LIMIT 1) as admin_username,
             (SELECT u.display_name FROM users u WHERE u.tenant_id = t.id AND u.role_code = 'ADMIN' ORDER BY u.created_at ASC LIMIT 1) as admin_name,
             (SELECT u.phone FROM users u WHERE u.tenant_id = t.id AND u.role_code = 'ADMIN' ORDER BY u.created_at ASC LIMIT 1) as admin_phone,
             (SELECT u.id FROM users u WHERE u.tenant_id = t.id AND u.role_code = 'ADMIN' ORDER BY u.created_at ASC LIMIT 1) as admin_user_id
      FROM tenants t
      ORDER BY t.created_at DESC
    `);const now=new Date;return res.rows.map(r=>{const exp=r.subscription_expires_at?new Date(r.subscription_expires_at):null;const daysRemaining=exp?Math.max(0,Math.ceil((exp.getTime()-now.getTime())/(1e3*60*60*24))):0;return{id:r.id,agency_code:r.agency_code,name:r.name,slug:r.slug,phone:r.phone,email:r.email,address:r.address,status:r.status,plan_code:r.plan_code||"ENTERPRISE_PRO",subscription_status:r.subscription_status||"ACTIVE",subscription_expires_at:r.subscription_expires_at,days_remaining:daysRemaining,max_branches:Number(r.max_branches||5),max_agents:Number(r.max_agents||20),branches_count:Number(r.branches_count||0),agents_count:Number(r.agents_count||0),properties_count:Number(r.properties_count||0),transactions_count:Number(r.transactions_count||0),total_transaction_volume:Number(r.total_transaction_volume||0),admin_username:r.admin_username||null,admin_name:r.admin_name||null,admin_phone:r.admin_phone||null,admin_user_id:r.admin_user_id||null,created_at:r.created_at,updated_at:r.updated_at}})}async getPlatformOverviewMetrics(){await this.init();const res=await this.pg.query(`
      SELECT
        (SELECT COUNT(*)::int FROM tenants) as total_tenants,
        (SELECT COUNT(*)::int FROM tenants WHERE status = 'ACTIVE' AND (subscription_expires_at IS NULL OR subscription_expires_at > CURRENT_TIMESTAMP)) as active_tenants,
        (SELECT COUNT(*)::int FROM branches WHERE status = 'ACTIVE') as total_branches,
        (SELECT COUNT(*)::int FROM users WHERE is_active = true) as total_agents,
        (SELECT COUNT(*)::int FROM properties WHERE is_archived = false) as total_properties,
        (SELECT COUNT(*)::int FROM customers WHERE is_archived = false) as total_customers,
        (SELECT COUNT(*)::int FROM transactions WHERE status = 'COMPLETED') as total_transactions,
        (SELECT COALESCE(SUM(final_price), 0)::numeric FROM transactions WHERE status = 'COMPLETED') as total_transaction_volume
    `);const row=res.rows[0];return{total_tenants:Number(row.total_tenants||0),active_tenants:Number(row.active_tenants||0),total_branches:Number(row.total_branches||0),total_agents:Number(row.total_agents||0),total_properties:Number(row.total_properties||0),total_customers:Number(row.total_customers||0),total_transactions:Number(row.total_transactions||0),total_transaction_volume:Number(row.total_transaction_volume||0)}}async createPlatformTenant(data,actorUserId){await this.init();const id=crypto.randomUUID();const cleanAgencyCode=data.agency_code.trim().toUpperCase();const slug=data.slug?.trim().toLowerCase()||cleanAgencyCode.toLowerCase();const planCode=data.plan_code||"ENTERPRISE_PRO";const trialDays=Number(data.trial_days||7);const expiresAt=new Date(Date.now()+trialDays*864e5).toISOString();let maxBranches=5;let maxAgents=20;if(planCode==="STARTER"){maxBranches=1;maxAgents=5}else if(planCode==="PROFESSIONAL"){maxBranches=3;maxAgents=15}else if(planCode==="ENTERPRISE_PRO"){maxBranches=10;maxAgents=50}await this.pg.query(`
      INSERT INTO tenants (
        id, agency_code, name, slug, phone, email, address,
        timezone, locale, currency, status, plan_code,
        subscription_status, subscription_start_at, subscription_expires_at,
        max_branches, max_agents, billing_cycle
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        'Asia/Tehran', 'fa-IR', 'IRR', 'ACTIVE', $8,
        'ACTIVE', CURRENT_TIMESTAMP, $9,
        $10, $11, 'ANNUAL'
      )
    `,[id,cleanAgencyCode,data.name.trim(),slug,data.phone||null,data.email||null,data.address||null,planCode,expiresAt,maxBranches,maxAgents]);const branchId=crypto.randomUUID();await this.pg.query(`
      INSERT INTO branches (id, tenant_id, branch_code, name, is_main, status)
      VALUES ($1, $2, 'MAIN', '\u0634\u0639\u0628\u0647 \u0645\u0631\u06A9\u0632\u06CC', true, 'ACTIVE')
    `,[branchId,id]);
    const adminUserId=crypto.randomUUID();
    const adminPassword=(data.admin_password || "AdminPassword123!").trim();
    const passwordHash=bcrypt.hashSync(adminPassword,10);
    const cleanAdminUsername=normalizeDigits((data.admin_username || "admin").trim()).toLowerCase();

    let adminName=(data.admin_name || data.admin_display_name || "").trim();
    let firstName=data.admin_first_name || "";
    let lastName=data.admin_last_name || "";
    if(!firstName && !lastName){
      if(adminName){
        const parts=adminName.split(" ");
        firstName=parts[0] || "مدیر";
        lastName=parts.slice(1).join(" ") || "دفتر";
      }else{
        firstName="مدیر";
        lastName="دفتر";
        adminName="مدیر دفتر";
      }
    }else if(!adminName){
      adminName=`${firstName} ${lastName}`.trim();
    }
    const adminPhone=data.admin_phone || data.phone || "09120000000";

    await this.pg.query(`
      INSERT INTO users (
        id, tenant_id, branch_id, username, password_hash,
        first_name, last_name, display_name, phone, is_active, role_code
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, true, 'ADMIN'
      )
    `,[
      adminUserId,
      id,
      branchId,
      cleanAdminUsername,
      passwordHash,
      firstName,
      lastName,
      adminName,
      adminPhone
    ]);
    await this.addAuditLog(id,actorUserId,"PLATFORM_TENANT_CREATED","TENANT",id,{agency_code:cleanAgencyCode,name:data.name,plan_code:planCode,admin_username:cleanAdminUsername});
    const tenants=await this.getAllTenantsWithStats();
    const createdTenant=tenants.find(t=>t.id===id);
    return {
      ...createdTenant,
      admin: {
        id: adminUserId,
        username: cleanAdminUsername,
        display_name: adminName,
        phone: adminPhone,
        role_code: "ADMIN"
      }
    };
  }
  async updatePlatformTenantManager(tenantId, data, actorUserId) {
    await this.init();
    const cleanUsername = data.admin_username ? normalizeDigits(data.admin_username.trim()).toLowerCase() : null;
    const adminName = data.admin_name ? data.admin_name.trim() : null;
    const phone = data.admin_phone ? data.admin_phone.trim() : null;

    // Check if an admin exists for this tenant
    const res = await this.pg.query(
      `SELECT * FROM users WHERE tenant_id = $1 AND role_code = 'ADMIN' ORDER BY created_at ASC LIMIT 1`,
      [tenantId]
    );

    let adminUser = res.rows[0];
    if (adminUser) {
      const updates = [];
      const params = [adminUser.id, tenantId];
      let idx = 3;

      if (adminName) {
        const parts = adminName.split(" ");
        const firstName = parts[0] || "مدیر";
        const lastName = parts.slice(1).join(" ") || "دفتر";
        updates.push(`display_name = $${idx++}`, `first_name = $${idx++}`, `last_name = $${idx++}`);
        params.push(adminName, firstName, lastName);
      }
      if (cleanUsername) {
        updates.push(`username = $${idx++}`);
        params.push(cleanUsername);
      }
      if (data.admin_password && data.admin_password.trim().length >= 6) {
        const hash = bcrypt.hashSync(data.admin_password.trim(), 10);
        updates.push(`password_hash = $${idx++}`);
        params.push(hash);
      }
      if (phone) {
        updates.push(`phone = $${idx++}`);
        params.push(phone);
      }

      if (updates.length > 0) {
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        await this.pg.query(
          `UPDATE users SET ${updates.join(", ")} WHERE id = $1 AND tenant_id = $2`,
          params
        );
      }
    } else {
      // Create fresh admin for tenant
      const branchRes = await this.pg.query(`SELECT id FROM branches WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
      const branchId = branchRes.rows[0]?.id || null;
      const adminUserId = crypto.randomUUID();
      const finalUsername = cleanUsername || "admin";
      const finalPassword = (data.admin_password || "DemoPassword123!").trim();
      const passwordHash = bcrypt.hashSync(finalPassword, 10);
      const finalName = adminName || "مدیر دفتر";
      const parts = finalName.split(" ");
      const firstName = parts[0] || "مدیر";
      const lastName = parts.slice(1).join(" ") || "دفتر";

      await this.pg.query(`
        INSERT INTO users (
          id, tenant_id, branch_id, username, password_hash,
          first_name, last_name, display_name, phone, is_active, role_code
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, true, 'ADMIN'
        )
      `, [
        adminUserId,
        tenantId,
        branchId,
        finalUsername,
        passwordHash,
        firstName,
        lastName,
        finalName,
        phone || "09120000000"
      ]);
      adminUser = { id: adminUserId, username: finalUsername };
    }

    if (actorUserId) {
      await this.addAuditLog(tenantId, actorUserId, "PLATFORM_TENANT_MANAGER_UPDATED", "USER", adminUser.id, {
        admin_username: cleanUsername || adminUser.username
      });
    }

    const tenants = await this.getAllTenantsWithStats();
    return tenants.find(t => t.id === tenantId);
  }
  async updatePlatformTenantStatus(tenantId, status, actorUserId) {
    await this.init();
    if (status === 'SUSPENDED') {
      await this.pg.query(`
        UPDATE tenants
        SET status = 'SUSPENDED',
            subscription_status = 'SUSPENDED',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [tenantId]);
    } else {
      await this.pg.query(`
        UPDATE tenants
        SET status = 'ACTIVE',
            subscription_status = (CASE WHEN subscription_status = 'SUSPENDED' THEN 'ACTIVE' ELSE subscription_status END),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [tenantId]);
    }

    if (status === 'SUSPENDED') {
      await this.pg.query(`DELETE FROM sessions WHERE tenant_id = $1`, [tenantId]);
      await this.pg.query(`UPDATE platform_support_sessions SET status = 'ENDED' WHERE tenant_id = $1`, [tenantId]);
    }

    await this.addAuditLog(tenantId, actorUserId, "PLATFORM_TENANT_STATUS_UPDATED", "TENANT", tenantId, { status });
    const tenants = await this.getAllTenantsWithStats();
    return tenants.find(t => t.id === tenantId);
  }

  async deletePlatformTenant(tenantId, actorUserId) {
    await this.init();
    const tenantRes = await this.pg.query(`SELECT id, agency_code, name FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
    if (tenantRes.rows.length === 0) {
      throw new Error("دفتر املاک مورد نظر یافت نشد.");
    }
    const tenant = tenantRes.rows[0];

    await this.pg.query(`DELETE FROM support_audit_logs WHERE tenant_id = $1`, [tenantId]);
    await this.pg.query(`DELETE FROM platform_support_sessions WHERE tenant_id = $1`, [tenantId]);
    await this.pg.query(`DELETE FROM sessions WHERE tenant_id = $1`, [tenantId]);
    await this.pg.query(`DELETE FROM customer_property_interactions WHERE tenant_id = $1`, [tenantId]);
    await this.pg.query(`DELETE FROM property_media WHERE tenant_id = $1`, [tenantId]);
    await this.pg.query(`DELETE FROM documents WHERE tenant_id = $1`, [tenantId]);
    await this.pg.query(`DELETE FROM transactions WHERE tenant_id = $1`, [tenantId]);
    await this.pg.query(`DELETE FROM tasks WHERE tenant_id = $1`, [tenantId]);
    await this.pg.query(`DELETE FROM interactions WHERE tenant_id = $1`, [tenantId]);
    await this.pg.query(`DELETE FROM customer_requirements WHERE tenant_id = $1`, [tenantId]);
    await this.pg.query(`DELETE FROM customers WHERE tenant_id = $1`, [tenantId]);
    await this.pg.query(`DELETE FROM property_owners WHERE tenant_id = $1`, [tenantId]);
    await this.pg.query(`DELETE FROM properties WHERE tenant_id = $1`, [tenantId]);
    await this.pg.query(`DELETE FROM owners WHERE tenant_id = $1`, [tenantId]);
    await this.pg.query(`DELETE FROM users WHERE tenant_id = $1`, [tenantId]);
    await this.pg.query(`DELETE FROM branches WHERE tenant_id = $1`, [tenantId]);
    await this.pg.query(`DELETE FROM tenant_counters WHERE tenant_id = $1`, [tenantId]);
    await this.pg.query(`DELETE FROM audit_logs WHERE tenant_id = $1`, [tenantId]);
    await this.pg.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);

    console.log(`[Platform Admin] Tenant "${tenant.name}" (${tenant.agency_code}) and all related data completely deleted by actor ${actorUserId}`);
    return tenant;
  }async updatePlatformTenantSubscription(tenantId, data, actorUserId) {
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

  // --- Backup & Restore (Export / Import) Methods ---
  async exportTenantBackup(tenantId) {
    await this.init();
    const tenantRes = await this.pg.query(`SELECT * FROM tenants WHERE id = $1`, [tenantId]);
    if (tenantRes.rows.length === 0) {
      throw new Error("دفتر املاک مورد نظر یافت نشد.");
    }
    const tenant = tenantRes.rows[0];

    const branches = (await this.pg.query(`SELECT * FROM branches WHERE tenant_id = $1 ORDER BY created_at ASC`, [tenantId])).rows;
    const users = (await this.pg.query(`SELECT * FROM users WHERE tenant_id = $1 ORDER BY created_at ASC`, [tenantId])).rows;
    const properties = (await this.pg.query(`SELECT * FROM properties WHERE tenant_id = $1 ORDER BY created_at ASC`, [tenantId])).rows;
    const owners = (await this.pg.query(`SELECT * FROM owners WHERE tenant_id = $1 ORDER BY created_at ASC`, [tenantId])).rows;
    const property_owners = (await this.pg.query(`SELECT * FROM property_owners WHERE tenant_id = $1`, [tenantId])).rows;
    const property_media = (await this.pg.query(`SELECT * FROM property_media WHERE tenant_id = $1 ORDER BY sort_order ASC, created_at ASC`, [tenantId])).rows;
    const customers = (await this.pg.query(`SELECT * FROM customers WHERE tenant_id = $1 ORDER BY created_at ASC`, [tenantId])).rows;
    const customer_requirements = (await this.pg.query(`SELECT * FROM customer_requirements WHERE tenant_id = $1`, [tenantId])).rows;
    const tasks = (await this.pg.query(`SELECT * FROM tasks WHERE tenant_id = $1 ORDER BY created_at ASC`, [tenantId])).rows;
    const interactions = (await this.pg.query(`SELECT * FROM interactions WHERE tenant_id = $1 ORDER BY created_at ASC`, [tenantId])).rows;
    const customer_property_interactions = (await this.pg.query(`SELECT * FROM customer_property_interactions WHERE tenant_id = $1`, [tenantId])).rows;
    const documents = (await this.pg.query(`SELECT * FROM documents WHERE tenant_id = $1 ORDER BY created_at ASC`, [tenantId])).rows;
    const transactions = (await this.pg.query(`SELECT * FROM transactions WHERE tenant_id = $1 ORDER BY created_at ASC`, [tenantId])).rows;
    const tenant_counters = (await this.pg.query(`SELECT * FROM tenant_counters WHERE tenant_id = $1`, [tenantId])).rows;

    return {
      version: "1.0",
      app: "Amlak OS",
      export_type: "TENANT_BACKUP",
      export_at: new Date().toISOString(),
      tenant,
      summary: {
        branches_count: branches.length,
        users_count: users.length,
        properties_count: properties.length,
        owners_count: owners.length,
        customers_count: customers.length,
        tasks_count: tasks.length,
        transactions_count: transactions.length,
        documents_count: documents.length
      },
      data: {
        branches,
        users,
        properties,
        owners,
        property_owners,
        property_media,
        customers,
        customer_requirements,
        tasks,
        interactions,
        customer_property_interactions,
        documents,
        transactions,
        tenant_counters
      }
    };
  }

  async exportAllTenantsBackup() {
    await this.init();
    const tenants = (await this.pg.query(`SELECT id FROM tenants ORDER BY created_at ASC`)).rows;
    const backups = [];
    for (const t of tenants) {
      const b = await this.exportTenantBackup(t.id);
      backups.push(b);
    }
    return {
      version: "1.0",
      app: "Amlak OS",
      export_type: "SYSTEM_FULL_BACKUP",
      export_at: new Date().toISOString(),
      total_tenants: backups.length,
      tenants: backups
    };
  }

  async importTenantBackup(backupPayload, options = {}, actorUserId = null) {
    await this.init();
    if (!backupPayload) {
      throw new Error("فایل یا داده‌های بک‌آپ ارسال نشده است.");
    }

    const payload = backupPayload.tenant ? backupPayload : (Array.isArray(backupPayload.tenants) && backupPayload.tenants[0] ? backupPayload.tenants[0] : null);
    if (!payload || !payload.tenant || !payload.data) {
      throw new Error("ساختار فایل بک‌آپ نامعتبر است. آبجکت‌های tenant و data یافت نشدند.");
    }

    const backupTenant = payload.tenant;
    const backupData = payload.data;

    let targetTenantId = options.targetTenantId;

    if (targetTenantId) {
      const existing = await this.pg.query(`SELECT id, agency_code, name FROM tenants WHERE id = $1`, [targetTenantId]);
      if (existing.rows.length === 0) {
        throw new Error("آژانس هدف جهت بازیابی یافت نشد.");
      }
    } else {
      let codeToUse = (options.overrideAgencyCode || backupTenant.agency_code || "AMLA").trim().toUpperCase();
      const codeCheck = await this.pg.query(`SELECT id FROM tenants WHERE UPPER(agency_code) = $1`, [codeToUse]);
      if (codeCheck.rows.length > 0) {
        if (options.overrideExisting) {
          targetTenantId = codeCheck.rows[0].id;
        } else {
          codeToUse = `${codeToUse}_${Math.floor(100 + Math.random() * 900)}`;
        }
      }

      if (!targetTenantId) {
        targetTenantId = crypto.randomUUID();
        const tenantName = (options.overrideName || backupTenant.name || "آژانس بازیابی شده").trim();
        const slug = backupTenant.slug ? `${backupTenant.slug}-${Date.now().toString(36)}` : codeToUse.toLowerCase();

        await this.pg.query(`
          INSERT INTO tenants (
            id, agency_code, name, slug, phone, email, address,
            timezone, locale, currency, status, plan_code,
            subscription_status, subscription_start_at, subscription_expires_at,
            max_branches, max_agents, billing_cycle
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12,
            $13, $14, $15,
            $16, $17, $18
          )
        `, [
          targetTenantId,
          codeToUse,
          tenantName,
          slug,
          backupTenant.phone || null,
          backupTenant.email || null,
          backupTenant.address || null,
          backupTenant.timezone || 'Asia/Tehran',
          backupTenant.locale || 'fa',
          backupTenant.currency || 'IRR',
          backupTenant.status || 'ACTIVE',
          backupTenant.plan_code || 'ENTERPRISE_PRO',
          backupTenant.subscription_status || 'ACTIVE',
          backupTenant.subscription_start_at || new Date().toISOString(),
          backupTenant.subscription_expires_at || new Date(Date.now() + 30 * 864e5).toISOString(),
          backupTenant.max_branches || 10,
          backupTenant.max_agents || 50,
          backupTenant.billing_cycle || 'ANNUAL'
        ]);
      }
    }

    // Clean existing records for targetTenantId
    await this.pg.query(`DELETE FROM support_audit_logs WHERE tenant_id = $1`, [targetTenantId]);
    await this.pg.query(`DELETE FROM platform_support_sessions WHERE tenant_id = $1`, [targetTenantId]);
    await this.pg.query(`DELETE FROM sessions WHERE tenant_id = $1`, [targetTenantId]);
    await this.pg.query(`DELETE FROM customer_property_interactions WHERE tenant_id = $1`, [targetTenantId]);
    await this.pg.query(`DELETE FROM property_media WHERE tenant_id = $1`, [targetTenantId]);
    await this.pg.query(`DELETE FROM documents WHERE tenant_id = $1`, [targetTenantId]);
    await this.pg.query(`DELETE FROM transactions WHERE tenant_id = $1`, [targetTenantId]);
    await this.pg.query(`DELETE FROM tasks WHERE tenant_id = $1`, [targetTenantId]);
    await this.pg.query(`DELETE FROM interactions WHERE tenant_id = $1`, [targetTenantId]);
    await this.pg.query(`DELETE FROM customer_requirements WHERE tenant_id = $1`, [targetTenantId]);
    await this.pg.query(`DELETE FROM customers WHERE tenant_id = $1`, [targetTenantId]);
    await this.pg.query(`DELETE FROM property_owners WHERE tenant_id = $1`, [targetTenantId]);
    await this.pg.query(`DELETE FROM properties WHERE tenant_id = $1`, [targetTenantId]);
    await this.pg.query(`DELETE FROM owners WHERE tenant_id = $1`, [targetTenantId]);
    await this.pg.query(`DELETE FROM users WHERE tenant_id = $1`, [targetTenantId]);
    await this.pg.query(`DELETE FROM branches WHERE tenant_id = $1`, [targetTenantId]);
    await this.pg.query(`DELETE FROM tenant_counters WHERE tenant_id = $1`, [targetTenantId]);

    const insertTableRows = async (tableName, rows) => {
      if (!Array.isArray(rows) || rows.length === 0) return 0;
      let inserted = 0;
      for (const item of rows) {
        const copy = { ...item };
        if ('tenant_id' in copy) {
          copy.tenant_id = targetTenantId;
        }
        if (tableName === 'users') {
          if (!copy.first_name) copy.first_name = copy.display_name?.split(' ')[0] || 'کاربر';
          if (!copy.last_name) copy.last_name = copy.display_name?.split(' ').slice(1).join(' ') || 'سامانه';
        }
        const cols = Object.keys(copy);
        const vals = Object.values(copy);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        try {
          await this.pg.query(
            `INSERT INTO ${tableName} (${cols.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            vals
          );
          inserted++;
        } catch (e) {
          console.warn(`[Import Backup] Skipped row in ${tableName}:`, e.message);
        }
      }
      return inserted;
    };

    const stats = {
      branches: await insertTableRows('branches', backupData.branches),
      users: await insertTableRows('users', backupData.users),
      properties: await insertTableRows('properties', backupData.properties),
      owners: await insertTableRows('owners', backupData.owners),
      property_owners: await insertTableRows('property_owners', backupData.property_owners),
      property_media: await insertTableRows('property_media', backupData.property_media),
      customers: await insertTableRows('customers', backupData.customers),
      customer_requirements: await insertTableRows('customer_requirements', backupData.customer_requirements),
      tasks: await insertTableRows('tasks', backupData.tasks),
      interactions: await insertTableRows('interactions', backupData.interactions),
      customer_property_interactions: await insertTableRows('customer_property_interactions', backupData.customer_property_interactions),
      documents: await insertTableRows('documents', backupData.documents),
      transactions: await insertTableRows('transactions', backupData.transactions),
      tenant_counters: await insertTableRows('tenant_counters', backupData.tenant_counters)
    };

    const userCount = await this.pg.query(`SELECT COUNT(*)::int as count FROM users WHERE tenant_id = $1`, [targetTenantId]);
    if (userCount.rows[0].count === 0) {
      const branchId = crypto.randomUUID();
      await this.pg.query(`
        INSERT INTO branches (id, tenant_id, name, branch_code, is_main, status)
        VALUES ($1, $2, 'شعبه مرکزی', 'MAIN', true, 'ACTIVE')
      `, [branchId, targetTenantId]);

      const adminId = crypto.randomUUID();
      const bcrypt = (await import("bcryptjs")).default;
      const passHash = bcrypt.hashSync("123456", 10);
      await this.pg.query(`
        INSERT INTO users (id, tenant_id, branch_id, username, password_hash, first_name, last_name, display_name, role_code, is_active)
        VALUES ($1, $2, $3, 'admin', $4, 'مدیر', 'آژانس', 'مدیر آژانس', 'ADMIN', true)
      `, [adminId, targetTenantId, branchId, passHash]);
    }

    const allTenants = await this.getAllTenantsWithStats();
    const restoredTenant = allTenants.find(t => t.id === targetTenantId);

    return {
      restored_tenant: restoredTenant,
      stats
    };
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
    const credentials = getPlatformCredentials();
    if (!credentials) return;
    const { username, password } = credentials;
    const existing = await this.pg.query(`SELECT id, password_hash FROM platform_admins WHERE username = $1 LIMIT 1`, [username]);
    if (existing.rows.length) {
      const admin = existing.rows[0];
      if (!bcrypt.compareSync(password, admin.password_hash)) {
        const passwordHash = bcrypt.hashSync(password, 12);
        await this.pg.transaction(async tx => {
          await tx.query(`UPDATE platform_admins SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [passwordHash, admin.id]);
          await tx.query(`DELETE FROM platform_sessions WHERE admin_id = $1`, [admin.id]);
        });
      }
      return;
    }
    await this.pg.query(
      `INSERT INTO platform_admins (id, username, password_hash, display_name, email, phone, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [crypto.randomUUID(), username, bcrypt.hashSync(password, 12), process.env.PLATFORM_ADMIN_NAME || "مدیر پلتفرم",
       process.env.PLATFORM_ADMIN_EMAIL || null, process.env.PLATFORM_ADMIN_PHONE || null]
    );
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
}const postgresDb=new PostgresDatabase;export{normalizeIranianPhone as normalizePhoneNumber,postgresDb};
