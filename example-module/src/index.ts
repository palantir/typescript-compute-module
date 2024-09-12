import { ComputeModule } from "@palantir/compute-module";
import { Type } from "@sinclair/typebox";

const computeModule = new ComputeModule({
  logger: console,
  isAutoRegistered: false,
  definitions: {
    getEnv: {
      input: Type.Object({}),
      output: Type.Object({}),
    },
    wait: {
      input: Type.Object({
        waitMs: Type.Number(),
        value: Type.Object({}),
      }),
      output: Type.Object({}),
    },
    getCredential: {
      input: Type.Object({
        source: Type.String(),
        key: Type.String(),
      }),
      output: Type.String(),
    },
    testEgress: {
      input: Type.Object({}),
      output: Type.String(),
    },
    openFile: {
      input: Type.Object({
        path: Type.String(),
      }),
      output: Type.String(),
    },
    testOutput: {
      input: Type.Object({}),
      output: Type.String(),
    },
  },
});

computeModule
  .on("responsive", () => {
    console.log("[Example Module] Responsive");
  })
  .register("wait", async (v) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(v.value);
      }, v.waitMs);
    });
  })
  .register("getEnv", async () => {
    return process.env;
  })
  .register("getCredential", async (v) => {
    return (await computeModule.getCredential(v.source, v.key)) ?? "Not found";
  })
  .register("openFile", async (v) => {
    const fileContents = require("fs").readFileSync(v.path, "utf-8");
    return fileContents;
  });
