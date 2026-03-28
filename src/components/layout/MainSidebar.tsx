import React, { useEffect, useState, useMemo, memo, useRef, useLayoutEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  mainNavItems,
  adminNavItems,
  footerNavItems,
  NavItem
} from '@/config/navItems';

/**
 * MainSidebar Component - Enterprise Intelligent Enhancement Protocol v2.0
 * 
 * ENHANCEMENTS:
 * - P1 Security: Least-privilege visibility with memoized access checks.
 * - P3 Performance: useMemo for list filtering & React.memo for component stability.
 * - P4 Clean Architecture: Decoupled navigation config in @/config/navItems.
 * - P5 Maintainability: JSDoc, explicit types, and intent-based variable naming.
 * - P6 UX & Fix: Resolved critical Z-index/Squashing bug; added ARIA accessibility.
 * - P7 Observability: Logic structure ready for telemetry integration.
 * 
 * @param props - MainSidebarProps
 */
interface MainSidebarProps {
  closeMobileSidebar?: () => void;
  handleSignOut?: () => void;
  isAdmin?: boolean;
  userPermissions?: Record<string, string[]> | any;
  isLoading?: boolean;
}

const SCROLL_STORAGE_KEY = 'scpng_sidebar_scroll';

const MainSidebar: React.FC<MainSidebarProps> = memo(({
  closeMobileSidebar,
  handleSignOut,
  isAdmin = false,
  userPermissions = {},
  isLoading = false
}) => {
  const location = useLocation();
  const [isFirstRender, setIsFirstRender] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Phase 3: Optimize isFirstRender check to only run once
  useEffect(() => {
    const timer = setTimeout(() => setIsFirstRender(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // UI UX Fix: Restore scroll position on mount
  useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      const savedPosition = sessionStorage.getItem(SCROLL_STORAGE_KEY);
      if (savedPosition) {
        scrollContainerRef.current.scrollTop = parseInt(savedPosition, 10);
      }
    }
  }, [isLoading]); // Re-run if loading state changes as content height might change

  // UI UX Fix: Save scroll position when user scrolls
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    sessionStorage.setItem(SCROLL_STORAGE_KEY, target.scrollTop.toString());
  };

  // Phase 1 & 3: Memoize navigation items based on permissions
  const itemsToRender = useMemo(() => {
    // If loading, show all standard items plus footer as placeholders
    if (isLoading) {
      return [...mainNavItems, ...footerNavItems];
    }

    /**
     * P1: Robust permission validation logic
     * Follows least-privilege principle: restricted by default unless scope present.
     */
    const hasAccess = (item: NavItem): boolean => {
      // Admin bypass
      if (isAdmin) return true;
      // Strict admin-only check
      if (item.isAdminOnly && !isAdmin) return false;
      // Public / No resource restriction items
      if (!item.resource) return true;
      // No permissions object available
      if (!userPermissions) return false;
      // Global wildcard permission
      if (userPermissions.all?.includes('*')) return true;
      // Target resource scope validation
      return !!(userPermissions[item.resource] && userPermissions[item.resource].length > 0);
    };

    const nav = mainNavItems.filter(hasAccess);

    // Append Admin items if applicable
    if (isAdmin) {
      nav.push(...adminNavItems);
    }

    // Always show footer items (Settings, etc.)
    nav.push(...footerNavItems);

    return nav;
  }, [isAdmin, userPermissions, isLoading]);

  return (
    <nav
      id="main-sidebar"
      aria-label="Main Navigation"
      role="navigation"
      // P6: Increased z-index (40) and added min-width + flex-shrink-0 to prevent layout squashing
      className={cn(
        "fixed inset-y-0 left-0 w-20 min-w-[5rem] flex-shrink-0",
        "bg-gradient-to-b from-[#400010] to-[#200008] dark:from-[#300010] dark:to-black",
        "flex flex-col items-center py-6 z-40 shadow-xl rounded-r-2xl border-r border-white/5 transition-all duration-300"
      )}
    >
      {/* P6: Branding / Logo - Consistent sizing */}
      <div className="mb-8 flex justify-center px-2 flex-shrink-0">
        <img
          src="/images/SCPNG Original Logo.png"
          alt="SCPNG Logo"
          className="w-16 h-auto drop-shadow-md"
        />
      </div>

      {/* Scrollable Navigation Menu */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex flex-col items-center mt-4 flex-1 w-full overflow-y-auto sidebar-scrollable pr-1"
      >
        <div className="flex flex-col items-center space-y-6 w-full">
          {itemsToRender.map((item, index) => {
            if (isLoading) {
              return (
                <div key={`skeleton-${index}`} className="flex flex-col items-center w-full animate-pulse group">
                  <div className="p-3 rounded-lg bg-white/5 h-11 w-11 mb-1"></div>
                  <div className="h-3 w-10 bg-white/5 rounded mt-1"></div>
                </div>
              );
            }

            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeMobileSidebar}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  "flex flex-col items-center text-white/80 hover:text-white transition-all group w-full",
                  isActive && "text-white",
                  isFirstRender && "animate-slide-in"
                )}
                style={isFirstRender ? { animationDelay: `${index * 0.05}s` } : undefined}
              >
                <div className={cn(
                  "p-3 rounded-lg group-hover:bg-white/10 transition-all duration-200 icon-hover-effect",
                  isActive && "bg-white/10 shadow-inner"
                )}>
                  <Icon size={20} />
                </div>
                <span className="text-[10px] mt-1 font-medium tracking-tight h-3 flex items-center">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* P6: Fixed Sign Out Action */}
      {handleSignOut && (
        <button
          onClick={handleSignOut}
          className="flex flex-col items-center text-white/80 hover:text-white transition-all group mb-6 icon-hover-effect flex-shrink-0"
          title="Sign Out"
          aria-label="Sign Out"
        >
          <div className="p-3 rounded-lg group-hover:bg-white/10 transition-colors">
            <LogOut size={20} />
          </div>
          <span className="text-[10px] mt-1 font-medium tracking-tight">Logout</span>
        </button>
      )}
    </nav>
  );
});

MainSidebar.displayName = 'MainSidebar';

export default MainSidebar;
