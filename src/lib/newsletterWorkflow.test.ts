import { describe, expect, it } from "vitest";
import {
  canEdit,
  canRead,
  emptyContent,
  hasRole,
  type Newsletter,
  publicationFor,
  type Routing,
  staffFor,
  transition,
  validateContent,
} from "./newsletters/newsletterWorkflow";

const now = new Date("2026-10-19T01:00:00Z");
function config(): Routing {
  return {
    rpDivision: "Research & Publication",
    reviewDays: 2,
    staff: [
      "author",
      "manager",
      "editor",
      "approver",
      "publisher",
      "specialist",
      "outsider",
      "alternate",
    ].map((oid) => ({
      oid,
      name: oid,
      email: `${oid}@example.test`,
      active: true,
      division: oid === "outsider" ? "Finance" : "Licensing",
    })),
    assignments: [
      { oid: "manager", role: "division_approver", division: "Licensing" },
      { oid: "editor", role: "editor" },
      { oid: "approver", role: "publication_approver" },
      { oid: "publisher", role: "publisher" },
      { oid: "specialist", role: "clearance" },
    ],
  };
}
function draft(): Newsletter {
  return {
    id: "sample",
    authorOid: "author",
    authorName: "Sample author",
    division: "Licensing",
    status: "draft",
    content: {
      ...emptyContent(),
      title: "Quarterly update",
      summary: "Sample summary",
      body: "Sample newsletter",
      sensitiveChecked: true,
    },
    version: "version-1",
    revision: 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    events: [],
  };
}
const act = (
  n: Newsletter,
  action: Parameters<typeof transition>[1],
  oid: string,
  c = config(),
  input = {},
) => transition(n, action, oid, c, input, now);
function approved(c = config()) {
  let n = act(draft(), "submit", "author", c);
  n = act(n, "approve", "manager", c);
  n = act(n, "approve", "editor", c);
  return act(n, "approve", "approver", c);
}

