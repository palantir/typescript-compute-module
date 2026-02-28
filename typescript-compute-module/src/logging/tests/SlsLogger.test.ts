import { SlsLogger } from "../SlsLogger";
import { queryContextStorage } from "../../QueryRunner";

describe("SlsLogger", () => {
  let writtenLines: string[];
  const originalWrite = process.stdout.write;
  const originalEnv = process.env;

  function parseEntry(index = 0): Record<string, any> {
    return JSON.parse(writtenLines[index]);
  }

  beforeEach(() => {
    writtenLines = [];
    process.stdout.write = ((chunk: string) => {
      writtenLines.push(chunk);
      return true;
    }) as typeof process.stdout.write;
    process.env = { ...originalEnv, COMPUTE_SESSION_ID: "test-session" };
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
    process.env = originalEnv;
  });

  it("should write SLS-formatted JSON to stdout", () => {
    const logger = new SlsLogger();
    logger.info("hello world");

    expect(writtenLines).toHaveLength(1);
    const entry = parseEntry();
    expect(entry.type).toBe("service.1");
    expect(entry.level).toBe("INFO");
    expect(entry.safe).toBe(true);
    expect(entry.message).toBe("hello world");
    expect(entry.time).toBeDefined();
  });

  it("should set origin to caller filename:line", () => {
    const logger = new SlsLogger();
    logger.info("origin test");

    const entry = parseEntry();
    // origin should be "SlsLogger.test.ts:<line>" since the call originates here
    expect(entry.origin).toMatch(/^SlsLogger\.test\.ts:\d+$/);
  });

  it("should set thread to current thread name", () => {
    const logger = new SlsLogger();
    logger.info("thread test");

    const entry = parseEntry();
    // Tests run on the main thread
    expect(entry.thread).toBe("main");
  });

  it("should auto-inject session_id, process_id, and job_id into params", () => {
    const logger = new SlsLogger();
    logger.info("auto params");

    const entry = parseEntry();
    expect(entry.params.session_id).toBe("test-session");
    expect(entry.params.process_id).toBe(String(process.pid));
    expect(entry.params.job_id).toBe("");
  });

  it("should default session_id to empty string when env var is unset", () => {
    delete process.env.COMPUTE_SESSION_ID;
    const logger = new SlsLogger();
    logger.info("no session");

    expect(parseEntry().params.session_id).toBe("");
  });

  it("should read job_id from AsyncLocalStorage context", () => {
    const logger = new SlsLogger();
    queryContextStorage.run({ jobId: "job-123" }, () => {
      logger.info("with job");
    });

    expect(parseEntry().params.job_id).toBe("job-123");
  });

  it("should merge user params with auto-injected params", () => {
    const logger = new SlsLogger();
    logger.info("with extra", { extra: "value" });

    const entry = parseEntry();
    expect(entry.params.extra).toBe("value");
    expect(entry.params.session_id).toBe("test-session");
    expect(entry.params.process_id).toBe(String(process.pid));
    expect(entry.params.job_id).toBe("");
  });

  it("should filter out undefined param values", () => {
    const logger = new SlsLogger();
    logger.info("partial params", {
      myParam: undefined,
      extra: "value",
    });

    const entry = parseEntry();
    expect(entry.params.extra).toBe("value");
    expect(entry.params.process_id).toBe(String(process.pid));
    expect("myParam" in entry.params).toBe(false);
  });

  it("should map log levels correctly", () => {
    const logger = new SlsLogger();
    logger.debug("a");
    logger.log("b");
    logger.info("c");
    logger.warn("d");
    logger.error("e");

    const levels = writtenLines.map((l) => JSON.parse(l).level);
    expect(levels).toEqual(["DEBUG", "INFO", "INFO", "WARN", "ERROR"]);
  });
});
