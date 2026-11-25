/**
 * Christmas Closing Event: one place to switch the invitation on or off,
 * change the dates, or point it at a different SharePoint list.
 */
export const CHRISTMAS_EVENT = {
  /** Used in storage keys. Change it for a new year so everyone is asked again. */
  id: 'christmas-closing-2026',
  /** Master switch for the envelope and form on intranet open. */
  enabled: true,
  /** SharePoint list that holds one row per staff member. */
  listName: 'Christmas_Event_2026_Responses',
  title: 'Christmas Closing Event 2026',
  year: '2026',
  eventDateLabel: '23 December 2026',
  venue: 'Hilton Hotel, Port Moresby',
  /** Last day the envelope is shown (inclusive, local time). */
  showUntil: '2026-12-23',
} as const;

export const ATTENDANCE_OPTIONS = [
  { value: 'Attending', label: 'Yes, I confirm my attendance.' },
  { value: 'Not attending', label: 'No, I will not be attending.' },
  { value: 'To be confirmed', label: 'To be confirmed.' },
] as const;

export const ARRANGEMENT_OPTIONS = [
  { value: 'Remaining in Port Moresby', label: 'Remaining in Port Moresby' },
  { value: 'Travelling out of Port Moresby', label: 'Travelling out of Port Moresby' },
  { value: 'Taking leave within Port Moresby', label: 'Taking leave within Port Moresby' },
  { value: 'Taking leave and travelling', label: 'Taking leave and travelling' },
  { value: 'Other / Not yet confirmed', label: 'Other / Not yet confirmed' },
] as const;

export type Attendance = (typeof ATTENDANCE_OPTIONS)[number]['value'];
export type Arrangement = (typeof ARRANGEMENT_OPTIONS)[number]['value'];

/** Arrangements that need a destination. */
export const NEEDS_DESTINATION: readonly string[] = ['Travelling out of Port Moresby', 'Taking leave and travelling'];
/** Arrangements that need leave / travel dates. */
export const NEEDS_DATES: readonly string[] = [
  'Travelling out of Port Moresby',
  'Taking leave within Port Moresby',
  'Taking leave and travelling',
];

/** Suggestions for the Division / Unit box (staff may type anything). */
export const DIVISION_UNIT_SUGGESTIONS: Record<string, string[]> = {
  'Executive Division': ['Executive Unit', 'Secretariat Unit'],
  'Corporate Services Division': ['Finance Unit', 'Human Resources Unit', 'IT Unit', 'Corporate Services Unit', 'Administrative Services'],
  'Licensing Market & Supervision Division': ['Market Data Unit', 'Licensing Unit', 'Supervision Unit', 'Investigations Unit'],
  'Legal Services Division': ['Legal Advisory Unit'],
  'Research & Publication Division': ['Research Unit', 'Media & Publication Unit'],
};

/**
 * Where each working field sits on the artwork, in artwork pixels.
 * The artwork is ARTWORK_W x ARTWORK_H; positions are measured from the image.
 */
export const ARTWORK_W = 1055;
export const ARTWORK_H = 1491;

export const FIELD_BOXES = {
  fullName: { x: 303, y: 537, w: 613, h: 30 },
  divisionUnit: { x: 303, y: 576, w: 613, h: 30 },
  destination: { x: 353, y: 1057, w: 563, h: 30 },
  startDate: { x: 353, y: 1095, w: 187, h: 30 },
  endDate: { x: 745, y: 1095, w: 171, h: 30 },
  comments: { x: 139, y: 1163, w: 777, h: 77 },
} as const;

/** Clickable rows for tick boxes: the row starts 7px left of the drawn box and 4px above it. */
export const TICK_ROW = { x: 172, w: 368, h: 30 } as const;
export const ATTENDANCE_ROWS_Y = [679, 710, 741] as const;
export const ARRANGEMENT_ROWS_Y = [835, 866, 896, 926, 957] as const;

/** The real SCPNG logo replaces the placeholder bird at the top of the artwork. */
export const LOGO_MEDALLION = { cx: 527.5, cy: 37, d: 64 } as const;
