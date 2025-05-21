import * as dotenv from "dotenv";
import { log, logError } from "./utils/logger";
import { 
  getIncreaseTransactions, 
  getEmployerInfo, 
  getEmployerBankInfo, 
  getWorkerBankInfo,
  getWorkerInfo
} from "./services";

dotenv.config();

const defaultPayrollRunIds = ["payrun_b1e94c03-3e7a-433c-8de0-c11da396bc02"];
const defaultEmployerIds = [
  "er_0eb7d20d-e488-4325-9173-6ffd821763ae"
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
      log("  get-worker-info [--worker-id] <ids...>");
      log("  run-all");
      return;
    }

    log(`Starting process for command: ${command}`);

    switch (command) {
      case "run-all": {
        log("Running all commands with default values");
        
        log("1. Running get-increase-transaction");
        await getIncreaseTransactions(defaultPayrollRunIds);
        
        log("2. Running get-employer-info");
        await getEmployerInfo(defaultEmployerIds);
        
        log("3. Running get-employer-bank-info");
        await getEmployerBankInfo(defaultEmployerIds);
        
        log("4. Running get-worker-bank-info");
        await getWorkerBankInfo(defaultEmployerIds);
        
        log("5. Running get-worker-info");
        await getWorkerInfo(defaultEmployerIds, "employer");
        
        break;
      }
      
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

      case "get-worker-info": {
        const args = process.argv.slice(3);
        const isWorkerIdMode = args[0] === "--worker-id";
        
        // If --worker-id flag is present, skip it for actual IDs
        const ids = isWorkerIdMode ? args.slice(1) : args;
        const idType = isWorkerIdMode ? "worker" : "employer";
        
        if (ids.length === 0) {
          if (idType === "worker") {
            log("No worker IDs provided.");
            log("Usage: get-worker-info --worker-id <worker-id1> <worker-id2> ...");
            return;
          } else {
            log("No employer IDs provided. Using default list.");
            await getWorkerInfo(defaultEmployerIds, "employer");
          }
        } else {
          log(`Processing ${ids.length} ${idType} IDs`);
          await getWorkerInfo(ids, idType);
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
        log("  get-worker-info [--worker-id] <ids...>");
        log("  run-all");
    }

    log("Process completed successfully!");
  } catch (error) {
    logError("An error occurred:", error);
    process.exit(1);
  }
}

main();
