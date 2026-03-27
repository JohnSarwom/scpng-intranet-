import React, { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  itemPreview?: ReactNode;
  onDelete: () => void;
}

const DeleteModal: React.FC<DeleteModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  itemPreview,
  onDelete
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden gap-0 dark:bg-gray-900/95 dark:backdrop-blur-2xl dark:border-white/10 shadow-2xl border-none">
        <DialogHeader className="px-6 py-6 border-b border-gray-100 dark:border-white/5 bg-destructive/5 dark:bg-red-950/20 backdrop-blur-md transition-colors">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-destructive dark:text-red-400 tracking-tight">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
            {title}
          </DialogTitle>
          <DialogDescription className="pt-2 text-gray-600 dark:text-gray-400 font-medium">
            {description}
          </DialogDescription>
        </DialogHeader>

        {itemPreview && (
          <div className="p-6 bg-white/50 dark:bg-black/20 backdrop-blur-sm overflow-y-auto custom-scrollbar">
            <div className="border border-gray-100 dark:border-white/10 rounded-xl p-4 bg-white/50 dark:bg-white/5 shadow-inner text-sm font-medium dark:text-gray-200">
              {itemPreview}
            </div>
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-gray-800/40 backdrop-blur-md flex sm:justify-end gap-2 transition-colors">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 transition-colors">Cancel</Button>
          <Button
            variant="destructive"
            className="dark:bg-red-600 dark:hover:bg-red-700 shadow-lg shadow-red-500/20 px-6 font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            onClick={() => {
              onDelete();
              onOpenChange(false);
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteModal; 