import * as dotenv from "dotenv";
import { log, logError } from "./utils/logger";
import { 
  getIncreaseTransactions, 
  getEmployerInfo, 
  getEmployerBankInfo, 
  getWorkerBankInfo 
} from "./services";

dotenv.config();

const defaultPayrollRunIds = ["payrun_d72ac493-2644-4824-a110-380b86314be5"];
const defaultEmployerIds = [
  "er_369feceb-bfb1-484b-b966-0a31fad6de3c",
  "er_ea769d6a-6b9f-425b-8b09-94f7c6762887"
];

async function main() {
  try {
    const command = process.argv[2];

    if (!command) {
      log("No command specified. Available commands:");
      log("  get-increase-transaction <payroll-run-ids>");
      log("  get-employer-info");
      log("  get-employer-bank-info");
      log("  get-worker-bank-info");
      return;
    }

    log(`Starting process for command: ${command}`);

    switch (command) {
      case "get-increase-transaction": {
        const payrollRunIds = process.argv.slice(3);

        if (payrollRunIds.length === 0) {
          log("No payroll run IDs provided. Using default list.");
          // Default payroll run IDs if none provided
          await getIncreaseTransactions(defaultPayrollRunIds);
        } else {
          log(`Processing ${payrollRunIds.length} payroll run IDs`);
          await getIncreaseTransactions(payrollRunIds);
        }
        break;
      }

      case "get-employer-info": {
        const employerIds = process.argv.slice(3);

        if (employerIds.length === 0) {
          log("No employer IDs provided. Using default list.");
          // Default payroll run IDs if none provided
          await getEmployerInfo(defaultEmployerIds);
        } else {
          log(`Processing ${employerIds.length} employer IDs`);
          await getEmployerInfo(employerIds);
        }
        break;
      }

      case "get-employer-bank-info": {
        const employerIds = process.argv.slice(3);

        if (employerIds.length === 0) {
          log("No employer IDs provided. Using default list.");
          await getEmployerBankInfo(defaultEmployerIds);
        } else {
          log(`Processing ${employerIds.length} employer IDs`);
          await getEmployerBankInfo(employerIds);
        }
        break;
      }
      
      case "get-worker-bank-info": {
        const employerIds = process.argv.slice(3);

        if (employerIds.length === 0) {
          log("No employer IDs provided. Using default list.");
          await getWorkerBankInfo(defaultEmployerIds);
        } else {
          log(`Processing ${employerIds.length} employer IDs`);
          await getWorkerBankInfo(employerIds);
        }
        break;
      }

      default:
        log(`Unknown command: ${command}`);
        log("Available commands:");
        log("  get-increase-transaction <payroll-run-ids>");
        log("  get-employer-info");
        log("  get-employer-bank-info");
        log("  get-worker-bank-info");
    }

    log("Process completed successfully!");
  } catch (error) {
    logError("An error occurred:", error);
    process.exit(1);
  }
}

main();
