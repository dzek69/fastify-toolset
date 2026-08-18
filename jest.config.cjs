module.exports = {
  "collectCoverageFrom": [
    "src/**/*.{mjs,js,jsx,ts,tsx}",
    "!**/*.d.ts"
  ],
  "setupFiles": [
    "<rootDir>/test/bootstrap.cjs"
  ],
  "moduleNameMapper": {
    // strips the ESM `.js` extension from *relative* imports only - the dot must be escaped and the specifier
    // anchored to `./` or `../`, otherwise package names like `uri-js` or `ipaddr.js` get mangled too
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  "testEnvironmentOptions": {
    "url": "http://localhost:8080"
  },
  "transform": {
    "\\.[jt]sx?$": [
      "babel-jest",
      {
        "configFile": "./test/babel.config.cjs"
      }
    ]
  }
};
