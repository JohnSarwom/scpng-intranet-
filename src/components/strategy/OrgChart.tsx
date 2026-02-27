
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Building2, Users, Mail, Phone, Maximize, Minimize, ZoomIn, ZoomOut, RotateCcw, Loader2 } from 'lucide-react';
import OfficerProfileModal, { type OfficerProfile } from './OfficerProfileModal';
import { useOfficerProfiles } from '@/hooks/useOfficerProfiles';
import { useEmployeePhotos } from '@/hooks/useEmployeePhotos';

// Using a distinct color palette based on the user's image
// Dark Maroon: #600018 (Approximate from previous code, adjusting to match image)
// Lighter Maroon/Red: #800020
// Highlight Cream: #FDF5E6 (Old Lace) or similar
// Connector Color: #E5E7EB (Gray 200) or lighter

const OrgNode = ({
    title,
    type = 'unit',
    className = ''
}: {
    title: string;
    type?: 'ceo' | 'division' | 'unit' | 'highlight';
    className?: string;
}) => {
    const baseStyles = "flex items-center justify-center text-center px-4 py-3 rounded-md shadow-sm transition-all border w-full max-w-[220px] z-10 relative";

    let variantStyles = "";

    switch (type) {
        case 'ceo':
            variantStyles = "bg-[#600018] border-[#400010] text-white font-bold text-lg min-w-[280px] py-4 shadow-md";
            break;
        case 'division':
            variantStyles = "bg-[#800020] border-[#600018] text-white font-semibold text-sm h-16 shadow-md"; // Fixed height for alignment
            break;
        case 'highlight':
            // The Secretariat Unit style
            variantStyles = "bg-[#FFF8E7] border-amber-300 text-[#600018] font-bold text-sm shadow-md";
            break;
        case 'unit':
        default:
            variantStyles = "bg-[#901025] border-[#800020] text-white font-medium text-xs hover:bg-[#800020] shadow-sm";
            break;
    }

    return (
        <div className={`${baseStyles} ${variantStyles} ${className}`}>
            {title}
        </div>
    );
};

const CHAIRMAN_OFFICE = {
    divisionName: "Office of the Chairman",
    units: [
        { unitName: "Executive Division" },
        { unitName: "Secretariat Unit", isHighlight: true }
    ]
};

const ORG_DIVISIONS = [
    {
        divisionName: "Corporate Services Division",
        units: [
            { unitName: "Finance Unit" },
            { unitName: "IT Unit" },
            { unitName: "Human Resource Unit" }
        ]
    },
    {
        divisionName: "Licensing, Market & Supervision Division",
        units: [
            { unitName: "Licensing Unit" },
            { unitName: "Supervision Unit" },
            { unitName: "Market Data Unit" },
            { unitName: "Investigations Unit" }
        ]
    },
    {
        divisionName: "Legal Services Division",
        units: [
            { unitName: "Legal Advisory Unit" }
        ]
    },
    {
        divisionName: "Research & Publication Division",
        units: [
            { unitName: "Research Unit" },
            { unitName: "Publication Unit" }
        ]
    }
];

interface ProfileUnit {
    unitName: string;
    officers: OfficerProfile[];
}

interface ProfileDivision {
    divisionName: string;
    units: ProfileUnit[];
}

