import React from "react";
import { Home, Users, CheckSquare, Search, Menu } from "lucide-react";

export type NavTab = "properties" | "customers" | "tasks" | "search" | "more";

interface BottomNavProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  pendingTasksCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  pendingTasksCount = 0
}) => {
  const tabs = [
    { id: "properties" as NavTab, label: "املاک", icon: Home },
    { id: "customers" as NavTab, label: "مشتریان", icon: Users },
    {
      id: "tasks" as NavTab,
      label: "پیگیری‌ها",
      icon: CheckSquare,
      badge: pendingTasksCount > 0 ? pendingTasksCount : undefined
    },
    { id: "search" as NavTab, label: "جستجو", icon: Search },
    { id: "more" as NavTab, label: "بیشتر", icon: Menu }
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg md:hidden">
      <div className="max-w-md mx-auto grid grid-cols-5 h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 transition relative ${
                isActive ? "text-[#145DB5]" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? "scale-110 stroke-[2.2]" : "stroke-[1.8]"
                  }`}
                />
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-bold px-1 py-0.2 rounded-full min-w-4 text-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] leading-none ${
                  isActive ? "font-bold text-[#145DB5]" : "font-medium"
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute bottom-0 w-8 h-0.5 bg-[#145DB5] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
