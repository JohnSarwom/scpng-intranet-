/**
 * UAT Feedback Service — SharePoint Backend
 * Stores feedback in the UAT_Feedback SharePoint list.
 * File attachments are uploaded to Asset Images/FeedBackFiles.
 */
import { Client } from '@microsoft/microsoft-graph-client';

export const FEEDBACK_CONFIG = {
  SITE_HOSTNAME: 'scpng1.sharepoint.com',
  SITE_PATH: '/sites/scpngintranet',
  LIST_NAME: 'UAT_Feedback',
  LIBRARY_NAME: 'Asset Images',
  UPLOAD_FOLDER: 'FeedBackFiles',
} as const;

export type FeedbackCategory =
  | 'Bug Report'
  | 'UI/UX Issue'
  | 'Feature Request'
  | 'General Comment'
  | 'Performance Issue';

export type FeedbackStatus = 'New' | 'Reviewed' | 'Resolved';

export interface UATFeedbackItem {
  id?: string;
  pageName: string;
  pageRoute: string;
  userName: string;
  userEmail: string;
  rating: number;
  category: FeedbackCategory;
  comment: string;
  status?: FeedbackStatus;
  attachmentUrl?: string;
  createdAt?: string;
}

export class FeedbackSharePointService {
  private client: Client;
  private siteId = '';
  private listId = '';

  constructor(client: Client) {
    this.client = client;
  }

  private async init() {
    if (this.siteId && this.listId) return;
    const { SITE_HOSTNAME, SITE_PATH, LIST_NAME } = FEEDBACK_CONFIG;

    const site = await this.client
      .api(`/sites/${SITE_HOSTNAME}:${SITE_PATH}`)
      .get();
    this.siteId = site.id;

    const lists = await this.client
      .api(`/sites/${this.siteId}/lists`)
      .filter(`displayName eq '${LIST_NAME}'`)
      .get();

    if (!lists.value?.length) {
      throw new Error(
        `SharePoint list '${LIST_NAME}' not found. Please create it first from Test Ground.`
      );
    }
    this.listId = lists.value[0].id;
  }

  async getAll(): Promise<UATFeedbackItem[]> {
    await this.init();
    const response = await this.client
      .api(`/sites/${this.siteId}/lists/${this.listId}/items`)
      .expand('fields')
      .orderby('createdDateTime desc')
      .top(500)
      .get();

    return (response.value ?? []).map((item: any) => ({
      id: item.id,
      pageName: item.fields.Title ?? '',
      pageRoute: item.fields.PageRoute ?? '',
      userName: item.fields.UserName ?? '',
      userEmail: item.fields.UserEmail ?? '',
      rating: Number(item.fields.Rating) || 0,
      category: item.fields.Category as FeedbackCategory,
      comment: item.fields.Comment ?? '',
      status: (item.fields.Status as FeedbackStatus) ?? 'New',
      attachmentUrl: item.fields.AttachmentUrl ?? '',
      createdAt: item.createdDateTime,
    }));
  }

  async updateStatus(id: string, status: FeedbackStatus): Promise<void> {
    await this.init();
    await this.client
      .api(`/sites/${this.siteId}/lists/${this.listId}/items/${id}/fields`)
      .patch({ Status: status });
  }

  async delete(id: string): Promise<void> {
    await this.init();
    await this.client
      .api(`/sites/${this.siteId}/lists/${this.listId}/items/${id}`)
      .delete();
  }

  /** Called from TestGround to bootstrap the list */
  static async createList(
    client: Client,
    siteId: string
  ): Promise<{ success: boolean; message: string }> {
    const { LIST_NAME } = FEEDBACK_CONFIG;
    try {
      await client.api(`/sites/${siteId}/lists`).post({
        displayName: LIST_NAME,
        columns: [
          { name: 'PageRoute', text: {} },
          { name: 'UserName', text: {} },
          { name: 'UserEmail', text: {} },
          {
            name: 'Rating',
            number: { decimalPlaces: 'none', minimum: 1, maximum: 5 },
          },
          {
            name: 'Category',
            choice: {
              choices: [
                'Bug Report',
                'UI/UX Issue',
                'Feature Request',
                'General Comment',
                'Performance Issue',
              ],
              allowTextEntry: false,
            },
          },
          { name: 'Comment', text: { allowMultipleLines: true, maxLength: 2000 } },
          {
            name: 'Status',
            choice: {
              choices: ['New', 'Reviewed', 'Resolved'],
              defaultValue: 'New',
              allowTextEntry: false,
            },
          },
          // Short text — stores the SharePoint webUrl of the uploaded attachment
          { name: 'AttachmentUrl', text: {} },
        ],
        list: { template: 'genericList' },
      });
      return { success: true, message: `List '${LIST_NAME}' created successfully!` };
    } catch (error: any) {
      const code = error?.code ?? '';
      if (error?.statusCode === 409 || code === 'resourceAlreadyExists') {
        return { success: false, message: `List '${LIST_NAME}' already exists.` };
      }
      throw error;
    }
  }
}
