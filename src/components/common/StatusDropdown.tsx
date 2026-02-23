import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StatusOption {
  value: string;
  label: string;
}

interface StatusDropdownProps {
  currentStatus: string;
  onStatusChange: (newStatus: string) => void;
  options?: StatusOption[];
}

// Default status options
const defaultStatusOptions: StatusOption[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'in-review', label: 'In Review' },
  { value: 'completed', label: 'Completed' }
];

export const StatusDropdown: React.FC<StatusDropdownProps> = ({
  currentStatus,
  onStatusChange,
  options = defaultStatusOptions,
}) => {
  return (
    <Select defaultValue={currentStatus} onValueChange={onStatusChange}>
      <SelectTrigger className="w-[120px]">
        <SelectValue placeholder="Select" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default StatusDropdown; 