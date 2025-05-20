import { createObjectCsvWriter } from "csv-writer";
import { log, logError } from "../utils/logger";
import { 
  fetchEmployerBankAccounts, 
  closeNeo4jConnection, 
  fetchAuthorizerInfoBatch 
} from "../integrations/salsa-neo4j";

export async function getEmployerBankInfo(employerIds: string[]): Promise<void> {
  log("Starting data fetch process for Employer Bank Accounts...");
  const allRecords = [];

  try {
    for (const employerId of employerIds) {
      try {
        log(`Fetching bank account data from Neo4j for ${employerId}...`);
        const bankAccounts = await fetchEmployerBankAccounts(employerId);
        
        if (bankAccounts.length === 0) {
          log(`No bank accounts found for employer ${employerId}`);
          continue;
        }
        
        log(`Found ${bankAccounts.length} bank accounts for ${employerId}`);
        
        // Collect all bank account IDs
        const bankAccountIds = bankAccounts
          .filter(account => account.id)
          .map(account => account.id);
          
        // Fetch authorizer information in batch for better performance
        let authorizerInfoMap = new Map();
        if (bankAccountIds.length > 0) {
          log(`Fetching authorizer info for ${bankAccountIds.length} bank accounts...`);
          authorizerInfoMap = await fetchAuthorizerInfoBatch(bankAccountIds);
          log(`Found authorizer info for ${authorizerInfoMap.size} bank accounts`);
        }
        
        // Process each bank account
        for (const account of bankAccounts) {
          let authorizerFirstName = "";
          let authorizerLastName = "";
          let authorizerEmail = "";
          let clientIp = "";
          
          // Get authorizer information from the map if available
          if (account.id && authorizerInfoMap.has(account.id)) {
            const authInfo = authorizerInfoMap.get(account.id);
            authorizerFirstName = authInfo.authorizerFirstName || "";
            authorizerLastName = authInfo.authorizerLastName || "";
            authorizerEmail = authInfo.authorizerEmail || "";
            clientIp = authInfo.clientIpAddress || "";
          }
          
          allRecords.push({
            employer_id: account.employerId,
            bank_name: account.bankName || "",
            account_number: account.accountNumber || "",
            routing_number: account.routingNumber || "",
            party_name: account.partyName || "",
            authorizer_first_name: authorizerFirstName || "null",
            authorizer_last_name: authorizerLastName || "null",
            authorizer_email: authorizerEmail || "null",
            client_ip: clientIp || "null",
            id: account.id,
          });
        }
        
        log(`Added ${bankAccounts.length} bank account records for employer ID: ${employerId}`);
      } catch (error) {
        logError(`Error processing employer ${employerId}:`, error);
        // Continue with the next employer instead of failing the entire process
      }
    }
    
    if (allRecords.length === 0) {
      log("No bank account records found for any employers");
      return;
    }
    
    log(`Writing ${allRecords.length} records to CSV...`);
    
    const csvWriter = createObjectCsvWriter({
      path: "output/employer-bank-info.csv",
      header: [
        { id: "employer_id", title: "Employer id" },
        { id: "bank_name", title: "Bank name" },
        { id: "account_number", title: "Account Number" },
        { id: "routing_number", title: "Routing number" },
        { id: "party_name", title: "Party name" },
        { id: "authorizer_first_name", title: "Authorizer first name" },
        { id: "authorizer_last_name", title: "Authorizer last name" },
        { id: "authorizer_email", title: "Authorizer email" },
        { id: "client_ip", title: "Client IP" },
        { id: "id", title: "Employer bank account id" },
      ]
    });
    
    await csvWriter.writeRecords(allRecords);
    log("Data has been written to employer-bank-info.csv");
  } finally {
    // Close Neo4j connection when done
    await closeNeo4jConnection();
  }
} 