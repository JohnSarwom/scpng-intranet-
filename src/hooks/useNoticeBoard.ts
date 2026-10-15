import { useState, useCallback, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnnouncementsSharePointService } from "@/services/announcementsSharePointService";
import { EmailAnnouncementsSharePointService } from "@/services/emailAnnouncementsSharePointService";
import { getGraphClient } from "@/services/graphService";
import { useToast } from "@/hooks/use-toast";

export function useNoticeBoard() {
  const emailNoticesEnabled = import.meta.env.VITE_ENABLE_EMAIL_NOTICES === "true";
  const { instance: msalInstance, accounts } = useMsal();
  const accountId = accounts[0]?.homeAccountId;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [service, setService] = useState<AnnouncementsSharePointService | null>(null);

  const initializeService = useCallback(async () => {
    if (service) return service;

    try {
      const graphClient = await getGraphClient(msalInstance);
      if (!graphClient) {
        throw new Error("Failed to initialize Graph client. Please ensure you are logged in.");
      }
      const announcementsService = new AnnouncementsSharePointService(graphClient);
      await announcementsService.initialize();
      setService(announcementsService);
      return announcementsService;
    } catch (err: unknown) {
      console.error("[useNoticeBoard] Service initialization failed:", err);
      const error = err instanceof Error ? err : new Error("Unknown error");
      toast({
        title: "SharePoint Connection Error",
        description: error.message || "Failed to connect to SharePoint. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  }, [msalInstance, service, toast]);

  useEffect(() => {
    if (!service && msalInstance) {
      initializeService().catch(console.error);
    }
  }, [initializeService, service, msalInstance]);

  const {
    data: announcements = [],
    isLoading: loading,
    error,
    isFetching,
    isFetchedAfterMount,
    refetch: refreshAnnouncements
  } = useQuery({
    queryKey: ["announcements", accountId, emailNoticesEnabled],
    queryFn: async () => {
      let currentService = service;
      if (!currentService) {
        currentService = await initializeService();
      }
      const manual = await currentService.getAnnouncements();
      if (!emailNoticesEnabled) return manual;

      const graphClient = await getGraphClient(msalInstance);
      if (!graphClient) throw new Error("Failed to initialize Graph client.");
      const email = await new EmailAnnouncementsSharePointService(graphClient).getAnnouncements();
      return [...manual, ...email].sort(
        (a, b) => b.createdDate.getTime() - a.createdDate.getTime()
      );
    },
    enabled: !!accountId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: 'always',
    meta: { persist: false },
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      let currentService = service;
      if (!currentService) {
        currentService = await initializeService();
      }
      return currentService.deleteAnnouncement(itemId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast({
        title: "Success",
        description: "Announcement deleted successfully",
      });
    },
    onError: (err: unknown) => {
      console.error("Failed to delete announcement:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete announcement",
        variant: "destructive",
      });
    }
  });

  return {
    announcements,
    loading,
    error: error as Error | null,
    popupReady: isFetchedAfterMount && !isFetching && !error,
    refresh: refreshAnnouncements,
    deleteNotice: deleteMutation.mutateAsync,
  };
}
