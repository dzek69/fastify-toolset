// @TODO very basic
const snakeCaseAllCaps = (string: string) => {
    return string.replace(/ /, "_").toUpperCase();
};

export {
    snakeCaseAllCaps,
};
