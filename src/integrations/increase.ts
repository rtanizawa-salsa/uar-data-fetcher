import axios from "axios";
import { log, logDebug, logError, logTrace } from "../utils/logger";

export interface IncreaseACHTransfer {
  id: string;
  amount: number;
  transaction_id: string;
}

// Add request interceptor
axios.interceptors.request.use((request) => {
  logTrace("Starting Request:", {
    url: request.url,
    method: request.method,
    headers: request.headers,
    params: request.params,
    data: request.data,
  });
  return request;
});

// Add response interceptor
axios.interceptors.response.use(
  (response) => {
    logTrace("Response:", {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
    });
    return response;
  },
  (error) => {
    logError("Response Error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers,
    });
    return Promise.reject(error);
  }
);

export async function fetchACHTransfer(
  achTransactionId: string
): Promise<IncreaseACHTransfer> {
  const url = `https://api.increase.com/ach_transfers/${achTransactionId}`;

  // Get API key from environment variables
  const apiKey = process.env.INCREASE_API_KEY;

  if (!apiKey) {
    throw new Error("INCREASE_API_KEY environment variable is required");
  }

  try {
    logDebug("Calling Increase ACH Transfer endpoint...");

    const response = await axios.get<IncreaseACHTransfer>(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.status !== 200) {
      logError("Increase API returned non-200 status:", response.status);
      throw new Error(`Increase API returned status ${response.status}`);
    }

    if (!response.data || !response.data.transaction_id) {
      logError("Invalid response format from Increase API");
      throw new Error("Invalid response format from Increase API");
    }

    log("Successfully retrieved ACH transfer from Increase");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logError("Error fetching Increase ACH transfer");
      logError("Status:", error.response?.status);
      logError("Status Text:", error.response?.statusText);
      logError("Response Data:", JSON.stringify(error.response?.data, null, 2));
      logError("Error Message:", error.message);
    } else {
      logError("Error fetching Increase ACH transfer");
      logError("Error:", error);
    }
    throw error;
  }
}
