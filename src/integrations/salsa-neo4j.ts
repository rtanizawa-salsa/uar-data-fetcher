import { Driver, Session, driver, auth } from "neo4j-driver";
import { log, logDebug, logError, logTrace } from "../utils/logger";

interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
}

export interface EmployerBankAccount {
  id: string;
  employerId: string;
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  partyName: string;
  createdDate: string;
  isDeleted: boolean;
}

export interface AuthorizerInfo {
  entityId: string;
  authorizerFirstName: string;
  authorizerLastName: string;
  authorizerEmail: string;
  clientIpAddress: string;
}

let neo4jDriver: Driver | null = null;

/**
 * Initialize Neo4j driver with configuration from environment variables
 */
function initializeDriver(): Driver {
  if (neo4jDriver) {
    return neo4jDriver;
  }

  const config: Neo4jConfig = {
    uri: process.env.NEO4J_URI || "bolt://localhost:7687",
    username: process.env.NEO4J_USERNAME || "neo4j",
    password: process.env.NEO4J_PASSWORD || "",
    database: process.env.NEO4J_DATABASE,
  };

  if (!config.password) {
    throw new Error("NEO4J_PASSWORD environment variable is required");
  }

  logDebug("Initializing Neo4j driver with URI:", config.uri);
  
  neo4jDriver = driver(
    config.uri,
    auth.basic(config.username, config.password)
  );

  return neo4jDriver;
}

/**
 * Close Neo4j driver connection
 */
export async function closeNeo4jConnection(): Promise<void> {
  if (neo4jDriver) {
    await neo4jDriver.close();
    neo4jDriver = null;
    logDebug("Neo4j driver connection closed");
  }
}

/**
 * Execute a Cypher query against Neo4j database
 */
