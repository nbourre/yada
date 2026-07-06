/**
 * Graph Visualization Component
 * Interactive database relationship visualization using Cytoscape.js
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  ButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Switch,
  FormControlLabel,
  Tooltip,
  IconButton,
  Drawer,
  List,
  ListItem,
  // Removed unused ListItemText and Timeline imports to satisfy eslint
  Divider,
  Alert,
} from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
  Download,
  Settings,
  Refresh,
  AccountTree,
} from '@mui/icons-material';
import { DependencyEntityRef, EntityType } from '../../models';
import DependencyPanel from './DependencyPanel';

interface GraphVisualizationProps {
  projectId: string | null;
}

interface GraphSettings {
  layout: string;
  showLabels: boolean;
  showOrphans: boolean;
  nodeSize: number;
  edgeWidth: number;
  showFieldTypes: boolean;
}

interface GraphStats {
  tables: number;
  relationships: number;
  fields: number;
  orphanTables: number;
}

const GraphVisualization: React.FC<GraphVisualizationProps> = ({ projectId }) => {
  // Use a narrowed type for Cytoscape instance
  const cyRef = useRef<import('cytoscape').Core | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  interface GraphElementNode {
    data: {
      id: string;
      name?: string;
      label?: string;
      type: string;
      description?: string;
      isOccurrence?: boolean;
      baseTable?: string | null;
    };
  }
  interface GraphElementEdge {
    data: { id?: string; source: string; target: string };
  }
  interface GraphData {
    elements: { nodes: GraphElementNode[]; edges: GraphElementEdge[] };
  }
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphElementNode['data'] | null>(null);
  const [depEntity, setDepEntity] = useState<DependencyEntityRef | null>(null);

  const [settings, setSettings] = useState<GraphSettings>({
    layout: 'cose',
    showLabels: true,
    showOrphans: true,
    nodeSize: 30,
    edgeWidth: 2,
    showFieldTypes: false,
  });

  const LAYOUT_OPTIONS = [
    { value: 'cose', label: 'Force Directed (COSE)' },
    { value: 'grid', label: 'Grid' },
    { value: 'circle', label: 'Circle' },
    { value: 'concentric', label: 'Concentric' },
    { value: 'breadthfirst', label: 'Hierarchical' },
  ];

  useEffect(() => {
    if (projectId) {
      void loadGraphData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (graphData && containerRef.current) {
      void initializeCytoscape();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData]);

  const loadGraphData = async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/graph`);

      if (!response.ok) {
        throw new Error(`Failed to load graph data: ${response.statusText}`);
      }

      const data = (await response.json()) as GraphData;
      setGraphData(data);

      // Calculate stats
      const tables = data.elements.nodes.filter(n => n.data.type === 'table').length;
      const relationships = data.elements.edges.length;
      const fields = data.elements.nodes.filter(n => n.data.type === 'field').length;
      const orphanTables = data.elements.nodes.filter(
        n =>
          n.data.type === 'table' &&
          !data.elements.edges.some(e => e.data.source === n.data.id || e.data.target === n.data.id)
      ).length;

      setStats({ tables, relationships, fields, orphanTables });
    } catch (err) {
      console.error('Graph loading error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load graph data');
    } finally {
      setLoading(false);
    }
  };

  const initializeCytoscape = async () => {
    if (!containerRef.current || !graphData) return;

    // Dynamically import Cytoscape
    const cytoscape = (await import('cytoscape')).default;

    // Stop any running layout and destroy previous instance
    if (cyRef.current) {
      try {
        cyRef.current.stop(); // stop animations/layouts
      } catch (_) {
        /* ignore */
      }
      cyRef.current.destroy();
      cyRef.current = null;
    }

    // Filter data based on settings, and build biligne labels for TO nodes
    const sourceNodes = settings.showOrphans
      ? graphData.elements.nodes
      : graphData.elements.nodes.filter(
          n =>
            n.data.type !== 'table' ||
            graphData.elements.edges.some(
              e => e.data.source === n.data.id || e.data.target === n.data.id
            )
        );
    const filteredElements: GraphData['elements'] = {
      nodes: sourceNodes.map(n => {
        if (n.data.type === 'table' && n.data.isOccurrence && n.data.baseTable) {
          return { ...n, data: { ...n.data, label: `${n.data.name}\n(${n.data.baseTable})` } };
        }
        return n;
      }),
      edges: graphData.elements.edges,
    };

    const cy = cytoscape({
      container: containerRef.current,
      elements: filteredElements,
      style: [
        {
          selector: 'node[type = "table"]',
          style: {
            'background-color': '#2196F3',
            label: settings.showLabels ? 'data(label)' : '',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 6,
            color: '#1a1a1a',
            'font-size': '11px',
            'font-weight': 'bold',
            'text-wrap': 'wrap' as any,
            'text-max-width': '120px' as any,
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.75,
            'text-background-padding': '2px',
            'text-background-shape': 'roundrectangle',
            width: settings.nodeSize,
            height: settings.nodeSize,
            'border-width': 2,
            'border-color': '#1976D2',
          },
        },
        {
          selector: 'node[type = "field"]',
          style: {
            'background-color': '#4CAF50',
            label: settings.showLabels && settings.showFieldTypes ? 'data(label)' : '',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 4,
            color: '#1a1a1a',
            'font-size': '10px',
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.75,
            'text-background-padding': '2px',
            'text-background-shape': 'roundrectangle',
            width: settings.nodeSize * 0.7,
            height: settings.nodeSize * 0.7,
          },
        },
        {
          selector: 'edge',
          style: {
            width: settings.edgeWidth,
            'line-color': '#9E9E9E',
            'target-arrow-color': '#9E9E9E',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
          },
        },
        {
          selector: ':selected',
          style: {
            'border-width': 4,
            'border-color': '#FF5722',
            'background-color': '#FF5722',
          },
        },
      ],
      layout: {
        name: settings.layout,
        fit: true,
        padding: 50,
      } as any,
    });

    // Event handlers
    cy.on('tap', 'node', evt => {
      const node = evt.target;
      setSelectedNode(node.data());
    });

    cy.on('tap', evt => {
      if (evt.target === cy) {
        setSelectedNode(null);
      }
    });

    cyRef.current = cy;
  };

  const handleZoomIn = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 1.2);
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 0.8);
    }
  };

  const handleFitToView = () => {
    if (cyRef.current) {
      cyRef.current.fit();
    }
  };

  const handleLayoutChange = (layout: string) => {
    if (cyRef.current) {
      try {
        cyRef.current.stop(); // stop current animation first
        cyRef.current.layout({ name: layout, animate: false, fit: true } as any).run();
      } catch (_) {
        /* ignore */
      }
    }
    // Update settings without triggering full re-init (layout already applied above)
    setSettings(prev => ({ ...prev, layout }));
  };

  const exportGraph = async (format: 'png' | 'jpg' | 'svg') => {
    if (!cyRef.current) return;

    try {
      const link = document.createElement('a');
      link.download = `database-graph-${new Date().toISOString().split('T')[0]}.${format}`;

      if (format === 'svg') {
        const coreWithSvg = cyRef.current as unknown as {
          svg: (opts: { scale?: number; full?: boolean }) => string;
        };
        const svgData = coreWithSvg.svg({ scale: 2, full: true });
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        link.href = URL.createObjectURL(blob);
      } else {
        const blob = (cyRef.current as unknown as { png: (opts: any) => string | Blob }).png({
          output: 'blob',
          scale: 2,
          full: true,
          bg: '#ffffff',
        });
        const href = typeof blob === 'string' ? blob : URL.createObjectURL(blob);
        link.href = href;
      }

      link.click();
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export graph');
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Database Relationship Graph
      </Typography>

      <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
        Interactive visualization of tables, fields, and their relationships.
      </Typography>

      {!projectId && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Please select a project first to view the database graph.
        </Alert>
      )}

      {/* Controls */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <ButtonGroup size="small">
                <Tooltip title="Zoom In">
                  <IconButton
                    onClick={handleZoomIn}
                    disabled={!graphData}
                    data-testid="zoom-in-button"
                  >
                    <ZoomIn />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Zoom Out">
                  <IconButton
                    onClick={handleZoomOut}
                    disabled={!graphData}
                    data-testid="zoom-out-button"
                  >
                    <ZoomOut />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Fit to View">
                  <IconButton
                    onClick={handleFitToView}
                    disabled={!graphData}
                    data-testid="fit-to-view-button"
                  >
                    <CenterFocusStrong />
                  </IconButton>
                </Tooltip>
              </ButtonGroup>

              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Layout</InputLabel>
                <Select
                  value={settings.layout}
                  label="Layout"
                  onChange={e => handleLayoutChange(e.target.value)}
                  disabled={!graphData}
                >
                  {LAYOUT_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                startIcon={<Refresh />}
                onClick={loadGraphData}
                disabled={!projectId || loading}
                size="small"
              >
                Refresh
              </Button>
              <Button
                startIcon={<Download />}
                onClick={() => exportGraph('png')}
                disabled={!graphData}
                size="small"
              >
                Export PNG
              </Button>
              <Button startIcon={<Settings />} onClick={() => setSettingsOpen(true)} size="small">
                Settings
              </Button>
            </Box>
          </Box>

          {/* Stats */}
          {stats && (
            <Box sx={{ mt: 2, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Typography variant="body2">
                <strong>Tables:</strong> {stats.tables}
              </Typography>
              <Typography variant="body2">
                <strong>Relationships:</strong> {stats.relationships}
              </Typography>
              <Typography variant="body2">
                <strong>Fields:</strong> {stats.fields}
              </Typography>
              <Typography
                variant="body2"
                color={stats.orphanTables > 0 ? 'warning.main' : 'text.secondary'}
              >
                <strong>Orphan Tables:</strong> {stats.orphanTables}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Graph Container */}
      <Card sx={{ height: 600 }}>
        <CardContent sx={{ height: '100%', p: 0 }}>
          <div
            ref={containerRef}
            data-testid="relationship-graph"
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#fafafa',
            }}
          />
        </CardContent>
      </Card>

      {/* Settings Drawer */}
      <Drawer anchor="right" open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <Box sx={{ width: 300, p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Graph Settings
          </Typography>

          <List>
            <ListItem>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.showLabels}
                    onChange={e => setSettings({ ...settings, showLabels: e.target.checked })}
                  />
                }
                label="Show Labels"
              />
            </ListItem>

            <ListItem>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.showOrphans}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        showOrphans: e.target.checked,
                      })
                    }
                  />
                }
                label="Show Orphan Tables"
              />
            </ListItem>

            <ListItem>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.showFieldTypes}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        showFieldTypes: e.target.checked,
                      })
                    }
                  />
                }
                label="Show Field Details"
              />
            </ListItem>

            <Divider />

            <ListItem>
              <Box sx={{ width: '100%' }}>
                <Typography gutterBottom>Node Size</Typography>
                <Slider
                  value={settings.nodeSize}
                  onChange={(_, value) => setSettings({ ...settings, nodeSize: value as number })}
                  min={20}
                  max={60}
                  step={5}
                  valueLabelDisplay="auto"
                />
              </Box>
            </ListItem>

            <ListItem>
              <Box sx={{ width: '100%' }}>
                <Typography gutterBottom>Edge Width</Typography>
                <Slider
                  value={settings.edgeWidth}
                  onChange={(_, value) => setSettings({ ...settings, edgeWidth: value as number })}
                  min={1}
                  max={5}
                  step={0.5}
                  valueLabelDisplay="auto"
                />
              </Box>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* Node Details */}
      {selectedNode && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {selectedNode.type === 'table' ? '📋' : '🏷️'} {selectedNode.name}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Type: {selectedNode.isOccurrence ? 'Table Occurrence (TO)' : selectedNode.type}
            </Typography>
            {selectedNode.isOccurrence && selectedNode.baseTable && (
              <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                Base table: <strong>{selectedNode.baseTable}</strong>
              </Typography>
            )}
            {selectedNode.description && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                {selectedNode.description}
              </Typography>
            )}
            <Button
              size="small"
              startIcon={<AccountTree />}
              sx={{ mt: 1 }}
              onClick={() =>
                setDepEntity({
                  entityType: selectedNode.type as EntityType,
                  entityId: selectedNode.id,
                  entityName: selectedNode.name ?? selectedNode.label ?? selectedNode.id,
                })
              }
            >
              Voir les dépendances
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1">Loading graph data...</Typography>
        </Box>
      )}

      <DependencyPanel
        projectId={projectId}
        entity={depEntity}
        onClose={() => setDepEntity(null)}
        onNavigate={target => {
          // The graph currently only renders table nodes (see
          // /api/projects/:id/graph) — if the target exists on the canvas,
          // select and center it; otherwise just re-open the panel on the
          // new entity (e.g. a script or field has no node to jump to).
          const node = cyRef.current?.getElementById(target.entityId);
          if (node && node.length > 0) {
            cyRef.current?.elements().unselect();
            node.select();
            cyRef.current?.animate({ center: { eles: node }, zoom: 1.5 }, { duration: 300 });
          }
          setDepEntity(target);
        }}
      />
    </Box>
  );
};

export default GraphVisualization;
