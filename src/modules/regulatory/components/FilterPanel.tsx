import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, RefreshCcw } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const FilterPanel: React.FC = () => {
    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 space-y-4 md:space-y-0 md:flex md:items-center md:gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                    placeholder="Search cases, IDs, or descriptions..."
                    className="pl-9 w-full bg-gray-50 border-gray-300 focus:border-primary focus:ring-primary"
                />
            </div>

            <div className="flex items-center gap-2">
                <Select defaultValue="all-types">
                    <SelectTrigger className="w-[140px] bg-gray-50">
                        <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all-types">All Types</SelectItem>
                        <SelectItem value="scam">Scam</SelectItem>
                        <SelectItem value="whistleblower">Whistleblower</SelectItem>
                        <SelectItem value="compliance">Compliance</SelectItem>
                        <SelectItem value="enquiry">Enquiry</SelectItem>
                    </SelectContent>
                </Select>

                <Select defaultValue="all-status">
                    <SelectTrigger className="w-[140px] bg-gray-50">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all-status">All Status</SelectItem>
                        <SelectItem value="received">Received</SelectItem>
                        <SelectItem value="review">Under Review</SelectItem>
                        <SelectItem value="investigating">Investigating</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                </Select>

                <Select defaultValue="all-risk">
                    <SelectTrigger className="w-[140px] bg-gray-50">
                        <SelectValue placeholder="Risk Level" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all-risk">All Risk</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                </Select>

                <div className="w-px h-8 bg-gray-200 mx-1"></div>

                <Button variant="outline" size="icon" className="text-gray-500">
                    <RefreshCcw className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

export default FilterPanel;
