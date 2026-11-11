import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Newspaper, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNewsletterData } from "@/hooks/useNewsletterData";
import type { Publication } from "@/types/newsletter";
import {
  newsletterDate,
  NewsletterError,
  NewsletterLoading,
  NewsletterSetup,
  panel,
} from "./NewsletterShared";

export default function PublishedNewsletters(
  { compact = false }: { compact?: boolean },
) {
  const { data, loading, error, configured, reload } = useNewsletterData<
    Publication[]
  >((service) => service.publications(), "publications");
  const [search, setSearch] = useState("");
  const [division, setDivision] = useState("");
  const [archive, setArchive] = useState(false);
  const divisions = useMemo<string[]>(
    () =>
      Array.from(
        new Set<string>((data || []).map((p: Publication) => p.division)),
      ).sort(),
    [data],
  );
  const matches = (data || []).filter((p) =>
    (compact
      ? p.status === "published"
      : archive || p.status === "published") &&
    (!division || p.division === division) &&
    `${p.title} ${p.summary} ${p.division}`.toLowerCase().includes(
      search.toLowerCase(),
    )
  );
  const shown = compact ? matches.slice(0, 3) : matches;
  if (!configured) return compact ? null : <NewsletterSetup />;
  if (loading) return <NewsletterLoading />;
  if (error) return <NewsletterError error={error} retry={reload} />;
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">
            {compact ? "Latest newsletters" : "Published newsletters"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Updates and stories from across SCPNG.
          </p>
        </div>
        {compact && (
          <Link
            to="/news/newsletters"
            className="inline-flex items-center gap-2 text-sm font-semibold text-intranet-primary dark:text-rose-300"
          >
            Browse all newsletters <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      {!compact && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Search published newsletters"
              placeholder="Search newsletters…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter by division"
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={division}
            onChange={(e) => setDivision(e.target.value)}
          >
            <option value="">All divisions</option>
            {divisions.map((d) => <option key={d}>{d}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={archive}
              onChange={(e) => setArchive(e.target.checked)}
            />Include archive
          </label>
        </div>
      )}
      {shown.length === 0
        ? (
          <div className={`${panel} py-12 text-center`}>
            <Newspaper className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
            <p className="font-medium">No published newsletters found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Published updates will appear here. Try changing your filters.
            </p>
          </div>
        )
        : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((p) => (
              <Link
                key={p.id}
                to={`/news/newsletters/${p.id}`}
                className="group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intranet-primary dark:border-white/10 dark:bg-gray-800"
              >
                {p.imageUrl
                  ? (
                    <img
                      src={p.imageUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-44 w-full object-cover"
                      loading="lazy"
                    />
                  )
                  : (
                    <div className="flex h-32 items-center justify-center bg-gradient-to-br from-[#83002A] to-[#420016]">
                      <Newspaper className="h-12 w-12 text-white/70" />
                    </div>
                  )}
                <div className="space-y-3 p-5">
                  <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                    <span>{p.division}</span>
                    <span>{newsletterDate(p.publishedAt)}</span>
                  </div>
                  <h3 className="text-lg font-bold group-hover:text-intranet-primary dark:group-hover:text-rose-300">
                    {p.title}
                  </h3>
                  <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {p.summary}
                  </p>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-intranet-primary dark:text-rose-300">
                    Read newsletter <ArrowRight className="h-4 w-4" />
                  </span>
                  {p.status === "archived" && (
                    <span className="ml-3 text-xs text-muted-foreground">
                      Archived
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
    </section>
  );
}
