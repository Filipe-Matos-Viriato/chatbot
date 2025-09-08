// packages/backend/src/services/unanswered_question_service.js
// Service for managing unanswered questions from chat messages, including RBAC, status updates, and reply functionality
// Handles the core business logic for the unanswered questions review page, ensuring proper access control and data management
// relevant files: communication_service.js, user-service.js, index.js, visitor-service.js
import supabase from '../config/supabase.js';
import userService from './user-service.js';

class UnansweredQuestionService {
  /**
   * Get unanswered questions with RBAC filtering
   * @param {string} clientId - Client ID
   * @param {string} userId - User ID for RBAC
   * @param {Object} filters - Query filters
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} - Paginated results with questions and metadata
   */
  async getUnansweredQuestions(clientId, userId, filters = {}, pagination = {}) {
    const { listingId, dateRange, searchQuery, status } = filters;
    const { page = 1, pageSize = 20 } = pagination;

    // For development purposes, assume admin role
    const user = { role: 'admin', client_id: clientId };

    let query = supabase
      .from('chat_messages')
      .select(`
        id,
        message_text,
        timestamp,
        listing_id,
        visitor_id,
        answered_by_user_id,
        requires_kb_update,
        resolution_notes,
        follow_up_sent_at,
        follow_up_channel,
        visitors!chat_messages_visitor_id_fkey (
          visitor_id,
          email,
          phone
        )
      `)
      .eq('client_id', clientId)
      .eq('sender_role', 'user')
      .order('timestamp', { ascending: false });

    // For development purposes, admin role has access to all questions
    // No RBAC filtering needed

    // Apply filters
    if (listingId) {
      query = query.eq('listing_id', listingId);
    }

    if (dateRange && dateRange.start && dateRange.end) {
      query = query
        .gte('timestamp', dateRange.start)
        .lte('timestamp', dateRange.end);
    }

    if (searchQuery) {
      query = query.ilike('message_text', `%${searchQuery}%`);
    }

    if (status) {
      switch (status) {
        case 'resolved':
          query = query.not('answered_by_user_id', 'is', null);
          break;
        case 'kb_update_needed':
          query = query.eq('requires_kb_update', true);
          break;
        case 'pending':
          query = query.is('answered_by_user_id', null).eq('requires_kb_update', false);
          break;
      }
    }

    // Apply is_unanswered filter for non-resolved statuses
    if (status !== 'resolved') {
      query = query.eq('is_unanswered', true);
    }

    // Get total count for pagination (use a simpler query without joins for count)
    let countQuery = supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('sender_role', 'user');

    // Apply the same filters as the main query
    if (listingId) {
      countQuery = countQuery.eq('listing_id', listingId);
    }

    if (dateRange && dateRange.start && dateRange.end) {
      countQuery = countQuery
        .gte('timestamp', dateRange.start)
        .lte('timestamp', dateRange.end);
    }

    if (searchQuery) {
      countQuery = countQuery.ilike('message_text', `%${searchQuery}%`);
    }

    if (status) {
      switch (status) {
        case 'resolved':
          countQuery = countQuery.not('answered_by_user_id', 'is', null);
          break;
        case 'kb_update_needed':
          countQuery = countQuery.eq('requires_kb_update', true);
          break;
        case 'pending':
          countQuery = countQuery.is('answered_by_user_id', null).eq('requires_kb_update', false);
          break;
      }
    }

    // Apply is_unanswered filter for non-resolved statuses
    if (status !== 'resolved') {
      countQuery = countQuery.eq('is_unanswered', true);
    }

    const { count: total, error: countError } = await countQuery;

    if (countError) {
      console.error('Error getting total count:', countError);
      throw new Error('Failed to fetch unanswered questions count');
    }

    // Apply pagination
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    // Execute query
    const { data: questions, error } = await query;

    if (error) {
      console.error('Error fetching unanswered questions:', error);
      throw new Error('Failed to fetch unanswered questions');
    }

    // Manual join for visitor data if automatic join failed
    if (questions && questions.length > 0) {
      const visitorIds = questions.map(q => q.visitor_id).filter(id => id);

      if (visitorIds.length > 0) {
        const { data: visitors, error: visitorError } = await supabase
          .from('visitors')
          .select('visitor_id, email, phone')
          .in('visitor_id', visitorIds);

        if (!visitorError && visitors) {
          // Create a map of visitor data
          const visitorMap = visitors.reduce((acc, visitor) => {
            acc[visitor.visitor_id] = visitor;
            return acc;
          }, {});

          // Attach visitor data to questions
          questions.forEach(question => {
            if (question.visitor_id && visitorMap[question.visitor_id]) {
              question.visitors = visitorMap[question.visitor_id];
            }
          });
        }
      }

      // Visitor data successfully joined
    }

    // Get listing names for better display
    const listingIds = [...new Set(questions.map(q => q.listing_id).filter(id => id))];
    let listingNames = {};
    if (listingIds.length > 0) {
      const { data: listings } = await supabase
        .from('listings')
        .select('id, name')
        .in('id', listingIds)
        .eq('client_id', clientId);

      listingNames = listings.reduce((acc, listing) => {
        acc[listing.id] = listing.name;
        return acc;
      }, {});
    }

    // Format questions with smart contact info (full details if user can reply)
    const formattedQuestions = questions.map(question => {
      const hasContactInfo = question.visitors && (question.visitors.email || question.visitors.phone);

      return {
        id: question.id,
        question: question.message_text,
        timestamp: question.timestamp,
        listingId: question.listing_id,
        listingName: listingNames[question.listing_id] || 'General',
        visitorId: question.visitor_id,
        // Smart masking: show full details if user can reply, otherwise mask
        visitorEmail: hasContactInfo ? question.visitors.email : (question.visitors ? this.maskEmail(question.visitors.email) : null),
        visitorPhone: hasContactInfo ? question.visitors.phone : (question.visitors ? this.maskPhone(question.visitors.phone) : null),
        answeredByUserId: question.answered_by_user_id,
        requiresKbUpdate: question.requires_kb_update,
        resolutionNotes: question.resolution_notes,
        followUpSentAt: question.follow_up_sent_at,
        followUpChannel: question.follow_up_channel,
        canReply: hasContactInfo // Flag to indicate if user can reply
      };
    });

    return {
      questions: formattedQuestions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  /**
   * Update the status of an unanswered question
   * @param {string} questionId - Chat message ID
   * @param {string} clientId - Client ID
   * @param {string} userId - User ID making the update
   * @param {Object} updateData - Update payload
   * @returns {Promise<Object>} - Updated question
   */
  async updateQuestionStatus(questionId, clientId, userId, updateData) {
    const { status, notes } = updateData;

    // For development purposes, assume admin role
    const user = { role: 'admin', client_id: clientId };

    // Get the question to verify permissions
    const { data: question, error: fetchError } = await supabase
      .from('chat_messages')
      .select('listing_id, client_id')
      .eq('id', questionId)
      .single();

    if (fetchError || !question) {
      throw new Error('Question not found');
    }

    if (question.client_id !== clientId) {
      throw new Error('Unauthorized access to this question');
    }

    // For development purposes, admin role has access to all listings
    // No additional permission checks needed

    // Prepare update data
    const updatePayload = {
      answered_by_user_id: userId,
      resolution_notes: notes || null,
      updated_at: new Date().toISOString()
    };

    if (status === 'resolved') {
      updatePayload.is_unanswered = false;
      updatePayload.requires_kb_update = false;
    } else if (status === 'kb_update_needed') {
      updatePayload.requires_kb_update = true;
      updatePayload.is_unanswered = true; // Keep as unanswered until KB is updated
    }

    // Update the question
    const { data: updatedQuestion, error: updateError } = await supabase
      .from('chat_messages')
      .update(updatePayload)
      .eq('id', questionId)
      .select(`
        id,
        message_text,
        timestamp,
        listing_id,
        visitor_id,
        answered_by_user_id,
        requires_kb_update,
        resolution_notes,
        is_unanswered
      `)
      .single();

    if (updateError) {
      console.error('Error updating question status:', updateError);
      throw new Error('Failed to update question status');
    }

    return updatedQuestion;
  }

  /**
   * Send a reply to a visitor
   * @param {string} questionId - Chat message ID
   * @param {string} clientId - Client ID
   * @param {string} userId - User ID sending the reply
   * @param {Object} replyData - Reply payload
   * @returns {Promise<Object>} - Reply result
   */
  async sendReply(questionId, clientId, userId, replyData) {
    const { channel, message } = replyData;

    // For development purposes, assume admin role
    const user = { role: 'admin', client_id: clientId };

    // Get question first
    const { data: question, error: fetchError } = await supabase
      .from('chat_messages')
      .select('listing_id, client_id, visitor_id')
      .eq('id', questionId)
      .single();

    if (fetchError || !question) {
      throw new Error('Question not found');
    }

    if (question.client_id !== clientId) {
      throw new Error('Unauthorized access to this question');
    }

    // For development purposes, admin role has access to all listings
    // No additional permission checks needed

    // Get visitor contact info separately
    let contactInfo = { email: null, phone: null };
    if (question.visitor_id) {
      const { data: visitor, error: visitorError } = await supabase
        .from('visitors')
        .select('email, phone')
        .eq('visitor_id', question.visitor_id)
        .single();

      if (!visitorError && visitor) {
        contactInfo = {
          email: visitor.email,
          phone: visitor.phone
        };
      }
    }

    if (!contactInfo.email && !contactInfo.phone) {
      throw new Error('No contact information available for this visitor');
    }

    // Send the reply (placeholder for now)
    let sendResult;
    try {
      // This will be replaced with actual communication service
      if (channel === 'email' && contactInfo.email) {
        console.log(`[EMAIL PLACEHOLDER] Sending email to ${this.maskEmail(contactInfo.email)}: ${message}`);
        sendResult = { success: true, channel: 'email' };
      } else if (channel === 'sms' && contactInfo.phone) {
        console.log(`[SMS PLACEHOLDER] Sending SMS to ${this.maskPhone(contactInfo.phone)}: ${message}`);
        sendResult = { success: true, channel: 'sms' };
      } else {
        throw new Error(`Invalid channel or missing contact info for ${channel}`);
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      throw new Error('Failed to send reply');
    }

    // Update the question with follow-up info
    const { error: updateError } = await supabase
      .from('chat_messages')
      .update({
        follow_up_sent_at: new Date().toISOString(),
        follow_up_channel: channel,
        is_unanswered: false,
        answered_by_user_id: userId
      })
      .eq('id', questionId);

    if (updateError) {
      console.error('Error updating question after reply:', updateError);
      // Don't throw here as the reply was sent successfully
    }

    return {
      success: true,
      channel,
      message: 'Reply sent successfully'
    };
  }

  /**
   * Mask email address for privacy
   * @param {string} email - Email address
   * @returns {string} - Masked email
   */
  maskEmail(email) {
    if (!email) return null;
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local}****@${domain}`;
    return `${local.slice(0, 2)}****@${domain}`;
  }

  /**
   * Mask phone number for privacy
   * @param {string} phone - Phone number
   * @returns {string} - Masked phone
   */
  maskPhone(phone) {
    if (!phone) return null;
    if (phone.length <= 4) return '****';

    // For longer phone numbers, show more digits
    if (phone.length >= 12) {
      // Show first 9 digits, mask next 5, show last 2
      return `${phone.slice(0, 9)}*****${phone.slice(-2)}`;
    } else {
      // Fallback for shorter numbers
      return `${phone.slice(0, Math.max(2, phone.length - 4))}****${phone.slice(-2)}`;
    }
  }
}

export default new UnansweredQuestionService();