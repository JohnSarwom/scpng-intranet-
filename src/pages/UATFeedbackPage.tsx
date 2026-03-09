import React from 'react';
import PageLayout from '@/components/layout/PageLayout';
import { UATFeedbackTab } from '@/components/admin/UATFeedbackTab';
import { MessageSquareText, FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const UATFeedbackPage: React.FC = () => {
  return (
    <PageLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <MessageSquareText className="h-8 w-8 text-intranet-primary" />
              UAT Feedback
            </h1>
            <p className="text-muted-foreground mt-1">
              Staff feedback and ratings collected during User Acceptance Testing.
            </p>
          </div>
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 border-intranet-primary/30 text-intranet-primary"
          >
            <FlaskConical size={14} />
            Testing Phase
          </Badge>
        </div>

        <Separator />

        <UATFeedbackTab />
      </div>
    </PageLayout>
  );
};

export default UATFeedbackPage;
