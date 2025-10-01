# Export Service API Contract

## Export Project Data Endpoint

**Endpoint**: `POST /api/export`

**Description**: Export project data in various formats with filtering options

### Request Schema
```json
{
  "type": "object",
  "required": ["projectId", "format"],
  "properties": {
    "projectId": {
      "type": "string",
      "format": "uuid",
      "description": "Target project identifier"
    },
    "format": {
      "type": "string",
      "enum": ["json", "csv", "excel", "html_report", "markdown"],
      "description": "Export format"
    },
    "filters": {
      "type": "object",
      "properties": {
        "entityTypes": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["table", "field", "layout", "script", "relationship", "value_list", "custom_function", "privilege_set", "account", "base_table"]
          },
          "description": "Include only specified entity types"
        },
        "filenames": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Include entities from specific files"
        },
        "entityIds": {
          "type": "array",
          "items": {
            "type": "string",
            "format": "uuid"
          },
          "description": "Include specific entities by ID"
        },
        "includeReferences": {
          "type": "boolean",
          "default": true,
          "description": "Include relationship data"
        },
        "includeProperties": {
          "type": "boolean",
          "default": true,
          "description": "Include entity-specific properties"
        }
      }
    },
    "options": {
      "type": "object",
      "properties": {
        "filename": {
          "type": "string",
          "description": "Custom export filename (without extension)"
        },
        "compression": {
          "type": "string",
          "enum": ["none", "zip", "gzip"],
          "default": "none"
        },
        "includeMetadata": {
          "type": "boolean",
          "default": true,
          "description": "Include export metadata header"
        },
        "maxRecords": {
          "type": "number",
          "minimum": 1,
          "maximum": 1000000,
          "description": "Limit number of exported records"
        }
      }
    },
    "formatOptions": {
      "type": "object",
      "description": "Format-specific configuration",
      "properties": {
        "csv": {
          "type": "object",
          "properties": {
            "delimiter": {
              "type": "string",
              "enum": [",", ";", "\t", "|"],
              "default": ","
            },
            "includeHeaders": {
              "type": "boolean",
              "default": true
            },
            "encoding": {
              "type": "string",
              "enum": ["utf-8", "utf-16", "ascii"],
              "default": "utf-8"
            }
          }
        },
        "excel": {
          "type": "object",
          "properties": {
            "separateSheets": {
              "type": "boolean",
              "default": true,
              "description": "Create separate sheets for each entity type"
            },
            "includeFormatting": {
              "type": "boolean",
              "default": true
            },
            "freezeHeaders": {
              "type": "boolean",
              "default": true
            }
          }
        },
        "html_report": {
          "type": "object",
          "properties": {
            "theme": {
              "type": "string",
              "enum": ["default", "minimal", "detailed"],
              "default": "default"
            },
            "includeGraphs": {
              "type": "boolean",
              "default": true,
              "description": "Embed interactive graphs"
            },
            "includeStatistics": {
              "type": "boolean",
              "default": true
            }
          }
        },
        "json": {
          "type": "object",
          "properties": {
            "pretty": {
              "type": "boolean",
              "default": true,
              "description": "Format JSON with indentation"
            },
            "includeSchema": {
              "type": "boolean",
              "default": false,
              "description": "Include JSON schema definition"
            }
          }
        }
      }
    }
  }
}
```

### Response Schema
```json
{
  "type": "object",
  "required": ["success", "exportId"],
  "properties": {
    "success": {
      "type": "boolean"
    },
    "exportId": {
      "type": "string",
      "format": "uuid",
      "description": "Unique export job identifier"
    },
    "downloadUrl": {
      "type": "string",
      "format": "uri",
      "description": "URL to download exported file"
    },
    "metadata": {
      "type": "object",
      "required": ["filename", "fileSizeBytes", "exportTimeMs"],
      "properties": {
        "filename": {
          "type": "string",
          "description": "Generated filename with extension"
        },
        "fileSizeBytes": {
          "type": "number",
          "description": "Export file size"
        },
        "exportTimeMs": {
          "type": "number",
          "description": "Export processing time"
        },
        "recordCount": {
          "type": "number",
          "description": "Number of exported records"
        },
        "format": {
          "type": "string",
          "description": "Export format used"
        },
        "compression": {
          "type": "string",
          "description": "Compression method used"
        },
        "expiresAt": {
          "type": "string",
          "format": "date-time",
          "description": "Download URL expiration"
        }
      }
    },
    "statistics": {
      "type": "object",
      "properties": {
        "entityCounts": {
          "type": "object",
          "additionalProperties": {
            "type": "number"
          },
          "description": "Count by entity type"
        },
        "referenceCounts": {
          "type": "object",
          "additionalProperties": {
            "type": "number"
          },
          "description": "Count by reference type"
        },
        "fileCounts": {
          "type": "object",
          "additionalProperties": {
            "type": "number"
          },
          "description": "Count by source filename"
        }
      }
    }
  }
}
```

## Export Status Endpoint

**Endpoint**: `GET /api/export/{exportId}/status`

**Description**: Check status of long-running export job

### Path Parameters
- `exportId` (string, uuid): Export job identifier

### Response Schema
```json
{
  "type": "object",
  "required": ["success", "status"],
  "properties": {
    "success": {
      "type": "boolean"
    },
    "status": {
      "type": "string",
      "enum": ["queued", "processing", "completed", "failed", "expired"]
    },
    "progress": {
      "type": "object",
      "properties": {
        "current": { "type": "number" },
        "total": { "type": "number" },
        "percentage": { "type": "number" },
        "phase": {
          "type": "string",
          "enum": ["filtering", "transforming", "formatting", "compressing", "uploading"]
        },
        "message": { "type": "string" }
      }
    },
    "downloadUrl": {
      "type": "string",
      "format": "uri",
      "description": "Available when status is completed"
    },
    "error": {
      "type": "object",
      "properties": {
        "code": { "type": "string" },
        "message": { "type": "string" },
        "details": { "type": "object" }
      },
      "description": "Present when status is failed"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time"
    },
    "completedAt": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

## Download Export File Endpoint

**Endpoint**: `GET /api/export/{exportId}/download`

**Description**: Download completed export file

### Path Parameters
- `exportId` (string, uuid): Export job identifier

### Response
- **Content-Type**: Varies by export format
- **Content-Disposition**: attachment; filename="..."
- **Content-Length**: File size in bytes

### Error Responses
- `404 Not Found`: Export ID not found or expired
- `410 Gone`: Export file has been cleaned up
- `425 Too Early`: Export still processing