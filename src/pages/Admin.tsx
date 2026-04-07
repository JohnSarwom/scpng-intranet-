
import React, { useState, useEffect, useRef } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '@/components/ui/tabs';
import {
    Users,
    Shield,
    Palette,
    Target,
    Activity,
    Globe,
    LayoutDashboard,
    Building2,
    MessageSquareText,
    Package,
    FileText
} from 'lucide-react';
import UserManagement from '@/components/admin/UserManagement';
import RoleManagement from '@/components/admin/RoleManagement';
import ThemeCustomization from '@/components/admin/ThemeCustomization';

import ApiManagement from '@/components/admin/ApiManagement';
import { ViewSettingsTab } from '@/components/admin/ViewSettingsTab';
import OrgStructureManagement from '@/components/admin/OrgStructureManagement';
import { UATFeedbackTab } from '@/components/admin/UATFeedbackTab';
import AssetPermissionsTab from '@/components/admin/AssetPermissionsTab';
import DocumentPermissionsTab from '@/components/admin/DocumentPermissionsTab';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { UserSharePointService, UserRole, PermissionGroup } from '@/services/userSharePointService';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';

const Admin = () => {
    const { hasPermission, isAdmin, loading: authLoading } = useRoleBasedAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const initialTab = searchParams.get('tab') || 'users';
    const [activeTab, setActiveTab] = useState(initialTab);

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        setSearchParams({ tab: value });
    };
    const { instance } = useMsal();

    // SharePoint Data State
    const [users, setUsers] = useState<UserRole[]>([]);
    const [groups, setGroups] = useState<PermissionGroup[]>([]);
    const [loading, setLoading] = useState(true);

    // Initialize Service — cached so initialization (siteId, listId, column names) runs once
    const serviceRef = useRef<UserSharePointService | null>(null);
    const getService = async (): Promise<UserSharePointService> => {
        if (!serviceRef.current) {
            const client = await getGraphClient(instance);
            if (!client) throw new Error("Failed to initialize Graph Client");
            serviceRef.current = new UserSharePointService(client);
        }
        return serviceRef.current;
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const service = await getService();
            const [fetchedUsers, fetchedGroups] = await Promise.all([
                service.getUsers(),
                service.getGroups()
            ]);
            setUsers(fetchedUsers);
            setGroups(fetchedGroups);
        } catch (error) {
            console.error("Failed to fetch admin data", error);
            toast.error("Failed to load admin data from SharePoint");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && (isAdmin || hasPermission('admin', 'access'))) {
            fetchData();
        }
    }, [isAdmin, authLoading]);

    // User Handlers
    const handleAddUser = async (user: Partial<UserRole>) => {
        const service = await getService();
        await service.addUser(user);
        await fetchData(); // Refresh list
    };

    const handleUpdateUser = async (email: string, updates: Partial<UserRole>) => {
        const service = await getService();
        await service.updateUser(email, updates);
        await fetchData();
    };

    const handleDeleteUser = async (email: string) => {
        const service = await getService();
        await service.deleteUser(email);
        await fetchData();
    };

    // Group Handlers — use optimistic updates to avoid SharePoint eventual-consistency lag
    const handleCreateGroup = async (group: PermissionGroup) => {
        const service = await getService();
        const created = await service.createGroup(group);
        setGroups(prev => [...prev, created]);
    };

    const handleUpdateGroup = async (group: PermissionGroup) => {
        const service = await getService();
        const oldGroup = groups.find(g => g.id === group.id);
        
        await service.updateGroup(group);
        setGroups(prev => prev.map(g => g.id === group.id ? group : g));

        // Sync old group name to new group name for users
        if (oldGroup && oldGroup.title !== group.title) {
            const usersToUpdate = users.filter(u => (u.groups || []).includes(oldGroup.title));
            for (const u of usersToUpdate) {
                const newGroups = u.groups!.map(g => g === oldGroup.title ? group.title : g);
                await handleUpdateUser(u.user_email, { groups: newGroups });
            }
        }
    };

    const handleDeleteGroup = async (groupId: string) => {
        const service = await getService();
        const deletedGroup = groups.find(g => g.id === groupId);
        
        await service.deleteGroup(groupId);
        setGroups(prev => prev.filter(g => g.id !== groupId));

        // Unassign deleted group from users
        if (deletedGroup) {
            const usersToUpdate = users.filter(u => (u.groups || []).includes(deletedGroup.title));
            for (const u of usersToUpdate) {
                const newGroups = u.groups!.filter(g => g !== deletedGroup.title);
                await handleUpdateUser(u.user_email, { groups: newGroups });
            }
        }
    };


    // Simple permission check - in a real app this would be more granular per tab
    if (!isAdmin && !hasPermission('admin', 'access')) {
        return (
            <PageLayout>
                <div className="p-6">
                    <Alert variant="destructive">
                        <Shield className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>
                            You do not have permission to access the admin dashboard.
                        </AlertDescription>
                    </Alert>
                </div>
            </PageLayout>
        );
    }

    return (
        <PageLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                        <p className="text-muted-foreground">
                            Manage users, roles, system settings, and organizational strategy.
                        </p>
                    </div>
                    {/* Refresh Button or Status Indicator could go here */}
                </div>

                <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
                    <TabsList className="grid w-full grid-cols-2 lg:grid-cols-9 h-auto">
                        <TabsTrigger value="users" className="py-2">
                            <Users className="mr-2 h-4 w-4" />
                            Users
                        </TabsTrigger>
                        <TabsTrigger value="roles" className="py-2">
                            <Shield className="mr-2 h-4 w-4" />
                            Roles & Groups
                        </TabsTrigger>
                        <TabsTrigger value="theme" className="py-2">
                            <Palette className="mr-2 h-4 w-4" />
                            Theme
                        </TabsTrigger>

                        <TabsTrigger value="api" className="py-2">
                            <Activity className="mr-2 h-4 w-4" />
                            API & Integrations
                        </TabsTrigger>
                        <TabsTrigger value="org-structure" className="py-2">
                            <Building2 className="mr-2 h-4 w-4" />
                            Org Structure
                        </TabsTrigger>
                        <TabsTrigger value="view-settings" className="py-2">
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            View Settings
                        </TabsTrigger>
                        <TabsTrigger value="asset-permissions" className="py-2">
                            <Package className="mr-2 h-4 w-4" />
                            Asset Permissions
                        </TabsTrigger>
                        <TabsTrigger value="doc-permissions" className="py-2">
                            <FileText className="mr-2 h-4 w-4" />
                            Doc Permissions
                        </TabsTrigger>
                        <TabsTrigger value="uat-feedback" className="py-2">
                            <MessageSquareText className="mr-2 h-4 w-4" />
                            UAT Feedback
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="users" className="space-y-4">
                        <UserManagement
                            users={users}
                            availableGroups={groups}
                            onAddUser={handleAddUser}
                            onUpdateUser={handleUpdateUser}
                            onDeleteUser={handleDeleteUser}
                            // Password/Email config not supported by SharePoint list directly, optional or unimplemented
                            onGeneratePassword={() => toast.info("Password management is handled via Entra ID/Active Directory")}
                            onConfigureEmail={() => toast.info("Email checks depend on Entra ID")}
                        />
                    </TabsContent>

                    <TabsContent value="roles" className="space-y-4">
                        <RoleManagement
                            groups={groups}
                            onCreateGroup={handleCreateGroup}
                            onUpdateGroup={handleUpdateGroup}
                            onDeleteGroup={handleDeleteGroup}
                        />
                    </TabsContent>

                    <TabsContent value="theme" className="space-y-4">
                        <ThemeCustomization />
                    </TabsContent>



                    <TabsContent value="api" className="space-y-4">
                        <ApiManagement />
                    </TabsContent>

                    <TabsContent value="org-structure" className="space-y-4">
                        <OrgStructureManagement />
                    </TabsContent>

                    <TabsContent value="view-settings" className="space-y-4">
                        <ViewSettingsTab />
                    </TabsContent>

                    <TabsContent value="asset-permissions" className="space-y-4">
                        <AssetPermissionsTab />
                    </TabsContent>

                    <TabsContent value="doc-permissions" className="space-y-4">
                        <DocumentPermissionsTab
                            users={users}
                            onUpdateUser={handleUpdateUser}
                        />
                    </TabsContent>

                    <TabsContent value="uat-feedback" className="space-y-4">
                        <UATFeedbackTab />
                    </TabsContent>
                </Tabs>
            </div>
        </PageLayout>
    );
};

export default Admin;
