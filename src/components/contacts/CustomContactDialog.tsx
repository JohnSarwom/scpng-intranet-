import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus, UserCircle } from 'lucide-react';

interface CustomContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactSaved: (contact: any) => Promise<void>;
  editingContact?: any;
}

const CustomContactDialog: React.FC<CustomContactDialogProps> = ({ 
  open, 
  onOpenChange, 
  onContactSaved,
  editingContact 
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    jobTitle: '',
    department: '',
    mail: '',
    mobilePhone: '',
    companyName: '',
    officeLocation: '',
  });

  useEffect(() => {
    if (editingContact) {
      setFormData({
        displayName: editingContact.displayName || '',
        jobTitle: editingContact.jobTitle || '',
        department: editingContact.department || '',
        mail: editingContact.mail || '',
        mobilePhone: editingContact.mobilePhone || '',
        companyName: editingContact.companyName || '',
        officeLocation: editingContact.officeLocation || '',
      });
    } else {
      setFormData({
        displayName: '',
        jobTitle: '',
        department: '',
        mail: '',
        mobilePhone: '',
        companyName: '',
        officeLocation: '',
      });
    }
  }, [editingContact, open]);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.displayName) return;

    setIsSubmitting(true);
    try {
      await onContactSaved(formData);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving custom contact:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto dark:bg-gray-900 dark:border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 dark:text-gray-100">
            {editingContact ? <UserCircle className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            {editingContact ? 'Edit Custom Contact' : 'Add Custom Contact'}
          </DialogTitle>
          <DialogDescription className="dark:text-gray-400">
            {editingContact 
              ? 'Update the details for this custom contact.' 
              : 'Add a private contact to your personal directory.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="displayName" className="dark:text-gray-300">Full Name *</Label>
            <Input
              id="displayName"
              value={formData.displayName}
              onChange={(e) => updateField('displayName', e.target.value)}
              placeholder="e.g., John Doe"
              className="dark:bg-white/5 dark:border-white/10 dark:text-gray-100 dark:placeholder:text-gray-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="jobTitle" className="dark:text-gray-300">Job Title</Label>
              <Input
                id="jobTitle"
                value={formData.jobTitle}
                onChange={(e) => updateField('jobTitle', e.target.value)}
                placeholder="e.g., Consultant"
                className="dark:bg-white/5 dark:border-white/10 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department" className="dark:text-gray-300">Department</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => updateField('department', e.target.value)}
                placeholder="e.g., Sales"
                className="dark:bg-white/5 dark:border-white/10 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mail" className="dark:text-gray-300">Email Address</Label>
            <Input
              id="mail"
              type="email"
              value={formData.mail}
              onChange={(e) => updateField('mail', e.target.value)}
              placeholder="e.g., john.doe@external.com"
              className="dark:bg-white/5 dark:border-white/10 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobilePhone" className="dark:text-gray-300">Phone Number</Label>
            <Input
              id="mobilePhone"
              value={formData.mobilePhone}
              onChange={(e) => updateField('mobilePhone', e.target.value)}
              placeholder="e.g., +675 7000 0000"
              className="dark:bg-white/5 dark:border-white/10 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName" className="dark:text-gray-300">Company</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                placeholder="e.g., External Ltd"
                className="dark:bg-white/5 dark:border-white/10 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="officeLocation" className="dark:text-gray-300">Location</Label>
              <Input
                id="officeLocation"
                value={formData.officeLocation}
                onChange={(e) => updateField('officeLocation', e.target.value)}
                placeholder="e.g., Port Moresby"
                className="dark:bg-white/5 dark:border-white/10 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="dark:border-white/10 dark:hover:bg-white/5 dark:text-gray-300">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="dark:bg-intranet-primary dark:hover:bg-intranet-primary/80 dark:text-white">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  {editingContact ? 'Update Contact' : 'Add Contact'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomContactDialog;
