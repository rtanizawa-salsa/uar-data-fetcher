import { createObjectCsvWriter } from "csv-writer";
import { log, logError } from "../utils/logger";
import { fetchWorkerById, fetchWorkersByEmployerId } from "../integrations/salsa-graphql";

export async function getWorkerInfo(
  ids: string[],
  idType: "worker" | "employer" = "employer"
): Promise<void> {
  log(`Starting data fetch process for Worker Information by ${idType} ID...`);
  const allRecords = [];

  try {
    if (idType === "worker") {
      // Process individual worker IDs
      for (const workerId of ids) {
        log(`Fetching worker data from Salsa API for worker ID: ${workerId} ...`);
        try {
          const workerInfo = await fetchWorkerById(workerId);
          allRecords.push(mapWorkerToRecord(workerInfo));
          log("Added record with worker ID:", workerInfo.workerId);
        } catch (error) {
          logError(`Error fetching worker information for ${workerId}:`, error);
        }
      }
    } else {
      // Process employer IDs and fetch all workers for each employer
      for (const employerId of ids) {
        log(`Fetching workers data from Salsa API for employer ID: ${employerId} ...`);
        try {
          const workers = await fetchWorkersByEmployerId(employerId);
          for (const worker of workers) {
            allRecords.push(mapWorkerToRecord(worker));
            log("Added record with worker ID:", worker.workerId);
          }
        } catch (error) {
          logError(`Error fetching workers for employer ${employerId}:`, error);
        }
      }
    }

    log(`Writing ${allRecords.length} records to CSV...`);

    const csvWriter = createObjectCsvWriter({
      path: "output/worker-personal-info.csv",
      header: [
        { id: "employer_id", title: "Employer ID" },
        { id: "worker_id", title: "Worker ID" },
        { id: "first_name", title: "First Name" },
        { id: "last_name", title: "Last Name" },
        { id: "date_of_birth", title: "Date of Birth" },
        { id: "address_line1", title: "Address Line 1" },
        { id: "address_line2", title: "Address Line 2" },
        { id: "city", title: "City" },
        { id: "state", title: "State" },
        { id: "postal_code", title: "Postal Code" },
        { id: "ssn", title: "SSN" },
      ],
    });

    await csvWriter.writeRecords(allRecords);
    log("Data has been written to worker-personal-info.csv");
  } catch (error) {
    logError("Error in getWorkerInfo:", error);
    throw error;
  }
}

function mapWorkerToRecord(worker: any) {
  return {
    employer_id: worker.employerId,
    worker_id: worker.workerId,
    first_name: worker.firstName,
    last_name: worker.lastName,
    date_of_birth: worker.dateOfBirth,
    address_line1: worker.addressLine1 || "",
    address_line2: worker.addressLine2 || "",
    city: worker.city || "",
    state: worker.state || "",
    postal_code: worker.postalCode || "",
    ssn: worker.ssn || ""
  };
} 