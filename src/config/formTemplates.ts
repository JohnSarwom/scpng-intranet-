import { FormTemplate, FormField, FormSection } from '@/types/forms';

// Helper function to create common field configurations
const createTextField = (
  id: string,
  label: string,
  required = false,
  placeholder?: string
): FormField => ({
  id,
  name: id,
  label,
  type: 'text',
  required,
  placeholder,
  width: 'full',
  validation: required ? [{ type: 'required', message: `${label} is required` }] : undefined
});

const createTextareaField = (
  id: string,
  label: string,
  required = false,
  rows = 3
): FormField => ({
  id,
  name: id,
  label,
  type: 'textarea',
  required,
  rows,
  width: 'full',
  validation: required ? [{ type: 'required', message: `${label} is required` }] : undefined
});

const createSelectField = (
  id: string,
  label: string,
  options: { value: string; label: string }[],
  required = false
): FormField => ({
  id,
  name: id,
  label,
  type: 'select',
  required,
  options,
  width: 'half',
  validation: required ? [{ type: 'required', message: `${label} is required` }] : undefined
});

const createDateField = (
  id: string,
  label: string,
  required = false
): FormField => ({
  id,
  name: id,
  label,
  type: 'date',
  required,
  width: 'half',
  validation: required ? [{ type: 'required', message: `${label} is required` }] : undefined
});

const createEmailField = (
  id: string,
  label: string,
  required = false
): FormField => ({
  id,
  name: id,
  label,
  type: 'email',
  required,
  width: 'half',
  validation: required ? [
    { type: 'required', message: `${label} is required` },
    { type: 'email', message: 'Please enter a valid email address' }
  ] : [{ type: 'email', message: 'Please enter a valid email address' }]
});

const createFileField = (
  id: string,
  label: string,
  accept?: string,
  required = false
): FormField => ({
  id,
  name: id,
  label,
  type: 'file',
  required,
  accept,
  width: 'full',
  validation: required ? [{ type: 'required', message: `${label} is required` }] : undefined
});

const createCheckboxGroupField = (
  id: string,
  label: string,
  options: { value: string; label: string }[],
  required = false
): FormField => ({
  id,
  name: id,
  label,
  type: 'checkbox-group',
  required,
  options,
  width: 'full',
  validation: required ? [{ type: 'required', message: `Please select at least one ${label}` }] : undefined
});

const createRadioGroupField = (
  id: string,
  label: string,
  options: { value: string; label: string }[],
  required = false
): FormField => ({
  id,
  name: id,
  label,
  type: 'radio-group',
  required,
  options,
  width: 'full',
  validation: required ? [{ type: 'required', message: `Please select a ${label}` }] : undefined
});

const createHiddenField = (id: string): FormField => ({
  id,
  name: id,
  label: '',
  type: 'hidden',
  required: false,
  width: 'full',
});


// Default approval steps for common workflows
const standardApprovalSteps = [
  {
    id: 'supervisor_approval',
    order: 1,
    title: 'Supervisor Approval',
    approverRole: 'supervisor',
    required: true,
    allowDelegation: true,
    timeoutDays: 3,
    escalationRole: 'manager'
  },
  {
    id: 'manager_approval',
    order: 2,
    title: 'Manager Approval',
    approverRole: 'manager',
    required: true,
    allowDelegation: false,
    timeoutDays: 5,
    escalationRole: 'director'
  }
];

const hrApprovalSteps = [
  ...standardApprovalSteps,
  {
    id: 'hr_approval',
    order: 3,
    title: 'HR Approval',
    approverRole: 'hr_manager',
    required: true,
    allowDelegation: false,
    timeoutDays: 2
  }
];

// Matches the actual 3-stage leave workflow:
// Manager Review → Director Review → HR Review
const leaveApprovalSteps = [
  {
    id: 'manager_review',
    order: 1,
    title: 'Manager Review',
    approverRole: 'manager',
    required: true,
    allowDelegation: true,
    timeoutDays: 3,
    escalationRole: 'director',
  },
  {
    id: 'director_review',
    order: 2,
    title: 'Director Review',
    approverRole: 'director',
    required: true,
    allowDelegation: false,
    timeoutDays: 5,
    escalationRole: 'hr_manager',
  },
  {
    id: 'hr_review',
    order: 3,
    title: 'HR Review',
    approverRole: 'hr_manager',
    required: true,
    allowDelegation: false,
    timeoutDays: 2,
  },
];

