import React, { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import PageLayout from '@/components/layout/PageLayout';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase, logger } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import {
  Bell,
  User as UserIcon,
  Pencil,
  Loader2
} from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useGraphProfile } from '@/hooks/useGraphProfile';
// useTaskGroupPreferences removed
import { useEmployeePhotos } from '@/hooks/useEmployeePhotos';
import { compressImage } from '@/lib/utils';

const Settings = () => {
  const { session, isSyncingSession } = useSupabaseAuth(); // Destructure isSyncingSession
  const { accounts, inProgress } = useMsal();
  const { profile: graphProfile } = useGraphProfile();
  const account = accounts[0];
  const userLoading = inProgress !== "none";
  // useTaskGroupPreferences removed
  const { uploadPhoto, getEmployeePhotos } = useEmployeePhotos();
  const [userRole, setUserRole] = useState(null);
  const [modalPhoto, setModalPhoto] = useState<string | undefined>(undefined);
  const [isUploadingModal, setIsUploadingModal] = useState(false);

  const [activeTab, setActiveTab] = useState('profile');

  const [settings, setSettings] = useState({
    profile: {
      name: '',
      email: '',
      phone: '+675 xxx xxxx',
      designation: '', // Replaced language
      timezone: 'Pacific/Port_Moresby',
      division: '',
      unit: ''
    },
    notifications: {
      email: true,
      browser: true,
      mobile: false,
      reports: true,
      updates: true,
      news: false
    }
  });

  useEffect(() => {
    // logger.info('[SettingsPage] useEffect triggered.', {
    //   supabaseSessionExists: !!session,
    //   msalAccountExists: !!account,
    //   userLoading: userLoading
    // });

    const fetchUserRole = async () => {
      if (account) {
        // logger.info('[SettingsPage] Fetching user role for MSAL account:', { username: account.username });
        const { data, error } = await supabase
          .from('user_role_summary')
          .select('role_name')
          .eq('user_email', account.username)
          .single();

        if (error) {
          logger.error('[SettingsPage] Error fetching user role:', { error: error.message });
          console.error('Error fetching user role:', error);
        } else if (data) {
          setUserRole(data.role_name);
          // logger.success('[SettingsPage] User role fetched successfully:', { role: data.role_name });
        } else {
          // logger.warn('[SettingsPage] No user role found for MSAL account:', { username: account.username });
        }
      } else {
        // logger.info('[SettingsPage] No MSAL account to fetch user role for.');
      }
    };

    if (!userLoading && account) {
      // logger.success('Settings Page: MSAL user identified', { account });
      fetchUserRole();
      setSettings(prevSettings => ({
        ...prevSettings,
        profile: {
          ...prevSettings.profile,
          name: account.name || account.username || '',
          email: account.username || ''
        }
      }));
    } else if (!userLoading && !account) {
      // logger.warn('Settings Page: No MSAL account found', { message: 'No MSAL account found' });
      toast.error('User session not found. Please login again.');
    }
  }, [account, userLoading, session, isSyncingSession]); // Added isSyncingSession to dependency array

  useEffect(() => {
    if (graphProfile) {
      setSettings(prevSettings => ({
        ...prevSettings,
        profile: {
          ...prevSettings.profile,
          division: graphProfile.officeLocation || '', // Maps to Division
          unit: graphProfile.department || '',       // Maps to Unit
          phone: graphProfile.mobilePhone || prevSettings.profile.phone, // Map mobilePhone
          designation: graphProfile.jobTitle || userRole || '' // Map jobTitle
        }
      }));
    }
  }, [graphProfile, userRole]);

  // Fetch modal photo on mount
  useEffect(() => {
    const fetchModalPhoto = async () => {
      if (account?.username) {
        const { modalUrl } = await getEmployeePhotos(account.username);
        if (modalUrl) {
          setModalPhoto(modalUrl);
        }
      }
    };
    fetchModalPhoto();
  }, [account?.username, getEmployeePhotos]);

  const handleModalPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const email = account?.username;

    if (file && email) {
      setIsUploadingModal(true);
      try {
        // Compress image before upload (max 1280px for modal background)
        const compressedFile = await compressImage(file, 1280, 0.7);

        // Optimistic UI: Set the photo immediately from the local file
        const objectUrl = URL.createObjectURL(compressedFile);
        setModalPhoto(objectUrl);

        // Perform the actual upload in background
        const newUrl = await uploadPhoto(compressedFile, email, 'modal');

        if (newUrl) {
          toast.success('Profile photo updated!');
        } else {
          toast.error('Upload failed. Please try again.');
        }
      } catch (error) {
        console.error('Failed to upload modal photo:', error);
        toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsUploadingModal(false);
        // Reset input
        event.target.value = '';
      }
    }
  };

  const handleSave = (settingType: keyof typeof settings) => {
    // logger.info(`Saving ${settingType} settings`, settings[settingType]);
    toast.success(`${settingType.charAt(0).toUpperCase() + settingType.slice(1)} settings saved successfully (mock)`);
  };

  if (userLoading || isSyncingSession) { // Update loading condition
    return (
      <PageLayout>
        <div className="flex justify-center items-center h-64">
          <p>{userLoading ? 'Loading user settings...' : 'Syncing authentication session...'}</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold mb-2">Settings</h1>
            <p className="text-gray-500">Manage your account and preferences</p>
          </div>
          <TabsList>
            <TabsTrigger value="profile" className="flex items-center gap-1">
              <UserIcon className="h-4 w-4" />
              <span>Profile</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-1">
              <Bell className="h-4 w-4" />
              <span>Notifications</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <Card className="md:w-64 shrink-0 animate-fade-in p-0 overflow-hidden">
            <div
              className="w-full h-full text-white p-6 md:p-8 flex flex-col justify-end relative overflow-hidden rounded-xl group"
              style={{
                background: 'linear-gradient(180deg, #8B4049 0%, #A52A2A 30%, #8B0000 70%, #660000 100%)',
                minHeight: '600px'
              }}
            >
              {/* Background Image using <img> tag for better loading performance */}
              {modalPhoto && (
                <img
                  src={modalPhoto}
                  alt="Cover"
                  className="absolute inset-0 w-full h-full object-cover z-0"
                  loading="eager"
                />
              )}

              {/* Overlay for readability if photo exists - Using red gradient with opacity */}
              {modalPhoto && (
                <div
                  className="absolute inset-0 z-0"
                  style={{
                    background: 'linear-gradient(to bottom, transparent 0%, transparent 55%, rgba(139, 0, 0, 0.65) 85%, rgba(102, 0, 0, 0.9) 100%)'
                  }}
                ></div>
              )}

              {/* Upload Trigger for Modal Photo */}
              <label
                htmlFor="settings-modal-photo-upload"
                className="absolute top-4 right-4 p-2.5 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full cursor-pointer z-50 transition-all duration-200 opacity-0 group-hover:opacity-100"
                title="Change Cover Photo"
              >
                {isUploadingModal ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Pencil className="w-5 h-5 text-white" />
                )}
              </label>
              <input
                type="file"
                id="settings-modal-photo-upload"
                className="hidden"
                accept="image/*"
                onChange={handleModalPhotoUpload}
                disabled={isUploadingModal}
              />

              {/* Name Section */}
              <div className="z-10 flex flex-col items-center md:items-start text-center md:text-left mb-6">
                <div className="space-y-1">
                  {(() => {
                    const fullName = account?.name || account?.username || 'User';
                    const nameParts = fullName.split(' ');
                    const firstName = nameParts[0] || '';
                    const lastName = nameParts.slice(1).join(' ') || '';

                    return (
                      <>
                        <h2 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight">
                          {firstName}
                        </h2>
                        {lastName && (
                          <h2 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight">
                            {lastName}
                          </h2>
                        )}
                      </>
                    );
                  })()}
                  <div className="w-12 h-1 bg-white/30 mt-4 rounded-full mx-auto md:mx-0"></div>
                </div>
              </div>

              {/* Employee ID (Bottom Left) */}
              <div className="z-10 text-center md:text-left">
                <p className="text-[10px] font-medium tracking-[0.2em] text-white/50 uppercase">
                  ID: {account?.localAccountId?.slice(0, 8).toUpperCase() || 'XXXXXXXX'}
                </p>
              </div>

              {/* Designation Removed from Image */}
            </div>
          </Card>

          <div className="flex-1 animate-fade-in">

            <TabsContent value="profile" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Settings</CardTitle>
                  <CardDescription>
                    Manage your personal information and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={settings.profile.name}
                        onChange={(e) => setSettings({
                          ...settings,
                          profile: {
                            ...settings.profile,
                            name: e.target.value
                          }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={settings.profile.email}
                        onChange={(e) => setSettings({
                          ...settings,
                          profile: {
                            ...settings.profile,
                            email: e.target.value
                          }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={settings.profile.phone}
                        onChange={(e) => setSettings({
                          ...settings,
                          profile: {
                            ...settings.profile,
                            phone: e.target.value
                          }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="designation">Designation</Label>
                      <Input
                        id="designation"
                        value={settings.profile.designation}
                        readOnly
                        className="bg-gray-50 text-gray-500"
                        placeholder="Designation info"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="division">Division</Label>
                      <Input
                        id="division"
                        value={settings.profile.division}
                        readOnly
                        className="bg-gray-50 text-gray-500"
                        placeholder="Division info"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unit">Unit</Label>
                      <Input
                        id="unit"
                        value={settings.profile.unit}
                        readOnly
                        className="bg-gray-50 text-gray-500"
                        placeholder="Unit info"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={settings.profile.timezone}
                      onValueChange={(value) => setSettings({
                        ...settings,
                        profile: {
                          ...settings.profile,
                          timezone: value
                        }
                      })}
                    >
                      <SelectTrigger id="timezone">
                        <SelectValue placeholder="Select Timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pacific/Port_Moresby">Port Moresby (GMT+10)</SelectItem>
                        <SelectItem value="Australia/Sydney">Sydney (GMT+10/11)</SelectItem>
                        <SelectItem value="Asia/Singapore">Singapore (GMT+8)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={() => handleSave('profile')}
                  >
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Settings</CardTitle>
                  <CardDescription>
                    Configure how and when you receive notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Notification Channels</h3>
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="email-notifications">Email Notifications</Label>
                          <p className="text-xs text-muted-foreground">
                            Receive notifications via email
                          </p>
                        </div>
                        <Switch
                          id="email-notifications"
                          checked={settings.notifications.email}
                          onCheckedChange={(checked) => setSettings({
                            ...settings,
                            notifications: {
                              ...settings.notifications,
                              email: checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="browser-notifications">Browser Notifications</Label>
                          <p className="text-xs text-muted-foreground">
                            Show notifications in browser
                          </p>
                        </div>
                        <Switch
                          id="browser-notifications"
                          checked={settings.notifications.browser}
                          onCheckedChange={(checked) => setSettings({
                            ...settings,
                            notifications: {
                              ...settings.notifications,
                              browser: checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="mobile-notifications">Mobile Notifications</Label>
                          <p className="text-xs text-muted-foreground">
                            Receive notifications on mobile
                          </p>
                        </div>
                        <Switch
                          id="mobile-notifications"
                          checked={settings.notifications.mobile}
                          onCheckedChange={(checked) => setSettings({
                            ...settings,
                            notifications: {
                              ...settings.notifications,
                              mobile: checked
                            }
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Notification Types</h3>
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="report-notifications">Reports & Analytics</Label>
                          <p className="text-xs text-muted-foreground">
                            Notifications for reports and KPI updates
                          </p>
                        </div>
                        <Switch
                          id="report-notifications"
                          checked={settings.notifications.reports}
                          onCheckedChange={(checked) => setSettings({
                            ...settings,
                            notifications: {
                              ...settings.notifications,
                              reports: checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="update-notifications">System Updates</Label>
                          <p className="text-xs text-muted-foreground">
                            Notifications for system updates and changes
                          </p>
                        </div>
                        <Switch
                          id="update-notifications"
                          checked={settings.notifications.updates}
                          onCheckedChange={(checked) => setSettings({
                            ...settings,
                            notifications: {
                              ...settings.notifications,
                              updates: checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="news-notifications">News & Announcements</Label>
                          <p className="text-xs text-muted-foreground">
                            Notifications for company news and announcements
                          </p>
                        </div>
                        <Switch
                          id="news-notifications"
                          checked={settings.notifications.news}
                          onCheckedChange={(checked) => setSettings({
                            ...settings,
                            notifications: {
                              ...settings.notifications,
                              news: checked
                            }
                          })}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={() => handleSave('notifications')}
                  >
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

          </div>
        </div>
      </Tabs>
    </PageLayout>
  );
};

export default Settings;
