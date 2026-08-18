/**
 * Turns a human readable phrase into an `ALL_CAPS_SNAKE_CASE` identifier.
 *
 * Apostrophes are dropped instead of becoming a separator (so `I'm a teapot` gives `IM_A_TEAPOT`, not `I_M_A_TEAPOT`);
 * every other run of non-alphanumeric characters collapses into a single underscore, which is what makes phrases like
 * `Request-URI Too Long` come out usable.
 *
 * @param string - phrase to convert
 */
const snakeCaseAllCaps = (string: string) => {
    return string
        .replace(/['’]/gu, "")
        .replace(/[^a-z0-9]+/giu, "_")
        .replace(/^_+|_+$/gu, "")
        .toUpperCase();
};

export {
    snakeCaseAllCaps,
};
