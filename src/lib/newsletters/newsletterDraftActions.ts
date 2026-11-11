import type { Content, Newsletter } from './newsletterWorkflow';
import { validateContent } from './newsletterWorkflow';

type DraftService = {
  save: (record: Newsletter, content: Content) => Promise<Newsletter>;
  action: (record: Newsletter, action: string) => Promise<Newsletter>;
};

/** Validate before enqueueing; backend validation remains authoritative. */
export async function persistNewsletterDraft(
  service: DraftService,
  record: Newsletter,
  content: Content,
  submit: boolean,
  confirmed: (record: Newsletter) => void,
  progress: (message: string) => void,
): Promise<boolean> {
  validateContent(content);
  if (submit) {
    const missing = [
      !content.title.trim() && 'a title',
      !content.summary.trim() && 'a summary',
      !content.body.trim() && 'content',
    ].filter(Boolean);
    if (missing.length) throw new Error(`Before submitting, add ${missing.join(', ')}.`);
    if (!content.sensitiveChecked) {
      throw new Error('Before submitting, tick “I have checked for confidential and personal information” in the Content checklist.');
    }
  }
  const changed = JSON.stringify(content) !== JSON.stringify(record.content);
  let current = record;
  if (changed) {
    progress('Saving your draft…');
    current = await service.save(record, content);
    confirmed(current);
  }
  if (submit) {
    progress('Submitting your newsletter for approval…');
    current = await service.action(current, 'submit');
    confirmed(current);
  }
  return changed;
}
