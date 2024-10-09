import https from "https";
import { Schema } from "./schemaTypes";
import axios, { AxiosError } from "axios";

export interface ConnectionInformation {
  getJobUri: string; // GET_JOB_URI
  postResultUri: string; // POST_RESULT_URI
  postSchemaUri: string; // POST_SCHEMA_URI
  trustStore: string; // DEFAULT_CA_PATH
  moduleAuthToken: string; // MODULE_AUTH_TOKEN
}

/**
 * API for interacting with the runtime.
 */
export class ComputeModuleApi {
  private axiosInstance: axios.AxiosInstance;

  constructor(private connectionInformation: ConnectionInformation) {
    this.axiosInstance = axios.create({
      httpsAgent: new https.Agent({
        ca: this.connectionInformation.trustStore,
      }),
      headers: {
        "Module-Auth-Token": this.connectionInformation.moduleAuthToken,
      },
    });
  }

  public getJobRequest = () =>
    this.axiosInstance.get<{
      type: "computeModuleJobV1";
      computeModuleJobV1: {
        jobId: string;
        queryType: string;
        query: any;
      };
    }>(this.connectionInformation.getJobUri);

  public postResult = <ResponseType>(jobId: string, response: ResponseType) =>
    this.axiosInstance.post(
      this.connectionInformation.postResultUri + "/" + jobId,
      JSON.stringify(response),
      {
        headers: {
          "Content-Type": "application/octet-stream",
        },
      }
    );

  public postSchema = (schemas: Schema[]) =>
    this.axiosInstance.post(this.connectionInformation.postSchemaUri, schemas, {
      headers: {
        "Content-Type": "application/json",
      }
    });
}

export function formatAxiosErrorResponse(error: AxiosError){
  return `
    Error running module - Network Error: ${error.response?.status}
    Status: ${error.status}
    Message: ${error.message}
    StatusText: ${error.response?.statusText}
    Data:
    ${JSON.stringify(error.response?.data, null, 2)}
  `
}