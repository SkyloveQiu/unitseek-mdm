import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Package,
  Download,
  Shield,
  RefreshCw,
  Search,
  X,
  Smartphone,
  Lock,
  Store,
  AlertCircle,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { apiGet, apiPost } from "@/lib/api";
import type { TranslationKey } from "@/i18n";

export interface PolicyApp {
  packageName: string;
  installType: string;
  defaultPermissionPolicy?: string;
  autoUpdateMode?: string;
  disabled?: boolean;
  lockTaskAllowed?: boolean;
}

interface ManagedAppsSectionProps {
  apps: PolicyApp[];
  onChange: (apps: PolicyApp[]) => void;
}

interface EnterpriseStatus {
  is_linked: boolean;
  enterprise_id: string | null;
}

interface WebTokenResponse {
  token: string;
  iframe_url: string;
}

const INSTALL_TYPES: { value: string; labelKey: TranslationKey }[] = [
  { value: "AVAILABLE", labelKey: "appInstallAvailable" },
  { value: "FORCE_INSTALLED", labelKey: "appInstallForced" },
  { value: "REQUIRED_FOR_SETUP", labelKey: "appInstallRequired" },
  { value: "PREINSTALLED", labelKey: "appInstallPreinstalled" },
  { value: "BLOCKED", labelKey: "appInstallBlocked" },
  { value: "KIOSK", labelKey: "appInstallKiosk" },
];

const PERMISSION_POLICIES: { value: string; labelKey: TranslationKey }[] = [
  { value: "", labelKey: "appPermDefault" },
  { value: "PROMPT", labelKey: "appPermPrompt" },
  { value: "GRANT", labelKey: "appPermGrant" },
  { value: "DENY", labelKey: "appPermDeny" },
];

const AUTO_UPDATE_MODES: { value: string; labelKey: TranslationKey }[] = [
  { value: "", labelKey: "appUpdateDefault" },
  { value: "DEFAULT", labelKey: "appUpdateAuto" },
  { value: "POSTPONED", labelKey: "appUpdatePostponed" },
  { value: "HIGH_PRIORITY", labelKey: "appUpdateHighPriority" },
];

