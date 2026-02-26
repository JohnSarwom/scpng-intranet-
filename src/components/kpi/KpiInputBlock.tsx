// src/components/kpi/KpiInputBlock.tsx
import React, { useState, useEffect } from 'react';
import { Kpi, User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, ListChecks, Calculator } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StaffMember } from '@/types/staff';
import { GlobalAssigneeSelector } from '@/components/common/GlobalAssigneeSelector';
import ChecklistSection, { ChecklistItem } from '@/components/ChecklistSection';
import { calculateKpiProgress } from '@/utils/kpiUtils';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface KpiInputBlockProps {
  kpiIndex: number;
  formData: Partial<Kpi>;
  onChange: (field: keyof Kpi, value: any) => void;
  onRemove: (index: number) => void;
  isOnlyBlock?: boolean; // Optional: To disable remove on the last block
  users?: User[]; // Add users prop for assignee selection
  staffMembers?: StaffMember[]; // Add staffMembers prop
  container?: HTMLElement | null;
  disabled?: boolean;
  isReadOnly?: boolean;
}

// --- Assignee Selector Component replaced by GlobalAssigneeSelector ---

// --- End Assignee Selector ---

// Helper function to get quarter from date string (YYYY-MM-DD)
const getQuarter = (dateString: string | undefined): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    const month = date.getMonth(); // 0-indexed (0 = January)
    if (month <= 2) return 'Q1';
    if (month <= 5) return 'Q2';
    if (month <= 8) return 'Q3';
    return 'Q4';
  } catch {
    return '-';
  }
};

