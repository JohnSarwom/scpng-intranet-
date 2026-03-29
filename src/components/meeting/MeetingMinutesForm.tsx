import React, { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { GlobalAssigneeSelector, Employee } from '@/components/common/GlobalAssigneeSelector';
import { ShareMeetingModal } from './ShareMeetingModal';
import { SharePointListSetupService } from '@/services/sharePointListSetupService';
import { generateMeetingDocx, generateMeetingPdf } from '@/services/meetingDocxService';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { useOpsService } from '@/hooks/useSharePointOps';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { toast } from 'sonner';
import { 
  Plus, Trash2, Users, FileText, ListChecks, 
  MessageSquare, ClipboardList, CheckCircle2,
  Clock, MapPin, User, ChevronRight, Share2, 
  Download, Settings, Loader2, FileCheck
} from 'lucide-react';

export interface AttendanceRecord {
  name: string;
  position: string;
  email: string;
}

export interface DiscussionRecord {
  topic: string;
  points: string;
}

export interface ActionItemRecord {
  area: string;
  action: string;
  owner: string;
}

export interface MeetingData {
  particulars: {
    name: string;
    meetingId: string;
    date: string;
    startTime: string;
    endTime: string;
    facilitator: string;
    venue: string;
    minutesBy: string;
    objective: string;
    order: string;
  };
  attendance: AttendanceRecord[];
  discussion: DiscussionRecord[];
  actionItems: ActionItemRecord[];
  remarks: string;
}

// Utility class merger
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}

