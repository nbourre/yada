"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.summaryParserService = exports.SummaryParserService = void 0;
const fast_xml_parser_1 = require("fast-xml-parser");
const fs_1 = require("fs");
const path_1 = require("path");
class SummaryParserService {
    /**
     * Détecte si un fichier est un Summary.xml FileMaker.
     * Lit les premiers 2KB pour vérifier le type.
     */
    async isSummaryFile(filePath) {
        try {
            const buffer = await fs_1.promises.readFile(filePath);
            const sample = this.decodeBuffer(buffer).substring(0, 2000);
            return (sample.includes('<FMPReport') &&
                sample.includes('type="Summary"'));
        }
        catch {
            return false;
        }
    }
    /**
     * Détecte si un contenu base64 est un Summary.xml.
     * Utilisé côté renderer avant d'écrire le fichier temp.
     */
    isSummaryContent(base64Content) {
        try {
            const buffer = Buffer.from(base64Content, 'base64');
            const sample = this.decodeBuffer(buffer).substring(0, 2000);
            return (sample.includes('<FMPReport') &&
                sample.includes('type="Summary"'));
        }
        catch {
            return false;
        }
    }
    /**
     * Parse un Summary.xml et retourne l'objet Solution.
     * @param summaryPath Chemin absolu vers le Summary.xml
     */
    async parseSummary(summaryPath) {
        const buffer = await fs_1.promises.readFile(summaryPath);
        const content = this.decodeBuffer(buffer);
        const parser = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            parseAttributeValue: false,
        });
        const parsed = parser.parse(content);
        const report = parsed.FMPReport || parsed.fmpreport;
        if (!report) {
            throw new Error(`Fichier Summary invalide — racine attendue: FMPReport. Trouvé: ${Object.keys(parsed).join(', ')}`);
        }
        if (report['@_type'] !== 'Summary') {
            throw new Error(`Ce fichier n'est pas un Summary.xml (type="${report['@_type']}")`);
        }
        const summaryDir = (0, path_1.dirname)(summaryPath);
        const rawFiles = report.File
            ? Array.isArray(report.File) ? report.File : [report.File]
            : [];
        const files = rawFiles.map(f => ({
            name: f['@_name'] || 'Inconnu',
            link: this.resolveLink(f['@_link'] || '', summaryDir),
            serverPath: f['@_path'] || '',
            stats: this.extractStats(f),
            parseStatus: 'pending',
        }));
        // Nom de la solution = nom du dossier parent du Summary.xml
        const solutionName = (0, path_1.dirname)(summaryPath).split(/[/\\]/).pop() || 'Solution';
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
    decodeBuffer(buffer) {
        // UTF-16 LE BOM (FF FE)
        if (buffer[0] === 0xff && buffer[1] === 0xfe) {
            let content = buffer.toString('utf16le');
            if (content.charCodeAt(0) === 0xfeff)
                content = content.substring(1);
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
            if (content.charCodeAt(0) === 0xfeff)
                content = content.substring(1);
            return content.replace(/�/g, '').replace(/\0/g, '');
        }
        // UTF-8 BOM (EF BB BF)
        if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
            return buffer.toString('utf-8').replace(/^﻿/, '');
        }
        return buffer.toString('utf-8');
    }
    /**
     * Résout le chemin relatif du link vers un chemin absolu.
     * Le link ressemble à ".//NomFichier_fmp12.xml" ou "./NomFichier_fmp12.xml"
     */
    resolveLink(link, summaryDir) {
        // Normaliser ".//", "./", "..//" en chemin relatif propre
        const normalized = link.replace(/^\.\/\/+/, '').replace(/^\.\//, '');
        return (0, path_1.resolve)((0, path_1.join)(summaryDir, normalized));
    }
    extractStats(f) {
        const n = (val) => val ? parseInt(val['@_count'] || '0', 10) : 0;
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
exports.SummaryParserService = SummaryParserService;
exports.summaryParserService = new SummaryParserService();