const KpiInputBlock: React.FC<KpiInputBlockProps> = ({ kpiIndex, formData, onChange, onRemove, isOnlyBlock, users = [], staffMembers = [], container, disabled = false, isReadOnly = false }) => {
  // Use DB format for values, but map to user-friendly labels
  const statusOptions: { value: Kpi['status']; label: string }[] = [
    { value: 'not-started', label: 'Not Started' },
    { value: 'on-track', label: 'On Track' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'on-hold', label: 'On Hold' },
    { value: 'completed', label: 'Completed' },
    { value: 'behind', label: 'Behind' },
  ];
  const [calculatedQuarter, setCalculatedQuarter] = useState<string>(() => getQuarter(formData.targetDate));

  // Initialize calculation type if missing
  useEffect(() => {
    if (!formData.calculationType) {
      onChange('calculationType', 'manual');
    }
  }, []);

  const derivedStatus = React.useMemo(() => {
    if (formData.calculationType === 'checklist') {
      const items = formData.checklist || [];
      if (items.length === 0) return 'not-started';
      const allChecked = items.every(item => item.checked);
      const anyChecked = items.some(item => item.checked);

      if (allChecked) return 'completed';
      if (anyChecked) return 'in-progress';
      return 'not-started';
    } else {
      // Manual input logic
      const target = Number(formData.target) || 0;
      const actual = Number(formData.actual) || 0;

      if (target > 0 && actual >= target) return 'completed';
      if (actual > 0) return 'in-progress';
      return 'not-started';
    }
  }, [formData.calculationType, formData.checklist, formData.target, formData.actual]);

  // Sync derived status with parent form state
  useEffect(() => {
    if (formData.status !== derivedStatus) {
      onChange('status', derivedStatus as any);
    }
  }, [derivedStatus, formData.status, onChange]);

  const handleChecklistChange = (items: ChecklistItem[]) => {
    onChange('checklist', items);
    // Removed logic that overwrites the 'actual' and 'target' numeric fields
    // so user data isn't lost when toggling between calculation types.
  };

  const handleTypeChange = (value: string) => {
    if (!value) return; // Prevent unselecting
    onChange('calculationType', value as 'manual' | 'checklist');
    // Removed standardizing target to 100 and forcing checklist evaluation
    // to preserve user input in manual fields.
  };

  // Update quarter when targetDate changes
  useEffect(() => {
    setCalculatedQuarter(getQuarter(formData.targetDate));
  }, [formData.targetDate]);

  return (
    <Card className="bg-muted/30 border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b">
        <CardTitle className="text-base font-medium">KPI #{kpiIndex + 1}</CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(kpiIndex)}
          disabled={disabled || isOnlyBlock} // Disable remove if it's the only block
          aria-label="Remove KPI"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* KPI Name */}
        <div className="grid gap-1.5">
          <Label htmlFor={`kpi-name-${kpiIndex}`}>KPI Name *</Label>
          <Input
            id={`kpi-name-${kpiIndex}`}
            value={formData.name || ''}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="e.g., Average Resolution Time"
            disabled={disabled}
            required
          />
        </div>

        {/* Calculation Method Toggle */}
        <div className="flex flex-col space-y-2">
          <Label>Measurement Method</Label>
          <ToggleGroup
            type="single"
            value={formData.calculationType || 'manual'}
            onValueChange={handleTypeChange}
            className="justify-start"
            disabled={disabled}
          >
            <ToggleGroupItem value="manual" aria-label="Manual Calculation" className="gap-2">
              <Calculator className="h-4 w-4" />
              Manual Input
            </ToggleGroupItem>
            <ToggleGroupItem value="checklist" aria-label="Checklist Calculation" className="gap-2">
              <ListChecks className="h-4 w-4" />
              Checklist
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Target & Actual (Side by side) - Conditional Logic */}
        {formData.calculationType === 'checklist' ? (
          <div className="space-y-4 border rounded-md p-4 bg-background">
            <ChecklistSection
              items={formData.checklist || []}
              onChange={handleChecklistChange}
              disabled={disabled}
            />
            <div className="text-xs text-muted-foreground">
              * Actual value is automatically calculated based on checklist completion. Target is set to 100%.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor={`kpi-target-${kpiIndex}`}>Target *</Label>
              <Input
                id={`kpi-target-${kpiIndex}`}
                type="number"
                value={formData.target ?? ''} // Use nullish coalescing for optional number
                onChange={(e) => onChange('target', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="e.g., 95"
                disabled={disabled}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`kpi-actual-${kpiIndex}`}>Actual</Label>
              <Input
                id={`kpi-actual-${kpiIndex}`}
                type="number"
                value={formData.actual ?? ''} // Use nullish coalescing
                onChange={(e) => onChange('actual', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="e.g., 92"
                disabled={disabled}
              />
            </div>
          </div>
        )}

        {/* Cost Associated */}
        <div className="grid gap-1.5">
          <Label htmlFor={`kpi-cost-${kpiIndex}`}>Cost Associated (Kina)</Label>
          <Input
            id={`kpi-cost-${kpiIndex}`}
            type="number"
            value={formData.costAssociated ?? ''} // Use nullish coalescing
            onChange={(e) => onChange('costAssociated', e.target.value ? parseFloat(e.target.value) : undefined)}
            placeholder="e.g., 1500.00"
            step="0.01" // Allow decimal input for currency
            disabled={disabled}
          />
        </div>

        {/* KPI Start Date & Target Date (Side by side) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={`kpi-start-date-${kpiIndex}`}>Start Date</Label>
            <Input
              id={`kpi-start-date-${kpiIndex}`}
              type="date"
              value={formData.startDate?.substring(0, 10) || ''}
              onChange={(e) => onChange('startDate', e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`kpi-target-date-${kpiIndex}`}>Target Date</Label>
            <div className="flex items-center gap-2">
              <Input
                id={`kpi-target-date-${kpiIndex}`}
                type="date"
                value={formData.targetDate?.substring(0, 10) || ''}
                onChange={(e) => onChange('targetDate', e.target.value)}
                min={formData.startDate?.substring(0, 10) || ''} // Prevent target date before start date
                className="flex-1"
                disabled={disabled}
              />
              {/* Display Calculated Quarter */}
              <Badge variant="outline" className="h-9 px-3 whitespace-nowrap">
                {calculatedQuarter}
              </Badge>
            </div>
          </div>
        </div>

        {/* Status (Auto-calculated) */}
        <div className="grid gap-1.5">
          <Label htmlFor={`kpi-status-${kpiIndex}`}>Status</Label>
          <Input
            id={`kpi-status-${kpiIndex}`}
            value={derivedStatus.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            readOnly
            className="bg-muted text-muted-foreground"
            title="Status is automatically calculated from Target and Actual values."
          />
        </div>

        {/* Add Assignee Selector */}
        <div className="grid gap-1.5">
          <Label htmlFor={`kpi-assignees-${kpiIndex}`}>Assignees</Label>
          <GlobalAssigneeSelector
            selected={formData.assignees?.map(u => ({
              id: u.id.toString(),
              displayName: u.name,
              givenName: '', surname: '', mail: u.email || ''
            })) || []}
            onChange={(employees) => {
              const users = employees.map(e => ({
                id: e.id,
                name: e.displayName,
                email: e.mail,
                initials: e.givenName && e.surname ? `${e.givenName[0]}${e.surname[0]}` : e.displayName.substring(0, 2)
              }));
              onChange('assignees', users);
            }}
            mode="multiple"
            placeholder="Select Assignees..."
            container={container}
            disabled={disabled}
          />
        </div>

        {/* KPI Description Textarea */}
        <div className="grid gap-1.5">
          <Label htmlFor={`kpi-description-${kpiIndex}`}>Description (Optional)</Label>
          <Textarea
            id={`kpi-description-${kpiIndex}`}
            value={formData.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="Describe this KPI..."
            rows={2}
            disabled={disabled}
          />
        </div>

        {/* Comments Textarea */}
        <div className="grid gap-1.5">
          <Label htmlFor={`kpi-comments-${kpiIndex}`}>Comments (Optional)</Label>
          <Textarea
            id={`kpi-comments-${kpiIndex}`}
            value={formData.comments || ''}
            onChange={(e) => onChange('comments', e.target.value)}
            placeholder="Enter comments..."
            rows={2}
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card >
  );
};

export default KpiInputBlock;