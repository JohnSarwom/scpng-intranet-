import { useState, useEffect, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { EmployeePhotosService } from '@/services/employeePhotosService';

export const useEmployeePhotos = () => {
    const { instance } = useMsal();
    const [photoService, setPhotoService] = useState<EmployeePhotosService | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const initService = async () => {
            try {
                const client = await getGraphClient(instance);
                if (client) {
                    const service = new EmployeePhotosService(client);
                    setPhotoService(service); // Set immediately so methods can be called (they handle init internally)
                    await service.initialize();
                    setIsInitialized(true);
                }
            } catch (error) {
                console.error('Failed to initialize employee photos service:', error);
            }
        };

        if (instance) {
            initService();
        }
    }, [instance]);

    const getPhotoUrl = useCallback(async (email: string): Promise<string | null> => {
        if (!photoService || !email) return null;
        return await photoService.getPhotoUrl(email);
    }, [photoService]);

    const getPhotoWithThumbnail = useCallback(async (email: string) => {
        if (!photoService || !email) return null;
        return await photoService.getPhotoWithThumbnail(email);
    }, [photoService]);

    const getPhotosForEmails = useCallback(async (emails: string[]) => {
        if (!photoService) return new Map<string, { profileUrl?: string; modalUrl?: string }>();
        return await photoService.getPhotosForEmails(emails);
    }, [photoService]);

    const getEmployeePhotos = useCallback(async (email: string) => {
        if (!photoService || !email) return { profileUrl: undefined, modalUrl: undefined };
        return await photoService.getEmployeePhotos(email);
    }, [photoService]);

    const getPhotoByFilename = useCallback(async (email: string, filename: string, modified?: string) => {
        if (!photoService || !email || !filename) return { profileUrl: undefined };
        return await photoService.getPhotoByFilename(email, filename, modified);
    }, [photoService]);

    const uploadPhoto = useCallback(async (file: File, email: string, type: 'profile' | 'modal' = 'profile'): Promise<string | null> => {
        if (!photoService) return null;
        try {
            return await photoService.uploadPhoto(file, email, type);
        } catch (error) {
            console.error("Failed to upload photo:", error);
            throw error;
        }
    }, [photoService]);

    return {
        getPhotoUrl,
        getEmployeePhotos,
        getPhotoWithThumbnail,
        getPhotosForEmails,
        getPhotoByFilename,
        uploadPhoto,
        isInitialized
    };
};
