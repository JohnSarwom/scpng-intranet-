import React, { useState } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { useMsal } from '@azure/msal-react';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { SharePointListSetupService } from '@/services/sharePointListSetupService';
import { SharePointOpsService } from '@/services/sharePointOpsService';
import { AnnouncementsSharePointService } from '@/services/announcementsSharePointService';
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
    Network
} from "lucide-react";
import { SharePointExplorer } from '@/components/admin/SharePointExplorer';
import { deleteAllPriceHistory } from '@/services/marketDataSharePointService';
import { generateAllMockData, StaffMember } from '@/data/mockPerformanceDataGenerator';
import { mockStrategyData } from '@/mockData/strategyData';
import { Kra, Kpi, Task } from '@/types';

const TestGround = () => {
    const { toast } = useToast();
    const { instance: msalInstance } = useMsal();
    const { user: roleUser } = useRoleBasedAuth();
    const [isSettingUpOps, setIsSettingUpOps] = useState(false);
    const [isSettingUpLists, setIsSettingUpLists] = useState(false);
    const [isSettingUpStrategyHub, setIsSettingUpStrategyHub] = useState(false);
    const [setupResult, setSetupResult] = useState<any>(null);
    const [isSettingUpAnnouncements, setIsSettingUpAnnouncements] = useState(false);
    const [isPurgingOps, setIsPurgingOps] = useState(false);
    const [isSeedingOfficers, setIsSeedingOfficers] = useState(false);
    const [isSettingUpOrgHierarchy, setIsSettingUpOrgHierarchy] = useState(false);
    const [isSettingUpTaskGroups, setIsSettingUpTaskGroups] = useState(false);

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

                {/* Enterprise Strategy Hub Setup Card (NEW) */}
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
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Strategic Pillars (4 Pillars)</li>
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

                {/* App Settings List Setup Card */}\n                {/* App Settings List Setup Card */}\n
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
        </PageLayout >
    );
};

export default TestGround;
