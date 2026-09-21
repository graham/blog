import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { THEMES, type ThemeId } from "@/lib/themes";

export default function AdminSettings() {
  const config = useQuery(api.config.getConfig);
  const setRequireAuth = useMutation(api.siteSettings.mutations.setRequireAuth);
  const setFeatures = useMutation(api.features.mutations.set);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, work: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await work();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save the setting",
      );
    } finally {
      setBusy(null);
    }
  }

  const features = config?.features;
  const requireAuth = config?.requireAuth ?? false;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight">
            Settings
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Site-wide switches. Every reader sees the same combination. While a
            feature is off, its UI is hidden and its extra Convex queries are
            not run.
          </p>
        </div>

        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div>
            <h2 className="font-medium">Require sign-in to read</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Private-site mode. Signed-out visitors are sent to sign-in and
              every public read (timeline, posts, tags, search, calendar) comes
              back empty. API keys still work. Channel membership still applies
              on top for signed-in readers.
            </p>
          </div>
          {config === undefined ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : (
            <ToggleRow
              on={requireAuth}
              onLabel="Private: sign-in required"
              offLabel="Public: anyone can read"
              actionLabel={requireAuth ? "Make site public" : "Require sign-in"}
              danger={requireAuth}
              disabled={busy !== null}
              onClick={() =>
                void run("auth", () => setRequireAuth({ requireAuth: !requireAuth }))
              }
            />
          )}
        </section>

        <div>
          <h2 className="font-sans text-xl font-semibold tracking-tight">
            Features
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            These flags are the public <code className="text-foreground">features</code>{" "}
            JSON every page already reads. Turn one on only if you want that
            surface live.
          </p>
        </div>

        {features === undefined ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : (
          <div className="space-y-4">
            <FeatureCard
              title="Bookmarks"
              on={features.bookmarks}
              disabled={busy !== null}
              onClick={() =>
                void run("bookmarks", () =>
                  setFeatures({ bookmarks: !features.bookmarks }),
                )
              }
            >
              <p>
                Lets administrators group published posts into named lists
                (for example Favorites). Those lists show as a sparse left rail
                on home, post, and tag pages, and below the article on small
                screens.
              </p>
              <p>
                Only listed, published posts a given reader can already open
                appear. Drafts, unlisted posts, and channel-private posts stay
                hidden. Off: the rail, the Bookmarks admin pages, and the editor
                checkboxes are hidden; bookmark queries are skipped.
              </p>
            </FeatureCard>

            <FeatureCard
              title="Timings"
              on={features.timings}
              disabled={busy !== null}
              onClick={() =>
                void run("timings", () =>
                  setFeatures({ timings: !features.timings }),
                )
              }
            >
              <p>
                On the home timeline (<code className="text-foreground">/</code>
                ), a quiet line above the first post names how old it is (“3 days
                ago”). Between later posts it names the gap (“2 hours earlier”).
              </p>
              <p>
                Uses each post’s publish time. Search results are unchanged. Off:
                the home list is only titles, dates, and excerpts, with no extra
                query.
              </p>
            </FeatureCard>

            <FeatureCard
              title="Calendar"
              on={features.calendar}
              disabled={busy !== null}
              onClick={() =>
                void run("calendar", () =>
                  setFeatures({ calendar: !features.calendar }),
                )
              }
            >
              <p>
                Adds a <code className="text-foreground">/calendar</code> page
                and a Calendar link in the header. The page is a month calendar:
                each day shows how many listed published posts went up that day,
                with a total for each week and for the month. Click a day for an
                hourly bar chart and a table (time, title, slug), not the usual
                card list on home.
              </p>
              <p>
                Previous/next month buttons move the calendar. Channel rules
                still apply. Off: the route redirects home and the month query
                is skipped.
              </p>
            </FeatureCard>

            <FeatureCard
              title="Infinite scroll"
              on={features.infiniteScroll}
              disabled={busy !== null}
              onClick={() =>
                void run("scroll", () =>
                  setFeatures({ infiniteScroll: !features.infiniteScroll }),
                )
              }
            >
              <p>
                On home, reaching the bottom of the timeline loads the next page
                of posts automatically. The Load more button is hidden while this
                is on.
              </p>
              <p>
                Search still returns one result set and does not keep loading.
                Off: readers use Load more as before.
              </p>
            </FeatureCard>

            <FeatureCard
              title="Images only"
              on={features.imagesOnly}
              disabled={busy !== null}
              onClick={() =>
                void run("images", () =>
                  setFeatures({ imagesOnly: !features.imagesOnly }),
                )
              }
            >
              <p>
                Signed-out visitors still see titles and descriptions, plus
                images and videos. Body text, tags, and captions are hidden.
                The public queries strip that body prose too.
              </p>
              <p>
                Anyone who signs in still sees the full post. Off: everyone sees
                the usual text.
              </p>
            </FeatureCard>

            <section className="space-y-4 rounded-xl border border-border bg-card p-5">
              <div>
                <h3 className="font-medium">Theme</h3>
                <div className="mt-2 max-w-2xl space-y-2 text-sm text-muted">
                  <p>
                    Recolors the whole site: page background, text, cards,
                    borders, links, and markdown. One theme at a time, for every
                    visitor. Paper is the built-in look when this is off.
                  </p>
                  <p>
                    Turn the feature on, then pick a palette. Off: theme CSS is
                    not applied and the picker is hidden.
                  </p>
                </div>
              </div>
              <ToggleRow
                on={features.theme.enabled}
                onLabel="On"
                offLabel="Off"
                actionLabel={features.theme.enabled ? "Turn off" : "Turn on"}
                disabled={busy !== null}
                onClick={() =>
                  void run("theme", () =>
                    setFeatures({ themeEnabled: !features.theme.enabled }),
                  )
                }
              />
              {features.theme.enabled ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {THEMES.map((theme) => {
                    const selected = features.theme.id === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          void run(`theme-${theme.id}`, () =>
                            setFeatures({ themeId: theme.id as ThemeId }),
                          )
                        }
                        className={`flex gap-3 rounded-xl border px-3 py-3 text-left ${
                          selected
                            ? "border-foreground"
                            : "border-border hover:border-foreground/40"
                        }`}
                      >
                        <span
                          className="mt-0.5 h-10 w-10 shrink-0 rounded-md border border-border"
                          style={{ background: theme.swatch }}
                        />
                        <span>
                          <span className="block text-sm font-medium">
                            {theme.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted">
                            {theme.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>
          </div>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </Layout>
  );
}

function ToggleRow({
  on,
  onLabel,
  offLabel,
  actionLabel,
  danger,
  disabled,
  onClick,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
  actionLabel: string;
  danger?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <span
        className={`text-sm font-medium ${
          danger ? "text-destructive" : on ? "text-foreground" : "text-muted"
        }`}
      >
        {on ? onLabel : offLabel}
      </span>
      <Button type="button" variant={on ? "outline" : "default"} disabled={disabled} onClick={onClick}>
        {actionLabel}
      </Button>
    </div>
  );
}

function FeatureCard({
  title,
  on,
  disabled,
  onClick,
  children,
}: {
  title: string;
  on: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h3 className="font-medium">{title}</h3>
        <div className="mt-2 max-w-2xl space-y-2 text-sm text-muted">{children}</div>
      </div>
      <ToggleRow
        on={on}
        onLabel="On"
        offLabel="Off"
        actionLabel={on ? "Turn off" : "Turn on"}
        disabled={disabled}
        onClick={onClick}
      />
    </section>
  );
}
