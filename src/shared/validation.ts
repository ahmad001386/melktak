import { z } from "zod";
import { normalizeIranianPhone } from "./normalization.js";

export const LoginSchema = z.object({
  agency_code: z.string().trim().default("DEMO01"),
  username: z.string().trim().min(2, "نام کاربری باید حداقل ۲ کاراکتر باشد"),
  password: z.string().min(1, "رمز عبور الزامی است")
});

export const CreateBranchSchema = z.object({
  name: z.string().trim().min(2, "نام شعبه باید حداقل ۲ کاراکتر باشد"),
  branch_code: z.string().trim().min(2, "کد شعبه باید حداقل ۲ کاراکتر باشد").regex(/^[a-zA-Z0-9_.-]+$/, "کد شعبه فقط می‌تواند شامل حروف انگلیسی، اعداد و خط تیره باشد"),
  phone: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  manager_user_id: z.string().uuid("شناسه مدیر نامعتبر است").optional().nullable().or(z.literal("")),
  is_main: z.boolean().default(false),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE")
});

export const UpdateBranchSchema = CreateBranchSchema.partial();

export const CreateAgentSchema = z.object({
  first_name: z.string().trim().min(2, "نام باید حداقل ۲ کاراکتر باشد"),
  last_name: z.string().trim().min(2, "نام خانوادگی باید حداقل ۲ کاراکتر باشد"),
  username: z.string().trim().min(3, "نام کاربری باید حداقل ۳ کاراکتر باشد").regex(/^[a-zA-Z0-9_.-]+$/, "نام کاربری فقط می‌تواند شامل حروف انگلیسی، اعداد و خط تیره باشد"),
  phone: z.string().trim().refine(val => normalizeIranianPhone(val).length === 11, { message: "شماره تلفن همراه معتبر ۱۱ رقمی وارد نمایید" }),
  password: z.string().min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد"),
  role_code: z.enum(["AGENT", "BRANCH_MANAGER", "ADMIN"]).default("AGENT"),
  branch_id: z.string().uuid("شناسه شعبه نامعتبر است").optional().nullable().or(z.literal("")),
  email: z.string().email("ایمیل معتبر نیست").optional().or(z.literal(""))
});

export const UpdateAgentSchema = CreateAgentSchema.partial();
export const UpdateAgentStatusSchema = z.object({ is_active: z.boolean() });
export const ResetPasswordSchema = z.object({ password: z.string().min(6, "رمز عبور جدید باید حداقل ۶ کاراکتر باشد") });
export const TransferAssetsSchema = z.object({
  target_agent_id: z.string().uuid("شناسه مشاور مقصد نامعتبر است"),
  transfer_properties: z.boolean().default(true),
  transfer_customers: z.boolean().default(true),
  transfer_tasks: z.boolean().default(true)
});

export const AssignRecordSchema = z.object({
  assigned_to_user_id: z.string().uuid("شناسه مشاور نامعتبر است")
});

export const QuickAddPropertySchema = z.object({
  title: z.string().trim().min(3, "عنوان ملک الزامی است"),
  property_type: z.enum(["APARTMENT", "VILLA", "OFFICE", "COMMERCIAL", "LAND", "PENTHOUSE", "OTHER"]),
  listing_type: z.enum(["SALE", "RENT", "PRE_SALE", "EXCHANGE"]),
  area_sqm: z.coerce.number().positive("متراژ باید بزرگتر از صفر باشد"),
  price_total: z.coerce.number().nonnegative().optional(),
  rent_amount: z.coerce.number().nonnegative().optional(),
  deposit_amount: z.coerce.number().nonnegative().optional(),
  province: z.string().default("تهران"),
  city: z.string().default("تهران"),
  district: z.string().optional(),
  neighborhood: z.string().min(1, "محله ملک الزامی است"),
  bedrooms: z.coerce.number().int().min(0).max(20).optional(),
  floor: z.coerce.number().int().optional(),
  has_parking: z.boolean().default(false),
  has_storage: z.boolean().default(false),
  has_elevator: z.boolean().default(false),
  has_balcony: z.boolean().default(false),
  description: z.string().optional(),
  visibility: z.enum(["AGENCY", "BRANCH", "PRIVATE"]).default("AGENCY"),
  branch_id: z.string().uuid("شناسه شعبه نامعتبر است").optional().nullable().or(z.literal("")),
  assigned_agent_id: z.string().uuid().optional(),
  owner_name: z.string().optional(),
  owner_phone: z.string().optional()
});

