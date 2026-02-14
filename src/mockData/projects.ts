
import { Project, User } from '@/types';

const staffList = [
    {
        "id": "6ffa0467-b3cd-49e5-a672-f02542cce241",
        "displayName": "Andy Ambulu",
        "email": "aambulu@scpng.gov.pg",
        "jobTitle": "General Counsel",
        "initials": "AA"
    },
    {
        "id": "4172b54b-970b-49c7-ad32-772d010ca186",
        "displayName": "Anita Kosnga",
        "email": "akosnga@scpng.gov.pg",
        "jobTitle": "Finance Officer",
        "initials": "AK"
    },
    {
        "id": "0ca1b0dc-b1a0-4117-838f-96e4d5556ed2",
        "displayName": "Donald Sinogerel Samson",
        "email": "dsamson@scpng.gov.pg",
        "jobTitle": "IT Hardware Officer",
        "initials": "DS"
    },
    {
        "id": "a854cc0f-4ea7-494f-9533-e28607f60457",
        "displayName": "Esther Alia",
        "email": "ealia@scpng.gov.pg",
        "jobTitle": "Market Data Officer ",
        "initials": "EA"
    },
    {
        "id": "964b2fa5-6d18-49a9-beb6-0cd76ed15649",
        "displayName": "Eric Kipongi",
        "email": "ekipongi@scpng.gov.pg",
        "jobTitle": "Manager Information Technology",
        "initials": "EK"
    },
    {
        "id": "4f58c6c5-d256-46a7-8e87-6ed8e8d14a8e",
        "displayName": "Isaac Mel",
        "email": "imel@scpng.gov.pg",
        "jobTitle": "Senior Legal Officer",
        "initials": "IM"
    },
    {
        "id": "022d27d0-94e2-4475-aa64-fd1e51f3babe",
        "displayName": "Immanuel Minoga",
        "email": "iminoga@scpng.gov.pg",
        "jobTitle": "Legal Officer",
        "initials": "IM"
    },
    {
        "id": "5054fc13-d2d9-415a-8665-4337f0e9be14",
        "displayName": "James Joshua",
        "email": "jjoshua@scpng.gov.pg",
        "jobTitle": "Acting CEO",
        "initials": "JJ"
    },
    {
        "id": "b7d5a3a0-03f4-4ba6-b523-6ee05268872d",
        "displayName": "Jacob Kom",
        "email": "jkom@scpng.gov.pg",
        "jobTitle": "Senior Investigations Officer",
        "initials": "JK"
    },
    {
        "id": "e0babe2a-9857-4e17-94ea-ff401bc4e67a",
        "displayName": "Joy Komba",
        "email": "jkomba@scpng.gov.pg",
        "jobTitle": "Director Research",
        "initials": "JK"
    },
    {
        "id": "9abd00cb-236a-44c9-9159-8e335dd526c4",
        "displayName": "John Sarwom",
        "email": "jsarwom@scpng.gov.pg",
        "jobTitle": "Senior IT Database Officer",
        "initials": "JS"
    },
    {
        "id": "d37c360a-d768-4bce-b773-bba3f204421a",
        "displayName": "Kylie Karis",
        "email": "kkaris@scpng.gov.pg",
        "jobTitle": "Licensing Officer",
        "initials": "KK"
    },
    {
        "id": "502a77d2-6a4d-4c93-b099-3a568964a10a",
        "displayName": "Lovelyn Karlyo",
        "email": "lkarlyo@scpng.gov.pg",
        "jobTitle": "Payroll Officer",
        "initials": "LK"
    },
    {
        "id": "2fc6ed38-b2b0-491e-b7e7-d604da7ffaf5",
        "displayName": "Laviniah Michael",
        "email": "lmichael@scpng.gov.pg",
        "jobTitle": "Intern",
        "initials": "LM"
    },
    {
        "id": "e1487d21-b03d-4132-b072-d11f0cfe8827",
        "displayName": "Lenome Rex MBalupa",
        "email": "lrmbalupa@scpng.gov.pg",
        "jobTitle": "Administrative Driver",
        "initials": "LR"
    },
    {
        "id": "4be2e23e-3155-404e-bdee-3ff1788f8c45",
        "displayName": "Leah Samuel",
        "email": "lsamuel@scpng.gov.pg",
        "jobTitle": "Divisional Secretary",
        "initials": "LS"
    },
    {
        "id": "63cd73d1-9c61-4243-9374-81c15a950e48",
        "displayName": "Leeroy Wambillie",
        "email": "lwambillie@scpng.gov.pg",
        "jobTitle": "Senior Licensing Officer",
        "initials": "LW"
    },
    {
        "id": "c31d2e4b-3e6e-4c3d-baa1-bacbc26c2559",
        "displayName": "Monica Abau-Sapulai",
        "email": "msapulai@scpng.gov.pg",
        "jobTitle": "Senior Systems Analyst",
        "initials": "MA"
    },
    {
        "id": "0f244ff4-b771-4a0f-b7c4-8b9eede9c64a",
        "displayName": "Max Siwi",
        "email": "msiwi@scpng.gov.pg",
        "jobTitle": "Senior Research Officer",
        "initials": "MS"
    },
    {
        "id": "6b1fdd2a-3b1d-4f68-963b-ea98821d4492",
        "displayName": "Mark Timea",
        "email": "mtimea@scpng.gov.pg",
        "jobTitle": "Admin Officer",
        "initials": "MT"
    },
    {
        "id": "7e72f564-a7e3-4080-b71b-ce5e63f0d05a",
        "displayName": "Mercy Tipitap",
        "email": "mtipitap@scpng.gov.pg",
        "jobTitle": "Senior Finance Officer",
        "initials": "MT"
    },
    {
        "id": "15c87d01-24ee-489b-b26f-346695bea317",
        "displayName": "Ninipe Gurumo",
        "email": "ngurumo@scpng.gov.pg",
        "jobTitle": "Executive Officer",
        "initials": "NG"
    },
    {
        "id": "06adbdb2-0558-43ba-8a12-c6ad1db6be70",
        "displayName": "Rosie Stevenou",
        "email": "rstevenou@scpng.gov.pg",
        "jobTitle": "Publication Officer",
        "initials": "RS"
    },
    {
        "id": "8728d5a8-2b0c-46ce-9f68-1be487c12242",
        "displayName": "Regina Wai",
        "email": "rwai@scpng.gov.pg",
        "jobTitle": "Senior Supervision Officer",
        "initials": "RW"
    },
    {
        "id": "7b267d84-b375-48c5-905e-6148f4655c9e",
        "displayName": "Sophia Marai",
        "email": "smarai@scpng.gov.pg",
        "jobTitle": "Receptionist",
        "initials": "SM"
    },
    {
        "id": "c7150f91-439b-4940-9908-8bb7d8d39870",
        "displayName": "Sam Taki",
        "email": "staki@scpng.gov.pg",
        "jobTitle": "Acting Director CS",
        "initials": "ST"
    },
    {
        "id": "f126f065-39b4-4d28-b250-d2af8ac70e1e",
        "displayName": "Tony Kawas",
        "email": "tkawas@scpng.gov.pg",
        "jobTitle": "Senior Legal Officer",
        "initials": "TK"
    },
    {
        "id": "3ba88b66-7a5e-41e3-9ecd-1a7bfa9da321",
        "displayName": "Thomas Mondaya",
        "email": "tmondaya@scpng.gov.pg",
        "jobTitle": "Senior HR Officer",
        "initials": "TM"
    },
    {
        "id": "df1cc159-957b-4636-a82e-ce3bebc6b884",
        "displayName": "Tyson Yapao",
        "email": "tyapao@scpng.gov.pg",
        "jobTitle": "Legal Manager",
        "initials": "TY"
    },
    {
        "id": "97df4788-8283-4cb4-b061-84d73462e732",
        "displayName": "Zomay Apini",
        "email": "zapini@scpng.gov.pg",
        "jobTitle": "Market Data Manager",
        "initials": "ZA"
    }
];

