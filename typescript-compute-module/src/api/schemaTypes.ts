export interface Schema {
  name: string;
  inputType: Schema.StructType["structType"];
  outputType: Schema.DataType;
}

export namespace Schema {
  export interface Entry {
    name: string;
    type: DataType;
  }

  export interface StructType {
    type: "structType";
    structType: {
      fields: Entry[];
    };
  }

  export interface ListType {
    type: "listType";
    elementType: DataType;
  }

  export type DataType = PrimitiveType | ComplexType | UnknownType;

  export interface PrimitiveType {
    type: "primitiveType";
    primitiveType: "BOOL" | "INT" | "FLOAT" | "STRING";
  }

  export interface ComplexType {
    type: "complexType";
    complexType: StructType | ListType;
  }

  export interface UnknownType {
    type: "unknownType";
    unknownType: {};
  }
}
