import { waitForJsonFile } from "../fs/waitForFile";
import { Logger } from "../logger";

export interface ResourceAliasesFile {
  [alias: string]: Resource;
}

export interface Resource {
  rid: string;
  branch?: string;
}

export class ResourceAliases {
  private _resourceAliasesPromise: Promise<ResourceAliasesFile> | null = null;

  constructor(private resourceAliasesPath: string, private logger?: Logger) {}

  public async getAlias(alias: string): Promise<Resource | null> {
    const resourceAliases = await this.resourceAliases;
    return resourceAliases[alias] ?? null;
  }

  private get resourceAliases(): Promise<ResourceAliasesFile> {
    return (this._resourceAliasesPromise ??= this.loadResourceAliases());
  }

  private async loadResourceAliases(): Promise<ResourceAliasesFile> {
    const content = await waitForJsonFile<ResourceAliasesFile>(
      this.resourceAliasesPath
    );
    this.logger?.log(`Loaded resource aliases: ${JSON.stringify(content)}`);
    return content;
  }
}
