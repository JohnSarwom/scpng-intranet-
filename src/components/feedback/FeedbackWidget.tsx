import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquarePlus,
  X,
  Star,
  Send,
  CheckCircle2,
  Bug,
  Paintbrush,
  Lightbulb,
  MessageCircle,
  Gauge,
  Paperclip,
  XCircle,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSharePointUpload } from '@/hooks/useSharePointUpload';
import { FEEDBACK_CONFIG, FeedbackCategory } from '@/services/feedbackService';
import { cn } from '@/lib/utils';

const PAGE_NAME_MAP: Record<string, string> = {
  '/': 'Dashboard',
  '/news': 'News',
  '/market-data': 'Market Data',
  '/market-summary': 'Daily Market Summary',
  '/ai-hub': 'AI Hub',
  '/admin': 'Admin',
  '/settings': 'Settings',
  '/documents': 'Documents',
  '/contacts': 'Contacts',
  '/strategy': 'Strategy',
  '/hr-profiles': 'HR Profiles',
  '/unit': 'Task Registry',
  '/division': 'Division',
  '/calendar': 'Calendar',
  '/gallery': 'Gallery',
  '/tickets': 'Tickets',
  '/asset-management': 'Asset Management',
  '/licensing-registry': 'Licensing Registry',
  '/forms': 'Forms',
  '/payments': 'Payments',
  '/apps': 'Apps',
  '/regulatory-intelligence': 'Regulatory Intelligence',
};

type CategoryDef = {
  value: FeedbackCategory;
  label: string;
  icon: React.ReactNode;
  color: string;
  selectedColor: string;
};

const CATEGORIES: CategoryDef[] = [
  {
    value: 'Bug Report',
    label: 'Bug Report',
    icon: <Bug size={20} />,
    color: 'text-red-500',
    selectedColor: 'bg-red-50 border-red-400 text-red-700 dark:bg-red-900/30 dark:border-red-500/50 dark:text-red-300',
  },
  {
    value: 'UI/UX Issue',
    label: 'UI / UX Issue',
    icon: <Paintbrush size={20} />,
    color: 'text-purple-500',
    selectedColor:
      'bg-purple-50 border-purple-400 text-purple-700 dark:bg-purple-900/30 dark:border-purple-500/50 dark:text-purple-300',
  },
  {
    value: 'Feature Request',
    label: 'Feature Request',
    icon: <Lightbulb size={20} />,
    color: 'text-amber-500',
    selectedColor:
      'bg-amber-50 border-amber-400 text-amber-700 dark:bg-amber-900/30 dark:border-amber-500/50 dark:text-amber-300',
  },
  {
    value: 'General Comment',
    label: 'General',
    icon: <MessageCircle size={20} />,
    color: 'text-sky-500',
    selectedColor:
      'bg-sky-50 border-sky-400 text-sky-700 dark:bg-sky-900/30 dark:border-sky-500/50 dark:text-sky-300',
  },
  {
    value: 'Performance Issue',
    label: 'Performance',
    icon: <Gauge size={20} />,
    color: 'text-orange-500',
    selectedColor:
      'bg-orange-50 border-orange-400 text-orange-700 dark:bg-orange-900/30 dark:border-orange-500/50 dark:text-orange-300',
  },
];

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