describe("Newsletter approval and publication policy", () => {
  it("routes a divisional submission through two independent approvals", () => {
    let n = act(draft(), "submit", "author");
    expect(n.status).toBe("division_review");
    expect(n.assignedOid).toBe("manager");
    n = act(n, "approve", "manager");
    expect(n.status).toBe("editorial_review");
    n = act(n, "approve", "editor");
    expect(n.status).toBe("publication_review");
    n = act(n, "approve", "approver");
    expect(n.status).toBe("approved");
    expect(n.approvedVersion).toBe(n.version);
    expect(n.events).toHaveLength(4);
  });
  it("routes R&P authors directly to an independent editor", () => {
    const n = draft();
    n.division = config().rpDivision;
    const submitted = act(n, "submit", "author");
    expect(submitted.status).toBe("editorial_review");
    expect(submitted.assignedOid).toBe("editor");
  });
  it("prevents author self-approval even with a matching role", () => {
    const c = config();
    c.assignments[0].oid = "author";
    expect(() => act(draft(), "submit", "author", c)).toThrow("exactly one");
  });
  it("blocks an unrelated divisional manager", () => {
    const c = config();
    c.assignments[0].division = "Finance";
    expect(() => act(draft(), "submit", "author", c)).toThrow("exactly one");
  });
  it("fails closed for missing routing", () => {
    const c = config();
    c.assignments = [];
    expect(() => act(draft(), "submit", "author", c)).toThrow("exactly one");
  });
  it("rejects ambiguous concurrent approvers", () => {
    const c = config();
    c.assignments.push({
      oid: "alternate",
      role: "division_approver",
      division: "Licensing",
    });
    expect(() => act(draft(), "submit", "author", c)).toThrow("exactly one");
  });
  it("honours effective-dated alternate appointments", () => {
    const c = config();
    c.assignments[0].endsAt = "2026-10-18T00:00:00Z";
    c.assignments.push({
      oid: "alternate",
      role: "division_approver",
      division: "Licensing",
      startsAt: now.toISOString(),
    });
    expect(act(draft(), "submit", "author", c).assignedOid).toBe("alternate");
  });
  it("does not grant access to disabled staff or expired reviewers", () => {
    const c = config();
    c.staff[1].active = false;
    expect(hasRole(c, "manager", "division_approver", "Licensing", now)).toBe(
      false,
    );
    expect(() => staffFor(c, "manager")).toThrow("not enabled");
  });
  it("prevents editorial reviewers from giving final approval", () => {
    const c = config();
    c.assignments.find((a) => a.role === "publication_approver")!.oid =
      "editor";
    let n = act(draft(), "submit", "author", c);
    n = act(n, "approve", "manager", c);
    expect(() => act(n, "approve", "editor", c)).toThrow("exactly one");
  });
  it("requires substantive submission fields and the author declaration", () => {
    const n = draft();
    n.content.sensitiveChecked = false;
    expect(() => act(n, "submit", "author")).toThrow("confirm");
    n.content.sensitiveChecked = true;
    n.content.body = " ";
    expect(() => act(n, "submit", "author")).toThrow("content");
  });
  it("requires reasons for rejection and returning content", () => {
    const n = act(draft(), "submit", "author");
    expect(() => act(n, "return", "manager")).toThrow("reason");
    expect(() => act(n, "reject", "manager")).toThrow("reason");
  });
  it("returns revisions to the author, then repeats content approval", () => {
    let n = act(draft(), "submit", "author");
    n = act(n, "return", "manager", config(), {
      comment: "Correct the figures.",
    });
    expect(n.status).toBe("returned");
    expect(canEdit(n, "author")).toBe(true);
    expect(n.events[n.events.length - 1]?.comment).toBe("Correct the figures.");
    n = act(n, "submit", "author");
    expect(n.status).toBe("division_review");
  });
  it("adds specialist clearance when declared", () => {
    const n = draft();
    n.content.needsClearance = true;
    let reviewed = act(
      act(act(n, "submit", "author"), "approve", "manager"),
      "approve",
      "editor",
    );
    expect(reviewed.status).toBe("clearance");
    reviewed = act(reviewed, "approve", "specialist");
    expect(reviewed.status).toBe("publication_review");
  });
  it("rejects a decision from an unassigned reviewer", () => {
    const n = act(draft(), "submit", "author");
    expect(() => act(n, "approve", "approver")).toThrow("not assigned");
  });
  it("prevents publication without exact-version approval", () => {
    const n = approved();
    n.version = "changed";
    expect(() => act(n, "publish", "publisher")).toThrow("current version");
  });
  it("prevents publishing by a contributor", () => {
    expect(() => act(approved(), "publish", "author")).toThrow(
      "authorised publisher",
    );
  });
  it("schedules only future dates and supports cancellation", () => {
    expect(() =>
      act(approved(), "schedule", "publisher", config(), {
        scheduledAt: now.toISOString(),
      })
    ).toThrow("future");
    let n = act(approved(), "schedule", "publisher", config(), {
      scheduledAt: "2026-10-26T23:00:00Z",
    });
    expect(n.status).toBe("scheduled");
    n = act(n, "cancel_schedule", "publisher");
    expect(n.status).toBe("approved");
    expect(n.scheduledAt).toBeUndefined();
  });
  it("queues email only once publication has been authorised", () => {
    const n = act(approved(), "publish", "publisher");
    expect(n.status).toBe("published");
    expect(n.notification?.state).toBe("queued");
    expect(() => act(n, "publish", "publisher")).toThrow("final approval");
  });
  it("exposes no workflow comments or identities in the public projection", () => {
    const n = act(approved(), "publish", "publisher");
    const p = publicationFor(n);
    expect(p).not.toHaveProperty("events");
    expect(p).not.toHaveProperty("assignedOid");
    expect(p).not.toHaveProperty("authorOid");
    expect(p.body).toBe(n.content.body);
  });
  it("withdraws content and removes public attachments", () => {
    let n = act(approved(), "publish", "publisher");
    n = act(n, "withdraw", "publisher", config(), {
      comment: "Incorrect figures.",
    });
    const p = publicationFor(n);
    expect(p.body).toBe("");
    expect(p.attachments).toEqual([]);
    expect(p.notice).toContain("withdrawn");
  });
  it("starts a correction without losing the previous published version reference", () => {
    let n = act(approved(), "publish", "publisher");
    n = act(n, "revise", "author", config(), {
      comment: "Update the figures.",
    });
    expect(n.status).toBe("draft");
    expect(n.publishedVersion).toBe("version-1");
    expect(n.approvedVersion).toBeUndefined();
  });
  it("prevents unauthorized draft access", () => {
    expect(canRead(draft(), "outsider", config(), now)).toBe(false);
    expect(canRead(draft(), "author", config(), now)).toBe(true);
  });
  it("does not mutate the existing record when a decision fails", () => {
    const n = draft();
    const original = structuredClone(n);
    expect(() => act(n, "approve", "manager")).toThrow();
    expect(n).toEqual(original);
  });
  it("validates content limits, duplicate attachments and safe cover URL schemes", () => {
    const c = draft().content;
    c.imageUrl = "javascript:alert(1)";
    expect(() => validateContent(c)).toThrow("HTTPS");
    c.imageUrl = "";
    c.body = "a".repeat(16001);
    expect(() => validateContent(c)).toThrow("length");
    c.body = "ok";
    const a = { id: "a", name: "a.pdf", size: 10, mime: "application/pdf" };
    c.attachments = [a, a];
    expect(() => validateContent(c)).toThrow("Duplicate");
  });
  it("updates assignment only through eligible configured routing", () => {
    const c = config();
    let n = act(draft(), "submit", "author", c);
    c.assignments[0].endsAt = "2026-10-18T00:00:00Z";
    c.assignments.push({
      oid: "alternate",
      role: "division_approver",
      division: "Licensing",
    });
    n = act(n, "reassign", "publisher", c, { comment: "Manager on leave." });
    expect(n.assignedOid).toBe("alternate");
  });
  it("preserves review comments against the reviewed version", () => {
    const n = act(
      act(draft(), "submit", "author"),
      "approve",
      "manager",
      config(),
      { comment: "Figures checked." },
    );
    expect(n.events[n.events.length - 1]).toMatchObject({
      action: "approve",
      version: "version-1",
      comment: "Figures checked.",
      actor: "manager",
    });
  });
});
