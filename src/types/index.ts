export type UserRole = "ADMIN" | "OWNER" | "BRANCH_MANAGER" | "AGENT";
export type PropertyType = "APARTMENT" | "VILLA" | "OFFICE" | "COMMERCIAL" | "LAND" | "PENTHOUSE" | "OTHER";
export type ListingType = "SALE" | "RENT" | "PRE_SALE" | "EXCHANGE";
export type PropertyStatus = "ACTIVE" | "RESERVED" | "TRANSACTED" | "ARCHIVED";
export type Visibility = "AGENCY" | "BRANCH" | "PRIVATE";
export type CustomerType = "BUYER" | "TENANT" | "SELLER" | "LANDLORD" | "INVESTOR";
export type LeadStatus = "NEW" | "CONTACTED" | "REQUIREMENTS_MET" | "VISIT_SCHEDULED" | "NEGOTIATING" | "WON" | "LOST" | "INACTIVE";
export type LeadTemperature = "HOT" | "WARM" | "COLD";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskType = "FOLLOW_UP" | "CALL" | "VISIT" | "MEETING" | "NEGOTIATION" | "PAYMENT_REMINDER" | "OTHER";
export type TaskStatus = "PENDING" | "COMPLETED" | "CANCELLED";
export type DocumentType = "DEED" | "CONTRACT" | "IDENTITY" | "FINANCIAL" | "PERMIT" | "POWER_OF_ATTORNEY" | "OTHER";
export type TransactionType = "SALE" | "RENT" | "PRE_SALE" | "EXCHANGE";
export type TransactionStatus = "COMPLETED" | "CANCELLED";

export interface User {
  id: string;
  tenant_id: string;
  branch_id?: string | null;
  username: string;
  first_name: string;
  last_name: string;
  display_name: string;
  phone?: string | null;
  email?: string | null;
  role_code: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Tenant {
  id: string;
  agency_code: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  subscription_plan?: string | null;
  subscription_status?: string | null;
  subscription_expires_at?: string | null;
  created_at?: string;
}

export interface PropertyMedia {
  id: string;
  property_id: string;
  file_path: string;
  media_type: string;
  is_cover: boolean;
  display_order: number;
}

export interface PropertyOwner {
  id: string;
  owner_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  ownership_percentage?: number;
  is_primary_owner?: boolean;
}

export interface Property {
  id: string;
  tenant_id: string;
  branch_id?: string | null;
  code: string;
  title: string;
  property_type: PropertyType;
  listing_type: ListingType;
  status: PropertyStatus;
  price_total?: number | null;
  price_per_meter?: number | null;
  rent_amount?: number | null;
  deposit_amount?: number | null;
  area_sqm: number;
  bedrooms?: number | null;
  floor?: number | null;
  year_built?: number | null;
  has_parking: boolean;
  has_storage: boolean;
  has_elevator: boolean;
  has_balcony: boolean;
  description?: string | null;
  province: string;
  city: string;
  neighborhood?: string | null;
  street?: string | null;
  visibility?: Visibility;
  assigned_agent_id?: string | null;
  assigned_agent_name?: string | null;
  created_by_user_id?: string;
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
  media?: PropertyMedia[];
  owners?: PropertyOwner[];
}

export interface CustomerRequirement {
  id: string;
  customer_id: string;
  property_type: PropertyType;
  listing_type?: ListingType;
  min_budget?: number;
  max_budget?: number;
  min_area?: number;
  max_area?: number;
  min_bedrooms?: number;
  max_bedrooms?: number;
  preferred_city?: string;
  preferred_neighborhoods?: string[];
  needs_parking?: boolean;
  needs_elevator?: boolean;
  needs_storage?: boolean;
  needs_balcony?: boolean;
  priority?: TaskPriority;
  notes?: string;
}

export interface CustomerInteraction {
  id: string;
  customer_id: string;
  property_id?: string | null;
  property_title?: string | null;
  interaction_type: string;
  title: string;
  description?: string | null;
  occurred_at: string;
  created_by_user_id?: string;
  agent_name?: string | null;
}

export interface Customer {
  id: string;
  tenant_id: string;
  branch_id?: string | null;
  code: string;
  first_name: string;
  last_name: string;
  display_name: string;
  phone: string;
  secondary_phone?: string | null;
  email?: string | null;
  customer_type: CustomerType;
  lead_status: LeadStatus;
  lead_source?: string | null;
  temperature: LeadTemperature;
  budget_min?: number | null;
  budget_max?: number | null;
  preferred_city?: string | null;
  preferred_area_text?: string | null;
  notes?: string | null;
  next_follow_up_at?: string | null;
  assigned_agent_id?: string | null;
  assigned_agent_name?: string | null;
  is_archived?: boolean;
  created_at: string;
  requirements?: CustomerRequirement[];
  interactions?: CustomerInteraction[];
}

export interface Task {
  id: string;
  tenant_id: string;
  branch_id?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  property_id?: string | null;
  property_title?: string | null;
  property_code?: string | null;
  title: string;
  description?: string | null;
  due_at: string;
  end_at?: string | null;
  priority: TaskPriority;
  type: TaskType;
  status: TaskStatus;
  assigned_to_user_id?: string | null;
  assigned_agent_name?: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  tenant_id: string;
  branch_id?: string | null;
  branch_name?: string | null;
  property_id: string;
  property_title?: string | null;
  property_code?: string | null;
  customer_id?: string | null;
  customer_name: string;
  customer_phone?: string | null;
  owner_id?: string | null;
  owner_name?: string | null;
  owner_phone?: string | null;
  transaction_type: TransactionType;
  final_price?: number | null;
  deposit_amount?: number | null;
  rent_amount?: number | null;
  contract_date: string;
  agent_id?: string | null;
  agent_name?: string | null;
  notes?: string | null;
  status: TransactionStatus;
  created_at: string;
}

export interface Branch {
  id: string;
  tenant_id: string;
  name: string;
  branch_code: string;
  phone?: string | null;
  address?: string | null;
  is_main: boolean;
  status: "ACTIVE" | "INACTIVE";
  manager_user_id?: string | null;
  manager_name?: string | null;
  created_at?: string;
}

export interface AppDocument {
  id: string;
  tenant_id: string;
  branch_id?: string | null;
  property_id?: string | null;
  customer_id?: string | null;
  document_type: DocumentType;
  display_name: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  file_path: string;
  created_at: string;
}

export interface PerformanceReport {
  total_transactions: number;
  total_sales_volume: number;
  total_rent_volume: number;
  total_deposit_volume: number;
  active_properties_count: number;
  active_customers_count: number;
  agent_stats?: Array<{
    agent_id: string;
    agent_name: string;
    deals_count: number;
    sales_volume: number;
    rent_volume: number;
  }>;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  meta?: any;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}
