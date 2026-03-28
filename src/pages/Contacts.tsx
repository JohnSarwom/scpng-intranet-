/**
 * Contacts Page
 * 
 * Restored: 2026-03-22 08:25 AM
 * Fix: Replaced useSupabaseAuth with useRoleBasedAuth to correctly handle isAdmin status 
 * and restored the "Copy All" (MS Graph Export) functionality.
 */
import React, { useState, useEffect } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Filter, Phone, Mail, MapPin, Plus, RefreshCw, Building, Users, Briefcase, Shield, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import OrganizationalStructure from '@/components/contacts/OrganizationalStructure';
import useMicrosoftContacts, { MicrosoftContact } from '@/hooks/useMicrosoftContacts';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import ContactDetailsModal from '@/components/contacts/ContactDetailsModal';
import AddContactDialog from '@/components/contacts/AddContactDialog';
import CustomContactDialog from '@/components/contacts/CustomContactDialog';
import { useEmployeePhotos } from '@/hooks/useEmployeePhotos';
import { useSharePointCustomContacts, useSharePointSetup } from '@/hooks/useSharePointOps';
import { Trash2, Edit, UserCircle, Loader2 } from 'lucide-react';

const Contacts = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const { contacts, isLoading, error, refetch } = useMicrosoftContacts();
  const { isAdmin, user: roleUser, loading: roleLoading } = useRoleBasedAuth();
  const [allContacts, setAllContacts] = useState<MicrosoftContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<MicrosoftContact | null>(null);
  const [selectedDivision, setSelectedDivision] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isCustomContactOpen, setIsCustomContactOpen] = useState(false);
  const [editingCustomContact, setEditingCustomContact] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();
  const [photoUrls, setPhotoUrls] = useState<Map<string, { profileUrl?: string; modalUrl?: string }>>(new Map());

  // Personal Custom Contacts Hook
  const { 
    data: customContacts, 
    loading: customLoading, 
    add: addCustom, 
    update: updateCustom, 
    remove: removeCustom 
  } = useSharePointCustomContacts(roleUser?.user_email || undefined);
  
  const { initializeCustomContactsList } = useSharePointSetup();

  // Helper to normalize office location to division ID
  const getDivisionIdFromOffice = (office?: string) => {
    if (!office) return null;
    // Normalize: "Corporate Services Division" -> "corporate-services-division"
    return office.toLowerCase()
      .trim()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // Note: Auto-setting division for non-admins was removed to allow full organizational visibility
  // as per task: "they should be able to see the whole officers contacts and not only those that are restricted"

  const handleCopyAll = () => {
    if (allContacts.length === 0) {
      toast({
        title: "No Contacts",
        description: "There are no contacts to copy.",
        variant: "destructive",
      });
      return;
    }
    const contactsJson = JSON.stringify(allContacts, null, 2);
    navigator.clipboard.writeText(contactsJson).then(() => {
      toast({
        title: "Copied to Clipboard",
        description: `${allContacts.length} contacts have been copied as JSON.`,
      });
    }).catch(err => {
      console.error('Failed to copy contacts: ', err);
      toast({
        title: "Error",
        description: "Could not copy contacts to clipboard.",
        variant: "destructive",
      });
    });
  };

  // Update contacts with MS Graph data
  useEffect(() => {
    if (contacts.length > 0) {
      // Process Microsoft contacts
      const processedContacts = contacts.map(contact => {
        // Derive divisionId from officeLocation
        const derivedDivisionId = getDivisionIdFromOffice(contact.officeLocation);
        if (derivedDivisionId) {
          (contact as any).divisionId = derivedDivisionId;
        }
        return contact;
      });

      // Filter out external contacts
      // Requirement: Must have both Division (Office) and Unit (Department)
      const validContacts = processedContacts.filter(contact => {
        const hasDivision = !!(contact as any).divisionId;
        const hasUnit = !!contact.department;
        return hasDivision && hasUnit;
      });

      setAllContacts(validContacts);
    }
  }, [contacts]);

  // Fetch employee photos from SharePoint
  // Fetch employee photos from SharePoint
  const { getPhotosForEmails, isInitialized: photosInitialized } = useEmployeePhotos();

  useEffect(() => {
    const fetchPhotos = async () => {
      if (allContacts.length > 0 && photosInitialized) {
        // Extract all emails
        const emails = allContacts
          .map(c => c.emailAddresses?.[0]?.address || c.mail)
          .filter((email): email is string => !!email);

        if (emails.length === 0) return;

        try {
          // Batch fetch photos
          const photoMap = await getPhotosForEmails(emails);
          setPhotoUrls(photoMap);
        } catch (error) {
          console.error("Failed to batch fetch photos:", error);
        }
      }
    };

    fetchPhotos();
  }, [allContacts, photosInitialized, getPhotosForEmails]);

  // Filter by division, search term, and other filters
  const filteredContacts = allContacts.filter(contact => {
    const matchesDivision = !selectedDivision // If no division is selected
        ? true // Show all
        : (contact as any).divisionId === selectedDivision; // Otherwise filter by division

    // Search filter
    const matchesSearch = contact.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.jobTitle?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (contact.emailAddresses?.[0]?.address || '').toLowerCase().includes(searchTerm.toLowerCase());

    // Department filter
    const matchesDepartmentFilter = departmentFilter === 'all' || (contact.department?.toLowerCase() || '') === departmentFilter.toLowerCase();

    // Company filter
    const matchesCompanyFilter = companyFilter === 'all' || (contact.companyName?.toLowerCase() || '') === companyFilter.toLowerCase();

    return matchesDivision && matchesSearch && matchesDepartmentFilter && matchesCompanyFilter;
  });

  // Filter contacts by department (division)
  const divisionContacts = allContacts.filter(contact => {
    const isDivisionContact = contact.department && contact.department.trim() !== '';

    // Apply division filtering based on user's permissions
    const matchesDivision = !selectedDivision
        ? true
        : (contact as any).divisionId === selectedDivision;

    return isDivisionContact && matchesDivision;
  });

  // Group contacts by their divisionId
  const contactsByDivision = divisionContacts.reduce((acc, contact) => {
    const divisionId = (contact as any).divisionId || 'other';
    if (!acc[divisionId]) {
      acc[divisionId] = [];
    }
    acc[divisionId].push(contact);
    return acc;
  }, {} as Record<string, MicrosoftContact[]>);

  // Group contacts by their units/departments
  const contactsByUnit = divisionContacts.reduce((acc, contact) => {
    if (!contact.department) return acc;

    const unit = contact.department.trim();
    if (!acc[unit]) {
      acc[unit] = [];
    }
    acc[unit].push(contact);
    return acc;
  }, {} as Record<string, MicrosoftContact[]>);

  // Filter contacts that are users (have userPrincipalName)
  const userContacts = allContacts.filter(contact => {
    const isUserContact = contact.userPrincipalName && contact.userPrincipalName.includes('@');

    // Apply division filtering based on user's permissions
    const matchesDivision = !selectedDivision
        ? true
        : (contact as any).divisionId === selectedDivision;

    return isUserContact && matchesDivision;
  });

  // Get unique departments from filtered contacts
  const departments = ['All', ...new Set(allContacts
    .filter(contact => !selectedDivision || (contact as any).divisionId === selectedDivision)
    .map(contact => contact.department)
    .filter((dept): dept is string => !!dept))];

  // Get unique companies from filtered contacts
  const companies = ['All', ...new Set(allContacts
    .filter(contact => !selectedDivision || (contact as any).divisionId === selectedDivision)
    .map(contact => contact.companyName)
    .filter((company): company is string => !!company))];

  const renderContactCard = (contact: MicrosoftContact & { isCustom?: boolean }, index: number) => {
    const email = contact.emailAddresses?.[0]?.address || contact.mail;
    const photos = email ? photoUrls.get(email) : null;
    const photoUrl = photos?.profileUrl;

    return (
      <Card key={contact.id} className="overflow-hidden animate-fade-in dark:bg-gray-800 dark:border-white/10 shadow-sm" style={{ animationDelay: `${0.3 + index * 0.05}s` }}>
        <div className="h-12 bg-gradient-to-r from-intranet-primary to-intranet-secondary opacity-90"></div>
        <CardContent className="p-6 pt-0 relative">
          <div className="flex justify-center">
            <img
              src={photoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${contact.displayName}&backgroundColor=600018`}
              alt={contact.displayName}
              className="w-20 h-20 rounded-full border-4 border-background dark:border-gray-800 -mt-10 shadow-md object-cover"
            />
          </div>

          <div className="text-center mt-2">
            <h3 className="font-bold dark:text-gray-100">{contact.displayName}</h3>
            <p className="text-sm text-muted-foreground dark:text-gray-400">{contact.jobTitle || 'No position specified'}</p>
            {contact.department && (
              <span className="inline-block px-3 py-1 bg-secondary/10 dark:bg-white/5 text-secondary dark:text-gray-300 text-xs rounded-full mt-2 border dark:border-white/10">
                {contact.department}
              </span>
            )}
            {contact.companyName && (
              <div className="mt-2 text-xs text-muted-foreground dark:text-gray-400 flex items-center justify-center">
                <Building className="h-3 w-3 mr-1" />
                {contact.companyName}
              </div>
            )}
            {/* Show division badge for admins */}
            {isAdmin && (contact as any).divisionId && (
              <div className="mt-1 text-xs text-muted-foreground dark:text-gray-400 flex items-center justify-center">
                <Shield className="h-3 w-3 mr-1" />
                {(contact as any).divisionId.replace(/-/g, ' ')}
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {contact.emailAddresses?.[0] && (
              <div className="flex items-center text-sm dark:text-gray-300">
                <Mail className="h-4 w-4 mr-2 text-intranet-primary dark:text-intranet-primary/80" />
                <span className="truncate">{contact.emailAddresses[0].address}</span>
              </div>
            )}

            {(contact.businessPhones?.[0] || contact.mobilePhone) && (
              <div className="flex items-center text-sm dark:text-gray-300">
                <Phone className="h-4 w-4 mr-2 text-intranet-primary dark:text-intranet-primary/80" />
                <span>{contact.businessPhones?.[0] || contact.mobilePhone}</span>
              </div>
            )}

            {contact.officeLocation && (
              <div className="flex items-center text-sm dark:text-gray-300">
                <MapPin className="h-4 w-4 mr-2 text-intranet-primary dark:text-intranet-primary/80" />
                <span>{contact.officeLocation}</span>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className={contact.isCustom ? "flex-1 dark:border-white/10 dark:hover:bg-white/5 dark:text-gray-300" : "w-full dark:border-white/10 dark:hover:bg-white/5 dark:text-gray-300"}
              onClick={() => {
                setSelectedContact(contact);
                setIsModalOpen(true);
              }}
            >
              View Profile
            </Button>
            {contact.isCustom && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="px-2 dark:border-white/10 dark:hover:bg-white/5 dark:text-blue-400"
                  onClick={() => {
                    setEditingCustomContact(contact);
                    setIsCustomContactOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="px-2 dark:border-white/10 dark:hover:bg-red-900/20 dark:text-red-400"
                  onClick={async () => {
                    if (confirm('Are you sure you want to delete this contact?')) {
                      await removeCustom(contact.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card >
    );
  };

  const renderContactsGrid = (contactsToRender: MicrosoftContact[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {isLoading ? (
        // Loading skeletons
        Array.from({ length: 8 }).map((_, index) => (
          <Card key={index} className="overflow-hidden dark:bg-gray-800 dark:border-white/10">
            <div className="h-12 bg-gradient-to-r from-intranet-primary to-intranet-secondary opacity-50"></div>
            <CardContent className="p-6 pt-0 relative">
              <div className="flex justify-center">
                <Skeleton className="w-20 h-20 rounded-full -mt-10 dark:bg-gray-700" />
              </div>
              <div className="text-center mt-2">
                <Skeleton className="h-6 w-32 mx-auto mb-2 dark:bg-gray-700" />
                <Skeleton className="h-4 w-24 mx-auto dark:bg-gray-700" />
              </div>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-full dark:bg-gray-700" />
                <Skeleton className="h-4 w-3/4 dark:bg-gray-700" />
                <Skeleton className="h-4 w-1/2 dark:bg-gray-700" />
              </div>
            </CardContent>
          </Card>
        ))
      ) : contactsToRender.length > 0 ? (
        contactsToRender.map((contact, index) => renderContactCard(contact, index))
      ) : (
        <div className="col-span-full text-center py-8 text-gray-500">
          No contacts found matching your search criteria
        </div>
      )}
    </div>
  );

  // Render contacts organized by divisions
  const renderDivisionContactsSection = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Card key={index} className="overflow-hidden">
              <div className="h-12 bg-gradient-to-r from-intranet-primary to-intranet-secondary"></div>
              <CardContent className="p-6 pt-0 relative">
                <div className="flex justify-center">
                  <Skeleton className="w-20 h-20 rounded-full -mt-10" />
                </div>
                <div className="text-center mt-2">
                  <Skeleton className="h-6 w-32 mx-auto mb-2" />
                  <Skeleton className="h-4 w-24 mx-auto" />
                </div>
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (Object.keys(contactsByDivision).length === 0) {
      return (
        <div className="col-span-full text-center py-8 text-gray-500">
          No divisional contacts found
        </div>
      );
    }

    const divisionOrder = [
      "executive-division",
      "corporate-services-division",
      "licensing-market-supervision-division",
      "legal-services-division",
      "research-publication-division",
      "secretariat-unit",
      "other"
    ];

    // Sort division IDs based on the predefined order, with any unknown divisions at the end
    const orderedDivisionIds = Object.keys(contactsByDivision).sort((a, b) => {
      const indexA = divisionOrder.indexOf(a);
      const indexB = divisionOrder.indexOf(b);

      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    return (
      <div className="space-y-8">
        {orderedDivisionIds.map(divisionId => {
          const contacts = contactsByDivision[divisionId];
          if (!contacts || contacts.length === 0) return null;

          // Format division name for display
          const divisionName = divisionId === 'other'
            ? 'Other Contacts'
            : divisionId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

          return (
            <div key={divisionId} className="animate-fade-in">
              <h2 className="text-xl font-semibold mb-4 px-4 py-2 bg-secondary/10 dark:bg-white/5 text-secondary dark:text-gray-100 rounded-lg border dark:border-white/10">{divisionName}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {contacts.map((contact, index) => renderContactCard(contact, index))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render contacts organized by units/departments
  const renderUnitContactsSection = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Card key={index} className="overflow-hidden">
              <div className="h-12 bg-gradient-to-r from-intranet-primary to-intranet-secondary"></div>
              <CardContent className="p-6 pt-0 relative">
                <div className="flex justify-center">
                  <Skeleton className="w-20 h-20 rounded-full -mt-10" />
                </div>
                <div className="text-center mt-2">
                  <Skeleton className="h-6 w-32 mx-auto mb-2" />
                  <Skeleton className="h-4 w-24 mx-auto" />
                </div>
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (Object.keys(contactsByUnit).length === 0) {
      return (
        <div className="col-span-full text-center py-8 text-gray-500">
          No unit contacts found
        </div>
      );
    }

    // Sort units alphabetically
    const sortedUnitNames = Object.keys(contactsByUnit).sort((a, b) => a.localeCompare(b));

    return (
      <div className="space-y-8">
        {sortedUnitNames.map(unitName => {
          const contacts = contactsByUnit[unitName];
          if (!contacts || contacts.length === 0) return null;

          // Format unit name for display
          const formattedUnitName = unitName.includes('Unit') ? unitName : `${unitName} Unit`;

          return (
            <div key={unitName} className="animate-fade-in">
              <h2 className="text-xl font-semibold mb-4 px-4 py-2 bg-secondary/10 dark:bg-white/5 text-secondary dark:text-gray-100 rounded-lg border dark:border-white/10">{formattedUnitName}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {contacts.map((contact, index) => renderContactCard(contact, index))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading || roleLoading) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <RefreshCw className="h-12 w-12 animate-spin text-primary opacity-20" />
          <p className="text-muted-foreground animate-pulse">Loading contacts and permissions...</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-bold mb-2">Organization Directory</h1>
        <p className="text-gray-500">
          Find and connect with colleagues across the SCPNG organization
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex justify-between items-center">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full max-w-2xl dark:bg-gray-800/50 dark:border dark:border-white/10 p-1 h-auto">
            <TabsTrigger value="all" className="flex items-center gap-2 px-6 py-2 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100 dark:text-gray-400">
              <Users className="h-4 w-4" />
              All Contacts
            </TabsTrigger>
            <TabsTrigger value="division" className="flex items-center gap-2 px-6 py-2 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100 dark:text-gray-400">
              <Briefcase className="h-4 w-4" />
              Division Contacts
            </TabsTrigger>
            <TabsTrigger value="units" className="flex items-center gap-2 px-6 py-2 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100 dark:text-gray-400">
              <Building className="h-4 w-4" />
              Unit Contacts
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2 px-6 py-2 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100 dark:text-gray-400">
              <UserCircle className="h-4 w-4" />
              My Contacts
            </TabsTrigger>
          </TabsList>

          {activeTab === 'users' && (
            <div className="flex gap-2">
              {isAdmin && (
                <Button 
                  onClick={initializeCustomContactsList}
                  variant="outline"
                  className="border-intranet-primary text-intranet-primary hover:bg-intranet-primary/10 gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Initialize Private Contacts Storage
                </Button>
              )}
              <Button 
                onClick={() => {
                  setEditingCustomContact(null);
                  setIsCustomContactOpen(true);
                }}
                className="bg-intranet-primary hover:bg-intranet-primary/90 text-white gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Private Contact
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="all" className="animate-fade-in-up">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-grow animate-fade-in">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <Input
                placeholder="Search by name, position, or email..."
                className="pl-10 dark:bg-white/5 dark:border-white/10 dark:text-gray-200 dark:placeholder:text-gray-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex flex-col md:flex-row gap-2 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[180px] dark:bg-white/5 dark:border-white/10 dark:text-gray-200">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-white/10">
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept.toLowerCase()} className="dark:text-gray-200 dark:focus:bg-white/5">
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="w-[180px] dark:bg-white/5 dark:border-white/10 dark:text-gray-200">
                  <SelectValue placeholder="Company" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-white/10">
                  {companies.map((company) => (
                    <SelectItem key={company} value={company.toLowerCase()} className="dark:text-gray-200 dark:focus:bg-white/5">
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="gap-2 dark:border-white/10 dark:hover:bg-white/5 dark:text-gray-300"
                    onClick={() => setIsAddContactOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 dark:border-white/10 dark:hover:bg-white/5 dark:text-gray-300"
                    onClick={handleCopyAll}
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="dark:border-white/10 dark:hover:bg-white/5 dark:text-gray-300"
                    onClick={refetch}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {renderContactsGrid(filteredContacts)}
        </TabsContent>

        <TabsContent value="division">
          {/* Division Contacts Tab - Now organized by divisions */}
          <div className="flex flex-row gap-4 mb-6">
            <div className="relative flex-grow animate-fade-in">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search division contacts..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {isAdmin && (
              <Button
                className="whitespace-nowrap animate-fade-in btn-hover-effect"
                style={{ animationDelay: '0.2s' }}
                onClick={refetch}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {renderDivisionContactsSection()}
        </TabsContent>

        <TabsContent value="units">
          {/* Unit Contacts Tab - Organized by units/departments */}
          <div className="flex flex-row gap-4 mb-6">
            <div className="relative flex-grow animate-fade-in">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search unit contacts..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {isAdmin && (
              <Button
                className="whitespace-nowrap animate-fade-in btn-hover-effect"
                style={{ animationDelay: '0.2s' }}
                onClick={refetch}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {renderUnitContactsSection()}
        </TabsContent>

        <TabsContent value="users" className="animate-fade-in-up">
          {customLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {customContacts.map((contact: any, index: number) => renderContactCard(contact, index))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      <ContactDetailsModal
        contact={selectedContact}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        photoUrl={selectedContact?.emailAddresses?.[0]?.address ? photoUrls.get(selectedContact.emailAddresses[0].address)?.profileUrl : undefined}
        modalPhotoUrl={selectedContact?.emailAddresses?.[0]?.address ? photoUrls.get(selectedContact.emailAddresses[0].address)?.modalUrl : undefined}
      />
      <AddContactDialog
        open={isAddContactOpen}
        onOpenChange={setIsAddContactOpen}
        onContactAdded={refetch}
      />

      <CustomContactDialog
        open={isCustomContactOpen}
        onOpenChange={setIsCustomContactOpen}
        editingContact={editingCustomContact}
        onContactSaved={async (data) => {
          if (editingCustomContact) {
            await updateCustom(editingCustomContact.id, data);
          } else {
            await addCustom(data);
          }
        }}
      />
    </PageLayout>
  );
};

export default Contacts;
