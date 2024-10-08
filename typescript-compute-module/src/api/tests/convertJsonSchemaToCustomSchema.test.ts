import { Type } from "@sinclair/typebox";
import { convertJsonSchemaToCustomSchema } from "../convertJsonSchematoFoundrySchema";

const EXAMPLE_DEFINITION = {
  isFirstName: {
    input: Type.Object({
      firstName: Type.String(),
    }),
    output: Type.Boolean(),
  },
};

describe("Type tests", () => {
  it("should have the same types", () => {
    const schema = convertJsonSchemaToCustomSchema(
      "isFirstName",
      EXAMPLE_DEFINITION.isFirstName.input,
      EXAMPLE_DEFINITION.isFirstName.output
    );
    expect(schema).toStrictEqual({
      functionName: "isFirstName",
      inputs: [
        {
          name: "firstName",
          required: true,
          dataType: {
            type: "string",
            string: {},
          },
          constraints: [],
        }
      ],
      output: {
        type: "single",
        single: {
          dataType: {
            type: "boolean",
            boolean: {},
          }
        }
      },
    });
  });
});
