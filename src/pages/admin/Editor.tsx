import { DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Layout } from "@/components/Layout";
import { MarkdownBody } from "@/components/MarkdownBody";
import { ZoomableImage } from "@/components/ImageOverlay";
import { AssetCaptionDialog } from "@/components/AssetCaptionDialog";
import { Button } from "@/components/ui/button";
import { assetSnippet, markdownHasStorageId, type OverlayImage } from "@/lib/images";
import { sha256Hex } from "@/lib/hash";
import { assetContentType, isArchiveAsset, isImageAsset, isVideoAsset } from "@/lib/assets";

type SaveState = "saved" | "saving" | "error";

function insertAtCursor(textarea: HTMLTextAreaElement, value: string, inserted: string) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const next = value.slice(0, start) + inserted + value.slice(end);
  const caret = start + inserted.length;
  return { next, caret };
}

export default function Editor() {
  const { id } = useParams();
  const postId = id as Id<"posts"> | undefined;
  const navigate = useNavigate();
  const convex = useConvex();
  const post = useQuery(api.posts.queries.getById, postId ? { postId } : "skip");
  const assetRows = useQuery(api.postAssets.queries.listForPost, postId ? { postId } : "skip");
  const assets = assetRows ?? [];
  const savePost = useMutation(api.posts.mutations.save);
  const setPublished = useMutation(api.posts.mutations.setPublished);
  const removePost = useMutation(api.posts.mutations.remove);
  const generateUploadUrl = useMutation(api.postAssets.mutations.generateUploadUrl);
  const saveAsset = useMutation(api.postAssets.mutations.save);
  const removeAsset = useMutation(api.postAssets.mutations.remove);
  const updateAssetText = useMutation(api.postAssets.mutations.updateText);
  const allChannels = useQuery(api.channels.queries.listAll);
  const config = useQuery(api.config.getConfig);
  const bookmarksEnabled = config?.bookmarksEnabled === true;
  const allBookmarkGroups = useQuery(
    api.bookmarkGroups.queries.listAll,
    bookmarksEnabled ? {} : "skip",
  );
  const requestAi = useMutation(api.postAi.mutations.request);
  const applyAiTitle = useMutation(api.postAi.mutations.applyTitle);
  const applyAiSummary = useMutation(api.postAi.mutations.applySummary);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [visibility, setVisibility] = useState<"listed" | "unlisted">("listed");
  const [published, setPublishedLocal] = useState(false);
  const [channelIds, setChannelIds] = useState<Id<"channels">[]>([]);
  const [bookmarkGroupIds, setBookmarkGroupIds] = useState<
    Id<"bookmarkGroups">[]
  >([]);
  const [hydrated, setHydrated] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [uploading, setUploading] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Record<string, { alt: string; description: string }>>(
    {},
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!post || hydrated) return;
    setTitle(post.title);
    setSlug(post.slug);
    setExcerpt(post.excerpt);
    setBody(post.body);
    setTagInput(post.tags.join(", "));
    setVisibility(post.visibility);
    setPublishedLocal(post.status === "published");
    setChannelIds(post.channels.map((channel) => channel._id));
    setBookmarkGroupIds(post.bookmarkGroups.map((group) => group._id));
    setHydrated(true);
  }, [post, hydrated]);

  useEffect(() => {
    if (assetRows === undefined) return;
    setCaptions((current) => {
      const next = { ...current };
      for (const asset of assetRows) {
        if (next[asset._id] === undefined) {
          next[asset._id] = {
            alt: asset.alt,
            description: asset.description,
          };
        }
      }
      return next;
    });
  }, [assetRows]);

  const tags = useMemo(
    () =>
      tagInput
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    [tagInput],
  );

  useEffect(() => {
    if (!postId || !hydrated || !dirty) return;
    const handle = window.setTimeout(() => {
      setSaveState("saving");
      void savePost({
        postId,
        title,
        slug,
        excerpt,
        body,
        visibility,
        tags,
        channelIds,
        ...(bookmarksEnabled ? { bookmarkGroupIds } : {}),
      })
        .then((result) => {
          setSlug(result.slug);
          setSaveState("saved");
          setDirty(false);
        })
        .catch(() => setSaveState("error"));
    }, 700);
    return () => window.clearTimeout(handle);
  }, [
    postId,
    hydrated,
    dirty,
    title,
    slug,
    excerpt,
    body,
    visibility,
    tags,
    channelIds,
    bookmarkGroupIds,
    bookmarksEnabled,
    savePost,
  ]);

  useEffect(() => {
    if (!hydrated || assetRows === undefined) return;
    const handle = window.setTimeout(() => {
      for (const asset of assetRows) {
        const local = captions[asset._id];
        if (!local) continue;
        if (local.alt === asset.alt && local.description === asset.description) {
          continue;
        }
        void updateAssetText({
          assetId: asset._id,
          alt: local.alt,
          description: local.description,
        });
      }
    }, 700);
    return () => window.clearTimeout(handle);
  }, [captions, hydrated, assetRows, updateAssetText]);

  function markDirty() {
    setDirty(true);
  }

  function insertMarkdown(snippet: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setBody((current) => `${current}\n${snippet}`);
      markDirty();
      return;
    }
    const { next, caret } = insertAtCursor(textarea, body, snippet);
    setBody(next);
    markDirty();
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(caret, caret);
    });
  }

  function insertAllMissing() {
    const snippets = assets
      .filter((asset) => !markdownHasStorageId(body, asset.storageId))
      .map((asset) => {
        const caption = captions[asset._id] ?? {
          alt: asset.alt,
          description: asset.description,
        };
        return assetSnippet(caption.alt || asset.filename, asset.storageId, asset.contentType);
      });
    if (snippets.length === 0) return;
    insertMarkdown(snippets.join("\n\n"));
  }

  async function onFiles(files: FileList | File[] | null) {
    if (!postId || !files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const contentType = assetContentType(file.name, file.type);
        const sha256 = await sha256Hex(file);
        const existing = await convex.query(api.postAssets.queries.findByHash, {
          postId,
          sha256,
        });
        if (existing) continue;
        const uploadUrl = await generateUploadUrl({});
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": contentType || "application/octet-stream" },
          body: file,
        });
        const json = (await response.json()) as { storageId: Id<"_storage"> };
        await saveAsset({
          postId,
          storageId: json.storageId,
          filename: file.name,
          contentType,
          sha256,
        });
      }
    } finally {
      setUploading(false);
    }
  }

  function onDropEditor(event: DragEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    const snippet = event.dataTransfer.getData("text/plain");
    if (snippet) insertMarkdown(snippet);
  }

  if (post === undefined) {
    return (
      <Layout variant="workspace">
        <p className="p-4 text-sm text-muted">Loading...</p>
      </Layout>
    );
  }

  if (post === null || !postId) {
    return (
      <Layout variant="workspace">
        <p className="p-4 text-sm text-muted">Post not found.</p>
      </Layout>
    );
  }

  const editingAsset = assets.find((asset) => asset._id === editingAssetId);
  const editingCaption = editingAsset
    ? (captions[editingAsset._id] ?? {
        alt: editingAsset.alt,
        description: editingAsset.description,
      })
    : null;
  const gallery: OverlayImage[] = assets.flatMap((asset) => {
    if (!asset.url || !isImageAsset(asset.contentType)) return [];
    const caption = captions[asset._id];
    return [
      {
        src: asset.url,
        alt: caption?.alt || asset.alt || asset.filename,
      },
    ];
  });

  return (
    <Layout variant="workspace">
      <div className="grid h-full min-h-0 grid-cols-4">
        <div className="col-span-3 min-h-0 overflow-y-auto px-6 py-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-sm">
              <Link to="/admin" className="text-muted hover:text-foreground">
                All posts
              </Link>
              <Link to={`/posts/${post.slug}`} className="text-muted hover:text-foreground">
                View post →
              </Link>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted">
                {saveState === "saving"
                  ? "Saving..."
                  : saveState === "error"
                    ? "Save failed"
                    : "Saved"}
              </span>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={visibility === "unlisted"}
                  onChange={(event) => {
                    setVisibility(event.target.checked ? "unlisted" : "listed");
                    markDirty();
                  }}
                />
                Unlisted
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setPublishedLocal(next);
                    void setPublished({
                      postId,
                      published: next,
                    });
                  }}
                />
                Published
              </label>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (!window.confirm("Delete this post?")) return;
                  void removePost({ postId }).then(() => navigate("/admin"));
                }}
              >
                Delete
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                markDirty();
              }}
              placeholder="Title"
              className="w-full border-0 bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted"
            />
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">AI title & summary</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={post.ai?.status === "pending"}
                  onClick={() => void requestAi({ postId })}
                >
                  {post.ai?.status === "pending" ? "Generating..." : "Generate"}
                </Button>
              </div>
              {post.ai?.status === "error" ? (
                <p className="text-xs text-destructive">{post.ai.error}</p>
              ) : null}
              {post.ai?.status === "ready" ? (
                <div className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs text-muted">Suggested titles</p>
                    <div className="flex flex-wrap gap-2">
                      {post.ai.titles.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          className="rounded-full border border-border px-3 py-1 text-left text-xs hover:bg-secondary"
                          onClick={() => {
                            setTitle(suggestion);
                            markDirty();
                            void applyAiTitle({ postId, title: suggestion });
                          }}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                  {post.ai.summary ? (
                    <div>
                      <p className="mb-1 text-xs text-muted">Recommended summary</p>
                      <p className="text-sm">{post.ai.summary}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <button
                          type="button"
                          className="text-accent"
                          onClick={() => {
                            setExcerpt(post.ai?.summary ?? "");
                            markDirty();
                            void applyAiSummary({ postId, asExcerpt: true });
                          }}
                        >
                          Use as excerpt
                        </button>
                        <span className="text-muted">
                          Saved on the post{post.aiSummary ? " (current)" : ""}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : post.aiSummary ? (
                <p className="text-sm text-muted">{post.aiSummary}</p>
              ) : (
                <p className="text-xs text-muted">
                  Generates title options and a summary via the Convex AI Gateway.
                </p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-muted">
                Slug
                <input
                  value={slug}
                  onChange={(event) => {
                    setSlug(event.target.value);
                    markDirty();
                  }}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <div className="block text-xs text-muted">
                Tags
                <div className="mt-1 flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input bg-card px-2 py-1">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground hover:bg-border"
                      onClick={() => {
                        setTagInput(tags.filter((item) => item !== tag).join(", "));
                        markDirty();
                      }}
                    >
                      {tag} ×
                    </button>
                  ))}
                  <input
                    value={tagDraft}
                    onChange={(event) => setTagDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        const piece = tagDraft.trim();
                        if (piece && !tags.includes(piece)) {
                          setTagInput([...tags, piece].join(", "));
                          markDirty();
                        }
                        setTagDraft("");
                      }
                      if (event.key === "Backspace" && tagDraft === "" && tags.length > 0) {
                        setTagInput(tags.slice(0, -1).join(", "));
                        markDirty();
                      }
                    }}
                    placeholder={tags.length === 0 ? "Add tag" : ""}
                    className="h-7 min-w-24 flex-1 bg-transparent text-sm text-foreground outline-none"
                  />
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted">Channels</p>
              <p className="mt-1 text-xs text-muted">
                None selected means everyone can see this post, including people who are not signed
                in.
              </p>
              {allChannels === undefined ? (
                <p className="mt-2 text-xs text-muted">Loading channels...</p>
              ) : allChannels.length === 0 ? (
                <p className="mt-2 text-xs text-muted">
                  No channels yet. Create them under Channels.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-3">
                  {allChannels.map((channel) => {
                    const checked = channelIds.includes(channel._id);
                    return (
                      <label key={channel._id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            setChannelIds((current) =>
                              event.target.checked
                                ? [...current, channel._id]
                                : current.filter((id) => id !== channel._id),
                            );
                            markDirty();
                          }}
                        />
                        {channel.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            {bookmarksEnabled ? (
              <div>
                <p className="text-xs text-muted">Bookmark groups</p>
                <p className="mt-1 text-xs text-muted">
                  Listed published posts in these groups appear in the reader
                  sidebar.
                </p>
                {allBookmarkGroups === undefined ? (
                  <p className="mt-2 text-xs text-muted">Loading groups...</p>
                ) : allBookmarkGroups.length === 0 ? (
                  <p className="mt-2 text-xs text-muted">
                    No groups yet. Create them under Bookmarks.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {allBookmarkGroups.map((group) => {
                      const checked = bookmarkGroupIds.includes(group._id);
                      return (
                        <label key={group._id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              setBookmarkGroupIds((current) =>
                                event.target.checked
                                  ? [...current, group._id]
                                  : current.filter((id) => id !== group._id),
                              );
                              markDirty();
                            }}
                          />
                          {group.name}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
            <label className="block text-xs text-muted">
              Excerpt
              <textarea
                value={excerpt}
                onChange={(event) => {
                  setExcerpt(event.target.value);
                  markDirty();
                }}
                rows={2}
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                onClick={() => setMode("write")}
                className={mode === "write" ? "font-medium" : "text-muted"}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setMode("preview")}
                className={mode === "preview" ? "font-medium" : "text-muted"}
              >
                Preview
              </button>
            </div>
            {mode === "write" ? (
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(event) => {
                  setBody(event.target.value);
                  markDirty();
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onDropEditor}
                placeholder="Write markdown. Drag media from Content, or paste a YouTube URL on its own line."
                className="min-h-[70vh] w-full rounded-xl border border-input bg-card px-4 py-3 font-mono text-sm leading-6 outline-none focus:ring-2 focus:ring-ring"
              />
            ) : (
              <div className="min-h-[70vh] rounded-xl border border-border bg-card px-6 py-5">
                <MarkdownBody content={body} assets={assets} />
              </div>
            )}
          </div>
        </div>

        <aside className="col-span-1 flex min-h-0 flex-col border-l border-border bg-card">
          <div className="shrink-0 border-b border-border p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Content</h2>
              <div className="flex items-center gap-2">
                {assets.length > 0 ? (
                  <button
                    type="button"
                    disabled={assets.every((asset) => markdownHasStorageId(body, asset.storageId))}
                    className="text-xs text-accent disabled:text-muted"
                    onClick={insertAllMissing}
                  >
                    Add all
                  </button>
                ) : null}
                {uploading ? <span className="text-xs text-muted">Uploading...</span> : null}
              </div>
            </div>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDropping(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                setDropping(true);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                setDropping(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDropping(false);
                const files = event.dataTransfer.files;
                if (files.length > 0) void onFiles(files);
              }}
              className={`w-full rounded-lg border border-dashed px-2 py-4 text-center text-xs ${
                dropping
                  ? "border-accent bg-secondary text-foreground"
                  : "border-input text-muted hover:border-accent hover:text-foreground"
              }`}
            >
              Drop images, videos, or ZIP files here, or click to upload.
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo,video/x-m4v,.mov,.avi,.m4v,.zip,application/zip"
              multiple
              className="hidden"
              onChange={(event) => {
                void onFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {assetRows === undefined ? (
              <p className="text-xs text-muted">Loading files...</p>
            ) : assets.length === 0 ? (
              <p className="text-xs text-muted">No files yet.</p>
            ) : (
              <ul className="space-y-2">
                {assets.map((asset) => {
                  const caption = captions[asset._id] ?? {
                    alt: asset.alt,
                    description: asset.description,
                  };
                  const snippet = assetSnippet(
                    caption.alt || asset.filename,
                    asset.storageId,
                    asset.contentType,
                  );
                  const isCover = post.coverImageId === asset.storageId;
                  const inBody = markdownHasStorageId(body, asset.storageId);
                  return (
                    <li key={asset._id} className="rounded-md border border-border p-1.5">
                      {asset.url && isVideoAsset(asset.contentType) ? (
                        <video
                          src={asset.url}
                          controls
                          playsInline
                          preload="metadata"
                          className="mb-1 h-24 w-full rounded bg-black object-contain"
                        />
                      ) : asset.url && isArchiveAsset(asset.contentType) ? (
                        <a
                          href={asset.url}
                          download={asset.filename}
                          className="mb-1 block rounded bg-muted px-2 py-4 text-center text-xs text-accent"
                        >
                          Download ZIP
                        </a>
                      ) : asset.url ? (
                        <ZoomableImage
                          src={asset.url}
                          alt={caption.alt || asset.filename}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/plain", snippet);
                            event.dataTransfer.effectAllowed = "copy";
                          }}
                          className="mb-1 h-14 w-full rounded object-cover"
                          gallery={gallery}
                        />
                      ) : null}
                      <p className="truncate text-[11px] text-muted">{asset.filename}</p>
                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px]">
                        <button
                          type="button"
                          className={inBody ? "text-purple-700" : "text-accent"}
                          onClick={() => insertMarkdown(snippet)}
                        >
                          Insert
                        </button>
                        {isImageAsset(asset.contentType) ? (
                          <button
                            type="button"
                            className="text-muted hover:text-foreground"
                            onClick={() => {
                              void savePost({
                                postId,
                                title,
                                slug,
                                excerpt,
                                body,
                                visibility,
                                tags,
                                channelIds,
                                ...(bookmarksEnabled ? { bookmarkGroupIds } : {}),
                                coverImageId: isCover ? null : asset.storageId,
                              });
                            }}
                          >
                            {isCover ? "Remove cover" : "Set cover"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="text-muted hover:text-foreground"
                          onClick={() => setEditingAssetId(asset._id)}
                        >
                          Alt
                        </button>
                        <button
                          type="button"
                          className="text-destructive"
                          onClick={() => void removeAsset({ assetId: asset._id })}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
      {editingAsset && editingCaption ? (
        <AssetCaptionDialog
          filename={editingAsset.filename}
          alt={editingCaption.alt}
          description={editingCaption.description}
          onAltChange={(alt) => {
            setCaptions((current) => ({
              ...current,
              [editingAsset._id]: { ...editingCaption, alt },
            }));
          }}
          onDescriptionChange={(description) => {
            setCaptions((current) => ({
              ...current,
              [editingAsset._id]: { ...editingCaption, description },
            }));
          }}
          onClose={() => setEditingAssetId(null)}
        />
      ) : null}
    </Layout>
  );
}
