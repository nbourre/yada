# Project Management Service API Contract

## List Projects Endpoint

**Endpoint**: `GET /api/projects`

**Description**: Retrieve list of all parsed projects with metadata

### Query Parameters
- `sortBy` (string, optional): Sort field (name, created_at, updated_at, file_count)
- `sortOrder` (string, optional): Sort direction (asc, desc) 
- `search` (string, optional): Filter by project name
- `limit` (number, optional): Maximum results to return (1-100)
- `offset` (number, optional): Pagination offset

### Response Schema
```json
{
  "type": "object",
  "required": ["success", "projects", "metadata"],
  "properties": {
    "success": {
      "type": "boolean"
    },
    "projects": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "createdAt", "updatedAt"],
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "name": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string", 
            "format": "date-time"
          },
          "statistics": {
            "type": "object",
            "properties": {
              "fileCount": { "type": "number" },
              "entityCount": { "type": "number" },
              "referenceCount": { "type": "number" },
              "entityTypes": {
                "type": "object",
                "additionalProperties": { "type": "number" }
              }
            }
          },
          "tags": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    },
    "metadata": {
      "type": "object",
      "required": ["totalCount"],
      "properties": {
        "totalCount": { "type": "number" },
        "hasNextPage": { "type": "boolean" },
        "hasPreviousPage": { "type": "boolean" }
      }
    }
  }
}
```

## Get Project Details Endpoint

**Endpoint**: `GET /api/projects/{projectId}`

**Description**: Retrieve detailed information about a specific project

### Path Parameters
- `projectId` (string, uuid): Project identifier

### Response Schema
```json
{
  "type": "object",
  "required": ["success", "project"],
  "properties": {
    "success": {
      "type": "boolean"
    },
    "project": {
      "type": "object",
      "required": ["id", "name", "createdAt", "updatedAt"],
      "properties": {
        "id": { "type": "string", "format": "uuid" },
        "name": { "type": "string" },
        "description": { "type": "string" },
        "createdAt": { "type": "string", "format": "date-time" },
        "updatedAt": { "type": "string", "format": "date-time" },
        "files": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "filename": { "type": "string" },
              "filepath": { "type": "string" },
              "role": {
                "type": "string",
                "enum": ["ui", "data", "mixed"]
              },
              "fileSizeBytes": { "type": "number" },
              "parseTimeMs": { "type": "number" },
              "entityCount": { "type": "number" },
              "lastModified": { "type": "string", "format": "date-time" }
            }
          }
        },
        "statistics": {
          "type": "object",
          "properties": {
            "totalEntities": { "type": "number" },
            "totalReferences": { "type": "number" },
            "entityBreakdown": {
              "type": "object",
              "additionalProperties": { "type": "number" }
            },
            "referenceBreakdown": {
              "type": "object",
              "additionalProperties": { "type": "number" }
            },
            "complexity": {
              "type": "object",
              "properties": {
                "averageReferencesPerEntity": { "type": "number" },
                "maxDepth": { "type": "number" },
                "circularReferences": { "type": "number" }
              }
            }
          }
        },
        "tags": {
          "type": "array",
          "items": { "type": "string" }
        },
        "snapshots": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string", "format": "uuid" },
              "name": { "type": "string" },
              "createdAt": { "type": "string", "format": "date-time" },
              "description": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

## Create Project Snapshot Endpoint

**Endpoint**: `POST /api/projects/{projectId}/snapshots`

**Description**: Create a snapshot of current project state for comparison

### Path Parameters
- `projectId` (string, uuid): Project identifier

### Request Schema
```json
{
  "type": "object",
  "required": ["name"],
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100
    },
    "description": {
      "type": "string",
      "maxLength": 500
    }
  }
}
```

### Response Schema
```json
{
  "type": "object",
  "required": ["success", "snapshot"],
  "properties": {
    "success": {
      "type": "boolean"
    },
    "snapshot": {
      "type": "object",
      "required": ["id", "name", "createdAt"],
      "properties": {
        "id": { "type": "string", "format": "uuid" },
        "name": { "type": "string" },
        "description": { "type": "string" },
        "createdAt": { "type": "string", "format": "date-time" },
        "statistics": {
          "type": "object",
          "properties": {
            "entityCount": { "type": "number" },
            "referenceCount": { "type": "number" }
          }
        }
      }
    }
  }
}
```

## Compare Project Snapshots Endpoint

**Endpoint**: `POST /api/projects/{projectId}/compare`

**Description**: Compare two project states (snapshots or current state)

### Path Parameters
- `projectId` (string, uuid): Project identifier

### Request Schema
```json
{
  "type": "object",
  "required": ["baseSnapshot", "compareSnapshot"],
  "properties": {
    "baseSnapshot": {
      "type": "string",
      "format": "uuid",
      "description": "Base snapshot ID (use 'current' for current state)"
    },
    "compareSnapshot": {
      "type": "string", 
      "format": "uuid",
      "description": "Compare snapshot ID (use 'current' for current state)"
    },
    "options": {
      "type": "object",
      "properties": {
        "includeEntityTypes": {
          "type": "array",
          "items": { "type": "string" }
        },
        "excludeEntityTypes": {
          "type": "array",
          "items": { "type": "string" }
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
  "required": ["success", "comparison"],
  "properties": {
    "success": {
      "type": "boolean"
    },
    "comparison": {
      "type": "object",
      "required": ["summary", "changes"],
      "properties": {
        "summary": {
          "type": "object",
          "properties": {
            "entitiesAdded": { "type": "number" },
            "entitiesRemoved": { "type": "number" },
            "entitiesModified": { "type": "number" },
            "referencesAdded": { "type": "number" },
            "referencesRemoved": { "type": "number" }
          }
        },
        "changes": {
          "type": "object",
          "properties": {
            "added": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": { "type": "string" },
                  "name": { "type": "string" },
                  "entityType": { "type": "string" },
                  "filename": { "type": "string" }
                }
              }
            },
            "removed": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": { "type": "string" },
                  "name": { "type": "string" },
                  "entityType": { "type": "string" },
                  "filename": { "type": "string" }
                }
              }
            },
            "modified": {
              "type": "array", 
              "items": {
                "type": "object",
                "properties": {
                  "id": { "type": "string" },
                  "name": { "type": "string" },
                  "entityType": { "type": "string" },
                  "filename": { "type": "string" },
                  "changes": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "field": { "type": "string" },
                        "oldValue": { "type": "string" },
                        "newValue": { "type": "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "generatedAt": { "type": "string", "format": "date-time" }
      }
    }
  }
}
```

## Delete Project Endpoint

**Endpoint**: `DELETE /api/projects/{projectId}`

**Description**: Delete a project and all associated data

### Path Parameters
- `projectId` (string, uuid): Project identifier

### Query Parameters
- `deleteSnapshots` (boolean, default: true): Also delete all snapshots

### Response Schema
```json
{
  "type": "object",
  "required": ["success"],
  "properties": {
    "success": {
      "type": "boolean"
    },
    "deletedAt": {
      "type": "string",
      "format": "date-time"
    },
    "statistics": {
      "type": "object",
      "properties": {
        "entitiesDeleted": { "type": "number" },
        "referencesDeleted": { "type": "number" },
        "snapshotsDeleted": { "type": "number" }
      }
    }
  }
}
```