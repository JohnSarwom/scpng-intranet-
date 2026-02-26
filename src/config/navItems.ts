import {
    Home,
    Grid3x3,
    Bell,
    Layers,
    TrendingUp,
    FileText,
    FormInput,
    MessageSquare,
    GalleryHorizontal,
    Users,
    Target,
    BarChart,
    Package,
    Ticket,
    Shield,
    Settings,
    Database,
    TestTube,
    Palette,
    LucideIcon
} from 'lucide-react';

export interface NavItem {
    icon: LucideIcon;
    path: string;
    label: string;
    /**
     * The resource key used for permission checks.
     * If null, the item is visible to all authenticated users.
     */
    resource: string | null;
    /**
     * If true, the item is only visible to users with Admin role.
     */
    isAdminOnly?: boolean;
}

export const mainNavItems: NavItem[] = [
    { icon: Home, path: '/', label: 'Home', resource: null },
    { icon: Grid3x3, path: '/apps', label: 'Apps', resource: 'apps' },
    { icon: Bell, path: '/news', label: 'News', resource: null },
    { icon: Layers, path: '/strategy', label: 'Strategy', resource: 'strategy' },
    { icon: TrendingUp, path: '/market-data', label: 'Market Data', resource: 'market_data' },
    { icon: FileText, path: '/documents', label: 'Documents', resource: 'documents' },
    { icon: FormInput, path: '/forms', label: 'Forms', resource: 'forms' },
    { icon: MessageSquare, path: '/ai-hub', label: 'AI Hub', resource: null },
    { icon: GalleryHorizontal, path: '/gallery', label: 'Gallery', resource: 'gallery' },
    { icon: Users, path: '/contacts', label: 'Contacts', resource: 'contacts' },
    { icon: Target, path: '/unit', label: 'Unit', resource: 'units' },
    { icon: Package, path: '/asset-management', label: 'Assets', resource: 'assets' },
    { icon: Users, path: '/hr-profiles', label: 'HR Profiles', resource: 'hr' },
    { icon: Ticket, path: '/tickets', label: 'Tickets', resource: 'tickets' },
    { icon: FileText, path: '/licensing-registry', label: 'Licensing', resource: 'licenses' },
    { icon: Shield, path: '/regulatory-intelligence', label: 'Regulatory', resource: 'regulatory' },
];

export const adminNavItems: NavItem[] = [
    { icon: Database, path: '/admin', label: 'Admin', resource: null, isAdminOnly: true },
    { icon: TestTube, path: '/test-ground', label: 'Test Ground', resource: null, isAdminOnly: true },
    { icon: Palette, path: '/ui-library', label: 'UI Library', resource: null, isAdminOnly: true },
];

export const footerNavItems: NavItem[] = [
    { icon: Settings, path: '/settings', label: 'Settings', resource: null },
];
