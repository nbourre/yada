/**
 * Export Service for data export functionality
 */

import {
  ExportOptions,
  ExportResult,
  ExportFormat,
  EntityType,
  Project,
  Table,
  Field,
} from '../models';
import { databaseService } from './database.service';

type ExtendedExportOptions = ExportOptions & { projectId: string };

interface ExportData {
  project?: Project | null;
  tables?: Table[];
  fields?: Field[];
}

export class ExportService {
  async exportData(options: ExtendedExportOptions): Promise<ExportResult> {
    const projectId = options.projectId;

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

  private async gatherData(projectId: string, entityTypes: EntityType[]): Promise<ExportData> {
    const result: ExportData = {};

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

  private async formatData(data: ExportData, format: ExportFormat): Promise<string> {
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

  private convertToCSV(data: ExportData): string {
    // Simple CSV conversion for demonstration
    let csv = '';

    if (data.tables) {
      csv += 'Tables\n';
      csv += 'ID,Name,Occurrence,IsOccurrence,BaseTableId,BaseTable,Record Count\n';
      data.tables.forEach((table: Table) => {
        csv += `${table.id},${table.name},${table.occurrence || ''},${table.isOccurrence ? 'true' : 'false'},${table.baseTableId || ''},${table.baseTable || ''},${table.recordCount || 0}\n`;
      });
      csv += '\n';
    }

    if (data.fields) {
      csv += 'Fields\n';
      csv += 'ID,Name,Table,Type,Required\n';
      data.fields.forEach((field: Field) => {
        csv += `${field.id},${field.name},${field.tableName},${field.type},${field.options?.required || false}\n`;
      });
    }

    return csv;
  }

  private convertToXML(data: ExportData): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<export>\n';

    if (data.project) {
      xml += `  <project id="${data.project.id}">\n`;
      xml += `    <name>${this.escapeXml(data.project.name)}</name>\n`;
      xml += `    <status>${data.project.status}</status>\n`;
      if (data.project.statistics) {
        xml += '    <statistics>\n';
        xml += `      <tables>${data.project.statistics.tableCount}</tables>\n`;
        xml += `      <fields>${data.project.statistics.fieldCount}</fields>\n`;
        xml += `      <occurrences>${data.project.statistics.occurrenceCount}</occurrences>\n`;
        xml += `      <relationships>${data.project.statistics.relationshipCount}</relationships>\n`;
        xml += '    </statistics>\n';
      }
      xml += '  </project>\n';
    }

    if (data.tables) {
      xml += '  <tables>\n';
      data.tables.forEach((table: Table) => {
        xml += `    <table id="${table.id}" isOccurrence="${table.isOccurrence ? 'true' : 'false'}" baseTableId="${table.baseTableId || ''}">\n`;
        xml += `      <name>${this.escapeXml(table.name)}</name>\n`;
        if (table.occurrence) {
          xml += `      <occurrence>${this.escapeXml(table.occurrence)}</occurrence>\n`;
        }
        if (table.baseTable) {
          xml += `      <baseTable>${this.escapeXml(table.baseTable)}</baseTable>\n`;
        }
        xml += `      <recordCount>${table.recordCount || 0}</recordCount>\n`;
        xml += '    </table>\n';
      });
      xml += '  </tables>\n';
    }

    xml += '</export>';
    return xml;
  }

  private convertToHTML(data: ExportData): string {
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
        .meta { font-size: 0.9em; color: #555; }
      </style>
    </head>
    <body>
      <h1>FileMaker DDR Export</h1>
    `;

    if (data.project) {
      html += `<h2>Project: ${this.escapeHtml(data.project.name)}</h2>`;
      if (data.project.statistics) {
        html += '<div class="meta">';
        html += `Tables: ${data.project.statistics.tableCount} | `;
        html += `Fields: ${data.project.statistics.fieldCount} | `;
        html += `Occurrences: ${data.project.statistics.occurrenceCount} | `;
        html += `Relationships: ${data.project.statistics.relationshipCount}`;
        html += '</div>';
      }
    }

    if (data.tables) {
      html +=
        '<table><thead><tr><th>ID</th><th>Name</th><th>Occurrence</th><th>Is Occurrence</th><th>Base Table ID</th><th>Base Table</th><th>Record Count</th></tr></thead><tbody>';
      data.tables.forEach((table: Table) => {
        html += `<tr><td>${this.escapeHtml(table.id)}</td><td>${this.escapeHtml(table.name)}</td><td>${this.escapeHtml(table.occurrence || '')}</td><td>${table.isOccurrence ? 'true' : 'false'}</td><td>${this.escapeHtml(table.baseTableId || '')}</td><td>${this.escapeHtml(table.baseTable || '')}</td><td>${table.recordCount || 0}</td></tr>`;
      });
      html += '</tbody></table>';
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
