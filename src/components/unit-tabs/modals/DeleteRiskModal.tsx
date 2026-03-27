import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Risk } from '@/types';
import { AlertTriangle } from 'lucide-react';

interface DeleteRiskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  risk: Risk | null;
  onDelete: (id: string) => void;
}

const DeleteRiskModal: React.FC<DeleteRiskModalProps> = ({
  open,
  onOpenChange,
  risk,
  onDelete
}) => {
  
  const handleDelete = () => {
    if (!risk) return;
    
    onDelete(risk.id);
    
    toast({
      title: "Success",
      description: "Risk deleted successfully",
    });
    
    onOpenChange(false);
  };

  if (!risk) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden gap-0 dark:bg-gray-900 dark:border-white/10 shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b border-border/50 bg-destructive/5 dark:bg-red-950/20 dark:border-red-900/10 transition-colors">
          <div className="flex items-center gap-2 text-destructive dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle className="text-xl font-semibold">Delete Risk</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-muted-foreground/80 dark:text-gray-400">
            Are you sure you want to delete this risk? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-muted p-3 rounded-md">
            <p className="font-medium">{risk.title}</p>
            {risk.description && (
              <p className="text-sm text-muted-foreground mt-1">{risk.description}</p>
            )}
          </div>
        </div>
        
        <DialogFooter className="px-6 py-4 border-t border-border/50 bg-muted/30 dark:bg-gray-800/50 dark:border-white/10 flex sm:justify-end gap-2 transition-colors">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-white/10 dark:text-gray-300">Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} className="dark:bg-red-600 dark:hover:bg-red-700 shadow-lg shadow-red-500/20">Delete Risk</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteRiskModal; 