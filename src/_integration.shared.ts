import type { FastifySchema, RequestGenericInterface, RouteHandler, FastifyInstance } from "fastify";
import type { ConsoleLoggerRequestDecorator, ErrorHandlerInstanceDecorator } from "./index.js";

import { consoleLogger, errorHandler, validationCompiler } from "./index.js";

declare module "fastify" {
    interface FastifyInstance extends ErrorHandlerInstanceDecorator {}
    interface FastifyRequest extends ConsoleLoggerRequestDecorator {}
}

const PORT = 16073;

const configTestSchema: FastifySchema = {
    querystring: {
        $isUrl: true,
        type: "object",
        required: ["relay"],
        properties: {
            relay: { type: "number" },
        },
    },
    body: {
        type: "object",
        required: ["relay"],
        properties: {
            relay: { type: "number" },
        },
    },
};

interface Params {
    relay: number;
}

interface Req extends RequestGenericInterface {
    Querystring: Params;
    Body: Params;
}

// send relay in url - it should be a number
// send relay in body - it should crash on string
// eslint-disable-next-line @typescript-eslint/require-await
const configTestHandler: RouteHandler<Req> = async (req) => ({
    error: false,
    typeofQS: typeof req.query.relay,
    typeofBody: typeof req.body.relay,
});

/**
 * Wires the whole toolset into a fastify instance and adds a few playground routes.
 *
 * Shared by the fastify 3 and fastify 5 integration entry points, so both are guaranteed to run the same code.
 *
 * @param app - fastify instance (any supported major)
 */
const buildIntegrationApp = (app: FastifyInstance) => {
    consoleLogger(app);
    errorHandler(app);
    validationCompiler(app);

    // eslint-disable-next-line @typescript-eslint/require-await
    app.get("/", async () => {
        return {
            error: false,
        };
    });

    app.get("/status/:code", async (req, res) => {
        const code = (req.params as { code: number }).code;
        res.status(code);
        return {
            error: false,
        };
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    app.get("/throw/:code", async function throwCodeHandler() {
        // eslint-disable-next-line @typescript-eslint/no-invalid-this
        throw new this.$errors.BadRequest("There is no stuff", {
            publicMessage: "hi there",
        });
    });

    app.post("/config-test", { schema: configTestSchema }, configTestHandler);

    return app;
};

/**
 * Starts the playground server.
 *
 * The object-style `listen` call is used on purpose - the positional `listen(port, host)` signature was removed
 * in fastify 4/5 and the object form works since fastify 3.9.
 *
 * @param app - fastify instance
 */
const startIntegrationApp = (app: FastifyInstance) => {
    return app.listen({ port: PORT, host: "0.0.0.0" });
};

export {
    buildIntegrationApp,
    startIntegrationApp,
};
