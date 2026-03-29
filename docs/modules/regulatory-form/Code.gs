/**
 * Google Apps Script Backend for Regulatory Intelligence Form
 * 
 * This script handles rendering the form and saving submissions to the connected sheet.
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('SC PNG - Regulatory Report Form')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Process form submission
 */
function processForm(formData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0]; // Assumes first sheet
    
    // Create timestamp
    const timestamp = new Date();
    
    // Append row to sheet
    sheet.appendRow([
      timestamp,
      formData.reporterName || 'Anonymous',
      formData.email || 'N/A',
      formData.reportType,
      formData.category,
      formData.title,
      formData.description,
      formData.riskLevel || 'LOW'
    ]);
    
    return { success: true, message: 'Report submitted successfully. Thank you for your cooperation.' };
  } catch (error) {
    Logger.log(error);
    return { success: false, message: 'Error submitting report: ' + error.toString() };
  }
}
