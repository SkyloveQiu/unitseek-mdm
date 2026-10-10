import { useEffect, useState } from "react";
import {
  Lock,
  RotateCcw,
  KeyRound,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";

export interface DeviceInfo {
  id: string | number;
  device_name: string | null;
  display_name?: string | null;
  model: string | null;
  manufacturer: string | null;
  serial_number: string | null;
  imei: string | null;
  os_version: string | null;
  api_level: number | null;
  security_patch_level?: string | null;
  state: string;
  compliance_state: string;
  policy_name: string | null;
  group_id?: number | null;
  last_sync_at?: string | null;
  last_reported_at?: string | null;
  enrolled_at?: string | null;
  application_reports?: Record<string, unknown> | null;
  hardware_info?: {
    cpu: string;
    ram: string;
    storage: string;
    battery_level: number;
    screen_resolution: string;
  };
}

interface DeviceDetailDialogProps {
  device: DeviceInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (deviceId: string, action: string) => void;
  groups: Array<{ id: number; name: string }>;
  onMoveGroup: (deviceId: string, groupId: number | null) => void;
  onRename: (deviceId: string, displayName: string) => void;
  renaming?: boolean;
  focusName?: boolean;
}

function getStateBadgeVariant(state: string) {
  switch (state) {
    case "active":
      return "success" as const;
    case "disabled":
      return "warning" as const;
    case "provisioning":
      return "default" as const;
    case "deleted":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function getComplianceBadgeVariant(state: string) {
  switch (state) {
    case "compliant":
      return "success" as const;
    case "non_compliant":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export function DeviceDetailDialog({
  device,
  open,
  onOpenChange,
  onAction,
  groups,
  onMoveGroup,
  onRename,
  renaming = false,
  focusName = false,
}: DeviceDetailDialogProps) {
  const { t } = useLanguage();
  const [showHardware, setShowHardware] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    setConfirmAction(null);
  }, [device?.id]);

  useEffect(() => {
    setNameDraft(device?.display_name ?? "");
  }, [device?.id, device?.display_name, open]);

  if (!device) return null;

  const nameUnchanged = nameDraft.trim() === (device.display_name ?? "");

  const handleAction = (action: string) => {
    if (action === "wipe") {
      setConfirmAction(action);
      return;
    }
    onAction(String(device.id), action);
  };

  const confirmDestructiveAction = () => {
    if (confirmAction) {
      onAction(String(device.id), confirmAction);
      setConfirmAction(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{device.display_name || device.device_name || `Device ${device.id}`}</DialogTitle>
            <DialogDescription>
              {[device.manufacturer, device.model].filter(Boolean).join(" ")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <form
              className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!nameUnchanged) onRename(String(device.id), nameDraft.trim());
              }}
            >
              <label htmlFor="device-display-name" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                {t("devDeviceName")}
              </label>
              <div className="flex gap-2">
                <Input
                  id="device-display-name"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  placeholder={t("devDeviceNamePlaceholder")}
                  maxLength={255}
                  autoFocus={focusName}
                  className="h-9"
                />
                <Button type="submit" size="sm" className="h-9 shrink-0" disabled={renaming || nameUnchanged}>
                  {t("devSaveName")}
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">{t("devDeviceNameHint")}</p>
            </form>

            {/* Status row */}
            <div className="flex items-center gap-3">
              <Badge variant={getStateBadgeVariant(device.state)}>
                {device.state}
              </Badge>
              <Badge variant={getComplianceBadgeVariant(device.compliance_state)}>
                {device.compliance_state.replace("_", " ")}
              </Badge>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">{t("devSerialNumber")}</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{device.serial_number || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">{t("devIMEI")}</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{device.imei || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">{t("devOSVersion")}</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                  Android {device.os_version || "-"} (API {device.api_level ?? "-"})
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">{t("devLastSync")}</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                  {device.last_sync_at ? formatDateTime(device.last_sync_at) : t("never")}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">{t("devPolicy")}</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{device.policy_name || t("none")}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">{t("devGroup")}</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{device.group_id ?? t("none")}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Security patch</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{device.security_patch_level || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Enrolled</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{device.enrolled_at ? formatDateTime(device.enrolled_at) : "-"}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Last report</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{device.last_reported_at ? formatDateTime(device.last_reported_at) : "-"}</p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Move device to group</label>
              <select
                value={device.group_id ?? ""}
                onChange={(event) => {
                  const groupId = event.target.value ? Number(event.target.value) : null;
                  if (groupId !== device.group_id) onMoveGroup(String(device.id), groupId);
                }}
                className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 text-sm"
              >
                <option value="">No group</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </div>

            {device.application_reports && Object.keys(device.application_reports).length > 0 && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Application reports</p>
                <div className="space-y-2">
                  {Object.entries(device.application_reports).map(([packageName, report]) => {
                    const value = typeof report === "object" && report !== null ? report as Record<string, unknown> : {};
                    const version = typeof value.versionName === "string" ? value.versionName : "Unknown version";
                    const state = typeof value.installState === "string" ? value.installState : "reported";
                    const failure = typeof value.installFailureReason === "string" ? value.installFailureReason : undefined;
                    return (
                      <div key={packageName} className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-mono truncate">{packageName}</span>
                        <span className={failure ? "text-red-600" : "text-gray-500"}>{failure || `${version} · ${state}`}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Hardware info (collapsible) */}
            {device.hardware_info && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  type="button"
                  className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  onClick={() => setShowHardware(!showHardware)}
                >
                  {t("devHardwareInfo")}
                  {showHardware ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {showHardware && (
                  <div className="px-4 pb-3 grid grid-cols-2 gap-3 text-sm border-t border-gray-200 dark:border-gray-700">
                    <div className="pt-3">
                      <p className="text-gray-500 dark:text-gray-400 text-xs">CPU</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{device.hardware_info.cpu}</p>
                    </div>
                    <div className="pt-3">
                      <p className="text-gray-500 dark:text-gray-400 text-xs">RAM</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{device.hardware_info.ram}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400 text-xs">{t("devStorage")}</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{device.hardware_info.storage}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400 text-xs">{t("devBattery")}</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{device.hardware_info.battery_level}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400 text-xs">{t("devScreen")}</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{device.hardware_info.screen_resolution}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction("lock")}
              >
                <Lock className="h-4 w-4 mr-1.5" />
                {t("devLock")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction("reboot")}
              >
                <RotateCcw className="h-4 w-4 mr-1.5" />
                {t("devReboot")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction("reset_password")}
              >
                <KeyRound className="h-4 w-4 mr-1.5" />
                {t("devResetPassword")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleAction("wipe")}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                {t("devWipeDevice")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog for destructive actions */}
      <Dialog
        open={confirmAction !== null}
        onOpenChange={() => setConfirmAction(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("devConfirmAction")}</DialogTitle>
            <DialogDescription>
              {t("devConfirmWipe").replace("{action}", confirmAction || "")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmAction(null)}
            >
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDestructiveAction}>
              {t("confirm")} {confirmAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
