import React, { useState, useMemo } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  Plus,
  Filter,
  Search,
  CalendarDays,
  User,
  CheckCircle,
  Circle,
  Edit,
  Trash2,
  MoreVertical,
  List,
  AlertTriangle, // Medium priority alternative
  Info, // Low priority
  XCircle, // High priority alternative
  ChevronDown, // For dropdown indicators
  Check, // For selected items in dropdowns
  Calendar as CalendarIcon // Renaming CalendarDays import
} from 'lucide-react';
import InquiryCard from './InquiryCard';
import { DateRange } from 'react-day-picker';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from 'date-fns';
import DateRangePicker from '@/components/ui/DateRangePicker'; // Reuse DateRangePicker component
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useStaffMembers } from '@/hooks/useStaffMembers';
import { useFrontDeskPermissions } from '@/hooks/frontDesk/useFrontDeskPermissions';
import InquiryDialog from './InquiryDialog';
import {
  formatReportedAt,
  inquiryCategories as potentialCategories,
  inquiryPriorities,
  inquiryStatuses,
  reportedWithin,
  toAssignee,
  type InquiryAssignee,
  type InquiryPriority,
  type InquiryStatus,
} from './inquiryOptions';

// Interface for Inquiry Data
export interface InquiryData {
  id: string;
  title: string;
  description: string;
  priority: InquiryPriority;
  category: string;
  status: InquiryStatus;
  assignee?: InquiryAssignee;
  reportedBy: string;
  reportedAt: string; // ISO 8601
  completed: boolean;
}

const todayAt = (hours: number, minutes: number) => {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};

// Sample initial data based on HTML concept
const initialInquiries: InquiryData[] = [
  { id: 'INQ-001', title: 'Building access system malfunction', description: 'East wing entry doors not responding to keycards, employees stuck outside...', priority: 'High', category: 'Facilities', status: 'In Progress', reportedBy: 'Security Team', reportedAt: todayAt(10, 15), completed: false },
  { id: 'INQ-002', title: 'Conference room AV system issues', description: 'Projector in Boardroom A not connecting to laptops, client meeting at 11AM...', priority: 'Medium', category: 'IT Support', status: 'Open', reportedBy: 'Front Desk', reportedAt: todayAt(9, 30), completed: false },
  { id: 'INQ-003', title: 'Office supplies restock request', description: 'Marketing department running low on printer paper and pens...', priority: 'Low', category: 'Supplies', status: 'Resolved', reportedBy: 'Front Desk', reportedAt: todayAt(14, 45), completed: true },
  { id: 'INQ-004', title: 'Visitor parking full - VIP arrival', description: 'Client CEO arriving in 30 minutes, no visitor parking available...', priority: 'High', category: 'Parking', status: 'Resolved', reportedBy: 'Front Desk', reportedAt: todayAt(13, 15), completed: true },
  { id: 'INQ-005', title: 'Cafeteria food quality complaint', description: "Several reports of undercooked chicken in today's lunch service...", priority: 'Medium', category: 'Food Service', status: 'In Progress', reportedBy: 'Multiple Employees', reportedAt: todayAt(12, 30), completed: false },
];

const UNASSIGNED = 'Unassigned';
type StatusTab = 'All Inquiries' | InquiryData['status'];

