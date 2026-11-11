import { canonicalDivision } from './organizationDivision.ts';
/** Pure workflow rules shared by the trusted API, UI and regression tests. */
export type Stage =
  | 'draft'
  | 'division_review'
  | 'editorial_review'
  | 'clearance'
  | 'publication_review'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'returned'
  | 'rejected'
  | 'archived'
  | 'withdrawn';
export type Role =
  | 'division_approver'
  | 'editor'
  | 'publication_approver'
  | 'publisher'
  | 'clearance';
export interface Staff {
  oid: string;
  name: string;
  email: string;
  division: string;
  active: boolean;
}
export interface Assignment {
  oid: string;
  role: Role;
  division?: string;
  startsAt?: string;
  endsAt?: string;
}
export interface Routing {
  staff: Staff[];
  assignments: Assignment[];
  rpDivision: string;
  reviewDays: number;
  escalationOid?: string;
}
export interface Attachment {
  id: string;
  name: string;
  size: number;
  mime: string;
}
export interface Content {
  title: string;
  summary: string;
  body: string;
  imageUrl: string;
  category: string;
  requestedDate: string;
  sensitiveChecked: boolean;
  needsClearance: boolean;
  attachments: Attachment[];
}
export interface Event {
  at: string;
  actor: string;
  name: string;
  action: string;
  comment: string;
  version: string;
}
export interface Newsletter {
  id: string;
  authorOid: string;
  authorName: string;
  division: string;
  divisionApprovalRequired?: boolean;
  status: Stage;
  content: Content;
  version: string;
  revision: number;
  approvedVersion?: string;
  editorOid?: string;
  returnStage?: Stage;
  assignedOid?: string;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string;
  publishedAt?: string;
  publishedVersion?: string;
  firstPublishedAt?: string;
  events: Event[];
  notification?: {
    state: 'queued' | 'sending' | 'accepted' | 'failed' | 'uncertain';
    detail?: string;
  };
}
export interface Publication {
  id: string;
  title: string;
  summary: string;
  body: string;
  imageUrl: string;
  category: string;
  division: string;
  authorName: string;
  attachments: Attachment[];
  publishedAt: string;
  firstPublishedAt?: string;
  version: string;
  status: 'published' | 'archived' | 'withdrawn';
  notice?: string;
}
export type Action =
  | 'submit'
  | 'approve'
  | 'return'
  | 'reject'
  | 'schedule'
  | 'cancel_schedule'
  | 'publish'
  | 'archive'
  | 'withdraw'
  | 'revise'
  | 'reassign';
