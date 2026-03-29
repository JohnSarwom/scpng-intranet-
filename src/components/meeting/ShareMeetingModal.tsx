import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Users, Mail, FileCheck, Share2, 
  Loader2, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { MeetingData } from '@/components/meeting/MeetingMinutesForm';
import { MeetingShareService } from '@/services/meetingShareService';
import { buildDocxBlob } from '@/services/meetingDocxService';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { useOpsService } from '@/hooks/useSharePointOps';
import { toast } from 'sonner';

interface ShareMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: MeetingData;
  onSuccess?: (shareLink: string) => void;
}

export const ShareMeetingModal = ({ isOpen, onClose, data, onSuccess }: ShareMeetingModalProps) => {
  const [customMessage, setCustomMessage] = useState('');
  const [sharing, setSharing] = useState(false);
  const [stage, setStage] = useState<'idle' | 'uploading' | 'sharing' | 'mailing' | 'complete' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { instance: msalInstance } = useMsal();
  const getOpsService = useOpsService();

  const recipients = data.attendance
    .filter(a => !!a.email && a.email.includes('@'))
    .map(a => ({ name: a.name, email: a.email }));

  const missingEmails = data.attendance.filter(a => !a.email || !a.email.includes('@'));

  const handleShare = async () => {
    setSharing(true);
    setStage('uploading');
    setErrorMessage('');

    try {
      // 1. Initialize services
      const opsService = await getOpsService();
      const graphClient = await getGraphClient(msalInstance);
      if (!graphClient || !opsService.siteId) {
        throw new Error('Graph client or Site ID not initialized.');
      }

      const shareService = new MeetingShareService(graphClient, opsService.siteId);

      // 2. Build Blob
      const blob = await buildDocxBlob(data);

      setStage('sharing');
      // 3. Orchestrate sharing via our new service
      const result = await shareService.shareWithAttendees(data, blob, customMessage);

      if (result.success) {
        setStage('complete');
        toast.success(result.message);
        if (onSuccess && result.shareLink) {
          onSuccess(result.shareLink);
        }
        setTimeout(() => {
          onClose();
          // Reset state for next time
          setStage('idle');
          setSharing(false);
        }, 2000);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error('Share failure:', error);
      setStage('error');
      setErrorMessage(error.message || 'An error occurred during sharing.');
      toast.error(error.message || 'Sharing failed.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-white border-0 shadow-2xl p-0 overflow-hidden rounded-2xl">
        <div className="bg-[#83002A] px-6 py-8 text-white relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
             <Share2 size={80} />
          </div>
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <Share2 className="w-6 h-6" /> 
            Collaborative Sharing
          </DialogTitle>
          <DialogDescription className="text-white/70 mt-2 text-sm">
            Share these minutes with all attendees for collaborative editing.
          </DialogDescription>
        </div>

        <div className="p-6 space-y-6">
          {stage === 'idle' || stage === 'error' ? (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                   <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Recipients ({recipients.length})</h4>
                   {missingEmails.length > 0 && (
                     <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-200">
                       {missingEmails.length} missing emails
                     </Badge>
                   )}
                </div>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-1">
                  {recipients.map((r, i) => (
                    <Badge key={i} className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 flex items-center gap-1.5 px-2 py-1">
                      <Mail className="w-3 h-3 text-[#83002A]" />
                      {r.name.split(' ')[0]}
                    </Badge>
                  ))}
                  {recipients.length === 0 && (
                    <p className="text-xs text-red-500 font-medium">No valid emails found in attendance roster.</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Custom Invitation Message</h4>
                <Textarea 
                  placeholder="e.g. Please review the minutes from today's session and add any points I might have missed."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="min-h-[120px] bg-slate-50 border-gray-200 focus:ring-[#83002A] focus:border-[#83002A] rounded-xl resize-none text-sm p-4"
                />
              </div>

              {stage === 'error' && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex gap-3 text-red-700 text-xs">
                   <AlertCircle className="w-4 h-4 shrink-0 transition-all" />
                   <p>{errorMessage}</p>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
               <div className="relative">
                  {stage === 'complete' ? (
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                       <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                  ) : (
                    <Loader2 className="w-16 h-16 text-[#83002A] animate-spin" />
                  )}
               </div>
               
               <div className="space-y-1">
                  <h3 className="text-lg font-bold text-gray-900">
                    {stage === 'uploading' && 'Uploading document...'}
                    {stage === 'sharing' && 'Generating secure edit link...'}
                    {stage === 'mailing' && 'Sending invitations...'}
                    {stage === 'complete' && 'Successfully Shared!'}
                  </h3>
                  <p className="text-sm text-gray-500 px-8">
                    {stage === 'uploading' && 'Saving the Word document to the Meeting Minutes Drafts library.'}
                    {stage === 'sharing' && 'Applying organizational edit permissions for collaborative work.'}
                    {stage === 'mailing' && 'Mailing the link to all attendees captured in the roster.'}
                    {stage === 'complete' && 'Each attendee will receive an email with instructions.'}
                  </p>
               </div>
            </div>
          )}
        </div>

        {(stage === 'idle' || stage === 'error') && (
          <DialogFooter className="p-6 bg-gray-50 border-t border-gray-100">
            <Button variant="ghost" onClick={onClose} className="rounded-xl px-6">Cancel</Button>
            <Button 
              onClick={handleShare} 
              disabled={recipients.length === 0}
              className="bg-[#83002A] hover:bg-[#6a0022] text-white rounded-xl px-8 shadow-lg shadow-[#83002A]/20 transition-all group"
            >
              <Share2 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" /> 
              Send Invitations
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
