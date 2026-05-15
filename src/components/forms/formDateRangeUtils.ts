import { FormField as FormFieldType } from '@/types/forms';

const DATE_FIELD_TYPES = new Set(['date', 'datetime', 'datetime-local']);

export interface DateRangePair {
  start: string;
  end: string;
}

export const isDateLikeField = (field: FormFieldType) =>
  DATE_FIELD_TYPES.has(field.type);

const directRangeStarts: Record<string, string> = {
  absenceto: 'absencefrom',
  enddate: 'startdate',
  end_date: 'start_date',
  returndate: 'startdate',
  return_date: 'start_date',
};

export const getDateRangeStartName = (
  fieldName: string,
  availableNames: string[],
): string | null => {
  const byLowerName = new Map(availableNames.map(name => [name.toLowerCase(), name]));
  const lowerName = fieldName.toLowerCase();

  const direct = directRangeStarts[lowerName];
  if (direct && byLowerName.has(direct)) {
    return byLowerName.get(direct) ?? null;
  }

  const candidates = [
    lowerName.replace(/end/g, 'start'),
    lowerName.replace(/to$/g, 'from'),
    lowerName.replace(/_to$/g, '_from'),
    lowerName.replace(/return/g, 'start'),
  ];

  for (const candidate of candidates) {
    if (candidate !== lowerName && byLowerName.has(candidate)) {
      return byLowerName.get(candidate) ?? null;
    }
  }

  return null;
};

export const getDateRangePairs = (fields: FormFieldType[]): DateRangePair[] => {
  const dateFields = fields.filter(isDateLikeField);
  const dateFieldNames = dateFields.map(field => field.name);

  return dateFields
    .map(field => {
      const start = getDateRangeStartName(field.name, dateFieldNames);
      return start ? { start, end: field.name } : null;
    })
    .filter((pair): pair is DateRangePair => Boolean(pair));
};

export const parseDateValue = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const pad = (value: number) => String(value).padStart(2, '0');

export const toDateInputValue = (
  value: unknown,
  fieldType: FormFieldType['type'],
): string | undefined => {
  const date = parseDateValue(value);
  if (!date) return undefined;

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());

  if (fieldType === 'date') {
    return `${year}-${month}-${day}`;
  }

  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const isBeforeDateValue = (value: unknown, minValue: unknown) => {
  const date = parseDateValue(value);
  const minDate = parseDateValue(minValue);
  if (!date || !minDate) return false;
  return date.getTime() < minDate.getTime();
};
