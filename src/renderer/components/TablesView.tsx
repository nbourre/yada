/**
 * TablesView — Vue tabulaire des tables FileMaker
 * Affiche toutes les tables dans un DataGrid MUI X.
 * Clic sur une ligne → Drawer de détail (champs + relations).
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  Tooltip,
  Paper,
  TextField,
  InputAdornment,
  TableSortLabel,
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
import TableChartIcon from '@mui/icons-material/TableChart';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import SearchIcon from '@mui/icons-material/Search';
import LinkIcon from '@mui/icons-material/Link';
import { Table as TableModel, Field, DependencyEntityRef } from '../../models';
import DependencyPanel from './DependencyPanel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TablesViewProps {
  projectId: string | null;
}

interface TableRow {
  id: string;
  name: string;
  type: 'Base Table' | 'Occurrence';
  baseTable: string;
  fieldCount: number;
  relationshipCount: number;
  _raw: TableModel;
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

// ---------------------------------------------------------------------------
// Panneau de détail (Drawer)
// ---------------------------------------------------------------------------

interface DetailDrawerProps {
  table: TableModel | null;
  onClose: () => void;
  onFieldClick: (field: Field) => void;
}

const FIELD_TYPE_COLOR: Record<string, string> = {
  text: '#1976d2',
  number: '#388e3c',
  date: '#f57c00',
  time: '#7b1fa2',
  timestamp: '#c62828',
  container: '#00838f',
  calculation: '#5d4037',
  summary: '#455a64',
  global: '#6a1b9a',
};

function FieldTypeChip({ type }: { type: string }) {
  const color = FIELD_TYPE_COLOR[type] ?? '#616161';
  return (
    <Chip
      label={type}
      size="small"
      sx={{
        bgcolor: color,
        color: '#fff',
        fontSize: '0.7rem',
        height: 20,
        fontWeight: 500,
      }}
    />
  );
}

// Genre du champ (Normal/Calculé/Résumé) — attribut DDR distinct du type de
// donnée (`dataType`). N'affiche rien pour "normal" pour ne pas encombrer
// le cas courant.
const FIELD_KIND_LABEL: Record<string, string> = {
  calculated: 'Calculé',
  summary: 'Résumé',
};
const FIELD_KIND_COLOR: Record<string, string> = {
  calculated: '#5d4037',
  summary: '#455a64',
};

function FieldKindChip({ kind }: { kind: string }) {
  if (kind === 'normal' || !FIELD_KIND_LABEL[kind]) return null;
  return (
    <Chip
      label={FIELD_KIND_LABEL[kind]}
      size="small"
      sx={{
        bgcolor: FIELD_KIND_COLOR[kind],
        color: '#fff',
        fontSize: '0.7rem',
        height: 20,
        fontWeight: 500,
      }}
    />
  );
}

type FieldSortColumn = 'name' | 'type' | 'fieldKind' | 'options' | 'comment';

function fieldSortValue(field: Field, column: FieldSortColumn): string {
  switch (column) {
    case 'name':
      return field.name.toLowerCase();
    case 'type':
      return field.type.toLowerCase();
    case 'fieldKind':
      return field.fieldKind;
    case 'options': {
      const flags = [
        field.options?.indexed && 'idx',
        field.options?.required && 'req',
        field.options?.unique && 'uniq',
        field.options?.global && 'global',
        field.options?.repeating && 'rep',
      ].filter(Boolean);
      return flags.join(',');
    }
    case 'comment':
      return (field.comment ?? '').toLowerCase();
  }
}

function DetailDrawer({ table, onClose, onFieldClick }: DetailDrawerProps) {
  const [fieldFilter, setFieldFilter] = useState('');
  const [sortColumn, setSortColumn] = useState<FieldSortColumn>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    setFieldFilter('');
  }, [table]);

  const handleSort = (column: FieldSortColumn) => {
    if (sortColumn === column) {
      setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDir('asc');
    }
  };

  if (!table) return null;

  const isOccurrence = table.isOccurrence ?? false;
  const baseTableName = table.baseTable ?? table.sourceTable ?? '';

  const filteredFields = (table.fields ?? [])
    .filter(
      f =>
        f.name.toLowerCase().includes(fieldFilter.toLowerCase()) ||
        f.type.toLowerCase().includes(fieldFilter.toLowerCase()) ||
        (f.comment ?? '').toLowerCase().includes(fieldFilter.toLowerCase())
    )
    .sort((a, b) => {
      const cmp = fieldSortValue(a, sortColumn).localeCompare(fieldSortValue(b, sortColumn));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  // Relations impliquant cette table (par nom)
  const relatedRels = table.relationships ?? [];

  return (
    <Drawer
      anchor="right"
      open={!!table}
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
          bgcolor: isOccurrence ? 'secondary.main' : 'primary.main',
          color: '#fff',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
        }}
      >
        <TableChartIcon sx={{ mt: 0.3 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" fontWeight={600} lineHeight={1.2}>
            {table.name}
          </Typography>
          <Box display="flex" gap={1} mt={0.5} flexWrap="wrap">
            <Chip
              label={isOccurrence ? 'Table Occurrence' : 'Base Table'}
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: '#fff', fontSize: '0.7rem' }}
            />
            {isOccurrence && baseTableName && (
              <Chip
                label={`→ ${baseTableName}`}
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
          {
            icon: <ViewColumnIcon fontSize="small" />,
            label: 'Champs',
            value: table.fields?.length ?? 0,
          },
          {
            icon: <LinkIcon fontSize="small" />,
            label: 'Relations',
            value: table.relationships?.length ?? 0,
          },
        ].map(s => (
          <Box
            key={s.label}
            flex={1}
            display="flex"
            alignItems="center"
            gap={1}
            sx={{
              px: 3,
              py: 1.5,
              borderRight: 1,
              borderColor: 'divider',
              '&:last-child': { borderRight: 0 },
            }}
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
      </Box>

      {/* Contenu scrollable */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 2 }}>
        {/* Champs */}
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <ViewColumnIcon fontSize="small" color="action" />
          <Typography variant="subtitle1" fontWeight={600}>
            Champs
          </Typography>
          <Chip label={table.fields?.length ?? 0} size="small" />
          <Box flex={1} />
          <TextField
            size="small"
            placeholder="Filtrer…"
            value={fieldFilter}
            onChange={e => setFieldFilter(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ width: 160 }}
          />
        </Box>

        <Paper variant="outlined" sx={{ mb: 3, overflow: 'hidden' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: 'action.hover', fontWeight: 600 } }}>
                {(
                  [
                    ['name', 'Nom'],
                    ['type', 'Type'],
                    ['fieldKind', 'Genre'],
                    ['options', 'Options'],
                    ['comment', 'Commentaire'],
                  ] as [FieldSortColumn, string][]
                ).map(([column, label]) => (
                  <TableCell key={column}>
                    <TableSortLabel
                      active={sortColumn === column}
                      direction={sortColumn === column ? sortDir : 'asc'}
                      onClick={() => handleSort(column)}
                    >
                      {label}
                    </TableSortLabel>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredFields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    {(table.fields?.length ?? 0) === 0 ? 'Aucun champ' : 'Aucun résultat'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredFields.map(field => (
                  <TableRow
                    key={field.id}
                    hover
                    onClick={() => onFieldClick(field)}
                    sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}
                  >
                    <TableCell
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        maxWidth: 140,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Tooltip title={field.name} placement="top">
                        <span>{field.name}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <FieldTypeChip type={field.type} />
                    </TableCell>
                    <TableCell>
                      <FieldKindChip kind={field.fieldKind} />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {field.options?.indexed && (
                          <Chip label="idx" size="small" sx={{ height: 16, fontSize: '0.65rem' }} />
                        )}
                        {field.options?.required && (
                          <Chip
                            label="req"
                            size="small"
                            color="error"
                            sx={{ height: 16, fontSize: '0.65rem' }}
                          />
                        )}
                        {field.options?.unique && (
                          <Chip
                            label="uniq"
                            size="small"
                            color="warning"
                            sx={{ height: 16, fontSize: '0.65rem' }}
                          />
                        )}
                        {field.options?.global && (
                          <Chip
                            label="global"
                            size="small"
                            color="info"
                            sx={{ height: 16, fontSize: '0.65rem' }}
                          />
                        )}
                        {field.options?.repeating && (
                          <Chip
                            label={`×${field.options.repetitions ?? '?'}`}
                            size="small"
                            sx={{ height: 16, fontSize: '0.65rem' }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        maxWidth: 120,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Tooltip title={field.comment ?? ''} placement="top">
                        <span>{field.comment ?? ''}</span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>

        {/* Relations */}
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <LinkIcon fontSize="small" color="action" />
          <Typography variant="subtitle1" fontWeight={600}>
            Relations
          </Typography>
          <Chip label={relatedRels.length} size="small" />
        </Box>

        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: 'action.hover', fontWeight: 600 } }}>
                <TableCell>Table gauche</TableCell>
                <TableCell>Champ gauche</TableCell>
                <TableCell align="center">Type</TableCell>
                <TableCell>Champ droit</TableCell>
                <TableCell>Table droite</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {relatedRels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    Aucune relation
                  </TableCell>
                </TableRow>
              ) : (
                relatedRels.map(rel => (
                  <TableRow key={rel.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell sx={{ fontSize: '0.78rem', fontFamily: 'monospace' }}>
                      {rel.leftTable}
                    </TableCell>
                    <TableCell
                      sx={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'text.secondary' }}
                    >
                      {rel.leftField}
                    </TableCell>
                    <TableCell align="center">
                      <Typography fontSize="0.8rem" color="text.secondary">
                        {rel.type === 'one-to-many'
                          ? '1→∞'
                          : rel.type === 'many-to-one'
                            ? '∞→1'
                            : rel.type === 'many-to-many'
                              ? '∞→∞'
                              : '1→1'}
                      </Typography>
                    </TableCell>
                    <TableCell
                      sx={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'text.secondary' }}
                    >
                      {rel.rightField}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', fontFamily: 'monospace' }}>
                      {rel.rightTable}
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

export default function TablesView({ projectId }: TablesViewProps) {
  const [tables, setTables] = useState<TableModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableModel | null>(null);
  const [selectedField, setSelectedField] = useState<DependencyEntityRef | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'base' | 'occurrence'>('all');

  const loadTables = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/tables`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const raw: TableModel[] = data.data ?? data.tables ?? [];
      setTables(raw);
    } catch (e: any) {
      setError(e.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  // Construire les lignes DataGrid
  const rows: TableRow[] = tables
    .filter(t => {
      if (filterType === 'base') return !t.isOccurrence;
      if (filterType === 'occurrence') return t.isOccurrence;
      return true;
    })
    .map(t => ({
      id: t.id,
      name: t.name,
      type: t.isOccurrence ? 'Occurrence' : 'Base Table',
      baseTable: t.baseTable ?? t.sourceTable ?? '',
      fieldCount: t.fields?.length ?? 0,
      relationshipCount: t.relationships?.length ?? 0,
      _raw: t,
    }));

  const columns: GridColDef<TableRow>[] = [
    {
      field: 'name',
      headerName: 'Nom',
      flex: 2,
      minWidth: 180,
      renderCell: params => (
        <Box display="flex" alignItems="center" gap={1}>
          <TableChartIcon
            fontSize="small"
            color={params.row.type === 'Base Table' ? 'primary' : 'secondary'}
          />
          <Typography variant="body2" fontFamily="monospace" fontWeight={500}>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 150,
      renderCell: params => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === 'Base Table' ? 'primary' : 'secondary'}
          variant="outlined"
        />
      ),
    },
    {
      field: 'baseTable',
      headerName: 'Table de base',
      flex: 1.5,
      minWidth: 160,
      renderCell: params =>
        params.value ? (
          <Typography variant="body2" color="text.secondary" fontFamily="monospace">
            {params.value}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        ),
    },
    {
      field: 'fieldCount',
      headerName: 'Champs',
      width: 100,
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: params => (
        <Chip
          label={params.value}
          size="small"
          variant="outlined"
          icon={<ViewColumnIcon style={{ fontSize: 14 }} />}
        />
      ),
    },
    {
      field: 'relationshipCount',
      headerName: 'Relations',
      width: 110,
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: params => (
        <Chip
          label={params.value}
          size="small"
          variant="outlined"
          icon={<LinkIcon style={{ fontSize: 14 }} />}
        />
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
          Importez un fichier DDR pour explorer ses tables.
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

  const baseCount = tables.filter(t => !t.isOccurrence).length;
  const occCount = tables.filter(t => t.isOccurrence).length;

  return (
    <Box>
      {/* Filtres rapides */}
      <Box display="flex" gap={1} mb={2} flexWrap="wrap">
        {[
          { key: 'all', label: `Toutes (${tables.length})` },
          { key: 'base', label: `Base Tables (${baseCount})` },
          { key: 'occurrence', label: `Occurrences (${occCount})` },
        ].map(f => (
          <Chip
            key={f.key}
            label={f.label}
            onClick={() => setFilterType(f.key as any)}
            color={filterType === f.key ? 'primary' : 'default'}
            variant={filterType === f.key ? 'filled' : 'outlined'}
            clickable
          />
        ))}
      </Box>

      {/* DataGrid */}
      <Paper variant="outlined" sx={{ height: 'calc(100vh - 260px)', minHeight: 400 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          density="compact"
          disableRowSelectionOnClick={false}
          onRowClick={(params: GridRowParams<TableRow>) => setSelectedTable(params.row._raw)}
          slots={{ toolbar: CustomToolbar }}
          slotProps={{
            toolbar: { showQuickFilter: true },
          }}
          initialState={{
            sorting: { sortModel: [{ field: 'name', sort: 'asc' }] },
          }}
          sx={{
            border: 0,
            '& .MuiDataGrid-row': {
              cursor: 'pointer',
            },
            '& .MuiDataGrid-row:hover': {
              bgcolor: 'action.hover',
            },
          }}
        />
      </Paper>

      {/* Drawer de détail */}
      <DetailDrawer
        table={selectedTable}
        onClose={() => setSelectedTable(null)}
        onFieldClick={field =>
          setSelectedField({
            entityType: 'field',
            entityId: field.id,
            entityName: field.name,
            tableName: selectedTable?.name,
          })
        }
      />

      {/* Panneau de dépendances */}
      <DependencyPanel
        projectId={projectId}
        entity={selectedField}
        onClose={() => setSelectedField(null)}
        onNavigate={target => {
          if (target.entityType === 'table') {
            const t = tables.find(t => t.id === target.entityId);
            if (t) {
              setSelectedTable(t);
              setSelectedField(null);
            }
          } else if (target.entityType === 'field') {
            const owner = tables.find(t => t.name === target.tableName);
            if (owner) setSelectedTable(owner);
            setSelectedField(target);
          }
        }}
      />
    </Box>
  );
}
