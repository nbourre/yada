/**
 * Main App Component for FileMaker DDR Explorer
 * React + TypeScript UI with Material-UI design system
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Tabs,
  Tab,
  Alert,
  Snackbar,
  Card,
  CardContent,
  LinearProgress,
} from '@mui/material';

import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SearchIcon from '@mui/icons-material/Search';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import DownloadIcon from '@mui/icons-material/Download';
import DashboardIcon from '@mui/icons-material/Dashboard';
import TableChartIcon from '@mui/icons-material/TableChart';

// Import our components (will create these next)
import ProjectDashboard from './ProjectDashboard';
import FileUpload from './FileUpload';
import SearchPanel from './SearchPanel';
import GraphVisualization from './GraphVisualization';
import ExportPanel from './ExportPanel';
import TablesView from './TablesView';

// Import types from our models
import { Project, Solution } from '../../models';
import '../types';

// Material-UI theme configuration
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
});

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `tab-${index}`,
    'aria-controls': `tabpanel-${index}`,
  };
}

export default function App() {
  // State management
  const [currentTab, setCurrentTab] = useState(0);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentSolution, setCurrentSolution] = useState<Solution | null>(null);
  const [loading, setLoading] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseMessage, setParseMessage] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseSuccessVisible, setParseSuccessVisible] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      // Call our API service to get projects
      const response = await fetch('/api/projects', {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        // If endpoint doesn't exist yet, just start with empty projects
        console.log('Projects endpoint not available yet');
        setProjects([]);
        setLoading(false);
        return;
      }

      const result = await response.json();

      if (result.success) {
        setProjects(result.projects ?? result.data ?? []);
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.log('Could not load projects, starting fresh:', error);
      setProjects([]); // Start with empty projects list
    } finally {
      setLoading(false);
    }
  }, []);

  // Load projects on component mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Setup IPC event listeners
  useEffect(() => {
    if (window.electronAPI) {
      // Progress updates
      window.electronAPI.onProgress((progress: number, message: string) => {
        setParseProgress(progress);
        setParseMessage(message);
      });

      // Error handling
      window.electronAPI.onError((error: string) => {
        showNotification(error, 'error');
        setIsParsing(false);
      });

      // Solution discovered (Summary.xml parsed, DDR files not yet processed)
      window.electronAPI.onSolutionDiscovered((solution: Solution) => {
        setCurrentSolution(solution);
        setIsParsing(true);
        setParseProgress(0);
        setParseMessage(`Solution "${solution.name}" found — parsing ${solution.files.length} file(s)...`);
        showNotification(`Parsing solution: ${solution.name}`, 'info');
      });

      // Individual file status update during solution parse
      window.electronAPI.onSolutionFileStatus((update: { solutionId: string; fileName: string; status: string; projectId?: string; error?: string }) => {
        setCurrentSolution(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            files: prev.files.map(f =>
              f.name === update.fileName
                ? { ...f, parseStatus: update.status as any, projectId: update.projectId, parseError: update.error }
                : f
            ),
          };
        });
      });

      // Solution fully parsed
      window.electronAPI.onSolutionParsed((solution: Solution) => {
        setCurrentSolution(solution);
        setIsParsing(false);
        setParseProgress(100);
        const readyCount = solution.files.filter((f: any) => f.parseStatus === 'ready').length;
        showNotification(`Solution parsed: ${readyCount}/${solution.files.length} files ready`, 'success');
        setParseSuccessVisible(true);
        setCurrentTab(0);
      });

      // Project parsed
      window.electronAPI.onProjectParsed((project: Project) => {
        console.log('Project parsed:', project);
        try {
          setCurrentProject(project);
          setProjects(prev => {
            const prevArray = Array.isArray(prev) ? prev : [];
            return [...prevArray, project];
          });
          setIsParsing(false);
          setParseProgress(100);
          showNotification(`Successfully parsed ${project.name}`, 'success');
          setParseSuccessVisible(true);
          setCurrentTab(0); // Switch to dashboard
        } catch (error) {
          console.error('Error setting parsed project:', error);
        }
      });

      // Note: No cleanup needed - IPC listeners are managed by the main process
    }
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleProjectSelect = (project: Project) => {
    setCurrentProject(project);
    setCurrentTab(0); // Switch to dashboard tab
  };

  const handleProjectUpload = async (file: File) => {
    if (!window.electronAPI) {
      showNotification('Electron API not available', 'error');
      return;
    }

    setLoading(true);
    setIsParsing(true);
    setParseProgress(0);
    setParseMessage('Starting file upload...');

    try {
      // For now, we'll use a mock file path since we can't get the actual file path from File object
      // In a real implementation, you would save the file temporarily or get the path differently
      const mockFilePath = `temp/${file.name}`;

      // Start parsing via electron IPC
      await window.electronAPI.parseFile(mockFilePath);

      // The result will be handled by the IPC event listeners
    } catch (error) {
      console.error('Error uploading file:', error);
      showNotification('Failed to parse file', 'error');
      setIsParsing(false);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (
    message: string,
    severity: 'success' | 'error' | 'warning' | 'info'
  ) => {
    setNotification({ message, severity });
  };

  const handleCloseNotification = () => {
    setNotification(null);
  };

  // Auto-hide parsing success banner after a short delay
  useEffect(() => {
    if (parseSuccessVisible && !isParsing) {
      const timer = setTimeout(() => {
        setParseSuccessVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [parseSuccessVisible, isParsing]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {/* Main App Bar */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            FileMaker DDR Explorer
          </Typography>
          {currentProject && (
            <Typography variant="body2" sx={{ mr: 2 }}>
              {currentProject.name}
            </Typography>
          )}
        </Toolbar>
      </AppBar>

      {/* Main Content Container */}
      <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }} data-testid="main-window">
        {/* Navigation Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={currentTab} onChange={handleTabChange}>
            <Tab
              icon={<DashboardIcon />}
              label="Dashboard"
              {...a11yProps(0)}
              disabled={!currentProject}
            />
            <Tab icon={<FolderOpenIcon />} label="Upload" {...a11yProps(1)} />
            <Tab
              icon={<TableChartIcon />}
              label="Tables"
              {...a11yProps(2)}
              disabled={!currentProject}
            />
            <Tab
              icon={<SearchIcon />}
              label="Search"
              {...a11yProps(3)}
              disabled={!currentProject}
            />
            <Tab
              icon={<AccountTreeIcon />}
              label="Visualize"
              {...a11yProps(4)}
              disabled={!currentProject}
            />
            <Tab
              icon={<DownloadIcon />}
              label="Export"
              {...a11yProps(5)}
              disabled={!currentProject}
            />
          </Tabs>
        </Box>

        {/* Tab Panels */}
        <TabPanel value={currentTab} index={0}>
          <ProjectDashboard
            project={currentProject}
            projects={projects}
            solution={currentSolution}
            onProjectSelect={handleProjectSelect}
            loading={loading}
          />
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <FileUpload onFileUpload={handleProjectUpload} loading={loading} />
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <TablesView projectId={currentProject?.id || null} />
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          <SearchPanel projectId={currentProject?.id || null} onNavigate={setCurrentTab} />
        </TabPanel>

        <TabPanel value={currentTab} index={4}>
          <GraphVisualization projectId={currentProject?.id || null} />
        </TabPanel>

        <TabPanel value={currentTab} index={5}>
          <ExportPanel projectId={currentProject?.id || null} />
        </TabPanel>
      </Container>

      {/* Parsing Progress Dialog */}
      {isParsing && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          data-testid="parsing-progress"
        >
          <Card sx={{ minWidth: 400, p: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom data-testid="parsing-title">
                Processing FileMaker DDR
              </Typography>
              <LinearProgress
                variant="determinate"
                value={parseProgress}
                sx={{ mb: 2 }}
                data-testid="progress-bar"
              />
              <Typography variant="body2" color="text.secondary" data-testid="progress-text">
                {parseMessage} ({parseProgress}%)
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Parsing Complete Message */}
      {parseSuccessVisible && !isParsing && (
        <Alert
          severity="success"
          onClose={() => setParseSuccessVisible(false)}
          sx={{ position: 'fixed', top: 80, right: 20, zIndex: 9999 }}
          data-testid="parsing-complete"
        >
          <Typography data-testid="parsing-success-message">
            File parsing completed successfully!
          </Typography>
          <Typography variant="caption" data-testid="parsing-metrics">
            Processing time: {parseMessage}
          </Typography>
        </Alert>
      )}

      {/* Notification Snackbar */}
      <Snackbar
        open={!!notification}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {notification ? (
          <Alert
            onClose={handleCloseNotification}
            severity={notification.severity}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ThemeProvider>
  );
}