import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderTree, Plus, Smartphone, Shield, Pencil, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { useLanguage } from "@/hooks/use-language";

interface DeviceGroup {
  id: number;
  name: string;
  description: string;
  device_count: number;
  default_policy_id: number | null;
}

interface CreateGroupData {
  name: string;
  description: string;
  default_policy_id: string;
}

interface Policy {
  id: number;
  name: string;
  display_name: string;
}

function GroupCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function GroupsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreateGroupData>({
    name: "",
    description: "",
    default_policy_id: "",
  });
  const [editingGroup, setEditingGroup] = useState<DeviceGroup | null>(null);

  const { data, isLoading, isError } = useQuery<DeviceGroup[]>({
    queryKey: ["groups"],
    queryFn: () => apiGet<DeviceGroup[]>("/groups"),
    retry: false,
  });

  const { data: policiesData } = useQuery<Policy[]>({
    queryKey: ["policies-list"],
    queryFn: () => apiGet("/policies"),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateGroupData) => apiPost("/groups", {
      ...data,
      default_policy_id: data.default_policy_id ? Number(data.default_policy_id) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setDialogOpen(false);
      setFormData({ name: "", description: "", default_policy_id: "" });
      toast("success", t("grpCreatedSuccess"));
    },
    onError: () => {
      toast("error", t("grpCreatedError"));
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateGroupData }) => apiPut(`/groups/${id}`, {
      ...data,
      default_policy_id: data.default_policy_id ? Number(data.default_policy_id) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setDialogOpen(false);
      setEditingGroup(null);
      setFormData({ name: "", description: "", default_policy_id: "" });
      toast("success", "Group updated.");
    },
    onError: () => toast("error", "Could not update group."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast("success", t("grpDeletedSuccess"));
    },
    onError: () => {
      toast("error", t("grpDeletedError"));
    },
  });

  const groups = data || [];
  const policies = policiesData || [];
  const policiesById = new Map(policies.map((policy) => [policy.id, policy]));
  const openCreateDialog = () => {
    setEditingGroup(null);
    setFormData({ name: "", description: "", default_policy_id: "" });
    setDialogOpen(true);
  };
  const openEditDialog = (group: DeviceGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || "",
      default_policy_id: group.default_policy_id ? String(group.default_policy_id) : "",
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t("grpTitle")}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t("grpSubtitle")}
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          {t("grpCreate")}
        </Button>
      </div>

      {/* Backend not connected */}
      {isError && (
        <div className="flex items-center gap-3 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/30 px-4 py-3">
          <Info className="h-5 w-5 text-primary-500 flex-shrink-0" />
          <p className="text-sm text-primary-700 dark:text-primary-300">
            {t("backendNotConnected")} {t("backendGroups")}
          </p>
        </div>
      )}

      {/* Groups grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <GroupCardSkeleton key={i} />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <FolderTree className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-lg font-medium text-gray-600 dark:text-gray-300">
              {t("grpNoItems")}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {t("grpNoItemsHint")}
            </p>
            <Button className="mt-4" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t("grpCreateFirst")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Card key={group.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FolderTree className="h-5 w-5 text-primary-600 flex-shrink-0" />
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {group.name}
                    </h3>
                  </div>
                </div>

                {group.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    {group.description}
                  </p>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="secondary">
                    <Smartphone className="h-3 w-3 mr-1" />
                    {group.device_count} {t("devices")}
                  </Badge>
                  {group.default_policy_id && policiesById.get(group.default_policy_id) && (
                    <Badge variant="outline">
                      <Shield className="h-3 w-3 mr-1" />
                      {policiesById.get(group.default_policy_id)?.display_name || policiesById.get(group.default_policy_id)?.name}
                    </Badge>
                  )}
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(group)}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    {t("edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30"
                    onClick={() => deleteMutation.mutate(group.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    {t("delete")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create group dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit group" : t("grpCreateDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("grpCreateDialogSubtitle")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("grpName")}
              </label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, name: e.target.value }))
                }
                placeholder={t("grpNamePlaceholder")}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("description")}
              </label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, description: e.target.value }))
                }
                placeholder={t("grpDescriptionPlaceholder")}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("grpDefaultPolicy")}
              </label>
              <select
                value={formData.default_policy_id}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    default_policy_id: e.target.value,
                  }))
                }
                className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              >
                <option value="">{t("grpNoDefaultPolicy")}</option>
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name || p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={() => editingGroup ? updateMutation.mutate({ id: editingGroup.id, data: formData }) : createMutation.mutate(formData)}
              disabled={createMutation.isPending || updateMutation.isPending || !formData.name}
            >
              {createMutation.isPending || updateMutation.isPending ? t("creating") : editingGroup ? "Save group" : t("grpCreateButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
