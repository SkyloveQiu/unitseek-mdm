import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Save,
  ChevronDown,
  ChevronUp,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Wifi,
  AppWindow,
  Smartphone,
  RefreshCw,
  BarChart3,
  Monitor,
  Users,
  MessageSquare,
  Loader2,
  FileText,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { useLanguage } from "@/hooks/use-language";
import {
  policyCategories,
  policyTemplates,
  policyJsonToFormState,
  formStateToPolicyJson,
  mergeWithExtraKeys,
  type FormState,
  type PolicyCategory,
  type PolicyField,
  type PolicyTemplate,
} from "./policy-definitions";
import { ManagedAppsSection, type PolicyApp } from "./managed-apps-section";

interface Policy {
  id: string;
  name: string;
  display_name: string;
  description: string;
  policy_json: Record<string, unknown> | string;
  version: number;
  is_default: boolean;
  applied_devices_count: number;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Lock,
  ShieldCheck,
  ShieldAlert,
  Wifi,
  AppWindow,
  Smartphone,
  RefreshCw,
  BarChart3,
  Monitor,
  Users,
  MessageSquare,
  FileText,
  Check,
};

const policyCategoryTitles: Record<string, string> = {
  password: "Password & Screen Lock",
  security: "Security",
  network: "Network & Connectivity",
  apps: "Applications",
  device: "Device Features",
  display: "Display & Screen",
  updates: "System Updates",
  kiosk: "Kiosk Mode",
  workProfile: "Work & Personal Profiles",
  monitoring: "Monitoring & Reporting",
  frp: "Factory Reset Protection",
  support: "Messages & Support",
};

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .replace(/\bWifi\b/g, "Wi-Fi")
    .replace(/\bUwb\b/g, "UWB")
    .replace(/\bVpn\b/g, "VPN")
    .replace(/\bNfc\b/g, "NFC")
    .replace(/\bUsb\b/g, "USB")
    .replace(/\bEsim\b/g, "eSIM")
    .replace(/\bApi\b/g, "API")
    .replace(/\bSms\b/g, "SMS")
    .replace(/\bFrp\b/g, "FRP");
}

function englishFieldLabel(field: PolicyField): string {
  const parts = field.key.split(".").filter((part) => !/^\d+$/.test(part));
  const leaf = parts[parts.length - 1] || field.key;
  return titleCase(leaf.replace(/([a-z])([A-Z])/g, "$1 $2"));
}

function englishOptionLabel(value: string): string {
  if (!value) return "Unspecified";

  if (/^\d+s$/.test(value)) {
    const seconds = Number(value.slice(0, -1));
    if (seconds % 86400 === 0) return `${seconds / 86400} days`;
    if (seconds % 3600 === 0) return `${seconds / 3600} hours`;
    if (seconds % 60 === 0) return `${seconds / 60} minutes`;
    return `${seconds} seconds`;
  }

  if (/^\d+$/.test(value)) {
    const milliseconds = Number(value);
    if (milliseconds >= 1000 && milliseconds % 1000 === 0) {
      const seconds = milliseconds / 1000;
      if (seconds % 60 === 0) return `${seconds / 60} minutes`;
      return `${seconds} seconds`;
    }
    return value;
  }

  return titleCase(value.replace(/_/g, " "));
}

