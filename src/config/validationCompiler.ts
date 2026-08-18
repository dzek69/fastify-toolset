import Ajv from "ajv";

import type { ErrorObject, ValidateFunction } from "ajv";
import type { FastifyInstance, FastifySchemaCompiler } from "fastify";

// @TODO review options: https://ajv.js.org/options.html

interface ToolsetSchema {
    [key: string]: unknown;
    /**
     * Marks a schema as describing data coming from the URL (query string, path params), where every value is
     * a string, so types have to be coerced.
     */
    $isUrl?: boolean;
}

/**
 * Ajv 8 error object with fastify 3's `dataPath` added back next to Ajv 8's `instancePath`, so a single validator
 * satisfies fastify 3, 4 and 5 at once.
 */
type CompatErrorObject = ErrorObject & { dataPath: string };

interface CompatValidator {
    (data: unknown): boolean;
    errors?: CompatErrorObject[] | null;
}

const sharedOpts = {
    removeAdditional: false,
    useDefaults: true,
    // `nullable` is not an option anymore - since Ajv 8 the `nullable` keyword is supported out of the box
};

const urlParamsAjv = new Ajv({
    ...sharedOpts,
    coerceTypes: true,
});

const generalAjv = new Ajv({
    ...sharedOpts,
    coerceTypes: false,
});

/**
 * Wraps an Ajv 8 validator so its errors also carry `dataPath`.
 *
 * fastify 3's default schema error formatter reads `error.dataPath` (the Ajv 6 name). Ajv 8 renamed that field to
 * `instancePath`, so without this fastify 3 would build messages with the property path missing.
 *
 * @param validate - compiled Ajv validator
 */
const addDataPath = (validate: ValidateFunction): CompatValidator => {
    const compatValidate: CompatValidator = (data) => {
        const valid = validate(data);
        const errors = (validate.errors ?? null) as CompatErrorObject[] | null;

        if (errors) {
            for (const error of errors) {
                error.dataPath = error.instancePath;
            }
        }
        compatValidate.errors = errors;

        return valid;
    };

    return compatValidate;
};

const theValidationCompiler: FastifySchemaCompiler<ToolsetSchema> = ({ schema }) => {
    // `$isUrl` is our own marker, not a JSON Schema keyword. Ajv 8 runs in strict mode by default and would throw
    // `strict mode: unknown keyword: "$isUrl"`, so it has to be stripped before compiling.
    const { $isUrl, ...cleanSchema } = schema;

    if ($isUrl) {
        return addDataPath(urlParamsAjv.compile(cleanSchema));
    }
    return addDataPath(generalAjv.compile(cleanSchema));
};

/**
 * Sets up a validator compiler that understands the `$isUrl` schema marker.
 *
 * fastify's own Ajv instance is not used at all, so validation behaves identically on fastify 3, 4 and 5.
 *
 * @param app - fastify instance
 */
const validationCompiler = (app: FastifyInstance) => {
    app.setValidatorCompiler(theValidationCompiler);
};

export {
    validationCompiler,
};

export type {
    ToolsetSchema,
};
