import { useNavigate } from "react-router-dom";
import {
  Settings,
  Building2,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/hooks/use-language";

export function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const settingsSections = [
    {
      title: t("setGeneral"),
      description: t("setGeneralDesc"),
      icon: Settings,
      color: "text-primary-600",
      bgColor: "bg-primary-50 dark:bg-primary-900/30",
      path: "/settings/general",
    },
    {
      title: t("setTenant"),
      description: t("setTenantDesc"),
      icon: Building2,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50 dark:bg-emerald-900/30",
      path: "/settings/tenant",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t("setTitle")}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t("setSubtitle")}
        </p>
      </div>

      {/* Settings grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingsSections.map((section) => (
          <Card
            key={section.path}
            className="hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigate(section.path)}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-lg ${section.bgColor} flex-shrink-0`}
                >
                  <section.icon className={`h-5 w-5 ${section.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {section.title}
                    </h3>
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {section.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
