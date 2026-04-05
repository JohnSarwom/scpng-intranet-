import React, { useState, useRef } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { FormLayoutWrapper } from '@/components/forms/FormLayoutWrapper';
import { websiteFeedbackTemplate } from '@/config/formTemplates';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import useMicrosoftContacts from '@/hooks/useMicrosoftContacts';
import { useSharePointUpload } from '@/hooks/useSharePointUpload';
import { toast } from 'sonner';
import { Upload, X, Image, CheckCircle2 } from 'lucide-react';

const SITE_PATH = '/sites/scpngintranet';
const SUBMISSION_LIST = 'Website_Feedback';
const SCREENSHOT_LIBRARY = 'Website_Feedback_Screenshots';

const WebsiteFeedbackPage: React.FC = () => {
  const { user } = useSupabaseAuth();
  const { contacts } = useMicrosoftContacts();
  const { uploadFile, addSharePointListItem, isLoading: isUploading } = useSharePointUpload();

  const [pendingScreenshots, setPendingScreenshots] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm({ defaultValues: {} });

  const currentUser = contacts.find(
    (c) => c.mail?.toLowerCase() === user?.email?.toLowerCase()
  );

  // Pre-fill user info once contacts are loaded
  React.useEffect(() => {
    if (currentUser) {
      form.setValue('submitterName', currentUser.displayName || '');
      form.setValue('submitterEmail', currentUser.mail || '');
      form.setValue('department', currentUser.department || '');
    }
  }, [currentUser, form]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length < files.length) {
      toast.warning('Only image files are accepted as screenshots.');
    }
    setPendingScreenshots((prev) => [...prev, ...images]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    );
    setPendingScreenshots((prev) => [...prev, ...files]);
  };

  const removeScreenshot = (index: number) => {
    setPendingScreenshots((prev) => prev.filter((_, i) => i !== index));
  };

  const sanitize = (name: string) =>
    name.replace(/[#%*:<>?/\\|"]/g, '').replace(/\s+/g, ' ').trim() || 'screenshot';

  const handleFormSubmit = async (data: Record<string, any>) => {
    setIsSubmitting(true);
    try {
      // 1. Upload screenshots
      const submitterLabel = sanitize(data.submitterName || user?.email || 'anonymous');
      const folderPath = `${submitterLabel}-${Date.now()}`;

      const uploadedScreenshots: { name: string; url: string; size: number }[] = [];
      for (const file of pendingScreenshots) {
        const url = await uploadFile(file, SITE_PATH, SCREENSHOT_LIBRARY, folderPath);
        if (url) {
          uploadedScreenshots.push({ name: file.name, url, size: file.size });
        }
      }

      // 2. Build payload
      const payload: Record<string, any> = {
        Title: `Website Feedback — ${data.submitterName || user?.email || 'Anonymous'}`,
        SubmitterName: data.submitterName || '',
        SubmitterEmail: data.submitterEmail || '',
        Department: data.department || '',
        Rating: parseInt(data.rating || '0', 10),
        FeedbackCategory: data.feedbackCategory || '',
        OverallExperience: data.overallExperience || '',
        WhatWorksWell: data.whatWorksWell || '',
        WhatNeedsImprovement: data.whatNeedsImprovement || '',
        ScreenshotsJSON: uploadedScreenshots.length
          ? JSON.stringify(uploadedScreenshots)
          : '',
        SubmissionDate: new Date().toISOString(),
        Status: 'New',
      };

      // 3. Submit to SharePoint list
      const result = await addSharePointListItem(SITE_PATH, SUBMISSION_LIST, payload);
      if (result) {
        toast.success('Feedback submitted successfully. Thank you!');
        setIsSubmitted(true);
        form.reset();
        setPendingScreenshots([]);
        localStorage.removeItem(`form_draft_${websiteFeedbackTemplate.id}`);
      } else {
        toast.error('Submission failed. Please try again.');
      }
    } catch (err) {
      console.error('WebsiteFeedbackPage submit error:', err);
      toast.error('An error occurred while submitting your feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSave = async (data: Record<string, any>) => {
    localStorage.setItem(
      `form_draft_${websiteFeedbackTemplate.id}`,
      JSON.stringify(data)
    );
  };

  // Load draft on mount
  React.useEffect(() => {
    const saved = localStorage.getItem(`form_draft_${websiteFeedbackTemplate.id}`);
    if (saved) {
      try {
        form.reset(JSON.parse(saved));
        toast.info('Loaded your previously saved draft.');
      } catch (_) {}
    }
  }, [form]);

  const screenshotUploadSection = (
    <Card className="mt-4 dark:bg-gray-800 dark:border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-base dark:text-gray-100">
          Screenshots <span className="text-muted-foreground text-sm font-normal">(optional)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors dark:border-white/20"
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Drag &amp; drop screenshots here, or <span className="text-primary underline">click to browse</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF, WebP accepted</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Staged files */}
        {pendingScreenshots.length > 0 && (
          <ul className="space-y-2">
            {pendingScreenshots.map((file, i) => (
              <li
                key={i}
                className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-md px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2 truncate">
                  <Image className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="truncate text-blue-700 dark:text-blue-300">{file.name}</span>
                  <span className="text-muted-foreground shrink-0">
                    ({(file.size / 1024).toFixed(0)} KB)
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeScreenshot(i)}
                  className="ml-2 text-muted-foreground hover:text-destructive shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h2 className="text-2xl font-bold dark:text-gray-100">Thank you for your feedback!</h2>
        <p className="text-muted-foreground max-w-md">
          Your feedback on the new website upgrade has been recorded. The IT team will review it shortly.
        </p>
        <Button variant="outline" onClick={() => setIsSubmitted(false)}>
          Submit Another Response
        </Button>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <FormLayoutWrapper
        title="New Website Upgrade — Feedback"
        template={websiteFeedbackTemplate}
        digitalContent={
          <div>
            <FormRenderer
              template={websiteFeedbackTemplate}
              mode="fill"
              onSubmit={handleFormSubmit}
              onSave={handleFormSave}
              onCancel={() => window.history.back()}
              disabled={isSubmitting || isUploading}
            />
            {screenshotUploadSection}
          </div>
        }
        paperContent={
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Paper view not applicable for this feedback form.
            </CardContent>
          </Card>
        }
        trackingContent={
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Feedback tracking coming soon.
            </CardContent>
          </Card>
        }
      />
    </FormProvider>
  );
};

export default WebsiteFeedbackPage;
