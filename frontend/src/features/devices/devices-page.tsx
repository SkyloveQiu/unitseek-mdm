import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Smartphone,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Lock,
  RotateCcw,
  Trash2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { DeviceDetailDialog, type DeviceInfo } from "./device-detail-dialog";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useLanguage } from "@/hooks/use-language";

interface Device {
  id: number;
  device_name: string | null;
  display_name: string | null;
  model: string | null;
  manufacturer: string | null;
  os_version: string | null;
  api_level: number | null;
  security_patch_level: string | null;
  state: string;
  compliance_state: string;
  policy_name: string | null;
  group_id: number | null;
  last_sync_at: string | null;
  last_reported_at: string | null;
  enrolled_at: string | null;
  serial_number: string | null;
  imei: string | null;
  application_reports: Record<string, unknown> | null;
}

interface DevicesResponse {
  items: Device[];
  total: number;
  page: number;
  per_page: number;
}

interface DeviceGroup {
  id: number;
  name: string;
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

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><Skeleton className="h-8 w-8" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function DevicesPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [complianceFilter, setComplianceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [focusName, setFocusName] = useState(false);

  const { data, isLoading, isError } = useQuery<DevicesResponse>({
    queryKey: ["devices", page, search, stateFilter, complianceFilter],
    queryFn: () =>
      apiGet<DevicesResponse>("/devices", {
        page,
        per_page: 20,
        search: search || undefined,
        state: stateFilter !== "all" ? stateFilter : undefined,
        compliance_state:
          complianceFilter !== "all" ? complianceFilter : undefined,
      }),
    retry: false,
  });

  const devices = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20) || 1;

  const filteredDevices = useMemo(() => {
    if (!search && stateFilter === "all" && complianceFilter === "all") {
      return devices;
    }
    return devices;
  }, [devices, search, stateFilter, complianceFilter]);

  const handleViewDevice = (device: Device, rename = false) => {
    const deviceInfo: DeviceInfo = {
      ...device,
      hardware_info: undefined,
    };
    setSelectedDevice(deviceInfo);
    setFocusName(rename);
    setDetailOpen(true);
  };

  // Keep the open detail dialog in step with the saved server state.
  const syncSelectedDevice = (updated: Device) => {
    setSelectedDevice((current) =>
      current && Number(current.id) === updated.id
        ? { ...updated, hardware_info: undefined }
        : current
    );
  };

  const actionMutation = useMutation({
    mutationFn: async ({ deviceId, action }: { deviceId: number; action: string }) => {
      if (action === "wipe") {
        const confirmation = window.prompt(`Type WIPE ${deviceId} to permanently erase this device.`);
        if (confirmation !== `WIPE ${deviceId}`) {
          throw new Error("Wipe confirmation was not accepted");
        }
        return apiPost(`/devices/${deviceId}/commands/wipe`, { confirmation });
      }
      if (action === "reset_password") {
        const newPassword = window.prompt("Enter the new device password/PIN. Do not reuse an account password.");
        if (!newPassword) throw new Error("A new device password/PIN is required");
        return apiPost(`/devices/${deviceId}/command`, {
          command: "reset_password",
          params: { new_password: newPassword, flags: ["REQUIRE_ENTRY"] },
        });
      }
      return apiPost(`/devices/${deviceId}/commands/${action}`);
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast("success", t("devActionSent").replace("{action}", variables.action).replace("{deviceId}", String(variables.deviceId)));
      setDetailOpen(false);
    },
    onError: (error) => {
      toast("error", error instanceof Error ? error.message : "Device command failed");
    },
  });
  const { data: groups = [] } = useQuery<DeviceGroup[]>({
    queryKey: ["groups"],
    queryFn: () => apiGet("/groups"),
  });

  const handleDeviceAction = (deviceId: string, action: string) => {
    actionMutation.mutate({ deviceId: Number(deviceId), action });
  };
  const moveGroupMutation = useMutation({
    mutationFn: ({ deviceId, groupId }: { deviceId: number; groupId: number | null }) =>
      apiPut<Device>(`/devices/${deviceId}`, { group_id: groupId }),
    onSuccess: (updated) => {
      syncSelectedDevice(updated);
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast("success", "Device group updated.");
    },
    onError: () => toast("error", "Could not move the device to that group."),
  });
  const renameMutation = useMutation({
    mutationFn: ({ deviceId, displayName }: { deviceId: number; displayName: string }) =>
      apiPut<Device>(`/devices/${deviceId}`, { display_name: displayName }),
    onSuccess: (updated) => {
      syncSelectedDevice(updated);
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast("success", t("devRenamed"));
    },
    onError: () => toast("error", t("devRenameFailed")),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t("devTitle")}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t("devSubtitle")}
        </p>
      </div>