const FeedbackWidget: React.FC = () => {
  const location = useLocation();
  const { accounts } = useMsal();
  const account = accounts[0];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, addSharePointListItem, isLoading } = useSharePointUpload();

  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const currentRoute = location.pathname;
  const pageName =
    PAGE_NAME_MAP[currentRoute] ??
    PAGE_NAME_MAP[
    Object.keys(PAGE_NAME_MAP).find(k => k !== '/' && currentRoute.startsWith(k)) ?? ''
    ] ??
    'This Page';

  const reset = () => {
    setCategory(null);
    setComment('');
    setRating(0);
    setHoveredRating(0);
    setSelectedFile(null);
    setSubmitted(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(reset, 300);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    e.target.value = ''; // reset so same file can be re-selected
  };

  const handleSubmit = async () => {
    if (!category || !comment.trim() || rating === 0) return;

    let attachmentUrl = '';

    // Upload attachment first if provided
    if (selectedFile) {
      const timestamp = Date.now();
      const uniqueName = `${timestamp}_${selectedFile.name}`;
      const fileToUpload = new File([selectedFile], uniqueName, { type: selectedFile.type });

      const url = await uploadFile(
        fileToUpload,
        FEEDBACK_CONFIG.SITE_PATH,
        FEEDBACK_CONFIG.LIBRARY_NAME,
        FEEDBACK_CONFIG.UPLOAD_FOLDER
      );
      attachmentUrl = url ?? '';
    }

    // Submit list item
    const result = await addSharePointListItem(
      FEEDBACK_CONFIG.SITE_PATH,
      FEEDBACK_CONFIG.LIST_NAME,
      {
        Title: pageName,
        PageRoute: currentRoute,
        UserName: account?.name ?? 'Unknown',
        UserEmail: account?.username ?? '',
        Rating: rating,
        Category: category,
        Comment: comment.trim(),
        Status: 'New',
        AttachmentUrl: attachmentUrl,
      }
    );

    if (result) {
      setSubmitted(true);
      setTimeout(handleClose, 2800);
    }
  };

  const isValid = !!category && comment.trim().length > 0 && rating > 0;

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col items-end gap-3">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-[390px] rounded-2xl shadow-2xl border border-border dark:border-white/10 bg-card dark:bg-gray-900 text-card-foreground dark:text-gray-100 flex flex-col overflow-hidden"
            style={{ maxHeight: 'calc(100vh - 110px)' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-intranet-primary to-intranet-secondary px-4 py-3 flex items-start justify-between shrink-0">
              <div>
                <p className="text-white font-semibold text-sm">Share Your Feedback</p>
                <p className="text-white/70 text-xs mt-0.5">
                  {pageName}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/15 rounded-full shrink-0"
              >
                <X size={15} />
              </Button>
            </div>

            {/* Body (scrollable) */}
            <div className="overflow-y-auto flex-1 p-4">
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-10 gap-3"
                >
                  <CheckCircle2 size={48} className="text-intranet-success" />
                  <p className="font-semibold text-base">Thank you!</p>
                  <p className="text-muted-foreground text-sm text-center max-w-[260px]">
                    Your feedback has been recorded and will help us improve the app.
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-5">

                  {/* Q1 — Category */}
                  <div>
                    <p className="text-sm font-semibold mb-2">
                      What type of feedback is this?
                      <span className="text-destructive ml-0.5">*</span>
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setCategory(cat.value)}
                          className={cn(
                            'flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-xs font-medium transition-all focus:outline-none hover:shadow-sm',
                            category === cat.value
                              ? cat.selectedColor
                              : 'border-border dark:border-white/10 text-muted-foreground dark:text-gray-400 hover:border-muted-foreground/40 dark:hover:bg-white/5'
                          )}
                        >
                          <span className={cn('transition-colors', category === cat.value ? '' : cat.color)}>
                            {cat.icon}
                          </span>
                          <span className="leading-tight text-center">{cat.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Q2 — Comment */}
                  <div>
                    <p className="text-sm font-semibold mb-2">
                      Describe your experience
                      <span className="text-destructive ml-0.5">*</span>
                    </p>
                    <Textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="What did you notice? What could be improved?"
                      className="resize-none text-sm min-h-[80px] dark:bg-white/5 dark:border-white/10 dark:text-gray-100 dark:placeholder:text-gray-500"
                      maxLength={2000}
                    />
                    <p className="text-right text-xs text-muted-foreground mt-1">
                      {comment.length}/2000
                    </p>
                  </div>

                  {/* Q3 — Attachment */}
                  <div>
                    <p className="text-sm font-semibold mb-2">
                      Attach a screenshot{' '}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    {selectedFile ? (
                      <div className="flex items-center gap-2 bg-muted/50 dark:bg-white/5 border dark:border-white/10 rounded-lg px-3 py-2">
                        <Paperclip size={14} className="text-muted-foreground dark:text-gray-400 shrink-0" />
                        <span className="text-xs text-muted-foreground flex-1 truncate">
                          {selectedFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <XCircle size={15} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center gap-2 border-2 border-dashed border-border dark:border-white/10 rounded-lg px-3 py-3 text-sm text-muted-foreground dark:text-gray-400 hover:border-intranet-primary/50 hover:text-intranet-primary dark:hover:bg-white/5 transition-colors"
                      >
                        <Paperclip size={16} />
                        Click to attach a file or screenshot
                      </button>
                    )}
                  </div>

                  {/* Q4 — Star rating (bottom) */}
                  <div>
                    <p className="text-sm font-semibold mb-2">
                      How would you rate this page?
                      <span className="text-destructive ml-0.5">*</span>
                    </p>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoveredRating(star)}
                          onMouseLeave={() => setHoveredRating(0)}
                          className="transition-transform hover:scale-110 focus:outline-none"
                        >
                          <Star
                            size={28}
                            className={cn(
                              'transition-colors',
                              star <= (hoveredRating || rating)
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-muted-foreground/25 dark:text-gray-700'
                            )}
                          />
                        </button>
                      ))}
                      {rating > 0 && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {STAR_LABELS[rating]}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Submit */}
                  <Button
                    onClick={handleSubmit}
                    disabled={!isValid || isLoading}
                    className="w-full bg-intranet-primary hover:bg-intranet-secondary text-white gap-2 h-10"
                  >
                    {isLoading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
                          className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full"
                        />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send size={15} />
                        Submit Feedback
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => (isOpen ? handleClose() : setIsOpen(true))}
        className={cn(
          'flex items-center gap-2 rounded-full shadow-lg px-4 py-3 text-white text-sm font-medium transition-colors',
          isOpen
            ? 'bg-intranet-secondary'
            : 'bg-intranet-primary hover:bg-intranet-secondary'
        )}
        title="Give Feedback"
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X size={18} />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageSquarePlus size={18} />
            </motion.span>
          )}
        </AnimatePresence>
        {!isOpen && <span>Feedback</span>}
      </motion.button>
    </div>
  );
};

export default FeedbackWidget;
