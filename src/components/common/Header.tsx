import React from "react";
import { useAuth } from "../../context/AuthContext.js";
import { roleLabels } from "../../utils/formatters.js";
import { Building2, User, LogOut, CheckSquare } from "lucide-react";

interface HeaderProps {
  todayTasksCount?: number;
  onOpenTasks?: () => void;
  onOpenProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  todayTasksCount = 0,
  onOpenTasks,
  onOpenProfile
}) => {
  const { user, tenant, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Brand / Agency Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#145DB5] flex items-center justify-center text-white shadow-sm shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold text-slate-900 truncate">
                {tenant?.name || "سامانه مدیریت املاک"}
              </h1>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-[#145DB5] border border-blue-100 shrink-0">
                {tenant?.agency_code || "DEMO01"}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 truncate">
              سیستم هوشمند معاملات و فایلینگ
            </p>
          </div>
        </div>

        {/* User Info & Quick Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Today Tasks Quick Button */}
          {todayTasksCount > 0 && onOpenTasks && (
            <button
              onClick={onOpenTasks}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold transition"
              title="پیگیری‌های موعد امروز"
            >
              <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
              <span>{todayTasksCount} پیگیری امروز</span>
            </button>
          )}

          {/* User Profile Pill */}
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200 transition text-right"
            title="پروفایل و تنظیمات کاربر"
          >
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="hidden sm:block text-right">
              <div className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[120px]">
                {user?.display_name || user?.first_name || "کاربر"}
              </div>
              <div className="text-[9px] text-slate-500 font-medium">
                {user ? roleLabels[user.role_code] : ""}
              </div>
            </div>
          </button>

          {/* Logout */}
          <button
            onClick={() => {
              if (window.confirm("آیا قصد خروج از حساب کاربری خود را دارید؟")) {
                logout();
              }
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
            title="خروج از حساب"
            aria-label="خروج از حساب"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
