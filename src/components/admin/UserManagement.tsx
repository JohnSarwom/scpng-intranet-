import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash, UserPlus, Save, X, Bell, Settings as SettingsIcon, Check, Loader2, DatabaseZap } from 'lucide-react';
import { toast } from 'sonner';
import { UserRole, PermissionGroup } from '@/services/userSharePointService';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

// Seed data for bulk user creation
const seedUsers: Array<{ user_name: string; user_email: string; division_name: string; unit_name: string }> = [
  { user_name: 'Andy Ambulu', user_email: 'aambulu@scpng.gov.pg', division_name: 'Executive Division', unit_name: 'Secretariat Unit' },
  { user_name: 'Anita Kosnga', user_email: 'akosnga@scpng.gov.pg', division_name: 'Corporate Services Division', unit_name: 'Finance Unit' },
  { user_name: 'Donald Sinogerel Samson', user_email: 'dsamson@scpng.gov.pg', division_name: 'Corporate Services Division', unit_name: 'IT Unit' },
  { user_name: 'Esther Alia', user_email: 'ealia@scpng.gov.pg', division_name: 'Licensing Market & Supervision Division', unit_name: 'Market Data Unit' },
  { user_name: 'Eric Kipongi', user_email: 'ekipongi@scpng.gov.pg', division_name: 'Corporate Services Division', unit_name: 'IT Unit' },
  { user_name: 'Enly Yakop', user_email: 'eyakop@scpng.gov.pg', division_name: 'Licensing Market & Supervision Division', unit_name: 'Investigations Unit' },
  { user_name: 'Harold Mek Kape', user_email: 'hkape@scpng.gov.pg', division_name: 'Licensing Market & Supervision Division', unit_name: 'Supervision Unit' },
  { user_name: 'Isaac Mel', user_email: 'imel@scpng.gov.pg', division_name: 'Legal Services Division', unit_name: 'Legal Advisory Unit' },
  { user_name: 'Immanuel Minoga', user_email: 'iminoga@scpng.gov.pg', division_name: 'Legal Services Division', unit_name: 'Legal Advisory Unit' },
  { user_name: 'James Joshua', user_email: 'jjoshua@scpng.gov.pg', division_name: 'Executive Division', unit_name: 'Executive Unit' },
  { user_name: 'Jacob Kom', user_email: 'jkom@scpng.gov.pg', division_name: 'Licensing Market & Supervision Division', unit_name: 'Investigations Unit' },
  { user_name: 'Joy Komba', user_email: 'jkomba@scpng.gov.pg', division_name: 'Research & Publication Division', unit_name: 'Research Unit' },
  { user_name: 'John Sarwom', user_email: 'jsarwom@scpng.gov.pg', division_name: 'Corporate Services Division', unit_name: 'IT Unit' },
  { user_name: 'Kylie Karis', user_email: 'kkaris@scpng.gov.pg', division_name: 'Licensing Market & Supervision Division', unit_name: 'Licensing Unit' },
  { user_name: 'Lovelyn Karlyo', user_email: 'lkarlyo@scpng.gov.pg', division_name: 'Corporate Services Division', unit_name: 'Human Resources Unit' },
  { user_name: 'Laviniah Michael', user_email: 'lmichael@scpng.gov.pg', division_name: 'Corporate Services Division', unit_name: 'Finance Unit' },
  { user_name: 'Lenome Rex MBalupa', user_email: 'lrmbalupa@scpng.gov.pg', division_name: 'Corporate Services Division', unit_name: 'Human Resources Unit' },
  { user_name: 'Leah Samuel', user_email: 'lsamuel@scpng.gov.pg', division_name: 'Corporate Services Division', unit_name: 'Human Resources Unit' },
  { user_name: 'Leeroy Wambillie', user_email: 'lwambillie@scpng.gov.pg', division_name: 'Licensing Market & Supervision Division', unit_name: 'Licensing Unit' },
  { user_name: 'Monica Abau-Sapulai', user_email: 'msapulai@scpng.gov.pg', division_name: 'Corporate Services Division', unit_name: 'IT Unit' },
  { user_name: 'Max Siwi', user_email: 'msiwi@scpng.gov.pg', division_name: 'Research & Publication Division', unit_name: 'Research Unit' },
  { user_name: 'Mark Timea', user_email: 'mtimea@scpng.gov.pg', division_name: 'Corporate Services Division', unit_name: 'Human Resources Unit' },
  { user_name: 'Mercy Tipitap', user_email: 'mtipitap@scpng.gov.pg', division_name: 'Corporate Services Division', unit_name: 'Finance Unit' },
  { user_name: 'Ninipe Gurumo', user_email: 'ngurumo@scpng.gov.pg', division_name: 'Executive Division', unit_name: 'Secretariat Unit' },
  { user_name: 'Rosie Stevenou', user_email: 'rstevenou@scpng.gov.pg', division_name: 'Research & Publication Division', unit_name: 'Media & Publication Unit' },
  { user_name: 'Regina Wai', user_email: 'rwai@scpng.gov.pg', division_name: 'Licensing Market & Supervision Division', unit_name: 'Supervision Unit' },
  { user_name: 'Sophia Marai', user_email: 'smarai@scpng.gov.pg', division_name: 'Corporate Services Division', unit_name: 'Human Resources Unit' },
  { user_name: 'Sam Taki', user_email: 'staki@scpng.gov.pg', division_name: 'Corporate Services Division', unit_name: 'Finance Unit' },
  { user_name: 'Tony Kawas', user_email: 'tkawas@scpng.gov.pg', division_name: 'Legal Services Division', unit_name: 'Legal Advisory Unit' },
  { user_name: 'Thomas Mondaya', user_email: 'tmondaya@scpng.gov.pg', division_name: 'Corporate Services Division', unit_name: 'Human Resources Unit' },
  { user_name: 'Tyson Yapao', user_email: 'tyapao@scpng.gov.pg', division_name: 'Legal Services Division', unit_name: 'Legal Advisory Unit' },
  { user_name: 'Zomay Apini', user_email: 'zapini@scpng.gov.pg', division_name: 'Licensing Market & Supervision Division', unit_name: 'Market Data Unit' },
];