async function executeNeo4jQuery<T>(
  cypher: string,
  params: Record<string, any> = {}
): Promise<T[]> {
  const driver = initializeDriver();
  const database = process.env.NEO4J_DATABASE;
  let session: Session;

  if (database) {
    session = driver.session({ database });
  } else {
    session = driver.session();
  }

  try {
    logTrace("Executing Neo4j query:", { cypher, params });

    const result = await session.run(cypher, params);
    const records = result.records.map(record => {
      const obj: Record<string, any> = {};
      record.keys.forEach(key => {
        if (typeof key === 'string') {
          obj[key] = record.get(key);
        }
      });
      return obj as T;
    });

    logDebug(`Neo4j query executed successfully, returned ${records.length} records`);
    return records;
  } catch (error) {
    logError("Error executing Neo4j query:", error);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Fetch active bank accounts for an employer
 */
async function fetchActiveBankAccounts(employerId: string): Promise<EmployerBankAccount[]> {
  const cypher = `
    MATCH(wc:EmployerCounterparty {employerId: $employerId})-[]-(wba:EmployerBankAccount)
    RETURN wba.entityId as id, wc.employerId as employerId, wba.bankName as bankName, wba.accountNumber as accountNumber, 
           wba.routingNumber as routingNumber, wba.partyName as partyName, wba.createdDate as createdDate
    ORDER BY wc.employerId, wba.routingNumber, wba.createdDate
  `;

  const results = await executeNeo4jQuery<EmployerBankAccount>(cypher, { employerId });
  return results.map(account => ({
    ...account,
    isDeleted: false
  }));
}

/**
 * Fetch deleted bank accounts for an employer
 */
async function fetchDeletedBankAccounts(employerId: string): Promise<EmployerBankAccount[]> {
  const cypher = `
    MATCH(wc:EmployerCounterparty {employerId: $employerId})-[]-(wba:DeletedEmployerBankAccount)
    RETURN wba.entityId as id, wc.employerId as employerId, wba.bankName as bankName, wba.accountNumber as accountNumber, 
           wba.routingNumber as routingNumber, wba.partyName as partyName, wba.createdDate as createdDate
    ORDER BY wc.employerId, wba.routingNumber, wba.createdDate
  `;

  const results = await executeNeo4jQuery<EmployerBankAccount>(cypher, { employerId });
  return results.map(account => ({
    ...account,
    isDeleted: true
  }));
}

/**
 * Fetch all bank accounts (active and deleted) for an employer
 */
export async function fetchEmployerBankAccounts(employerId: string): Promise<EmployerBankAccount[]> {
  log(`Fetching bank accounts for employer ${employerId}`);
  
  try {
    const [activeBankAccounts, deletedBankAccounts] = await Promise.all([
      fetchActiveBankAccounts(employerId),
      fetchDeletedBankAccounts(employerId)
    ]);

    const allBankAccounts = [...activeBankAccounts, ...deletedBankAccounts];
    log(`Found ${allBankAccounts.length} bank accounts for employer ${employerId}`);
    
    return allBankAccounts;
  } catch (error) {
    logError(`Error fetching bank accounts for employer ${employerId}:`, error);
    throw error;
  }
}

/**
 * Fetch authorizer information for a bank account
 */
export async function fetchAuthorizerInfo(employerBankAccountId: string): Promise<AuthorizerInfo | null> {
  const cypher = `
    MATCH(pas:PaymentAuthorizationSignature)-[]-(pa:PaymentAuthorization)-[]-(eba:DeletedEmployerBankAccount {entityId: $employerBankAccountId})
    RETURN eba.entityId as entityId, pas.authorizerFirstName as authorizerFirstName, 
           pas.authorizerLastName as authorizerLastName, pas.authorizerEmail as authorizerEmail, 
           pas.clientIpAddress as clientIpAddress
    UNION
    MATCH(pas:PaymentAuthorizationSignature)-[]-(pa:PaymentAuthorization)-[]-(eba:EmployerBankAccount {entityId: $employerBankAccountId})
    RETURN eba.entityId as entityId, pas.authorizerFirstName as authorizerFirstName, 
           pas.authorizerLastName as authorizerLastName, pas.authorizerEmail as authorizerEmail, 
           pas.clientIpAddress as clientIpAddress
  `;

  log(`Fetching authorizer info for bank account ID ${employerBankAccountId}`);
  
  try {
    const results = await executeNeo4jQuery<AuthorizerInfo>(cypher, { employerBankAccountId });
    
    if (results.length === 0) {
      logDebug(`No authorizer info found for bank account ID ${employerBankAccountId}`);
      return null;
    }
    
    // Return the first authorizer info found
    return results[0];
  } catch (error) {
    logError(`Error fetching authorizer info for bank account ID ${employerBankAccountId}:`, error);
    return null; // Return null instead of throwing to avoid breaking the main process
  }
}

/**
 * Fetch authorizer information for multiple bank accounts at once
 * Returns a map of bank account ID to authorizer info
 */
export async function fetchAuthorizerInfoBatch(employerBankAccountIds: string[]): Promise<Map<string, AuthorizerInfo>> {
  if (employerBankAccountIds.length === 0) {
    return new Map();
  }

  // Create Cypher parameter with array of IDs
  const params = { employerBankAccountIds };
  
  const cypher = `
    MATCH(pas:PaymentAuthorizationSignature)-[]-(pa:PaymentAuthorization)-[]-(eba:DeletedEmployerBankAccount)
    WHERE eba.entityId IN $employerBankAccountIds
    RETURN eba.entityId as entityId, pas.authorizerFirstName as authorizerFirstName, 
           pas.authorizerLastName as authorizerLastName, pas.authorizerEmail as authorizerEmail, 
           pas.clientIpAddress as clientIpAddress
    UNION
    MATCH(pas:PaymentAuthorizationSignature)-[]-(pa:PaymentAuthorization)-[]-(eba:EmployerBankAccount)
    WHERE eba.entityId IN $employerBankAccountIds
    RETURN eba.entityId as entityId, pas.authorizerFirstName as authorizerFirstName, 
           pas.authorizerLastName as authorizerLastName, pas.authorizerEmail as authorizerEmail, 
           pas.clientIpAddress as clientIpAddress
  `;

  log(`Fetching authorizer info for ${employerBankAccountIds.length} bank account IDs in batch`);
  
  try {
    const results = await executeNeo4jQuery<AuthorizerInfo>(cypher, params);
    const authorizerMap = new Map<string, AuthorizerInfo>();
    
    for (const authInfo of results) {
      if (authInfo.entityId) {
        authorizerMap.set(authInfo.entityId, authInfo);
      }
    }
    
    logDebug(`Found authorizer info for ${authorizerMap.size} out of ${employerBankAccountIds.length} bank accounts`);
    return authorizerMap;
  } catch (error) {
    logError(`Error fetching authorizer info in batch:`, error);
    return new Map(); // Return empty map instead of throwing to avoid breaking the main process
  }
} 