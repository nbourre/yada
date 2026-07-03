/**
 * Summary XML Parser Service
 * Parses FileMaker DDR Summary.xml to discover all files in a solution.
 *
 * Summary.xml structure (FM Pro 19+, UTF-16 LE BOM):
 *   <FMPReport type="Summary" version="22.0.4" creationDate="..." creationTime="...">
 *     <File link="./NomFichier_fmp12.xml" name="NomFichier.fmp12" path="...">
 *       <BaseTables count="81"/>
 *       <Tables count="174"/>
 *       ...
 *     </File>
 *   </FMPReport>
 */

import { XMLParser } from 'fast-xml-parser';
import { promises as fs } from 'fs';
import { dirname, resolve, join } from 'path';
import { Solution, SolutionFile, SolutionFileStats } from '../models';

interface RawSummaryFile {
  '@_link'?: string;
  '@_name'?: string;
  '@_path'?: string;
  BaseTables?: { '@_count'?: string };
  Tables?: { '@_count'?: string };
  Relationships?: { '@_count'?: string };
  Layouts?: { '@_count'?: string };
  Scripts?: { '@_count'?: string };
  ValueLists?: { '@_count'?: string };
  CustomFunctions?: { '@_count'?: string };
  Accounts?: { '@_count'?: string };
  Privileges?: { '@_count'?: string };
  ExtendedPrivileges?: { '@_count'?: string };
  FileReferences?: { '@_count'?: string };
  CustomMenuSets?: { '@_count'?: string };
  CustomMenus?: { '@_count'?: string };
}

interface RawFMPReport {
  '@_type'?: string;
  '@_version'?: string;
  '@_creationDate'?: string;
  '@_creationTime'?: string;
  File?: RawSummaryFile | RawSummaryFile[];
}

export class SummaryParserService {
  /**
   * Détecte si un fichier est un Summary.xml FileMaker.
   * Lit les premiers 2KB pour vérifier le type.
   */
  async isSummaryFile(filePath: string): Promise<boolean> {
    try {
      const buffer = await fs.readFile(filePath);
      const sample = this.decodeBuffer(buffer).substring(0, 2000);
      return sample.includes('<FMPReport') && sample.includes('type="Summary"');
    } catch {
      return false;
    }
  }

  /**
   * Détecte si un contenu base64 est un Summary.xml.
   * Utilisé côté renderer avant d'écrire le fichier temp.
   */
  isSummaryContent(base64Content: string): boolean {
    try {
      const buffer = Buffer.from(base64Content, 'base64');
      const sample = this.decodeBuffer(buffer).substring(0, 2000);
      return sample.includes('<FMPReport') && sample.includes('type="Summary"');
    } catch {
      return false;
    }
  }

  /**
   * Parse un Summary.xml et retourne l'objet Solution.
   * @param summaryPath Chemin absolu vers le Summary.xml
   */
  async parseSummary(summaryPath: string): Promise<Solution> {
    const buffer = await fs.readFile(summaryPath);
    const content = this.decodeBuffer(buffer);

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: false,
    });

    const parsed = parser.parse(content);
    const report: RawFMPReport = parsed.FMPReport || parsed.fmpreport;

    if (!report) {
      throw new Error(
        `Fichier Summary invalide — racine attendue: FMPReport. Trouvé: ${Object.keys(parsed).join(', ')}`
      );
    }

    if (report['@_type'] !== 'Summary') {
      throw new Error(`Ce fichier n'est pas un Summary.xml (type="${report['@_type']}")`);
    }

    const summaryDir = dirname(summaryPath);
    const rawFiles = report.File ? (Array.isArray(report.File) ? report.File : [report.File]) : [];

    const files: SolutionFile[] = rawFiles.map(f => ({
      name: f['@_name'] || 'Inconnu',
      link: this.resolveLink(f['@_link'] || '', summaryDir),
      serverPath: f['@_path'] || '',
      stats: this.extractStats(f),
      parseStatus: 'pending' as const,
    }));

    // Nom de la solution = nom du dossier parent du Summary.xml
    const solutionName = dirname(summaryPath).split(/[/\\]/).pop() || 'Solution';

    return {
      id: `sol-${Date.now().toString(36)}`,
      name: solutionName,
      fileMakerVersion: report['@_version'] || '',
      creationDate: report['@_creationDate'] || '',
      creationTime: report['@_creationTime'] || '',
      summaryPath,
      files,
      parsedAt: new Date(),
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private decodeBuffer(buffer: Buffer): string {
    // UTF-16 LE BOM (FF FE)
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
      let content = buffer.toString('utf16le');
      if (content.charCodeAt(0) === 0xfeff) content = content.substring(1);
      return content.replace(/�/g, '').replace(/\0/g, '');
    }
    // UTF-16 BE BOM (FE FF) — swap bytes
    if (buffer[0] === 0xfe && buffer[1] === 0xff) {
      const swapped = Buffer.alloc(buffer.length);
      for (let i = 0; i + 1 < buffer.length; i += 2) {
        swapped[i] = buffer[i + 1];
        swapped[i + 1] = buffer[i];
      }
      let content = swapped.toString('utf16le');
      if (content.charCodeAt(0) === 0xfeff) content = content.substring(1);
      return content.replace(/�/g, '').replace(/\0/g, '');
    }
    // UTF-8 BOM (EF BB BF)
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      return buffer.toString('utf-8').replace(/^\uFEFF/, '');
    }
    return buffer.toString('utf-8');
  }

  /**
   * Résout le chemin relatif du link vers un chemin absolu.
   * Le link ressemble à ".//NomFichier_fmp12.xml" ou "./NomFichier_fmp12.xml"
   */
  private resolveLink(link: string, summaryDir: string): string {
    // Normaliser ".//", "./", "..//" en chemin relatif propre
    const normalized = link.replace(/^\.\/\/+/, '').replace(/^\.\//, '');
    return resolve(join(summaryDir, normalized));
  }

  private extractStats(f: RawSummaryFile): SolutionFileStats {
    const n = (val?: { '@_count'?: string }) => (val ? parseInt(val['@_count'] || '0', 10) : 0);

    return {
      baseTableCount: n(f.BaseTables),
      tableCount: n(f.Tables),
      relationshipCount: n(f.Relationships),
      layoutCount: n(f.Layouts),
      scriptCount: n(f.Scripts),
      valueListCount: n(f.ValueLists),
      customFunctionCount: n(f.CustomFunctions),
      accountCount: n(f.Accounts),
      privilegeCount: n(f.Privileges),
      extendedPrivilegeCount: n(f.ExtendedPrivileges),
      fileReferenceCount: n(f.FileReferences),
      customMenuSetCount: n(f.CustomMenuSets),
      customMenuCount: n(f.CustomMenus),
    };
  }
}

export const summaryParserService = new SummaryParserService();
