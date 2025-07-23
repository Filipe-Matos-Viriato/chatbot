const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Supabase URL or Service Role Key is missing in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Helper function to calculate Euclidean distance
function euclideanDistance(vec1, vec2) {
  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    sum += (vec1[i] - vec2[i]) ** 2;
  }
  return Math.sqrt(sum);
}

// K-Means implementation
function initializeCentroids(data, k) {
  const centroids = [];
  const dataRange = data.length;
  for (let i = 0; i < k; i++) {
    centroids.push(data[Math.floor(Math.random() * dataRange)]);
  }
  return centroids;
}

function assignToCentroids(data, centroids) {
  const assignments = new Array(data.length).fill(0);
  for (let i = 0; i < data.length; i++) {
    let minDistance = Infinity;
    let closestCentroidIndex = -1;
    for (let j = 0; j < centroids.length; j++) {
      const distance = euclideanDistance(data[i], centroids[j]);
      if (distance < minDistance) {
        minDistance = distance;
        closestCentroidIndex = j;
      }
    }
    assignments[i] = closestCentroidIndex;
  }
  return assignments;
}

function updateCentroids(data, assignments, k) {
  const newCentroids = Array.from({ length: k }, () => Array(data[0].length).fill(0));
  const counts = new Array(k).fill(0);

  for (let i = 0; i < data.length; i++) {
    const clusterIndex = assignments[i];
    for (let j = 0; j < data[i].length; j++) {
      newCentroids[clusterIndex][j] += data[i][j];
    }
    counts[clusterIndex]++;
  }

  for (let i = 0; i < k; i++) {
    if (counts[i] > 0) {
      for (let j = 0; j < newCentroids[i].length; j++) {
        newCentroids[i][j] /= counts[i];
      }
    } else {
      // Handle empty clusters by re-initializing them
      newCentroids[i] = data[Math.floor(Math.random() * data.length)];
    }
  }
  return newCentroids;
}

async function clusterQuestions() {
  console.log('Starting question clustering process...');

  const { data: questionData, error: fetchError } = await supabase
    .from('question_embeddings')
    .select(`
      question_id,
      listing_id,
      embedding,
      questions (
        question_text
      )
    `);

  if (fetchError) {
    console.error('Error fetching question embeddings and texts:', fetchError);
    return;
  }

  if (!questionData || questionData.length === 0) {
    console.log('No question embeddings found. Exiting clustering process.');
    return;
  }

  const embeddings = questionData
    .filter(item => item.questions && item.questions.question_text)
    .map(item => ({
      question_id: item.question_id,
      listing_id: item.listing_id,
      embedding: JSON.parse(item.embedding), // Parse the embedding string into an array
      question_text: item.questions.question_text
    }));

  if (embeddings.length === 0) {
    console.log('No valid question texts found for embeddings. Exiting clustering process.');
    return;
  }

  const groupedEmbeddings = embeddings.reduce((acc, curr) => {
    const key = curr.listing_id || 'general';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(curr);
    return acc;
  }, {});

  for (const listingId in groupedEmbeddings) {
    console.log(`Clustering questions for listing_id: ${listingId}`);
    const currentEmbeddings = groupedEmbeddings[listingId];
    const vectors = currentEmbeddings.map(e => e.embedding);

    const k = Math.min(Math.max(Math.ceil(vectors.length * 0.1), 1), 10); // Heuristic for K

    if (vectors.length < k) {
      console.log(`Not enough data points (${vectors.length}) to form ${k} clusters for listing_id: ${listingId}. Skipping clustering.`);
      continue;
    }

    try {
      let centroids = initializeCentroids(vectors, k);
      let assignments;
      let oldAssignments = [];
      const maxIterations = 100;
      let iterations = 0;

      while (iterations < maxIterations) {
        assignments = assignToCentroids(vectors, centroids);
        if (JSON.stringify(assignments) === JSON.stringify(oldAssignments)) {
          break; // Converged
        }
        oldAssignments = assignments;
        centroids = updateCentroids(vectors, assignments, k);
        iterations++;
      }

      const clusteredQuestionsToInsert = [];

      for (let i = 0; i < k; i++) {
        const clusterEmbeddings = [];
        const clusterQuestionTexts = [];
        const clusterQuestionIds = [];

        currentEmbeddings.forEach((item, index) => {
          if (assignments[index] === i) {
            clusterEmbeddings.push(item.embedding);
            clusterQuestionTexts.push(item.question_text);
            clusterQuestionIds.push(item.question_id);
          }
        });

        if (clusterEmbeddings.length === 0) {
          continue;
        }

        const centroid = clusterEmbeddings[0].map((_, colIndex) =>
          clusterEmbeddings.reduce((sum, row) => sum + row[colIndex], 0) / clusterEmbeddings.length
        );

        let minDistance = Infinity;
        let representativeQuestionText = '';
        let representativeQuestionId = '';

        clusterEmbeddings.forEach((embedding, index) => {
          const distance = euclideanDistance(embedding, centroid);
          if (distance < minDistance) {
            minDistance = distance;
            representativeQuestionText = clusterQuestionTexts[index];
            representativeQuestionId = clusterQuestionIds[index];
          }
        });

        const clientId = 'client-abc'; // This should ideally come from a config or be passed

        clusteredQuestionsToInsert.push({
          client_id: clientId,
          listing_id: listingId === 'general' ? null : listingId,
          cluster_id: `${listingId}-${i}`,
          question_text: representativeQuestionText,
          count: clusterEmbeddings.length,
        });
      }

      if (clusteredQuestionsToInsert.length > 0) {
        console.log(`Inserting ${clusteredQuestionsToInsert.length} clustered questions for listing_id: ${listingId}`);
        const { error: upsertError } = await supabase
          .from('clustered_questions')
          .upsert(clusteredQuestionsToInsert, { onConflict: 'cluster_id,listing_id' });

        if (upsertError) {
          console.error('Error upserting clustered questions:', upsertError);
        } else {
          console.log('Successfully upserted clustered questions.');
        }
      } else {
        console.log('No clustered questions to insert.');
      }

    } catch (clusteringError) {
      console.error(`Error during clustering for listing_id ${listingId}:`, clusteringError);
    }
  }

  console.log('Question clustering process finished.');
}

clusterQuestions().catch(console.error);
