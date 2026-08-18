import { getEslintConfig } from "@ezez/eslint";
import { readFile } from "fs/promises";

const packageJson = JSON.parse(String(await readFile("./package.json")));
const react = Boolean(packageJson.libraryTemplate?.jsx);

const config = getEslintConfig({ react });

// `@ezez/eslint` only relaxes its rules for `*.spec.*` files. `src/__test/` holds shared test helpers that are
// imported by the spec files (and must NOT be named `*.spec.ts`, or jest would try to run them as suites), so the
// same treatment is applied to them here.
const testHelpers = {
    name: "Test helpers in src/__test",
    files: ["src/__test/**/*.ts"],
    languageOptions: {
        globals: Object.fromEntries([
            "afterAll", "afterEach", "beforeAll", "beforeEach", "describe", "expect", "it", "jest", "test",
        ].map(name => [name, "readonly"])),
    },
    rules: {
        "max-lines": "off",
        "max-lines-per-function": "off",
        "max-statements": "off",
        "no-magic-numbers": "off",
        "func-names": "off",
        "@typescript-eslint/no-magic-numbers": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unnecessary-condition": "off",
        "@typescript-eslint/require-await": "off",
    },
};

export default [...config, testHelpers];
