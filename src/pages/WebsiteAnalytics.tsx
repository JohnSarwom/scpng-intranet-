import React, { useState, useMemo } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Eye, Users, Globe, Clock, Monitor, Smartphone, Tablet,
  ArrowUp, ArrowDown, TrendingUp, ExternalLink, FileText,
  BarChart3, Activity, MousePointerClick, Zap
} from 'lucide-react';
import WebsiteAnalyticsAIChat, { type WebsiteAnalyticsData } from '@/components/analytics/WebsiteAnalyticsAIChat';
import FacebookAnalyticsTab from '@/components/analytics/FacebookAnalyticsTab';

// ─── Mock Data ───────────────────────────────────────────────

const OVERVIEW_STATS = {
  totalPageViews: 12_847,
  uniqueVisitors: 3_214,
  avgSessionDuration: '4m 32s',
  bounceRate: 34.2,
  pageViewsTrend: 12.5,
  visitorsTrend: 8.3,
  sessionTrend: -2.1,
  bounceTrend: -5.4,
};

const DAILY_VIEWS = [
  { date: 'Mar 1', views: 380, visitors: 102 },
  { date: 'Mar 2', views: 420, visitors: 118 },
  { date: 'Mar 3', views: 310, visitors: 89 },
  { date: 'Mar 4', views: 455, visitors: 134 },
  { date: 'Mar 5', views: 502, visitors: 148 },
  { date: 'Mar 6', views: 478, visitors: 139 },
  { date: 'Mar 7', views: 390, visitors: 110 },
  { date: 'Mar 8', views: 425, visitors: 121 },
  { date: 'Mar 9', views: 510, visitors: 155 },
  { date: 'Mar 10', views: 468, visitors: 136 },
  { date: 'Mar 11', views: 535, visitors: 162 },
  { date: 'Mar 12', views: 490, visitors: 145 },
  { date: 'Mar 13', views: 445, visitors: 128 },
  { date: 'Mar 14', views: 520, visitors: 158 },
];

const TOP_PAGES = [
  { path: '/', title: 'Home Page', views: 3_420, uniqueViews: 1_890, avgTime: '2m 15s' },
  { path: '/about', title: 'About SCPNG', views: 1_856, uniqueViews: 1_234, avgTime: '3m 42s' },
  { path: '/licensing', title: 'Licensing Information', views: 1_540, uniqueViews: 1_102, avgTime: '5m 18s' },
  { path: '/market-data', title: 'Market Data & Statistics', views: 1_320, uniqueViews: 890, avgTime: '6m 05s' },
  { path: '/publications', title: 'Publications & Reports', views: 1_105, uniqueViews: 780, avgTime: '4m 30s' },
  { path: '/contact', title: 'Contact Us', views: 892, uniqueViews: 745, avgTime: '1m 48s' },
  { path: '/investor-education', title: 'Investor Education', views: 756, uniqueViews: 620, avgTime: '7m 12s' },
  { path: '/news', title: 'News & Announcements', views: 698, uniqueViews: 510, avgTime: '3m 55s' },
  { path: '/complaints', title: 'File a Complaint', views: 540, uniqueViews: 480, avgTime: '4m 22s' },
  { path: '/forms', title: 'Downloadable Forms', views: 420, uniqueViews: 380, avgTime: '2m 40s' },
];

const TOP_REFERRERS = [
  { source: 'Google Search', visits: 4_320, percentage: 33.6 },
  { source: 'Direct', visits: 3_180, percentage: 24.8 },
  { source: 'Facebook', visits: 1_560, percentage: 12.1 },
  { source: 'PNG Government Portal', visits: 1_240, percentage: 9.7 },
  { source: 'PNGX (Stock Exchange)', visits: 890, percentage: 6.9 },
  { source: 'Bank of PNG', visits: 620, percentage: 4.8 },
  { source: 'LinkedIn', visits: 450, percentage: 3.5 },
  { source: 'Bing Search', visits: 320, percentage: 2.5 },
  { source: 'Other', visits: 267, percentage: 2.1 },
];

