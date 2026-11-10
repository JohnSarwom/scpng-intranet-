import React, { useRef, useState } from 'react';
import { LogIn, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { newGroupRef, type FrontDeskVisitor, type VisitorInput } from '@/services/frontDesk/visitorRules';

const NO_HOST = '__none';

interface Staff { name: string; email: string }
interface Group { company: string; reason: string; hostEmail: string; groupRef: string }

/**
 * The walk-in sign-in bar (plan P3.3): Name and Reason are enough, Date and Time In fill in
 * automatically, Enter signs in, and focus goes straight back to Name for the next visitor.
 */
export const QuickSignInBar: React.FC<{
  todayKey: string;
  staff: Staff[];
  saving: boolean;
  onSignIn: (input: VisitorInput) => Promise<FrontDeskVisitor | undefined>;
}> = ({ todayKey, staff, saving, onSignIn }) => {
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [reason, setReason] = useState('');
  const [hostEmail, setHostEmail] = useState(NO_HOST);
  const [badgeNo, setBadgeNo] = useState('');
  const [groupRef, setGroupRef] = useState('');
  const [lastGroup, setLastGroup] = useState<Group | null>(null);
  const [errors, setErrors] = useState<{ name?: boolean; reason?: boolean }>({});

  const reset = () => {
    setName(''); setCompany(''); setReason(''); setHostEmail(NO_HOST); setBadgeNo(''); setGroupRef('');
    nameRef.current?.focus();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = { name: !name.trim(), reason: !reason.trim() };
    setErrors(missing);
    if (missing.name || missing.reason) {
      (missing.name ? nameRef.current : document.getElementById('quick-sign-in-reason'))?.focus();
      return;
    }
    const host = staff.find(s => s.email === hostEmail);
    const input: VisitorInput = {
      name, company, reason, visitDate: todayKey, badgeNo,
      hostEmail: host?.email, hostName: host?.name,
      groupRef: groupRef || newGroupRef(),
    };
    const saved = await onSignIn(input);
    if (!saved) return;
    setLastGroup({ company: company.trim(), reason: reason.trim(), hostEmail, groupRef: input.groupRef! });
    reset();
  };

  /** Pre-fills the last visitor's company, reason and host, and keeps them in one group (paper "same as above"). */
  const addAnother = () => {
    if (!lastGroup) return;
    setCompany(lastGroup.company); setReason(lastGroup.reason); setHostEmail(lastGroup.hostEmail); setGroupRef(lastGroup.groupRef);
    setName(''); setBadgeNo('');
    nameRef.current?.focus();
  };

  return (
    <form onSubmit={submit} className="rounded-lg border bg-white dark:bg-gray-900 p-3 space-y-2" aria-label="Sign in a visitor">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Sign in a visitor</h3>
        {lastGroup && (
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addAnother}>
            <UsersRound className="mr-1 h-3.5 w-3.5" />
            {lastGroup.company ? `Add another from ${lastGroup.company}` : 'Add another to this group'}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.4fr_1fr_0.7fr_auto] gap-2">
        <Input
          ref={nameRef}
          aria-label="Visitor's name"
          placeholder="Visitor's name*"
          value={name}
          onChange={e => { setName(e.target.value); setErrors(x => ({ ...x, name: false })); }}
          className={cn(errors.name && 'border-red-500')}
          autoComplete="off"
        />
        <Input aria-label="Company" placeholder="Company" value={company} onChange={e => setCompany(e.target.value)} autoComplete="off" />
        <Input
          id="quick-sign-in-reason"
          aria-label="Reason for visit"
          placeholder="Reason for visit*"
          value={reason}
          onChange={e => { setReason(e.target.value); setErrors(x => ({ ...x, reason: false })); }}
          className={cn(errors.reason && 'border-red-500')}
          autoComplete="off"
        />
        <Select value={hostEmail} onValueChange={setHostEmail}>
          <SelectTrigger aria-label="Host"><SelectValue placeholder="Host" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_HOST}>No host</SelectItem>
            {staff.map(s => <SelectItem key={s.email} value={s.email}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input aria-label="Badge number" placeholder="Badge No" value={badgeNo} onChange={e => setBadgeNo(e.target.value)} autoComplete="off" />
        <Button type="submit" disabled={saving} className="whitespace-nowrap">
          <LogIn className="mr-1 h-4 w-4" />Sign in
        </Button>
      </div>
      {(errors.name || errors.reason) && (
        <p className="text-xs text-red-600">Enter the visitor’s name and the reason for the visit.</p>
      )}
      {groupRef && <p className="text-xs text-muted-foreground">Signing in with the same group as the last visitor.</p>}
    </form>
  );
};
