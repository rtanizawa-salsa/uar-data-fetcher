import axios from "axios";
import { log, logDebug, logError, logTrace } from "../utils/logger";

export interface SalsaGraphQLResponse<T> {
  data: T;
  errors?: Array<{
    message: string;
    locations: Array<{
      line: number;
      column: number;
    }>;
    path: string[];
  }>;
}

export interface SalsaQueryParams {
  query: string;
  variables?: Record<string, any>;
}

// Add request interceptor for logging
axios.interceptors.request.use((request) => {
  logTrace("Starting Salsa GraphQL Request:", {
    url: request.url,
    method: request.method,
    headers: request.headers,
    data: request.data,
  });
  return request;
});

// Add response interceptor for logging
axios.interceptors.response.use(
  (response) => {
    logTrace("Salsa GraphQL Response:", {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
    });
    return response;
  },
  (error) => {
    logError("Salsa GraphQL Response Error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers,
    });
    return Promise.reject(error);
  }
);

// Domain models
export interface EmployerInfo {
  employerId: string;
  businessName: string;
  legalName?: string;
  ein: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface WorkerInfo {
  workerId: string;
  firstName: string;
  lastName: string;
  employerId: string;
  employerName: string;
  dateOfBirth: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  ssn?: string;
}

interface EmployerApiResponse {
  employer: {
    id: string;
    businessName: string;
    legalName: string;
    taxesSetupByJurisdiction: Array<{
      taxIdentifiers: Array<{
        id: string;
        type: {
          id: string;
          name: string;
        };
        value: string | null;
      }>;
    }>;
    filingAddress: {
      address: {
        addressLine1: string;
        addressLine2: string;
        administrativeArea: string;
        locality: string;
        postalCode: string;
      };
    };
  };
}

interface WorkerApiResponse {
  worker?: {
    id: string;
    firstName: string;
    lastName: string;
    employer: {
      id: string;
      businessName: string;
    };
    personalInformation: {
      dateOfBirth: string;
      homeAddress: {
        id: string;
        address: {
          addressLine1: string;
          addressLine2: string;
          locality: string;
          postalCode: string;
          administrativeArea: string;
          country: string;
        };
      };
      governmentIdentifiers: Array<{
        id: string;
        value: string;
        type: {
          id: string;
          name: string;
        };
      }>;
    };
  };
  employer?: {
    id: string;
    workers: Array<{
      id: string;
      firstName: string;
      lastName: string;
      personalInformation: {
        dateOfBirth: string;
        homeAddress: {
          id: string;
          address: {
            addressLine1: string;
            addressLine2: string;
            locality: string;
            postalCode: string;
            administrativeArea: string;
            country: string;
          };
        };
        governmentIdentifiers: Array<{
          id: string;
          value: string;
          type: {
            id: string;
            name: string;
          };
        }>;
      };
    }>;
  };
}

// Type for a single worker response
type WorkerDetails = NonNullable<WorkerApiResponse['worker']>;
// Type for a worker within employer response
type EmployerWorker = NonNullable<WorkerApiResponse['employer']>['workers'][0];

export async function executeGraphQLQuery<T>(
  params: SalsaQueryParams
): Promise<T> {
  try {
    logDebug("Executing Salsa GraphQL query...");
    
    const apiUrl =
      process.env.SALSA_API_URL || "https://api.internal.salsa.dev/api/graphql";
    const authToken = process.env.SALSA_AUTH_TOKEN;
    if (!authToken) {
      throw new Error("SALSA_AUTH_TOKEN environment variable is required");
    }

    const response = await axios.post<SalsaGraphQLResponse<T>>(apiUrl, params, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.status !== 200) {
      logError("Salsa API returned non-200 status:", response.status);
      throw new Error(`Salsa API returned status ${response.status}`);
    }
    if (response.data.errors && response.data.errors.length > 0) {
      const errorMessages = response.data.errors
        .map((e) => e.message)
        .join(", ");
      logError("Salsa GraphQL returned errors:", errorMessages);
      throw new Error(`Salsa GraphQL errors: ${errorMessages}`);
    }
    if (!response.data.data) {
      logError("Invalid response format from Salsa API");
      throw new Error("Invalid response format from Salsa API");
    }

    log("Successfully executed Salsa GraphQL query");
    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logError("Error executing Salsa GraphQL query");
      logError("Status:", error.response?.status);
      logError("Status Text:", error.response?.statusText);
      logError("Response Data:", JSON.stringify(error.response?.data, null, 2));
      logError("Error Message:", error.message);
      logError("Request Config:", error.config);
      
      if (error.response?.status === 401) {
        throw new Error(`Authentication failed: Please check your SALSA_AUTH_TOKEN environment variable`);
      }
    } else {
      logError("Error executing Salsa GraphQL query");
      logError("Error:", error instanceof Error ? error.message : JSON.stringify(error));
      logError("Error stack:", error instanceof Error ? error.stack : "No stack trace available");
    }
    throw error;
  }
}

export async function fetchEmployerById(
  employerId: string
): Promise<EmployerInfo> {
  const employerQuery = `
    query Employer {
      employer(id: "${employerId}") {
        id
        businessName
        legalName
        taxesSetupByJurisdiction {
          taxIdentifiers {
            id
            type {
              id
              name
            }
            value
          }
        }
        filingAddress {
          address {
            addressLine1
            addressLine2
            administrativeArea
            locality
            postalCode
          }
        }
      }
    }
  `;

  // Execute GraphQL query
  const response = await executeGraphQLQuery<EmployerApiResponse>({
    query: employerQuery,
  });

  // Extract EIN and Address information
  const ein = extractEin(response.employer.taxesSetupByJurisdiction);
  const addressInfo = formatAddress(response.employer.filingAddress?.address);

  // Map API response to our domain model
  return {
    employerId: response.employer.id,
    businessName: response.employer.businessName,
    legalName: response.employer.legalName,
    ein: ein,
    addressLine1: addressInfo.addressLine1,
    addressLine2: addressInfo.addressLine2,
    city: addressInfo.city,
    state: addressInfo.state,
    postalCode: addressInfo.postalCode,
  };
}

