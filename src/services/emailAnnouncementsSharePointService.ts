import { Client } from "@microsoft/microsoft-graph-client";
import { IAnnouncement } from "@/types";

// These lists must be secured independently in SharePoint before the feature flag is enabled.
const SITE = "/sites/scpng1.sharepoint.com:/sites/scpngintranet";
export const EMAIL_NOTICE_LISTS = [
  { name: "EmailAnnouncements_AllStaff", audience: "All Staff" },
  { name: "EmailAnnouncements_AllOfficers", audience: "All Officers" },
] as const;

interface GraphListItem {
  id: string;
  fields: {
    Title?: string;
    Content?: string;
    SourceEmail?: string;
    ReceivedDate?: string;
    InternetMessageId?: string;
    Created?: string;
  };
}

export function mergeEmailAnnouncements(items: IAnnouncement[]): IAnnouncement[] {
  const merged = new Map<string, IAnnouncement>();
  for (const item of items) {
    const key = item.internetMessageId?.trim() || item.id;
    const prior = merged.get(key);
    if (prior && prior.audience !== item.audience) {
      prior.audience = "Both groups";
    } else if (!prior) {
      merged.set(key, { ...item });
    }
  }
  return [...merged.values()].sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());
}

export class EmailAnnouncementsSharePointService {
  constructor(private client: Client) {}

  async getAnnouncements(): Promise<IAnnouncement[]> {
    const site = await this.client.api(SITE).get();
    const lists = await this.client.api(`/sites/${site.id}/lists`).get();
    const availableLists: Array<{ id: string; displayName: string }> = lists.value || [];
    const allItems: IAnnouncement[] = [];

    for (const target of EMAIL_NOTICE_LISTS) {
      const list = availableLists.find(item => item.displayName === target.name);
      if (!list) continue;

      try {
        let pageUrl: string | undefined = `/sites/${site.id}/lists/${list.id}/items?$expand=fields&$top=100`;
        while (pageUrl) {
          const result: { value?: GraphListItem[]; "@odata.nextLink"?: string } =
            await this.client.api(pageUrl).get();
          for (const item of result.value || []) {
            const fields = item.fields || {};
            if (!fields.Title || !fields.Content || !fields.InternetMessageId) continue;
            const received = new Date(fields.ReceivedDate || fields.Created || "");
            allItems.push({
              id: `${target.name}:${item.id}`,
              title: fields.Title,
              content: fields.Content,
              sourceEmail: fields.SourceEmail,
              createdDate: Number.isNaN(received.getTime()) ? new Date(0) : received,
              internetMessageId: fields.InternetMessageId,
              audience: target.audience,
              source: "email",
              category: "Announcement",
              isPinned: false,
            });
          }
          pageUrl = result["@odata.nextLink"];
        }
      } catch (error: unknown) {
        // A member of only one mail group must not be blocked by the other list.
        const status = (error as { statusCode?: number; status?: number }).statusCode
          ?? (error as { status?: number }).status;
        if (status !== 403 && status !== 404) throw error;
      }
    }

    return mergeEmailAnnouncements(allItems);
  }
}
