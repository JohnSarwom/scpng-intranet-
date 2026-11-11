import { describe, expect, it, vi } from 'vitest';
import { persistNewsletterDraft } from './newsletters/newsletterDraftActions';
import { emptyContent, type Newsletter } from './newsletters/newsletterWorkflow';

function setup() {
  const content = { ...emptyContent(), title: 'Test', summary: 'Pilot summary', body: 'Pilot content', sensitiveChecked: true };
  const record: Newsletter = {
    id: 'draft', authorOid: 'john', authorName: 'John', division: 'Corporate Services Division',
    status: 'draft', content, version: 'version-1', revision: 2,
    createdAt: '2026-10-22T00:00:00Z', updatedAt: '2026-10-22T00:00:00Z', events: [],
  };
  const saved = { ...record, revision: 3, content: { ...content, title: 'Changed' } };
  const submitted: Newsletter = { ...saved, revision: 4, status: 'division_review' };
  const service = { save: vi.fn().mockResolvedValue(saved), action: vi.fn().mockResolvedValue(submitted) };
  const confirmed = vi.fn(), progress = vi.fn();
  return { content, record, saved, submitted, service, confirmed, progress };
}
describe('newsletter save and submit queue pressure', () => {
  it('rejects an unchecked declaration before saving or submitting', async () => {
    const x = setup();
    await expect(persistNewsletterDraft(x.service, x.record, { ...x.content, title: 'Changed', sensitiveChecked: false }, true, x.confirmed, x.progress)).rejects.toThrow('Content checklist');
    expect(x.service.save).not.toHaveBeenCalled();
    expect(x.service.action).not.toHaveBeenCalled();
    expect(x.confirmed).not.toHaveBeenCalled();
  });
  it.each(['title', 'summary', 'body'] as const)('rejects missing %s before either request', async field => {
    const x = setup();
    await expect(persistNewsletterDraft(x.service, x.record, { ...x.content, [field]: ' ' }, true, x.confirmed, x.progress)).rejects.toThrow('Before submitting');
    expect(x.service.save).not.toHaveBeenCalled();
    expect(x.service.action).not.toHaveBeenCalled();
  });
  it('does not queue a save when all changes are already saved', async () => {
    const x = setup();
    expect(await persistNewsletterDraft(x.service, x.record, x.content, false, x.confirmed, x.progress)).toBe(false);
    expect(x.service.save).not.toHaveBeenCalled();
    expect(x.service.action).not.toHaveBeenCalled();
  });
  it('submits an unchanged draft in one request using its current revision', async () => {
    const x = setup();
    await persistNewsletterDraft(x.service, x.record, x.content, true, x.confirmed, x.progress);
    expect(x.service.save).not.toHaveBeenCalled();
    expect(x.service.action).toHaveBeenCalledWith(x.record, 'submit');
    expect(x.service.action).toHaveBeenCalledTimes(1);
    expect(x.progress).toHaveBeenCalledWith('Submitting your newsletter for approval…');
    expect(x.confirmed).toHaveBeenCalledWith(x.submitted);
  });
  it('saves changed content once, then submits the confirmed new revision', async () => {
    const x = setup();
    await persistNewsletterDraft(x.service, x.record, x.saved.content, true, x.confirmed, x.progress);
    expect(x.service.save).toHaveBeenCalledWith(x.record, x.saved.content);
    expect(x.service.save).toHaveBeenCalledTimes(1);
    expect(x.service.action).toHaveBeenCalledWith(x.saved, 'submit');
    expect(x.service.action).toHaveBeenCalledTimes(1);
    expect(x.confirmed.mock.calls).toEqual([[x.saved], [x.submitted]]);
    expect(x.progress.mock.calls).toEqual([['Saving your draft…'], ['Submitting your newsletter for approval…']]);
  });
  it('does not submit when saving fails', async () => {
    const x = setup(); x.service.save.mockRejectedValue(new Error('Unconfirmed save'));
    await expect(persistNewsletterDraft(x.service, x.record, x.saved.content, true, x.confirmed, x.progress)).rejects.toThrow('Unconfirmed save');
    expect(x.service.action).not.toHaveBeenCalled();
    expect(x.confirmed).not.toHaveBeenCalled();
  });
  it('retains the confirmed save if approval submission fails', async () => {
    const x = setup(); x.service.action.mockRejectedValue(new Error('No reviewer'));
    await expect(persistNewsletterDraft(x.service, x.record, x.saved.content, true, x.confirmed, x.progress)).rejects.toThrow('No reviewer');
    expect(x.confirmed.mock.calls).toEqual([[x.saved]]);
  });
});
