/**
 * File Upload Component
 * Handles FileMaker DDR XML file uploads with drag & drop
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip,
} from '@mui/material';
import CloudUpload from '@mui/icons-material/CloudUpload';
import InsertDriveFile from '@mui/icons-material/InsertDriveFile';
import DeleteIcon from '@mui/icons-material/Delete';

interface FileUploadProps {
  onFileUpload: (file: File) => Promise<void>;
  loading: boolean;
}

interface UploadedFile {
  file: File;
  id: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, loading }) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    if (!file.name.toLowerCase().endsWith('.xml')) {
      return 'Please select an XML file';
    }
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return 'La taille du fichier doit être inférieure à 100MB';
    }
    return null;
  };

  /** Lit un File en ArrayBuffer et retourne le base64 correspondant */
  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => {
        const ab = e.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(ab);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        res(btoa(binary));
      };
      reader.onerror = () => rej(new Error(`Failed to read ${file.name}`));
      reader.readAsArrayBuffer(file);
    });

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      const newFiles: UploadedFile[] = [];
      const errors: string[] = [];

      Array.from(files).forEach(file => {
        const validationError = validateFile(file);
        if (validationError) {
          errors.push(`${file.name}: ${validationError}`);
        } else {
          newFiles.push({
            file,
            id: `${file.name}-${Date.now()}`,
          });
        }
      });

      if (errors.length > 0) {
        setError(errors.join(', '));
      } else {
        setError(null);
        setSelectedFiles([...selectedFiles, ...newFiles]);
      }
    },
    [selectedFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset input value so same file can be selected again
    e.target.value = '';
  };

  const removeFile = (id: string) => {
    setSelectedFiles(selectedFiles.filter(f => f.id !== id));
  };

  const uploadFile = async (uploadedFile: UploadedFile) => {
    try {
      if (window.electronAPI) {
        // In Electron, File objects expose the real disk path via .path
        const originalPath: string | undefined = (uploadedFile.file as any).path;

        // Read as binary to detect Summary and for DDR temp-file transfer
        const base64 = await readFileAsBase64(uploadedFile.file);
        const isSummary = await window.electronAPI.isSummaryFile(base64);

        if (isSummary) {
          // For Summary.xml we MUST use the original path so relative links resolve correctly
          if (!originalPath) {
            setError('Could not determine file path. Please use the Browse button instead of drag & drop.');
            return;
          }
          console.log('Detected Summary.xml — launching full solution parse:', originalPath);
          const solution = await window.electronAPI.parseSolution(originalPath);
          console.log('Solution parsed:', solution);
        } else {
          // For individual DDR files, write to temp (server needs access)
          const tempPath = await window.electronAPI.writeTempFile(
            `temp_${Date.now()}_${uploadedFile.file.name}`,
            base64
          );
          console.log('Temp file written:', tempPath);
          const result = await window.electronAPI.parseFile(tempPath);
          console.log('Parse result:', result);
        }

        setSelectedFiles(prev => prev.filter(f => f.id !== uploadedFile.id));
      } else {
        await onFileUpload(uploadedFile.file);
        setSelectedFiles(prev => prev.filter(f => f.id !== uploadedFile.id));
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(`Upload failed for ${uploadedFile.file.name}: ${error}`);
    }
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

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Import FileMaker DDR Files
      </Typography>

      <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
        Upload a <strong>Summary.xml</strong> to import the full solution at once,
        or a single DDR file (<strong>.xml</strong>).
      </Typography>

      {/* Drag & Drop Area */}
      <Card
        sx={{
          mb: 3,
          border: dragOver ? 2 : 1,
          borderColor: dragOver ? 'primary.main' : 'divider',
          borderStyle: 'dashed',
          bgcolor: dragOver ? 'action.hover' : 'background.paper',
          transition: 'all 0.2s ease-in-out',
        }}
      >
        <CardContent>
          <Box
            data-testid="file-drop-zone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            sx={{
              textAlign: 'center',
              py: 4,
              cursor: 'pointer',
            }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <CloudUpload
              sx={{
                fontSize: 64,
                color: dragOver ? 'primary.main' : 'text.secondary',
                mb: 2,
              }}
            />
            <Typography variant="h6" gutterBottom>
              {dragOver ? 'Drop here' : 'Drag & drop an XML file here'}
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Summary.xml (full solution) or individual DDR file — or click to browse
            </Typography>
            <Button
              variant="outlined"
              component="span"
              startIcon={<InsertDriveFile />}
              data-testid="add-files-button"
            >
              Browse Files
            </Button>
            <input
              id="file-input"
              type="file"
              accept=".xml"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Loading Progress */}
      {loading && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Processing file...
          </Typography>
          <LinearProgress />
        </Box>
      )}

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Selected Files ({selectedFiles.length})
            </Typography>
            <List>
              {selectedFiles.map(uploadedFile => (
                <ListItem
                  key={uploadedFile.id}
                  data-testid="file-list-item"
                  secondaryAction={
                    <Box>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => uploadFile(uploadedFile)}
                        disabled={loading}
                        sx={{ mr: 1 }}
                        data-testid="parse-files-button"
                      >
                        Upload
                      </Button>
                      <IconButton
                        edge="end"
                        onClick={() => removeFile(uploadedFile.id)}
                        disabled={loading}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={uploadedFile.file.name}
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Chip
                          label={formatFileSize(uploadedFile.file.size)}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <Chip
                          label={uploadedFile.file.type || 'XML'}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Upload Guidelines */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            File Requirements
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="• Summary.xml — imports all files in the solution in one operation" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Individual DDR file (.xml) — imports a single .fmp12 file" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Maximum file size: 100MB" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Generated via FileMaker Pro: File > Manage > Database > DDR" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Supported encodings: UTF-16 LE (FileMaker default) and UTF-8" />
            </ListItem>
          </List>
        </CardContent>
      </Card>
    </Box>
  );
};

export default FileUpload;
