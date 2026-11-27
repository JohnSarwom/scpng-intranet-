import { describe, expect, it } from 'vitest';
import { describeSaveError } from './saveErrors';
import { ChristmasListNotReadyError } from './christmasEventService';

const graph = (statusCode: number, message = 'error') => Object.assign(new Error(message), { statusCode });

describe('describeSaveError', () => {
  it('tells read-only staff it is a permission problem, not their connection', () => {
    const msg = describeSaveError(graph(403, 'Access denied'), true);
    expect(msg).toMatch(/permission/);
    expect(msg).not.toMatch(/connection/);
  });

  it('blames the connection only when the request never got a reply', () => {
    expect(describeSaveError(graph(-1, 'Failed to fetch'), true)).toMatch(/connection/);
    expect(describeSaveError(new TypeError('Failed to fetch'), true)).toMatch(/connection/);
    expect(describeSaveError(graph(500), false)).toMatch(/connection/);
  });

  it('asks people to wait when SharePoint is busy', () => {
    expect(describeSaveError(graph(429), true)).toMatch(/busy/);
  });

  it('spots an expired sign-in', () => {
    const err = Object.assign(new Error('interaction_required: AADSTS50058'), { name: 'InteractionRequiredAuthError' });
    expect(describeSaveError(err, true)).toMatch(/sign-in has expired/);
  });

  it('says when the list is not set up', () => {
    expect(describeSaveError(new ChristmasListNotReadyError(), true)).toMatch(/isn't set up/);
  });

  it('gives the error code for anything else, and always reassures', () => {
    const msg = describeSaveError(graph(400, 'Invalid request'), true);
    expect(msg).toMatch(/error 400/);
    expect(msg).toMatch(/kept on this computer/);
  });
});