// Leave Application Form Template
export const leaveApplicationTemplate: FormTemplate = {
  id: 'leave-application',
  title: 'LEAVE APPLICATION FORM',
  description: 'To be filled by applicant',
  version: '1.0',
  divisionId: 'corporate-services-division',
  category: 'hr',
  estimatedTime: '5-10 minutes',
  status: 'active',
  lastUpdated: '2024-07-30',

  sections: [
    {
      id: 'applicant_info',
      title: 'A) TO BE FILLED BY APPLICANT',
      description: '',
      fields: [
        createTextField('payrollNumber', 'PAYROLL #'),
        createTextField('name', 'NAME', true),
        createSelectField('division', 'DIVISION', [
          { value: 'Corporate Services Division', label: 'Corporate Services Division' },
          { value: 'Legal Division', label: 'Legal Division' },
          { value: 'Research and Publication Division', label: 'Research and Publication Division' },
          { value: 'Licensing & Supervision Division', label: 'Licensing & Supervision Division' },
        ], true),
        createSelectField('unit', 'UNIT', [
          { value: 'IT Unit', label: 'IT Unit' },
          { value: 'HR Unit', label: 'HR Unit' },
          { value: 'Finance Unit', label: 'Finance Unit' },
          { value: 'Supervision Unit', label: 'Supervision Unit' },
          { value: 'Licensing Unit', label: 'Licensing Unit' },
          { value: 'Marketing Unit', label: 'Marketing Unit' },
          { value: 'Investigations Unit', label: 'Investigations Unit' },
          { value: 'Legal Unit', label: 'Legal Unit' },
          { value: 'Secretariat Unit', label: 'Secretariat Unit' },
        ], true),
        {
          id: 'absenceFrom',
          name: 'absenceFrom',
          label: 'PERIOD OF ABSENCE (DATE & TIME) - FROM',
          type: 'datetime-local',
          required: true,
          width: 'half',
          validation: [{ type: 'required', message: 'Start date and time is required' }]
        },
        {
          id: 'absenceTo',
          name: 'absenceTo',
          label: 'TO',
          type: 'datetime-local',
          required: true,
          width: 'half',
          validation: [{ type: 'required', message: 'End date and time is required' }]
        },
        createTextareaField('reason', 'REASON', true, 2),
        createRadioGroupField('leaveType', 'Type of Leave', [
          { value: 'SICK LEAVE', label: 'SICK LEAVE' },
          { value: 'COMPASSIONATE LEAVE', label: 'COMPASSIONATE LEAVE' },
          { value: 'ANNUAL LEAVE', label: 'ANNUAL LEAVE' },
          { value: 'CARERS LEAVE', label: 'CARERS LEAVE' },
          { value: 'LEAVE WITHOUT PAY', label: 'LEAVE WITHOUT PAY' },
          { value: 'STUDY LEAVE', label: 'STUDY LEAVE' },
          { value: 'MATERNITY LEAVE', label: 'MATERNITY LEAVE' },
          { value: 'LEAVE FOR BREAST FEEDING', label: 'LEAVE FOR BREAST FEEDING' },
          { value: 'PATERNITY LEAVE', label: 'PATERNITY LEAVE' },
          { value: 'RECREATIONAL LEAVE', label: 'RECREATIONAL LEAVE' }
        ], true)
      ]
    }
  ],

  workflowEnabled: true,
  approvalSteps: leaveApprovalSteps,

  notifications: [
    {
      trigger: 'submission',
      recipients: ['manager'],
      template: 'leave_application_submitted',
    },
    {
      trigger: 'manager_approved',
      recipients: ['director'],
      template: 'leave_application_director_review',
    },
    {
      trigger: 'director_approved',
      recipients: ['hr_manager'],
      template: 'leave_application_hr_review',
    },
    {
      trigger: 'approval',
      recipients: ['submitter'],
      template: 'leave_application_approved',
    },
    {
      trigger: 'rejection',
      recipients: ['submitter'],
      template: 'leave_application_rejected',
    },
  ],

  createdBy: 'system',
  createdAt: '2024-01-15',
  tags: ['hr', 'leave', 'time-off'],

  permissions: {
    view: ['all_employees'],
    fill: ['all_employees'],
    approve: ['supervisor', 'manager', 'hr_manager'],
    admin: ['hr_admin', 'system_admin']
  }
};

