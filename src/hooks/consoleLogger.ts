import chalk from "chalk";

import type { FastifyInstance, onResponseHookHandler, preHandlerHookHandler } from "fastify";

interface ConsoleLoggerRequestDecorator {
    $requestId: string;
}

let count = 0;
const id = `r${Date.now()}${Math.random()}_`;

const SERVER_ERRORS_START = 500;
const CLIENT_ERRORS_START = 400;
const REDIRECTS_START = 300;
const OK_START = 200;
// const INFORMATIONAL_START = 100;

const colorStatus = (n: number) => {
    if (n >= SERVER_ERRORS_START) {
        return chalk.red(n);
    }
    if (n >= CLIENT_ERRORS_START) {
        return chalk.magenta(n);
    }
    if (n >= REDIRECTS_START) {
        return chalk.yellow(n);
    }
    if (n >= OK_START) {
        return chalk.green(n);
    }
    return chalk.blue(n);
};

const preConsoleLogger: preHandlerHookHandler = (req, res, next) => {
    const reqId = `${id}${count++}`;
    // eslint-disable-next-line no-param-reassign
    req.$requestId = reqId;

    console.info("<", reqId, new Date().toISOString(), req.ip, req.raw.method, req.raw.url);
    next();
};

const responseConsoleLogger: onResponseHookHandler = (req, res, next) => {
    const statusCode = colorStatus(res.raw.statusCode);

    console.info(">", req.$requestId, new Date().toISOString(), statusCode);
    next();
};

const consoleLogger = (app: FastifyInstance) => { // @TODO add id generation fn
    app.addHook("preHandler", preConsoleLogger);
    app.addHook("onResponse", responseConsoleLogger);
    app.decorateRequest("$requestId", "");
};

export {
    consoleLogger,
};

export type {
    ConsoleLoggerRequestDecorator,
};
