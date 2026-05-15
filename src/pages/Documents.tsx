import { useState, useEffect, useMemo, useRef } from 'react';
import { useMsal } from "@azure/msal-react";
import { useMicrosoftGraph, Document } from '@/hooks/useMicrosoftGraph.tsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  FileText, FileSpreadsheet, Presentation, FileImage,
  File, FileArchive, FileCode, Video, Music,
  Folder, ArrowLeft, RefreshCw, LayoutGrid, LayoutList, Info,
  PlusCircle, User, Users, Building, ChevronDown, ChevronRight, Globe,
  FolderOpen, FolderPlus, Calendar, Clock, Download, Pencil, Trash2,
  Upload, ExternalLink, AlertTriangle, X, Check
} from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import AddDocumentModal from '@/components/custom/AddDocumentModal';
import AddCategoryDialog from '@/components/documents/AddCategoryDialog';
import EditCategoryDialog from '@/components/documents/EditCategoryDialog';
import { supabase } from '@/lib/supabaseClient';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { fetchSharedDocuments, uploadSharedDocument, addExternalLink, deleteSharedDocument, SharedDocument } from '@/services/sharedDocumentsService';
import { fetchDocumentCategories, createDocumentCategory, updateDocumentCategory, deleteDocumentCategory, DocumentCategory } from '@/services/documentCategoriesService';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { getGraphClient } from '@/services/graphService';
import DocumentsPageSkeleton from '@/components/documents/skeletons/DocumentsPageSkeleton';

// Define a more comprehensive interface for display purposes
interface DisplayableDocument {
  id: string; // Unique ID (from OneDrive or Supabase)
  name: string; // Display name (file name or title)
  url: string;  // URL to open (webUrl for OneDrive, sharepoint_url for Supabase link)
  lastModified: string; // Date string
  size: number; // File size in bytes
  isFolder?: boolean; // True if it's an OneDrive folder
  source: 'OneDrive' | 'SharePointLink'; // To distinguish the origin
  originalFileName?: string; // For SharePointLink, to help with getFileIcon
  description?: string; // For SharePointLink
  tags?: string; // For SharePointLink
}

interface PathItem {
  id: string;
  name: string;
}

interface DocumentFolder {
  id: string;
  name: string;
  description?: string;
  fileCount: number;
  totalSize: number;
  lastModified: string;
  icon?: React.ReactNode;
  category: string;
  isFolder: boolean;
  sharedWith?: UserAvatar[];
}

interface UserAvatar {
  id: string;
  name: string;
  initials: string;
  color: string;
}

interface MockDocument {
  id: string;
  name: string;
  size: string;
  lastModified: string;
  fileType: string;
  extension: string;
  icon: React.ReactNode;
  sharedWith: UserAvatar[];
  description?: string;
  tags?: string[];
  url?: string;
}

interface DocumentSection {
  id: string;
  name: string;
  description?: string;
  files: MockDocument[];
}

interface CategoryWithFiles {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  fileCount: number;
  totalSize: number;
  lastModified: string;
  category: string;
  isFolder: boolean;
  sharedWith: UserAvatar[];
  recentFiles: MockDocument[];
  sections: DocumentSection[];
}

interface NavigationState {
  currentLevel: 'categories' | 'subcategory' | 'files';
  currentCategoryId: string | null;
  currentSubCategoryName: string | null;
  breadcrumbs: BreadcrumbItem[];
}

interface BreadcrumbItem {
  id: string;
  name: string;
  level: 'root' | 'category' | 'subcategory';
}

// New Primary Tab Structure
const primaryTabsConfig = [
  { id: 'my-documents', label: 'My Documents', icon: <User className="mr-2 h-4 w-4" /> },
  { id: 'company-wide', label: 'Organizational Shared Documents', icon: <Building className="mr-2 h-4 w-4" />, defaultSecondary: 'all-company' },
  { id: 'team-unit', label: 'Team / Unit Documents', icon: <Users className="mr-2 h-4 w-4" />, defaultSecondary: 'team-all' },
  { id: 'external-shared', label: 'External Shared Documents', icon: <Globe className="mr-2 h-4 w-4" />, defaultSecondary: 'all-external' },
];

// --- Data structure for Company-Wide Sub-Categories with Hierarchy ---
interface CompanyWideSubCategoryItem {
  id: string;
  label: string;
  dbSubCategoryValue?: string; // Explicit DB value for fetching, if different from a mapped label
  children?: CompanyWideSubCategoryItem[];
}

const companyWideSubCategories: CompanyWideSubCategoryItem[] = [
  { id: 'all-company', label: 'All Organisational Documents' }, // Remains the default view for all
  {
    id: 'governance-legal-parent',
    label: 'Governance & Legal',
    // This parent is for grouping; does not directly map to a single dbSubCategoryValue unless defined
    children: [
      { id: 'legal-compliance-docs', label: 'Legal & Compliance Documents', dbSubCategoryValue: 'Legal & Compliance Documents' },
      { id: 'regulatory-framework', label: 'Regulatory & Legal Framework' },
      { id: 'internal-compliance', label: 'Internal Compliance Policies & Procedures' },
      { id: 'contracts-agreements', label: 'Contracts & Agreements' },
      { id: 'data-privacy', label: 'Data Privacy & Protection' },
      { id: 'ethics-conduct', label: 'Ethics & Code of Conduct' },
      { id: 'litigation-disputes', label: 'Litigation & Dispute Resolution' },
      { id: 'compliance-audits', label: 'Compliance Audits & Assessments' },
      { id: 'licenses-permits', label: 'Licenses & Permits' },
      { id: 'corp-governance', label: 'Corporate Governance & Board Resolutions' },
      { id: 'legal-opinions', label: 'Legal Opinions & Advice' },
    ]
  },
  {
    id: 'policies-procedures-manuals',
    label: 'Policies, Procedures, Guidelines and Manuals',
    children: [
      { id: 'legal-advisory', label: 'Legal Advisory' },
      { id: 'legal-enforcement', label: 'Legal Enforcement & Compliance' },
      { id: 'licensing', label: 'Licensing' },
      { id: 'supervision', label: 'Supervision' },
      { id: 'investigations', label: 'Investigations' },
      { id: 'research', label: 'Research' },
      { id: 'media-publication', label: 'Media & Publication' },
      { id: 'market-data', label: 'Market Data' },
      { id: 'finance', label: 'Finance' },
      { id: 'hr', label: 'HR' },
      { id: 'investments', label: 'Investments' },
      { id: 'it', label: 'IT' }
    ]
  },
  {
    id: 'comms-branding-parent',
    label: 'Communication & Branding',
    children: [
      { id: 'branding-comms', label: 'Branding & Communications', dbSubCategoryValue: 'Branding & Communications' },
      { id: 'forms', label: 'Forms & Templates', dbSubCategoryValue: 'Forms' },
    ]
  },
  {
    id: 'training-hr-parent',
    label: 'Training & Human Resources',
    children: [
      { id: 'training-dev', label: 'Training & Development Resources', dbSubCategoryValue: 'Training & Development Resources' }
    ]
  },
  {
    id: 'it-systems-parent',
    label: 'IT & Systems',
    children: [
      { id: 'it-system-docs', label: 'IT & System Documentation', dbSubCategoryValue: 'IT & System Documentation' }
    ]
  },
  {
    id: 'strategy-management-parent',
    label: 'Organisational Strategy & Management',
    children: [
      { id: 'corporate-plan', label: 'Corporate & Strategic', dbSubCategoryValue: 'Corporate Plan Documents' },
      { id: 'reports', label: 'Reports', dbSubCategoryValue: 'Reports' },
      { id: 'policies', label: 'Policies & Procedures', dbSubCategoryValue: 'Policies' },
      { id: 'guidelines-procedures', label: 'Guidelines & Procedures', dbSubCategoryValue: 'Guidelines & Procedures' }, // No longer a parent of Training & Dev
    ]
  },
];

// Create a map of Category Label -> SubCategory Labels for the Modal
const companyWideSubCategoryMap: Record<string, string[]> = {};
companyWideSubCategories.forEach(cat => {
  if (cat.id !== 'all-company' && cat.children) {
    companyWideSubCategoryMap[cat.label] = cat.children.map(c => c.label);
  }
});

// Map old scpngSharedSubCategories labels (used in DB) to new IDs if needed for complex cases,
// but dbSubCategoryValue on items is now preferred.
// This map is mainly for ensuring `initialSubCategory` in AddDocumentModal can work if it needs an old label.
const oldLabelToNewIdMap: Record<string, string> = {
  'Policies': 'policies',
  'Forms': 'forms',
  'Corporate Plan Documents': 'corporate-plan',
  'Reports': 'reports',
  'Branding & Communications': 'branding-comms',
  'Guidelines & Procedures': 'guidelines-procedures-parent', // Parent now represents this
  'Training & Development Resources': 'training-dev',
  'IT & System Documentation': 'it-system-docs',
  'Legal & Compliance Documents': 'legal-compliance-parent', // Parent now represents this
  'Historical & Archives': 'historical-archives',
};
// And the reverse (primarily for `AddDocumentModal` if it expects an old sub-category label based on active ID)
const newIdToOldLabelMap: Record<string, string> = Object.fromEntries(
  companyWideSubCategories.flatMap(item => {
    const entries: [string, string][] = [];
    if (item.dbSubCategoryValue) {
      entries.push([item.id, item.dbSubCategoryValue]);
    }
    if (item.children) {
      item.children.forEach(child => {
        if (child.dbSubCategoryValue) {
          entries.push([child.id, child.dbSubCategoryValue]);
        }
      });
    }
    return entries;
  }).filter(([id, label]) => id && label) // Filter out any undefined due to missing dbSubCategoryValue
);


// Define secondary navigation items based on primary tab
// Note: companyWideSubCategories is now the source for 'company-wide'
const secondaryNavConfig: Record<string, { id: string; label: string; sourceCategory?: string; children?: any[] }[]> = {
  'my-documents': [],
  'company-wide': companyWideSubCategories, // Use the new hierarchical structure
  'team-unit': [
    { id: 'team-all', label: 'All Team/Unit Documents' },
    { id: 'division-shared', label: 'Division Shared', sourceCategory: 'Unit Shared' },
  ],
  'external-shared': [
    { id: 'all-external', label: 'All External Documents' },
  ],
};

// For AddDocumentModal, these are the Supabase `shared_category` values
const shareableCategoriesForModal = ['SCPNG Shared Documents', 'Unit Shared'];

// Mock user data for sharing avatars
const mockUsers: UserAvatar[] = [
  { id: '1', name: 'Sarah Mitchell', initials: 'SM', color: 'bg-red-500' },
  { id: '2', name: 'John Davis', initials: 'JD', color: 'bg-blue-500' },
  { id: '3', name: 'Emily Chen', initials: 'EC', color: 'bg-green-500' },
  { id: '4', name: 'Michael Brown', initials: 'MB', color: 'bg-purple-500' },
  { id: '5', name: 'Lisa Anderson', initials: 'LA', color: 'bg-yellow-500' },
  { id: '6', name: 'David Wilson', initials: 'DW', color: 'bg-pink-500' },
  { id: '7', name: 'Rachel Green', initials: 'RG', color: 'bg-indigo-500' },
  { id: '8', name: 'Tom Parker', initials: 'TP', color: 'bg-teal-500' },
];

