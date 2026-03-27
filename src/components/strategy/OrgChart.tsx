
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Building2, Users, Mail, Phone, Maximize, Minimize, ZoomIn, ZoomOut, RotateCcw, Loader2 } from 'lucide-react';
import OfficerProfileModal, { type OfficerProfile } from './OfficerProfileModal';
import { useOfficerProfiles } from '@/hooks/useOfficerProfiles';
import { useEmployeePhotos } from '@/hooks/useEmployeePhotos';
import { useDivisions } from '@/hooks/useDivisions';
import { useUnits } from '@/hooks/useUnits';
import DivisionModal, { type MockDivisionData } from './DivisionModal';
import UnitModal, { type MockUnitData } from './UnitModal';

// Removed MOCK_DIVISIONS_DATA and MOCK_UNITS_DATA

// Using a distinct color palette based on the user's image
// Dark Maroon: #600018 (Approximate from previous code, adjusting to match image)
// Lighter Maroon/Red: #800020
// Highlight Cream: #FDF5E6 (Old Lace) or similar
// Connector Color: #E5E7EB (Gray 200) or lighter

const OrgNode = ({
    title,
    type = 'unit',
    className = '',
    onClick
}: {
    title: string;
    type?: 'ceo' | 'division' | 'unit' | 'highlight';
    className?: string;
    onClick?: () => void;
}) => {
    const baseStyles = `flex items-center justify-center text-center px-4 py-3 rounded-md shadow-sm transition-all border w-full max-w-[220px] z-10 relative ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-[#800020]' : ''}`;

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
            variantStyles = "bg-[#FFF8E7] dark:bg-amber-950/20 border-amber-300 dark:border-amber-500/50 text-[#600018] dark:text-amber-200 font-bold text-sm shadow-md";
            break;

        case 'unit':
        default:
            variantStyles = "bg-[#901025] border-[#800020] text-white font-medium text-xs hover:bg-[#800020] shadow-sm";
            break;
    }

    return (
        <div className={`${baseStyles} ${variantStyles} ${className}`} onClick={onClick}>
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
    headOfficer?: OfficerProfile;
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
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow w-full cursor-pointer"
            onClick={() => onClick?.(officer)}
        >
            <div className="flex items-start gap-3">
                {officer.photoUrl ? (
                    <img
                        src={officer.photoUrl}
                        alt={officer.name}
                        className="w-10 h-10 rounded-full border border-gray-100 dark:border-white/5 object-cover flex-shrink-0 shadow-sm"
                    />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-[#600018] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {initials}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{officer.name}</p>
                    <p className="text-xs text-[#800020] dark:text-intranet-primary-light font-medium truncate">{officer.jobTitle}</p>
                    <div className="flex items-center gap-1 mt-1">
                        <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                            {officer.email}
                        </span>
                    </div>
                    {officer.phone && (
                        <div className="flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">{officer.phone}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>

    );
};

const StructureView = ({ profileDivisions, onDivisionClick, onUnitClick }: { profileDivisions: ProfileDivision[], onDivisionClick: (divName: string) => void, onUnitClick: (unitName: string) => void }) => (
    <>
        {/* CEO Node */}
        <div className="flex flex-col items-center relative mb-12">
            <OrgNode title="Chief Executive Officer (CEO)" type="ceo" />
            <div className="w-px h-8 bg-gray-300 dark:bg-white/20 absolute -bottom-8 left-1/2 -translate-x-1/2"></div>
        </div>


        {/* Office of the Chairman - intermediate tier */}
        <div className="flex flex-col items-center relative mb-12">
            <OrgNode title={CHAIRMAN_OFFICE.divisionName} type="division" className="mb-6" onClick={() => onDivisionClick(CHAIRMAN_OFFICE.divisionName)} />
            {/* Units under Chairman */}
            <div className="flex flex-col items-center w-full gap-3 relative">
                <div
                    className="absolute top-0 bottom-4 left-1/2 -translate-x-1/2 w-px bg-gray-300 dark:bg-white/20 z-0"
                    style={{ height: `calc(100% - 20px)` }}
                ></div>
                {CHAIRMAN_OFFICE.units.map((unit, uIndex) => (
                    <div key={uIndex} className="relative z-10 w-full flex justify-center">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-gray-300 dark:bg-white/20"></div>
                        <OrgNode
                            title={unit.unitName}
                            type={unit.isHighlight ? 'highlight' : 'unit'}
                            className="w-[90%]"
                            onClick={() => onUnitClick(unit.unitName)}
                        />
                    </div>
                ))}
            </div>
            {/* Vertical line down to divisions */}
            <div className="w-px h-8 bg-gray-300 dark:bg-white/20 mt-4"></div>
        </div>


        {/* Divisions row */}
        <div className="flex justify-center items-start w-full">
            {profileDivisions.map((division, index) => {
                const isFirst = index === 0;
                const isLast = index === profileDivisions.length - 1;

                return (
                    <div key={index} className="flex flex-col items-center relative flex-1 min-w-[180px] px-2 lg:px-4">
                        {!isFirst && <div className="absolute -top-4 left-0 w-1/2 h-px bg-gray-300 dark:bg-white/20"></div>}
                        {!isLast && <div className="absolute -top-4 right-0 w-1/2 h-px bg-gray-300 dark:bg-white/20"></div>}
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 h-4 w-px bg-gray-300 dark:bg-white/20"></div>


                        <OrgNode
                            title={division.divisionName}
                            type="division"
                            className="mb-6 w-full"
                            onClick={() => onDivisionClick(division.divisionName)}
                        />

                        <div className="flex flex-col items-center w-full gap-3 relative">
                            {division.units.length > 0 && (
                                <>
                                    <div
                                        className="absolute top-0 bottom-4 left-1/2 -translate-x-1/2 w-px bg-gray-300 dark:bg-white/20 z-0"
                                        style={{ height: `calc(100% - 20px)` }}
                                    ></div>
                                    {division.units.map((unit, uIndex) => (
                                        <div key={uIndex} className="relative z-10 w-full flex justify-center">
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-gray-300 dark:bg-white/20"></div>

                                            <OrgNode
                                                title={unit.unitName}
                                                type={'unit'}
                                                className="w-[90%]"
                                                onClick={() => onUnitClick(unit.unitName)}
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
    onOfficerClick,
    onDivisionClick,
    onUnitClick
}: {
    ceoOfficer: OfficerProfile | null,
    chairmanOfficeProfile: any,
    profileDivisions: ProfileDivision[],
    onOfficerClick: (officer: OfficerProfile) => void,
    onDivisionClick: (divName: string) => void,
    onUnitClick: (unitName: string) => void
}) => (
    <>
        {/* CEO Node + James Joshua card */}
        <div className="flex flex-col items-center relative mb-12">
            <OrgNode title="Chief Executive Officer (CEO)" type="ceo" />
            <div className="w-px h-4 bg-gray-300 dark:bg-white/20"></div>
            {ceoOfficer && (
                <div className="w-[260px]">
                    <OfficerCard officer={ceoOfficer} onClick={onOfficerClick} />
                </div>
            )}
            <div className="w-px h-8 bg-gray-300 dark:bg-white/20 absolute -bottom-8 left-1/2 -translate-x-1/2"></div>
        </div>


        {/* Office of the Chairman - intermediate tier */}
        <div className="flex flex-col items-center relative mb-12">
            <OrgNode title={chairmanOfficeProfile.divisionName} type="division" className="mb-4" onClick={() => onDivisionClick(chairmanOfficeProfile.divisionName)} />
            {/* Executive Division on top, then Secretariat Unit below */}
            <div className="flex flex-col items-center gap-3 relative">
                <div
                    className="absolute top-0 bottom-4 left-1/2 -translate-x-1/2 w-px bg-gray-300 dark:bg-white/20 z-0"
                    style={{ height: `calc(100% - 20px)` }}
                ></div>


                {/* Executive Division */}
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-px h-3 bg-gray-300 dark:bg-white/20"></div>

                    <OrgNode
                        title={chairmanOfficeProfile.executiveDivision.unitName}
                        type="unit"
                        className="mb-2"
                        onClick={() => onUnitClick(chairmanOfficeProfile.executiveDivision.unitName)}
                    />
                </div>

                {/* Secretariat Unit with officers */}
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-px h-3 bg-gray-300 dark:bg-white/20"></div>
                    <OrgNode
                        title={chairmanOfficeProfile.secretariatUnit.unitName}
                        type="highlight"
                        className="mb-2 dark:bg-amber-900/20 dark:border-amber-500/30 dark:text-amber-200"
                        onClick={() => onUnitClick(chairmanOfficeProfile.secretariatUnit.unitName)}
                    />
                    <div className="w-[220px] flex flex-col gap-1.5">
                        {chairmanOfficeProfile.secretariatUnit.officers.map((officer: OfficerProfile, oIndex: number) => (
                            <OfficerCard key={oIndex} officer={officer} onClick={onOfficerClick} />
                        ))}
                    </div>
                </div>
            </div>
            {/* Vertical line down to divisions */}
            <div className="w-px h-8 bg-gray-300 dark:bg-white/20 mt-4"></div>
        </div>


        {/* Divisions row with officer profiles */}
        <div className="flex justify-center items-start w-full">
            {profileDivisions.map((division, index) => {
                const isFirst = index === 0;
                const isLast = index === profileDivisions.length - 1;

                return (
                    <div key={index} className="flex flex-col items-center relative flex-1 min-w-[220px] px-2 lg:px-3">
                        {!isFirst && <div className="absolute -top-4 left-0 w-1/2 h-px bg-gray-300 dark:bg-white/20"></div>}
                        {!isLast && <div className="absolute -top-4 right-0 w-1/2 h-px bg-gray-300 dark:bg-white/20"></div>}
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 h-4 w-px bg-gray-300 dark:bg-white/20"></div>


                        <OrgNode
                            title={division.divisionName}
                            type="division"
                            className="mb-6 w-full"
                            onClick={() => onDivisionClick(division.divisionName)}
                        />

                        <div className="flex flex-col items-center w-full gap-4 relative">
                            {(division.units.length > 0 || division.headOfficer) && (
                                <>
                                    <div
                                        className="absolute -top-6 bottom-4 left-1/2 -translate-x-1/2 w-px bg-gray-300 dark:bg-white/20 z-0"
                                    ></div>


                                    {division.headOfficer && (
                                        <div className="relative z-10 w-[95%] flex flex-col items-center mb-2">
                                            <OfficerCard officer={division.headOfficer} onClick={onOfficerClick} />
                                        </div>
                                    )}

                                    {division.units.length > 0 && division.units.map((unit, uIndex) => (
                                        <div key={uIndex} className="relative z-10 w-full flex flex-col items-center">
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-gray-300 dark:bg-white/20"></div>

                                            <OrgNode
                                                title={unit.unitName}
                                                type="unit"
                                                className="w-[90%] mb-2"
                                                onClick={() => onUnitClick(unit.unitName)}
                                            />
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
    const [selectedDivision, setSelectedDivision] = useState<MockDivisionData | null>(null);
    const [selectedUnit, setSelectedUnit] = useState<MockUnitData | null>(null);
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

    const { data: rawProfiles = [], isLoading: isProfilesLoading, error: profilesError } = useOfficerProfiles();
    const { data: rawDivisions = [], isLoading: isDivisionsLoading, error: divisionsError } = useDivisions();
    const { data: rawUnits = [], isLoading: isUnitsLoading, error: unitsError } = useUnits();

    const isLoading = isProfilesLoading || isDivisionsLoading || isUnitsLoading;
    const fetchError = profilesError || divisionsError || unitsError;

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
                <Loader2 className="h-10 w-10 animate-spin text-[#600018] dark:text-intranet-primary-light" />
                <span className="ml-4 text-[#600018] dark:text-gray-100 font-medium">Loading Organization Structure...</span>
            </div>

        );
    }
    if (fetchError) {
        return (
            <div className="flex h-96 items-center justify-center text-red-500 dark:text-red-400">
                Failed to load data. Please ensure the SharePoint lists are created and seeded.
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
        const staticUnitNames = staticDiv ? staticDiv.units.map(u => u.unitName) : [];
        const dynamicUnitNames = Array.from(new Set(divProfiles.map(p => p.unit).filter(Boolean)));

        const orderWeight = (name: string) => {
            const lower = name.toLowerCase();
            if (lower.includes('director') || lower === 'office of the director' || lower === 'head of division') return -1;
            return 0;
        };

        const allUnitNamesSet = new Set([...staticUnitNames, ...dynamicUnitNames]);
        const allUnitNames = Array.from(allUnitNamesSet).sort((a, b) => {
            const weightA = orderWeight(a);
            const weightB = orderWeight(b);
            if (weightA !== weightB) return weightA - weightB;
            const indexA = staticUnitNames.indexOf(a);
            const indexB = staticUnitNames.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });

        let headOfficer: OfficerProfile | undefined = divProfiles.find(p => {
            const title = (p.jobTitle || '').toLowerCase();
            return title.includes('director') || title === 'general counsel';
        });

        if (!headOfficer) {
            headOfficer = divProfiles.find(p => {
                const title = (p.jobTitle || '').toLowerCase();
                return title.includes('oic') || title.includes('officer in charge');
            });
        }

        if (!headOfficer) {
            headOfficer = divProfiles.find(p => {
                const title = (p.jobTitle || '').toLowerCase();
                return title.includes('legal manager') || title.includes('manager');
            });
        }

        return {
            divisionName: divName,
            headOfficer,
            units: allUnitNames.map(unitName => {
                let officers = divProfiles.filter(p => p.unit === unitName);
                if (headOfficer) {
                    officers = officers.filter(p => p.email !== headOfficer!.email);
                }
                return {
                    unitName,
                    officers
                };
            }).filter(u => u.officers.length > 0 || staticUnitNames.includes(u.unitName))
        };
    });

    const handleUnitClick = (unitName: string) => {
        if (unitName === "Executive Division") {
            handleDivisionClick(unitName);
            return;
        }
        const unitData = rawUnits.find(u => u.unitName === unitName);
        if (unitData) {
            const unitProfiles = profiles.filter(p => p.unit === unitData.unitName);
            setSelectedUnit({
                ...unitData,
                totalStaff: unitProfiles.length > 0 ? unitProfiles.length : unitData.totalStaff
            });
        } else {
            console.log("No live data for unit:", unitName);
            // Fallback for demo purposes if unit doesn't exist
            setSelectedUnit({
                id: "demo",
                unitName: unitName,
                parentDivision: "Related Division",
                primaryContact: { label: "Contact", email: "info@scpng.gov.pg" },
                location: "HQ",
                totalStaff: profiles.filter(p => p.unit === unitName).length || Math.floor(Math.random() * 10) + 2,
                manager: { quote: "Dedicated to excellence in executing our core functions.", name: "Unit Manager" },
                missionStatement: `To manage and execute the responsibilities of the ${unitName} effectively and efficiently.`,
                coreFunctions: [
                    { name: "Core Function 1", description: "Primary responsibility", icon: "book" }
                ],
                achievements: [
                    { title: "Quarterly Target Met", date: "Q1 2024", description: "Exceeded performance metrics.", icon: "award" }
                ],
                statutoryDuties: "Perform duties assigned by the director in accordance with regulations."
            });
        }
    };

    const handleDivisionClick = (divName: string) => {
        const divData = rawDivisions.find(d => d.divisionName === divName);
        if (divData) {
            const divProfiles = profiles.filter(p => p.division === divData.divisionName);
            setSelectedDivision({
                ...divData,
                totalStaff: divProfiles.length > 0 ? divProfiles.length : divData.totalStaff
            });
        } else {
            console.log("No live data for division:", divName);
            // Fallback for demo purposes
            setSelectedDivision({
                id: "demo",
                divisionName: divName,
                branch: "General Branch",
                primaryContact: { label: "Contact", email: "info@scpng.gov.pg" },
                location: "HQ",
                totalStaff: profiles.filter(p => p.division === divName).length || 15,
                director: { quote: "Leading with vision to foster a robust market.", name: "Division Director" },
                missionStatement: `To provide direction and leadership to the ${divName}.`,
                subDepartments: [],
                achievements: [],
                statutoryDuties: ''
            });
        }
    };

    return (
        <div
            ref={containerRef}
            className={`w-full overflow-auto p-8 min-h-[600px] flex flex-col items-center ${isFullscreen ? 'bg-white dark:bg-gray-900' : 'bg-transparent'
                }`}
        >

            {/* Title + Controls Row */}
            <div className="w-full flex items-start justify-between mb-12">
                <div className="flex-1" />
                <h2 className="text-[#600018] dark:text-gray-100 text-2xl font-sans font-bold uppercase tracking-widest text-center flex-1">
                    Securities Commission of Papua New Guinea
                </h2>

                <div className="flex-1 flex justify-end items-center gap-2">
                    {/* View Toggle */}
                    <div className="inline-flex rounded-lg border border-gray-300 dark:border-white/10 bg-gray-100 dark:bg-gray-800 p-0.5 shadow-sm">
                        <button
                            onClick={() => setView('structure')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'structure'
                                ? 'bg-[#600018] text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                        >

                            <Building2 className="w-3.5 h-3.5" />
                            Structure
                        </button>
                        <button
                            onClick={() => setView('profiles')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'profiles'
                                ? 'bg-[#600018] text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                        >

                            <Users className="w-3.5 h-3.5" />
                            Profiles
                        </button>
                    </div>

                    {/* Zoom Controls */}
                    <div className="inline-flex items-center rounded-lg border border-gray-300 dark:border-white/10 bg-gray-100 dark:bg-gray-800 p-0.5 shadow-sm">
                        <button
                            onClick={handleZoomOut}
                            disabled={zoom <= ZOOM_MIN}
                            className="p-1.5 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Zoom out"
                        >

                            <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={handleResetZoom}
                            className="px-1.5 py-1 text-[10px] font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-all min-w-[40px] text-center"
                            title="Reset zoom"
                        >
                            {zoomPercent}%
                        </button>

                        <button
                            onClick={handleZoomIn}
                            disabled={zoom >= ZOOM_MAX}
                            className="p-1.5 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Zoom in"
                        >
                            <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                    </div>


                    {/* Fullscreen Button */}
                    <button
                        onClick={toggleFullscreen}
                        className="inline-flex items-center p-1.5 rounded-lg border border-gray-300 dark:border-white/10 bg-gray-100 dark:bg-gray-800 shadow-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
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
                    <StructureView
                        profileDivisions={profileDivisions}
                        onDivisionClick={handleDivisionClick}
                        onUnitClick={handleUnitClick}
                    />
                ) : (
                    <ProfilesView
                        ceoOfficer={ceoOfficer}
                        chairmanOfficeProfile={chairmanOfficeProfile}
                        profileDivisions={profileDivisions}
                        onOfficerClick={setSelectedOfficer}
                        onDivisionClick={handleDivisionClick}
                        onUnitClick={handleUnitClick}
                    />
                )}
            </div>

            {/* Officer Profile Modal */}
            <OfficerProfileModal
                officer={selectedOfficer}
                open={!!selectedOfficer}
                onClose={() => setSelectedOfficer(null)}
            />

            {/* Division Detail Modal */}
            <DivisionModal
                isOpen={!!selectedDivision}
                onClose={() => setSelectedDivision(null)}
                division={selectedDivision}
            />

            <UnitModal
                isOpen={!!selectedUnit}
                onClose={() => setSelectedUnit(null)}
                unit={selectedUnit}
            />
        </div>
    );
};

export default OrgChart;