const DEVICE_BREAKDOWN = [
  { device: 'Desktop', icon: Monitor, count: 7_108, percentage: 55.3, color: 'bg-blue-500' },
  { device: 'Mobile', icon: Smartphone, count: 4_495, percentage: 35.0, color: 'bg-green-500' },
  { device: 'Tablet', icon: Tablet, count: 1_244, percentage: 9.7, color: 'bg-amber-500' },
];

const BROWSER_STATS = [
  { name: 'Chrome', percentage: 62.4, color: 'bg-blue-500' },
  { name: 'Safari', percentage: 18.2, color: 'bg-gray-500' },
  { name: 'Firefox', percentage: 8.6, color: 'bg-orange-500' },
  { name: 'Edge', percentage: 7.1, color: 'bg-cyan-500' },
  { name: 'Other', percentage: 3.7, color: 'bg-slate-400' },
];

const RECENT_VISITS = [
  { ip: '202.168.xxx.xxx', page: '/', referrer: 'Google', userAgent: 'Chrome 122 / Windows', time: '2 min ago', country: 'PG' },
  { ip: '103.24.xxx.xxx', page: '/licensing', referrer: 'Direct', userAgent: 'Safari 17 / macOS', time: '5 min ago', country: 'AU' },
  { ip: '202.168.xxx.xxx', page: '/market-data', referrer: 'PNGX', userAgent: 'Chrome 122 / Android', time: '8 min ago', country: 'PG' },
  { ip: '180.150.xxx.xxx', page: '/about', referrer: 'Google', userAgent: 'Firefox 123 / Windows', time: '12 min ago', country: 'AU' },
  { ip: '202.168.xxx.xxx', page: '/publications', referrer: 'Facebook', userAgent: 'Chrome 122 / Windows', time: '15 min ago', country: 'PG' },
  { ip: '14.200.xxx.xxx', page: '/investor-education', referrer: 'LinkedIn', userAgent: 'Edge 122 / Windows', time: '18 min ago', country: 'AU' },
  { ip: '202.165.xxx.xxx', page: '/contact', referrer: 'Direct', userAgent: 'Chrome 122 / iPhone', time: '22 min ago', country: 'PG' },
  { ip: '103.68.xxx.xxx', page: '/news', referrer: 'Google', userAgent: 'Safari 17 / iPad', time: '25 min ago', country: 'NZ' },
];

const GEO_DISTRIBUTION = [
  { country: 'Papua New Guinea', visits: 8_540, pct: 66.5 },
  { country: 'Australia', visits: 2_180, pct: 17.0 },
  { country: 'New Zealand', pct: 4.8, visits: 620 },
  { country: 'United States', visits: 480, pct: 3.7 },
  { country: 'Singapore', visits: 340, pct: 2.6 },
  { country: 'United Kingdom', visits: 280, pct: 2.2 },
  { country: 'Other', visits: 407, pct: 3.2 },
];

const SOCIAL_STATS = {
  facebook: { reach: 12_450, engagement: 2_840, followers: 8_210, trend: 15.4 },
  linkedin: { impressions: 4_320, clicks: 890, followers: 1_450, trend: 8.2 },
};

const CROSS_PLATFORM_TRENDS = [
  { date: 'Mar 1', website: 380, facebook: 420, linkedin: 120 },
  { date: 'Mar 2', website: 420, facebook: 510, linkedin: 145 },
  { date: 'Mar 3', website: 310, facebook: 380, linkedin: 90 },
  { date: 'Mar 4', website: 455, facebook: 590, linkedin: 160 },
  { date: 'Mar 5', website: 502, facebook: 640, linkedin: 185 },
  { date: 'Mar 6', website: 478, facebook: 610, linkedin: 170 },
  { date: 'Mar 7', website: 390, facebook: 480, linkedin: 130 },
  { date: 'Mar 8', website: 425, facebook: 530, linkedin: 155 },
  { date: 'Mar 9', website: 510, facebook: 710, linkedin: 210 },
  { date: 'Mar 10', website: 468, facebook: 645, linkedin: 195 },
  { date: 'Mar 11', website: 535, facebook: 780, linkedin: 240 },
  { date: 'Mar 12', website: 490, facebook: 720, linkedin: 220 },
  { date: 'Mar 13', website: 445, facebook: 660, linkedin: 190 },
  { date: 'Mar 14', website: 520, facebook: 810, linkedin: 260 },
];

