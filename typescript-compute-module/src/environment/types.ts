import { Service } from "./services";

export type Environment = PipelinesEnvironment | FunctionsEnvironment;

export interface PipelinesEnvironment {
    type: "pipelines";
    buildToken: string;
    services: Record<Service, string>;
}

export interface FunctionsEnvironment {
    type: "functions";
}