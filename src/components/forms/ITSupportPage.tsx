import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { FormLayoutWrapper } from '@/components/forms/FormLayoutWrapper';
import { GenericPaperForm } from '@/components/forms/GenericPaperForm';
import { itSupportTemplate } from '@/config/formTemplates';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

const ITSupportPage: React.FC = () => {
    const form = useForm({
        defaultValues: {},
    });

    const handleFormSubmit = async (data: Record<string, any>) => {
        // Basic mock submission for now
        console.log('Form submitted:', data);
        toast.success('IT Support Request submitted successfully!');
        form.reset();
    };

    const handleFormSave = async (data: Record<string, any>) => {
        console.log('Form saved as draft:', data);
        toast.success('IT Support Request saved as draft!');
    };

    return (
        <FormProvider {...form}>
            <FormLayoutWrapper
                title={itSupportTemplate.title}
                template={itSupportTemplate}
                digitalContent={
                    <FormRenderer
                        template={itSupportTemplate}
                        mode="fill"
                        onSubmit={handleFormSubmit}
                        onSave={handleFormSave}
                        onCancel={() => window.history.back()}
                    />
                }
                paperContent={
                    <div className="flex justify-center p-4">
                        <GenericPaperForm template={itSupportTemplate} />
                    </div>
                }
                trackingContent={
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            Feature coming soon. Track your IT support requests directly right here.
                        </CardContent>
                    </Card>
                }
            />
        </FormProvider>
    );
};

export default ITSupportPage;
