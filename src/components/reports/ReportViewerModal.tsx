import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Report, ReportSectionContent } from '@/types/reports';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, User, FileText, Download, Printer } from "lucide-react";
import { format } from 'date-fns';

interface ReportViewerModalProps {
    report: Report | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const ReportViewerModal: React.FC<ReportViewerModalProps> = ({
    report,
    open,
    onOpenChange
}) => {
    if (!report) return null;

    const renderSection = (section: ReportSectionContent) => {
        switch (section.type) {
            case 'custom':
            case 'kpi':
                if (section.visualization?.type === 'metrics') {
                    return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {section.data.map((metric: any, idx: number) => (
                                <Card key={idx} className="bg-muted/50">
                                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                        <span className="text-2xl font-bold">{metric.value}</span>
                                        <span className="text-xs text-muted-foreground">{metric.label}</span>
                                        {metric.status && (
                                            <Badge variant={metric.status === 'good' ? 'outline' : 'destructive'} className="mt-2 text-[10px] h-5">
                                                {metric.status.toUpperCase()}
                                            </Badge>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    );
                }
                // Fallback for charts (rendered as simple list for now as we don't have chart lib set up in this context)
                return (
                    <div className="space-y-2">
                        {section.data.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-2 border rounded text-sm">
                                <span>{item.name || item.title}</span>
                                <div className="flex items-center gap-2">
                                    {item.status && <Badge variant="outline">{item.status}</Badge>}
                                    {item.progress !== undefined && <span className="text-muted-foreground">{item.progress}%</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                );

            case 'project':
            case 'task':
            case 'risk':
                return (
                    <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted text-muted-foreground">
                                <tr>
                                    <th className="p-2 font-medium">Item</th>
                                    <th className="p-2 font-medium">Status</th>
                                    <th className="p-2 font-medium">Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {section.data.map((item: any, idx: number) => (
                                    <tr key={idx} className="border-t hover:bg-muted/20">
                                        <td className="p-2 font-medium">{item.name || item.title}</td>
                                        <td className="p-2">
                                            <Badge variant={item.status === 'completed' || item.status === 'low' ? 'default' : 'secondary'}>
                                                {item.status || 'N/A'}
                                            </Badge>
                                        </td>
                                        <td className="p-2 text-muted-foreground">
                                            {item.progress !== undefined && `Progress: ${item.progress}%`}
                                            {item.impact && `Impact: ${item.impact}`}
                                            {item.manager && `Manager: ${item.manager}`}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );

            default:
                return <div className="text-sm text-muted-foreground">Unsupported section type: {section.type}</div>;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <div className="flex items-start justify-between">
                        <div>
                            <DialogTitle className="text-xl flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                {report.name}
                            </DialogTitle>
                            <DialogDescription className="mt-1 flex items-center gap-4 text-xs">
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(report.created_at || new Date()), 'PPP')}
                                </span>
                                <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {report.created_by}
                                </span>
                                <Badge variant="secondary" className="text-[10px] h-5">{report.template_id}</Badge>
                            </DialogDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => window.print()}>
                                <Printer className="h-4 w-4 mr-2" />
                                Print
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 p-6">
                    <div className="space-y-8 max-w-3xl mx-auto">
                        {/* AI Analysis Summary if available */}
                        {report.ai_analysis && report.ai_insights && (
                            <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base text-purple-800 dark:text-purple-300 flex items-center gap-2">
                                        ✨ AI Insights
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm space-y-4">
                                    {report.ai_insights.trends && (
                                        <div>
                                            <strong className="font-semibold text-purple-900 dark:text-purple-200">Key Trends:</strong>
                                            <ul className="list-disc list-inside mt-1 text-purple-800 dark:text-purple-300/80">
                                                {report.ai_insights.trends.map((t, i) => <li key={i}>{t}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                    {report.ai_insights.predictions && (
                                        <div>
                                            <strong className="font-semibold text-purple-900 dark:text-purple-200">Predictions:</strong>
                                            <ul className="list-disc list-inside mt-1 text-purple-800 dark:text-purple-300/80">
                                                {report.ai_insights.predictions.map((t, i) => <li key={i}>{t}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Report Sections */}
                        {report.content.sections.map((section) => (
                            <div key={section.id} className="space-y-3">
                                <h3 className="text-lg font-semibold border-b pb-1">{section.title}</h3>
                                {renderSection(section)}
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <DialogFooter className="px-6 py-4 border-t bg-muted/20">
                    <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
