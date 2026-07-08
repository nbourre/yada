/**
 * ScriptsView — Vue tabulaire des scripts FileMaker.
 * Affiche tous les scripts dans un DataGrid MUI X.
 * Clic sur un script → Drawer de détail (étapes + tables utilisées).
 * Miroir de TablesView.tsx pour la structure et les conventions visuelles.
 */

import React, { useCallback, useEffect, useState } from 'react';
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
  TableRow,
  Paper,
  Button,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRowParams,
  GridToolbarContainer,
  GridToolbarFilterButton,
  GridToolbarExport,
  GridToolbarQuickFilter,
} from '@mui/x-data-grid';
import CloseIcon from '@mui/icons-material/Close';
import CodeIcon from '@mui/icons-material/Code';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { Script, DependencyEntityRef } from '../../models';
import DependencyPanel from './DependencyPanel';
import { useResizableWidth } from '../utils/useResizableWidth';

interface ScriptsViewProps {
  projectId: string | null;
}

// ---------------------------------------------------------------------------
// Toolbar personnalisé
// ---------------------------------------------------------------------------

function CustomToolbar() {
  return (
    <GridToolbarContainer sx={{ gap: 1, px: 1, py: 0.5 }}>
      <GridToolbarFilterButton />
      <GridToolbarExport />
      <Box sx={{ flex: 1 }} />
      <GridToolbarQuickFilter debounceMs={200} />
    </GridToolbarContainer>
  );
}

interface ScriptRow {
  id: string;
  name: string;
  stepCount: number;
  runWithFullAccess: boolean;
  includeInMenu: boolean;
  comment: string;
  _raw: Script;
}

// ---------------------------------------------------------------------------
// Drawer de détail
// ---------------------------------------------------------------------------

interface ScriptDetailDrawerProps {
  script: Script | null;
  onClose: () => void;
  onShowDependencies: (script: Script) => void;
}

function tablesUsedIn(script: Script): string[] {
  const tables = new Set<string>();
  for (const step of script.steps) {
    const targetTable = step.options?.targetTable;
    if (typeof targetTable === 'string' && targetTable) tables.add(targetTable);
  }
  return Array.from(tables).sort();
}

