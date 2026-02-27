import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
import { FormTemplate } from '@/types/forms';
import { useFormContext } from 'react-hook-form';

export interface FormLayoutWrapperProps {
    title: string;
    template?: FormTemplate;
    onDebugSchema?: () => void;
    digitalContent: React.ReactNode;
    paperContent: React.ReactNode;
    trackingContent: React.ReactNode;
}

export const FormLayoutWrapper: React.FC<FormLayoutWrapperProps> = ({
    title,
    template,
    onDebugSchema,
    digitalContent,
    paperContent,
    trackingContent,
}) => {
    const [viewMode, setViewMode] = useState<'digital' | 'paper' | 'tracking'>('digital');
    const navigate = useNavigate();
    const formContext = useFormContext();

    // Calculate progress if template and form context exist
    const calculateProgress = () => {
        if (!template || !formContext || viewMode !== 'digital') return 0;

        const watchedData = formContext.watch();
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
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as any)} className="w-full">
                <div className="flex justify-between items-center mb-6">
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/forms')}
                        className="-ml-4 text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Forms
                    </Button>
                    <div className="flex gap-2">
                        {onDebugSchema && (
                            <Button variant="outline" size="sm" onClick={onDebugSchema}>
                                Debug Schema
                            </Button>
                        )}
                        <TabsList>
                            <TabsTrigger value="digital">Digital Form</TabsTrigger>
                            <TabsTrigger value="paper">Paper Form</TabsTrigger>
                            <TabsTrigger value="tracking">My Applications</TabsTrigger>
                        </TabsList>
                    </div>
                </div>

                {template && (
                    <Card className="mb-6">
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                    <CardTitle className="text-2xl">{template.title}</CardTitle>
                                    <CardDescription>{template.description}</CardDescription>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Clock className="h-4 w-4" />
                                        <span>Estimated time: {template.estimatedTime}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">
                                        Version {template.version}
                                    </Badge>
                                </div>
                            </div>

                            {viewMode === 'digital' && (
                                <div className="space-y-2 mt-4 text-sm">
                                    <div className="flex justify-between">
                                        <span className="font-medium">Form completion</span>
                                        <span>{progress}%</span>
                                    </div>
                                    <Progress value={progress} className="h-2" />
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
