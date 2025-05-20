import { createObjectCsvWriter } from "csv-writer";
import { log, logError } from "../utils/logger";
import { fetchEmployerById } from "../integrations/salsa-graphql";

export async function getEmployerInfo(employerIds: string[]): Promise<void> {
  log("Starting data fetch process for Employers...");
  const allRecords = [];

  for (const employerId of employerIds) {
    try {
      log(`Fetching employer data from Salsa API for ${employerId} ...`);
      const employerInfo = await fetchEmployerById(employerId);

      allRecords.push({
        employer_id: employerInfo.employerId,
        business_name: employerInfo.businessName,
        ein: employerInfo.ein,
        address_line1: employerInfo.addressLine1,
        address_line2: employerInfo.addressLine2,
        city: employerInfo.city,
        state: employerInfo.state,
        postal_code: employerInfo.postalCode,
      });
      log("Added record with employer ID:", employerInfo.employerId);
    } catch (error) {
      logError("Error fetching employer information:", error);
      throw error;
    }
  }

  log(`Writing ${allRecords.length} records to CSV...`);

  const csvWriter = createObjectCsvWriter({
    path: "output/employer-business-info.csv",
    header: [
      { id: "employer_id", title: "Employer ID" },
      { id: "business_name", title: "Business name" },
      { id: "ein", title: "EIN" },
      { id: "address_line1", title: "Address line 1" },
      { id: "address_line2", title: "Address line 2" },
      { id: "city", title: "City" },
      { id: "state", title: "State" },
      { id: "postal_code", title: "Postal code" },
    ],
  });

  await csvWriter.writeRecords(allRecords);
  log("Data has been written to employer-business-info.csv");
}
