import React, { useState, useEffect } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import {
    History, FilePlus
} from 'lucide-react';
import MeetingMinutesForm, { MeetingData, MeetingHistoryEntry } from '@/components/meeting/MeetingMinutesForm';
import { toast } from 'sonner';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { useOpsService } from '@/hooks/useSharePointOps';

const HISTORY_KEY = 'scpng_mtg_history';
const DRAFT_KEY = 'scpng_mtg_draft';
const MAX_HISTORY = 20;

const freshMeetingData = (): MeetingData => ({
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
  attendance: [{ name: '', position: '', email: '' }],
  discussion: [{ topic: '', points: '' }],
  actionItems: [{ area: '', action: '', owner: '' }],
  remarks: ''
});

const buildPartialMeetingData = (fields: any): MeetingData => ({
  particulars: {
    name: fields.Title || '',
    meetingId: fields.MeetingID || '',
    date: fields.MeetingDate ? fields.MeetingDate.split('T')[0] : '',
    startTime: '09:00',
    endTime: '10:00',
    facilitator: fields.Facilitator || '',
    venue: fields.Venue || '',
    minutesBy: '',
    objective: '',
    order: ''
  },
  attendance: (() => { try { return JSON.parse(fields.AttendeesJSON || '[]'); } catch { return [{ name: '', position: '', email: '' }]; } })(),
  discussion: [{ topic: '', points: '' }],
  actionItems: [{ area: '', action: '', owner: '' }],
  remarks: ''
});

const MeetingMinutes = () => {
  const [meetingData, setMeetingData] = useState<MeetingData>(freshMeetingData);
  const [history, setHistory] = useState<MeetingHistoryEntry[]>([]);
  const { instance: msalInstance } = useMsal();
  const getOpsService = useOpsService();

  // Load draft + history from localStorage
  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try { setMeetingData(JSON.parse(savedDraft)); } catch (e) { /* ignore */ }
    }
    const savedHistory = localStorage.getItem(HISTORY_KEY);
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)); } catch (e) { /* ignore */ }
    }
  }, []);

  // Fetch history from SharePoint for the current user
  useEffect(() => {
    const fetchSpHistory = async () => {
      try {
        const account = msalInstance.getActiveAccount();
        if (!account) return;
        const currentEmail = account.username;

        const opsService = await getOpsService();
        const graphClient = await getGraphClient(msalInstance);
        if (!graphClient || !opsService.siteId) return;

        const lists = await graphClient.api(`/sites/${opsService.siteId}/lists`).get();
        const list = lists.value.find((l: any) => l.displayName === 'Meeting_Minutes_Registry');
        if (!list) return;

        const itemsResp = await graphClient
          .api(`/sites/${opsService.siteId}/lists/${list.id}/items`)
          .expand('fields')
          .get();

        const myItems = (itemsResp.value as any[]).filter(item =>
          item.createdBy?.user?.email === currentEmail
        );

        const spEntries: MeetingHistoryEntry[] = myItems.map(item => {
          const fields = item.fields || {};
          let data: MeetingData;
          if (fields.MeetingDataJSON) {
            try { data = JSON.parse(fields.MeetingDataJSON); } catch { data = buildPartialMeetingData(fields); }
          } else {
            data = buildPartialMeetingData(fields);
          }
          return {
            id: `sp-${item.id}`,
            savedAt: item.createdDateTime,
            meetingName: fields.Title || 'Untitled Meeting',
            meetingId: fields.MeetingID || fields.MeetingId || '',
            data,
          };
        });

        if (spEntries.length === 0) return;

        setHistory(prev => {
          // Merge localStorage + SP entries, dedup by id, sort by date
          const localIds = new Set(prev.map(e => e.id));
          const newEntries = spEntries.filter(e => !localIds.has(e.id));
          return [...prev, ...newEntries].sort(
            (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
          );
        });
      } catch (e) {
        console.error('Failed to load SP meeting history:', e);
      }
    };

    fetchSpHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(meetingData));
  }, [meetingData]);

  const handleClear = () => {
    const fresh = freshMeetingData();
    setMeetingData(fresh);
    localStorage.removeItem(DRAFT_KEY);
    toast.success('Form cleared');
  };

  const handleSaveToHistory = () => {
    const entry: MeetingHistoryEntry = {
      id: `${Date.now()}`,
      savedAt: new Date().toISOString(),
      meetingName: meetingData.particulars.name || 'Untitled Meeting',
      meetingId: meetingData.particulars.meetingId,
      data: meetingData,
    };
    setHistory(prev => {
      const updated = [...prev, entry].slice(-MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
    toast.success('Meeting saved to history');
  };

  const handleLoadHistory = (entry: MeetingHistoryEntry) => {
    setMeetingData(entry.data);
    toast.success(`Loaded: ${entry.meetingName}`);
  };

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
                onClear={handleClear}
                onSave={handleSaveToHistory}
                history={history}
                onLoadHistory={handleLoadHistory}
            />
        </div>
      </div>
    </PageLayout>
  );
};

export default MeetingMinutes;