const MeetingMinutesForm = ({ data, onChange }: { 
  data: MeetingData, 
  onChange: (newData: MeetingData) => void
}) => {
  const sectionRefs = {
    particulars: useRef<HTMLDivElement>(null),
    attendance: useRef<HTMLDivElement>(null),
    discussion: useRef<HTMLDivElement>(null),
    actions: useRef<HTMLDivElement>(null),
    remarks: useRef<HTMLDivElement>(null)
  };

  const { isAdmin } = useRoleBasedAuth();
  const { instance: msalInstance } = useMsal();
  const getOpsService = useOpsService();

  const [activeSection, setActiveSection] = useState<string>('particulars');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isInitializingSP, setIsInitializingSP] = useState(false);

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      Object.entries(sectionRefs).forEach(([key, ref]) => {
        if (ref.current && 
            scrollPosition >= ref.current.offsetTop && 
            scrollPosition < ref.current.offsetTop + ref.current.offsetHeight) {
          setActiveSection(key);
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (section: keyof typeof sectionRefs) => {
    sectionRefs[section].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(section);
  };

  const updateParticulars = (field: keyof MeetingData['particulars'], value: string) => {
    onChange({
      ...data,
      particulars: { ...data.particulars, [field]: value }
    });
  };

  const addAttendance = () => {
    onChange({
      ...data,
      attendance: [...data.attendance, { name: '', position: '', email: '' }]
    });
  };

  const removeAttendance = (index: number) => {
    const newAttendance = [...data.attendance];
    newAttendance.splice(index, 1);
    onChange({ ...data, attendance: newAttendance });
  };

  const updateAttendance = (index: number, field: keyof AttendanceRecord, value: string) => {
    const newAttendance = [...data.attendance];
    newAttendance[index] = { ...newAttendance[index], [field]: value };
    onChange({ ...data, attendance: newAttendance });
  };

  const addDiscussion = () => {
    onChange({
      ...data,
      discussion: [...data.discussion, { topic: '', points: '' }]
    });
  };

  const removeDiscussion = (index: number) => {
    const newDiscussion = [...data.discussion];
    newDiscussion.splice(index, 1);
    onChange({ ...data, discussion: newDiscussion });
  };

  const updateDiscussion = (index: number, field: keyof DiscussionRecord, value: string) => {
    const newDiscussion = [...data.discussion];
    newDiscussion[index] = { ...newDiscussion[index], [field]: value };
    onChange({ ...data, discussion: newDiscussion });
  };

  const addActionItem = () => {
    onChange({
      ...data,
      actionItems: [...data.actionItems, { area: '', action: '', owner: '' }]
    });
  };

  const removeActionItem = (index: number) => {
    const newActions = [...data.actionItems];
    newActions.splice(index, 1);
    onChange({ ...data, actionItems: newActions });
  };

  const updateActionItem = (index: number, field: keyof ActionItemRecord, value: string) => {
    const newActions = [...data.actionItems];
    newActions[index] = { ...newActions[index], [field]: value };
    onChange({ ...data, actionItems: newActions });
  };

  const handleInitializeSP = async () => {
    setIsInitializingSP(true);
    const setupToast = toast.loading("Initializing SharePoint Infrastructure...");
    try {
      const opsService = await getOpsService();
      const graphClient = await getGraphClient(msalInstance);
      if (!graphClient || !opsService.siteId) {
        throw new Error('Graph client or Site ID not initialized.');
      }

      const setupService = new SharePointListSetupService(graphClient, opsService.siteId);
      const result = await setupService.setupMeetingMinutesInfrastructure();

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      console.error('Setup failed:', error);
      toast.error(error.message || 'Infrastructure setup failed.');
    } finally {
      setIsInitializingSP(false);
      toast.dismiss(setupToast);
    }
  };

  const handleDownloadPDF = async () => {
    const exportToast = toast.loading("Preparing print preview...");
    try {
      await generateMeetingPdf(data);
      toast.success("Print preview ready", { duration: 3000 });
    } catch (error: any) {
      console.error("PDF generation failed", error);
      toast.error(error?.message || "Failed to open print window.");
    } finally {
      toast.dismiss(exportToast);
    }
  };

  const handleDownloadDocx = async () => {
    const exportToast = toast.loading("Preparing Word document...");
    try {
      await generateMeetingDocx(data);
      toast.success("Word Document Downloaded");
    } catch (error) {
      console.error("DOCX generation failed", error);
      toast.error("Failed to generate Word document.");
    } finally {
      toast.dismiss(exportToast);
    }
  };

  const NavItem = ({ section, label, icon: Icon, count }: { section: keyof typeof sectionRefs, label: string, icon: any, count?: number }) => {
    const isActive = activeSection === section;
    return (
        <button 
            onClick={() => scrollToSection(section)}
            className={cn(
                "w-full flex items-center justify-between p-3 rounded-lg transition-all text-left group border-l-4",
                isActive 
                    ? "bg-[#83002A]/5 border-[#83002A] text-[#83002A]" 
                    : "border-transparent text-gray-400 hover:text-gray-900 hover:bg-gray-50"
            )}
        >
            <div className="flex items-center gap-3">
                <Icon className={cn("w-4 h-4", isActive ? "text-[#83002A]" : "text-gray-400 group-hover:text-gray-600")} />
                <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
            </div>
            {count !== undefined && count > 0 && (
                <Badge variant="outline" className={cn(
                    "border-0 text-[10px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center rounded-full font-bold",
                    isActive ? "bg-[#83002A] text-white" : "bg-gray-200 text-gray-500"
                )}>
                    {count}
                </Badge>
            )}
        </button>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-10 items-start">
      {/* Sidebar Navigation - Light Clean Theme */}
      <div className="w-full lg:w-64 sticky top-32 z-10">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-2 pt-4">
          <div className="px-4 mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Form Progress</h3>
          </div>
          <div className="space-y-0.5">
            <NavItem section="particulars" label="Particulars" icon={FileText} />
            <NavItem section="attendance" label="Attendance" icon={Users} count={data.attendance.length} />
            <NavItem section="discussion" label="Discussions" icon={MessageSquare} count={data.discussion.length} />
            <NavItem section="actions" label="Action Items" icon={ListChecks} count={data.actionItems.length} />
            <NavItem section="remarks" label="Final Remarks" icon={CheckCircle2} />
          </div>
          
          <div className="p-4 mt-6 bg-gray-50 border-t border-gray-100">
             <div className="flex items-center gap-2 mb-2">
                 <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="bg-green-600 h-full rounded-full" style={{ width: '85%' }} />
                 </div>
                 <span className="text-[10px] font-bold text-gray-600">85%</span>
             </div>
             <p className="text-[9px] text-gray-400 font-medium">Auto-syncing data for export</p>
          </div>
        </div>
      </div>

      {/* Main Single Column Form */}
      <div className="flex-1 space-y-12 max-w-4xl px-2">
        {/* Particulars Section */}
        <section ref={sectionRefs.particulars} className="scroll-mt-32">
          <Card className="border-gray-200 bg-white shadow-sm rounded-xl overflow-hidden">
            <div className="bg-slate-50 border-b border-gray-100 px-8 py-5">
              <h2 className="text-lg font-bold text-gray-900">A) Meeting Particulars</h2>
            </div>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 uppercase">Meeting Name <span className="text-red-500">*</span></label>
                  <Input 
                      value={data.particulars.name} 
                      onChange={(e) => updateParticulars('name', e.target.value)}
                      placeholder="e.g. Project Alpha Update"
                      className="bg-white border-gray-300 focus:ring-1 focus:ring-[#83002A] focus:border-[#83002A] h-11 rounded-lg transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 uppercase">Meeting ID / Number</label>
                  <Input 
                      value={data.particulars.meetingId} 
                      onChange={(e) => updateParticulars('meetingId', e.target.value)}
                      className="bg-gray-50 border-gray-300 h-11 rounded-lg text-gray-500 border-dashed"
                      readOnly
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 uppercase flex items-center gap-2">Date Selection <span className="text-red-500">*</span></label>
                  <Input 
                      type="date"
                      value={data.particulars.date} 
                      onChange={(e) => updateParticulars('date', e.target.value)}
                      className="border-gray-300 h-11 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-700 uppercase">Starts</label>
                      <Input 
                          type="time"
                          value={data.particulars.startTime} 
                          onChange={(e) => updateParticulars('startTime', e.target.value)}
                          className="border-gray-300 h-11 rounded-lg"
                      />
                  </div>
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-700 uppercase">Ends</label>
                      <Input 
                          type="time"
                          value={data.particulars.endTime} 
                          onChange={(e) => updateParticulars('endTime', e.target.value)}
                          className="border-gray-300 h-11 rounded-lg"
                      />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 uppercase flex items-center gap-2">Venue / Location</label>
                  <Input 
                      value={data.particulars.venue} 
                      onChange={(e) => updateParticulars('venue', e.target.value)}
                      placeholder="e.g. SCPNG Conference Room"
                      className="border-gray-300 h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 uppercase">Facilitator</label>
                  <GlobalAssigneeSelector
                    selected={data.particulars.facilitator ? [{ id: 'facilitator', displayName: data.particulars.facilitator }] as Employee[] : []}
                    onChange={(employees) => {
                      if (employees.length > 0) {
                        updateParticulars('facilitator', employees[0].displayName);
                      } else {
                        updateParticulars('facilitator', '');
                      }
                    }}
                    placeholder="Select Facilitator..."
                    className="border-gray-300 h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 uppercase">Minutes Recorded By</label>
                  <GlobalAssigneeSelector
                    selected={data.particulars.minutesBy ? [{ id: 'recorder', displayName: data.particulars.minutesBy }] as Employee[] : []}
                    onChange={(employees) => {
                      if (employees.length > 0) {
                        updateParticulars('minutesBy', employees[0].displayName);
                      } else {
                        updateParticulars('minutesBy', '');
                      }
                    }}
                    placeholder="Select Recorder..."
                    className="border-gray-300 h-11 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-6 pt-4 border-t border-gray-100">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-700 uppercase">Meeting Objective <span className="text-red-500">*</span></label>
                    <Textarea 
                        value={data.particulars.objective} 
                        onChange={(e) => updateParticulars('objective', e.target.value)}
                        placeholder="State the purpose of this meeting..."
                        className="bg-white border-gray-300 focus:ring-1 focus:ring-[#83002A] min-h-[100px] rounded-lg p-3 resize-none"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-700 uppercase">Opening Mentions</label>
                    <Textarea 
                        value={data.particulars.order} 
                        onChange={(e) => updateParticulars('order', e.target.value)}
                        placeholder="Housekeeping, apologies, or opening remarks..."
                        className="bg-white border-gray-300 min-h-[80px] rounded-lg p-3 resize-none"
                    />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Attendance Section */}
        <section ref={sectionRefs.attendance} className="scroll-mt-32">
          <Card className="border-gray-200 bg-white shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-gray-100 px-8 py-5 flex flex-row items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">B) Attendance Roster</h2>
                  <Button onClick={addAttendance} variant="outline" size="sm" className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50 h-9">
                      <Plus className="w-4 h-4 mr-2" /> Add Attendee
                  </Button>
              </CardHeader>
              <CardContent className="p-8">
                  {data.attendance.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-xl">
                          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                          <p className="text-sm text-gray-400">No attendees added yet</p>
                      </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {data.attendance.map((attendee, idx) => (
                            <div 
                                key={idx} 
                                className="flex gap-4 items-start bg-gray-50 p-5 rounded-xl border border-gray-100 transition-all hover:border-[#83002A]/30 group"
                            >
                                <div className="flex-1 space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-gray-400">Officer Name</label>
                                        <GlobalAssigneeSelector
                                            selected={attendee.name ? [{ id: `attendee-${idx}`, displayName: attendee.name }] as Employee[] : []}
                                            onChange={(employees) => {
                                                if (employees.length > 0) {
                                                    const emp = employees[0];
                                                    // Update name and auto-fill position if available
                                                    const newAttendance = [...data.attendance];
                                                    newAttendance[idx] = { 
                                                        ...newAttendance[idx], 
                                                        name: emp.displayName,
                                                        position: emp.jobTitle || newAttendance[idx].position,
                                                        email: emp.mail || ''
                                                    };
                                                    onChange({ ...data, attendance: newAttendance });
                                                } else {
                                                    updateAttendance(idx, 'name', '');
                                                    updateAttendance(idx, 'email', '');
                                                }
                                            }}
                                            placeholder="Search Name..."
                                            className="bg-white border-gray-300 h-9 text-sm rounded-md"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-gray-400">Position / Assignment</label>
                                        <Input 
                                            value={attendee.position}
                                            onChange={(e) => updateAttendance(idx, 'position', e.target.value)}
                                            placeholder="Senior Consultant"
                                            className="bg-white border-gray-300 h-9 text-sm rounded-md"
                                        />
                                    </div>
                                </div>
                                <Button 
                                    onClick={() => removeAttendance(idx)}
                                    variant="ghost" 
                                    size="icon"
                                    className="text-gray-300 hover:text-red-600 hover:bg-red-50 -mt-1 -mr-1 h-8 w-8 transition-opacity md:opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                  )}
              </CardContent>
          </Card>
        </section>

        {/* Discussion Section */}
        <section ref={sectionRefs.discussion} className="scroll-mt-32">
          <Card className="border-gray-200 bg-white shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-gray-100 px-8 py-5 flex flex-row items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">C) Key Discussion Points</h2>
                  <Button onClick={addDiscussion} variant="outline" size="sm" className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50 h-9">
                      <Plus className="w-4 h-4 mr-2" /> New Topic
                  </Button>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                  {data.discussion.length === 0 && (
                      <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-xl">
                          <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                          <p className="text-sm text-gray-400">Discussion record is empty</p>
                      </div>
                  )}
                  {data.discussion.map((item, idx) => (
                      <div 
                          key={idx} 
                          className="p-6 rounded-xl border border-gray-100 bg-gray-50/50 relative group hover:border-[#83002A]/20 transition-all"
                      >
                          <div className="flex items-center justify-between mb-5">
                            <span className="text-xs font-bold text-[#83002A] bg-[#83002A]/5 px-3 py-1 rounded-full uppercase">Topic Section {idx + 1}</span>
                            <Button 
                                onClick={() => removeDiscussion(idx)}
                                variant="ghost" 
                                size="icon"
                                className="text-gray-300 hover:text-red-500 hover:bg-red-50 h-8 w-8 opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          <div className="space-y-4">
                              <div className="space-y-2">
                                  <label className="text-xs font-bold text-gray-600">DISCUSSION TOPIC TITLE</label>
                                  <Input 
                                      value={item.topic}
                                      onChange={(e) => updateDiscussion(idx, 'topic', e.target.value)}
                                      placeholder="Brief Topic Header"
                                      className="bg-white border-gray-300 font-bold text-gray-900 rounded-lg h-10"
                                  />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-xs font-bold text-gray-600">DELIBERATIONS & RESOLUTIONS</label>
                                  <Textarea 
                                      value={item.points}
                                      onChange={(e) => updateDiscussion(idx, 'points', e.target.value)}
                                      placeholder="Record details of the discussion here..."
                                      className="bg-white border-gray-300 min-h-[140px] rounded-lg p-4 resize-none leading-relaxed"
                                  />
                                  <p className="text-[10px] text-gray-400 italic mt-1">Separate bullets with a new line for proper document formatting.</p>
                              </div>
                          </div>
                      </div>
                  ))}
              </CardContent>
          </Card>
        </section>

        {/* Action Items Section */}
        <section ref={sectionRefs.actions} className="scroll-mt-32">
          <Card className="border-gray-200 bg-white shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-gray-100 px-8 py-5 flex flex-row items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">D) Action Items Reference</h2>
                  <Button onClick={addActionItem} variant="outline" size="sm" className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50 h-9">
                      <Plus className="w-4 h-4 mr-2" /> Assign Responsibility
                  </Button>
              </CardHeader>
              <CardContent className="p-8">
                  {data.actionItems.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-xl">
                          <ListChecks className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                          <p className="text-sm text-gray-400">No action items defined</p>
                      </div>
                  ) : (
                    <div className="space-y-3">
                        {data.actionItems.map((item, idx) => (
                            <div 
                                key={idx} 
                                className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100 group transition-all"
                            >
                                <div className="md:col-span-3">
                                    <Input 
                                        value={item.area}
                                        onChange={(e) => updateActionItem(idx, 'area', e.target.value)}
                                        placeholder="Area (e.g. IT)"
                                        className="bg-white border-gray-300 h-10 text-xs font-bold"
                                    />
                                </div>
                                <div className="md:col-span-12 lg:md:col-span-6">
                                    <Input 
                                        value={item.action}
                                        onChange={(e) => updateActionItem(idx, 'action', e.target.value)}
                                        placeholder="Assigned task or directive..."
                                        className="bg-white border-gray-300 h-10 text-xs"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <GlobalAssigneeSelector
                                        selected={item.owner ? [{ id: `owner-${idx}`, displayName: item.owner }] as Employee[] : []}
                                        onChange={(employees) => {
                                            if (employees.length > 0) {
                                                updateActionItem(idx, 'owner', employees[0].displayName);
                                            } else {
                                                updateActionItem(idx, 'owner', '');
                                            }
                                        }}
                                        placeholder="Owner"
                                        className="bg-white border-gray-300 h-10 text-xs font-medium"
                                    />
                                </div>
                                <div className="md:col-span-1 flex items-center justify-center">
                                    <Button 
                                        onClick={() => removeActionItem(idx)}
                                        variant="ghost" 
                                        size="icon"
                                        className="text-gray-300 hover:text-red-500 h-8 w-8"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                  )}
              </CardContent>
          </Card>
        </section>

        {/* Remarks Section */}
        <section ref={sectionRefs.remarks} className="scroll-mt-32">
          <Card className="border-gray-200 bg-white shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-gray-100 px-8 py-5">
                  <h2 className="text-lg font-bold text-gray-900">E) Final Remarks</h2>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                  <div className="space-y-3">
                      <label className="text-xs font-bold text-gray-700 uppercase">Closing Statements</label>
                      <Textarea 
                          value={data.remarks} 
                          onChange={(e) => onChange({...data, remarks: e.target.value})}
                          placeholder="Summary of meeting closure, next proposed meeting date..."
                          className="bg-white border-gray-300 min-h-[120px] rounded-lg p-4 resize-none leading-relaxed"
                      />
                  </div>
                  
                  <div className="p-6 rounded-xl bg-slate-50 border border-gray-100">
                      <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-4">
                          <ClipboardList className="w-4 h-4 text-[#83002A]" />
                          Module Summary
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 bg-white rounded-lg border border-gray-200">
                              <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Attendees</p>
                              <p className="text-2xl font-bold text-gray-900">{data.attendance.length}</p>
                          </div>
                          <div className="p-4 bg-white rounded-lg border border-gray-200">
                              <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Topics</p>
                              <p className="text-2xl font-bold text-gray-900">{data.discussion.length}</p>
                          </div>
                          <div className="p-4 bg-white rounded-lg border border-gray-200">
                              <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Directives</p>
                              <p className="text-2xl font-bold text-gray-900">{data.actionItems.length}</p>
                          </div>
                          <div className="p-4 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
                              <Badge className="bg-green-600 text-white font-bold text-[10px] border-0 py-1 px-3">READY</Badge>
                          </div>
                      </div>
                  </div>
              </CardContent>
          </Card>
        </section>

        {/* Form Footer Actions */}
        <div className="pt-10 pb-20 border-t border-gray-200 mt-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-bold text-gray-900">Finalize & Share</h3>
                    <p className="text-xs text-gray-500 max-w-xs">Distribute the minutes to all attendees or export for official records.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Admin Setup Button */}
                    {isAdmin && (
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={handleInitializeSP}
                            disabled={isInitializingSP}
                            className="text-gray-400 hover:text-[#83002A] h-10 px-4"
                        >
                            {isInitializingSP ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Settings className="w-4 h-4 mr-2" />}
                            Init SharePoint
                        </Button>
                    )}

                    <Button 
                        variant="outline" 
                        onClick={handleDownloadDocx}
                        className="border-gray-300 text-gray-700 h-11 px-6 rounded-xl hover:bg-gray-50 font-semibold"
                    >
                        <Download className="w-4 h-4 mr-2" /> Export Word
                    </Button>

                    {isAdmin && (
                        <Button 
                            variant="outline" 
                            onClick={handleDownloadPDF}
                            className="border-[#83002A]/20 text-[#83002A] h-11 px-6 rounded-xl hover:bg-[#83002A]/5 hover:border-[#83002A] font-semibold"
                        >
                            <FileCheck className="w-4 h-4 mr-2" /> Official PDF
                        </Button>
                    )}

                    <Button 
                        onClick={() => setIsShareModalOpen(true)}
                        className="bg-[#83002A] hover:bg-[#6a0022] text-white h-11 px-8 rounded-xl shadow-lg shadow-[#83002A]/20 font-bold transition-all transform hover:scale-[1.02]"
                    >
                        <Share2 className="w-4 h-4 mr-2" /> Share with Attendees
                    </Button>
                </div>
            </div>
        </div>

        <ShareMeetingModal 
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            data={data}
        />
      </div>
    </div>
  );
};

export default MeetingMinutesForm;
