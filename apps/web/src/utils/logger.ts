type LogArgs = Parameters<typeof console.log>;
type WarnArgs = Parameters<typeof console.warn>;
type ErrorArgs = Parameters<typeof console.error>;

const isProd = import.meta.env.PROD;

export const logger = {
  debug: (...args: LogArgs) => {
    if (!isProd) {
      console.log(...args);
    }
  },
  info: (...args: LogArgs) => {
    if (!isProd) {
      console.log(...args);
    }
  },
  user: (...args: LogArgs) => {
    console.log(...args);
  },
  warn: (...args: WarnArgs) => {
    console.warn(...args);
  },
  error: (...args: ErrorArgs) => {
    console.error(...args);
  },
};
