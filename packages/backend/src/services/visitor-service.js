// packages/backend/src/services/visitor-service.js
// Service for managing visitor data, lead scoring, and interaction tracking in Supabase.
// To track visitor interactions and calculate lead scores for prioritization.
// Relevant files: config/supabase.js, services/client-config-service.js, index.js
import * as clientConfigService from './client-config-service.js';
import supabase from '../config/supabase.js'; // Import Supabase client
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

class VisitorService {
  constructor() {
    // No longer using in-memory map, data will be stored in Supabase
  }

  async createVisitor(clientId, listingId) {
    // Check if a visitor with this clientId already exists

    const visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newVisitor = {
      visitor_id: visitorId,
      client_id: clientId,
      lead_score: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('🔄 Attempting to insert new visitor into Supabase:', newVisitor);
    const { data, error } = await supabase
      .from('visitors')
      .insert([newVisitor])
      .select();

    console.log('📊 Supabase insert result:', { data, error });

    if (error) {
      console.error('❌ Error creating visitor in Supabase:', error);
      throw new Error('Failed to create visitor');
    }

    if (!data || data.length === 0) {
      console.error('❌ No data returned from visitor creation');
      throw new Error('Failed to create visitor - no data returned');
    }

    console.log(`✅ Visitor created successfully: ${visitorId} for client ${clientId}`);

    return data[0];
  }

  async getClientScoringRules(clientId) {
    try {
      const clientConfig = await clientConfigService.getClientConfig(clientId);
      if (!clientConfig || !clientConfig.leadScoringRules) {
        console.warn(`No scoring rules found for client ${clientId}, using defaults`);
        // Return default scoring rules with qualification threshold
        return {
          engagementBehavior: {
            questions_3_5: 5,
            questions_6_10: 10,
            questions_10_plus: 15,
            time_5_10_min: 5,
            time_10_plus_min: 10,
            clicked_listing: 5,
            returned_within_48h: 10
          },
          questionIntentQuality: {
            asked_pricing: 10,
            asked_location: 10,
            asked_legal: 10,
            asked_remote_buying: 10,
            asked_details: 5,
            asked_availability: 5
          },
          conversionActions: {
            submitted_contact: 15,
            booked_viewing: 30,
            asked_contact_agent: 20,
            requested_brochure: 10
          },
          qualificationThreshold: {
            minScore: 40,
            label: "Warm Lead",
            description: "Minimum score for lead qualification timing"
          },
          decay: {
            enabled: true,
            decayDays: 7,
            decayPoints: 5,
            minScore: 0
          }
        };
      }

      // Ensure qualification threshold exists in client config
      if (!clientConfig.leadScoringRules.qualificationThreshold) {
        clientConfig.leadScoringRules.qualificationThreshold = {
          minScore: 40,
          label: "Warm Lead",
          description: "Minimum score for lead qualification timing"
        };
      }

      return clientConfig.leadScoringRules;
    } catch (error) {
      console.error(`Error loading scoring rules for client ${clientId}:`, error);
      return null;
    }
  }

  async calculateScoreImpact(eventType, visitor, clientId) {
    const scoringRules = await this.getClientScoringRules(clientId);
    if (!scoringRules) {
      return 0;
    }

    // Calculate score impact based on event type
    let scoreImpact = 0;

    // Engagement Behavior
    if (eventType.startsWith('QUESTIONS_')) {
      const questionsCount = parseInt(eventType.split('_')[1]);
      if (questionsCount >= 3 && questionsCount <= 5) {
        scoreImpact = scoringRules.engagementBehavior.questions_3_5;
      } else if (questionsCount >= 6 && questionsCount <= 10) {
        scoreImpact = scoringRules.engagementBehavior.questions_6_10;
      } else if (questionsCount > 10) {
        scoreImpact = scoringRules.engagementBehavior.questions_10_plus;
      }
    } else if (eventType === 'TIME_5_10_MIN') {
      scoreImpact = scoringRules.engagementBehavior.time_5_10_min;
    } else if (eventType === 'TIME_10_PLUS_MIN') {
      scoreImpact = scoringRules.engagementBehavior.time_10_plus_min;
    } else if (eventType === 'CLICKED_LISTING') {
      scoreImpact = scoringRules.engagementBehavior.clicked_listing;
    } else if (eventType === 'RETURNED_WITHIN_48H') {
      scoreImpact = scoringRules.engagementBehavior.returned_within_48h;
    }

    // Question Intent & Quality
    else if (eventType === 'ASKED_PRICING') {
      scoreImpact = scoringRules.questionIntentQuality.asked_pricing;
    } else if (eventType === 'ASKED_LOCATION') {
      scoreImpact = scoringRules.questionIntentQuality.asked_location;
    } else if (eventType === 'ASKED_LEGAL') {
      scoreImpact = scoringRules.questionIntentQuality.asked_legal;
    } else if (eventType === 'ASKED_REMOTE_BUYING') {
      scoreImpact = scoringRules.questionIntentQuality.asked_remote_buying;
    } else if (eventType === 'ASKED_DETAILS') {
      scoreImpact = scoringRules.questionIntentQuality.asked_details;
    } else if (eventType === 'ASKED_AVAILABILITY') {
      scoreImpact = scoringRules.questionIntentQuality.asked_availability;
    }

    // Conversion Actions
    else if (eventType === 'SUBMITTED_CONTACT') {
      scoreImpact = scoringRules.conversionActions.submitted_contact;
    } else if (eventType === 'BOOKED_VIEWING') {
      scoreImpact = scoringRules.conversionActions.booked_viewing;
    } else if (eventType === 'ASKED_CONTACT_AGENT') {
      scoreImpact = scoringRules.conversionActions.asked_contact_agent;
    } else if (eventType === 'REQUESTED_BROCHURE') {
      scoreImpact = scoringRules.conversionActions.requested_brochure;
    }

    return scoreImpact;
  }

  /**
   * Calculate the time it took for a visitor to qualify (reach threshold score)
   * @param {string} visitorId - The visitor ID
   * @param {string} clientId - The client ID
   * @returns {Promise<number>} Qualification time in hours
   */
  async calculateQualificationTime(visitorId, clientId) {
    try {
      // Get visitor creation time
      const { data: visitor, error: visitorError } = await supabase
        .from('visitors')
        .select('created_at')
        .eq('visitor_id', visitorId)
        .single();

      if (visitorError || !visitor) {
        console.error('Error fetching visitor creation time:', visitorError);
        return 0;
      }

      const startTime = new Date(visitor.created_at);

      // Get all events for this visitor to find qualification timestamp
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('timestamp, score_impact')
        .eq('visitor_id', visitorId)
        .order('timestamp', { ascending: true });

      if (eventsError) {
        console.error('Error fetching events for qualification time:', eventsError);
        return 0;
      }

      if (!events || events.length === 0) {
        // No events, use current time as qualification time
        const qualificationTime = new Date();
        return (qualificationTime - startTime) / (1000 * 60 * 60); // hours
      }

      // Reconstruct score progression to find when threshold was reached
      let currentScore = 0;
      let qualificationTimestamp = null;
      const scoringRules = await this.getClientScoringRules(clientId);
      const threshold = scoringRules?.qualificationThreshold?.minScore || 40;

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
      return Math.max(0, qualificationTime); // Ensure non-negative

    } catch (error) {
      console.error('Error calculating qualification time:', error);
      return 0;
    }
  }

  async logEvent(visitorId, eventType, clientId, listingId) { // Add listingId
    const { data: visitorData, error: fetchError } = await supabase
      .from('visitors')
      .select('*')
      .eq('visitor_id', visitorId)
      .single();

    if (fetchError || !visitorData) {
      console.warn(`Visitor with ID ${visitorId} not found in Supabase or error fetching:`, fetchError);
      return null;
    }

    const scoreImpact = await this.calculateScoreImpact(eventType, visitorData, clientId);

    const previousScore = visitorData.lead_score;
    const newLeadScore = visitorData.lead_score + scoreImpact;

    const { data: eventInsertData, error: eventInsertError } = await supabase
      .from('events')
      .insert([{
        visitor_id: visitorId,
        event_type: eventType,
        timestamp: new Date().toISOString(),
        score_impact: scoreImpact,
        listing_id: listingId,
        client_id: clientId
      }]);

    if (eventInsertError) {
      console.error('Error inserting event into Supabase:', eventInsertError);
      throw new Error('Failed to log event');
    }

    // --- NEW LOGIC FOR ENGAGED_USERS AND TOTAL_CONVERSIONS ---
    let clientName = null;
    try {
      const clientConfig = await clientConfigService.getClientConfig(clientId);
      if (clientConfig && clientConfig.clientName) {
        clientName = clientConfig.name;
      }
    } catch (error) {
      console.error(`Error fetching client name for client ${clientId}:`, error);
    }

    if (listingId) {
      // Check if this is the first event for this visitor on this listing
      const { count: existingEventsCount, error: countError } = await supabase
        .from('events')
        .select('id', { count: 'exact' })
        .eq('visitor_id', visitorId)
        .eq('listing_id', listingId);

      if (countError) {
        console.error('Error checking existing events for visitor:', countError);
        return;
      }

      let metricsToUpdate = {};

      // Increment engaged_users if this is the first event for this visitor on this listing
      if (existingEventsCount === 0) { // This is the first event being logged for this visitor/listing combination
        const { data: currentMetrics, error: fetchMetricsError } = await supabase
          .from('listing_metrics')
          .select('engaged_users') // Select the new column name
          .eq('listing_id', listingId)
          .single();

        if (fetchMetricsError && fetchMetricsError.code !== 'PGRST116') {
          console.error('Error fetching current listing_metrics (engaged_users):', fetchMetricsError);
          return;
        }
        metricsToUpdate.engaged_users = currentMetrics ? currentMetrics.engaged_users + 1 : 1;
        console.log(`Incremented engaged_users for listing: ${listingId}`);
      }

      // Increment total_conversions if the event is a conversion action
      const conversionEventTypes = [
        'SUBMITTED_CONTACT',
        'BOOKED_VIEWING',
        'ASKED_CONTACT_AGENT',
        'REQUESTED_BROCHURE'
      ];
      if (conversionEventTypes.includes(eventType)) {
        const { data: currentMetrics, error: fetchMetricsError } = await supabase
          .from('listing_metrics')
          .select('total_conversions')
          .eq('listing_id', listingId)
          .single();

        if (fetchMetricsError && fetchMetricsError.code !== 'PGRST116') {
          console.error('Error fetching current listing_metrics (total_conversions):', fetchMetricsError);
          return;
        }
        metricsToUpdate.total_conversions = currentMetrics ? currentMetrics.total_conversions + 1 : 1;
        console.log(`Incremented total_conversions for listing: ${listingId}`);
      }

      // Update inquiries (existing logic, but ensure it's separate from new metrics)
      if (eventType.startsWith('ASKED_')) {
        const { data: currentMetrics, error: fetchMetricsError } = await supabase
          .from('listing_metrics')
          .select('inquiries')
          .eq('listing_id', listingId)
          .single();

        if (fetchMetricsError && fetchMetricsError.code !== 'PGRST116') {
          console.error('Error fetching current listing_metrics (inquiries):', fetchMetricsError);
          return;
        }
        metricsToUpdate.inquiries = currentMetrics ? currentMetrics.inquiries + 1 : 1;
        console.log(`Incremented inquiries for listing: ${listingId}`);
      }

      // Perform the upsert for all metrics to update
      if (Object.keys(metricsToUpdate).length > 0) {
        metricsToUpdate.listing_id = listingId;
        metricsToUpdate.updated_at = new Date().toISOString();
        if (clientName) {
          metricsToUpdate.client_name = clientName;
        }

        const { error: updateMetricsError } = await supabase
          .from('listing_metrics')
          .upsert(
            metricsToUpdate,
            {
              onConflict: 'listing_id',
              ignoreDuplicates: false,
            }
          );

        if (updateMetricsError) {
          console.error('Error updating listing_metrics:', updateMetricsError);
        } else {
          console.log(`Updated listing_metrics for listing: ${listingId}`);
        }
      }

      // Recalculate and update conversion_rate
      const { data: updatedMetrics, error: fetchUpdatedMetricsError } = await supabase
        .from('listing_metrics')
        .select('engaged_users, total_conversions') // Select new columns
        .eq('listing_id', listingId)
        .single();

      if (fetchUpdatedMetricsError) {
        console.error('Error fetching updated metrics for conversion rate:', fetchUpdatedMetricsError);
      } else {
        const newConversionRate = updatedMetrics.engaged_users > 0
          ? (updatedMetrics.total_conversions / updatedMetrics.engaged_users) * 100
          : 0; // Store as number, not string with '%'

        const { error: updateConversionError } = await supabase
          .from('listing_metrics')
          .upsert(
            {
              listing_id: listingId,
              conversion_rate: newConversionRate,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'listing_id',
              ignoreDuplicates: false,
            }
          );

        if (updateConversionError) {
          console.error('Error updating listing_metrics (conversion_rate):', updateConversionError);
        } else {
          console.log(`Updated conversion_rate for listing: ${listingId} to ${newConversionRate}`);
        }
      }
    }

    const { data: updateData, error: updateError } = await supabase
      .from('visitors')
      .update({
        lead_score: newLeadScore,
        previous_lead_score: previousScore,
        updated_at: new Date().toISOString()
      })
      .eq('visitor_id', visitorId)
      .select();

    if (updateError) {
      console.error('Error updating visitor lead score in Supabase:', updateError);
      throw new Error('Failed to update visitor score');
    }

    console.log(`Event logged for ${visitorId}: ${eventType}, score impact: ${scoreImpact}, new score: ${newLeadScore}`);

    // Check for qualification and update client qualification metrics
    const scoringRules = await this.getClientScoringRules(clientId);
    const qualificationThreshold = scoringRules?.qualificationThreshold?.minScore || 40;

    if (previousScore < qualificationThreshold && newLeadScore >= qualificationThreshold) {
      // Visitor just qualified - calculate and update metrics
      try {
        const qualificationTime = await this.calculateQualificationTime(visitorId, clientId);

        // Update client qualification metrics
        const { data: currentMetrics, error: fetchMetricsError } = await supabase
          .from('client_qualification_metrics')
          .select('qualified_visitors_count, total_qualification_time_hours')
          .eq('client_id', clientId)
          .single();

        let newCount = 1;
        let newTotalTime = qualificationTime;

        if (!fetchMetricsError && currentMetrics) {
          newCount = currentMetrics.qualified_visitors_count + 1;
          newTotalTime = currentMetrics.total_qualification_time_hours + qualificationTime;
        }

        const newAverage = newTotalTime / newCount;

        const { error: updateMetricsError } = await supabase
          .from('client_qualification_metrics')
          .upsert({
            client_id: clientId,
            qualification_threshold: qualificationThreshold,
            qualified_visitors_count: newCount,
            total_qualification_time_hours: newTotalTime,
            avg_qualification_time_hours: newAverage,
            last_updated: new Date().toISOString()
          });

        if (updateMetricsError) {
          console.error('Error updating client qualification metrics:', updateMetricsError);
        } else {
          console.log(`Updated qualification metrics for client ${clientId}: ${newCount} qualified visitors, avg ${newAverage.toFixed(2)} hours`);
        }
      } catch (error) {
        console.error('Error updating qualification metrics:', error);
      }
    }

    // Increment hot_leads if the visitor becomes a hot lead and listingId is provided
    if (listingId && newLeadScore >= 70 && visitorData.lead_score < 70) { // Check if they just crossed the threshold
      const { data: currentMetrics, error: fetchMetricsError } = await supabase
        .from('listing_metrics')
        .select('unacknowledged_hot_leads')
        .eq('listing_id', listingId)
        .single();

      if (fetchMetricsError && fetchMetricsError.code !== 'PGRST116') {
        console.error('Error fetching current listing_metrics (unacknowledged_hot_leads):', fetchMetricsError);
        return;
      }

      const newHotLeads = currentMetrics ? currentMetrics.unacknowledged_hot_leads + 1 : 1;

      const { error: updateMetricsError } = await supabase
        .from('listing_metrics')
        .upsert(
          {
            listing_id: listingId,
            unacknowledged_hot_leads: newHotLeads,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'listing_id',
            ignoreDuplicates: false,
          }
        );

      if (updateMetricsError) {
        console.error('Error updating listing_metrics (unacknowledged_hot_leads):', updateMetricsError);
      } else {
        console.log(`Incremented unacknowledged_hot_leads for listing: ${listingId}`);
      }
    }

    // Update lead_score_distribution if listingId is provided
    if (listingId) {
      const { data: currentMetrics, error: fetchMetricsError } = await supabase
        .from('listing_metrics')
        .select('lead_score_distribution_hot, lead_score_distribution_warm, lead_score_distribution_cold')
        .eq('listing_id', listingId)
        .single();

      if (fetchMetricsError && fetchMetricsError.code !== 'PGRST116') {
        console.error('Error fetching current listing_metrics (lead_score_distribution):', fetchMetricsError);
        return;
      }

      let hot = currentMetrics ? currentMetrics.lead_score_distribution_hot : 0;
      let warm = currentMetrics ? currentMetrics.lead_score_distribution_warm : 0;
      let cold = currentMetrics ? currentMetrics.lead_score_distribution_cold : 0;

      // Decrement previous category if score changed categories
      if (visitorData.lead_score < 40 && newLeadScore >= 40) { // Cold to Warm/Hot
        cold = Math.max(0, cold - 1);
      }
      if (visitorData.lead_score >= 40 && visitorData.lead_score < 70 && newLeadScore < 40) { // Warm to Cold
        warm = Math.max(0, warm - 1);
      }
      if (visitorData.lead_score >= 40 && visitorData.lead_score < 70 && newLeadScore >= 70) { // Warm to Hot
        warm = Math.max(0, warm - 1);
      }
      if (visitorData.lead_score >= 70 && newLeadScore < 70) { // Hot to Warm/Cold
        hot = Math.max(0, hot - 1);
      }

      // Increment current category
      if (newLeadScore >= 70) {
        hot++;
      } else if (newLeadScore >= 40) {
        warm++;
      } else {
        cold++;
      }

      const { error: updateMetricsError } = await supabase
        .from('listing_metrics')
        .upsert(
          {
            listing_id: listingId,
            lead_score_distribution_hot: hot,
            lead_score_distribution_warm: warm,
            lead_score_distribution_cold: cold,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'listing_id',
            ignoreDuplicates: false,
          }
        );

      if (updateMetricsError) {
        console.error('Error updating listing_metrics (lead_score_distribution):', updateMetricsError);
      } else {
        console.log(`Updated lead_score_distribution for listing: ${listingId}`);
      }
    }

    return updateData[0];
  }

  async getVisitor(visitorId) {
    const { data, error } = await supabase
      .from('visitors')
      .select('*')
      .eq('visitor_id', visitorId)
      .single();

    if (error) {
      console.error('Error fetching visitor from Supabase:', error);
      return null;
    }
    return data;
  }

  /**
   * Update visitor contact information
   * @param {string} visitorId - Visitor ID
   * @param {string} clientId - Client ID
   * @param {Object} contactInfo - Contact information {email, phone}
   * @returns {Promise<Object>} - Updated visitor
   */
  async updateVisitorContact(visitorId, clientId, contactInfo) {
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (contactInfo.email) {
      updateData.email = contactInfo.email;
    }

    if (contactInfo.phone) {
      updateData.phone = contactInfo.phone;
    }

    const { data, error } = await supabase
      .from('visitors')
      .update(updateData)
      .eq('visitor_id', visitorId)
      .eq('client_id', clientId)
      .select();

    if (error) {
      console.error('Error updating visitor contact info:', error);
      throw new Error('Failed to update visitor contact information');
    }

    console.log(`Updated contact info for visitor ${visitorId}`);
    return data[0];
  }

  async getLeadsByListingId(listingId, clientId) {
    // Fetch unique visitor_ids from the events table that are associated with the given listingId and clientId
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('visitor_id', { distinct: true }) // Use distinct to get unique visitor_ids
      .eq('listing_id', listingId)
      .eq('client_id', clientId);

    if (eventError) {
      console.error('Error fetching events for listing leads:', eventError);
      throw new Error('Failed to fetch events for listing leads');
    }

    const visitorIds = eventData.map(event => event.visitor_id);
    // Ensure uniqueness in case distinct: true doesn't cover all edge cases or if there are other ways to get duplicates
    const uniqueVisitorIds = [...new Set(visitorIds)];

    if (visitorIds.length === 0) {
      return []; // No visitors found for this listing
    }

    // Fetch the actual visitor data for these unique visitor_ids
    const { data: visitors, error: visitorError } = await supabase
      .from('visitors')
      .select('visitor_id, lead_score, previous_lead_score, created_at, updated_at') // Include previous_lead_score
      .in('visitor_id', visitorIds);

    if (visitorError) {
      console.error('Error fetching visitors by IDs:', visitorError);
      throw new Error('Failed to fetch visitors by IDs');
    }

    return visitors;
  }

  /**
   * Get score history for a visitor by reconstructing from events
   * Returns array of {timestamp, score} points for sparkline visualization
   */
  async getVisitorScoreHistory(visitorId, maxPoints = 15) {
    try {
      // Fetch all events for this visitor ordered by timestamp
      const { data: events, error } = await supabase
        .from('events')
        .select('timestamp, score_impact')
        .eq('visitor_id', visitorId)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error fetching events for score history:', error);
        return [];
      }

      if (!events || events.length === 0) {
        return [];
      }

      // Reconstruct score history by cumulatively adding score impacts
      let currentScore = 0;
      const scoreHistory = [];

      // Add initial point at visitor creation (score = 0)
      const { data: visitor, error: visitorError } = await supabase
        .from('visitors')
        .select('created_at')
        .eq('visitor_id', visitorId)
        .single();

      if (!visitorError && visitor) {
        scoreHistory.push({
          timestamp: visitor.created_at,
          score: 0
        });
      }

      // Add score changes from events
      for (const event of events) {
        currentScore += event.score_impact;
        scoreHistory.push({
          timestamp: event.timestamp,
          score: Math.max(0, currentScore) // Ensure score doesn't go below 0
        });
      }

      // Return last N points for sparkline (most recent history)
      return scoreHistory.slice(-maxPoints);
    } catch (error) {
      console.error('Error reconstructing visitor score history:', error);
      return [];
    }
  }

