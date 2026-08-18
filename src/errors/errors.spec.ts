import { ClientError, errors, errorToCodeMap, HttpError, ServerError } from "./errors.js";

type ErrorName = keyof typeof errors;

interface Expectation {
    name: ErrorName;
    status: number;
    code: string;
}

/**
 * The full expected mapping, written out by hand on purpose - deriving it the same way the implementation does would
 * make this test pass no matter what breaks.
 */
const CLIENT_EXPECTATIONS: Expectation[] = [
    { name: "BadRequest", status: 400, code: "ERR_BAD_REQUEST" },
    { name: "Unauthorized", status: 401, code: "ERR_UNAUTHORIZED" },
    { name: "PaymentRequired", status: 402, code: "ERR_PAYMENT_REQUIRED" },
    { name: "Forbidden", status: 403, code: "ERR_FORBIDDEN" },
    { name: "NotFound", status: 404, code: "ERR_NOT_FOUND" },
    { name: "MethodNotAllowed", status: 405, code: "ERR_METHOD_NOT_ALLOWED" },
    { name: "NotAcceptable", status: 406, code: "ERR_NOT_ACCEPTABLE" },
    { name: "ProxyAuthenticationRequired", status: 407, code: "ERR_PROXY_AUTHENTICATION_REQUIRED" },
    { name: "RequestTimeout", status: 408, code: "ERR_REQUEST_TIMEOUT" },
    { name: "Conflict", status: 409, code: "ERR_CONFLICT" },
    { name: "Gone", status: 410, code: "ERR_GONE" },
    { name: "LengthRequired", status: 411, code: "ERR_LENGTH_REQUIRED" },
    { name: "PreconditionFailed", status: 412, code: "ERR_PRECONDITION_FAILED" },
    { name: "RequestEntityTooLarge", status: 413, code: "ERR_REQUEST_ENTITY_TOO_LARGE" },
    { name: "RequestUriTooLong", status: 414, code: "ERR_REQUEST_URI_TOO_LONG" },
    { name: "UnsupportedMediaType", status: 415, code: "ERR_UNSUPPORTED_MEDIA_TYPE" },
    { name: "RequestedRangeNotSatisfiable", status: 416, code: "ERR_REQUESTED_RANGE_NOT_SATISFIABLE" },
    { name: "ExpectationFailed", status: 417, code: "ERR_EXPECTATION_FAILED" },
    { name: "ImATeapot", status: 418, code: "ERR_IM_A_TEAPOT" },
    { name: "InsufficientSpaceOnResource", status: 419, code: "ERR_INSUFFICIENT_SPACE_ON_RESOURCE" },
    { name: "MethodFailure", status: 420, code: "ERR_METHOD_FAILURE" },
    { name: "MisdirectedRequest", status: 421, code: "ERR_MISDIRECTED_REQUEST" },
    { name: "UnprocessableEntity", status: 422, code: "ERR_UNPROCESSABLE_ENTITY" },
    { name: "Locked", status: 423, code: "ERR_LOCKED" },
    { name: "FailedDependency", status: 424, code: "ERR_FAILED_DEPENDENCY" },
    { name: "TooEarly", status: 425, code: "ERR_TOO_EARLY" },
    { name: "UpgradeRequired", status: 426, code: "ERR_UPGRADE_REQUIRED" },
    { name: "PreconditionRequired", status: 428, code: "ERR_PRECONDITION_REQUIRED" },
    { name: "TooManyRequests", status: 429, code: "ERR_TOO_MANY_REQUESTS" },
    { name: "RequestHeaderFieldsTooLarge", status: 431, code: "ERR_REQUEST_HEADER_FIELDS_TOO_LARGE" },
    { name: "UnavailableForLegalReasons", status: 451, code: "ERR_UNAVAILABLE_FOR_LEGAL_REASONS" },
];

