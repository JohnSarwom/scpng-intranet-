import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download, FileText, Loader2, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Attachment, labels, type Stage } from "@/types/newsletter";
import { NewsletterService } from "@/services/newsletterService";
import { useState } from "react";

export const panel =
  "rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-gray-800";
export const primary =
  "bg-intranet-primary text-white hover:bg-intranet-primary/90";
export const newsletterDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en-PG", {
      dateStyle: "medium",
      timeZone: "Pacific/Port_Moresby",
    }).format(new Date(value))
    : "—";
export function StatusBadge({ status }: { status: Stage }) {
  const tone = ["published", "approved"].includes(status)
    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
    : ["returned", "rejected", "withdrawn"].includes(status)
    ? "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
    : ["draft", "archived"].includes(status)
    ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
    : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}
    >
      {labels[status]}
    </span>
  );
}
export function NewsletterLoading() {
  return (
    <div className="flex items-center justify-center gap-3 py-20" role="status">
      <Loader2 className="h-5 w-5 animate-spin" />Loading newsletters…
    </div>
  );
}
export function NewsletterSetup() {
  return (
    <div className={panel}>
      <Newspaper className="mb-4 h-8 w-8 text-intranet-primary" />
      <h2 className="text-xl font-semibold">
        Newsletter workspace is being prepared
      </h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        The submission and publishing service needs to be connected before staff
        can use this workspace. Your existing news and announcements remain
        available.
      </p>
      <Button asChild variant="outline" className="mt-5">
        <Link to="/news">Back to News & Announcements</Link>
      </Button>
    </div>
  );
}
export function NewsletterError(
  { error, retry }: { error: string; retry?: () => void },
) {
  return (
    <div
      className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
      role="alert"
    >
      <p>{error}</p>
      {retry && (
        <Button variant="outline" onClick={retry} className="mt-3">
          Try again
        </Button>
      )}
    </div>
  );
}
export function NewsletterBody({ body }: { body: string }) {
  return (
    <div className="space-y-5 text-base leading-8 text-gray-700 dark:text-gray-200 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:pt-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:text-xl [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-intranet-primary [&_a]:underline dark:[&_a]:text-rose-300 [&_blockquote]:border-l-4 [&_blockquote]:border-intranet-primary [&_blockquote]:bg-rose-50 [&_blockquote]:p-4 dark:[&_blockquote]:bg-white/5 [&_img]:max-w-full [&_table]:block [&_table]:overflow-x-auto">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: ({ alt }) => (
            <span className="text-sm text-muted-foreground">
              {alt
                ? `[Image: ${alt}]`
                : "[Inline image omitted; use the cover image field.]"}
            </span>
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
export function Attachments(
  { id, files, service, published = false }: {
    id: string;
    files: Attachment[];
    service: NewsletterService;
    published?: boolean;
  },
) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  return (
    <section className={panel}>
      <h2 className="mb-4 text-lg font-semibold">Attachments</h2>
      {files.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No attachments for this newsletter.
        </p>
      )}
      <div className="space-y-4">
        {files.map((file) => (
          <div key={file.id} className="flex items-center gap-3">
            <FileText className="h-8 w-8 shrink-0 text-intranet-primary" />
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              disabled={!!busy}
              aria-label={`Download ${file.name}`}
              onClick={async () => {
                setBusy(file.id);
                setError("");
                try {
                  await service.download(id, file, published);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Download failed.");
                } finally {
                  setBusy("");
                }
              }}
            >
              {busy === file.id
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Download className="h-4 w-4" />}
            </Button>
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
