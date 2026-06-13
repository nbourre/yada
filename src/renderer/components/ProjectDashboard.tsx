/**
 * Project Dashboard Component
 * Displays project overview, statistics, and project list
 */

import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Chip,
  CircularProgress,
  // Removed unused UI imports (Paper, Divider, Button, Dialog components, TextField)
} from '@mui/material';
import { TableChart, ViewColumn, Web, Code, AccountTree, Functions, FolderSpecial, CheckCircle, Error as ErrorIcon, HourglassEmpty, FormatListBulleted, Security, CallMerge } from '@mui/icons-material';
import LinearProgress from '@mui/material/LinearProgress';

import { Project, Solution } from '../../models';

interface ProjectDashboardProps {
  project: Project | null;
  projects: Project[];
  solution: Solution | null;
  onProjectSelect: (project: Project) => void;
  loading: boolean;
}

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
  project,
  projects = [],
  solution,
  onProjectSelect,
  loading,
}) => {
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!project && projects.length === 0) {
    return (
      <Box textAlign="center" py={8}>
        <Typography variant="h5" gutterBottom color="textSecondary">
          Welcome to FileMaker DDR Explorer
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Upload a FileMaker Database Design Report (DDR) XML file to get started.
        </Typography>
      </Box>
    );
  }

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  const formatFileSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const fileStatusIcon = (status?: string) => {
    switch (status) {
      case 'ready':    return <CheckCircle sx={{ color: 'success.main', fontSize: 18 }} />;
      case 'error':    return <ErrorIcon sx={{ color: 'error.main', fontSize: 18 }} />;
      case 'parsing':  return <HourglassEmpty sx={{ color: 'warning.main', fontSize: 18 }} />;
      default:         return <HourglassEmpty sx={{ color: 'text.disabled', fontSize: 18 }} />;
    }
  };

  const solutionTotals = solution
    ? solution.files.reduce(
        (acc, f) => ({
          baseTables:     acc.baseTables     + f.stats.baseTableCount,
          tables:         acc.tables         + f.stats.tableCount,
          relationships:  acc.relationships  + f.stats.relationshipCount,
          layouts:        acc.layouts        + f.stats.layoutCount,
          scripts:        acc.scripts        + f.stats.scriptCount,
          customFunctions:acc.customFunctions+ f.stats.customFunctionCount,
          valueLists:     acc.valueLists     + f.stats.valueListCount,
        }),
        { baseTables: 0, tables: 0, relationships: 0, layouts: 0, scripts: 0, customFunctions: 0, valueLists: 0 }
      )
    : null;

  const parsedCount  = solution?.files.filter(f => f.parseStatus === 'ready').length  ?? 0;
  const pendingCount = solution?.files.filter(f => f.parseStatus !== 'ready' && f.parseStatus !== 'error').length ?? 0;

  return (
    <Grid container spacing={3}>
      {/* Solution Overview */}
      {solution && (
        <Grid item xs={12}>
          <Card sx={{ mb: 1, borderLeft: 4, borderColor: 'primary.main' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <FolderSpecial color="primary" />
                <Typography variant="h6">{solution.name}</Typography>
                <Chip label={`FM ${solution.fileMakerVersion}`} size="small" variant="outlined" sx={{ ml: 1 }} />
                <Chip
                  label={`${parsedCount}/${solution.files.length} files ready`}
                  size="small"
                  color={parsedCount === solution.files.length ? 'success' : pendingCount > 0 ? 'warning' : 'error'}
                  sx={{ ml: 0.5 }}
                />
              </Box>

              {/* Per-file status */}
              <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                {solution.files.map(f => (
                  <Box key={f.name} display="flex" alignItems="center" gap={0.5}
                    sx={{ bgcolor: 'action.hover', borderRadius: 1, px: 1, py: 0.5 }}>
                    {fileStatusIcon(f.parseStatus)}
                    <Typography variant="caption">{f.name}</Typography>
                  </Box>
                ))}
              </Box>

              {/* Progress bar while parsing */}
              {pendingCount > 0 && (
                <LinearProgress variant="determinate" value={(parsedCount / solution.files.length) * 100} sx={{ mb: 1 }} />
              )}

              {/* Aggregate stats */}
              {solutionTotals && (
                <Box display="flex" flexWrap="wrap" gap={2} mt={1}>
                  {[
                    { label: 'Base Tables', value: solutionTotals.baseTables },
                    { label: 'Table Occurrences', value: solutionTotals.tables },
                    { label: 'Relationships', value: solutionTotals.relationships },
                    { label: 'Layouts', value: solutionTotals.layouts },
                    { label: 'Scripts', value: solutionTotals.scripts },
                    { label: 'Custom Functions', value: solutionTotals.customFunctions },
                    { label: 'Value Lists', value: solutionTotals.valueLists },
                  ].map(s => (
                    <Box key={s.label} textAlign="center" sx={{ minWidth: 80 }}>
                      <Typography variant="h6" color="primary">{s.value}</Typography>
                      <Typography variant="caption" color="textSecondary">{s.label}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Project List */}
      <Grid xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Projects
            </Typography>
            <List dense>
              {projects.map(proj => (
                <ListItem key={proj.id} disablePadding>
                  <ListItemButton
                    onClick={() => onProjectSelect(proj)}
                    selected={project?.id === proj.id}
                  >
                    <ListItemText
                      primary={proj.name}
                      secondary={
                        <Box>
                          <Typography variant="caption" display="block">
                            {formatDate(proj.parsedAt)}
                          </Typography>
                          <Chip
                            label={proj.status}
                            size="small"
                            color={
                              proj.status === 'ready'
                                ? 'success'
                                : proj.status === 'error'
                                  ? 'error'
                                  : 'warning'
                            }
                          />
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Grid>

      {/* Project Details */}
      {project && (
        <Grid item xs={12} md={8}>
          {/* Project Info */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                {project.name}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    File: {project.fileName}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Size: {formatFileSize(project.fileSize)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Parsed: {formatDate(project.parsedAt)}
                  </Typography>
                  <Typography variant="body2" color={project.status === 'error' ? 'error' : 'textSecondary'}>
                    Status: {project.status}
                  </Typography>
                  {project.status === 'error' && (project as any).errors?.length > 0 && (
                    <Typography variant="body2" color="error" sx={{ mt: 1, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                      {(project as any).errors.join('\n')}
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Statistics Cards */}
          <Grid container spacing={2}>
            <Grid item xs={6} md={4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <TableChart color="primary" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" component="div" data-testid="tables-count">
                    {project.statistics.tableCount}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Tables
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={6} md={4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <ViewColumn color="primary" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" component="div" data-testid="fields-count">
                    {project.statistics.fieldCount}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Fields
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={6} md={4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Web color="primary" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" component="div">
                    {project.statistics.layoutCount}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Layouts
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={6} md={4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Code color="primary" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" component="div">
                    {project.statistics.scriptCount}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Scripts
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={6} md={4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <AccountTree color="primary" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" component="div">
                    {project.statistics.relationshipCount}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Relationships
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={6} md={4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Functions color="primary" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" component="div">
                    {project.statistics.customFunctionCount}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Custom Functions
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {project.statistics.valueListCount != null && (
              <Grid item xs={6} md={4}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <FormatListBulleted color="primary" sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h4" component="div">
                      {project.statistics.valueListCount}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Value Lists
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {project.statistics.privilegeSetCount != null && (
              <Grid item xs={6} md={4}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Security color="primary" sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h4" component="div">
                      {project.statistics.privilegeSetCount}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Privilege Sets
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {project.statistics.scriptReferenceCount != null && (
              <Grid item xs={6} md={4}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <CallMerge color="primary" sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h4" component="div">
                      {project.statistics.scriptReferenceCount}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Script References
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>

          {/* Metadata */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Database Metadata
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    FileMaker Version
                  </Typography>
                  <Typography variant="body1">{project.metadata.fileMakerVersion}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Platform
                  </Typography>
                  <Typography variant="body1">{project.metadata.platform}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Created By
                  </Typography>
                  <Typography variant="body1">{project.metadata.createdBy}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Modified By
                  </Typography>
                  <Typography variant="body1">{project.metadata.modifiedBy}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );
};

export default ProjectDashboard;
