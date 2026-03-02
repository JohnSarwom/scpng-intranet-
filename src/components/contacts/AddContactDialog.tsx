import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useMsal } from '@azure/msal-react';
import { Loader2, UserPlus } from 'lucide-react';

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactAdded: () => void;
}

const DIVISIONS = [
  'Executive Division',
  'Corporate Services Division',
  'Licensing Market & Supervision Division',
  'Legal Services Division',
  'Research & Publication Division',
];

const DEPARTMENTS = [
  'Secretariat Unit',
  'Finance Unit',
  'IT Unit',
  'HR Unit',
  'Market Data Unit',
  'Legal Unit',
  'Research Unit',
  'Licensing Unit',
  'Supervision Unit',
  'Administration Unit',
  'Communications Unit',
];

const AddContactDialog: React.FC<AddContactDialogProps> = ({ open, onOpenChange, onContactAdded }) => {
  const { instance } = useMsal();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    givenName: '',
    surname: '',
    displayName: '',
    jobTitle: '',
    department: '',
    officeLocation: '',
    mail: '',
    mailNickname: '',
    businessPhone: '',
    mobilePhone: '',
    companyName: 'SCPNG',
    password: '',
  });

  const updateField = (field: string, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-generate displayName from first + last name
      if (field === 'givenName' || field === 'surname') {
        const first = field === 'givenName' ? value : prev.givenName;
        const last = field === 'surname' ? value : prev.surname;
        updated.displayName = `${first} ${last}`.trim();
      }
      // Auto-generate mailNickname from email
      if (field === 'mail') {
        updated.mailNickname = value.split('@')[0] || '';
      }
      return updated;
    });
  };

  const resetForm = () => {
    setFormData({
      givenName: '',
      surname: '',
      displayName: '',
      jobTitle: '',
      department: '',
      officeLocation: '',
      mail: '',
      mailNickname: '',
      businessPhone: '',
      mobilePhone: '',
      companyName: 'SCPNG',
      password: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.givenName || !formData.surname || !formData.mail || !formData.password) {
      toast({
        title: 'Missing Required Fields',
        description: 'Please fill in first name, last name, email, and password.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Acquire token with write permissions
      const response = await instance.acquireTokenSilent({
        scopes: ['User.ReadWrite.All', 'Directory.ReadWrite.All'],
      });

      // Build payload with only valid Graph API properties (mail is read-only, derived from UPN)
      const userPayload: Record<string, any> = {
        accountEnabled: true,
        displayName: formData.displayName,
        givenName: formData.givenName,
        surname: formData.surname,
        mailNickname: formData.mailNickname || formData.mail.split('@')[0],
        userPrincipalName: formData.mail,
        businessPhones: formData.businessPhone ? [formData.businessPhone] : [],
        passwordProfile: {
          forceChangePasswordNextSignIn: true,
          password: formData.password,
        },
      };

      // Only include optional fields if they have values
      if (formData.jobTitle) userPayload.jobTitle = formData.jobTitle;
      if (formData.department) userPayload.department = formData.department;
      if (formData.officeLocation) userPayload.officeLocation = formData.officeLocation;
      if (formData.mobilePhone) userPayload.mobilePhone = formData.mobilePhone;
      if (formData.companyName) userPayload.companyName = formData.companyName;

      const result = await fetch('https://graph.microsoft.com/v1.0/users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${response.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userPayload),
      });

      if (!result.ok) {
        const errorData = await result.json().catch(() => null);
        const errorMessage = errorData?.error?.message || result.statusText;
        throw new Error(errorMessage);
      }

      toast({
        title: 'Contact Added',
        description: `${formData.displayName} has been added to the organization directory.`,
      });

      resetForm();
      onOpenChange(false);
      onContactAdded();
    } catch (error) {
      console.error('Error creating contact:', error);
      toast({
        title: 'Failed to Add Contact',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add New Contact
          </DialogTitle>
          <DialogDescription>
            Add a new member to the SCPNG organization directory.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Name Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="givenName">First Name *</Label>
              <Input
                id="givenName"
                value={formData.givenName}
                onChange={(e) => updateField('givenName', e.target.value)}
                placeholder="e.g., John"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surname">Last Name *</Label>
              <Input
                id="surname"
                value={formData.surname}
                onChange={(e) => updateField('surname', e.target.value)}
                placeholder="e.g., Doe"
                required
              />
            </div>
          </div>

          {/* Display Name (auto-generated but editable) */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={formData.displayName}
              onChange={(e) => updateField('displayName', e.target.value)}
              placeholder="Auto-generated from first and last name"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="mail">Email Address *</Label>
            <Input
              id="mail"
              type="email"
              value={formData.mail}
              onChange={(e) => updateField('mail', e.target.value)}
              placeholder="e.g., jdoe@scpng.gov.pg"
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Temporary Password *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => updateField('password', e.target.value)}
              placeholder="Minimum 8 characters"
              required
              minLength={8}
            />
            <p className="text-xs text-muted-foreground">User will be prompted to change this on first sign-in.</p>
          </div>

          {/* Job Title */}
          <div className="space-y-2">
            <Label htmlFor="jobTitle">Job Title</Label>
            <Input
              id="jobTitle"
              value={formData.jobTitle}
              onChange={(e) => updateField('jobTitle', e.target.value)}
              placeholder="e.g., Finance Officer"
            />
          </div>

          {/* Division & Department */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Division</Label>
              <Select value={formData.officeLocation} onValueChange={(val) => updateField('officeLocation', val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select division" />
                </SelectTrigger>
                <SelectContent>
                  {DIVISIONS.map((div) => (
                    <SelectItem key={div} value={div}>{div}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unit / Department</Label>
              <Select value={formData.department} onValueChange={(val) => updateField('department', val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Phone Numbers */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="businessPhone">Business Phone</Label>
              <Input
                id="businessPhone"
                value={formData.businessPhone}
                onChange={(e) => updateField('businessPhone', e.target.value)}
                placeholder="e.g., +675 321 2223"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobilePhone">Mobile Phone</Label>
              <Input
                id="mobilePhone"
                value={formData.mobilePhone}
                onChange={(e) => updateField('mobilePhone', e.target.value)}
                placeholder="e.g., +675 7000 0000"
              />
            </div>
          </div>

          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName">Company</Label>
            <Input
              id="companyName"
              value={formData.companyName}
              onChange={(e) => updateField('companyName', e.target.value)}
              placeholder="e.g., SCPNG"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Contact
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddContactDialog;
