import {
  TObject,
  TBoolean,
  TInteger,
  TNumber,
  TString,
  TArray,
  TSchema,
  TypeGuard,
} from "@sinclair/typebox";
import { Schema } from "./schemaTypes";

export type SupportedTypeboxTypes =
  | TObject
  | TBoolean
  | TInteger
  | TNumber
  | TString
  | TArray;

// Function to convert JSON Schema to our custom Schema type
export function convertJsonSchemaToCustomSchema(
  schemaName: string,
  input: TObject | undefined,
  output: SupportedTypeboxTypes
): Schema {
  return {
    name: schemaName,
    inputType:
      input != null
        ? convertPropertiesToStructType(input).structType
        : { fields: [] },
    outputType: convertJsonType(output),
  };
}

function convertPropertiesToStructType({
  properties,
}: TObject): Schema.StructType {
  const entries: Schema.Entry[] = Object.keys(properties).map((key) => ({
    name: key,
    type: convertJsonType(properties[key]),
  }));
  return {
    type: "structType",
    structType: {
      fields: entries,
    },
  };
}

function convertJsonType(jsonType: TSchema): Schema.DataType {
  if (TypeGuard.IsObject(jsonType)) {
    return {
      type: "complexType",
      complexType: convertPropertiesToStructType(jsonType),
    };
  } else if (TypeGuard.IsArray(jsonType)) {
    return {
      type: "complexType",
      complexType: {
        type: "listType",
        elementType: convertJsonType(jsonType.items),
      },
    };
  } else if (TypeGuard.IsBoolean(jsonType)) {
    return { type: "primitiveType", primitiveType: "BOOL" };
  } else if (TypeGuard.IsInteger(jsonType)) {
    return { type: "primitiveType", primitiveType: "INT" };
  } else if (TypeGuard.IsNumber(jsonType)) {
    return { type: "primitiveType", primitiveType: "FLOAT" };
  } else if (TypeGuard.IsString(jsonType)) {
    return { type: "primitiveType", primitiveType: "STRING" };
  } else {
    return { type: "unknownType", unknownType: {} };
  }
}