  /**
   * Apply score decay to stagnant visitors for a specific client
   */
  async applyScoreDecay(clientId) {
    try {
      // Get client-specific decay configuration
      const clientConfig = await clientConfigService.getClientConfig(clientId);
      const decayConfig = clientConfig?.leadScoringRules?.decay || {
        enabled: true,
        decayDays: 7,
        decayPoints: 5,
        minScore: 0
      };

      if (!decayConfig.enabled) {
        console.log(`Score decay disabled for client ${clientId}`);
        return;
      }

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - decayConfig.decayDays);

      // Find stagnant visitors
      const { data: stagnantVisitors, error: fetchError } = await supabase
        .from('visitors')
        .select('visitor_id, lead_score')
        .eq('client_id', clientId)
        .lt('updated_at', cutoffDate.toISOString())
        .gt('lead_score', decayConfig.minScore);

      if (fetchError) {
        console.error('Error fetching stagnant visitors:', fetchError);
        return;
      }

      if (!stagnantVisitors || stagnantVisitors.length === 0) {
        console.log(`No stagnant visitors found for client ${clientId}`);
        return;
      }

      // Apply decay to each visitor
      for (const visitor of stagnantVisitors) {
        const newScore = Math.max(visitor.lead_score - decayConfig.decayPoints, decayConfig.minScore);

        const { error: updateError } = await supabase
          .from('visitors')
          .update({
            lead_score: newScore,
            previous_lead_score: visitor.lead_score,
            updated_at: new Date().toISOString()
          })
          .eq('visitor_id', visitor.visitor_id);

        if (updateError) {
          console.error(`Error applying decay to visitor ${visitor.visitor_id}:`, updateError);
        } else {
          console.log(`Applied decay to visitor ${visitor.visitor_id}: ${visitor.lead_score} → ${newScore}`);
        }
      }

      console.log(`Applied score decay to ${stagnantVisitors.length} visitors for client ${clientId}`);
    } catch (error) {
      console.error(`Error in applyScoreDecay for client ${clientId}:`, error);
    }
  }

  async acknowledgeLeads(visitorIds) {
    const { error } = await supabase
      .from('visitors')
      .update({ is_acknowledged: true })
      .in('visitor_id', visitorIds);

    if (error) {
      console.error('Error acknowledging leads in Supabase:', error);
      throw new Error('Failed to acknowledge leads');
    }
    console.log(`Acknowledged leads: ${visitorIds.join(', ')}`);
  }

  /**
   * Compute qualification score from onboarding answers using client-configurable rules.
   */
  computeLeadScoreFromOnboarding(onboarding, rules) {
    const defaultRules = {
      weights: {
        timeframe: { asap: 10, "1_3_months": 7, "3_6_months": 4, "6_plus_months": 2, browsing: 0 },
        budgetProvided: 3,
        // Optional fine-grained bucket weights (fallbacks to budgetProvided when absent)
        budgetBuckets: {
          "100_200k": 1,
          "200_300k": 2,
          "300_400k": 3,
          "400_500k": 4,
          "500k_plus": 5,
          "prefer_not_to_say": 0,
        },
        typologySpecified: 3,
        consentMarketing: 2,
      },
      minScoreOnCompletion: 5,
      maxScore: 20,
    };

    const cfg = rules || defaultRules;
    const w = cfg.weights || defaultRules.weights;

    let score = 0;
    const timeframeRaw = (onboarding?.buying_timeframe || '').toLowerCase();
    const budgetRaw = (onboarding?.budget_bucket || '').toLowerCase();
    const typology = onboarding?.typology || '';
    const consent = Boolean(onboarding?.consent_marketing);

    // Normalize timeframe
    const timeframeKey = (timeframeRaw.includes('asap') || timeframeRaw.includes('<1')) ? 'asap'
      : (timeframeRaw.includes('1–3') || timeframeRaw.includes('1-3') || /\b1\s*[\-–]\s*3\b/.test(timeframeRaw)) ? '1_3_months'
      : (timeframeRaw.includes('3–6') || timeframeRaw.includes('3-6') || /\b3\s*[\-–]\s*6\b/.test(timeframeRaw)) ? '3_6_months'
      : (timeframeRaw.includes('6+') || timeframeRaw.includes('6 +') || timeframeRaw.includes('6 plus') || timeframeRaw.includes('6 meses') || timeframeRaw.includes('6+ meses')) ? '6_plus_months'
      : (timeframeRaw.includes('brows') || timeframeRaw.includes('explorar')) ? 'browsing'
      : null;

    if (timeframeKey && w.timeframe?.[timeframeKey] != null) {
      score += Number(w.timeframe[timeframeKey]) || 0;
    }
    // Budget scoring: prefer fine-grained buckets if configured
    if (budgetRaw) {
      // Normalize to canonical keys
      const raw = budgetRaw
        .replace(/€/g, '')
        .replace(/\s+/g, '')
        .replace(/–/g, '-') // normalize en dash
        .trim();
      let budgetKey = null;
      if (/^100-200k$/i.test(raw)) budgetKey = '100_200k';
      else if (/^200-300k$/i.test(raw)) budgetKey = '200_300k';
      else if (/^300-400k$/i.test(raw)) budgetKey = '300_400k';
      else if (/^400-500k$/i.test(raw)) budgetKey = '400_500k';
      else if (/^500k\+?$/i.test(raw) || /^>500k$/i.test(raw) || /^500\+k$/i.test(raw)) budgetKey = '500k_plus';
      else if (raw.includes('prefernottosay') || raw.includes('prefernot') || raw.includes('prefironãodizer') || raw.includes('preferirnão')) budgetKey = 'prefer_not_to_say';

      const bucketWeights = w.budgetBuckets;
      if (budgetKey && bucketWeights && Object.prototype.hasOwnProperty.call(bucketWeights, budgetKey)) {
        score += Number(bucketWeights[budgetKey]) || 0;
      } else if (!raw.includes('prefernot') && !raw.includes('prefironãodizer') && !raw.includes('preferirnão')) {
        // Fallback: any provided budget gets the generic weight
        score += Number(w.budgetProvided) || 0;
      }
    }
    if (typology && !/other|not sure|indiferente|outro/i.test(typology)) {
      score += Number(w.typologySpecified) || 0;
    }
    if (consent) {
      score += Number(w.consentMarketing) || 0;
    }

    const capped = Math.min(score, cfg.maxScore || defaultRules.maxScore);
    if ((cfg.minScoreOnCompletion || 0) > 0) {
      return Math.max(capped, cfg.minScoreOnCompletion);
    }
    return capped;
  }

  async upsertVisitorPreferenceProfileToPinecone(clientId, visitorId, onboarding) {
    try {
      // Non-PII content summary
      const summary = [
        onboarding?.typology ? `Typology: ${onboarding.typology}` : null,
        onboarding?.budget_bucket ? `Budget: ${onboarding.budget_bucket}` : null,
        onboarding?.buying_timeframe ? `Timeframe: ${onboarding.buying_timeframe}` : null,
      ].filter(Boolean).join(', ');

      if (!summary) return;

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

      const embed = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: `Visitor preference profile for personalization. ${summary}`,
      });
      const vector = embed?.data?.[0]?.embedding;
      if (!vector) return;

      const indexName = process.env.PINECONE_INDEX || 'rachatbot-1536';
      const index = pinecone.index(indexName).namespace(clientId);
      await index.upsert([
        {
          id: `visitor_profile_${visitorId}`,
          values: vector,
          metadata: {
            client_id: clientId,
            visitor_id: visitorId,
            typology: onboarding?.typology || null,
            budget_bucket: onboarding?.budget_bucket || null,
            buying_timeframe: onboarding?.buying_timeframe || null,
            category: 'visitor_profile',
          },
        },
      ]);
    } catch (error) {
      console.error('Failed to upsert visitor preference profile to Pinecone:', error);
    }
  }

  /**
   * Save onboarding answers into visitors table and compute/update lead_score.
   */
  async saveOnboarding(visitorId, clientId, onboardingPayload) {
    // Fetch existing visitor
    const { data: existing, error: fetchError } = await supabase
      .from('visitors')
      .select('*')
      .eq('visitor_id', visitorId)
      .single();

    if (fetchError || !existing) {
      throw new Error('Visitor not found');
    }

    // Load client config to get onboarding scoring rules
    let onboardingRules = null;
    try {
      const clientConfig = await clientConfigService.getClientConfig(clientId);
      onboardingRules = clientConfig?.onboardingScoringRules || null;
    } catch (e) {
      console.warn('Failed to load client config for onboarding scoring, using defaults');
    }

    const newScore = this.computeLeadScoreFromOnboarding(onboardingPayload, onboardingRules);
    const mergedOnboarding = { ...(existing.onboarding_questions || {}), ...onboardingPayload };
    const previousScore = existing.lead_score;

    const { data: updated, error: updateError } = await supabase
      .from('visitors')
      .update({
        onboarding_questions: mergedOnboarding,
        onboarding_completed: true,
        // Use the higher of the two to avoid double-counting with events
        lead_score: Math.max(existing.lead_score || 0, newScore),
        previous_lead_score: previousScore,
        updated_at: new Date().toISOString(),
      })
      .eq('visitor_id', visitorId)
      .select();

    if (updateError) {
      throw new Error('Failed to save onboarding');
    }

    // Fire-and-forget: upsert non-PII preference profile to Pinecone
    this.upsertVisitorPreferenceProfileToPinecone(clientId, visitorId, mergedOnboarding).catch(() => {});

    return updated?.[0];
  }
}
export default new VisitorService();