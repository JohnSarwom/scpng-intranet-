import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Trash, UserPlus, Save, X, Loader2, Link } from 'lucide-react';
import { toast } from 'sonner';
import { OfficerProfile } from '@/components/strategy/OfficerProfileModal';
import { useOfficerProfiles } from '@/hooks/useOfficerProfiles';
import { OfficerProfileService } from '@/services/officerProfileService';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { useQueryClient } from '@tanstack/react-query';

const OrgStructureManagement = () => {
    const { instance } = useMsal();
    const queryClient = useQueryClient();
    const { data: profiles = [], isLoading: isFetchingProfiles, error } = useOfficerProfiles();

    const [editingProfile, setEditingProfile] = useState<Partial<OfficerProfile> | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const getService = async () => {
        const client = await getGraphClient(instance);
        if (!client) throw new Error("Failed to initialize Graph Client");
        return new OfficerProfileService(client);
    };

    const handleEdit = (profile: OfficerProfile) => {
        setEditingProfile({ ...profile });
    };

    const handleAdd = () => {
        setEditingProfile({
            name: '',
            jobTitle: '',
            email: '',
            phone: '',
            employeeId: '',
            joinedDate: new Date().getFullYear().toString(),
            division: '',
            unit: '',
            summary: '',
            skills: [],
            reportsTo: null,
            directReports: 0,
            officeExtension: '',
            timezone: 'PGT (GMT+10)',
            statutoryDuty: '',
            profileImageUrl: ''
        });
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete the profile for ${name}?`)) return;
        setIsProcessing(true);
        try {
            const service = await getService();
            await service.deleteProfile(id);
            toast.success(`Profile for ${name} deleted successfully`);
            queryClient.invalidateQueries({ queryKey: ["officerProfiles"] });
        } catch (error) {
            console.error("Failed to delete profile", error);
            toast.error("Failed to delete profile");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSave = async () => {
        if (!editingProfile?.name || !editingProfile?.jobTitle) {
            toast.error("Name and Job Title are required fields");
            return;
        }

        setIsProcessing(true);
        try {
            const service = await getService();
            if (editingProfile.id) {
                // Update
                await service.updateProfile(editingProfile.id, editingProfile);
                toast.success('Profile updated successfully');
            } else {
                // Add
                await service.addProfile(editingProfile);
                toast.success('Profile created successfully');
            }
            setEditingProfile(null);
            queryClient.invalidateQueries({ queryKey: ["officerProfiles"] });
        } catch (error) {
            console.error("Failed to save profile", error);
            toast.error("Failed to save profile changes");
        } finally {
            setIsProcessing(false);
        }
    };

    const updateField = (field: keyof OfficerProfile, value: any) => {
        setEditingProfile(prev => prev ? { ...prev, [field]: value } : null);
    };

    const renderProfileForm = () => {
        if (!editingProfile) return null;
        return (
            <div className="w-full">
                <h3 className="text-lg font-medium mb-3">{editingProfile.id ? 'Edit Officer Profile' : 'Add New Officer'}</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-1">
                        <Label>Full Name *</Label>
                        <Input value={editingProfile.name || ''} onChange={e => updateField('name', e.target.value)} disabled={isProcessing} placeholder="e.g. James Joshua" />
                    </div>
                    <div className="space-y-1">
                        <Label>Job Title *</Label>
                        <Input value={editingProfile.jobTitle || ''} onChange={e => updateField('jobTitle', e.target.value)} disabled={isProcessing} placeholder="e.g. Acting CEO" />
                    </div>
                    <div className="space-y-1">
                        <Label>Employee ID</Label>
                        <Input value={editingProfile.employeeId || ''} onChange={e => updateField('employeeId', e.target.value)} disabled={isProcessing} placeholder="e.g. #EMP-1001" />
                    </div>

                    <div className="space-y-1">
                        <Label>Email</Label>
                        <Input type="email" value={editingProfile.email || ''} onChange={e => updateField('email', e.target.value)} disabled={isProcessing} />
                    </div>
                    <div className="space-y-1">
                        <Label>Phone / Mobile</Label>
                        <Input value={editingProfile.phone || ''} onChange={e => updateField('phone', e.target.value)} disabled={isProcessing} />
                    </div>
                    <div className="space-y-1">
                        <Label>Office Extension</Label>
                        <Input value={editingProfile.officeExtension || ''} onChange={e => updateField('officeExtension', e.target.value)} disabled={isProcessing} />
                    </div>

                    <div className="space-y-1">
                        <Label>Division</Label>
                        <Input value={editingProfile.division || ''} onChange={e => updateField('division', e.target.value)} disabled={isProcessing} />
                    </div>
                    <div className="space-y-1">
                        <Label>Unit</Label>
                        <Input value={editingProfile.unit || ''} onChange={e => updateField('unit', e.target.value)} disabled={isProcessing} />
                    </div>
                    <div className="space-y-1">
                        <Label>Joined Date</Label>
                        <Input value={editingProfile.joinedDate || ''} onChange={e => updateField('joinedDate', e.target.value)} disabled={isProcessing} placeholder="e.g. Jan 2015" />
                    </div>

                    <div className="space-y-1">
                        <Label>Reports To Name</Label>
                        <Input
                            value={editingProfile.reportsTo?.name || ''}
                            onChange={e => updateField('reportsTo', { ...editingProfile.reportsTo, name: e.target.value, title: editingProfile.reportsTo?.title || '' })}
                            disabled={isProcessing}
                            placeholder="e.g. Board of Commission"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Reports To Title</Label>
                        <Input
                            value={editingProfile.reportsTo?.title || ''}
                            onChange={e => updateField('reportsTo', { ...editingProfile.reportsTo, name: editingProfile.reportsTo?.name || '', title: e.target.value })}
                            disabled={isProcessing}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Direct Reports (Count)</Label>
                        <Input
                            type="number"
                            value={editingProfile.directReports || 0}
                            onChange={e => updateField('directReports', parseInt(e.target.value) || 0)}
                            disabled={isProcessing}
                        />
                    </div>

                    <div className="space-y-1 lg:col-span-3">
                        <Label>Skills (Comma-separated)</Label>
                        <Input
                            value={editingProfile.skills?.join(', ') || ''}
                            onChange={e => updateField('skills', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                            disabled={isProcessing}
                            placeholder="e.g. Executive Leadership, Strategic Planning"
                        />
                    </div>

                    <div className="space-y-1 lg:col-span-3">
                        <Label>Profile Image URL</Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Link className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                                <Input
                                    className="pl-9"
                                    value={editingProfile.profileImageUrl || ''}
                                    onChange={e => updateField('profileImageUrl', e.target.value)}
                                    disabled={isProcessing}
                                    placeholder="https://..."
                                />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">Provide an absolute URL, or if using SharePoint photos, refer to the documentation on employeePhotosService.</p>
                    </div>

                    <div className="space-y-1 lg:col-span-3">
                        <Label>Professional Summary</Label>
                        <Textarea
                            value={editingProfile.summary || ''}
                            onChange={e => updateField('summary', e.target.value)}
                            disabled={isProcessing}
                            rows={3}
                        />
                    </div>

                    <div className="space-y-1 lg:col-span-3">
                        <Label>Statutory Duty</Label>
                        <Textarea
                            value={editingProfile.statutoryDuty || ''}
                            onChange={e => updateField('statutoryDuty', e.target.value)}
                            disabled={isProcessing}
                            rows={4}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditingProfile(null)} className="flex items-center gap-1" disabled={isProcessing}>
                        <X size={16} />
                        <span>Cancel</span>
                    </Button>
                    <Button onClick={handleSave} disabled={isProcessing} className="flex items-center gap-1">
                        {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        <span>{isProcessing ? 'Saving...' : 'Save'}</span>
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex justify-between items-center">
                    <span>Organizational Structure</span>
                    <Button onClick={handleAdd} size="sm" className="flex items-center gap-1" disabled={isProcessing || isFetchingProfiles}>
                        <UserPlus size={16} />
                        <span>Add Officer</span>
                    </Button>
                </CardTitle>
                <CardDescription>
                    Manage executive profiles and organizational chart data used in Strategy.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {error && (
                    <div className="mb-4 p-4 text-red-500 bg-red-50 rounded-md">
                        Failed to load profiles. Please verify SharePoint list exists and permissions are correct.
                    </div>
                )}

                {editingProfile && !editingProfile.id && (
                    <div className="mb-6 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                        {renderProfileForm()}
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Officer</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Division/Unit</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
                            {isFetchingProfiles ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                                        <p className="text-sm text-gray-500 mt-2">Loading profiles...</p>
                                    </td>
                                </tr>
                            ) : profiles.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                        No officer profiles found. Click "Add Officer" to create one.
                                    </td>
                                </tr>
                            ) : (
                                profiles.map(profile => (
                                    <React.Fragment key={profile.id || profile.employeeId}>
                                        <tr className={editingProfile?.id === profile.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600">
                                                        {profile.name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{profile.name}</div>
                                                        <div className="text-sm text-gray-500">{profile.jobTitle}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{profile.division || '-'}</div>
                                                <div className="text-sm text-gray-500">{profile.unit}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{profile.email}</div>
                                                <div className="text-sm text-gray-500">{profile.phone || '-'}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex justify-end space-x-2">
                                                    <Button
                                                        onClick={() => handleEdit(profile)}
                                                        size="sm"
                                                        variant="ghost"
                                                        disabled={isProcessing}
                                                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                                                    >
                                                        <Pencil size={16} />
                                                    </Button>
                                                    <Button
                                                        onClick={() => profile.id && handleDelete(profile.id, profile.name)}
                                                        size="sm"
                                                        disabled={isProcessing || !profile.id}
                                                        variant="ghost"
                                                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                                    >
                                                        <Trash size={16} />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                        {editingProfile?.id === profile.id && (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-4 border-b border-indigo-100 bg-gray-50/50 dark:bg-gray-800/50">
                                                    <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border shadow-sm">
                                                        {renderProfileForm()}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};

export default OrgStructureManagement;
