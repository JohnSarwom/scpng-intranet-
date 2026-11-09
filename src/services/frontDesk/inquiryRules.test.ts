import { describe, expect, it } from 'vitest';
import {
  filterInquiries,
  inquiryFields,
  inquiryPeriod,
  inquiryToInput,
  mapInquiry,
  mergeInquiries,
  searchInquiries,
  UNASSIGNED,
  validateInquiryInput,
  type FrontDeskInquiry,
  type InquiryInput,
} from './inquiryRules';

const NOW = '2026-11-10T02:00:00.000Z';
const ACTOR = 'reception@scpng.gov.pg';

const open: FrontDeskInquiry = {
  id: '4', eTag: '"i,3"', title: 'Projector not working', category: 'IT Support', priority: 'High', status: 'Open',
  reportedAt: '2026-11-09T23:15:00.000Z', reportedBy: 'Board secretary',
};
const input = (over: Partial<InquiryInput> = {}): InquiryInput => ({ ...inquiryToInput(open), ...over });

describe('inquiryRules', () => {
  it('maps a stored item, falling back to safe choices', () => {
    const mapped = mapInquiry({
      id: '7', eTag: '"e"',
      fields: { Title: ' Leak ', Category: 'Plumbing', Priority: 'Urgent', Status: 'In Progress', AssigneeEmail: 'A.B@scpng.gov.pg', ReportedAt: '2026-11-09T22:00:00Z' },
    });
    expect(mapped).toMatchObject({ id: '7', title: 'Leak', category: 'General', priority: 'Medium', status: 'In Progress', assigneeEmail: 'a.b@scpng.gov.pg', reportedAt: '2026-11-09T22:00:00.000Z' });
  });

  it('logs a new inquiry without empty fields, stamping the assignment when someone is assigned', () => {
    expect(inquiryFields(input({ description: ' ', reportedBy: '' }), { actorEmail: ACTOR, nowIso: NOW })).toEqual({
      Title: 'Projector not working', Category: 'IT Support', Priority: 'High', Status: 'Open', ReportedAt: '2026-11-09T23:15:00.000Z',
    });
    expect(inquiryFields(input({ assigneeEmail: 'IT@scpng.gov.pg', assigneeName: 'IT Desk' }), { actorEmail: ACTOR, nowIso: NOW })).toMatchObject({
      AssigneeEmail: 'it@scpng.gov.pg', AssigneeName: 'IT Desk', AssignedAt: NOW, AssignedByEmail: ACTOR,
    });
  });

  it('stamps ResolvedAt on resolving, keeps it while resolved, and clears it on reopening', () => {
    expect(inquiryFields(input({ status: 'Resolved' }), { previous: open, nowIso: NOW }).ResolvedAt).toBe(NOW);
    const resolved = { ...open, status: 'Resolved' as const, resolvedAt: '2026-11-09T23:30:00.000Z' };
    expect(inquiryFields(input({ status: 'Resolved', title: 'Renamed' }), { previous: resolved, nowIso: NOW })).not.toHaveProperty('ResolvedAt');
    expect(inquiryFields(input({ status: 'In Progress' }), { previous: resolved, nowIso: NOW }).ResolvedAt).toBeNull();
    expect(inquiryFields(input({ status: 'In Progress' }), { previous: open, nowIso: NOW })).not.toHaveProperty('ResolvedAt');
  });

  it('restarts the assignment trail on reassigning, clears it on unassigning, and leaves it alone otherwise', () => {
    const assigned = { ...open, assigneeEmail: 'a@scpng.gov.pg', assigneeName: 'A', assignedAt: '2026-11-09T23:20:00.000Z', acknowledgedAt: '2026-11-09T23:40:00.000Z' };
    expect(inquiryFields(input({ assigneeEmail: 'b@scpng.gov.pg', assigneeName: 'B' }), { previous: assigned, actorEmail: ACTOR, nowIso: NOW })).toMatchObject({
      AssigneeEmail: 'b@scpng.gov.pg', AssigneeName: 'B', AssignedAt: NOW, AssignedByEmail: ACTOR, AcknowledgedAt: null,
    });
    expect(inquiryFields(input({ assigneeEmail: undefined, assigneeName: 'A' }), { previous: assigned, nowIso: NOW })).toMatchObject({
      AssigneeEmail: null, AssigneeName: null, AssignedAt: null, AssignedByEmail: null, AcknowledgedAt: null,
    });
    const sameAssignee = inquiryFields(input({ assigneeEmail: 'A@scpng.gov.pg', assigneeName: 'A', priority: 'Low' }), { previous: assigned, nowIso: NOW });
    expect(sameAssignee).not.toHaveProperty('AssignedAt');
    expect(sameAssignee).not.toHaveProperty('AcknowledgedAt');
  });

  it('clears optional fields on edit so an emptied field is really emptied', () => {
    expect(inquiryFields(input({ reportedBy: '' }), { previous: open, nowIso: NOW })).toMatchObject({ ReportedBy: null, Description: null });
  });

  it('requires a title and a reported time that is not in the future', () => {
    expect(validateInquiryInput(input({ title: ' ', reportedAt: '' }), NOW)).toEqual({ title: 'Enter a title.', reportedAt: 'Enter when it was reported.' });
    expect(validateInquiryInput(input({ reportedAt: '2026-11-10T03:00:00.000Z' }), NOW).reportedAt).toMatch(/future/);
    expect(validateInquiryInput(input(), NOW)).toEqual({});
  });

  it('reads the last 30 PNG days plus open inquiries, or only the filtered days', () => {
    expect(inquiryPeriod('2026-11-10')).toEqual({
      from: '2026-10-12', to: '2026-11-10', start: '2026-10-11T14:00:00.000Z', end: '2026-11-10T14:00:00.000Z', includeOpen: true,
    });
    expect(inquiryPeriod('2026-11-10', { from: '2026-11-05', to: '2026-11-03' })).toEqual({
      from: '2026-11-03', to: '2026-11-05', start: '2026-11-02T14:00:00.000Z', end: '2026-11-05T14:00:00.000Z', includeOpen: false,
    });
  });

  it('merges each inquiry once, newest first, then filters and searches', () => {
    const older = { ...open, id: '1', title: 'Parking for visitor', category: 'Parking' as const, priority: 'Low' as const, reportedAt: '2026-10-01T01:00:00.000Z' };
    const resolved = { ...open, id: '2', status: 'Resolved' as const, assigneeEmail: 'a@scpng.gov.pg', assigneeName: 'Anna', reportedAt: '2026-11-10T00:00:00.000Z' };
    const all = mergeInquiries([resolved, open], [older, open]);
    expect(all.map(i => i.id)).toEqual(['2', '4', '1']);
    expect(filterInquiries(all, { status: 'Open' }).map(i => i.id)).toEqual(['4', '1']);
    expect(filterInquiries(all, { assignees: [UNASSIGNED] }).map(i => i.id)).toEqual(['4', '1']);
    expect(filterInquiries(all, { assignees: ['a@scpng.gov.pg'], categories: ['IT Support'] }).map(i => i.id)).toEqual(['2']);
    expect(filterInquiries(all, { priorities: ['Low'] }).map(i => i.id)).toEqual(['1']);
    expect(searchInquiries(all, 'anna').map(i => i.id)).toEqual(['2']);
    expect(searchInquiries(all, '  ')).toHaveLength(3);
  });
});
