import React, { useState, useEffect, useMemo } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Settings, Loader2, Eye, RefreshCw, PlusCircle, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { SharePointOpsService } from '@/services/sharePointOpsService';
import { SharePointListSetupService } from '@/services/sharePointListSetupService';
import {
    RoleKey,
    useComponentVisibilityAdmin,
} from '@/hooks/useComponentVisibility';

// Define the configuration types
export type ViewScope = 'All' | 'Division' | 'Unit' | 'Individual';

export interface ViewConfig {
    id: string;
    page: string;
    component: string;
    scope: ViewScope;
    description: string;
}

const ROLE_COLUMNS: { key: RoleKey; label: string }[] = [
    { key: 'manager', label: 'Manager' },
    { key: 'staff_member', label: 'Staff Member' },
];

const EMPTY_FORM = { page: '', component: '', description: '', manager: false, staff_member: false };

export const ViewSettingsTab = () => {
    const { toast } = useToast();
    const { instance } = useMsal();

    // ── Component Visibility (SharePoint-backed) ─────────────────────────────
    const {
        settings: visibilitySettings,
        loading: visibilityLoading,
        initializing,
        updateSetting,
        addSetting,
        deleteSetting,
        initializeList,
        refresh,
    } = useComponentVisibilityAdmin();

    const [showAddForm, setShowAddForm] = useState(false);
    const [addForm, setAddForm] = useState(EMPTY_FORM);
    const [addSaving, setAddSaving] = useState(false);
    const [selectedPage, setSelectedPage] = useState<string>('All');

    const pageNames = useMemo(() => {
        const pages = [...new Set(visibilitySettings.map(s => s.page))];
        return ['All', ...pages];
    }, [visibilitySettings]);

    const filteredSettings = useMemo(() =>
        selectedPage === 'All'
            ? visibilitySettings
            : visibilitySettings.filter(s => s.page === selectedPage),
        [visibilitySettings, selectedPage]
    );

    const handleToggle = async (settingId: string, role: RoleKey, checked: boolean) => {
        try {
            await updateSetting(settingId, role, checked);
            toast({ title: "Saved", description: `Visibility updated.` });
        } catch {
            toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
        }
    };

    const handleDelete = async (settingId: string, component: string) => {
        if (!settingId) return;
        try {
            await deleteSetting(settingId);
            toast({ title: "Deleted", description: `${component} removed from the registry.` });
        } catch {
            toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
        }
    };

    const handleAddSubmit = async () => {
        if (!addForm.page.trim() || !addForm.component.trim()) {
            toast({ title: "Required", description: "Page and Component are required.", variant: "destructive" });
            return;
        }
        setAddSaving(true);
        try {
            const visibleTo: RoleKey[] = ['admin', 'super_admin'];
            if (addForm.manager) visibleTo.push('manager');
            if (addForm.staff_member) visibleTo.push('staff_member');

            await addSetting({
                settingKey: `${addForm.page.toLowerCase().replace(/\s+/g, '-')}-${addForm.component.toLowerCase().replace(/\s+/g, '-')}`,
                page: addForm.page.trim(),
                component: addForm.component.trim(),
                description: addForm.description.trim(),
                visibleTo,
            });
            setAddForm(EMPTY_FORM);
            setShowAddForm(false);
            toast({ title: "Added", description: `${addForm.component} added to registry.` });
        } catch {
            toast({ title: "Error", description: "Failed to add component.", variant: "destructive" });
        } finally {
            setAddSaving(false);
        }
    };

    const handleInitializeVisibilityList = async () => {
        try {
            await initializeList();
            toast({ title: "Success", description: "Component Visibility list created in SharePoint." });
        } catch (e: any) {
            toast({ title: "Failed", description: e.message, variant: "destructive" });
        }
    };

    // ── Data Scope Settings (existing) ───────────────────────────────────────
    const [configs, setConfigs] = useState<ViewConfig[]>([]);
    const [loading, setLoading] = useState(false);
    const [initializingScope, setInitializingScope] = useState(false);

    const getOpsService = async () => {
        const client = await getGraphClient(instance);
        if (!client) throw new Error("Graph Client unavailable");
        const service = new SharePointOpsService(client);
        await service.initialize();
        return service;
    };

    const loadScopeSettings = async () => {
        setLoading(true);
        try {
            const service = await getOpsService();
            const data = await service.getViewSettings();
            setConfigs(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadScopeSettings(); }, []);

    const handleScopeSelect = (id: string, component: string, newScope: ViewScope) => {
        setConfigs(prev => prev.map(c => c.id === id ? { ...c, scope: newScope } : c));
        (async () => {
            try {
                const service = await getOpsService();
                await service.updateViewSetting(component, newScope);
                toast({ title: "Saved", description: `${component} updated to ${newScope}` });
            } catch {
                toast({ title: "Error", description: "Failed to save setting.", variant: "destructive" });
            }
        })();
    };

    const handleInitializeScopeList = async () => {
        setInitializingScope(true);
        try {
            const client = await getGraphClient(instance);
            if (!client) return;
            const site = await client.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const setup = new SharePointListSetupService(client, site.id);
            await setup.createViewSettingsList();
            toast({ title: "Success", description: "View Settings list created and populated." });
            loadScopeSettings();
        } catch (e: any) {
            toast({ title: "Initialization Failed", description: e.message, variant: "destructive" });
        } finally {
            setInitializingScope(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* ── Component Visibility by Role ─────────────────────────────── */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Component Visibility by Role</CardTitle>
                        <CardDescription>
                            Control which page sections are visible to Managers and Staff.
                            Admins always see everything. Changes save instantly to SharePoint.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => setShowAddForm(v => !v)} variant="outline" size="sm">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Component
                        </Button>
                        <Button onClick={refresh} variant="outline" size="sm" disabled={visibilityLoading}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${visibilityLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button onClick={handleInitializeVisibilityList} variant="outline" size="sm" disabled={initializing}>
                            {initializing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings className="mr-2 h-4 w-4" />}
                            Initialize List
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Add Component inline form */}
                    {showAddForm && (
                        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                            <p className="text-sm font-medium">Register a new component</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <Input
                                    placeholder="Page name (e.g. Strategy)"
                                    value={addForm.page}
                                    onChange={e => setAddForm(f => ({ ...f, page: e.target.value }))}
                                />
                                <Input
                                    placeholder="Component name (e.g. Reports Tab)"
                                    value={addForm.component}
                                    onChange={e => setAddForm(f => ({ ...f, component: e.target.value }))}
                                />
                                <Input
                                    placeholder="Description (optional)"
                                    value={addForm.description}
                                    onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                                />
                            </div>
                            <div className="flex items-center gap-6">
                                <span className="text-sm text-muted-foreground">Also visible to:</span>
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <Checkbox
                                        checked={addForm.manager}
                                        onCheckedChange={v => setAddForm(f => ({ ...f, manager: !!v }))}
                                    />
                                    Manager
                                </label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <Checkbox
                                        checked={addForm.staff_member}
                                        onCheckedChange={v => setAddForm(f => ({ ...f, staff_member: !!v }))}
                                    />
                                    Staff Member
                                </label>
                                <div className="ml-auto flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => { setShowAddForm(false); setAddForm(EMPTY_FORM); }}>
                                        Cancel
                                    </Button>
                                    <Button size="sm" onClick={handleAddSubmit} disabled={addSaving}>
                                        {addSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Save
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Page filter tabs */}
                    {visibilitySettings.length > 0 && (
                        <div className="flex flex-wrap gap-1 border-b pb-3">
                            {pageNames.map(page => (
                                <button
                                    key={page}
                                    onClick={() => setSelectedPage(page)}
                                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                                        selectedPage === page
                                            ? 'bg-primary text-primary-foreground font-medium'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                                >
                                    {page}
                                    {page !== 'All' && (
                                        <span className={`ml-1.5 text-xs ${selectedPage === page ? 'opacity-75' : 'opacity-50'}`}>
                                            ({visibilitySettings.filter(s => s.page === page).length})
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {visibilityLoading && visibilitySettings.length === 0 ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : visibilitySettings.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No settings found. Click "Initialize List" to create the SharePoint list and seed defaults.
                        </div>
                    ) : (
                        <div className={`relative transition-opacity ${visibilityLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                        {visibilityLoading && (
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                <div className="flex items-center gap-2 bg-background/80 px-3 py-1.5 rounded-md text-sm text-muted-foreground">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Loading from SharePoint…
                                </div>
                            </div>
                        )}
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {selectedPage === 'All' && <TableHead>Page</TableHead>}
                                    <TableHead>Component</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-center">
                                        Admin
                                        <div className="text-xs text-muted-foreground font-normal">(always on)</div>
                                    </TableHead>
                                    {ROLE_COLUMNS.map(col => (
                                        <TableHead key={col.key} className="text-center">{col.label}</TableHead>
                                    ))}
                                    <TableHead className="w-10" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredSettings.map(setting => (
                                    <TableRow key={setting.id || setting.settingKey}>
                                        {selectedPage === 'All' && (
                                            <TableCell>
                                                <Badge variant="outline">{setting.page}</Badge>
                                            </TableCell>
                                        )}
                                        <TableCell className="font-medium">{setting.component}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{setting.description}</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex justify-center">
                                                <Checkbox checked disabled />
                                            </div>
                                        </TableCell>
                                        {ROLE_COLUMNS.map(col => (
                                            <TableCell key={col.key} className="text-center">
                                                <div className="flex justify-center">
                                                    <Checkbox
                                                        checked={setting.visibleTo.includes(col.key)}
                                                        onCheckedChange={(checked) =>
                                                            setting.id && handleToggle(setting.id, col.key, !!checked)
                                                        }
                                                        disabled={!setting.id}
                                                    />
                                                </div>
                                            </TableCell>
                                        ))}
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                onClick={() => handleDelete(setting.id, setting.component)}
                                                disabled={!setting.id}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        Settings are stored in SharePoint and apply to all users.
                        If the list does not exist yet, click "Initialize List" once.
                    </p>
                </CardContent>
            </Card>

            {/* ── Data Scope / View Filtering ──────────────────────────────── */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>View Settings & Data Filtering</CardTitle>
                        <CardDescription>
                            Configure how data is filtered for users. Define default visibility scopes.
                        </CardDescription>
                    </div>
                    <Button onClick={handleInitializeScopeList} disabled={initializingScope} variant="outline" size="sm">
                        {initializingScope ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings className="mr-2 h-4 w-4" />}
                        Initialize Settings List
                    </Button>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : configs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No settings found. Click "Initialize Settings List" to start.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Page</TableHead>
                                    <TableHead>Component</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Visibility Scope</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {configs.map((config) => (
                                    <TableRow key={config.id}>
                                        <TableCell>{config.page}</TableCell>
                                        <TableCell className="font-medium">{config.component}</TableCell>
                                        <TableCell className="text-muted-foreground">{config.description}</TableCell>
                                        <TableCell>
                                            <Select
                                                value={config.scope}
                                                onValueChange={(val: ViewScope) => handleScopeSelect(config.id, config.component, val)}
                                            >
                                                <SelectTrigger className="w-[180px]">
                                                    <SelectValue placeholder="Select scope" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="All">All Data (No Filter)</SelectItem>
                                                    <SelectItem value="Division">My Division Only</SelectItem>
                                                    <SelectItem value="Unit">My Unit Only</SelectItem>
                                                    <SelectItem value="Individual">Assigned to Me Only</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
