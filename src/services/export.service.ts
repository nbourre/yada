/**
 * Export Service for data export functionality
 */

import { ExportOptions, ExportResult, ExportFormat, EntityType } from '../models';
import { databaseService } from './database.service';

export class ExportService {
  async exportData(options: ExportOptions): Promise<ExportResult> {
    const projectId = (options as any).projectId;

    if (!projectId) {
      throw new Error('Project ID is required for export');
    }

    const data = await this.gatherData(projectId, options.entities);
    const exportedData = await this.formatData(data, options.format);

    return {
      format: options.format,
      data: exportedData,
      filename: this.generateFilename(projectId, options.format),
      size: Buffer.byteLength(exportedData, 'utf8'),
      generatedAt: new Date(),
    };
  }

  private async gatherData(projectId: string, entityTypes: EntityType[]): Promise<any> {
    const result: any = {};

    if (entityTypes.includes('table')) {
      result.tables = await databaseService.getTablesForProject(projectId);
    }

    if (entityTypes.includes('field')) {
      result.fields = await databaseService.getFieldsForProject(projectId);
    }

    // Add other entity types as needed
    result.project = await databaseService.getProject(projectId);

    return result;
  }

  private async formatData(data: any, format: ExportFormat): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);

      case 'csv':
        return this.convertToCSV(data);

      case 'xml':
        return this.convertToXML(data);

      case 'html':
        return this.convertToHTML(data);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion for demonstration
    let csv = '';

    if (data.tables) {
      csv += 'Tables\n';
      csv += 'ID,Name,Occurrence,Record Count\n';
      data.tables.forEach((table: any) => {
        csv += `${table.id},${table.name},${table.occurrence},${table.recordCount || 0}\n`;
      });
      csv += '\n';
    }

    if (data.fields) {
      csv += 'Fields\n';
      csv += 'ID,Name,Table,Type,Required\n';
      data.fields.forEach((field: any) => {
        csv += `${field.id},${field.name},${field.tableName},${field.type},${field.options?.required || false}\n`;
      });
    }

    return csv;
  }

  private convertToXML(data: any): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<export>\n';

    if (data.project) {
      xml += `  <project id="${data.project.id}">\n`;
      xml += `    <name>${this.escapeXml(data.project.name)}</name>\n`;
      xml += `    <status>${data.project.status}</status>\n`;
      xml += '  </project>\n';
    }

    xml += '</export>';
    return xml;
  }

  private convertToHTML(data: any): string {
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>FileMaker DDR Export</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        h2 { color: #333; }
      </style>
    </head>
    <body>
      <h1>FileMaker DDR Export</h1>
    `;

    if (data.project) {
      html += `<h2>Project: ${this.escapeHtml(data.project.name)}</h2>`;
    }

    html += '</body></html>';
    return html;
  }

  private escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, c => {
      switch (c) {
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '&':
          return '&amp;';
        case "'":
          return '&apos;';
        case '"':
          return '&quot;';
        default:
          return c;
      }
    });
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private generateFilename(projectId: string, format: ExportFormat): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `filemaker-export-${projectId}-${timestamp}.${format}`;
  }
}

export const exportService = new ExportService();
