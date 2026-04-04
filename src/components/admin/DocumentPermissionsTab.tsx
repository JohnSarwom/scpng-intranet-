import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Building, Globe, Crown, User, Search, Info, Loader2 } from 'lucide-react';
import { UserRole } from '@/services/userSharePointService';
import { toast } from 'sonner';

// ─── Permission definitions ────────────────────────────────────────────────────

const DOCUMENT_SECTIONS = [
  {
    key: 'documents_org',
    label: 'Organisational Shared',
    icon: Building,
    color: 'text-blue-600',
    description: 'Company-wide policies, procedures and shared resources',
  },
  {
    key: 'documents_external',
    label: 'External Shared',
    icon: Globe,
    color: 'text-green-600',
    description: 'Documents and links shared with external parties',
  },
] as const;

type SectionKey = (typeof DOCUMENT_SECTIONS)[number]['key'];

const DOCUMENT_ACTIONS: { key: string; label: string; description: string }[] = [
  { key: 'upload', label: 'Upload', description: 'Add new documents or links' },
  { key: 'delete', label: 'Delete', description: 'Remove documents permanently' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRoleBadge(role: string) {
  switch (role) {
    case 'super_admin': return <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">Super Admin</Badge>;
    case 'admin':       return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Admin</Badge>;
    case 'manager':     return <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">Manager</Badge>;
    default:            return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Staff</Badge>;
  }
}

function hasDocAction(user: UserRole, sectionKey: SectionKey, action: string): boolean {
  const perms = user.permissions || {};
  return Array.isArray(perms[sectionKey]) && perms[sectionKey].includes(action);
}

function buildUpdatedPermissions(
  current: any,
  sectionKey: SectionKey,
  action: string,
  enabled: boolean,
): any {
  const perms = { ...(current || {}) };
  const existing: string[] = Array.isArray(perms[sectionKey]) ? [...perms[sectionKey]] : [];

  if (enabled) {
    if (!existing.includes(action)) existing.push(action);
  } else {
    const idx = existing.indexOf(action);
    if (idx !== -1) existing.splice(idx, 1);
  }

  if (existing.length === 0) {
    delete perms[sectionKey];
  } else {
    perms[sectionKey] = existing;
  }
  return perms;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  users: UserRole[];
  onUpdateUser: (email: string, updates: Partial<UserRole>) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DocumentPermissionsTab: React.FC<Props> = ({ users, onUpdateUser }) => {
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null); // "email::section::action"

  // Admins always have full access — filter them out of the table (show a note instead)
  const nonAdminUsers = users.filter(
    u => !u.is_admin && u.role_name !== 'admin' && u.role_name !== 'super_admin',
  );

  const adminUsers = users.filter(
    u => u.is_admin || u.role_name === 'admin' || u.role_name === 'super_admin',
  );

  const filtered = nonAdminUsers.filter(u =>
    (u.user_name || u.user_email).toLowerCase().includes(search.toLowerCase()) ||
    u.user_email.toLowerCase().includes(search.toLowerCase()),
  );

  const handleToggle = async (
    user: UserRole,
    sectionKey: SectionKey,
    action: string,
    enabled: boolean,
  ) => {
    const key = `${user.user_email}::${sectionKey}::${action}`;
    setSaving(key);
    try {
      const updatedPermissions = buildUpdatedPermissions(
        user.permissions,
        sectionKey,
        action,
        enabled,
      );
      await onUpdateUser(user.user_email, { permissions: updatedPermissions });
      // Mutate local copy so UI reflects immediately without full reload
      user.permissions = updatedPermissions;
      toast.success(
        `${enabled ? 'Granted' : 'Revoked'} ${action} on ${DOCUMENT_SECTIONS.find(s => s.key === sectionKey)?.label} for ${user.user_name || user.user_email}`,
      );
    } catch (err: any) {
      toast.error(`Failed to update permission: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" />
            Document Management Permissions
          </CardTitle>
          <CardDescription>
            Control which non-admin users can upload or delete documents in each shared section.
            Admins and Super Admins always have full access.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Info — admins always allowed */}
      {adminUsers.length > 0 && (
        <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-900/10">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Crown className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
                  Admin &amp; Super Admin accounts have unrestricted document access
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                  {adminUsers.map(u => u.user_name || u.user_email).join(', ')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            Permission Legend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DOCUMENT_SECTIONS.map(section => (
              <div key={section.key} className="flex items-start gap-3">
                <section.icon className={`h-5 w-5 ${section.color} flex-shrink-0 mt-0.5`} />
                <div>
                  <p className="text-sm font-medium">{section.label}</p>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                  <div className="flex gap-2 mt-1">
                    {DOCUMENT_ACTIONS.map(a => (
                      <span key={a.key} className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                        <strong>{a.label}</strong> — {a.description}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User permissions table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">User Permissions</CardTitle>
              <CardDescription>{nonAdminUsers.length} non-admin user{nonAdminUsers.length !== 1 ? 's' : ''}</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {search ? 'No users match your search.' : 'No non-admin users found.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground w-56">User</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">Role</th>
                    {DOCUMENT_SECTIONS.map(section => (
                      DOCUMENT_ACTIONS.map(action => (
                        <th key={`${section.key}-${action.key}`} className="text-center px-3 py-3 font-medium text-muted-foreground min-w-[100px]">
                          <div className="flex flex-col items-center gap-0.5">
                            <section.icon className={`h-3.5 w-3.5 ${section.color}`} />
                            <span className="text-xs leading-tight">{section.label.split(' ')[0]}</span>
                            <span className="text-xs font-semibold">{action.label}</span>
                          </div>
                        </th>
                      ))
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filtered.map(user => (
                    <tr key={user.user_email} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <User className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{user.user_name || user.user_email}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.user_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{getRoleBadge(user.role_name)}</td>
                      {DOCUMENT_SECTIONS.map(section => (
                        DOCUMENT_ACTIONS.map(action => {
                          const key = `${user.user_email}::${section.key}::${action.key}`;
                          const isSaving = saving === key;
                          const enabled = hasDocAction(user, section.key, action.key);
                          return (
                            <td key={key} className="px-3 py-3 text-center">
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin mx-auto text-primary" />
                              ) : (
                                <Switch
                                  checked={enabled}
                                  onCheckedChange={val => handleToggle(user, section.key, action.key, val)}
                                  className="data-[state=checked]:bg-primary"
                                />
                              )}
                            </td>
                          );
                        })
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentPermissionsTab;
