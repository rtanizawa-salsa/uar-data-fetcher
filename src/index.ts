import * as dotenv from 'dotenv';
import { createObjectCsvWriter } from 'csv-writer';
import { fetchPaymentOrders, FetchPaymentOrdersParams, extractACHTransferId } from './integrations/modern-treasury';
import { fetchACHTransfer } from './integrations/increase';
import { log, logDebug, logError } from './utils/logger';

dotenv.config();

async function main() {
  try {
    log('Starting data fetch process...');

    const payrollRunIds = [
      'payrun_04288914-0610-47e3-b1ed-4a5d78654323',
      'payrun_2abfbae7-8334-4fbe-a0bf-0f3bfe10a85d',
    ];
    const allRecords = [];

    for (const payrollRunId of payrollRunIds) {
      const modernTreasuryParams: FetchPaymentOrdersParams = {
        per_page: 100,
        'metadata[payrollRunId]': payrollRunId
      };
      const paymentOrders = await fetchPaymentOrders(
        process.env.MODERN_TREASURY_USERNAME!,
        process.env.MODERN_TREASURY_PASSWORD!,
        modernTreasuryParams
      );

      log(`Retrieved ${paymentOrders.length} payment orders from Modern Treasury for payrollRunId: ${payrollRunId}`);

      for (const [index, order] of paymentOrders.entries()) {
        log(`Processing payment order ${index + 1}/${paymentOrders.length}`);
        logDebug('Payment Order ID:', order.id, ', Amount:', order.amount, ', Direction:', order.direction);

        const achTransferId = extractACHTransferId(order);
        log('Found ACH Transfer ID:', achTransferId);

        if (achTransferId) {
          log('Fetching Increase data for ACH Transfer ID:', achTransferId);
          const increaseData = await fetchACHTransfer(
            process.env.INCREASE_API_KEY!,
            achTransferId
          );
          logDebug('ACH Transfer ID:', increaseData.id, ', Amount:', increaseData.amount, ', Transaction ID:', increaseData.transaction_id);

          allRecords.push({
            payroll_run_id: payrollRunId,
            direction: order.direction,
            effective_date: order.effective_date,
            amount: paymentOrders[index].amount,
            transaction_id: increaseData.transaction_id
          });
          log('Added record with transaction ID:', increaseData.transaction_id);
        } else {
          log('No ACH Transfer ID found for this payment order, skipping...');
        }
      }
    }

    log(`Writing ${allRecords.length} records to CSV...`);

    const csvWriter = createObjectCsvWriter({
      path: 'output.csv',
      header: [
        { id: 'payroll_run_id', title: 'Payroll run ID' },
        { id: 'direction', title: 'Direction' },
        { id: 'effective_date', title: 'Transaction date' },
        { id: 'amount', title: 'Amount' },
        { id: 'transaction_id', title: 'Transaction ID' }
      ]
    });

    await csvWriter.writeRecords(allRecords);
    log('Data has been written to output.csv');
    log('Process completed successfully!');
  } catch (error) {
    logError('An error occurred:', error);
    process.exit(1);
  }
}

main();