// Helper function to get random users for sharing
const getRandomSharedUsers = (count: number = 2): UserAvatar[] => {
  const shuffled = [...mockUsers].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Helper function to create mock documents
const createMockDocument = (name: string, extension: string, sizeInMB: number, daysAgo: number, description?: string, tags?: string[]): MockDocument => {
  const getFileIcon = (ext: string) => {
    switch (ext) {
      case 'docx': case 'doc': return <FileText className="h-12 w-12 text-blue-500" />;
      case 'xlsx': case 'xls': return <FileSpreadsheet className="h-12 w-12 text-green-500" />;
      case 'pptx': case 'ppt': return <Presentation className="h-12 w-12 text-red-500" />;
      case 'pdf': return <File className="h-12 w-12 text-red-600" />;
      case 'png': case 'jpg': case 'jpeg': return <FileImage className="h-12 w-12 text-purple-500" />;
      case 'zip': case 'rar': return <FileArchive className="h-12 w-12 text-yellow-500" />;
      default: return <FileText className="h-12 w-12 text-gray-500" />;
    }
  };

  return {
    id: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}`,
    name: `${name}.${extension}`,
    size: `${sizeInMB} MB`,
    lastModified: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toLocaleDateString(),
    fileType: extension.toUpperCase(),
    extension,
    icon: getFileIcon(extension),
    sharedWith: getRandomSharedUsers(Math.floor(Math.random() * 4) + 2),
    description,
    tags
  };
};

// Comprehensive mock data for categories with files
const mockCategoriesWithFiles: Record<string, CategoryWithFiles> = {
  'governance-legal-parent': {
    id: 'governance-legal-parent',
    name: 'Governance & Legal',
    description: '11 subcategories',
    icon: <File className="h-12 w-12 text-red-600" />,
    fileCount: 87,
    totalSize: 342 * 1024 * 1024,
    lastModified: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'company-category',
    isFolder: true,
    sharedWith: getRandomSharedUsers(4),
    recentFiles: [
      createMockDocument('Board Resolution 2024-03', 'pdf', 2.4, 1, 'Latest board meeting resolutions'),
      createMockDocument('Compliance Checklist Q1', 'xlsx', 1.8, 3, 'Quarterly compliance review'),
      createMockDocument('Legal Opinion Securities', 'docx', 3.2, 5, 'Securities law legal opinion'),
      createMockDocument('Regulatory Update March', 'pdf', 1.5, 7, 'Monthly regulatory updates')
    ],
    sections: [
      {
        id: 'board-resolutions',
        name: 'Board Resolutions',
        description: 'Official board meeting minutes and resolutions',
        files: [
          createMockDocument('Board Resolution 2024-03', 'pdf', 2.4, 1, 'March board meeting resolutions', ['board', 'resolution', '2024']),
          createMockDocument('Board Resolution 2024-02', 'pdf', 2.1, 32, 'February board meeting resolutions', ['board', 'resolution', '2024']),
          createMockDocument('Annual Board Meeting 2024', 'docx', 4.2, 45, 'Annual general meeting minutes', ['agm', 'annual', 'minutes']),
          createMockDocument('Emergency Board Resolution', 'pdf', 1.8, 15, 'Emergency meeting resolution', ['emergency', 'urgent']),
          createMockDocument('Quarterly Review Resolution', 'pdf', 2.6, 60, 'Q4 2023 quarterly review', ['quarterly', 'review']),
          createMockDocument('Strategic Planning Resolution', 'pdf', 3.1, 75, 'Strategic planning decisions', ['strategy', 'planning'])
        ]
      },
      {
        id: 'compliance-documents',
        name: 'Compliance Documents',
        description: 'Regulatory compliance and audit materials',
        files: [
          createMockDocument('Compliance Checklist Q1', 'xlsx', 1.8, 3, 'Q1 2024 compliance checklist', ['compliance', 'checklist', 'Q1']),
          createMockDocument('Audit Report 2024', 'pdf', 5.4, 20, 'Annual external audit report', ['audit', 'annual', '2024']),
          createMockDocument('Risk Assessment Matrix', 'xlsx', 2.3, 10, 'Current risk assessment matrix', ['risk', 'assessment']),
          createMockDocument('Compliance Training Manual', 'docx', 6.7, 45, 'Staff compliance training guide', ['training', 'manual']),
          createMockDocument('Internal Controls Review', 'pdf', 3.9, 25, 'Internal controls assessment', ['controls', 'internal']),
          createMockDocument('Regulatory Correspondence', 'pdf', 2.1, 12, 'Communication with regulators', ['regulatory', 'correspondence'])
        ]
      },
      {
        id: 'legal-opinions',
        name: 'Legal Opinions & Advice',
        description: 'External legal counsel opinions and advice',
        files: [
          createMockDocument('Legal Opinion Securities', 'docx', 3.2, 5, 'Securities regulation legal opinion', ['legal', 'securities', 'opinion']),
          createMockDocument('Contract Review Analysis', 'pdf', 2.8, 18, 'Major contract legal review', ['contract', 'review']),
          createMockDocument('Merger Legal Assessment', 'docx', 4.1, 90, 'M&A legal due diligence', ['merger', 'legal', 'due-diligence']),
          createMockDocument('Litigation Risk Analysis', 'pdf', 3.6, 35, 'Potential litigation assessment', ['litigation', 'risk']),
          createMockDocument('Intellectual Property Review', 'docx', 2.9, 55, 'IP portfolio legal review', ['ip', 'intellectual-property'])
        ]
      },
      {
        id: 'corporate-governance',
        name: 'Corporate Governance',
        description: 'Corporate governance policies and procedures',
        files: [
          createMockDocument('Corporate Governance Policy', 'pdf', 4.5, 8, 'Updated corporate governance framework', ['governance', 'policy']),
          createMockDocument('Code of Conduct', 'pdf', 3.2, 120, 'Employee code of conduct', ['code', 'conduct', 'ethics']),
          createMockDocument('Director Independence Policy', 'docx', 2.1, 180, 'Board director independence guidelines', ['director', 'independence']),
          createMockDocument('Whistleblower Policy', 'pdf', 1.9, 90, 'Whistleblower protection procedures', ['whistleblower', 'protection'])
        ]
      }
    ]
  },

  'strategy-management-parent': {
    id: 'strategy-management-parent',
    name: 'Company Strategy & Management',
    description: '4 subcategories',
    icon: <Building className="h-12 w-12 text-blue-600" />,
    fileCount: 65,
    totalSize: 289 * 1024 * 1024,
    lastModified: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'company-category',
    isFolder: true,
    sharedWith: getRandomSharedUsers(5),
    recentFiles: [
      createMockDocument('Strategic Plan 2024-2026', 'pptx', 8.5, 2, 'Three-year strategic roadmap'),
      createMockDocument('Q1 Performance Dashboard', 'xlsx', 3.4, 4, 'Quarterly performance metrics'),
      createMockDocument('Market Analysis Report', 'pdf', 5.2, 6, 'Current market conditions analysis'),
      createMockDocument('Budget Allocation 2024', 'xlsx', 4.1, 8, 'Annual budget distribution')
    ],
    sections: [
      {
        id: 'strategic-plans',
        name: 'Strategic Plans',
        description: 'Long-term strategic planning documents',
        files: [
          createMockDocument('Strategic Plan 2024-2026', 'pptx', 8.5, 2, 'Three-year strategic roadmap', ['strategy', 'planning', '2024-2026']),
          createMockDocument('Digital Transformation Strategy', 'pdf', 6.2, 25, 'Digital transformation roadmap', ['digital', 'transformation']),
          createMockDocument('Market Expansion Plan', 'docx', 4.8, 40, 'New market entry strategy', ['market', 'expansion']),
          createMockDocument('Innovation Strategy 2024', 'pptx', 5.9, 60, 'Innovation and R&D strategy', ['innovation', 'r&d']),
          createMockDocument('Competitive Strategy Analysis', 'pdf', 3.7, 35, 'Competitive landscape analysis', ['competitive', 'analysis'])
        ]
      },
      {
        id: 'performance-reports',
        name: 'Performance Reports',
        description: 'KPI tracking and performance analysis',
        files: [
          createMockDocument('Q1 Performance Dashboard', 'xlsx', 3.4, 4, 'Q1 2024 KPI dashboard', ['performance', 'KPI', 'Q1']),
          createMockDocument('Annual Performance Review 2023', 'pdf', 7.1, 120, '2023 full year performance', ['annual', 'performance', '2023']),
          createMockDocument('Monthly Metrics February', 'xlsx', 2.1, 45, 'February 2024 monthly metrics', ['monthly', 'metrics']),
          createMockDocument('Departmental Performance Analysis', 'pptx', 4.6, 30, 'Department-wise performance review', ['departmental', 'analysis']),
          createMockDocument('Benchmark Comparison Report', 'pdf', 3.8, 20, 'Industry benchmark analysis', ['benchmark', 'industry'])
        ]
      },
      {
        id: 'budget-planning',
        name: 'Budget & Financial Planning',
        description: 'Budget allocations and financial planning',
        files: [
          createMockDocument('Budget Allocation 2024', 'xlsx', 4.1, 8, 'Annual budget distribution', ['budget', '2024', 'allocation']),
          createMockDocument('Capital Expenditure Plan', 'xlsx', 3.5, 15, 'CapEx planning for 2024', ['capex', 'planning']),
          createMockDocument('Financial Forecast 2024-2025', 'pdf', 5.3, 22, 'Two-year financial projections', ['forecast', 'financial']),
          createMockDocument('Cost Optimization Analysis', 'xlsx', 2.8, 35, 'Cost reduction opportunities', ['cost', 'optimization'])
        ]
      },
      {
        id: 'management-reports',
        name: 'Management Reports',
        description: 'Executive and management reporting',
        files: [
          createMockDocument('Executive Summary March', 'pdf', 2.9, 5, 'March 2024 executive briefing', ['executive', 'summary']),
          createMockDocument('Management Committee Minutes', 'docx', 1.8, 12, 'Latest management meeting minutes', ['management', 'minutes']),
          createMockDocument('Risk Management Report', 'pdf', 4.2, 18, 'Enterprise risk management update', ['risk', 'management']),
          createMockDocument('Operational Review Q1', 'pptx', 6.1, 25, 'Q1 operational performance review', ['operational', 'review'])
        ]
      }
    ]
  },

  'comms-branding-parent': {
    id: 'comms-branding-parent',
    name: 'Communication & Branding',
    description: '2 subcategories',
    icon: <FileImage className="h-12 w-12 text-purple-600" />,
    fileCount: 43,
    totalSize: 156 * 1024 * 1024,
    lastModified: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'company-category',
    isFolder: true,
    sharedWith: getRandomSharedUsers(3),
    recentFiles: [
      createMockDocument('Brand Guidelines 2024', 'pdf', 12.3, 1, 'Updated brand identity guidelines'),
      createMockDocument('Press Release Template', 'docx', 1.2, 5, 'Standard press release format'),
      createMockDocument('Marketing Campaign Assets', 'zip', 45.6, 7, 'Q1 marketing campaign materials'),
      createMockDocument('Social Media Style Guide', 'pdf', 3.8, 10, 'Social media branding guidelines')
    ],
    sections: [
      {
        id: 'brand-assets',
        name: 'Brand Assets',
        description: 'Logos, guidelines, and brand materials',
        files: [
          createMockDocument('Brand Guidelines 2024', 'pdf', 12.3, 1, 'Complete brand identity guide', ['brand', 'guidelines']),
          createMockDocument('Logo Package', 'zip', 25.4, 15, 'All logo variations and formats', ['logo', 'assets']),
          createMockDocument('Color Palette Guide', 'pdf', 2.1, 30, 'Official brand color specifications', ['color', 'palette']),
          createMockDocument('Typography Standards', 'pdf', 1.8, 45, 'Brand typography guidelines', ['typography', 'fonts']),
          createMockDocument('Photography Style Guide', 'pdf', 8.9, 60, 'Brand photography standards', ['photography', 'style'])
        ]
      },
      {
        id: 'communications',
        name: 'Communications Materials',
        description: 'Templates, campaigns, and communication assets',
        files: [
          createMockDocument('Press Release Template', 'docx', 1.2, 5, 'Standard PR template', ['press', 'template']),
          createMockDocument('Newsletter Template', 'docx', 2.3, 20, 'Internal newsletter format', ['newsletter', 'template']),
          createMockDocument('Presentation Template', 'pptx', 4.5, 25, 'Standard presentation deck', ['presentation', 'template']),
          createMockDocument('Email Signature Guidelines', 'pdf', 1.1, 40, 'Email signature standards', ['email', 'signature']),
          createMockDocument('Crisis Communication Plan', 'docx', 3.7, 90, 'Crisis communication procedures', ['crisis', 'communication'])
        ]
      }
    ]
  }
};

// Helper function to get appropriate icon for file types
const getFileTypeIcon = (typeName: string) => {
  switch (typeName) {
    case 'Documents':
      return <FileText className="h-12 w-12 text-blue-500" />;
    case 'Spreadsheets':
      return <FileSpreadsheet className="h-12 w-12 text-green-500" />;
    case 'Presentations':
      return <Presentation className="h-12 w-12 text-red-500" />;
    case 'Images':
      return <FileImage className="h-12 w-12 text-purple-500" />;
    default:
      return <File className="h-12 w-12 text-gray-500" />;
  }
};

// Helper function to get category icons
const getCategoryIcon = (_categoryId: string) => {
  return <FolderOpen className="h-12 w-12 text-blue-500" />;
};

// Helper function to get file icon based on document
const getFileIconForDocument = (doc: DisplayableDocument) => {
  const fileName = doc.source === 'SharePointLink' ? doc.originalFileName : doc.name;
  if (!fileName) return <FileText className="h-12 w-12 text-gray-400" />;

  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'doc': case 'docx': return <FileText className="h-12 w-12 text-blue-500" />;
    case 'xls': case 'xlsx': return <FileSpreadsheet className="h-12 w-12 text-green-500" />;
    case 'ppt': case 'pptx': return <Presentation className="h-12 w-12 text-red-500" />;
    case 'jpg': case 'jpeg': case 'png': case 'gif': return <FileImage className="h-12 w-12 text-purple-500" />;
    case 'pdf': return <File className="h-12 w-12 text-red-600" />;
    case 'zip': case 'rar': return <FileArchive className="h-12 w-12 text-yellow-500" />;
    case 'txt': case 'md': return <FileText className="h-12 w-12 text-gray-500" />;
    case 'js': case 'ts': case 'html': case 'css': return <FileCode className="h-12 w-12 text-indigo-500" />;
    case 'mp4': case 'mov': case 'avi': return <Video className="h-12 w-12 text-pink-500" />;
    case 'mp3': case 'wav': case 'aac': return <Music className="h-12 w-12 text-teal-500" />;
    default: return <FileText className="h-12 w-12 text-gray-400" />;
  }
};

// Mock data generator for visual folder representation
const getDocumentFolders = (activePrimaryTab: string, activeSecondaryNav: string, documents: DisplayableDocument[], categories?: CompanyWideSubCategoryItem[]): DocumentFolder[] => {
  if (activePrimaryTab === 'my-documents') {
    // For My Documents, show OneDrive folders as visual cards
    const folders = documents.filter(doc => doc.isFolder);
    const files = documents.filter(doc => !doc.isFolder);

    const folderCards: DocumentFolder[] = folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      description: 'OneDrive folder',
      fileCount: 0, // We don't know the count without fetching contents
      totalSize: 0,
      lastModified: folder.lastModified,
      icon: <FolderOpen className="h-12 w-12 text-blue-500" />,
      category: 'folder',
      isFolder: true
    }));

    // Group files by type for better visualization
    if (files.length > 0) {
      const fileTypes = {
        'Documents': files.filter(f => {
          const ext = f.name.split('.').pop()?.toLowerCase();
          return ['doc', 'docx', 'pdf', 'txt', 'md'].includes(ext || '');
        }),
        'Spreadsheets': files.filter(f => {
          const ext = f.name.split('.').pop()?.toLowerCase();
          return ['xls', 'xlsx', 'csv'].includes(ext || '');
        }),
        'Presentations': files.filter(f => {
          const ext = f.name.split('.').pop()?.toLowerCase();
          return ['ppt', 'pptx'].includes(ext || '');
        }),
        'Images': files.filter(f => {
          const ext = f.name.split('.').pop()?.toLowerCase();
          return ['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext || '');
        }),
        'Other Files': files.filter(f => {
          const ext = f.name.split('.').pop()?.toLowerCase();
          return !['doc', 'docx', 'pdf', 'txt', 'md', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext || '');
        })
      };

      Object.entries(fileTypes).forEach(([typeName, typeFiles]) => {
        if (typeFiles.length > 0) {
          const totalSize = typeFiles.reduce((sum, f) => sum + (f.size || 0), 0);
          const latestModified = typeFiles.reduce((latest, f) => {
            return new Date(f.lastModified) > new Date(latest) ? f.lastModified : latest;
          }, typeFiles[0].lastModified);

          folderCards.push({
            id: typeName.toLowerCase().replace(/\s+/g, '-'),
            name: typeName,
            description: `${typeFiles.length} ${typeFiles.length === 1 ? 'file' : 'files'}`,
            fileCount: typeFiles.length,
            totalSize,
            lastModified: latestModified,
            icon: getFileTypeIcon(typeName),
            category: 'file-group',
            isFolder: false
          });
        }
      });
    }

    return folderCards;
  }

  if (activePrimaryTab === 'company-wide') {
    // Always show all company-wide categories as cards (no more sidebar navigation)
    const cats = categories || companyWideSubCategories;
    return cats.filter(cat => cat.id !== 'all-company').map(category => {
      // Calculate real stats from documents if available
      const categoryDocs = documents.filter(doc => doc.category === category.label);
      const fileCount = categoryDocs.length;
      const totalSize = categoryDocs.reduce((acc, doc) => acc + (doc.size || 0), 0);

      return {
        id: category.id,
        name: category.label,
        description: 'Folder',
        fileCount: fileCount,
        totalSize: totalSize,
        lastModified: new Date().toISOString(), // Could find latest doc date
        icon: getCategoryIcon(category.id),
        category: 'company-category',
        isFolder: true,
        sharedWith: []
      };
    });
  }

  if (activePrimaryTab === 'team-unit') {
    // For team/unit documents, show with prominent sharing indicators
    return [
      {
        id: 'unit-shared-docs',
        name: 'Division Shared Documents',
        description: 'Folder',
        fileCount: Math.floor(Math.random() * 30) + 15,
        totalSize: Math.floor(Math.random() * 200) * 1024 * 1024,
        lastModified: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000).toISOString(),
        icon: <FolderOpen className="h-12 w-12 text-blue-500" />,
        category: 'unit-category',
        isFolder: true,
        sharedWith: getRandomSharedUsers(5) // Show more users for unit documents
      },
      {
        id: 'team-projects',
        name: 'Team Projects',
        description: 'Folder',
        fileCount: Math.floor(Math.random() * 20) + 8,
        totalSize: Math.floor(Math.random() * 150) * 1024 * 1024,
        lastModified: new Date(Date.now() - Math.floor(Math.random() * 5) * 24 * 60 * 60 * 1000).toISOString(),
        icon: <FolderOpen className="h-12 w-12 text-blue-500" />,
        category: 'team-category',
        isFolder: true,
        sharedWith: getRandomSharedUsers(4)
      },
      {
        id: 'department-resources',
        name: 'Department Resources',
        description: 'Folder',
        fileCount: Math.floor(Math.random() * 25) + 12,
        totalSize: Math.floor(Math.random() * 100) * 1024 * 1024,
        lastModified: new Date(Date.now() - Math.floor(Math.random() * 10) * 24 * 60 * 60 * 1000).toISOString(),
        icon: <FolderOpen className="h-12 w-12 text-blue-500" />,
        category: 'department-category',
        isFolder: true,
        sharedWith: getRandomSharedUsers(6) // Show more sharing for department level
      },
      {
        id: 'policies-procedures-manuals',
        name: 'Policies, Procedures, Guidelines and Manuals',
        description: 'Folder',
        fileCount: 0,
        totalSize: 0,
        lastModified: new Date('2026-01-12').toISOString(),
        icon: <FolderOpen className="h-12 w-12 text-blue-500" />,
        category: 'company-category',
        isFolder: true,
        sharedWith: []
      }
    ];
  }

  // Default fallback for other tabs
  return documents.map(doc => ({
    id: doc.id,
    name: doc.name,
    description: doc.description || 'Document',
    fileCount: doc.isFolder ? 0 : 1,
    totalSize: doc.size || 0,
    lastModified: doc.lastModified,
    icon: doc.isFolder ? <FolderOpen className="h-12 w-12 text-blue-500" /> : getFileIconForDocument(doc),
    category: doc.isFolder ? 'folder' : 'document',
    isFolder: doc.isFolder || false
  }));
};


export default function Documents() {
  const {
    getOneDriveDocuments,
    getFolderContents,
    isLoading: isOneDriveLoading,
    handleLogin,
    uploadBinaryFileToSharePoint,
    uploadToOneDrive,
    createOneDriveFolder,
    renameOneDriveItem,
    deleteOneDriveItem,
    moveOneDriveItem,
  } = useMicrosoftGraph();
  const { instance } = useMsal();
  const { user } = useSupabaseAuth();
  const { isAdmin, isSuperAdmin, hasPermission } = useRoleBasedAuth();
  const canAddDocument = isAdmin;

  // Document section CRUD permissions (admins always allowed; non-admins need explicit grant)
  const canUploadOrg    = isAdmin || hasPermission('documents_org', 'upload');
  const canDeleteOrg    = isAdmin || hasPermission('documents_org', 'delete');
  const canUploadExt    = isAdmin || hasPermission('documents_external', 'upload');
  const canDeleteExt    = isAdmin || hasPermission('documents_external', 'delete');
  const canManageOrgCategories = isAdmin || isSuperAdmin;

  const [documents, setDocuments] = useState<DisplayableDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<DisplayableDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [authError, setAuthError] = useState(false);
  const [currentPath, setCurrentPath] = useState<PathItem[]>([]);

  const [activePrimaryTab, setActivePrimaryTab] = useState<string>(primaryTabsConfig[1].id);
  const [activeSecondaryNav, setActiveSecondaryNav] = useState<string>(primaryTabsConfig[1].defaultSecondary);
  const [expandedCompanyWideItems, setExpandedCompanyWideItems] = useState<Record<string, boolean>>({});

  const [isAddDocumentModalOpen, setIsAddDocumentModalOpen] = useState(false);
  const [isAddCategoryDialogOpen, setIsAddCategoryDialogOpen] = useState(false);
  const [isEditCategoryDialogOpen, setIsEditCategoryDialogOpen] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DocumentCategory | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dynamicCategories, setDynamicCategories] = useState<DocumentCategory[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // OneDrive CRUD state
  const [isDriveUploading, setIsDriveUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag-to-folder state
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Rename dialog
  const [renameTarget, setRenameTarget] = useState<DisplayableDocument | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Delete confirm dialog (OneDrive)
  const [deleteTarget, setDeleteTarget] = useState<DisplayableDocument | null>(null);

  // Delete confirm dialog (Org/External SharePoint shared docs)
  const [sharedDocDeleteTarget, setSharedDocDeleteTarget] = useState<MockDocument | null>(null);
  const [isDeletingSharedDoc, setIsDeletingSharedDoc] = useState(false);

  // New folder dialog
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Add subfolder dialog (inside a category)
  const [isAddSubfolderOpen, setIsAddSubfolderOpen] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState('');
  const [isAddingSubfolder, setIsAddingSubfolder] = useState(false);

  // Rename subfolder dialog
  const [renamingSubfolder, setRenamingSubfolder] = useState<string | null>(null);
  const [renameSubfolderValue, setRenameSubfolderValue] = useState('');
  const [isRenamingSubfolder, setIsRenamingSubfolder] = useState(false);

  // Delete subfolder confirm
  const [deletingSubfolder, setDeletingSubfolder] = useState<string | null>(null);
  const [isDeletingSubfolder, setIsDeletingSubfolder] = useState(false);

  // Navigation state for drill-down functionality
  const [navigationState, setNavigationState] = useState<NavigationState>({
    currentLevel: 'categories',
    currentCategoryId: null,
    currentSubCategoryName: null,
    breadcrumbs: []
  });

  // Build the active category list: use dynamic categories if loaded, fall back to hardcoded
  const activeCompanyWideCategories: CompanyWideSubCategoryItem[] = useMemo(() => {
    if (categoriesLoaded && dynamicCategories.length > 0) {
      const allItem: CompanyWideSubCategoryItem = { id: 'all-company', label: 'All Organisational Documents' };
      const dynamicItems: CompanyWideSubCategoryItem[] = dynamicCategories.map(cat => {
        const safeId = cat.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-parent';
        return {
          id: safeId,
          label: cat.title,
          children: cat.subCategories.length > 0
            ? cat.subCategories.map((sub, idx) => ({
              id: `${safeId}-child-${idx}`,
              label: sub,
              dbSubCategoryValue: sub,
            }))
            : undefined,
        };
      });
      return [allItem, ...dynamicItems];
    }
    return companyWideSubCategories;
  }, [dynamicCategories, categoriesLoaded]);

  // Load dynamic categories from SharePoint (auto-creates list if missing)
  const loadCategories = async () => {
    try {
      const client = await getGraphClient(instance);
      if (!client) return;
      const categories = await fetchDocumentCategories(client);
      setDynamicCategories(categories);
      setCategoriesLoaded(true);
    } catch (error: any) {
      // If the list doesn't exist yet, try to create it automatically
      if (error?.statusCode === 404 || error?.message?.includes('does not exist')) {
        console.log('Document_Categories list not found, attempting to create...');
        try {
          const client = await getGraphClient(instance);
          if (!client) return;
          const site = await client.api(`/sites/scpng1.sharepoint.com:/sites/scpngintranet`).get();
          const { SharePointListSetupService } = await import('@/services/sharePointListSetupService');
          const setup = new SharePointListSetupService(client, site.id);
          await setup.createDocumentCategoriesList();
          // Retry fetch after creation
          const categories = await fetchDocumentCategories(client);
          setDynamicCategories(categories);
          setCategoriesLoaded(true);
          return;
        } catch (setupError) {
          console.warn('Could not auto-create Document_Categories list:', setupError);
        }
      }
      console.warn('Could not load dynamic categories, using hardcoded fallback:', error);
      setCategoriesLoaded(false);
    }
  };

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  // Handle creating a new category
  const handleCreateCategory = async (data: { title: string; description: string; sortOrder: number }) => {
    setIsCreatingCategory(true);
    try {
      const client = await getGraphClient(instance);
      if (!client) throw new Error('Could not initialize Graph Client');
      await createDocumentCategory(client, {
        title: data.title,
        description: data.description,
        sortOrder: data.sortOrder,
      });
      toast.success(`Category "${data.title}" created successfully!`);
      setIsAddCategoryDialogOpen(false);
      await loadCategories(); // Refresh the categories list
    } catch (error: any) {
      console.error('Error creating category:', error);
      toast.error(`Failed to create category: ${error.message}`);
    } finally {
      setIsCreatingCategory(false);
    }
  };

  // Handle opening the edit dialog for a category
  const handleEditCategoryClick = (folder: DocumentFolder) => {
    // Find the matching dynamic category by title
    const cat = dynamicCategories.find(c => c.title === folder.name);
    if (cat) {
      setEditingCategory(cat);
      setIsEditCategoryDialogOpen(true);
    } else {
      toast.error('This category cannot be edited (hardcoded fallback).');
    }
  };

  // Handle updating a category
  const handleUpdateCategory = async (data: { title: string; description: string; sortOrder: number }) => {
    if (!editingCategory) return;
    setIsEditingCategory(true);
    try {
      const client = await getGraphClient(instance);
      if (!client) throw new Error('Could not initialize Graph Client');
      await updateDocumentCategory(client, editingCategory.id, {
        title: data.title,
        description: data.description,
        sortOrder: data.sortOrder,
      });
      toast.success(`Category "${data.title}" updated successfully!`);
      setIsEditCategoryDialogOpen(false);
      setEditingCategory(null);
      await loadCategories();
    } catch (error: any) {
      console.error('Error updating category:', error);
      toast.error(`Failed to update category: ${error.message}`);
    } finally {
      setIsEditingCategory(false);
    }
  };

  // Handle deleting (soft-delete) a category
  const handleDeleteCategory = async () => {
    if (!editingCategory) return;
    setIsEditingCategory(true);
    try {
      const client = await getGraphClient(instance);
      if (!client) throw new Error('Could not initialize Graph Client');
      await deleteDocumentCategory(client, editingCategory.id);
      toast.success(`Category "${editingCategory.title}" deleted successfully.`);
      setIsEditCategoryDialogOpen(false);
      setEditingCategory(null);
      await loadCategories();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      toast.error(`Failed to delete category: ${error.message}`);
    } finally {
      setIsEditingCategory(false);
    }
  };

  const handleAddSubfolder = async () => {
    const name = newSubfolderName.trim();
    if (!name || !navigationState.currentCategoryId || !currentCategoryDef) return;
    const cat = dynamicCategories.find(c => c.title === currentCategoryDef.label);
    if (!cat) {
      toast.error('Category not found in SharePoint. Please refresh and try again.');
      return;
    }
    if (cat.subCategories.includes(name)) {
      toast.error(`Subfolder "${name}" already exists in this category.`);
      return;
    }
    setIsAddingSubfolder(true);
    try {
      const client = await getGraphClient(instance);
      if (!client) throw new Error('Could not initialize Graph Client');
      const updatedSubCategories = [...cat.subCategories, name];
      await updateDocumentCategory(client, cat.id, { subCategories: updatedSubCategories });
      toast.success(`Subfolder "${name}" added successfully.`);
      setIsAddSubfolderOpen(false);
      setNewSubfolderName('');
      await loadCategories();
    } catch (error: any) {
      toast.error(`Failed to add subfolder: ${error.message}`);
    } finally {
      setIsAddingSubfolder(false);
    }
  };

  const getCategoryForCurrentView = () =>
    dynamicCategories.find(c => {
      const safeId = c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-parent';
      return safeId === navigationState.currentCategoryId;
    });

  const handleRenameSubfolderConfirm = async () => {
    const newName = renameSubfolderValue.trim();
    if (!newName || !renamingSubfolder) return;
    const cat = getCategoryForCurrentView();
    if (!cat) { toast.error('Category not found. Please refresh.'); return; }
    if (cat.subCategories.includes(newName) && newName !== renamingSubfolder) {
      toast.error(`A subfolder named "${newName}" already exists.`); return;
    }
    setIsRenamingSubfolder(true);
    try {
      const client = await getGraphClient(instance);
      if (!client) throw new Error('Could not initialize Graph Client');
      const updated = cat.subCategories.map(s => s === renamingSubfolder ? newName : s);
      await updateDocumentCategory(client, cat.id, { subCategories: updated });
      toast.success(`Renamed to "${newName}"`);
      setRenamingSubfolder(null);
      setRenameSubfolderValue('');
      await loadCategories();
    } catch (error: any) {
      toast.error(`Failed to rename: ${error.message}`);
    } finally {
      setIsRenamingSubfolder(false);
    }
  };

  const handleDeleteSubfolderConfirm = async () => {
    if (!deletingSubfolder) return;
    const cat = getCategoryForCurrentView();
    if (!cat) { toast.error('Category not found. Please refresh.'); return; }
    setIsDeletingSubfolder(true);
    try {
      const client = await getGraphClient(instance);
      if (!client) throw new Error('Could not initialize Graph Client');
      const updated = cat.subCategories.filter(s => s !== deletingSubfolder);
      await updateDocumentCategory(client, cat.id, { subCategories: updated });
      toast.success(`Subfolder "${deletingSubfolder}" removed.`);
      setDeletingSubfolder(null);
      await loadCategories();
    } catch (error: any) {
      toast.error(`Failed to delete: ${error.message}`);
    } finally {
      setIsDeletingSubfolder(false);
    }
  };

  // Handle delete directly from hover button (opens edit dialog in delete-confirm mode)
  const handleDeleteCategoryClick = (folder: DocumentFolder) => {
    const cat = dynamicCategories.find(c => c.title === folder.name);
    if (cat) {
      setEditingCategory(cat);
      setIsEditCategoryDialogOpen(true);
    }
  };

  const currentSharePointCategoriesForModal = useMemo(() => {
    if (activePrimaryTab === 'company-wide') return ['SCPNG Shared Documents'];
    if (activePrimaryTab === 'team-unit') {
      // Since 'General Shared' is removed as a distinct UI choice,
      // 'Unit Shared' (representing Division Shared) is the main category here.
      return ['Unit Shared'];
    }
    if (activePrimaryTab === 'external-shared') {
      return ['External Shared Documents'];
    }
    return [];
  }, [activePrimaryTab, activeSecondaryNav]);

  const currentSubCategoriesForModal = useMemo(() => {
    // Provides a flat list of all possible DB sub-category *labels* for the modal
    // when 'SCPNG Shared Documents' is the target.
    if (activePrimaryTab === 'company-wide') {
      return activeCompanyWideCategories
        .flatMap(item => item.dbSubCategoryValue ? [item.dbSubCategoryValue] : (item.children?.map(c => c.dbSubCategoryValue).filter(Boolean) || []))
        .filter(Boolean) as string[]; // Ensure only defined strings
    }
    return undefined; // Or an empty array if preferred for other primary tabs
  }, [activePrimaryTab, activeCompanyWideCategories]);

  const modalAvailableCategories = useMemo(() =>
    activeCompanyWideCategories.filter(c => c.id !== 'all-company').map(c => c.label),
    [activeCompanyWideCategories]
  );

  const dynamicSubCategoryMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    activeCompanyWideCategories.forEach(cat => {
      if (cat.id !== 'all-company' && cat.children) {
        map[cat.label] = cat.children.map(c => c.label);
      }
    });
    return map;
  }, [activeCompanyWideCategories]);


  const fetchPersonalDocumentsRoot = async () => {
    setAuthError(false);
    setCurrentPath([]);
    setDocuments([]);
    setIsLoading(true);
    try {
      const odDocs = await getOneDriveDocuments();
      const mappedDocs: DisplayableDocument[] = (odDocs || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        url: item.url || item.webUrl, // Use .url as useMicrosoftGraph returns .url, fallback to webUrl just in case
        lastModified: item.lastModifiedDateTime || item.lastModified,
        size: item.size,
        isFolder: item.isFolder ?? false,
        source: 'OneDrive',
        originalFileName: item.name,
      }));
      mappedDocs.sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        return a.name.localeCompare(b.name);
      });
      setDocuments(mappedDocs);
    } catch (error: any) {
      console.error('fetchPersonalDocumentsRoot Error:', error);
      if (error.message?.includes('No account') || error.message?.includes('Authentication') || error.code === 'UserLoginRequired') {
        setAuthError(true);
        toast.error('Authentication Error for My Documents. Please re-authenticate.');
      } else {
        toast.error(`Failed to fetch My Documents: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const findCategoryById = (id: string, categories: CompanyWideSubCategoryItem[]): CompanyWideSubCategoryItem | null => {
    for (const category of categories) {
      if (category.id === id) return category;
      if (category.children) {
        const foundInChildren = findCategoryById(id, category.children);
        if (foundInChildren) return foundInChildren;
      }
    }
    return null;
  };

  const loadData = async () => {
    console.log(`Loading data for Primary: ${activePrimaryTab}, Secondary: ${activeSecondaryNav}`);
    setSearchQuery('');
    setDocuments([]);
    setCurrentPath([]);
    setAuthError(false);
    setIsLoading(true);

    if (activePrimaryTab === 'my-documents') {
      await fetchPersonalDocumentsRoot();
    } else if (activePrimaryTab === 'company-wide') {
      setIsLoading(true);
      try {
        const client = await getGraphClient(instance);
        if (!client) { setIsLoading(false); return; }

        const sharedDocs = await fetchSharedDocuments(client);

        // Filter based on activeSecondaryNav
        // If secondary nav points to a category or subcategory, filter appropriately
        // However, company-wide tab logic usually wants ALL docs loaded so we can filter locally for speed, 
        // OR if the list is huge, we filter server side. For now, fetch all, filter local.

        const filtered = sharedDocs;

        // Logic to filter if we wanted to restrict what's in 'documents' state based on sidebar.
        // But documents state usually drives the view.
        // If activeSecondaryNav is 'all-company', we show all. 
        // If it's something else, we might filter. 

        const docs: DisplayableDocument[] = sharedDocs.map(d => ({
          id: d.id,
          name: d.name,
          url: d.webUrl,
          lastModified: d.createdDateTime,
          size: d.size,
          isFolder: false,
          source: 'SharePointLink',
          originalFileName: d.name,
          description: d.description,
          tags: d.tags,
          // Store additional metadata for grouping
          category: d.category,
          // @ts-ignore
          subCategory: d.subCategory
        }));

        setDocuments(docs);
      } catch (e: any) {
        console.error("Failed to fetch shared documents", e);
        toast.error("Failed to load organizational documents.");
        setDocuments([]);
      }
    } else if (activePrimaryTab === 'team-unit') {
      try {
        let query = supabase
          .from('company_documents')
          .select('id, title, description, tags, sharepoint_url, file_name, file_type, file_size, created_at, sub_category, shared_category')
          .eq('is_archived', false);

        // Updated logic for 'team-unit' data fetching
        if (activeSecondaryNav === 'team-all' || activeSecondaryNav === 'division-shared') {
          query = query.eq('shared_category', 'Unit Shared');
        } else {
          // Fallback or if more specific team/unit types were added and not handled yet
          console.warn(`Unknown or unhandled secondary nav for team-unit: ${activeSecondaryNav}. Loading no documents.`);
          setDocuments([]);
          setIsLoading(false); return;
        }

        query = query.order('created_at', { ascending: false });
        const { data, error } = await query;
        if (error) throw error;
        const fetchedDocs: DisplayableDocument[] = data.map((doc: any) => ({
          id: doc.id, name: doc.title, url: doc.sharepoint_url, lastModified: doc.created_at,
          size: doc.file_size, isFolder: false, source: 'SharePointLink',
          originalFileName: doc.file_name, description: doc.description, tags: doc.tags,
        }));
        setDocuments(fetchedDocs);
      } catch (error: any) {
        console.error(`Error fetching Team/Unit docs for ${activeSecondaryNav}:`, error);
        toast.error(`Failed to load documents: ${error.message}`);
        setDocuments([]);
      }
    } else if (activePrimaryTab === 'external-shared') {
      setIsLoading(true);
      try {
        const client = await getGraphClient(instance);
        if (!client) { setIsLoading(false); return; }

        const sharedDocs = await fetchSharedDocuments(client);

        // Filter documents specifically for External category
        const externalDocs = sharedDocs.filter(d => d.category === 'External Shared Documents');

        const docs: DisplayableDocument[] = externalDocs.map(d => ({
          id: d.id,
          name: d.name,
          url: d.webUrl,
          lastModified: d.createdDateTime,
          size: d.size,
          isFolder: false,
          source: 'SharePointLink',
          originalFileName: d.name,
          description: d.description,
          tags: d.tags,
          // @ts-ignore
          category: d.category,
          // @ts-ignore
          subCategory: d.subCategory
        }));

        setDocuments(docs);
      } catch (e: any) {
        console.error("Failed to fetch external shared documents", e);
        toast.error("Failed to load external shared documents.");
        setDocuments([]);
      }
    } else {
      console.warn(`Data fetching not implemented for primary tab: ${activePrimaryTab}.`);
      setDocuments([]);
    }
    setIsLoading(false);
  };

  useEffect(() => { loadData(); }, [activePrimaryTab, activeSecondaryNav]);

  useEffect(() => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    const filtered = documents.filter(doc =>
      doc.name.toLowerCase().includes(lowerCaseQuery) ||
      (doc.description && doc.description.toLowerCase().includes(lowerCaseQuery)) ||
      (doc.tags && doc.tags.toLowerCase().includes(lowerCaseQuery)) ||
      (doc.originalFileName && doc.originalFileName.toLowerCase().includes(lowerCaseQuery))
    );
    setFilteredDocuments(filtered);
  }, [searchQuery, documents]);

  const handleReauthenticate = async () => {
    if (activePrimaryTab === 'my-documents' && authError) {
      setAuthError(false);
      await handleLogin();
    } else {
      loadData();
    }
  };

  const navigateToFolder = async (folder: DisplayableDocument) => {
    if (!folder.isFolder || activePrimaryTab !== 'my-documents' || !folder.id) return;
    setIsLoading(true);
    try {
      const folderContentsResult = await getFolderContents(folder.id);
      const mappedContents: DisplayableDocument[] = (folderContentsResult || []).map((item: any) => ({
        id: item.id, name: item.name, url: item.webUrl, lastModified: item.lastModifiedDateTime,
        size: item.size, isFolder: !!item.folder, source: 'OneDrive', originalFileName: item.name,
      }));
      mappedContents.sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1; if (!a.isFolder && b.isFolder) return 1;
        return a.name.localeCompare(b.name);
      });
      setDocuments(mappedContents);
      setCurrentPath(prevPath => [...prevPath, { id: folder.id!, name: folder.name }]);
      setSearchQuery('');
    } catch (error: any) {
      toast.error(`Failed to load folder contents: ${error.message}`);
      if (error.message?.includes('Authentication') || error.code === 'UserLoginRequired') setAuthError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateUp = async () => {
    if (currentPath.length === 0 || activePrimaryTab !== 'my-documents') return;
    setIsLoading(true);
    const newPath = [...currentPath]; newPath.pop();
    try {
      if (newPath.length === 0) {
        await fetchPersonalDocumentsRoot();
      } else {
        const parentFolder = newPath[newPath.length - 1];
        const folderContentsResult = await getFolderContents(parentFolder.id);
        const mappedContents: DisplayableDocument[] = (folderContentsResult || []).map((item: any) => ({
          id: item.id, name: item.name, url: item.webUrl, lastModified: item.lastModifiedDateTime,
          size: item.size, isFolder: !!item.folder, source: 'OneDrive', originalFileName: item.name,
        }));
        mappedContents.sort((a, b) => {
          if (a.isFolder && !b.isFolder) return -1; if (!a.isFolder && b.isFolder) return 1;
          return a.name.localeCompare(b.name);
        });
        setDocuments(mappedContents);
        setCurrentPath(newPath);
        setSearchQuery('');
      }
    } catch (error: any) {
      toast.error(`Failed to load parent folder: ${error.message}`);
      if (error.message?.includes('Authentication') || error.code === 'UserLoginRequired') setAuthError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const getFileIcon = (doc: DisplayableDocument) => {
    const fileName = doc.source === 'SharePointLink' ? doc.originalFileName : doc.name;
    if (!fileName) return <FileText className="h-10 w-10 text-gray-400" />;
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'doc': case 'docx': return <FileText className="h-10 w-10 text-blue-500" />;
      case 'xls': case 'xlsx': return <FileSpreadsheet className="h-10 w-10 text-green-500" />;
      case 'ppt': case 'pptx': return <Presentation className="h-10 w-10 text-red-500" />;
      case 'jpg': case 'jpeg': case 'png': case 'gif': return <FileImage className="h-10 w-10 text-purple-500" />;
      case 'pdf': return <File className="h-10 w-10 text-red-600" />;
      case 'zip': case 'rar': return <FileArchive className="h-10 w-10 text-yellow-500" />;
      case 'txt': case 'md': return <FileText className="h-10 w-10 text-gray-500" />;
      case 'js': case 'ts': case 'html': case 'css': return <FileCode className="h-10 w-10 text-indigo-500" />;
      case 'mp4': case 'mov': case 'avi': return <Video className="h-10 w-10 text-pink-500" />;
      case 'mp3': case 'wav': case 'aac': return <Music className="h-10 w-10 text-teal-500" />;
      default: return <FileText className="h-10 w-10 text-gray-400" />;
    }
  };

  const formatFileSize = (bytes: number | undefined) => {
    if (bytes === undefined || bytes === 0) return '0 B';
    const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const handlePrimaryTabChange = (tabId: string) => {
    if (isUploading || isLoading) return;
    setActivePrimaryTab(tabId);
    const tabConfig = primaryTabsConfig.find(t => t.id === tabId);
    setActiveSecondaryNav(tabConfig?.defaultSecondary || secondaryNavConfig[tabId]?.[0]?.id || '');
    setExpandedCompanyWideItems({}); // Collapse all on primary tab change

    // Reset navigation state when changing primary tabs
    setNavigationState({
      currentLevel: 'categories',
      currentCategoryId: null,
      currentSubCategoryName: null,
      breadcrumbs: []
    });
  };

  const handleSecondaryNavChange = (navId: string, isParentToggle: boolean = false) => {
    if (isUploading || isLoading) return;

    const item = findCategoryById(navId, activeCompanyWideCategories);

    if (item && item.children && item.children.length > 0) { // It's a parent item
      setExpandedCompanyWideItems(prev => ({ ...prev, [navId]: !prev[navId] }));
      // If only toggling, don't change activeSecondaryNav unless it's explicitly set or no child is active
      // For now, clicking a parent always makes it active.
    }
    // Always set the clicked item (parent or child) as active
    setActiveSecondaryNav(navId);
  };


  const handleShareDocument = async (documentData: {
    title: string;
    description: string;
    tags?: string;
    file?: File | null;
    url?: string | null;
    category: string;
    subCategory?: string | null;
    type: 'file' | 'link';
  }) => {
    const activeAccount = instance.getActiveAccount();
    if (documentData.type === 'file' && !documentData.file && !activeAccount) {
      toast.error(activeAccount ? 'No file selected.' : 'User not authenticated with Microsoft 365.'); return;
    }
    if (documentData.type === 'link' && !documentData.url && !activeAccount) {
      toast.error(activeAccount ? 'No URL provided.' : 'User not authenticated with Microsoft 365.'); return;
    }

    setIsUploading(true);
    toast.loading(documentData.type === 'file' ? 'Uploading document...' : 'Adding external link...');

    try {
      const client = await getGraphClient(instance);
      if (!client) throw new Error("Could not initialize Graph Client");

      if (documentData.type === 'file' && documentData.file) {
        await uploadSharedDocument(client, documentData.file, {
          category: documentData.category,
          subCategory: documentData.subCategory || undefined,
          description: documentData.description,
          tags: documentData.tags
        });
      } else if (documentData.type === 'link' && documentData.url) {
        await addExternalLink(client, {
          title: documentData.title,
          url: documentData.url,
          category: documentData.category,
          subCategory: documentData.subCategory || undefined,
          description: documentData.description,
          tags: documentData.tags
        });
      }

      toast.dismiss();
      toast.success(documentData.type === 'file' ? 'Document shared successfully!' : 'External link added successfully!');
      setIsAddDocumentModalOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error sharing document:', error);
      toast.dismiss();
      toast.error(`Failed to share document: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const currentPrimaryTabConfig = primaryTabsConfig.find(t => t.id === activePrimaryTab);
  const searchPlaceholder = currentPrimaryTabConfig ? `Search in ${currentPrimaryTabConfig.label}...` : 'Search documents...';

  const renderCompanyWideNav = (items: CompanyWideSubCategoryItem[], level = 0) => {
    return items.map(navItem => (
      <div key={navItem.id}>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleSecondaryNavChange(navItem.id)}
                disabled={isLoading || isUploading}
                className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors
                            ${activeSecondaryNav === navItem.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'}
                            ${level > 0 ? 'pl-9' : ''} group`}
              >
                {navItem.children && navItem.children.length > 0 && (
                  expandedCompanyWideItems[navItem.id] ?
                    <ChevronDown className="h-4 w-4 mr-2 flex-shrink-0 transform group-hover:text-foreground" /> :
                    <ChevronRight className="h-4 w-4 mr-2 flex-shrink-0 transform group-hover:text-foreground" />
                )}
                <span className="truncate flex-1 text-left">{navItem.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" align="start">
              <p>{navItem.label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {navItem.children && expandedCompanyWideItems[navItem.id] && (
          <div className="mt-1 space-y-1">
            {renderCompanyWideNav(navItem.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  // Breadcrumb component
  const BreadcrumbNavigation = ({ breadcrumbs, onBreadcrumbClick }: {
    breadcrumbs: BreadcrumbItem[];
    onBreadcrumbClick: (breadcrumb: BreadcrumbItem) => void
  }) => (
    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-6 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border dark:border-white/10">
      {breadcrumbs.map((breadcrumb, index) => (
        <div key={breadcrumb.id} className="flex items-center gap-2">
          <button
            onClick={() => onBreadcrumbClick(breadcrumb)}
            className="text-primary dark:text-blue-400 hover:text-primary/80 hover:underline font-medium"
          >
            {breadcrumb.name}
          </button>
          {index < breadcrumbs.length - 1 && (
            <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-600" />
          )}
        </div>
      ))}
    </div>
  );


  // File card component for individual documents
  const FileCard = ({ file, onClick }: { file: MockDocument; onClick: (file: MockDocument) => void }) => (
    <Card
      className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10"
      onClick={() => onClick(file)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-shrink-0 mr-3">
            {file.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm line-clamp-2 mb-1" title={file.name}>
              {file.name}
            </h4>
            {file.description && (
              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">{file.description}</p>
            )}
          </div>
        </div>

        <div className="space-y-1 text-xs text-gray-500 dark:text-gray-500 mb-3">
          <div className="flex items-center justify-between">
            <span>{file.size}</span>
            <span>{file.lastModified}</span>
          </div>
        </div>

        {/* File tags */}
        {file.tags && file.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {file.tags.slice(0, 3).map((tag, index) => (
              <span key={index} className="px-2 py-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-full text-xs border dark:border-white/10">
                {tag}
              </span>
            ))}
            {file.tags.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-full text-xs">
                +{file.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Shared with avatars */}
        {file.sharedWith && file.sharedWith.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/5">
            <span className="text-xs text-gray-400 dark:text-gray-500">Shared with:</span>
            <div className="flex -space-x-1">
              {file.sharedWith.slice(0, 3).map((user, index) => (
                <div
                  key={user.id}
                  className={`w-5 h-5 rounded-full ${user.color} text-white text-xs font-medium flex items-center justify-center border border-white dark:border-gray-800 relative`}
                  title={user.name}
                  style={{ zIndex: 10 - index }}
                >
                  {user.initials}
                </div>
              ))}
              {file.sharedWith.length > 3 && (
                <div className="w-5 h-5 rounded-full bg-gray-400 text-white text-xs font-medium flex items-center justify-center border border-white dark:border-gray-800">
                  +{file.sharedWith.length - 3}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );


  // New component for visual document/folder cards
  const DocumentFolderCard = ({ folder, onClick, onEdit, onDelete, showAdminActions, onRename, onDriveDelete, showDriveActions, isDragTarget, onDragOver, onDragLeave, onDrop }: {
    folder: DocumentFolder;
    onClick: (folder: DocumentFolder) => void;
    onEdit?: (folder: DocumentFolder) => void;
    onDelete?: (folder: DocumentFolder) => void;
    showAdminActions?: boolean;
    onRename?: (folder: DocumentFolder) => void;
    onDriveDelete?: (folder: DocumentFolder) => void;
    showDriveActions?: boolean;
    isDragTarget?: boolean;
    onDragOver?: (e: React.DragEvent) => void;
    onDragLeave?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
  }) => (
    <Card
      className={`group relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md bg-white dark:bg-gray-800 border shadow-sm ${isDragTarget ? 'border-primary border-2 bg-primary/5 dark:bg-primary/10 scale-[1.02]' : 'border-gray-200/60 dark:border-white/10'}`}
      onClick={() => onClick(folder)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Hover action buttons - top right */}
      {showDriveActions && (
        <div className="absolute top-3 right-3 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          {onRename && (
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRename(folder); }}
              className="p-1.5 rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-white/10 hover:bg-primary hover:text-white transition-all"
              title="Rename">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDriveDelete && (
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDriveDelete(folder); }}
              className="p-1.5 rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-white/10 hover:bg-red-600 hover:text-white transition-all"
              title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {showAdminActions && (folder.category === 'company-category' || folder.category === 'company-subcategory') && (
        <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
          {onEdit && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(folder); }}
              className="p-1.5 rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-white/10 hover:bg-primary hover:text-white dark:hover:bg-primary transition-all opacity-0 group-hover:opacity-100"
              title="Edit category">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(folder); }}
              className="p-1.5 rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-white/10 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100"
              title="Delete category">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-shrink-0 mr-4">
            {folder.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 truncate mb-1" title={folder.name}>
              {folder.name}
            </h3>
            {folder.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">{folder.description}</p>
            )}
          </div>
        </div>

        <div className="space-y-2 text-sm text-gray-500 dark:text-gray-500">
          {folder.fileCount > 0 && (
            <div className="flex items-center gap-2">
              <File className="h-4 w-4" />
              <span>{folder.fileCount} {folder.fileCount === 1 ? 'file' : 'files'}</span>
            </div>
          )}

          {folder.totalSize > 0 && (
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              <span>{formatFileSize(folder.totalSize)}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>{formatDate(folder.lastModified)}</span>
          </div>
        </div>

      </CardContent>
    </Card>
  );


  // List-view row for folders
  const DocumentFolderRow = ({ folder, onClick, onEdit, onDelete, showAdminActions, onRename, onDriveDelete, showDriveActions, isDragTarget, onDragOver, onDragLeave, onDrop }: {
    folder: DocumentFolder;
    onClick: (folder: DocumentFolder) => void;
    onEdit?: (folder: DocumentFolder) => void;
    onDelete?: (folder: DocumentFolder) => void;
    showAdminActions?: boolean;
    onRename?: (folder: DocumentFolder) => void;
    onDriveDelete?: (folder: DocumentFolder) => void;
    showDriveActions?: boolean;
    isDragTarget?: boolean;
    onDragOver?: (e: React.DragEvent) => void;
    onDragLeave?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
  }) => (
    <div
      className={`group flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-800 border rounded-lg cursor-pointer hover:shadow-md transition-all ${isDragTarget ? 'border-primary border-2 bg-primary/5 dark:bg-primary/10 scale-[1.01]' : 'border-gray-200/60 dark:border-white/10'}`}
      onClick={() => onClick(folder)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex-shrink-0">
        <FolderOpen className="h-8 w-8 text-blue-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate" title={folder.name}>{folder.name}</p>
        {folder.description && folder.description !== 'Folder' && (
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{folder.description}</p>
        )}
      </div>
      <div className="hidden sm:flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
        {folder.fileCount > 0 && (
          <span className="flex items-center gap-1.5">
            <File className="h-4 w-4" />
            {folder.fileCount} {folder.fileCount === 1 ? 'file' : 'files'}
          </span>
        )}
        {folder.totalSize > 0 && (
          <span className="flex items-center gap-1.5">
            <Download className="h-4 w-4" />
            {formatFileSize(folder.totalSize)}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          {formatDate(folder.lastModified)}
        </span>
      </div>
      {showDriveActions && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {onRename && (
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRename(folder); }}
              className="p-1.5 rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-white/10 hover:bg-primary hover:text-white transition-all"
              title="Rename">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDriveDelete && (
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDriveDelete(folder); }}
              className="p-1.5 rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-white/10 hover:bg-red-600 hover:text-white transition-all"
              title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {showAdminActions && (folder.category === 'company-category' || folder.category === 'company-subcategory') && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {onEdit && (
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(folder); }}
              className="p-1.5 rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-white/10 hover:bg-primary hover:text-white transition-all"
              title="Edit category">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(folder); }}
              className="p-1.5 rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-white/10 hover:bg-red-600 hover:text-white transition-all"
              title="Delete category">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );

  const handleFolderClick = (folder: DocumentFolder) => {
    if (activePrimaryTab === 'my-documents' && folder.isFolder) {
      // Handle OneDrive folder navigation (existing functionality)
      const doc = documents.find(d => d.id === folder.id);
      if (doc) {
        navigateToFolder(doc);
      }
    } else if (folder.category === 'company-category') {
      // Drill into subfolder list
      setNavigationState({
        currentLevel: 'subcategory',
        currentCategoryId: folder.id,
        currentSubCategoryName: null,
        breadcrumbs: [
          { id: 'root', name: 'Document Categories', level: 'root' },
          { id: folder.id, name: folder.name, level: 'category' }
        ]
      });
    } else if (folder.category === 'company-subcategory') {
      // Drill into files within a subfolder
      setNavigationState(prev => ({
        currentLevel: 'files',
        currentCategoryId: prev.currentCategoryId,
        currentSubCategoryName: folder.name,
        breadcrumbs: [
          { id: 'root', name: 'Document Categories', level: 'root' },
          { id: prev.currentCategoryId!, name: prev.breadcrumbs.find(b => b.level === 'category')?.name || '', level: 'category' },
          { id: folder.name, name: folder.name, level: 'subcategory' }
        ]
      }));
    } else if (folder.category === 'document') {
      // Open the document
      const doc = documents.find(d => d.id === folder.id);
      if (doc) {
        window.open(doc.url, '_blank');
      }
    }
  };

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = (breadcrumb: BreadcrumbItem) => {
    if (breadcrumb.level === 'root') {
      setNavigationState({
        currentLevel: 'categories',
        currentCategoryId: null,
        currentSubCategoryName: null,
        breadcrumbs: []
      });
    } else if (breadcrumb.level === 'category') {
      // Go back up to the subfolder list for this category
      setNavigationState({
        currentLevel: 'subcategory',
        currentCategoryId: breadcrumb.id,
        currentSubCategoryName: null,
        breadcrumbs: [
          { id: 'root', name: 'Document Categories', level: 'root' },
          { id: breadcrumb.id, name: breadcrumb.name, level: 'category' }
        ]
      });
    }
  };

  // Handle file click (open document)
  // Handle file click (open document)
  const handleFileClick = (file: MockDocument | any) => {
    const fileUrl = file.url || file.webUrl;
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    } else {
      toast.error('Cannot open file: URL not found.');
      console.error('File missing URL:', file);
    }
  };

  // ── OneDrive CRUD helpers ──────────────────────────────────────────────────

  /** Returns the OneDrive parent item ID for the current location */
  const currentOneDriveParentId = (): string | 'root' => {
    if (currentPath.length === 0) return 'root';
    return currentPath[currentPath.length - 1].id;
  };

  /** Refresh the current OneDrive folder view after a mutation */
  const refreshCurrentFolder = async () => {
    const parentId = currentOneDriveParentId();
    if (parentId === 'root') {
      await fetchPersonalDocumentsRoot();
    } else {
      const items = await getFolderContents(parentId);
      const mapped: DisplayableDocument[] = (items || []).map((item: any) => ({
        id: item.id, name: item.name, url: item.webUrl,
        lastModified: item.lastModifiedDateTime, size: item.size,
        isFolder: !!item.folder, source: 'OneDrive', originalFileName: item.name,
      }));
      mapped.sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        return a.name.localeCompare(b.name);
      });
      setDocuments(mapped);
    }
  };

  /** Handle file input change (upload button) */
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsDriveUploading(true);
    for (const file of files) {
      setUploadProgress(`Uploading ${file.name}…`);
      const result = await uploadToOneDrive(file, currentOneDriveParentId());
      if (result) {
        toast.success(`"${file.name}" uploaded successfully`);
      }
    }
    setUploadProgress(null);
    setIsDriveUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await refreshCurrentFolder();
  };

  /** Handle drag-and-drop upload */
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (activePrimaryTab !== 'my-documents') return;
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    setIsDriveUploading(true);
    for (const file of files) {
      setUploadProgress(`Uploading ${file.name}…`);
      const result = await uploadToOneDrive(file, currentOneDriveParentId());
      if (result) toast.success(`"${file.name}" uploaded successfully`);
    }
    setUploadProgress(null);
    setIsDriveUploading(false);
    await refreshCurrentFolder();
  };

  /** Handle dropping a file onto a folder to move it */
  const handleMoveToFolder = async (fileId: string, fileName: string, folderId: string, folderName: string) => {
    setIsDriveUploading(true);
    setUploadProgress(`Moving "${fileName}" to "${folderName}"…`);
    const ok = await moveOneDriveItem(fileId, folderId);
    if (ok) toast.success(`"${fileName}" moved to "${folderName}"`);
    setUploadProgress(null);
    setIsDriveUploading(false);
    await refreshCurrentFolder();
  };

  /** Create a new folder */
  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setIsDriveUploading(true);
    const result = await createOneDriveFolder(name, currentOneDriveParentId());
    if (result) toast.success(`Folder "${name}" created`);
    setIsNewFolderOpen(false);
    setNewFolderName('');
    setIsDriveUploading(false);
    await refreshCurrentFolder();
  };

  /** Confirm rename */
  const handleRenameConfirm = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    setIsDriveUploading(true);
    const ok = await renameOneDriveItem(renameTarget.id, renameValue.trim());
    if (ok) toast.success(`Renamed to "${renameValue.trim()}"`);
    setRenameTarget(null);
    setRenameValue('');
    setIsDriveUploading(false);
    await refreshCurrentFolder();
  };

  /** Confirm delete */
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDriveUploading(true);
    const ok = await deleteOneDriveItem(deleteTarget.id);
    if (ok) toast.success(`"${deleteTarget.name}" moved to recycle bin`);
    setDeleteTarget(null);
    setIsDriveUploading(false);
    await refreshCurrentFolder();
  };

  /** Delete a document from the Org/External SharePoint shared documents list */
  const handleSharedDocDeleteConfirm = async () => {
    if (!sharedDocDeleteTarget) return;
    setIsDeletingSharedDoc(true);
    try {
      const client = await getGraphClient(instance);
      if (!client) throw new Error('Failed to initialize Graph client');
      await deleteSharedDocument(client, sharedDocDeleteTarget.id);
      toast.success(`"${sharedDocDeleteTarget.name}" deleted successfully`);
      setSharedDocDeleteTarget(null);
      // Refresh the documents list
      setIsLoading(true);
      try {
        const sharedDocs = await fetchSharedDocuments(client);
        const mapped: DisplayableDocument[] = sharedDocs.map(d => ({
          id: d.id, name: d.name, url: d.webUrl, lastModified: d.createdDateTime,
          size: d.size, isFolder: false, source: 'SharePoint' as const,
          description: d.description, tags: d.tags,
          ...(d as any)
        }));
        setDocuments(mapped);
      } finally {
        setIsLoading(false);
      }
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message}`);
    } finally {
      setIsDeletingSharedDoc(false);
    }
  };

  // ── End OneDrive CRUD helpers ──────────────────────────────────────────────

  // Generate folder representation of current data
  const documentFolders = useMemo(() => {
    if (navigationState.currentLevel !== 'categories') return [];
    return getDocumentFolders(activePrimaryTab, activeSecondaryNav, filteredDocuments, activeCompanyWideCategories);
  }, [activePrimaryTab, activeSecondaryNav, filteredDocuments, navigationState.currentLevel, activeCompanyWideCategories]);

  // --- Subcategory level: folder cards for each subfolder inside a category ---
  const currentSubfolderCards = useMemo((): DocumentFolder[] => {
    if (navigationState.currentLevel !== 'subcategory' || !navigationState.currentCategoryId) return [];
    const categoryDef = activeCompanyWideCategories.find(c => c.id === navigationState.currentCategoryId);
    if (!categoryDef) return [];
    const subNames = categoryDef.children?.map(c => c.label) || [];
    return subNames.map(name => {
      const docsInSub = documents.filter(d => (d as any).subCategory === name);
      return {
        id: name,
        name,
        description: `${docsInSub.length} document${docsInSub.length !== 1 ? 's' : ''}`,
        fileCount: docsInSub.length,
        totalSize: docsInSub.reduce((a, b) => a + (b.size || 0), 0),
        lastModified: docsInSub[0]?.lastModified || new Date().toISOString(),
        icon: <FolderOpen className="h-12 w-12 text-blue-500" />,
        category: 'company-subcategory',
        isFolder: true,
        sharedWith: [],
      } as DocumentFolder;
    });
  }, [navigationState, documents, activeCompanyWideCategories]);

  // Current category name/label for use in headers
  const currentCategoryDef = useMemo(() => {
    if (!navigationState.currentCategoryId) return null;
    return activeCompanyWideCategories.find(c => c.id === navigationState.currentCategoryId) || null;
  }, [navigationState.currentCategoryId, activeCompanyWideCategories]);

  // --- Files level: documents inside a specific subfolder ---
  const currentCategoryData = useMemo(() => {
    if (navigationState.currentLevel === 'files' && navigationState.currentCategoryId) {
      const categoryDef = activeCompanyWideCategories.find(c => c.id === navigationState.currentCategoryId);
      if (!categoryDef) return null;
      const subName = navigationState.currentSubCategoryName;
      // New schema: category = org label (e.g. "Training & Human Resources"), subCategory = subfolder name
      // Old schema: category = 'SCPNG Shared Documents', subCategory = org label — treat as belonging here
      const scopedDocs = subName
        ? documents.filter(d =>
            // new schema: category matches org label AND subCategory matches subfolder
            ((d as any).category === categoryDef.label && (d as any).subCategory === subName) ||
            // old schema: subCategory matches subfolder name directly
            ((d as any).category !== categoryDef.label && (d as any).subCategory === subName)
          )
        : documents.filter(d =>
            // no subfolder: just category matches with no subCategory set
            (d as any).category === categoryDef.label && !(d as any).subCategory
          );
      const files = scopedDocs.map(d => ({
        id: d.id, name: d.name, size: formatFileSize(d.size), lastModified: formatDate(d.lastModified),
        fileType: d.name.split('.').pop()?.toUpperCase() || '', extension: d.name.split('.').pop() || '',
        icon: getFileIconForDocument(d), sharedWith: [], description: d.description,
        tags: d.tags ? d.tags.split(',') : [], url: d.url,
      }));
      return {
        id: subName || 'general',
        name: subName || 'General',
        categoryName: categoryDef.label,
        files,
      };
    }
    return null;
  }, [navigationState, documents, activeCompanyWideCategories]);


  console.log('DEBUG: Rendering Documents. ActiveTab:', activePrimaryTab, 'CanAdd:', canAddDocument);

  return (
    <PageLayout>
      <div className="mb-6 animate-fade-in flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2 dark:text-gray-100">Document Management System</h1>
          <p className="text-gray-500 dark:text-gray-400">Access and manage organisational and personal documents</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <button 
                className="p-2 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-primary hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                title="System Information"
                aria-label="System Information"
              >
                <Info className="h-4 w-4" />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto w-full md:w-[600px] border border-gray-200 dark:border-white/10 p-0 shadow-2xl">
              <div className="p-6">
                <DialogHeader>
                  <DialogTitle className="text-xl">Document Management System</DialogTitle>
                  <DialogDescription className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mt-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                    Store, browse, and manage your personal OneDrive files, organisational shared documents, team/unit resources, and external shared links — all in one place.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="py-2 space-y-6 mt-4">
                  {/* Tabs key */}
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4 text-primary" /> Sections
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { icon: <User className="h-4 w-4 text-blue-500" />, label: 'My Documents', desc: 'Your personal OneDrive files & folders' },
                        { icon: <Building className="h-4 w-4 text-green-500" />, label: 'Organisational', desc: 'Company-wide shared documents' },
                        { icon: <Users className="h-4 w-4 text-purple-500" />, label: 'Team / Unit', desc: 'Documents shared within your team' },
                        { icon: <Globe className="h-4 w-4 text-orange-500" />, label: 'External', desc: 'Documents shared with external parties' },
                      ].map(item => (
                        <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <span className="mt-0.5 flex-shrink-0 bg-white dark:bg-gray-900 p-1.5 rounded-md shadow-sm border border-gray-100 dark:border-gray-800">{item.icon}</span>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-none mb-1">{item.label}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 leading-snug">{item.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-800 to-transparent" />
                  
                  {/* File type icon key */}
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" /> Supported File Types
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { icon: <FolderOpen className="h-4 w-4 text-blue-500" />, label: 'Folder' },
                        { icon: <FileText className="h-4 w-4 text-blue-500" />, label: 'Word Doc' },
                        { icon: <FileSpreadsheet className="h-4 w-4 text-green-500" />, label: 'Spreadsheet' },
                        { icon: <Presentation className="h-4 w-4 text-red-500" />, label: 'Presentation' },
                        { icon: <File className="h-4 w-4 text-red-600" />, label: 'PDF' },
                        { icon: <FileImage className="h-4 w-4 text-purple-500" />, label: 'Image' },
                        { icon: <FileArchive className="h-4 w-4 text-yellow-500" />, label: 'Archive / ZIP' },
                        { icon: <FileCode className="h-4 w-4 text-indigo-500" />, label: 'Code File' },
                        { icon: <Video className="h-4 w-4 text-pink-500" />, label: 'Video' },
                        { icon: <Music className="h-4 w-4 text-teal-500" />, label: 'Audio' },
                        { icon: <FileText className="h-4 w-4 text-gray-400" />, label: 'Other/Text' },
                      ].map(item => (
                        <div key={item.label} className="flex items-center gap-2.5 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <div className="bg-white dark:bg-gray-900 p-1.5 rounded-md border border-gray-100 dark:border-gray-800 shadow-sm">
                            {item.icon}
                          </div>
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-800 to-transparent" />

                  {/* Key Risks & Considerations */}
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" /> Key Risks &amp; Considerations
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      These apply to <span className="font-medium text-gray-700 dark:text-gray-300">My Documents</span> (OneDrive) upload, rename, and delete operations.
                    </p>
                    <div className="space-y-2">
                      {[
                        {
                          risk: 'Files over 4 MB',
                          mitigation: 'Automatically switches to a chunked upload session — no action needed from you.',
                          color: 'text-blue-600 dark:text-blue-400',
                          bg: 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30',
                        },
                        {
                          risk: 'Deleting a folder with contents',
                          mitigation: 'The entire folder and all its files move to your OneDrive recycle bin — recoverable for 30 days.',
                          color: 'text-red-600 dark:text-red-400',
                          bg: 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30',
                        },
                        {
                          risk: 'Renaming and changing the file extension',
                          mitigation: 'The file is renamed as typed. If you remove or change the extension (e.g. .docx → .txt) the file may become unreadable — double-check before confirming.',
                          color: 'text-amber-600 dark:text-amber-400',
                          bg: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30',
                        },
                        {
                          risk: 'Auth token expiry during large uploads',
                          mitigation: 'The app silently re-authenticates in the background. If that fails you will see a pop-up to sign in again — the upload will resume after.',
                          color: 'text-purple-600 dark:text-purple-400',
                          bg: 'bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30',
                        },
                        {
                          risk: 'Rate limiting on bulk operations',
                          mitigation: 'Not a concern for single-item actions. If you upload many large files in rapid succession, briefly pause between uploads.',
                          color: 'text-gray-600 dark:text-gray-400',
                          bg: 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800',
                        },
                      ].map(item => (
                        <div key={item.risk} className={`flex items-start gap-3 p-3 rounded-lg border ${item.bg}`}>
                          <AlertTriangle className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${item.color}`} />
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold leading-none mb-1 ${item.color}`}>{item.risk}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-snug">{item.mitigation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          {/* View toggle */}
          <div className="flex items-center border border-gray-200 dark:border-white/10 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              title="List view"
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={loadData} variant="outline" disabled={isUploading || isLoading} className="dark:border-white/10 dark:hover:bg-gray-800">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>


      <Tabs value={activePrimaryTab} onValueChange={handlePrimaryTabChange} className="w-full">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 w-full px-0.5 md:pr-1.5">

          <TabsList className="dark:bg-gray-800/50 dark:border dark:border-white/10 p-1">
            {primaryTabsConfig.map(tab => (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id} 
                disabled={isLoading || isUploading}
                className="dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100 dark:text-gray-400"
              >
                {tab.icon} {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex items-center gap-2">
            <Input
              placeholder={searchPlaceholder} value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-[300px] dark:bg-white/5 dark:border-white/10 dark:placeholder:text-gray-500" 
              disabled={isUploading || isLoading}
            />
          </div>
        </div>




        <div className="w-full">{/* All tab content goes here */}
          {isLoading ? (
            <DocumentsPageSkeleton />
          ) : (
            <>

              {!isLoading && authError && activePrimaryTab === 'my-documents' && (
                <div className="flex flex-col items-center justify-center p-8 bg-destructive/10 rounded-lg mt-4">
                  <p className="text-destructive mb-4 text-center">Authentication error for My Documents. Please re-authenticate.</p>
                  <Button onClick={handleReauthenticate} variant="default" disabled={isLoading || isUploading}>
                    Re-authenticate
                  </Button>
                </div>
              )}

              {!isLoading && !authError && activePrimaryTab === 'my-documents' && currentPath.length > 0 && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4 flex-wrap">
                  <Button variant="ghost" size="sm" onClick={navigateUp} disabled={isLoading || isUploading} className="flex items-center text-primary hover:bg-primary/10">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button> <span>/</span>
                  <Button variant="link" size="sm" className="text-primary px-1 h-auto py-0"
                    onClick={async () => { setIsLoading(true); await fetchPersonalDocumentsRoot(); setIsLoading(false); }}
                    disabled={isLoading || isUploading}> OneDrive Root </Button> <span>/</span>
                  {currentPath.map((folder, index) => (
                    <div key={folder.id} className="flex items-center gap-1">
                      {index < currentPath.length - 1 ? (
                        <Button variant="link" size="sm" className="text-primary px-1 h-auto py-0"
                          onClick={async () => {
                            if (isLoading || isUploading) return; setIsLoading(true);
                            const pathSlice = currentPath.slice(0, index + 1);
                            const targetFolder = pathSlice[pathSlice.length - 1];
                            try {
                              const contentsResult = await getFolderContents(targetFolder.id);
                              const contents: DisplayableDocument[] = (contentsResult || []).map((item: any) => ({
                                id: item.id, name: item.name, url: item.webUrl, lastModified: item.lastModifiedDateTime, size: item.size, isFolder: !!item.folder, source: 'OneDrive', originalFileName: item.name
                              }));
                              contents.sort((a, b) => { if (a.isFolder && !b.isFolder) return -1; if (!a.isFolder && b.isFolder) return 1; return a.name.localeCompare(b.name); });
                              setDocuments(contents); setCurrentPath(pathSlice);
                            } catch (error: any) {
                              toast.error(`Failed to load folder: ${error.message}`);
                              if (error.message?.includes('Authentication') || error.code === 'UserLoginRequired') setAuthError(true);
                            } finally { setIsLoading(false); }
                          }}
                          disabled={isLoading || isUploading} > {folder.name} </Button>
                      ) : (<span className="text-foreground font-medium px-1">{folder.name}</span>)}
                      {index < currentPath.length - 1 && <span className="text-gray-400">/</span>}
                    </div>
                  ))}
                </div>
              )}

              {!isLoading && (!authError || activePrimaryTab !== 'my-documents') && (
                <div className="space-y-8 border border-gray-200 dark:border-white/10 rounded-lg p-6 bg-white/50 dark:bg-gray-900/20">

                  {/* Breadcrumb Navigation */}
                  {navigationState.breadcrumbs.length > 0 && (
                    <BreadcrumbNavigation
                      breadcrumbs={navigationState.breadcrumbs}
                      onBreadcrumbClick={handleBreadcrumbClick}
                    />
                  )}

                  {/* Category View - Show categories and recently opened */}
                  {navigationState.currentLevel === 'categories' && (
                    <>
                      {/* Recently Opened Section (like in reference image) */}

                      {/* Main Document Categories Section */}
                      <div>
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <h2 className="text-xl font-semibold text-primary dark:text-gray-100 mb-1">
                              {activePrimaryTab === 'company-wide' && 'Document Categories'}
                              {activePrimaryTab === 'my-documents' && 'My Files'}
                              {activePrimaryTab === 'team-unit' && 'Team Documents'}
                              {activePrimaryTab === 'external-shared' && 'External Documents'}
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {activePrimaryTab === 'company-wide' && 'Browse documents by organizational category'}
                              {activePrimaryTab === 'my-documents' && 'Your personal files and folders'}
                              {activePrimaryTab === 'team-unit' && 'Shared team and division documents'}
                              {activePrimaryTab === 'external-shared' && 'Documents shared with external parties'}
                            </p>
                          </div>

                          {/* My Documents toolbar */}
                          {activePrimaryTab === 'my-documents' && (
                            <div className="flex items-center gap-2">
                              {/* Hidden file input */}
                              <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={handleFileInputChange}
                              />
                              <Button
                                variant="outline"
                                disabled={isDriveUploading || isLoading}
                                onClick={() => fileInputRef.current?.click()}
                                className="dark:border-white/10"
                              >
                                <Upload className="h-4 w-4 mr-2" /> Upload File
                              </Button>
                              <Button
                                variant="outline"
                                disabled={isDriveUploading || isLoading}
                                onClick={() => { setNewFolderName(''); setIsNewFolderOpen(true); }}
                                className="dark:border-white/10"
                              >
                                <FolderPlus className="h-4 w-4 mr-2" /> New Folder
                              </Button>
                            </div>
                          )}

                          {activePrimaryTab !== 'my-documents' && (
                            (() => {
                              const canUpload = activePrimaryTab === 'external-shared' ? canUploadExt : canUploadOrg;
                              if (!canUpload) return null;
                              return (
                                <div className="flex items-center gap-2">
                                  {activePrimaryTab === 'company-wide' && canManageOrgCategories && (
                                    <Button onClick={() => setIsAddCategoryDialogOpen(true)} variant="outline" disabled={isUploading || isLoading}>
                                      <FolderPlus className="h-4 w-4 mr-2" /> Add Category
                                    </Button>
                                  )}
                                  <Button onClick={() => setIsAddDocumentModalOpen(true)} variant="default" disabled={isUploading || isLoading}>
                                    <PlusCircle className="h-4 w-4 mr-2" />
                                    {activePrimaryTab === 'external-shared' ? 'Add External Doc/Link' : 'Add Document'}
                                  </Button>
                                </div>
                              );
                            })()
                          )}
                        </div>

                        {/* Upload progress banner */}
                        {isDriveUploading && uploadProgress && (
                          <div className="mb-4 flex items-center gap-3 px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-lg text-sm text-primary">
                            <RefreshCw className="h-4 w-4 animate-spin flex-shrink-0" />
                            {uploadProgress}
                          </div>
                        )}

                        {activePrimaryTab === 'my-documents' ? (
                          /* Drag-and-drop zone wrapper */
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              // Only show upload overlay for external file drops (not internal moves)
                              if (e.dataTransfer.types.includes('Files') && !e.dataTransfer.types.includes('application/x-onedrive-item')) {
                                setIsDragOver(true);
                              }
                            }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={(e) => {
                              // Only handle external file upload drops here; folder drops handled per-folder
                              if (e.dataTransfer.types.includes('Files') && !e.dataTransfer.types.includes('application/x-onedrive-item')) {
                                handleDrop(e);
                              }
                            }}
                            className={`rounded-lg transition-colors ${isDragOver ? 'bg-primary/5 border-2 border-dashed border-primary p-4' : ''}`}
                          >
                            {isDragOver && (
                              <div className="flex flex-col items-center justify-center py-8 pointer-events-none">
                                <Upload className="h-10 w-10 text-primary mb-2" />
                                <p className="text-sm font-medium text-primary">Drop files to upload</p>
                              </div>
                            )}
                            {!isDragOver && (filteredDocuments.length > 0 ? (
                              viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                  {filteredDocuments.map((doc) => {
                                    if (doc.isFolder) {
                                      const folderData: DocumentFolder = {
                                        id: doc.id, name: doc.name, description: 'Folder',
                                        fileCount: 0, totalSize: doc.size || 0, lastModified: doc.lastModified,
                                        icon: <FolderOpen className="h-12 w-12 text-blue-500" />,
                                        category: 'folder', isFolder: true, sharedWith: []
                                      };
                                      return (
                                        <DocumentFolderCard
                                          key={doc.id} folder={folderData} onClick={handleFolderClick}
                                          showDriveActions
                                          onRename={(f) => { setRenameTarget(doc); setRenameValue(doc.name); }}
                                          onDriveDelete={(f) => setDeleteTarget(doc)}
                                          isDragTarget={dragOverFolderId === doc.id}
                                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverFolderId(doc.id); }}
                                          onDragLeave={(e) => { e.stopPropagation(); setDragOverFolderId(null); }}
                                          onDrop={(e) => {
                                            e.preventDefault(); e.stopPropagation();
                                            setDragOverFolderId(null);
                                            const itemId = e.dataTransfer.getData('application/x-onedrive-item');
                                            const itemName = e.dataTransfer.getData('text/plain');
                                            if (itemId) handleMoveToFolder(itemId, itemName, doc.id, doc.name);
                                          }}
                                        />
                                      );
                                    } else {
                                      return (
                                        <div
                                          key={doc.id}
                                          className="group relative"
                                          draggable
                                          onDragStart={(e) => {
                                            e.dataTransfer.setData('application/x-onedrive-item', doc.id);
                                            e.dataTransfer.setData('text/plain', doc.name);
                                            e.dataTransfer.effectAllowed = 'move';
                                          }}
                                        >
                                          <FileCard
                                            file={{
                                              id: doc.id, name: doc.name, size: formatFileSize(doc.size),
                                              lastModified: formatDate(doc.lastModified),
                                              fileType: doc.name.split('.').pop()?.toUpperCase() || 'FILE',
                                              extension: doc.name.split('.').pop() || '',
                                              icon: getFileIconForDocument(doc), sharedWith: [],
                                              description: doc.description, tags: doc.tags ? doc.tags.split(',') : []
                                            }}
                                            onClick={() => handleFileClick(doc)}
                                          />
                                          {/* Per-file actions overlay */}
                                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); window.open(doc.url, '_blank'); }}
                                              className="p-1.5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-white/10 hover:bg-primary hover:text-white transition-all shadow-sm"
                                              title="Open"
                                            ><ExternalLink className="h-3.5 w-3.5" /></button>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setRenameTarget(doc); setRenameValue(doc.name); }}
                                              className="p-1.5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-white/10 hover:bg-primary hover:text-white transition-all shadow-sm"
                                              title="Rename"
                                            ><Pencil className="h-3.5 w-3.5" /></button>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(doc); }}
                                              className="p-1.5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-white/10 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                              title="Delete"
                                            ><Trash2 className="h-3.5 w-3.5" /></button>
                                          </div>
                                        </div>
                                      );
                                    }
                                  })}
                                </div>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  {filteredDocuments.map((doc) => {
                                    if (doc.isFolder) {
                                      const folderData: DocumentFolder = {
                                        id: doc.id, name: doc.name, description: '',
                                        fileCount: 0, totalSize: doc.size || 0, lastModified: doc.lastModified,
                                        icon: <FolderOpen className="h-8 w-8 text-blue-500" />,
                                        category: 'folder', isFolder: true, sharedWith: []
                                      };
                                      return (
                                        <DocumentFolderRow
                                          key={doc.id} folder={folderData} onClick={handleFolderClick}
                                          showDriveActions
                                          onRename={(f) => { setRenameTarget(doc); setRenameValue(doc.name); }}
                                          onDriveDelete={(f) => setDeleteTarget(doc)}
                                          isDragTarget={dragOverFolderId === doc.id}
                                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverFolderId(doc.id); }}
                                          onDragLeave={(e) => { e.stopPropagation(); setDragOverFolderId(null); }}
                                          onDrop={(e) => {
                                            e.preventDefault(); e.stopPropagation();
                                            setDragOverFolderId(null);
                                            const itemId = e.dataTransfer.getData('application/x-onedrive-item');
                                            const itemName = e.dataTransfer.getData('text/plain');
                                            if (itemId) handleMoveToFolder(itemId, itemName, doc.id, doc.name);
                                          }}
                                        />
                                      );
                                    } else {
                                      return (
                                        <div
                                          key={doc.id}
                                          className="group flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-white/10 rounded-lg"
                                          draggable
                                          onDragStart={(e) => {
                                            e.dataTransfer.setData('application/x-onedrive-item', doc.id);
                                            e.dataTransfer.setData('text/plain', doc.name);
                                            e.dataTransfer.effectAllowed = 'move';
                                          }}
                                        >
                                          <div className="flex-shrink-0">{getFileIconForDocument(doc)}</div>
                                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleFileClick(doc)}>
                                            <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{doc.name}</p>
                                            <p className="text-xs text-gray-400">{formatFileSize(doc.size)} · {formatDate(doc.lastModified)}</p>
                                          </div>
                                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                            <button onClick={() => window.open(doc.url, '_blank')}
                                              className="p-1.5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-white/10 hover:bg-primary hover:text-white transition-all"
                                              title="Open"><ExternalLink className="h-3.5 w-3.5" /></button>
                                            <button onClick={() => { setRenameTarget(doc); setRenameValue(doc.name); }}
                                              className="p-1.5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-white/10 hover:bg-primary hover:text-white transition-all"
                                              title="Rename"><Pencil className="h-3.5 w-3.5" /></button>
                                            <button onClick={() => setDeleteTarget(doc)}
                                              className="p-1.5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-white/10 hover:bg-red-600 hover:text-white transition-all"
                                              title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                                          </div>
                                        </div>
                                      );
                                    }
                                  })}
                                </div>
                              )
                            ) : (
                              <div className="text-center py-10 text-gray-500">
                                <p className="text-lg mb-2">{searchQuery ? 'No documents match your search.' : 'No documents found.'}</p>
                                <p className="text-sm">Drop files here or use Upload File to add documents.</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            {documentFolders.length > 0 ? (
                              viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                  {documentFolders.map((folder) => (
                                    <DocumentFolderCard
                                      key={folder.id} folder={folder} onClick={handleFolderClick}
                                      onEdit={handleEditCategoryClick} onDelete={handleDeleteCategoryClick}
                                      showAdminActions={(isAdmin || isSuperAdmin) && categoriesLoaded}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  {documentFolders.map((folder) => (
                                    <DocumentFolderRow
                                      key={folder.id} folder={folder} onClick={handleFolderClick}
                                      onEdit={handleEditCategoryClick} onDelete={handleDeleteCategoryClick}
                                      showAdminActions={(isAdmin || isSuperAdmin) && categoriesLoaded}
                                    />
                                  ))}
                                </div>
                              )
                            ) : (
                              <div className="text-center py-10 text-gray-500">
                                <p className="text-lg mb-2">{searchQuery ? 'No documents match your search.' : 'No documents found.'}</p>
                                <p className="text-sm">
                                  {searchQuery ? 'Try a different search term.' :
                                    (activePrimaryTab === 'company-wide' ? 'No organisational documents found in this category.' :
                                      activePrimaryTab === 'team-unit' ? 'No documents found for your team/unit.' :
                                        'Check back later for new documents.')}
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}

                  {/* Subcategory View — subfolder cards inside a category */}
                  {navigationState.currentLevel === 'subcategory' && currentCategoryDef && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-xl font-semibold text-primary dark:text-gray-100">{currentCategoryDef.label}</h2>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {currentSubfolderCards.length} subfolder{currentSubfolderCards.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        {canManageOrgCategories && activePrimaryTab === 'company-wide' && (
                          <Button variant="outline" onClick={() => { setNewSubfolderName(''); setIsAddSubfolderOpen(true); }} className="dark:border-white/10">
                            <FolderPlus className="h-4 w-4 mr-2" /> Add Subfolder
                          </Button>
                        )}
                      </div>

                      {currentSubfolderCards.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <FolderOpen className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
                          <p className="text-gray-500 dark:text-gray-400 text-sm">No subfolders yet.</p>
                          {canManageOrgCategories && (
                            <Button variant="outline" size="sm" className="mt-3 dark:border-white/10"
                              onClick={() => { setNewSubfolderName(''); setIsAddSubfolderOpen(true); }}>
                              <FolderPlus className="h-4 w-4 mr-2" /> Add Subfolder
                            </Button>
                          )}
                        </div>
                      ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {currentSubfolderCards.map(folder => (
                            <DocumentFolderCard
                              key={folder.id}
                              folder={folder}
                              onClick={handleFolderClick}
                              showAdminActions={canManageOrgCategories && activePrimaryTab === 'company-wide'}
                              onEdit={canManageOrgCategories ? (f) => { setRenamingSubfolder(f.name); setRenameSubfolderValue(f.name); } : undefined}
                              onDelete={canManageOrgCategories ? (f) => setDeletingSubfolder(f.name) : undefined}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {currentSubfolderCards.map(folder => (
                            <DocumentFolderRow
                              key={folder.id}
                              folder={folder}
                              onClick={handleFolderClick}
                              showAdminActions={canManageOrgCategories && activePrimaryTab === 'company-wide'}
                              onEdit={canManageOrgCategories ? (f) => { setRenamingSubfolder(f.name); setRenameSubfolderValue(f.name); } : undefined}
                              onDelete={canManageOrgCategories ? (f) => setDeletingSubfolder(f.name) : undefined}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Files View — documents inside a specific subfolder */}
                  {navigationState.currentLevel === 'files' && currentCategoryData && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-xl font-semibold text-primary dark:text-gray-100">{currentCategoryData.name}</h2>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {currentCategoryData.files.length} document{currentCategoryData.files.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        {canUploadOrg && activePrimaryTab === 'company-wide' && (
                          <Button onClick={() => setIsAddDocumentModalOpen(true)} variant="default" disabled={isUploading || isLoading}>
                            <PlusCircle className="h-4 w-4 mr-2" /> Add Document
                          </Button>
                        )}
                      </div>

                      {currentCategoryData.files.length === 0 ? (
                        <div className="flex items-center gap-3 px-4 py-8 rounded-lg border border-dashed border-gray-200 dark:border-white/10 text-gray-400 dark:text-gray-500 text-sm">
                          <Folder className="h-5 w-5 flex-shrink-0" />
                          <span>No documents yet. Use "Add Document" to upload files to this subfolder.</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {currentCategoryData.files.map((file) => {
                            const canDeleteFile = activePrimaryTab === 'external-shared' ? canDeleteExt : canDeleteOrg;
                            return (
                              <div key={file.id} className="group relative">
                                <FileCard file={file} onClick={handleFileClick} />
                                {canDeleteFile && (
                                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    {file.url && (
                                      <button onClick={(e) => { e.stopPropagation(); window.open(file.url, '_blank'); }}
                                        className="p-1.5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-white/10 hover:bg-primary hover:text-white transition-all shadow-sm"
                                        title="Open"><ExternalLink className="h-3.5 w-3.5" /></button>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); setSharedDocDeleteTarget(file); }}
                                      className="p-1.5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-white/10 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                      title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </div>
      </Tabs>

      <AddDocumentModal
        isOpen={isAddDocumentModalOpen}
        onOpenChange={setIsAddDocumentModalOpen}
        onShare={handleShareDocument}
        availableCategories={
          navigationState.currentLevel === 'files' && currentCategoryData
            ? [currentCategoryData.categoryName]
            : currentSharePointCategoriesForModal
        }
        subCategoryMap={dynamicSubCategoryMap}
        initialCategory={
          navigationState.currentLevel === 'files' && currentCategoryData
            ? currentCategoryData.categoryName
            : currentSharePointCategoriesForModal[0]
        }
        initialSubCategory={
          navigationState.currentLevel === 'files'
            ? navigationState.currentSubCategoryName || undefined
            : undefined
        }
      />

      <AddCategoryDialog
        isOpen={isAddCategoryDialogOpen}
        onOpenChange={setIsAddCategoryDialogOpen}
        onSubmit={handleCreateCategory}
        isSubmitting={isCreatingCategory}
      />

      <EditCategoryDialog
        isOpen={isEditCategoryDialogOpen}
        onOpenChange={(open) => {
          setIsEditCategoryDialogOpen(open);
          if (!open) setEditingCategory(null);
        }}
        onSubmit={handleUpdateCategory}
        onDelete={handleDeleteCategory}
        isSubmitting={isEditingCategory}
        initialData={editingCategory ? {
          title: editingCategory.title,
          description: editingCategory.description || '',
          sortOrder: editingCategory.sortOrder,
        } : null}
      />

      {/* ── OneDrive CRUD Dialogs ─────────────────────────────────────────── */}

      {/* New Folder dialog */}
      {isNewFolderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">New Folder</h3>
              <button onClick={() => setIsNewFolderOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              autoFocus
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setIsNewFolderOpen(false); }}
              placeholder="Folder name"
              className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsNewFolderOpen(false)} className="dark:border-white/10">Cancel</Button>
              <Button onClick={handleCreateFolder} disabled={!newFolderName.trim() || isDriveUploading}>
                {isDriveUploading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <FolderPlus className="h-4 w-4 mr-2" />}
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rename dialog */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Rename</h3>
              <button onClick={() => setRenameTarget(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              autoFocus
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setRenameTarget(null); }}
              className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenameTarget(null)} className="dark:border-white/10">Cancel</Button>
              <Button onClick={handleRenameConfirm} disabled={!renameValue.trim() || isDriveUploading}>
                {isDriveUploading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Rename
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Delete "{deleteTarget.name}"?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {deleteTarget.isFolder
                    ? 'This folder and all its contents will be moved to your OneDrive recycle bin.'
                    : 'This file will be moved to your OneDrive recycle bin.'}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} className="dark:border-white/10">Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDriveUploading}>
                {isDriveUploading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Delete confirm dialog — Shared (Org / External) documents */}
      {sharedDocDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Delete "{sharedDocDeleteTarget.name}"?
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This document will be permanently removed from the shared library.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSharedDocDeleteTarget(null)} className="dark:border-white/10">
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleSharedDocDeleteConfirm} disabled={isDeletingSharedDoc}>
                {isDeletingSharedDoc ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Subfolder dialog */}
      {isAddSubfolderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Add Subfolder</h3>
              <button onClick={() => setIsAddSubfolderOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              autoFocus
              type="text"
              value={newSubfolderName}
              onChange={(e) => setNewSubfolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubfolder(); if (e.key === 'Escape') setIsAddSubfolderOpen(false); }}
              placeholder="Subfolder name"
              className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddSubfolderOpen(false)} className="dark:border-white/10">Cancel</Button>
              <Button onClick={handleAddSubfolder} disabled={!newSubfolderName.trim() || isAddingSubfolder}>
                {isAddingSubfolder ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <FolderPlus className="h-4 w-4 mr-2" />}
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Subfolder dialog */}
      {renamingSubfolder !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Rename Subfolder</h3>
              <button onClick={() => setRenamingSubfolder(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              autoFocus
              type="text"
              value={renameSubfolderValue}
              onChange={(e) => setRenameSubfolderValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubfolderConfirm(); if (e.key === 'Escape') setRenamingSubfolder(null); }}
              className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenamingSubfolder(null)} className="dark:border-white/10">Cancel</Button>
              <Button onClick={handleRenameSubfolderConfirm} disabled={!renameSubfolderValue.trim() || isRenamingSubfolder}>
                {isRenamingSubfolder ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Rename
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Subfolder confirm dialog */}
      {deletingSubfolder !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Delete "{deletingSubfolder}"?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This will remove the subfolder definition. Documents already tagged to this subfolder will not be deleted but will become unclassified.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeletingSubfolder(null)} className="dark:border-white/10">Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteSubfolderConfirm} disabled={isDeletingSubfolder}>
                {isDeletingSubfolder ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
