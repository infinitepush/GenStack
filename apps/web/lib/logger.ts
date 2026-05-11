import pino from "pino";

export const logger = pino({
  name: "genstack-web",
  level: process.env.LOG_LEVEL ?? "info"
});
