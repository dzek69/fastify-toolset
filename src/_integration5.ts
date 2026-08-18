/**
 * Playground server running on fastify 5, installed as the `fastify5` alias (`pnpm run start:dev:fastify5`).
 */
import fastify5 from "fastify5";

import type { FastifyInstance } from "fastify";

import { buildIntegrationApp, startIntegrationApp } from "./_integration.shared.js";

console.info("BOOT (fastify 5)");

(async () => {
    // the alias is a different package to TypeScript, so its instance type is structurally identical but nominally
    // unrelated to the `fastify` (v3) one this repo compiles against - hence the cast
    const app = fastify5() as unknown as FastifyInstance;
    return startIntegrationApp(buildIntegrationApp(app));
})().catch((e: unknown) => {
    throw e;
});
