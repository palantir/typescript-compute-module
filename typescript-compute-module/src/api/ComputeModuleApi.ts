import https from "https";
import { Schema } from "./schemaTypes";
import axios from "axios";

export interface ConnectionInformation {
  getJobUri: string; // GET_JOB_URI
  postResultUri: string; // POST_RESULT_URI
  postSchemaUri: string; // POST_SCHEMA_URI
  trustStore: Promise<string>; // DEFAULT_CA_PATH
  moduleAuthToken: Promise<string>; // MODULE_AUTH_TOKEN
}

/**
 * API for interacting with the runtime.
 */
export class ComputeModuleApi {
  private axiosInstance: axios.AxiosInstance | null = null;

  constructor(private connectionInformation: ConnectionInformation) {}

  public getJobRequest = async () => {
    const instance = await this.getAxios();
    return instance.get<{
      type: "computeModuleJobV1";
      computeModuleJobV1: {
        jobId: string;
        queryType: string;
        query: any;
      };
    }>(this.connectionInformation.getJobUri);
  };

  public postResult = async <ResponseType>(
    jobId: string,
    response: ResponseType
  ) => {
    const instance = await this.getAxios();
    return instance.post(this.connectionInformation.postResultUri + "/" + jobId, response, {
      headers: {
        "Content-Type": "application/octet-stream",
      },
    });
  };

  public postSchema = async (schemas: Schema[]) => {
    const instance = await this.getAxios();
    return instance.post(this.connectionInformation.postSchemaUri, schemas);
  };

  private getAxios = async () => {
    if (this.axiosInstance == null) {
      this.axiosInstance = axios.create({
        httpsAgent: new https.Agent({
          ca: await this.connectionInformation.trustStore,
        }),
        headers: {
          "Module-Auth-Token": await this.connectionInformation.moduleAuthToken,
        },
      });
    }
    return this.axiosInstance;
  };

}