export const PropertyStatusSchema = z.enum([
  "ACTIVE", "AVAILABLE", "NEGOTIATION", "UNDER_NEGOTIATION", "RESERVED",
  "DEAL", "TRANSACTED", "SOLD", "RENTED", "ARCHIVED"
]);

export const UpdatePropertySchema = QuickAddPropertySchema.partial().extend({
  status: PropertyStatusSchema.optional(),
  assigned_to_user_id: z.string().uuid().optional()
});

export const QuickAddCustomerSchema = z.object({
  first_name: z.string().trim().min(2, "نام الزامی است"),
  last_name: z.string().trim().min(2, "نام خانوادگی الزامی است"),
  phone: z.string().trim().refine(val => normalizeIranianPhone(val).length === 11, { message: "شماره تلفن همراه معتبر ۱۱ رقمی وارد نمایید" }),
  secondary_phone: z.string().optional(),
  email: z.string().email("ایمیل معتبر نیست").optional().or(z.literal("")),
  visibility: z.enum(["AGENCY", "BRANCH", "PRIVATE"]).default("AGENCY"),
  branch_id: z.string().uuid("شناسه شعبه نامعتبر است").optional().nullable().or(z.literal("")),
  customer_type: z.enum(["BUYER", "TENANT", "SELLER", "LANDLORD", "INVESTOR"]).default("BUYER"),
  lead_status: z.enum(["NEW", "CONTACTED", "REQUIREMENTS_MET", "VISIT_SCHEDULED", "NEGOTIATING", "WON", "LOST", "INACTIVE"]).default("NEW"),
  lead_source: z.string().default("IN_PERSON"),
  temperature: z.enum(["HOT", "WARM", "COLD"]).default("WARM"),
  budget_min: z.coerce.number().nonnegative().optional(),
  budget_max: z.coerce.number().nonnegative().optional(),
  preferred_city: z.string().optional(),
  preferred_area_text: z.string().optional(),
  notes: z.string().optional(),
  next_follow_up_at: z.string().optional(),
  assigned_agent_id: z.string().uuid().optional()
});

export const UpdateCustomerSchema = QuickAddCustomerSchema.partial().extend({
  is_archived: z.boolean().optional(),
  assigned_to_user_id: z.string().uuid().optional()
});

export const QuickAddTaskSchema = z.object({
  customer_id: z.string().uuid().optional(),
  property_id: z.string().min(1).optional(),
  title: z.string().trim().min(2, "عنوان پیگیری الزامی است"),
  description: z.string().optional(),
  due_at: z.string().min(1, "موعد پیگیری الزامی است"),
  end_at: z.string().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  type: z.enum(["FOLLOW_UP", "CALL", "VISIT", "MEETING", "NEGOTIATION", "PAYMENT_REMINDER", "OTHER"]).default("FOLLOW_UP"),
  visit_result: z.enum(["INTERESTED", "NOT_INTERESTED", "NEED_FOLLOW_UP", "NEGOTIATION_STARTED"]).optional().nullable(),
  assigned_to_user_id: z.string().uuid().optional().nullable(),
  branch_id: z.string().uuid().optional().nullable().or(z.literal(""))
});

export const CreateOwnerSchema = z.object({
  first_name: z.string().trim().min(2, "نام مالک الزامی است"),
  last_name: z.string().trim().min(2, "نام خانوادگی الزامی است"),
  phone: z.string().trim().refine(val => normalizeIranianPhone(val).length === 11, { message: "شماره تلفن همراه معتبر ۱۱ رقمی وارد نمایید" }),
  secondary_phone: z.string().optional(),
  email: z.string().email("ایمیل معتبر نیست").optional().or(z.literal("")),
  national_id: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional()
});

