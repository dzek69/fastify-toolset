import { createError } from "better-custom-error";
import { getReasonPhrase, StatusCodes } from "http-status-codes";

import type { CustomErrorConstructor } from "better-custom-error";

import { snakeCaseAllCaps } from "../utils/index.js";

interface ErrorShape {
    [key: string]: unknown;
    publicMessage?: string;
    errorCode?: string;
}

interface ErrorCodes {
    code: string;
    status: number;
}

const HttpError = createError<ErrorShape>("HttpError");

const ClientError = createError<ErrorShape>("ClientHttpError", HttpError);
const ServerError = createError<ErrorShape>("ServerHttpError", HttpError);

const BadRequest = createError<ErrorShape>("BadRequestError", ClientError);
const Unauthorized = createError<ErrorShape>("UnauthorizedError", ClientError);
const Forbidden = createError<ErrorShape>("ForbiddenError", ClientError);
const NotFound = createError<ErrorShape>("NotFoundError", ClientError);
const TooManyRequests = createError<ErrorShape>("TooManyRequests", ClientError);
const Gone = createError<ErrorShape>("Gone", ClientError);

const InternalServerError = createError<ErrorShape>("InternalServerError", ServerError);

const getErrorCodes = (s: number) => {
    return {
        code: "ERR_" + snakeCaseAllCaps(getReasonPhrase(s)), status: s,
    };
};

const errorToCodeMap = new Map<CustomErrorConstructor<ErrorShape>, ErrorCodes>([
    [BadRequest, getErrorCodes(StatusCodes.BAD_REQUEST)],
    [Unauthorized, getErrorCodes(StatusCodes.UNAUTHORIZED)],
    [Forbidden, getErrorCodes(StatusCodes.FORBIDDEN)],
    [NotFound, getErrorCodes(StatusCodes.NOT_FOUND)],
    [TooManyRequests, getErrorCodes(StatusCodes.TOO_MANY_REQUESTS)],
    [Gone, getErrorCodes(StatusCodes.GONE)],

    [InternalServerError, getErrorCodes(StatusCodes.INTERNAL_SERVER_ERROR)],
]);

const errors = {
    BadRequest,
    Unauthorized,
    Forbidden,
    NotFound,
    TooManyRequests,
    Gone,

    InternalServerError,
};

export {
    HttpError,
    ClientError,
    ServerError,

    errors,
    errorToCodeMap,
};

export type {
    ErrorShape,
};