// Organizational structure: Divisions and their Units
const divisionsAndUnits: Record<string, string[]> = {
  'Executive Division': ['Executive Unit', 'Secretariat Unit'],
  'Corporate Services Division': ['Finance Unit', 'Human Resources Unit', 'IT Unit', 'Corporate Services Unit', 'Administrative Services'],
  'Licensing Market & Supervision Division': ['Market Data Unit', 'Licensing Unit', 'Supervision Unit', 'Investigations Unit'],
  'Legal Services Division': ['Legal Advisory Unit'],
  'Research & Publication Division': ['Research Unit', 'Media & Publication Unit'],
  'Secretariat Unit': ['Secretariat Unit'],
};

const divisionsList = Object.keys(divisionsAndUnits);

interface UserManagementProps {
  users: UserRole[];
  availableGroups: PermissionGroup[];
  // setUsers is removed in favor of direct add/update callbacks which refresh the list in parent
  onAddUser: (user: Partial<UserRole>) => Promise<void>;
  onUpdateUser: (email: string, updates: Partial<UserRole>) => Promise<void>;
  onDeleteUser: (email: string) => Promise<void>;
  onGeneratePassword?: (user: UserRole) => void;
  onConfigureEmail?: (user: UserRole) => void;
}

const UserManagement: React.FC<UserManagementProps> = ({
  users,
  availableGroups,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onGeneratePassword,
  onConfigureEmail
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<UserRole>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState({ current: 0, total: 0 });

  const handleSeedUsers = async () => {
    const existingEmails = new Set(users.map(u => u.user_email.toLowerCase()));
    const usersToAdd = seedUsers.filter(u => !existingEmails.has(u.user_email.toLowerCase()));

    if (usersToAdd.length === 0) {
      toast.info('All seed users already exist');
      return;
    }

    if (!confirm(`This will add ${usersToAdd.length} new users as staff_member with IT Group. ${seedUsers.length - usersToAdd.length} users already exist and will be skipped. Continue?`)) {
      return;
    }

    setIsSeeding(true);
    setSeedProgress({ current: 0, total: usersToAdd.length });
    let added = 0;
    let failed = 0;

    for (const seedUser of usersToAdd) {
      try {
        await onAddUser({
          user_name: seedUser.user_name,
          user_email: seedUser.user_email,
          role_name: 'staff_member',
          division_name: seedUser.division_name,
          unit_name: seedUser.unit_name,
          groups: availableGroups.length > 0 ? [availableGroups[0].title] : [],
        });
        added++;
      } catch (error) {
        console.error(`Failed to add ${seedUser.user_name}:`, error);
        failed++;
      }
      setSeedProgress({ current: added + failed, total: usersToAdd.length });
    }

    setIsSeeding(false);
    if (failed === 0) {
      toast.success(`Successfully added ${added} users`);
    } else {
      toast.warning(`Added ${added} users, ${failed} failed`);
    }
  };

  const toggleGroup = (groupTitle: string) => {
    const currentGroups = formData.groups || [];
    let newGroups;
    if (currentGroups.includes(groupTitle)) {
      newGroups = currentGroups.filter(g => g !== groupTitle);
    } else {
      newGroups = [...currentGroups, groupTitle];
    }
    setFormData({ ...formData, groups: newGroups });
  };

  const handleEditUser = (user: UserRole) => {
    setIsEditing(true);
    const validGroupTitles = availableGroups.map(g => g.title);
    const cleanedGroups = (user.groups || []).filter(g => validGroupTitles.includes(g));
    setFormData({ ...user, groups: cleanedGroups });
    setIsModalOpen(true);
  };

  const startAddingUser = () => {
    setIsEditing(false);
    setFormData({
      user_email: '',
      user_name: '',
      role_name: 'staff_member',
      groups: []
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.user_email || !formData.user_name) {
      toast.error('Please fill all required fields');
      return;
    }
    
    setIsProcessing(true);
    try {
      if (isEditing) {
        await onUpdateUser(formData.user_email!, {
          user_name: formData.user_name,
          role_name: formData.role_name,
          division_name: formData.division_name,
          unit_name: formData.unit_name,
          groups: formData.groups
        });
        toast.success('User updated successfully');
      } else {
        await onAddUser(formData as UserRole);
        toast.success('User added successfully');
      }
      setIsModalOpen(false);
    } catch (error) {
      toast.error(`Failed to ${isEditing ? 'update' : 'add'} user`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteUser = async (email: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      setIsProcessing(true);
      try {
        await onDeleteUser(email);
        toast.success('User deleted successfully');
      } catch (error) {
        toast.error('Failed to delete user');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between">
          <span>Users</span>
          <div className="flex gap-2">
            <Button
              onClick={handleSeedUsers}
              size="sm"
              variant="outline"
              disabled={isSeeding || isProcessing}
              className="flex items-center gap-1"
            >
              {isSeeding ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{seedProgress.current}/{seedProgress.total}</span>
                </>
              ) : (
                <>
                  <DatabaseZap size={16} />
                  <span>Seed Users</span>
                </>
              )}
            </Button>
            <Button onClick={startAddingUser} size="sm" className="flex items-center gap-1" disabled={isSeeding}>
              <UserPlus size={16} />
              <span>Add User</span>
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Manage user accounts and permissions via SharePoint UserRoles list.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Division / Unit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Groups</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
              {users.map(user => (
                <tr key={user.id || user.user_email}>
                  <td className="px-6 py-4 whitespace-nowrap">{user.user_name || user.user_email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{user.user_email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant="outline" className={`
                      ${user.role_name === 'super_admin' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                        user.role_name === 'admin' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                          user.role_name === 'manager' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                            'bg-green-100 text-green-800 border-green-200'}`}>
                      {user.role_name}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      {user.division_name && <div className="text-sm font-medium">{user.division_name}</div>}
                      <div className="text-sm text-gray-500">{user.unit_name || '-'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {user.groups && user.groups.length > 0 ? (
                        user.groups.map(g => {
                          const isOrphaned = !availableGroups.some(ag => ag.title === g);
                          return (
                            <Badge key={g} variant={isOrphaned ? 'destructive' : 'secondary'} className="text-xs">
                              {g} {isOrphaned && '(Invalid)'}
                            </Badge>
                          );
                        })
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <Button onClick={() => handleEditUser(user)} size="sm" variant="ghost" disabled={isProcessing} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">
                        <Pencil size={16} />
                      </Button>
                      {onGeneratePassword && (
                        <Button onClick={() => onGeneratePassword(user)} size="sm" disabled={isProcessing} variant="ghost" className="text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300">
                          <SettingsIcon size={16} />
                        </Button>
                      )}
                      {onConfigureEmail && (
                        <Button onClick={() => onConfigureEmail(user)} size="sm" disabled={isProcessing} variant="ghost" className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                          <Bell size={16} />
                        </Button>
                      )}
                      <Button onClick={() => handleDeleteUser(user.user_email)} size="sm" disabled={isProcessing} variant="ghost" className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                        <Trash size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit User' : 'Add New User'}</DialogTitle>
              <DialogDescription>
                {isEditing ? 'Update the details and permissions for this user.' : 'Create a new user by assigning a role and divisions.'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.user_name || ''}
                    onChange={e => setFormData({ ...formData, user_name: e.target.value })}
                    placeholder="Full Name"
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={formData.user_email || ''}
                    onChange={e => setFormData({ ...formData, user_email: e.target.value })}
                    placeholder="email@scpng.gov.pg"
                    disabled={isProcessing || isEditing}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <select
                    value={formData.role_name || 'staff_member'}
                    onChange={e => setFormData({ ...formData, role_name: e.target.value as any })}
                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                    disabled={isProcessing}
                  >
                    <option value="staff_member">Staff Member</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Division</Label>
                  <select
                    value={formData.division_name || ''}
                    onChange={e => {
                      setFormData({ ...formData, division_name: e.target.value, unit_name: '' });
                    }}
                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                    disabled={isProcessing}
                  >
                    <option value="">Select Division</option>
                    {divisionsList.map(div => (
                      <option key={div} value={div}>{div}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <select
                    value={formData.unit_name || ''}
                    onChange={e => {
                      setFormData({ ...formData, unit_name: e.target.value });
                    }}
                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                    disabled={isProcessing || !formData.division_name}
                  >
                    <option value="">Select Unit</option>
                    {(formData.division_name && divisionsAndUnits[formData.division_name] || []).map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Security Groups</Label>
                <div className="flex flex-wrap gap-2 p-4 border rounded-md bg-gray-50 dark:bg-gray-900/50">
                  {availableGroups.map(group => (
                    <div key={group.id} className="flex items-center space-x-2 bg-white dark:bg-gray-800 p-2 rounded-md border shadow-sm">
                      <Checkbox
                        id={`modal-grp-${group.id}`}
                        checked={(formData.groups || []).includes(group.title)}
                        onCheckedChange={() => toggleGroup(group.title)}
                        disabled={isProcessing}
                      />
                      <Label htmlFor={`modal-grp-${group.id}`} className="cursor-pointer font-medium text-sm">
                        {group.title}
                      </Label>
                    </div>
                  ))}
                  {availableGroups.length === 0 && (
                    <span className="text-sm text-gray-500 italic">No permission groups available. Create one in 'Roles & Groups'.</span>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isProcessing}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isProcessing}>
                {isProcessing && <Loader2 size={16} className="animate-spin mr-2" />}
                {isProcessing ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default UserManagement;
