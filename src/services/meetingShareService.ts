import { Client } from '@microsoft/microsoft-graph-client';
import { MeetingData } from '@/components/meeting/MeetingMinutesForm';

export interface ShareResult {
  success: boolean;
  message: string;
  shareLink?: string;
  error?: any;
}

export class MeetingShareService {
  private client: Client;
  private siteId: string;

  constructor(client: Client, siteId: string) {
    this.client = client;
    this.siteId = siteId;
  }

  /**
   * Resolves the drive ID for a given document library name.
   */
  async getDriveIdByName(libraryName: string): Promise<string> {
    const drives = await this.client.api(`/sites/${this.siteId}/drives`).get();
    const drive = drives.value.find((d: any) => d.name === libraryName);
    if (!drive) {
      throw new Error(`Document library "${libraryName}" not found. Please initialize SharePoint first.`);
    }
    return drive.id;
  }

  /**
   * Resolves the list ID for a given list name.
   */
  async getListIdByName(listName: string): Promise<string> {
    const lists = await this.client.api(`/sites/${this.siteId}/lists`).get();
    const list = lists.value.find((l: any) => l.displayName === listName);
    if (!list) {
      throw new Error(`List "${listName}" not found. Please initialize SharePoint first.`);
    }
    return list.id;
  }

  /**
   * Uploads the meeting minutes docx to the drafts library.
   */
  async uploadDraft(data: MeetingData, blob: Blob): Promise<{ id: string; webUrl: string }> {
    const driveId = await this.getDriveIdByName('Meeting_Minutes_Drafts');
    
    const fileName = `Meeting_Minutes_${(data.particulars.name || 'Draft').replace(/[^a-zA-Z0-9_\- ]/g, '')}_${data.particulars.date}.docx`;
    
    // Large file upload session is safer, but for small docx files, simple PUT works
    // We'll use simple PUT for now as these are typically < 4MB
    const response = await this.client
      .api(`/drives/${driveId}/root:/${fileName}:/content`)
      .put(blob);

    return {
      id: response.id,
      webUrl: response.webUrl,
      driveId: driveId
    };
  }

  /**
   * Registers the meeting in the metadata registry.
   */
  async registerMetadata(data: MeetingData, documentUrl: string): Promise<void> {
    const listId = await this.getListIdByName('Meeting_Minutes_Registry');
    
    const payload = {
      fields: {
        Title: data.particulars.name || 'Untitled Meeting',
        MeetingDate: data.particulars.date ? new Date(data.particulars.date).toISOString() : null,
        Facilitator: data.particulars.facilitator,
        Venue: data.particulars.venue,
        AttendeesJSON: JSON.stringify(data.attendance),
        DocumentUrl: documentUrl,
        Status: 'Draft'
      }
    };

    await this.client.api(`/sites/${this.siteId}/lists/${listId}/items`).post(payload);
  }

  /**
   * Creates an "Organization-wise" sharing link with Edit permissions.
   */
  async createSharingLink(driveId: string, driveItemId: string): Promise<string> {
    // Generate an organization-specific edit link
    // We target the specific driveId instead of the site's default /drive
    const response = await this.client
      .api(`/drives/${driveId}/items/${driveItemId}/createLink`)
      .post({
        type: 'edit',
        scope: 'organization'
      });

    return response.link.webUrl;
  }

  /**
   * Sends notification emails to all attendees.
   */
  async sendNotifications(recipients: string[], shareLink: string, customMessage: string, meetingName: string): Promise<void> {
    if (recipients.length === 0) return;

    const emailBody = `
      <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #83002A;">Meeting Minutes Sharing</h2>
          <p>Hello,</p>
          <p>The draft meeting minutes for <strong>${meetingName}</strong> have been shared with you for review and editing.</p>
          ${customMessage ? `<div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #83002A; margin: 20px 0;">${customMessage}</div>` : ''}
          <p>You can access and edit the document directly via the link below:</p>
          <p><a href="${shareLink}" style="background: #83002A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Open Meeting Minutes</a></p>
          <br/>
          <p style="font-size: 12px; color: #777;">This is an automated notification from the SCPNG Intranet Meeting Minutes Module.</p>
        </body>
      </html>
    `;

    const message = {
      subject: `Meeting Minutes: ${meetingName}`,
      body: {
        contentType: 'HTML',
        content: emailBody,
      },
      toRecipients: recipients.map(email => ({
        emailAddress: {
          address: email,
        },
      })),
    };

    await this.client.api('/me/sendMail').post({ message });
  }

  /**
   * Orchestrates the entire sharing workflow.
   */
  async shareWithAttendees(data: MeetingData, blob: Blob, customMessage: string): Promise<ShareResult> {
    try {
      // 1. Upload file
      const { id: driveItemId, webUrl, driveId } = await this.uploadDraft(data, blob);
      
      // 2. Register metadata
      await this.registerMetadata(data, webUrl);
      
      // 3. Create sharing link
      const shareLink = await this.createSharingLink(driveId, driveItemId);
      
      // 4. Send emails
      const recipients = data.attendance
        .map(a => a.email)
        .filter(email => !!email && email.includes('@'));
      
      await this.sendNotifications(recipients, shareLink, customMessage, data.particulars.name);
      
      return {
        success: true,
        message: 'Meeting minutes shared successfully with all attendees.',
        shareLink
      };
    } catch (error: any) {
      console.error('Sharing failed:', error);
      return {
        success: false,
        message: error.message || 'An unexpected error occurred during sharing.',
        error
      };
    }
  }
}
