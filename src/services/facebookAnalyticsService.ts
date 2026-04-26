import { Client } from '@microsoft/microsoft-graph-client';

export interface FacebookPost {
    id: string;
    postId: string;
    postType: string;
    postMessage: string;
    createdTime: string;
    postLink: string;
    imageUrl: string;
    videoUrl: string;
    reactions: number;
    shares: number;
    lastSyncedAt: string;
}

export interface FacebookComment {
    id: string;
    commentId: string;
    postId: string;
    commentType: string;
    commentMessage: string;
    commentAuthor: string;
    commentTime: string;
}

export interface FacebookMessage {
    id: string;
    messageId: string;
    conversationId: string;
    senderName: string;
    senderId: string;
    direction: string;
    messageText: string;
    timestamp: string;
}

const SITE_PATH = '/sites/scpng1.sharepoint.com:/sites/scpngintranet';
const LIST_NAMES = {
    posts: 'Facebook_Posts',
    comments: 'Facebook_Comments',
    messages: 'Facebook_Messages',
} as const;

async function resolveSiteAndLists(client: Client): Promise<{ siteId: string; listIds: Record<string, string> }> {
    const site = await client.api(SITE_PATH).get();
    const siteId = site.id as string;

    const targets = new Set<string>([LIST_NAMES.posts, LIST_NAMES.comments, LIST_NAMES.messages]);
    const listIds: Record<string, string> = {};

    let next: string | null = `/sites/${siteId}/lists?$select=id,displayName&$top=200`;
    while (next) {
        const res: any = await client.api(next).get();
        for (const l of res.value || []) {
            if (!targets.has(l.displayName)) continue;
            if (l.displayName === LIST_NAMES.posts) listIds.posts = l.id;
            if (l.displayName === LIST_NAMES.comments) listIds.comments = l.id;
            if (l.displayName === LIST_NAMES.messages) listIds.messages = l.id;
        }
        if (listIds.posts && listIds.comments && listIds.messages) break;
        next = res['@odata.nextLink'] || null;
        if (next) {
            const idx = next.indexOf('/sites/');
            if (idx > 0) next = next.substring(idx);
        }
    }
    return { siteId, listIds };
}

async function fetchAllItems(client: Client, siteId: string, listId: string): Promise<any[]> {
    const items: any[] = [];
    let next: string | null = `/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=200`;
    while (next) {
        const res: any = await client.api(next).get();
        items.push(...(res.value || []));
        next = res['@odata.nextLink'] || null;
        if (next) {
            const idx = next.indexOf('/sites/');
            if (idx > 0) next = next.substring(idx);
        }
    }
    return items;
}

export class FacebookAnalyticsService {
    constructor(private client: Client) {}

    async loadAll(): Promise<{ posts: FacebookPost[]; comments: FacebookComment[]; messages: FacebookMessage[] }> {
        const { siteId, listIds } = await resolveSiteAndLists(this.client);

        if (!listIds.posts || !listIds.comments || !listIds.messages) {
            throw new Error('Facebook SharePoint lists not found. Deploy them from the Test Ground page first.');
        }

        const [rawPosts, rawComments, rawMessages] = await Promise.all([
            fetchAllItems(this.client, siteId, listIds.posts),
            fetchAllItems(this.client, siteId, listIds.comments),
            fetchAllItems(this.client, siteId, listIds.messages),
        ]);

        const posts: FacebookPost[] = rawPosts.map(it => {
            const f = it.fields || {};
            return {
                id: it.id,
                postId: f.PostId || '',
                postType: f.PostType || 'text',
                postMessage: f.PostMessage || '',
                createdTime: f.CreatedTime || '',
                postLink: f.PostLink || '',
                imageUrl: f.ImageUrl || '',
                videoUrl: f.VideoUrl || '',
                reactions: Number(f.Reactions) || 0,
                shares: Number(f.Shares) || 0,
                lastSyncedAt: f.LastSyncedAt || '',
            };
        });

        const comments: FacebookComment[] = rawComments.map(it => {
            const f = it.fields || {};
            return {
                id: it.id,
                commentId: f.CommentId || '',
                postId: f.PostId || '',
                commentType: f.CommentType || 'comment',
                commentMessage: f.CommentMessage || '',
                commentAuthor: f.CommentAuthor || '',
                commentTime: f.CommentTime || '',
            };
        });

        const messages: FacebookMessage[] = rawMessages.map(it => {
            const f = it.fields || {};
            return {
                id: it.id,
                messageId: f.MessageId || '',
                conversationId: f.ConversationId || '',
                senderName: f.SenderName || '',
                senderId: f.SenderId || '',
                direction: f.Direction || '',
                messageText: f.MessageText || '',
                timestamp: f.Timestamp || '',
            };
        });

        posts.sort((a, b) => (b.createdTime || '').localeCompare(a.createdTime || ''));
        comments.sort((a, b) => (b.commentTime || '').localeCompare(a.commentTime || ''));
        messages.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

        return { posts, comments, messages };
    }
}
