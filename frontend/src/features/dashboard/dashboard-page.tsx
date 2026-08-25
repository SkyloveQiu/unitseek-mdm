import { useQuery } from "@tanstack/react-query";
import {
  Smartphone,
  CheckCircle,
  ShieldCheck,
  AlertTriangle,
  Clock3,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { useLanguage } from "@/hooks/use-language";

interface ApiDashboardStats {
  total_devices: number;
  active_devices: number;
  compliant_devices: number;
  non_compliant_devices: number;
  policies_count: number;
  groups_count: number;
  recent_enrollments: number;
  recently_reporting_devices: number;
  testing_devices: number;
  production_devices: number;
  devices_with_application_problems: number;
  devices_by_state: Record<string, number>;
  devices_by_os: Record<string, number>;
}

const fallbackData: ApiDashboardStats = {
  total_devices: 0,
  active_devices: 0,
  compliant_devices: 0,
  non_compliant_devices: 0,
  policies_count: 0,
  groups_count: 0,
  recent_enrollments: 0,
  recently_reporting_devices: 0,
  testing_devices: 0,
  production_devices: 0,
  devices_with_application_problems: 0,
  devices_by_state: {},
  devices_by_os: {},
};

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-12 w-12 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { t } = useLanguage();

  const statCards: { key: keyof ApiDashboardStats; label: string; icon: typeof Smartphone; color: string; bgColor: string; darkBgColor: string }[] = [
    {
      key: "total_devices",
      label: t("dashTotalDevices"),
      icon: Smartphone,
      color: "text-primary-600",
      bgColor: "bg-primary-50",
      darkBgColor: "dark:bg-primary-900/30",
    },
    {
      key: "active_devices",
      label: t("dashActiveDevices"),
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      darkBgColor: "dark:bg-emerald-900/30",
    },
    {
      key: "recently_reporting_devices",
      label: t("dashRecentlyReporting"),
      icon: Clock3,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      darkBgColor: "dark:bg-blue-900/30",
    },
    {
      key: "compliant_devices",
      label: t("dashCompliant"),
      icon: ShieldCheck,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      darkBgColor: "dark:bg-emerald-900/30",
    },
    {
      key: "non_compliant_devices",
      label: t("dashNonCompliant"),
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      darkBgColor: "dark:bg-red-900/30",
    },
  ];

  const statusColors: Record<string, { bg: string; label: string }> = {
    active: { bg: "bg-emerald-500", label: t("dashStateActive") },
    disabled: { bg: "bg-amber-500", label: t("dashStateDisabled") },
    provisioning: { bg: "bg-primary-500", label: t("dashStateProvisioning") },
    deleted: { bg: "bg-red-500", label: t("dashStateDeleted") },
  };

  const { data, isLoading, isError } = useQuery<ApiDashboardStats>({
    queryKey: ["dashboard", "stats"],
    queryFn: () => apiGet<ApiDashboardStats>("/dashboard/stats"),
    retry: false,
  });

  const stats = data || fallbackData;
  const devicesByState = stats.devices_by_state || {};
  const totalStatusDevices = Object.values(devicesByState).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {isError && (
        <div className="flex items-center gap-3 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/30 px-4 py-3">
          <Info className="h-5 w-5 text-primary-500 flex-shrink-0" />
          <p className="text-sm text-primary-700 dark:text-primary-300">
            {t("backendNotConnected")} {t("backendDashboard")}
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading
          ? statCards.map((card) => <StatCardSkeleton key={card.key} />)
          : statCards.map((card) => (
              <Card key={card.key}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        {card.label}
                      </p>
                      <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">
                        {(stats[card.key as keyof ApiDashboardStats] as number) ?? 0}
                      </p>
                    </div>
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-lg ${card.bgColor} ${card.darkBgColor}`}
                    >
                      <card.icon className={`h-6 w-6 ${card.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Bottom section: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Summary info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashOverview")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{t("dashPolicies")}</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{stats.policies_count}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{t("dashGroups")}</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{stats.groups_count}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{t("dashRecentEnrollments")}</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{stats.recent_enrollments}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3">
                    <p className="text-xs text-blue-700 dark:text-blue-300">Testing</p>
                    <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{stats.testing_devices}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">Production</p>
                    <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{stats.production_devices}</p>
                  </div>
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3">
                    <p className="text-xs text-red-700 dark:text-red-300">App issues</p>
                    <p className="text-lg font-bold text-red-900 dark:text-red-100">{stats.devices_with_application_problems}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Device Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashDeviceStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full rounded-full" />
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Status bar */}
                <div className="h-4 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden flex">
                  {totalStatusDevices > 0 ? (
                    Object.entries(devicesByState).map(
                      ([key, value]) => {
                        const pct = (value / totalStatusDevices) * 100;
                        if (pct === 0) return null;
                        return (
                          <div
                            key={key}
                            className={`${statusColors[key]?.bg || "bg-gray-300"} transition-all`}
                            style={{ width: `${pct}%` }}
                            title={`${statusColors[key]?.label || key}: ${value}`}
                          />
                        );
                      }
                    )
                  ) : (
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full" />
                  )}
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(devicesByState).length > 0 ? (
                    Object.entries(devicesByState).map(
                      ([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <div
                            className={`h-3 w-3 rounded-full ${statusColors[key]?.bg || "bg-gray-300"}`}
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {statusColors[key]?.label || key}
                          </span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 ml-auto">
                            {value}
                          </span>
                        </div>
                      )
                    )
                  ) : (
                    Object.entries(statusColors).map(([key, cfg]) => (
                      <div key={key} className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${cfg.bg}`} />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{cfg.label}</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 ml-auto">0</span>
                      </div>
                    ))
                  )}
                </div>

                {totalStatusDevices === 0 && (
                  <p className="text-sm text-center text-gray-400 dark:text-gray-500">
                    {t("dashNoDevices")}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
