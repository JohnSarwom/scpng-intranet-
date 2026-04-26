import React, { useState, useEffect } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { useMsal } from '@azure/msal-react';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { SharePointListSetupService } from '@/services/sharePointListSetupService';
import { SharePointOpsService } from '@/services/sharePointOpsService';
import { PowerAutomateService } from '@/services/powerAutomateService';
import { RegulatorySharePointSetupService } from '@/services/regulatorySharePointSetupService';
import { FacebookAnalyticsSetupService } from '@/services/facebookAnalyticsSetupService';
import { StrategyMigrationService } from '@/services/strategyMigrationService';
import { AnnouncementsSharePointService } from '@/services/announcementsSharePointService';
import { KraKpiSeedService } from '@/services/kraKpiSeedService';
import { getGraphClient } from '@/services/graphService';
import {
    Settings,
    Loader2,
    CheckCircle,
    AlertCircle,
    Check,
    Database,
    Play,
    LayoutDashboard,
    Layers,
    FileText,
    ListChecks,
    Trash2,
    Rocket,
    TestTube,
    Info,
    List,
    FolderKanban,
    Users,
    Target,
    Network,
    RefreshCw,
    Shield,
    Copy,
    Search,
    MessageSquarePlus,
    Bell,
    Zap,
    PlugZap,
    ListTree,
} from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { SharePointExplorer } from '@/components/admin/SharePointExplorer';
import { FeedbackSharePointService } from '@/services/feedbackService';
import { deleteAllPriceHistory } from '@/services/marketDataSharePointService';
import { generateAllMockData, StaffMember } from '@/data/mockPerformanceDataGenerator';
import { mockStrategyData } from '@/mockData/strategyData';
import { Kra, Kpi, Task } from '@/types';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { itRequestTemplate } from '@/config/formTemplates';
import { useSharePointUpload } from '@/hooks/useSharePointUpload';
import { FormProvider, useForm } from 'react-hook-form';

