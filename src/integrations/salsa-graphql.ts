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

export async function executeGraphQLQuery<T>(
  params: SalsaQueryParams
): Promise<T> {
  try {
    logDebug("Executing Salsa GraphQL query...");

    const apiUrl =
      process.env.SALSA_API_URL || "https://api.internal.salsa.dev/api/graphql";
    const authToken = process.env.SALSA_AUTH_TOKEN;
    if (!authToken) {
      throw new Error("SALSA_API_KEY environment variable is required");
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
    } else {
      logError("Error executing Salsa GraphQL query");
      logError("Error:", error);
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
