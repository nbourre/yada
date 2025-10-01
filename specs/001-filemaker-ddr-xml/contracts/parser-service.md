# Parser Service API Contract

## Parse Project Endpoint

**Endpoint**: `POST /api/parse-project`

**Description**: Parse one or more DDR XML files and create/update project database

### Request Schema
```json
{
  "type": "object",
  "required": ["projectName", "files"],
  "properties": {
    "projectName": {
      "type": "string",
      "minLength": 1,
      "maxLength": 255,
      "description": "User-friendly project name"
    },
    "files": {
      "type": "array",
      "minItems": 1,
      "maxItems": 10,
      "items": {
        "type": "object",
        "required": ["path", "role"],
        "properties": {
          "path": {
            "type": "string",
            "description": "Absolute path to DDR XML file"
          },
          "role": {
            "type": "string",
            "enum": ["ui", "data", "mixed"],
            "description": "FileMaker file type designation"
          }
        }
      }
    },
    "options": {
      "type": "object",
      "properties": {
        "overwriteExisting": {
          "type": "boolean",
          "default": false,
          "description": "Replace existing project with same name"
        },
        "enableProgressUpdates": {
          "type": "boolean", 
          "default": true,
          "description": "Send real-time progress via WebSocket"
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
  "required": ["success", "projectId"],
  "properties": {
    "success": {
      "type": "boolean"
    },
    "projectId": {
      "type": "string",
      "format": "uuid",
      "description": "Generated project identifier"
    },
    "metrics": {
      "type": "object",
      "properties": {
        "parseTimeMs": {
          "type": "number",
          "description": "Total parsing duration"
        },
        "entitiesCreated": {
          "type": "object",
          "additionalProperties": {
            "type": "number"
          },
          "description": "Count by entity type"
        },
        "referencesCreated": {
          "type": "number",
          "description": "Total cross-references extracted"
        },
        "filesProcessed": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "filename": { "type": "string" },
              "sizeBytes": { "type": "number" },
              "parseTimeMs": { "type": "number" },
              "entitiesExtracted": { "type": "number" }
            }
          }
        }
      }
    },
    "warnings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "enum": ["malformed_xml", "missing_references", "encoding_issue", "version_mismatch"]
          },
          "message": { "type": "string" },
          "filename": { "type": "string" },
          "lineNumber": { "type": "number" }
        }
      }
    }
  }
}
```

### Error Response Schema
```json
{
  "type": "object",
  "required": ["success", "error"],
  "properties": {
    "success": {
      "type": "boolean",
      "const": false
    },
    "error": {
      "type": "object",
      "required": ["code", "message"],
      "properties": {
        "code": {
          "type": "string",
          "enum": [
            "FILE_NOT_FOUND",
            "INVALID_XML",
            "PARSING_ERROR", 
            "DATABASE_ERROR",
            "PROJECT_EXISTS",
            "INSUFFICIENT_PERMISSIONS"
          ]
        },
        "message": {
          "type": "string",
          "description": "Human-readable error description"
        },
        "details": {
          "type": "object",
          "description": "Additional error context"
        }
      }
    }
  }
}
```

## Parse Progress Events (WebSocket)

**Event**: `parse-progress`

```json
{
  "type": "object",
  "required": ["projectId", "phase", "progress"],
  "properties": {
    "projectId": { "type": "string", "format": "uuid" },
    "phase": {
      "type": "string",
      "enum": ["validating", "parsing", "analyzing", "indexing", "complete"]
    },
    "progress": {
      "type": "object",
      "required": ["current", "total"],
      "properties": {
        "current": { "type": "number" },
        "total": { "type": "number" },
        "percentage": { "type": "number", "minimum": 0, "maximum": 100 },
        "message": { "type": "string" },
        "filename": { "type": "string" }
      }
    },
    "metrics": {
      "type": "object",
      "properties": {
        "entitiesProcessed": { "type": "number" },
        "referencesFound": { "type": "number" },
        "currentFileSize": { "type": "number" },
        "estimatedTimeRemaining": { "type": "number" }
      }
    }
  }
}
```