const getRandomStaff = () => staffList[Math.floor(Math.random() * staffList.length)];
const getRandomSubset = (count: number) => {
    const shuffled = [...staffList].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

export const mockProjects: Project[] = [
    {
        id: 'mock-1',
        name: 'Network Infrastructure Upgrade',
        description: 'Upgrading core switches and firewalls across all divisions.',
        status: 'in-progress',
        startDate: new Date('2025-01-15'),
        endDate: new Date('2025-06-30'),
        manager: 'Eric Kipongi',
        budget: 500000,
        budgetSpent: 120000,
        progress: 35,
        assignees: [
            { id: '964b2fa5-6d18-49a9-beb6-0cd76ed15649', name: 'Eric Kipongi', email: 'ekipongi@scpng.gov.pg', initials: 'EK' },
            { id: '0ca1b0dc-b1a0-4117-838f-96e4d5556ed2', name: 'Donald Sinogerel Samson', email: 'dsamson@scpng.gov.pg', initials: 'DS' },
            { id: '9abd00cb-236a-44c9-9159-8e335dd526c4', name: 'John Sarwom', email: 'jsarwom@scpng.gov.pg', initials: 'JS' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-2',
        name: 'Legal Document Management System',
        description: 'Implementing a new centralized document management system for the Legal team.',
        status: 'planned',
        startDate: new Date('2025-03-01'),
        endDate: new Date('2025-09-01'),
        manager: 'Tyson Yapao',
        budget: 250000,
        budgetSpent: 0,
        progress: 0,
        assignees: [
            { id: 'df1cc159-957b-4636-a82e-ce3bebc6b884', name: 'Tyson Yapao', email: 'tyapao@scpng.gov.pg', initials: 'TY' },
            { id: '4f58c6c5-d256-46a7-8e87-6ed8e8d14a8e', name: 'Isaac Mel', email: 'imel@scpng.gov.pg', initials: 'IM' },
            { id: '022d27d0-94e2-4475-aa64-fd1e51f3babe', name: 'Immanuel Minoga', email: 'iminoga@scpng.gov.pg', initials: 'IM' },
            { id: 'f126f065-39b4-4d28-b250-d2af8ac70e1e', name: 'Tony Kawas', email: 'tkawas@scpng.gov.pg', initials: 'TK' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-3',
        name: 'Cloud Migration Strategy',
        description: 'Developing a roadmap for migrating on-premise servers to Azure.',
        status: 'in-progress',
        startDate: new Date('2024-11-01'),
        endDate: new Date('2025-04-01'),
        manager: 'John Sarwom',
        budget: 150000,
        budgetSpent: 60000,
        progress: 45,
        assignees: [
            { id: '9abd00cb-236a-44c9-9159-8e335dd526c4', name: 'John Sarwom', email: 'jsarwom@scpng.gov.pg', initials: 'JS' },
            { id: 'c31d2e4b-3e6e-4c3d-baa1-bacbc26c2559', name: 'Monica Abau-Sapulai', email: 'msapulai@scpng.gov.pg', initials: 'MA' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-4',
        name: 'Cybersecurity Audit 2026',
        description: 'Annual external security audit and remediation.',
        status: 'planned',
        startDate: new Date('2026-01-10'),
        endDate: new Date('2026-03-30'),
        manager: 'Eric Kipongi',
        budget: 80000,
        budgetSpent: 0,
        progress: 0,
        assignees: [
            { id: '964b2fa5-6d18-49a9-beb6-0cd76ed15649', name: 'Eric Kipongi', email: 'ekipongi@scpng.gov.pg', initials: 'EK' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-5',
        name: 'Employee Portal Redesign',
        description: 'Revamping the intranet portal for better user experience.',
        status: 'in-progress',
        startDate: new Date('2025-02-01'),
        endDate: new Date('2025-05-15'),
        manager: 'John Sarwom',
        budget: 120000,
        budgetSpent: 45000,
        progress: 60,
        assignees: [
            { id: '9abd00cb-236a-44c9-9159-8e335dd526c4', name: 'John Sarwom', email: 'jsarwom@scpng.gov.pg', initials: 'JS' },
            { id: '06adbdb2-0558-43ba-8a12-c6ad1db6be70', name: 'Rosie Stevenou', email: 'rstevenou@scpng.gov.pg', initials: 'RS' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-6',
        name: 'Data Warehouse Implementation',
        description: 'Centralizing data from various units into a single warehouse.',
        status: 'on-hold',
        startDate: new Date('2024-09-01'),
        endDate: new Date('2025-12-31'),
        manager: 'Monica Abau-Sapulai',
        budget: 400000,
        budgetSpent: 100000,
        progress: 25,
        assignees: [
            { id: 'c31d2e4b-3e6e-4c3d-baa1-bacbc26c2559', name: 'Monica Abau-Sapulai', email: 'msapulai@scpng.gov.pg', initials: 'MA' },
            { id: '97df4788-8283-4cb4-b061-84d73462e732', name: 'Zomay Apini', email: 'zapini@scpng.gov.pg', initials: 'ZA' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-7',
        name: 'Mobile App Development',
        description: 'Creating a mobile app for public market data access.',
        status: 'planned',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-12-01'),
        manager: 'Zomay Apini',
        budget: 180000,
        budgetSpent: 0,
        progress: 0,
        assignees: [
            { id: '97df4788-8283-4cb4-b061-84d73462e732', name: 'Zomay Apini', email: 'zapini@scpng.gov.pg', initials: 'ZA' },
            { id: 'a854cc0f-4ea7-494f-9533-e28607f60457', name: 'Esther Alia', email: 'ealia@scpng.gov.pg', initials: 'EA' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-8',
        name: 'Hardware Refresh Program',
        description: 'Replacing aging laptops and desktops for 50 staff members.',
        status: 'in-progress',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-04-30'),
        manager: 'Donald Sinogerel Samson',
        budget: 300000,
        budgetSpent: 280000,
        progress: 90,
        assignees: [
            { id: '0ca1b0dc-b1a0-4117-838f-96e4d5556ed2', name: 'Donald Sinogerel Samson', email: 'dsamson@scpng.gov.pg', initials: 'DS' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-9',
        name: 'Compliance Tracking System',
        description: 'Automating the tracking of regulatory compliance tasks.',
        status: 'completed',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-12-31'),
        manager: 'Tyson Yapao',
        budget: 150000,
        budgetSpent: 145000,
        progress: 100,
        assignees: [
            { id: 'df1cc159-957b-4636-a82e-ce3bebc6b884', name: 'Tyson Yapao', email: 'tyapao@scpng.gov.pg', initials: 'TY' },
            { id: '8728d5a8-2b0c-46ce-9f68-1be487c12242', name: 'Regina Wai', email: 'rwai@scpng.gov.pg', initials: 'RW' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-10',
        name: 'Market Surveillance Dashboard',
        description: 'Real-time dashboard for monitoring market activities.',
        status: 'in-progress',
        startDate: new Date('2025-02-15'),
        endDate: new Date('2025-08-15'),
        manager: 'Zomay Apini',
        budget: 220000,
        budgetSpent: 50000,
        progress: 20,
        assignees: [
            { id: '97df4788-8283-4cb4-b061-84d73462e732', name: 'Zomay Apini', email: 'zapini@scpng.gov.pg', initials: 'ZA' },
            { id: 'a854cc0f-4ea7-494f-9533-e28607f60457', name: 'Esther Alia', email: 'ealia@scpng.gov.pg', initials: 'EA' },
            { id: '63cd73d1-9c61-4243-9374-81c15a950e48', name: 'Leeroy Wambillie', email: 'lwambillie@scpng.gov.pg', initials: 'LW' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-11',
        name: 'HRIS Upgrade',
        description: 'Upgrading the HR system to the latest version.',
        status: 'planned',
        startDate: new Date('2025-04-01'),
        endDate: new Date('2025-07-01'),
        manager: 'Thomas Mondaya',
        budget: 90000,
        budgetSpent: 0,
        progress: 0,
        assignees: [
            { id: '3ba88b66-7a5e-41e3-9ecd-1a7bfa9da321', name: 'Thomas Mondaya', email: 'tmondaya@scpng.gov.pg', initials: 'TM' },
            { id: '502a77d2-6a4d-4c93-b099-3a568964a10a', name: 'Lovelyn Karlyo', email: 'lkarlyo@scpng.gov.pg', initials: 'LK' },
            { id: '6b1fdd2a-3b1d-4f68-963b-ea98821d4492', name: 'Mark Timea', email: 'mtimea@scpng.gov.pg', initials: 'MT' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-12',
        name: 'Financial Reporting Automation',
        description: 'Scripts to automate monthly financial reports.',
        status: 'in-progress',
        startDate: new Date('2025-01-20'),
        endDate: new Date('2025-03-31'),
        manager: 'Sam Taki',
        budget: 50000,
        budgetSpent: 10000,
        progress: 75,
        assignees: [
            { id: 'c7150f91-439b-4940-9908-8bb7d8d39870', name: 'Sam Taki', email: 'staki@scpng.gov.pg', initials: 'ST' },
            { id: '4172b54b-970b-49c7-ad32-772d010ca186', name: 'Anita Kosnga', email: 'akosnga@scpng.gov.pg', initials: 'AK' },
            { id: '7e72f564-a7e3-4080-b71b-ce5e63f0d05a', name: 'Mercy Tipitap', email: 'mtipitap@scpng.gov.pg', initials: 'MT' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-13',
        name: 'Disaster Recovery Plan Test',
        description: 'Scheduled testing of the DR plan.',
        status: 'planned',
        startDate: new Date('2025-08-01'),
        endDate: new Date('2025-08-31'),
        manager: 'Eric Kipongi',
        budget: 20000,
        budgetSpent: 0,
        progress: 0,
        assignees: [
            { id: '964b2fa5-6d18-49a9-beb6-0cd76ed15649', name: 'Eric Kipongi', email: 'ekipongi@scpng.gov.pg', initials: 'EK' },
            { id: '9abd00cb-236a-44c9-9159-8e335dd526c4', name: 'John Sarwom', email: 'jsarwom@scpng.gov.pg', initials: 'JS' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-14',
        name: 'CRM Pilot',
        description: 'Testing a new CRM for stakeholder management.',
        status: 'on-hold',
        startDate: new Date('2024-10-01'),
        endDate: new Date('2025-02-01'),
        manager: 'James Joshua',
        budget: 60000,
        budgetSpent: 15000,
        progress: 10,
        assignees: [
            { id: '5054fc13-d2d9-415a-8665-4337f0e9be14', name: 'James Joshua', email: 'jjoshua@scpng.gov.pg', initials: 'JJ' },
            { id: '15c87d01-24ee-489b-b26f-346695bea317', name: 'Ninipe Gurumo', email: 'ngurumo@scpng.gov.pg', initials: 'NG' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-15',
        name: 'IT Service Desk Optimization',
        description: 'Improving response times and ticket handling processes.',
        status: 'in-progress',
        startDate: new Date('2025-02-01'),
        endDate: new Date('2025-12-31'),
        manager: 'John Sarwom',
        budget: 30000,
        budgetSpent: 5000,
        progress: 15,
        assignees: [
            { id: '9abd00cb-236a-44c9-9159-8e335dd526c4', name: 'John Sarwom', email: 'jsarwom@scpng.gov.pg', initials: 'JS' },
            { id: '0ca1b0dc-b1a0-4117-838f-96e4d5556ed2', name: 'Donald Sinogerel Samson', email: 'dsamson@scpng.gov.pg', initials: 'DS' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-16',
        name: 'Regulatory Reporting Framework',
        description: 'Establishing a new framework for industry reporting.',
        status: 'in-progress',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        manager: 'Andy Ambulu',
        budget: 100000,
        budgetSpent: 20000,
        progress: 20,
        assignees: [
            { id: '6ffa0467-b3cd-49e5-a672-f02542cce241', name: 'Andy Ambulu', email: 'aambulu@scpng.gov.pg', initials: 'AA' },
            { id: 'df1cc159-957b-4636-a82e-ce3bebc6b884', name: 'Tyson Yapao', email: 'tyapao@scpng.gov.pg', initials: 'TY' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-17',
        name: 'Intranet Content Revamp',
        description: 'Updating all department pages with fresh content.',
        status: 'in-progress',
        startDate: new Date('2025-03-01'),
        endDate: new Date('2025-06-01'),
        manager: 'Joy Komba',
        budget: 25000,
        budgetSpent: 5000,
        progress: 30,
        assignees: [
            { id: 'e0babe2a-9857-4e17-94ea-ff401bc4e67a', name: 'Joy Komba', email: 'jkomba@scpng.gov.pg', initials: 'JK' },
            { id: '06adbdb2-0558-43ba-8a12-c6ad1db6be70', name: 'Rosie Stevenou', email: 'rstevenou@scpng.gov.pg', initials: 'RS' },
            { id: '0f244ff4-b771-4a0f-b7c4-8b9eede9c64a', name: 'Max Siwi', email: 'msiwi@scpng.gov.pg', initials: 'MS' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-18',
        name: 'Vendor Management System',
        description: 'System to track vendor contracts and performance.',
        status: 'planned',
        startDate: new Date('2025-07-01'),
        endDate: new Date('2025-12-31'),
        manager: 'Sam Taki',
        budget: 85000,
        budgetSpent: 0,
        progress: 0,
        assignees: [
            { id: 'c7150f91-439b-4940-9908-8bb7d8d39870', name: 'Sam Taki', email: 'staki@scpng.gov.pg', initials: 'ST' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-19',
        name: 'AI Chatbot Integration',
        description: 'Integrating an AI assistant for the intranet.',
        status: 'completed',
        startDate: new Date('2024-11-01'),
        endDate: new Date('2025-01-31'),
        manager: 'John Sarwom',
        budget: 45000,
        budgetSpent: 42000,
        progress: 100,
        assignees: [
            { id: '9abd00cb-236a-44c9-9159-8e335dd526c4', name: 'John Sarwom', email: 'jsarwom@scpng.gov.pg', initials: 'JS' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-20',
        name: 'Network Security Policy Review',
        description: 'Reviewing and updating security policies.',
        status: 'planned',
        startDate: new Date('2025-05-01'),
        endDate: new Date('2025-06-30'),
        manager: 'Eric Kipongi',
        budget: 15000,
        budgetSpent: 0,
        progress: 0,
        assignees: [
            { id: '964b2fa5-6d18-49a9-beb6-0cd76ed15649', name: 'Eric Kipongi', email: 'ekipongi@scpng.gov.pg', initials: 'EK' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-21',
        name: 'internal Audit 2025',
        description: 'Conducting internal audit for all departments.',
        status: 'in-progress',
        startDate: new Date('2025-02-01'),
        endDate: new Date('2025-04-30'),
        manager: 'Jacob Kom',
        budget: 50000,
        budgetSpent: 10000,
        progress: 40,
        assignees: [
            { id: 'b7d5a3a0-03f4-4ba6-b523-6ee05268872d', name: 'Jacob Kom', email: 'jkom@scpng.gov.pg', initials: 'JK' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-22',
        name: 'VoIP System Upgrade',
        description: 'Upgrading the phone system to a new IP-based solution.',
        status: 'planned',
        startDate: new Date('2025-09-01'),
        endDate: new Date('2025-11-30'),
        manager: 'Donald Sinogerel Samson',
        budget: 120000,
        budgetSpent: 0,
        progress: 0,
        assignees: [
            { id: '0ca1b0dc-b1a0-4117-838f-96e4d5556ed2', name: 'Donald Sinogerel Samson', email: 'dsamson@scpng.gov.pg', initials: 'DS' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-23',
        name: 'Office 365 Migration',
        description: 'Migrating all users to Microsoft 365 E5 license.',
        status: 'completed',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        manager: 'Eric Kipongi',
        budget: 200000,
        budgetSpent: 195000,
        progress: 100,
        assignees: [
            { id: '964b2fa5-6d18-49a9-beb6-0cd76ed15649', name: 'Eric Kipongi', email: 'ekipongi@scpng.gov.pg', initials: 'EK' },
            { id: '9abd00cb-236a-44c9-9159-8e335dd526c4', name: 'John Sarwom', email: 'jsarwom@scpng.gov.pg', initials: 'JS' }
        ],
        risks: [],
        tasks: []
    },
    {
        id: 'mock-24',
        name: 'Asset Management System Rollout',
        description: 'Deploying software to track all physical assets.',
        status: 'in-progress',
        startDate: new Date('2025-03-01'),
        endDate: new Date('2025-06-30'),
        manager: 'Mark Timea',
        budget: 70000,
        budgetSpent: 30000,
        progress: 55,
        assignees: [
            { id: '6b1fdd2a-3b1d-4f68-963b-ea98821d4492', name: 'Mark Timea', email: 'mtimea@scpng.gov.pg', initials: 'MT' },
            { id: 'e1487d21-b03d-4132-b072-d11f0cfe8827', name: 'Lenome Rex MBalupa', email: 'lrmbalupa@scpng.gov.pg', initials: 'LR' }
        ],
        risks: [],
        tasks: []
    }
];
