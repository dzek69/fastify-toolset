import fastify from "fastify";
import { consoleLogger, errorHandler } from "./index.js";

import type { ConsoleLoggerRequestDecorator, ErrorHandlerInstanceDecorator } from "./index.js";

console.info("BOOT");

declare module "fastify" {
    interface FastifyInstance extends ErrorHandlerInstanceDecorator {}
    interface FastifyRequest extends ConsoleLoggerRequestDecorator {}
}

(async () => {
    const app = fastify();
    consoleLogger(app);
    errorHandler(app);

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
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    return app.listen(16073, "0.0.0.0");
})().catch(e => {
    throw e;
});

export {};