export const LinkPropertyOwnerSchema = z.object({
  owner_id: z.string().uuid("شناسه مالک نامعتبر است"),
  ownership_percentage: z.coerce.number().min(1).max(100).default(100),
  is_primary_owner: z.boolean().default(true),
  notes: z.string().optional()
});

export const CreateCustomerRequirementSchema = z.object({
  property_type: z.enum(["APARTMENT", "VILLA", "OFFICE", "COMMERCIAL", "LAND", "PENTHOUSE", "OTHER"]),
  listing_type: z.enum(["SALE", "RENT", "PRE_SALE", "EXCHANGE"]).optional(),
  min_budget: z.coerce.number().nonnegative().optional(),
  max_budget: z.coerce.number().nonnegative().optional(),
  min_area: z.coerce.number().positive().optional(),
  max_area: z.coerce.number().positive().optional(),
  min_bedrooms: z.coerce.number().int().min(0).optional(),
  max_bedrooms: z.coerce.number().int().min(0).optional(),
  preferred_city: z.string().optional(),
  preferred_neighborhoods: z.array(z.string()).optional(),
  needs_parking: z.boolean().optional(),
  needs_elevator: z.boolean().optional(),
  needs_storage: z.boolean().optional(),
  needs_balcony: z.boolean().optional(),
  required_features: z.array(z.string()).optional(),
  preferred_features: z.array(z.string()).optional(),
  excluded_features: z.array(z.string()).optional(),
  must_have: z.string().optional(),
  deal_breakers: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  notes: z.string().optional()
});

export const UpdateCustomerRequirementSchema = CreateCustomerRequirementSchema.partial().extend({
  is_active: z.boolean().optional()
});

export const CustomerPropertyReactionSchema = z.object({
  reaction: z.enum(["INTERESTED", "NOT_INTERESTED", "OFFER", "NEUTRAL"]),
  reaction_reason: z.string().optional(),
  reaction_notes: z.string().optional(),
  status: z.enum(["SENT", "VIEWED", "VISITED", "ARCHIVED"]).optional()
});

export const MergeCustomerSchema = z.object({
  source_customer_id: z.string().uuid("شناسه مشتری مبدأ نامعتبر است"),
  target_customer_id: z.string().uuid("شناسه مشتری مقصد نامعتبر است"),
  reason: z.string().optional()
});

export const CreateInteractionSchema = z.object({
  property_id: z.string().min(1).optional(),
  interaction_type: z.enum(["CALL", "MESSAGE", "PROPERTY_SENT", "PROPERTY_REACTION", "PROPERTY_LIKED", "PROPERTY_REJECTED", "VISIT", "NOTE", "FOLLOW_UP", "MEETING", "STATUS_CHANGED", "TEMPERATURE_CHANGED", "REQUIREMENT_CREATED", "REQUIREMENT_UPDATED", "MERGED", "OTHER"]),
  title: z.string().trim().min(2, "عنوان تعامل یا رویداد الزامی است"),
  description: z.string().optional(),
  occurred_at: z.string().optional()
});

export const UploadDocumentSchema = z.object({
  document_type: z.enum(["DEED", "CONTRACT", "IDENTITY", "FINANCIAL", "PERMIT", "POWER_OF_ATTORNEY", "OTHER"]).default("OTHER"),
  display_name: z.string().trim().optional(),
  description: z.string().optional(),
  property_id: z.string().optional().nullable(),
  customer_id: z.string().optional().nullable(),
  branch_id: z.string().uuid().optional().nullable().or(z.literal(""))
});

