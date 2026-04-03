import React, { useState } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, Eye, PlusCircle, Building2, User, Crown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
    RoleKey,
    useComponentVisibilityAdmin,
} from '@/hooks/useComponentVisibility';

const ASSET_BUTTON_SETTING_KEY = 'assets-add-button';

const VISIBILITY_RULES = [
    {
        role: 'Admin / Super Admin',
        icon: Crown,
        badge: 'bg-purple-100 text-purple-800 border-purple-200',
        description: 'Sees all assets across the entire organisation.',
    },
    {
        role: 'Manager',
        icon: Building2,
        badge: 'bg-orange-100 text-orange-800 border-orange-200',
        description: 'Sees all assets that belong to their assigned Division or Unit.',
    },
    {
        role: 'Staff Member',
        icon: User,
        badge: 'bg-green-100 text-green-800 border-green-200',
        description: 'Sees only assets that are directly assigned to them.',
    },
];

const ADD_ROLES: { key: RoleKey; label: string; description: string }[] = [
    {
        key: 'manager',
        label: 'Manager',
        description: 'Allow managers to register new assets in the Asset Registry.',
    },
    {
        key: 'staff_member',
        label: 'Staff Member',
        description: 'Allow regular staff to register new assets in the Asset Registry.',
    },
];

export const AssetPermissionsTab = () => {
    const { toast } = useToast();
    const { settings, loading, updateSetting } = useComponentVisibilityAdmin();
    const [saving, setSaving] = useState<RoleKey | null>(null);

    const addButtonSetting = settings.find(s => s.settingKey === ASSET_BUTTON_SETTING_KEY);

    const handleToggle = async (role: RoleKey, enabled: boolean) => {
        if (!addButtonSetting?.id) {
            toast({
                title: 'Setting not found',
                description: 'Asset visibility setting is not initialised in SharePoint. Go to View Settings and initialise the list first.',
                variant: 'destructive',
            });
            return;
        }

        setSaving(role);
        try {
            await updateSetting(addButtonSetting.id, role, enabled);
            toast({
                title: 'Permission updated',
                description: `${role === 'manager' ? 'Managers' : 'Staff members'} can now ${enabled ? 'add' : 'no longer add'} assets.`,
            });
        } catch {
            toast({
                title: 'Save failed',
                description: 'Could not update the permission in SharePoint. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setSaving(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-xl font-semibold">Asset Registry Permissions</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Control who can view and register assets. Admins always have full access.
                </p>
            </div>

            {/* Visibility Rules */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base">Asset Visibility Rules</CardTitle>
                    </div>
                    <CardDescription>
                        These rules determine which assets each role can see when they open the Asset Registry.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="divide-y">
                        {VISIBILITY_RULES.map(({ role, icon: Icon, badge, description }) => (
                            <div key={role} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                                <div className="mt-0.5">
                                    <Icon className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="outline" className={badge}>{role}</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Add Asset Permission */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <PlusCircle className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base">Add Asset Permission</CardTitle>
                    </div>
                    <CardDescription>
                        Choose which roles can register new assets. The "Add Asset" button will appear on the Asset Registry page for enabled roles.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading permissions...
                        </div>
                    ) : (
                        <div className="divide-y">
                            {ADD_ROLES.map(({ key, label, description }) => {
                                const isEnabled = addButtonSetting?.visibleTo.includes(key) ?? false;
                                const isSaving = saving === key;

                                return (
                                    <div key={key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-sm font-medium">{label}</span>
                                                {isEnabled ? (
                                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Enabled</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-xs">Disabled</Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">{description}</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                            <Switch
                                                checked={isEnabled}
                                                disabled={isSaving || !addButtonSetting?.id}
                                                onCheckedChange={(checked) => handleToggle(key, checked)}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {!loading && !addButtonSetting?.id && (
                        <p className="text-xs text-amber-600 mt-3">
                            The ComponentVisibility list has not been initialised in SharePoint yet. Go to the <strong>View Settings</strong> tab and click "Initialise List" first.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Info */}
            <Card className="border-dashed">
                <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-sm text-muted-foreground">
                            Admins and Super Admins always have full access — these toggles only affect Manager and Staff Member roles.
                            Changes are saved to SharePoint and take effect for users within 5 minutes (cache TTL).
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AssetPermissionsTab;
