import type { FastifyInstance, FastifySchema } from "fastify";
import type { ConsoleLoggerRequestDecorator, ErrorHandlerInstanceDecorator } from "../index.js";

import { consoleLogger, errorHandler, errors as toolsetErrors, errorToCodeMap, validationCompiler } from "../index.js";

type ErrorName = keyof typeof toolsetErrors;

/** A user defined error built on top of a toolset one, to prove it inherits its status and code. */
const SeatAlreadyTaken = toolsetErrors.Conflict.extend("SeatAlreadyTaken");

declare module "fastify" {
    interface FastifyInstance extends ErrorHandlerInstanceDecorator {}
    interface FastifyRequest extends ConsoleLoggerRequestDecorator {}
}

const NOT_FOUND = 404;
const BAD_REQUEST = 400;
const CONFLICT = 409;
const SERVER_ERROR = 500;
const OK = 200;

interface ErrorBody {
    error: true;
    errorCode: string;
    errorMessage: string;
    errorMessageRaw?: string;
    errorDetails: null | { [key: string]: unknown };
}

/**
 * Every fastify major is a separate npm package here (`fastify` = v3, `fastify5` = v5), so their instance types are
 * structurally identical but nominally unrelated. The suite is written against the `fastify` types and the factory
 * result is cast once, here.
 */
type FastifyFactory = () => unknown;

const urlSchema: FastifySchema = {
    querystring: {
        $isUrl: true,
        type: "object",
        required: ["relay"],
        properties: {
            relay: { type: "number" },
        },
    },
};

const bodySchema: FastifySchema = {
    body: {
        type: "object",
        required: ["relay"],
        properties: {
            relay: { type: "number" },
        },
    },
};

const buildApp = (createFastify: FastifyFactory) => {
    const app = createFastify() as FastifyInstance;

    consoleLogger(app);
    errorHandler(app);
    validationCompiler(app);

    app.get("/ok", async (req) => ({ error: false, requestId: req.$requestId }));

    app.get("/throw/known", async function throwKnown() {
        // eslint-disable-next-line @typescript-eslint/no-invalid-this
        throw new this.$errors.NotFound("internal details of what is missing", {
            publicMessage: "Nothing here",
        });
    });

    app.get("/throw/no-public-message", async function throwNoPublic() {
        // eslint-disable-next-line @typescript-eslint/no-invalid-this
        throw new this.$errors.Gone("this resource is gone");
    });

    app.get("/throw/custom-code", async function throwCustomCode() {
        // eslint-disable-next-line @typescript-eslint/no-invalid-this
        throw new this.$errors.BadRequest("nope", {
            publicMessage: "Nope",
            errorCode: "ERR_MY_OWN_CODE",
        });
    });

    app.get("/throw/server", async function throwServer() {
        // eslint-disable-next-line @typescript-eslint/no-invalid-this
        throw new this.$errors.InternalServerError("boom");
    });

    app.get("/throw/too-many", async function throwTooMany() {
        // eslint-disable-next-line @typescript-eslint/no-invalid-this
        throw new this.$errors.TooManyRequests("slow down");
    });

    app.get("/throw/unknown", async () => {
        throw new Error("SECRET internal message");
    });

    app.get("/throw/extended", async () => {
        throw new SeatAlreadyTaken("seat 14A is taken", { publicMessage: "That seat is taken" });
    });

    // fastify's own validation flow always sets `validationContext`, but a validation error can also reach the handler
    // without it - e.g. `fastify.errorCodes.FST_ERR_VALIDATION` thrown by hand or by a plugin, which carries only
    // `code`, or an error that only carries the `validation` array
    app.get("/throw/validation-code-only", async () => {
        throw Object.assign(new Error("body must have required property 'relay'"), {
            code: "FST_ERR_VALIDATION",
        });
    });

    app.get("/throw/validation-array-only", async () => {
        throw Object.assign(new Error("body/relay must be number"), {
            validation: [{ message: "must be number" }],
        });
    });

    app.get("/throw/by-name/:name", async function throwByName(req) {
        const { name: errorName } = req.params as { name: ErrorName };
        // eslint-disable-next-line @typescript-eslint/no-invalid-this
        const ErrorClass = this.$errors[errorName];

        if (!ErrorClass) {
            throw new Error(`no such error: ${errorName}`);
        }
        throw new ErrorClass("thrown by name");
    });

    app.get("/url-schema", { schema: urlSchema }, async (req) => ({
        typeofRelay: typeof (req.query as { relay: unknown }).relay,
        relay: (req.query as { relay: unknown }).relay,
    }));

    app.post("/body-schema", { schema: bodySchema }, async (req) => ({
        typeofRelay: typeof (req.body as { relay: unknown }).relay,
    }));

    return app;
};

