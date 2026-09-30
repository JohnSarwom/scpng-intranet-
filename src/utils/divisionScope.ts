/**
 * Narrows already-loaded, already permission-filtered records to one Division so
 * the Division page's figures describe that Division. It only ever removes
 * records; it never widens what a viewer can see.
 *
 * Membership rules match the Linkage inventory (linkageInventoryService):
 * a KRA belongs by its Division column, or by its unit when Division is blank;
 * a KPI belongs through its KRA; a Task belongs by its recorded unit, or through
 * its KPI/KRA when no unit is recorded.
 *
 * Kept free of runtime imports so the Node test harness can load it directly.
 */

const normalize = (value: unknown): string =>
  (value === null || value === undefined ? '' : String(value))
    .trim().toLowerCase().replace(/\s+/g, ' ').replace(/ division$/, '');

const id = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());

interface ScopedKra { id: string | number; division?: string | null; unit?: string | null }
interface ScopedKpi { id: string | number; kra_id?: string | number | null }
interface ScopedTask { unit_id?: string | null; kpi_id?: string | number | null; kra_id?: string | number | null }

export function scopeRecordsToDivision<T extends ScopedTask, K extends ScopedKpi, R extends ScopedKra>(input: {
  divisionName: string;
  unitNames: string[];
  tasks: T[];
  kpis: K[];
  kras: R[];
}): { tasks: T[]; kpis: K[]; kras: R[] } {
  const divisionKey = normalize(input.divisionName);
  const unitKeys = new Set(input.unitNames.map(normalize).filter(Boolean));

  const kraInDivision = (kra: ScopedKra | undefined): boolean => {
    if (!kra) return false;
    const divKey = normalize(kra.division);
    return divKey ? divKey === divisionKey : unitKeys.has(normalize(kra.unit));
  };

  const kras = input.kras.filter(kraInDivision);
  const kraIds = new Set(kras.map(kra => id(kra.id)));
  const kpis = input.kpis.filter(kpi => kraIds.has(id(kpi.kra_id)));
  const kpiKraIds = new Map(input.kpis.map(kpi => [id(kpi.id), id(kpi.kra_id)]));

  const tasks = input.tasks.filter(task => {
    const unitKey = normalize(task.unit_id);
    if (unitKey) return unitKeys.has(unitKey);
    const viaKpi = kpiKraIds.get(id(task.kpi_id));
    return kraIds.has(viaKpi || '') || kraIds.has(id(task.kra_id));
  });

  return { tasks, kpis, kras };
}
