import { describe, expect, it } from 'vitest';
import type { Client } from '@microsoft/microsoft-graph-client';
import { NewsletterSharePointTransport } from './newsletterSharePointTransport';

function fixture(
  options: {
    statuses?: string[];
    uncertainCreate?: boolean;
    missingCreate?: boolean;
    output?: unknown;
    tick?: number;
  } = {},
) {
  const writes: { url: string; data: { fields: Record<string, unknown> } }[] =
    [];
  const reads: string[] = [];
  let clock = 0;
  let count = 0;
  const graph = {
    api: (url: string) => ({
      async post(data: { fields: Record<string, unknown> }) {
        writes.push({ url, data });
        if (
          url.includes('/requests/') && options.uncertainCreate
        ) throw new Error('Connection interrupted');
        return { id: '1' };
      },
      async get() {
        reads.push(url);
        if (url.includes('$filter=')) {
          return {
            value: options.missingCreate ? [] : [{ id: '1' }],
          };
        }
        const statuses = options.statuses ||
          ['Queued', 'Processing', 'Succeeded'];
        return {
          fields: {
            Status: statuses[Math.min(count++, statuses.length - 1)],
            ResponseText: JSON.stringify(options.output || { ok: true }),
            ErrorMessage: 'The reviewed version changed.',
          },
        };
      },
    }),
  } as unknown as Client;
  const pause = async () => {
    clock += options.tick || 2000;
  };
  return {
    writes,
    reads,
    transport: new NewsletterSharePointTransport(
      graph,
      { siteId: 'site', requestsId: 'requests', partsId: 'parts' },
      pause,
      () => clock,
    ),
  };
}

describe('Power Automate newsletter SharePoint transport', () => {
  it('queues once under the signed-in SharePoint identity and waits for a confirmed result', async () => {
    const f = fixture();
    expect(await f.transport.execute('create')).toEqual({ ok: true });
    expect(f.writes).toHaveLength(1);
    expect(f.writes[0].url).toBe('/sites/site/lists/requests/items');
    expect(f.writes[0].data.fields).toMatchObject({
      Action: 'create',
      Status: 'Queued',
      PartCount: 0,
    });
    expect(f.writes[0].data.fields).not.toHaveProperty('Author');
    expect(f.reads).toHaveLength(3);
  });
  it('resolves an uncertain create by its unique request key without submitting twice', async () => {
    const f = fixture({ uncertainCreate: true });
    expect(await f.transport.execute('submit', { id: 'draft', revision: 1 }))
      .toEqual({ ok: true });
    expect(f.writes).toHaveLength(1);
    expect(f.reads.some((url) => url.includes('$filter=fields/Title'))).toBe(
      true,
    );
  });
  it('does not replay a create whose outcome cannot be confirmed', async () => {
    const f = fixture({ uncertainCreate: true, missingCreate: true });
    await expect(f.transport.execute('publish')).rejects.toThrow(
      'before retrying',
    );
    expect(f.writes).toHaveLength(1);
  });
  it.each(['Failed', 'Uncertain'])(
    'reports %s without another mutation',
    async (status) => {
      const f = fixture({ statuses: [status] });
      await expect(f.transport.execute('approve', { revision: 1 })).rejects
        .toThrow('reviewed version changed');
      expect(f.writes).toHaveLength(1);
    },
  );
  it('reports a pending timeout without automatically replacing the request', async () => {
    const f = fixture({ statuses: ['Processing'], tick: 60000 });
    await expect(f.transport.execute('publish')).rejects.toThrow(
      'No replacement request',
    );
    expect(f.writes).toHaveLength(1);
  });
  it('splits large uploads into bounded creator-owned parts before the final queue item', async () => {
    const f = fixture();
    await f.transport.execute('upload', {
      base64: 'a'.repeat(130000),
      name: 'report.pdf',
    });
    const parts = f.writes.filter((row) => row.url.includes('/parts/'));
    expect(parts).toHaveLength(4);
    expect(parts.map((row) => row.data.fields.PartIndex).sort()).toEqual([
      0,
      1,
      2,
      3,
    ]);
    expect(
      parts.every((row) => String(row.data.fields.PartText).length <= 40000),
    ).toBe(true);
    const queued = f.writes[f.writes.length - 1];
    expect(queued.url).toContain('/requests/');
    expect(queued.data.fields.PartCount).toBe(4);
    const reconstructed = parts.sort((a, b) =>
      Number(a.data.fields.PartIndex) - Number(b.data.fields.PartIndex)
    ).map((row) => row.data.fields.PartText).join('');
    expect(JSON.parse(reconstructed)).toMatchObject({
      action: 'upload',
      name: 'report.pdf',
    });
    expect(
      parts.every((row) =>
        row.data.fields.RequestKey === queued.data.fields.Title
      ),
    ).toBe(true);
  });
  it('never writes authoritative submissions, publications, permissions or appointments directly', async () => {
    const f = fixture();
    await f.transport.execute('routing_admin_save', {
      config: { assignments: [] },
    });
    expect(
      f.writes.every((row) =>
        row.url.includes('/requests/') || row.url.includes('/parts/')
      ),
    ).toBe(true);
  });
  it('rejects oversized data before creating any queue item', async () => {
    const f = fixture();
    await expect(f.transport.execute('upload', { base64: 'a'.repeat(4500000) }))
      .rejects.toThrow('too large');
    expect(f.writes).toHaveLength(0);
  });
  it('reads a large result through its restricted SharePoint delivery file', async () => {
    const listId = '11111111-1111-1111-1111-111111111111';
    const requested: string[] = [];
    const graph = {
      api: (url: string) => ({
        responseType() {
          return this;
        },
        post: async () => ({ id: '1' }),
        async get() {
          requested.push(url);
          if (url.endsWith('/driveItem')) {
            return {
              id: 'file',
              parentReference: { driveId: 'drive' },
            };
          }
          if (url.endsWith('/content')) {
            return new Blob([
              JSON.stringify({ verified: true }),
            ]);
          }
          return {
            fields: {
              Status: 'Succeeded',
              ResponseText: JSON.stringify({
                resultFile: { siteId: 'site', listId, itemId: 7 },
              }),
            },
          };
        },
      }),
    } as unknown as Client;
    const transport = new NewsletterSharePointTransport(graph, {
      siteId: 'site',
      requestsId: 'requests',
      partsId: 'parts',
    });
    expect(await transport.execute('list')).toEqual({ verified: true });
    expect(requested).toContain(
      `/sites/site/lists/${listId}/items/7/driveItem`,
    );
  });
  it('rejects a result-file reference outside the configured request site', async () => {
    const f = fixture({
      output: {
        resultFile: {
          siteId: 'different-site',
          listId: '11111111-1111-1111-1111-111111111111',
          itemId: 1,
        },
      },
    });
    await expect(f.transport.execute('list')).rejects.toThrow(
      'Invalid newsletter result-file',
    );
  });
});