/**
 * The whole test suite, parametrized with a fastify factory, so it can be run against every supported major.
 *
 * @param label - name shown in the test report
 * @param createFastify - the `fastify` export of the version under test
 */
const defineToolsetSuite = (label: string, createFastify: FastifyFactory) => {
    describe(label, () => {
        let app: FastifyInstance,
            infoLogs: unknown[][];

        beforeEach(() => {
            infoLogs = [];
            jest.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
                infoLogs.push(args);
            });
            jest.spyOn(console, "error").mockImplementation(() => undefined);
            app = buildApp(createFastify);
        });

        afterEach(async () => {
            jest.restoreAllMocks();
            await app.close();
        });

        describe("consoleLogger", () => {
            it("decorates the request with an id and logs both directions", async () => {
                const res = await app.inject({ method: "GET", url: "/ok" });

                res.statusCode.must.equal(OK);

                const body = JSON.parse(res.body) as { requestId: string };
                body.requestId.must.be.a.string();
                body.requestId.length.must.be.gt(0);

                const incoming = infoLogs.find(l => l[0] === "<");
                const outgoing = infoLogs.find(l => l[0] === ">");

                Boolean(incoming).must.be.true();
                Boolean(outgoing).must.be.true();
                incoming![1]!.must.equal(body.requestId);
                outgoing![1]!.must.equal(body.requestId);
            });

            it("gives every request a unique id", async () => {
                const [one, two] = await Promise.all([
                    app.inject({ method: "GET", url: "/ok" }),
                    app.inject({ method: "GET", url: "/ok" }),
                ]);

                const idOne = (JSON.parse(one.body) as { requestId: string }).requestId;
                const idTwo = (JSON.parse(two.body) as { requestId: string }).requestId;

                idOne.must.not.equal(idTwo);
            });
        });

        describe("errorHandler", () => {
            it("maps a known error to its status code and public message", async () => {
                const res = await app.inject({ method: "GET", url: "/throw/known" });

                res.statusCode.must.equal(NOT_FOUND);

                const body = JSON.parse(res.body) as ErrorBody;
                body.error.must.be.true();
                body.errorCode.must.equal("ERR_NOT_FOUND");
                body.errorMessage.must.equal("Nothing here");
                (body.errorDetails === null).must.be.true();
            });

            it("falls back to the raw message when there is no publicMessage", async () => {
                const res = await app.inject({ method: "GET", url: "/throw/no-public-message" });

                res.statusCode.must.equal(410);
                (JSON.parse(res.body) as ErrorBody).errorMessage.must.equal("this resource is gone");
            });

            it("allows overriding the error code", async () => {
                const res = await app.inject({ method: "GET", url: "/throw/custom-code" });

                res.statusCode.must.equal(BAD_REQUEST);
                (JSON.parse(res.body) as ErrorBody).errorCode.must.equal("ERR_MY_OWN_CODE");
            });

            it("builds multi word error codes without spaces", async () => {
                const server = await app.inject({ method: "GET", url: "/throw/server" });
                const tooMany = await app.inject({ method: "GET", url: "/throw/too-many" });

                (JSON.parse(server.body) as ErrorBody).errorCode.must.equal("ERR_INTERNAL_SERVER_ERROR");
                (JSON.parse(tooMany.body) as ErrorBody).errorCode.must.equal("ERR_TOO_MANY_REQUESTS");
            });

            it("maps every error in $errors to its own status and code", async () => {
                const names = Object.keys(toolsetErrors) as ErrorName[];

                names.length.must.equal(errorToCodeMap.size);

                for (const errorName of names) {
                    const expected = errorToCodeMap.get(toolsetErrors[errorName])!;
                    const res = await app.inject({ method: "GET", url: `/throw/by-name/${errorName}` });
                    const body = JSON.parse(res.body) as ErrorBody;

                    res.statusCode.must.equal(expected.status);
                    body.errorCode.must.equal(expected.code);
                    body.errorMessage.must.equal("thrown by name");
                }
            });

            it("gives an error extended from a known one its parent's status and code", async () => {
                const res = await app.inject({ method: "GET", url: "/throw/extended" });

                res.statusCode.must.equal(CONFLICT);

                const body = JSON.parse(res.body) as ErrorBody;
                body.errorCode.must.equal("ERR_CONFLICT");
                body.errorMessage.must.equal("That seat is taken");
            });

            it("recognises a validation error that only carries the FST_ERR_VALIDATION code", async () => {
                const res = await app.inject({ method: "GET", url: "/throw/validation-code-only" });

                res.statusCode.must.equal(BAD_REQUEST);

                const body = JSON.parse(res.body) as ErrorBody;
                body.errorCode.must.equal("ERR_BAD_REQUEST");
                body.errorMessage.must.equal("body must have required property 'relay'");
            });

            it("recognises a validation error that only carries the validation array", async () => {
                const res = await app.inject({ method: "GET", url: "/throw/validation-array-only" });

                res.statusCode.must.equal(BAD_REQUEST);

                const body = JSON.parse(res.body) as ErrorBody;
                body.errorCode.must.equal("ERR_BAD_REQUEST");
                body.errorMessage.must.equal("body/relay must be number");
            });

            it("hides the message of an unknown error", async () => {
                const res = await app.inject({ method: "GET", url: "/throw/unknown" });

                res.statusCode.must.equal(SERVER_ERROR);

                const body = JSON.parse(res.body) as ErrorBody;
                body.errorCode.must.equal("ERR_UNKNOWN_ERROR");
                body.errorMessage.must.equal("<No message>");
                res.body.must.not.contain("SECRET");
            });

            describe("in development mode", () => {
                const previousNodeEnv = process.env.NODE_ENV;

                beforeEach(() => {
                    process.env.NODE_ENV = "development";
                });

                afterEach(() => {
                    process.env.NODE_ENV = previousNodeEnv;
                });

                it("exposes the raw message and the stack", async () => {
                    const res = await app.inject({ method: "GET", url: "/throw/unknown" });
                    const body = JSON.parse(res.body) as ErrorBody;

                    body.errorMessageRaw!.must.equal("SECRET internal message");
                    Boolean(body.errorDetails).must.be.true();
                    Boolean(body.errorDetails!.stack).must.be.true();
                });
            });

            it("turns a fastify schema validation error into a bad request", async () => {
                const res = await app.inject({
                    method: "POST",
                    url: "/body-schema",
                    payload: { relay: "not a number" },
                });

                res.statusCode.must.equal(BAD_REQUEST);

                const body = JSON.parse(res.body) as ErrorBody;
                body.errorCode.must.equal("ERR_BAD_REQUEST");
                // the property path only shows up when Ajv 8 errors carry `dataPath` (fastify 3) /
                // `instancePath` (fastify 4+)
                body.errorMessage.must.contain("relay");
                body.errorMessage.must.contain("body");
            });
        });

        describe("validationCompiler", () => {
            it("coerces types for schemas marked with $isUrl", async () => {
                const res = await app.inject({ method: "GET", url: "/url-schema?relay=5" });

                res.statusCode.must.equal(OK);

                const body = JSON.parse(res.body) as { typeofRelay: string; relay: number };
                body.typeofRelay.must.equal("number");
                body.relay.must.equal(5);
            });

            it("still rejects url params that cannot be coerced", async () => {
                const res = await app.inject({ method: "GET", url: "/url-schema?relay=abc" });

                res.statusCode.must.equal(BAD_REQUEST);
                (JSON.parse(res.body) as ErrorBody).errorCode.must.equal("ERR_BAD_REQUEST");
            });

            it("rejects missing required url params", async () => {
                const res = await app.inject({ method: "GET", url: "/url-schema" });

                res.statusCode.must.equal(BAD_REQUEST);
            });

            it("does not coerce types for regular schemas", async () => {
                const ok = await app.inject({ method: "POST", url: "/body-schema", payload: { relay: 5 } });
                const bad = await app.inject({ method: "POST", url: "/body-schema", payload: { relay: "5" } });

                ok.statusCode.must.equal(OK);
                (JSON.parse(ok.body) as { typeofRelay: string }).typeofRelay.must.equal("number");

                bad.statusCode.must.equal(BAD_REQUEST);
            });
        });
    });
};

export {
    defineToolsetSuite,
};
