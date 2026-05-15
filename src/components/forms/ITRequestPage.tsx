import React, { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { FormLayoutWrapper } from '@/components/forms/FormLayoutWrapper';
import { ITRequestPaper } from '@/components/forms/ITRequestPaper';
import { itRequestTemplate } from '@/config/formTemplates';
import { FormSubmission } from '@/types/forms';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import useMicrosoftContacts from '@/hooks/useMicrosoftContacts';
import { useSharePointUpload } from '@/hooks/useSharePointUpload';
import { toast } from 'sonner';

const ITRequestPage: React.FC = () => {
  const { user } = useSupabaseAuth();
  const { contacts } = useMicrosoftContacts();
  const { addSharePointListItem, isLoading: isSubmitting } = useSharePointUpload();

  const form = useForm({
    defaultValues: {},
  });

  const currentUserContact = contacts.find(
    (contact) => contact.mail?.toLowerCase() === user?.email?.toLowerCase()
  );

  const handleFormSubmit = async (data: Record<string, any>) => {
    if (!currentUserContact) {
      throw new Error('Could not find your contact information. Please try again.');
    }

    const userData = {
      Title: `IT Request from ${currentUserContact.displayName}`,
      Name: currentUserContact.displayName || '',
      Email: currentUserContact.mail || '',
      Job_x0020_Title: currentUserContact.jobTitle || '',
      Department: currentUserContact.department || '',
    };

    const submissionData = { ...userData };
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        // Format arrays (checkbox groups) as comma-separated strings
        submissionData[key] = Array.isArray(data[key])
          ? data[key].join(', ')
          : String(data[key]);
      }
    }

    try {
      const result = await addSharePointListItem(
        '/sites/scpngintranet',
        'IT_Request_Access_List',
        submissionData
      );

      if (result) {
        setIsSuccessfullySubmitted(true);
        localStorage.removeItem(`form_draft_${itRequestTemplate.id}`);
      } else {
        throw new Error('Failed to submit IT Request. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting to SharePoint:', error);
      throw error instanceof Error
        ? error
        : new Error('An error occurred while submitting the form.');
    }
  };

  const handleFormSave = async (data: Record<string, any>) => {
    try {
      localStorage.setItem(`form_draft_${itRequestTemplate.id}`, JSON.stringify(data));
      console.log('Form saved as draft to localStorage:', data);
    } catch (error) {
      console.error('Failed to save draft to localStorage:', error);
    }
  };

  // Load draft from localStorage on mount
  React.useEffect(() => {
    const savedDraft = localStorage.getItem(`form_draft_${itRequestTemplate.id}`);
    if (savedDraft) {
      try {
        const parsedDraft = JSON.parse(savedDraft);
        form.reset(parsedDraft);
        toast.info('Loaded your previously saved draft.');
      } catch (error) {
        console.error('Failed to parse saved draft:', error);
      }
    }
  }, [form]);

  const [isSuccessfullySubmitted, setIsSuccessfullySubmitted] = useState(false);

  const mockSubmission: FormSubmission = React.useMemo(() => ({
    id: `sub_${itRequestTemplate.id}_${Date.now()}`,
    formTemplateId: itRequestTemplate.id,
    status: isSuccessfullySubmitted ? 'submitted' : 'draft',
    data: form.getValues(),
    submittedBy: user?.email || 'unknown',
    submittedAt: isSuccessfullySubmitted ? new Date().toISOString() : undefined as any,
    history: [],
  }), [form, isSuccessfullySubmitted, user]);

  return (
    <FormProvider {...form}>
      <FormLayoutWrapper
        title="IT Request"
        template={itRequestTemplate}
        digitalContent={
          <FormRenderer
            template={itRequestTemplate}
            mode="fill"
            onSubmit={handleFormSubmit}
            onSave={handleFormSave}
            onCancel={() => window.history.back()}
          />
        }
        paperContent={
          <ITRequestPaper submission={mockSubmission} />
        }
        trackingContent={
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Feature coming soon. Track your IT requests directly right here.
            </CardContent>
          </Card>
        }
      />
    </FormProvider>
  );
};
export default ITRequestPage;
