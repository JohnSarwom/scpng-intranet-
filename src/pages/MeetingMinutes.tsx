import React, { useState, useEffect } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import { 
    History, FilePlus 
} from 'lucide-react';
import MeetingMinutesForm, { MeetingData } from '@/components/meeting/MeetingMinutesForm';

const MeetingMinutes = () => {
  const [meetingData, setMeetingData] = useState<MeetingData>({
    particulars: {
      name: '',
      meetingId: `SC-MTG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '10:00',
      facilitator: '',
      venue: 'SCPNG Main Board Room',
      minutesBy: '',
      objective: '',
      order: ''
    },
    attendance: [
        { name: '', position: '', email: '' }
    ],
    discussion: [
        { topic: '', points: '' }
    ],
    actionItems: [
        { area: '', action: '', owner: '' }
    ],
    remarks: ''
  });

  // Load from local storage if exists (draft saving)
  useEffect(() => {
    const saved = localStorage.getItem('scpng_mtg_draft');
    if (saved) {
      try {
        setMeetingData(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load draft", e);
      }
    }
  }, []);

  // Auto-save draft
  useEffect(() => {
    localStorage.setItem('scpng_mtg_draft', JSON.stringify(meetingData));
  }, [meetingData]);

  return (
    <PageLayout>
      <div className="min-h-screen bg-slate-50/50 -mx-4 px-4">
        {/* Simplified Sticky Header - Navigation & Title only */}
        <div className="sticky top-0 z-50 bg-white border-b border-gray-200 -mx-4 px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-[#83002A]/5 rounded-xl border border-[#83002A]/10">
                <FilePlus className="w-5 h-5 text-[#83002A]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                Meeting Minutes Generator
              </h1>
              <div className="flex items-center gap-3 text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                <span className="flex items-center gap-1.5"><History className="w-3 h-3 text-green-600" /> Draft Auto-saved</span>
                <span className="text-gray-300">•</span>
                <span className="text-[#83002A]">Dynamic Template v2.4</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Vertical Form */}
        <div className="max-w-6xl mx-auto py-8">
            <MeetingMinutesForm 
                data={meetingData} 
                onChange={setMeetingData} 
            />
        </div>
      </div>
    </PageLayout>
  );
};

export default MeetingMinutes;
