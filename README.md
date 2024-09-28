# @palantir/compute-module

[![npm version](https://img.shields.io/npm/v/@palantir%2Fcompute-module?style=flat)](https://www.npmjs.com/package/@palantir/compute-module)

Node.JS compatible implementation of the Palantir Compute Module specification.

- [@palantir/compute-module](#palantircompute-module)
  - [Functions Mode](#functions-mode)
    - [Basic usage](#basic-usage)
    - [Schema registration](#schema-registration)
  - [Pipelines Mode](#pipelines-mode)
    - [Retrieving aliases](#retrieving-aliases)
  - [General usage](#general-usage)
    - [Retrieving source credentials](#retrieving-source-credentials)
    - [Retrieving environment details](#retrieving-environment-details)
    - [Retrieving Foundry services](#retrieving-foundry-services)
  - [Developing the SDK](#developing-the-sdk)
    - [Building the example module](#building-the-example-module)

## Functions Mode

### Basic usage

This library can be used untyped with vanilla JavaScript to generate registerable functions in "Functions" execution mode.

```js
import { ComputeModule } from "@palantir/compute-module";

new ComputeModule()
  .on("addOne", async (n) => n + 1)
  .on("stringify", async (n) => "" + n)
  .default(() => ({ error: "Unsupported query name" }));
```

### Schema registration

Definitions can be generated using [typebox](https://github.com/sinclairzx81/typebox) allowing the Compute Module to register functions at runtime, while maintaining typesafety at compile time.

```ts
import { ComputeModule } from "@palantir/compute-module";
import { Type } from "@sinclair/typebox";

const myModule = new ComputeModule({
  logger: console,
  definitions: {
    addOne: {
      input: Type.Object({
        value: Type.Number(),
      }),
      output: Type.Object({ value: Type.Number() }),
    },
  },
});

myModule.on("addOne", async (n) => n + 1);
```

## Pipelines Mode

### Retrieving aliases

Compute Modules can interact with resources in their execution environment, within Palantir Foundry these are defined as inputs and outputs on the Compute Module spec. Resource identifiers can be unique to the execution environment, so using aliases allows your code to maintain a static reference to known resources. To receive the identifier for an aliases resource, use the `getResource` method.

```ts
const resourceId = myModule.getResource("myResourceAlias");
const result = await someDataFetcherForId(resourceId);
```

## General usage

The following features are available in both Pipelines and Functions mode in order to interact with Palantir Foundry:

### Retrieving source credentials

Sources can be used to store secrets for use within a Compute Module, they prevent you from having to put secrets in your container or in plaintext in the job specification. Retrieving a source credential using this library is simple:

```ts
const myCredential = myModule.getCredential("mySourceApiName", "MyCredential");
```

### Retrieving environment details

At runtime, you can retrieve details about the execution environment, which is useful for authenticating around services available:

```ts
const token =
  myModule.environment.type === "pipelines" ? myModule.environment.buildToken : undefined;
```

### Retrieving Foundry services

At runtime, you can retrieve the api paths for known Foundry services, this allows you to call those endpoints without using a source to ingress back into the platform:

```ts
import { FoundryService } from "@palantir/compute-module";

const streamProxyApi = myModule.getServiceApi(FoundryService.STREAM_PROXY);
```

## Developing the SDK

### Building the example module

Run docker build from the top-level directory (not example-module):

```sh
docker build -f example-module/Dockerfile -t my-container-registry.palantirfoundry.com/example-module:0.0.1 .
```
