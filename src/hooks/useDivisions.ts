import { useQuery } from "@tanstack/react-query";
import { useMsal } from "@azure/msal-react";
import { getGraphClient } from "@/services/graphService";
import { DivisionService } from "@/services/divisionService";

export const useDivisions = () => {
    const { instance: msalInstance } = useMsal();

    return useQuery({
        queryKey: ["strategyDivisions"],
        queryFn: async () => {
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error("No Graph Client");

            try {
                const service = new DivisionService(graphClient);
                const divisions = await service.getDivisions();
                return divisions;
            } catch (error) {
                console.warn("[useDivisions] Error fetching divisions:", error);
                return [];
            }
        },
        enabled: !!msalInstance.getActiveAccount(),
        staleTime: 1000 * 60 * 5, // 5 mins
    });
};
