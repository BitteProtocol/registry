import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  DocumentData,
  Firestore,
  QueryDocumentSnapshot,
  WithFieldValue,
} from "@google-cloud/firestore";
import { COLLECTIONS } from "./constants";


export type FirestoreOperationResult = {
  success: boolean;
  error?: unknown;
};

const GCP_PROJECT = process.env.GCP_PROJECT;
const GCP_CLIENT_EMAIL = process.env.GCP_SERVICE_ACCOUNT_CLIENT_EMAIL;
const GCP_PRIVATE_KEY = process.env.GCP_SERVICE_ACCOUNT_PRIVATE_KEY;
if (!GCP_PROJECT || !GCP_CLIENT_EMAIL || !GCP_PRIVATE_KEY) {
  throw new Error(
    "Missing GCP_PROJECT, GCP_SERVICE_ACCOUNT_CLIENT_EMAIL, or GCP_SERVICE_ACCOUNT_PRIVATE_KEY in env"
  );
}

const db = new Firestore({
  ignoreUndefinedProperties: true,
  projectId: GCP_PROJECT,
  credentials: {
    client_email: GCP_CLIENT_EMAIL,
    private_key: GCP_PRIVATE_KEY,
  },
  databaseId: "mainnet",
});

export const read = async <T>(
  collection: string,
  ref: string
): Promise<T | null> => {
  const doc = await db.collection(collection).doc(ref).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as T;
};

export const readAll = async <T>(collection: string): Promise<T[]> =>
  (await db.collection(collection).get()).docs.map((d) => d.data()) as T[];

export const write = async <T extends WithFieldValue<DocumentData>>(
  collection: string,
  ref: string,
  data: T,
  merge: boolean = false
): Promise<FirestoreOperationResult> => {
  try {
    await db.collection(collection).doc(ref).set(data, { merge });
    return { success: true };
  } catch (error) {
    console.error(`Error writing to ${collection}/${ref}`, error);
    return { success: false, error };
  }
};

export const writeBatch = async (
  writes: {
    collection: string;
    ref: string;
    data: WithFieldValue<DocumentData>;
    merge?: boolean;
  }[]
): Promise<FirestoreOperationResult> => {
  try {
    const batch = db.batch();
    for (const write of writes) {
      batch.set(db.collection(write.collection).doc(write.ref), write.data, {
        merge: write.merge || false,
      });
    }
    await batch.commit();

    return { success: true };
  } catch (error) {
    console.error(`Error writing batch`, error);
    return { success: false, error };
  }
};

export const update = async (
  collection: string,
  ref: string,
  data: WithFieldValue<DocumentData>
): Promise<FirestoreOperationResult> => {
  try {
    await db.collection(collection).doc(ref).update(data);
    return { success: true };
  } catch (error) {
    console.error(`Error updating ${collection}/${ref}`, error);
    return { success: false, error };
  }
};

export const destroy = async (
  collection: string,
  ref: string
): Promise<FirestoreOperationResult> => {
  try {
    await db.collection(collection).doc(ref).delete();
    return { success: true };
  } catch (error) {
    console.error(`Error deleting ${collection}/${ref}`, error);
    return { success: false, error };
  }
};

export const destroyBatch = async (
  destroys: { collection: string; ref: string }[]
): Promise<FirestoreOperationResult> => {
  try {
    const batch = db.batch();
    for (const destroy of destroys) {
      batch.delete(db.collection(destroy.collection).doc(destroy.ref));
    }
    await batch.commit();

    return { success: true };
  } catch (error) {
    console.error(`Error deleting batch`, error);
    return { success: false, error };
  }
};

export const isDocumentNotFoundError = (err: Error): boolean =>
  err.message.startsWith("Doc at ref ") && err.message.endsWith(" not found");

export const catchDocumentNotFound = (err: Error): null => {
  if (isDocumentNotFoundError(err)) return null;
  throw err;
};

export const queryAgents = async <T>(options: {
  verified?: boolean;
  withTools?: boolean;
} = {}): Promise<T[]> => {
  let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.AGENTS);
  
  if (options.verified) {
    query = query.where('verified', '==', true);
  }

  const snapshot = await query.get();
  
  if (!options.withTools) {
    return snapshot.docs.map(doc => {
      const data = doc.data();
      const { tools, ...rest } = data;
      return rest as T;
    });
  }
  
  return snapshot.docs.map(doc => doc.data() as T);
};

export const queryTools = async <T>(options: {
  verified?: boolean;
  functionName?: string;
} = {}): Promise<T[]> => {
  let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.AGENTS)
    .select('tools', 'image'); 
  
  if (options.verified) {
    query = query.where('verified', '==', true);
  }

  const snapshot = await query.get();

  const tools: any[] = [];
  
  snapshot.docs.forEach(doc => {
    const agent = doc.data();
    if (agent.tools) {
      agent.tools.forEach((tool: any) => {
        const toolWithImage = { ...tool, image: agent.image };
        
        if (options.functionName) {
          if (tool.name.toLowerCase().includes(options.functionName.toLowerCase())) {
            tools.push(toolWithImage);
          }
        } else {
          tools.push(toolWithImage);
        }
      });
    }
  });

  const uniqueTools = tools.filter((tool, index, self) =>
    index === self.findIndex(t => t.function.name === tool.function.name)
  );
  
  return uniqueTools as T[];
};
