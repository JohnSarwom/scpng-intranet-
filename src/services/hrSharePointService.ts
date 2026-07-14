/**
 * HR SharePoint Service
 * Handles all SharePoint operations for HR Profiles module
 */

import { Client } from '@microsoft/microsoft-graph-client';
import {
  Employee,
  EmployeeProfile,
  LeaveBalance,
  LeaveRequest,
  EmployeeDocument,
  Training,
  PerformanceReview,
  HRCase,
  EmploymentHistory,
  AuditLogEntry,
  ApprovalAttachment,
  ApprovalHistoryEntry,
  HRStatistics,
  DocumentUploadData,
  LeaveRequestSubmission,
  EmployeeFormData,
  WorkflowApprover,
  WorkflowStage,
  EmailTemplate,
  EmailTemplateStage,
} from '@/types/hr';
import { sendLeaveEmail, sendApproverNotification } from '@/services/hrEmailService';

const SITE_PATH = '/sites/scpngintranet';
const SITE_DOMAIN = 'scpng1.sharepoint.com';

// SharePoint List Names
const LISTS = {
  EMPLOYEES: 'HR_Employees',
  LEAVE_BALANCES: 'HR_LeaveBalances',
  LEAVE_REQUESTS: 'Staff Leave Requests',
  DOCUMENTS: 'HR_Documents',
  TRAINING: 'HR_Training',
  PERFORMANCE_REVIEWS: 'HR_PerformanceReviews',
  HR_CASES: 'HR_Cases',
  EMPLOYMENT_HISTORY: 'HR_EmploymentHistory',
  AUDIT_LOG: 'HR_AuditLog',
  WORKFLOW_APPROVERS: 'HR_WorkflowApprovers',
  EMAIL_TEMPLATES: 'HR_EmailTemplates',
};

const LIBRARY_NAME = 'HR_Documents';
const PENDING_WORKFLOW_STAGES: WorkflowStage[] = ['Manager Review', 'CEO Review', 'Director Review', 'HR Review'];
const TERMINAL_LEAVE_STATUSES = ['Approved', 'Rejected', 'Declined', 'Cancelled'];
const CEO_NAME = 'James Joshua';
const CEO_EMAIL = 'jjoshua@scpng.gov.pg';
const EXECUTIVE_DIVISION = 'Office of the Chairman';
const EXECUTIVE_UNIT = 'Executive Division';
const SECRETARIAT_UNIT = 'Secretariat Unit';
const ALLOW_SELF_LEAVE_APPROVAL_TESTING = true;

const WORKFLOW_NAME_ALIASES: Record<string, string> = {
  'executive division': EXECUTIVE_DIVISION,
  'office of the ceo': EXECUTIVE_DIVISION,
  'office of the chairman': EXECUTIVE_DIVISION,
  'legal division': 'Legal Services Division',
  'legal services division': 'Legal Services Division',
  'research and publication division': 'Research & Publication Division',
  'research publication division': 'Research & Publication Division',
  'research & publication division': 'Research & Publication Division',
  'licensing & supervision division': 'Licensing, Market & Supervision Division',
  'licensing market & supervision division': 'Licensing, Market & Supervision Division',
  'licensing market supervision division': 'Licensing, Market & Supervision Division',
  'licensing, market & supervision division': 'Licensing, Market & Supervision Division',
  'hr unit': 'Human Resource Unit',
  'human resources unit': 'Human Resource Unit',
  'human resource unit': 'Human Resource Unit',
  'legal unit': 'Legal Advisory Unit',
  'legal advisory unit': 'Legal Advisory Unit',
  'media & publication unit': 'Publication Unit',
  'publication unit': 'Publication Unit',
  'research unit': 'Research Unit',
  'market data unit': 'Market Data Unit',
  'executive unit': EXECUTIVE_UNIT,
  'secretariat unit': SECRETARIAT_UNIT,
};

export class HRSharePointService {
  private client: Client;
  private siteId: string | null = null;
  private listIds: Map<string, string> = new Map();

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Initialize service by getting site and list IDs
   */
  async initialize(): Promise<void> {
    try {
      // Get Site ID
      const site = await this.client
        .api(`/sites/${SITE_DOMAIN}:${SITE_PATH}`)
        .get();

      if (!site || !site.id) {
        throw new Error(`Site not found at ${SITE_DOMAIN}:${SITE_PATH}`);
      }

      this.siteId = site.id;
      console.log('✅ HR Service initialized with site ID:', this.siteId);

      // Get all list IDs
      await this.loadListIds();
    } catch (error) {
      console.error('❌ Error initializing HR SharePoint Service:', error);
      throw error;
    }
  }

  /**
   * Load all SharePoint list IDs
   */
  private async loadListIds(): Promise<void> {
    if (!this.siteId) throw new Error('Site ID not initialized');

    try {
      const lists = await this.client
        .api(`/sites/${this.siteId}/lists`)
        .get();

      for (const [key, listName] of Object.entries(LISTS)) {
        const list = lists.value.find((l: any) => l.displayName === listName);
        if (list) {
          this.listIds.set(listName, list.id);
          console.log(`✅ Loaded list ID for ${listName}:`, list.id);
        } else {
          console.warn(`⚠️ List not found: ${listName}`);
        }
      }
    } catch (error) {
      console.error('❌ Error loading list IDs:', error);
      throw error;
    }
  }

  /**
   * Get list ID by name
   */
  private getListId(listName: string): string {
    const listId = this.listIds.get(listName);
    if (!listId) {
      throw new Error(`List ID not found for: ${listName}`);
    }
    return listId;
  }

