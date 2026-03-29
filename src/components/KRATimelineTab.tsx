import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Kra, Kpi, Objective } from '@/types/kpi';
import { AlertTriangle, AlertCircle } from 'lucide-react';

interface KRATimelineTabProps {
  kras: Kra[];
  objectives: Objective[];
  viewMode: 'quarters' | 'months' | 'weeks';
  onViewModeChange: (mode: 'quarters' | 'months' | 'weeks') => void;
}

const KRATimelineTab: React.FC<KRATimelineTabProps> = ({ kras, objectives, viewMode, onViewModeChange }) => {
  // const [currentViewMode, setCurrentViewMode] = useState<'quarters' | 'months' | 'weeks'>('quarters'); // Removed local state
  const currentViewMode = viewMode; // Use prop instead
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current week
  useEffect(() => {
    if (currentViewMode === 'weeks' && scrollContainerRef.current) {
      // Estimate current week
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
      const currentWeek = Math.ceil((days + 1) / 7);

      const scrollWidth = scrollContainerRef.current.scrollWidth;
      const viewportWidth = scrollContainerRef.current.clientWidth;

      // Calculate target position (approximate center of timeline)
      const targetScroll = (currentWeek / 52) * scrollWidth;

      scrollContainerRef.current.scrollTo({
        left: Math.max(0, targetScroll - (viewportWidth / 2)),
        behavior: 'smooth'
      });
    }
  }, [currentViewMode]);

  // --- Preprocessing for Grouping --- 
  const firstObjectiveMap = new Map<string | number, string>();
  const firstKraTitleMap = new Map<string, string>(); // Key: objective_id-kraTitle
  const lastObjectiveMap = new Map<string | number, string>(); // To find the last KRA for an objective
  const lastKraTitleMap = new Map<string, string>(); // To find the last KRA for a title group

  kras.forEach(kra => {
    // Track first occurrence of each objective_id
    if (kra.objective_id && !firstObjectiveMap.has(kra.objective_id)) {
      firstObjectiveMap.set(kra.objective_id, kra.id as string);
    }
    // Track first occurrence of each KRA title *within* an objective
    const kraTitleKey = `${kra.objective_id}-${kra.title}`;
    if (kra.title && !firstKraTitleMap.has(kraTitleKey)) {
      firstKraTitleMap.set(kraTitleKey, kra.id as string);
    }
    // Track last KRA for each objective (will be overwritten until the last one)
    if (kra.objective_id) {
      lastObjectiveMap.set(kra.objective_id, kra.id as string);
    }
    // Track last KRA for each title group (will be overwritten)
    if (kra.title) { // Check if title exists
      lastKraTitleMap.set(kraTitleKey, kra.id as string);
    }
  });
  // --- End Preprocessing ---

  const quarters = ["Q1", "Q2", "Q3", "Q4"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const weeks = Array.from({ length: 52 }, (_, i) => `W${i + 1}`);

  const parseDate = (dateString: string | undefined): Date | null => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    } catch (e) {
      return null;
    }
  };

  const calculatePosition = (date: Date | null): number => {
    if (!date) return 0;
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);
    const totalDays = (endOfYear.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24);
    const daysFromStart = (date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.min(100, (daysFromStart / totalDays) * 100));
  };

  const calculateWidth = (startDate: Date | null, endDate: Date | null): number => {
    if (!startDate || !endDate || startDate >= endDate) return 0;
    const year = startDate.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);
    const totalDays = (endOfYear.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24);
    const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const width = (duration / totalDays) * 100;
    const startPosition = calculatePosition(startDate);

    // Ensure minimum visual width (approx 4px on standard screens)
    // 100% / 1200px (min width) * 4px = ~0.33%
    const minWidthPercent = 0.5;

    return Math.max(minWidthPercent, Math.min(100 - startPosition, width));
  };

  const getKraProgress = (kpis: Kpi[]): number => {
    if (!kpis || kpis.length === 0) return 0;
    const totalTarget = kpis.reduce((sum, kpi) => sum + (Number(kpi.target) || 0), 0);
    if (totalTarget === 0) return 0;
    const totalActual = kpis.reduce((sum, kpi) => sum + (Number(kpi.actual) || 0), 0);
    const progress = Math.min(100, (totalActual / totalTarget) * 100);
    return Math.round(progress);
  };

  // Helper function to get KPI progress percentage
  const getKpiProgress = (kpi: Kpi): number => {
    if (kpi.status === 'completed') return 100;
    const target = Number(kpi.target);
    const actual = Number(kpi.actual);
    if (target === 0 || isNaN(target) || isNaN(actual) || actual === undefined || actual === null) return 0;
    const progress = Math.min(100, Math.max(0, (actual / target) * 100));
    return Math.round(progress);
  };

  // --- New Helper: Get Date Range from KPIs ---
  const getKpiDateRange = (kpis: Kpi[]): string => {
    if (!kpis || kpis.length === 0) return '';

    let minStartDate: Date | null = null;
    let maxTargetDate: Date | null = null;

    kpis.forEach(kpi => {
      const startDate = parseDate(kpi.start_date || kpi.startDate);
      const targetDate = parseDate(kpi.target_date || kpi.targetDate);

      if (startDate) {
        if (!minStartDate || startDate < minStartDate) {
          minStartDate = startDate;
        }
      }
      if (targetDate) {
        if (!maxTargetDate || targetDate > maxTargetDate) {
          maxTargetDate = targetDate;
        }
      }
    });

    const formatDate = (date: Date | null): string => {
      if (!date) return '?';
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    if (minStartDate || maxTargetDate) {
      return `${formatDate(minStartDate)} - ${formatDate(maxTargetDate)}`;
    }

    return '';
  };
  // --- End Helper ---

  const getProgressColorClass = (progress: number): string => {
    if (progress >= 100) return "bg-green-500";
    if (progress >= 75) return "bg-green-400";
    if (progress >= 50) return "bg-amber-500";
    return "bg-red-500";
  };

  const getKpiStatusColorClass = (status: Kpi['status']): string => {
    switch (status) {
      case 'completed': return "bg-blue-600 dark:bg-blue-600 text-white";
      case 'on-track': return "bg-green-600 dark:bg-green-600 text-white";
      case 'in-progress': return "bg-green-200 dark:bg-emerald-500/30 text-emerald-950 dark:text-emerald-300 border border-green-300 dark:border-emerald-500/40";
      case 'at-risk': return "bg-amber-300 dark:bg-amber-500/30 text-amber-950 dark:text-amber-300 border border-amber-400 dark:border-amber-500/40";
      case 'on-hold': return "bg-gray-400 dark:bg-gray-600 text-white";
      case 'not-started': return "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border border-gray-300 dark:border-white/10";
      case 'behind': return "bg-red-600 dark:bg-red-600 text-white";
      default: return "bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-300";
    }
  };

  const getStatusTextColor = (status: Kpi['status']): string => {
    switch (status) {
      case 'in-progress':
      case 'at-risk':
      case 'not-started':
        return 'text-gray-900 dark:text-inherit font-semibold';
      default:
        return 'text-white font-medium';
    }
  };

  const isCritical = (status: Kpi['status']) => {
    return status === 'behind' || status === 'at-risk';
  };

  return (
    <Card className="h-full flex flex-col dark:bg-gray-900 dark:border-white/10">
      <CardContent className="flex-1 min-h-0 overflow-hidden p-0">
        <div className="overflow-auto max-h-[calc(100vh-200px)] border dark:border-white/5 rounded-xl text-sm relative kanban-scrollbar bg-white/50 dark:bg-black/20 backdrop-blur-sm" ref={scrollContainerRef}>
          <div className="timeline-view min-w-[1200px] relative">
            <div className="flex border-b border-gray-200 dark:border-white/10 sticky top-0 bg-gray-50/95 dark:bg-black/40 backdrop-blur-md z-40">
              <div className="w-48 h-12 px-6 flex items-center text-sm font-semibold dark:text-gray-300 shrink-0 sticky left-0 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-md z-50 border-r border-b border-gray-200 dark:border-white/10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">Initiative</div>
              <div className="w-64 h-12 px-6 flex items-center text-sm font-semibold dark:text-gray-300 shrink-0 sticky left-[12rem] bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-md z-50 border-r border-b border-gray-200 dark:border-white/10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">KRA Details</div>
              <div className="flex-1 flex h-12 items-center">
                {currentViewMode === 'quarters' && quarters.map(quarter => (
                  <div key={quarter} className="flex-1 text-center text-sm font-semibold dark:text-gray-300">
                    {quarter}
                  </div>
                ))}
                {currentViewMode === 'months' && months.map(month => (
                  <div key={month} className="flex-1 text-center text-xs font-semibold dark:text-gray-300">
                    {month}
                  </div>
                ))}
                {currentViewMode === 'weeks' && (
                  <div className="flex w-full h-12 items-center">
                    {weeks.map((week, i) => (
                      <div
                        key={week}
                        className="text-center text-xs font-semibold dark:text-gray-300"
                        style={{ width: '1.92%' }}
                      >
                        {i % 4 === 0 ? week : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="relative isolate">
              {/* Vertical Grid Lines -  Use a container matching the scroll height */}
              <div className="absolute top-0 left-[calc(12rem+16rem)] right-0 bottom-0 pointer-events-none z-0 flex">
                {currentViewMode === 'quarters' && quarters.map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 border-r border-dashed border-gray-200 dark:border-white/5 ${i < 3 ? 'border-r' : 'border-r-0'}`}
                  />
                ))}
                {currentViewMode === 'months' && months.map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 border-r border-dashed border-gray-300 dark:border-white/5 ${i < 11 ? 'border-r' : 'border-r-0'}`}
                  />
                ))}
                {currentViewMode === 'weeks' && weeks.map((_, i) => (
                  <div
                    key={i}
                    className={`border-r border-dashed border-gray-200 dark:border-white/5 ${i < 51 ? 'border-r' : 'border-r-0'}`}
                    style={{
                      width: '1.92%'
                    }}
                  />
                ))}
              </div>

              <div className="relative z-10">
                {kras.map((kra, kraIndex) => {
                  const kpisExist = kra.unitKpis && kra.unitKpis.length > 0;

                  // --- Grouping Checks ---
                  const isFirstForObjective = kra.objective_id ? firstObjectiveMap.get(kra.objective_id) === kra.id : false;
                  const kraTitleKey = `${kra.objective_id}-${kra.title}`;
                  const isFirstForKraTitle = kra.title ? firstKraTitleMap.get(kraTitleKey) === kra.id : false;
                  // Check if it's the last KRA for this objective
                  const isLastForObjective = kra.objective_id ? lastObjectiveMap.get(kra.objective_id) === kra.id : false;
                  // Check if it's the last KRA for this title group
                  const isLastForKraTitle = kra.title ? lastKraTitleMap.get(kraTitleKey) === kra.id : false;
                  // Calculate date range for the KRA based on its KPIs
                  const kraDateRange = getKpiDateRange(kra.unitKpis || []);
                  // --- End Grouping Checks ---

                  return (
                    <div key={kra.id} className="flex items-stretch hover:bg-intranet-primary/[0.04] dark:hover:bg-white/5 relative group transition-all duration-300 ease-out border-b border-gray-200 dark:border-white/10">
                      {/* Objective Column - Sticky */}
                      <div className={`w-48 px-6 py-3 shrink-0 flex flex-col border-r border-gray-200 dark:border-white/10 sticky left-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md z-30 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] group-hover:bg-intranet-primary/[0.02] dark:group-hover:bg-white/5 ${isFirstForObjective ? 'border-t border-gray-200 dark:border-white/10' : ''} ${isLastForObjective ? 'border-b border-gray-200 dark:border-white/10' : ''}`}>
                        {isFirstForObjective && (
                          <span className="font-medium text-gray-900 dark:text-gray-100 block truncate text-sm mb-1" title={objectives.find(o => String(o.id) === String(kra.objective_id))?.title}>
                            {(() => {
                              // Find objective in the objectives array
                              const objective = objectives.find(o => String(o.id) === String(kra.objective_id));
                              // Return title if found, otherwise fallback
                              return objective?.title || (kra.objective_id ? `Obj ID: ${kra.objective_id}` : 'N/A');
                            })()}
                          </span>
                        )}
                        {/* Use a div with margin for spacing */}
                        <div className="mt-auto"></div>
                      </div>

                      {/* KRA Details Column - Sticky */}
                      <div className={`w-64 px-6 py-3 shrink-0 border-r border-gray-200 dark:border-white/10 flex flex-col sticky left-[12rem] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md z-30 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] group-hover:bg-intranet-primary/[0.02] dark:group-hover:bg-white/5 ${isFirstForKraTitle ? 'border-t border-gray-200 dark:border-white/10' : ''} ${isLastForKraTitle ? 'border-b border-gray-200 dark:border-white/10' : ''}`}>
                        {isFirstForKraTitle && (
                          <>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 block truncate" title={kra.title}>{kra.title}</div>
                            <div className="text-xs text-muted-foreground dark:text-gray-400 block truncate mt-0.5">{kra.unit || 'N/A'}</div>
                            {/* Display calculated date range */}
                            {kraDateRange && (
                              <div className="text-xs text-muted-foreground/80 dark:text-gray-500 block truncate mt-1">
                                {kraDateRange}
                              </div>
                            )}
                          </>
                        )}
                        {/* Use a div with margin for spacing */}
                        <div className="mt-auto"></div>
                      </div>

                      {/* Timeline Bars Column */}
                      <div
                        className={`flex-1 relative border-b border-gray-200 dark:border-white/10 ${isFirstForObjective || isFirstForKraTitle ? 'border-t border-gray-200 dark:border-white/10' : ''}`}
                        style={{ minHeight: kpisExist ? `${(kra.unitKpis.length * 2.5) + 1.5}rem` : '4rem' }}
                      >
                        {/* Container for KPI Bars */}
                        <div className={`relative ${kpisExist ? 'py-3 h-full' : 'h-full'}`}>
                          {kra.unitKpis && kra.unitKpis.map((kpi, kpiIndex) => {
                            const kpiStartDate = parseDate(kpi.start_date || kpi.startDate);
                            const kpiTargetDate = parseDate(kpi.target_date || kpi.targetDate);
                            const kpiStartPosition = calculatePosition(kpiStartDate);
                            const kpiWidth = calculateWidth(kpiStartDate, kpiTargetDate);
                            const kpiColorClass = getKpiStatusColorClass(kpi.status);
                            const kpiProgress = getKpiProgress(kpi);
                            const isTruncated = kpiWidth < 12; // Threshold for truncating text

                            if (!kpiStartDate || !kpiTargetDate) {
                              return <React.Fragment key={kpi.id || `kpi-${kraIndex}-${kpiIndex}-frag`}></React.Fragment>;
                            }

                            return (
                              <Tooltip key={kpi.id || `kpi-${kraIndex}-${kpiIndex}`} delayDuration={100}>
                                <TooltipTrigger asChild>
                                  {/* Outer div: Positions the bar */}
                                  <div
                                    className={`absolute h-6 rounded-md shadow-sm flex items-center transition-all hover:scale-105 hover:z-20 cursor-pointer ${kpiColorClass}`}
                                    style={{
                                      left: `${kpiStartPosition}%`,
                                      width: `${kpiWidth}%`,
                                      top: `${0.75 + kpiIndex * 2.5}rem`,
                                      // Ensure min width via CSS as overlap fallback
                                      minWidth: '12px'
                                    }}
                                  >
                                    {/* Progress Bar (Overlay) */}
                                    <div
                                      className="absolute top-0 left-0 h-full rounded-l-md bg-black/10"
                                      style={{ width: `${kpiProgress}%` }}
                                    />

                                    {/* KPI Name Label - Conditional Positioning */}
                                    <span
                                      className={`absolute items-center px-2 truncate block w-full whitespace-nowrap text-[11px] ${getStatusTextColor(kpi.status)}`}
                                      style={{
                                        // If bar is too small, move text outside to the right
                                        ...(isTruncated ? {
                                          left: '100%',
                                          marginLeft: '4px',
                                          color: '#374151', // Dark Gray for outside text
                                          textShadow: 'none',
                                          overflow: 'visible',
                                          width: 'auto'
                                        } : {
                                          inset: 0,
                                          display: 'flex',
                                        })
                                      }}
                                    >
                                      {/* Alert Icon for Critical Items */}
                                      {isCritical(kpi.status) && (
                                        <AlertCircle className={`h-3 w-3 mr-1 flex-shrink-0 ${isTruncated ? 'text-red-500' : 'text-inherit'}`} />
                                      )}

                                      {kpi.name}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                {/* Wrap TooltipContent in a Portal */}
                                <TooltipPrimitive.Portal>
                                  <TooltipContent side="top" align="center" className="z-[100] dark:bg-gray-950 dark:border-white/10 dark:text-gray-100">
                                    <p className="font-semibold">{kpi.name}</p>
                                    <p className="text-xs text-muted-foreground dark:text-gray-400">
                                      {kpi.start_date || kpi.startDate ? new Date(kpi.start_date || kpi.startDate).toLocaleDateString() : '?'} - {kpi.target_date || kpi.targetDate ? new Date(kpi.target_date || kpi.targetDate).toLocaleDateString() : '?'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${kpi.status === 'completed' ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30' :
                                        kpi.status === 'on-track' ? 'bg-green-50 dark:bg-green-500/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/30' :
                                          kpi.status === 'in-progress' ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30' :
                                            kpi.status === 'at-risk' ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30' :
                                              kpi.status === 'behind' ? 'bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30' :
                                                'bg-gray-50 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-500/30'
                                        }`}>
                                        {kpi.status}
                                      </span>
                                      <span className="text-xs">Progress: {kpiProgress}%</span>
                                    </div>
                                    {kpi.target !== undefined && <p className="text-xs">Target: {kpi.target}</p>}
                                    {kpi.actual !== undefined && <p className="text-xs">Actual: {kpi.actual}</p>}
                                  </TooltipContent>
                                </TooltipPrimitive.Portal>
                              </Tooltip>
                            );
                          })}
                        </div>
                        {/* "No KPIs" message */}
                        {!kpisExist && (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground px-4 text-center">
                            No KPIs defined for this KRA.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {kras.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">No KRAs to display.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400 pt-4 px-4 bg-background dark:bg-gray-900 border-t border-gray-100 dark:border-white/10 z-50">
          <div>{new Date().getFullYear()} Fiscal Year</div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-600 dark:bg-green-600" />
              <span>On Track</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-200 dark:bg-emerald-500/30 border border-green-300 dark:border-emerald-500/40" />
              <span>In Progress</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-amber-300 dark:bg-amber-500/30 border border-amber-400 dark:border-amber-500/40" />
              <span>At Risk</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-600 dark:bg-red-600" />
              <span>Behind</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default KRATimelineTab; 