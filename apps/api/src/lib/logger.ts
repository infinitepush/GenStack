import pino from "pino";

export const logger = pino({
  name: "genstack-api",
  level: process.env.LOG_LEVEL ?? "info"
});