  /**
   * Fetch items from a list filtered by EmployeeID server-side.
   * The Prefer header allows filtering on non-indexed columns without a hard 403.
   * Handles pagination automatically so callers always get the full result set.
   */
  private async getItemsByEmployeeId(
    listName: string,
    employeeId: string,
    additionalFilter?: string
  ): Promise<any[]> {
    if (!this.siteId) await this.initialize();

    try {
      const listId = this.getListId(listName);
      const safeId = employeeId.replace(/'/g, "''");

      let odata = `fields/EmployeeID eq '${safeId}'`;
      if (additionalFilter === 'fields/IsActive eq true') {
        odata += ` and fields/IsActive eq true`;
      }

      const all: any[] = [];
      let nextLink: string | undefined;

      do {
        const req = nextLink
          ? this.client.api(nextLink)
          : this.client
              .api(`/sites/${this.siteId}/lists/${listId}/items`)
              .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
              .expand('fields')
              .filter(odata)
              .top(500);

        const response = await req.get();
        all.push(...response.value);
        nextLink = response['@odata.nextLink'];
      } while (nextLink);

      return all;
    } catch (error) {
      console.error(`❌ Error fetching items from ${listName}:`, error);
      throw error;
    }
  }

  /**
   * DEBUG: Inspect list columns to find internal names
   */
  async inspectListColumns(listName: string): Promise<void> {
    if (!this.siteId) await this.initialize();
    try {
      const listId = this.getListId(listName);
      const response = await this.client.api(`/sites/${this.siteId}/lists/${listId}/columns`).get();

      const columns = response.value.map((c: any) => ({
        displayName: c.displayName,
        name: c.name, // This is the internal name we need!
        id: c.id,
        type: c.text ? 'Text' : (c.number ? 'Number' : (c.choice ? 'Choice' : 'Other'))
      }));

      console.log(`📋 SCHEMA REPORT FOR '${listName}':`);
      console.table(columns);
      console.log('Detailed Columns:', JSON.stringify(columns, null, 2));
    } catch (error) {
      console.error('❌ Error inspecting columns:', error);
    }
  }

  /**
   * ==========================================
   * EMPLOYEE OPERATIONS
   * ==========================================
   */

  /**
   * Get all employees with optional filtering
   */
  async getEmployees(filter?: {
    status?: string;
    department?: string;
    employmentType?: string;
  }): Promise<Employee[]> {
    if (!this.siteId) await this.initialize();

    try {
      const listId = this.getListId(LISTS.EMPLOYEES);
      let query = this.client.api(`/sites/${this.siteId}/lists/${listId}/items`)
        .expand('fields')
        .top(5000);

      // Build filter query
      const filters: string[] = [];
      if (filter?.status) {
        filters.push(`fields/EmploymentStatus eq '${filter.status}'`);
      }
      if (filter?.department) {
        filters.push(`fields/Department eq '${filter.department}'`);
      }
      if (filter?.employmentType) {
        filters.push(`fields/EmploymentType eq '${filter.employmentType}'`);
      }

      if (filters.length > 0) {
        query = query.filter(filters.join(' and '));
      }

      const response = await query.get();
      return response.value.map((item: any) => this.mapSharePointEmployee(item.fields));
    } catch (error) {
      console.error('❌ Error fetching employees:', error);
      throw error;
    }
  }

  /**
   * Get employee by ID
   */
  async getEmployeeById(employeeId: string): Promise<Employee | null> {
    if (!this.siteId) await this.initialize();

    try {
      const listId = this.getListId(LISTS.EMPLOYEES);

      // Fetch all items and filter client-side to avoid indexing requirement
      // For production, index the EmployeeID column in SharePoint for better performance
      const response = await this.client
        .api(`/sites/${this.siteId}/lists/${listId}/items`)
        .expand('fields')
        .get();

      if (response.value && response.value.length > 0) {
        const employee = response.value.find((item: any) =>
          item.fields.EmployeeID === employeeId
        );

        if (employee) {
          return this.mapSharePointEmployee(employee.fields);
        }
      }
      return null;
    } catch (error) {
      console.error('❌ Error fetching employee:', error);
      throw error;
    }
  }

  /**
   * Get employee by Email
   */
  async getEmployeeByEmail(email: string): Promise<Employee | null> {
    if (!this.siteId) await this.initialize();

    try {
      const listId = this.getListId(LISTS.EMPLOYEES);

      // Filter by Email
      // Sanitize email to prevent OData injection: escape single quotes by doubling them
      const safeEmail = email.replace(/'/g, "''");
      const response = await this.client
        .api(`/sites/${this.siteId}/lists/${listId}/items`)
        .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
        .expand('fields')
        .filter(`fields/Email eq '${safeEmail}'`)
        .get();

      if (response.value && response.value.length > 0) {
        return this.mapSharePointEmployee(response.value[0].fields);
      }
      return null;
    } catch (error) {
      console.error('❌ Error fetching employee by email:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive employee profile with all related data
   */
  async getEmployeeProfile(employeeId: string): Promise<EmployeeProfile | null> {
    try {
      const employee = await this.getEmployeeById(employeeId);
      if (!employee) return null;

      // Fetch all related data in parallel
      const [
        leaveBalances,
        leaveRequests,
        documents,
        trainings,
        performanceReviews,
        employmentHistory,
      ] = await Promise.all([
        this.getLeaveBalances(employeeId),
        this.getLeaveRequests(employeeId),
        this.getDocuments(employeeId),
        this.getTraining(employeeId),
        this.getPerformanceReviews(employeeId),
        this.getEmploymentHistory(employeeId),
      ]);

      return {
        ...employee,
        leaveBalances,
        leaveRequests,
        documents,
        trainings,
        performanceReviews,
        employmentHistory,
      };
    } catch (error) {
      console.error('❌ Error fetching employee profile:', error);
      throw error;
    }
  }

  /**
   * Create new employee
   */
  async createEmployee(data: EmployeeFormData): Promise<Employee> {
    if (!this.siteId) await this.initialize();

    try {
      const listId = this.getListId(LISTS.EMPLOYEES);

      // Generate employee ID if not provided
      const employeeId = data.employeeId || `EMP${Date.now()}`;

      const itemData = {
        fields: {
          EmployeeID: employeeId,
          FirstName: data.firstName,
          LastName: data.lastName,
          PreferredName: data.preferredName,
          Gender: data.gender,
          DateOfBirth: data.dateOfBirth,
          NationalID: data.nationalId,
          Email: data.email,
          Phone: data.phone,
          MobilePhone: data.mobilePhone,
          Address: data.address,
          EmergencyContactName: data.emergencyContactName,
          EmergencyContactPhone: data.emergencyContactPhone,
          EmergencyContactRelation: data.emergencyContactRelation,
          Department: data.department,
          Unit: data.unit,
          JobTitle: data.jobTitle,
          OfficeLocation: data.officeLocation,
          StartDate: data.startDate,
          EmploymentStatus: data.employmentStatus,
          EmploymentType: data.employmentType,
          Grade: data.grade,
          PayScale: data.payScale,
          CostCenter: data.costCenter,
        },
      };

      const response = await this.client
        .api(`/sites/${this.siteId}/lists/${listId}/items`)
        .post(itemData);

      // Log audit entry
      await this.logAudit(employeeId, 'Employee', 'Created', undefined, undefined, undefined, JSON.stringify(data));

      return this.mapSharePointEmployee(response.fields);
    } catch (error) {
      console.error('❌ Error creating employee:', error);
      throw error;
    }
  }

  /**
   * Update employee
   */
  async updateEmployee(itemId: string, data: Partial<EmployeeFormData>): Promise<Employee> {
    if (!this.siteId) await this.initialize();

    try {
      const listId = this.getListId(LISTS.EMPLOYEES);

      const updateData: any = { fields: {} };

      // Map form data to SharePoint fields
      if (data.firstName) updateData.fields.FirstName = data.firstName;
      if (data.lastName) updateData.fields.LastName = data.lastName;
      if (data.preferredName !== undefined) updateData.fields.PreferredName = data.preferredName;
      if (data.email) updateData.fields.Email = data.email;
      if (data.phone !== undefined) updateData.fields.Phone = data.phone;
      if (data.mobilePhone !== undefined) updateData.fields.MobilePhone = data.mobilePhone;
      if (data.jobTitle) updateData.fields.JobTitle = data.jobTitle;
      if (data.department !== undefined) updateData.fields.Department = data.department;
      if (data.unit !== undefined) updateData.fields.Unit = data.unit;
      if (data.employmentStatus) updateData.fields.EmploymentStatus = data.employmentStatus;
      if (data.employmentType) updateData.fields.EmploymentType = data.employmentType;

      const response = await this.client
        .api(`/sites/${this.siteId}/lists/${listId}/items/${itemId}`)
        .patch(updateData);

      return this.mapSharePointEmployee(response.fields);
    } catch (error) {
      console.error('❌ Error updating employee:', error);
      throw error;
    }
  }

  /**
   * ==========================================
   * LEAVE OPERATIONS
   * ==========================================
   */

  /**
   * Create leave balance for employee
   */
  async createLeaveBalance(
    employeeId: string,
    leaveType: string,
    entitlement: number,
    year: number,
    used: number = 0,
    pending: number = 0
  ): Promise<void> {
    if (!this.siteId) await this.initialize();

    try {
      const listId = this.getListId(LISTS.LEAVE_BALANCES);

      const itemData = {
        fields: {
          EmployeeID: employeeId,
          LeaveType: leaveType,
          Year: year.toString(), // Schema: Text
          Entitlement: entitlement.toString(), // Schema: Text
          Used: used.toString(), // Schema: Text
          Pending: pending.toString(), // Schema: Text
          AccrualRate: '0', // Schema: Text
          LastAccrualDate: new Date().toISOString(),
        },
      };

      await this.client
        .api(`/sites/${this.siteId}/lists/${listId}/items`)
        .post(itemData);
    } catch (error) {
      console.error('❌ Error creating leave balance:', error);
      throw error;
    }
  }

  /**
   * Update an employee leave balance row.
   */
  async updateLeaveBalance(
    itemId: string,
    data: {
      leaveType: string;
      year: number;
      entitlement: number;
      used: number;
      pending: number;
      accrualRate?: number;
      lastAccrualDate?: string;
    }
  ): Promise<void> {
    if (!this.siteId) await this.initialize();

    try {
      const listId = this.getListId(LISTS.LEAVE_BALANCES);
      await this.client
        .api(`/sites/${this.siteId}/lists/${listId}/items/${itemId}`)
        .patch({
          fields: {
            LeaveType: data.leaveType,
            Year: data.year.toString(),
            Entitlement: data.entitlement.toString(),
            Used: data.used.toString(),
            Pending: data.pending.toString(),
            AccrualRate: (data.accrualRate ?? 0).toString(),
            LastAccrualDate: data.lastAccrualDate ?? new Date().toISOString(),
          },
        });
    } catch (error) {
      console.error('❌ Error updating leave balance:', error);
      throw error;
    }
  }

  /**
   * Get leave balances for employee
   */
  async getLeaveBalances(employeeId: string): Promise<LeaveBalance[]> {
    try {
      const items = await this.getItemsByEmployeeId(LISTS.LEAVE_BALANCES, employeeId);

      return items.map((item: any) => {
        const entitlement = parseFloat(item.fields.Entitlement || '0');
        const used = parseFloat(item.fields.Used || '0');
        const pending = parseFloat(item.fields.Pending || '0');

        return {
          id: item.id,
          employeeId: item.fields.EmployeeID,
          leaveType: item.fields.LeaveType,
          year: parseInt(item.fields.Year || '0'),
          entitlement: entitlement,
          used: used,
          pending: pending,
          available: entitlement - used - pending,
          accrualRate: parseFloat(item.fields.AccrualRate || '0'),
          lastAccrualDate: item.fields.LastAccrualDate,
        };
      });
    } catch (error) {
      console.error('❌ Error fetching leave balances:', error);
      return [];
    }
  }

  /**
   * Get leave requests for employee
   */
  async getLeaveRequests(employeeId: string): Promise<LeaveRequest[]> {
    try {
      if (!this.siteId) await this.initialize();

      const listId = this.getListId(LISTS.LEAVE_REQUESTS);
      const safeId = employeeId.replace(/'/g, "''");
      const all: any[] = [];
      let nextLink: string | undefined;

      do {
        const req = nextLink
          ? this.client.api(nextLink)
          : this.client
              .api(`/sites/${this.siteId}/lists/${listId}/items`)
              .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
              .expand('fields')
              .filter(`fields/EmployeeID eq '${safeId}'`)
              .top(500);

        const response = await req.get();
        all.push(...response.value);
        nextLink = response['@odata.nextLink'];
      } while (nextLink);

      const sorted = all.sort((a: any, b: any) => {
        const dateA = new Date(a.fields.Start_Date).getTime();
        const dateB = new Date(b.fields.Start_Date).getTime();
        return dateB - dateA;
      });

      return sorted.map((item: any) => this.mapLeaveRequestItem(item));
    } catch (error) {
      console.error('❌ Error fetching leave requests:', error);
      return [];
    }
  }

  /**
   * Get a single leave request by SharePoint item ID.
   * Used by email deep links so terminal and pending requests can be
   * distinguished without relying on the pending approvals list.
   */
  async getLeaveRequestById(itemId: string): Promise<LeaveRequest | null> {
    if (!this.siteId) await this.initialize();

    try {
      const listId = this.getListId(LISTS.LEAVE_REQUESTS);
      const item = await this.client
        .api(`/sites/${this.siteId}/lists/${listId}/items/${itemId}`)
        .expand('fields')
        .get();

      return this.mapLeaveRequestItem(item);
    } catch (error: any) {
      const status = error?.statusCode ?? error?.status;
      const code = String(error?.code ?? '').toLowerCase();
      if (status === 404 || code.includes('itemnotfound')) {
        return null;
      }

      console.error('❌ Error fetching leave request by ID:', error);
      throw error;
    }
  }

  /**
   * Submit leave request
   */
  /**
   * Post a new leave item, auto-creating any unrecognised columns and retrying.
   */
  private async postLeaveItem(
    listId: string,
    fields: Record<string, unknown>,
  ): Promise<any> {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        return await this.client
          .api(`/sites/${this.siteId}/lists/${listId}/items`)
          .post({ fields });
      } catch (err: any) {
        const match = (err?.message ?? '').match(/Field '([^']+)' is not recognized/);
        if (!match) throw err;
        const missingCol = match[1];
        const columnDefinition = ['ApprovalHistory', 'ApprovalAttachments'].includes(missingCol)
          ? { name: missingCol, text: { allowMultipleLines: true } }
          : { name: missingCol, text: {} };
        await this.client
          .api(`/sites/${this.siteId}/lists/${listId}/columns`)
          .post(columnDefinition)
          .catch(() => {});
      }
    }
    return await this.client
      .api(`/sites/${this.siteId}/lists/${listId}/items`)
      .post({ fields });
  }

  /**
   * Patch a leave request item, auto-creating any unrecognised columns and retrying.
   * SharePoint rejects writes to columns that don't exist yet; this helper catches
   * that error, creates the missing column, and retries up to 10 times so every
   * field in the payload is guaranteed to land even on a fresh list.
   */
  private async patchLeaveItem(
    listId: string,
    itemId: string,
    fields: Record<string, unknown>,
  ): Promise<void> {
    let remaining = { ...fields };
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await this.client
          .api(`/sites/${this.siteId}/lists/${listId}/items/${itemId}`)
          .patch({ fields: remaining });
        return; // success
      } catch (err: any) {
        const match = (err?.message ?? '').match(/Field '([^']+)' is not recognized/);
        if (!match) throw err; // unrelated error - rethrow
        const missingCol = match[1];
        // Create the missing column then retry the full payload
        const columnDefinition = ['ApprovalHistory', 'ApprovalAttachments'].includes(missingCol)
          ? { name: missingCol, text: { allowMultipleLines: true } }
          : { name: missingCol, text: {} };
        await this.client
          .api(`/sites/${this.siteId}/lists/${listId}/columns`)
          .post(columnDefinition)
          .catch(() => { /* already exists */ });
      }
    }
    // Final attempt after exhausting retries
    await this.client
      .api(`/sites/${this.siteId}/lists/${listId}/items/${itemId}`)
      .patch({ fields: remaining });
  }

