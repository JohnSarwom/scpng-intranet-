import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FormTemplate, FormSubmission, FormField as FormFieldType, FormSection } from '@/types/forms';
import { FormField } from './FormField';
import { Clock, Save, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  getDateRangePairs,
  isBeforeDateValue,
} from './formDateRangeUtils';

interface FormRendererProps {
  template: FormTemplate;
  initialData?: Record<string, any>;
  submission?: FormSubmission;
  mode: 'fill' | 'review' | 'readonly';
  onSubmit?: (data: Record<string, any>) => Promise<void>;
  onSave?: (data: Record<string, any>) => Promise<void>;
  onCancel?: () => void;
  className?: string;
  showProgress?: boolean;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  resetOnSuccess?: boolean;
}

export const FormRenderer: React.FC<FormRendererProps> = ({
  template,
  initialData = {},
  submission,
  mode = 'fill',
  onSubmit,
  onSave,
  onCancel,
  className,
  showProgress = true,
  showSuccessToast = false,
  showErrorToast = false,
  resetOnSuccess = true
}) => {
  const { toast } = useToast();
  const [currentSection, setCurrentSection] = useState(0);
  const [visibleSections, setVisibleSections] = useState<FormSection[]>(template.sections);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const {
    handleSubmit,
    watch,
    trigger,
    formState: { errors, isDirty },
    getValues,
    reset,
    setValue,
    clearErrors
  } = useFormContext();

  // Watch form data for auto-save functionality
  const watchedData = watch();
  const allVisibleFields = useMemo(
    () => visibleSections.flatMap(section => section.fields),
    [visibleSections],
  );
  const dateRangePairs = useMemo(
    () => getDateRangePairs(allVisibleFields),
    [allVisibleFields],
  );

  useEffect(() => {
    dateRangePairs.forEach(({ start, end }) => {
      const startValue = watchedData[start];
      const endValue = watchedData[end];
      if (!startValue) return;

      if (!endValue || isBeforeDateValue(endValue, startValue)) {
        setValue(end, startValue, {
          shouldDirty: true,
          shouldTouch: Boolean(endValue),
          shouldValidate: true,
        });
        clearErrors(end);
      }
    });
  }, [dateRangePairs, watchedData, setValue, clearErrors]);

  useEffect(() => {
    const requestAccessType = watchedData['requestAccessType'];
    if (requestAccessType) {
      const baseSections = template.sections.filter(s => s.id === 'request_info' || s.id === 'request_details');
      if (requestAccessType === 'equipment') {
        const equipmentSection = template.sections.find(s => s.id === 'equipment_request');
        if (equipmentSection) {
          setVisibleSections([baseSections[0], equipmentSection, baseSections[1]]);
        }
      } else if (requestAccessType === 'access') {
        const accessSection = template.sections.find(s => s.id === 'access_request');
        if (accessSection) {
          setVisibleSections([baseSections[0], accessSection, baseSections[1]]);
        }
      } else if (requestAccessType === 'other') {
        // 'Other' - skip both equipment and access sections entirely
        setVisibleSections([baseSections[0], baseSections[1]]);
      } else {
        setVisibleSections(template.sections);
      }
      // Reset to first section when logic changes the visible sections
      setCurrentSection(0);
    } else {
      setVisibleSections(template.sections);
    }
  }, [watchedData['requestAccessType'], template.sections]);

  // Check if field should be shown based on conditional logic
  const shouldShowField = useCallback((field: FormFieldType): boolean => {
    if (!field.showWhen) return true;

    const { field: dependentField, operator, value } = field.showWhen;
    const dependentValue = watchedData[dependentField];

    switch (operator) {
      case 'equals':
        return dependentValue === value;
      case 'notEquals':
        return dependentValue !== value;
      case 'contains':
        return Array.isArray(dependentValue)
          ? dependentValue.includes(value)
          : String(dependentValue || '').includes(value);
      case 'isEmpty':
        return !dependentValue || dependentValue === '';
      case 'isNotEmpty':
        return dependentValue && dependentValue !== '';
      default:
        return true;
    }
  }, [watchedData]);

  // Calculate form completion percentage
  const calculateProgress = useCallback(() => {
    if (!visibleSections) return 0;

    const allFields = visibleSections.flatMap(section => section.fields);
    // Filter by both required AND currently visible
    const relevantRequiredFields = allFields.filter(field => field.required && shouldShowField(field));

    if (relevantRequiredFields.length === 0) return 100;

    const filledRequiredFields = relevantRequiredFields.filter(field => {
      const value = watchedData[field.name];
      return value !== undefined && value !== null && value !== '';
    });

    return Math.round((filledRequiredFields.length / relevantRequiredFields.length) * 100);
  }, [visibleSections, watchedData, shouldShowField]);

  const progress = calculateProgress();

  // Auto-save functionality
  useEffect(() => {
    if (mode !== 'fill' || !onSave || !isDirty) return;

    const timer = setTimeout(async () => {
      if (isDirty && !isSaving && !isSubmitting) {
        setIsSaving(true);
        try {
          await onSave(getValues());
          toast({
            title: "Draft saved",
            description: "Your form has been automatically saved.",
            duration: 2000
          });
        } catch (error) {
          console.error('Auto-save failed:', error);
        } finally {
          setIsSaving(false);
        }
      }
    }, 3000); // Auto-save after 3 seconds of inactivity

    return () => clearTimeout(timer);
  }, [watchedData, isDirty, isSaving, isSubmitting, onSave, getValues, toast, mode]);

  // Handle form submission
  const onSubmitForm = async (data: Record<string, any>) => {
    if (!onSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setHasSubmitted(false);

    try {
      await onSubmit(data);
      if (showSuccessToast) {
        toast({
          title: "Form submitted successfully",
          description: "Your form has been submitted for review.",
          duration: 5000
        });
      }
      if (resetOnSuccess) {
        reset();
      }
      setHasSubmitted(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit form';
      setSubmitError(errorMessage);
      if (showErrorToast) {
        toast({
          title: "Submission failed",
          description: errorMessage,
          variant: "destructive",
          duration: 5000
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle manual save
  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    try {
      await onSave(getValues());
      toast({
        title: "Draft saved",
        description: "Your form has been saved as a draft.",
        duration: 3000
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save form';
      toast({
        title: "Save failed",
        description: errorMessage,
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Validate current section
  const validateSection = async (sectionIndex: number) => {
    const section = visibleSections[sectionIndex];
    if (!section) return true;

    const fieldNames = section.fields.map(field => field.name);
    const isValid = await trigger(fieldNames);
    return isValid;
  };

  // Navigate to next section
  const nextSection = async () => {
    const isCurrentSectionValid = await validateSection(currentSection);
    if (isCurrentSectionValid && currentSection < visibleSections.length - 1) {
      setCurrentSection(currentSection + 1);
    }
  };

  // Navigate to previous section
  const prevSection = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };



  // Get status badge for readonly mode
  const getStatusBadge = () => {
    if (!submission) return null;

    const statusConfig: Record<string, { variant: 'secondary' | 'default' | 'destructive' | 'outline', label: string, className?: string }> = {
      draft: { variant: 'secondary' as const, label: 'Draft' },
      submitted: { variant: 'default' as const, label: 'Submitted' },
      under_review: { variant: 'default' as const, label: 'Under Review' },
      approved: { variant: 'default' as const, label: 'Approved', className: 'bg-green-100 text-green-800' },
      rejected: { variant: 'destructive' as const, label: 'Rejected' },
      withdrawn: { variant: 'outline' as const, label: 'Withdrawn' }
    };

    const config = statusConfig[submission.status];
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const currentSectionData = visibleSections[currentSection];
  const isFirstSection = currentSection === 0;
  const isLastSection = currentSection === visibleSections.length - 1;
  const canProceed = mode === 'fill' && !isSubmitting;
  const hasVisibleErrors = Object.keys(errors).length > 0;
  const currentSectionFields = currentSectionData.fields.filter(shouldShowField);
  const getFieldErrorMessage = (fieldName: string) => {
    const fieldError = errors[fieldName] as { message?: unknown } | undefined;
    return typeof fieldError?.message === 'string' ? fieldError.message : null;
  };
  const getFieldErrorType = (fieldName: string) => {
    const fieldError = errors[fieldName] as { type?: unknown } | undefined;
    return typeof fieldError?.type === 'string' ? fieldError.type : null;
  };
  const currentRangePairs = getDateRangePairs(currentSectionFields);
  const rangeAlertByEndName = new Map<string, string>();
  const suppressedRangeErrorFields = new Set<string>();

  currentRangePairs.forEach(({ start, end }) => {
    const startMessage = getFieldErrorMessage(start);
    const endMessage = getFieldErrorMessage(end);
    const isSharedRangeError = Boolean(
      startMessage &&
      endMessage &&
      startMessage === endMessage &&
      (getFieldErrorType(start) === 'overlap' ||
        getFieldErrorType(end) === 'overlap' ||
        startMessage.length > 80),
    );

    if (isSharedRangeError && endMessage) {
      rangeAlertByEndName.set(end, endMessage);
      suppressedRangeErrorFields.add(start);
      suppressedRangeErrorFields.add(end);
    }
  });

  if (hasSubmitted && mode === 'fill') {
    return (
      <div className={cn("max-w-4xl mx-auto", className)}>
        <Card className="dark:bg-gray-800 dark:border-white/10">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
            <CheckCircle2 className="h-14 w-14 text-green-600" />
            <div>
              <h2 className="text-2xl font-semibold dark:text-gray-100">Form submitted</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Your request has been submitted successfully. You can submit another response when needed.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setSubmitError(null);
                setHasSubmitted(false);
                setCurrentSection(0);
              }}
            >
              Submit Another Response
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("max-w-4xl mx-auto space-y-6", className)}>
      {/* Error Alert */}
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {/* Current Section */}
      <Card className="dark:bg-gray-800 dark:border-white/10">
        <CardHeader>
          <CardTitle className="dark:text-gray-100">{currentSectionData.title}</CardTitle>
          {currentSectionData.description && (
            <CardDescription className="dark:text-gray-400">{currentSectionData.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit(onSubmitForm)}>
            <div className="grid gap-6">
              {currentSectionFields.map((field) => (
                <React.Fragment key={field.id}>
                  <FormField
                    field={field}
                    disabled={mode === 'readonly'}
                    suppressError={suppressedRangeErrorFields.has(field.name)}
                    className={cn(
                      field.width === 'half' && "md:col-span-1",
                      field.width === 'third' && "md:col-span-1",
                      field.width === 'quarter' && "md:col-span-1",
                      "col-span-2"
                    )}
                  />
                  {rangeAlertByEndName.has(field.name) && (
                    <Alert className="col-span-2 border-[#D32F2F]/40 bg-[#FEF2F2] text-[#991B1B] dark:bg-red-950/30 dark:text-red-200">
                      <AlertCircle className="h-4 w-4 !text-[#D32F2F]" />
                      <AlertDescription className="font-medium text-[#991B1B] dark:text-red-100">
                        {rangeAlertByEndName.get(field.name)}
                      </AlertDescription>
                    </Alert>
                  )}
                </React.Fragment>
              ))}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Navigation and Actions */}
      <Card className="dark:bg-gray-800 dark:border-white/10">
        <CardContent className="flex items-center justify-between pt-6">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={prevSection}
              disabled={isFirstSection || !canProceed}
              className="dark:bg-white/5 dark:border-white/10 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              Previous
            </Button>

            {!isLastSection && (
              <Button
                type="button"
                onClick={nextSection}
                disabled={!canProceed}
              >
                Next
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {mode === 'fill' && onSave && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSave}
                disabled={isSaving || isSubmitting}
              >
                {isSaving ? (
                  <>
                    <Save className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Draft
                  </>
                )}
              </Button>
            )}

            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
                className="dark:bg-white/5 dark:border-white/10 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Cancel
              </Button>
            )}

            {mode === 'fill' && isLastSection && onSubmit && (
              <Button
                type="submit"
                onClick={handleSubmit(onSubmitForm)}
                disabled={isSubmitting || hasVisibleErrors}
              >
                {isSubmitting ? (
                  <>
                    <Send className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Form
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
