import { StatusCodes } from "http-status-codes";

import type { FastifyInstance } from "fastify";
import type { CustomError } from "@ezez/errors";
import type { ErrorShape } from "../errors/errors.js";

import { errors, errorToCodeMap } from "../errors/errors.js";

interface ErrorHandlerInstanceDecorator {
    $errors: typeof errors;
}

type Handler = Parameters<FastifyInstance["setErrorHandler"]>[0];

interface ErrorResponse {
    error: true;
    errorDetails: null | { [key: string]: unknown };
    errorCode: string;
    errorMessage: string;
    errorMessageRaw?: string;
}

type ValidationError = {
    code?: string;
    validation?: unknown[];
    validationContext?: string;
} & Error;

/**
 * Detects fastify's own schema validation errors.
 *
 * fastify 3 only decorates the error with `validation` + `validationContext`, fastify 4 and 5 additionally set
 * a stable `code`, so all three are checked to stay version-agnostic.
 */
const isValidationError = (error: ValidationError) => {
    return error.code === "FST_ERR_VALIDATION"
        || Array.isArray(error.validation)
        || Boolean(error.validationContext);
};

// eslint-disable-next-line max-statements
const handler: Handler = (error, request, reply) => {
    const e = error as CustomError<ErrorShape>;
    const response: ErrorResponse = {
        error: true,
        errorCode: "ERR_UNKNOWN_ERROR",
        errorMessage: "<No message>",
        errorDetails: null,
    };

    console.error("Handling error", error);

    // @TODO pass original error somewhere for better logging purposes

    reply.status(StatusCodes.INTERNAL_SERVER_ERROR); // eslint-disable-line @typescript-eslint/no-floating-promises

    const copyDetails = process.env.NODE_ENV === "development";

    if (error instanceof Error) {
        let knownError = false;
        for (const err of errorToCodeMap.keys()) {
            if (!(error instanceof err)) {
                continue;
            }

            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            reply.status(errorToCodeMap.get(err)!.status);
            response.errorCode = errorToCodeMap.get(err)!.code;
            // if it's a known custom error we can safely assume no private data is in the message
            // because all the important stuff will be hidden in the details
            // for other Error instances we can't do that
            if (e.message) {
                response.errorMessage = e.message;
            }

            knownError = true;
        }

        if (!knownError && isValidationError(error)) {
            // This is fastify validation error
            // So we return 400 and message, because it's safe (I hope)

            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            reply.status(errorToCodeMap.get(errors.BadRequest)!.status);
            response.errorCode = errorToCodeMap.get(errors.BadRequest)!.code;

            if (e.message) {
                response.errorMessage = e.message;
            }
            knownError = true;
        }

        if (e.details?.publicMessage) {
            response.errorMessage = e.details.publicMessage;
        }

        if (e.details?.errorCode) {
            response.errorCode = e.details.errorCode;
        }

        if (copyDetails) {
            if (!knownError) {
                // no need for rawMessage if known error, because it's already in the errorMessage filed
                response.errorMessageRaw = e.message || "<No raw message>";
            }

            response.errorDetails = {
                stack: e.stack,
                details: e.details,
            };
        }
    }
    // @TODO handle situation when error is not instance of error?

    reply.send(response); // eslint-disable-line @typescript-eslint/no-floating-promises
};

const errorHandler = (app: FastifyInstance) => {
    app.setErrorHandler(handler);
    app.decorate("$errors", errors);
};

export { errorHandler };

export type {
    ErrorHandlerInstanceDecorator,
};
