import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { FormLayoutWrapper } from '@/components/forms/FormLayoutWrapper';
import { GenericPaperForm } from '@/components/forms/GenericPaperForm';
import { trainingRequestTemplate } from '@/config/formTemplates';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

const TrainingRequestPage: React.FC = () => {
    const form = useForm({
        defaultValues: {},
    });

    const handleFormSubmit = async (data: Record<string, any>) => {
        // Basic mock submission for now
        console.log('Form submitted:', data);
    };

    const handleFormSave = async (data: Record<string, any>) => {
        console.log('Form saved as draft:', data);
        toast.success('Training Request saved as draft!');
    };

    return (
        <FormProvider {...form}>
            <FormLayoutWrapper
                title={trainingRequestTemplate.title}
                template={trainingRequestTemplate}
                digitalContent={
                    <FormRenderer
                        template={trainingRequestTemplate}
                        mode="fill"
                        onSubmit={handleFormSubmit}
                        onSave={handleFormSave}
                        onCancel={() => window.history.back()}
                    />
                }
                paperContent={
                    <div className="flex justify-center p-4">
                        <GenericPaperForm template={trainingRequestTemplate} />
                    </div>
                }
                trackingContent={
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            Feature coming soon. Track your training requests directly right here.
                        </CardContent>
                    </Card>
                }
            />
        </FormProvider>
    );
};

export default TrainingRequestPage;