const AUDIENCE_GROWTH = [
  { date: 'Mar 8', total: 11_420 },
  { date: 'Mar 9', total: 11_580 },
  { date: 'Mar 10', total: 11_710 },
  { date: 'Mar 11', total: 11_940 },
  { date: 'Mar 12', total: 12_120 },
  { date: 'Mar 13', total: 12_450 },
  { date: 'Mar 14', total: 12_874 },
];

const CONTENT_PERFORMANCE = [
  { category: 'News & Media', engagement: 6_420, color: 'bg-primary' },
  { category: 'Licensing Info', engagement: 4_180, color: 'bg-blue-600' },
  { category: 'Market Data', engagement: 3_850, color: 'bg-[#0077b5]' },
  { category: 'Investor Ed', engagement: 2_940, color: 'bg-green-600' },
  { category: 'Regulatory', engagement: 1_280, color: 'bg-amber-600' },
];

const HOURLY_TRAFFIC = [
  { hour: '00', views: 45 }, { hour: '01', views: 28 }, { hour: '02', views: 15 },
  { hour: '03', views: 12 }, { hour: '04', views: 18 }, { hour: '05', views: 32 },
  { hour: '06', views: 58 }, { hour: '07', views: 120 }, { hour: '08', views: 245 },
  { hour: '09', views: 380 }, { hour: '10', views: 420 }, { hour: '11', views: 390 },
  { hour: '12', views: 310 }, { hour: '13', views: 365 }, { hour: '14', views: 395 },
  { hour: '15', views: 350 }, { hour: '16', views: 280 }, { hour: '17', views: 190 },
  { hour: '18', views: 145 }, { hour: '19', views: 110 }, { hour: '20', views: 88 },
  { hour: '21', views: 72 }, { hour: '22', views: 60 }, { hour: '23', views: 48 },
];

// ─── Helper Components ───────────────────────────────────────

