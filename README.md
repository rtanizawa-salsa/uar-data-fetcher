# 💸 UAR data fetcher Script

This script automates the process of fetching data required for UAR (Unusual activity report). It fetches data from [Modern Treasury](https://www.moderntreasury.com/) based on multiple `payrollRunId` metadata values, and  [Increase](https://www.increase.com/) based on the `ach_transfer` id, exporting the required data into a CSV file.

---

## 📌 Purpose

This script is designed to help the risk team to reconcile data in order to submit UAR to Increase.

1. Retrieves payment orders tagged with specific `payrollRunId` metadata from Modern Treasury.
2. Extracts ACH transfer IDs from those payment orders.
3. Queries Increase to retrieve transaction-level details for each ACH transfer.
4. Writes all resulting transaction IDs into a single CSV file (`output.csv`).


## ⚙️ Configuration

Before running the script, ensure you have the following environment variables set in a `.env` file at the root of your project:

```env
MODERN_TREASURY_USERNAME=your_mt_username
MODERN_TREASURY_PASSWORD=your_mt_password
INCREASE_API_KEY=your_increase_api_key
LOG_MODE=INFO
```


## TODO
- Filter by purpose (exclude TAX_TRANSFERS)
- Filter by status (exclude cancelled payment orders)
