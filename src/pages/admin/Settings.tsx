import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ThemeSelect } from "@/components/ThemeSelect";
import type { ThemeId } from "@/lib/themes";
import type { FeatureMode } from "@/lib/features";

export default function AdminSettings() {
  const config = useQuery(api.config.getConfig);
  const setRequireAuth = useMutation(api.siteSettings.mutations.setRequireAuth);
  const setSignInMethods = useMutation(api.siteSettings.mutations.setSignInMethods);
  const setFeatures = useMutation(api.features.mutations.set);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, work: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await work();
    } catch (caught) {
      setError(settingErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  const features = config?.features;
  const requireAuth = config?.requireAuth ?? false;
  const googleOn = config?.googleAuthEnabled === true;
  const passwordOn = config?.passwordAuthEnabled === true;
  const onlyGoogle = googleOn && !passwordOn;
  const onlyPassword = passwordOn && !googleOn;

  return (
    <Layout>
      <div className="min-h-[32rem] space-y-4">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight">
            Settings
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Site-wide switches. Off features hide their UI and skip extra queries.
          </p>
        </div>

        {config === undefined || features === undefined ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <SettingRow
              title="Theme"
              description="One palette for every visitor. Off uses Paper. Pick a theme to preview its colors."
            >
              <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                <OnOff
                  on={features.theme.enabled}
                  disabled={busy !== null}
                  onClick={() =>
                    void run("theme", () =>
                      setFeatures({ themeEnabled: !features.theme.enabled }),
                    )
                  }
                />
                <ThemeSelect
                  value={features.theme.id}
                  disabled={busy !== null || !features.theme.enabled}
                  onChange={(themeId) =>
                    void run(`theme-${themeId}`, () =>
                      setFeatures({ themeId: themeId as ThemeId }),
                    )
                  }
                />
              </div>
            </SettingRow>

            <SettingRow
              title="Google sign-in"
              description={
                config.googleAuthAvailable
                  ? onlyGoogle
                    ? "Show Continue with Google. This is the only sign-in method on, so it cannot be turned off."
                    : "Show Continue with Google. Only existing users can sign in; create or invite them first."
                  : "Unavailable until AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are set on the deployment."
              }
            >
              <OnOff
                on={googleOn}
                disabled={busy !== null || !config.googleAuthAvailable || onlyGoogle}
                onClick={() =>
                  void run("google", () =>
                    setSignInMethods({ googleSignIn: !googleOn }),
                  )
                }
              />
            </SettingRow>

            <SettingRow
              title="Password sign-in"
              description={
                config.passwordAuthAvailable
                  ? onlyPassword
                    ? "Show the email and password form. This is the only sign-in method on, so it cannot be turned off."
                    : "Show the email and password form. Turn off to require Google for everyone."
                  : "Unavailable until AUTH_PASSWORD_ENABLED is true on the deployment."
              }
            >
              <OnOff
                on={passwordOn}
                disabled={busy !== null || !config.passwordAuthAvailable || onlyPassword}
                onClick={() =>
                  void run("password", () =>
                    setSignInMethods({ passwordSignIn: !passwordOn }),
                  )
                }
              />
            </SettingRow>

            <SettingRow
              title="Require sign-in"
              description="Signed-out visitors go to sign-in; public reads come back empty. API keys still work."
            >
              <OnOff
                on={requireAuth}
                onLabel="Private"
                offLabel="Public"
                danger={requireAuth}
                disabled={busy !== null}
                onClick={() =>
                  void run("auth", () =>
                    setRequireAuth({ requireAuth: !requireAuth }),
                  )
                }
              />
            </SettingRow>

            <SettingRow
              title="Bookmarks"
              description="Admin-curated groups as a left rail on reader pages. Hidden posts stay hidden. Admin only: rail is visible to admins."
            >
              <ModePicker
                value={features.bookmarks}
                disabled={busy !== null}
                onChange={(bookmarks) =>
                  void run(`bookmarks-${bookmarks}`, () => setFeatures({ bookmarks }))
                }
              />
            </SettingRow>

            <SettingRow
              title="Timings"
              description="Home list shows age of the first post (“N ago”) and gaps between later posts (“earlier”). Admin only: admins see it."
            >
              <ModePicker
                value={features.timings}
                disabled={busy !== null}
                onChange={(timings) =>
                  void run(`timings-${timings}`, () => setFeatures({ timings }))
                }
              />
            </SettingRow>

            <SettingRow
              title="Calendar"
              description="Adds /calendar and a header link. Month view with per-day counts, chart, and table. Admin only: hidden from readers."
            >
              <ModePicker
                value={features.calendar}
                disabled={busy !== null}
                onChange={(calendar) =>
                  void run(`calendar-${calendar}`, () => setFeatures({ calendar }))
                }
              />
            </SettingRow>

            <SettingRow
              title="Infinite scroll"
              description="Home loads the next page at the bottom. Search stays a single result set. Admin only: readers still use Load more."
            >
              <ModePicker
                value={features.infiniteScroll}
                disabled={busy !== null}
                onChange={(infiniteScroll) =>
                  void run(`scroll-${infiniteScroll}`, () =>
                    setFeatures({ infiniteScroll }),
                  )
                }
              />
            </SettingRow>

            <SettingRow
              title="Images only"
              description="Signed-out visitors see titles, descriptions, and media. Body text stays hidden until sign-in."
            >
              <OnOff
                on={features.imagesOnly}
                disabled={busy !== null}
                onClick={() =>
                  void run("images", () =>
                    setFeatures({ imagesOnly: !features.imagesOnly }),
                  )
                }
              />
            </SettingRow>

            <SettingRow
              title="Post sort order"
              description="Home, tags, previous/next, and admin posts. Default is creation time."
              last
            >
              <div className="flex flex-wrap justify-end gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={features.sortOrder === "created" ? "default" : "outline"}
                  disabled={busy !== null}
                  onClick={() =>
                    void run("sort-created", () =>
                      setFeatures({ sortOrder: "created" }),
                    )
                  }
                >
                  Created
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={features.sortOrder === "updated" ? "default" : "outline"}
                  disabled={busy !== null}
                  onClick={() =>
                    void run("sort-updated", () =>
                      setFeatures({ sortOrder: "updated" }),
                    )
                  }
                >
                  Last updated
                </Button>
              </div>
            </SettingRow>
          </div>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </Layout>
  );
}

function settingErrorMessage(caught: unknown): string {
  const raw = caught instanceof Error ? caught.message : "Could not save the setting";
  const inner = raw.match(/\]\s*([\s\S]*?)\s*(?:\n\s*Called by client)?$/);
  if (inner?.[1]) {
    return inner[1].replace(/\n\s*Called by client\s*$/, "").trim();
  }
  return raw.replace(/\n\s*Called by client\s*$/, "").trim();
}

function SettingRow({
  title,
  description,
  children,
  last = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
        last ? "" : "border-b border-border"
      }`}
    >
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-muted">{description}</p>
      </div>
      <div className="min-w-0 sm:justify-self-end">{children}</div>
    </div>
  );
}

function ModePicker({
  value,
  disabled,
  onChange,
}: {
  value: FeatureMode;
  disabled: boolean;
  onChange: (value: FeatureMode) => void;
}) {
  const options: Array<{ id: FeatureMode; label: string }> = [
    { id: "off", label: "Off" },
    { id: "on", label: "On" },
    { id: "adminOnly", label: "Admin only" },
  ];
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {options.map((option) => (
        <Button
          key={option.id}
          type="button"
          size="sm"
          variant={value === option.id ? "default" : "outline"}
          disabled={disabled}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function OnOff({
  on,
  onLabel = "On",
  offLabel = "Off",
  danger = false,
  disabled,
  onClick,
}: {
  on: boolean;
  onLabel?: string;
  offLabel?: string;
  danger?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={on ? "outline" : "default"}
      disabled={disabled}
      className={danger ? "text-destructive" : undefined}
      onClick={onClick}
    >
      {on ? onLabel : offLabel}
    </Button>
  );
}