function StatCard({ title, value, trend, icon: Icon, suffix }: {
  title: string;
  value: string | number;
  trend: number;
  icon: React.ElementType;
  suffix?: string;
}) {
  const isPositive = trend > 0;
  const trendIsGood = title === 'Bounce Rate' ? !isPositive : isPositive;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">
              {typeof value === 'number' ? value.toLocaleString() : value}
              {suffix}
            </p>
            <div className={`flex items-center gap-1 mt-1 text-sm ${trendIsGood ? 'text-green-600' : 'text-red-500'}`}>
              {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              <span>{Math.abs(trend)}% vs last month</span>
            </div>
          </div>
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniBarChart({ data, maxValue, height = 120 }: { data: { label: string; value: number }[]; maxValue: number; height?: number }) {
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-primary/80 rounded-t hover:bg-primary transition-colors min-h-[2px]"
            style={{ height: `${(d.value / maxValue) * 100}%` }}
            title={`${d.label}: ${d.value}`}
          />
          <span className="text-[10px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ percentage, color = 'bg-primary' }: { percentage: number; color?: string }) {
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${percentage}%` }} />
    </div>
  );
}

// ─── Page Component ──────────────────────────────────────────

const WebsiteAnalytics = () => {
  const [dateRange, setDateRange] = useState('30d');

  const maxDailyViews = Math.max(...DAILY_VIEWS.map(d => d.views));
  const maxHourlyViews = Math.max(...HOURLY_TRAFFIC.map(d => d.views));

  // Assemble data for the AI chat component
  const analyticsData: WebsiteAnalyticsData = {
    overview: OVERVIEW_STATS,
    topPages: TOP_PAGES,
    referrers: TOP_REFERRERS,
    devices: DEVICE_BREAKDOWN.map(d => ({ device: d.device, count: d.count, percentage: d.percentage })),
    browsers: BROWSER_STATS,
    dailyViews: DAILY_VIEWS,
    geoDistribution: GEO_DISTRIBUTION,
    activeVisitors: 24,
    newVisitorPct: 62.3,
    returningVisitorPct: 37.7,
  };

  // ─── Dynamic Insights Logic (Local/Free) ─────────────────────
  const insights = useMemo(() => {
    // Helper: Select template based on threshold
    const getInsight = (value: number, thresholds: { neutral: number, positive: number }, templates: { high: string, mid: string, low: string }, data: any) => {
      let template = templates.mid;
      if (value >= thresholds.positive) template = templates.high;
      if (value < thresholds.neutral) template = templates.low;
      
      return template.replace(/{(\w+)}/g, (match, key) => data[key] || match);
    };

    // 1. Dominant Channel Logic
    const channels = [
      { name: 'Website', value: OVERVIEW_STATS.totalPageViews },
      { name: 'Facebook', value: SOCIAL_STATS.facebook.reach },
      { name: 'LinkedIn', value: SOCIAL_STATS.linkedin.impressions }
    ];
    const dominant = [...channels].sort((a, b) => b.value - a.value)[0];
    const totalReach = channels.reduce((sum, c) => sum + c.value, 0);
    const dominantPct = Math.round((dominant.value / totalReach) * 100);

    const dominantTemplates = {
      high: "{name} is effectively your core platform, commanding a massive {pct}% of your total brand reach.",
      mid: "{name} currently leads in total reach, accounting for {pct}% of your brand exposure this week.",
      low: "Reach is relatively balanced, with {name} holding a slight lead at {pct}% of the total volume."
    };
    const dominantText = getInsight(dominantPct, { neutral: 35, positive: 50 }, dominantTemplates, { name: dominant.name, pct: dominantPct });

    // 2. Growth Trajectory Logic
    const fastests = [
      { name: 'Facebook', growth: SOCIAL_STATS.facebook.trend },
      { name: 'LinkedIn', growth: SOCIAL_STATS.linkedin.trend },
      { name: 'Website', growth: OVERVIEW_STATS.pageViewsTrend }
    ].sort((a, b) => b.growth - a.growth);
    const fastest = fastests[fastests.length - 1];
    const vsWebsite = (fastest.growth / OVERVIEW_STATS.pageViewsTrend).toFixed(1);

    const growthTemplates = {
      high: "Your {name} audience is in an explosive growth phase ({growth}%), outperforming the website by a factor of {vs}x.",
      mid: "{name} is showing a healthy growth trajectory at {growth}%, steadily outpacing your other channels.",
      low: "Audience growth is currently leaning towards {name} ({growth}%), though overall momentum is steady across platforms."
    };
    const growthText = getInsight(fastest.growth, { neutral: 5, positive: 12 }, growthTemplates, { name: fastest.name, growth: fastest.growth, vs: vsWebsite });

    // 3. Engagement Alpha Logic
    const avgTime = OVERVIEW_STATS.avgSessionDuration;
    const websiteTimeInSeconds = parseInt(avgTime.split('m')[0]) * 60 + parseInt(avgTime.split(' ')[1]);
    const timeRatio = (websiteTimeInSeconds / 105).toFixed(1);

    const engagementTemplates = {
      high: "Website content is capturing deep attention: visitors stay {ratio}x longer ({time} avg) than social media benchmarks.",
      mid: "Engagement depth is strongest on the Website, with users spending {ratio}x more time ({time}) than on social feeds.",
      low: "Your website maintains high-quality sessions at {time} per visitor, outlasting the average social media 'scroll-by'."
    };
    const engagementText = getInsight(parseFloat(timeRatio), { neutral: 1.5, positive: 2.5 }, engagementTemplates, { ratio: timeRatio, time: avgTime });

    return {
      dominant: { text: dominantText },
      growth: { text: growthText },
      engagement: { text: engagementText }
    };
  }, []);

  return (
    <PageLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
        {/* Top-level Platform Selector Tabs */}
        <Tabs defaultValue="website" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="website">Website</TabsTrigger>
            <TabsTrigger value="facebook">Facebook</TabsTrigger>
            <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0 space-y-6">
            {/* Key Insights Highlight */}
            <div className="grid grid-cols-1 gap-4">
              <Card className="bg-gradient-to-br from-[#400010]/5 to-transparent border-[#400010]/10">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">Platform Insights & Recommendations</CardTitle>
                  </div>
                  <CardDescription>Automated cross-platform analysis for the last 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                           <TrendingUp size={12} className="text-green-600" /> Dominant Channel
                        </p>
                        <p className="text-sm font-medium">{insights.dominant.text}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                           <Users size={12} className="text-blue-600" /> Growth Trajectory
                        </p>
                        <p className="text-sm font-medium">{insights.growth.text}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                           <Activity size={12} className="text-amber-600" /> Engagement Alpha
                        </p>
                        <p className="text-sm font-medium">{insights.engagement.text}</p>
                     </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Multi-Platform Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard 
                title="Total Combined Reach" 
                value={OVERVIEW_STATS.totalPageViews + SOCIAL_STATS.facebook.reach + SOCIAL_STATS.linkedin.impressions} 
                trend={12.8} 
                icon={TrendingUp} 
              />
              <StatCard 
                title="Total Engagement" 
                value={SOCIAL_STATS.facebook.engagement + SOCIAL_STATS.linkedin.clicks} 
                trend={10.5} 
                icon={Activity} 
              />
              <StatCard 
                title="Total Audience" 
                value={OVERVIEW_STATS.uniqueVisitors + SOCIAL_STATS.facebook.followers + SOCIAL_STATS.linkedin.followers} 
                trend={5.2} 
                icon={Users} 
              />
              <StatCard 
                title="Avg Session Activity" 
                value="4.2k" 
                trend={-1.4} 
                icon={BarChart3} 
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Cross-Platform performance chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Cross-Platform Performance</CardTitle>
                  <CardDescription>Daily activity across all platforms (Website PageViews, FB Reach, LI Impressions)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px] w-full mt-4 flex items-end gap-2 text-primary">
                    {(() => {
                      const allValues = CROSS_PLATFORM_TRENDS.flatMap(d => [d.website, d.facebook, d.linkedin]);
                      const maxVal = Math.max(...allValues, 100) * 1.1; // Add 10% headroom
                      
                      return CROSS_PLATFORM_TRENDS.slice(-10).map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col gap-1 items-stretch group relative">
                           <div className="flex items-end gap-0.5 h-full">
                              <div 
                                className="flex-1 bg-primary/40 rounded-t transition-all group-hover:bg-primary/60" 
                                style={{ height: `${(d.website / maxVal) * 100}%` }} 
                                title={`Website: ${d.website}`}
                              />
                              <div 
                                className="flex-1 bg-blue-600/40 rounded-t transition-all group-hover:bg-blue-600/60" 
                                style={{ height: `${(d.facebook / maxVal) * 100}%` }} 
                                title={`Facebook: ${d.facebook}`}
                              />
                              <div 
                                className="flex-1 bg-[#0077b5]/40 rounded-t transition-all group-hover:bg-[#0077b5]/60" 
                                style={{ height: `${(d.linkedin / maxVal) * 100}%` }} 
                                title={`LinkedIn: ${d.linkedin}`}
                              />
                           </div>
                           <span className="text-[10px] text-muted-foreground text-center truncate">{d.date.split(' ')[1]}</span>
                        </div>
                      ));
                    })()}
                  </div>
                  <div className="flex items-center justify-center gap-6 mt-6 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-primary/60" />
                      <span className="text-xs font-medium">Website</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-blue-600/60" />
                      <span className="text-xs font-medium">Facebook</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-[#0077b5]/60" />
                      <span className="text-xs font-medium">LinkedIn</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Platform Breakdown Quick Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Platform Distribution</CardTitle>
                  <CardDescription>Share of total audience engagement</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Globe className="h-3 w-3 text-primary" />
                        Website
                      </span>
                      <span className="font-medium text-muted-foreground">42%</span>
                    </div>
                    <ProgressBar percentage={42} color="bg-primary" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                         <div className="h-3 w-3 bg-blue-600 rounded-full flex items-center justify-center text-[8px] text-white">f</div>
                        Facebook
                      </span>
                      <span className="font-medium text-muted-foreground">38%</span>
                    </div>
                    <ProgressBar percentage={38} color="bg-blue-600" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <div className="h-3 w-3 bg-[#0077b5] rounded-sm flex items-center justify-center text-[8px] text-white">in</div>
                        LinkedIn
                      </span>
                      <span className="font-medium text-muted-foreground">20%</span>
                    </div>
                    <ProgressBar percentage={20} color="bg-[#0077b5]" />
                  </div>
                  
                  <div className="pt-4 border-t space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground italic">Top Source This Week</p>
                        <p className="text-sm font-bold text-blue-600">Facebook</p>
                      </div>
                      <Badge variant="outline" className="text-blue-600 border-blue-600/20 bg-blue-50">
                        +15.4%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Audience Growth Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Audience Growth Trend</CardTitle>
                  <CardDescription>Cumulative cross-platform follower & subscriber count</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] w-full flex items-end gap-1 relative pt-10">
                    <div className="absolute top-2 left-0 right-0 flex justify-between px-2">
                       <div className="flex flex-col">
                          <span className="text-xl font-bold">12,874</span>
                          <span className="text-[10px] text-green-600 flex items-center gap-0.5"><ArrowUp size={8}/> 12.8%</span>
                       </div>
                    </div>
                    {AUDIENCE_GROWTH.map((d, i) => {
                      const min = 11000;
                      const max = 13000;
                      const hPct = ((d.total - min) / (max - min)) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col gap-1 items-stretch group relative">
                           <div className="flex-1 bg-muted rounded-md overflow-hidden flex flex-col justify-end">
                              <div 
                                className="w-full bg-gradient-to-t from-primary/60 to-primary/20 transition-all group-hover:from-primary/80" 
                                style={{ height: `${hPct}%` }}
                              />
                           </div>
                           <span className="text-[10px] text-muted-foreground text-center truncate">{d.date.split(' ')[1]}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Content Engagement by Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top Content Engagement</CardTitle>
                  <CardDescription>Interaction volume by primary information category</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                   {CONTENT_PERFORMANCE.map((c, i) => {
                      const max = 7000;
                      const pct = (c.engagement / max) * 100;
                      return (
                        <div key={i} className="space-y-1.5">
                           <div className="flex justify-between text-xs">
                              <span className="font-medium">{c.category}</span>
                              <span className="text-muted-foreground">{c.engagement.toLocaleString()} interactions</span>
                           </div>
                           <ProgressBar percentage={pct} color={c.color} />
                        </div>
                      );
                   })}
                </CardContent>
              </Card>
            </div>

            {/* AI Analytics Assistant for Overview */}
            <WebsiteAnalyticsAIChat 
              type="overview"
              data={{
                ...analyticsData,
                socialStats: SOCIAL_STATS,
                crossPlatformTrends: CROSS_PLATFORM_TRENDS,
                audienceGrowth: AUDIENCE_GROWTH,
                contentPerformance: CONTENT_PERFORMANCE
              }} 
            />
          </TabsContent>

          <TabsContent value="website" className="mt-0 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Website Analytics</h1>
                <p className="text-muted-foreground">
                  SCPNG public website traffic and visitor insights
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <Activity className="h-3 w-3" />
                  Live
                </Badge>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="12m">Last 12 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Page Views" value={OVERVIEW_STATS.totalPageViews} trend={OVERVIEW_STATS.pageViewsTrend} icon={Eye} />
              <StatCard title="Unique Visitors" value={OVERVIEW_STATS.uniqueVisitors} trend={OVERVIEW_STATS.visitorsTrend} icon={Users} />
              <StatCard title="Avg Session Duration" value={OVERVIEW_STATS.avgSessionDuration} trend={OVERVIEW_STATS.sessionTrend} icon={Clock} />
              <StatCard title="Bounce Rate" value={OVERVIEW_STATS.bounceRate} trend={OVERVIEW_STATS.bounceTrend} icon={MousePointerClick} suffix="%" />
            </div>

            {/* Sub-Tabs */}
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="pages">Pages</TabsTrigger>
                <TabsTrigger value="referrers">Referrers</TabsTrigger>
                <TabsTrigger value="visitors">Visitors</TabsTrigger>
                <TabsTrigger value="realtime">Real-time</TabsTrigger>
              </TabsList>

              {/* ── Overview Tab ── */}
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Daily Views Chart */}
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-base">Daily Page Views</CardTitle>
                      <CardDescription>Page views over the last 14 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <MiniBarChart
                        data={DAILY_VIEWS.map(d => ({ label: d.date.replace('Mar ', ''), value: d.views }))}
                        maxValue={maxDailyViews}
                        height={180}
                      />
                    </CardContent>
                  </Card>

                  {/* Device Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Devices</CardTitle>
                      <CardDescription>Visitor device types</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {DEVICE_BREAKDOWN.map(d => (
                        <div key={d.device} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <d.icon className="h-4 w-4 text-muted-foreground" />
                              <span>{d.device}</span>
                            </div>
                            <span className="font-medium">{d.percentage}%</span>
                          </div>
                          <ProgressBar percentage={d.percentage} color={d.color} />
                          <p className="text-xs text-muted-foreground">{d.count.toLocaleString()} visits</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {/* Hourly Traffic + Browsers */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Hourly Traffic</CardTitle>
                      <CardDescription>Page views by hour of day (today)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <MiniBarChart
                        data={HOURLY_TRAFFIC.map(d => ({ label: d.hour, value: d.views }))}
                        maxValue={maxHourlyViews}
                        height={140}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Browsers</CardTitle>
                      <CardDescription>Visitor browser usage</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {BROWSER_STATS.map(b => (
                        <div key={b.name} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>{b.name}</span>
                            <span className="font-medium">{b.percentage}%</span>
                          </div>
                          <ProgressBar percentage={b.percentage} color={b.color} />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ── Pages Tab ── */}
              <TabsContent value="pages">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top Pages</CardTitle>
                    <CardDescription>Most visited pages on the SCPNG website</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-3 font-medium text-muted-foreground">#</th>
                            <th className="pb-3 font-medium text-muted-foreground">Page</th>
                            <th className="pb-3 font-medium text-muted-foreground text-right">Views</th>
                            <th className="pb-3 font-medium text-muted-foreground text-right">Unique</th>
                            <th className="pb-3 font-medium text-muted-foreground text-right">Avg Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {TOP_PAGES.map((page, i) => (
                            <tr key={page.path} className="border-b last:border-0 hover:bg-muted/50">
                              <td className="py-3 text-muted-foreground">{i + 1}</td>
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <div>
                                    <p className="font-medium">{page.title}</p>
                                    <p className="text-xs text-muted-foreground">{page.path}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 text-right font-medium">{page.views.toLocaleString()}</td>
                              <td className="py-3 text-right">{page.uniqueViews.toLocaleString()}</td>
                              <td className="py-3 text-right">{page.avgTime}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Referrers Tab ── */}
              <TabsContent value="referrers">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Traffic Sources</CardTitle>
                    <CardDescription>Where visitors are coming from</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {TOP_REFERRERS.map((ref) => (
                      <div key={ref.source} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{ref.source}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground">{ref.visits.toLocaleString()} visits</span>
                            <span className="font-medium w-12 text-right">{ref.percentage}%</span>
                          </div>
                        </div>
                        <ProgressBar percentage={ref.percentage} color="bg-primary" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Visitors Tab ── */}
              <TabsContent value="visitors" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Visitor Map Placeholder */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Geographic Distribution</CardTitle>
                      <CardDescription>Top visitor locations</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {GEO_DISTRIBUTION.map(c => (
                          <div key={c.country} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-muted-foreground" />
                              <span>{c.country}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground">{c.visits.toLocaleString()}</span>
                              <span className="font-medium w-12 text-right">{c.pct}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* New vs Returning */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">New vs Returning</CardTitle>
                      <CardDescription>First-time and repeat visitors</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>New Visitors</span>
                          <span className="font-medium">62.3%</span>
                        </div>
                        <ProgressBar percentage={62.3} color="bg-blue-500" />
                        <p className="text-xs text-muted-foreground">2,003 visitors</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Returning Visitors</span>
                          <span className="font-medium">37.7%</span>
                        </div>
                        <ProgressBar percentage={37.7} color="bg-green-500" />
                        <p className="text-xs text-muted-foreground">1,211 visitors</p>
                      </div>
                      <div className="pt-4 border-t space-y-2">
                        <p className="text-sm font-medium">Avg Pages per Session</p>
                        <p className="text-2xl font-bold">3.8</p>
                        <p className="text-xs text-muted-foreground">Returning visitors avg 5.2 pages</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ── Real-time Tab ── */}
              <TabsContent value="realtime">
                <div className="space-y-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                        <div>
                          <p className="text-3xl font-bold">24</p>
                          <p className="text-sm text-muted-foreground">Active visitors right now</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Recent Visits</CardTitle>
                      <CardDescription>Latest visitor activity (IPs partially masked)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="pb-3 font-medium text-muted-foreground">Time</th>
                              <th className="pb-3 font-medium text-muted-foreground">Page</th>
                              <th className="pb-3 font-medium text-muted-foreground">Referrer</th>
                              <th className="pb-3 font-medium text-muted-foreground">Browser / OS</th>
                              <th className="pb-3 font-medium text-muted-foreground">Country</th>
                            </tr>
                          </thead>
                          <tbody>
                            {RECENT_VISITS.map((v, i) => (
                              <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                                <td className="py-3 text-muted-foreground whitespace-nowrap">{v.time}</td>
                                <td className="py-3 font-medium">{v.page}</td>
                                <td className="py-3">{v.referrer}</td>
                                <td className="py-3 text-muted-foreground">{v.userAgent}</td>
                                <td className="py-3">
                                  <Badge variant="outline">{v.country}</Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>


            {/* Footer note */}
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <BarChart3 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Data Source: WordPress PHP Tracking</p>
                    <p className="mt-1">
                      Analytics data is collected via server-side PHP snippets on the SCPNG public website.
                      Page views, visitor IPs, referrers, and user agents are logged on each request and
                      synced to the dashboard. Currently displaying mock data — connect to the live WordPress
                      endpoint to enable real-time statistics.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="facebook" className="mt-0">
            <FacebookAnalyticsTab />
          </TabsContent>

          <TabsContent value="linkedin" className="mt-0">
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <div className="h-10 w-10 bg-[#0077b5] rounded-sm flex items-center justify-center mb-4 text-white">
                  <span className="font-bold text-xl leading-none">in</span>
                </div>
                <p className="text-lg font-medium">LinkedIn Analytics</p>
                <p className="text-sm">Professional network reach, post performance, and talent insights will appear here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
};

export default WebsiteAnalytics;
