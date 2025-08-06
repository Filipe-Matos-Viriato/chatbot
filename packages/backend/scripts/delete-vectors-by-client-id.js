import { Pinecone } from '@pinecone-database/pinecone';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file in the backend root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function deleteVectorsByClientId(indexName, clientId) {
  try {
    const { PINECONE_API_KEY, PINECONE_NAMESPACE } = process.env;

    if (!PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY is not set in the environment variables. Please check your .env file.');
    }

    const pinecone = new Pinecone({
      apiKey: PINECONE_API_KEY,
    });

    // 1. Get the index host using the SDK's describeIndex method
    console.log(`Describing index '${indexName}' to get the host...`);
    const indexDescription = await pinecone.describeIndex(indexName);
    if (!indexDescription || !indexDescription.host) {
      throw new Error(`Could not describe index '${indexName}'. Please ensure the index exists and the API key is correct.`);
    }
    const indexHost = indexDescription.host;
    console.log(`Found index host: ${indexHost}`);

    const namespace = PINECONE_NAMESPACE || "";

    if (!namespace) {
      console.warn("Warning: PINECONE_NAMESPACE environment variable is not set. Deleting from the default namespace.");
    }

    // 2. Construct the direct API call using axios
    const apiUrl = `https://${indexHost}/vectors/delete`;
    const requestBody = {
      filter: {
        'client_id': clientId,
      },
      namespace: namespace,
    };
    const requestConfig = {
      headers: {
        'Api-Key': PINECONE_API_KEY,
        'Content-Type': 'application/json',
      },
    };

    console.log(`Sending POST request to: ${apiUrl}`);
    console.log(`Request body: ${JSON.stringify(requestBody, null, 2)}`);
    
    await axios.post(apiUrl, requestBody, requestConfig);

    console.log(`\nDeletion request for clientId '${clientId}' was sent successfully.`);
    console.log("The deletion is an asynchronous process. Please check your Pinecone dashboard to monitor its progress.");

  } catch (error) {
    if (axios.isAxiosError(error)) {
        console.error(`\nAn Axios error occurred during the deletion process for clientId '${clientId}':`, error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
    } else {
        console.error(`\nAn unexpected error occurred for clientId '${clientId}':`, error.message);
    }
    process.exit(1);
  }
}

function main() {
  const [,, indexName, clientId] = process.argv;

  if (!indexName || !clientId) {
    console.error("Error: Please provide both the Pinecone index name and the client ID for deletion.");
    console.log("\nUsage: node packages/backend/scripts/delete-vectors-by-client-id.js <indexName> <clientIdToDelete>");
    console.log("Example: node packages/backend/scripts/delete-vectors-by-client-id.js upinvestments-1536 client-abc\n");
    process.exit(1);
  }

  console.log('--- Starting Pinecone Vector Deletion Script ---');
  deleteVectorsByClientId(indexName, clientId)
    .then(() => {
      console.log('--- Script has finished execution ---');
    })
    .catch(() => {
      // The error is already logged in deleteVectorsByClientId, so just exit
      process.exit(1);
    });
}

main();
