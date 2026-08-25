import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Smartphone,
  Shield,
  QrCode,
  FolderTree,
  Package,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { SOURCE_REPOSITORY_URL } from "@/lib/project";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { t } = useLanguage();

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: t("navDashboard"), end: true },
    { to: "/devices", icon: Smartphone, label: t("navDevices") },
    { to: "/applications", icon: Package, label: t("navApplications") },
    { to: "/policies", icon: Shield, label: t("navPolicies") },
    { to: "/enrollment", icon: QrCode, label: t("navEnrollment") },
    { to: "/groups", icon: FolderTree, label: t("navGroups") },
    { to: "/settings", icon: Settings, label: t("navSettings") },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-[260px] flex flex-col transition-transform duration-300 lg:translate-x-0",
          "bg-white border-r border-gray-200 dark:bg-sidebar dark:border-slate-800",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Close button (mobile) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:text-sidebar-text dark:hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Logo section */}
        <div className="flex flex-col items-center px-6 pt-6 pb-4 border-b border-gray-200 dark:border-slate-800">
          <img
            src="/unitseek-mdm-logo-v2.png"
            alt="Unitseek MDM"
            className="h-14 w-auto object-contain"
          />
          <span className="mt-2 text-xs font-semibold tracking-widest uppercase text-gray-500 dark:text-sidebar-text">
            Unitseek MDM
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto sidebar-scrollbar px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = item.end
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary-600 text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-sidebar-text dark:hover:bg-sidebar-hover dark:hover:text-white"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {item.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-4 pb-3 text-center">
          <a
            href={SOURCE_REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-gray-400 hover:text-primary-600 dark:text-sidebar-muted dark:hover:text-primary-400"
          >
            Open source · AGPL-3.0
          </a>
        </div>

        {/* User section */}
        <div className="border-t border-gray-200 dark:border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-white text-sm font-medium flex-shrink-0">
              {user ? getInitials(user.full_name) : "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.full_name || "User"}
              </p>
              <p className="text-xs text-gray-500 dark:text-sidebar-muted truncate">
                {user?.email || ""}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="text-gray-400 hover:text-gray-700 dark:text-sidebar-muted dark:hover:text-white transition-colors flex-shrink-0"
              title={t("navLogout")}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
