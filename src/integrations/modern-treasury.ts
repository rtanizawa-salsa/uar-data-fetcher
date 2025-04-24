import axios from 'axios';
import { log, logTrace, logError } from '../utils/logger';

export interface PaymentReference {
  id: string;
  object: string;
  live_mode: boolean;
  reference_number: string;
  reference_number_type: string;
  referenceable_id: string;
  referenceable_type: string;
  created_at: string;
  updated_at: string;
}

export interface ModernTreasuryPaymentOrder {
  id: string;
  object: string;
  live_mode: boolean;
  type: string;
  amount: number;
  direction: string;
  effective_date: string;
  reference_numbers: PaymentReference[];
}

export interface ModernTreasuryResponse {
  data: ModernTreasuryPaymentOrder[];
}

export interface FetchPaymentOrdersParams {
  per_page: number;
  'metadata[payrollRunId]': string;
}

export function extractACHTransferId(paymentOrder: ModernTreasuryPaymentOrder): string | null {
  const reference = paymentOrder.reference_numbers.find(
    ref => ref.reference_number_type === 'bnk_dev_transfer_id'
  );
  return reference?.reference_number || null;
}

export async function fetchPaymentOrders(
  username: string,
  password: string,
  params: FetchPaymentOrdersParams
): Promise<ModernTreasuryPaymentOrder[]> {
  const url = 'https://app.moderntreasury.com/api/payment_orders';

  try {
    log('Calling Modern Treasury payment order endpoint...');

    // Add request interceptor
    axios.interceptors.request.use(request => {
      logTrace('Starting Request:', {
        url: request.url,
        method: request.method,
        headers: request.headers,
        params: request.params,
        data: request.data
      });
      return request;
    });
    // Add response interceptor
    axios.interceptors.response.use(response => {
      logTrace('Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data
      });
      return response;
    }, error => {
      logError('Response Error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      });
      return Promise.reject(error);
    });

    const response = await axios.get<ModernTreasuryResponse>(url, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
      },
      params
    });

    if (response.status !== 200) {
      logError('Modern Treasury API returned non-200 status:', response.status);
      throw new Error(`Modern Treasury API returned status ${response.status}`);
    }

    if (!response.data || !Array.isArray(response.data)) {
      logError('Invalid response format from Modern Treasury API');
      throw new Error('Invalid response format from Modern Treasury API');
    }

    log('Successfully retrieved payment orders from Modern Treasury');
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logError('Error fetching Modern Treasury payment orders');
      logError('Status:', error.response?.status);
      logError('Status Text:', error.response?.statusText);
      logError('Response Data:', JSON.stringify(error.response?.data, null, 2));
      logError('Error Message:', error.message);
    } else {
      logError('Error fetching Modern Treasury payment orders');
      logError('Error:', error);
    }
    throw error;
  }
} 