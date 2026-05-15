import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { toast } from 'sonner';
import { getGraphClient } from '@/services/graphService';
import { getHRServiceInstance } from '@/services/hrSharePointService';
import { WorkflowApprover, EmailTemplate, EmailTemplateStage } from '@/types/hr';
import { buildSCPNGEmailHTML, buildSCPNGEmailSubject, EmailTemplateVars } from '@/utils/scpngEmailBuilder';

// ---------------------------------------------------------------------------
// Send email via Graph /me/sendMail — MJML-compiled HTML as the email body
// ---------------------------------------------------------------------------

export interface SendTestEmailPayload {
  to: string;
  stage: EmailTemplateStage;
  vars: EmailTemplateVars;
}

async function sendViaGraph(msalInstance: any, payload: SendTestEmailPayload): Promise<void> {
  const client = await getGraphClient(msalInstance);
  if (!client) throw new Error('Graph client unavailable');

  const subject     = buildSCPNGEmailSubject(payload.stage, payload.vars);
  const mjmlHtml    = await buildSCPNGEmailHTML(payload.stage, payload.vars);

  await client.api('/me/sendMail').post({
    message: {
      subject,
      body: { contentType: 'HTML', content: mjmlHtml },
      toRecipients: [{ emailAddress: { address: payload.to } }],
    },
    saveToSentItems: false,
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export const useSetupWorkflowLists = () => {
  const { instance: msalInstance } = useMsal();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const client = await getGraphClient(msalInstance);
      if (!client) throw new Error('Graph client unavailable');
      const service = await getHRServiceInstance(client);
      await service.setupWorkflowLists();
    },
    onSuccess: () => {
      toast.success('Workflow lists created successfully.');
      queryClient.invalidateQueries({ queryKey: ['hr', 'workflow-approvers'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'email-templates'] });
    },
    onError: (e: unknown) => {
      toast.error('Setup failed', {
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });
};

// ---------------------------------------------------------------------------
// Approvers
// ---------------------------------------------------------------------------

export const useWorkflowApprovers = () => {
  const { instance: msalInstance } = useMsal();

  return useQuery<WorkflowApprover[]>({
    queryKey: ['hr', 'workflow-approvers'],
    queryFn: async () => {
      if (!msalInstance) return [];
      const client = await getGraphClient(msalInstance);
      if (!client) return [];
      const service = await getHRServiceInstance(client);
      return service.getWorkflowApprovers();
    },
    enabled: !!msalInstance,
  });
};

export const useSaveWorkflowApprover = () => {
  const { instance: msalInstance } = useMsal();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: WorkflowApprover) => {
      const client = await getGraphClient(msalInstance);
      if (!client) throw new Error('Graph client unavailable');
      const service = await getHRServiceInstance(client);
      return service.saveWorkflowApprover(data);
    },
    onSuccess: () => {
      toast.success('Approver saved.');
      queryClient.invalidateQueries({ queryKey: ['hr', 'workflow-approvers'] });
    },
    onError: (e: unknown) => {
      toast.error('Save failed', {
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });
};

export const useDeleteWorkflowApprover = () => {
  const { instance: msalInstance } = useMsal();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const client = await getGraphClient(msalInstance);
      if (!client) throw new Error('Graph client unavailable');
      const service = await getHRServiceInstance(client);
      return service.deleteWorkflowApprover(itemId);
    },
    onSuccess: () => {
      toast.success('Approver removed.');
      queryClient.invalidateQueries({ queryKey: ['hr', 'workflow-approvers'] });
    },
    onError: (e: unknown) => {
      toast.error('Delete failed', {
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });
};

// ---------------------------------------------------------------------------
// Email Templates
// ---------------------------------------------------------------------------

export const useEmailTemplates = () => {
  const { instance: msalInstance } = useMsal();

  return useQuery<EmailTemplate[]>({
    queryKey: ['hr', 'email-templates'],
    queryFn: async () => {
      if (!msalInstance) return [];
      const client = await getGraphClient(msalInstance);
      if (!client) return [];
      const service = await getHRServiceInstance(client);
      return service.getEmailTemplates();
    },
    enabled: !!msalInstance,
  });
};

export const useSaveEmailTemplate = () => {
  const { instance: msalInstance } = useMsal();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: EmailTemplate) => {
      const client = await getGraphClient(msalInstance);
      if (!client) throw new Error('Graph client unavailable');
      const service = await getHRServiceInstance(client);
      return service.saveEmailTemplate(data);
    },
    onSuccess: () => {
      toast.success('Template saved.');
      queryClient.invalidateQueries({ queryKey: ['hr', 'email-templates'] });
    },
    onError: (e: unknown) => {
      toast.error('Save failed', {
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });
};

// ---------------------------------------------------------------------------
// Send test email
// ---------------------------------------------------------------------------

export const useSendTestEmail = () => {
  const { instance: msalInstance } = useMsal();

  return useMutation({
    mutationFn: (payload: SendTestEmailPayload) => sendViaGraph(msalInstance, payload),
    onSuccess: (_data, vars) => {
      toast.success(`Email sent to ${vars.to}`, { description: 'MJML-compiled branded HTML delivered.' });
    },
    onError: (e: unknown) => {
      toast.error('Send failed', {
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });
};
