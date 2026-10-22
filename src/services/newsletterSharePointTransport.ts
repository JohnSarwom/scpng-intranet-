import { type Client, ResponseType } from '@microsoft/microsoft-graph-client';

export interface NewsletterQueueConfig {
  siteId: string;
  requestsId: string;
  partsId: string;
}
type FileReference = { siteId: string; listId: string; itemId: number };
const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** SharePoint records the authenticated creator; Power Automate owns every authoritative decision. */
export class NewsletterSharePointTransport {
  constructor(
    private graph: Client,
    private config: NewsletterQueueConfig,
    private pause = wait,
    private now = Date.now,
  ) {
    if (
      ![config.siteId, config.requestsId, config.partsId].every((v) =>
        /^[a-zA-Z0-9,.-]+$/.test(v)
      )
    ) {
      throw new Error(
        'Configure the SharePoint newsletter request lists first.',
      );
    }
  }
  private base(listId: string) {
    return `/sites/${this.config.siteId}/lists/${listId}/items`;
  }
  private async file(reference: FileReference): Promise<Blob> {
    if (
      reference?.siteId !== this.config.siteId ||
      !/^[a-f0-9-]{36}$/i.test(reference.listId) ||
      !Number.isInteger(reference.itemId) || reference.itemId < 1
    ) throw new Error('Invalid newsletter result-file reference.');
    const item = await this.graph.api(
      `${this.base(reference.listId)}/${reference.itemId}/driveItem`,
    ).get();
    if (!item.id || !item.parentReference?.driveId) {
      throw new Error('The newsletter result file is unavailable.');
    }
    return this.graph.api(
      `/drives/${item.parentReference.driveId}/items/${item.id}/content`,
    ).responseType(ResponseType.BLOB).get();
  }
  async execute<T>(
    action: string,
    data: Record<string, unknown> = {},
    binary = false,
  ): Promise<T> {
    const requestKey = crypto.randomUUID();
    const input = JSON.stringify({ ...data, action });
    if (input.length > 4500000) {
      throw new Error('This newsletter request is too large.');
    }
    const parts: string[] = [];
    if (input.length > 48000) {
      for (let i = 0; i < input.length; i += 40000) {
        parts.push(input.slice(i, i + 40000));
      }
    }
    // Parts are private to their creator. The flow checks the same creator and sequence before joining them.
    for (let i = 0; i < parts.length; i += 4) {
      await Promise.all(
        parts.slice(i, i + 4).map((text, offset) =>
          this.graph.api(this.base(this.config.partsId)).post({
            fields: {
              Title: `${requestKey}-${i + offset}`,
              RequestKey: requestKey,
              PartIndex: i + offset,
              PartText: text,
            },
          })
        ),
      );
    }
    let item: { id: string };
    try {
      item = await this.graph.api(this.base(this.config.requestsId)).post({
        fields: {
          Title: requestKey,
          Action: action,
          InputText: parts.length ? '' : input,
          PartCount: parts.length,
          Status: 'Queued',
        },
      });
    } catch (error) {
      // Resolve an uncertain create by its key; reject ambiguous matches.
      // The private ledger, rather than queue-field uniqueness, prevents mutation replay.
      const existing = await this.graph.api(
        `${
          this.base(this.config.requestsId)
        }?$filter=fields/Title eq '${requestKey}'&$select=id`,
      ).get().catch(() => null);
      if (existing?.value?.length !== 1) {
        throw new Error(
          `Newsletter request ${requestKey} could not be confirmed. Check its status before retrying. ${
            error instanceof Error ? error.message : ''
          }`,
        );
      }
      item = existing.value[0];
    }
    const deadline = this.now() + 180000;
    while (this.now() < deadline) {
      const result = await this.graph.api(
        `${this.base(this.config.requestsId)}/${item.id}?$expand=fields`,
      ).get();
      if (result.fields?.Status === 'Succeeded') {
        let output = JSON.parse(result.fields.ResponseText || 'null');
        if (output?.resultFile) {
          output = JSON.parse(
            await (await this.file(output.resultFile)).text(),
          );
        }
        return (binary ? await this.file(output.downloadFile) : output) as T;
      }
      if (['Failed', 'Uncertain'].includes(result.fields?.Status)) {
        throw new Error(
          `${
            result.fields.ErrorMessage ||
            'Power Automate could not confirm this request.'
          } Request: ${requestKey}. Check the result before retrying.`,
        );
      }
      await this.pause(2000);
    }
    throw new Error(
      `Power Automate is still processing request ${requestKey}. Its outcome is not yet confirmed; check before retrying. No replacement request was submitted.`,
    );
  }
}
