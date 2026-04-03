export const FLOW_CONFIG = {
    ENVIRONMENT_ID:    'Default-b173aac7-6781-4d49-a037-d874bd4a09ab',
    API_BASE:          'https://api.flow.microsoft.com',
    POWERAPPS_API_BASE:'https://api.powerapps.com',
    SHAREPOINT_SITE:   'https://scpng1.sharepoint.com/sites/scpngintranet',
    FLOW_SCOPES:       ['https://service.flow.microsoft.com//.default'],
    POWERAPPS_SCOPES:  ['https://service.powerapps.com//.default'],

    // Flow names
    /** @deprecated Single-flow name kept for TestGround backward compat */
    REPORT_FLOW_NAME:  'SCPNG Intranet — Scheduled Report Dispatcher',
    DISPATCH_FLOW_NAME:'SCPNG Intranet — Report Dispatch',
    SEND_FLOW_NAME:    'SCPNG Intranet — Report Send',

    /**
     * Google Sheets spreadsheet ID (from the URL).
     * Replace this with your actual ID before deploying the flows.
     * Format: https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
     */
    SPREADSHEET_ID: '1QC0x7LGONaLX1hm2BXYj23qUp1z9wlfxRm6se7XQy3Y',
};
