/**
 * Asset Sub-SharePoint Service
 * Handles Maintenance and Invoice records for Assets
 */

import { Client } from '@microsoft/microsoft-graph-client';

const SITE_PATH = '/sites/scpngintranet';
const SITE_DOMAIN = 'scpng1.sharepoint.com';
const MAINTENANCE_LIST_NAME = 'Asset_Maintenance';
const INVOICES_LIST_NAME = 'Asset_Invoices';

export interface MaintenanceRecord {
  id: string;
  asset_id: string;
  maintenance_type: string;
  description: string;
  status: string;
  scheduled_date: string;
  completed_date?: string;
  technician?: string;
  cost?: number;
  is_mock_data?: boolean;
  created_at?: string;
}

export interface InvoiceRecord {
  id: string;
  asset_id: string;
  vendor_name: string;
  asset_name?: string;
  invoice_number: string;
  amount: number;
  issue_date: string;
  due_date: string;
  status: string;
  payment_date?: string;
  attachment_url?: string;
  is_mock_data?: boolean;
  created_at?: string;
}

export class AssetSubSharePointService {
  private client: Client;
  private siteId: string | null = null;
  private maintenanceListId: string | null = null;
  private invoicesListId: string | null = null;

  constructor(client: Client) {
    this.client = client;
    console.log('🔧 [AssetSubSharePointService] Service initialized');
  }

  /**
   * Initialize service by getting site and list IDs
   */
  async initialize(): Promise<void> {
    try {
      if (this.siteId && this.maintenanceListId && this.invoicesListId) return;

      console.log('🔄 [AssetSubSharePointService] Starting initialization...');

      // Get Site ID
      const site = await this.client
        .api(`/sites/${SITE_DOMAIN}:${SITE_PATH}`)
        .get();

      this.siteId = site.id;

      // Get Lists
      const lists = await this.client
        .api(`/sites/${this.siteId}/lists`)
        .select('id,displayName')
        .get();

      const maintList = lists.value.find((l: any) => l.displayName === MAINTENANCE_LIST_NAME);
      const invList = lists.value.find((l: any) => l.displayName === INVOICES_LIST_NAME);

      if (maintList) this.maintenanceListId = maintList.id;
      if (invList) this.invoicesListId = invList.id;

      console.log('✅ [AssetSubSharePointService] Initialization complete!');
    } catch (error) {
      console.error('❌ [AssetSubSharePointService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Fetch Maintenance Records
   */
  async getMaintenanceRecords(assetId?: string): Promise<MaintenanceRecord[]> {
    await this.initialize();
    if (!this.maintenanceListId) return [];

    try {
      let query = this.client.api(`/sites/${this.siteId}/lists/${this.maintenanceListId}/items`).expand('fields');
      
      if (assetId) {
        query = query.filter(`fields/AssetID eq '${assetId}'`);
      }

      const response = await query.get();
      return response.value.map((item: any) => this.mapMaintenanceRecord(item));
    } catch (error) {
      console.error('❌ [AssetSubSharePointService] Failed to fetch maintenance records:', error);
      return [];
    }
  }

  /**
   * Fetch Invoice Records
   */
  async getInvoiceRecords(assetId?: string): Promise<InvoiceRecord[]> {
    await this.initialize();
    if (!this.invoicesListId) return [];

    try {
      let query = this.client.api(`/sites/${this.siteId}/lists/${this.invoicesListId}/items`).expand('fields');
      
      if (assetId) {
        query = query.filter(`fields/AssetID eq '${assetId}'`);
      }

      const response = await query.get();
      return response.value.map((item: any) => this.mapInvoiceRecord(item));
    } catch (error) {
      console.error('❌ [AssetSubSharePointService] Failed to fetch invoice records:', error);
      return [];
    }
  }

  /**
   * Add Maintenance Record
   */
  async addMaintenanceRecord(record: Partial<MaintenanceRecord>): Promise<MaintenanceRecord> {
    await this.initialize();
    if (!this.maintenanceListId) throw new Error('Maintenance list not found');

    const payload = {
      fields: {
        Title: `${record.maintenance_type} for Asset ${record.asset_id}`,
        AssetID: record.asset_id,
        MaintenanceType: record.maintenance_type,
        Description: record.description,
        Status: record.status || 'Scheduled',
        ScheduledDate: record.scheduled_date,
        CompletedDate: record.completed_date,
        Technician: record.technician,
        Cost: record.cost,
        IsMockData: record.is_mock_data || false
      }
    };

    const response = await this.client.api(`/sites/${this.siteId}/lists/${this.maintenanceListId}/items`).post(payload);
    return this.mapMaintenanceRecord(response);
  }

  /**
   * Add Invoice Record
   */
  async addInvoiceRecord(record: Partial<InvoiceRecord>): Promise<InvoiceRecord> {
    await this.initialize();
    if (!this.invoicesListId) throw new Error('Invoices list not found');

    const payload = {
      fields: {
        Title: record.invoice_number,
        AssetID: record.asset_id,
        VendorName: record.vendor_name,
        AssetName: record.asset_name,
        InvoiceNumber: record.invoice_number,
        Amount: record.amount,
        IssueDate: record.issue_date,
        DueDate: record.due_date,
        Status: record.status || 'Pending',
        PaymentDate: record.payment_date,
        AttachmentUrl: record.attachment_url,
        IsMockData: record.is_mock_data || false
      }
    };

    const response = await this.client.api(`/sites/${this.siteId}/lists/${this.invoicesListId}/items`).post(payload);
    return this.mapInvoiceRecord(response);
  }

  /**
   * Helper: Map SharePoint item to MaintenanceRecord
   */
  private mapMaintenanceRecord(item: any): MaintenanceRecord {
    const f = item.fields;
    return {
      id: item.id,
      asset_id: String(f.AssetID || ''),
      maintenance_type: String(f.MaintenanceType || ''),
      description: String(f.Description || ''),
      status: String(f.Status || ''),
      scheduled_date: f.ScheduledDate,
      completed_date: f.CompletedDate,
      technician: String(f.Technician || ''),
      cost: Number(f.Cost || 0),
      is_mock_data: !!f.IsMockData,
      created_at: item.createdDateTime
    };
  }

  /**
   * Helper: Map SharePoint item to InvoiceRecord
   */
  private mapInvoiceRecord(item: any): InvoiceRecord {
    const f = item.fields;
    return {
      id: item.id,
      asset_id: String(f.AssetID || ''),
      vendor_name: String(f.VendorName || ''),
      asset_name: String(f.AssetName || ''),
      invoice_number: String(f.InvoiceNumber || ''),
      amount: Number(f.Amount || 0),
      issue_date: f.IssueDate,
      due_date: f.DueDate,
      status: String(f.Status || ''),
      payment_date: f.PaymentDate,
      attachment_url: String(f.AttachmentUrl || ''),
      is_mock_data: !!f.IsMockData,
      created_at: item.createdDateTime
    };
  }
}