/**
 * Extracts EIN from employer tax identifiers
 */
function extractEin(
  taxesSetupByJurisdiction: EmployerApiResponse["employer"]["taxesSetupByJurisdiction"]
): string {
  let ein = "";
  if (taxesSetupByJurisdiction && taxesSetupByJurisdiction.length > 0) {
    for (const jurisdiction of taxesSetupByJurisdiction) {
      for (const taxId of jurisdiction.taxIdentifiers) {
        if (taxId.type.id === "key:taxid:us:fein" && taxId.value) {
          ein = taxId.value;
          break;
        }
      }
      if (ein) break;
    }
  }
  return ein;
}

/**
 * Formats address from filing address data
 */
function formatAddress(
  address?: EmployerApiResponse["employer"]["filingAddress"]["address"]
): {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
} {
  if (!address) {
    return {
      addressLine1: "",
      city: "",
      state: "",
      postalCode: "",
    };
  }
  logDebug("Formatting address:", address);

  return {
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.locality,
    state: address.administrativeArea.toUpperCase(),
    postalCode: address.postalCode,
  };
}

export async function fetchWorkerById(workerId: string): Promise<WorkerInfo> {
  const workerQuery = `
    query Worker {
      worker(id: "${workerId}") {
        id
        firstName
        lastName
        employer {
          id
          businessName
        }
        personalInformation {
          dateOfBirth
          homeAddress {
            id
            address {
              addressLine1
              addressLine2
              locality
              postalCode
              administrativeArea
              country
            }
          }
          governmentIdentifiers {
            id
            value(unmasked: true)
            type {
              id
              name
            }
          }
        }
      }
    }
  `;

  // Execute GraphQL query
  const response = await executeGraphQLQuery<WorkerApiResponse>({
    query: workerQuery,
  });

  if (!response.worker) {
    throw new Error(`Worker not found with ID: ${workerId}`);
  }

  const worker = response.worker as WorkerDetails;
  
  // Extract SSN if available
  const ssn = extractSsn(worker.personalInformation.governmentIdentifiers);
  const addressInfo = formatWorkerAddress(worker.personalInformation.homeAddress?.address);

  // Map API response to our domain model
  return {
    workerId: worker.id,
    firstName: worker.firstName,
    lastName: worker.lastName,
    employerId: worker.employer.id,
    employerName: worker.employer.businessName,
    dateOfBirth: worker.personalInformation.dateOfBirth,
    addressLine1: addressInfo.addressLine1,
    addressLine2: addressInfo.addressLine2,
    city: addressInfo.city,
    state: addressInfo.state,
    postalCode: addressInfo.postalCode,
    country: addressInfo.country,
    ssn: ssn,
  };
}

export async function fetchWorkersByEmployerId(employerId: string): Promise<WorkerInfo[]> {
  const employerQuery = `
    query Employer {
      employer(id: "${employerId}") {
        id
        workers {
          id
          firstName
          lastName
          personalInformation {
            dateOfBirth
            homeAddress {
              id
              address {
                addressLine1
                addressLine2
                locality
                postalCode
                administrativeArea
                country
              }
            }
            governmentIdentifiers {
              id
              value(unmasked: true)
              type {
                id
                name
              }
            }
          }
        }
      }
    }
  `;

  // Execute GraphQL query
  const response = await executeGraphQLQuery<WorkerApiResponse>({
    query: employerQuery,
  });

  if (!response.employer || !response.employer.workers) {
    throw new Error(`Employer not found with ID: ${employerId} or has no workers`);
  }

  // Map API response to our domain model
  return response.employer.workers.map(worker => {
    const workerData = worker as EmployerWorker;
    const ssn = extractSsn(workerData.personalInformation.governmentIdentifiers);
    const addressInfo = formatWorkerAddress(workerData.personalInformation.homeAddress?.address);

    return {
      workerId: workerData.id,
      firstName: workerData.firstName,
      lastName: workerData.lastName,
      employerId: response.employer?.id || "",
      employerName: workerData.id,
      dateOfBirth: workerData.personalInformation.dateOfBirth,
      addressLine1: addressInfo.addressLine1,
      addressLine2: addressInfo.addressLine2,
      city: addressInfo.city,
      state: addressInfo.state,
      postalCode: addressInfo.postalCode,
      country: addressInfo.country,
      ssn: ssn,
    };
  });
}

/**
 * Extracts SSN from worker government identifiers
 */
function extractSsn(
  governmentIdentifiers: WorkerDetails["personalInformation"]["governmentIdentifiers"]
): string | undefined {
  if (!governmentIdentifiers || governmentIdentifiers.length === 0) {
    return undefined;
  }
  
  for (const id of governmentIdentifiers) {
    if (id.type.id === "key:wrgovid:us:ssn" && id.value) {
      return id.value;
    }
  }
  
  return undefined;
}

/**
 * Formats worker address from home address data
 */
function formatWorkerAddress(
  address?: WorkerDetails["personalInformation"]["homeAddress"]["address"]
): {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
} {
  if (!address) {
    return {
      addressLine1: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
    };
  }

  return {
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.locality,
    state: address.administrativeArea.toUpperCase(),
    postalCode: address.postalCode,
    country: address.country,
  };
}
