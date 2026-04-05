import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  FileText,
  Users,
  Building,
  Settings,
  Computer,
  Scale,
  Plus,
  Filter,
  Eye,
  LucideIcon,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { divisions } from '@/data/divisions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormTemplate as FormTemplateType } from '@/types/forms';
import { useForms } from '@/hooks/useForms';
import { AddGroupDialog } from '@/components/forms/AddGroupDialog';
import { AddFormDialog } from '@/components/forms/AddFormDialog';
import FormsPageSkeleton from '@/components/forms/skeletons/FormsPageSkeleton';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  defaultFormTemplates,
  leaveApplicationTemplate,
  assetRequestTemplate,
  trainingRequestTemplate,
  itRequestTemplate,
  websiteFeedbackTemplate
} from '@/config/formTemplates';

// Form categories based on organizational divisions
interface FormCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  divisionId?: string;
  forms: FormTemplateType[];
}

// Mock form templates - in real implementation, these would come from the database
const mockFormTemplates: FormTemplateType[] = Object.values(defaultFormTemplates);

const formCategories: FormCategory[] = [
  {
    id: 'hr',
    name: 'Human Resources',
    description: 'Employee-related forms and requests',
    icon: Users,
    divisionId: 'corporate-services-division',
    forms: mockFormTemplates.filter(form =>
      ['leave-application', 'overtime-request', 'training-request'].includes(form.id)
    )
  },
  {
    id: 'it',
    name: 'Information Technology',
    description: 'IT services and equipment requests',
    icon: Computer,
    divisionId: 'corporate-services-division',
    forms: mockFormTemplates.filter(form =>
      ['it-equipment-access-request', 'website-upgrade-feedback'].includes(form.id)
    )
  },
  {
    id: 'procurement',
    name: 'Procurement & Finance',
    description: 'Purchase requests and vendor management',
    icon: Building,
    divisionId: 'corporate-services-division',
    forms: mockFormTemplates.filter(form =>
      ['asset-request', 'vendor-registration'].includes(form.id)
    )
  },
  {
    id: 'legal',
    name: 'Legal Services',
    description: 'Legal advice and contract reviews',
    icon: Scale,
    divisionId: 'legal-services-division',
    forms: mockFormTemplates.filter(form =>
      ['legal-advice-request', 'contract-review'].includes(form.id)
    )
  },
  {
    id: 'executive',
    name: 'Executive & Policy',
    description: 'High-level policy and budget requests',
    icon: Settings,
    divisionId: 'executive-division',
    forms: mockFormTemplates.filter(form =>
      ['policy-proposal', 'budget-request'].includes(form.id)
    )
  }
];