      {/* Backend not connected */}
      {isError && (
        <div className="flex items-center gap-3 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/30 px-4 py-3">
          <Info className="h-5 w-5 text-primary-500 flex-shrink-0" />
          <p className="text-sm text-primary-700 dark:text-primary-300">
            {t("backendNotConnected")} {t("backendDevices")}
          </p>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t("devSearch")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <select
          value={stateFilter}
          onChange={(e) => {
            setStateFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
        >
          <option value="all">{t("devAllStates")}</option>
          <option value="active">{t("devActive")}</option>
          <option value="disabled">{t("devDisabled")}</option>
          <option value="provisioning">{t("devProvisioning")}</option>
          <option value="deleted">{t("devDeleted")}</option>
        </select>
        <select
          value={complianceFilter}
          onChange={(e) => {
            setComplianceFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
        >
          <option value="all">{t("devAllCompliance")}</option>
          <option value="compliant">{t("devCompliant")}</option>
          <option value="non_compliant">{t("devNonCompliant")}</option>
          <option value="unknown">{t("devUnknown")}</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("devColName")}</TableHead>
              <TableHead>{t("devColModel")}</TableHead>
              <TableHead>{t("devColOS")}</TableHead>
              <TableHead>{t("devColState")}</TableHead>
              <TableHead>{t("devColCompliance")}</TableHead>
              <TableHead>{t("devColPolicy")}</TableHead>
              <TableHead>{t("devColLastSync")}</TableHead>
              <TableHead className="w-12">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton />
            ) : filteredDevices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="flex flex-col items-center py-12 text-gray-400">
                    <Smartphone className="h-12 w-12 mb-3" />
                    <p className="text-lg font-medium text-gray-600 dark:text-gray-300">
                      {t("devNoDevices")}
                    </p>
                    <p className="text-sm mt-1 dark:text-gray-500">
                      {t("devNoDevicesHint")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredDevices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700">
                        <Smartphone className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      </div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {device.display_name || device.device_name || `Device ${device.id}`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {[device.manufacturer, device.model].filter(Boolean).join(" ") || "-"}
                  </TableCell>
                  <TableCell>
                    {device.os_version || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStateBadgeVariant(device.state)}>
                      {device.state}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={getComplianceBadgeVariant(
                        device.compliance_state
                      )}
                    >
                      {device.compliance_state.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {device.policy_name || "-"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {device.last_sync_at
                      ? formatDateTime(device.last_sync_at)
                      : t("never")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg focus-visible:ring-2 focus-visible:ring-offset-1"
                          aria-label="Device actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={() => handleViewDevice(device)}
                        >
                          <Eye className="h-4 w-4 shrink-0" />
                          {t("devViewDetails")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleViewDevice(device, true)}
                        >
                          <Pencil className="h-4 w-4 shrink-0" />
                          {t("devRename")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            handleDeviceAction(String(device.id), "lock")
                          }
                        >
                          <Lock className="h-4 w-4 shrink-0" />
                          {t("devLock")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleDeviceAction(String(device.id), "reboot")
                          }
                        >
                          <RotateCcw className="h-4 w-4 shrink-0" />
                          {t("devReboot")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          destructive
                          onClick={() =>
                            handleDeviceAction(String(device.id), "wipe")
                          }
                        >
                          <Trash2 className="h-4 w-4 shrink-0" />
                          {t("devWipeDevice")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {(page - 1) * 20 + 1} - {Math.min(page * 20, total)} {t("of")} {total} {t("devices")}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("previous")}
              </Button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t("page")} {page} {t("of")} {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("next")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Device detail dialog */}
      <DeviceDetailDialog
        device={selectedDevice}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onAction={handleDeviceAction}
        groups={groups}
        onMoveGroup={(deviceId, groupId) => moveGroupMutation.mutate({ deviceId: Number(deviceId), groupId })}
        onRename={(deviceId, displayName) => renameMutation.mutate({ deviceId: Number(deviceId), displayName })}
        renaming={renameMutation.isPending}
        focusName={focusName}
      />
    </div>
  );
}