const OfficerCard = ({ officer, onClick }: { officer: OfficerProfile; onClick?: (officer: OfficerProfile) => void }) => {
    const initials = officer.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return (
        <div
            className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow w-full cursor-pointer"
            onClick={() => onClick?.(officer)}
        >
            <div className="flex items-start gap-3">
                {officer.photoUrl ? (
                    <img
                        src={officer.photoUrl}
                        alt={officer.name}
                        className="w-10 h-10 rounded-full border border-gray-100 object-cover flex-shrink-0 shadow-sm"
                    />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-[#600018] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {initials}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{officer.name}</p>
                    <p className="text-xs text-[#800020] font-medium truncate">{officer.jobTitle}</p>
                    <div className="flex items-center gap-1 mt-1">
                        <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="text-[10px] text-gray-500 truncate">
                            {officer.email}
                        </span>
                    </div>
                    {officer.phone && (
                        <div className="flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="text-[10px] text-gray-500">{officer.phone}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const StructureView = () => (
    <>
        {/* CEO Node */}
        <div className="flex flex-col items-center relative mb-12">
            <OrgNode title="Chief Executive Officer (CEO)" type="ceo" />
            <div className="w-px h-8 bg-gray-300 absolute -bottom-8 left-1/2 -translate-x-1/2"></div>
        </div>

        {/* Office of the Chairman - intermediate tier */}
        <div className="flex flex-col items-center relative mb-12">
            <OrgNode title={CHAIRMAN_OFFICE.divisionName} type="division" className="mb-6" />
            {/* Units under Chairman */}
            <div className="flex flex-col items-center w-full gap-3 relative">
                <div
                    className="absolute top-0 bottom-4 left-1/2 -translate-x-1/2 w-px bg-gray-300 z-0"
                    style={{ height: `calc(100% - 20px)` }}
                ></div>
                {CHAIRMAN_OFFICE.units.map((unit, uIndex) => (
                    <div key={uIndex} className="relative z-10 w-full flex justify-center">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-gray-300"></div>
                        <OrgNode
                            title={unit.unitName}
                            type={unit.isHighlight ? 'highlight' : 'unit'}
                            className="w-[90%]"
                        />
                    </div>
                ))}
            </div>
            {/* Vertical line down to divisions */}
            <div className="w-px h-8 bg-gray-300 mt-4"></div>
        </div>

        {/* Divisions row */}
        <div className="flex justify-center items-start w-full">
            {ORG_DIVISIONS.map((division, index) => {
                const isFirst = index === 0;
                const isLast = index === ORG_DIVISIONS.length - 1;

                return (
                    <div key={index} className="flex flex-col items-center relative flex-1 min-w-[180px] px-2 lg:px-4">
                        {!isFirst && <div className="absolute -top-4 left-0 w-1/2 h-px bg-gray-300"></div>}
                        {!isLast && <div className="absolute -top-4 right-0 w-1/2 h-px bg-gray-300"></div>}
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 h-4 w-px bg-gray-300"></div>

                        <OrgNode
                            title={division.divisionName}
                            type="division"
                            className="mb-6 w-full"
                        />

                        <div className="flex flex-col items-center w-full gap-3 relative">
                            {division.units.length > 0 && (
                                <>
                                    <div
                                        className="absolute top-0 bottom-4 left-1/2 -translate-x-1/2 w-px bg-gray-300 z-0"
                                        style={{ height: `calc(100% - 20px)` }}
                                    ></div>
                                    {division.units.map((unit, uIndex) => (
                                        <div key={uIndex} className="relative z-10 w-full flex justify-center">
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-gray-300"></div>
                                            <OrgNode
                                                title={unit.unitName}
                                                type={'unit'}
                                                className="w-[90%]"
                                            />
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    </>
);

const ProfilesView = ({
    ceoOfficer,
    chairmanOfficeProfile,
    profileDivisions,
    onOfficerClick
}: {
    ceoOfficer: OfficerProfile | null,
    chairmanOfficeProfile: any,
    profileDivisions: ProfileDivision[],
    onOfficerClick: (officer: OfficerProfile) => void
}) => (
    <>
        {/* CEO Node + James Joshua card */}
        <div className="flex flex-col items-center relative mb-12">
            <OrgNode title="Chief Executive Officer (CEO)" type="ceo" />
            <div className="w-px h-4 bg-gray-300"></div>
            {ceoOfficer && (
                <div className="w-[260px]">
                    <OfficerCard officer={ceoOfficer} onClick={onOfficerClick} />
                </div>
            )}
            <div className="w-px h-8 bg-gray-300 absolute -bottom-8 left-1/2 -translate-x-1/2"></div>
        </div>

        {/* Office of the Chairman - intermediate tier */}
        <div className="flex flex-col items-center relative mb-12">
            <OrgNode title={chairmanOfficeProfile.divisionName} type="division" className="mb-4" />
            {/* Executive Division on top, then Secretariat Unit below */}
            <div className="flex flex-col items-center gap-3 relative">
                <div
                    className="absolute top-0 bottom-4 left-1/2 -translate-x-1/2 w-px bg-gray-300 z-0"
                    style={{ height: `calc(100% - 20px)` }}
                ></div>

                {/* Executive Division */}
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-px h-3 bg-gray-300"></div>
                    <div className="bg-[#901025] border border-[#800020] text-white font-medium text-xs rounded-md px-3 py-2 text-center min-w-[180px] shadow-sm">
                        {chairmanOfficeProfile.executiveDivision.unitName}
                    </div>
                </div>

                {/* Secretariat Unit with officers */}
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-px h-3 bg-gray-300"></div>
                    <div className="bg-[#FFF8E7] border border-amber-300 text-[#600018] font-bold text-xs rounded-md px-3 py-2 text-center min-w-[180px] shadow-sm mb-2">
                        {chairmanOfficeProfile.secretariatUnit.unitName}
                    </div>
                    <div className="w-[220px] flex flex-col gap-1.5">
                        {chairmanOfficeProfile.secretariatUnit.officers.map((officer: OfficerProfile, oIndex: number) => (
                            <OfficerCard key={oIndex} officer={officer} onClick={onOfficerClick} />
                        ))}
                    </div>
                </div>
            </div>
            {/* Vertical line down to divisions */}
            <div className="w-px h-8 bg-gray-300 mt-4"></div>
        </div>

        {/* Divisions row with officer profiles */}
        <div className="flex justify-center items-start w-full">
            {profileDivisions.map((division, index) => {
                const isFirst = index === 0;
                const isLast = index === profileDivisions.length - 1;

                return (
                    <div key={index} className="flex flex-col items-center relative flex-1 min-w-[220px] px-2 lg:px-3">
                        {!isFirst && <div className="absolute -top-4 left-0 w-1/2 h-px bg-gray-300"></div>}
                        {!isLast && <div className="absolute -top-4 right-0 w-1/2 h-px bg-gray-300"></div>}
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 h-4 w-px bg-gray-300"></div>

                        <OrgNode
                            title={division.divisionName}
                            type="division"
                            className="mb-6 w-full"
                        />

                        <div className="flex flex-col items-center w-full gap-4 relative">
                            {division.units.length > 0 && (
                                <>
                                    <div
                                        className="absolute top-0 bottom-4 left-1/2 -translate-x-1/2 w-px bg-gray-300 z-0"
                                        style={{ height: `calc(100% - 20px)` }}
                                    ></div>
                                    {division.units.map((unit, uIndex) => (
                                        <div key={uIndex} className="relative z-10 w-full flex flex-col items-center">
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-gray-300"></div>
                                            <div className="bg-[#901025] border border-[#800020] text-white font-medium text-xs rounded-md px-3 py-2 text-center w-[90%] shadow-sm mb-2">
                                                {unit.unitName}
                                            </div>
                                            <div className="w-[95%] flex flex-col gap-1.5">
                                                {unit.officers.map((officer, oIndex) => (
                                                    <OfficerCard key={oIndex} officer={officer} onClick={onOfficerClick} />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    </>
);

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;

const OrgChart = () => {
    const [view, setView] = useState<'structure' | 'profiles'>('structure');
    const [zoom, setZoom] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [selectedOfficer, setSelectedOfficer] = useState<OfficerProfile | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleZoomIn = useCallback(() => {
        setZoom(prev => Math.min(prev + ZOOM_STEP, ZOOM_MAX));
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoom(prev => Math.max(prev - ZOOM_STEP, ZOOM_MIN));
    }, []);

    const handleResetZoom = useCallback(() => {
        setZoom(1);
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (!containerRef.current) return;

        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }, []);

    useEffect(() => {
        const handleChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleChange);
        return () => document.removeEventListener('fullscreenchange', handleChange);
    }, []);

    const zoomPercent = Math.round(zoom * 100);

    const { data: rawProfiles = [], isLoading, error: fetchError } = useOfficerProfiles();
    const { getPhotosForEmails, getPhotoByFilename, isInitialized: photosInitialized } = useEmployeePhotos();
    const [photoUrls, setPhotoUrls] = useState<Map<string, { profileUrl?: string; modalUrl?: string }>>(new Map());

    useEffect(() => {
        const fetchPhotos = async () => {
            if (rawProfiles.length > 0 && photosInitialized) {
                // 1. First pass: batch fetch by email
                const emails = rawProfiles.map(p => p.email).filter(Boolean);
                const batchPhotos = await getPhotosForEmails(emails);

                const finalMap = new Map(batchPhotos);

                // 2. Second pass: fallback for missing but having profileImageUrl (filename path)
                await Promise.all(rawProfiles.map(async (p) => {
                    if (p.email && !finalMap.get(p.email)?.profileUrl && p.profileImageUrl) {
                        try {
                            const filename = p.profileImageUrl.split('/').pop()?.split('?')[0];
                            if (filename) {
                                const photo = await getPhotoByFilename(p.email, filename);
                                if (photo.profileUrl) {
                                    finalMap.set(p.email, photo);
                                }
                            }
                        } catch (e) {
                            console.error("Fallback photo fetch failed for", p.email, e);
                        }
                    }
                }));

                setPhotoUrls(finalMap);
            }
        };
        fetchPhotos();
    }, [rawProfiles, photosInitialized, getPhotosForEmails, getPhotoByFilename]);

    const profiles = rawProfiles.map(p => ({
        ...p,
        photoUrl: photoUrls.get(p.email)?.profileUrl,
        modalUrl: photoUrls.get(p.email)?.modalUrl
    }));

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-[#600018]" />
                <span className="ml-4 text-[#600018] font-medium">Loading Organization Structure...</span>
            </div>
        );
    }
    if (fetchError) {
        return (
            <div className="flex h-96 items-center justify-center text-red-500">
                Failed to load profiles. Please ensure the SharePoint list is created and seeded.
            </div>
        );
    }

    const ceoOfficer = profiles.find(p => p.division === "Office of the Chairman" && p.unit === "Executive Division") || null;
    const secretariatOfficers = profiles.filter(p => p.division === "Office of the Chairman" && p.unit === "Secretariat Unit");

    const chairmanOfficeProfile = {
        divisionName: "Office of the Chairman",
        executiveDivision: { unitName: "Executive Division" },
        secretariatUnit: {
            unitName: "Secretariat Unit",
            officers: secretariatOfficers
        }
    };

    const orgDivisionNames = [
        "Corporate Services Division",
        "Licensing, Market & Supervision Division",
        "Legal Services Division",
        "Research & Publication Division"
    ];

    const profileDivisions: ProfileDivision[] = orgDivisionNames.map(divName => {
        const divProfiles = profiles.filter(p => p.division === divName);
        const staticDiv = ORG_DIVISIONS.find(d => d.divisionName === divName);
        const unitNames = staticDiv ? staticDiv.units.map(u => u.unitName) : Array.from(new Set(divProfiles.map(p => p.unit).filter(Boolean)));

        return {
            divisionName: divName,
            units: unitNames.map(unitName => ({
                unitName,
                officers: divProfiles.filter(p => p.unit === unitName)
            }))
        };
    });

    return (
        <div
            ref={containerRef}
            className={`w-full overflow-auto p-8 min-h-[600px] flex flex-col items-center ${isFullscreen ? 'bg-white' : 'bg-transparent'
                }`}
        >
            {/* Title + Controls Row */}
            <div className="w-full flex items-start justify-between mb-12">
                <div className="flex-1" />
                <h2 className="text-[#600018] text-2xl font-sans font-bold uppercase tracking-widest text-center flex-1">
                    Securities Commission of Papua New Guinea
                </h2>
                <div className="flex-1 flex justify-end items-center gap-2">
                    {/* View Toggle */}
                    <div className="inline-flex rounded-lg border border-gray-300 bg-gray-100 p-0.5 shadow-sm">
                        <button
                            onClick={() => setView('structure')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'structure'
                                ? 'bg-[#600018] text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                }`}
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            Structure
                        </button>
                        <button
                            onClick={() => setView('profiles')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'profiles'
                                ? 'bg-[#600018] text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                }`}
                        >
                            <Users className="w-3.5 h-3.5" />
                            Profiles
                        </button>
                    </div>

                    {/* Zoom Controls */}
                    <div className="inline-flex items-center rounded-lg border border-gray-300 bg-gray-100 p-0.5 shadow-sm">
                        <button
                            onClick={handleZoomOut}
                            disabled={zoom <= ZOOM_MIN}
                            className="p-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Zoom out"
                        >
                            <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={handleResetZoom}
                            className="px-1.5 py-1 text-[10px] font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-md transition-all min-w-[40px] text-center"
                            title="Reset zoom"
                        >
                            {zoomPercent}%
                        </button>
                        <button
                            onClick={handleZoomIn}
                            disabled={zoom >= ZOOM_MAX}
                            className="p-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Zoom in"
                        >
                            <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Fullscreen Button */}
                    <button
                        onClick={toggleFullscreen}
                        className="inline-flex items-center p-1.5 rounded-lg border border-gray-300 bg-gray-100 shadow-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-all"
                        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    >
                        {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>

            {/* Zoomable chart content */}
            <div
                className="w-full flex flex-col items-center origin-top transition-transform duration-200"
                style={{ transform: `scale(${zoom})` }}
            >
                {view === 'structure' ? (
                    <StructureView />
                ) : (
                    <ProfilesView
                        ceoOfficer={ceoOfficer}
                        chairmanOfficeProfile={chairmanOfficeProfile}
                        profileDivisions={profileDivisions}
                        onOfficerClick={setSelectedOfficer}
                    />
                )}
            </div>

            {/* Officer Profile Modal */}
            <OfficerProfileModal
                officer={selectedOfficer}
                open={!!selectedOfficer}
                onClose={() => setSelectedOfficer(null)}
            />
        </div>
    );
};

export default OrgChart;