const Forms: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedDivision, setSelectedDivision] = useState<string>('');
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);

  const navigate = useNavigate();
  const { isAdmin } = useRoleBasedAuth();
  const { groups: dbGroups, registrations, loading, addGroup, addForm } = useForms();

  // Helper to get Lucide icon from string
  const getIcon = (iconName: string): LucideIcon => {
    const Icon = (LucideIcons as Record<string, unknown>)[iconName] as LucideIcon | undefined;
    return Icon || LucideIcons.FileText;
  };

  // Map database groups to FormCategory
  const dynamicCategories = useMemo(() => {
    return dbGroups.map(group => ({
      id: group.id,
      name: group.title,
      description: group.description,
      icon: getIcon(group.iconName),
      forms: registrations
        .filter(reg => reg.groupId === group.id)
        .map(reg => {
          const template = (defaultFormTemplates as Record<string, any>)[reg.templateId];
          return {
            id: reg.id,
            title: reg.title || template?.title,
            description: reg.description || template?.description,
            status: reg.status,
            estimatedTime: reg.estimatedTime || template?.estimatedTime || '5-10 mins',
            lastUpdated: 'Recently',
            requiredApprovals: template?.approvalSteps?.map((s: { approverRole: string }) => s.approverRole) || []
          } as FormTemplateType;
        })
    }));
  }, [dbGroups, registrations]);

  // Combine hardcoded and dynamic categories (or just use dynamic)
  // For now, let's keep hardcoded if there are no dynamic groups, otherwise use dynamic
  const activeCategories = dynamicCategories.length > 0 ? dynamicCategories : formCategories;

  // Real form templates
  const formTemplates: FormTemplateType[] = [
    leaveApplicationTemplate,
    assetRequestTemplate,
    trainingRequestTemplate,
    itRequestTemplate,
    websiteFeedbackTemplate
  ];

  // Filter forms based on division access and search
  const filteredCategories = useMemo(() => {
    return activeCategories.map(category => {
      // Filter forms within category
      const filteredForms = category.forms.filter(form => {
        // Division filter (hardcoded categories have divisionId, dynamic ones might need one too)
        const matchesDivision = !selectedDivision || category.divisionId === selectedDivision;

        // Search filter
        const matchesSearch = !searchQuery ||
          form.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          form.description.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesDivision && matchesSearch;
      });

      return {
        ...category,
        forms: filteredForms
      };
    }).filter(category =>
      // Only show categories that have forms after filtering
      category.forms.length > 0 ||
      // Or if we're on the specific tab for this category
      activeTab === category.id
    );
  }, [searchQuery, selectedDivision, activeTab, activeCategories]);

  const allForms = useMemo(() => {
    return filteredCategories.flatMap(category => category.forms);
  }, [filteredCategories]);

  const handleFormAccess = (template: FormTemplateType) => {
    navigate(`/forms/fill/${template.id}`);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'draft': return 'secondary';
      case 'archived': return 'outline';
      default: return 'default';
    }
  };

  const FormCard: React.FC<{ form: FormTemplateType }> = ({ form }) => {
    // Find the actual form template
    const template = formTemplates.find(t => t.id === form.id);

    return (
      <Card className="hover:shadow-md transition-shadow cursor-pointer dark:bg-gray-800 dark:border-white/10" onClick={() => template && handleFormAccess(template)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg mb-1 dark:text-gray-100">{form.title}</CardTitle>
              <CardDescription className="text-sm dark:text-gray-400">{form.description}</CardDescription>
            </div>
            <Badge variant={getStatusBadgeVariant(form.status)} className="ml-2">
              {form.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
            <span>⏱️ {form.estimatedTime}</span>
            <span>Updated: {form.lastUpdated}</span>
          </div>

          {form.requiredApprovals && form.requiredApprovals.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground dark:text-gray-500 mb-1">Required Approvals:</p>
              <div className="flex flex-wrap gap-1">
                {form.requiredApprovals.map((approval, index) => (
                  <Badge key={index} variant="outline" className="text-xs dark:border-white/10 dark:text-gray-400">
                    {approval}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" className="flex-1" disabled={!template}>
              <FileText className="w-4 h-4 mr-2" />
              {template ? 'Fill Form' : 'Coming Soon'}
            </Button>
            <Button size="sm" variant="outline" disabled={!template}>
              <Eye className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <PageLayout>
      <div className="space-y-6">
        {/* Header and Controls Row */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2 dark:text-gray-100">Forms</h1>
            <p className="text-muted-foreground dark:text-gray-400">
              Access official forms for various organizational processes and workflows.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
            <div className="relative w-full sm:w-[300px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search forms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full dark:bg-white/5 dark:border-white/10"
              />
            </div>

            <div className="flex gap-2">
              <Select
                value={selectedDivision}
                onValueChange={setSelectedDivision}
              >
                <SelectTrigger className="w-full sm:w-[200px] dark:bg-white/5 dark:border-white/10">
                  <SelectValue placeholder="All Divisions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Divisions</SelectItem>
                  {divisions.map(division => (
                    <SelectItem key={division.id} value={division.id}>
                      {division.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsAddFormOpen(true)}>
                      <FileText className="h-4 w-4 mr-2" />
                      Add New Form
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsAddGroupOpen(true)}>
                      <Users className="h-4 w-4 mr-2" />
                      Create New Group
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <FormsPageSkeleton />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-6 dark:bg-gray-800 dark:border-white/10 p-1">
              <TabsTrigger value="all" className="dark:data-[state=active]:bg-gray-700">All Forms ({allForms.length})</TabsTrigger>
              {activeCategories.map(category => (
                <TabsTrigger key={category.id} value={category.id} className="dark:data-[state=active]:bg-gray-700">
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* All Forms Tab */}
            <TabsContent value="all" className="space-y-6 mt-6">
              {filteredCategories.map(category => (
                <div key={category.id}>
                  <div className="flex items-center gap-3 mb-4">
                    <category.icon className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold dark:text-gray-100">{category.name}</h2>
                    <Badge variant="secondary" className="dark:bg-gray-800 dark:text-gray-400 border-none">{category.forms.length}</Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {category.forms.map(form => (
                      <FormCard key={form.id} form={form} />
                    ))}
                  </div>
                </div>
              ))}

              {allForms.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No forms found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery
                      ? `No forms match your search for "${searchQuery}"`
                      : "No forms are available for your current division selection"
                    }
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Category-specific tabs */}
            {activeCategories.map(category => (
              <TabsContent key={category.id} value={category.id} className="space-y-4 mt-6">
                <div className="flex items-center gap-3 mb-6">
                  <category.icon className="h-6 w-6 text-primary" />
                  <div>
                    <h2 className="text-2xl font-semibold dark:text-gray-100">{category.name}</h2>
                    <p className="text-muted-foreground dark:text-gray-400">{category.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.forms.map(form => (
                    <FormCard key={form.id} form={form} />
                  ))}
                </div>

                {category.forms.length === 0 && (
                  <div className="text-center py-12">
                    <category.icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No {category.name.toLowerCase()} forms available</h3>
                    <p className="text-muted-foreground">
                      Forms for this category will be added soon.
                    </p>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      <AddGroupDialog
        open={isAddGroupOpen}
        onOpenChange={setIsAddGroupOpen}
        onAdd={async (group) => { await addGroup(group); }}
      />
      <AddFormDialog
        open={isAddFormOpen}
        onOpenChange={setIsAddFormOpen}
        groups={dbGroups}
        onAdd={async (form) => { await addForm(form); }}
      />

    </PageLayout>
  );
};

export default Forms;
