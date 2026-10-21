import { useEffect, useMemo, useRef, useState } from "react";
import { persistNewsletterDraft } from "@/lib/newsletters/newsletterDraftActions";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Loader2,
  Newspaper,
  Plus,
  Save,
  Search,
  Send,
  Upload,
  X,
} from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PremiumTable,
  PremiumTableBody,
  PremiumTableCell,
  PremiumTableHead,
  PremiumTableHeader,
  PremiumTableRow,
} from "@/components/ui/PremiumTable";
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
  StatusBadge,
} from "@/components/newsletters/NewsletterShared";
import {
  type Content,
  emptyContent,
  labels,
  type Newsletter,
  type Stage,
} from "@/types/newsletter";

const steps: Stage[] = [
  "draft",
  "division_review",
  "editorial_review",
  "publication_review",
  "published",
];
const inputStyle =
  "h-10 w-full rounded-md border bg-background px-3 text-sm dark:border-white/10";
const messageOf = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "The newsletter action could not be completed.";
function portMoresbyDateTime(iso?: string) {
  return iso
    ? new Date(Date.parse(iso) + 10 * 3600000).toISOString().slice(0, 16)
    : "";
}

export default function NewsletterWorkspace() {
  const navigate = useNavigate();
  const { submissionId } = useParams();
  const { data, loading, error, configured, reload, updateData, service } =
    useNewsletterData(async (s) => {
      const [session, records] = await Promise.all([s.session(), s.list()]);
      return { ...session, records };
    }, "workspace");
  const [tab, setTab] = useState("mine");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("Saving your changes…");
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const [content, setContent] = useState<Content>(emptyContent);
  const [baseline, setBaseline] = useState("");
  const [preview, setPreview] = useState(false);
  const [comment, setComment] = useState("");
  const [schedule, setSchedule] = useState("");
  const [historical, setHistorical] = useState<
    { content: Content; version: string; at: string } | null
  >(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date(Date.now() + 10 * 3600000);
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const selected = data?.records.find((n) => n.id === submissionId);
  const actor = data?.actor;
  const roles = data?.roles || [];
  const editable = !!selected && selected.authorOid === actor?.oid &&
    ["draft", "returned"].includes(selected.status);
  const dirty = editable && JSON.stringify(content) !== baseline;
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setFailure("");
    setNotice("");
    setPreview(false);
    setHistorical(null);
  }, [submissionId]);
  useEffect(() => {
    if (selected) {
      setContent(structuredClone(selected.content));
      setBaseline(JSON.stringify(selected.content));
      setSchedule(portMoresbyDateTime(selected.scheduledAt));
      setComment("");
    }
  }, [selected]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const followLink = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.("a[href]");
      if (
        a && !(a as HTMLAnchorElement).download &&
        !window.confirm("Leave this page and discard unsaved changes?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", followLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", followLink, true);
    };
  }, [dirty]);
  const records = data?.records || [];
  const mine = records.filter((n) => n.authorOid === actor?.oid);
  const publishers = roles.some((r) => r.role === "publisher");
  const reviewers = roles.some((r) =>
    ["division_approver", "editor", "publication_approver", "clearance"]
      .includes(r.role)
  );
  const pending = records.filter((n) =>
    n.assignedOid === actor?.oid &&
    ["division_review", "editorial_review", "publication_review", "clearance"]
      .includes(n.status)
  );
  const visible =
    (tab === "mine"
      ? mine
      : tab === "reviews"
      ? pending
      : records.filter((n) =>
        ["approved", "scheduled", "published", "archived"].includes(n.status)
      )).filter((n) =>
        (!status || n.status === status) &&
        `${n.content.title} ${n.division} ${n.authorName}`.toLowerCase()
          .includes(search.toLowerCase())
      );
  const canPublish = !!selected &&
    roles.some((r) =>
      r.role === "publisher" &&
      (!r.division || r.division === selected.division)
    );
  const canDecide = !!selected && selected.assignedOid === actor?.oid &&
    pending.some((n) => n.id === selected.id);
  const events = useMemo(() => selected ? [...selected.events].reverse() : [], [
    selected,
  ]);
  function applyConfirmedRecord(record: Newsletter) {
    updateData((current) => ({
      ...current,
      records: [record, ...current.records.filter((item) => item.id !== record.id)],
    }));
  }
  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setProgress("Saving your changes…");
    setFailure("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setFailure(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(submit = false) {
    if (!selected) return;
    await run(async () => {
      const changed = await persistNewsletterDraft(
        service, selected, content, submit,
        (record) => {
          setBaseline(JSON.stringify(record.content));
          applyConfirmedRecord(record);
        },
        setProgress,
      );
      setNotice(submit ? "Newsletter submitted for review." : changed ? "Draft saved." : "All changes are already saved.");
    });
  }
  async function decide(action: string) {
    if (!selected) return;
    if (
      ["return", "reject", "archive", "withdraw", "revise", "reassign"]
        .includes(action) && !comment.trim()
    ) {
      setFailure("Enter a reason in the comments field before continuing.");
      return;
    }
    if (
      ["publish", "withdraw", "reject"].includes(action) &&
      !window.confirm(
        action === "publish"
          ? "Publish this approved newsletter to its staff audience?"
          : `${action === "withdraw" ? "Withdraw" : "Reject"} this newsletter?`,
      )
    ) return;
    await run(async () => {
      const next = await service.action(
        selected,
        action,
        comment,
        schedule ? new Date(`${schedule}:00+10:00`).toISOString() : undefined,
      );
      applyConfirmedRecord(next);
      setNotice(
        next.publicationWarning ||
          (action === "publish"
            ? "Newsletter published. Staff email is queued for the background service."
            : "Newsletter updated."),
      );
    });
  }
  function field<K extends keyof Content>(key: K, value: Content[K]) {
    setContent((c) => ({ ...c, [key]: value }));
  }
  const back = () => {
    if (!dirty || window.confirm("Discard unsaved changes?")) {
      setBaseline(JSON.stringify(content));
      navigate("/news/newsletters/workspace");
    }
  };
  const monthDays = new Date(
    Date.UTC(
      calendarMonth.getUTCFullYear(),
      calendarMonth.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  const offset = (calendarMonth.getUTCDay() + 6) % 7;
  return (
    <PageLayout>
      <main className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-intranet-primary dark:text-rose-300">
              News & Announcements
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              {selected
                ? editable ? "Create Newsletter" : "Review Newsletter"
                : "Newsletter Workspace"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {selected
                ? editable
                  ? "Prepare your newsletter for divisional review."
                  : "Review the content, decisions and publication history."
                : "Create, track and share news across SCPNG."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selected
              ? (
                <>
                  <Button variant="outline" onClick={back} disabled={busy}>
                    <ArrowLeft className="mr-2 h-4 w-4" />My workspace
                  </Button>
                  {editable && (
                    <>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => setPreview(!preview)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        {preview ? "Edit draft" : "Preview"}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => save()}
                      >
                        <Save className="mr-2 h-4 w-4" />Save Draft
                      </Button>
                      <Button
                        className={primary}
                        disabled={busy}
                        onClick={() => save(true)}
                      >
                        <Send className="mr-2 h-4 w-4" />Submit for Approval
                      </Button>
                    </>
                  )}
                </>
              )
              : (
                <>
                  <Button asChild variant="outline">
                    <Link to="/news/newsletters">Published Newsletters</Link>
                  </Button>
                  <Button
                    className={primary}
                    disabled={busy || loading || !configured || !actor}
                    onClick={() =>
                      run(async () => {
                        const n = await service.create();
                        applyConfirmedRecord(n);
                        navigate(`/news/newsletters/workspace/${n.id}`);
                      })}
                  >
                    <Plus className="mr-2 h-4 w-4" />Create Newsletter
                  </Button>
                </>
              )}
          </div>
        </div>
        {busy && (
          <div role="status" className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />{progress}
          </div>
        )}
        {failure && <NewsletterError error={failure} />}
        {notice && (
          <p
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
          >
            {notice}
          </p>
        )}
        {!configured
          ? <NewsletterSetup />
          : loading
          ? <NewsletterLoading />
          : error
          ? <NewsletterError error={error} retry={reload} />
          : submissionId && !selected
          ? (
            <NewsletterError
              error="This submission is unavailable or you do not have access."
              retry={reload}
            />
          )
          : selected
          ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={selected.status} />
                <span className="text-sm text-muted-foreground">
                  {selected.division} · Record revision {selected.revision} ·
                  {" "}
                  {dirty
                    ? "Unsaved changes"
                    : `Saved ${newsletterDate(selected.updatedAt)}`}
                </span>
                {selected.publishedVersion && (
                  <Link
                    to={`/news/newsletters/${selected.id}`}
                    className="text-sm font-medium text-intranet-primary dark:text-rose-300"
                  >
                    View published newsletter →
                  </Link>
                )}
              </div>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-5">
                  {editable && !preview
                    ? (
                      <section className={`${panel} space-y-5`}>
                        <label className="block space-y-2 text-sm font-semibold">
                          <span>Title *</span>
                          <Input
                            maxLength={180}
                            value={content.title}
                            onChange={(e) => field("title", e.target.value)}
                            placeholder="Enter newsletter title"
                            disabled={busy}
                          />
                        </label>
                        <label className="block space-y-2 text-sm font-semibold">
                          <span>Summary *</span>
                          <Textarea
                            maxLength={500}
                            rows={3}
                            value={content.summary}
                            onChange={(e) => field("summary", e.target.value)}
                            placeholder="A short summary for the news feed and staff email"
                            disabled={busy}
                          />
                          <span className="block text-right text-xs font-normal text-muted-foreground">
                            {content.summary.length}/500
                          </span>
                        </label>
                        <label className="block space-y-2 text-sm font-semibold">
                          <span>Content *</span>
                          <span className="block text-xs font-normal text-muted-foreground">
                            Use ## for headings, **bold text**, and - for bullet
                            points. Preview before submitting.
                          </span>
                          <Textarea
                            maxLength={16000}
                            rows={18}
                            value={content.body}
                            onChange={(e) => field("body", e.target.value)}
                            placeholder={"## Quarterly highlights\n\nWrite your newsletter here…"}
                            className="font-mono text-sm leading-7"
                            disabled={busy}
                          />
                        </label>
                        <label className="block space-y-2 text-sm font-semibold">
                          <span>Cover image URL (optional)</span>
                          <Input
                            type="url"
                            value={content.imageUrl}
                            onChange={(e) => field("imageUrl", e.target.value)}
                            placeholder="https://…"
                            disabled={busy}
                          />
                          <span className="block text-xs font-normal text-muted-foreground">
                            Use an approved image accessible to your staff
                            audience.
                          </span>
                        </label>
                        <div className="border-t pt-5">
                          <div className="flex items-center justify-between gap-3">
                            <h2 className="font-semibold">Attachments</h2>
                            <input
                              ref={fileInput}
                              type="file"
                              className="hidden"
                              accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                              aria-label="Upload newsletter attachment"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (file) {
                                  run(async () => {
                                    const attachment = await service.upload(
                                      selected,
                                      file,
                                    );
                                    field("attachments", [
                                      ...content.attachments,
                                      attachment,
                                    ]);
                                  });
                                }
                              }}
                            />
                            <Button
                              variant="outline"
                              disabled={busy || content.attachments.length >= 5}
                              onClick={() => fileInput.current?.click()}
                            >
                              <Upload className="mr-2 h-4 w-4" />Add attachment
                            </Button>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Up to five files, 3 MB each. PDF, DOCX, XLSX, PNG or
                            JPG.
                          </p>
                          <div className="mt-3 space-y-2">
                            {content.attachments.map((a) => (
                              <div
                                className="flex items-center gap-3 rounded-lg border p-3"
                                key={a.id}
                              >
                                <FileText className="h-5 w-5 text-intranet-primary" />
                                <span className="min-w-0 flex-1 truncate text-sm">
                                  {a.name}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Remove ${a.name}`}
                                  disabled={busy}
                                  onClick={() =>
                                    field(
                                      "attachments",
                                      content.attachments.filter((f) =>
                                        f.id !== a.id
                                      ),
                                    )}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>
                    )
                    : (
                      <article className={`${panel} space-y-6`}>
                        {content.imageUrl && (
                          <img
                            src={content.imageUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="max-h-72 w-full rounded-xl object-cover"
                          />
                        )}
                        <p className="text-xs font-bold uppercase tracking-widest text-intranet-primary dark:text-rose-300">
                          {content.category}
                        </p>
                        <h2 className="text-3xl font-bold">
                          {content.title || "Untitled newsletter"}
                        </h2>
                        <p className="text-lg leading-8 text-muted-foreground">
                          {content.summary}
                        </p>
                        <NewsletterBody
                          body={content.body ||
                            "Your newsletter preview will appear here."}
                        />
                        <p className="border-t pt-4 text-sm text-muted-foreground">
                          Prepared by {selected.authorName} ·{" "}
                          {selected.division}
                        </p>
                      </article>
                    )}
                  {!editable && (
                    <Attachments
                      id={selected.id}
                      files={selected.content.attachments}
                      service={service}
                    />
                  )}
                  <section className={panel}>
                    <h2 className="mb-4 text-lg font-semibold">
                      Approval & version history
                    </h2>
                    <ol className="space-y-5">
                      {events.map((event, i) => (
                        <li key={`${event.at}-${i}`} className="flex gap-3">
                          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-intranet-primary" />
                          <div>
                            <p className="text-sm font-semibold">
                              {event.action.replace(/_/g, " ")}{" "}
                              <span className="font-normal text-muted-foreground">
                                · {event.name}
                              </span>
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(event.at).toLocaleString("en-PG", {
                                timeZone: "Pacific/Port_Moresby",
                              })} · Port Moresby
                            </p>
                            {event.comment && (
                              <p className="mt-2 whitespace-pre-wrap text-sm">
                                {event.comment}
                              </p>
                            )}
                            {event.action === "saved" && event.version && (
                              <Button
                                variant="link"
                                className="h-auto p-0 text-xs"
                                disabled={busy}
                                onClick={() =>
                                  run(async () => {
                                    setHistorical(
                                      await service.request<
                                        {
                                          content: Content;
                                          version: string;
                                          at: string;
                                        }
                                      >("version", {
                                        id: selected.id,
                                        version: event.version,
                                      }),
                                    );
                                  })}
                              >
                                View saved version
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                </div>
                <aside className="space-y-5">
                  <section className={`${panel} space-y-4`}>
                    <h2 className="text-lg font-semibold">
                      Submission details
                    </h2>
                    <dl className="space-y-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Author</dt>
                        <dd>{selected.authorName}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Division</dt>
                        <dd>{selected.division}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Audience</dt>
                        <dd>All staff</dd>
                      </div>
                    </dl>
                    {editable
                      ? (
                        <>
                          <label className="block space-y-2 text-sm">
                            <span>Requested publication date</span>
                            <Input
                              type="date"
                              value={content.requestedDate}
                              onChange={(e) =>
                                field("requestedDate", e.target.value)}
                              disabled={busy}
                            />
                          </label>
                          <label className="block space-y-2 text-sm">
                            <span>Category</span>
                            <select
                              className={inputStyle}
                              value={content.category}
                              onChange={(e) =>
                                field("category", e.target.value)}
                              disabled={busy}
                            >
                              {[
                                "SCPNG News",
                                "Division Update",
                                "Staff Bulletin",
                                "Research Insights",
                              ].map((c) => <option key={c}>{c}</option>)}
                            </select>
                          </label>
                        </>
                      )
                      : (
                        <>
                          <p className="text-sm">
                            Requested publication:{" "}
                            {selected.content.requestedDate || "Not specified"}
                          </p>
                          {selected.dueAt && (
                            <p className="text-sm text-muted-foreground">
                              Review due {newsletterDate(selected.dueAt)}
                            </p>
                          )}
                        </>
                      )}
                  </section>
                  {editable && (
                    <section className={`${panel} space-y-4`}>
                      <h2 className="font-semibold">Content checklist</h2>
                      <label className="flex items-start gap-3 text-sm leading-6">
                        <input
                          type="checkbox"
                          checked={content.sensitiveChecked}
                          disabled={busy}
                          className="mt-1.5 accent-[#83002A]"
                          onChange={(e) =>
                            field("sensitiveChecked", e.target.checked)}
                        />
                        <span>
                          I have checked for confidential and personal
                          information. *
                        </span>
                      </label>
                      <label className="flex items-start gap-3 text-sm leading-6">
                        <input
                          type="checkbox"
                          checked={content.needsClearance}
                          disabled={busy}
                          className="mt-1.5 accent-[#83002A]"
                          onChange={(e) =>
                            field("needsClearance", e.target.checked)}
                        />
                        <span>
                          This submission needs additional specialist clearance.
                        </span>
                      </label>
                      <p className="text-xs text-muted-foreground">
                        This declaration is your assessment. It is not an
                        automated content scan.
                      </p>
                    </section>
                  )}
                  <section className={panel}>
                    <h2 className="mb-5 font-semibold">Workflow progress</h2>
                    <ol className="space-y-4">
                      {steps.filter((stage) => stage !== "division_review" ||
                        selected.divisionApprovalRequired !== false
                      ).flatMap((stage) =>
                        stage === "publication_review" &&
                          selected.content.needsClearance
                          ? ["clearance" as Stage, stage]
                          : [stage]
                      ).map((stage, i) => {
                        const current = selected.status === stage;
                        return (
                          <li
                            key={stage}
                            className="flex items-center gap-3 text-sm"
                          >
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                                current
                                  ? "border-intranet-primary bg-intranet-primary text-white"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {current ? <Check className="h-4 w-4" /> : i + 1}
                            </span>
                            <span
                              className={current
                                ? "font-semibold"
                                : "text-muted-foreground"}
                            >
                              {labels[stage]}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                    {selected.status === "returned" && (
                      <p className="mt-4 text-sm text-rose-700 dark:text-rose-300">
                        Changes requested. Resubmission will repeat the required
                        content approvals.
                      </p>
                    )}
                  </section>
                  {(canDecide ||
                    (canPublish &&
                      [
                        "division_review",
                        "editorial_review",
                        "publication_review",
                        "clearance",
                        "approved",
                        "scheduled",
                        "published",
                        "archived",
                      ].includes(selected.status)) ||
                    (selected.authorOid === actor?.oid &&
                      ["published", "archived"].includes(selected.status))) && (
                    <section className={`${panel} space-y-4`}>
                      <h2 className="text-lg font-semibold">
                        {canDecide ? "Your decision" : "Publication controls"}
                      </h2>
                      {canDecide && (
                        <p className="text-sm leading-6 text-muted-foreground">
                          {selected.status === "division_review"
                            ? "Confirm accuracy and suitability for internal circulation."
                            : selected.status === "editorial_review"
                            ? "Check wording, layout, branding, attachments and completeness."
                            : selected.status === "clearance"
                            ? "Confirm the submission has received the required specialist clearance."
                            : "Approve this exact version for publication."}
                        </p>
                      )}
                      <label className="block space-y-2 text-sm">
                        <span>Comments / reason</span>
                        <Textarea
                          rows={4}
                          maxLength={2000}
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Required when returning, rejecting, archiving or withdrawing"
                          disabled={busy}
                        />
                      </label>
                      {selected.authorOid === actor?.oid &&
                        ["published", "archived"].includes(selected.status) && (
                        <Button
                          variant="outline"
                          className="w-full"
                          disabled={busy}
                          onClick={() => decide("revise")}
                        >
                          Start Correction
                        </Button>
                      )}
                      {canPublish &&
                        [
                          "division_review",
                          "editorial_review",
                          "publication_review",
                          "clearance",
                        ].includes(selected.status) && (
                        <Button
                          variant="outline"
                          className="w-full"
                          disabled={busy}
                          onClick={() => decide("reassign")}
                        >
                          Refresh Reviewer Assignment
                        </Button>
                      )}
                      {canDecide && (
                        <>
                          <Button
                            className={`w-full ${primary}`}
                            disabled={busy}
                            onClick={() => decide("approve")}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {selected.status === "editorial_review"
                              ? "Complete Editorial Review"
                              : "Approve"}
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full"
                            disabled={busy}
                            onClick={() => decide("return")}
                          >
                            Return for Changes
                          </Button>
                          <Button
                            variant="ghost"
                            className="w-full text-red-700 dark:text-red-300"
                            disabled={busy}
                            onClick={() => decide("reject")}
                          >
                            Reject Submission
                          </Button>
                        </>
                      )}
                      {canPublish &&
                        ["approved", "scheduled"].includes(selected.status) && (
                        <>
                          <label className="block space-y-2 text-sm">
                            <span>Publication date & time</span>
                            <Input
                              type="datetime-local"
                              value={schedule}
                              onChange={(e) => setSchedule(e.target.value)}
                              disabled={busy}
                            />
                          </label>
                          <p className="text-xs text-muted-foreground">
                            Port Moresby (UTC+10)
                          </p>
                          <Button
                            className={`w-full ${primary}`}
                            disabled={busy || !schedule ||
                              !data?.capabilities.scheduling}
                            onClick={() => decide("schedule")}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />Schedule
                            Publication
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full"
                            disabled={busy}
                            onClick={() => decide("publish")}
                          >
                            Publish Now
                          </Button>
                          {selected.status === "scheduled" && (
                            <Button
                              variant="ghost"
                              className="w-full"
                              disabled={busy}
                              onClick={() => decide("cancel_schedule")}
                            >
                              Cancel Schedule
                            </Button>
                          )}
                          <p className="text-xs leading-5 text-muted-foreground">
                            {data?.capabilities.staffEmail
                              ? "Staff email is queued after successful publication."
                              : "Staff email is not enabled for this workspace."}
                            {" "}
                            {data?.capabilities.scheduling
                              ? "Scheduled publishing is enabled."
                              : "Scheduled publishing is awaiting background-service setup."}
                          </p>
                        </>
                      )}
                      {canPublish &&
                        ["published", "archived"].includes(selected.status) && (
                        <>
                          {selected.status === "published" && (
                            <Button
                              variant="outline"
                              className="w-full"
                              disabled={busy}
                              onClick={() => decide("archive")}
                            >
                              Archive Newsletter
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            className="w-full text-red-700 dark:text-red-300"
                            disabled={busy}
                            onClick={() => decide("withdraw")}
                          >
                            Withdraw Newsletter
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Staff email:{" "}
                            {selected.notification?.state || "Not queued"}
                          </p>
                          {selected.notification?.detail && (
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                              {selected.notification.detail}
                            </p>
                          )}
                        </>
                      )}
                    </section>
                  )}
                </aside>
              </div>
            </>
          )
          : (
            <>
              <div
                className="flex flex-wrap gap-2 border-b pb-3"
                role="tablist"
                aria-label="Newsletter workspace views"
              >
                {[{ id: "mine", title: "My Submissions", show: true }, {
                  id: "reviews",
                  title: `Assigned Reviews (${pending.length})`,
                  show: reviewers,
                }, {
                  id: "publishing",
                  title: "Publishing Queue",
                  show: publishers,
                }, {
                  id: "calendar",
                  title: "Publishing Calendar",
                  show: publishers,
                }].filter((t) => t.show).map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={tab === t.id}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-intranet-primary ${
                      tab === t.id
                        ? "bg-intranet-primary text-white"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => {
                      setTab(t.id);
                      setStatus("");
                    }}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[{
                  title: "Drafts",
                  count: mine.filter((n) => n.status === "draft").length,
                  icon: FileText,
                }, {
                  title: "In Review",
                  count: mine.filter((n) =>
                    [
                      "division_review",
                      "editorial_review",
                      "publication_review",
                      "clearance",
                    ].includes(n.status)
                  ).length,
                  icon: Clock,
                }, {
                  title: "Changes Requested",
                  count: mine.filter((n) => n.status === "returned").length,
                  icon: ArrowLeft,
                }, {
                  title: "Published",
                  count: mine.filter((n) => n.status === "published").length,
                  icon: CheckCircle2,
                }].map((stat) => (
                  <div
                    key={stat.title}
                    className={`${panel} flex items-center gap-4`}
                  >
                    <span className="rounded-full bg-intranet-primary/10 p-3 text-intranet-primary dark:text-rose-300">
                      <stat.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {stat.title}
                      </p>
                      <p className="mt-1 text-3xl font-bold">{stat.count}</p>
                    </div>
                  </div>
                ))}
              </div>
              {tab === "calendar"
                ? (
                  <section className={panel}>
                    <div className="mb-5 flex items-center justify-between">
                      <h2 className="text-xl font-bold">
                        {calendarMonth.toLocaleDateString("en-PG", {
                          month: "long",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </h2>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Previous month"
                          onClick={() =>
                            setCalendarMonth(
                              new Date(
                                Date.UTC(
                                  calendarMonth.getUTCFullYear(),
                                  calendarMonth.getUTCMonth() - 1,
                                  1,
                                ),
                              ),
                            )}
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Next month"
                          onClick={() =>
                            setCalendarMonth(
                              new Date(
                                Date.UTC(
                                  calendarMonth.getUTCFullYear(),
                                  calendarMonth.getUTCMonth() + 1,
                                  1,
                                ),
                              ),
                            )}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="grid min-w-[650px] grid-cols-7">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                          (d) => (
                            <div
                              className="border-b p-3 text-center text-xs font-semibold text-muted-foreground"
                              key={d}
                            >
                              {d}
                            </div>
                          ),
                        )}
                        {Array.from({
                          length: Math.ceil((offset + monthDays) / 7) * 7,
                        }, (_, i) => {
                          const day = i - offset + 1;
                          const valid = day > 0 && day <= monthDays;
                          const date = valid
                            ? `${calendarMonth.getUTCFullYear()}-${
                              String(calendarMonth.getUTCMonth() + 1).padStart(
                                2,
                                "0",
                              )
                            }-${String(day).padStart(2, "0")}`
                            : "";
                          return (
                            <div
                              key={i}
                              className={`min-h-28 border-b border-r p-2 ${
                                valid ? "" : "bg-muted/30"
                              }`}
                            >
                              <span className="text-xs text-muted-foreground">
                                {valid ? day : ""}
                              </span>
                              {valid && records.filter((n) =>
                                n.status === "scheduled" &&
                                portMoresbyDateTime(n.scheduledAt).startsWith(
                                  date,
                                )
                              ).map((n) => (
                                <Link
                                  className="mt-2 block rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-900 focus-visible:ring-2 focus-visible:ring-intranet-primary dark:bg-purple-950 dark:text-purple-200"
                                  to={`/news/newsletters/workspace/${n.id}`}
                                  key={n.id}
                                >
                                  {n.content.title}
                                  <span className="block opacity-70">
                                    {portMoresbyDateTime(n.scheduledAt).slice(
                                      11,
                                    )}
                                  </span>
                                </Link>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground">
                      All publication times use Port Moresby (UTC+10).
                    </p>
                  </section>
                )
                : (
                  <section className={`${panel} space-y-5`}>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <h2 className="text-xl font-semibold">
                        {tab === "mine"
                          ? "My Submissions"
                          : tab === "reviews"
                          ? "Assigned Reviews"
                          : "Publishing Queue"}
                      </h2>
                      <div className="flex flex-wrap gap-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            aria-label="Search submissions"
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search newsletters…"
                          />
                        </div>
                        <select
                          aria-label="Filter submissions by status"
                          className={inputStyle + " !w-auto"}
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                        >
                          <option value="">All statuses</option>
                          {Object.entries(labels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {visible.length
                      ? (
                        <PremiumTable>
                          <PremiumTableHeader>
                            <PremiumTableRow>
                              <PremiumTableHead>Newsletter</PremiumTableHead>
                              <PremiumTableHead>Division</PremiumTableHead>
                              <PremiumTableHead>Status</PremiumTableHead>
                              <PremiumTableHead>Assigned to</PremiumTableHead>
                              <PremiumTableHead>Updated</PremiumTableHead>
                            </PremiumTableRow>
                          </PremiumTableHeader>
                          <PremiumTableBody>
                            {visible.map((n) => (
                              <PremiumTableRow key={n.id}>
                                <PremiumTableCell>
                                  <Link
                                    className="font-semibold text-intranet-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-intranet-primary dark:text-rose-300"
                                    to={`/news/newsletters/workspace/${n.id}`}
                                  >
                                    {n.content.title || "Untitled draft"}
                                  </Link>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {n.authorName}
                                  </p>
                                </PremiumTableCell>
                                <PremiumTableCell>
                                  {n.division}
                                </PremiumTableCell>
                                <PremiumTableCell>
                                  <StatusBadge status={n.status} />
                                </PremiumTableCell>
                                <PremiumTableCell>
                                  {n.assignedOid === actor?.oid
                                    ? "You"
                                    : n.assignedOid
                                    ? "Assigned reviewer"
                                    : "—"}
                                </PremiumTableCell>
                                <PremiumTableCell>
                                  {newsletterDate(n.updatedAt)}
                                </PremiumTableCell>
                              </PremiumTableRow>
                            ))}
                          </PremiumTableBody>
                        </PremiumTable>
                      )
                      : (
                        <div className="py-12 text-center">
                          <Newspaper className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                          <h3 className="font-semibold">
                            {search || status
                              ? "No matching submissions"
                              : tab === "reviews"
                              ? "You have no reviews waiting"
                              : "No newsletters here yet"}
                          </h3>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {tab === "mine"
                              ? "Create a newsletter to get started, or adjust your filters."
                              : "Items appear here when they reach the appropriate workflow stage."}
                          </p>
                        </div>
                      )}
                  </section>
                )}
            </>
          )}
        <Dialog
          open={!!historical}
          onOpenChange={(open) => {
            if (!open) setHistorical(null);
          }}
        >
          <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle>Saved newsletter version</DialogTitle>
              <DialogDescription>
                This is a preserved content snapshot. Current approval decisions
                remain in the submission history.
              </DialogDescription>
            </DialogHeader>
            {historical && (
              <div className="space-y-5">
                <p className="text-xs text-muted-foreground">
                  Saved {newsletterDate(historical.at)}
                </p>
                <h2 className="text-2xl font-bold">
                  {historical.content.title}
                </h2>
                <p className="text-muted-foreground">
                  {historical.content.summary}
                </p>
                <NewsletterBody body={historical.content.body} />
                <h3 className="font-semibold">Attachments in this version</h3>
                {historical.content.attachments.map((a) => (
                  <p className="text-sm" key={a.id}>{a.name}</p>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </PageLayout>
  );
}
