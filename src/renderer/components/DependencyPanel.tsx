/**
 * DependencyPanel — affiche les dépendances et dépendants en cascade d'une
 * entité sélectionnée (champ, table, script, layout, fonction personnalisée).
 * Réutilise le langage visuel du DetailDrawer de TablesView (header coloré +
 * bandeau de stats + sections scrollables en Paper/Table).
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Drawer,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TableChartIcon from '@mui/icons-material/TableChart';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import WebIcon from '@mui/icons-material/Web';
import CodeIcon from '@mui/icons-material/Code';
import CallMergeIcon from '@mui/icons-material/CallMerge';
import FunctionsIcon from '@mui/icons-material/Functions';
import SecurityIcon from '@mui/icons-material/Security';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { DependencyEntityRef, DependencyNode, DependencyEdgeType, EntityType } from '../../models';
import { ENTITY_TYPE_COLOR, ENTITY_TYPE_LABEL } from '../utils/entityColors';

const ENTITY_TYPE_ICON: Record<EntityType, React.ReactElement> = {
  table: <TableChartIcon fontSize="small" />,
  field: <ViewColumnIcon fontSize="small" />,
  layout: <WebIcon fontSize="small" />,
  script: <CodeIcon fontSize="small" />,
  relationship: <CallMergeIcon fontSize="small" />,
  custom_function: <FunctionsIcon fontSize="small" />,
  privilege: <SecurityIcon fontSize="small" />,
};

const EDGE_TYPE_LABEL: Record<DependencyEdgeType, string> = {
  'relationship-key': 'Clé de relation',
  'script-calls-script': 'Appel de script',
  'script-sets-field': 'Set Field',
  'script-navigates-layout': 'Go to Layout',
  'layout-shows-field': 'Champ sur layout',
  'layout-shows-field-via-portal': 'Champ via portail',
  'layout-triggers-script': 'Déclenche le script',
  'field-references-field': 'Référencé dans un calcul',
  'field-references-function': 'Fonction utilisée',
  'script-references-field': 'Référencé dans le script',
  'script-references-function': 'Fonction utilisée dans le script',
};

interface DependencyResponse {
  success: boolean;
  entity?: DependencyEntityRef;
  dependencies?: DependencyNode[];
  dependents?: DependencyNode[];
  cycles?: { from: DependencyEntityRef; to: DependencyEntityRef }[];
  truncated?: boolean;
  depth?: number;
  error?: { message: string };
}

interface DependencyPanelProps {
  projectId: string | null;
  entity: DependencyEntityRef | null; // null = fermé
  onClose: () => void;
  onNavigate?: (entity: DependencyEntityRef) => void;
}

function groupByLevel(nodes: DependencyNode[]): Map<number, DependencyNode[]> {
  const map = new Map<number, DependencyNode[]>();
  for (const node of nodes) {
    const list = map.get(node.level);
    if (list) list.push(node);
    else map.set(node.level, [node]);
  }
  return map;
}

function NodeSection({
  title,
  nodes,
  onNavigate,
}: {
  title: string;
  nodes: DependencyNode[];
  onNavigate?: (entity: DependencyEntityRef) => void;
}) {
  const grouped = useMemo(() => groupByLevel(nodes), [nodes]);
  const levels = Array.from(grouped.keys()).sort((a, b) => a - b);

  return (
    <Box mb={3}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <Typography variant="subtitle1" fontWeight={600}>
          {title}
        </Typography>
        <Chip label={nodes.length} size="small" />
      </Box>
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        {nodes.length === 0 ? (
          <Box sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">Aucun</Typography>
          </Box>
        ) : (
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Entité</TableCell>
                <TableCell>Relation</TableCell>
                <TableCell align="right">Naviguer</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {levels.map(level => (
                <React.Fragment key={level}>
                  <TableRow>
                    <TableCell colSpan={3} sx={{ bgcolor: 'action.hover', py: 0.5 }}>
                      <Typography variant="caption" fontWeight={600}>
                        Niveau {level}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  {grouped.get(level)!.map(node => (
                    <TableRow
                      key={`${node.entityType}:${node.entityId}`}
                      hover
                      sx={node.unresolved ? { opacity: 0.65 } : undefined}
                    >
                      <TableCell>
                        <Tooltip
                          title={
                            node.unresolved
                              ? (node.detail ?? 'Référence non résolue dans ce fichier')
                              : ''
                          }
                          placement="top"
                        >
                          <Box display="flex" alignItems="center" gap={1}>
                            <Box
                              sx={{
                                color: node.unresolved
                                  ? 'text.disabled'
                                  : ENTITY_TYPE_COLOR[node.entityType],
                                display: 'flex',
                              }}
                            >
                              {node.unresolved ? (
                                <HelpOutlineIcon fontSize="small" />
                              ) : (
                                ENTITY_TYPE_ICON[node.entityType]
                              )}
                            </Box>
                            <Box>
                              <Typography
                                variant="body2"
                                sx={node.unresolved ? { fontStyle: 'italic' } : undefined}
                              >
                                {node.entityName}
                              </Typography>
                              {node.tableName && (
                                <Typography variant="caption" color="text.secondary">
                                  {node.tableName}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={EDGE_TYPE_LABEL[node.edgeType]}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {!node.unresolved && (
                          <IconButton
                            size="small"
                            title="Naviguer vers"
                            onClick={() => onNavigate?.(node)}
                          >
                            <ArrowForwardIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}

export default function DependencyPanel({
  projectId,
  entity,
  onClose,
  onNavigate,
}: DependencyPanelProps) {
  const [data, setData] = useState<DependencyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxDepth, setMaxDepth] = useState(5);

  useEffect(() => {
    if (!entity || !projectId) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/dependencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        entityType: entity.entityType,
        entityId: entity.entityId,
        direction: 'both',
        maxDepth,
      }),
    })
      .then(res => res.json())
      .then((json: DependencyResponse) => {
        if (cancelled) return;
        if (!json.success) {
          setError(json.error?.message ?? 'Erreur inconnue');
        } else {
          setData(json);
        }
      })
      .catch(e => {
        if (!cancelled) setError(e.message ?? 'Erreur réseau');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, entity?.entityType, entity?.entityId, maxDepth]);

  if (!entity) return null;

  const dependencies = data?.dependencies ?? [];
  const dependents = data?.dependents ?? [];
  const cycles = data?.cycles ?? [];

  return (
    <Drawer
      anchor="right"
      open={!!entity}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 560 }, display: 'flex', flexDirection: 'column' },
      }}
    >
      {/* En-tête */}
      <Box
        sx={{
          px: 3,
          py: 2,
          bgcolor: ENTITY_TYPE_COLOR[entity.entityType],
          color: '#fff',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
        }}
      >
        <Box sx={{ mt: 0.3 }}>{ENTITY_TYPE_ICON[entity.entityType]}</Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" fontWeight={600} lineHeight={1.2}>
            {entity.entityName}
          </Typography>
          <Box display="flex" gap={1} mt={0.5} flexWrap="wrap">
            <Chip
              label={ENTITY_TYPE_LABEL[entity.entityType]}
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: '#fff', fontSize: '0.7rem' }}
            />
            {entity.tableName && (
              <Chip
                label={entity.tableName}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.7rem' }}
              />
            )}
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#fff', mt: -0.5, mr: -1 }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Stats rapides */}
      <Box display="flex" sx={{ borderBottom: 1, borderColor: 'divider' }}>
        {[
          { label: 'Dépendances', value: dependencies.length },
          { label: 'Dépendants', value: dependents.length },
          { label: 'Cycles', value: cycles.length },
        ].map(s => (
          <Box
            key={s.label}
            flex={1}
            textAlign="center"
            sx={{
              px: 2,
              py: 1.5,
              borderRight: 1,
              borderColor: 'divider',
              '&:last-child': { borderRight: 0 },
            }}
          >
            <Typography variant="h6" fontWeight={700} lineHeight={1}>
              {s.value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {s.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Contrôle de profondeur */}
      <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="dep-depth-label">Profondeur</InputLabel>
          <Select
            labelId="dep-depth-label"
            label="Profondeur"
            value={maxDepth}
            onChange={e => setMaxDepth(Number(e.target.value))}
          >
            {[1, 2, 3, 5, 8, 10].map(d => (
              <MenuItem key={d} value={d}>
                {d} niveau{d > 1 ? 'x' : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Contenu scrollable */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 2 }}>
        {loading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={28} />
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {!loading && !error && data && (
          <>
            {cycles.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {cycles.length} cycle{cycles.length > 1 ? 's' : ''} de dépendance détecté
                {cycles.length > 1 ? 's' : ''}
              </Alert>
            )}
            {data.truncated && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Résultats tronqués à {maxDepth} niveaux — augmentez la profondeur pour voir plus
                loin.
              </Alert>
            )}
            <NodeSection title="Dépendances" nodes={dependencies} onNavigate={onNavigate} />
            <NodeSection title="Dépendants" nodes={dependents} onNavigate={onNavigate} />
          </>
        )}
      </Box>
    </Drawer>
  );
}
