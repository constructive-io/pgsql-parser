import { Deparser, DeparserOptions } from "./deparser";

const deparseMethod = Deparser.deparse;

// Export the original sync version as deparseSync
export const deparseSync = deparseMethod;

// Create an async wrapper for deparse
export const deparse = async (...args: Parameters<typeof deparseMethod>): Promise<ReturnType<typeof deparseMethod>> => {
    return deparseMethod(...args);
};

export { Deparser, DeparserOptions };
export { QuoteUtils } from './utils/quote-utils';