# Task List

## Implement URL-to-Listing_ID Validation
**Status:** On Hold
**Goal:** Add a validation step to the ingestion pipeline to ensure the `listing_id` provided by a client matches the `listing_id` found in the corresponding listing URL.
**Implementation Plan:**
1.  **Client Configuration:** Add a `listingUrlPattern` field to the client JSON configuration files. This field will hold a regex pattern capable of extracting the listing ID from a URL.
2.  **Frontend Validation (Real-time Feedback):**
    *   When the client enters both a `listing_id` and a `URL` in the dashboard, trigger a real-time validation check on the frontend.
    *   Use the regex from the config file to extract the ID from the URL.
    *   If there is a mismatch, display an immediate, non-blocking warning pop-up to the user, alerting them of the potential discrepancy and asking for confirmation before proceeding with the upload.
3.  **Backend Validation (Failsafe):**
    *   The asynchronous ingestion worker will perform the same validation check.
    *   If the IDs do not match, the job will be marked as "Failed," and a detailed error message will be logged for administrative review.


## Implement Lead Scoring & Visitor Tracking System
**Status:** Completed
**Goal:** Developed a system to track visitor interactions across domains and assign a lead score to prioritize high-intent individuals for the sales team.
**Completion Date:** 2025-07-16

### Lead Scoring Details:
The lead score is a hybrid score (maximum 100 points) composed of three main components: Engagement Behavior, Question Intent & Quality, and Conversion Actions.

#### Scoring Components:

-   **Engagement Behavior (max 30 points):**
    -   Number of questions asked (3–5): +5 points
    -   Number of questions asked (6–10): +10 points
    -   Number of questions asked (10+): +15 points
    -   Time spent chatting (5–10 min): +5 points
    -   Time spent chatting (10+ min): +10 points
    -   Clicked on a listing: +5 points
    -   Returned to chat within 48h: +10 points

-   **Question Intent & Quality (max 40 points):**
    -   Asking about price, financing, or ROI: +10 points
    -   Asking about location, neighborhood, or schools: +10 points
    -   Asking about legal process, taxes, or documentation: +10 points
    -   Asking about remote buying or investment options: +10 points
    -   Asking about property details, condition, amenities, or layout: +5 points
    -   Asking about availability or urgency: +5 points

-   **Conversion Actions (max 30 points):**
    -   Submitted contact info: +15 points
    -   Booked a property viewing: +30 points
    -   Asked to be contacted by an agent: +20 points
    -   Requested a brochure or floor plan: +10 points

#### Lead Qualification Thresholds:

-   **Hot Lead (70–100 pts):** Ready for agent follow-up or direct sales.
-   **Warm Lead (40–69 pts):** Nurture with follow-up content or offers.
-   **Cold Lead (<40 pts):** Keep in CRM for future re-engagement.