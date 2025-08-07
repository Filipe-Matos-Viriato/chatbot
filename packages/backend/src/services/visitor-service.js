// packages/backend/src/services/visitor-service.js
import * as clientConfigService from './client-config-service.js';
import supabase from '../config/supabase.js'; // Import Supabase client

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
        console.warn(`No scoring rules found for client ${clientId}`);
        return null;
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
      .update({ lead_score: newLeadScore, updated_at: new Date().toISOString() })
      .eq('visitor_id', visitorId)
      .select();

    if (updateError) {
      console.error('Error updating visitor lead score in Supabase:', updateError);
      throw new Error('Failed to update visitor score');
    }

    console.log(`Event logged for ${visitorId}: ${eventType}, score impact: ${scoreImpact}, new score: ${newLeadScore}`);

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
async acknowledgeLeads(visitorIds) {
    const { error } = await supabase
      .from('visitors')
      .update({ is_acknowledged: true, updated_at: new Date().toISOString() })
      .in('visitor_id', visitorIds);

    if (error) {
      console.error('Error acknowledging leads in Supabase:', error);
      throw new Error('Failed to acknowledge leads');
    }
    console.log(`Acknowledged leads: ${visitorIds.join(', ')}`);
  }
}
export default new VisitorService();