  private parseJsonField<T>(value: unknown, fallback: T): T {
    if (!value || typeof value !== 'string') return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  private createApprovalHistoryEntry(params: {
    stage: string;
    action: ApprovalHistoryEntry['action'];
    actorName: string;
    actorEmail?: string;
    comments?: string;
    attachments?: ApprovalAttachment[];
    fromStage?: string;
    toStage?: string;
  }): ApprovalHistoryEntry {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      stage: params.stage,
      action: params.action,
      actorName: params.actorName,
      actorEmail: params.actorEmail,
      comments: params.comments,
      attachments: params.attachments,
      fromStage: params.fromStage,
      toStage: params.toStage,
      createdAt: new Date().toISOString(),
    };
  }

  private async getLeaveItemFields(listId: string, itemId: string): Promise<Record<string, any>> {
    const item = await this.client
      .api(`/sites/${this.siteId}/lists/${listId}/items/${itemId}`)
      .expand('fields')
      .get();
    return item.fields ?? {};
  }

  private buildApprovalMetadataFields(
    fields: Record<string, any>,
    entry: ApprovalHistoryEntry,
    attachments: ApprovalAttachment[] = [],
  ): Record<string, string> {
    const history = this.parseJsonField<ApprovalHistoryEntry[]>(
      fields.ApprovalHistory,
      [],
    );
    const existingAttachments = this.parseJsonField<ApprovalAttachment[]>(
      fields.ApprovalAttachments,
      [],
    );

    return {
      ApprovalHistory: JSON.stringify([...history, entry]),
      ApprovalAttachments: JSON.stringify([...existingAttachments, ...attachments]),
    };
  }

  private sameEmail(a?: string, b?: string): boolean {
    return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
  }

