# fastify-toolset

A small set of drop-in pieces I keep re-writing in every fastify project: consistent JSON error responses, a readable
request log for development, and a validator compiler that knows URL params are always strings.

Designed for private use, but documented well enough to be usable.

## Compatibility

| fastify | status                              |
|---------|-------------------------------------|
| 3.x     | supported, tested against `3.29.5`  |
| 4.x     | expected to work, not tested        |
| 5.x     | supported, tested against `5.12.0`  |

fastify is a **peer dependency**, so your app decides the version. The toolset brings its own Ajv 8 instance instead of
using fastify's, which is what makes a single code path work across all three majors.

⚠️ fastify 3 reached end of life and has unpatched advisories of its own (see [Security](#security)). Use it only if
you cannot upgrade yet.

## Install

```bash
pnpm add fastify-toolset
```

## Usage

Everything takes the fastify instance and wires itself in. Nothing here is a fastify plugin, so there is no
encapsulation - call them on the instance (or scope) you want them applied to.

```ts
import fastify from "fastify";
import { consoleLogger, errorHandler, validationCompiler } from "fastify-toolset";

import type { ConsoleLoggerRequestDecorator, ErrorHandlerInstanceDecorator } from "fastify-toolset";

// opt in to the types of the decorators added below
declare module "fastify" {
    interface FastifyInstance extends ErrorHandlerInstanceDecorator {}
    interface FastifyRequest extends ConsoleLoggerRequestDecorator {}
}

const app = fastify();

consoleLogger(app);
errorHandler(app);
validationCompiler(app);

await app.listen({ port: 3000 });
```

### `errorHandler(app)`

Installs an error handler that turns every thrown error into the same JSON shape, and decorates the instance with
`app.$errors`:

```ts
app.get("/thing/:id", async function handler() {
    throw new this.$errors.NotFound("thing 123 is not in the db", {
        publicMessage: "No such thing",
    });
});
```

```json
{
  "error": true,
  "errorCode": "ERR_NOT_FOUND",
  "errorMessage": "No such thing",
  "errorDetails": null
}
```

What ends up in the response depends on the kind of error thrown:

- **known errors** (from `app.$errors`) set the HTTP status and the `errorCode` from the table below. `errorMessage` is
  the `publicMessage` from the error details, and **when there is no `publicMessage`, the error's own message is used
  instead**. That is deliberate: the convention for these errors is that anything private goes into the details, and
  the message stays presentable.
- **fastify schema validation errors** are detected and reported as `400` / `ERR_BAD_REQUEST`, keeping fastify's own
  message (e.g. `body/relay must be number`).
- **anything else** - a plain `Error`, a library error, whatever bubbled up - becomes `500` / `ERR_UNKNOWN_ERROR` with
  `errorMessage: "<No message>"`. Here the error's own message is **never** used, because nothing guarantees it is safe
  to show. Set `publicMessage` (see below) if you do want to say something.

Two error details act as overrides regardless of which of the three cases applies:

- `publicMessage` becomes `errorMessage`
- `errorCode` replaces the code

Finally, when `NODE_ENV === "development"`, `errorDetails` carries `stack` and the error's `details`, and unknown errors
additionally get `errorMessageRaw` with the message that was withheld.

#### Available errors

`app.$errors` covers every 4xx and 5xx status. The key is the PascalCase form of the status' reason phrase, the
`errorCode` is the same phrase in `ERR_ALL_CAPS`, and `error.name` is the key itself - so once you know one, you know
all of them.

4xx, all inheriting from `ClientError`:

| `app.$errors.…`                | status | `errorCode`                             |
|--------------------------------|--------|-----------------------------------------|
| `BadRequest`                   | 400    | `ERR_BAD_REQUEST`                       |
| `Unauthorized`                 | 401    | `ERR_UNAUTHORIZED`                      |
| `PaymentRequired`              | 402    | `ERR_PAYMENT_REQUIRED`                  |
| `Forbidden`                    | 403    | `ERR_FORBIDDEN`                         |
| `NotFound`                     | 404    | `ERR_NOT_FOUND`                         |
| `MethodNotAllowed`             | 405    | `ERR_METHOD_NOT_ALLOWED`                |
| `NotAcceptable`                | 406    | `ERR_NOT_ACCEPTABLE`                    |
| `ProxyAuthenticationRequired`  | 407    | `ERR_PROXY_AUTHENTICATION_REQUIRED`     |
| `RequestTimeout`               | 408    | `ERR_REQUEST_TIMEOUT`                   |
| `Conflict`                     | 409    | `ERR_CONFLICT`                          |
| `Gone`                         | 410    | `ERR_GONE`                              |
| `LengthRequired`               | 411    | `ERR_LENGTH_REQUIRED`                   |
| `PreconditionFailed`           | 412    | `ERR_PRECONDITION_FAILED`               |
| `RequestEntityTooLarge`        | 413    | `ERR_REQUEST_ENTITY_TOO_LARGE`          |
| `RequestUriTooLong`            | 414    | `ERR_REQUEST_URI_TOO_LONG`              |
| `UnsupportedMediaType`         | 415    | `ERR_UNSUPPORTED_MEDIA_TYPE`            |
| `RequestedRangeNotSatisfiable` | 416    | `ERR_REQUESTED_RANGE_NOT_SATISFIABLE`   |
| `ExpectationFailed`            | 417    | `ERR_EXPECTATION_FAILED`                |
| `ImATeapot`                    | 418    | `ERR_IM_A_TEAPOT`                       |
| `InsufficientSpaceOnResource`  | 419    | `ERR_INSUFFICIENT_SPACE_ON_RESOURCE`    |
| `MethodFailure`                | 420    | `ERR_METHOD_FAILURE`                    |
| `MisdirectedRequest`           | 421    | `ERR_MISDIRECTED_REQUEST`               |
| `UnprocessableEntity`          | 422    | `ERR_UNPROCESSABLE_ENTITY`              |
| `Locked`                       | 423    | `ERR_LOCKED`                            |
| `FailedDependency`             | 424    | `ERR_FAILED_DEPENDENCY`                 |
| `TooEarly`                     | 425    | `ERR_TOO_EARLY`                         |
| `UpgradeRequired`              | 426    | `ERR_UPGRADE_REQUIRED`                  |
| `PreconditionRequired`         | 428    | `ERR_PRECONDITION_REQUIRED`             |
| `TooManyRequests`              | 429    | `ERR_TOO_MANY_REQUESTS`                 |
| `RequestHeaderFieldsTooLarge`  | 431    | `ERR_REQUEST_HEADER_FIELDS_TOO_LARGE`   |
| `UnavailableForLegalReasons`   | 451    | `ERR_UNAVAILABLE_FOR_LEGAL_REASONS`     |

5xx, all inheriting from `ServerError`:

| `app.$errors.…`                 | status | `errorCode`                             |
|---------------------------------|--------|-----------------------------------------|
| `InternalServerError`           | 500    | `ERR_INTERNAL_SERVER_ERROR`             |
| `NotImplemented`                | 501    | `ERR_NOT_IMPLEMENTED`                   |
| `BadGateway`                    | 502    | `ERR_BAD_GATEWAY`                       |
| `ServiceUnavailable`            | 503    | `ERR_SERVICE_UNAVAILABLE`               |
| `GatewayTimeout`                | 504    | `ERR_GATEWAY_TIMEOUT`                   |
| `HttpVersionNotSupported`       | 505    | `ERR_HTTP_VERSION_NOT_SUPPORTED`        |
| `VariantAlsoNegotiates`         | 506    | `ERR_VARIANT_ALSO_NEGOTIATES`           |
| `InsufficientStorage`           | 507    | `ERR_INSUFFICIENT_STORAGE`              |
| `LoopDetected`                  | 508    | `ERR_LOOP_DETECTED`                     |
| `NotExtended`                   | 510    | `ERR_NOT_EXTENDED`                      |
| `NetworkAuthenticationRequired` | 511    | `ERR_NETWORK_AUTHENTICATION_REQUIRED`   |

The base classes `HttpError`, `ClientError` and `ServerError` are exported too, for `instanceof` checks and for
building your own errors on top. `errorToCodeMap` is exported as well, if you need the status/code of an error outside
of a request.

```ts
import { ClientError, errorToCodeMap, errors } from "fastify-toolset";

errorToCodeMap.get(errors.Conflict);             // { status: 409, code: "ERR_CONFLICT" }
new errors.Conflict("x") instanceof ClientError; // true
new errors.Conflict("x").names;                  // ["Conflict", "ClientHttpError", "HttpError", "Error"]

const MyError = errors.Conflict.extend("SeatAlreadyTaken"); // 409 / ERR_CONFLICT, but your own class
```

All of them are [`@ezez/errors`](https://www.npmjs.com/package/@ezez/errors) constructors, so they also carry
`details`, `parent`, `ancestors` and `names`, and can be extended further with `.extend()` - an extended error still
matches its parent in `errorToCodeMap`, so it keeps the parent's status and code.

### `consoleLogger(app)`

A human-readable request log for development, plus a `$requestId` on every request to correlate the two lines:

```
< r1786998025315_0 2026-08-17T20:20:25.952Z 127.0.0.1 GET /thing/123
> r1786998025315_0 2026-08-17T20:20:25.956Z 200
```

The status code is colored by class (2xx green, 3xx yellow, 4xx magenta, 5xx red).

### `validationCompiler(app)`

Replaces fastify's validator compiler with two Ajv 8 instances and adds one extra schema marker, `$isUrl`:

```ts
app.get("/thing", {
    schema: {
        querystring: {
            $isUrl: true, // <- everything in a URL is a string, so coerce types
            type: "object",
            required: ["limit"],
            properties: {
                limit: { type: "number" },
            },
        },
    },
}, async (req) => {
    return { limit: req.query.limit }; // a real number
});
```

Without `$isUrl` types are **not** coerced, so a JSON body with `{ "limit": "10" }` is rejected instead of quietly
becoming `10`. Both instances use `useDefaults: true` and `removeAdditional: false`.

## Development

```bash
pnpm test                      # jest, runs the whole suite against fastify 3 and fastify 5
pnpm run typecheck             # tsc against both majors
pnpm run lint
pnpm run compile               # esm + cjs build
pnpm run start:dev             # playground server on fastify 3, port 16073
pnpm run start:dev:fastify5    # the same playground on fastify 5
```

fastify 5 is installed next to fastify 3 under the `fastify5` alias (`"fastify5": "npm:fastify@^5.12.0"`).
`src/__test/suite.ts` holds the whole test suite as a function taking a fastify factory; `src/fastify3.spec.ts` and
`src/fastify5.spec.ts` each run it once, so both majors are always covered by exactly the same assertions.

## Security

`pnpm audit --prod` is clean. `pnpm audit` reports four advisories, all of them coming from the fastify 3 devDependency
(fastify 3 is EOL, and its `find-my-way@4` has no patched release) - they do not affect consumers of this package,
which pick their own fastify version. Everything else is pinned to a patched version through `overrides` in
`pnpm-workspace.yaml`.

## License

MIT
