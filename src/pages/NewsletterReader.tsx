import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Newspaper } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { useNewsletterData } from "@/hooks/useNewsletterData";
import {
  Attachments,
  NewsletterBody,
  newsletterDate,
  NewsletterError,
  NewsletterLoading,
  NewsletterSetup,
  panel,
  primary,
} from "@/components/newsletters/NewsletterShared";
import PublishedNewsletters from "@/components/newsletters/PublishedNewsletters";

export default function NewsletterReader() {
  const { id } = useParams();
  const { data, service, loading, error, configured, reload } =
    useNewsletterData(async (s) => {
      if (!id) return null;
      const [publication, related] = await Promise.all([
        s.publication(id),
        s.publications(),
      ]);
      return {
        publication,
        related: related.filter((p) => p.id !== id && p.status === "published")
          .slice(0, 3),
      };
    }, `reader:${id || "index"}`);
  const p = data?.publication;
  return (
    <PageLayout>
      <main className="mx-auto max-w-7xl space-y-7 p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/news"
            className="inline-flex items-center gap-2 text-sm font-medium text-intranet-primary dark:text-rose-300"
          >
            <ArrowLeft className="h-4 w-4" />Back to News
          </Link>
          <Button asChild variant="outline">
            <Link to="/news/newsletters/workspace">Newsletter Workspace</Link>
          </Button>
        </div>
        {!configured
          ? <NewsletterSetup />
          : loading
          ? <NewsletterLoading />
          : error
          ? <NewsletterError error={error} retry={reload} />
          : !id
          ? (
            <>
              <div className="border-b pb-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-intranet-primary dark:text-rose-300">
                  News & Announcements
                </p>
                <h1 className="text-3xl font-bold">SCPNG Newsletters</h1>
              </div>
              <PublishedNewsletters />
            </>
          )
          : p && (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <article className={`${panel} overflow-hidden !p-0`}>
                {p.imageUrl && p.status !== "withdrawn" && (
                  <img
                    src={p.imageUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="max-h-80 w-full object-cover"
                  />
                )}
                <div className="space-y-6 p-6 md:p-9">
                  <span className="inline-flex rounded-full bg-intranet-primary/10 px-3 py-1 text-xs font-bold text-intranet-primary dark:bg-rose-950 dark:text-rose-200">
                    {p.category}
                  </span>
                  <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                    {p.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>{p.division}</span>
                    <span>·</span>
                    <time dateTime={p.publishedAt}>
                      {newsletterDate(p.publishedAt)}
                    </time>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {Math.max(1, Math.ceil(p.body.split(/\s+/).length / 200))}
                      {" "}
                      min read
                    </span>
                  </div>
                  {p.firstPublishedAt && p.firstPublishedAt !== p.publishedAt &&
                    (
                      <p className="rounded-lg bg-muted p-3 text-sm">
                        Updated {newsletterDate(p.publishedAt)}{" "}
                        after review. Originally published{" "}
                        {newsletterDate(p.firstPublishedAt)}.
                      </p>
                    )}
                  {p.status === "archived" && (
                    <p className="rounded-lg bg-muted p-3 text-sm">
                      This newsletter is in the archive.
                    </p>
                  )}
                  {p.notice
                    ? (
                      <div
                        role="status"
                        className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
                      >
                        {p.notice}
                      </div>
                    )
                    : (
                      <>
                        <p className="border-b pb-6 text-lg leading-8 text-muted-foreground">
                          {p.summary}
                        </p>
                        <NewsletterBody body={p.body} />
                      </>
                    )}
                  <footer className="border-t pt-5 text-sm text-muted-foreground">
                    Published by <strong>Research & Publication</strong>
                  </footer>
                </div>
              </article>
              <aside className="space-y-5">
                <Attachments
                  id={p.id}
                  files={p.attachments}
                  service={service}
                  published
                />
                <section className={panel}>
                  <h2 className="mb-4 text-lg font-semibold">
                    More from SCPNG
                  </h2>
                  <div className="space-y-5">
                    {data.related.map((other) => (
                      <Link
                        key={other.id}
                        to={`/news/newsletters/${other.id}`}
                        className="block rounded-md focus-visible:ring-2 focus-visible:ring-intranet-primary"
                      >
                        <p className="font-medium hover:text-intranet-primary">
                          {other.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {newsletterDate(other.publishedAt)}
                        </p>
                      </Link>
                    ))}
                    {!data.related.length && (
                      <Newspaper className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <Button asChild className={`mt-6 w-full ${primary}`}>
                    <Link to="/news/newsletters">Browse all newsletters</Link>
                  </Button>
                </section>
              </aside>
            </div>
          )}
      </main>
    </PageLayout>
  );
}
