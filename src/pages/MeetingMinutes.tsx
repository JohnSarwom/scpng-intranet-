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
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';

const HISTORY_KEY = 'scpng_mtg_history';
const DRAFT_KEY = 'scpng_mtg_draft';
const MAX_HISTORY = 20;

const freshMeetingData = (): MeetingData => ({
  particulars: {
    name: '',
    meetingId: '',
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

/**
 * Converts a unit name to a short uppercase code using initials.
 * e.g. "Information Technology" → "IT", "Human Resources" → "HR"
 */
const getUnitCode = (unitName: string): string => {
  return unitName
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map(w => w[0].toUpperCase())
    .join('');
};

/**
 * Finds the next sequential meeting ID for the given unit code.
 * Format: SCPNGMID{UNITCODE}{NNN}
 */
const generateNextMeetingId = (unitCode: string, existingIds: string[]): string => {
  const prefix = `SCPNGMID${unitCode}`;
  let maxNum = 0;
  for (const id of existingIds) {
    if (id.startsWith(prefix)) {
      const num = parseInt(id.slice(prefix.length), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
};

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
  const [existingMeetingIds, setExistingMeetingIds] = useState<string[]>([]);
  const [spLoaded, setSpLoaded] = useState(false);
  const { instance: msalInstance } = useMsal();
  const getOpsService = useOpsService();
  const { user: roleUser } = useRoleBasedAuth();

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

  // Fetch history + all Meeting IDs from SharePoint
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

        const allItems: any[] = itemsResp.value;

        // Collect all stored Meeting IDs (for sequence generation across all users in unit)
        const allIds = allItems
          .map(item => item.fields?.MeetingID as string)
          .filter(Boolean);
        setExistingMeetingIds(allIds);

        // Filter to current user's items for history display
        const myItems = allItems.filter(item =>
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
            meetingId: fields.MeetingID || '',
            data,
          };
        });

        if (spEntries.length > 0) {
          setHistory(prev => {
            const localIds = new Set(prev.map(e => e.id));
            const newEntries = spEntries.filter(e => !localIds.has(e.id));
            return [...prev, ...newEntries].sort(
              (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
            );
          });
        }
      } catch (e) {
        console.error('Failed to load SP meeting history:', e);
      } finally {
        setSpLoaded(true);
      }
    };

    fetchSpHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generate unit-based Meeting ID once SP data is loaded (roleUser may still be loading)
  useEffect(() => {
    if (!spLoaded) return;
    // Use unit_name → division_name → 'GEN' as fallback so ID always generates
    const unitName = roleUser?.unit_name || roleUser?.division_name || 'GEN';
    const unitCode = getUnitCode(unitName);
    setMeetingData(prev => {
      // Only auto-generate if the ID is empty or still in the old SC-MTG format
      if (prev.particulars.meetingId && !prev.particulars.meetingId.startsWith('SC-MTG-')) return prev;
      const nextId = generateNextMeetingId(unitCode, existingMeetingIds);
      return { ...prev, particulars: { ...prev.particulars, meetingId: nextId } };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spLoaded, roleUser?.unit_name, roleUser?.division_name]);

  // Auto-save draft
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(meetingData));
  }, [meetingData]);

  const handleClear = () => {
    const fresh = freshMeetingData();
    // Regenerate a new sequential ID for the unit on clear
    const unitName = roleUser?.unit_name || roleUser?.division_name || 'GEN';
    const unitCode = getUnitCode(unitName);
    fresh.particulars.meetingId = generateNextMeetingId(unitCode, existingMeetingIds);
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
