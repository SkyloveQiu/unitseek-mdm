import { Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { LoginPage } from "@/features/auth/login-page";
import { RegisterPage } from "@/features/auth/register-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { DevicesPage } from "@/features/devices/devices-page";
import { PoliciesPage } from "@/features/policies/policies-page";
import { PolicyEditor } from "@/features/policies/policy-editor";
import { EnrollmentPage } from "@/features/enrollment/enrollment-page";
import { GroupsPage } from "@/features/groups/groups-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { GeneralSettingsPage } from "@/features/settings/general-settings";
import { TenantSettingsPage } from "@/features/settings/tenant-settings";
import { ApplicationsPage } from "@/features/applications/applications-page";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="applications" element={<ApplicationsPage />} />
        <Route path="policies" element={<PoliciesPage />} />
        <Route path="policies/new" element={<PolicyEditor />} />
        <Route path="policies/:id" element={<PolicyEditor />} />
        <Route path="enrollment" element={<EnrollmentPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/general" element={<GeneralSettingsPage />} />
        <Route path="settings/tenant" element={<TenantSettingsPage />} />
      </Route>
    </Routes>
  );
}
