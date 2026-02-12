import { Type } from "@sinclair/typebox";
import { HttpStatusCode } from "axios";
import { QueryRunner, QueryResponseMapping, QueryContext } from "../QueryRunner";
import { ComputeModuleApi } from "../api/ComputeModuleApi";

const TEST_QUERY_MAPPING = {
  testQuery: {
    input: Type.Object({
      name: Type.String(),
    }),
    output: Type.String(),
  },
} satisfies QueryResponseMapping;

describe("QueryRunner", () => {
  let mockComputeModuleApi: jest.Mocked<ComputeModuleApi>;

  beforeEach(() => {
    mockComputeModuleApi = {
      getJobRequest: jest.fn(),
      postResult: jest.fn().mockResolvedValue(undefined),
      postStreamingResult: jest.fn(),
      postSchema: jest.fn(),
    } as unknown as jest.Mocked<ComputeModuleApi>;
  });

  describe("QueryContext", () => {
    it("should pass QueryContext with jobId to response listeners", async () => {
      const jobId = "test-job-id-123";
      const receivedContexts: (QueryContext | undefined)[] = [];

      const responseListener = jest.fn(
        async (message: { name: string }, context?: QueryContext) => {
          receivedContexts.push(context);
          return `Hello, ${message.name}`;
        }
      );

      mockComputeModuleApi.getJobRequest
        .mockResolvedValueOnce({
          status: HttpStatusCode.Ok,
          data: {
            type: "computeModuleJobV1",
            computeModuleJobV1: {
              jobId,
              queryType: "testQuery",
              query: { name: "World" },
            },
          },
        } as any)
        .mockImplementation(() => new Promise(() => {})); // Block on second call

      const queryRunner = new QueryRunner<typeof TEST_QUERY_MAPPING>({
        testQuery: {
          type: "response",
          listener: responseListener,
        },
      });

      // Run in background and wait for the listener to be called
      const runPromise = queryRunner.run(mockComputeModuleApi);

      // Wait for the listener to be invoked
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(responseListener).toHaveBeenCalledTimes(1);
      expect(responseListener).toHaveBeenCalledWith(
        { name: "World" },
        { jobId }
      );
      expect(receivedContexts).toHaveLength(1);
      expect(receivedContexts[0]).toEqual({ jobId });
    });

    it("should pass QueryContext with jobId to streaming listeners", async () => {
      const jobId = "streaming-job-id-456";
      const receivedContexts: (QueryContext | undefined)[] = [];

      const streamingListener = jest.fn(
        (
          message: { name: string },
          responseStream: { write: (chunk: any) => void; end: () => void },
          context?: QueryContext
        ) => {
          receivedContexts.push(context);
          responseStream.write(`Hello, ${message.name}`);
          responseStream.end();
        }
      );

      mockComputeModuleApi.getJobRequest
        .mockResolvedValueOnce({
          status: HttpStatusCode.Ok,
          data: {
            type: "computeModuleJobV1",
            computeModuleJobV1: {
              jobId,
              queryType: "testQuery",
              query: { name: "Stream" },
            },
          },
        } as any)
        .mockImplementation(() => new Promise(() => {})); // Block on second call

      const queryRunner = new QueryRunner<typeof TEST_QUERY_MAPPING>({
        testQuery: {
          type: "streaming",
          listener: streamingListener,
        },
      });

      // Run in background
      const runPromise = queryRunner.run(mockComputeModuleApi);

      // Wait for the listener to be invoked
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(streamingListener).toHaveBeenCalledTimes(1);
      expect(streamingListener).toHaveBeenCalledWith(
        { name: "Stream" },
        expect.objectContaining({
          write: expect.any(Function),
          end: expect.any(Function),
        }),
        { jobId }
      );
      expect(receivedContexts).toHaveLength(1);
      expect(receivedContexts[0]).toEqual({ jobId });
    });

    it("should pass different jobIds for different jobs", async () => {
      const jobIds = ["job-1", "job-2"];
      const receivedContexts: (QueryContext | undefined)[] = [];
      let callCount = 0;

      const responseListener = jest.fn(
        async (message: { name: string }, context?: QueryContext) => {
          receivedContexts.push(context);
          return `Response ${++callCount}`;
        }
      );

      mockComputeModuleApi.getJobRequest
        .mockResolvedValueOnce({
          status: HttpStatusCode.Ok,
          data: {
            type: "computeModuleJobV1",
            computeModuleJobV1: {
              jobId: jobIds[0],
              queryType: "testQuery",
              query: { name: "First" },
            },
          },
        } as any)
        .mockResolvedValueOnce({
          status: HttpStatusCode.Ok,
          data: {
            type: "computeModuleJobV1",
            computeModuleJobV1: {
              jobId: jobIds[1],
              queryType: "testQuery",
              query: { name: "Second" },
            },
          },
        } as any)
        .mockImplementation(() => new Promise(() => {})); // Block on third call

      const queryRunner = new QueryRunner<typeof TEST_QUERY_MAPPING>({
        testQuery: {
          type: "response",
          listener: responseListener,
        },
      });

      // Run in background
      const runPromise = queryRunner.run(mockComputeModuleApi);

      // Wait for both listeners to be invoked
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(responseListener).toHaveBeenCalledTimes(2);
      expect(receivedContexts).toHaveLength(2);
      expect(receivedContexts[0]).toEqual({ jobId: jobIds[0] });
      expect(receivedContexts[1]).toEqual({ jobId: jobIds[1] });
    });
  });

  describe("backward compatibility", () => {
    it("should work with response listeners that only accept message parameter", async () => {
      const jobId = "compat-job-123";
      const receivedMessages: { name: string }[] = [];

      // Listener that only accepts message, ignoring context (backward compatible)
      const responseListener = jest.fn(async (message: { name: string }) => {
        receivedMessages.push(message);
        return `Hello, ${message.name}`;
      });

      mockComputeModuleApi.getJobRequest
        .mockResolvedValueOnce({
          status: HttpStatusCode.Ok,
          data: {
            type: "computeModuleJobV1",
            computeModuleJobV1: {
              jobId,
              queryType: "testQuery",
              query: { name: "BackwardCompat" },
            },
          },
        } as any)
        .mockImplementation(() => new Promise(() => {}));

      const queryRunner = new QueryRunner<typeof TEST_QUERY_MAPPING>({
        testQuery: {
          type: "response",
          listener: responseListener,
        },
      });

      queryRunner.run(mockComputeModuleApi);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(responseListener).toHaveBeenCalledTimes(1);
      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toEqual({ name: "BackwardCompat" });

      // Verify postResult was called with the correct response
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockComputeModuleApi.postResult).toHaveBeenCalledWith(
        jobId,
        "Hello, BackwardCompat"
      );
    });

    it("should work with streaming listeners that only accept message and stream parameters", async () => {
      const jobId = "compat-stream-456";
      const receivedMessages: { name: string }[] = [];
      const writtenChunks: string[] = [];

      // Listener that only accepts message and stream, ignoring context (backward compatible)
      const streamingListener = jest.fn(
        (
          message: { name: string },
          responseStream: { write: (chunk: any) => void; end: () => void }
        ) => {
          receivedMessages.push(message);
          const chunk = `Hello, ${message.name}`;
          writtenChunks.push(chunk);
          responseStream.write(chunk);
          responseStream.end();
        }
      );

      mockComputeModuleApi.getJobRequest
        .mockResolvedValueOnce({
          status: HttpStatusCode.Ok,
          data: {
            type: "computeModuleJobV1",
            computeModuleJobV1: {
              jobId,
              queryType: "testQuery",
              query: { name: "StreamCompat" },
            },
          },
        } as any)
        .mockImplementation(() => new Promise(() => {}));

      const queryRunner = new QueryRunner<typeof TEST_QUERY_MAPPING>({
        testQuery: {
          type: "streaming",
          listener: streamingListener,
        },
      });

      queryRunner.run(mockComputeModuleApi);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(streamingListener).toHaveBeenCalledTimes(1);
      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toEqual({ name: "StreamCompat" });
      expect(writtenChunks).toEqual(["Hello, StreamCompat"]);

      // Verify postStreamingResult was called
      expect(mockComputeModuleApi.postStreamingResult).toHaveBeenCalledWith(
        jobId,
        expect.anything()
      );
    });
  });

  describe("default listener", () => {
    it("should invoke default listener when no specific listener is registered for query type", async () => {
      const jobId = "default-listener-job-123";
      const receivedContexts: QueryContext[] = [];
      const receivedQueryTypes: string[] = [];

      const defaultListener = jest.fn(
        async (query: any, queryType: string, context: QueryContext) => {
          receivedContexts.push(context);
          receivedQueryTypes.push(queryType);
          return `Default response for ${queryType}`;
        }
      );

      mockComputeModuleApi.getJobRequest
        .mockResolvedValueOnce({
          status: HttpStatusCode.Ok,
          data: {
            type: "computeModuleJobV1",
            computeModuleJobV1: {
              jobId,
              queryType: "unknownQuery",
              query: { data: "test" },
            },
          },
        } as any)
        .mockImplementation(() => new Promise(() => {}));

      const queryRunner = new QueryRunner<typeof TEST_QUERY_MAPPING>(
        {},
        defaultListener
      );

      queryRunner.run(mockComputeModuleApi);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(defaultListener).toHaveBeenCalledTimes(1);
      expect(defaultListener).toHaveBeenCalledWith(
        { data: "test" },
        "unknownQuery",
        { jobId }
      );
      expect(receivedContexts).toHaveLength(1);
      expect(receivedContexts[0]).toEqual({ jobId });
      expect(receivedQueryTypes).toEqual(["unknownQuery"]);

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockComputeModuleApi.postResult).toHaveBeenCalledWith(
        jobId,
        "Default response for unknownQuery"
      );
    });

    it("should convert number responses to string in default listener", async () => {
      const jobId = "number-response-job";

      const defaultListener = jest.fn(async () => 42);

      mockComputeModuleApi.getJobRequest
        .mockResolvedValueOnce({
          status: HttpStatusCode.Ok,
          data: {
            type: "computeModuleJobV1",
            computeModuleJobV1: {
              jobId,
              queryType: "numberQuery",
              query: {},
            },
          },
        } as any)
        .mockImplementation(() => new Promise(() => {}));

      const queryRunner = new QueryRunner<typeof TEST_QUERY_MAPPING>(
        {},
        defaultListener
      );

      queryRunner.run(mockComputeModuleApi);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockComputeModuleApi.postResult).toHaveBeenCalledWith(
        jobId,
        "42"
      );
    });

    it("should handle errors in default listener", async () => {
      const jobId = "error-job-456";

      const defaultListener = jest.fn(async () => {
        throw new Error("Default listener error");
      });

      mockComputeModuleApi.getJobRequest
        .mockResolvedValueOnce({
          status: HttpStatusCode.Ok,
          data: {
            type: "computeModuleJobV1",
            computeModuleJobV1: {
              jobId,
              queryType: "failingQuery",
              query: {},
            },
          },
        } as any)
        .mockImplementation(() => new Promise(() => {}));

      const queryRunner = new QueryRunner<typeof TEST_QUERY_MAPPING>(
        {},
        defaultListener
      );

      queryRunner.run(mockComputeModuleApi);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockComputeModuleApi.postResult).toHaveBeenCalledWith(
        jobId,
        expect.objectContaining({
          error: "Error",
          reason: "Default listener error",
        })
      );
    });

    it("should prefer specific listener over default listener", async () => {
      const jobId = "specific-listener-job";

      const specificListener = jest.fn(async () => "specific response");
      const defaultListener = jest.fn(async () => "default response");

      mockComputeModuleApi.getJobRequest
        .mockResolvedValueOnce({
          status: HttpStatusCode.Ok,
          data: {
            type: "computeModuleJobV1",
            computeModuleJobV1: {
              jobId,
              queryType: "testQuery",
              query: { name: "Test" },
            },
          },
        } as any)
        .mockImplementation(() => new Promise(() => {}));

      const queryRunner = new QueryRunner<typeof TEST_QUERY_MAPPING>(
        {
          testQuery: {
            type: "response",
            listener: specificListener,
          },
        },
        defaultListener
      );

      queryRunner.run(mockComputeModuleApi);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(specificListener).toHaveBeenCalledTimes(1);
      expect(defaultListener).not.toHaveBeenCalled();
    });

    it("should allow updating default listener via updateDefaultListener", async () => {
      const jobId1 = "job-before-update";
      const jobId2 = "job-after-update";

      const originalListener = jest.fn(async () => "original");
      const updatedListener = jest.fn(async () => "updated");

      let resolveSecondJob: () => void;
      const secondJobPromise = new Promise<void>((resolve) => {
        resolveSecondJob = resolve;
      });

      mockComputeModuleApi.getJobRequest
        .mockResolvedValueOnce({
          status: HttpStatusCode.Ok,
          data: {
            type: "computeModuleJobV1",
            computeModuleJobV1: {
              jobId: jobId1,
              queryType: "dynamicQuery",
              query: {},
            },
          },
        } as any)
        .mockImplementationOnce(async () => {
          await secondJobPromise;
          return {
            status: HttpStatusCode.Ok,
            data: {
              type: "computeModuleJobV1",
              computeModuleJobV1: {
                jobId: jobId2,
                queryType: "dynamicQuery",
                query: {},
              },
            },
          } as any;
        })
        .mockImplementation(() => new Promise(() => {}));

      const queryRunner = new QueryRunner<typeof TEST_QUERY_MAPPING>(
        {},
        originalListener
      );

      queryRunner.run(mockComputeModuleApi);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(originalListener).toHaveBeenCalledTimes(1);
      expect(updatedListener).not.toHaveBeenCalled();

      queryRunner.updateDefaultListener(updatedListener);

      // Release the second job now that listener is updated
      resolveSecondJob!();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(updatedListener).toHaveBeenCalledTimes(1);
      expect(originalListener).toHaveBeenCalledTimes(1); // Still only 1
    });
  });

  describe("responsive event", () => {
    it("should emit responsive event on first successful job request", async () => {
      const responsiveListener = jest.fn();

      mockComputeModuleApi.getJobRequest
        .mockResolvedValueOnce({
          status: HttpStatusCode.Ok,
          data: {
            type: "computeModuleJobV1",
            computeModuleJobV1: {
              jobId: "job-1",
              queryType: "testQuery",
              query: { name: "Test" },
            },
          },
        } as any)
        .mockImplementation(() => new Promise(() => {}));

      const queryRunner = new QueryRunner<typeof TEST_QUERY_MAPPING>({
        testQuery: {
          type: "response",
          listener: async () => "result",
        },
      });

      queryRunner.on("responsive", responsiveListener);

      const runPromise = queryRunner.run(mockComputeModuleApi);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(responsiveListener).toHaveBeenCalledTimes(1);
    });

    it("should immediately call listener if already responsive", async () => {
      const responsiveListener1 = jest.fn();
      const responsiveListener2 = jest.fn();

      mockComputeModuleApi.getJobRequest
        .mockResolvedValueOnce({
          status: HttpStatusCode.Ok,
          data: {
            type: "computeModuleJobV1",
            computeModuleJobV1: {
              jobId: "job-1",
              queryType: "testQuery",
              query: { name: "Test" },
            },
          },
        } as any)
        .mockImplementation(() => new Promise(() => {}));

      const queryRunner = new QueryRunner<typeof TEST_QUERY_MAPPING>({
        testQuery: {
          type: "response",
          listener: async () => "result",
        },
      });

      queryRunner.on("responsive", responsiveListener1);

      const runPromise = queryRunner.run(mockComputeModuleApi);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Register listener after becoming responsive
      queryRunner.on("responsive", responsiveListener2);

      expect(responsiveListener1).toHaveBeenCalledTimes(1);
      expect(responsiveListener2).toHaveBeenCalledTimes(1);
    });
  });
});