// Asset Request Form Template
export const assetRequestTemplate: FormTemplate = {
  id: 'asset-request',
  title: 'Asset Request Form',
  description: 'Request purchase of new assets or equipment',
  version: '1.0',
  divisionId: 'corporate-services-division',
  category: 'procurement',
  estimatedTime: '12-18 minutes',
  status: 'active',
  lastUpdated: '2024-07-30',

  sections: [
    {
      id: 'requestor_info',
      title: 'Requestor Information',
      fields: [
        createTextField('requestor_name', 'Requestor Name', true),
        createTextField('requestor_id', 'Employee ID', true),
        createEmailField('requestor_email', 'Email Address', true),
        createTextField('department', 'Department', true),
        createTextField('cost_center', 'Cost Center', false)
      ]
    },
    {
      id: 'asset_details',
      title: 'Asset Details',
      fields: [
        createSelectField('asset_category', 'Asset Category', [
          { value: 'computer_hardware', label: 'Computer Hardware' },
          { value: 'office_furniture', label: 'Office Furniture' },
          { value: 'software', label: 'Software' },
          { value: 'mobile_devices', label: 'Mobile Devices' },
          { value: 'office_equipment', label: 'Office Equipment' },
          { value: 'vehicle', label: 'Vehicle' },
          { value: 'other', label: 'Other' }
        ], true),
        createTextField('asset_description', 'Asset Description', true, 'Detailed description of the asset'),
        createTextField('manufacturer', 'Manufacturer/Brand', false),
        createTextField('model', 'Model Number', false),
        {
          id: 'quantity',
          name: 'quantity',
          label: 'Quantity',
          type: 'number',
          required: true,
          width: 'half',
          min: 1,
          validation: [{ type: 'required', message: 'Quantity is required' }]
        },
        {
          id: 'estimated_cost',
          name: 'estimated_cost',
          label: 'Estimated Cost (PGK)',
          type: 'currency',
          required: true,
          width: 'half',
          validation: [{ type: 'required', message: 'Estimated cost is required' }]
        }
      ]
    },
    {
      id: 'justification',
      title: 'Business Justification',
      fields: [
        createSelectField('priority', 'Priority Level', [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'urgent', label: 'Urgent' }
        ], true),
        createTextareaField('business_justification', 'Business Justification', true, 5),
        createDateField('required_by', 'Required By Date', false),
        createSelectField('budget_source', 'Budget Source', [
          { value: 'departmental', label: 'Departmental Budget' },
          { value: 'capital', label: 'Capital Expenditure' },
          { value: 'project', label: 'Project Budget' },
          { value: 'emergency', label: 'Emergency Fund' }
        ], true)
      ]
    },
    {
      id: 'vendor_info',
      title: 'Vendor Information',
      description: 'If you have a preferred vendor or quote',
      fields: [
        createTextField('preferred_vendor', 'Preferred Vendor', false),
        createTextField('vendor_contact', 'Vendor Contact', false),
        createFileField('quotes', 'Vendor Quotes', '.pdf,.doc,.docx,.xls,.xlsx', false)
      ]
    }
  ],

  workflowEnabled: true,
  approvalSteps: [
    ...standardApprovalSteps,
    {
      id: 'finance_approval',
      order: 3,
      title: 'Finance Approval',
      approverRole: 'finance_manager',
      required: true,
      allowDelegation: false,
      timeoutDays: 5
    },
    {
      id: 'executive_approval',
      order: 4,
      title: 'Executive Approval',
      approverRole: 'ceo',
      required: false, // Only for high-value assets
      allowDelegation: false,
      timeoutDays: 7
    }
  ],

  createdBy: 'system',
  createdAt: '2024-01-14',
  tags: ['procurement', 'assets', 'finance'],

  permissions: {
    view: ['all_employees'],
    fill: ['all_employees'],
    approve: ['supervisor', 'manager', 'finance_manager', 'ceo'],
    admin: ['procurement_admin', 'system_admin']
  }
};


