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
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border/50 bg-destructive/5">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2 text-destructive">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
            {title}
          </DialogTitle>
          <DialogDescription className="pt-2 text-muted-foreground/80">
            {description}
          </DialogDescription>
        </DialogHeader>

        {itemPreview && (
          <div className="p-6 overflow-y-auto custom-scrollbar">
            <div className="border border-destructive/20 rounded-lg p-4 bg-background shadow-sm text-sm">
              {itemPreview}
            </div>
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t border-border/50 bg-muted/30 flex sm:justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
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