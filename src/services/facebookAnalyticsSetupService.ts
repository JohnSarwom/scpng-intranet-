import { Client } from '@microsoft/microsoft-graph-client';

export interface FacebookListsSetupResult {
    success: boolean;
    message: string;
    listIds?: {
        posts?: string;
        comments?: string;
        messages?: string;
    };
    error?: unknown;
}

export interface DropUrlColumnsResult {
    success: boolean;
    message: string;
    dropped: string[];
    failed: { column: string; error: string }[];
}

type ColumnDef = Record<string, unknown>;

export class FacebookAnalyticsSetupService {
    private client: Client;
    private siteId: string;

    private postsListName = 'Facebook_Posts';
    private commentsListName = 'Facebook_Comments';
    private messagesListName = 'Facebook_Messages';

    constructor(client: Client, siteId: string) {
        this.client = client;
        this.siteId = siteId;
    }

    private txt = (name: string): ColumnDef => ({ name, text: {} });
    private note = (name: string): ColumnDef => ({
        name,
        text: { allowMultipleLines: true, textType: 'plain', maxLength: 63999 },
    });
    private num = (name: string): ColumnDef => ({ name, number: {} });
    private dt = (name: string): ColumnDef => ({
        name,
        dateTime: { displayAs: 'default', format: 'dateTime' },
    });

    private async findListIdByName(displayName: string): Promise<string | null> {
        try {
            const res = await this.client
                .api(`/sites/${this.siteId}/lists`)
                .filter(`displayName eq '${displayName}'`)
                .get();
            if (res?.value?.length > 0) return res.value[0].id as string;
            return null;
        } catch (e) {
            console.error(`Failed to search for list ${displayName}:`, e);
            return null;
        }
    }

    private async createList(displayName: string, description: string, columns: ColumnDef[]): Promise<string> {
        const existing = await this.findListIdByName(displayName);
        if (existing) {
            console.log(`ℹ️  List "${displayName}" already exists (id: ${existing}). Skipping creation.`);
            return existing;
        }

        const created = await this.client
            .api(`/sites/${this.siteId}/lists`)
            .post({
                displayName,
                description,
                list: { template: 'genericList' },
                columns,
            });

        console.log(`✅ Created list "${displayName}" — id: ${created.id}`);
        return created.id as string;
    }

    async setupAllLists(): Promise<FacebookListsSetupResult> {
        console.log('🚀 [Facebook Analytics Setup] Creating SharePoint lists...');

        try {
            const postsId = await this.createList(
                this.postsListName,
                'Facebook page posts synced from the Facebook Graph API via Google Apps Script.',
                [
                    this.txt('PostId'),
                    this.txt('PostType'),
                    this.note('PostMessage'),
                    this.dt('CreatedTime'),
                    // URL fields are multi-line because Facebook CDN URLs
                    // routinely exceed the 255-char single-line limit.
                    this.note('PostLink'),
                    this.note('ImageUrl'),
                    this.note('VideoUrl'),
                    this.num('Reactions'),
                    this.num('Shares'),
                    this.dt('LastSyncedAt'),
                ],
            );

            const commentsId = await this.createList(
                this.commentsListName,
                'Comments and replies on Facebook page posts.',
                [
                    this.txt('PostId'),
                    this.txt('CommentId'),
                    this.txt('CommentType'),
                    this.note('CommentMessage'),
                    this.txt('CommentAuthor'),
                    this.dt('CommentTime'),
                ],
            );

            const messagesId = await this.createList(
                this.messagesListName,
                'Facebook Messenger conversations and messages for the page.',
                [
                    this.txt('MessageId'),
                    this.txt('ConversationId'),
                    this.txt('SenderName'),
                    this.txt('SenderId'),
                    this.txt('Direction'),
                    this.note('MessageText'),
                    this.dt('Timestamp'),
                ],
            );

            return {
                success: true,
                message: `Facebook analytics lists ready. Posts: ${postsId} | Comments: ${commentsId} | Messages: ${messagesId}`,
                listIds: { posts: postsId, comments: commentsId, messages: messagesId },
            };
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error('❌ [Facebook Analytics Setup] Failed:', error);
            return { success: false, message: msg, error };
        }
    }

    /**
     * Delete the existing single-line URL columns from Facebook_Posts so they
     * can be recreated as multi-line by setupAllLists().
     *
     * SharePoint can't widen a column in place — single-line text columns are
     * hard-capped at 255 chars. After dropping, run setupAllLists() again to
     * recreate them as multi-line ('note') columns that can hold long FB CDN URLs.
     *
     * Existing post rows are preserved; only the three URL fields are blanked.
     */
    async dropUrlColumns(): Promise<DropUrlColumnsResult> {
        const targets = ['ImageUrl', 'VideoUrl', 'PostLink'];
        const dropped: string[] = [];
        const failed: { column: string; error: string }[] = [];

        const postsListId = await this.findListIdByName(this.postsListName);
        if (!postsListId) {
            return {
                success: false,
                message: `List "${this.postsListName}" not found.`,
                dropped,
                failed,
            };
        }

        let columns: Array<{ id: string; name: string }> = [];
        try {
            const res = await this.client
                .api(`/sites/${this.siteId}/lists/${postsListId}/columns?$select=id,name`)
                .get();
            columns = res?.value || [];
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return {
                success: false,
                message: `Failed to list columns: ${msg}`,
                dropped,
                failed,
            };
        }

        for (const target of targets) {
            const col = columns.find(c => c.name === target);
            if (!col) {
                failed.push({ column: target, error: 'column not found on list' });
                continue;
            }
            try {
                await this.client
                    .api(`/sites/${this.siteId}/lists/${postsListId}/columns/${col.id}`)
                    .delete();
                dropped.push(target);
                console.log(`✅ Dropped column "${target}" (id: ${col.id})`);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                failed.push({ column: target, error: msg });
                console.error(`❌ Failed to drop "${target}":`, e);
            }
        }

        const success = dropped.length === targets.length;
        const message = success
            ? `Dropped ${dropped.length}/${targets.length} URL columns. Run setupAllLists() to recreate them as multi-line.`
            : `Dropped ${dropped.length}/${targets.length} URL columns. Failures: ${failed.map(f => `${f.column} (${f.error})`).join(', ')}`;

        return { success, message, dropped, failed };
    }
}
