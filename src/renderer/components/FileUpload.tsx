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
    // Check file extension
    if (!file.name.toLowerCase().endsWith('.xml')) {
      return 'Please select an XML file';
    }

    // Check file size (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return 'File size must be less than 100MB';
    }

    return null;
  };

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
      // If electron API is available, use it to save and parse the file
      if (window.electronAPI) {
        // Read file as binary (ArrayBuffer) to preserve encoding (UTF-16 LE BOM, etc.)
        const reader = new FileReader();
        reader.onload = async e => {
          try {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            // Convert to base64 to safely transfer binary data through IPC
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);

            // Write binary content to a temp file via Electron API
            const tempPath = await window.electronAPI.writeTempFile(
              `temp_${Date.now()}_${uploadedFile.file.name}`,
              base64
            );

            console.log('Temp file written:', tempPath);

            // Call the electron API to parse the file
            const result = await window.electronAPI.parseFile(tempPath);
            console.log('Parse result:', result);

            // Remove uploaded file from the list after successful parsing starts
            setSelectedFiles(selectedFiles.filter(f => f.id !== uploadedFile.id));
          } catch (error) {
            console.error('Parse error:', error);
            setError(`Failed to parse ${uploadedFile.file.name}: ${error}`);
          }
        };

        reader.onerror = () => {
          setError(`Failed to read file: ${uploadedFile.file.name}`);
        };

        reader.readAsArrayBuffer(uploadedFile.file);
      } else {
        // Fallback to direct file upload
        await onFileUpload(uploadedFile.file);
        setSelectedFiles(selectedFiles.filter(f => f.id !== uploadedFile.id));
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(`Upload failed: ${error}`);
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
        Upload FileMaker DDR Files
      </Typography>

      <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
        Upload FileMaker Database Design Report (DDR) XML files to analyze your database structure.
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
              {dragOver ? 'Drop files here' : 'Drag & drop XML files here'}
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              or click to browse files
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
              <ListItemText primary="• XML files only (.xml extension)" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Maximum file size: 100MB" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Generated by FileMaker Pro's Database Design Report (DDR)" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Files should contain complete database schema information" />
            </ListItem>
          </List>
        </CardContent>
      </Card>
    </Box>
  );
};

export default FileUpload;
