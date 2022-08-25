import fastify from "fastify";

import type { FastifySchema, RequestGenericInterface, RouteHandler } from "fastify";
import type { ConsoleLoggerRequestDecorator, ErrorHandlerInstanceDecorator } from "./index.js";

import { consoleLogger, errorHandler, validationCompiler } from "./index.js";

console.info("BOOT");

declare module "fastify" {
    interface FastifyInstance extends ErrorHandlerInstanceDecorator {}
    interface FastifyRequest extends ConsoleLoggerRequestDecorator {}
}

(async () => {
    const app = fastify();
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
        res.status(code); // eslint-disable-line @typescript-eslint/no-floating-promises
        return {
            error: false,
        };
    });
    // eslint-disable-next-line @typescript-eslint/require-await
    app.get("/throw/:code", async function throwCodeHandler(req, res) {
        // eslint-disable-next-line @typescript-eslint/no-invalid-this
        throw new this.$errors.BadRequest("There is no stuff", {
            publicMessage: "hi there",
        });
    });

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
    const configTestHandler: RouteHandler<Req> = async (req, res) => ({
        error: false,
        typeofQS: typeof req.query.relay,
        typeofBody: typeof req.body.relay,
    });

    app.post("/config-test", { schema: configTestSchema }, configTestHandler);
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    return app.listen(16073, "0.0.0.0");
})().catch(e => {
    throw e as Error;
});

