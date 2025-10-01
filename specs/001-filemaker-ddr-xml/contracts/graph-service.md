# Graph Service API Contract

## Generate Graph Data Endpoint

**Endpoint**: `POST /api/graph/generate`

**Description**: Generate graph visualization data for entity relationships

### Request Schema
```json
{
  "type": "object",
  "required": ["projectId", "rootEntities"],
  "properties": {
    "projectId": {
      "type": "string",
      "format": "uuid",
      "description": "Target project identifier"
    },
    "rootEntities": {
      "type": "array",
      "minItems": 1,
      "maxItems": 50,
      "items": {
        "type": "string",
        "format": "uuid"
      },
      "description": "Starting entity IDs for graph traversal"
    },
    "options": {
      "type": "object",
      "properties": {
        "maxDepth": {
          "type": "number",
          "minimum": 1,
          "maximum": 10,
          "default": 3,
          "description": "Maximum relationship traversal depth"
        },
        "maxNodes": {
          "type": "number",
          "minimum": 10,
          "maximum": 5000,
          "default": 500,
          "description": "Maximum nodes to include in graph"
        },
        "includeEntityTypes": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["table", "field", "layout", "script", "relationship", "value_list", "custom_function", "privilege_set", "account", "base_table"]
          },
          "description": "Filter included entity types"
        },
        "excludeEntityTypes": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Exclude specific entity types"
        },
        "includeReferenceTypes": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["field_reference", "table_reference", "script_call", "layout_reference", "calculation_dependency", "relationship_dependency", "value_list_reference"]
          },
          "description": "Filter included reference types"
        },
        "layout": {
          "type": "string",
          "enum": ["hierarchical", "force_directed", "circular", "grid"],
          "default": "force_directed",
          "description": "Graph layout algorithm"
        },
        "clustering": {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true
            },
            "method": {
              "type": "string",
              "enum": ["entity_type", "filename", "module", "none"],
              "default": "entity_type"
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
  "required": ["success", "graph"],
  "properties": {
    "success": {
      "type": "boolean"
    },
    "graph": {
      "type": "object",
      "required": ["nodes", "edges", "metadata"],
      "properties": {
        "nodes": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["id", "label", "type"],
            "properties": {
              "id": {
                "type": "string",
                "format": "uuid"
              },
              "label": {
                "type": "string",
                "description": "Display name for node"
              },
              "type": {
                "type": "string",
                "description": "Entity type for styling"
              },
              "filename": {
                "type": "string"
              },
              "size": {
                "type": "number",
                "description": "Visual node size (based on connection count)"
              },
              "color": {
                "type": "string",
                "description": "Hex color for node styling"
              },
              "cluster": {
                "type": "string",
                "description": "Cluster group identifier"
              },
              "properties": {
                "type": "object",
                "description": "Additional node data for tooltips"
              },
              "position": {
                "type": "object",
                "properties": {
                  "x": { "type": "number" },
                  "y": { "type": "number" }
                },
                "description": "Pre-calculated layout position (optional)"
              }
            }
          }
        },
        "edges": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["id", "source", "target", "type"],
            "properties": {
              "id": {
                "type": "string",
                "description": "Unique edge identifier"
              },
              "source": {
                "type": "string",
                "format": "uuid",
                "description": "Source node ID"
              },
              "target": {
                "type": "string", 
                "format": "uuid",
                "description": "Target node ID"
              },
              "type": {
                "type": "string",
                "description": "Reference type for styling"
              },
              "weight": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "description": "Edge strength/importance"
              },
              "label": {
                "type": "string",
                "description": "Edge label for display"
              },
              "color": {
                "type": "string",
                "description": "Hex color for edge styling"
              },
              "properties": {
                "type": "object",
                "description": "Additional edge data"
              }
            }
          }
        },
        "metadata": {
          "type": "object",
          "required": ["generationTimeMs", "nodeCount", "edgeCount"],
          "properties": {
            "generationTimeMs": {
              "type": "number",
              "description": "Graph generation time"
            },
            "nodeCount": {
              "type": "number"
            },
            "edgeCount": {
              "type": "number"
            },
            "clusters": {
              "type": "object",
              "additionalProperties": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "nodeCount": { "type": "number" },
                  "color": { "type": "string" }
                }
              },
              "description": "Cluster definitions"
            },
            "layout": {
              "type": "object",
              "properties": {
                "algorithm": { "type": "string" },
                "bounds": {
                  "type": "object",
                  "properties": {
                    "minX": { "type": "number" },
                    "maxX": { "type": "number" },
                    "minY": { "type": "number" },
                    "maxY": { "type": "number" }
                  }
                }
              }
            },
            "statistics": {
              "type": "object",
              "properties": {
                "maxDepthReached": { "type": "number" },
                "nodeTypeDistribution": {
                  "type": "object",
                  "additionalProperties": { "type": "number" }
                },
                "edgeTypeDistribution": {
                  "type": "object", 
                  "additionalProperties": { "type": "number" }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## Graph Layout Update Endpoint

**Endpoint**: `POST /api/graph/layout`

**Description**: Apply different layout algorithm to existing graph data

### Request Schema
```json
{
  "type": "object",
  "required": ["graphData", "layout"],
  "properties": {
    "graphData": {
      "type": "object",
      "description": "Existing graph nodes/edges data"
    },
    "layout": {
      "type": "string",
      "enum": ["hierarchical", "force_directed", "circular", "grid", "dagre"]
    },
    "options": {
      "type": "object",
      "properties": {
        "animate": {
          "type": "boolean",
          "default": true
        },
        "fit": {
          "type": "boolean", 
          "default": true,
          "description": "Fit graph to viewport"
        },
        "padding": {
          "type": "number",
          "default": 50
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
  "required": ["success", "positions"],
  "properties": {
    "success": {
      "type": "boolean"
    },
    "positions": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "x": { "type": "number" },
          "y": { "type": "number" }
        }
      },
      "description": "Node ID to position mapping"
    },
    "bounds": {
      "type": "object",
      "properties": {
        "minX": { "type": "number" },
        "maxX": { "type": "number" },
        "minY": { "type": "number" },
        "maxY": { "type": "number" }
      }
    },
    "layoutTimeMs": {
      "type": "number"
    }
  }
}
```