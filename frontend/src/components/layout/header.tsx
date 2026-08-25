import { useLocation } from "react-router-dom";
import { Menu, Bell, ChevronRight, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useLanguage } from "@/hooks/use-language";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();

  const pageTitles: Record<string, { title: string; breadcrumbs: string[] }> = {
    "/": { title: t("bcDashboard"), breadcrumbs: [t("bcDashboard")] },
    "/devices": { title: t("bcDevices"), breadcrumbs: [t("bcDashboard"), t("bcDevices")] },
    "/applications": { title: t("bcApplications"), breadcrumbs: [t("bcDashboard"), t("bcApplications")] },
    "/policies": { title: t("bcPolicies"), breadcrumbs: [t("bcDashboard"), t("bcPolicies")] },
    "/policies/new": { title: t("bcNewPolicy"), breadcrumbs: [t("bcDashboard"), t("bcPolicies"), t("bcNewPolicy")] },
    "/enrollment": { title: t("bcEnrollment"), breadcrumbs: [t("bcDashboard"), t("bcEnrollment")] },
    "/groups": { title: t("bcGroups"), breadcrumbs: [t("bcDashboard"), t("bcGroups")] },
    "/settings": { title: t("bcSettings"), breadcrumbs: [t("bcDashboard"), t("bcSettings")] },
    "/settings/general": { title: t("bcGeneral"), breadcrumbs: [t("bcDashboard"), t("bcSettings"), t("bcGeneral")] },
    "/settings/tenant": { title: t("bcTenant"), breadcrumbs: [t("bcDashboard"), t("bcSettings"), t("bcTenant")] },
  };

  let pageInfo = pageTitles[location.pathname];
  if (!pageInfo) {
    if (/^\/policies\/[^/]+$/.test(location.pathname) && location.pathname !== "/policies/new") {
      pageInfo = { title: t("bcEditPolicy"), breadcrumbs: [t("bcDashboard"), t("bcPolicies"), t("bcEditPolicy")] };
    } else {
      pageInfo = { title: t("page"), breadcrumbs: [t("bcDashboard")] };
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 sm:px-6">
      <div className="flex items-center gap-4">
        {/* Hamburger menu (mobile) */}
        <button
          type="button"
          onClick={onMenuClick}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {pageInfo.title}
          </h1>
          {/* Breadcrumbs */}
          <nav className="hidden sm:flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            {pageInfo.breadcrumbs.map((crumb, i) => (
              <span key={crumb} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                <span
                  className={
                    i === pageInfo.breadcrumbs.length - 1
                      ? "text-gray-600 dark:text-gray-300"
                      : ""
                  }
                >
                  {crumb}
                </span>
              </span>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="relative flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title={theme === "dark" ? t("themeLightTooltip") : t("themeDarkTooltip")}
        >
          {theme === "dark" ? (
            <>
              <Sun className="h-4 w-4 text-amber-400" />
              <span className="hidden sm:inline text-xs">{t("themeLight")}</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-slate-500" />
              <span className="hidden sm:inline text-xs">{t("themeDark")}</span>
            </>
          )}
        </button>

        {/* Notifiche */}
        <button
          type="button"
          className="relative rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>
      </div>
    </header>
  );
}
