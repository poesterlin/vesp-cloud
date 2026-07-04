import Ajv from 'ajv';
import schema from '@vesp-cloud/schema/schema';

interface JsonSchema {
  definitions?: Record<string, unknown>;
}

export interface ProjectSchemaValidationResult {
  valid: boolean;
  errors: string[];
}

const projectSchema = schema as JsonSchema;

const ajv = new Ajv({
  allErrors: true,
  strict: false,
});

const validateProjectSchemaCompiled = ajv.compile({
  $ref: '#/definitions/Project',
  definitions: projectSchema.definitions,
});

export function validateProjectSchema(project: unknown): ProjectSchemaValidationResult {
  if (validateProjectSchemaCompiled(project)) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: (validateProjectSchemaCompiled.errors ?? []).map((error) => {
      const path = error.instancePath || '/';
      return `${path} ${error.message ?? 'is invalid'}`;
    }),
  };
}
