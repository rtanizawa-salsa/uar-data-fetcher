import { createObjectCsvWriter } from "csv-writer";
import { log, logError } from "../utils/logger";
import { fetchWorkerBankAccounts, closeNeo4jConnection } from "../integrations/salsa-neo4j";

export async function getWorkerBankInfo(employerIds: string[]): Promise<void> {
  log("Starting data fetch process for Worker Bank Accounts...");
  
  try {
    log(`Fetching worker bank accounts for ${employerIds.length} employers...`);
    const workerBankAccounts = await fetchWorkerBankAccounts(employerIds);
    
    if (workerBankAccounts.length === 0) {
      log("No worker bank accounts found");
      return;
    }
    
    log(`Processing ${workerBankAccounts.length} worker bank account records...`);
    
    const allRecords = workerBankAccounts.map(account => ({
      employer_id: account.employerId || "",
      worker_id: account.workerId || "",
      bank_name: account.bankName || "",
      account_number: account.accountNumber || "",
      routing_number: account.routingNumber || "",
      party_name: account.partyName || "",
      is_deleted: account.isDeleted ? "Yes" : "No",
      created_date: account.createdDate || "",
    }));
    
    log(`Writing ${allRecords.length} records to CSV...`);
    
    const csvWriter = createObjectCsvWriter({
      path: "output/worker-bank-info.csv",
      header: [
        { id: "employer_id", title: "Employer id" },
        { id: "worker_id", title: "Worker id" },
        { id: "bank_name", title: "Bank name" },
        { id: "account_number", title: "Account Number" },
        { id: "routing_number", title: "Routing number" },
        { id: "party_name", title: "Party name" },
        { id: "is_deleted", title: "Is Deleted" },
        { id: "created_date", title: "Created Date" },
      ]
    });
    
    await csvWriter.writeRecords(allRecords);
    log("Data has been written to worker-bank-info.csv");
  } catch (error) {
    logError("Error processing worker bank accounts:", error);
    throw error;
  } finally {
    // Close Neo4j connection when done
    await closeNeo4jConnection();
  }
} 