// Training Request Template
export const trainingRequestTemplate: FormTemplate = {
  id: 'training-request',
  title: 'Training Request Form',
  description: 'Request approval for professional development and training',
  version: '1.0',
  divisionId: 'corporate-services-division',
  category: 'hr',
  estimatedTime: '10-15 minutes',
  status: 'active',
  lastUpdated: '2024-07-30',

  sections: [
    {
      id: 'employee_info',
      title: 'Employee Information',
      fields: [
        createTextField('employee_name', 'Full Name', true),
        createTextField('employee_id', 'Employee ID', true),
        createEmailField('email', 'Email Address', true),
        createTextField('position', 'Position', true),
        createTextField('department', 'Department', true),
        createTextField('years_service', 'Years of Service', false)
      ]
    },
    {
      id: 'training_details',
      title: 'Training Details',
      fields: [
        createTextField('training_title', 'Training/Course Title', true),
        createTextField('provider', 'Training Provider', true),
        createSelectField('training_type', 'Training Type', [
          { value: 'conference', label: 'Conference' },
          { value: 'workshop', label: 'Workshop' },
          { value: 'certification', label: 'Certification Course' },
          { value: 'degree', label: 'Degree Program' },
          { value: 'online', label: 'Online Course' },
          { value: 'seminar', label: 'Seminar' },
          { value: 'other', label: 'Other' }
        ], true),
        createDateField('start_date', 'Start Date', true),
        createDateField('end_date', 'End Date', true),
        createTextField('duration', 'Duration', false, 'e.g., 3 days, 2 weeks'),
        createTextField('location', 'Location', false),
        {
          id: 'cost',
          name: 'cost',
          label: 'Total Cost (PGK)',
          type: 'currency',
          required: true,
          width: 'half',
          validation: [{ type: 'required', message: 'Cost is required' }]
        }
      ]
    },
    {
      id: 'justification',
      title: 'Training Justification',
      fields: [
        createTextareaField('business_relevance', 'How does this training relate to your current role?', true, 4),
        createTextareaField('expected_outcomes', 'What are the expected learning outcomes?', true, 4),
        createTextareaField('benefit_to_organization', 'How will this training benefit the organization?', true, 4),
        createTextareaField('knowledge_sharing', 'How will you share the knowledge gained with colleagues?', false, 3)
      ]
    },
    {
      id: 'alternatives',
      title: 'Alternative Training Options',
      description: 'Have you considered other training options?',
      fields: [
        createTextareaField('alternatives_considered', 'Other training options considered', false, 3),
        createTextareaField('why_this_option', 'Why is this the preferred option?', false, 3)
      ]
    },
    {
      id: 'attachments',
      title: 'Supporting Documents',
      fields: [
        createFileField('training_brochure', 'Training Brochure/Curriculum', '.pdf,.doc,.docx', false),
        createFileField('quote', 'Cost Quote', '.pdf,.doc,.docx,.xls,.xlsx', false)
      ]
    }
  ],

  workflowEnabled: true,
  approvalSteps: hrApprovalSteps,

  createdBy: 'system',
  createdAt: '2024-01-20',
  tags: ['hr', 'training', 'development'],

  permissions: {
    view: ['all_employees'],
    fill: ['all_employees'],
    approve: ['supervisor', 'manager', 'hr_manager'],
    admin: ['hr_admin', 'system_admin']
  }
};

// IT Equipment & Access Request Form Template
export const itRequestTemplate: FormTemplate = {
  id: 'it-equipment-access-request',
  title: 'IT Equipment & Access Request Form',
  description: 'Request for IT equipment or system access',
  version: '1.0',
  divisionId: 'corporate-services-division',
  category: 'it',
  estimatedTime: '10-15 minutes',
  status: 'active',
  lastUpdated: '2024-07-30',
  sections: [
    {
      id: 'request_info',
      title: 'Request Information',
      fields: [
        createRadioGroupField('priority', 'Priority Level', [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'urgent', label: 'Urgent' },
        ], true),
        createRadioGroupField('requestAccessType', 'Request/Access Type', [
          { value: 'equipment', label: 'Equipment Request' },
          { value: 'access', label: 'Access Request' },
          { value: 'other', label: 'Other' },
        ], true),
        {
          ...createTextField('otherRequestType', 'Please specify', true, 'Specify other request type'),
          showWhen: { field: 'requestAccessType', operator: 'equals', value: 'other' }
        },
      ],
    },
    {
      id: 'equipment_request',
      title: 'Equipment Request',
      fields: [
        createCheckboxGroupField('equipment', 'Equipment', [
          { value: 'laptop', label: 'Laptop' },
          { value: 'desktop', label: 'Desktop' },
          { value: 'monitor', label: 'Monitor' },
          { value: 'projector', label: 'Projector' },
          { value: 'camera', label: 'Camera' },
          { value: 'ups', label: 'UPS' },
          { value: 'other', label: 'Other' },
        ], true),
        {
          ...createTextField('otherEquipment', 'Please specify other equipment', true),
          showWhen: { field: 'equipment', operator: 'contains', value: 'other' }
        },
      ],
    },
    {
      id: 'access_request',
      title: 'Access Request',
      fields: [
        createCheckboxGroupField('access', 'Access', [
          { value: 'email_password_reset', label: 'Email Password Reset' },
          { value: 'wifi_password_access', label: 'Wi-Fi-Password Access' },
          { value: 'desktop_user_password_reset', label: 'Desktop User Password Reset' },
          { value: 'software_installation', label: 'Software Installation' },
          { value: 'printer_password_reset', label: 'Printer Password Reset' },
          { value: 'other', label: 'Other' },
        ], true),
        {
          ...createTextField('otherAccess', 'Please specify other access', true),
          showWhen: { field: 'access', operator: 'contains', value: 'other' }
        },
      ],
    },
    {
      id: 'request_details',
      title: 'Request / Access Details',
      fields: [
        createTextareaField('details', 'Details', true, 5),
        {
          ...createDateField('startDate', 'Intended Start Date of Use'),
          showWhen: { field: 'requestAccessType', operator: 'equals', value: 'equipment' }
        },
        {
          ...createDateField('returnDate', 'Intended Return Date'),
          showWhen: { field: 'requestAccessType', operator: 'equals', value: 'equipment' }
        },
        {
          ...createTextField('duration', 'Other specified Duration (Permanent Usage / Temporary)'),
          showWhen: { field: 'requestAccessType', operator: 'equals', value: 'equipment' }
        },
      ],
    },
  ],
  workflowEnabled: true,
  approvalSteps: [
    {
      id: 'it_review',
      order: 1,
      title: 'IT Team Review',
      approverRole: 'it_support',
      required: true,
      allowDelegation: true,
      timeoutDays: 1,
    },
  ],
  createdBy: 'system',
  createdAt: '2024-07-30',
  tags: ['it', 'equipment', 'access'],
  permissions: {
    view: ['all_employees'],
    fill: ['all_employees'],
    approve: ['it_support', 'it_manager'],
    admin: ['it_admin', 'system_admin'],
  },
};

