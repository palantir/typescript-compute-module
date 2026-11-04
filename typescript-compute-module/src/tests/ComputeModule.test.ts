import { Type } from "@sinclair/typebox";
import { ComputeModule } from "../ComputeModule";

const definitions = {
  greeting: {
    input: Type.Object({ name: Type.String() }),
    output: Type.String(),
  },
};

type Module = ComputeModule<{ definitions: typeof definitions }>;

describe("ComputeModule handler types", () => {
  it("accepts synchronous and asynchronous responses with schema-derived types", async () => {
    type Listener = Parameters<Module["register"]>[1];
    const sync: Listener = ({ name }) => name;
    const async: Listener = async ({ name }) => name;
    // @ts-expect-error Response types must match the output schema.
    const wrongOutput: Listener = () => 42;
    // @ts-expect-error Promise results must match the output schema.
    const wrongAsyncOutput: Listener = async () => 42;
    // @ts-expect-error Inputs must match the input schema.
    const wrongInput: Listener = ({ name }: { name: number }) => String(name);

    expect(sync({ name: "World" }, { jobId: "sync" })).toBe("World");
    await expect(async({ name: "World" }, { jobId: "async" })).resolves.toBe("World");
  });

  it("accepts synchronous and asynchronous default responses", async () => {
    type Listener = Parameters<Module["default"]>[0];
    const sync: Listener = () => 42;
    const async: Listener = async () => 42;

    expect(sync({}, "unknown", { jobId: "sync" })).toBe(42);
    await expect(async({}, "unknown", { jobId: "async" })).resolves.toBe(42);
  });
});
