# Search Service API Contract

## Global Search Endpoint

**Endpoint**: `POST /api/search`

**Description**: Perform full-text search across all project entities with faceted filtering

### Request Schema
```json
{
  "type": "object",
  "required": ["projectId", "query"],
  "properties": {
    "projectId": {
      "type": "string",
      "format": "uuid",
      "description": "Target project identifier"
    },
    "query": {
      "type": "string",
      "minLength": 1,
      "maxLength": 500,
      "description": "Search query text (supports FTS5 syntax)"
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
          "description": "Filter by entity types"
        },
        "filenames": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Filter by source filenames"
        },
        "tags": {
          "type": "array", 
          "items": { "type": "string" },
          "description": "Filter by entity tags"
        }
      }
    },
    "pagination": {
      "type": "object",
      "properties": {
        "offset": {
          "type": "number",
          "minimum": 0,
          "default": 0
        },
        "limit": {
          "type": "number",
          "minimum": 1,
          "maximum": 1000,
          "default": 50
        }
      }
    },
    "sorting": {
      "type": "object",
      "properties": {
        "field": {
          "type": "string",
          "enum": ["relevance", "name", "entity_type", "filename", "created_at"],
          "default": "relevance"
        },
        "direction": {
          "type": "string",
          "enum": ["asc", "desc"],
          "default": "desc"
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
  "required": ["success", "results", "metadata"],
  "properties": {
    "success": {
      "type": "boolean"
    },
    "results": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "entityType", "filename", "relevanceScore"],
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "name": {
            "type": "string"
          },
          "entityType": {
            "type": "string"
          },
          "filename": {
            "type": "string"
          },
          "relevanceScore": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "snippet": {
            "type": "string",
            "description": "Highlighted text snippet showing match context"
          },
          "properties": {
            "type": "object",
            "description": "Entity-specific properties"
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
      "required": ["totalCount", "searchTimeMs"],
      "properties": {
        "totalCount": {
          "type": "number",
          "description": "Total matching results (across all pages)"
        },
        "searchTimeMs": {
          "type": "number",
          "description": "Query execution time"
        },
        "facets": {
          "type": "object",
          "properties": {
            "entityTypes": {
              "type": "object",
              "additionalProperties": {
                "type": "number"
              },
              "description": "Count of results by entity type"
            },
            "filenames": {
              "type": "object", 
              "additionalProperties": {
                "type": "number"
              },
              "description": "Count of results by filename"
            }
          }
        },
        "hasNextPage": {
          "type": "boolean"
        },
        "hasPreviousPage": {
          "type": "boolean"
        }
      }
    }
  }
}
```

## Entity Details Endpoint

**Endpoint**: `GET /api/entities/{entityId}`

**Description**: Retrieve detailed information about a specific entity

### Path Parameters
- `entityId` (string, uuid): Entity identifier

### Query Parameters
- `includeReferences` (boolean, default: true): Include incoming/outgoing references
- `includeProperties` (boolean, default: true): Include entity-specific properties

### Response Schema
```json
{
  "type": "object",
  "required": ["success", "entity"],
  "properties": {
    "success": {
      "type": "boolean"
    },
    "entity": {
      "type": "object",
      "required": ["id", "name", "entityType", "filename"],
      "properties": {
        "id": { "type": "string", "format": "uuid" },
        "name": { "type": "string" },
        "entityType": { "type": "string" },
        "filename": { "type": "string" },
        "description": { "type": "string" },
        "properties": { "type": "object" },
        "tags": {
          "type": "array",
          "items": { "type": "string" }
        },
        "references": {
          "type": "object",
          "properties": {
            "incoming": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "fromEntityId": { "type": "string" },
                  "fromEntityName": { "type": "string" },
                  "fromEntityType": { "type": "string" },
                  "referenceType": { "type": "string" },
                  "context": { "type": "string" }
                }
              }
            },
            "outgoing": {
              "type": "array",
              "items": {
                "type": "object", 
                "properties": {
                  "toEntityId": { "type": "string" },
                  "toEntityName": { "type": "string" },
                  "toEntityType": { "type": "string" },
                  "referenceType": { "type": "string" },
                  "context": { "type": "string" }
                }
              }
            }
          }
        },
        "createdAt": { "type": "string", "format": "date-time" },
        "updatedAt": { "type": "string", "format": "date-time" }
      }
    }
  }
}
```