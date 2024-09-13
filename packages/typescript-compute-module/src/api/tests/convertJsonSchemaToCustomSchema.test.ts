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
      name: "isFirstName",
      inputType: {
        fields: [
          {
            name: "firstName",
            type: {
              type: "primitiveType",
              primitiveType: "STRING",
            },
          },
        ],
      },
      outputType: {
        type: "primitiveType",
        primitiveType: "BOOL",
      },
    });
  });
});
