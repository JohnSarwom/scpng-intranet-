import { describe, expect, it } from 'vitest';
import { isQueuedPilotRead } from './newsletterPilotQueue';

const read = { Status: 'Queued', PartCount: 0, Action: 'notifications', InputText: '{"action":"notifications"}' };
describe('holding old pilot read requests', () => {
  it('accepts queued notification and appointment-loading reads', () => {
    expect(isQueuedPilotRead(read)).toBe(true);
    expect(isQueuedPilotRead({ ...read, Action: 'routing_admin_get', InputText: '{"action":"routing_admin_get"}' })).toBe(true);
  });
  it('preserves work that has already started or completed', () => {
    for (const Status of ['Processing', 'Succeeded', 'Uncertain', 'Failed', 'PilotHeld']) expect(isQueuedPilotRead({ ...read, Status })).toBe(false);
  });
  it('refuses decisions and mismatched or malformed command payloads', () => {
    expect(isQueuedPilotRead({ ...read, Action: 'publish', InputText: '{"action":"publish"}' })).toBe(false);
    expect(isQueuedPilotRead({ ...read, InputText: '{"action":"publish"}' })).toBe(false);
    expect(isQueuedPilotRead({ ...read, InputText: '{' })).toBe(false);
  });
  it('refuses multipart requests and missing part counts', () => {
    for (const PartCount of [1, undefined, null, '0']) expect(isQueuedPilotRead({ ...read, PartCount })).toBe(false);
  });
});
