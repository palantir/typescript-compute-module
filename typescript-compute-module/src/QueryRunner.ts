import { AsyncLocalStorage } from "node:async_hooks";
import { HttpStatusCode, isAxiosError } from "axios";
import { Logger } from "./logger";
import { Static, TObject } from "@sinclair/typebox";
import {
  ComputeModuleApi,
  formatAxiosErrorResponse,
  sanitizeAxiosError,
} from "./api/ComputeModuleApi";
import { SupportedTypeboxTypes } from "./api/convertJsonSchematoFoundrySchema";
import { PassThrough } from "stream";
import { finished } from "stream/promises";

export interface QueryResponseMapping {
  [queryType: string]: {
    input: TObject;
    output: SupportedTypeboxTypes;
  };
}

export type QueryListener<M extends QueryResponseMapping> =
  | {
      type: "response";
      listener: ResponseQueryListener<M>;
    }
  | {
      type: "streaming";
      listener: StreamingQueryListener<M>;
    };

export type StreamingQueryListener<M extends QueryResponseMapping> = <
  T extends keyof M
>(
  message: Static<M[T]["input"]>,
  responseStream: {
    write: (chunk: Buffer | Uint8Array | string) => void;
    end: () => void;
  },
  context: QueryContext
) => void;

export interface QueryContext {
  jobId: string;
}

export const queryContextStorage = new AsyncLocalStorage<QueryContext>();

export type ResponseQueryListener<M extends QueryResponseMapping> = <
  T extends keyof M
>(
  message: Static<M[T]["input"]>,
  context: QueryContext
) => Static<M[T]["output"]> | Promise<Static<M[T]["output"]>>;

export type DefaultQueryListener = (
  query: any,
  queryType: string,
  context: QueryContext
) => any;

export class QueryRunner<M extends QueryResponseMapping> {
  private isResponsive = false;

  private responsiveEventListeners: Set<() => void> = new Set();

  constructor(
    private readonly listeners: Partial<{
      [K in keyof M]: QueryListener<Pick<M, K>>;
    }>,
    private defaultListener?: DefaultQueryListener,
    private readonly logger?: Logger
  ) {}

  async run(computeModuleApi: ComputeModuleApi) {
    while (true) {
      try {
        const jobRequest = await computeModuleApi.getJobRequest();

        if (
          !this.isResponsive &&
          jobRequest.status.toString().startsWith("2")
        ) {
          // If this is the first job, set the module as responsive
          this.setResponsive();
        }

        if (jobRequest.status === HttpStatusCode.Ok) {
          const { query, queryType, jobId } =
            jobRequest.data.computeModuleJobV1;
          const context: QueryContext = { jobId };
          this.logger?.info(`Job received - Query: ${queryType}`, { job_id: jobId });

          queryContextStorage.run(context, () => {
            this.dispatchJob(computeModuleApi, queryType, query, context);
          });
        }
      } catch (e) {
        if (!isAxiosError(e)) {
          this.logger?.error(`Error running module: ${e}`);
          continue;
        }
        if (!this.isResponsive && e.code === "ECONNREFUSED") {
          continue;
        }
        // Sanitize the error before logging to prevent sensitive data leakage
        const sanitizedError = sanitizeAxiosError(e);
        this.logger?.error(
          `Error running module - Network Error: ${formatAxiosErrorResponse(sanitizedError)}`
        );
      }
    }
  }

  public on(_eventName: "responsive", listener: () => void) {
    if (this.isResponsive) {
      listener();
    } else {
      this.responsiveEventListeners.add(listener);
    }
  }

  private setResponsive() {
    this.isResponsive = true;
    this.responsiveEventListeners.forEach((listener) => listener());
  }

  public updateDefaultListener(defaultListener: DefaultQueryListener) {
    this.defaultListener = defaultListener;
  }

  private dispatchJob(
    computeModuleApi: ComputeModuleApi,
    queryType: string,
    query: any,
    context: QueryContext
  ): void {
    const { jobId } = context;
    const listener = this.listeners[queryType];

    if (listener?.type === "response") {
      // Defer invocation so synchronous throws follow the job error path too
      Promise.resolve()
        .then(() => listener.listener(query, context))
        .then((response) => computeModuleApi.postResult(jobId, response))
        .catch((error) => this.handleJobError(computeModuleApi, jobId, "job", error));
      return;
    }

    if (listener?.type === "streaming") {
      void this.dispatchStreamingJob(
        computeModuleApi,
        listener.listener,
        query,
        context
      );
      return;
    }

    if (this.defaultListener != null) {
      const defaultListener = this.defaultListener;
      Promise.resolve()
        .then(() => defaultListener(query, queryType, context))
        .then((response) =>
          computeModuleApi.postResult(
            jobId,
            // Convert number to string as per response spec
            typeof response === "number" ? response.toString() : response
          )
        )
        .catch((error) => this.handleJobError(computeModuleApi, jobId, "default listener", error));
      return;
    }

    this.logger?.error(`No listener for query type: ${queryType}`);
  }

  private async dispatchStreamingJob<N extends QueryResponseMapping>(
    computeModuleApi: ComputeModuleApi,
    listener: StreamingQueryListener<N>,
    query: any,
    context: QueryContext
  ): Promise<void> {
    const { jobId } = context;
    const writable = new PassThrough();
    let result: unknown;
    try {
      result = listener(query, writable, context);
    } catch (error) {
      writable.destroy();
      this.handleJobError(computeModuleApi, jobId, "streaming job", error);
      return;
    }

    try {
      // Start uploading before awaiting the producer so backpressure cannot block it
      await Promise.all([
        result,
        Promise.resolve().then(() =>
          computeModuleApi.postStreamingResult(jobId, writable)
        ),
        // Observe stream errors even if the upload fails before attaching its listeners
        finished(writable),
      ]);
    } catch (error) {
      const sanitizedError = this.logJobError(jobId, "streaming job", error);
      writable.destroy(
        sanitizedError instanceof Error
          ? sanitizedError
          : new Error(String(sanitizedError))
      );
    }
  }

  private handleJobError(
    computeModuleApi: ComputeModuleApi,
    jobId: string,
    label: string,
    error: unknown
  ): void {
    const sanitizedError = this.logJobError(jobId, label, error);
    computeModuleApi.postResult(jobId, QueryRunner.getFailedQueryResult(sanitizedError));
  }

  private logJobError(jobId: string, label: string, error: unknown): unknown {
    const sanitizedError = isAxiosError(error) ? sanitizeAxiosError(error) : error;
    this.logger?.error(`Error executing ${label}: ${sanitizedError}`, { job_id: jobId });
    return sanitizedError;
  }

  private static getFailedQueryResult(error: any): Record<string, string> {
    return { "error": error.toString(),
             ...(error instanceof Error &&
              { "error": error.name, "reason": error.message })
    };
  }
}
