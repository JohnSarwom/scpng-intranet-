import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Users, Target, Search, ExternalLink,
  Building2, List, LayoutGrid,
} from 'lucide-react';
import { UnitComparisonData, RAGStatus } from '@/types/division.types';
import { UseDivisionDataReturn } from '@/hooks/useDivisionData';
import { DivisionMetrics } from '@/types/division.types';
import { useNavigate } from 'react-router-dom';
import OfficerProfileModal, { OfficerProfile, OfficerPerformanceStats } from '@/components/strategy/OfficerProfileModal';
import { useOfficerProfiles } from '@/hooks/useOfficerProfiles';
import { useEmployeePhotos } from '@/hooks/useEmployeePhotos';

type ViewMode = 'units' | 'officers' | 'table';

// Use the exported type from modal (single source of truth)
type OfficerStats = OfficerPerformanceStats;

function computeOfficerStats(email: string, data: UseDivisionDataReturn): OfficerStats {
  const e = email.toLowerCase();

  const myTasks = data.tasks.filter(t =>
    t.assignee?.toLowerCase() === e ||
    t.assignedTo?.toLowerCase() === e ||
    t.createdByEmail?.toLowerCase() === e ||
    t.assignees?.some(a => (a as any).email?.toLowerCase() === e)
  );
  const completedTasks = myTasks.filter(t => t.status === 'completed' || t.status === 'done').length;
  const inProgressTasks = myTasks.filter(t => t.status === 'in-progress').length;
  const inReviewTasks = myTasks.filter(t => t.status === 'in-review').length;
  const onHoldTasks = myTasks.filter(t => t.status === 'on-hold').length;
  const todoTasks = myTasks.filter(t => t.status === 'todo').length;
  const taskScore = myTasks.length > 0 ? (completedTasks / myTasks.length) * 100 : 0;

  const myKRAs = data.combinedKras.filter(k =>
    (k as any).owner?.email?.toLowerCase() === e ||
    (k as any).ownerId?.toLowerCase() === e
  );
  const kraProgress = myKRAs.length > 0
    ? Math.round(myKRAs.reduce((sum, k) => sum + ((k as any).progress || 0), 0) / myKRAs.length)
    : 0;

  const myKPIs = data.kpis.filter(k =>
    (k as any).owner?.email?.toLowerCase() === e ||
    (k as any).ownerId?.toLowerCase() === e
  );
  const onTrackKPIs = myKPIs.filter(k => k.status === 'on-track' || k.status === 'completed').length;
  const kpiScore = myKPIs.length > 0 ? (onTrackKPIs / myKPIs.length) * 100 : 0;

  const myObjectives = data.objectives.filter(o =>
    (o as any).owner?.email?.toLowerCase() === e ||
    (o as any).responsible?.toLowerCase() === e
  );

  const overallScore = Math.round(taskScore * 0.5 + kraProgress * 0.3 + kpiScore * 0.2);

  return {
    totalTasks: myTasks.length,
    completedTasks,
    inProgressTasks,
    inReviewTasks,
    onHoldTasks,
    todoTasks,
    taskCompletion: Math.round(taskScore),
    totalKRAs: myKRAs.length,
    kraProgress,
    totalKPIs: myKPIs.length,
    onTrackKPIs,
    totalObjectives: myObjectives.length,
    overallScore,
  };
}

// --- RAG helpers ---
const ragBorderLeft = (score: number) =>
  score >= 70 ? 'border-l-green-400' : score >= 40 ? 'border-l-amber-400' : 'border-l-red-400';
const ragBorderTop = (score: number) =>
  score >= 70 ? 'border-t-green-400' : score >= 40 ? 'border-t-amber-400' : 'border-t-red-400';
const ragDot = (score: number) =>
  score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500';
const ragText = (score: number) =>
  score >= 70 ? 'text-green-600' : score >= 40 ? 'text-amber-600' : 'text-red-600';

// --- Unit Performance Card ---
interface UnitPerformanceCardProps {
  unit: UnitComparisonData;
  onClick: () => void;
}

