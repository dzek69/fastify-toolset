import { createError } from "@ezez/errors";
import { getReasonPhrase, StatusCodes } from "http-status-codes";

import type { CustomErrorConstructor } from "@ezez/errors";

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

// `createError` only accepts a native `Error` as a parent - building on top of a custom error goes through `.extend`
const ClientError = HttpError.extend("ClientHttpError");
const ServerError = HttpError.extend("ServerHttpError");

// IANA registered statuses that `http-status-codes@2` has no entry for, so `StatusCodes` cannot be used and
// `getReasonPhrase` would throw
const TOO_EARLY = 425;
const VARIANT_ALSO_NEGOTIATES = 506;
const LOOP_DETECTED = 508;
const NOT_EXTENDED = 510;

const EXTRA_REASON_PHRASES: { [status: number]: string | undefined } = {
    [TOO_EARLY]: "Too Early",
    [VARIANT_ALSO_NEGOTIATES]: "Variant Also Negotiates",
    [LOOP_DETECTED]: "Loop Detected",
    [NOT_EXTENDED]: "Not Extended",
};

/**
 * Every 4xx status, keyed by the PascalCase form of its reason phrase - the same phrase the `errorCode` is derived
 * from, so `errors.RequestEntityTooLarge` always pairs with `ERR_REQUEST_ENTITY_TOO_LARGE`.
 */
const CLIENT_ERROR_STATUSES = {
    BadRequest: StatusCodes.BAD_REQUEST,
    Unauthorized: StatusCodes.UNAUTHORIZED,
    PaymentRequired: StatusCodes.PAYMENT_REQUIRED,
    Forbidden: StatusCodes.FORBIDDEN,
    NotFound: StatusCodes.NOT_FOUND,
    MethodNotAllowed: StatusCodes.METHOD_NOT_ALLOWED,
    NotAcceptable: StatusCodes.NOT_ACCEPTABLE,
    ProxyAuthenticationRequired: StatusCodes.PROXY_AUTHENTICATION_REQUIRED,
    RequestTimeout: StatusCodes.REQUEST_TIMEOUT,
    Conflict: StatusCodes.CONFLICT,
    Gone: StatusCodes.GONE,
    LengthRequired: StatusCodes.LENGTH_REQUIRED,
    PreconditionFailed: StatusCodes.PRECONDITION_FAILED,
    RequestEntityTooLarge: StatusCodes.REQUEST_TOO_LONG,
    RequestUriTooLong: StatusCodes.REQUEST_URI_TOO_LONG,
    UnsupportedMediaType: StatusCodes.UNSUPPORTED_MEDIA_TYPE,
    RequestedRangeNotSatisfiable: StatusCodes.REQUESTED_RANGE_NOT_SATISFIABLE,
    ExpectationFailed: StatusCodes.EXPECTATION_FAILED,
    ImATeapot: StatusCodes.IM_A_TEAPOT,
    InsufficientSpaceOnResource: StatusCodes.INSUFFICIENT_SPACE_ON_RESOURCE,
    MethodFailure: StatusCodes.METHOD_FAILURE,
    MisdirectedRequest: StatusCodes.MISDIRECTED_REQUEST,
    UnprocessableEntity: StatusCodes.UNPROCESSABLE_ENTITY,
    Locked: StatusCodes.LOCKED,
    FailedDependency: StatusCodes.FAILED_DEPENDENCY,
    TooEarly: TOO_EARLY,
    UpgradeRequired: StatusCodes.UPGRADE_REQUIRED,
    PreconditionRequired: StatusCodes.PRECONDITION_REQUIRED,
    TooManyRequests: StatusCodes.TOO_MANY_REQUESTS,
    RequestHeaderFieldsTooLarge: StatusCodes.REQUEST_HEADER_FIELDS_TOO_LARGE,
    UnavailableForLegalReasons: StatusCodes.UNAVAILABLE_FOR_LEGAL_REASONS,
} as const;

/**
 * Every 5xx status, keyed the same way as {@link CLIENT_ERROR_STATUSES}.
 */
const SERVER_ERROR_STATUSES = {
    InternalServerError: StatusCodes.INTERNAL_SERVER_ERROR,
    NotImplemented: StatusCodes.NOT_IMPLEMENTED,
    BadGateway: StatusCodes.BAD_GATEWAY,
    ServiceUnavailable: StatusCodes.SERVICE_UNAVAILABLE,
    GatewayTimeout: StatusCodes.GATEWAY_TIMEOUT,
    HttpVersionNotSupported: StatusCodes.HTTP_VERSION_NOT_SUPPORTED,
    VariantAlsoNegotiates: VARIANT_ALSO_NEGOTIATES,
    InsufficientStorage: StatusCodes.INSUFFICIENT_STORAGE,
    LoopDetected: LOOP_DETECTED,
    NotExtended: NOT_EXTENDED,
    NetworkAuthenticationRequired: StatusCodes.NETWORK_AUTHENTICATION_REQUIRED,
} as const;

const getErrorCodes = (httpStatus: number): ErrorCodes => {
    const phrase = EXTRA_REASON_PHRASES[httpStatus] ?? getReasonPhrase(httpStatus);

    return {
        code: "ERR_" + snakeCaseAllCaps(phrase), status: httpStatus,
    };
};

type ErrorSet<T> = { [K in keyof T]: CustomErrorConstructor<ErrorShape> };

/**
 * Builds one error constructor per entry of a status table.
 *
 * @param statuses - status table; the keys become both the `$errors` keys and the class names
 * @param parentError - error to inherit from, so `instanceof ClientError` / `instanceof ServerError` keeps working
 */
const createErrorSet = <T extends { [key: string]: number }>(
    statuses: T, parentError: CustomErrorConstructor<ErrorShape>,
): ErrorSet<T> => {
    const set: { [key: string]: CustomErrorConstructor<ErrorShape> } = {};

    for (const key of Object.keys(statuses)) {
        set[key] = parentError.extend(key);
    }

    return set as ErrorSet<T>;
};

const errors = {
    ...createErrorSet(CLIENT_ERROR_STATUSES, ClientError),
    ...createErrorSet(SERVER_ERROR_STATUSES, ServerError),
};

const allStatuses: { [key: string]: number | undefined } = {
    ...CLIENT_ERROR_STATUSES,
    ...SERVER_ERROR_STATUSES,
};

const errorToCodeMap = new Map<CustomErrorConstructor<ErrorShape>, ErrorCodes>(
    (Object.keys(errors) as (keyof typeof errors)[]).map(
        key => [errors[key], getErrorCodes(allStatuses[key]!)],
    ),
);

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