export const labels: Record<Stage, string> = {
  draft: 'Draft',
  division_review: 'Pending Divisional Approval',
  editorial_review: 'Editorial Review',
  clearance: 'Additional Clearance',
  publication_review: 'Pending Publication Approval',
  approved: 'Approved for Publication',
  scheduled: 'Scheduled',
  published: 'Published',
  returned: 'Returned for Changes',
  rejected: 'Rejected',
  archived: 'Archived',
  withdrawn: 'Withdrawn',
};
export const emptyContent = (): Content => ({
  title: '',
  summary: '',
  body: '',
  imageUrl: '',
  category: 'SCPNG News',
  requestedDate: '',
  sensitiveChecked: false,
  needsClearance: false,
  attachments: [],
});
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function staffFor(config: Routing, oid: string): Staff {
  const staff = config.staff.find((s) => s.oid === oid && s.active);
  assert(
    staff,
    'Your staff account is not enabled for newsletters. Contact the workflow administrator.',
  );
  return staff;
}
export function hasRole(
  config: Routing,
  oid: string,
  role: Role,
  division: string,
  now = new Date(),
): boolean {
  if (!config.staff.some((s) => s.oid === oid && s.active)) return false;
  return config.assignments.some((a) =>
    a.oid === oid && a.role === role &&
    (!a.division ||
      canonicalDivision(a.division) === canonicalDivision(division)) &&
    (!a.startsAt || Date.parse(a.startsAt) <= now.getTime()) &&
    (!a.endsAt || Date.parse(a.endsAt) > now.getTime())
  );
}
const roleForStage: Partial<Record<Stage, Role>> = {
  division_review: 'division_approver',
  editorial_review: 'editor',
  clearance: 'clearance',
  publication_review: 'publication_approver',
};
export function canRead(
  n: Newsletter,
  oid: string,
  config: Routing,
  now = new Date(),
): boolean {
  return n.authorOid === oid ||
    ([
      'division_approver',
      'editor',
      'publication_approver',
      'publisher',
      'clearance',
    ] as Role[]).some((role) => hasRole(config, oid, role, n.division, now));
}
export function canEdit(n: Newsletter, oid: string): boolean {
  return n.authorOid === oid && ['draft', 'returned'].includes(n.status);
}
function assign(n: Newsletter, stage: Stage, config: Routing, now: Date) {
  const role = roleForStage[stage];
  n.status = stage;
  delete n.assignedOid;
  delete n.dueAt;
  if (!role) return;
  const candidates = config.assignments.filter((a) =>
    a.role === role && hasRole(config, a.oid, role, n.division, now) &&
    a.oid !== n.authorOid &&
    (role !== 'publication_approver' || a.oid !== n.editorOid)
  );
  const unique = [...new Set(candidates.map((a) => a.oid))];
  assert(
    unique.length === 1,
    `Configure exactly one eligible ${
      role.replace(/_/g, ' ')
    } for ${n.division}; alternate appointments must not overlap.`,
  );
  n.assignedOid = unique[0];
  const due = new Date(now);
  let remaining = Math.max(1, Math.min(config.reviewDays || 2, 30));
  while (remaining > 0) {
    due.setUTCDate(due.getUTCDate() + 1);
    if (![0, 6].includes(new Date(due.getTime() + 10 * 3600000).getUTCDay())) {
      remaining--;
    }
  }
  n.dueAt = due.toISOString();
}
export function validateContent(c: Content, submitting = false) {
  assert(c && typeof c === 'object', 'Newsletter content is required.');
  for (
    const field of [
      'title',
      'summary',
      'body',
      'imageUrl',
      'category',
      'requestedDate',
    ] as const
  ) assert(typeof c[field] === 'string', `Invalid ${field}.`);
  assert(
    c.title.length <= 180 && c.summary.length <= 500 &&
      c.body.length <= 16000 && c.category.length <= 80,
    'Content exceeds the allowed length.',
  );
  assert(
    !c.imageUrl || /^https:\/\//i.test(c.imageUrl),
    'Cover images must use an HTTPS URL.',
  );
  assert(c.imageUrl.length <= 2000, 'Cover image URL is too long.');
  assert(
    !c.requestedDate || /^\d{4}-\d{2}-\d{2}$/.test(c.requestedDate),
    'Invalid requested publication date.',
  );
  assert(
    typeof c.sensitiveChecked === 'boolean' &&
      typeof c.needsClearance === 'boolean',
    'Complete the content declarations.',
  );
  assert(
    Array.isArray(c.attachments) && c.attachments.length <= 5,
    'A maximum of five attachments is allowed.',
  );
  assert(
    new Set(c.attachments.map((a) => a.id)).size === c.attachments.length,
    'Duplicate attachments are not allowed.',
  );
  for (const a of c.attachments) {
    assert(
      a && typeof a.id === 'string' && typeof a.name === 'string' &&
        typeof a.mime === 'string' && Number.isFinite(a.size) && a.size > 0 &&
        a.size <= 3 * 1024 * 1024,
      'Invalid attachment.',
    );
  }
  if (submitting) {
    assert(
      c.title.trim() && c.summary.trim() && c.body.trim() && c.sensitiveChecked,
      'Add a title, summary and content, and confirm the sensitive-information check.',
    );
  }
}
export function transition(
  record: Newsletter,
  action: Action,
  oid: string,
  config: Routing,
  input: { comment?: string; scheduledAt?: string } = {},
  now = new Date(),
): Newsletter {
  const actor = staffFor(config, oid);
  const n: Newsletter = structuredClone(record);
  const comment = (input.comment || '').trim();
  assert(comment.length <= 2000, 'Comments must be at most 2,000 characters.');
  assert(canRead(n, oid, config, now), 'You cannot access this submission.');
  if (action === 'revise') {
    assert(
      n.authorOid === oid && ['published', 'archived'].includes(n.status),
      'Only the author can start a correction to a published newsletter.',
    );
    assert(comment, 'Explain why this newsletter needs correction.');
    n.status = 'draft';
    delete n.approvedVersion;
    delete n.scheduledAt;
    delete n.assignedOid;
    delete n.dueAt;
  } else if (action === 'submit') {
    assert(
      canEdit(n, oid),
      'Only the author can submit a draft or returned newsletter.',
    );
    validateContent(n.content, true);
    delete n.approvedVersion;
    delete n.scheduledAt;
    // Conservative resubmission: facts and attachments always receive content approval again.
    assign(
      n,
      canonicalDivision(n.division) === canonicalDivision(config.rpDivision)
        ? 'editorial_review'
        : 'division_review',
      config,
      now,
    );
  } else if (['approve', 'return', 'reject'].includes(action)) {
    const role = roleForStage[n.status];
    assert(
      role && n.assignedOid === oid &&
        hasRole(config, oid, role, n.division, now),
      'This review is not assigned to you, or your authority has expired.',
    );
    assert(
      n.authorOid !== oid,
      'You cannot approve or review your own submission.',
    );
    if (action === 'return' || action === 'reject') {
      assert(
        comment,
        'Provide a reason for returning or rejecting this newsletter.',
      );
      n.returnStage = n.status;
      n.status = action === 'return' ? 'returned' : 'rejected';
      n.assignedOid = n.authorOid;
      delete n.dueAt;
      delete n.approvedVersion;
    } else {
      if (n.status === 'division_review') {
        assign(n, 'editorial_review', config, now);
      } else if (n.status === 'editorial_review') {
        n.editorOid = oid;
        assign(
          n,
          n.content.needsClearance ? 'clearance' : 'publication_review',
          config,
          now,
        );
      } else if (n.status === 'clearance') {
        assign(n, 'publication_review', config, now);
      } else {
        assert(
          n.editorOid !== oid,
          'Final approval must be independent of editorial review.',
        );
        n.approvedVersion = n.version;
        assign(n, 'approved', config, now);
      }
    }
  } else {
    assert(
      hasRole(config, oid, 'publisher', n.division, now),
      'Only an authorised publisher can perform this action.',
    );
    if (action === 'reassign') {
      assert(
        roleForStage[n.status],
        'Only a pending review can be reassigned.',
      );
      assert(comment, 'Explain the reassignment.');
      assign(n, n.status, config, now);
    } else if (action === 'schedule' || action === 'publish') {
      assert(
        ['approved', 'scheduled'].includes(n.status) &&
          n.approvedVersion === n.version,
        'The current version must have final approval before publication.',
      );
      if (action === 'schedule') {
        assert(
          input.scheduledAt && Date.parse(input.scheduledAt) > now.getTime(),
          'Choose a future publication time.',
        );
        n.scheduledAt = new Date(input.scheduledAt).toISOString();
        n.status = 'scheduled';
      } else {
        n.firstPublishedAt ||= n.publishedAt || now.toISOString();
        n.status = 'published';
        n.publishedAt = now.toISOString();
        n.publishedVersion = n.version;
        delete n.scheduledAt;
        n.notification = { state: 'queued' };
      }
    } else if (action === 'cancel_schedule') {
      assert(n.status === 'scheduled', 'This newsletter is not scheduled.');
      n.status = 'approved';
      delete n.scheduledAt;
    } else if (action === 'archive' || action === 'withdraw') {
      assert(
        action === 'withdraw'
          ? n.publishedVersion && n.status !== 'withdrawn'
          : ['published', 'archived'].includes(n.status),
        'Only published newsletters can be maintained.',
      );
      assert(comment, 'Provide a reason for this action.');
      n.status = action === 'archive' ? 'archived' : 'withdrawn';
      delete n.assignedOid;
      delete n.dueAt;
    } else throw new Error('Unknown workflow action.');
  }
  n.updatedAt = now.toISOString();
  n.revision++;
  n.events.push({
    at: n.updatedAt,
    actor: oid,
    name: actor.name,
    action,
    comment,
    version: n.version,
  });
  return n;
}
export function publicationFor(n: Newsletter): Publication {
  assert(
    n.publishedAt && n.publishedVersion === n.version &&
      ['published', 'archived', 'withdrawn'].includes(n.status),
    'This version is not published.',
  );
  return {
    id: n.id,
    title: n.content.title,
    summary: n.content.summary,
    body: n.status === 'withdrawn' ? '' : n.content.body,
    imageUrl: n.content.imageUrl,
    category: n.content.category,
    division: n.division,
    authorName: n.authorName,
    attachments: n.status === 'withdrawn' ? [] : n.content.attachments,
    publishedAt: n.publishedAt,
    firstPublishedAt: n.firstPublishedAt,
    version: n.version,
    status: n.status as Publication['status'],
    notice: n.status === 'withdrawn'
      ? 'This newsletter has been withdrawn by Research & Publication.'
      : undefined,
  };
}