  private normalizeWorkflowName(value?: string): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const key = raw
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ', ')
      .trim();
    const alias = WORKFLOW_NAME_ALIASES[key] ?? raw;
    return alias
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private workflowNameMatches(configured?: string, requested?: string): boolean {
    const requestedKey = this.normalizeWorkflowName(requested);
    const configuredKey = this.normalizeWorkflowName(configured);
    return (
      configuredKey === requestedKey ||
      configuredKey === 'all' ||
      configuredKey === 'any' ||
      configuredKey === '*'
    );
  }

  private isExecutiveDivisionOrUnit(division?: string, unit?: string): boolean {
    const divisionKey = this.normalizeWorkflowName(division);
    const unitKey = this.normalizeWorkflowName(unit);
    return (
      divisionKey === this.normalizeWorkflowName(EXECUTIVE_DIVISION) ||
      unitKey === this.normalizeWorkflowName(EXECUTIVE_UNIT) ||
      unitKey === this.normalizeWorkflowName(SECRETARIAT_UNIT)
    );
  }

  private async getOfficerProfileFieldsByEmail(email?: string): Promise<Record<string, any> | null> {
    if (!email || !this.siteId) return null;

    try {
      const lists = await this.client
        .api(`/sites/${this.siteId}/lists`)
        .filter("displayName eq 'Strategy_Officer_Profiles'")
        .select('id')
        .get();
      const listId = lists.value?.[0]?.id;
      if (!listId) return null;

      const safeEmail = email.replace(/'/g, "''");
      const res = await this.client
        .api(`/sites/${this.siteId}/lists/${listId}/items`)
        .filter(`fields/Email eq '${safeEmail}'`)
        .expand('fields')
        .top(1)
        .get();

      return res.value?.[0]?.fields ?? null;
    } catch (error) {
      console.warn('Could not load officer profile for executive leave routing:', error);
      return null;
    }
  }

  private async shouldUseExecutiveLeaveRoute(data: {
    employeeEmail?: string;
    division?: string;
    unit?: string;
  }): Promise<boolean> {
    if (this.isExecutiveDivisionOrUnit(data.division, data.unit)) return true;
    if (this.sameEmail(data.employeeEmail, CEO_EMAIL)) return true;

    const profile = await this.getOfficerProfileFieldsByEmail(data.employeeEmail);
    if (!profile) return false;

    const reportsToName = String(profile.ReportsToName ?? '').trim();
    const reportsToTitle = String(profile.ReportsToTitle ?? '').trim().toLowerCase();
    const jobTitle = String(profile.JobTitle ?? '').trim().toLowerCase();

    return (
      reportsToName.toLowerCase() === CEO_NAME.toLowerCase() ||
      reportsToTitle.includes('ceo') ||
      jobTitle.includes('chief executive officer') ||
      this.isExecutiveDivisionOrUnit(profile.Division, profile.Unit)
    );
  }

  private isPendingWorkflowStage(stage?: string): stage is WorkflowStage {
    return PENDING_WORKFLOW_STAGES.includes(stage as WorkflowStage);
  }

  private workflowApproverCandidates(
    approver: WorkflowApprover,
    requesterEmail?: string,
  ): Array<{ approverName: string; approverEmail: string }> {
    const primary = {
      approverName: approver.approverName,
      approverEmail: approver.approverEmail,
    };
    const delegate = {
      approverName: approver.delegateName ?? '',
      approverEmail: approver.delegateEmail ?? '',
    };
    const escalation = {
      approverName: approver.escalationName ?? '',
      approverEmail: approver.escalationEmail ?? '',
    };
    const executiveFallback = {
      approverName: approver.executiveFallbackName ?? '',
      approverEmail: approver.executiveFallbackEmail ?? '',
    };

    const ordered = !ALLOW_SELF_LEAVE_APPROVAL_TESTING && this.sameEmail(primary.approverEmail, requesterEmail)
      ? [escalation, executiveFallback, delegate]
      : [primary, delegate, escalation, executiveFallback];

    const seen = new Set<string>();
    return ordered.filter(candidate => {
      const email = candidate.approverEmail.trim().toLowerCase();
      if (!email || seen.has(email)) return false;
      if (!ALLOW_SELF_LEAVE_APPROVAL_TESTING && this.sameEmail(email, requesterEmail)) return false;
      seen.add(email);
      return true;
    });
  }

  private resolveWorkflowApprover(
    approver: WorkflowApprover,
    requesterEmail?: string,
    actingEmail?: string,
  ): WorkflowApprover | null {
    const candidate = this.workflowApproverCandidates(approver, requesterEmail)
      .find(item => !actingEmail || this.sameEmail(item.approverEmail, actingEmail));

    return candidate
      ? {
          ...approver,
          approverName: candidate.approverName,
          approverEmail: candidate.approverEmail,
        }
      : null;
  }

  private async assertLeaveActionAllowed(
    fields: Record<string, any>,
    approverEmail: string,
    action: 'approve' | 'reject',
  ): Promise<{
    currentStage: WorkflowStage;
    employeeEmail: string;
    division: string;
    unit: string;
  }> {
    const currentStage = fields.Stage;
    const approvalStatus = fields.ApprovalStatus;
    const employeeEmail = fields.EmployeeEmail || fields.Email || '';
    const division = fields.Division || '';
    const unit = fields.Unit || '';

    if (!this.isPendingWorkflowStage(currentStage)) {
      throw new Error(`Cannot ${action} a request at stage: "${currentStage || 'Not recorded'}"`);
    }

    if (TERMINAL_LEAVE_STATUSES.includes(approvalStatus)) {
      throw new Error(`This request is already ${String(approvalStatus).toLowerCase()}.`);
    }

    if (!ALLOW_SELF_LEAVE_APPROVAL_TESTING && this.sameEmail(approverEmail, employeeEmail)) {
      throw new Error(`You cannot ${action} your own request. It must be routed to a higher-level approver.`);
    }

    const configuredApprover = await this.getApproverForStage(division, unit, currentStage);
    if (!configuredApprover) {
      throw new Error(`No approver is configured for ${division || 'this division'} / ${unit || 'this unit'} at ${currentStage}.`);
    }

    const allowedApprover = this.resolveWorkflowApprover(configuredApprover, employeeEmail, approverEmail);
    if (!allowedApprover) {
      const effectiveApprover = this.resolveWorkflowApprover(configuredApprover, employeeEmail);
      throw new Error(`Only ${effectiveApprover?.approverName || effectiveApprover?.approverEmail || 'a configured approver'} can ${action} this ${currentStage} request.`);
    }

    return { currentStage, employeeEmail, division, unit };
  }

  private async resolveLeaveStageAvoidingSelf(
    requestedStage: WorkflowStage,
    employeeEmail: string | undefined,
    division: string,
    unit: string,
    executiveRoute = false,
  ): Promise<{ stage: WorkflowStage; step: string; approver: WorkflowApprover | null; skippedStages: WorkflowStage[] }> {
    const ordered: WorkflowStage[] = executiveRoute
      ? ['CEO Review', 'HR Review']
      : ['Manager Review', 'Director Review', 'HR Review'];
    let startIndex = ordered.indexOf(requestedStage);
    if (startIndex < 0) startIndex = 0;

    const skippedStages: WorkflowStage[] = [];

    for (let i = startIndex; i < ordered.length; i++) {
      const stage = ordered[i];
      const approverRow = await this.getApproverForStage(division, unit, stage);
      const approver = approverRow
        ? this.resolveWorkflowApprover(approverRow, employeeEmail)
        : null;
      const managerApprover = stage === 'Director Review'
        ? await this.getApproverForStage(division, unit, 'Manager Review')
        : null;
      const shouldSkipDirector =
        stage === 'Director Review' &&
        requestedStage === 'Director Review' &&
        managerApprover?.skipDirectorReview;

      if (shouldSkipDirector || !approver) {
        skippedStages.push(stage);
        continue;
      }

      return {
        stage,
        step: stage === 'CEO Review' ? '2' : stage === 'HR Review' ? '4' : String(i + 2),
        approver,
        skippedStages,
      };
    }

    throw new Error('No valid approver found. The requester cannot approve their own leave request.');
  }

  async submitLeaveRequest(data: LeaveRequestSubmission): Promise<LeaveRequest> {
    if (!this.siteId) await this.initialize();

    try {
      // Reject submissions with no leave type
      if (!data.leaveType || data.leaveType === 'N/A') {
        throw new Error('A leave type must be selected before submitting.');
      }

      // Check for overlapping active requests before creating
      const existing = await this.getLeaveRequests(data.employeeId);
      const reqStart = new Date(data.startDate);
      const reqEnd = new Date(data.endDate);
      const conflict = existing.find(req => {
        if (['Rejected', 'Declined', 'Cancelled'].includes(req.status)) return false;
        const existStart = new Date(req.startDate);
        const existEnd = new Date(req.endDate);
        return reqStart <= existEnd && reqEnd >= existStart;
      });
      if (conflict) {
        throw new Error(
          `An active leave request already covers overlapping dates (${conflict.startDate} - ${conflict.endDate}, ID: ${conflict.id}). ` +
          `Please cancel it before submitting a new request for the same period.`
        );
      }

      const listId = this.getListId(LISTS.LEAVE_REQUESTS);
      const executiveRoute = await this.shouldUseExecutiveLeaveRoute({
        employeeEmail: data.employeeEmail,
        division: data.division,
        unit: data.unit,
      });
      const initialRouting = await this.resolveLeaveStageAvoidingSelf(
        executiveRoute ? 'CEO Review' : 'Manager Review',
        data.employeeEmail,
        data.division ?? '',
        data.unit ?? '',
        executiveRoute,
      ).catch(() => ({
        stage: (executiveRoute ? 'CEO Review' : 'Manager Review') as WorkflowStage,
        step: '2',
        approver: null,
        skippedStages: [],
      }));

      const submissionHistory = this.createApprovalHistoryEntry({
        stage: 'Submitted',
        action: initialRouting.skippedStages.length ? 'Escalated' : 'Submitted',
        actorName: data.name ?? data.employeeId,
        actorEmail: data.employeeEmail,
        comments: initialRouting.skippedStages.length
          ? `Submitted and routed to ${initialRouting.stage} because ${initialRouting.skippedStages.join(', ')} was skipped.`
          : 'Submitted leave application.',
        fromStage: 'Submitted',
        toStage: initialRouting.stage,
      });

      const itemData = {
        fields: {
          EmployeeID: data.employeeId,
          Name: data.name,
          EmployeeEmail: data.employeeEmail ?? '',
          Division: data.division,
          Unit: data.unit,
          Type_of_leave: data.leaveType,
          Start_Date: data.startDate,
          End_Date: data.endDate,
          Reason: data.reason,
          Stage: initialRouting.stage,
          CurrentStep: initialRouting.step, // Schema defines this as Text
          Request_ID: `REQ-${data.employeeId}-${Date.now()}`,
          Submission_Date: new Date().toISOString().split('T')[0],
          TotalLeaveDays: data.daysRequested,
          ApprovalStatus: 'Pending',
          ApprovalHistory: JSON.stringify([submissionHistory]),
        },
      };

      const response = await this.postLeaveItem(listId, itemData.fields);

      const leaveRequest: LeaveRequest = {
        id: response.id,
        employeeId: response.fields.EmployeeID,
        leaveType: response.fields.Type_of_leave,
        startDate: response.fields.Start_Date,
        endDate: response.fields.End_Date,
        daysRequested: response.fields.TotalLeaveDays,
        reason: response.fields.Reason,
        status: response.fields.ApprovalStatus,
        stage: response.fields.Stage,
        currentStep: parseInt(response.fields.CurrentStep || '0'),
        createdDate: response.fields.Created,
      };

      // Increment pending balance so available days reflect the in-flight request
      try {
        const year = new Date().getFullYear();
        await this.incrementPendingBalance(data.employeeId, data.leaveType, data.daysRequested, year);
      } catch (e) {
        console.warn('⚠️ Could not increment pending balance after submission:', e);
      }

      await this.logAudit(data.employeeId, 'Leave', 'Created', data.employeeId,
        'Stage', undefined, initialRouting.stage);

      // Send submission confirmation to employee
      if (data.employeeEmail) {
        sendLeaveEmail(this.client, {
          to: data.employeeEmail,
          employeeName: data.name ?? data.employeeId,
          leaveType: data.leaveType,
          startDate: data.startDate,
          endDate: data.endDate,
          days: data.daysRequested,
          division: data.division,
          unit: data.unit,
          stage: 'Submission',
        });
      }

      // Notify the manager (Stage 1 approver) so they can act from email
      try {
        const approverRow = initialRouting.approver ?? await this.getApproverForStage(
          data.division ?? '', data.unit ?? '', initialRouting.stage
        );
        const approver = approverRow
          ? this.resolveWorkflowApprover(approverRow, data.employeeEmail)
          : null;
        if (approver?.approverEmail) {
          sendApproverNotification(this.client, {
            to: approver.approverEmail,
            approverName: approver.approverName,
            employeeName: data.name ?? data.employeeId,
            leaveType: data.leaveType,
            startDate: data.startDate,
            endDate: data.endDate,
            days: data.daysRequested,
            stage: initialRouting.stage,
            division: data.division,
            unit: data.unit,
            requestId: leaveRequest.id,
            appUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
          });
        }
      } catch {
        // Approver lookup failed - skip notification gracefully
      }

      return leaveRequest;
    } catch (error) {
      console.error('❌ Error submitting leave request:', error);
      throw error;
    }
  }

  /**
   * Increment the Pending days for an employee's leave balance.
   * Called when a request is submitted so available = entitlement - used - pending
   * reflects in-flight requests immediately.
   */
  async incrementPendingBalance(
    employeeId: string,
    leaveType: string,
    daysToAdd: number,
    year: number
  ): Promise<void> {
    if (!this.siteId) await this.initialize();

    const balances = await this.getLeaveBalances(employeeId);
    const balance = balances.find(
      b =>
        b.leaveType.toLowerCase() === leaveType.toLowerCase() &&
        (b.year === year || b.year === 0)
    );

    if (!balance) return; // No matching balance row - skip silently

    const newPending = balance.pending + daysToAdd;
    const listId = this.getListId(LISTS.LEAVE_BALANCES);

    await this.client
      .api(`/sites/${this.siteId}/lists/${listId}/items/${balance.id}`)
      .patch({ fields: { Pending: String(newPending) } });
  }

  /**
   * Fetch all leave requests that are currently in-flight (not terminal).
   * Used by the Approver Dashboard to list actionable requests.
   * Pass filterStage to scope to a specific approval stage.
   */
  async getAllPendingLeaveRequests(filterStage?: string): Promise<LeaveRequest[]> {
    if (!this.siteId) await this.initialize();

    try {
      const listId = this.getListId(LISTS.LEAVE_REQUESTS);
      const all: any[] = [];
      let nextLink: string | undefined;

      do {
        const req = nextLink
          ? this.client.api(nextLink)
          : this.client
              .api(`/sites/${this.siteId}/lists/${listId}/items`)
              .expand('fields')
              .top(500);

        const response = await req.get();
        all.push(...response.value);
        nextLink = response['@odata.nextLink'];
      } while (nextLink);

      let items: any[] = all;

      if (filterStage) {
        items = items.filter((item: any) => item.fields.Stage === filterStage);
      } else {
        items = items.filter((item: any) => !TERMINAL_LEAVE_STATUSES.includes(item.fields.ApprovalStatus));
      }

      return items
        .sort((a: any, b: any) =>
          new Date(a.fields.Created).getTime() - new Date(b.fields.Created).getTime()
        )
        .map((item: any) => this.mapLeaveRequestItem(item));
    } catch (error) {
      console.error('❌ Error fetching all pending leave requests:', error);
      return [];
    }
  }

  /**
   * Fetch every leave request for the central approval history view.
   * Access should be restricted by the caller to HR users or configured approvers.
   */
  async getAllLeaveRequests(): Promise<LeaveRequest[]> {
    if (!this.siteId) await this.initialize();

    try {
      const listId = this.getListId(LISTS.LEAVE_REQUESTS);
      const all: any[] = [];
      let nextLink: string | undefined;

      do {
        const req = nextLink
          ? this.client.api(nextLink)
          : this.client
              .api(`/sites/${this.siteId}/lists/${listId}/items`)
              .expand('fields')
              .top(500);

        const response = await req.get();
        all.push(...response.value);
        nextLink = response['@odata.nextLink'];
      } while (nextLink);

      return all
        .sort((a: any, b: any) =>
          new Date(b.fields.Created).getTime() - new Date(a.fields.Created).getTime()
        )
        .map((item: any) => this.mapLeaveRequestItem(item));
    } catch (error) {
      console.error('❌ Error fetching all leave requests:', error);
      return [];
    }
  }

  /**
   * Approve a leave request, advancing it to the next workflow stage.
   * On final HR approval, balance is deducted automatically.
   */
  async approveLeaveRequest(
    itemId: string,
    currentStage: string,
    approverName: string,
    approverEmail: string,
    employeeId: string,
    leaveType: string,
    daysRequested: number,
    comments?: string,
    attachments?: ApprovalAttachment[],
    emailCtx?: {
      employeeEmail: string;
      employeeName: string;
      startDate: string;
      endDate: string;
      division?: string;
      unit?: string;
    }
  ): Promise<void> {
    if (!this.siteId) await this.initialize();

    const listId = this.getListId(LISTS.LEAVE_REQUESTS);
    const existingFields = await this.getLeaveItemFields(listId, itemId);
    const actionContext = await this.assertLeaveActionAllowed(existingFields, approverEmail, 'approve');
    const currentWorkflowStage = actionContext.currentStage;
    const employeeEmail = actionContext.employeeEmail;
    const division = emailCtx?.division ?? actionContext.division;
    const unit = emailCtx?.unit ?? actionContext.unit;

    const today = new Date().toISOString().split('T')[0];

    const updateFields: Record<string, string> = {};
    let nextStage: string;
    let nextStep: string;

    switch (currentWorkflowStage) {
      case 'Manager Review':
        updateFields['Approver_Manager'] = approverName;
        updateFields['Manager_Approval_Date'] = today;
        {
          const resolved = await this.resolveLeaveStageAvoidingSelf(
            'Director Review',
            employeeEmail,
            division,
            unit,
          );
          nextStage = resolved.stage;
          nextStep = resolved.step;
        }
        break;
      case 'CEO Review':
        updateFields['Approver_CEO'] = approverName;
        updateFields['CEO_Approval_Date'] = today;
        {
          const resolved = await this.resolveLeaveStageAvoidingSelf(
            'HR Review',
            employeeEmail,
            division,
            unit,
            true,
          );
          nextStage = resolved.stage;
          nextStep = resolved.step;
        }
        break;
      case 'Director Review':
        updateFields['Approver_Director'] = approverName;
        updateFields['Director_Approval_Date'] = today;
        {
          const resolved = await this.resolveLeaveStageAvoidingSelf(
            'HR Review',
            employeeEmail,
            division,
            unit,
          );
          nextStage = resolved.stage;
          nextStep = resolved.step;
        }
        break;
      case 'HR Review':
        nextStage = 'Approved';
        nextStep = '5';
        updateFields['Approver_HR'] = approverName;
        updateFields['HR_Approval_Date'] = today;
        updateFields['ApprovalStatus'] = 'Approved';
        updateFields['ApprovedBy'] = approverName;
        updateFields['ApprovedDate'] = today;
        break;
      default:
        throw new Error(`Cannot approve a request at stage: "${currentWorkflowStage}"`);
    }

    updateFields['Stage'] = nextStage;
    updateFields['CurrentStep'] = nextStep;
    if (comments) updateFields['HRRemarks'] = comments;

    if (nextStage === 'Approved') {
      const year = new Date().getFullYear();
      await this.deductLeaveBalance(employeeId, leaveType, daysRequested, year);
    }

    Object.assign(
      updateFields,
      this.buildApprovalMetadataFields(
        existingFields,
        this.createApprovalHistoryEntry({
          stage: currentWorkflowStage,
          action: 'Approved',
          actorName: approverName,
          actorEmail: approverEmail,
          comments,
          attachments,
          fromStage: currentWorkflowStage,
          toStage: nextStage,
        }),
        attachments ?? [],
      ),
    );

    await this.patchLeaveItem(listId, itemId, updateFields);

    await this.logAudit(employeeId, 'Leave', 'Updated', approverEmail,
      'Stage', currentWorkflowStage, nextStage);

    // --- Employee status email (requires their stored email address) ---
    if (emailCtx?.employeeEmail) {
      const stageMap: Record<string, 'Manager Approved' | 'CEO Approved' | 'Director Approved' | 'Fully Approved'> = {
        'Manager Review': 'Manager Approved',
        'CEO Review': 'CEO Approved',
        'Director Review': 'Director Approved',
        'HR Review': 'Fully Approved',
      };
      const emailStage = stageMap[currentWorkflowStage];
      if (emailStage) {
        sendLeaveEmail(this.client, {
          to: emailCtx.employeeEmail,
          employeeName: emailCtx.employeeName,
          leaveType,
          startDate: emailCtx.startDate,
          endDate: emailCtx.endDate,
          days: daysRequested,
          division: emailCtx.division,
          unit: emailCtx.unit,
          stage: emailStage,
          approverName,
        });
      }
    }

    // --- Next-stage approver notification (always fires, regardless of employee email) ---
    // This ensures the chain continues whether the action came from the dashboard or email.
    if (nextStage !== 'Approved' && emailCtx) {
      try {
        const nextApproverRow = await this.getApproverForStage(
          emailCtx.division ?? '', emailCtx.unit ?? '', nextStage as any
        );
        const nextApprover = nextApproverRow
          ? this.resolveWorkflowApprover(nextApproverRow, employeeEmail)
          : null;
        if (nextApprover?.approverEmail) {
          sendApproverNotification(this.client, {
            to: nextApprover.approverEmail,
            approverName: nextApprover.approverName,
            employeeName: emailCtx.employeeName,
            leaveType,
            startDate: emailCtx.startDate,
            endDate: emailCtx.endDate,
            days: daysRequested,
            stage: nextStage,
            division: emailCtx.division,
            unit: emailCtx.unit,
            requestId: itemId,
            appUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
          });
        }
      } catch {
        // Approver lookup failed - skip notification gracefully
      }
    }
  }

  /**
   * Reject a leave request at any approval stage.
   * Requires a reason. Reverses the pending balance that was incremented on submission.
   */
  async rejectLeaveRequest(
    itemId: string,
    currentStage: string,
    approverName: string,
    approverEmail: string,
    employeeId: string,
    reason: string,
    leaveType: string,
    daysRequested: number,
    attachments?: ApprovalAttachment[],
    emailCtx?: {
      employeeEmail: string;
      employeeName: string;
      startDate: string;
      endDate: string;
      division?: string;
      unit?: string;
    }
  ): Promise<void> {
    if (!this.siteId) await this.initialize();

    const listId = this.getListId(LISTS.LEAVE_REQUESTS);
    const existingFields = await this.getLeaveItemFields(listId, itemId);
    const actionContext = await this.assertLeaveActionAllowed(existingFields, approverEmail, 'reject');
    const currentWorkflowStage = actionContext.currentStage;

    const today = new Date().toISOString().split('T')[0];

    await this.patchLeaveItem(listId, itemId, {
      ApprovalStatus: 'Rejected',
      Stage: 'Rejected',
      HRRemarks: reason,
      ApprovedBy: approverName,
      ApprovedDate: today,
      ...this.buildApprovalMetadataFields(
        existingFields,
        this.createApprovalHistoryEntry({
          stage: currentWorkflowStage,
          action: 'Rejected',
          actorName: approverName,
          actorEmail: approverEmail,
          comments: reason,
          attachments,
          fromStage: currentWorkflowStage,
          toStage: 'Rejected',
        }),
        attachments ?? [],
      ),
    });

    // Reverse the pending balance that was incremented when the request was submitted
    try {
      const year = new Date().getFullYear();
      const balances = await this.getLeaveBalances(employeeId);
      const balance = balances.find(
        b =>
          b.leaveType.toLowerCase() === leaveType.toLowerCase() &&
          (b.year === year || b.year === 0)
      );
      if (balance) {
        const newPending = Math.max(0, balance.pending - daysRequested);
        const balListId = this.getListId(LISTS.LEAVE_BALANCES);
        await this.client
          .api(`/sites/${this.siteId}/lists/${balListId}/items/${balance.id}`)
          .patch({ fields: { Pending: String(newPending) } });
      }
    } catch (e) {
      console.warn('⚠️ Could not reverse pending balance on rejection:', e);
    }

    await this.logAudit(employeeId, 'Leave', 'Updated', approverEmail,
      'ApprovalStatus', currentWorkflowStage, 'Rejected');

    if (emailCtx?.employeeEmail) {
      sendLeaveEmail(this.client, {
        to: emailCtx.employeeEmail,
        employeeName: emailCtx.employeeName,
        leaveType,
        startDate: emailCtx.startDate,
        endDate: emailCtx.endDate,
        days: daysRequested,
        division: emailCtx.division,
        unit: emailCtx.unit,
        stage: 'Rejected',
        approverName,
        rejectionReason: reason,
      });
    }
  }

  /**
   * Cancel a pending leave request (employee self-service).
   * Only requests in Pending/Manager Review/Director Review stage can be cancelled.
   * Reverses the pending balance increment.
   */
  async cancelLeaveRequest(
    itemId: string,
    employeeId: string,
    leaveType: string,
    daysRequested: number,
    cancellerEmail: string
  ): Promise<void> {
    if (!this.siteId) await this.initialize();

    const listId = this.getListId(LISTS.LEAVE_REQUESTS);
    const existingFields = await this.getLeaveItemFields(listId, itemId);
    const requestEmployeeId = String(existingFields.EmployeeID ?? '').trim();
    const requestEmployeeEmail = String(existingFields.EmployeeEmail ?? existingFields.Email ?? '').trim();
    const requestStatus = String(existingFields.ApprovalStatus ?? '').trim();
    const requestStage = String(existingFields.Stage ?? '').trim();

    if (requestEmployeeId !== String(employeeId).trim()) {
      throw new Error('You can only cancel your own leave request.');
    }

    if (requestEmployeeEmail && !this.sameEmail(requestEmployeeEmail, cancellerEmail)) {
      throw new Error('You can only cancel leave requests submitted under your account.');
    }

    if (TERMINAL_LEAVE_STATUSES.includes(requestStatus) || ['Director Review', 'HR Review', 'Approved', 'Rejected', 'Cancelled'].includes(requestStage)) {
      throw new Error(`This leave request can no longer be cancelled at stage: ${requestStage || requestStatus || 'Unknown'}.`);
    }

    if (requestStatus && requestStatus !== 'Pending') {
      throw new Error(`Only pending leave requests can be cancelled. Current status: ${requestStatus}.`);
    }

    await this.client
      .api(`/sites/${this.siteId}/lists/${listId}/items/${itemId}`)
      .patch({
        fields: {
          ApprovalStatus: 'Cancelled',
          Stage: 'Cancelled',
          ...this.buildApprovalMetadataFields(
            existingFields,
            this.createApprovalHistoryEntry({
              stage: existingFields.Stage ?? 'Submitted',
              action: 'Cancelled',
              actorName: cancellerEmail || employeeId,
              actorEmail: cancellerEmail,
              comments: 'Request cancelled by applicant.',
              fromStage: existingFields.Stage,
              toStage: 'Cancelled',
            }),
          ),
        },
      });

    // Reverse the pending balance that was incremented on submission
    try {
      const year = new Date().getFullYear();
      const balances = await this.getLeaveBalances(employeeId);
      const balance = balances.find(
        b =>
          b.leaveType.toLowerCase() === leaveType.toLowerCase() &&
          (b.year === year || b.year === 0)
      );
      if (balance) {
        const newPending = Math.max(0, balance.pending - daysRequested);
        const balListId = this.getListId(LISTS.LEAVE_BALANCES);
        await this.client
          .api(`/sites/${this.siteId}/lists/${balListId}/items/${balance.id}`)
          .patch({ fields: { Pending: String(newPending) } });
      }
    } catch (e) {
      console.warn('⚠️ Could not reverse pending balance on cancellation:', e);
    }

    await this.logAudit(employeeId, 'Leave', 'Updated', cancellerEmail,
      'ApprovalStatus', 'Pending', 'Cancelled');
  }

  /**
   * Deduct approved leave days from an employee's balance.
   * Called when HR marks a request Approved (fallback if Power Automate flow is not deployed).
   * Simultaneously reduces Used and clears the matching Pending amount.
   */
  async deductLeaveBalance(
    employeeId: string,
    leaveType: string,
    daysToDeduct: number,
    year: number
  ): Promise<void> {
    if (!this.siteId) await this.initialize();

    const balances = await this.getLeaveBalances(employeeId);
    // Match on leave type case-insensitively; fall back to any year if year=0
    const balance = balances.find(
      b =>
        b.leaveType.toLowerCase() === leaveType.toLowerCase() &&
        (b.year === year || b.year === 0)
    );

    if (!balance) {
      throw new Error(
        `No leave balance found for employee ${employeeId} - type: "${leaveType}", year: ${year}.`
      );
    }

    const newUsed = balance.used + daysToDeduct;
    if (newUsed > balance.entitlement) {
      throw new Error(
        `Deducting ${daysToDeduct} day(s) would exceed the entitlement of ${balance.entitlement}. ` +
        `Currently used: ${balance.used}.`
      );
    }

    // Reduce pending by the same amount (min 0) since the request is now approved
    const newPending = Math.max(0, balance.pending - daysToDeduct);

    try {
      const listId = this.getListId(LISTS.LEAVE_BALANCES);
      await this.client
        .api(`/sites/${this.siteId}/lists/${listId}/items/${balance.id}`)
        .patch({
          fields: {
            Used: String(newUsed),
            Pending: String(newPending),
          },
        });
    } catch (error) {
      console.error('❌ Error deducting leave balance:', error);
      throw error;
    }
  }

  /**
   * ==========================================
   * DOCUMENT OPERATIONS
   * ==========================================
   */

  /**
   * Get documents for employee
   */
  async getDocuments(employeeId: string): Promise<EmployeeDocument[]> {
    try {
      // Fetch with IsActive filter (can use server-side as it's not EmployeeID)
      const items = await this.getItemsByEmployeeId(
        LISTS.DOCUMENTS,
        employeeId,
        'fields/IsActive eq true'
      );

      // Sort by upload date descending (client-side)
      const sorted = items.sort((a: any, b: any) => {
        const dateA = new Date(a.fields.UploadDate).getTime();
        const dateB = new Date(b.fields.UploadDate).getTime();
        return dateB - dateA;
      });

      return sorted.map((item: any) => ({
        id: item.id,
        employeeId: item.fields.EmployeeID,
        documentType: item.fields.DocumentType,
        documentName: item.fields.DocumentName,
        fileUrl: item.fields.FileURL,
        uploadedBy: item.fields.UploadedBy,
        uploadDate: item.fields.UploadDate,
        expiryDate: item.fields.ExpiryDate,
        version: item.fields.Version || 1,
        isActive: item.fields.IsActive,
        notes: item.fields.Notes,
      }));
    } catch (error) {
      console.error('❌ Error fetching documents:', error);
      return [];
    }
  }

  /**
   * ==========================================
   * TRAINING OPERATIONS
   * ==========================================
   */

  /**
   * Get training records for employee
   */
  async getTraining(employeeId: string): Promise<Training[]> {
    try {
      const items = await this.getItemsByEmployeeId(LISTS.TRAINING, employeeId);

      // Sort by completion date descending (client-side)
      const sorted = items.sort((a: any, b: any) => {
        const dateA = new Date(a.fields.CompletionDate).getTime();
        const dateB = new Date(b.fields.CompletionDate).getTime();
        return dateB - dateA;
      });

      return sorted.map((item: any) => ({
        id: item.id,
        employeeId: item.fields.EmployeeID,
        courseName: item.fields.CourseName,
        provider: item.fields.Provider,
        completionDate: item.fields.CompletionDate,
        expiryDate: item.fields.ExpiryDate,
        certificateUrl: item.fields.CertificateURL,
        status: item.fields.Status,
        cost: item.fields.Cost,
        notes: item.fields.Notes,
      }));
    } catch (error) {
      console.error('❌ Error fetching training records:', error);
      return [];
    }
  }

  /**
   * ==========================================
   * PERFORMANCE REVIEW OPERATIONS
   * ==========================================
   */

  /**
   * Get performance reviews for employee
   */
  async getPerformanceReviews(employeeId: string): Promise<PerformanceReview[]> {
    try {
      const items = await this.getItemsByEmployeeId(LISTS.PERFORMANCE_REVIEWS, employeeId);

      // Sort by review date descending (client-side)
      const sorted = items.sort((a: any, b: any) => {
        const dateA = new Date(a.fields.ReviewDate).getTime();
        const dateB = new Date(b.fields.ReviewDate).getTime();
        return dateB - dateA;
      });

      return sorted.map((item: any) => ({
        id: item.id,
        employeeId: item.fields.EmployeeID,
        reviewPeriod: item.fields.ReviewPeriod,
        reviewDate: item.fields.ReviewDate,
        reviewType: item.fields.ReviewType,
        reviewer: item.fields.Reviewer,
        overallRating: item.fields.OverallRating,
        strengths: item.fields.Strengths,
        areasForImprovement: item.fields.AreasForImprovement,
        goals: item.fields.Goals,
        employeeComments: item.fields.EmployeeComments,
        status: item.fields.Status,
      }));
    } catch (error) {
      console.error('❌ Error fetching performance reviews:', error);
      return [];
    }
  }

  /**
   * ==========================================
   * EMPLOYMENT HISTORY OPERATIONS
   * ==========================================
   */

  /**
   * Get employment history for employee
   */
  async getEmploymentHistory(employeeId: string): Promise<EmploymentHistory[]> {
    try {
      const items = await this.getItemsByEmployeeId(LISTS.EMPLOYMENT_HISTORY, employeeId);

      // Sort by effective date descending (client-side)
      const sorted = items.sort((a: any, b: any) => {
        const dateA = new Date(a.fields.EffectiveDate).getTime();
        const dateB = new Date(b.fields.EffectiveDate).getTime();
        return dateB - dateA;
      });

      return sorted.map((item: any) => ({
        id: item.id,
        employeeId: item.fields.EmployeeID,
        changeType: item.fields.ChangeType,
        previousJobTitle: item.fields.PreviousJobTitle,
        newJobTitle: item.fields.NewJobTitle,
        previousDepartment: item.fields.PreviousDepartment,
        newDepartment: item.fields.NewDepartment,
        previousGrade: item.fields.PreviousGrade,
        newGrade: item.fields.NewGrade,
        effectiveDate: item.fields.EffectiveDate,
        reason: item.fields.Reason,
        approvedBy: item.fields.ApprovedBy,
      }));
    } catch (error) {
      console.error('❌ Error fetching employment history:', error);
      return [];
    }
  }

  /**
   * ==========================================
   * STATISTICS & REPORTING
   * ==========================================
   */

  /**
   * Get HR statistics
   */
  async getHRStatistics(): Promise<HRStatistics> {
    try {
      const employees = await this.getEmployees();

      const stats: HRStatistics = {
        totalEmployees: employees.length,
        activeEmployees: employees.filter(e => e.employmentStatus === 'Active').length,
        onLeave: employees.filter(e => e.employmentStatus === 'On Leave').length,
        byDepartment: {},
        byEmploymentType: {
          Permanent: 0,
          Contract: 0,
          Casual: 0,
          Temporary: 0,
          Intern: 0,
          Consultant: 0,
          Agency: 0,
        },
        contractsExpiring: 0,
        documentsExpiring: 0,
        certificationsExpiring: 0,
        lowLeaveBalance: 0,
      };

      // Count by department
      employees.forEach(emp => {
        if (emp.department) {
          stats.byDepartment[emp.department] = (stats.byDepartment[emp.department] || 0) + 1;
        }
        if (emp.employmentType) {
          stats.byEmploymentType[emp.employmentType]++;
        }
      });

      return stats;
    } catch (error) {
      console.error('❌ Error fetching HR statistics:', error);
      throw error;
    }
  }

  /**
   * ==========================================
   * ADMIN OPERATIONS
   * ==========================================
   */

  /**
   * Delete ALL data from all HR lists.
   * WARNING: Permanently destructive. Caller must pass callerIsAdmin=true after
   * verifying the user has admin role via useRoleBasedAuth().isAdmin.
   */
  async deleteAllData(callerIsAdmin: boolean = false): Promise<void> {
    if (!callerIsAdmin) {
      throw new Error(
        'deleteAllData requires admin privileges. Verify the caller has admin role before passing callerIsAdmin: true.'
      );
    }
    if (!this.siteId) await this.initialize();

    try {
      console.log('⚠️ STARTING DELETE ALL DATA OPERATION');

      // 1. Get all list IDs
      if (this.listIds.size === 0) {
        await this.loadListIds();
      }

      // 2. Iterate through all lists
      for (const [listKey, listName] of Object.entries(LISTS)) {
        console.log(`🗑️ Processing list: ${listName}`);

        try {
          const listId = this.getListId(listName);

          // Get all items from the list (just needed fields to keep it light)
          let items: any[] = [];
          let hasMore = true;
          let nextLink: string | undefined = undefined;

          // Fetch all items with pagination
          while (hasMore) {
            let request: any;

            if (nextLink) {
              request = this.client.api(nextLink);
            } else {
              request = this.client
                .api(`/sites/${this.siteId}/lists/${listId}/items`)
                .select('id')
                .top(1000); // 999 is max, safe 1000
            }

            const response = await request.get();
            items = [...items, ...response.value];

            if (response['@odata.nextLink']) {
              nextLink = response['@odata.nextLink'];
            } else {
              hasMore = false;
            }
          }

          console.log(`   Found ${items.length} items to delete in ${listName}`);

          // Delete items in chunks to avoid rate limiting
          // Note: Graph API batching would be better but simple iteration is safer to implement quickly
          // defined chunk size
          const chunkSize = 10;
          for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            await Promise.all(
              chunk.map(item =>
                this.client
                  .api(`/sites/${this.siteId}/lists/${listId}/items/${item.id}`)
                  .delete()
                  .catch(e => console.error(`Failed to delete item ${item.id} from ${listName}`, e))
              )
            );
            console.log(`   Deleted chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(items.length / chunkSize)}`);
          }

          console.log(`✅ Cleared list: ${listName}`);

        } catch (error) {
          console.error(`❌ Error clearing list ${listName}:`, error);
          // Continue with other lists even if one fails
        }
      }

      console.log('✅ DELETE ALL DATA COMPLETE');
    } catch (error) {
      console.error('❌ Fatal error in deleteAllData:', error);
      throw error;
    }
  }


  /**
   * ==========================================
   * AUDIT LOGGING
   * ==========================================
   */

  /**
   * Log audit entry
   */
  private async logAudit(
    employeeId: string,
    entityType: string,
    action: string,
    changedBy?: string,
    fieldChanged?: string,
    oldValue?: string,
    newValue?: string
  ): Promise<void> {
    if (!this.siteId) return;

    try {
      const listId = this.getListId(LISTS.AUDIT_LOG);

      const itemData = {
        fields: {
          EmployeeID: employeeId,
          EntityType: entityType,
          Action: action,
          ChangedBy: changedBy,
          FieldChanged: fieldChanged,
          OldValue: oldValue,
          NewValue: newValue,
          ChangedDate: new Date().toISOString(),
        },
      };

      await this.client
        .api(`/sites/${this.siteId}/lists/${listId}/items`)
        .post(itemData);
    } catch (error) {
      console.error('⚠️ Error logging audit entry:', error);
      // Don't throw - audit logging shouldn't break operations
    }
  }

  /**
   * ==========================================
   * HELPER METHODS
   * ==========================================
   */

  /**
   * Map a raw SharePoint list item to a LeaveRequest object.
   * Centralised so both getLeaveRequests and getAllPendingLeaveRequests stay in sync.
   */
  private mapLeaveRequestItem(item: any): LeaveRequest {
    return {
      id: item.id,
      employeeId: item.fields.EmployeeID,
      employeeName: item.fields.Name,
      leaveType: item.fields.Type_of_leave,
      startDate: item.fields.Start_Date,
      endDate: item.fields.End_Date,
      daysRequested: item.fields.TotalLeaveDays || 0,
      reason: item.fields.Reason,
      status: item.fields.ApprovalStatus || 'Pending',
      stage: item.fields.Stage || 'Submitted',
      currentStep: parseInt(item.fields.CurrentStep || '1'),
      approverManager: item.fields.Approver_Manager,
      approverCEO: item.fields.Approver_CEO,
      approverDirector: item.fields.Approver_Director,
      approverHR: item.fields.Approver_HR,
      approvedBy: item.fields.ApprovedBy,
      approvedDate: item.fields.ApprovedDate,
      managerApprovedDate:
        item.fields['Manager Approval Date'] ||
        item.fields.Manager_Approval_Date ||
        item.fields.ManagerApprovalDate,
      ceoApprovedDate:
        item.fields['CEO Approval Date'] ||
        item.fields.CEO_Approval_Date ||
        item.fields.CEOApprovalDate,
      directorApprovedDate:
        item.fields['Director Approval Date'] ||
        item.fields.Director_Approval_Date ||
        item.fields.DirectorApprovalDate,
      hrApprovedDate:
        item.fields['HR Approval Date'] ||
        item.fields.HR_Approval_Date ||
        item.fields.HRApprovalDate,
      comments: item.fields.HRRemarks,
      approvalHistory: this.parseJsonField<ApprovalHistoryEntry[]>(
        item.fields.ApprovalHistory,
        [],
      ),
      attachments: this.parseJsonField<ApprovalAttachment[]>(
        item.fields.ApprovalAttachments,
        [],
      ),
      createdDate: item.fields.Created,
      employeeEmail: item.fields.EmployeeEmail ?? item.fields.Email ?? '',
      division: item.fields.Division,
      unit: item.fields.Unit,
    };
  }

  /**
   * Map SharePoint fields to Employee object
   */
  private mapSharePointEmployee(fields: any): Employee {
    return {
      id: fields.id || fields.ID,
      employeeId: fields.EmployeeID,
      firstName: fields.FirstName,
      lastName: fields.LastName,
      preferredName: fields.PreferredName,
      fullName: `${fields.FirstName} ${fields.LastName}`,
      gender: fields.Gender,
      dateOfBirth: fields.DateOfBirth,
      photoUrl: fields.PhotoURL,
      nationalId: fields.NationalID,
      email: fields.Email,
      phone: fields.Phone,
      mobilePhone: fields.MobilePhone,
      address: fields.Address,
      emergencyContactName: fields.EmergencyContactName,
      emergencyContactPhone: fields.EmergencyContactPhone,
      emergencyContactRelation: fields.EmergencyContactRelation,
      department: fields.Department,
      unit: fields.Unit,
      jobTitle: fields.JobTitle,
      lineManager: fields.LineManager,
      officeLocation: fields.OfficeLocation,
      startDate: fields.StartDate,
      endDate: fields.EndDate,
      employmentStatus: fields.EmploymentStatus,
      employmentType: fields.EmploymentType,
      grade: fields.Grade,
      payScale: fields.PayScale,
      costCenter: fields.CostCenter,
      payrollId: fields.PayrollID,
      createdDate: fields.CreatedDate,
      modifiedDate: fields.ModifiedDate,
      createdBy: fields.CreatedBy,
      modifiedBy: fields.ModifiedBy,
    };
  }

  // =========================================================================
  // WORKFLOW ADMIN - Approvers
  // =========================================================================

  /**
   * Creates the HR_WorkflowApprovers and HR_EmailTemplates lists if they
   * don't already exist. Call once from the admin setup button.
   */
  async setupWorkflowLists(): Promise<void> {
    if (!this.siteId) await this.initialize();

    const ensureList = async (displayName: string, columns: object[]) => {
      try {
        // Check if it already exists
        const existing = await this.client
          .api(`/sites/${this.siteId}/lists`)
          .filter(`displayName eq '${displayName}'`)
          .get();
        if (existing.value?.length > 0) {
          console.log(`✅ List already exists: ${displayName}`);
          return existing.value[0].id as string;
        }

        // Create
        const created = await this.client
          .api(`/sites/${this.siteId}/lists`)
          .post({ displayName, list: { template: 'genericList' } });

        const listId = created.id as string;

        for (const col of columns) {
          await this.client
            .api(`/sites/${this.siteId}/lists/${listId}/columns`)
            .post(col);
        }

        console.log(`✅ Created list: ${displayName}`);
        return listId;
      } catch (err) {
        console.error(`❌ Error ensuring list ${displayName}:`, err);
        throw err;
      }
    };

    await ensureList(LISTS.WORKFLOW_APPROVERS, [
      { name: 'Unit',                  text: {} },
      { name: 'Stage',                 text: {} },
      { name: 'ApproverName',          text: {} },
      { name: 'ApproverEmail',         text: {} },
      { name: 'DelegateName',          text: {} },
      { name: 'DelegateEmail',         text: {} },
      { name: 'EscalationName',        text: {} },
      { name: 'EscalationEmail',       text: {} },
      { name: 'ExecutiveFallbackName', text: {} },
      { name: 'ExecutiveFallbackEmail', text: {} },
      { name: 'SkipDirectorReview',    boolean: {} },
    ]);

    await ensureList(LISTS.EMAIL_TEMPLATES, [
      { name: 'Subject', text: {} },
      { name: 'Body',    text: { allowMultipleLines: true } },
    ]);

    // Re-load list IDs so new lists are registered
    await this.loadListIds();
  }

  /** Fetch all workflow approver assignments. */
  async getWorkflowApprovers(): Promise<WorkflowApprover[]> {
    if (!this.siteId) await this.initialize();

    try {
      const listId = this.getListId(LISTS.WORKFLOW_APPROVERS);
      const all: any[] = [];
      let nextLink: string | undefined;

      do {
        const req = nextLink
          ? this.client.api(nextLink)
          : this.client
              .api(`/sites/${this.siteId}/lists/${listId}/items`)
              .expand('fields')
              .top(500);
        const res = await req.get();
        all.push(...res.value);
        nextLink = res['@odata.nextLink'];
      } while (nextLink);

      return all.map(item => ({
        id: item.id,
        division: item.fields.Title ?? '',
        unit: item.fields.Unit ?? '',
        stage: item.fields.Stage as WorkflowStage,
        approverName: item.fields.ApproverName ?? '',
        approverEmail: item.fields.ApproverEmail ?? '',
        delegateName: item.fields.DelegateName ?? '',
        delegateEmail: item.fields.DelegateEmail ?? '',
        escalationName: item.fields.EscalationName ?? '',
        escalationEmail: item.fields.EscalationEmail ?? '',
        executiveFallbackName: item.fields.ExecutiveFallbackName ?? '',
        executiveFallbackEmail: item.fields.ExecutiveFallbackEmail ?? '',
        skipDirectorReview: item.fields.SkipDirectorReview ?? false,
      }));
    } catch (err) {
      console.error('❌ Error fetching workflow approvers:', err);
      throw err;
    }
  }

  private workflowApproverColumnDefinition(name: string): object {
    return name === 'SkipDirectorReview'
      ? { name, boolean: {} }
      : { name, text: {} };
  }

  private async ensureWorkflowApproverColumn(listId: string, name: string): Promise<void> {
    await this.client
      .api(`/sites/${this.siteId}/lists/${listId}/columns`)
      .post(this.workflowApproverColumnDefinition(name))
      .catch(() => {});
  }

  private async patchWorkflowApproverFields(
    listId: string,
    itemId: string | number,
    fields: Record<string, unknown>,
  ): Promise<void> {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await this.client
          .api(`/sites/${this.siteId}/lists/${listId}/items/${itemId}/fields`)
          .patch(fields);
        return;
      } catch (err: any) {
        const match = (err?.message ?? '').match(/Field '([^']+)' is not recognized/);
        if (!match) throw err;
        await this.ensureWorkflowApproverColumn(listId, match[1]);
      }
    }

    await this.client
      .api(`/sites/${this.siteId}/lists/${listId}/items/${itemId}/fields`)
      .patch(fields);
  }

  private async postWorkflowApproverFields(
    listId: string,
    fields: Record<string, unknown>,
  ): Promise<any> {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        return await this.client
          .api(`/sites/${this.siteId}/lists/${listId}/items`)
          .post({ fields });
      } catch (err: any) {
        const match = (err?.message ?? '').match(/Field '([^']+)' is not recognized/);
        if (!match) throw err;
        await this.ensureWorkflowApproverColumn(listId, match[1]);
      }
    }

    return await this.client
      .api(`/sites/${this.siteId}/lists/${listId}/items`)
      .post({ fields });
  }

  /** Create or update a single approver row. Pass id to update, omit to create. */
  async saveWorkflowApprover(data: WorkflowApprover): Promise<WorkflowApprover> {
    if (!this.siteId) await this.initialize();

    // Auto-create the list on first use
    if (!this.listIds.has(LISTS.WORKFLOW_APPROVERS)) {
      await this.setupWorkflowLists();
    }

    const fields = {
      Title: data.division,
      Unit: data.unit,
      Stage: data.stage,
      ApproverName: data.approverName,
      ApproverEmail: data.approverEmail,
      DelegateName: data.delegateName ?? '',
      DelegateEmail: data.delegateEmail ?? '',
      EscalationName: data.escalationName ?? '',
      EscalationEmail: data.escalationEmail ?? '',
      ExecutiveFallbackName: data.executiveFallbackName ?? '',
      ExecutiveFallbackEmail: data.executiveFallbackEmail ?? '',
      SkipDirectorReview: data.skipDirectorReview ?? false,
    };

    try {
      const listId = this.getListId(LISTS.WORKFLOW_APPROVERS);

      if (data.id) {
        await this.patchWorkflowApproverFields(listId, data.id, fields);
        return { ...data };
      } else {
        const created = await this.postWorkflowApproverFields(listId, fields);
        return { ...data, id: created.id };
      }
    } catch (err) {
      console.error('❌ Error saving workflow approver:', err);
      throw err;
    }
  }

  /** Delete a workflow approver row by SharePoint item id. */
  async deleteWorkflowApprover(itemId: string): Promise<void> {
    if (!this.siteId) await this.initialize();
    try {
      const listId = this.getListId(LISTS.WORKFLOW_APPROVERS);
      await this.client
        .api(`/sites/${this.siteId}/lists/${listId}/items/${itemId}`)
        .delete();
    } catch (err) {
      console.error('❌ Error deleting workflow approver:', err);
      throw err;
    }
  }

  /**
   * Look up the approver for a given division+unit+stage.
   * Used inside approveLeaveRequest when dynamic routing is enabled.
   */
  async getApproverForStage(
    division: string,
    unit: string,
    stage: WorkflowStage,
  ): Promise<WorkflowApprover | null> {
    const all = await this.getWorkflowApprovers();
    const stageRows = all.filter(a => a.stage === stage);
    const exact = stageRows.find(
      a =>
        this.workflowNameMatches(a.division, division) &&
        this.workflowNameMatches(a.unit, unit),
    );
    if (exact) return exact;

    if (stage === 'CEO Review') {
      const executiveFallback = stageRows.find(
        a =>
          this.workflowNameMatches(a.division, EXECUTIVE_DIVISION) &&
          (
            this.workflowNameMatches(a.unit, EXECUTIVE_UNIT) ||
            this.workflowNameMatches(a.unit, SECRETARIAT_UNIT)
          ),
      );
      if (executiveFallback) return executiveFallback;
    }

    return (
      stageRows.find(
        a =>
          this.workflowNameMatches(a.division, 'All') &&
          this.workflowNameMatches(a.unit, 'All'),
      ) ?? null
    );
  }

  // =========================================================================
  // WORKFLOW ADMIN - Email Templates
  // =========================================================================

  /** Fetch all email templates (one per stage). */
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    if (!this.siteId) await this.initialize();

    try {
      const listId = this.getListId(LISTS.EMAIL_TEMPLATES);
      const res = await this.client
        .api(`/sites/${this.siteId}/lists/${listId}/items`)
        .expand('fields')
        .top(20)
        .get();

      return (res.value ?? []).map((item: any) => ({
        id: item.id,
        stage: item.fields.Title as EmailTemplateStage,
        subject: item.fields.Subject ?? '',
        body: item.fields.Body ?? '',
      }));
    } catch (err) {
      console.error('❌ Error fetching email templates:', err);
      throw err;
    }
  }

  /** Create or update an email template. Title = stage name; pass id to update. */
  async saveEmailTemplate(data: EmailTemplate): Promise<EmailTemplate> {
    if (!this.siteId) await this.initialize();

    // Auto-create the list on first use
    if (!this.listIds.has(LISTS.EMAIL_TEMPLATES)) {
      await this.setupWorkflowLists();
    }

    const fields = {
      Title: data.stage,
      Subject: data.subject,
      Body: data.body,
    };

    try {
      const listId = this.getListId(LISTS.EMAIL_TEMPLATES);

      if (data.id) {
        await this.client
          .api(`/sites/${this.siteId}/lists/${listId}/items/${data.id}/fields`)
          .patch(fields);
        return { ...data };
      } else {
        const created = await this.client
          .api(`/sites/${this.siteId}/lists/${listId}/items`)
          .post({ fields });
        return { ...data, id: created.id };
      }
    } catch (err) {
      console.error('❌ Error saving email template:', err);
      throw err;
    }
  }
}

// Singleton instance
let serviceInstance: HRSharePointService | null = null;
let initializationPromise: Promise<HRSharePointService> | null = null;

/**
 * Get singleton instance of HR Service
 * Ensures initialization happens only once
 */
export const getHRServiceInstance = async (client: Client): Promise<HRSharePointService> => {
  // If already initialized, return immediately
  if (serviceInstance) return serviceInstance;

  // If initialization is in progress, return the existing promise
  if (initializationPromise) return initializationPromise;

  // Start initialization
  initializationPromise = (async () => {
    try {
      const service = new HRSharePointService(client);
      await service.initialize();
      serviceInstance = service;
      return service;
    } catch (error) {
      // Reset promise on error so we can try again
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
};

// Export factory (legacy/testing)
export const createHRService = (client: Client) => new HRSharePointService(client);
