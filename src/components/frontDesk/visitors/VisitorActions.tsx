import React from 'react';
import { LogIn, LogOut, MoreVertical, PencilIcon, Trash2Icon, Undo2, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { VisitorStatus } from '@/services/frontDesk/frontDeskConfig';
import type { FrontDeskVisitor } from '@/services/frontDesk/visitorRules';

export interface VisitorActionHandlers {
  canUpdate: boolean;
  canDelete: boolean;
  onChangeStatus: (visitor: FrontDeskVisitor, target: VisitorStatus) => void;
  onEdit: (visitor: FrontDeskVisitor) => void;
  onDelete: (visitor: FrontDeskVisitor) => void;
}

/** Sign in / Sign out as the main button, everything else in the menu. Hidden without the permission. */
export const VisitorActions: React.FC<VisitorActionHandlers & { visitor: FrontDeskVisitor; size?: 'sm' | 'xs' }> = ({
  visitor, canUpdate, canDelete, onChangeStatus, onEdit, onDelete, size = 'sm',
}) => {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const buttonClass = size === 'xs' ? 'h-7 px-2 text-xs' : 'h-8 px-3';
  const menuItems: React.ReactNode[] = [];
  if (canUpdate) {
    if (visitor.status === 'Expected') {
      menuItems.push(<DropdownMenuItem key="noshow" onClick={() => onChangeStatus(visitor, 'No Show')}><UserX className="mr-2 h-4 w-4" />Mark as no-show</DropdownMenuItem>);
    }
    if (visitor.status === 'Signed Out') {
      menuItems.push(<DropdownMenuItem key="undo" onClick={() => onChangeStatus(visitor, 'On Site')}><Undo2 className="mr-2 h-4 w-4" />Undo sign-out</DropdownMenuItem>);
    }
    if (visitor.status === 'On Site' || visitor.status === 'No Show') {
      menuItems.push(<DropdownMenuItem key="expected" onClick={() => onChangeStatus(visitor, 'Expected')}><Undo2 className="mr-2 h-4 w-4" />Back to expected</DropdownMenuItem>);
    }
    menuItems.push(<DropdownMenuItem key="edit" onClick={() => onEdit(visitor)}><PencilIcon className="mr-2 h-4 w-4" />Edit details</DropdownMenuItem>);
  }
  if (canDelete) {
    if (menuItems.length) menuItems.push(<DropdownMenuSeparator key="sep" />);
    menuItems.push(<DropdownMenuItem key="delete" className="text-red-600 focus:text-red-600" onClick={() => onDelete(visitor)}><Trash2Icon className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>);
  }

  return (
    <div className="flex items-center justify-end gap-1" onClick={stop} onPointerDown={stop}>
      {canUpdate && visitor.status === 'Expected' && (
        <Button size="sm" variant="outline" className={buttonClass} onClick={() => onChangeStatus(visitor, 'On Site')}>
          <LogIn className="mr-1 h-3.5 w-3.5" />Sign in
        </Button>
      )}
      {canUpdate && visitor.status === 'On Site' && (
        <Button size="sm" className={buttonClass} onClick={() => onChangeStatus(visitor, 'Signed Out')}>
          <LogOut className="mr-1 h-3.5 w-3.5" />Sign out
        </Button>
      )}
      {menuItems.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`More actions for ${visitor.name}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">{menuItems}</DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