const TestGround = () => {
    const { toast } = useToast();
    const { instance: msalInstance } = useMsal();
    const { user: roleUser } = useRoleBasedAuth();

    // ID Extractor State
    const [spUrlToExtract, setSpUrlToExtract] = useState('');
    const [extractedSiteId, setExtractedSiteId] = useState('');
    const [extractedListId, setExtractedListId] = useState('');
    const [extractedDriveId, setExtractedDriveId] = useState('');
    const [isExtractingIds, setIsExtractingIds] = useState(false);

    const [isSettingUpOps, setIsSettingUpOps] = useState(false);
    const [isSettingUpLists, setIsSettingUpLists] = useState(false);
    const [isSettingUpStrategyHub, setIsSettingUpStrategyHub] = useState(false);
    const [isSettingUpCorporatePlan, setIsSettingUpCorporatePlan] = useState(false);
    const [isMigratingStrategy, setIsMigratingStrategy] = useState(false);
    const [setupResult, setSetupResult] = useState<any>(null);
    const [isSettingUpRegulatory, setIsSettingUpRegulatory] = useState(false);
    const [isSettingUpFacebook, setIsSettingUpFacebook] = useState(false);
    const [isDroppingFbUrlCols, setIsDroppingFbUrlCols] = useState(false);
    const [isSettingUpAnnouncements, setIsSettingUpAnnouncements] = useState(false);
    const [isPurgingOps, setIsPurgingOps] = useState(false);
    const [isSeedingOfficers, setIsSeedingOfficers] = useState(false);
    const [isSettingUpOrgHierarchy, setIsSettingUpOrgHierarchy] = useState(false);
    const [isSettingUpTaskGroups, setIsSettingUpTaskGroups] = useState(false);
    const [isSettingUpForms, setIsSettingUpForms] = useState(false);
    const [isSettingUpDivisions, setIsSettingUpDivisions] = useState(false);
    const [isSeedingDivisions, setIsSeedingDivisions] = useState(false);
    const [isSeedingTasks, setIsSeedingTasks] = useState(false);
    const [isSeedingAssets, setIsSeedingAssets] = useState(false);
    const [isPurgingDemo, setIsPurgingDemo] = useState(false);
    const [isSettingUpITRequest, setIsSettingUpITRequest] = useState(false);
    const [isSettingUpAssetSubLists, setIsSettingUpAssetSubLists] = useState(false);
    const [isSeedingAssetSubLists, setIsSeedingAssetSubLists] = useState(false);

    const [recentITRequests, setRecentITRequests] = useState<any[]>([]);
    const [isLoadingRequests, setIsLoadingRequests] = useState(false);
    const { addSharePointListItem, isLoading: isSubmittingForm } = useSharePointUpload();
    const form = useForm({ defaultValues: {} });

    const loadRecentITRequests = async () => {
        setIsLoadingRequests(true);
        try {
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) return;

            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            const response = await graphClient
                .api(`/sites/${site.id}/lists/IT_Request_Access_List/items`)
                .expand('fields')
                .top(5)
                .get();

            setRecentITRequests(response.value || []);
        } catch (error) {
            console.error('Failed to fetch recent IT requests:', error);
        } finally {
            setIsLoadingRequests(false);
        }
    };

    useEffect(() => {
        loadRecentITRequests();
    }, []);

    const handleSeedTasks = async () => {
        setIsSeedingTasks(true);
        try {
            toast({ title: "🚀 Seeding Tasks", description: "Generating 10 demo tasks per user..." });
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');
            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const setupService = new SharePointListSetupService(graphClient, site.id);
            const result = await setupService.seedTenDemoTasksForEachUser();
            toast({ title: "✅ Success", description: result.message });
        } catch (error: any) {
            toast({ title: "❌ Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSeedingTasks(false);
        }
    };

    const handleSeedAssets = async () => {
        setIsSeedingAssets(true);
        try {
            toast({ title: "🚀 Seeding Assets", description: "Generating 10 demo assets per user..." });
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');
            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const setupService = new SharePointListSetupService(graphClient, site.id);
            const result = await setupService.seedTenDemoAssetsForEachUser();
            toast({ title: "✅ Success", description: result.message });
        } catch (error: any) {
            toast({ title: "❌ Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSeedingAssets(false);
        }
    };

    const handleSetupAssetSubLists = async () => {
        setIsSettingUpAssetSubLists(true);
        try {
            toast({ title: "🚀 Setting up Asset Sub-lists", description: "Creating Maintenance and Invoices lists..." });
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');
            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const setupService = new SharePointListSetupService(graphClient, site.id);
            
            await setupService.createAssetMaintenanceList();
            await setupService.createAssetInvoicesList();
            
            toast({ title: "✅ Success", description: "Maintenance and Invoices lists created." });
        } catch (error: any) {
            toast({ title: "❌ Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSettingUpAssetSubLists(false);
        }
    };

    const handleSeedAssetSubLists = async () => {
        setIsSeedingAssetSubLists(true);
        try {
            toast({ title: "🚀 Seeding Asset Data", description: "Generating maintenance and invoice records..." });
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');
            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const setupService = new SharePointListSetupService(graphClient, site.id);
            const result = await setupService.seedMaintenanceAndInvoices();
            toast({ title: "✅ Success", description: result.message });
        } catch (error: any) {
            toast({ title: "❌ Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSeedingAssetSubLists(false);
        }
    };

    const handlePurgeDemoData = async () => {
        if (!confirm('Are you sure you want to PURGE all demo data? This will delete all Tasks and Assets marked as Mock Data. This cannot be undone!')) {
            return;
        }

        setIsPurgingDemo(true);
        try {
            toast({ title: "🗑️ Purging Demo Data", description: "Removing all mock tasks and assets..." });
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');
            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const setupService = new SharePointListSetupService(graphClient, site.id);
            const result = await setupService.purgeAllDemoData();
            toast({ title: "✅ Success", description: result.message });
        } catch (error: any) {
            toast({ title: "❌ Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsPurgingDemo(false);
        }
    };


    const handleExtractIds = async () => {
        if (!spUrlToExtract) {
            toast({ title: "⚠️ URL Required", description: "Please enter a SharePoint URL.", variant: "destructive" });
            return;
        }

        setIsExtractingIds(true);
        setExtractedSiteId('');
        setExtractedListId('');
        setExtractedDriveId('');

        try {
            const urlObj = new URL(spUrlToExtract);
            const hostname = urlObj.hostname;
            const pathParts = urlObj.pathname.split('/');
            let sitePath = '';

            if (pathParts.length >= 3 && pathParts[1].toLowerCase() === 'sites') {
                sitePath = `/${pathParts[1]}/${pathParts[2]}`;
            } else {
                sitePath = '/';
            }

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Graph client initialization failed');

            const siteResponse = await graphClient
                .api(`/sites/${hostname}:${sitePath}`)
                .select('id')
                .get();

            const siteId = siteResponse.id;
            setExtractedSiteId(siteId);

            const listsResponse = await graphClient
                .api(`/sites/${siteId}/lists`)
                .select('id,webUrl,displayName,name')
                .get();

            const decodedUrl = decodeURIComponent(spUrlToExtract).toLowerCase();
            let foundListId = '';

            for (const list of listsResponse.value) {
                if (list.webUrl && decodedUrl.includes(list.webUrl.toLowerCase())) {
                    foundListId = list.id;
                    break;
                }
            }

            if (!foundListId) {
                for (const list of listsResponse.value) {
                    if (decodedUrl.includes(`/${list.name.toLowerCase()}/`) || decodedUrl.includes(`/${list.displayName.toLowerCase()}/`)) {
                        foundListId = list.id;
                        break;
                    }
                }
            }

            if (foundListId) {
                setExtractedListId(foundListId);
            }

            // Try extracting Drive ID
            const drivesResponse = await graphClient
                .api(`/sites/${siteId}/drives`)
                .select('id,webUrl,name')
                .get();

            let foundDriveId = '';
            for (const drive of drivesResponse.value) {
                if (drive.webUrl && decodedUrl.includes(drive.webUrl.toLowerCase())) {
                    foundDriveId = drive.id;
                    break;
                }
            }
            if (!foundDriveId) {
                for (const drive of drivesResponse.value) {
                    if (decodedUrl.includes(`/${drive.name.toLowerCase()}/`)) {
                        foundDriveId = drive.id;
                        break;
                    }
                }
            }
            if (foundDriveId) {
                setExtractedDriveId(foundDriveId);
            }

            if (foundListId && foundDriveId) {
                toast({ title: "✅ Success", description: "Extracted Site ID, List ID, and Drive ID successfully!" });
            } else if (foundListId || foundDriveId) {
                toast({ title: "⚠️ Partial Success", description: `Extracted Site ID and ${foundDriveId ? 'Drive ID' : 'List ID'}, but not both. URL might not be a standard Document Library.`, variant: "destructive" });
            } else {
                toast({ title: "⚠️ Partial Success", description: "Extracted Site ID, but could not determine List/Drive ID. Make sure it points to a Library/List.", variant: "destructive" });
            }

        } catch (error: any) {
            console.error("ID Extraction Error", error);
            toast({ title: "❌ Extraction Failed", description: "Make sure you provided a valid SharePoint URL.", variant: "destructive" });
        } finally {
            setIsExtractingIds(false);
        }
    };

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "📋 Copied", description: `${label} copied to clipboard!` });
    };

    const handleSeedOfficerData = async () => {
        setIsSeedingOfficers(true);
        try {
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');
            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const setupService = new SharePointListSetupService(graphClient, site.id);
            const result = await setupService.seedOfficerOperationalData();
            if (result.success) {
                toast({ title: "✅ Officer Data Seeded", description: result.message });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({ title: "❌ Seeding Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSeedingOfficers(false);
        }
    };

    const handleSetupStrategyLists = async () => {
        setIsSettingUpLists(true);
        setSetupResult(null);

        try {
            // console.log('🚀 [TestGround] Starting SharePoint list setup...');

            toast({
                title: "🚀 Creating SharePoint Lists",
                description: "This may take a minute...",
            });

            // Get Graph client
            // console.log('📡 [TestGround] Getting Graph client...');
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) {
                throw new Error('Failed to get Graph client');
            }
            // console.log('✅ [TestGround] Graph client obtained');

            // Get site ID
            // console.log('🔍 [TestGround] Getting SharePoint site...');
            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();
            // console.log('✅ [TestGround] Site obtained:', site.id);

            // Create setup service
            // console.log('🛠️ [TestGround] Creating setup service...');
            const setupService = new SharePointListSetupService(graphClient, site.id);

            // Check if lists already exist
            // console.log('🔍 [TestGround] Checking for existing lists...');
            const { exists, lists } = await setupService.checkExistingLists();
            // console.log('📋 [TestGround] Existing lists check:', { exists, lists });

            if (exists) {
                const result = {
                    success: false,
                    message: `Lists already exist: ${lists.join(', ')}`,
                    existingLists: lists
                };
                setSetupResult(result);
                toast({
                    title: "⚠️ Lists Already Exist",
                    description: `Found: ${lists.join(', ')}`,
                    variant: "destructive"
                });
                return;
            }

            // Create all lists
            // console.log('🏗️ [TestGround] Creating all lists...');
            const result = await setupService.createAllLists();
            // console.log('📊 [TestGround] Setup result:', result);
            setSetupResult(result);

            if (result.success) {
                toast({
                    title: "✅ Success!",
                    description: "All Strategy lists created successfully with sample data",
                });
            } else {
                throw new Error(result.message);
            }

        } catch (error: any) {
            console.error('❌ [TestGround] Setup failed:', error);
            const errorResult = {
                success: false,
                message: error.message || "Failed to create SharePoint lists",
                error: {
                    message: error.message,
                    statusCode: error.statusCode,
                    code: error.code
                }
            };
            setSetupResult(errorResult);
            toast({
                title: "❌ Setup Failed",
                description: error.message || "Failed to create SharePoint lists",
                variant: "destructive"
            });
        } finally {
            setIsSettingUpLists(false);
        }
    };

    const handleSetupDivisionsAndUnits = async () => {
        setIsSettingUpDivisions(true);
        setSetupResult(null);

        try {
            toast({
                title: "🚀 Creating Org Lists",
                description: "Setting up Divisions and Units lists...",
            });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) {
                throw new Error("Failed to initialize Graph client");
            }

            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            const setupService = new SharePointListSetupService(graphClient, site.id);
            const result = await setupService.setupStrategyDivisionsAndUnitsLists();

            setSetupResult(result);
            if (result.success) {
                toast({
                    title: "✅ Success",
                    description: "Divisions & Units lists created successfully.",
                });
            } else {
                toast({
                    title: "⚠️ Warning",
                    description: result.message,
                    variant: "destructive"
                });
            }
        } catch (error: any) {
            console.error('Setup failed:', error);
            const result = {
                success: false,
                message: error.message || "An unexpected error occurred",
                details: error
            };
            setSetupResult(result);
            toast({
                title: "❌ Error",
                description: result.message,
                variant: "destructive"
            });
        } finally {
            setIsSettingUpDivisions(false);
        }
    };

    const handleSeedDivisionsAndUnits = async () => {
        setIsSeedingDivisions(true);
        setSetupResult(null);

        try {
            toast({
                title: "🌱 Seeding Data",
                description: "Populating Divisions and Units...",
            });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) {
                throw new Error("Failed to initialize Graph client");
            }

            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            const setupService = new SharePointListSetupService(graphClient, site.id);
            const result = await setupService.seedStrategyDivisionsAndUnits();

            setSetupResult(result);
            if (result.success) {
                toast({
                    title: "✅ Data Seeded",
                    description: "Divisions & Units populated successfully.",
                });
            } else {
                toast({
                    title: "⚠️ Warning",
                    description: result.message,
                    variant: "destructive"
                });
            }
        } catch (error: any) {
            console.error('Seeding failed:', error);
            const result = {
                success: false,
                message: error.message || "An unexpected error occurred",
                details: error
            };
            setSetupResult(result);
            toast({
                title: "❌ Error",
                description: result.message,
                variant: "destructive"
            });
        } finally {
            setIsSeedingDivisions(false);
        }
    };

    const handleSetupAnnouncements = async () => {
        setIsSettingUpAnnouncements(true);
        setSetupResult(null);

        try {
            toast({
                title: "🚀 Creating Announcements List",
                description: "Setting up Announcements list...",
            });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const announcementsService = new AnnouncementsSharePointService(graphClient);
            await announcementsService.initialize();

            toast({
                title: "✅ Success!",
                description: "Announcements list created/verified successfully",
            });
            setSetupResult({ success: true, message: "Announcements list ready." });

        } catch (error: any) {
            console.error('❌ [TestGround] Setup failed:', error);
            setSetupResult({
                success: false,
                message: error.message || "Failed to create Announcements list",
                error
            });
            toast({
                title: "❌ Setup Failed",
                description: error.message || "Failed to create Announcements list",
                variant: "destructive"
            });
        } finally {
            setIsSettingUpAnnouncements(false);
        }
    };

    const handleSetupStrategyHubEngine = async () => {
        setIsSettingUpStrategyHub(true);
        setSetupResult(null);

        try {
            toast({
                title: "🚀 Deploying Strategy Engine",
                description: "Creating all lists and seeding SCPNG mock data...",
            });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            const setupService = new SharePointListSetupService(graphClient, site.id);
            const result = await setupService.setupStrategyHubEngine();
            setSetupResult(result);

            if (result.success) {
                toast({
                    title: "✅ Engine Deployed!",
                    description: "Strategy, Analytics & Reports are now live with real data.",
                });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error('❌ Strategy Hub Setup failed:', error);
            setSetupResult({ success: false, message: error.message, error });
            toast({
                title: "❌ Deployment Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsSettingUpStrategyHub(false);
        }
    };

    const handleSetupCorporatePlan = async () => {
        setIsSettingUpCorporatePlan(true);
        setSetupResult(null);

        try {
            toast({
                title: "🚀 Deploying Corporate Plan 2026-2028",
                description: "Creating Goals, KRAs, and Initiatives lists...",
            });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            const setupService = new SharePointListSetupService(graphClient, site.id);
            const result = await setupService.setupCorporatePlanLists();
            setSetupResult(result);

            if (result.success) {
                toast({
                    title: "✅ Corporate Plan Deployed!",
                    description: "The new 5-Level hierarchy lists are now live.",
                });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error('❌ Corporate Plan Setup failed:', error);
            setSetupResult({ success: false, message: error.message, error });
            toast({
                title: "❌ Deployment Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsSettingUpCorporatePlan(false);
        }
    };

    const handleMigrateStrategyData = async () => {
        setIsMigratingStrategy(true);
        setSetupResult(null);
        try {
            toast({
                title: "🚀 Starting Data Migration",
                description: "Moving legacy objectives into the new 5-level Corporate Plan hierarchy...",
            });

            const graphClient = await getGraphClient(msalInstance);
            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const migrationService = new StrategyMigrationService(graphClient, site.id);
            await migrationService.initialize();
            
            const result = await migrationService.migrateData();
            setSetupResult(result);

            if (result.success) {
                toast({
                    title: "✅ Migration Complete",
                    description: `Migrated ${result.stats?.initiatives || 0} initiatives. Detailed stats in console.`,
                });
                console.log("Migration Stats:", result.stats);
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error('❌ Migration failed:', error);
            setSetupResult({ success: false, message: error.message, error });
            toast({
                title: "❌ Migration Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsMigratingStrategy(false);
        }
    };

    const handleSetupRegulatoryEngine = async () => {
        setIsSettingUpRegulatory(true);
        setSetupResult(null);

        try {
            toast({
                title: "🚀 Deploying Regulatory Engine",
                description: "Creating 'Regulatory_Intelligence_Cases' list and seeding mock cases...",
            });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            const setupService = new RegulatorySharePointSetupService(graphClient, site.id);
            const result = await setupService.deployRegulatoryEngine();
            setSetupResult(result);

            if (result.success) {
                toast({
                    title: "✅ Regulatory Engine Deployed!",
                    description: "Regulatory lists are now live with real data.",
                });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error('❌ Regulatory Setup failed:', error);
            setSetupResult({ success: false, message: error.message, error });
            toast({
                title: "❌ Deployment Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsSettingUpRegulatory(false);
        }
    };

    const handleSetupFacebookAnalytics = async () => {
        setIsSettingUpFacebook(true);
        setSetupResult(null);

        try {
            toast({
                title: "🚀 Deploying Facebook Analytics Lists",
                description: "Creating Facebook_Posts, Facebook_Comments, and Facebook_Messages lists...",
            });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            const setupService = new FacebookAnalyticsSetupService(graphClient, site.id);
            const result = await setupService.setupAllLists();
            setSetupResult(result);

            if (result.success) {
                toast({
                    title: "✅ Facebook Analytics Ready!",
                    description: "Three SharePoint lists are live. Copy the list IDs from the console.",
                });
                if (result.listIds) {
                    console.log('📋 Facebook list IDs — copy these into your Apps Script Script Properties:');
                    console.log(`FB_POSTS_LIST_ID    = ${result.listIds.posts}`);
                    console.log(`FB_COMMENTS_LIST_ID = ${result.listIds.comments}`);
                    console.log(`FB_MESSAGES_LIST_ID = ${result.listIds.messages}`);
                }
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error('❌ Facebook Analytics Setup failed:', error);
            setSetupResult({ success: false, message: error.message, error });
            toast({
                title: "❌ Deployment Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsSettingUpFacebook(false);
        }
    };

    const handleDropFacebookUrlColumns = async () => {
        if (!confirm(
            'Drop ImageUrl, VideoUrl and PostLink columns from Facebook_Posts?\n\n' +
            'These will be recreated as multi-line columns the next time you click ' +
            '"Deploy Facebook Analytics Lists". Existing post rows are kept but their ' +
            'URL fields will be blank until the next Apps Script sync.'
        )) return;

        setIsDroppingFbUrlCols(true);
        setSetupResult(null);

        try {
            toast({
                title: '🧹 Dropping URL columns',
                description: 'Removing single-line ImageUrl/VideoUrl/PostLink from Facebook_Posts...',
            });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            const setupService = new FacebookAnalyticsSetupService(graphClient, site.id);
            const result = await setupService.dropUrlColumns();
            setSetupResult(result);

            if (result.success) {
                toast({
                    title: '✅ URL columns dropped',
                    description: 'Now click "Deploy Facebook Analytics Lists" to recreate them as multi-line.',
                });
            } else {
                toast({
                    title: '⚠️ Partial drop',
                    description: result.message,
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            console.error('❌ Drop URL columns failed:', error);
            setSetupResult({ success: false, message: error.message, error });
            toast({
                title: '❌ Drop failed',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsDroppingFbUrlCols(false);
        }
    };

    const handleSetupOrgHierarchy = async () => {
        setIsSettingUpOrgHierarchy(true);
        setSetupResult(null);

        try {
            toast({
                title: "🚀 Moving Org Structure to SharePoint",
                description: "Creating 'Org_Hierarchy' list and seeding current structure...",
            });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            const setupService = new SharePointListSetupService(graphClient, site.id);
            const result = await setupService.setupStrategyOrgHierarchy();
            setSetupResult(result);

            if (result.success) {
                toast({
                    title: "✅ Org Structure Synchronized!",
                    description: "Divisions and Units are now managed dynamically via SharePoint.",
                });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error('❌ Org Hierarchy Setup failed:', error);
            setSetupResult({ success: false, message: error.message, error });
            toast({
                title: "❌ Setup Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsSettingUpOrgHierarchy(false);
        }
    };

    const handlePurgeAndResetOperations = async () => {
        if (!confirm('⚠️ WARNING: This will DELETE all Operations data (Tasks, Projects, Risks, KPIs, KRAs) and Unit Objectives.\n\nStrategic Pillars and Strategic Objectives will remain intact.\n\nAre you sure you want to proceed with a fresh start?')) return;

        setIsPurgingOps(true);
        setSetupResult(null);

        try {
            toast({
                title: "🧹 Purging & Resetting",
                description: "Deleting old lists and recreating fresh ones...",
            });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            const setupService = new SharePointListSetupService(graphClient, site.id);
            const result = await setupService.purgeAndResetOperations(true); // true = skip sample data
            setSetupResult(result);

            if (result.success) {
                toast({
                    title: "✅ Fresh Start Ready!",
                    description: "All operations lists have been reset. You can now start adding clean data.",
                });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error('❌ Purge failed:', error);
            setSetupResult({ success: false, message: error.message, error });
            toast({
                title: "❌ Purge Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsPurgingOps(false);
        }
    };

    const [isResettingStrategy, setIsResettingStrategy] = useState(false);
    const [isReseedingFramework, setIsReseedingFramework] = useState(false);
    const [frameworkSeedLog, setFrameworkSeedLog] = useState<string[]>([]);

    const handleResetStrategyProgress = async () => {
        if (!confirm('This will reset the progress of ALL Strategic Objectives to 0%. This is useful if you have deleted all operational data and want a clean slate.\n\nAre you sure completely?')) return;

        setIsResettingStrategy(true);
        setSetupResult(null);

        try {
            toast({
                title: "🔄 Resetting Progress",
                description: "Setting all Strategic Objectives progress to 0%...",
            });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            const setupService = new SharePointListSetupService(graphClient, site.id);
            const result = await setupService.resetStrategicProgress();

            setSetupResult(result);

            if (result.success) {
                toast({
                    title: "✅ Strategy Reset Complete",
                    description: result.message,
                });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error('❌ Reset failed:', error);
            setSetupResult({ success: false, message: error.message, error });
            toast({
                title: "❌ Reset Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsResettingStrategy(false);
        }
    };

    const handleReseedScpngFramework = async () => {
        if (!confirm(
            'WARNING: This will DELETE all existing Unit Objectives, KRAs, and KPIs, then recreate the full SCPNG Strategic Performance Framework (5 Goals / 18 KRAs / 72 KPIs) from the official document.\n\nThis cannot be undone. Proceed?'
        )) return;

        setIsReseedingFramework(true);
        setFrameworkSeedLog([]);

        try {
            toast({ title: 'Resetting SCPNG Framework', description: 'Deleting old data and seeding new framework...' });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const seedService = new KraKpiSeedService(graphClient);
            const result = await seedService.resetAndSeed((line) => {
                setFrameworkSeedLog(prev => [...prev, line]);
            });

            if (result.success) {
                toast({
                    title: 'Framework Reset Complete',
                    description: `${result.stats.goals} Goals, ${result.stats.keyDeliverables} Key Deliverables, ${result.stats.initiatives} Initiatives, ${result.stats.kras} KRAs, ${result.stats.kpis} KPIs created.`,
                });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error('Framework reseed failed:', error);
            setFrameworkSeedLog(prev => [...prev, `ERROR: ${error.message}`]);
            toast({ title: 'Reseed Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsReseedingFramework(false);
        }
    };

    const handleSetupOperationsLists = async () => {
        setIsSettingUpOps(true);
        setSetupResult(null);

        try {
            // console.log('🚀 [TestGround] Starting Operations list setup...');

            toast({
                title: "🚀 Creating Operations Lists",
                description: "This may take a minute...",
            });

            // Get Graph client
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            // Get site ID
            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            // Create setup service
            const setupService = new SharePointListSetupService(graphClient, site.id);

            // Create ONLY Operations lists (KRAs, KPIs, Projects, Tasks, Risks)
            // console.log('🏗️ [TestGround] Creating Operations lists only...');
            const result = await setupService.createOperationsLists();
            setSetupResult(result);

            if (result.success) {
                toast({
                    title: "✅ Success!",
                    description: "All Operations lists created successfully with sample data",
                });
            } else {
                throw new Error(result.message);
            }

        } catch (error: any) {
            console.error('❌ [TestGround] Setup failed:', error);
            setSetupResult({
                success: false,
                message: error.message || "Failed to create Operations lists",
                error
            });
            toast({
                title: "❌ Setup Failed",
                description: error.message || "Failed to create Operations lists",
                variant: "destructive"
            });
        } finally {
            setIsSettingUpOps(false);
        }
    };

    const handleSetupTaskGroups = async () => {
        setIsSettingUpTaskGroups(true);
        setSetupResult(null);

        try {
            toast({
                title: "🚀 Creating Task Groups List",
                description: "This may take a minute...",
            });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            const setupService = new SharePointListSetupService(graphClient, site.id);

            const result = await setupService.setupTaskGroupsList();
            setSetupResult(result);

            if (result.success) {
                toast({
                    title: "✅ Success!",
                    description: "Task Groups list created successfully.",
                });
            } else {
                throw new Error(result.message);
            }

        } catch (error: any) {
            console.error('❌ [TestGround] Setup failed:', error);
            setSetupResult({
                success: false,
                message: error.message || "Failed to create Task Groups list",
                error
            });
            toast({
                title: "❌ Setup Failed",
                description: error.message || "Failed to create Task Groups list",
                variant: "destructive"
            });
        } finally {
            setIsSettingUpTaskGroups(false);
        }
    };

    const handleSetupFormsEngine = async () => {
        setIsSettingUpForms(true);
        setSetupResult(null);

        try {
            toast({
                title: "🚀 Deploying Forms Engine",
                description: "Creating Form_Groups and Form_Registrations lists...",
            });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            const setupService = new SharePointListSetupService(graphClient, site.id);
            const result = await setupService.setupFormsEngine();
            setSetupResult(result);

            if (result.success) {
                toast({
                    title: "✅ Forms Engine Deployed!",
                    description: "You can now manage form groups and registrations via SharePoint.",
                });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error('❌ Forms Engine Setup failed:', error);
            setSetupResult({ success: false, message: error.message, error });
            toast({
                title: "❌ Deployment Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsSettingUpForms(false);
        }
    };

    const handleSetupITRequestList = async () => {
        setIsSettingUpITRequest(true);
        setSetupResult(null);
        try {
            toast({
                title: "🚀 Setting up IT Request list",
                description: "Creating IT_Request_Access_List...",
            });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            const setupService = new SharePointListSetupService(graphClient, site.id);
            const result = await setupService.setupITRequestList();
            setSetupResult(result);

            if (result.success) {
                toast({ title: "✅ IT Request List Ready", description: result.message });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({ title: "❌ Setup Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSettingUpITRequest(false);
        }
    };

    const handleITRequestSubmit = async (data: any) => {
        try {
            toast({ title: "📤 Submitting", description: "Uploading IT Request to SharePoint..." });

            // Map form data to SharePoint schema
            const mappedData = {
                StaffName: data.name || roleUser?.display_name || 'Anonymous',
                StaffEmail: data.email || roleUser?.email || '',
                StaffID: data.payrollNumber || '',
                Department: data.division || '',
                JobTitle: data.jobTitle || 'Staff',
                RequestType: data.requestAccessType || 'Equipment Request',
                Systems: Array.isArray(data.access) ? data.access.join(', ') : (Array.isArray(data.equipment) ? data.equipment.join(', ') : ''),
                Priority: data.priority || 'Medium',
                Notes: data.details || '',
                Status: 'Pending',
                SubmissionDate: new Date().toISOString()
            };

            const result = await addSharePointListItem('/sites/scpngintranet', 'IT_Request_Access_List', mappedData);

            if (result) {
                toast({ title: "✅ Submitted", description: "IT Request submitted successfully!" });
                loadRecentITRequests(); // Refresh the list
            } else {
                throw new Error('Failed to submit');
            }
        } catch (error: any) {
            toast({ title: "❌ Submission Failed", description: error.message, variant: "destructive" });
        }
    };

    const [isEnsuringAssignees, setIsEnsuringAssignees] = useState(false);
    const [isEnsuringCompletionDate, setIsEnsuringCompletionDate] = useState(false);

    const handleEnsureAssigneesColumn = async () => {
        setIsEnsuringAssignees(true);
        setSetupResult(null);
        try {
            toast({ title: "🛠️ Fixing Schema", description: "Ensuring 'Assignees' column exists on Operations_Tasks..." });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const setupService = new SharePointListSetupService(graphClient, site.id);

            const result = await setupService.ensureAssigneesColumn();

            if (result.success) {
                toast({ title: "✅ Success", description: result.message });
                setSetupResult({ success: true, message: result.message });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error('Fix failed:', error);
            toast({ title: "❌ Failed", description: error.message, variant: "destructive" });
            setSetupResult({ success: false, message: error.message, error });
        } finally {
            setIsEnsuringAssignees(false);
        }
    };

    const handleEnsureCompletionColumn = async () => {
        setIsEnsuringCompletionDate(true);
        setSetupResult(null);
        try {
            toast({ title: "🛠️ Fixing Schema", description: "Ensuring 'CompletionDate' column exists on Operations_Tasks..." });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const setupService = new SharePointListSetupService(graphClient, site.id);

            const result = await setupService.ensureTaskColumns();

            if (result.success) {
                toast({ title: "✅ Success", description: result.message });
                setSetupResult({ success: true, message: result.message });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error('Fix failed:', error);
            toast({ title: "❌ Failed", description: error.message, variant: "destructive" });
            setSetupResult({ success: false, message: error.message, error });
        } finally {
            setIsEnsuringCompletionDate(false);
        }
    };

    const [isSettingUpMarket, setIsSettingUpMarket] = useState(false);
    const [isSettingUpDocs, setIsSettingUpDocs] = useState(false);
    const [isDeletingHistory, setIsDeletingHistory] = useState(false);

    const [isSettingUpAppSettings, setIsSettingUpAppSettings] = useState(false);

    const handleSetupAppSettings = async () => {
        setIsSettingUpAppSettings(true);
        setSetupResult(null);

        try {
            toast({
                title: "🚀 Creating App Settings List",
                description: "This may take a moment...",
            });

            // Get Graph client
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            // Get site ID
            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            // Create setup service
            const setupService = new SharePointListSetupService(graphClient, site.id);

            // Create List
            const result = await setupService.createInternalAppSettingsList();
            setSetupResult(result);

            if (result.success) {
                toast({
                    title: "✅ Success!",
                    description: result.message,
                });
            } else {
                throw new Error(result.message);
            }

        } catch (error: any) {
            console.error('❌ [TestGround] Setup failed:', error);
            setSetupResult({
                success: false,
                message: error.message || "Failed to create App Settings list",
                error
            });
            toast({
                title: "❌ Setup Failed",
                description: error.message || "Failed to create App Settings list",
                variant: "destructive"
            });
        } finally {
            setIsSettingUpAppSettings(false);
        }
    };

    const handleSetupMarketLists = async () => {
        setIsSettingUpMarket(true);
        setSetupResult(null);

        try {
            // console.log('🚀 [TestGround] Starting Market Data list setup...');

            toast({
                title: "🚀 Creating Market Data Lists",
                description: "This may take a minute...",
            });

            // Get Graph client
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            // Get site ID
            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            // Create setup service
            const setupService = new SharePointListSetupService(graphClient, site.id);

            // Create Lists
            const result = await setupService.createMarketDataLists();
            setSetupResult(result);

            if (result.success) {
                toast({
                    title: "✅ Success!",
                    description: "All Market Data lists created successfully",
                });
            } else {
                throw new Error(result.message);
            }

        } catch (error: any) {
            console.error('❌ [TestGround] Setup failed:', error);
            setSetupResult({
                success: false,
                message: error.message || "Failed to create Market Data lists",
                error
            });
            toast({
                title: "❌ Setup Failed",
                description: error.message || "Failed to create Market Data lists",
                variant: "destructive"
            });
        } finally {
            setIsSettingUpMarket(false);
        }
    };

    const [isSeedingMarket, setIsSeedingMarket] = useState(false);

    const handleSeedMarketData = async () => {
        setIsSeedingMarket(true);
        setSetupResult(null);

        try {
            toast({ title: "🌱 Seeding Market Data", description: "Generating companies and history... This may take a few minutes." });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const setupService = new SharePointListSetupService(graphClient, site.id);

            const result = await setupService.seedMarketData();

            if (result.success) {
                toast({ title: "✅ Seeding Complete", description: result.message });
                setSetupResult({ success: true, message: result.message, details: null });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error('Seeding failed', error);
            toast({ title: "❌ Seeding Failed", description: error.message, variant: "destructive" });
            setSetupResult({ success: false, message: error.message, error });
        } finally {
            setIsSeedingMarket(false);
        }
    };

    const handleSetupDocs = async () => {
        setIsSettingUpDocs(true);
        setSetupResult(null);

        try {
            // Get Graph client
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            // Get site ID
            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            const setupService = new SharePointListSetupService(graphClient, site.id);

            const result = await setupService.createSharedDocsSetup();
            setSetupResult(result);

            if (result.success) {
                toast({
                    title: "✅ Success!",
                    description: "Organizational Documents setup completed",
                });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error('Setup failed:', error);
            setSetupResult({
                success: false,
                message: error.message,
                details: error
            });
            toast({
                title: "❌ Setup Failed",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsSettingUpDocs(false);
        }
    };

    const handleEnsureDocsList = async () => {
        setIsSettingUpDocs(true);
        setSetupResult(null);
        try {
            toast({ title: "🛠️ Checking Schema", description: "Ensuring 'Organizational_Documents' library exists..." });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const setupService = new SharePointListSetupService(graphClient, site.id);

            const result = await setupService.ensureSharedDocsColumns();

            if (result.success) {
                toast({ title: "✅ Success", description: result.message });
                setSetupResult({ success: true, message: result.message });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error('Repair failed:', error);
            toast({ title: "❌ Failed", description: error.message, variant: "destructive" });
            setSetupResult({ success: false, message: error.message, error });
        } finally {
            setIsSettingUpDocs(false);
        }
    };

    const handleDeleteDocs = async () => {
        if (!confirm('Are you sure you want to delete the Organizational Documents library? This cannot be undone!')) {
            return;
        }

        setIsSettingUpDocs(true);
        try {
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            const setupService = new SharePointListSetupService(graphClient, site.id);

            const result = await setupService.deleteSharedDocsSetup();

            if (result.success) {
                toast({
                    title: "🗑️ Deleted",
                    description: "Organizational Documents library deleted",
                });
                setSetupResult({ success: true, message: result.message });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({
                title: "❌ Delete Failed",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsSettingUpDocs(false);
        }
    };

    const handleSetupDocumentCategories = async () => {
        setIsSettingUpDocs(true);
        try {
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const setupService = new SharePointListSetupService(graphClient, site.id);
            const result = await setupService.createDocumentCategoriesList();

            if (result.success) {
                toast({ title: "✅ Success", description: result.message });
                setSetupResult({ success: true, message: result.message });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error('Document Categories setup failed:', error);
            toast({ title: "❌ Failed", description: error.message, variant: "destructive" });
            setSetupResult({ success: false, message: error.message, error });
        } finally {
            setIsSettingUpDocs(false);
        }
    };

    // ==========================================
    // MOCK DATA GENERATION & UPLOAD
    // ==========================================
    const [mockData, setMockData] = useState<{ kras: Kra[], kpis: Kpi[], tasks: Task[] } | null>(null);
    const [isGeneratingMock, setIsGeneratingMock] = useState(false);
    const [isUploadingMock, setIsUploadingMock] = useState(false);
    const [mockUploadStatus, setMockUploadStatus] = useState<string>('');


    // ==========================================
    // REPORTS & ANALYTICS SETUP
    // ==========================================
    const [isSettingUpReports, setIsSettingUpReports] = useState(false);
    const [isSettingUpReportSchedules, setIsSettingUpReportSchedules] = useState(false);

    const handleSetupReportSchedulesList = async () => {
        setIsSettingUpReportSchedules(true);
        setSetupResult(null);

        try {
            toast({
                title: "Creating Report Schedules List",
                description: "Setting up Report_Schedules list...",
            });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const opsService = new SharePointOpsService(graphClient);
            await opsService.initialize();
            await opsService.createReportSchedulesList();

            toast({
                title: "Success!",
                description: "Report_Schedules list created/verified successfully",
            });
            setSetupResult({ success: true, message: "Report Schedules list ready." });

        } catch (error: any) {
            console.error('[TestGround] Report Schedules setup failed:', error);
            setSetupResult({
                success: false,
                message: error.message || "Failed to create Report Schedules list",
                error
            });
            toast({
                title: "Setup Failed",
                description: error.message || "Failed to create Report Schedules list",
                variant: "destructive"
            });
        } finally {
            setIsSettingUpReportSchedules(false);
        }
    };

    const [isDeployingFlow, setIsDeployingFlow] = useState(false);
    const [flowDeployResult, setFlowDeployResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleDeployReportFlow = async () => {
        setIsDeployingFlow(true);
        setFlowDeployResult(null);

        try {
            toast({
                title: "Deploying Power Automate Flow",
                description: "Creating the Report Scheduler flow in Power Automate...",
            });

            const paService = new PowerAutomateService(msalInstance);
            const result = await paService.deployReportSchedulerFlow();

            const msg = `Dispatch: ${result.dispatch.message} | Send: ${result.send.message}`;
            setFlowDeployResult({ success: result.overallSuccess, message: msg });

            if (result.overallSuccess) {
                toast({
                    title: "Both Flows Deployed!",
                    description: "Report Dispatch and Report Send flows are live.",
                });
            } else {
                toast({
                    title: "Deployment Partially Failed",
                    description: msg,
                    variant: "destructive"
                });
            }
        } catch (error: any) {
            console.error('[TestGround] Flow deployment failed:', error);
            setFlowDeployResult({ success: false, message: error.message });
            toast({
                title: "Deployment Failed",
                description: error.message || "Failed to deploy flow",
                variant: "destructive"
            });
        } finally {
            setIsDeployingFlow(false);
        }
    };

    const handleListFlows = async () => {
        try {
            const paService = new PowerAutomateService(msalInstance);
            const flows = await paService.listFlows();
            console.log('[TestGround] Flows:', flows);
            toast({
                title: `Found ${flows.length} flow(s)`,
                description: flows.map(f => `${f.displayName} (${f.state})`).join(', ') || 'No flows found',
            });
        } catch (error: any) {
            toast({
                title: "Failed to list flows",
                description: error.message,
                variant: "destructive"
            });
        }
    };

    const handleInspectFlow = async () => {
        try {
            const paService = new PowerAutomateService(msalInstance);
            const flows = await paService.listFlows();
            if (flows.length === 0) {
                toast({ title: "No flows found", variant: "destructive" });
                return;
            }
            // Get the first flow's full definition
            const flowDef = await paService.getFlowDefinition(flows[0].name);
            console.log('[TestGround] Flow definition for:', flows[0].displayName);
            console.log('[TestGround] connectionReferences:', JSON.stringify(flowDef?.properties?.connectionReferences, null, 2));
            console.log('[TestGround] First action:', JSON.stringify(Object.entries(flowDef?.properties?.definition?.actions || {})[0], null, 2));
            console.log('[TestGround] Full definition:', JSON.stringify(flowDef, null, 2));
            toast({
                title: `Inspected: ${flows[0].displayName}`,
                description: "Full definition logged to console. Check connectionReferences format.",
            });
        } catch (error: any) {
            toast({
                title: "Failed to inspect flow",
                description: error.message,
                variant: "destructive"
            });
        }
    };

    const handleListConnections = async () => {
        try {
            const paService = new PowerAutomateService(msalInstance);
            const connections = await paService.listConnections();
            console.log('[TestGround] Connections:', connections);
            const connected = connections.filter(c => c.status === 'Connected');
            toast({
                title: `Found ${connected.length} active connection(s)`,
                description: connected.map(c => c.displayName).join(', ') || 'No connections found',
            });
        } catch (error: any) {
            toast({
                title: "Failed to list connections",
                description: error.message,
                variant: "destructive"
            });
        }
    };

    const [isDeletingFlow, setIsDeletingFlow] = useState(false);

    const handleDeleteReportFlow = async () => {
        setIsDeletingFlow(true);
        setFlowDeployResult(null);

        try {
            const paService = new PowerAutomateService(msalInstance);
            const flows = await paService.listFlows();
            const toDelete = flows.filter(f =>
                f.displayName === 'SCPNG Intranet — Report Dispatch' ||
                f.displayName === 'SCPNG Intranet — Report Send' ||
                f.displayName === 'SCPNG Intranet — Scheduled Report Dispatcher'
            );

            if (toDelete.length === 0) {
                setFlowDeployResult({ success: false, message: 'No Report Scheduler flows found to delete.' });
                toast({ title: "No Flows Found", description: "No existing report flows found.", variant: "destructive" });
                return;
            }

            for (const flow of toDelete) {
                await paService.deleteFlow(flow.name);
            }

            const names = toDelete.map(f => f.displayName).join(', ');
            setFlowDeployResult({ success: true, message: `Deleted: ${names}. You can now redeploy.` });
            toast({
                title: "Flows Deleted",
                description: `${toDelete.length} flow(s) removed. Ready to redeploy.`,
            });
        } catch (error: any) {
            console.error('[TestGround] Flow deletion failed:', error);
            setFlowDeployResult({ success: false, message: error.message });
            toast({
                title: "Deletion Failed",
                description: error.message || "Failed to delete flows",
                variant: "destructive"
            });
        } finally {
            setIsDeletingFlow(false);
        }
    };

    const handleSetupReportsList = async () => {
        setIsSettingUpReports(true);
        setSetupResult(null);

        try {
            toast({
                title: "🚀 Creating Reports List",
                description: "Setting up Performance_Reports list...",
            });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const opsService = new SharePointOpsService(graphClient);
            await opsService.initialize();
            await opsService.createReportsList();

            toast({
                title: "✅ Success!",
                description: "Performance_Reports list created/verified successfully",
            });
            setSetupResult({ success: true, message: "Reports list ready." });

        } catch (error: any) {
            console.error('❌ [TestGround] Setup failed:', error);
            setSetupResult({
                success: false,
                message: error.message || "Failed to create Reports list",
                error
            });
            toast({
                title: "❌ Setup Failed",
                description: error.message || "Failed to create Reports list",
                variant: "destructive"
            });
        } finally {
            setIsSettingUpReports(false);
        }
    };

    const handleGenerateMockData = async () => {
        setIsGeneratingMock(true);
        try {
            // 1. Fetch Users
            toast({ title: "👥 Fetching Users...", description: "Getting up to 10 active users..." });
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('No Graph Client');

            const users = await graphClient.api('/users')
                .select('id,displayName,jobTitle,department,officeLocation,mail')
                .filter("accountEnabled eq true")
                .top(999)
                .get();

            const staffMembers: StaffMember[] = users.value
                .filter((u: any) => u.mail)
                .slice(0, 10)
                .map((u: any) => ({
                    id: u.id,
                    displayName: u.displayName,
                    jobTitle: u.jobTitle || 'Staff',
                    department: u.department || 'General',
                    officeLocation: u.officeLocation || 'HQ',
                    mail: u.mail,
                    divisionId: 'DIV-001'
                }));

            console.log(`✅ [Mock Generator] Fetched ${staffMembers.length} valid users for generation.`);
            if (staffMembers.length > 0) {
                console.log(`ℹ️ [Mock Generator] Example user for data: ${staffMembers[0].mail}`);
            }

            if (staffMembers.length === 0) throw new Error('No users found in tenant');

            // 2. Prepare Strategies
            const strategies = mockStrategyData.objectives.map((o: any, i: number) => ({
                id: i + 1,
                title: o.title,
                description: o.description,
                deliverables: o.deliverables
            }));

            // 3. Generate
            const data = generateAllMockData(staffMembers, strategies);
            setMockData(data);

            toast({
                title: "✅ Data Generated",
                description: `Created ${data.kras.length} KRAs, ${data.kpis.length} KPIs, ${data.tasks.length} Tasks for ${staffMembers.length} users.`
            });

        } catch (error: any) {
            toast({ title: "❌ Generation Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsGeneratingMock(false);
        }
    };

    const handleGenerateForUser = async () => {
        setIsGeneratingMock(true);
        try {
            // 1. Specific Target User
            const targetEmail = 'jsarwom@scpng.gov.pg';
            toast({ title: "🎯 Targeting User", description: `Generating data specifically for ${targetEmail}...` });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('No Graph Client');

            // 2. Debug: Log Site Info to console to verify we are writing to the right place
            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .select('id,webUrl,displayName')
                .get();
            console.log('🔍 [Debug] Target Site:', site);
            console.log('   ID:', site.id);
            console.log('   URL:', site.webUrl);

            // 3. Create mock staff member object directly (skipping tenant fetch to be sure)
            const staffMembers: StaffMember[] = [{
                id: 'active-user-id',
                displayName: 'John Sarwom',
                jobTitle: 'IT Manager',
                department: 'IT Division',
                officeLocation: 'HQ',
                mail: targetEmail,
                divisionId: 'DIV-001'
            }];

            console.log(`✅ [Mock Generator] Targeting single user: ${targetEmail}`);

            // 4. Prepare Strategies
            const strategies = mockStrategyData.objectives.map((o: any, i: number) => ({
                id: i + 1,
                title: o.title,
                description: o.description,
                deliverables: o.deliverables
            }));

            // 5. Generate
            const data = generateAllMockData(staffMembers, strategies);
            setMockData(data);

            toast({
                title: "✅ Generated. Starting Upload...",
                description: `Created ${data.kras.length} KRAs. Uploading automatically...`
            });

            // 6. Auto-Upload for Debugging convenience
            setIsUploadingMock(true);
            const service = new SharePointListSetupService(graphClient, site.id);
            setMockUploadStatus('Fetching User Map...');
            const userMap = await service.getSiteUserMap();

            setMockUploadStatus(`Uploading ${data.kras.length} KRAs...`);
            await service.uploadMockKRAs(data.kras, userMap);

            setMockUploadStatus(`Uploading ${data.kpis.length} KPIs...`);
            await service.uploadMockKPIs(data.kpis, userMap);

            setMockUploadStatus(`Uploading ${data.tasks.length} Tasks...`);
            await service.uploadMockTasks(data.tasks, userMap);

            setMockUploadStatus('Done!');
            toast({ title: "✅ Full Upload Complete", description: "Check SharePoint Lists now." });
            setMockData(null);

        } catch (error: any) {
            console.error(error);
            toast({ title: "❌ Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsGeneratingMock(false);
            setIsUploadingMock(false);
        }
    };

    const handleUploadMockData = async () => {
        if (!mockData) return;
        setIsUploadingMock(true);
        setMockUploadStatus('Initializing...');

        try {
            const graphClient = await getGraphClient(msalInstance);
            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const service = new SharePointListSetupService(graphClient, site.id);

            // 1. Get User Map
            setMockUploadStatus('Fetching User Map...');
            const userMap = await service.getSiteUserMap();

            // 2. Upload KRAs
            setMockUploadStatus(`Uploading ${mockData.kras.length} KRAs...`);
            await service.uploadMockKRAs(mockData.kras, userMap);

            // 3. Upload KPIs
            setMockUploadStatus(`Uploading ${mockData.kpis.length} KPIs...`);
            await service.uploadMockKPIs(mockData.kpis, userMap);

            // 4. Upload Tasks
            setMockUploadStatus(`Uploading ${mockData.tasks.length} Tasks...`);
            await service.uploadMockTasks(mockData.tasks, userMap);

            setMockUploadStatus('Done!');
            toast({ title: "✅ Upload Complete", description: "All mock data uploaded successfully." });
            setMockData(null); // Clear after upload

        } catch (error: any) {
            console.error(error);
            toast({ title: "❌ Upload Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsUploadingMock(false);
            setMockUploadStatus('');
        }
    };

    const handleClearMockData = async () => {
        if (!confirm('Are you sure? This will delete ALL mock KRAs, KPIs, and Tasks!')) return;
        setIsUploadingMock(true);
        setMockUploadStatus('Clearing data...');
        try {
            const graphClient = await getGraphClient(msalInstance);
            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const service = new SharePointListSetupService(graphClient, site.id);
            await service.clearMockPerformanceData();
            toast({ title: "🗑️ Data Cleared", description: "Mock data removed." });
        } catch (error: any) {
            toast({ title: "❌ Error", description: error.message, variant: "destructive" });
        } finally {
            setIsUploadingMock(false);
            setMockUploadStatus('');
        }
    };

    const [isSeedingProjects, setIsSeedingProjects] = useState(false);

    const handleResetAndSeedProjects = async () => {
        if (!confirm('WARNING: This will DELETE the existing Projects list and all its data! Continue?')) return;
        setIsSeedingProjects(true);
        setSetupResult(null);

        try {
            toast({ title: "🚀 Resetting Projects", description: "Deleting and recreating list..." });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');
            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const setupService = new SharePointListSetupService(graphClient, site.id);

            // 1. Recreate List (Handles deletion and creation safely)
            toast({ title: "🏗️ Recreating List", description: "Applying new schema (Text Manager, JSON Assignees)..." });
            const recreateResult = await setupService.recreateProjectsListOnly();

            if (!recreateResult.success) {
                throw new Error(recreateResult.message);
            }

            // 2. Seed Data
            toast({ title: "🌱 Seeding Data", description: "Injecting mock projects..." });
            const result = await setupService.seedProjectsData();

            if (result.success) {
                toast({ title: "✅ Success!", description: result.message });
                setSetupResult({ success: true, message: result.message });
            } else {
                throw new Error(result.message);
            }

        } catch (error: any) {
            console.error('Project Reset Failed:', error);
            toast({ title: "❌ Failed", description: error.message, variant: "destructive" });
            setSetupResult({ success: false, message: error.message, error });
        } finally {
            setIsSeedingProjects(false);
        }
    };

    const [isSettingUpProfiles, setIsSettingUpProfiles] = useState(false);

    const handleSetupEmployeeProfiles = async () => {
        setIsSettingUpProfiles(true);
        setSetupResult(null);

        try {
            toast({
                title: "🚀 Creating Employee Profiles List",
                description: "Setting up list and populating data...",
            });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .get();

            const setupService = new SharePointListSetupService(graphClient, site.id);
            const result = await setupService.createEmployeeProfilesList();

            if (result.success) {
                toast({
                    title: "✅ Success!",
                    description: result.message,
                });
                setSetupResult(result);
            } else {
                throw new Error(result.message);
            }

        } catch (error: any) {
            console.error('❌ Setup failed:', error);
            toast({
                title: "❌ Setup Failed",
                description: error.message,
                variant: "destructive"
            });
            setSetupResult({ success: false, message: error.message });
        } finally {
            setIsSettingUpProfiles(false);
        }
    };
    const [isSettingUpOfficerProfiles, setIsSettingUpOfficerProfiles] = useState(false);
    const [isSeedingOfficerProfiles, setIsSeedingOfficerProfiles] = useState(false);

    const handleSetupOfficerProfilesList = async () => {
        setIsSettingUpOfficerProfiles(true);
        setSetupResult(null);
        try {
            toast({ title: "🚀 Creating Officer Profiles List", description: "This may take a minute..." });
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');
            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const setupService = new SharePointListSetupService(graphClient, site.id);
            const result = await setupService.setupOfficerProfilesList();
            setSetupResult(result);
            if (result.success) {
                toast({ title: "✅ Success!", description: result.message });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error(error);
            setSetupResult({ success: false, message: error.message, error });
            toast({ title: "❌ Setup Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSettingUpOfficerProfiles(false);
        }
    };

    const handleSeedOfficerProfilesList = async () => {
        setIsSeedingOfficerProfiles(true);
        setSetupResult(null);
        try {
            toast({ title: "🌱 Seeding Officer Profiles Data", description: "Pushing hardcoded mock data to SharePoint..." });
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');
            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const setupService = new SharePointListSetupService(graphClient, site.id);
            const result = await setupService.seedOfficerProfilesList();
            setSetupResult(result);
            if (result.success) {
                toast({ title: "✅ Success!", description: result.message });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error(error);
            setSetupResult({ success: false, message: error.message, error });
            toast({ title: "❌ Seeding Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSeedingOfficerProfiles(false);
        }
    };

    // ==========================================
    // UAT FEEDBACK LIST SETUP
    // ==========================================
    const [isCreatingFeedbackList, setIsCreatingFeedbackList] = useState(false);

    const handleCreateUATFeedbackList = async () => {
        setIsCreatingFeedbackList(true);
        setSetupResult(null);
        try {
            toast({ title: "🚀 Creating UAT Feedback List", description: "Setting up UAT_Feedback SharePoint list..." });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();

            const result = await FeedbackSharePointService.createList(graphClient, site.id);
            setSetupResult({ success: result.success, message: result.message });

            if (result.success) {
                toast({ title: "✅ List Created", description: result.message });
            } else {
                toast({ title: "⚠️ Already Exists", description: result.message, variant: "destructive" });
            }
        } catch (error: any) {
            console.error('UAT Feedback list creation failed:', error);
            setSetupResult({ success: false, message: error.message, error });
            toast({ title: "❌ Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsCreatingFeedbackList(false);
        }
    };

    // ==========================================
    // DIVISION WORKPLANS LIST SETUP
    // ==========================================
    const [isCreatingWorkPlansList, setIsCreatingWorkPlansList] = useState(false);

    const handleCreateWorkPlansList = async () => {
        setIsCreatingWorkPlansList(true);
        setSetupResult(null);
        try {
            toast({ title: "Creating Division_WorkPlans List", description: "Setting up SharePoint list..." });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const siteId = site.id;

            // 1. Create the list
            const listPayload = {
                displayName: 'Division_WorkPlans',
                list: { template: 'genericList' },
            };

            let listId: string;
            try {
                const listResp = await graphClient.api(`/sites/${siteId}/lists`).post(listPayload);
                listId = listResp.id;
            } catch (err: any) {
                if (err.statusCode === 409 || err.message?.includes('already exists')) {
                    // List exists — resolve its ID
                    const existing = await graphClient.api(`/sites/${siteId}/lists`).filter(`displayName eq 'Division_WorkPlans'`).get();
                    if (existing.value?.length > 0) {
                        listId = existing.value[0].id;
                        toast({ title: "List already exists", description: "Adding missing columns..." });
                    } else {
                        throw err;
                    }
                } else {
                    throw err;
                }
            }

            // 2. Define columns
            const columns: Array<{ name: string; type: string; choices?: string[] }> = [
                { name: 'Description', type: 'text' },
                { name: 'DivisionId', type: 'text' },
                { name: 'DivisionName', type: 'text' },
                { name: 'Status', type: 'choice', choices: ['draft', 'active', 'completed', 'archived'] },
                { name: 'TimePeriod', type: 'choice', choices: ['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'annual', 'custom'] },
                { name: 'Year', type: 'number' },
                { name: 'StartDate', type: 'dateTime' },
                { name: 'EndDate', type: 'dateTime' },
                { name: 'GoalsJSON', type: 'text' },
                { name: 'LinkedStrategicObjectiveId', type: 'text' },
                { name: 'LinkedStrategicObjectiveTitle', type: 'text' },
                { name: 'Organization', type: 'text' },
                { name: 'PreparedBy', type: 'text' },
                { name: 'PlanningPeriodLabel', type: 'text' },
                { name: 'Mandate', type: 'text' },
                { name: 'MonitoringAndReporting', type: 'text' },
                { name: 'ReviewFrequency', type: 'text' },
                { name: 'ReportingTo', type: 'text' },
                { name: 'OverallProgress', type: 'number' },
                { name: 'CreatedByName', type: 'text' },
                { name: 'CreatedByEmail', type: 'text' },
            ];

            let created = 0;
            let skipped = 0;
            for (const col of columns) {
                try {
                    let colPayload: any;
                    if (col.type === 'text') {
                        // Use multiline for large JSON fields
                        const isMultiline = ['GoalsJSON', 'Description', 'Mandate', 'MonitoringAndReporting'].includes(col.name);
                        colPayload = {
                            name: col.name,
                            text: { allowMultipleLines: isMultiline, maxLength: isMultiline ? undefined : 255 },
                        };
                    } else if (col.type === 'number') {
                        colPayload = { name: col.name, number: {} };
                    } else if (col.type === 'dateTime') {
                        colPayload = { name: col.name, dateTime: { format: 'dateTime' } };
                    } else if (col.type === 'choice') {
                        colPayload = { name: col.name, choice: { choices: col.choices, allowTextEntry: false } };
                    }
                    await graphClient.api(`/sites/${siteId}/lists/${listId}/columns`).post(colPayload);
                    created++;
                } catch (colErr: any) {
                    if (colErr.statusCode === 409 || colErr.message?.includes('already exists')) {
                        skipped++;
                    } else {
                        console.warn(`Failed to create column ${col.name}:`, colErr.message);
                    }
                }
            }

            const msg = `List ready. ${created} columns created, ${skipped} already existed.`;
            setSetupResult({ success: true, message: msg });
            toast({ title: "Division_WorkPlans List Ready", description: msg });

            // Reset service cache so it picks up the new list
            const { resetOpsServiceCache } = await import('@/services/sharePointOpsService');
            resetOpsServiceCache();

        } catch (error: any) {
            console.error('Division_WorkPlans list creation failed:', error);
            setSetupResult({ success: false, message: error.message, error });
            toast({ title: "Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsCreatingWorkPlansList(false);
        }
    };

    // ==========================================
    // SYSTEM NOTIFICATIONS LIST SETUP
    // ==========================================
    const [isCreatingNotificationsList, setIsCreatingNotificationsList] = useState(false);

    const handleCreateNotificationsList = async () => {
        setIsCreatingNotificationsList(true);
        setSetupResult(null);
        try {
            toast({ title: "Creating System_Notifications List", description: "Setting up SharePoint list..." });

            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error('Failed to get Graph client');

            const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const siteId = site.id;

            // 1. Create the list
            let listId: string;
            try {
                const listResp = await graphClient.api(`/sites/${siteId}/lists`).post({
                    displayName: 'System_Notifications',
                    list: { template: 'genericList' },
                });
                listId = listResp.id;
            } catch (err: any) {
                if (err.statusCode === 409 || err.message?.includes('already exists')) {
                    const existing = await graphClient.api(`/sites/${siteId}/lists`).filter(`displayName eq 'System_Notifications'`).get();
                    if (existing.value?.length > 0) {
                        listId = existing.value[0].id;
                        toast({ title: "List already exists", description: "Adding missing columns..." });
                    } else {
                        throw err;
                    }
                } else {
                    throw err;
                }
            }

            // 2. Define columns
            const columns: Array<{ name: string; payload: any }> = [
                { name: 'Message', payload: { name: 'Message', text: { allowMultipleLines: true, textType: 'plain' } } },
                { name: 'RecipientEmail', payload: { name: 'RecipientEmail', text: { maxLength: 255 } } },
                { name: 'Type', payload: { name: 'Type', text: { maxLength: 50 } } },
                { name: 'Category', payload: { name: 'Category', text: { maxLength: 50 } } },
                { name: 'ActionUrl', payload: { name: 'ActionUrl', text: { maxLength: 255 } } },
                { name: 'IsRead', payload: { name: 'IsRead', boolean: {} } },
                { name: 'CreatedBy_Custom', payload: { name: 'CreatedBy_Custom', text: { maxLength: 255 } } },
            ];

            let created = 0;
            let skipped = 0;
            for (const col of columns) {
                try {
                    await graphClient.api(`/sites/${siteId}/lists/${listId}/columns`).post(col.payload);
                    created++;
                } catch (colErr: any) {
                    if (colErr.statusCode === 409 || colErr.message?.includes('already exists')) {
                        skipped++;
                    } else {
                        console.warn(`Failed to create column ${col.name}:`, colErr.message);
                    }
                }
            }

            const msg = `List ready. ${created} columns created, ${skipped} already existed.`;
            setSetupResult({ success: true, message: msg });
            toast({ title: "System_Notifications List Ready", description: msg });

            // Reset service cache so it picks up the new list
            const { resetOpsServiceCache } = await import('@/services/sharePointOpsService');
            resetOpsServiceCache();

        } catch (error: any) {
            console.error('System_Notifications list creation failed:', error);
            setSetupResult({ success: false, message: error.message, error });
            toast({ title: "Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsCreatingNotificationsList(false);
        }
    };

    return (
        <PageLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <TestTube className="h-8 w-8 text-intranet-primary" />
                            Test Ground
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Admin testing area for SharePoint list creation and other experimental features
                        </p>
                    </div>
                    <Badge variant="outline" className="text-lg px-4 py-2">
                        Admin Only
                    </Badge>
                </div>

                <Separator />

                {/* User Info Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Info className="h-5 w-5" />
                            Current User Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="font-semibold">Email:</span>
                                <p className="text-muted-foreground">{roleUser?.user_email || 'Not loaded'}</p>
                            </div>
                            <div>
                                <span className="font-semibold">Role:</span>
                                <p className="text-muted-foreground">{roleUser?.role_name || 'Not loaded'}</p>
                            </div>
                            <div>
                                <span className="font-semibold">Division:</span>
                                <p className="text-muted-foreground">{roleUser?.division_name || 'Not assigned'}</p>
                            </div>
                            <div>
                                <span className="font-semibold">Is Admin:</span>
                                <p className="text-muted-foreground">
                                    {roleUser?.is_admin ? (
                                        <Badge variant="default">Yes</Badge>
                                    ) : (
                                        <Badge variant="secondary">No</Badge>
                                    )}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Bulk Demo Data Provisioning Card */}
                <Card className="border-2 border-purple-500 shadow-lg bg-gradient-to-br from-white to-purple-50/30 dark:from-gray-900 dark:to-purple-950/10 overflow-hidden transform transition-all hover:scale-[1.01]">
                    <div className="absolute top-0 left-0 w-2 h-full bg-purple-600"></div>
                    <CardHeader className="bg-purple-500/5 pb-2">
                        <div className="flex justify-between items-start">
                            <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400 text-2xl font-bold">
                                <Zap className="h-6 w-6 fill-purple-600" />
                                Bulk Demo Data Provisioning
                            </CardTitle>
                            <Badge className="bg-purple-600 text-white">Advanced Tool</Badge>
                        </div>
                        <CardDescription className="text-base">
                            Quickly populate or clean up demo data across the entire intranet to test system scaling and dashboard visualizations.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-sm text-amber-800 shadow-sm animate-pulse">
                            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                            <p>
                                <strong>System Notice:</strong> This tool creates realistic data linked to all active users. 
                                Every item is tagged with <code>IsMockData: true</code> for safe removal.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Button
                                onClick={handleSeedTasks}
                                disabled={isSeedingTasks}
                                size="lg"
                                className="w-full gap-3 bg-purple-600 hover:bg-purple-700 h-16 text-lg font-bold shadow-lg hover:shadow-purple-500/20"
                            >
                                {isSeedingTasks ? (
                                    <>
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                        Seeding Tasks...
                                    </>
                                ) : (
                                    <>
                                        <ListChecks className="h-6 w-6" />
                                        Seed 10 Tasks Per User
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={handleSeedAssets}
                                disabled={isSeedingAssets}
                                size="lg"
                                variant="outline"
                                className="w-full gap-3 border-purple-600 text-purple-700 hover:bg-purple-50 h-16 text-lg font-bold border-2"
                            >
                                {isSeedingAssets ? (
                                    <>
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                        Seeding Assets...
                                    </>
                                ) : (
                                    <>
                                        <Database className="h-6 w-6" />
                                        Seed 10 Assets Per User
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={handleSetupAssetSubLists}
                                disabled={isSettingUpAssetSubLists}
                                size="lg"
                                className="w-full gap-3 bg-blue-600 hover:bg-blue-700 h-16 text-lg font-bold shadow-lg"
                            >
                                {isSettingUpAssetSubLists ? (
                                    <>
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                        Setting up lists...
                                    </>
                                ) : (
                                    <>
                                        <Layers className="h-6 w-6" />
                                        Setup Asset Sub-Lists
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={handleSeedAssetSubLists}
                                disabled={isSeedingAssetSubLists}
                                size="lg"
                                variant="outline"
                                className="w-full gap-3 border-blue-600 text-blue-700 hover:bg-blue-50 h-16 text-lg font-bold border-2"
                            >
                                {isSeedingAssetSubLists ? (
                                    <>
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                        Seeding Data...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="h-6 w-6" />
                                        Seed Maintenance & Invoices
                                    </>
                                )}
                            </Button>
                        </div>

                        <div className="py-2">
                            <Separator />
                        </div>

                        <Button
                            onClick={handlePurgeDemoData}
                            disabled={isPurgingDemo}
                            variant="destructive"
                            size="lg"
                            className="w-full gap-3 border-red-600 bg-red-600 hover:bg-red-700 text-white h-16 text-lg font-bold shadow-xl ring-2 ring-red-500/20"
                        >
                            {isPurgingDemo ? (
                                <>
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                    Purging Demo Data...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-6 w-6" />
                                    Purge All Demo Data
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* SharePoint ID Extractor */}
                <Card className="border-2 border-primary/20 shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Search className="h-5 w-5" />
                            SharePoint ID Extractor
                        </CardTitle>
                        <CardDescription>
                            Extract Site ID and List ID from a SharePoint URL to use in configuration.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Paste SharePoint List URL here..."
                                value={spUrlToExtract}
                                onChange={(e) => setSpUrlToExtract(e.target.value)}
                                className="flex-1"
                            />
                            <Button
                                onClick={handleExtractIds}
                                disabled={isExtractingIds || !spUrlToExtract}
                            >
                                {isExtractingIds ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                                Extract IDs
                            </Button>
                        </div>

                        {(extractedSiteId || extractedListId || extractedDriveId) && (
                            <div className="bg-muted/50 rounded-md p-4 space-y-3 border">
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Site ID</div>
                                    <div className="flex items-center gap-2">
                                        <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm flex-1 overflow-x-auto">
                                            {extractedSiteId || 'Could not extract'}
                                        </code>
                                        <Button size="sm" variant="outline" onClick={() => handleCopy(extractedSiteId, 'Site ID')} disabled={!extractedSiteId}>
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">List ID</div>
                                    <div className="flex items-center gap-2">
                                        <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm flex-1 overflow-x-auto">
                                            {extractedListId || 'Could not extract'}
                                        </code>
                                        <Button size="sm" variant="outline" onClick={() => handleCopy(extractedListId, 'List ID')} disabled={!extractedListId}>
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Drive ID (Document Library Uploads)</div>
                                    <div className="flex items-center gap-2">
                                        <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm flex-1 overflow-x-auto">
                                            {extractedDriveId || 'Could not extract'}
                                        </code>
                                        <Button size="sm" variant="outline" onClick={() => handleCopy(extractedDriveId, 'Drive ID')} disabled={!extractedDriveId}>
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Regulatory Intelligence Setup Card (NEW) */}
                <Card className="border-2 border-intranet-primary shadow-lg bg-gradient-to-br from-white to-intranet-primary/5 dark:from-gray-900 dark:to-intranet-primary/10">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-2xl flex items-center gap-2 text-intranet-primary text-bold">
                                    <Shield className="h-6 w-6" /> {/* Requires Shield icon from lucide-react */}
                                    Regulatory Intelligence Backend Setup
                                </CardTitle>
                                <CardDescription className="text-base font-medium mt-1">
                                    Deploy the 'Regulatory_Intelligence_Cases' SharePoint list.
                                </CardDescription>
                            </div>
                            <Badge className="bg-intranet-primary text-white">New</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Layers className="h-4 w-4" /> Comprehensive Data Setup
                                </h3>
                                <ul className="grid grid-cols-1 gap-2 text-sm font-medium">
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Case Types (Whistleblower, Scam)</li>
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Case Categories</li>
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Status & Risk Levels</li>
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Reporter Details</li>
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Assigned Units/Officers</li>
                                </ul>
                            </div>

                            <div className="bg-intranet-primary/5 rounded-2xl p-6 border border-intranet-primary/10 flex flex-col justify-center">
                                <div className="space-y-4">
                                    <Button
                                        onClick={handleSetupRegulatoryEngine}
                                        disabled={isSettingUpRegulatory}
                                        size="lg"
                                        className="w-full bg-intranet-primary hover:bg-intranet-primary-dark shadow-md py-6 text-lg font-bold"
                                    >
                                        {isSettingUpRegulatory ? (
                                            <>
                                                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                                Deploying Engine...
                                            </>
                                        ) : (
                                            <>
                                                <Settings className="h-6 w-6 mr-2" />
                                                Deploy Regulatory Engine
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Facebook Analytics Setup Card (NEW) */}
                <Card className="border-2 border-blue-600 shadow-lg bg-gradient-to-br from-white to-blue-50 dark:from-gray-900 dark:to-blue-950/30">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-2xl flex items-center gap-2 text-blue-700 text-bold">
                                    <Network className="h-6 w-6" />
                                    Facebook Analytics Backend Setup
                                </CardTitle>
                                <CardDescription className="text-base font-medium mt-1">
                                    Deploy the three SharePoint lists that store Facebook posts, comments, and messages synced from Google Apps Script.
                                </CardDescription>
                            </div>
                            <Badge className="bg-blue-600 text-white">New</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Layers className="h-4 w-4" /> Lists Created
                                </h3>
                                <ul className="grid grid-cols-1 gap-2 text-sm font-medium">
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Facebook_Posts (id, type, message, media, engagement)</li>
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Facebook_Comments (comment + reply thread)</li>
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Facebook_Messages (Messenger inbox)</li>
                                </ul>
                                <p className="text-xs text-muted-foreground pt-2">
                                    After deploy, the list IDs are logged to the browser console. Paste them into your Google Apps Script Script Properties as <code>FB_POSTS_LIST_ID</code>, <code>FB_COMMENTS_LIST_ID</code>, <code>FB_MESSAGES_LIST_ID</code>.
                                </p>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-900 flex flex-col justify-center">
                                <div className="space-y-4">
                                    <Button
                                        onClick={handleSetupFacebookAnalytics}
                                        disabled={isSettingUpFacebook}
                                        size="lg"
                                        className="w-full bg-blue-600 hover:bg-blue-700 shadow-md py-6 text-lg font-bold"
                                    >
                                        {isSettingUpFacebook ? (
                                            <>
                                                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                                Deploying Lists...
                                            </>
                                        ) : (
                                            <>
                                                <Settings className="h-6 w-6 mr-2" />
                                                Deploy Facebook Analytics Lists
                                            </>
                                        )}
                                    </Button>

                                    <Button
                                        onClick={handleDropFacebookUrlColumns}
                                        disabled={isDroppingFbUrlCols}
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-amber-400 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                    >
                                        {isDroppingFbUrlCols ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Dropping URL columns...
                                            </>
                                        ) : (
                                            <>
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Drop URL columns (then redeploy)
                                            </>
                                        )}
                                    </Button>
                                    <p className="text-xs text-muted-foreground -mt-2">
                                        Run this if your existing Facebook_Posts list has single-line ImageUrl/VideoUrl/PostLink columns truncating Facebook CDN URLs. After dropping, click <strong>Deploy Facebook Analytics Lists</strong> to recreate them as multi-line.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Enterprise Strategy Hub Setup Card */}
                <Card className="border-2 border-intranet-primary shadow-lg bg-gradient-to-br from-white to-intranet-primary/5 dark:from-gray-900 dark:to-intranet-primary/10">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-2xl flex items-center gap-2 text-intranet-primary text-bold">
                                    <Rocket className="h-6 w-6" />
                                    Enterprise Strategy Hub Backend Setup
                                </CardTitle>
                                <CardDescription className="text-base font-medium mt-1">
                                    Deploy the complete design schema for Strategy, Analytics, and Reports.
                                </CardDescription>
                            </div>
                            <Badge className="bg-intranet-primary text-white">Recommended</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Layers className="h-4 w-4" /> Comprehensive Data Setup
                                </h3>
                                <ul className="grid grid-cols-1 gap-2 text-sm font-medium">
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Strategy Config (Mission/Vision)</li>
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Core Functions (4 Functions)</li>
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Strategic Objectives (Full Cards)</li>
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Divisional Alignment (Cascade)</li>
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Roadmap Milestones (Analytics)</li>
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Strategy Risks (Reports)</li>
                                </ul>
                            </div>

                            <div className="bg-intranet-primary/5 rounded-2xl p-6 border border-intranet-primary/10 flex flex-col justify-center">
                                <div className="space-y-4">
                                    <Button
                                        onClick={handleSetupStrategyHubEngine}
                                        disabled={isSettingUpStrategyHub}
                                        size="lg"
                                        className="w-full bg-intranet-primary hover:bg-intranet-primary-dark shadow-md py-6 text-lg font-bold"
                                    >
                                        {isSettingUpStrategyHub ? (
                                            <>
                                                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                                Deploying Engine...
                                            </>
                                        ) : (
                                            <>
                                                <Settings className="h-6 w-6 mr-2" />
                                                Deploy Strategy Engine
                                            </>
                                        )}
                                    </Button>

                                    <Button
                                        variant="outline"
                                        onClick={async () => {
                                            if (!confirm('RESET: This will delete all Strategy Hub lists. Data will be lost! Proceed?')) return;
                                            setIsSettingUpStrategyHub(true);
                                            try {
                                                const graphClient = await getGraphClient(msalInstance);
                                                const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
                                                const setupService = new SharePointListSetupService(graphClient, site.id);
                                                const res = await setupService.deleteStrategyHubEngine();
                                                if (res.success) toast({ title: "🗑️ Cleaned Up", description: "Strategy Hub Engine lists removed." });
                                            } finally {
                                                setIsSettingUpStrategyHub(false);
                                            }
                                        }}
                                        className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold"
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Reset Strategy Engine
                                    </Button>

                                    <Separator className="my-2" />

                                    <Button
                                        variant="secondary"
                                        onClick={async () => {
                                            setIsSettingUpStrategyHub(true);
                                            try {
                                                toast({ title: "🚀 Deploying Objectives", description: "Creating Strategic Objectives list..." });
                                                const graphClient = await getGraphClient(msalInstance);
                                                const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
                                                const setupService = new SharePointListSetupService(graphClient, site.id);
                                                // Call standalone method
                                                const result = await setupService.setupStrategicObjectivesStandalone();
                                                if (result.success) {
                                                    toast({ title: "✅ Objectives Deployed", description: "Strategic Objectives list created with full cards data." });
                                                } else {
                                                    throw new Error(result.message);
                                                }
                                            } catch (error: any) {
                                                toast({ title: "❌ Failed", description: error.message, variant: "destructive" });
                                            } finally {
                                                setIsSettingUpStrategyHub(false);
                                            }
                                        }}
                                        className="w-full font-semibold"
                                    >
                                        <ListChecks className="h-4 w-4 mr-2" />
                                        Deploy Objectives Only
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Corporate Plan 2026-2028 Setup Card (NEW) */}
                <Card className="border-2 border-emerald-500/50 shadow-lg bg-gradient-to-br from-white to-emerald-50 dark:from-gray-900 dark:to-emerald-900/10">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-2xl flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-bold">
                                    <Target className="h-6 w-6" />
                                    Corporate Plan 2026-2028 Schema Setup
                                </CardTitle>
                                <CardDescription className="text-base font-medium mt-1">
                                    Deploy the new 5-level hierarchy lists (Goals &gt; KRAs &gt; Initiatives) to SharePoint.
                                </CardDescription>
                            </div>
                            <Badge className="bg-emerald-600 text-white">Critical Update</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Layers className="h-4 w-4" /> New List Structure
                                </h3>
                                <ul className="grid grid-cols-1 gap-2 text-sm font-medium">
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-500" /> Strategic_Goals (Top level, replaces Pillars)</li>
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-500" /> Strategic_KRAs (Mid level, replaces org-objectives)</li>
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-500" /> Strategic_Initiatives (Unit level, replaces div-alignment)</li>
                                    <li className="flex items-center gap-2 text-muted-foreground"><CheckCircle className="h-4 w-4" /> Performance_KPIs (Existing)</li>
                                    <li className="flex items-center gap-2 text-muted-foreground"><CheckCircle className="h-4 w-4" /> Operations_Tasks (Existing)</li>
                                </ul>
                            </div>

                            <div className="bg-emerald-500/5 rounded-2xl p-6 border border-emerald-500/10 flex flex-col justify-center">
                                <div className="space-y-4">
                                    <Button
                                        onClick={handleSetupCorporatePlan}
                                        disabled={isSettingUpCorporatePlan || isMigratingStrategy}
                                        size="lg"
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-md py-6 text-lg font-bold"
                                    >
                                        {isSettingUpCorporatePlan ? (
                                            <>
                                                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                                Deploying Corporate Lists...
                                            </>
                                        ) : (
                                            <>
                                                <Database className="h-6 w-6 mr-2" />
                                                Create 2026-2028 Lists
                                            </>
                                        )}
                                    </Button>

                                    <Button
                                        onClick={handleMigrateStrategyData}
                                        disabled={isMigratingStrategy || isSettingUpCorporatePlan}
                                        size="lg"
                                        variant="outline"
                                        className="w-full border-emerald-600 text-emerald-700 hover:bg-emerald-50 shadow-sm py-6 text-lg font-bold"
                                    >
                                        {isMigratingStrategy ? (
                                            <>
                                                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                                Migrating Legacy Data...
                                            </>
                                        ) : (
                                            <>
                                                <RefreshCw className="h-6 w-6 mr-2" />
                                                Migrate Legacy Data
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Organization Structure Setup Card */}
                <Card className="border-2 border-intranet-primary shadow-lg overflow-hidden transform transition-all hover:scale-[1.01] mb-6">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Users className="h-24 w-24 text-intranet-primary" />
                    </div>
                    <CardHeader className="bg-intranet-primary/5">
                        <CardTitle className="flex items-center gap-2 text-intranet-primary text-xl">
                            <Network className="h-6 w-6" />
                            Organization Structure Setup
                        </CardTitle>
                        <CardDescription className="text-base">
                            Initialize and synchronize the organizational hierarchy (Divisions & Units) from SharePoint.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 text-sm text-blue-800">
                            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                            <p>
                                This tool creates or updates the <strong>Org_Hierarchy</strong> list. This list is used by the <strong>Strategy Hub</strong> to dynamically build the organizational tree and divisional alignments.
                            </p>
                        </div>

                        <div className="flex flex-col gap-4">
                            <Button
                                onClick={handleSetupOrgHierarchy}
                                disabled={isSettingUpOrgHierarchy || isSettingUpLists}
                                size="lg"
                                className="w-full gap-3 h-16 text-xl font-black shadow-md hover:shadow-lg transition-all bg-intranet-primary hover:bg-intranet-primary/90"
                            >
                                {isSettingUpOrgHierarchy ? (
                                    <>
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                        Synchronizing Hierarchy...
                                    </>
                                ) : (
                                    <>
                                        <Users className="h-7 w-7" />
                                        Synchronize Org Hierarchy
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* IT Request Form Test Area (MOVED HIGHER) */}
                <Card className="border-2 border-primary/20 bg-primary/5 mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl text-primary">
                            <Settings className="h-6 w-6" />
                            IT Request Form Test Ground
                        </CardTitle>
                        <CardDescription>
                            Setup the IT Request Access List and test the form submission logic.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <ListChecks className="h-4 w-4" />
                                    Backend Setup
                                </h3>
                                <Button
                                    onClick={handleSetupITRequestList}
                                    disabled={isSettingUpITRequest}
                                    className="w-full"
                                >
                                    {isSettingUpITRequest ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            Creating IT_Request_Access_List...
                                        </>
                                    ) : (
                                        <>
                                            <Database className="h-4 w-4 mr-2" />
                                            Setup IT Request Access List
                                        </>
                                    )}
                                </Button>
                                <p className="text-xs text-muted-foreground bg-white/50 p-2 rounded border">
                                    Clicking this button creates the <strong>IT_Request_Access_List</strong> in SharePoint.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <Play className="h-4 w-4" />
                                    Live Form Test
                                </h3>
                                <FormProvider {...form}>
                                    <FormRenderer
                                        template={itRequestTemplate}
                                        onSubmit={handleITRequestSubmit}
                                        isSubmitting={isSubmittingForm}
                                    />
                                </FormProvider>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <List className="h-4 w-4" />
                                    Recent Submissions (Last 5)
                                </h3>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={loadRecentITRequests}
                                    disabled={isLoadingRequests}
                                >
                                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingRequests ? 'animate-spin' : ''}`} />
                                    Refresh
                                </Button>
                            </div>

                            <div className="rounded-md border bg-white overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Staff Name</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Priority</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {recentITRequests.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                    {isLoadingRequests ? 'Loading submissions...' : 'No submissions found yet.'}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            recentITRequests.map((req) => (
                                                <TableRow key={req.id}>
                                                    <TableCell className="font-medium">{req.fields?.StaffName}</TableCell>
                                                    <TableCell>{req.fields?.RequestType}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={req.fields?.Priority === 'Urgent' ? 'destructive' : 'secondary'}>
                                                            {req.fields?.Priority}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{req.fields?.Status}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                        {req.fields?.SubmissionDate ? new Date(req.fields.SubmissionDate).toLocaleDateString() : '-'}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Officer Profiles Setup Card */}
                <Card className="border-2 border-indigo-500/20 mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-indigo-600" />
                            Officer Profiles Data Migration (Org Chart)
                        </CardTitle>
                        <CardDescription>
                            Create the Strategy_Officer_Profiles list and seed it with the hardcoded mock data for the Org Chart Modal.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col gap-4">
                            <Button
                                onClick={handleSetupOfficerProfilesList}
                                disabled={isSettingUpOfficerProfiles}
                                size="lg"
                                className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700"
                            >
                                {isSettingUpOfficerProfiles ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Creating Officer Profiles List...
                                    </>
                                ) : (
                                    <>
                                        <Database className="h-5 w-5" />
                                        Create Officer Profiles List
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={handleSeedOfficerProfilesList}
                                disabled={isSeedingOfficerProfiles || isSettingUpOfficerProfiles}
                                variant="outline"
                                className="w-full gap-2 border-dashed border-indigo-600/50 text-indigo-700 hover:bg-indigo-50"
                            >
                                {isSeedingOfficerProfiles ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                                        Seeding Data...
                                    </>
                                ) : (
                                    <>
                                        <Play className="h-4 w-4 text-indigo-600" />
                                        Seed Officer Profiles Data
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Forms Management Setup Card */}
                <Card className="border-2 border-primary shadow-lg mb-6">
                    <CardHeader className="bg-primary/5">
                        <CardTitle className="flex items-center gap-2 text-primary text-xl">
                            <FileText className="h-6 w-6" />
                            Forms Management Setup
                        </CardTitle>
                        <CardDescription className="text-base">
                            Initialize the backend infrastructure for the dynamic Forms Engine.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex gap-3 text-sm">
                            <Info className="h-5 w-5 text-primary flex-shrink-0" />
                            <p>
                                This tool creates <strong>Form_Groups</strong> and <strong>Form_Registrations</strong> lists.
                                These lists allow you to organize forms into categories and register templates dynamically.
                            </p>
                        </div>

                        <div className="flex flex-col gap-4">
                            <Button
                                onClick={handleSetupFormsEngine}
                                disabled={isSettingUpForms || isSettingUpLists}
                                size="lg"
                                className="w-full gap-3 h-16 text-xl font-black shadow-md hover:shadow-lg transition-all"
                            >
                                {isSettingUpForms ? (
                                    <>
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                        Deploying Forms Engine...
                                    </>
                                ) : (
                                    <>
                                        <Rocket className="h-7 w-7" />
                                        Deploy Forms Engine
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>


                {/* SharePoint List Setup Card */}
                <Card className="border-2 border-intranet-primary/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Database className="h-5 w-5 text-intranet-primary" />
                            SharePoint Strategy Lists Setup
                        </CardTitle>
                        <CardDescription>
                            Create required lists for Strategy System (Mission, Pillars, Objectives)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* What Gets Created */}
                        <div className="space-y-3">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Layers className="h-4 w-4" />
                                Lists to be Created:
                            </h3>
                            <div className="grid gap-2 ml-6">
                                <div className="flex items-start gap-2">
                                    <List className="h-4 w-4 mt-0.5 text-intranet-primary" />
                                    <div>
                                        <p className="font-medium">Strategy_Config</p>
                                        <p className="text-sm text-muted-foreground">Mission, Vision, Values</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <List className="h-4 w-4 mt-0.5 text-intranet-primary" />
                                    <div>
                                        <p className="font-medium">Strategic_Pillars</p>
                                        <p className="text-sm text-muted-foreground">Top-level strategic pillars</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <List className="h-4 w-4 mt-0.5 text-intranet-primary" />
                                    <div>
                                        <p className="font-medium">Strategic_Objectives</p>
                                        <p className="text-sm text-muted-foreground">Org Objectives and Division Objectives with relationships</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Setup Button */}
                        <div className="flex flex-col gap-4">
                            <Button
                                onClick={handleSetupStrategyLists}
                                disabled={isSettingUpLists || isSettingUpOps}
                                size="lg"
                                className="w-full gap-2"
                            >
                                {isSettingUpLists ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Creating Strategy Lists...
                                    </>
                                ) : (
                                    <>
                                        <Settings className="h-5 w-5" />
                                        Create Strategy Lists
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={async () => {
                                    if (!confirm('Are you sure you want to delete all Strategy lists? This cannot be undone.')) return;

                                    setIsSettingUpLists(true);
                                    try {
                                        const graphClient = await getGraphClient(msalInstance);
                                        if (!graphClient) throw new Error('Failed to get Graph client');

                                        const site = await graphClient
                                            .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                                            .get();

                                        const setupService = new SharePointListSetupService(graphClient, site.id);
                                        const result = await setupService.deleteStrategyLists();

                                        if (result.success) {
                                            toast({ title: "✅ Lists Deleted", description: "You can now run the setup again." });
                                            setSetupResult(null); // Clear previous results
                                        } else {
                                            throw new Error(result.message);
                                        }
                                    } catch (error: any) {
                                        toast({
                                            title: "❌ Delete Failed",
                                            description: error.message,
                                            variant: "destructive"
                                        });
                                    } finally {
                                        setIsSettingUpLists(false);
                                    }
                                }}
                                disabled={isSettingUpLists || isSettingUpOps}
                                variant="destructive"
                                size="lg"
                                className="w-full gap-2"
                            >
                                <AlertCircle className="h-5 w-5" />
                                Reset / Delete Strategy Lists
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Operations Lists Setup Card */}
                <Card className="border-2 border-emerald-500/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-emerald-600" />
                            SharePoint Operations Lists Setup
                        </CardTitle>
                        <CardDescription>
                            Create operational lists (KRAs, KPIs, Projects, Tasks) with mock data
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* What Gets Created */}
                        <div className="space-y-3">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Layers className="h-4 w-4" />
                                Lists to be Created:
                            </h3>
                            <div className="grid gap-2 ml-6">
                                <div className="flex items-start gap-2">
                                    <List className="h-4 w-4 mt-0.5 text-emerald-600" />
                                    <div>
                                        <p className="font-medium">Performance_KRAs</p>
                                        <p className="text-sm text-muted-foreground">Linked to Strategic Goals</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <List className="h-4 w-4 mt-0.5 text-emerald-600" />
                                    <div>
                                        <p className="font-medium">Performance_KPIs</p>
                                        <p className="text-sm text-muted-foreground">Linked to KRAs</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <List className="h-4 w-4 mt-0.5 text-emerald-600" />
                                    <div>
                                        <p className="font-medium">Operations_Projects</p>
                                        <p className="text-sm text-muted-foreground">Linked to KRAs</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <List className="h-4 w-4 mt-0.5 text-emerald-600" />
                                    <div>
                                        <p className="font-medium">Operations_Tasks</p>
                                        <p className="text-sm text-muted-foreground">Daily operations linked to Projects/KRAs</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <List className="h-4 w-4 mt-0.5 text-emerald-600" />
                                    <div>
                                        <p className="font-medium">Operations_Risks</p>
                                        <p className="text-sm text-muted-foreground">Risks linked to Projects/KRAs</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <List className="h-4 w-4 mt-0.5 text-emerald-600" />
                                    <div>
                                        <p className="font-medium">Operations_TaskGroups</p>
                                        <p className="text-sm text-muted-foreground">Groups of tasks independent of Projects</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Setup Button */}
                        <div className="flex flex-col gap-4">
                            <Button
                                onClick={handleSetupOperationsLists}
                                disabled={isSettingUpLists || isSettingUpOps}
                                size="lg"
                                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                            >
                                {isSettingUpOps ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Creating Operations Lists...
                                    </>
                                ) : (
                                    <>
                                        <Settings className="h-5 w-5" />
                                        Create Operations Lists
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={handleSetupTaskGroups}
                                disabled={isSettingUpTaskGroups}
                                variant="outline"
                                className="w-full gap-2 border-dashed border-emerald-600/50 text-emerald-700 hover:bg-emerald-50"
                            >
                                {isSettingUpTaskGroups ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                                        Creating Task Groups List...
                                    </>
                                ) : (
                                    <>
                                        <FolderKanban className="h-4 w-4 text-emerald-600" />
                                        Create Task Groups List Only
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={handleEnsureAssigneesColumn}
                                disabled={isEnsuringAssignees}
                                variant="outline"
                                className="w-full gap-2 border-dashed border-emerald-600/50 text-emerald-700 hover:bg-emerald-50"
                            >
                                {isEnsuringAssignees ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                                        Fixing Schema...
                                    </>
                                ) : (
                                    <>
                                        <Database className="h-4 w-4 text-emerald-600" />
                                        Fix Schema: Add 'Assignees' Column
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={handleEnsureCompletionColumn}
                                disabled={isEnsuringCompletionDate}
                                variant="outline"
                                className="w-full gap-2 border-dashed border-emerald-600/50 text-emerald-700 hover:bg-emerald-50"
                            >
                                {isEnsuringCompletionDate ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                                        Fixing Schema...
                                    </>
                                ) : (
                                    <>
                                        <ListChecks className="h-4 w-4 text-emerald-600" />
                                        Fix Schema: Add 'CompletionDate' Column
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={async () => {
                                    setIsEnsuringCompletionDate(true);
                                    try {
                                        toast({ title: "🌱 Seeding Data", description: "Backpopulating completion dates..." });
                                        const graphClient = await getGraphClient(msalInstance);
                                        if (!graphClient) throw new Error("Failed to get Graph client"); // Safety check
                                        const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
                                        const setupService = new SharePointListSetupService(graphClient, site.id);

                                        const result = await setupService.seedRandomCompletionDates();
                                        toast({ title: "✅ Completed", description: result.message });
                                    } catch (e: any) {
                                        toast({ title: "❌ Error", description: e.message, variant: "destructive" });
                                    } finally {
                                        setIsEnsuringCompletionDate(false);
                                    }
                                }}
                                disabled={isEnsuringCompletionDate}
                                variant="outline"
                                className="w-full gap-2 border-dashed border-amber-500/50 text-amber-700 hover:bg-amber-50"
                            >
                                {isEnsuringCompletionDate ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                                        Seeding...
                                    </>
                                ) : (
                                    <>
                                        <Database className="h-4 w-4 text-amber-600" />
                                        Populate Random Completion Dates
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={handleSeedOfficerData}
                                disabled={isSeedingOfficers || isSettingUpOps}
                                variant="outline"
                                className="w-full gap-2 border-dashed border-emerald-500/50 text-emerald-700 hover:bg-emerald-50"
                            >
                                {isSeedingOfficers ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                                        Seeding Officer Data...
                                    </>
                                ) : (
                                    <>
                                        <Users className="h-4 w-4 text-emerald-600" />
                                        Seed Officer Operational Data (30 Staff)
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={async () => {
                                    if (!confirm('Are you sure you want to delete all Operations lists?')) return;

                                    setIsSettingUpOps(true);
                                    try {
                                        const graphClient = await getGraphClient(msalInstance);
                                        if (!graphClient) throw new Error('Failed to get Graph client');
                                        const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
                                        const setupService = new SharePointListSetupService(graphClient, site.id);
                                        const result = await setupService.deleteOperationsLists();

                                        if (result.success) {
                                            toast({ title: "✅ Lists Deleted", description: "Operations lists removed." });
                                            setSetupResult(null);
                                        } else {
                                            throw new Error(result.message);
                                        }
                                    } catch (error: any) {
                                        toast({ title: "❌ Delete Failed", description: error.message, variant: "destructive" });
                                    } finally {
                                        setIsSettingUpOps(false);
                                    }
                                }}
                                disabled={isSettingUpLists || isSettingUpOps}
                                variant="outline"
                                size="lg"
                                className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50"
                            >
                                <AlertCircle className="h-5 w-5" />
                                Reset / Delete Operations Lists
                            </Button>

                            <Button
                                onClick={handlePurgeAndResetOperations}
                                disabled={isSettingUpLists || isSettingUpOps || isPurgingOps}
                                variant="destructive"
                                size="lg"
                                className="w-full gap-2 border-red-600 bg-red-600 hover:bg-red-700 text-white"
                            >
                                {isPurgingOps ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Purging & Resetting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="h-5 w-5" />
                                        Purge & Reset (Fresh Start)
                                    </>
                                )}
                            </Button>

                            <div className="border-t border-gray-200 my-4"></div>

                            <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <Target className="w-4 h-4 text-purple-600" />
                                Strategy Maintenance
                            </h3>

                            <Button
                                onClick={handleResetStrategyProgress}
                                disabled={isResettingStrategy}
                                variant="outline"
                                className="w-full gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
                            >
                                {isResettingStrategy ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                                        Resetting Strategy...
                                    </>
                                ) : (
                                    <>
                                        <Target className="h-4 w-4 text-purple-600" />
                                        Reset Strategy Progress (0%)
                                    </>
                                )}
                            </Button>

                            <div className="border-t border-gray-200 my-4"></div>

                            <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-red-600" />
                                Reset & Reseed SCPNG Framework
                            </h3>
                            <p className="text-xs text-gray-500 mb-3">
                                Wipes all Objectives, KRAs and KPIs, then seeds the official framework:
                                5 Strategic Goals, 18 KRAs, 72 KPIs across all divisions.
                            </p>

                            <Button
                                onClick={handleReseedScpngFramework}
                                disabled={isReseedingFramework}
                                variant="destructive"
                                className="w-full gap-2 bg-red-700 hover:bg-red-800 text-white"
                            >
                                {isReseedingFramework ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Reseeding Framework...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="h-4 w-4" />
                                        Reset & Reseed Official Framework
                                    </>
                                )}
                            </Button>

                            {frameworkSeedLog.length > 0 && (
                                <div className="mt-3 bg-gray-950 rounded-md p-3 max-h-56 overflow-y-auto font-mono text-xs text-green-400 space-y-0.5">
                                    {frameworkSeedLog.map((line, i) => (
                                        <div key={i} className={line.startsWith('ERROR') ? 'text-red-400' : line.startsWith('  ') ? 'text-gray-400' : 'text-green-300'}>
                                            {line}
                                        </div>
                                    ))}
                                    {isReseedingFramework && (
                                        <div className="text-yellow-400 animate-pulse">Running...</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>


                {/* Mock Data Generation Card */}
                <Card className="border-2 border-amber-500/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Database className="h-5 w-5 text-amber-600" />
                            Mock Performance Data (Individual Filtering)
                        </CardTitle>
                        <CardDescription>
                            Generate and upload realistic KRAs, KPIs, and Tasks for staff members to test filtering.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <h4 className="font-semibold flex items-center gap-2">
                                <ListChecks className="h-4 w-4" />
                                Process:
                            </h4>
                            <ul className="space-y-2 ml-6 text-sm">
                                <li>1. Fetch up to 10 users from Tenant</li>
                                <li>2. Generate ~30 items per user (10 KRA, 10 KPI, 10 Task)</li>
                                <li>3. Link items to Strategic Objectives and each other</li>
                                <li>4. Upload to SharePoint with correct Lookups</li>
                            </ul>
                        </div>

                        <div className="flex flex-col gap-4">
                            {!mockData ? (
                                <>
                                    <Button
                                        onClick={handleGenerateMockData}
                                        disabled={isGeneratingMock || isUploadingMock}
                                        className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                                        size="lg"
                                    >
                                        {isGeneratingMock ? (
                                            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</>
                                        ) : (
                                            <><TestTube className="h-4 w-4 mr-2" /> Generate Mock Data (10 Users)</>
                                        )}
                                    </Button>

                                    <Button
                                        onClick={handleGenerateForUser}
                                        disabled={isGeneratingMock || isUploadingMock}
                                        className="w-full bg-blue-100/10 text-blue-600 hover:bg-blue-100/20 border-blue-600 border"
                                        size="lg"
                                    >
                                        {isGeneratingMock ? (
                                            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</>
                                        ) : (
                                            <><CheckCircle className="h-4 w-4 mr-2" /> Generate for jsarwom@scpng.gov.pg</>
                                        )}
                                    </Button>
                                </>
                            ) : (
                                <div className="space-y-4 border p-4 rounded-lg bg-slate-50 dark:bg-slate-900">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-green-600">
                                            Ready to Upload: {mockData.kras.length + mockData.kpis.length + mockData.tasks.length} items
                                        </span>
                                        <Button variant="ghost" size="sm" onClick={() => setMockData(null)}>Cancel</Button>
                                    </div>
                                    <Button
                                        onClick={handleUploadMockData}
                                        disabled={isUploadingMock}
                                        className="w-full bg-green-600 hover:bg-green-700"
                                        size="lg"
                                    >
                                        {isUploadingMock ? (
                                            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {mockUploadStatus}</>
                                        ) : (
                                            <><Rocket className="h-4 w-4 mr-2" /> Upload to SharePoint</>
                                        )}
                                    </Button>
                                </div>
                            )}

                            <Button
                                onClick={handleClearMockData}
                                disabled={isUploadingMock}
                                variant="outline"
                                className="w-full text-red-500 border-red-200 hover:bg-red-50"
                            >
                                <Trash2 className="h-4 w-4 mr-2" /> Clear All Mock Performance Data
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Projects Management Card */}
                <Card className="border-2 border-indigo-500/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FolderKanban className="h-5 w-5 text-indigo-600" />
                            Projects Management Setup
                        </CardTitle>
                        <CardDescription>
                            Specialized tools for the Projects list (Schema updates & Mock Data)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <h4 className="font-semibold flex items-center gap-2">
                                <ListChecks className="h-4 w-4" />
                                Actions:
                            </h4>
                            <ul className="space-y-2 ml-6 text-sm">
                                <li>
                                    <span className="font-bold text-indigo-600">Reset & Seed:</span> Deletes 'Operations_Projects', recreates it with new schema (Manager as Text, Assignees as JSON), and seeds 24 mock projects.
                                </li>
                            </ul>
                        </div>

                        <Button
                            onClick={handleResetAndSeedProjects}
                            disabled={isSeedingProjects || isSettingUpLists || isSettingUpOps}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                            size="lg"
                        >
                            {isSeedingProjects ? (
                                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Resetting & Seeding...</>
                            ) : (
                                <><Rocket className="h-4 w-4 mr-2" /> Reset & Seed Projects List</>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Employee Profiles Setup */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-intranet-primary" />
                            Employee Profiles Setup
                        </CardTitle>
                        <CardDescription>
                            Create SharePoint list for employee profile images.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-sm space-y-2 mb-4 p-3 bg-muted rounded-md">
                            <div className="flex items-center gap-2">
                                <List className="h-4 w-4 text-blue-500" />
                                <span>Creates: <strong>Employee_Profiles</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Database className="h-4 w-4 text-green-500" />
                                <span>Adds columns: ProfilePhoto, ModalPhoto</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-purple-500" />
                                <span>Populates: 22 Users</span>
                            </div>
                        </div>

                        <Button
                            onClick={handleSetupEmployeeProfiles}
                            disabled={isSettingUpProfiles}
                            className="w-full bg-intranet-primary hover:bg-intranet-secondary"
                        >
                            {isSettingUpProfiles ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                            Deploy Employee Profiles List
                        </Button>
                    </CardContent>
                </Card>

                {/* Market Data Lists Setup Card */}
                {/* Announcements List Setup Card */}
                <Card className="border-2 border-orange-500/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Rocket className="h-5 w-5 text-orange-600" />
                            Announcements Setup
                        </CardTitle>
                        <CardDescription>
                            Create 'Announcements' list for the Notice Board and functionality.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <h4 className="font-semibold flex items-center gap-2">
                                <ListChecks className="h-4 w-4" />
                                Lists to be Created:
                            </h4>
                            <ul className="space-y-2 ml-6 text-sm">
                                <li key="announcements">
                                    <div className="font-medium flex items-center gap-2">
                                        <Database className="h-3 w-3 text-orange-500" />
                                        Announcements
                                    </div>
                                    <div className="text-muted-foreground ml-5">
                                        Stores intranet announcements, events, and alerts.
                                    </div>
                                </li>
                            </ul>
                        </div>

                        <div className="flex flex-col gap-4">
                            <Button
                                onClick={handleSetupAnnouncements}
                                disabled={isSettingUpAnnouncements}
                                size="lg"
                                className="w-full bg-orange-600 hover:bg-orange-700"
                            >
                                {isSettingUpAnnouncements ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                        Creating Announcements list...
                                    </>
                                ) : (
                                    <>
                                        <Rocket className="h-5 w-5 mr-2" />
                                        Deploy Announcements List
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* App Settings List Setup Card */}
                <Card className="border-2 border-slate-500/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5 text-slate-600" />
                            App Configuration Setup
                        </CardTitle>
                        <CardDescription>
                            Create 'InternalAppSettings' list for storing API keys and global config
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <h4 className="font-semibold flex items-center gap-2">
                                <ListChecks className="h-4 w-4" />
                                Lists to be Created:
                            </h4>
                            <ul className="space-y-2 ml-6 text-sm">
                                <li key="appsettings">
                                    <div className="font-medium flex items-center gap-2">
                                        <Database className="h-3 w-3 text-slate-500" />
                                        InternalAppSettings
                                    </div>
                                    <div className="text-muted-foreground ml-5">
                                        Stores configuration key-value pairs (e.g. GeminiAPIKey)
                                    </div>
                                </li>
                            </ul>
                        </div>

                        <div className="flex flex-col gap-4">
                            <Button
                                onClick={handleSetupAppSettings}
                                disabled={isSettingUpLists || isSettingUpOps || isSettingUpMarket || isSettingUpDocs || isSettingUpAppSettings}
                                size="lg"
                                className="w-full bg-slate-600 hover:bg-slate-700"
                            >
                                {isSettingUpAppSettings ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                        Creating settings list...
                                    </>
                                ) : (
                                    <>
                                        <Settings className="h-5 w-5 mr-2" />
                                        Deploy App Settings List
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Shared Documents Setup Card */}
                <Card className="border-2 border-purple-500/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-purple-600" />
                            SharePoint Shared Documents Setup
                        </CardTitle>
                        <CardDescription>
                            Create document library for Organizational Shared Documents
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <h4 className="font-semibold flex items-center gap-2">
                                <ListChecks className="h-4 w-4" />
                                Lists to be Created:
                            </h4>
                            <ul className="space-y-2 ml-6 text-sm">
                                <li key="docs">
                                    <div className="font-medium flex items-center gap-2">
                                        <Database className="h-3 w-3 text-purple-500" />
                                        Organizational_Documents
                                    </div>
                                    <div className="text-muted-foreground ml-5">
                                        Library for company-wide shared documents with metadata
                                    </div>
                                </li>
                            </ul>
                        </div>

                        <div className="flex flex-col gap-4">
                            <Button
                                onClick={handleSetupDocs}
                                disabled={isSettingUpLists || isSettingUpOps || isSettingUpMarket || isSettingUpDocs}
                                size="lg"
                                className="w-full bg-purple-600 hover:bg-purple-700"
                            >
                                {isSettingUpDocs ? (
                                    <>
                                        <span className="animate-spin mr-2">⏳</span>
                                        Setting up Documents...
                                    </>
                                ) : (
                                    <>
                                        <Settings className="mr-2 h-4 w-4" />
                                        Create Documents Library
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={handleEnsureDocsList}
                                disabled={isSettingUpLists || isSettingUpOps || isSettingUpMarket || isSettingUpDocs}
                                variant="outline"
                                className="w-full gap-2 border-dashed border-purple-600/50 text-purple-700 hover:bg-purple-50"
                            >
                                {isSettingUpDocs ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                                        Ensuring Library...
                                    </>
                                ) : (
                                    <>
                                        <Database className="h-4 w-4 text-purple-600" />
                                        Ensure Organizational Documents List
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={handleSetupDocumentCategories}
                                disabled={isSettingUpLists || isSettingUpOps || isSettingUpMarket || isSettingUpDocs}
                                variant="outline"
                                className="w-full gap-2 border-dashed border-purple-600/50 text-purple-700 hover:bg-purple-50"
                            >
                                {isSettingUpDocs ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                                        Setting up Categories...
                                    </>
                                ) : (
                                    <>
                                        <Database className="h-4 w-4 text-purple-600" />
                                        Setup Document Categories List
                                    </>
                                )}
                            </Button>

                            <Button
                                variant="outline"
                                onClick={handleDeleteDocs}
                                disabled={isSettingUpLists || isSettingUpOps || isSettingUpMarket || isSettingUpDocs}
                                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Documents Library
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Reports Setup Card */}
                <Card className="border-2 border-pink-500/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-pink-600" />
                            Reports & Analytics Setup
                        </CardTitle>
                        <CardDescription>
                            Create SharePoint list for storing generated Performance Reports.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <h4 className="font-semibold flex items-center gap-2">
                                <ListChecks className="h-4 w-4" />
                                Lists to be Created:
                            </h4>
                            <ul className="space-y-2 ml-6 text-sm">
                                <li key="reports">
                                    <div className="font-medium flex items-center gap-2">
                                        <Database className="h-3 w-3 text-pink-500" />
                                        Performance_Reports
                                    </div>
                                    <div className="text-muted-foreground ml-5">
                                        Stores generated reports (JSON content) + Metadata
                                    </div>
                                </li>
                            </ul>
                        </div>

                        <Button
                            onClick={handleSetupReportsList}
                            disabled={isSettingUpReports || isSettingUpLists}
                            className="w-full bg-pink-600 hover:bg-pink-700 text-white"
                            size="lg"
                        >
                            {isSettingUpReports ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Initializing List...
                                </>
                            ) : (
                                <>
                                    <Play className="mr-2 h-4 w-4" />
                                    Initialize Reports List
                                </>
                            )}
                        </Button>

                        <Separator />

                        <div className="space-y-2">
                            <h4 className="font-semibold flex items-center gap-2">
                                <ListChecks className="h-4 w-4" />
                                Report Schedules List:
                            </h4>
                            <ul className="space-y-2 ml-6 text-sm">
                                <li>
                                    <div className="font-medium flex items-center gap-2">
                                        <Database className="h-3 w-3 text-pink-500" />
                                        Report_Schedules
                                    </div>
                                    <div className="text-muted-foreground ml-5">
                                        Per-user report schedule config — period, categories, preferred time/day, active toggle. Power Automate reads this list to send recurring reports.
                                    </div>
                                    <div className="text-muted-foreground ml-5 text-xs mt-1">
                                        Columns: UserEmail, Division, Unit, TimePeriod, Categories (JSON), IsActive, PreferredTime, PreferredDay, PreferredDayOfMonth, LastSentAt, NextSendAt, ManagerEmail
                                    </div>
                                </li>
                            </ul>
                        </div>

                        <Button
                            onClick={handleSetupReportSchedulesList}
                            disabled={isSettingUpReportSchedules || isSettingUpLists}
                            className="w-full bg-pink-700 hover:bg-pink-800 text-white"
                            size="lg"
                        >
                            {isSettingUpReportSchedules ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Initializing Report Schedules...
                                </>
                            ) : (
                                <>
                                    <Play className="mr-2 h-4 w-4" />
                                    Initialize Report Schedules List
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Power Automate Flow Deployment */}
                <Card className="border-2 border-violet-500/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-violet-600" />
                            Power Automate — Report Scheduler (2 Flows)
                        </CardTitle>
                        <CardDescription>
                            Deploys two flows to automation@scpng.gov.pg. Flow 1 (Dispatch) reads due schedules and writes metrics to Google Sheets every 30 min. Google Apps Script calls Gemini AI and marks rows READY. Flow 2 (Send) picks up READY rows, builds the HTML email, and sends via Office 365 — no premium connectors required.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2 text-sm">
                            <div className="font-medium flex items-center gap-2">
                                <ListTree className="h-4 w-4 text-violet-500" />
                                Flow 1 — Dispatch (every 30 min, SharePoint + Google Sheets):
                            </div>
                            <ul className="ml-6 space-y-1 text-muted-foreground text-xs mb-3">
                                <li>1. Read active schedules from SharePoint where NextSendAt &lt;= now</li>
                                <li>2. For each due user: fetch Tasks, KRAs, KPIs, Objectives</li>
                                <li>3. Compute metrics + period label</li>
                                <li>4. Insert PENDING row into Google Sheets AI_Queue</li>
                            </ul>
                            <div className="font-medium flex items-center gap-2">
                                <ListTree className="h-4 w-4 text-violet-500" />
                                Google Apps Script (every 5 min, free):
                            </div>
                            <ul className="ml-6 space-y-1 text-muted-foreground text-xs mb-3">
                                <li>5. Read PENDING rows from AI_Queue</li>
                                <li>6. Call Gemini API for AI summary</li>
                                <li>7. Write AISummary + mark row READY</li>
                            </ul>
                            <div className="font-medium flex items-center gap-2">
                                <ListTree className="h-4 w-4 text-violet-500" />
                                Flow 2 — Send (every 15 min, Google Sheets + Office 365):
                            </div>
                            <ul className="ml-6 space-y-1 text-muted-foreground text-xs">
                                <li>8. Read READY rows from AI_Queue</li>
                                <li>9. Build HTML email with metrics + embedded AI summary</li>
                                <li>10. Send via Office 365 from automation@scpng.gov.pg</li>
                                <li>11. Update NextSendAt in SharePoint + mark row SENT</li>
                            </ul>
                        </div>

                        {flowDeployResult && (
                            <div className={`p-3 rounded-lg border text-sm ${flowDeployResult.success
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : 'bg-red-50 border-red-200 text-red-700'
                            }`}>
                                {flowDeployResult.success ? <CheckCircle className="inline h-4 w-4 mr-1" /> : <AlertCircle className="inline h-4 w-4 mr-1" />}
                                {flowDeployResult.message}
                            </div>
                        )}

                        <div className="flex gap-2 flex-wrap">
                            <Button
                                onClick={handleListConnections}
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                            >
                                <PlugZap className="h-3.5 w-3.5" />
                                Check Connections
                            </Button>
                            <Button
                                onClick={handleListFlows}
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                            >
                                <ListTree className="h-3.5 w-3.5" />
                                List Flows
                            </Button>
                            <Button
                                onClick={handleInspectFlow}
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                            >
                                <Search className="h-3.5 w-3.5" />
                                Inspect Flow
                            </Button>
                            <Button
                                onClick={handleDeleteReportFlow}
                                disabled={isDeletingFlow}
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                            >
                                {isDeletingFlow ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                )}
                                Delete Flow
                            </Button>
                        </div>

                        <Button
                            onClick={handleDeployReportFlow}
                            disabled={isDeployingFlow}
                            className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                            size="lg"
                        >
                            {isDeployingFlow ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deploying Flow...
                                </>
                            ) : (
                                <>
                                    <Zap className="mr-2 h-4 w-4" />
                                    Deploy Both Flows (Dispatch + Send)
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Organizational Units Setup Card */}
                <Card className="border-2 border-cyan-500/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Network className="h-5 w-5 text-cyan-600" />
                            Organizational Hierarchy Setup
                        </CardTitle>
                        <CardDescription>
                            Create Strategy_Divisions and Strategy_Units lists, and seed them with org data.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col gap-4">
                            <Button
                                onClick={handleSetupDivisionsAndUnits}
                                disabled={isSettingUpDivisions || isSeedingDivisions}
                                size="lg"
                                className="w-full bg-cyan-600 hover:bg-cyan-700"
                            >
                                {isSettingUpDivisions ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                        Creating Org Lists...
                                    </>
                                ) : (
                                    <>
                                        <Settings className="h-5 w-5 mr-2" />
                                        Create Divisions & Units Lists
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={handleSeedDivisionsAndUnits}
                                disabled={isSettingUpDivisions || isSeedingDivisions}
                                variant="outline"
                                size="lg"
                                className="w-full gap-2 border-dashed border-cyan-600/50 text-cyan-700 hover:bg-cyan-50"
                            >
                                {isSeedingDivisions ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
                                        Seeding Org Data...
                                    </>
                                ) : (
                                    <>
                                        <Database className="h-5 w-5 text-cyan-600" />
                                        Seed Divisions & Units Data
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-2 border-blue-500/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Layers className="h-5 w-5 text-blue-600" />
                            SharePoint Market Data Setup
                        </CardTitle>
                        <CardDescription>
                            Create lists for Market Data (Companies, Price History, Settings)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* What Gets Created */}
                        <div className="space-y-3">
                            <h3 className="font-semibold flex items-center gap-2">
                                <List className="h-4 w-4" />
                                Lists to be Created:
                            </h3>
                            <div className="grid gap-2 ml-6">
                                <div className="flex items-start gap-2">
                                    <Database className="h-4 w-4 mt-0.5 text-blue-600" />
                                    <div>
                                        <p className="font-medium">Market_Companies</p>
                                        <p className="text-sm text-muted-foreground">Company profiles and current data</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Database className="h-4 w-4 mt-0.5 text-blue-600" />
                                    <div>
                                        <p className="font-medium">Market_PriceHistory</p>
                                        <p className="text-sm text-muted-foreground">Historical price data linked to companies</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Database className="h-4 w-4 mt-0.5 text-blue-600" />
                                    <div>
                                        <p className="font-medium">Market_Settings</p>
                                        <p className="text-sm text-muted-foreground">Configuration settings for the dashboard</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Setup Button */}
                        <div className="flex flex-col gap-4">
                            <Button
                                onClick={handleSetupMarketLists}
                                disabled={isSettingUpLists || isSettingUpOps || isSettingUpMarket}
                                size="lg"
                                className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                            >
                                {isSettingUpMarket ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Creating Market Lists...
                                    </>
                                ) : (
                                    <>
                                        <Settings className="h-5 w-5" />
                                        Create Market Lists
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={handleSeedMarketData}
                                disabled={isSettingUpLists || isSettingUpOps || isSettingUpMarket || isSeedingMarket}
                                size="lg"
                                className="w-full gap-2 bg-green-600 hover:bg-green-700"
                            >
                                {isSeedingMarket ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Seeding Data...
                                    </>
                                ) : (
                                    <>
                                        <Database className="h-5 w-5" />
                                        Seed Market Data
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={async () => {
                                    if (!confirm('Are you sure you want to delete all Market Data lists?')) return;

                                    setIsSettingUpMarket(true);
                                    try {
                                        const graphClient = await getGraphClient(msalInstance);
                                        if (!graphClient) throw new Error('Failed to get Graph client');
                                        const site = await graphClient.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
                                        const setupService = new SharePointListSetupService(graphClient, site.id);
                                        const result = await setupService.deleteMarketDataLists();

                                        if (result.success) {
                                            toast({ title: "✅ Lists Deleted", description: "Market Data lists removed." });
                                            setSetupResult(null);
                                        } else {
                                            throw new Error(result.message);
                                        }
                                    } catch (error: any) {
                                        toast({ title: "❌ Delete Failed", description: error.message, variant: "destructive" });
                                    } finally {
                                        setIsSettingUpMarket(false);
                                    }
                                }}
                                disabled={isSettingUpLists || isSettingUpOps || isSettingUpMarket}
                                variant="outline"
                                size="lg"
                                className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50"
                            >
                                <AlertCircle className="h-5 w-5" />
                                Reset / Delete Market Lists
                            </Button>

                            <Button
                                onClick={async () => {
                                    if (!confirm('Are you sure you want to CLEAR ALL Price History? This will delete all rows in Market_PriceHistory.')) return;

                                    setIsDeletingHistory(true);
                                    try {
                                        toast({ title: "🗑️ Clearing History", description: "Deleting all price history items..." });
                                        await deleteAllPriceHistory();
                                        toast({ title: "✅ History Cleared", description: "All price history items have been deleted." });
                                    } catch (error: any) {
                                        console.error('Delete history failed', error);
                                        toast({ title: "❌ Delete Failed", description: error.message, variant: "destructive" });
                                    } finally {
                                        setIsDeletingHistory(false);
                                    }
                                }}
                                disabled={isSettingUpLists || isSettingUpOps || isSettingUpMarket || isDeletingHistory}
                                variant="destructive"
                                size="lg"
                                className="w-full gap-2"
                            >
                                {isDeletingHistory ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Clearing...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="h-5 w-5" />
                                        Clear Price History Only
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* IT Request Form Test Area */}
                <Card className="border-2 border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Rocket className="h-5 w-5 text-primary" />
                            IT Request Form Test Ground
                        </CardTitle>
                        <CardDescription>
                            Create the dedicated list and test the form submission with independent logic.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col gap-4">
                            <Button
                                onClick={handleSetupITRequestList}
                                disabled={isSettingUpITRequest}
                                size="lg"
                                className="w-full bg-primary hover:bg-primary/90"
                            >
                                {isSettingUpITRequest ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                        Setting up IT Request List...
                                    </>
                                ) : (
                                    <>
                                        <Database className="h-5 w-5 mr-2" />
                                        Step 1: Setup IT_Request_Access_List
                                    </>
                                )}
                            </Button>
                        </div>

                        <Separator className="my-6" />

                        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border-2 border-primary/10 shadow-sm">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <TestTube className="w-5 h-5 text-primary" />
                                Step 2: Live Form Test
                            </h3>
                            <div className="max-h-[600px] overflow-y-auto p-4 border rounded-lg bg-slate-50/50">
                                <FormProvider {...form}>
                                    <FormRenderer
                                        template={itRequestTemplate}
                                        onSubmit={handleITRequestSubmit}
                                        isSubmitting={isSubmittingForm}
                                    />
                                </FormProvider>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Result Display */}
                {setupResult && (
                    <Card className={setupResult.success ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-red-500 bg-red-50 dark:bg-red-950'}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                {setupResult.success ? (
                                    <>
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                        Success!
                                    </>
                                ) : (
                                    <>
                                        <AlertCircle className="h-5 w-5 text-red-600" />
                                        Failed
                                    </>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm">{setupResult.message}</p>
                            {setupResult.details && (
                                <details className="mt-2">
                                    <summary className="text-xs font-semibold cursor-pointer">View Details</summary>
                                    <pre className="text-xs mt-2 p-2 bg-black/10 dark:bg-white/10 rounded overflow-auto max-h-40">
                                        {JSON.stringify(setupResult.details, null, 2)}
                                    </pre>
                                </details>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Instructions Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Instructions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <ol className="list-decimal list-inside space-y-2">
                            <li>Ensure <strong>Strategy Lists</strong> are created first (Step 1).</li>
                            <li>Click "Create Operations Lists" (Step 2).</li>
                            <li>Wait for the process to complete.</li>
                            <li>Check "Site Contents" in SharePoint to verify all lists.</li>
                        </ol>
                    </CardContent>
                </Card>

                {/* UAT Feedback List Setup */}
                <Card className="border-2 border-intranet-primary/30 bg-gradient-to-br from-white to-intranet-primary/5 dark:from-gray-900 dark:to-intranet-primary/10">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-xl flex items-center gap-2 text-intranet-primary">
                                    <MessageSquarePlus className="h-6 w-6" />
                                    UAT Feedback List Setup
                                </CardTitle>
                                <CardDescription className="mt-1">
                                    Creates the <strong>UAT_Feedback</strong> SharePoint list used to store staff feedback during testing.
                                    File attachments are uploaded to the <strong>Asset Images/FeedBackFiles</strong> folder.
                                </CardDescription>
                            </div>
                            <Badge className="bg-intranet-primary text-white shrink-0">UAT</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-muted/50 rounded-lg border p-4 space-y-2 text-sm">
                            <p className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">Columns created</p>
                            <div className="grid grid-cols-2 gap-1.5 text-muted-foreground">
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> Title (Page Name)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> PageRoute (text)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> UserName (text)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> UserEmail (text)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> Rating (number 1–5)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> Category (choice)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> Comment (multiline text)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> Status (choice)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> AttachmentUrl (short text)</span>
                            </div>
                        </div>

                        <Button
                            onClick={handleCreateUATFeedbackList}
                            disabled={isCreatingFeedbackList}
                            size="lg"
                            className="w-full gap-2 bg-intranet-primary hover:bg-intranet-secondary"
                        >
                            {isCreatingFeedbackList ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Creating List...
                                </>
                            ) : (
                                <>
                                    <Database className="h-5 w-5" />
                                    Create UAT_Feedback List
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Division WorkPlans List Setup */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Database className="h-5 w-5" />
                            Division WorkPlans List Setup
                        </CardTitle>
                        <CardDescription>
                            Creates the <code>Division_WorkPlans</code> SharePoint list with all required columns for persisting work plans and linking them to Objectives/KRAs/KPIs.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-muted rounded-lg p-3">
                            <p className="text-sm font-medium mb-2">Columns to be created:</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> Title (built-in)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> Description (multiline)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> DivisionId (text)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> DivisionName (text)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> Status (choice)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> TimePeriod (choice)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> Year (number)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> StartDate / EndDate</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> GoalsJSON (multiline)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> LinkedStrategicObjectiveId</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> Organization / PreparedBy</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> Mandate (multiline)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> MonitoringAndReporting</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> OverallProgress (number)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> CreatedByName / Email</span>
                            </div>
                        </div>

                        <Button
                            onClick={handleCreateWorkPlansList}
                            disabled={isCreatingWorkPlansList}
                            size="lg"
                            className="w-full gap-2 bg-intranet-primary hover:bg-intranet-secondary"
                        >
                            {isCreatingWorkPlansList ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Creating List...
                                </>
                            ) : (
                                <>
                                    <Database className="h-5 w-5" />
                                    Create Division_WorkPlans List
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* System Notifications List Setup */}
                <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-white to-amber-50/50 dark:from-gray-900 dark:to-amber-950/10">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-xl flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                    <Bell className="h-6 w-6" />
                                    System Notifications List Setup
                                </CardTitle>
                                <CardDescription className="mt-1">
                                    Creates the <strong>System_Notifications</strong> SharePoint list used by Power Automate to push notifications to users. The bell icon in the header reads from this list.
                                </CardDescription>
                            </div>
                            <Badge className="bg-amber-600 text-white shrink-0">Notifications</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-muted/50 rounded-lg border p-4 space-y-2 text-sm">
                            <p className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">Columns created</p>
                            <div className="grid grid-cols-2 gap-1.5 text-muted-foreground">
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> Title (built-in)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> Message (multiline)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> RecipientEmail (text)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> Type (text)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> Category (text)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> ActionUrl (text)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> IsRead (boolean)</span>
                                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-500" /> CreatedBy_Custom (text)</span>
                            </div>
                        </div>

                        <Button
                            onClick={handleCreateNotificationsList}
                            disabled={isCreatingNotificationsList}
                            size="lg"
                            className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
                        >
                            {isCreatingNotificationsList ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Creating List...
                                </>
                            ) : (
                                <>
                                    <Database className="h-5 w-5" />
                                    Create System_Notifications List
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                <Separator className="my-8" />

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Database className="h-6 w-6 text-intranet-primary" />
                            SharePoint Explorer
                        </h2>
                        <Badge variant="outline">Preview Feature</Badge>
                    </div>
                    <p className="text-muted-foreground">
                        Directly manage SharePoint lists, columns, and data from this interface.
                    </p>
                    <SharePointExplorer />
                </div>
            </div>
        </PageLayout>
    );
};

export default TestGround;
