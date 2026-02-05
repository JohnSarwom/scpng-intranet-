
import React from 'react';
import { Card } from '@/components/ui/card';

interface OrgNodeProps {
    title: string;
    subtitle?: string;
    isMain?: boolean;
    isSecondary?: boolean;
}

const OrgNode: React.FC<OrgNodeProps> = ({ title, subtitle, isMain = false, isSecondary = false }) => (
    <div className={`flex flex-col items-center p-3 rounded-xl shadow-md border-2 w-full max-w-[200px] text-center transition-all hover:scale-105 duration-300 ${isMain
        ? 'bg-gradient-to-br from-[#600018] to-[#400010] border-[#800020] text-white p-6 max-w-[300px]'
        : isSecondary
            ? 'bg-gradient-to-br from-[#800020] to-[#600018] border-[#a00028] text-white'
            : 'bg-white dark:bg-gray-800 border-[#800020]/20 text-[#600018] dark:text-white'
        }`}>
        <h4 className={`font-bold uppercase tracking-tight ${isMain ? 'text-lg' : 'text-xs'}`}>{title}</h4>
        {subtitle && <p className={`mt-1 font-light opacity-90 ${isMain ? 'text-sm' : 'text-[10px]'}`}>{subtitle}</p>}
    </div>
);

const Connector = ({ vertical = false, horizontal = false, length = "1rem" }: { vertical?: boolean, horizontal?: boolean, length?: string }) => (
    <div className={`bg-[#800020]/30 ${vertical ? 'w-0.5' : 'h-0.5'}`} style={{
        width: horizontal ? length : (vertical ? '2px' : '0'),
        height: vertical ? length : (horizontal ? '2px' : '0')
    }} />
);

const OrgChart = () => {
    return (
        <div className="w-full overflow-x-auto p-4 flex flex-col items-center gap-0 bg-[#fafafa] dark:bg-gray-950/50 rounded-3xl border border-gray-100 dark:border-gray-800">
            <div className="mb-8">
                <OrgNode title="Chief Executive Officer" isMain />
            </div>

            <Connector vertical length="2rem" />



            {/* Horizontal bridge for main divisions */}
            <div className="w-[calc(100%-200px)] h-0.5 bg-[#800020]/30 relative">
                {/* 4 branches for the divisions */}
                <div className="absolute top-0 left-0 w-0.5 h-4 bg-[#800020]/30" />
                <div className="absolute top-0 left-1/3 w-0.5 h-4 bg-[#800020]/30" />
                <div className="absolute top-0 left-2/3 w-0.5 h-4 bg-[#800020]/30" />
                <div className="absolute top-0 right-0 w-0.5 h-4 bg-[#800020]/30" />
            </div>

            {/* Level 3: Divisions */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 w-full mt-4 items-start">

                {/* Corporate Services Division */}
                <div className="flex flex-col items-center gap-4">
                    <OrgNode title="Corporate Services Division" isSecondary />
                    <Connector vertical length="1rem" />
                    <div className="flex flex-col gap-2 w-full items-center">
                        <OrgNode title="HR Unit" />
                        <OrgNode title="IT Unit" />
                        <OrgNode title="Finance Unit" />
                    </div>
                </div>

                {/* Legal Division */}
                <div className="flex flex-col items-center gap-4">
                    <OrgNode title="Legal Division" isSecondary />
                    <Connector vertical length="1rem" />
                    <div className="flex flex-col gap-2 w-full items-center">
                        <OrgNode title="Legal Unit" />
                    </div>
                </div>

                {/* Research & Publication Div. */}
                <div className="flex flex-col items-center gap-4">
                    <OrgNode title="Research & Publication Div." isSecondary />
                    <Connector vertical length="1rem" />
                    <div className="flex flex-col gap-2 w-full items-center">
                        <OrgNode title="Research Unit" />
                        <OrgNode title="Publication Unit" />
                        <OrgNode title="Investment Unit" />
                    </div>
                </div>

                {/* Executive Division */}
                <div className="flex flex-col items-center gap-4">
                    <OrgNode title="Executive Division" isSecondary />
                    <Connector vertical length="1rem" />
                    <div className="flex flex-col gap-2 w-full items-center">
                        <OrgNode title="Secretariat Unit" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrgChart;
