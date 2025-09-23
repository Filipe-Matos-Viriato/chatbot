/**
 * Migration script to populate client_qualification_metrics table
 * with historical data from existing visitors and events tables
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure SUPABASE_URL and SUPABASE_ANON_KEY are set in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function populateQualificationMetrics() {
  console.log('🚀 Starting qualification metrics population...');

  try {
    // Get all clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('client_id, client_name, lead_scoring_rules');

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    if (!clients || clients.length === 0) {
      console.log('⚠️ No clients found');
      return;
    }

    console.log(`📊 Processing ${clients.length} clients...`);

    for (const client of clients) {
      console.log(`\n🔄 Processing client: ${client.client_name} (${client.client_id})`);

      try {
        // Get client's qualification threshold
        const scoringRules = client.lead_scoring_rules || {};
        const threshold = scoringRules.qualificationThreshold?.minScore || 40;

        console.log(`🎯 Using qualification threshold: ${threshold}`);

        // Get all qualified visitors for this client
        const { data: qualifiedVisitors, error: visitorsError } = await supabase
          .from('visitors')
          .select('visitor_id, lead_score, created_at')
          .eq('client_id', client.client_id)
          .gte('lead_score', threshold);

        if (visitorsError) {
          console.error(`❌ Error fetching qualified visitors for ${client.client_id}:`, visitorsError);
          continue;
        }

        if (!qualifiedVisitors || qualifiedVisitors.length === 0) {
          console.log(`⚠️ No qualified visitors found for ${client.client_id}`);
          continue;
        }

        console.log(`👥 Found ${qualifiedVisitors.length} qualified visitors`);

        // Calculate qualification times for each visitor
        const qualificationTimes = [];
        let processedCount = 0;

        for (const visitor of qualifiedVisitors) {
          try {
            // Calculate qualification time directly (inline implementation)
            const startTime = new Date(visitor.created_at);

            // Get all events for this visitor to find qualification timestamp
            const { data: events, error: eventsError } = await supabase
              .from('events')
              .select('timestamp, score_impact')
              .eq('visitor_id', visitor.visitor_id)
              .order('timestamp', { ascending: true });

            if (eventsError) {
              console.warn(`⚠️ Error fetching events for visitor ${visitor.visitor_id}:`, eventsError.message);
              continue;
            }

            if (!events || events.length === 0) {
              // No events, use current time as qualification time
              const qualificationTime = (new Date() - startTime) / (1000 * 60 * 60); // hours
              if (qualificationTime > 0) {
                qualificationTimes.push(qualificationTime);
              }
              continue;
            }

            // Reconstruct score progression to find when threshold was reached
            let currentScore = 0;
            let qualificationTimestamp = null;

            for (const event of events) {
              currentScore += event.score_impact;

              // Check if this event caused qualification (score just crossed threshold)
              if (currentScore >= threshold && !qualificationTimestamp) {
                qualificationTimestamp = new Date(event.timestamp);
                break;
              }
            }

            if (!qualificationTimestamp) {
              // If no qualification found in events, use last event time
              qualificationTimestamp = new Date(events[events.length - 1].timestamp);
            }

            const qualificationTime = (qualificationTimestamp - startTime) / (1000 * 60 * 60); // hours
            if (qualificationTime > 0) {
              qualificationTimes.push(Math.max(0, qualificationTime));
            }

            processedCount++;
            if (processedCount % 10 === 0) {
              console.log(`⏳ Processed ${processedCount}/${qualifiedVisitors.length} visitors...`);
            }
          } catch (error) {
            console.warn(`⚠️ Error calculating qualification time for visitor ${visitor.visitor_id}:`, error.message);
          }
        }

        if (qualificationTimes.length === 0) {
          console.log(`⚠️ No valid qualification times calculated for ${client.client_id}`);
          continue;
        }

        // Calculate aggregate metrics
        const totalTime = qualificationTimes.reduce((sum, time) => sum + time, 0);
        const averageTime = totalTime / qualificationTimes.length;

        console.log(`📈 Calculated metrics:`);
        console.log(`   - Qualified visitors: ${qualificationTimes.length}`);
        console.log(`   - Total qualification time: ${totalTime.toFixed(2)} hours`);
        console.log(`   - Average qualification time: ${averageTime.toFixed(2)} hours`);

        // Insert/update metrics in the database
        const { error: insertError } = await supabase
          .from('client_qualification_metrics')
          .upsert({
            client_id: client.client_id,
            qualification_threshold: threshold,
            qualified_visitors_count: qualificationTimes.length,
            total_qualification_time_hours: totalTime,
            avg_qualification_time_hours: averageTime,
            last_updated: new Date().toISOString()
          });

        if (insertError) {
          console.error(`❌ Error inserting metrics for ${client.client_id}:`, insertError);
        } else {
          console.log(`✅ Successfully populated metrics for ${client.client_id}`);
        }

      } catch (error) {
        console.error(`❌ Error processing client ${client.client_id}:`, error);
      }
    }

    console.log('\n🎉 Qualification metrics population completed!');

    // Print summary
    const { data: summary, error: summaryError } = await supabase
      .from('client_qualification_metrics')
      .select('client_id, qualified_visitors_count, avg_qualification_time_hours');

    if (!summaryError && summary) {
      console.log('\n📊 Summary of populated metrics:');
      summary.forEach(metric => {
        console.log(`   ${metric.client_id}: ${metric.qualified_visitors_count} visitors, avg ${metric.avg_qualification_time_hours?.toFixed(2) || 0} hours`);
      });
    }

  } catch (error) {
    console.error('❌ Fatal error in populateQualificationMetrics:', error);
  }
}

// Run the script
populateQualificationMetrics()
  .then(() => {
    console.log('🏁 Script execution completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script execution failed:', error);
    process.exit(1);
  });