/**
 * Playground server running on fastify 3 (`pnpm run start:dev`).
 */
import fastify from "fastify";

import { buildIntegrationApp, startIntegrationApp } from "./_integration.shared.js";

console.info("BOOT (fastify 3)");

(async () => {
    return startIntegrationApp(buildIntegrationApp(fastify()));
})().catch((e: unknown) => {
    throw e;
});
