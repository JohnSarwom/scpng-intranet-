import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowUpRight, ArrowDownRight, Bell, LayoutList, ChevronRight, ChevronUp, Loader2, Database } from "lucide-react";
import { formatCurrency, cn, formatDate, formatRelativeTime } from "@/lib/utils";
import { TooltipWrapper } from "@/components/ui/tooltip-wrapper";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { useAssetsSharePoint } from "@/hooks/useAssetsSharePoint";
import { useAssetSubSharePoint } from "@/hooks/useAssetSubSharePoint";

// --- Colors for Donut Chart ---
const DONUT_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function AssetDashboard() {
  const { assets, loading: loadingAssets, error: assetsError, refresh: refreshAssets } = useAssetsSharePoint();
  const { useMaintenance, useInvoices, refreshMaintenance, refreshInvoices } = useAssetSubSharePoint();
  
  const { data: maintenanceRecords = [], isLoading: loadingMaint } = useMaintenance();
  const { data: invoiceRecords = [], isLoading: loadingInvoices } = useInvoices();

  const loading = loadingAssets || loadingMaint || loadingInvoices;
  const error = assetsError?.message;

  // --- 1. Aggregated Summary Data ---
  const summary = useMemo(() => {
    if (!assets.length) return {
      total_purchase_cost: 0,
      total_active_assets: 0,
      total_distinct_active_types: 0,
      total_depreciated_value: 0,
      total_recent_purchase_cost: 0,
      total_recent_assets: 0,
      total_recent_distinct_types: 0
    };

    const activeAssets = assets.filter(a => !a.is_deleted && a.condition !== 'Decommissioned' && a.condition !== 'Sold');
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    const recentAssets = activeAssets.filter(a => {
      if (!a.purchase_date) return false;
      return new Date(a.purchase_date) >= thirtyDaysAgo;
    });

    const distinctTypes = new Set(activeAssets.map(a => a.type));
    const recentTypes = new Set(recentAssets.map(a => a.type));

    return {
      total_purchase_cost: activeAssets.reduce((sum, a) => sum + (Number(a.purchase_cost) || 0), 0),
      total_active_assets: activeAssets.length,
      total_distinct_active_types: distinctTypes.size,
      total_depreciated_value: activeAssets.reduce((sum, a) => sum + (Number(a.depreciated_value) || 0), 0),
      total_recent_purchase_cost: recentAssets.reduce((sum, a) => sum + (Number(a.purchase_cost) || 0), 0),
      total_recent_assets: recentAssets.length,
      total_recent_distinct_types: recentTypes.size
    };
  }, [assets]);

  // --- 2. Time Series Data (Acquisitions over time) ---
  const timeSeriesData = useMemo(() => {
    if (!assets.length) return [];
    
    const sortedAssets = [...assets]
      .filter(a => a.purchase_date)
      .sort((a, b) => new Date(a.purchase_date!).getTime() - new Date(b.purchase_date!).getTime());

    let cumulativeValue = 0;
    const dataPoints: Record<string, number> = {};

    sortedAssets.forEach(asset => {
      const dateKey = asset.purchase_date!.split('T')[0];
      cumulativeValue += (Number(asset.purchase_cost) || 0);
      dataPoints[dateKey] = cumulativeValue;
    });

    return Object.entries(dataPoints).map(([report_date, cumulative_purchase_cost]) => ({
      report_date,
      cumulative_purchase_cost
    })).sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime())
      .slice(-30);
  }, [assets]);

  // --- 3. Depreciation by Type (Donut) ---
  const depreciationByTypeData = useMemo(() => {
    const byType: Record<string, number> = {};
    assets.forEach(asset => {
      if (asset.is_deleted) return;
      const type = asset.type || 'Unknown';
      byType[type] = (byType[type] || 0) + (Number(asset.depreciated_value) || 0);
    });

    return Object.entries(byType)
      .map(([asset_type, total_depreciated_value_for_type]) => ({
        asset_type,
        total_depreciated_value_for_type
      }))
      .filter(d => d.total_depreciated_value_for_type > 0)
      .sort((a, b) => b.total_depreciated_value_for_type - a.total_depreciated_value_for_type);
  }, [assets]);

  // --- 4. Monthly Acquisition Trend (Bar) ---
  const monthlyAcquisitionData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const trend = months.map(m => ({ month: m, total_acquisition: 0 }));

    assets.forEach(asset => {
      if (!asset.purchase_date || asset.is_deleted) return;
      const d = new Date(asset.purchase_date);
      if (d.getFullYear() === currentYear) {
        trend[d.getMonth()].total_acquisition += (Number(asset.purchase_cost) || 0);
      }
    });

    return trend;
  }, [assets]);


  // --- 7. Upcoming Maintenance (Sorted by Date) ---
  const upcomingMaintenance = useMemo(() => {
    return maintenanceRecords
      .filter(m => m.status === 'Scheduled' && m.scheduled_date)
      .sort((a, b) => new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime())
      .slice(0, 5);
  }, [maintenanceRecords]);

  return (
    <Card className="w-full shadow-sm border">
      <CardContent className="p-6 space-y-6">
        <div className="shrink-0 space-y-0.5 border-b border-gray-100 dark:border-gray-800 pb-4 mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Database className="h-6 w-6 text-blue-600" />
              Asset Dashboard
            </h2>
            <p className="text-muted-foreground font-medium text-sm">Unified SharePoint Intelligence</p>
          </div>
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading} className="gap-2 border-primary/20 hover:bg-primary/5 transition-all">
            <Loader2 className={cn("h-4 w-4", loading && "animate-spin")} />
            Sync Data
          </Button>
        </div>

        {/* Top Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="overflow-hidden border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Total Value</CardTitle>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">Live</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold tracking-tight">
                {formatCurrency(summary.total_purchase_cost)}
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span className="flex items-center gap-1.5"><LayoutList className="h-3.5 w-3.5" /> {summary.total_active_assets} Assets</span>
                <span className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> {summary.total_distinct_active_types} Categories</span>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-l-4 border-l-emerald-500 shadow-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest text-emerald-800/80">Growth (30D)</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold tracking-tight">
                {formatCurrency(summary.total_recent_purchase_cost)}
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span className="flex items-center gap-1.5"><LayoutList className="h-3.5 w-3.5" /> {summary.total_recent_assets} New Assets</span>
                <span className="flex items-center gap-1.5 text-emerald-600">Active Cycle</span>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-l-4 border-l-amber-500 shadow-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest text-amber-800/80">Asset Lifecycles</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold tracking-tight text-amber-700/90">
                {formatCurrency(summary.total_depreciated_value)}
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Net Book Value:</span>
                <span className="font-bold text-blue-600">{formatCurrency(summary.total_purchase_cost - summary.total_depreciated_value)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <Card className="overflow-hidden md:col-span-8 shadow-sm border-gray-100 hover:border-gray-200 transition-colors">
            <CardHeader>
              <CardTitle className="text-base font-bold text-gray-800">Asset Growth Trend (SharePoint Realtime)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeriesData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis dataKey="report_date" tickFormatter={formatDateTick} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tickFormatter={formatCurrencyTick} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(v: number) => [formatCurrency(v), "Cumulative Value"]} 
                      labelFormatter={formatDateTick} 
                    />
                    <Area type="monotone" dataKey="cumulative_purchase_cost" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorValue)" dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden md:col-span-4 shadow-sm border-gray-100 hover:border-gray-200 transition-colors">
            <CardHeader>
              <CardTitle className="text-base font-bold text-gray-800">Value by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={depreciationByTypeData}
                      cx="50%" cy="50%"
                      innerRadius={65} outerRadius={85}
                      paddingAngle={5}
                      dataKey="total_depreciated_value_for_type"
                      nameKey="asset_type"
                    >
                      {depreciationByTypeData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(v: number) => formatCurrency(v)} 
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-4">
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-60">Total</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.total_depreciated_value)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 shadow-sm border-gray-100">
            <CardHeader>
              <CardTitle className="text-base font-bold text-gray-800">Monthly Acquisition Trends ({new Date().getFullYear()})</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyAcquisitionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tickFormatter={formatCurrencyTick} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip 
                    cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(v: number) => [formatCurrency(v), "Monthly Spending"]} 
                  />
                  <Bar dataKey="total_acquisition" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-sm border-gray-100">
              <CardHeader className="pb-3 border-b border-gray-50 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-gray-500">Recent Assignments</CardTitle>
                <Badge variant="outline" className="text-[10px] font-bold">5 Latest</Badge>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {recentlyAssignedAssets.length > 0 ? (
                  recentlyAssignedAssets.map(asset => (
                    <div key={asset.id} className="flex items-center gap-3 group">
                      <Avatar className="h-9 w-9 border-2 border-white shadow-sm overflow-hidden bg-gray-100 group-hover:scale-105 transition-transform">
                        {asset.image_url && <AvatarImage src={asset.image_url} alt={asset.name} />}
                        <AvatarFallback className="bg-blue-600 text-white font-extrabold text-xs">{asset.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate text-gray-800 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{asset.name}</p>
                        <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          {asset.assigned_to}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-bold whitespace-nowrap bg-gray-50 px-2 py-1 rounded">
                        {formatRelativeTime(asset.assigned_date)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6 italic font-medium">No recent assignments found.</p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-gray-100">
              <CardHeader className="pb-3 border-b border-gray-50 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-gray-500">Upcoming Maintenance</CardTitle>
                <Wrench className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {upcomingMaintenance.length > 0 ? (
                  upcomingMaintenance.map(record => (
                    <div key={record.id} className="flex items-center gap-3 group">
                      <div className="flex flex-col items-center justify-center w-9 h-9 border rounded-lg bg-amber-50 group-hover:bg-amber-100 transition-colors">
                        <p className="text-[10px] font-bold text-amber-700 leading-none">{new Date(record.scheduled_date!).toLocaleDateString(undefined, { month: 'short' })}</p>
                        <p className="text-xs font-black text-amber-800 leading-none mt-0.5">{new Date(record.scheduled_date!).getDate()}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                         <p className="text-xs font-bold truncate text-gray-800 uppercase tracking-tight">{getAssetName(record.asset_id)}</p>
                        <p className="text-[10px] text-amber-700 font-bold capitalize flex items-center gap-1">
                          <RotateCcw className="h-2.5 w-2.5" />
                          {record.maintenance_type || 'Routine'}
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6 italic font-medium">No upcoming maintenance scheduled.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Helper inside component to resolve asset names
  function getAssetName(assetId: string) {
    const asset = assets.find(a => a.id === assetId || a.serial_number === assetId);
    return asset ? asset.name : assetId;
  }
}

// Internal reusable components
function Badge({ variant = "default", children, className }: { variant?: "default" | "secondary" | "outline", children: React.ReactNode, className?: string }) {
  const variants = {
    default: "bg-blue-600 text-white",
    secondary: "bg-gray-100 text-gray-900 border-transparent",
    outline: "border border-gray-200 text-gray-600 font-bold"
  };
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight", variants[variant], className)}>
      {children}
    </span>
  );
}

const Wrench = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
);
