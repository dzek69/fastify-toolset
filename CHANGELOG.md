All notable changes to this project will be documented in this file.

The format is based on [EZEZ Changelog](https://ezez.dev/changelog/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [UNRELEASED]
(nothing yet)

## [0.2.0] - 2026-08-18
### Breaking
- `better-custom-error` (deprecated) replaced with its successor `@ezez/errors`. The errors keep their messages,
  `details` and `instanceof` behaviour, so throwing and catching is unchanged - but they are instances of a different
  library now, and they gained `parent`, `ancestors`, `names` and `.extend()`
- error class names are unified: every error's class name is now exactly its `$errors` key, so `error.name` (and the
  stack trace header) of `BadRequest`, `Unauthorized`, `Forbidden` and `NotFound` lost the `Error` suffix -
  `BadRequestError` is now `BadRequest`. Only matters if you matched on `error.name`; `instanceof` and `errorCode` are
  unaffected
- `fastify` moved from `dependencies` to `peerDependencies` (`^3.29.5 || ^4.0.0 || ^5.0.0`) - your app now picks the
  version, and it is no longer installed transitively
- upgraded to Ajv 8 (from Ajv 6); the `nullable` Ajv option is gone (Ajv 8 supports the `nullable` keyword natively)
  and schemas are now compiled in Ajv's strict mode
- error codes for multi word reason phrases are fixed, so e.g. `ERR_INTERNAL_SERVER ERROR` is now
  `ERR_INTERNAL_SERVER_ERROR` and `ERR_TOO_MANY REQUESTS` is now `ERR_TOO_MANY_REQUESTS`. `snakeCaseAllCaps` now also
  collapses any other punctuation (`Request-URI Too Long` -> `REQUEST_URI_TOO_LONG`) and drops apostrophes
  (`I'm a teapot` -> `IM_A_TEAPOT`)
### Added
- `$errors` now covers **every** 4xx and 5xx status (42 errors, up from 7), each with a status and an `errorCode`
  derived from its reason phrase; 4xx inherit from `ClientError`, 5xx from `ServerError`
- `errorToCodeMap` is generated from a single declarative status table, so an error cannot be half-added anymore
- an error extended from a toolset one (`errors.Conflict.extend("SeatAlreadyTaken")`) inherits its status and code
- support for fastify 4 and 5 next to fastify 3
- full test suite, run against fastify 3 and fastify 5 from the same source (`src/__test/suite.ts`)
- `typecheck:fastify3` / `typecheck:fastify5` scripts, `start:dev:fastify5` playground
- a README
### Fixed
- `$isUrl` no longer reaches Ajv, which would reject it as an unknown keyword in strict mode
- Ajv 8 validation errors carry `dataPath` next to `instancePath`, so fastify 3 keeps rendering the property path in
  validation messages
- validation errors that reach the error handler outside fastify's own validation flow - carrying only
  `code === "FST_ERR_VALIDATION"` (as `fastify.errorCodes.FST_ERR_VALIDATION` does when thrown by hand or by a plugin)
  or only the `validation` array - are now recognised as such and answered with `400` / `ERR_BAD_REQUEST` instead of
  `500` / `ERR_UNKNOWN_ERROR` with the message withheld. Errors coming from fastify's own validation were already
  detected via `validationContext` and are unaffected
- the library no longer relies on the dev-only integration file to provide global types
### Dev
- `http-status-codes` bumped to `^2.3.0`, which knows 421 and 426; the four IANA statuses it still misses (425, 506,
  508, 510) carry their reason phrase locally
- `pnpm audit` down from 22 to 4 advisories via `overrides` in `pnpm-workspace.yaml`; the remaining 4 all come from the
  EOL fastify 3 devDependency, and `pnpm audit --prod` is clean
- the dev playground (`src/_integration*.ts`) is no longer part of the published build
- fixed the jest `moduleNameMapper`, which stripped `.js` from package names such as `uri-js` and `ipaddr.js`

## [0.1.4] - 2022-08-27
### Added
- `Gone` error

## [0.1.3] - 2022-08-27
### Changed
- `publicMessage` error detail is now optional

## [0.1.2] - 2022-08-25
### Added
- Allow defining custom `errorCode` field

## [0.1.1] - 2021-08-23
### Added
- Too many requests error
- temporary console log to error handling

## [0.1.0] - 2021-08-18
### Added
- validationCompiler
### Changed
- errorHandler handles schema validation messages automatically
### Dev
- deps upgrade

## [0.0.1] - 2021-08-14
### Added
- first version
- errorHandler
- consoleLogger
