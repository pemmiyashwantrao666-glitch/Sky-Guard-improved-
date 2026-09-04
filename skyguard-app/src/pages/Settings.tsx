import { useState } from "react";
import { motion } from "framer-motion";
import { User, Users, Bell, Shield, Globe, Save, CheckCircle2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-blue focus-visible:ring-offset-2",
        checked ? "bg-deep-atmo" : "bg-cloud-grey"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

const initialProfile = {
  name: "Alex Mercer",
  email: "alex.mercer@skyguard.ai",
  role: "Operations Lead",
};

const initialPreferences = {
  unitSystem: "metric",
  timezone: "UTC",
  dateFormat: "YYYY-MM-DD",
};

const initialNotifications = {
  emailAlerts: true,
  pushNotifications: false,
  severityThreshold: "warning",
};

const initialDataSources = {
  stationGroups: "global-north",
  retentionDays: "90",
};

const initialSecurity = {
  sessionTimeout: "30",
  twoFactor: false,
};

export function Settings() {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState(initialProfile);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [dataSources, setDataSources] = useState(initialDataSources);
  const [security, setSecurity] = useState(initialSecurity);
  const [roles, setRoles] = useState({ "Alex Mercer": "Operations Lead", "Priya Kumar": "Analyst", "Rohan Sharma": "Field Technician" });

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      <div>
        <motion.h1
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-serif text-2xl font-bold text-ink-navy"
        >
          Settings
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-1 text-sm text-graphite/60"
        >
          Manage your workspace preferences and configurations.
        </motion.p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <motion.section
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-deep-atmo" />
                  <CardTitle>Profile</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-graphite">
                      Full Name
                    </label>
                    <Input
                      value={profile.name}
                      onChange={(e) =>
                        setProfile({ ...profile, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-graphite">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={profile.email}
                      onChange={(e) =>
                        setProfile({ ...profile, email: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-graphite">
                    Role
                  </label>
                  <Input value={profile.role} disabled />
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-deep-atmo" />
                  <CardTitle>Preferences</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-graphite">
                      Unit System
                    </label>
                    <select
                      value={preferences.unitSystem}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          unitSystem: e.target.value,
                        })
                      }
                      className="flex h-10 w-full rounded-lg border border-cloud-grey bg-white px-3 py-2 text-sm text-graphite transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-blue focus-visible:ring-offset-2"
                    >
                      <option value="metric">Metric</option>
                      <option value="imperial">Imperial</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-graphite">
                      Timezone
                    </label>
                    <select
                      value={preferences.timezone}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          timezone: e.target.value,
                        })
                      }
                      className="flex h-10 w-full rounded-lg border border-cloud-grey bg-white px-3 py-2 text-sm text-graphite transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-blue focus-visible:ring-offset-2"
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="Asia/Tokyo">Asia/Tokyo</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-graphite">
                      Date Format
                    </label>
                    <select
                      value={preferences.dateFormat}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          dateFormat: e.target.value,
                        })
                      }
                      className="flex h-10 w-full rounded-lg border border-cloud-grey bg-white px-3 py-2 text-sm text-graphite transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-blue focus-visible:ring-offset-2"
                    >
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-deep-atmo" />
                  <CardTitle>Notifications</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-cloud-grey bg-white/60 p-4">
                  <div>
                    <p className="text-sm font-medium text-graphite">
                      Email Alerts
                    </p>
                    <p className="text-xs text-graphite/60">
                      Receive alert digests via email
                    </p>
                  </div>
                  <Toggle
                    checked={notifications.emailAlerts}
                    onChange={(value) =>
                      setNotifications({ ...notifications, emailAlerts: value })
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-cloud-grey bg-white/60 p-4">
                  <div>
                    <p className="text-sm font-medium text-graphite">
                      Push Notifications
                    </p>
                    <p className="text-xs text-graphite/60">
                      Browser and mobile push alerts
                    </p>
                  </div>
                  <Toggle
                    checked={notifications.pushNotifications}
                    onChange={(value) =>
                      setNotifications({
                        ...notifications,
                        pushNotifications: value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-graphite">
                    Minimum Severity Threshold
                  </label>
                  <select
                    value={notifications.severityThreshold}
                    onChange={(e) =>
                      setNotifications({
                        ...notifications,
                        severityThreshold: e.target.value,
                      })
                    }
                    className="flex h-10 w-full rounded-lg border border-cloud-grey bg-white px-3 py-2 text-sm text-graphite transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-blue focus-visible:ring-offset-2"
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-deep-atmo" />
                  <CardTitle>Data Sources</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-graphite">
                    Station Group
                  </label>
                  <select
                    value={dataSources.stationGroups}
                    onChange={(e) =>
                      setDataSources({
                        ...dataSources,
                        stationGroups: e.target.value,
                      })
                    }
                    className="flex h-10 w-full rounded-lg border border-cloud-grey bg-white px-3 py-2 text-sm text-graphite transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-blue focus-visible:ring-offset-2"
                  >
                    <option value="global-north">Global North</option>
                    <option value="global-south">Global South</option>
                    <option value="asia-pacific">Asia Pacific</option>
                    <option value="europe">Europe</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-graphite">
                    Data Retention (days)
                  </label>
                  <Input
                    type="number"
                    value={dataSources.retentionDays}
                    onChange={(e) =>
                      setDataSources({
                        ...dataSources,
                        retentionDays: e.target.value,
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-deep-atmo" />
                  <CardTitle>Security</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-graphite">
                    Session Timeout (minutes)
                  </label>
                  <Input
                    type="number"
                    value={security.sessionTimeout}
                    onChange={(e) =>
                      setSecurity({
                        ...security,
                        sessionTimeout: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-cloud-grey bg-white/60 p-4">
                  <div>
                    <p className="text-sm font-medium text-graphite">
                      Two-Factor Authentication
                    </p>
                    <p className="text-xs text-graphite/60">
                      Add an extra layer of account security
                    </p>
                  </div>
                  <Toggle
                    checked={security.twoFactor}
                    onChange={(value) =>
                      setSecurity({ ...security, twoFactor: value })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-deep-atmo" />
                  <CardTitle>Users & Roles</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(roles).map(([name, role]) => (
                  <div key={name} className="flex flex-col gap-2 rounded-lg border border-cloud-grey bg-white/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="text-sm font-medium text-graphite">{name}</p><p className="text-xs text-graphite/60">Workspace member</p></div>
                    <select value={role} onChange={(event) => setRoles((current) => ({ ...current, [name]: event.target.value }))} className="h-9 rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite">
                      <option>Operations Lead</option><option>Analyst</option><option>Field Technician</option><option>Viewer</option>
                    </select>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.section>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2"
            >
              {saved ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </>
              )}
            </Button>
            {saved && (
              <motion.span
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-sm text-healthy-green"
              >
                Preferences updated successfully.
              </motion.span>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <motion.aside
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-graphite/70">
                <p>
                  Changes are applied immediately after saving. Some settings
                  may require a re-authentication.
                </p>
                <p>
                  Data retention affects how long raw telemetry is queryable in
                  the Analytics panel.
                </p>
              </CardContent>
            </Card>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
