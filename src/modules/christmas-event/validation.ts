import { NEEDS_DATES, NEEDS_DESTINATION } from './config';
import type { ChristmasResponse } from './christmasEventService';

export type ChristmasField =
  | 'fullName'
  | 'divisionUnit'
  | 'attendance'
  | 'arrangement'
  | 'destination'
  | 'startDate'
  | 'endDate';

export interface ChristmasProblem {
  field: ChristmasField;
  message: string;
}

/** Returns every problem, in the order the fields appear on the form. */
export function validateChristmasResponse(r: ChristmasResponse): ChristmasProblem[] {
  const out: ChristmasProblem[] = [];
  if (!r.fullName.trim()) out.push({ field: 'fullName', message: 'Please enter your full name.' });
  if (!r.divisionUnit.trim()) out.push({ field: 'divisionUnit', message: 'Please enter your Division / Unit.' });
  if (!r.attendance) out.push({ field: 'attendance', message: 'Please tick one attendance option (section 02).' });
  if (!r.arrangement) out.push({ field: 'arrangement', message: 'Please tick one Christmas period arrangement (section 03).' });
  if (r.arrangement && NEEDS_DESTINATION.includes(r.arrangement) && !r.destination.trim())
    out.push({ field: 'destination', message: 'Please enter your travel destination (section 04).' });
  if (r.arrangement && NEEDS_DATES.includes(r.arrangement)) {
    if (!r.startDate) out.push({ field: 'startDate', message: 'Please choose your departure / leave start date.' });
    if (!r.endDate) out.push({ field: 'endDate', message: 'Please choose your return / leave end date.' });
  }
  if (r.startDate && r.endDate && r.endDate < r.startDate)
    out.push({ field: 'endDate', message: 'The return / leave end date is before the start date.' });
  return out;
}
