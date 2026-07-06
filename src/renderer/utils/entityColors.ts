import { EntityType } from '../../models';

export const ENTITY_TYPE_COLOR: Record<EntityType, string> = {
  table: '#1976d2',
  field: '#388e3c',
  layout: '#f57c00',
  script: '#7b1fa2',
  relationship: '#c62828',
  custom_function: '#00838f',
  privilege: '#455a64',
};

export const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  table: 'Table',
  field: 'Champ',
  layout: 'Layout',
  script: 'Script',
  relationship: 'Relation',
  custom_function: 'Fonction personnalisée',
  privilege: 'Privilège',
};