function ScriptDetailDrawer({ script, onClose, onShowDependencies }: ScriptDetailDrawerProps) {
  const { width: drawerWidth, onResizeStart } = useResizableWidth({
    defaultWidth: 640,
    min: 420,
    storageKey: 'yada-scriptsview-detail-width',
  });

  if (!script) return null;

  const tablesUsed = tablesUsedIn(script);

  return (
    <Drawer
      anchor="right"
      open={!!script}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: drawerWidth }, display: 'flex', flexDirection: 'column' },
      }}
    >
      {/* Poignée de redimensionnement */}
      <Box
        onMouseDown={onResizeStart}
        sx={{
          display: { xs: 'none', sm: 'block' },
          position: 'absolute',
          left: -3,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: 'col-resize',
          zIndex: theme => theme.zIndex.drawer + 1,
          '&:hover': { bgcolor: 'primary.main', opacity: 0.5 },
        }}
      />

      {/* En-tête */}
      <Box
        sx={{
          px: 3,
          py: 2,
          bgcolor: 'primary.main',
          color: '#fff',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
        }}
      >
        <CodeIcon sx={{ mt: 0.3 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" fontWeight={600} lineHeight={1.2}>
            {script.name}
          </Typography>
          <Box display="flex" gap={1} mt={0.5} flexWrap="wrap">
            <Chip
              label={script.runWithFullAccess ? 'Accès complet: Oui' : 'Accès complet: Non'}
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: '#fff', fontSize: '0.7rem' }}
            />
            <Chip
              label={script.includeInMenu ? 'Dans le menu' : 'Hors menu'}
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.7rem' }}
            />
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#fff', mt: -0.5, mr: -1 }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Stats rapides */}
      <Box display="flex" sx={{ borderBottom: 1, borderColor: 'divider' }}>
        {[
          {
            icon: <FormatListNumberedIcon fontSize="small" />,
            label: 'Étapes',
            value: script.steps.length,
          },
        ].map(s => (
          <Box
            key={s.label}
            flex={1}
            display="flex"
            alignItems="center"
            gap={1}
            sx={{ px: 3, py: 1.5 }}
          >
            {s.icon}
            <Box>
              <Typography variant="h6" fontWeight={700} lineHeight={1}>
                {s.value}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {s.label}
              </Typography>
            </Box>
          </Box>
        ))}
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2 }}>
          <Button
            size="small"
            startIcon={<AccountTreeIcon />}
            onClick={() => onShowDependencies(script)}
          >
            Voir les dépendances
          </Button>
        </Box>
      </Box>

      {/* Contenu scrollable */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 2 }}>
        {script.comment && (
          <Alert severity="info" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
            {script.comment}
          </Alert>
        )}

        {tablesUsed.length > 0 && (
          <Box mb={3}>
            <Typography variant="subtitle1" fontWeight={600} mb={1}>
              Tables utilisées
            </Typography>
            <Box display="flex" gap={0.5} flexWrap="wrap">
              {tablesUsed.map(t => (
                <Chip key={t} label={t} size="small" variant="outlined" />
              ))}
            </Box>
          </Box>
        )}

        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <FormatListNumberedIcon fontSize="small" color="action" />
          <Typography variant="subtitle1" fontWeight={600}>
            Étapes du script
          </Typography>
          <Chip label={script.steps.length} size="small" />
        </Box>

        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Table size="small">
            <TableBody>
              {script.steps.length === 0 ? (
                <TableRow>
                  <TableCell align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    Aucune étape
                  </TableCell>
                </TableRow>
              ) : (
                script.steps.map((step, index) => (
                  <TableRow key={index} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell
                      sx={{
                        width: 36,
                        color: 'text.disabled',
                        fontSize: '0.7rem',
                        textAlign: 'right',
                        verticalAlign: 'top',
                        pt: 0.8,
                      }}
                    >
                      {index + 1}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.78rem',
                        color: step.enabled ? 'text.primary' : 'text.disabled',
                        textDecoration: step.enabled ? 'none' : 'line-through',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {step.text || step.step}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>
      </Box>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export default function ScriptsView({ projectId }: ScriptsViewProps) {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [depEntity, setDepEntity] = useState<DependencyEntityRef | null>(null);

  const loadScripts = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/scripts`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const raw: Script[] = data.data ?? data.scripts ?? [];
      // FileMaker represents Scripts-menu separators as real, nameless "-"
      // script entries with no steps — accurate to the DDR, but not
      // meaningful to inspect here.
      setScripts(raw.filter(s => s.name !== '-'));
    } catch (e: any) {
      setError(e.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  const rows: ScriptRow[] = scripts.map(s => ({
    id: s.id,
    name: s.name,
    stepCount: s.steps?.length ?? 0,
    runWithFullAccess: !!s.runWithFullAccess,
    includeInMenu: !!s.includeInMenu,
    comment: s.comment ?? '',
    _raw: s,
  }));

  const columns: GridColDef<ScriptRow>[] = [
    {
      field: 'name',
      headerName: 'Nom',
      flex: 2,
      minWidth: 220,
      renderCell: params => (
        <Box display="flex" alignItems="center" gap={1}>
          <CodeIcon fontSize="small" color="primary" />
          <Typography variant="body2" fontFamily="monospace" fontWeight={500}>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'stepCount',
      headerName: 'Étapes',
      width: 100,
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: params => <Chip label={params.value} size="small" variant="outlined" />,
    },
    {
      field: 'runWithFullAccess',
      headerName: 'Accès complet',
      width: 130,
      align: 'center',
      headerAlign: 'center',
      renderCell: params =>
        params.value ? (
          <Chip label="Oui" size="small" color="warning" variant="outlined" />
        ) : (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        ),
    },
    {
      field: 'includeInMenu',
      headerName: 'Menu',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: params =>
        params.value ? (
          <Chip label="Oui" size="small" variant="outlined" />
        ) : (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        ),
    },
    {
      field: 'comment',
      headerName: 'Commentaire',
      flex: 1.5,
      minWidth: 160,
      renderCell: params => (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {params.value}
        </Typography>
      ),
    },
  ];

  if (!projectId) {
    return (
      <Box textAlign="center" py={8}>
        <Typography variant="h6" color="text.secondary">
          Aucun projet sélectionné
        </Typography>
        <Typography variant="body2" color="text.disabled" mt={1}>
          Importez un fichier DDR pour explorer ses scripts.
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      <Paper variant="outlined" sx={{ height: 'calc(100vh - 220px)', minHeight: 400 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          density="compact"
          onRowClick={(params: GridRowParams<ScriptRow>) => setSelectedScript(params.row._raw)}
          slots={{ toolbar: CustomToolbar }}
          slotProps={{
            toolbar: { showQuickFilter: true },
          }}
          initialState={{
            sorting: { sortModel: [{ field: 'name', sort: 'asc' }] },
          }}
          sx={{
            border: 0,
            '& .MuiDataGrid-row': { cursor: 'pointer' },
            '& .MuiDataGrid-row:hover': { bgcolor: 'action.hover' },
          }}
        />
      </Paper>

      {/* Drawer de détail */}
      <ScriptDetailDrawer
        script={selectedScript}
        onClose={() => setSelectedScript(null)}
        onShowDependencies={s =>
          setDepEntity({ entityType: 'script', entityId: s.id, entityName: s.name })
        }
      />

      {/* Panneau de dépendances */}
      <DependencyPanel
        projectId={projectId}
        entity={depEntity}
        onClose={() => setDepEntity(null)}
        onNavigate={target => {
          if (target.entityType === 'script') {
            const s = scripts.find(s => s.id === target.entityId);
            if (s) {
              setSelectedScript(s);
              setDepEntity(null);
            }
          } else {
            // Layouts/fields/tables aren't navigable from within ScriptsView
            // (no corresponding list here) — re-open the panel on the new
            // entity so the cascade can still be followed.
            setDepEntity(target);
          }
        }}
      />
    </Box>
  );
}
