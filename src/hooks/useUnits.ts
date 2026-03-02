import { useQuery } from "@tanstack/react-query";
import { useMsal } from "@azure/msal-react";
import { getGraphClient } from "@/services/graphService";
import { UnitService } from "@/services/unitService";

export const useUnits = () => {
    const { instance: msalInstance } = useMsal();

    return useQuery({
        queryKey: ["strategyUnits"],
        queryFn: async () => {
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error("No Graph Client");

            try {
                const service = new UnitService(graphClient);
                const units = await service.getUnits();
                return units;
            } catch (error) {
                console.warn("[useUnits] Error fetching units:", error);
                return [];
            }
        },
        enabled: !!msalInstance.getActiveAccount(),
        staleTime: 1000 * 60 * 5, // 5 mins
    });
};
