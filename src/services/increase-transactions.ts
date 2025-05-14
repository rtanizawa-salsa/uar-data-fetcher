import { createObjectCsvWriter } from "csv-writer";
import {
  fetchPaymentOrders,
  FetchPaymentOrdersParams,
  extractACHTransferId,
} from "../integrations/modern-treasury";
import { fetchACHTransfer } from "../integrations/increase";
import { log, logDebug } from "../utils/logger";

export async function getIncreaseTransactions(
  payrollRunIds: string[]
): Promise<void> {
  log("Starting data fetch process for Increase transactions...");

  const allRecords = [];

  for (const payrollRunId of payrollRunIds) {
    log(`Fetching transaction data for payroll run ${payrollRunId} ...`);
    const modernTreasuryParams: FetchPaymentOrdersParams = {
      per_page: 100,
      "metadata[payrollRunId]": payrollRunId,
    };
    const paymentOrders = await fetchPaymentOrders(modernTreasuryParams);

    log(
      `Retrieved ${paymentOrders.length} payment orders from Modern Treasury for payrollRunId: ${payrollRunId}`
    );

    for (const [index, order] of paymentOrders.entries()) {
      log(`Processing payment order ${index + 1}/${paymentOrders.length}`);
      logDebug(
        "Payment Order ID:",
        order.id,
        ", Amount:",
        order.amount,
        ", Direction:",
        order.direction
      );

      const achTransferId = extractACHTransferId(order);
      log("Found ACH Transfer ID:", achTransferId);

      if (achTransferId) {
        log("Fetching Increase data for ACH Transfer ID:", achTransferId);
        const increaseData = await fetchACHTransfer(achTransferId);
        logDebug(
          "ACH Transfer ID:",
          increaseData.id,
          ", Amount:",
          increaseData.amount,
          ", Transaction ID:",
          increaseData.transaction_id
        );

        allRecords.push({
          payroll_run_id: payrollRunId,
          direction: order.direction,
          effective_date: order.effective_date,
          amount: order.amount,
          transaction_id: increaseData.transaction_id,
        });
        log("Added record with transaction ID:", increaseData.transaction_id);
      } else {
        log("No ACH Transfer ID found for this payment order, skipping...");
      }
    }
  }

  log(`Writing ${allRecords.length} records to CSV...`);

  const csvWriter = createObjectCsvWriter({
    path: "output/increase-transactions.csv",
    header: [
      { id: "payroll_run_id", title: "Payroll run ID" },
      { id: "direction", title: "Direction" },
      { id: "effective_date", title: "Transaction date" },
      { id: "amount", title: "Amount" },
      { id: "transaction_id", title: "Transaction ID" },
    ],
  });

  await csvWriter.writeRecords(allRecords);
  log("Data has been written to increase-transactions.csv");
}
