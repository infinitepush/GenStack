import demoConfig from "../../../configs/example-app.json";
import { normalizeAppConfig } from "./config-engine";

export const appConfigResult = normalizeAppConfig(demoConfig);
export const appConfig = appConfigResult.config;
