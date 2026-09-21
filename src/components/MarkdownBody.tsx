import { useMemo, useState } from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { linkifyYouTube, parseYouTubeId } from "@/lib/youtube";
import { ZoomableImage } from "@/components/ImageOverlay";
import { markdownOverlayImages, type OverlayImage } from "@/lib/images";
import { isImageAsset, isVideoAsset } from "@/lib/assets";
import { mediaOnlyMarkdown } from "@/lib/mediaOnly";
import { SortableTable } from "@/components/SortableTable";

type Asset = {
  storageId: string;
  url: string | null;
  filename: string;
  alt?: string;
  description?: string;
  contentType: string;
};

const NO_ASSETS: Asset[] = [];

function YouTubeEmbed({ id }: { id: string }) {
  return (
    <div className="yt-embed">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

function VideoAsset({
  asset,
  mediaOnly = false,
}: {
  asset: Asset & { url: string };
  mediaOnly?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const label = mediaOnly ? "Video" : (asset.alt || asset.filename).trim();
  return (
    <span className="md-video">
      <video
        controls
        playsInline
        preload="metadata"
        aria-label={label}
        onError={() => setFailed(true)}
      >
        <source src={asset.url} type={asset.contentType} />
      </video>
      {mediaOnly ? null : failed ? (
        <span className="md-video-error">
          This browser cannot play this video format. Download it or convert it to MP4/WebM.
        </span>
      ) : null}
      {!mediaOnly && asset.description ? (
        <span className="md-caption">{asset.description}</span>
      ) : null}
      {mediaOnly ? null : (
        <a href={asset.url} download={asset.filename} className="md-video-download">
          Download {asset.filename}
        </a>
      )}
    </span>
  );
}

export function MarkdownBody({
  content,
  assets = NO_ASSETS,
  gallery,
  mediaOnly = false,
}: {
  content: string;
  assets?: Asset[];
  gallery?: OverlayImage[];
  mediaOnly?: boolean;
}) {
  const byStorageId = new Map(assets.map((asset) => [asset.storageId, asset]));
  const rendered = mediaOnly ? mediaOnlyMarkdown(content) : content;
  const collected = useMemo(() => markdownOverlayImages(rendered, assets), [rendered, assets]);
  const images = gallery ?? collected;

  return (
    <div className="md">
      <Markdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (url.startsWith("convex://") ? url : defaultUrlTransform(url))}
        components={{
          table: ({ children }) => (
            <div
              className="md-table-scroll"
              role="region"
              aria-label="Scrollable table"
              tabIndex={0}
            >
              <SortableTable>{children}</SortableTable>
            </div>
          ),
          a: ({ href, children }) => {
            const storageId = href?.startsWith("convex://") ? href.slice("convex://".length) : null;
            const asset = storageId ? byStorageId.get(storageId) : undefined;
            if (asset) {
              if (!asset.url) return <>{children}</>;
              return (
                <a href={asset.url} download={asset.filename}>
                  {children}
                </a>
              );
            }
            const youtubeId = href ? parseYouTubeId(href) : null;
            if (youtubeId) {
              return <YouTubeEmbed id={youtubeId} />;
            }
            const external = href?.startsWith("http");
            return (
              <a
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noreferrer" : undefined}
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt, title }) => {
            const storageId = src?.startsWith("convex://") ? src.slice("convex://".length) : null;
            const asset = storageId ? byStorageId.get(storageId) : undefined;
            const resolved = storageId ? (asset?.url ?? undefined) : src;
            if (!resolved) return null;
            if (asset && isVideoAsset(asset.contentType)) {
              return <VideoAsset asset={{ ...asset, url: resolved }} mediaOnly={mediaOnly} />;
            }
            if (asset && !isImageAsset(asset.contentType)) {
              if (mediaOnly) return null;
              return (
                <span className="md-file">
                  <a href={resolved} download={asset.filename}>
                    Download {asset.filename}
                  </a>
                </span>
              );
            }
            const altText = mediaOnly ? "" : (asset?.alt || alt || asset?.filename || "").trim();
            const description = mediaOnly ? "" : (asset?.description || title || "").trim();
            return (
              <span className="md-image">
                <ZoomableImage src={resolved} alt={altText} gallery={images} />
                {description ? <span className="md-caption">{description}</span> : null}
              </span>
            );
          },
        }}
      >
        {linkifyYouTube(rendered)}
      </Markdown>
    </div>
  );
}