// Specify return type as React.ReactElement
const GeneralInquiries = (): React.ReactElement => {
  const [inquiries, setInquiries] = useState<InquiryData[]>(initialInquiries);
  const [searchQuery, setSearchQuery] = useState('');
  const { staffMembers } = useStaffMembers();
  const perms = useFrontDeskPermissions();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInquiry, setEditingInquiry] = useState<InquiryData | null>(null);
  const [inquiryToDelete, setInquiryToDelete] = useState<InquiryData | null>(null);

  // --- Filter State ---
  const [activeStatusTab, setActiveStatusTab] = useState<StatusTab>('All Inquiries');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedPriorities, setSelectedPriorities] = useState<Set<InquiryData['priority']>>(new Set());
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set()); // Assignee emails, or UNASSIGNED
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  // --- End Filter State ---

  // Filter inquiries based on search query and filters
  const filteredInquiries = useMemo(() => {
    let filtered = [...inquiries];

    // 1. Filter by Active Status Tab
    if (activeStatusTab !== 'All Inquiries') {
      filtered = filtered.filter(inquiry => inquiry.status === activeStatusTab);
    }

    // 2. Filter by Selected Categories
    if (selectedCategories.size > 0) {
      filtered = filtered.filter(inquiry => selectedCategories.has(inquiry.category));
    }

    // 3. Filter by Selected Priorities
    if (selectedPriorities.size > 0) {
      filtered = filtered.filter(inquiry => selectedPriorities.has(inquiry.priority));
    }

    // 4. Filter by Selected Assignees
    if (selectedAssignees.size > 0) {
      filtered = filtered.filter(inquiry =>
        inquiry.assignee
          ? !!inquiry.assignee.email && selectedAssignees.has(inquiry.assignee.email)
          : selectedAssignees.has(UNASSIGNED)
      );
    }

    // 5. Filter by Date Range on reportedAt
    if (dateRange?.from) {
      filtered = filtered.filter(inquiry => reportedWithin(inquiry.reportedAt, dateRange));
    }

    // 6. Filter by Search Query (apply last)
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(inquiry => 
        inquiry.title.toLowerCase().includes(lowerQuery) ||
        inquiry.description.toLowerCase().includes(lowerQuery) ||
        inquiry.category.toLowerCase().includes(lowerQuery) ||
        inquiry.status.toLowerCase().includes(lowerQuery) ||
        inquiry.priority.toLowerCase().includes(lowerQuery) ||
        (inquiry.assignee && inquiry.assignee.name.toLowerCase().includes(lowerQuery)) ||
        inquiry.reportedBy.toLowerCase().includes(lowerQuery)
      );
    }

    return filtered;
  }, [inquiries, searchQuery, activeStatusTab, selectedCategories, selectedPriorities, selectedAssignees, dateRange]);

  const getPriorityIcon = (priority: 'High' | 'Medium' | 'Low') => {
    switch (priority) {
      case 'High': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'Medium': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'Low': return <Info className="h-4 w-4 text-green-500" />;
      default: return null;
    }
  };

  const getStatusBadgeClass = (status: 'Open' | 'In Progress' | 'Resolved') => {
    switch (status) {
      case 'Open': return 'border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600';
      case 'In Progress': return 'border-transparent bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-800/60';
      case 'Resolved': return 'border-transparent bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-800/60';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
      hash = category.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash; // Convert to 32bit integer
    }
    const hue = Math.abs(hash) % 360;
    // Using HSL for softer, consistent pastel-like colors, applied via inline style for dynamic hue
    // The badge component itself handles base padding and border-radius
    const badgeStyle = {
      backgroundColor: `hsl(${hue}, 70%, 90%)`, // Light background
      color: `hsl(${hue}, 50%, 40%)`,          // Darker text
      borderColor: `hsl(${hue}, 60%, 80%)`,    // Slightly darker border
    };
    // Return style object to be applied inline
    return badgeStyle;
  };

  const handleCreateInquiry = () => {
    setEditingInquiry(null);
    setIsDialogOpen(true);
  };

  const handleEditInquiry = (id: string) => {
    const inquiry = inquiries.find(inq => inq.id === id);
    if (!inquiry) return;
    setEditingInquiry(inquiry);
    setIsDialogOpen(true);
  };

  const handleInquirySubmit = (inquiry: InquiryData) => {
    setInquiries(prev => prev.some(inq => inq.id === inquiry.id)
      ? prev.map(inq => (inq.id === inquiry.id ? inquiry : inq))
      : [inquiry, ...prev]);
    setIsDialogOpen(false);
    setEditingInquiry(null);
  };

  const handleDeleteInquiry = (id: string) => {
    setInquiryToDelete(inquiries.find(inq => inq.id === id) || null);
  };

  const confirmDeleteInquiry = () => {
    if (inquiryToDelete) setInquiries(prev => prev.filter(inq => inq.id !== inquiryToDelete.id));
    setInquiryToDelete(null);
  };

  // Handlers for inline updates via dropdowns
  const handleStatusUpdate = (id: string, newStatus: InquiryStatus) => {
    setInquiries(prev =>
      prev.map(inq => (inq.id === id ? { ...inq, status: newStatus, completed: newStatus === 'Resolved' } : inq))
    );
    // TODO: Add API call to update backend
  };

  const handleCategoryUpdate = (id: string, newCategory: string) => {
    setInquiries(prev =>
      prev.map(inq => (inq.id === id ? { ...inq, category: newCategory } : inq))
    );
    // TODO: Add API call to update backend
  };

  const handleAssigneeUpdate = (id: string, newAssigneeEmail: string | null) => {
    const staff = staffMembers.find(member => member.email === newAssigneeEmail);
    const newAssignee = staff ? toAssignee(staff) : undefined; // null unassigns
    setInquiries(prev =>
      prev.map(inq => (inq.id === id ? { ...inq, assignee: newAssignee } : inq))
    );
    // TODO: Add API call to update backend
  };

  // --- Filter Handlers ---
  const handleCategoryFilterChange = (category: string, checked: boolean) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(category);
      } else {
        next.delete(category);
      }
      return next;
    });
  };

  const handlePriorityFilterChange = (priority: InquiryData['priority'], checked: boolean) => {
    setSelectedPriorities(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(priority);
      } else {
        next.delete(priority);
      }
      return next;
    });
  };

  const handleAssigneeFilterChange = (assigneeName: string, checked: boolean) => {
    setSelectedAssignees(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(assigneeName);
      } else {
        next.delete(assigneeName);
      }
      return next;
    });
  };

  const handleStatusTabClick = (tab: StatusTab) => {
    setActiveStatusTab(tab);
  };

  // --- End Filter Handlers ---

  return (
    <div className="h-full flex flex-col p-4 bg-gray-50 dark:bg-gray-900">
      {/* Filters Bar */}
      <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {/* Implement Filter Dropdowns similar to TicketManager */}
            {/* Date Range Filter */}
            <DateRangePicker 
              selectedRange={dateRange} 
              onSelectRange={setDateRange} 
              placeholder="Filter by Date Range..."
              className="w-[280px]"
            />

            {/* Category Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={cn(selectedCategories.size > 0 && "border-primary text-primary")}>
                  <Filter className="mr-2 h-4 w-4" /> Category {selectedCategories.size > 0 && `(${selectedCategories.size})`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {potentialCategories.map(cat => (
                  <DropdownMenuCheckboxItem
                    key={cat}
                    checked={selectedCategories.has(cat)}
                    onCheckedChange={(checked) => handleCategoryFilterChange(cat, !!checked)}
                  >
                    {cat}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Priority Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={cn(selectedPriorities.size > 0 && "border-primary text-primary")}>
                  <Filter className="mr-2 h-4 w-4" /> Priority {selectedPriorities.size > 0 && `(${selectedPriorities.size})`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filter by Priority</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {inquiryPriorities.map(prio => (
                  <DropdownMenuCheckboxItem
                    key={prio}
                    checked={selectedPriorities.has(prio)}
                    onCheckedChange={(checked) => handlePriorityFilterChange(prio, !!checked)}
                  >
                    {getPriorityIcon(prio)} <span className="ml-2">{prio}</span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Assignee Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={cn(selectedAssignees.size > 0 && "border-primary text-primary")}>
                  <User className="mr-2 h-4 w-4" /> Assigned To {selectedAssignees.size > 0 && `(${selectedAssignees.size})`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
                <DropdownMenuLabel>Filter by Assignee</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                   key={UNASSIGNED}
                   checked={selectedAssignees.has(UNASSIGNED)}
                   onCheckedChange={(checked) => handleAssigneeFilterChange(UNASSIGNED, !!checked)}
                 >
                   <span className="italic text-muted-foreground">Unassigned</span>
                 </DropdownMenuCheckboxItem>
                {staffMembers.map(staff => toAssignee(staff)).map(assignee => (
                  <DropdownMenuCheckboxItem
                    key={assignee.email}
                    checked={!!assignee.email && selectedAssignees.has(assignee.email)}
                    onCheckedChange={(checked) => assignee.email && handleAssigneeFilterChange(assignee.email, !!checked)}
                  >
                    <Avatar className="h-5 w-5 mr-2"><AvatarFallback className="text-[10px]">{assignee.initials}</AvatarFallback></Avatar>
                    {assignee.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

          </div>
          <div className="flex items-center gap-2">
            {perms.canCreate && (
              <Button
                onClick={handleCreateInquiry}
                className="bg-primary text-white hover:bg-primary/90"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                New Inquiry
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs and Search/View Bar */}
      <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
         <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            {/* Implement Tabs if needed */}
            <div className="border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                {/* Functional Status Tabs */}
                {['All Inquiries', ...inquiryStatuses].map((tabStatus) => (
                  <button
                    key={tabStatus}
                    onClick={() => handleStatusTabClick(tabStatus as StatusTab)}
                    className={cn(
                      "whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm",
                      activeStatusTab === tabStatus
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
                    )}
                  >
                    {tabStatus}
                  </button>
                ))}
              </nav>
            </div>
            
            <div className="flex items-center gap-2 flex-grow justify-end">
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search inquiries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
         </div>
      </div>

      {/* Inquiry List View */}
      <div className="flex-grow overflow-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="sticky top-0 bg-gray-50 dark:bg-gray-700 z-10">
          <div className="grid grid-cols-[auto_minmax(0,_4fr)_minmax(0,_2fr)_minmax(0,_2fr)_minmax(0,_2fr)_auto] gap-4 items-center p-3 px-4 border-b border-gray-200 dark:border-gray-600">
            <div className="col-span-1 text-xs font-medium text-muted-foreground"></div> {/* Checkbox/Priority Icon */}
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Inquiry Details</div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assigned To</div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Actions</div>
          </div>
        </div>
        <div>
          {filteredInquiries.map((inquiry) => (
            <div
              key={inquiry.id}
              className="grid grid-cols-[auto_minmax(200px,_4fr)_minmax(100px,_2fr)_minmax(100px,_2fr)_minmax(120px,_2fr)_auto] gap-4 items-center p-3 px-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
            >
              <div>
                <span title={inquiry.priority + ' Priority'}>
                  {getPriorityIcon(inquiry.priority)}
                </span>
              </div>
              <div>
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{inquiry.title}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={inquiry.description}>{inquiry.description}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Reported{inquiry.reportedBy ? ` by ${inquiry.reportedBy}` : ''} · {formatReportedAt(inquiry.reportedAt)}
                </div>
              </div>
              <div className="flex items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={!perms.canUpdate}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "text-xs font-normal justify-start p-1 h-auto min-w-[80px] rounded-md",
                        "hover:opacity-80 transition-opacity group-hover:border group-hover:border-dashed"
                      )}
                      style={getCategoryBadgeClass(inquiry.category)}
                    >
                      <span className="truncate mr-1">{inquiry.category}</span>
                      {perms.canUpdate && <ChevronDown className="h-3 w-3 opacity-50 ml-auto" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Change Category</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      {potentialCategories.map((cat) => (
                        <DropdownMenuItem
                          key={cat}
                          onSelect={() => handleCategoryUpdate(inquiry.id, cat)}
                          className="text-xs"
                        >
                          <span className="mr-2" style={{ color: getCategoryBadgeClass(cat).color }}>●</span>
                          {cat}
                          {inquiry.category === cat && <Check className="ml-auto h-4 w-4" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={!perms.canUpdate}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "text-xs font-medium justify-start p-1 h-auto min-w-[90px] rounded-md",
                        getStatusBadgeClass(inquiry.status),
                        "hover:opacity-80 transition-opacity group-hover:border group-hover:border-dashed"
                      )}
                    >
                      <span className="truncate mr-1">{inquiry.status}</span>
                      {perms.canUpdate && <ChevronDown className="h-3 w-3 opacity-50 ml-auto" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      {inquiryStatuses.map((stat) => (
                        <DropdownMenuItem
                          key={stat}
                          onSelect={() => handleStatusUpdate(inquiry.id, stat)}
                          className="text-xs"
                        >
                          <span className={cn("mr-2 h-2 w-2 rounded-full", getStatusBadgeClass(stat).split(' ')[0])}></span>
                          {stat}
                          {inquiry.status === stat && <Check className="ml-auto h-4 w-4" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={!perms.canUpdate}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs font-normal justify-start p-1 h-auto min-w-[80px] rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 group-hover:border group-hover:border-dashed"
                    >
                      {inquiry.assignee ? (
                        <>
                          <Avatar className="h-5 w-5 mr-1.5">
                            <AvatarFallback className="text-[10px] bg-muted-foreground/20 text-muted-foreground">
                              {inquiry.assignee.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate mr-1">{inquiry.assignee.name}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground italic mr-1">Unassigned</span>
                      )}
                      {perms.canUpdate && <ChevronDown className="h-3 w-3 opacity-50 ml-auto" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
                     <DropdownMenuLabel>Assign To</DropdownMenuLabel>
                     <DropdownMenuSeparator />
                     <DropdownMenuGroup>
                        <DropdownMenuItem
                           onSelect={() => handleAssigneeUpdate(inquiry.id, null)}
                           className="text-xs italic"
                         >
                           Unassigned
                           {!inquiry.assignee && <Check className="ml-auto h-4 w-4" />}
                         </DropdownMenuItem>
                       {staffMembers.map(staff => toAssignee(staff)).map((assignee) => (
                         <DropdownMenuItem
                           key={assignee.email}
                           onSelect={() => handleAssigneeUpdate(inquiry.id, assignee.email || null)}
                           className="text-xs"
                         >
                           <Avatar className="h-5 w-5 mr-1.5">
                             <AvatarFallback className="text-[10px] bg-muted-foreground/20 text-muted-foreground">
                               {assignee.initials}
                             </AvatarFallback>
                           </Avatar>
                           {assignee.name}
                           {inquiry.assignee?.email === assignee.email && <Check className="ml-auto h-4 w-4" />}
                         </DropdownMenuItem>
                       ))}
                     </DropdownMenuGroup>
                   </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex justify-end items-center">
                {(perms.canUpdate || perms.canDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">More actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {perms.canUpdate && (
                      <DropdownMenuItem onClick={() => handleEditInquiry(inquiry.id)}>
                        <Edit className="mr-2 h-4 w-4" />
                        <span>Edit</span>
                      </DropdownMenuItem>
                    )}
                    {perms.canUpdate && perms.canDelete && <DropdownMenuSeparator />}
                    {perms.canDelete && (
                      <DropdownMenuItem
                        onClick={() => handleDeleteInquiry(inquiry.id)}
                        className="text-red-600 focus:text-red-600 focus:bg-red-100/50 dark:focus:bg-red-800/30"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <InquiryDialog
        isOpen={isDialogOpen}
        onClose={() => { setIsDialogOpen(false); setEditingInquiry(null); }}
        onSubmit={handleInquirySubmit}
        initialData={editingInquiry}
      />

      <AlertDialog open={!!inquiryToDelete} onOpenChange={open => { if (!open) setInquiryToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this inquiry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-medium">{inquiryToDelete?.title}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteInquiry} className={cn(buttonVariants({ variant: 'destructive' }))}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GeneralInquiries; 