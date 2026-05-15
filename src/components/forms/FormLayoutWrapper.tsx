import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
import { FormTemplate } from '@/types/forms';
import { useFormContext, useWatch } from 'react-hook-form';

export type FormLayoutView = 'digital' | 'paper' | 'tracking';

export interface FormLayoutWrapperProps {
    title: string;
    template?: FormTemplate;
    onDebugSchema?: () => void;
    digitalContent: React.ReactNode;
    paperContent: React.ReactNode;
    trackingContent: React.ReactNode;
    showPaperTab?: boolean;
    showTrackingTab?: boolean;
    showProgress?: boolean;
    activeView?: FormLayoutView;
    onViewChange?: (value: FormLayoutView) => void;
}

export const FormLayoutWrapper: React.FC<FormLayoutWrapperProps> = ({
    title,
    template,
    onDebugSchema,
    digitalContent,
    paperContent,
    trackingContent,
    showPaperTab = true,
    showTrackingTab = true,
    showProgress = true,
    activeView,
    onViewChange,
}) => {
    const [internalViewMode, setInternalViewMode] = useState<FormLayoutView>('digital');
    const viewMode = activeView ?? internalViewMode;
    const setViewMode = (value: FormLayoutView) => {
        setInternalViewMode(value);
        onViewChange?.(value);
    };
    const navigate = useNavigate();
    const formContext = useFormContext();
    const watchedData = useWatch({ control: formContext.control });

    // Calculate progress if template and form context exist
    const calculateProgress = () => {
        if (!template || !formContext || viewMode !== 'digital') return 0;

        const allFields = template.sections.flatMap(section => section.fields);
        const requiredFields = allFields.filter(field => field.required);
        const filledRequiredFields = requiredFields.filter(field => {
            const value = watchedData[field.name];
            return value !== undefined && value !== null && value !== '';
        });

        return requiredFields.length > 0
            ? Math.round((filledRequiredFields.length / requiredFields.length) * 100)
            : 100;
    };

    const progress = calculateProgress();

    return (
        <div className="space-y-4">
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as FormLayoutView)} className="w-full">
                <div className="flex justify-between items-center mb-6">
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/forms')}
                        className="-ml-4 text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Forms
                    </Button>
                    <div className="flex gap-2">
                        {onDebugSchema && (
                            <Button variant="outline" size="sm" onClick={onDebugSchema} className="dark:bg-white/5 dark:border-white/10 dark:text-gray-400 hover:dark:bg-gray-700">
                                Debug Schema
                            </Button>
                        )}
                        {(showPaperTab || showTrackingTab) && (
                            <TabsList className="dark:bg-gray-800 dark:border-white/10 p-1">
                                <TabsTrigger value="digital" className="dark:data-[state=active]:bg-gray-700">Digital Form</TabsTrigger>
                                {showPaperTab && <TabsTrigger value="paper" className="dark:data-[state=active]:bg-gray-700">Paper Form</TabsTrigger>}
                                {showTrackingTab && <TabsTrigger value="tracking" className="dark:data-[state=active]:bg-gray-700">My Applications</TabsTrigger>}
                            </TabsList>
                        )}
                    </div>
                </div>

                {template && (
                    <Card className="mb-6 dark:bg-gray-800 dark:border-white/10">
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                    <CardTitle className="text-2xl dark:text-gray-100">{template.title}</CardTitle>
                                    <CardDescription className="dark:text-gray-400">{template.description}</CardDescription>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-gray-500">
                                        <Clock className="h-4 w-4" />
                                        <span>Estimated time: {template.estimatedTime}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="dark:border-white/10 dark:text-gray-400">
                                        Version {template.version}
                                    </Badge>
                                </div>
                            </div>
 
                            {viewMode === 'digital' && showProgress && (
                                <div className="space-y-2 mt-4 text-sm">
                                    <div className="flex justify-between">
                                        <span className="font-medium dark:text-gray-300">Form completion</span>
                                        <span className="dark:text-gray-400">{progress}%</span>
                                    </div>
                                    <Progress value={progress} className="h-2 dark:bg-gray-700" />
                                </div>
                            )}
                        </CardHeader>
                    </Card>
                )}

                <TabsContent value="digital">
                    {digitalContent}
                </TabsContent>
                <TabsContent value="paper">
                    {paperContent}
                </TabsContent>
                <TabsContent value="tracking">
                    {trackingContent}
                </TabsContent>
            </Tabs>
        </div>
    );
};
