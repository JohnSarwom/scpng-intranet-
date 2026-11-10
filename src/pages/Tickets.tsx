import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import TicketManager from '../components/ticketing/TicketManager';
import VisitorManagement from '../components/ticketing/VisitorManagement';
import AppointmentView from '../components/ticketing/AppointmentView';
import MailAndPackages from '../components/ticketing/MailAndPackages';
import GeneralInquiries from '../components/ticketing/GeneralInquiries';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Calendar, 
  Mail, 
  Phone, 
  ArrowLeft,
  LayoutGrid
} from 'lucide-react';
import { Button } from "@/components/ui/button";

// Ticket Inbox and the Employee Support, Event Prep and Feedback & Complaints tabs were removed
// (front-desk plan decisions D1 and D2) until they have requirements and real behaviour.
type TicketCategory = 
  | 'ticket-manager'
  | 'visitor-management' 
  | 'appointments' 
  | 'mail-packages' 
  | 'general-inquiries';

const Tickets: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TicketCategory>('ticket-manager');
  const navigate = useNavigate();

  const tabs = [
    { 
      id: 'ticket-manager' as TicketCategory, 
      label: 'Ticket Manager', 
      icon: LayoutGrid, 
      content: <TicketManager />
    },
    { 
      id: 'visitor-management' as TicketCategory, 
      label: 'Visitor Management', 
      icon: Users,
      content: <VisitorManagement /> 
    },
    { 
      id: 'appointments' as TicketCategory, 
      label: 'Appointments', 
      icon: Calendar,
      content: <AppointmentView /> 
    },
    { 
      id: 'mail-packages' as TicketCategory, 
      label: 'Mail & Packages', 
      icon: Mail,
      content: <MailAndPackages /> 
    },
    { 
      id: 'general-inquiries' as TicketCategory, 
      label: 'General Inquiries', 
      icon: Phone,
      content: <GeneralInquiries /> 
    },
  ];

  return (
    <PageLayout>
      <div className="w-full">
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigate(-1)}
            className="rounded-full h-8 w-8 flex items-center justify-center border-gray-200 dark:border-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Front Desk Ticketing System</h1>
        </div>
        
        <div className="w-full">
          <Tabs 
            defaultValue="ticket-manager" 
            className="w-full" 
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as TicketCategory)}
          >
            <div className="mb-6 overflow-x-auto horizontal-scrollbar-fade pb-2">
              <TabsList className="flex space-x-1 bg-gray-100/80 dark:bg-gray-800/50 border dark:border-white/10 p-1 rounded-xl h-auto w-max min-w-full md:min-w-0">
                {tabs.map((tab) => (
                  <TabsTrigger 
                    key={tab.id} 
                    value={tab.id}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-primary dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all whitespace-nowrap"
                  >
                    <tab.icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
              {tabs.map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="mt-0">
                  {tab.content}
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>
      </div>
    </PageLayout>
  );
};

export default Tickets; 