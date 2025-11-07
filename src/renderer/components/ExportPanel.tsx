/**
 * Export Panel Component
 * Data export functionality with various formats and options
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Grid,
  Alert,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import { GetApp, Description, PictureAsPdf, TableChart } from '@mui/icons-material';

interface ExportPanelProps {
  projectId: string | null;
}

interface ExportOptions {
  format: string;
  includeFields: boolean;
  includeScripts: boolean;
  includeLayouts: boolean;
  includeRelationships: boolean;
  includeCalculations: boolean;
}

interface ExportJob {
  id: string;
  format: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
  error?: string;
}

const ExportPanel: React.FC<ExportPanelProps> = ({ projectId }) => {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'json',
    includeFields: true,
    includeScripts: true,
    includeLayouts: true,
    includeRelationships: true,
    includeCalculations: true,
  });

  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportFormats = [
    { value: 'json', label: 'JSON', icon: <Description /> },
    { value: 'csv', label: 'CSV', icon: <TableChart /> },
    { value: 'pdf', label: 'PDF Report', icon: <PictureAsPdf /> },
  ];

  const handleExport = async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      // Map UI options to API payload
      const entityTypes: string[] = [];
      if (options.includeFields) entityTypes.push('field');
      if (options.includeScripts) entityTypes.push('script');
      if (options.includeLayouts) entityTypes.push('layout');
      if (options.includeRelationships) entityTypes.push('relationship');

      const response = await fetch(`/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          format: options.format,
          options: {
            filterOptions: {
              entityTypes: entityTypes.length > 0 ? entityTypes : undefined,
            },
          },
        }),
      });

      if (!response.ok) throw new Error('Export failed');

      const result = await response.json();

      // Complete job immediately using server response
      const downloadUrl: string | undefined = result?.export?.downloadUrl;
      const newJob: ExportJob = {
        id: `${Date.now()}`,
        format: options.format,
        status: downloadUrl ? 'completed' : 'failed',
        progress: downloadUrl ? 100 : 0,
        createdAt: new Date(),
        completedAt: downloadUrl ? new Date() : undefined,
        downloadUrl,
        error: downloadUrl ? undefined : 'No download available',
      };

      setJobs(prev => [newJob, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  // Legacy polling removed: /api/export responds synchronously in current backend

  if (!projectId) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="textSecondary">
          Select a project to export data
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Export Data
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Export Configuration */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Export Configuration
              </Typography>

              {/* Format Selection */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Export Format</InputLabel>
                <Select
                  value={options.format}
                  label="Export Format"
                  onChange={e => setOptions({ ...options, format: e.target.value })}
                  disabled={loading}
                >
                  {exportFormats.map(format => (
                    <MenuItem key={format.value} value={format.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {format.icon}
                        {format.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Content Options */}
              <Typography variant="subtitle2" gutterBottom>
                Include Content
              </Typography>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={options.includeFields}
                      onChange={e => setOptions({ ...options, includeFields: e.target.checked })}
                      disabled={loading}
                    />
                  }
                  label="Fields & Schemas"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={options.includeScripts}
                      onChange={e => setOptions({ ...options, includeScripts: e.target.checked })}
                      disabled={loading}
                    />
                  }
                  label="Scripts"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={options.includeLayouts}
                      onChange={e => setOptions({ ...options, includeLayouts: e.target.checked })}
                      disabled={loading}
                    />
                  }
                  label="Layouts"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={options.includeRelationships}
                      onChange={e =>
                        setOptions({ ...options, includeRelationships: e.target.checked })
                      }
                      disabled={loading}
                    />
                  }
                  label="Relationships"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={options.includeCalculations}
                      onChange={e =>
                        setOptions({ ...options, includeCalculations: e.target.checked })
                      }
                      disabled={loading}
                    />
                  }
                  label="Calculations"
                />
              </FormGroup>

              <Button
                variant="contained"
                startIcon={<GetApp />}
                onClick={handleExport}
                disabled={loading || !projectId}
                fullWidth
                sx={{ mt: 3 }}
              >
                {loading ? 'Exporting...' : 'Start Export'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Export Jobs */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Export Jobs
              </Typography>

              {jobs.length === 0 ? (
                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{ textAlign: 'center', py: 3 }}
                >
                  No export jobs yet
                </Typography>
              ) : (
                <List>
                  {jobs.map((job, index) => (
                    <React.Fragment key={job.id}>
                      <ListItem>
                        <ListItemIcon>
                          {exportFormats.find(f => f.value === job.format)?.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={`${job.format.toUpperCase()} Export`}
                          secondary={
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Chip
                                  label={job.status}
                                  size="small"
                                  color={
                                    job.status === 'completed'
                                      ? 'success'
                                      : job.status === 'failed'
                                        ? 'error'
                                        : job.status === 'running'
                                          ? 'primary'
                                          : 'default'
                                  }
                                />
                                <Typography variant="caption">
                                  {job.createdAt.toLocaleTimeString()}
                                </Typography>
                              </Box>

                              {job.status === 'running' && (
                                <LinearProgress
                                  variant="determinate"
                                  value={job.progress}
                                  sx={{ mt: 1 }}
                                />
                              )}

                              {job.status === 'completed' && job.downloadUrl && (
                                <Button
                                  size="small"
                                  href={job.downloadUrl}
                                  download
                                  startIcon={<GetApp />}
                                >
                                  Download
                                </Button>
                              )}

                              {job.status === 'failed' && job.error && (
                                <Typography variant="caption" color="error">
                                  {job.error}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < jobs.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ExportPanel;