const SERVER_EXPECTATIONS: Expectation[] = [
    { name: "InternalServerError", status: 500, code: "ERR_INTERNAL_SERVER_ERROR" },
    { name: "NotImplemented", status: 501, code: "ERR_NOT_IMPLEMENTED" },
    { name: "BadGateway", status: 502, code: "ERR_BAD_GATEWAY" },
    { name: "ServiceUnavailable", status: 503, code: "ERR_SERVICE_UNAVAILABLE" },
    { name: "GatewayTimeout", status: 504, code: "ERR_GATEWAY_TIMEOUT" },
    { name: "HttpVersionNotSupported", status: 505, code: "ERR_HTTP_VERSION_NOT_SUPPORTED" },
    { name: "VariantAlsoNegotiates", status: 506, code: "ERR_VARIANT_ALSO_NEGOTIATES" },
    { name: "InsufficientStorage", status: 507, code: "ERR_INSUFFICIENT_STORAGE" },
    { name: "LoopDetected", status: 508, code: "ERR_LOOP_DETECTED" },
    { name: "NotExtended", status: 510, code: "ERR_NOT_EXTENDED" },
    { name: "NetworkAuthenticationRequired", status: 511, code: "ERR_NETWORK_AUTHENTICATION_REQUIRED" },
];

const ALL_EXPECTATIONS = [...CLIENT_EXPECTATIONS, ...SERVER_EXPECTATIONS];

describe("errors", () => {
    it("exposes exactly the expected set of errors", () => {
        const actual = Object.keys(errors).sort();
        const expected = ALL_EXPECTATIONS.map(e => e.name).sort();

        actual.must.eql(expected);
    });

    it("maps every error to the right status and code", () => {
        for (const expectation of ALL_EXPECTATIONS) {
            const mapped = errorToCodeMap.get(errors[expectation.name]);

            Boolean(mapped).must.be.true();
            mapped!.status.must.equal(expectation.status);
            mapped!.code.must.equal(expectation.code);
        }
    });

    it("has no duplicated error codes", () => {
        const codes = [...errorToCodeMap.values()].map(v => v.code);

        new Set(codes).size.must.equal(codes.length);
    });

    it("has no duplicated statuses", () => {
        const statuses = [...errorToCodeMap.values()].map(v => v.status);

        new Set(statuses).size.must.equal(statuses.length);
    });

    it("puts 4xx errors under ClientError", () => {
        for (const { name: errorName } of CLIENT_EXPECTATIONS) {
            const error = new errors[errorName]("test");

            (error instanceof ClientError).must.be.true();
            (error instanceof ServerError).must.be.false();
            (error instanceof HttpError).must.be.true();
            (error instanceof Error).must.be.true();
        }
    });

    it("puts 5xx errors under ServerError", () => {
        for (const { name: errorName } of SERVER_EXPECTATIONS) {
            const error = new errors[errorName]("test");

            (error instanceof ServerError).must.be.true();
            (error instanceof ClientError).must.be.false();
            (error instanceof HttpError).must.be.true();
        }
    });

    it("names every error class exactly after its key, with no suffix", () => {
        for (const { name: errorName } of ALL_EXPECTATIONS) {
            new errors[errorName]("test").name.must.equal(errorName);
        }
    });

    it("exposes the whole hierarchy on the error itself", () => {
        const error = new errors.Conflict("test");

        error.names.must.eql(["Conflict", "ClientHttpError", "HttpError", "Error"]);

        const serverError = new errors.BadGateway("test");

        serverError.names.must.eql(["BadGateway", "ServerHttpError", "HttpError", "Error"]);
    });

    it("lets a user error be built on top of a toolset one", () => {
        const SeatAlreadyTaken = errors.Conflict.extend("SeatAlreadyTaken");
        const error = new SeatAlreadyTaken("test");

        (error instanceof errors.Conflict).must.be.true();
        (error instanceof ClientError).must.be.true();
        error.name.must.equal("SeatAlreadyTaken");
    });

    it("carries the error details", () => {
        const error = new errors.Conflict("internal", { publicMessage: "Already there" });

        error.message.must.equal("internal");
        error.details!.publicMessage!.must.equal("Already there");
    });
});
