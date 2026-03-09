import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronRight, Target, Layers } from 'lucide-react';
import { Objective, KRA } from '@/types';

interface DivisionObjectivesAlignmentProps {
  objectives: Objective[];
  kras: KRA[];
}

export const DivisionObjectivesAlignment: React.FC<DivisionObjectivesAlignmentProps> = ({ objectives, kras }) => {
  // Group KRAs by objective
  const objectivesWithKras = objectives.map(obj => {
    const linkedKras = kras.filter(k => String(k.objectiveId) === String(obj.id));
    const avgProgress = linkedKras.length > 0
      ? Math.round(linkedKras.reduce((sum, k) => sum + (k.progress || 0), 0) / linkedKras.length)
      : 0;

    return {
      ...obj,
      linkedKras,
      avgProgress,
    };
  }).filter(obj => obj.linkedKras.length > 0);

  if (objectivesWithKras.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Strategic Alignment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No strategic objectives linked yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Strategic Alignment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {objectivesWithKras.map(obj => (
            <div key={String(obj.id)} className="border rounded-lg p-3">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Target className="h-4 w-4 text-[#83002A] shrink-0" />
                  <span className="text-sm font-medium truncate">{obj.title}</span>
                </div>
                <Badge variant={obj.avgProgress >= 70 ? 'default' : obj.avgProgress >= 40 ? 'secondary' : 'destructive'} className="text-xs ml-2 shrink-0">
                  {obj.avgProgress}%
                </Badge>
              </div>
              <Progress value={obj.avgProgress} className="h-1.5 mb-2" />
              <div className="space-y-1.5 ml-6">
                {obj.linkedKras.slice(0, 3).map(kra => (
                  <div key={kra.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ChevronRight className="h-3 w-3" />
                    <span className="truncate flex-1">{kra.name}</span>
                    <span className="font-medium">{kra.progress || 0}%</span>
                  </div>
                ))}
                {obj.linkedKras.length > 3 && (
                  <div className="text-xs text-muted-foreground ml-5">
                    +{obj.linkedKras.length - 3} more KRAs
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
