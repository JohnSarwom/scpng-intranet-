import React, { useEffect } from 'react';
import { Kra, User, Objective } from '@/types';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
// Assuming a DatePicker component exists or using Input type="date" for now
// import DatePicker from '@/components/ui/date-picker';
// Assuming a MultiSelect component exists for assignees or using a placeholder
// import MultiSelect from '@/components/ui/multi-select';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils"; // For conditional classes
import { Badge } from "@/components/ui/badge";
import { StaffMember } from '@/types/staff'; // Import StaffMember
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'; // Corrected auth hook import
import { useStaffByDepartment } from '@/hooks/useStaffByDepartment'; // Import hook to get user's department
import { GlobalAssigneeSelector } from '@/components/common/GlobalAssigneeSelector';

interface KraFormSectionProps {
  formData: Partial<Kra>;
  onChange: (field: keyof Kra, value: any) => void;
  users?: User[]; // List of users for assignee selection
  staffMembers?: StaffMember[]; // Add staffMembers prop
  objectives?: Objective[]; // List of objectives for dropdown
  units?: { id: string | number; name: string }[]; // Now expects { id: "Dept Name", name: "Dept Name" }
  existingKraTitles?: string[]; // Add prop for existing titles
  existingKraObjects?: Kra[]; // Full KRA objects for ID-based linking
  isAddingNew: boolean; // Add prop to know if we are adding a new KRA
  container?: HTMLElement | null;
  disabled?: boolean;
}

// Simple MultiSelectChip component placeholder for Assignees
// const AssigneeSelector = ... (Removed, using GlobalAssigneeSelector now)


