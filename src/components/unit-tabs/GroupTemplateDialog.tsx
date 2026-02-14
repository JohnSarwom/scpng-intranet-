import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface GroupTemplateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreateFromTemplate: (template: string) => void;
}

export const GroupTemplateDialog = ({ open, onOpenChange, onCreateFromTemplate }: GroupTemplateDialogProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Task Groups</DialogTitle>
                    <DialogDescription>
                        Choose a template to get started, or create groups manually.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <Button
                        className="w-full justify-start"
                        variant="outline"
                        onClick={() => {
                            onCreateFromTemplate('kanban');
                            onOpenChange(false);
                        }}
                    >
                        <div className="text-left">
                            <div className="font-semibold">Kanban</div>
                            <div className="text-xs text-muted-foreground">TO DO, IN PROGRESS, REVIEW, DONE</div>
                        </div>
                    </Button>

                    <Button
                        className="w-full justify-start"
                        variant="outline"
                        onClick={() => {
                            onCreateFromTemplate('simple');
                            onOpenChange(false);
                        }}
                    >
                        <div className="text-left">
                            <div className="font-semibold">Simple</div>
                            <div className="text-xs text-muted-foreground">TODO, DONE</div>
                        </div>
                    </Button>

                    <Button
                        className="w-full justify-start"
                        variant="outline"
                        onClick={() => {
                            onCreateFromTemplate('agile');
                            onOpenChange(false);
                        }}
                    >
                        <div className="text-left">
                            <div className="font-semibold">Agile Sprint</div>
                            <div className="text-xs text-muted-foreground">BACKLOG, SPRINT, IN PROGRESS, REVIEW, DONE</div>
                        </div>
                    </Button>

                    <Button
                        className="w-full"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                    >
                        I'll create my own groups
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