function CategorySection({
  category,
  formState,
  onFieldChange,
  defaultExpanded,
}: {
  category: PolicyCategory;
  formState: FormState;
  onFieldChange: (key: string, value: unknown) => void;
  defaultExpanded: boolean;
}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const Icon = iconMap[category.icon];

  // Count how many fields are actively set
  const activeCount = category.fields.filter((f) => {
    const val = formState[f.key];
    if (val === undefined || val === null) return false;
    if (f.type === "toggle") return val === true;
    if (f.type === "select") return val !== "";
    if (f.type === "number") return Number(val) > 0;
    return false;
  }).length;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${category.color}`}>
            {Icon && <Icon className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {policyCategoryTitles[category.id] || category.title}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{category.fields.length} {t("polEditorSettings")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <Badge variant="secondary">{activeCount} {t("polEditorActive")}</Badge>
          )}
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <CardContent className="px-4 pb-4 pt-0">
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-4">
            {category.fields.map((field) => (
              <FieldRow
                key={field.key}
                field={field}
                value={formState[field.key]}
                onChange={(val) => onFieldChange(field.key, val)}
              />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: PolicyField;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const label = englishFieldLabel(field);
  const description = `Configure ${label.toLowerCase()} for managed Android devices.`;

  if (field.type === "toggle") {
    const checked = value === true;
    return (
      <div className="flex items-center justify-between py-2">
        <div className="flex-1 min-w-0 mr-4">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        </div>
        <Switch
          checked={checked}
          onCheckedChange={(val) => onChange(val)}
        />
      </div>
    );
  }

  if (field.type === "select") {
    const strValue = value !== undefined && value !== null ? String(value) : "";
    return (
      <div className="flex items-center justify-between py-2 gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        </div>
        <Select
          className="w-52 shrink-0"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {englishOptionLabel(opt.value)}
            </option>
          ))}
        </Select>
      </div>
    );
  }

  if (field.type === "number") {
    const numValue = value !== undefined && value !== null ? Number(value) : field.min;
    return (
      <div className="flex items-center justify-between py-2 gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step || 1}
            value={numValue}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-32 accent-primary-600"
          />
          <span className="text-sm font-mono text-gray-700 dark:text-gray-300 w-8 text-center tabular-nums">
            {numValue}
          </span>
        </div>
      </div>
    );
  }

  return null;
}

export function PolicyEditor() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isNew = !id || id === "new";

  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [formState, setFormState] = useState<FormState>({});
  const [policyApps, setPolicyApps] = useState<PolicyApp[]>([]);
  const [originalJson, setOriginalJson] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Fetch existing policy
  const { data: policy, isLoading } = useQuery<Policy>({
    queryKey: ["policies", id],
    queryFn: () => apiGet<Policy>(`/policies/${id}`),
    enabled: !isNew,
    retry: false,
  });

  // Populate form when policy loads
  useEffect(() => {
    if (policy && !loaded) {
      setName(policy.name);
      setDisplayName(policy.display_name);
      setDescription(policy.description);
      setIsDefault(policy.is_default);

      let policyObj: Record<string, unknown> = {};
      try {
        policyObj = typeof policy.policy_json === "string"
          ? JSON.parse(policy.policy_json)
          : (policy.policy_json as unknown as Record<string, unknown>);
      } catch {
        policyObj = {};
      }

      setOriginalJson(policyObj);
      setFormState(policyJsonToFormState(policyObj));

      // Load applications from policy_json
      const existingApps = Array.isArray(policyObj.applications)
        ? (policyObj.applications as PolicyApp[])
        : [];
      setPolicyApps(existingApps);

      setLoaded(true);
    }
  }, [policy, loaded]);

  // Set loaded for new policies
  useEffect(() => {
    if (isNew && !loaded) {
      setLoaded(true);
    }
  }, [isNew, loaded]);

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      display_name: string;
      description: string;
      policy_json: Record<string, unknown>;
      is_default?: boolean;
    }) => apiPost("/policies", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      toast("success", t("polEditorCreatedSuccess"));
      navigate("/policies");
    },
    onError: () => {
      toast("error", t("polEditorCreatedError"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      name: string;
      display_name: string;
      description: string;
      policy_json: Record<string, unknown>;
      is_default?: boolean;
    }) => apiPut(`/policies/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      toast("success", t("polEditorUpdatedSuccess"));
      navigate("/policies");
    },
    onError: () => {
      toast("error", t("polEditorUpdatedError"));
    },
  });

  const handleFieldChange = (key: string, value: unknown) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const applyTemplate = (template: PolicyTemplate) => {
    setSelectedTemplate(template.id);
    setName(template.defaultName);
    setDisplayName(template.defaultDisplayName);
    setFormState({ ...template.formState });
    toast("info", t("tplApplied").replace("{name}", t(template.nameKey as Parameters<typeof t>[0])));
  };

  const clearTemplate = () => {
    setSelectedTemplate(null);
    setName("");
    setDisplayName("");
    setDescription("");
    setFormState({});
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast("error", t("polEditorNameRequired"));
      return;
    }

    const editorJson = formStateToPolicyJson(formState);
    const finalJson = isNew ? editorJson : mergeWithExtraKeys(originalJson, editorJson);

    // Include managed applications
    if (policyApps.length > 0) {
      finalJson.applications = policyApps.map((app) => {
        const entry: Record<string, unknown> = {
          packageName: app.packageName,
          installType: app.installType || "AVAILABLE",
        };
        if (app.defaultPermissionPolicy) entry.defaultPermissionPolicy = app.defaultPermissionPolicy;
        if (app.autoUpdateMode) entry.autoUpdateMode = app.autoUpdateMode;
        if (app.disabled) entry.disabled = true;
        if (app.lockTaskAllowed) entry.lockTaskAllowed = true;
        return entry;
      });
    } else {
      delete finalJson.applications;
    }
    const payload = {
      name: name.trim(),
      display_name: displayName.trim() || name.trim(),
      description: description.trim(),
      policy_json: finalJson,
      is_default: isDefault,
    };

    if (isNew) {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (!isNew && isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded" />
          <Skeleton className="h-6 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/policies")}
            className="text-gray-500 dark:text-gray-400"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("polTitle")}
          </Button>
        </div>
        <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {isSaving ? t("saving") : isNew ? t("polEditorCreate") : t("polEditorSave")}
        </Button>
      </div>

      {/* Title */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {isNew ? t("polEditorCreateTitle") : t("polEditorEditTitle")}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t("polEditorSubtitle")}
        </p>
      </div>

      {/* Template selector - only for new policies */}
      {isNew && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t("tplChooseTemplate")}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t("tplChooseTemplateDesc")}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Blank */}
              <button
                type="button"
                onClick={clearTemplate}
                className={`relative flex flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition-all hover:shadow-sm ${
                  selectedTemplate === null
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500"
                    : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                }`}
              >
                {selectedTemplate === null && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  </div>
                )}
                <div className="p-2 rounded-lg text-gray-500 bg-gray-100 dark:text-gray-400 dark:bg-gray-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {t("tplBlank")}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                    {t("tplBlankDesc")}
                  </p>
                </div>
              </button>

              {/* Templates */}
              {policyTemplates.map((tpl) => {
                const TplIcon = iconMap[tpl.icon] || FileText;
                const isSelected = selectedTemplate === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className={`relative flex flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition-all hover:shadow-sm ${
                      isSelected
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500"
                        : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <Check className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                      </div>
                    )}
                    <div className={`p-2 rounded-lg ${tpl.color}`}>
                      <TplIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {t(tpl.nameKey as Parameters<typeof t>[0])}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {t(tpl.descKey as Parameters<typeof t>[0])}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Basic info */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("polEditorName")}
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("polEditorNamePlaceholder")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("polEditorDisplayName")}
              </label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("polEditorDisplayNamePlaceholder")}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("polEditorDescription")}
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("polEditorDescriptionPlaceholder")}
              />
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              <Switch
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("polEditorDefault")}
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Managed Applications */}
      <ManagedAppsSection apps={policyApps} onChange={setPolicyApps} />

      {/* Policy categories */}
      <div className="space-y-3">
        {policyCategories.map((category, index) => (
          <CategorySection
            key={category.id}
            category={category}
            formState={formState}
            onFieldChange={handleFieldChange}
            defaultExpanded={index === 0}
          />
        ))}
      </div>
    </div>
  );
}