// Website Upgrade Feedback Form Template
export const websiteFeedbackTemplate: FormTemplate = {
  id: 'website-upgrade-feedback',
  title: 'New Website Upgrade — Feedback Form',
  description: 'Share your experience and suggestions on the newly launched website upgrade',
  version: '1.0',
  divisionId: 'corporate-services-division',
  category: 'it',
  estimatedTime: '5-10 minutes',
  status: 'active',
  lastUpdated: '2026-04-05',

  sections: [
    {
      id: 'submitter_info',
      title: 'Your Information',
      fields: [
        createTextField('submitterName', 'Full Name', true),
        createEmailField('submitterEmail', 'Email Address', true),
        createTextField('department', 'Department / Unit', false),
      ]
    },
    {
      id: 'feedback',
      title: 'Website Feedback',
      fields: [
        createRadioGroupField('rating', 'Overall Rating', [
          { value: '5', label: '5 — Excellent' },
          { value: '4', label: '4 — Good' },
          { value: '3', label: '3 — Average' },
          { value: '2', label: '2 — Poor' },
          { value: '1', label: '1 — Very Poor' },
        ], true),
        createSelectField('feedbackCategory', 'Feedback Category', [
          { value: 'General', label: 'General' },
          { value: 'Navigation', label: 'Navigation & Menus' },
          { value: 'Performance', label: 'Performance & Speed' },
          { value: 'Design', label: 'Design & Layout' },
          { value: 'Features', label: 'Features & Functionality' },
          { value: 'Bug Report', label: 'Bug Report' },
          { value: 'Other', label: 'Other' },
        ], true),
        createTextareaField('overallExperience', 'Overall Experience', true, 4),
        createTextareaField('whatWorksWell', 'What Works Well?', false, 3),
        createTextareaField('whatNeedsImprovement', 'What Needs Improvement?', false, 3),
      ]
    }
  ],

  workflowEnabled: false,
  approvalSteps: [],

  createdBy: 'system',
  createdAt: '2026-04-05',
  tags: ['it', 'website', 'feedback'],

  permissions: {
    view: ['all_employees'],
    fill: ['all_employees'],
    approve: ['it_admin', 'system_admin'],
    admin: ['it_admin', 'system_admin'],
  },
};

// Export all templates
export const defaultFormTemplates = {
  leave_application: leaveApplicationTemplate,
  asset_request: assetRequestTemplate,
  training_request: trainingRequestTemplate,
  it_equipment_access_request: itRequestTemplate,
  website_upgrade_feedback: websiteFeedbackTemplate,
};

// Form categories configuration
export const formCategories = [
  {
    id: 'hr',
    name: 'Human Resources',
    description: 'Employee-related forms and requests',
    icon: 'Users',
    color: '#10B981',
    templates: ['leave_application', 'training_request']
  },
  {
    id: 'it',
    name: 'Information Technology',
    description: 'IT services and equipment requests',
    icon: 'Computer',
    color: '#3B82F6',
    templates: ['it-equipment-access-request', 'website-upgrade-feedback']
  },
  {
    id: 'procurement',
    name: 'Procurement & Finance',
    description: 'Purchase requests and vendor management',
    icon: 'Building',
    color: '#F59E0B',
    templates: ['asset_request']
  }
];
