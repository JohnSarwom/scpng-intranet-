import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { FormLayoutWrapper } from '@/components/forms/FormLayoutWrapper';
import { GenericPaperForm } from '@/components/forms/GenericPaperForm';
import { assetRequestTemplate } from '@/config/formTemplates';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

const AssetRequestPage: React.FC = () => {
    const form = useForm({
        defaultValues: {},
    });

    const handleFormSubmit = async (data: Record<string, any>) => {
        // Basic mock submission for now
        console.log('Form submitted:', data);
        toast.success('Asset Request submitted successfully!');
        form.reset();
    };

    const handleFormSave = async (data: Record<string, any>) => {
        console.log('Form saved as draft:', data);
        toast.success('Asset Request saved as draft!');
    };

    return (
        <FormProvider {...form}>
            <FormLayoutWrapper
                title={assetRequestTemplate.title}
                template={assetRequestTemplate}
                digitalContent={
                    <FormRenderer
                        template={assetRequestTemplate}
                        mode="fill"
                        onSubmit={handleFormSubmit}
                        onSave={handleFormSave}
                        onCancel={() => window.history.back()}
                    />
                }
                paperContent={
                    <div className="flex justify-center p-4">
                        <GenericPaperForm template={assetRequestTemplate} />
                    </div>
                }
                trackingContent={
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            Feature coming soon. Track your asset requests directly right here.
                        </CardContent>
                    </Card>
                }
            />
        </FormProvider>
    );
};

export default AssetRequestPage;
