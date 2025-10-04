/**
 * Graph Service for relationship visualization
 */

import { GraphData, GraphNode, GraphEdge, EntityType, GraphLayout } from '../models';
import { databaseService } from './database.service';

export class GraphService {
  async generateGraph(
    projectId: string,
    entityTypes?: EntityType[],
    layout?: GraphLayout
  ): Promise<GraphData> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Generate nodes for tables
    if (!entityTypes || entityTypes.includes('table')) {
      const tables = await databaseService.getTablesForProject(projectId);

      tables.forEach(table => {
        nodes.push({
          id: table.id,
          label: table.name,
          type: 'table',
          data: table,
          style: {
            color: '#4CAF50',
            size: 30,
            shape: 'rectangle',
          },
        });
      });
    }

    // Generate nodes for fields
    if (!entityTypes || entityTypes.includes('field')) {
      const fields = await databaseService.getFieldsForProject(projectId);

      fields.forEach(field => {
        nodes.push({
          id: field.id,
          label: field.name,
          type: 'field',
          data: field,
          style: {
            color: '#2196F3',
            size: 20,
            shape: 'ellipse',
          },
        });

        // Create edge from field to table
        edges.push({
          id: `${field.id}-${field.tableId}`,
          source: field.id,
          target: field.tableId,
          type: 'one-to-many',
          label: 'belongs to',
          style: {
            color: '#757575',
            width: 1,
            style: 'solid',
          },
        });
      });
    }

    return {
      nodes,
      edges,
      layout: layout || {
        algorithm: 'force',
        options: {
          springLength: 100,
          springStrength: 0.1,
          damping: 0.09,
        },
      },
    };
  }
}

export const graphService = new GraphService();
