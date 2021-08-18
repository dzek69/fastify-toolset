import Ajv from "ajv";
import type { FastifyInstance } from "fastify";

// @TODO review options: https://ajv.js.org/options.html

const sharedOpts = {
    removeAdditional: false,
    useDefaults: true,
    nullable: true,
};

const urlParamsAjv = new Ajv({
    ...sharedOpts,
    coerceTypes: true,
});

const generalAjv = new Ajv({
    ...sharedOpts,
    coerceTypes: false,
});

const theValidationCompiler = ({ schema }: { schema: { $isUrl?: boolean }}) => {
    if (schema.$isUrl) {
        return urlParamsAjv.compile(schema);
    }
    return generalAjv.compile(schema);
};

const validationCompiler = (app: FastifyInstance) => {
    app.setValidatorCompiler(theValidationCompiler);
};

export {
    validationCompiler,
};
