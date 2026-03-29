import { Project, Risk, KRA, Task } from '../types';
import { Asset } from '@/services/assetsSharePointService';

// Mock objectives for KRA modal
export const mockObjectives = [
  {
    id: "obj1",
    title: "Improve Operational Efficiency",
    description: "Streamline processes to reduce costs and improve service delivery"
  },
  {
    id: "obj2",
    title: "Enhance Customer Experience",
    description: "Improve customer satisfaction through better service and communication"
  },
  {
    id: "obj3",
    title: "Increase Market Share",
    description: "Expand our presence in key market segments"
  }
];

// Mock projects data
export const mockProjects: Project[] = [
  {
    id: "1",
    name: "Website Redesign",
    description: "Modernize company website with new branding",
    status: "in-progress",
    startDate: new Date("2023-01-15"),
    endDate: new Date("2023-06-30"),
    manager: "Jane Smith",
    budget: 75000,
    budgetSpent: 45000,
    progress: 60,
    risks: [],
    tasks: []
  },
  {
    id: "2",
    name: "Mobile App Development",
    description: "Create a mobile app for customer engagement",
    status: "planned",
    startDate: new Date("2023-07-01"),
    endDate: new Date("2023-12-31"),
    manager: "John Doe",
    budget: 120000,
    budgetSpent: 0,
    progress: 0,
    risks: [],
    tasks: []
  }
];

// Mock risks data
export const mockRisks: Risk[] = [
  {
    id: "1",
    title: "Budget Overrun",
    description: "Project expenses exceed allocated budget",
    impact: "high",
    likelihood: "medium",
    status: "mitigating",
    category: "Financial",
    unit_id: "1",
    project_id: "1",
    project_name: "Website Redesign",
    owner: "Finance Team",
    identificationDate: new Date("2023-02-10"),
    createdAt: new Date("2023-02-10"),
    updatedAt: new Date("2023-03-15")
  },
  {
    id: "2",
    title: "Resource Shortage",
    description: "Insufficient developer resources to meet timeline",
    impact: "medium",
    likelihood: "high",
    status: "identified",
    category: "Resource",
    unit_id: "1",
    project_id: "1",
    project_name: "Website Redesign",
    owner: "Project Manager",
    identificationDate: new Date("2023-02-15"),
    createdAt: new Date("2023-02-15"),
    updatedAt: new Date("2023-02-15")
  }
];

// Mock tasks data
export const mockTasks: Task[] = [
  {
    id: "1",
    title: "Implement User Authentication",
    description: "Set up secure login and registration system",
    status: "in-progress",
    priority: "high",
    assignee: "John Doe",
    dueDate: "2023-06-15",
    assignedTo: "John Doe",
    startDate: new Date("2023-05-01"),
    projectId: "1",
    projectName: "Website Redesign",
    completionPercentage: 75
  },
  {
    id: "2",
    title: "Design Homepage Layout",
    description: "Create responsive design for new homepage",
    status: "done",
    priority: "medium",
    assignee: "Jane Smith",
    dueDate: "2023-05-30",
    assignedTo: "Jane Smith",
    startDate: new Date("2023-05-10"),
    projectId: "1",
    projectName: "Website Redesign",
    completionPercentage: 100
  },
  {
    id: "3",
    title: "Research Competitor Apps",
    description: "Analyze features and UX of competitor mobile apps",
    status: "todo",
    priority: "medium",
    assignee: "Alex Wong",
    dueDate: "2023-07-15",
    assignedTo: "Alex Wong",
    startDate: new Date("2023-07-01"),
    projectId: "2",
    projectName: "Mobile App Development",
    completionPercentage: 0
  }
];

// Mock KRAs data
export const mockKras: KRA[] = [
  {
    id: "1",
    name: "Improve Customer Satisfaction",
    objectiveId: "1",
    objectiveName: "Enhance User Experience",
    department: "Customer Service",
    responsible: "Jane Smith",
    startDate: new Date("2023-01-01"),
    endDate: new Date("2023-12-31"),
    progress: 65,
    status: "in-progress",
    title: "Improve Customer Satisfaction",
    kpis: [
      {
        id: "1",
        name: "Customer Satisfaction Score",
        date: new Date("2023-06-01"),
        startDate: new Date("2023-01-01"),
        target: "90%",
        actual: "85%",
        status: "at-risk",
        description: "Monthly customer satisfaction survey results",
        notes: "Trending upward but still below target"
      },
      {
        id: "2",
        name: "Support Response Time",
        date: new Date("2023-06-01"),
        startDate: new Date("2023-01-01"),
        target: "< 4 hours",
        actual: "3.5 hours",
        status: "on-track",
        description: "Average time to respond to support tickets",
        notes: "Consistently meeting target"
      }
    ],
    createdAt: "2023-01-01",
    updatedAt: "2023-06-01"
  },
  {
    id: "2",
    name: "Increase Market Share",
    objectiveId: "2",
    objectiveName: "Business Growth",
    department: "Marketing",
    responsible: "John Doe",
    startDate: new Date("2023-01-01"),
    endDate: new Date("2023-12-31"),
    progress: 40,
    status: "in-progress",
    title: "Increase Market Share",
    kpis: [
      {
        id: "3",
        name: "Market Share Percentage",
        date: new Date("2023-06-01"),
        startDate: new Date("2023-01-01"),
        target: "25%",
        actual: "22%",
        status: "at-risk",
        description: "Percentage of total market",
        notes: "Growth slower than projected"
      }
    ],
    createdAt: "2023-01-01",
    updatedAt: "2023-06-01"
  }
];

// Mock assets
export const mockAssets: Asset[] = [
  {
    id: "1",
    name: "MacBook Pro 16\"",
    type: "laptop",
    serial_number: "MP123456789",
    assigned_to: "John Smith",
    division: "Engineering",
    purchase_date: "2022-06-15",
    warranty_expiry_date: "2025-06-15",
    condition: "Good",
    notes: "16GB RAM, 1TB SSD"
  },
  {
    id: "2",
    name: "iPhone 14 Pro",
    type: "mobile",
    serial_number: "IP987654321",
    assigned_to: "Jane Doe",
    division: "Marketing",
    purchase_date: "2022-09-20",
    warranty_expiry_date: "2024-09-20",
    condition: "Active",
    notes: "256GB, Graphite"
  },
  {
    id: "3",
    name: "Adobe Creative Cloud License",
    type: "software",
    serial_number: "AC123456",
    assigned_to: "Design Team",
    division: "Design",
    purchase_date: "2023-01-10",
    warranty_expiry_date: "2024-01-10",
    condition: "Excellent",
    notes: "Annual subscription"
  }
];