const UnitPerformanceCard: React.FC<UnitPerformanceCardProps> = ({ unit, onClick }) => {
  const ragStatus: RAGStatus = unit.overallScore >= 70 ? 'green' : unit.overallScore >= 40 ? 'amber' : 'red';
  const ragColors = {
    green: 'border-l-green-200 dark:border-l-green-800',
    amber: 'border-l-amber-200 dark:border-l-amber-800',
    red: 'border-l-red-200 dark:border-l-red-800',
  };
  const dotColors = { green: 'bg-green-500', amber: 'bg-amber-500', red: 'bg-red-500' };

  return (
    <Card
      className={`cursor-pointer hover:shadow-lg transition-all border-l-4 ${ragColors[ragStatus]}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${dotColors[ragStatus]}`} />
            <h3 className="font-semibold text-sm">{unit.unitName}</h3>
          </div>
          <Badge variant="outline" className="text-xs">{unit.staffCount} staff</Badge>
        </div>

        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Task Completion</span>
              <span className="font-medium">{unit.taskCompletion}%</span>
            </div>
            <Progress value={unit.taskCompletion} className="h-1.5" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">KRA Progress</span>
              <span className="font-medium">{unit.kraProgress}%</span>
            </div>
            <Progress value={unit.kraProgress} className="h-1.5" />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Overall Score</span>
          <span className="text-lg font-bold">{unit.overallScore}%</span>
        </div>
      </CardContent>
    </Card>
  );
};

