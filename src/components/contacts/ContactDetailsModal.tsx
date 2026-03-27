import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MicrosoftContact } from '@/hooks/useMicrosoftContacts';
import { Mail, Phone, Calendar as CalendarIcon, X, Send, Copy, Building as BuildingIcon, Pencil, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn, compressImage } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { useEmployeePhotos } from '@/hooks/useEmployeePhotos';
import { useState } from 'react';

interface ContactDetailsModalProps {
    contact: MicrosoftContact | null;
    isOpen: boolean;
    onClose: () => void;
    photoUrl?: string;
    modalPhotoUrl?: string;
}

const ContactDetailsModal: React.FC<ContactDetailsModalProps> = (props) => {
    const { contact, isOpen, onClose, photoUrl: initialPhotoUrl } = props;
    const { toast } = useToast();
    const { uploadPhoto } = useEmployeePhotos();
    const [isUploading, setIsUploading] = useState(false);
    const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | undefined>(initialPhotoUrl);

    // Sync initial prop to state when it changes
    React.useEffect(() => {
        setCurrentPhotoUrl(initialPhotoUrl);
    }, [initialPhotoUrl]);

    // State for modal photo, initialized from props
    const [modalPhoto, setModalPhoto] = useState<string | undefined>(props.modalPhotoUrl);
    const [isUploadingModal, setIsUploadingModal] = useState(false);

    // Sync state if props change (e.g. when switching contacts)
    React.useEffect(() => {
        setModalPhoto(props.modalPhotoUrl);
    }, [props.modalPhotoUrl]);

    if (!contact) return null;

    const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        const email = contact.emailAddresses?.[0]?.address;

        if (file && email) {
            setIsUploading(true);
            try {
                // Compress image before upload (max 400px for avatar)
                const compressedFile = await compressImage(file, 400, 0.8);

                // Upload as 'profile' type for now (reuses the main profile photo)
                const newUrl = await uploadPhoto(compressedFile, email, 'profile');
                if (newUrl) {
                    // Cache bust to force reload
                    const timestampedUrl = `${newUrl}?t=${new Date().getTime()}`;
                    setCurrentPhotoUrl(timestampedUrl);
                    toast({
                        title: "Success",
                        description: "Profile photo updated!",
                    });
                }
            } catch (error) {
                console.error("Upload error:", error);
                toast({
                    title: "Error",
                    description: "Failed to upload photo",
                    variant: "destructive"
                });
            } finally {
                setIsUploading(false);
                // Reset input
                event.target.value = '';
            }
        }
    };

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: "Copied!",
            description: `${label} has been copied to your clipboard.`,
            duration: 2000,
        });
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const handleModalPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        const email = contact.emailAddresses?.[0]?.address;

        console.log("📸 [Modal] Upload triggered", { file: file?.name, email });

        if (file && email) {
            setIsUploadingModal(true);
            try {
                // Compress image before upload (max 1280px for modal background)
                const compressedFile = await compressImage(file, 1280, 0.7);

                // Upload as 'modal' type
                console.log("📸 [Modal] Calling uploadPhoto...");

                // Optimistic UI: Set the photo immediately from the local file
                const objectUrl = URL.createObjectURL(compressedFile);
                setModalPhoto(objectUrl);

                // Perform the actual upload in background
                const newUrl = await uploadPhoto(compressedFile, email, 'modal');
                console.log("📸 [Modal] Upload result:", newUrl);

                if (newUrl) {
                    toast({
                        title: "Success",
                        description: "Modal photo updated!",
                    });
                    // Verify if the returned URL is usable (it should be a blob URL now from the service)
                    // If not, we keep our local objectUrl until next reload
                } else {
                    console.warn("📸 [Modal] Upload returned null (service might not be ready)");
                    toast({
                        title: "Upload Failed",
                        description: "Service not ready. Please try again in a moment.",
                        variant: "destructive"
                    });
                }
            } catch (error) {
                console.error("Failed to upload modal photo:", error);
                toast({
                    title: "Upload Failed",
                    description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    variant: "destructive"
                });
                // Revert on failure? (Optional, but good practice. For now, we leave it as user can try again)
            } finally {
                setIsUploadingModal(false);
                // Reset input
                event.target.value = '';
            }
        } else {
            console.warn("📸 [Modal] Missing file or email", { file, email });
        }
    };


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 shadow-2xl flex flex-col md:flex-row h-auto !min-h-0 max-h-[90vh]">
                <DialogTitle className="sr-only">Contact Details for {contact.displayName}</DialogTitle>
                {/* Left Panel: Identity (Red Gradient) - Reduced width to 30% */}
                <div
                    className="w-full md:w-[30%] text-white p-6 md:p-8 flex flex-col justify-end relative overflow-hidden shrink-0 rounded-b-xl md:rounded-xl z-10 group"
                    style={{
                        background: 'linear-gradient(180deg, #8B4049 0%, #A52A2A 30%, #8B0000 70%, #660000 100%)'
                    }}
                >
                    {/* Background Image using <img> tag for better loading performance */}
                    {modalPhoto && (
                        <img
                            src={modalPhoto}
                            alt="Cover"
                            className="absolute inset-0 w-full h-full object-cover z-0"
                            loading="eager"
                        />
                    )}

                    {/* Overlay for readability if photo exists - Using red gradient with opacity */}
                    {modalPhoto && (
                        <div
                            className="absolute inset-0 z-0"
                            style={{
                                background: 'linear-gradient(to bottom, transparent 0%, transparent 55%, rgba(139, 0, 0, 0.65) 85%, rgba(102, 0, 0, 0.9) 100%)'
                            }}
                        ></div>
                    )}

                    {/* Upload Trigger for Modal Photo */}
                    <label
                        htmlFor="modal-hero-upload"
                        className="absolute top-4 right-4 p-2.5 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full cursor-pointer z-50 transition-all duration-200 opacity-0 group-hover:opacity-100"
                        title="Change Cover Photo"
                    >
                        {isUploadingModal ? (
                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                        ) : (
                            <Pencil className="w-5 h-5 text-white" />
                        )}
                    </label>
                    <input
                        type="file"
                        id="modal-hero-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={handleModalPhotoUpload}
                        disabled={isUploadingModal}
                    />

                    <div className="z-10 flex flex-col items-center md:items-start text-center md:text-left mb-8">
                        {/* Name */}
                        <div className="space-y-1">
                            <h2 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight">
                                {contact.givenName || contact.displayName.split(' ')[0]}
                            </h2>
                            <h2 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight">
                                {contact.surname || contact.displayName.split(' ').slice(1).join(' ')}
                            </h2>
                            <div className="w-12 h-1 bg-white/30 mt-4 rounded-full mx-auto md:mx-0"></div>
                        </div>
                    </div>

                    {/* Employee ID (Bottom) - Made smaller */}
                    <div className="z-10 text-center md:text-left">
                        <p className="text-[10px] font-medium tracking-[0.2em] text-white/50 uppercase">
                            ID: {contact.id.slice(0, 8).toUpperCase()}
                        </p>
                    </div>
                </div>

                {/* Right Panel: Details (White) - Increased width to 70% - Flex Col for Sticky Footer */}
                <div className="w-full md:w-[70%] bg-white dark:bg-gray-900 relative flex flex-col overflow-hidden">

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 md:p-8">

                        <div className="flex justify-between items-start mb-8 pr-12">
                            <div className="space-y-6">
                                {/* Status Indicator - Badge Style */}
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-500/20">
                                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                        <span className="text-[10px] font-bold tracking-wider uppercase">Active</span>
                                    </span>
                                </div>

                                {/* Designation */}
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Designation</p>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">{contact.jobTitle || 'Staff Member'}</h3>
                                </div>
                            </div>

                            {/* Avatar/Initials Box - Moves to Right */}
                            <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-center border border-gray-100 dark:border-white/10 shadow-sm shrink-0 ml-4 overflow-hidden relative group">
                                {currentPhotoUrl ? (
                                    <img
                                        src={currentPhotoUrl}
                                        alt={contact.displayName}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-3xl md:text-4xl font-bold tracking-wider text-[#8B0000] dark:text-red-500">{getInitials(contact.displayName)}</span>
                                )}

                                {/* Hover Overlay */}
                                <label
                                    htmlFor="modal-photo-upload"
                                    className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                >
                                    {isUploading ? (
                                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                                    ) : (
                                        <Pencil className="w-6 h-6 text-white" />
                                    )}
                                </label>
                                <input
                                    type="file"
                                    id="modal-photo-upload"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handlePhotoUpload}
                                    disabled={isUploading}
                                />
                            </div>
                        </div>

                        {/* Division & Unit Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 pb-8 border-b border-gray-100 dark:border-white/10">
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Division</p>
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-snug">
                                    {contact.officeLocation || 'Unassigned'}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Unit</p>
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-snug">
                                    {contact.department || 'Unassigned'}
                                </p>
                            </div>
                        </div>

                        {/* Contact Info List - Increased Spacing */}
                        <div className="space-y-5 mb-auto">
                            <TooltipProvider delayDuration={300}>
                                {/* Email */}
                                <div className="flex items-center group">
                                    <div className="w-10 h-10 shrink-0 rounded-lg bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-400 dark:text-gray-500 mr-4 group-hover:bg-red-50 dark:group-hover:bg-red-900/20 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors duration-300">
                                        <span className="text-lg font-serif italic">@</span>
                                    </div>
                                    <div className="grow min-w-0">
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Email Address</p>
                                        <div className="flex items-center gap-2">
                                            <a
                                                href={`mailto:${contact.emailAddresses?.[0]?.address}`}
                                                className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-red-700 dark:hover:text-red-400 transition-colors truncate"
                                            >
                                                {contact.emailAddresses?.[0]?.address || 'No email'}
                                            </a>
                                            {contact.emailAddresses?.[0] && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleCopy(contact.emailAddresses![0].address, "Email"); }}
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600"
                                                        >
                                                            <Copy size={12} />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Copy Email</TooltipContent>
                                                </Tooltip>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Business Phone */}
                                {contact.businessPhones?.[0] && (
                                    <div className="flex items-center group">
                                        <div className="w-10 h-10 shrink-0 rounded-lg bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-400 dark:text-gray-500 mr-4 group-hover:bg-red-50 dark:group-hover:bg-red-900/20 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors duration-300">
                                            <BuildingIcon size={18} />
                                        </div>
                                        <div className="grow">
                                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Business Line</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{contact.businessPhones[0]}</p>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleCopy(contact.businessPhones![0], "Phone"); }}
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600"
                                                        >
                                                            <Copy size={12} />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Copy Number</TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Mobile Phone */}
                                {contact.mobilePhone && (
                                    <div className="flex items-center group">
                                        <div className="w-10 h-10 shrink-0 rounded-lg bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-400 dark:text-gray-500 mr-4 group-hover:bg-red-50 dark:group-hover:bg-red-900/20 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors duration-300">
                                            <Phone size={18} />
                                        </div>
                                        <div className="grow">
                                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Mobile</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{contact.mobilePhone}</p>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleCopy(contact.mobilePhone!, "Mobile"); }}
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600"
                                                        >
                                                            <Copy size={12} />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Copy Number</TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </TooltipProvider>
                        </div>

                    </div>

                    {/* sticky Actions Footer */}
                    <div className="shrink-0 p-6 md:p-8 pt-4 border-t border-gray-100 dark:border-white/10 bg-white dark:bg-gray-900 z-20">
                        <div className="flex gap-4">
                            <Button
                                className="flex-1 bg-[#8B0000] hover:bg-[#6d0000] text-white rounded-lg h-11 font-medium tracking-wide shadow-md hover:shadow-lg transition-all"
                                onClick={() => contact.emailAddresses?.[0] && window.open(`mailto:${contact.emailAddresses[0].address}`)}
                            >
                                <Send size={16} className="mr-2" /> SEND EMAIL
                            </Button>
                            <Button
                                variant="secondary"
                                className="flex-1 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-900 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg h-11 font-medium tracking-wide transition-all"
                                onClick={() => {
                                    const phone = contact.mobilePhone || contact.businessPhones?.[0];
                                    if (phone) window.open(`tel:${phone}`);
                                    else toast({ title: "No phone number", description: "This contact does not have a phone number listed.", variant: "destructive" });
                                }}
                            >
                                <Phone size={16} className="mr-2" /> CALL
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// Renaming the custom icon to avoid conflict if I used the same name, though I used BuildingIcon alias for lucide
function CustomBuildingIcon({ size, className }: { size?: number, className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size || 24}
            height={size || 24}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
            <path d="M9 22v-4h6v4" />
            <path d="M8 6h.01" />
            <path d="M16 6h.01" />
            <path d="M12 6h.01" />
            <path d="M12 10h.01" />
            <path d="M12 14h.01" />
            <path d="M16 10h.01" />
            <path d="M16 14h.01" />
            <path d="M8 10h.01" />
            <path d="M8 14h.01" />
        </svg>
    );
}

export default ContactDetailsModal;