const KraFormSection: React.FC<KraFormSectionProps> = ({
  formData,
  onChange,
  users = [],
  staffMembers = [], // Add default value
  objectives = [],
  units = [], // Receives derived department list
  existingKraTitles = [], // Accept prop
  existingKraObjects = [], // Full KRA objects for ID-based linking
  isAddingNew, // Destructure the new prop
  container,
  disabled = false,
}) => {

  const { user } = useSupabaseAuth(); // Corrected auth hook usage
  // Get current user's department directly from the hook
  const { currentUserDepartment } = useStaffByDepartment();

  // Effect to pre-fill unit (department) when adding a new KRA
  useEffect(() => {
    console.log("[KraFormSection useEffect] Running. isAddingNew:", isAddingNew);
    if (isAddingNew && currentUserDepartment && units.length > 0) {
      console.log("[KraFormSection useEffect] User department:", currentUserDepartment);
      // Check if the unit field is currently empty before setting
      // Use 'unit' field which should store the department name string
      if (!formData.unit) {
        console.log(`[KraFormSection useEffect] Setting unit to: ${currentUserDepartment}`);
        // Set the department name string directly
        onChange('unit', currentUserDepartment);
      }
    }
    // Update dependencies
  }, [isAddingNew, currentUserDepartment, units, onChange, formData.unit]);

  // Helper to handle date input changes (assuming YYYY-MM-DD format)
  const handleDateChange = (field: 'startDate' | 'targetDate', value: string) => {
    // Basic validation or formatting can be added here if needed
    onChange(field, value);
  };

  const [inputValue, setInputValue] = React.useState(formData.title || '');

  // Reset input value when formData.title changes (e.g., when editing)
  useEffect(() => {
    setInputValue(formData.title || '');
  }, [formData.title]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium dark:text-gray-200">KRA Information</h3>
      {/* KRA Title Combobox */}
      <div className="grid gap-1.5">
        <Label htmlFor="kra-title" className="dark:text-gray-300">KRA Title *</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-label="Select or type a KRA title"
              className={cn(
                "w-full justify-between dark:bg-gray-900 dark:border-white/10 dark:text-gray-100 dark:hover:bg-gray-800",
                !formData.title && "text-muted-foreground dark:text-gray-500"
              )}
              disabled={disabled}
            >
              {formData.title || "Select or type a KRA title..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0 dark:bg-gray-950 dark:border-white/10" container={container}>
            <Command className="dark:bg-gray-950">
              <CommandInput
                placeholder="Search or type new title..."
                value={inputValue}
                onValueChange={(search) => {
                  setInputValue(search);
                  onChange('title', search);
                }}
                className="dark:text-gray-100"
              />
              <CommandList>
                <CommandEmpty>No existing KRAs found. Type to create new.</CommandEmpty>
                <CommandGroup>
                  {existingKraObjects.length > 0
                    ? existingKraObjects.map((kra) => (
                      <CommandItem
                        key={kra.id}
                        value={kra.title}
                        className="dark:text-gray-300 dark:aria-selected:bg-gray-800 dark:aria-selected:text-gray-100"
                        onSelect={() => {
                          // Use the original KRA title (preserving casing) instead of cmdk's lowercased currentValue
                          const originalTitle = kra.title.trim();
                          if (originalTitle === formData.title) {
                            // Deselect: clear title and ID
                            onChange('title', '');
                            onChange('id' as any, undefined);
                          } else {
                            // Select existing KRA: link by ID and prefill fields
                            onChange('title', originalTitle);
                            onChange('id' as any, kra.id); // Link to existing KRA by ID
                            if (kra.objective_id) onChange('objective_id' as any, String(kra.objective_id));
                            if (kra.unit) onChange('unit', kra.unit);
                            if (kra.status) onChange('status', kra.status);
                            if (kra.description) onChange('description', kra.description);
                            if (kra.assignees) onChange('assignees', kra.assignees);
                            if (kra.owner) onChange('owner', kra.owner);
                          }
                          setInputValue(originalTitle === formData.title ? '' : originalTitle);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            formData.title?.trim().toLowerCase() === kra.title.trim().toLowerCase() ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {kra.title}
                      </CommandItem>
                    ))
                    : existingKraTitles.map((title) => (
                      <CommandItem
                        key={title}
                        value={title}
                        className="dark:text-gray-300 dark:aria-selected:bg-gray-800 dark:aria-selected:text-gray-100"
                        onSelect={() => {
                          // Fallback: use original title string (not cmdk's lowercased value)
                          const trimmedValue = title.trim();
                          onChange('title', trimmedValue === formData.title ? '' : trimmedValue);
                          setInputValue(trimmedValue === formData.title ? '' : trimmedValue);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            formData.title === title ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {title}
                      </CommandItem>
                    ))
                  }
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Objective & Unit (Side by side on larger screens) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="kra-objective" className="dark:text-gray-300">Objective *</Label>
          <Select
            value={formData.objective_id?.toString() || ''}
            onValueChange={(value) => onChange('objective_id' as any, value)}
            disabled={disabled}
            required
          >
            <SelectTrigger id="kra-objective" className="dark:bg-gray-900 dark:border-white/10 dark:text-gray-100">
              <SelectValue placeholder="Select an objective" />
            </SelectTrigger>
            <SelectContent container={container} className="dark:bg-gray-950 dark:border-white/10">
              {objectives.length > 0 ? (
                objectives.map((obj) => (
                  <SelectItem key={obj.id} value={obj.id.toString()}>{obj.title}</SelectItem>
                ))
              ) : (
                <div className="px-2 py-1.5 text-sm text-muted-foreground dark:text-gray-500">No objectives defined.</div>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Owner Field - Single Select with Auto-fill */}
        <div className="grid gap-1.5">
          <Label className="dark:text-gray-300">Owner (Lead)</Label>
          <GlobalAssigneeSelector
            selected={formData.owner ? [{
              id: formData.owner.id.toString(),
              displayName: formData.owner.name,
              givenName: '', surname: '', mail: formData.owner.email || ''
            }] : []}
            onChange={(employees) => {
              const selected = employees[0];
              if (selected) {
                // Update Owner
                onChange('owner', {
                  id: selected.id,
                  name: selected.displayName,
                  email: selected.mail
                });
                onChange('ownerId', selected.id);

                // Auto-fill Unit/Department from Employee data
                if (selected.department) {
                  console.log(`[KraFormSection] Auto-filling unit from Owner: ${selected.department}`);
                  onChange('unit', selected.department);
                }
              } else {
                onChange('owner', undefined);
                onChange('ownerId', undefined);
              }
            }}
            mode="single"
            placeholder="Select Owner..."
            container={container}
            disabled={disabled}
          />
        </div>

        {/* Unit Dropdown */}
        <div className="grid gap-1.5">
          <Label htmlFor="kra-unit" className="dark:text-gray-300">Unit *</Label>
          <Select
            // Use unit field (department name string) for value
            value={formData.unit || ''}
            onValueChange={(value) => onChange('unit', value)}
            disabled={disabled || (isAddingNew && !!currentUserDepartment)} // Disable if adding new and we have current department
            required
          >
            <SelectTrigger id="kra-unit" className="dark:bg-gray-900 dark:border-white/10 dark:text-gray-100">
              <SelectValue placeholder="Select a unit" />
            </SelectTrigger>
            <SelectContent container={container} className="dark:bg-gray-950 dark:border-white/10">
              {(() => {
                // Combine existing units with the current value if it's unique
                const currentUnit = formData.unit;
                const unitExists = units.some(u => u.name === currentUnit);

                const displayUnits = [...units];
                if (currentUnit && !unitExists) {
                  displayUnits.unshift({ id: currentUnit, name: currentUnit });
                }

                return displayUnits.length > 0 ? (
                  displayUnits.map((unit) => (
                    <SelectItem key={unit.id} value={unit.name} className="dark:text-gray-300 dark:focus:bg-gray-800 dark:focus:text-gray-100">{unit.name}</SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground dark:text-gray-500">No units defined.</div>
                );
              })()}
            </SelectContent>
          </Select>
        </div>

        {/* Status (Auto-calculated) */}
        <div className="grid gap-1.5">
          <Label htmlFor="kra-status" className="dark:text-gray-300">Status</Label>
          <Input
            id="kra-status"
            value={(formData.status || 'open').charAt(0).toUpperCase() + (formData.status || 'open').slice(1).replace('-', ' ')}
            readOnly
            className="bg-muted dark:bg-gray-800 dark:border-white/10 dark:text-gray-400 focus:ring-0"
            title="Status is automatically calculated from linked KPIs."
          />
          <p className="text-[10px] text-muted-foreground dark:text-gray-500">
            Automatically derived from KPIs.
          </p>
        </div>
      </div>

      {/* Assignees Multi-select */}
      <div className="grid gap-1.5">
        <Label className="dark:text-gray-300">Additional Assignees</Label>
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
              avatarUrl: undefined, // Add if available
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

      {/* KRA Comments */}
      <div className="grid gap-1.5">
        <Label htmlFor="kra-comments" className="dark:text-gray-300">Comments (Optional)</Label>
        <Textarea
          id="kra-comments"
          value={formData.description || ''}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="Add any overall notes for this KRA..."
          rows={3}
          disabled={disabled}
          className="dark:bg-gray-900 dark:border-white/10 dark:text-gray-100 focus:ring-blue-500/20"
        />
      </div>

    </div>
  );
};

export default KraFormSection; 