// --- Staff Roster (unit drill-down modal) ---
const StaffRoster: React.FC<{
  unitName: string;
  staff: { name: string; email: string; unit: string; jobTitle: string }[];
}> = ({ unitName, staff }) => {
  const unitStaff = staff.filter(s => s.unit === unitName);
  return (
    <div>
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Users className="h-4 w-4" />
        Staff ({unitStaff.length})
      </h4>
      {unitStaff.length === 0 ? (
        <p className="text-sm text-muted-foreground">No staff found for this unit.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unitStaff.map(s => (
              <TableRow key={s.email}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-[#83002A] text-white">
                        {s.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    {s.name}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.jobTitle}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.email}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

// --- Officer Profile Card ---
const OfficerCard: React.FC<{
  staff: { name: string; email: string; unit: string; jobTitle: string };
  photoUrl?: string;
  stats: OfficerStats;
  onClick: () => void;
}> = ({ staff, photoUrl, stats, onClick }) => {
  const initials = staff.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Card
      className={`overflow-hidden cursor-pointer hover:shadow-lg transition-all border-t-4 ${ragBorderTop(stats.overallScore)}`}
      onClick={onClick}
    >
      <div className="h-10 bg-gradient-to-r from-[#600018] to-[#900030] relative">
        <div className={`absolute bottom-2 right-2 w-2 h-2 rounded-full ${ragDot(stats.overallScore)} ring-2 ring-white`} />
      </div>
      <CardContent className="p-4 pt-0">
        <div className="flex justify-center">
          <Avatar className="w-16 h-16 -mt-8 border-4 border-white shadow-md">
            {photoUrl && <AvatarImage src={photoUrl} alt={staff.name} className="object-cover" />}
            <AvatarFallback className="bg-[#800020] text-white text-lg font-bold">{initials}</AvatarFallback>
          </Avatar>
        </div>

        <div className="text-center mt-2 mb-3">
          <h3 className="font-semibold text-sm leading-tight">{staff.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{staff.jobTitle}</p>
          <Badge variant="outline" className="text-[10px] mt-1 px-2 py-0 border-[#800020]/30 text-[#800020]">
            {staff.unit}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-1 text-center border-t pt-2.5">
          <div>
            <div className="text-sm font-bold">
              {stats.completedTasks}
              <span className="text-xs font-normal text-muted-foreground">/{stats.totalTasks}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">Tasks</div>
          </div>
          <div>
            <div className="text-sm font-bold">{stats.totalKRAs}</div>
            <div className="text-[10px] text-muted-foreground">KRAs</div>
          </div>
          <div>
            <div className="text-sm font-bold">
              {stats.onTrackKPIs}
              <span className="text-xs font-normal text-muted-foreground">/{stats.totalKPIs}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">KPIs</div>
          </div>
        </div>

        <div className="mt-2.5">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Overall</span>
            <span className={`font-semibold ${ragText(stats.overallScore)}`}>{stats.overallScore}%</span>
          </div>
          <Progress value={stats.overallScore} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  );
};

// --- Main Units Tab ---
interface DivisionUnitsTabProps {
  data: UseDivisionDataReturn;
  metrics: DivisionMetrics;
}

export const DivisionUnitsTab: React.FC<DivisionUnitsTabProps> = ({ data, metrics }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('units');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<UnitComparisonData | null>(null);
  const [selectedOfficer, setSelectedOfficer] = useState<OfficerProfile | null>(null);
  const [selectedOfficerStats, setSelectedOfficerStats] = useState<OfficerStats | null>(null);
  const navigate = useNavigate();

  const { data: officerProfiles } = useOfficerProfiles();
  const { getPhotosForEmails, isInitialized: photosInitialized } = useEmployeePhotos();
  const [photoUrls, setPhotoUrls] = useState<Map<string, { profileUrl?: string; modalUrl?: string }>>(new Map());

  // Fetch photos when in officer / table mode
  useEffect(() => {
    if ((viewMode === 'officers' || viewMode === 'table') && photosInitialized && data.staff.length > 0) {
      const emails = data.staff.map(s => s.email).filter(Boolean);
      if (emails.length > 0) {
        getPhotosForEmails(emails).then(map => setPhotoUrls(map)).catch(() => { });
      }
    }
  }, [viewMode, photosInitialized, data.staff, getPhotosForEmails]);

  // Pre-compute per-officer stats
  const officerStatsMap = useMemo(() => {
    const map = new Map<string, OfficerStats>();
    data.staff.forEach(s => {
      map.set(s.email.toLowerCase(), computeOfficerStats(s.email, data));
    });
    return map;
  }, [data]);

  // Filtered units (view 1)
  const filteredUnits = useMemo(() => {
    if (!searchQuery.trim()) return metrics.unitComparisons;
    return metrics.unitComparisons.filter(u =>
      u.unitName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [metrics.unitComparisons, searchQuery]);

  // Filtered staff (views 2 & 3)
  const filteredStaff = useMemo(() => {
    if (!searchQuery.trim()) return data.staff;
    const q = searchQuery.toLowerCase();
    return data.staff.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.unit.toLowerCase().includes(q) ||
      s.jobTitle.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  }, [data.staff, searchQuery]);

  const handleOfficerClick = (staffMember: { name: string; email: string; unit: string; jobTitle: string }) => {
    const matched = officerProfiles?.find(p => p.email.toLowerCase() === staffMember.email.toLowerCase());
    const photos = photoUrls.get(staffMember.email.toLowerCase());

    const profile: OfficerProfile = matched ? {
      ...matched,
      photoUrl: photos?.profileUrl ?? matched.photoUrl,
      modalUrl: photos?.modalUrl ?? matched.modalUrl,
    } : {
      name: staffMember.name,
      jobTitle: staffMember.jobTitle,
      email: staffMember.email,
      phone: null,
      employeeId: 'N/A',
      joinedDate: 'N/A',
      division: data.division?.name || '',
      unit: staffMember.unit,
      summary: '',
      skills: [],
      reportsTo: null,
      directReports: 0,
      officeExtension: null,
      timezone: 'PGT (GMT+10)',
      photoUrl: photos?.profileUrl,
      modalUrl: photos?.modalUrl,
    };

    const stats = officerStatsMap.get(staffMember.email.toLowerCase()) ?? computeOfficerStats(staffMember.email, data);
    setSelectedOfficer(profile);
    setSelectedOfficerStats(stats);
  };

  const switchView = (mode: ViewMode) => {
    setViewMode(mode);
    setSearchQuery('');
  };

  const countLabel = viewMode === 'units'
    ? `${filteredUnits.length} unit${filteredUnits.length !== 1 ? 's' : ''}`
    : `${filteredStaff.length} officer${filteredStaff.length !== 1 ? 's' : ''}`;

  const viewButtons: { mode: ViewMode; icon: React.ElementType; label: string }[] = [
    { mode: 'units', icon: Building2, label: 'Units' },
    { mode: 'officers', icon: Users, label: 'Officer Cards' },
    { mode: 'table', icon: List, label: 'Table' },
  ];

  return (
    <div className="space-y-4 mt-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={viewMode === 'units' ? 'Search units...' : 'Search officers...'}
            className="pl-9"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* View mode toggles */}
        <div className="flex items-center gap-0.5 border rounded-lg p-0.5 bg-muted/30">
          {viewButtons.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => switchView(mode)}
              title={label}
              className={`p-1.5 rounded-md transition-all ${viewMode === mode
                  ? 'bg-[#800020] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        <div className="text-sm text-muted-foreground whitespace-nowrap">{countLabel}</div>
      </div>

      {/* ── View 1: Unit Cards ── */}
      {viewMode === 'units' && (
        filteredUnits.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              No units found
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUnits.map(unit => (
              <UnitPerformanceCard
                key={unit.unitId}
                unit={unit}
                onClick={() => setSelectedUnit(unit)}
              />
            ))}
          </div>
        )
      )}

      {/* ── View 2: Officer Profile Cards ── */}
      {viewMode === 'officers' && (
        filteredStaff.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              No officers found
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {Array.from(new Set(filteredStaff.map(s => s.unit || 'Other Unit'))).sort().map(unitName => {
              const unitStaff = filteredStaff.filter(s => (s.unit || 'Other Unit') === unitName);
              return (
                <div key={unitName} className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Building2 className="h-5 w-5 text-[#800020]" />
                    <h3 className="text-lg font-semibold text-[#800020]">{unitName}</h3>
                    <Badge variant="outline" className="ml-2 bg-[#800020]/5 text-[#800020] border-[#800020]/20">
                      {unitStaff.length} Officer{unitStaff.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {unitStaff.map(s => {
                      const stats = officerStatsMap.get(s.email.toLowerCase()) ?? computeOfficerStats(s.email, data);
                      const photos = photoUrls.get(s.email.toLowerCase());
                      return (
                        <OfficerCard
                          key={s.email}
                          staff={s}
                          photoUrl={photos?.profileUrl}
                          stats={stats}
                          onClick={() => handleOfficerClick(s)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── View 3: Officers Table ── */}
      {viewMode === 'table' && (
        <Card>
          <CardContent className="p-0">
            {filteredStaff.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                No officers found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4 w-56">Officer</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-center">Tasks</TableHead>
                    <TableHead className="text-center">Task %</TableHead>
                    <TableHead className="text-center">KRAs</TableHead>
                    <TableHead className="text-center">KRA Prog.</TableHead>
                    <TableHead className="text-center">KPIs</TableHead>
                    <TableHead className="text-center">Objectives</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.map(s => {
                    const stats = officerStatsMap.get(s.email.toLowerCase()) ?? computeOfficerStats(s.email, data);
                    const photos = photoUrls.get(s.email.toLowerCase());
                    const initials = s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <TableRow
                        key={s.email}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleOfficerClick(s)}
                      >
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              {photos?.profileUrl && (
                                <AvatarImage src={photos.profileUrl} alt={s.name} className="object-cover" />
                              )}
                              <AvatarFallback className="text-[10px] bg-[#83002A] text-white">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{s.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{s.jobTitle}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs border-[#800020]/30 text-[#800020] whitespace-nowrap">
                            {s.unit}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          <span className="font-medium">{stats.completedTasks}</span>
                          <span className="text-muted-foreground text-xs">/{stats.totalTasks}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-1.5 justify-center">
                            <Progress value={stats.taskCompletion} className="h-1.5 w-14" />
                            <span className="text-xs w-7 text-right">{stats.taskCompletion}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm font-medium">{stats.totalKRAs}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-1.5 justify-center">
                            <Progress value={stats.kraProgress} className="h-1.5 w-14" />
                            <span className="text-xs w-7 text-right">{stats.kraProgress}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          <span className="font-medium">{stats.onTrackKPIs}</span>
                          <span className="text-muted-foreground text-xs">/{stats.totalKPIs}</span>
                        </TableCell>
                        <TableCell className="text-center text-sm font-medium">{stats.totalObjectives}</TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm font-bold ${ragText(stats.overallScore)}`}>
                            {stats.overallScore}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Unit Drill-Down Modal (units view) */}
      <Dialog open={!!selectedUnit} onOpenChange={() => setSelectedUnit(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-[#83002A]" />
              {selectedUnit?.unitName}
            </DialogTitle>
          </DialogHeader>

          {selectedUnit && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-bold">{selectedUnit.taskCompletion}%</div>
                    <div className="text-xs text-muted-foreground">Task Completion</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-bold">{selectedUnit.kraProgress}%</div>
                    <div className="text-xs text-muted-foreground">KRA Progress</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-bold">{selectedUnit.staffCount}</div>
                    <div className="text-xs text-muted-foreground">Staff Members</div>
                  </CardContent>
                </Card>
              </div>

              <StaffRoster unitName={selectedUnit.unitName} staff={data.staff} />

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setSelectedUnit(null); navigate('/unit'); }}
                  className="gap-2"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Unit Page
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Officer Profile Modal (officers + table views) */}
      <OfficerProfileModal
        officer={selectedOfficer}
        open={!!selectedOfficer}
        onClose={() => { setSelectedOfficer(null); setSelectedOfficerStats(null); }}
        performance={selectedOfficerStats ?? undefined}
      />
    </div>
  );
};
