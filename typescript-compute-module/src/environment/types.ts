export type Environment = PipelinesEnvironment | FunctionsEnvironment;

export interface PipelinesEnvironment {
    type: "pipelines";
    buildToken: string;
}

export interface FunctionsEnvironment {
    type: "functions";
}