import axios from "axios";
import { PassThrough } from "stream";
import { ComputeModuleApi } from "../ComputeModuleApi";

describe("ComputeModuleApi", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the streaming upload promise so callers can handle failures", () => {
    const transport = axios.create();
    const upload = new Promise<never>(() => {});
    const post = jest.spyOn(transport, "post").mockReturnValue(upload);
    jest.spyOn(axios, "create").mockReturnValue(transport);
    const api = new ComputeModuleApi({
      getJobUri: "/jobs",
      postResultUri: "/results",
      postSchemaUri: "/schema",
      trustStore: undefined,
      moduleAuthToken: "test-token",
    });
    const stream = new PassThrough();

    expect(api.postStreamingResult("job", stream)).toBe(upload);
    expect(post).toHaveBeenCalledWith("/results/job", stream, {
      headers: { "Content-Type": "application/octet-stream" },
    });
    stream.destroy();
  });
});
