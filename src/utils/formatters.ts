// @ts-nocheck
import jalaaliPkg from "jalaali-js";
const jalaali = (jalaaliPkg as any)?.default || jalaaliPkg;
import {
  PropertyType,
  ListingType,
  PropertyStatus,
  CustomerType,
  LeadStatus,
  LeadTemperature,
  TaskPriority,
  TaskType,
  DocumentType,
  UserRole
} from "../types/index.js";

export function toPersianDigits(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "";
  const str = String(n);
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return str.replace(/\d/g, (x) => persianDigits[parseInt(x, 10)]);
}

export function formatPrice(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "توافقی";
  if (amount === 0) return "۰ تومان";

  if (amount >= 1_000_000_000) {
    const billions = amount / 1_000_000_000;
    const formatted = billions % 1 === 0 ? billions.toFixed(0) : billions.toFixed(1);
    return `${toPersianDigits(formatted)} میلیارد تومان`;
  }
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const formatted = millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(0);
    return `${toPersianDigits(formatted)} میلیون تومان`;
  }
  return `${toPersianDigits(amount.toLocaleString("fa-IR"))} تومان`;
}

export function formatPriceDetailed(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "توافقی";
  return `${toPersianDigits(Number(amount).toLocaleString("fa-IR"))} تومان`;
}

export function formatPersianDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const monthNames = [
      "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
      "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
    ];
    return `${toPersianDigits(j.jd)} ${monthNames[j.jm - 1]} ${toPersianDigits(j.jy)}`;
  } catch {
    return dateStr;
  }
}

export function formatRelativePersian(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (Math.abs(diffHours) < 1) return "هم‌اکنون";
    if (diffHours > 0 && diffHours < 24) return `${toPersianDigits(diffHours)} ساعت دیگر`;
    if (diffHours < 0 && diffHours > -24) return `${toPersianDigits(Math.abs(diffHours))} ساعت پیش`;
    if (diffDays === 1) return "فردا";
    if (diffDays === -1) return "دیروز";
    if (diffDays > 0) return `${toPersianDigits(diffDays)} روز دیگر`;
    return `${toPersianDigits(Math.abs(diffDays))} روز پیش`;
  } catch {
    return formatPersianDate(dateStr);
  }
}

export const propertyTypeLabels: Record<PropertyType, string> = {
  APARTMENT: "آپارتمان",
  VILLA: "ویلایی / خانه",
  OFFICE: "موقعیت اداری",
  COMMERCIAL: "تجاری / مغازه",
  LAND: "زمین / کلنگی",
  PENTHOUSE: "پنت‌هاوس",
  OTHER: "سایر ملک‌ها"
};

export const listingTypeLabels: Record<ListingType, string> = {
  SALE: "فروش",
  RENT: "رهن و اجاره",
  PRE_SALE: "پیش‌فروش",
  EXCHANGE: "معاوضه"
};

export const propertyStatusLabels: Record<PropertyStatus, { label: string; badgeClass: string }> = {
  ACTIVE: { label: "فعال", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  RESERVED: { label: "رزرو شده", badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
  TRANSACTED: { label: "معامله شده", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" },
  ARCHIVED: { label: "بایگانی", badgeClass: "bg-slate-100 text-slate-600 border-slate-200" }
};

export const customerTypeLabels: Record<CustomerType, string> = {
  BUYER: "خریدار",
  TENANT: "مستأجر",
  SELLER: "فروشنده",
  LANDLORD: "موجر / مالک",
  INVESTOR: "سرمایه‌گذار"
};

export const leadStatusLabels: Record<LeadStatus, { label: string; color: string }> = {
  NEW: { label: "مشتری جدید", color: "bg-sky-50 text-sky-700 border-sky-200" },
  CONTACTED: { label: "تماس اولیه", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  REQUIREMENTS_MET: { label: "تطبیق فایل", color: "bg-teal-50 text-teal-700 border-teal-200" },
  VISIT_SCHEDULED: { label: "هماهنگی بازدید", color: "bg-purple-50 text-purple-700 border-purple-200" },
  NEGOTIATING: { label: "در حال جلسه / نشست", color: "bg-amber-50 text-amber-700 border-amber-200" },
  WON: { label: "قرارداد موفق", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  LOST: { label: "انصراف / لغو", color: "bg-rose-50 text-rose-700 border-rose-200" },
  INACTIVE: { label: "غیرفعال", color: "bg-slate-100 text-slate-600 border-slate-200" }
};

export const temperatureLabels: Record<LeadTemperature, { label: string; badge: string; icon: string }> = {
  HOT: { label: "فوری و داغ", badge: "bg-rose-50 text-rose-700 border-rose-200", icon: "🔥" },
  WARM: { label: "گرم", badge: "bg-amber-50 text-amber-700 border-amber-200", icon: "☀️" },
  COLD: { label: "سرد", badge: "bg-slate-100 text-slate-700 border-slate-200", icon: "❄️" }
};

export const taskPriorityLabels: Record<TaskPriority, { label: string; color: string }> = {
  LOW: { label: "عادی", color: "bg-slate-100 text-slate-700 border-slate-200" },
  MEDIUM: { label: "متوسط", color: "bg-blue-50 text-blue-700 border-blue-200" },
  HIGH: { label: "مهم", color: "bg-amber-50 text-amber-700 border-amber-200" },
  URGENT: { label: "فوری", color: "bg-rose-50 text-rose-700 border-rose-200" }
};

export const taskTypeLabels: Record<TaskType, string> = {
  FOLLOW_UP: "پیگیری معمول",
  CALL: "تماس تلفنی",
  VISIT: "بازدید ملک",
  MEETING: "جلسه حضوری",
  NEGOTIATION: "نشست قرارداد",
  PAYMENT_REMINDER: "یادآوری پرداخت",
  OTHER: "سایر"
};

export const roleLabels: Record<UserRole, string> = {
  ADMIN: "مدیر ارشد آژانس",
  OWNER: "مالک آژانس",
  BRANCH_MANAGER: "مدیر شعبه",
  AGENT: "مشاور املاک"
};

export const documentTypeLabels: Record<DocumentType, string> = {
  DEED: "سند مالکیت / بنچاق",
  CONTRACT: "مبایعه‌نامه / اجاره‌نامه",
  IDENTITY: "مدارک شناسایی",
  FINANCIAL: "فیش و اسناد مالی",
  PERMIT: "پایان‌کار / پروانه",
  POWER_OF_ATTORNEY: "وکالت‌نامه",
  OTHER: "سایر مدارک"
};
