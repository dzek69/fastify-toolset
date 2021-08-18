import { StatusCodes } from "http-status-codes";
import type { FastifyInstance } from "fastify";
import type { CustomError } from "better-custom-error";

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
    validation: unknown[];
    validationContext: string;
} & Error;

// eslint-disable-next-line max-statements
const handler: Handler = (error, request, reply) => {
    const e = error as CustomError<{publicMessage: string}>;
    const response: ErrorResponse = {
        error: true,
        errorCode: "ERR_UNKNOWN_ERROR",
        errorMessage: "<No message>",
        errorDetails: null,
    };

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

        if (!knownError && (error as ValidationError).validationContext) {
            // This is fastify validation error // @TODO improve detection
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
