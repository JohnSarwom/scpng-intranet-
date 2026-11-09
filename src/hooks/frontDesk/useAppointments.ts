import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appointmentDateKey, type AppointmentInput, type FrontDeskAppointment } from '@/services/frontDesk/appointmentRules';
import { AppointmentsService, type InviteResult } from '@/services/frontDesk/appointmentsService';
import { FrontDeskConflictError } from '@/services/frontDesk/frontDeskGraph';
import { frontDeskKeys, FRONT_DESK_LIVE_REFETCH_MS } from './frontDeskQueryKeys';
import { frontDeskFailed, frontDeskSaved, frontDeskWarning } from './frontDeskToasts';
import { useFrontDeskActor } from './useFrontDeskActor';
import { useFrontDeskGraph } from './useFrontDeskGraph';

function useAppointmentsService() {
  const getGraph = useFrontDeskGraph();
  return async () => new AppointmentsService(await getGraph());
}

/** Appointments starting in a period, refreshed every 30 seconds so two desks stay in step. */
export function useAppointmentsBetween(start: string, end: string) {
  const service = useAppointmentsService();
  return useQuery({
    queryKey: frontDeskKeys.appointmentsBetween(start, end),
    queryFn: async () => (await service()).listBetween(start, end),
    refetchInterval: FRONT_DESK_LIVE_REFETCH_MS,
  });
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

const inviteNote: Partial<Record<InviteResult, string>> = {
  created: 'An Outlook invite was sent to the host and staff attendees.',
  updated: 'The Outlook invite was updated.',
  canceled: 'The Outlook invite was canceled.',
};

export function useAppointmentMutations() {
  const queryClient = useQueryClient();
  const actor = useFrontDeskActor();
  const service = useAppointmentsService();
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: frontDeskKeys.appointments() }),
    queryClient.invalidateQueries({ queryKey: ['front-desk', 'visitors'] }),
  ]);

  /**
   * Saves the appointment, then brings its expected visitors and Outlook invite in line.
   * Those follow-on steps never undo the save: a failure there shows a warning instead.
   */
  const save = useMutation({
    mutationFn: async ({ appointment, input, sendInvite }: { appointment?: FrontDeskAppointment; input: AppointmentInput; sendInvite: boolean }) => {
      const svc = await service();
      const saved = appointment ? await svc.update(appointment, input) : await svc.create(input, actor.email);
      const warnings: [string, string?][] = [];
      let visitorsChanged = 0;
      try {
        const result = await svc.syncExpectedVisitors(saved, actor.email, appointment ? appointmentDateKey(appointment) : undefined);
        visitorsChanged = result.created + result.updated + result.removed;
      } catch (error) {
        warnings.push(['The visitor log was not updated for this appointment.', errorText(error)]);
      }
      let invite: InviteResult = 'none';
      try {
        invite = await svc.syncInvite(saved, { sendInvite });
        if (invite === 'other-calendar') {
          warnings.push(['The Outlook invite was not changed.', 'It was sent from another receptionist’s calendar; ask them to update it.']);
        }
      } catch (error) {
        warnings.push(['The Outlook invite could not be sent or updated.', errorText(error)]);
      }
      return { saved, invite, visitorsChanged, warnings };
    },
    onSuccess: ({ saved, invite, visitorsChanged, warnings }, { appointment }) => {
      const notes = [inviteNote[invite], visitorsChanged ? 'Its visitors are in the visitor log as Expected.' : ''].filter(Boolean);
      frontDeskSaved(`${saved.title} ${appointment ? 'updated' : 'booked'}.${notes.length ? ` ${notes.join(' ')}` : ''}`);
      for (const [message, detail] of warnings) frontDeskWarning(message, detail);
    },
    onError: (error: unknown) => {
      frontDeskFailed('save the appointment', error);
      if (error instanceof FrontDeskConflictError) void refresh();
    },
    onSettled: refresh,
  });

  /** Deletes the appointment, cancels its invite and removes guests who never arrived. */
  const remove = useMutation({
    mutationFn: async (appointment: FrontDeskAppointment) => {
      const svc = await service();
      await svc.remove(appointment);
      try {
        const { invite } = await svc.cleanUpAfterDelete(appointment, actor.email);
        return invite === 'other-calendar' ? 'The Outlook invite is in another receptionist’s calendar; ask them to cancel it.' : '';
      } catch (error) {
        return `Its Outlook invite or expected visitors could not be cleaned up: ${errorText(error)}`;
      }
    },
    onSuccess: (warning, appointment) => {
      frontDeskSaved(`${appointment.title} deleted.`);
      if (warning) frontDeskWarning('Some follow-up steps did not finish.', warning);
    },
    onError: (error: unknown) => frontDeskFailed('delete the appointment', error),
    onSettled: refresh,
  });

  return { save, remove };
}
