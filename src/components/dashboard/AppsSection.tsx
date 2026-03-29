import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ExternalLink, Plus, Grid3x3, Loader2, AlertCircle, RefreshCw, Pencil, Database, CloudUpload } from 'lucide-react';
import { microsoft365Apps, customApps } from '@/config/appLinks';
import { AppLink } from '@/types/apps';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApps } from '@/hooks/useApps';
import { SharePointApp } from '@/services/appsSharePointService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AddAppModal } from '@/components/apps/AddAppModal';
import { EditAppModal } from '@/components/apps/EditAppModal';
import { AppDetailsModal } from '@/components/apps/AppDetailsModal';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { AppGridSkeleton } from '@/components/dashboard/AppGridSkeleton';
import { useToast } from '@/hooks/use-toast';

interface AppCardProps {
  app: AppLink;
  onEdit?: () => void;
  onView?: () => void;
  isAdmin?: boolean;
}

const AppCard: React.FC<AppCardProps> = ({ app, onEdit, onView, isAdmin }) => {
  // Check if icon is a URL (starts with http) or emoji/text
  const isIconUrl = app.icon?.startsWith('http');

  return (
    <div
      onClick={onView}
      className="group relative flex items-start gap-4 p-4 rounded-xl border border-gray-200 dark:border-white/10 hover:border-red-500 dark:hover:border-red-500 hover:shadow-md transition-all duration-200 bg-white dark:bg-white/5 cursor-pointer"
    >
      {/* Top Right Icons Container */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
        {app.isExternal && (
          <a
            href={app.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 text-gray-400 hover:bg-intranet-primary hover:text-white hover:border-intranet-primary transition-all"
            title="Open application in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {/* Edit Button - Admin Only */}
        {isAdmin && onEdit && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit();
            }}
            className="p-1.5 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 hover:bg-intranet-primary hover:text-white hover:border-intranet-primary transition-all opacity-0 group-hover:opacity-100"
            title="Edit application"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-start gap-4 flex-1 min-w-0">
        <div className="flex-shrink-0">
          {isIconUrl ? (
            <img
              src={app.icon}
              alt={app.name}
              className="w-12 h-12 object-contain rounded"
              onError={(e) => {
                // Fallback to a default icon if image fails to load
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.innerHTML = '📦';
                (e.target as HTMLImageElement).parentElement!.classList.add('text-4xl');
              }}
            />
          ) : (
            <div className="text-4xl">{app.icon || '📦'}</div>
          )}
        </div>
        <div className="flex-1 min-w-0 pr-12">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-intranet-primary transition-colors">
              {app.name}
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
            {app.description}
          </p>
        </div>
      </div>
    </div>
  );
};

const AppsSection: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  // const [showAddCustomApp, setShowAddCustomApp] = useState(false); // Unused
  const [useSharePoint, setUseSharePoint] = useState(true); // Toggle to use SharePoint or static data
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAppForEdit, setSelectedAppForEdit] = useState<SharePointApp | null>(null);

  // View Details State
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedAppForDetails, setSelectedAppForDetails] = useState<AppLink | null>(null);

  // Check if user is admin
  const { isAdmin } = useRoleBasedAuth();
  const { toast } = useToast();

  // Fetch apps from SharePoint
  const { apps: sharePointApps, categories, loading, error, refetch, addApplication } = useApps();
  const [isDeploying, setIsDeploying] = useState(false);

  const sortedCategories = useMemo(() => {
    // Definitive sort order for categories
    const order = [
      'SCPNG Apps',
      'Microsoft 365',
      'Finance Systems',
      'Legal Apps',
      'AI Apps',
      'HR Systems',
      'Productivity',
      'Communication',
      'Utilities',
      'External Services',
      'National Portals',
      'Document Utilities',
      'Media Optimization',
      'File Conversion',
      'Custom'
    ];
    return order;
  }, []);

  // Convert SharePoint apps to AppLink format
  const convertedSharePointApps: AppLink[] = useMemo(() => {
    return sharePointApps.map((app: SharePointApp) => ({
      id: app.appId,
      name: app.title,
      description: app.description || '',
      icon: app.icon || '📦',
      url: app.appUrl,
      category: app.category,
      isExternal: app.isExternal ?? true,
      displayOrder: app.displayOrder,
    }));
  }, [sharePointApps]);

  // Determine which apps to use
  const allApps = useSharePoint && convertedSharePointApps.length > 0
    ? convertedSharePointApps
    : [...microsoft365Apps, ...customApps];

  // Filter apps by category
  const filteredApps = useMemo(() => {
    if (selectedCategory === 'all') {
      return allApps;
    }
    return allApps.filter(app =>
      app.category.toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [selectedCategory, allApps]);

  // Group apps by category for display
  const appsByCategory = useMemo(() => {
    const grouped: Record<string, AppLink[]> = {};
    allApps.forEach(app => {
      const category = app.category || 'Uncategorized';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(app);
    });

    // Sort apps within each category by displayOrder
    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) =>
        (a.displayOrder || 999) - (b.displayOrder || 999)
      );
    });

    return grouped;
  }, [allApps]);

  const availableCategories = useSharePoint && categories.length > 0
    ? categories
    : Array.from(new Set(allApps.map(app => app.category))).sort();

  const handleCopyData = () => {
    try {
      const dataStr = JSON.stringify(allApps, null, 2);
      navigator.clipboard.writeText(dataStr);
      toast({
        title: "Data Copied",
        description: "Application backend data has been copied to clipboard as JSON.",
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy data to clipboard.",
        variant: "destructive",
      });
    }
  };

  const bulkApps = [
    { appId: 'meeting-minutes', name: 'Meeting Minutes', description: 'Official SCPNG collaborative meeting minutes generator and registry.', icon: '📄', url: '/meeting-minutes', category: 'SCPNG Apps', isExternal: false }
  ];

  const handleBulkDeploy = async () => {
    setIsDeploying(true);
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    try {
      const existingAppIds = new Set(sharePointApps.map(app => app.appId));
      
      for (let i = 0; i < bulkApps.length; i++) {
        const appData = bulkApps[i];
        
        if (existingAppIds.has(appData.appId)) {
          skipCount++;
          continue;
        }

        try {
          await addApplication({
            appId: appData.appId,
            title: appData.name,
            description: appData.description,
            icon: appData.icon,
            appUrl: appData.url,
            category: appData.category,
            isExternal: appData.isExternal || false,
            isActive: true,
            displayOrder: 100 + (i * 10)
          });
          successCount++;
          if (successCount % 5 === 0) {
            toast({
              title: "Deploying...",
              description: `Deployed ${successCount}/${bulkApps.length} apps.`,
            });
          }
        } catch (err) {
          console.error(`Failed to deploy ${appData.name}:`, err);
          failCount++;
        }
      }

      await refetch();
      
      toast({
        title: "Deployment Complete",
        description: `Successfully deployed ${successCount} apps. Skipped ${skipCount} existing. Failed ${failCount}.`,
      });
    } catch (error) {
      toast({
        title: "Deployment Failed",
        description: "An error occurred during bulk deployment.",
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="space-y-4 mb-8">
      {/* Error Alert */}
      {error && useSharePoint && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Apps</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-white/10">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-2xl font-bold dark:text-gray-100">
              <Grid3x3 className="h-6 w-6 text-intranet-primary" />
              <span>Apps</span>
              {isAdmin && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleCopyData}
                    className="p-1 rounded-md text-gray-400 hover:text-intranet-primary hover:bg-intranet-primary/10 transition-colors"
                    title="Copy Backend Data (JSON)"
                  >
                    <Database className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleBulkDeploy}
                    disabled={isDeploying}
                    className="p-1 rounded-md text-gray-400 hover:text-intranet-primary hover:bg-intranet-primary/10 transition-colors disabled:opacity-50"
                    title="Deploy Optimized Catalog to Backend"
                  >
                    {isDeploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                  </button>
                </div>
              )}
            </CardTitle>
            <div className="flex items-center gap-3">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Apps</SelectItem>
                  {availableCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin && useSharePoint && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsAddModalOpen(true)}
                  disabled={loading}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add App
                </Button>
              )}
              {useSharePoint && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refetch}
                  disabled={loading}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Loading State */}
          {loading && useSharePoint && (
            <div className="py-6">
              <AppGridSkeleton count={8} />
            </div>
          )}

          {/* Content - Show when not loading or when using static data */}
          {(!loading || !useSharePoint) && (
            <>
              {/* Show All Categories */}
              {selectedCategory === 'all' && (
                <>
                  {Object.keys(appsByCategory).sort((a, b) => {
                    const indexA = sortedCategories.indexOf(a);
                    const indexB = sortedCategories.indexOf(b);

                    // If both are in the list, sort by index
                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                    // If only A is in the list, A comes first
                    if (indexA !== -1) return -1;
                    // If only B is in the list, B comes first
                    if (indexB !== -1) return 1;
                    // Otherwise sort alphabetically
                    return a.localeCompare(b);
                  }).map((category) => (
                    <div key={category} className="mb-6 last:mb-0">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                        {category}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {appsByCategory[category].map((app) => (
                          <AppCard
                            key={app.id}
                            app={app}
                            isAdmin={isAdmin && useSharePoint}
                            onView={() => {
                              setSelectedAppForDetails(app);
                              setIsDetailsModalOpen(true);
                            }}
                            onEdit={() => {
                              const sharePointApp = sharePointApps.find(spa => spa.appId === app.id);
                              if (sharePointApp) {
                                setSelectedAppForEdit(sharePointApp);
                                setIsEditModalOpen(true);
                              }
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Show Filtered Apps */}
              {selectedCategory !== 'all' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredApps.map((app) => (
                    <AppCard
                      key={app.id}
                      app={app}
                      isAdmin={isAdmin && useSharePoint}
                      onView={() => {
                        setSelectedAppForDetails(app);
                        setIsDetailsModalOpen(true);
                      }}
                      onEdit={() => {
                        const sharePointApp = sharePointApps.find(spa => spa.appId === app.id);
                        if (sharePointApp) {
                          setSelectedAppForEdit(sharePointApp);
                          setIsEditModalOpen(true);
                        }
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Empty State */}
              {filteredApps.length === 0 && !loading && (
                <div className="text-center py-12 text-gray-500">
                  <Grid3x3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No apps found in this category.</p>
                  {useSharePoint && (
                    <p className="mt-2 text-sm">
                      Apps should be added in SharePoint under the "Applications" list.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Link to all Microsoft 365 apps */}
      <div className="text-center">
        <a
          href="https://www.office.com/apps"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-intranet-primary dark:text-intranet-accent-light hover:text-intranet-primary/80 dark:hover:text-white font-medium transition-colors"
        >
          View all Microsoft 365 apps
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {/* Add App Modal */}
      <AddAppModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          refetch(); // Refresh the apps list
        }}
      />

      {/* Edit App Modal */}
      <EditAppModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedAppForEdit(null);
        }}
        onSuccess={() => {
          refetch(); // Refresh the apps list
        }}
        app={selectedAppForEdit}
      />

      {/* View App Details Modal */}
      <AppDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedAppForDetails(null);
        }}
        app={selectedAppForDetails}
      />
    </div>
  );
};

export default AppsSection;
