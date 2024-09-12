import { waitForJsonFile } from "../fs/waitForFile";
import { Logger } from "../logger";

export interface SourceCredentialsFile {
    [source: string]: {
        [credential: string]: string;
    }
}

export class SourceCredentials {
    private _sourceCredentialsPromise: Promise<SourceCredentialsFile> | null = null;

    constructor(private credentialPath: string, private logger?: Logger) { }

    public async getCredential(sourceApiName: string, credentialName: string): Promise<string | null> {
        const sourceCredentials = await this.sourceCredentials;
        return sourceCredentials[sourceApiName]?.[credentialName] ?? null;
    }

    private get sourceCredentials(): Promise<SourceCredentialsFile> {
        return this._sourceCredentialsPromise ??= this.loadSourceCredentials();
    }

    private async loadSourceCredentials(): Promise<SourceCredentialsFile> {
        const content = await waitForJsonFile<SourceCredentialsFile>(this.credentialPath);
        this.logger?.log(`Loaded credentials: ${JSON.stringify(mapValues(content, obfuscateValues))}`)
        return content;
    }
}

function mapValues<T,V>(object: {[id:string]: V} , mapper: (value:V) => T ):{[id:string]: T} {
    return Object.fromEntries(
        Object.entries(object).map(([key,value]) => [key, mapper(value)])
    )
}

function obfuscateValues(obj: Record<string, string>) {
    return Object.fromEntries(Object.keys(obj).map(key => [key, "****"]));
}