function getInstallTypeBadge(installType: string) {
  switch (installType) {
    case "FORCE_INSTALLED":
      return { color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", icon: Download };
    case "REQUIRED_FOR_SETUP":
      return { color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", icon: Download };
    case "BLOCKED":
      return { color: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400", icon: X };
    case "KIOSK":
      return { color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", icon: Lock };
    case "PREINSTALLED":
      return { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", icon: Smartphone };
    default:
      return { color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", icon: Package };
  }
}

function AppRow({
  app,
  onUpdate,
  onRemove,
}: {
  app: PolicyApp;
  onUpdate: (updated: PolicyApp) => void;
  onRemove: () => void;
}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const badge = getInstallTypeBadge(app.installType);
  const BadgeIcon = badge.icon;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
      {/* Main row */}
      <div className="flex items-center gap-3 p-3">
        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
          <Package className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100 truncate">
            {app.packageName}
          </p>
        </div>
        <Badge className={`text-xs px-2 py-0.5 ${badge.color}`}>
          <BadgeIcon className="h-3 w-3 mr-1" />
          {t(INSTALL_TYPES.find((it) => it.value === app.installType)?.labelKey || "appInstallAvailable")}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600"
        >
          {expanded ? t("close") : t("edit")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-red-400 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-3 pb-3 pt-3 space-y-3 bg-gray-50/50 dark:bg-gray-800/30">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Install Type */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                <Download className="h-3 w-3 inline mr-1" />
                {t("appInstallType")}
              </label>
              <Select
                className="w-full text-sm"
                value={app.installType}
                onChange={(e) => onUpdate({ ...app, installType: e.target.value })}
              >
                {INSTALL_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </Select>
            </div>

            {/* Permission Policy */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                <Shield className="h-3 w-3 inline mr-1" />
                {t("appPermissions")}
              </label>
              <Select
                className="w-full text-sm"
                value={app.defaultPermissionPolicy || ""}
                onChange={(e) =>
                  onUpdate({ ...app, defaultPermissionPolicy: e.target.value })
                }
              >
                {PERMISSION_POLICIES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </Select>
            </div>

            {/* Auto Update */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                <RefreshCw className="h-3 w-3 inline mr-1" />
                {t("appAutoUpdate")}
              </label>
              <Select
                className="w-full text-sm"
                value={app.autoUpdateMode || ""}
                onChange={(e) =>
                  onUpdate({ ...app, autoUpdateMode: e.target.value })
                }
              >
                {AUTO_UPDATE_MODES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayStoreSection({ onSelectApp }: { onSelectApp: (packageName: string) => void }) {
  const { t } = useLanguage();
  const [showStore, setShowStore] = useState(false);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: enterpriseStatus } = useQuery<EnterpriseStatus>({
    queryKey: ["enterprise", "status"],
    queryFn: () => apiGet<EnterpriseStatus>("/enterprise/status"),
  });

  const isLinked = enterpriseStatus?.is_linked ?? false;

  const openStore = useCallback(async () => {
    if (!isLinked) return;
    setLoading(true);
    try {
      const result = await apiPost<WebTokenResponse>("/apps/web-token", {
        parent_frame_url: window.location.origin,
      });
      setIframeUrl(result.iframe_url);
      setShowStore(true);
    } catch {
      // Token creation failed - show manual entry instead
      setShowStore(false);
    } finally {
      setLoading(false);
    }
  }, [isLinked]);

  // Listen for messages from the Managed Google Play iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Google Play iframe sends messages when user selects an app
      if (event.data?.messageType === "N_SELECT") {
        const packageName = event.data?.packageName;
        if (packageName) {
          onSelectApp(packageName);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onSelectApp]);

  if (!isLinked) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
        <AlertCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <p className="text-xs text-gray-500 dark:text-gray-400 flex-1">
          {t("entPlayStoreNotLinked")}
        </p>
        <a href="/settings/tenant" className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1">
          <Settings className="h-3 w-3" />
          {t("navSettings")}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!showStore ? (
        <Button
          variant="outline"
          size="sm"
          onClick={openStore}
          disabled={loading}
          className="w-full justify-center border-dashed"
        >
          <Store className="h-4 w-4 mr-2" />
          {loading ? t("loading") : t("entPlayStoreTitle")}
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <Store className="h-3 w-3" />
              {t("entPlayStoreDesc")}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStore(false)}
              className="text-gray-400 hover:text-gray-600 h-6 px-2"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          {iframeUrl && (
            <iframe
              src={iframeUrl}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700"
              style={{ height: "480px" }}
              allow="encrypted-media"
            />
          )}
        </div>
      )}
    </div>
  );
}

export function ManagedAppsSection({ apps, onChange }: ManagedAppsSectionProps) {
  const { t } = useLanguage();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPackage, setNewPackage] = useState("");
  const [newInstallType, setNewInstallType] = useState("AVAILABLE");

  const handleAdd = (packageName?: string) => {
    const pkg = (packageName || newPackage).trim();
    if (!pkg) return;

    // Prevent duplicates
    if (apps.some((a) => a.packageName === pkg)) {
      return;
    }

    const newApp: PolicyApp = {
      packageName: pkg,
      installType: newInstallType,
    };

    onChange([...apps, newApp]);
    setNewPackage("");
    setNewInstallType("AVAILABLE");
    if (!packageName) {
      setShowAddForm(false);
    }
  };

  const handlePlayStoreSelect = useCallback((packageName: string) => {
    handleAdd(packageName);
  }, [apps, newInstallType]);

  const handleUpdate = (index: number, updated: PolicyApp) => {
    const newApps = [...apps];
    newApps[index] = updated;
    onChange(newApps);
  };

  const handleRemove = (index: number) => {
    onChange(apps.filter((_, i) => i !== index));
  };

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {t("appManagedTitle")}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("appManagedSubtitle")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {apps.length > 0 && (
            <Badge variant="secondary">
              {apps.length} app
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? (
              <>
                <X className="h-4 w-4 mr-1" />
                {t("cancel")}
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                {t("appAddApp")}
              </>
            )}
          </Button>
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Managed Google Play iframe */}
        <PlayStoreSection onSelectApp={handlePlayStoreSelect} />

        {/* Manual Add Form */}
        {showAddForm && (
          <div className="p-3 border-2 border-dashed border-emerald-200 dark:border-emerald-800 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">
              {t("appAddAppHint")}
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-9 text-sm font-mono"
                  placeholder={t("appPackagePlaceholder")}
                  value={newPackage}
                  onChange={(e) => setNewPackage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
              <Select
                className="w-44 text-sm"
                value={newInstallType}
                onChange={(e) => setNewInstallType(e.target.value)}
              >
                {INSTALL_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </Select>
              <Button size="sm" onClick={() => handleAdd()} disabled={!newPackage.trim()}>
                <Plus className="h-4 w-4 mr-1" />
                {t("appAdd")}
              </Button>
            </div>
          </div>
        )}

        {/* Apps List */}
        {apps.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("appNoApps")}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {t("appNoAppsHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {apps.map((app, index) => (
              <AppRow
                key={app.packageName}
                app={app}
                onUpdate={(updated) => handleUpdate(index, updated)}
                onRemove={() => handleRemove(index)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
