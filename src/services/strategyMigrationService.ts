import { Client } from '@microsoft/microsoft-graph-client';
import { StrategyService } from './strategyService';

export class StrategyMigrationService {
    private client: Client;
    private siteId: string;
    private listIds: { [key: string]: string } = {};

    constructor(client: Client, siteId: string) {
        this.client = client;
        this.siteId = siteId;
    }

    async initialize(): Promise<void> {
        const lists = await this.client.api(`/sites/${this.siteId}/lists`).select('id,name,displayName').get();
        
        const listMapping: { [key: string]: string } = {
            'OBJECTIVES': 'Strategic_Objectives', // Old list
            'GOALS': 'Strategic_Goals', // New Top-Level List
            'KRAS': 'Strategic_KRAs', // New Mid-Level List
            'INITIATIVES': 'Strategic_Initiatives', // New Low-Level List
        };

        for (const [key, listName] of Object.entries(listMapping)) {
            const list = lists.value.find((l: any) => l.name === listName || l.displayName === listName);
            if (list) {
                this.listIds[key] = list.id;
            }
        }
    }

    /**
     * One-time migration function
     * Copies data from Strategic_Objectives and structures it into Goals -> KRAs -> Initiatives
     */
    async migrateData(): Promise<{ success: boolean; message: string; stats: any }> {
        try {
            console.log("🚀 [StrategyMigrationService] Beginning Migration...");

            if (!this.listIds['OBJECTIVES'] || !this.listIds['GOALS'] || !this.listIds['KRAS'] || !this.listIds['INITIATIVES']) {
                throw new Error("Missing required lists. Please deploy Corporate Plan 2026-2028 schema first.");
            }

            // 1. Fetch Legacy Data
            const legacyItems = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['OBJECTIVES']}/items`)
                .expand('fields')
                .top(200)
                .get();

            if (!legacyItems.value || legacyItems.value.length === 0) {
                return { success: true, message: "No legacy data found to migrate.", stats: { migrated: 0 }};
            }

            console.log(`Found ${legacyItems.value.length} legacy objectives.`);

            // 2. Clear new lists (Optional, but safe for one-time manual triggers)
            // Skip deletion for safety, assume they are empty

            const stats = { goals: 0, kras: 0, initiatives: 0 };

            // Seed the 4 Corporate Goals to map items into
            const corporateGoals = [
                {
                    title: "Markets & Connectivity",
                    description: "Rebuilding our digital markets and strengthening international connectivity to attract investment.",
                    icon: "Globe"
                },
                {
                    title: "Regulatory Reform",
                    description: "Updating the legal landscape to adapt to modern and digital economic realities.",
                    icon: "Building2"
                },
                {
                    title: "Digitisation",
                    description: "Embracing technology to digitize internal processes and establish an e-registry platform.",
                    icon: "Zap"
                },
                {
                    title: "Administrative Fundamentals & Cooperation",
                    description: "Building a high-performance culture, optimizing resources, and enhancing inter-agency collaboration.",
                    icon: "Users"
                }
            ];

            const goalMap: Record<string, string> = {}; // Name -> ItemId

            // Define mapping of old titles (or deliverables) to the appropriate Goal 
            // We use simple keyword matching for the demonstration
            const matchGoal = (text: string): string => {
                const t = (text || '').toLowerCase();
                if (t.includes('market') || t.includes('connect')) return "Markets & Connectivity";
                if (t.includes('regulat') || t.includes('law') || t.includes('act')) return "Regulatory Reform";
                if (t.includes('digit') || t.includes('system') || t.includes('registry')) return "Digitisation";
                return "Administrative Fundamentals & Cooperation";
            };

            for (const goal of corporateGoals) {
                const created = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['GOALS']}/items`).post({
                    fields: {
                        Title: goal.title,
                        Description: goal.description,
                        Icon: goal.icon,
                        Status: "On Track",
                        Progress: 0,
                    }
                });
                goalMap[goal.title] = created.id;
                stats.goals++;
            }

            // Group legacy items by Unit
            // We'll treat Unit as the "KRA" and the original Legacy item as the "Initiative"
            const krasCreatedByUnit: Record<string, string> = {}; // UnitName -> KRA ItemId

            for (const item of legacyItems.value) {
                const fields = item.fields;
                const unitName = fields.Unit || fields.Division || "General Execution";
                const itemTitle = fields.Title || "Untitled Initiative";
                
                // Which Goal does this fall under?
                const mappedGoalTitle = matchGoal(itemTitle + " " + fields.Deliverables);
                const goalId = goalMap[mappedGoalTitle];

                // Ensure KRA exists for this Unit under this Goal
                const kraKey = `${goalId}_${unitName}`;
                if (!krasCreatedByUnit[kraKey]) {
                    const kraItem = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['KRAS']}/items`).post({
                        fields: {
                            Title: `${unitName} Key Result Area`,
                            Description: `Key operations executed by ${unitName}`,
                            ParentGoalIdLookupId: Number(goalId),
                        }
                    });
                    krasCreatedByUnit[kraKey] = kraItem.id;
                    stats.kras++;
                }

                const kraId = krasCreatedByUnit[kraKey];

                // Create Initiative (from the old Objective)
                await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['INITIATIVES']}/items`).post({
                    fields: {
                        Title: itemTitle,
                        Description: fields.Description || "",
                        Status: fields.Status || "Not Started",
                        Progress: fields.Progress || 0,
                        ParentKRAIdLookupId: Number(kraId),
                    }
                });
                stats.initiatives++;
            }

            return { 
                success: true, 
                message: "Migration completed successfully",
                stats
            };

        } catch (error: any) {
            console.error("Migration error:", error);
            return { success: false, message: error.message || "Unknown error", stats: null };
        }
    }
}
