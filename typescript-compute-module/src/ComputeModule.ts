import { Logger, loggerToInstanceLogger } from "./logger";
import {
  QueryListener,
  QueryResponseMapping,
  QueryRunner,
} from "./QueryRunner";
import {
  ComputeModuleApi,
} from "./api/ComputeModuleApi";
import { convertJsonSchemaToCustomSchema } from "./api/convertJsonSchematoFoundrySchema";
import { Static } from "@sinclair/typebox";
import { SourceCredentials } from "./sources/SourceCredentials";
import { waitForFile } from "./fs/waitForFile";
import { ResourceAliases } from "./resources/ResourceAliases";
import { Environment } from "./environment/types";

export interface ComputeModuleOptions<M extends QueryResponseMapping = any> {
  /**
   * Definitions for the queries that the module will respond to, defined using typebox.
   * @example
   * ```typescript
   * import { Type } from "@sinclair/typebox";
   * const definitions = {
   *    "isFirstName": {
   *        input: Type.String(),
   *        output: Type.Boolean(),
   *      },
   * };
   * ```
   *
   * If not provided, functions will not be autoregistered and typesafety will not be provided.
   */
  definitions?: M;
  /**
   * Logger to use for logging, if not provided, no logging will be done.
   * This interface accepts console, winston, or any other object that has the same methods as console.
   */
  logger?: Logger;
  /**
   * Instance ID to use for logging, if not provided no instance ID will be added
   */
  instanceId?: string;
  /**
   * If the module should automatically register queries with the runtime, defaults to true.
   *
   * Can be set to false to enable typesafety without registering the queries.
   */
  isAutoRegistered?: boolean;
}

export class ComputeModule<M extends QueryResponseMapping> {
  // Environment variables
  private static GET_JOB_URI = "GET_JOB_URI";
  private static POST_RESULT_URI = "POST_RESULT_URI";
  private static POST_SCHEMA_URI = "POST_SCHEMA_URI";

  // Known mounted files
  private static SOURCE_CREDENTIALS = "SOURCE_CREDENTIALS";
  private static RESOURCE_ALIAS_MAP = "RESOURCE_ALIAS_MAP";
  private static DEFAULT_CA_PATH = "DEFAULT_CA_PATH";
  private static MODULE_AUTH_TOKEN = "MODULE_AUTH_TOKEN";
  private static BUILD2_TOKEN = "BUILD2_TOKEN";

  private sourceCredentials: SourceCredentials | null;
  private resourceAliases: ResourceAliases | null;
  private logger?: Logger;
  private queryRunner: QueryRunner<M>;
  private definitions?: M;
  private shouldAutoRegister: boolean;

  private listeners: Partial<{
    [K in keyof M]: QueryListener<Pick<M, K>>;
  }> = {};
  private defaultListener?: (data: any, queryName: string) => Promise<any>;

  constructor({
    logger,
    instanceId,
    definitions,
    isAutoRegistered,
  }: ComputeModuleOptions<M>) {
    this.logger =
      logger != null ? loggerToInstanceLogger(logger, instanceId) : undefined;
    this.definitions = definitions;
    this.shouldAutoRegister = isAutoRegistered ?? true;

    const sourceCredentialsPath = process.env[ComputeModule.SOURCE_CREDENTIALS];
    this.sourceCredentials =
      sourceCredentialsPath != null
        ? new SourceCredentials(sourceCredentialsPath)
        : null;

    const resourceAliasMap = process.env[ComputeModule.RESOURCE_ALIAS_MAP];
    this.resourceAliases =
      resourceAliasMap != null
        ? new ResourceAliases(resourceAliasMap, this.logger)
        : null;

    this.queryRunner = new QueryRunner<M>(
      this.listeners,
      this.defaultListener,
      this.logger
    );

    if (process.env.NODE_ENV === "development") {
      console.warn("Inactive module - running in dev mode");
      return;
    }

    this.initialize();
  }

  /**
   * Adds a listener for a specific query, only one response listener can be added per query
   * @param queryName Foundry query name to respond to
   * @param listener Function to run when the query is received
   * @returns
   */
  public register<T extends keyof M>(
    queryName: T,
    listener: (data: Static<M[T]["input"]>) => Promise<Static<M[T]["output"]>>
  ) {
    this.listeners[queryName] = listener;
    return this;
  }

  /**
   * Adds a listener for events within the compute module
   * - responsive: When the module is responsive and can receive queries
   * @returns
   */
  public on(_eventName: "responsive", listener: () => void) {
    this.queryRunner?.on("responsive", listener);
    return this;
  }

  /**
   * Adds a default listener for when no other listener is found for a query
   * @param listener Function to run when the query is received
   * @returns
   */
  public default(listener: (data: any, queryName: string) => Promise<any>) {
    this.defaultListener = listener;
    this.queryRunner?.updateDefaultListener(listener);
    return this;
  }

  private async initialize() {
    const computeModuleApi = new ComputeModuleApi({
      getJobUri: process.env[ComputeModule.GET_JOB_URI] ?? "",
      postResultUri: process.env[ComputeModule.POST_RESULT_URI] ?? "",
      postSchemaUri: process.env[ComputeModule.POST_SCHEMA_URI] ?? "",
      trustStore: waitForFile(
        process.env[ComputeModule.DEFAULT_CA_PATH] ?? ""
      ),
      moduleAuthToken: waitForFile(
        process.env[ComputeModule.MODULE_AUTH_TOKEN] ?? ""
      ),
    });

    this.queryRunner.on("responsive", () => {
      this.logger?.info("Module is responsive");
      if (this.definitions && this.shouldAutoRegister) {
        const schemas = Object.entries(this.definitions).map(
          ([queryName, query]) =>
            convertJsonSchemaToCustomSchema(
              queryName,
              query.input,
              query.output
            )
        );
        this.logger?.info(`Posting schemas: ${JSON.stringify(schemas)}`);
        try {
          computeModuleApi.postSchema(schemas);
        } catch (e) {
          this.logger?.error(`Error posting schemas: ${e}`);
        }
      }
    });

    this.queryRunner.run(computeModuleApi);
  }

  public async getCredential(sourceApiName: string, credentialName: string) {
    if (this.sourceCredentials == null) {
      throw new Error(
        "No source credentials mounted. This implies the SOURCE_CREDENTIALS environment variable has not been set, ensure you have set sources mounted on the Compute Module."
      );
    }
    return this.sourceCredentials.getCredential(sourceApiName, credentialName);
  }

  public async getResource(alias: string) {
    if (this.resourceAliases == null) {
      throw new Error(
        "No resource aliases mounted. This implies the RESOURCE_ALIAS_MAP environment variable has not been set, ensure you have set resources mounted on the Compute Module."
      );
    }
    return this.resourceAliases.getAlias(alias);
  }

  /**
   * Returns the environment and tokens for the current execution mode
   */
  public async getEnvironment(): Promise<Environment> {
    const buildTokenPath = process.env[ComputeModule.BUILD2_TOKEN];
    if (buildTokenPath != null) {
      return {
        type: "pipelines",
        buildToken: await waitForFile(buildTokenPath),
      };
    }
    return {
      type: "functions",
    };
  }
}