export const UpdateDocumentSchema = z.object({
  document_type: z.enum(["DEED", "CONTRACT", "IDENTITY", "FINANCIAL", "PERMIT", "POWER_OF_ATTORNEY", "OTHER"]).optional(),
  display_name: z.string().trim().min(1, "نام نمایشی سند معتبر نیست").optional(),
  description: z.string().optional().nullable(),
  property_id: z.string().optional().nullable(),
  customer_id: z.string().optional().nullable(),
  branch_id: z.string().uuid().optional().nullable().or(z.literal(""))
});

export const UpdateProfileSchema = z.object({
  display_name: z.string().trim().min(2, "نام نمایشی الزامی است").optional(),
  phone: z.string().optional()
});

export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1, "رمز عبور فعلی الزامی است"),
  new_password: z.string().min(6, "رمز عبور جدید باید حداقل ۶ کاراکتر باشد"),
  confirm_password: z.string().min(1, "تکرار رمز عبور جدید الزامی است")
}).refine(data => data.new_password === data.confirm_password, {
  message: "رمز عبور جدید و تکرار آن مطابقت ندارند",
  path: ["confirm_password"]
});

export const UpdateTenantSettingsSchema = z.object({
  name: z.string().trim().min(2, "نام آژانس الزامی است").optional(),
  phone: z.string().optional(),
  address: z.string().optional()
});

export const CreateTransactionSchema = z.object({
  property_id: z.string().min(1, "شناسه ملک الزامی است"),
  transaction_type: z.enum(["SALE", "RENT", "PRE_SALE", "EXCHANGE"]).default("SALE"),
  customer_id: z.string().optional().nullable().or(z.literal("")),
  customer_name: z.string().trim().min(2, "نام طرف دوم معامله (خریدار یا مستأجر) الزامی است"),
  customer_phone: z.string().optional().nullable().or(z.literal("")),
  owner_id: z.string().uuid().optional().nullable().or(z.literal("")),
  owner_name: z.string().optional().nullable().or(z.literal("")),
  owner_phone: z.string().optional().nullable().or(z.literal("")),
  final_price: z.coerce.number().nonnegative().optional().nullable(),
  deposit_amount: z.coerce.number().nonnegative().optional().nullable(),
  rent_amount: z.coerce.number().nonnegative().optional().nullable(),
  contract_date: z.string().datetime({ offset: true, message: "تاریخ معامله معتبر نیست" }),
  agent_id: z.string().uuid().optional().nullable().or(z.literal("")),
  branch_id: z.string().uuid().optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable().or(z.literal("")),
  status: z.enum(["COMPLETED", "CANCELLED"]).default("COMPLETED")
}).refine(data => {
  if (data.transaction_type === "RENT") {
    return (data.deposit_amount !== undefined && data.deposit_amount !== null && data.deposit_amount >= 0) ||
           (data.rent_amount !== undefined && data.rent_amount !== null && data.rent_amount >= 0);
  }
  return data.final_price !== undefined && data.final_price !== null && data.final_price > 0;
}, {
  message: "مبلغ نهایی معامله (یا ودیعه/اجاره برای رهن و اجاره) باید مشخص شود.",
  path: ["final_price"]
});

export const UpdateTransactionSchema = z.object({
  property_id: z.string().uuid().optional(),
  transaction_type: z.enum(["SALE", "RENT", "PRE_SALE", "EXCHANGE"]).optional(),
  customer_id: z.string().optional().nullable().or(z.literal("")),
  customer_name: z.string().trim().min(2).optional(),
  customer_phone: z.string().optional().nullable(),
  owner_id: z.string().uuid().optional().nullable().or(z.literal("")),
  owner_name: z.string().optional().nullable(),
  owner_phone: z.string().optional().nullable(),
  final_price: z.coerce.number().nonnegative().optional().nullable(),
  deposit_amount: z.coerce.number().nonnegative().optional().nullable(),
  rent_amount: z.coerce.number().nonnegative().optional().nullable(),
  contract_date: z.string().optional(),
  agent_id: z.string().uuid().optional().nullable().or(z.literal("")),
  branch_id: z.string().uuid().optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable(),
  status: z.enum(["COMPLETED", "CANCELLED"]).optional()
});
