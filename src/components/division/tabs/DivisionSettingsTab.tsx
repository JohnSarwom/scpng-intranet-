import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Eye, Save, RefreshCw } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { DivisionSettingsConfig } from '@/types/division.types';

interface DivisionSettingsTabProps {
  divisionId: string;
  canEdit: boolean;
  onRefresh: () => void;
}

const DEFAULT_SETTINGS: DivisionSettingsConfig = {
  notifications: {
    dailySummary: true,
    weeklyDigest: true,
    alertOnRisk: true,
    alertOnOverdue: true,
  },
  display: {
    defaultTab: 'overview',
    defaultTimePeriod: 'monthly',
    showAIInsights: true,
  },
};

export const DivisionSettingsTab: React.FC<DivisionSettingsTabProps> = ({ canEdit, onRefresh }) => {
  const [settings, setSettings] = useState<DivisionSettingsConfig>(() => {
    try {
      const saved = localStorage.getItem('division_settings');
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [saving, setSaving] = useState(false);

  const updateNotification = (key: keyof DivisionSettingsConfig['notifications'], value: boolean) => {
    setSettings(prev => ({ ...prev, notifications: { ...prev.notifications, [key]: value } }));
  };

  const updateDisplay = (key: keyof DivisionSettingsConfig['display'], value: string | boolean) => {
    setSettings(prev => ({ ...prev, display: { ...prev.display, [key]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    localStorage.setItem('division_settings', JSON.stringify(settings));
    setSaving(false);
    toast({ title: 'Settings saved', description: 'Division preferences have been updated.' });
  };

  return (
    <div className="space-y-6 mt-4 max-w-2xl">
      {/* Notification Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notification Preferences
          </CardTitle>
          <CardDescription className="text-xs">
            Configure what alerts and summaries you receive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'dailySummary' as const, label: 'Daily Operations Summary', desc: 'Receive a daily digest of tasks, completions, and alerts' },
            { key: 'weeklyDigest' as const, label: 'Weekly Performance Digest', desc: 'Get a weekly roll-up of KPIs, KRAs, and unit comparisons' },
            { key: 'alertOnRisk' as const, label: 'At-Risk Alerts', desc: 'Notify when a KRA or project moves to at-risk status' },
            { key: 'alertOnOverdue' as const, label: 'Overdue Task Alerts', desc: 'Notify when tasks exceed their due date' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-medium">{item.label}</Label>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={settings.notifications[item.key]}
                onCheckedChange={v => updateNotification(item.key, v)}
                disabled={!canEdit}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Display Preferences
          </CardTitle>
          <CardDescription className="text-xs">
            Customize your default view settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Default Tab</Label>
              <Select
                value={settings.display.defaultTab}
                onValueChange={v => updateDisplay('defaultTab', v)}
                disabled={!canEdit}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="overview">Overview</SelectItem>
                  <SelectItem value="units">Units</SelectItem>
                  <SelectItem value="workplans">Work Plans</SelectItem>
                  <SelectItem value="reports">Reports</SelectItem>
                  <SelectItem value="analytics">Analytics</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Default Time Period</Label>
              <Select
                value={settings.display.defaultTimePeriod}
                onValueChange={v => updateDisplay('defaultTimePeriod', v)}
                disabled={!canEdit}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Show AI Insights</Label>
              <p className="text-xs text-muted-foreground">Display AI-generated insights on the Analytics tab</p>
            </div>
            <Switch
              checked={settings.display.showAIInsights}
              onCheckedChange={v => updateDisplay('showAIInsights', v)}
              disabled={!canEdit}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={!canEdit || saving}
          className="gap-2 bg-[#83002A] hover:bg-[#5C001E]"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
        <Button variant="outline" onClick={onRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh Data
        </Button>
      </div>
    </div>
  );
};
