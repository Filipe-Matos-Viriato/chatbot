// packages/backend/src/services/listing-service.js
// Service for managing listing records in Supabase with advanced query capabilities.
// To provide database operations for property listings, including price aggregations and recommendation logic.
// Relevant files: config/supabase.js, rag-service.js, index.js
import supabase from '../config/supabase.js';

const ListingService = {
  async createListing(listingData) {
    const { data, error } = await supabase
      .from('listings')
      .insert([listingData])
      .select();
    if (error) {
      throw new Error(`Error creating listing: ${error.message}`);
    }
    return data[0];
  },

  async getListingById(id) {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
      throw new Error(`Error fetching listing by ID: ${error.message}`);
    }
    return data;
  },

  async getListingsByClientId(clientId) {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('client_id', clientId);
    if (error) {
      throw new Error(`Error fetching listings by client ID: ${error.message}`);
    }
    return data;
  },

  async updateListing(id, updates) {
    const { data, error } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', id)
      .select();
    if (error) {
      throw new Error(`Error updating listing: ${error.message}`);
    }
    return data[0];
  },

  async deleteListing(id) {
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', id);
    if (error) {
      throw new Error(`Error deleting listing: ${error.message}`);
    }
    return { success: true };
  },

  async updateListingByUuid(uuid, updates) {
    const { data, error } = await supabase
      .from('listings')
      .update(updates)
      .eq('listing_uuid', uuid)
      .select();
    if (error) {
      throw new Error(`Error updating listing by UUID: ${error.message}`);
    }
    return data[0];
  },

  async deleteListingByUuid(uuid) {
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('listing_uuid', uuid);
    if (error) {
      throw new Error(`Error deleting listing by UUID: ${error.message}`);
    }
    return { success: true };
  },
};
 
ListingService.getListingByUuid = async (uuid) => {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('listing_uuid', uuid)
    .single();
  if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
    throw new Error(`Error fetching listing by UUID: ${error.message}`);
  }
  return data;
};
 
// Add these functions to the ListingService object
ListingService.getMinPrice = async (clientId) => {
  const { data, error } = await supabase
    .from('listings')
    .select('price')
    .eq('client_id', clientId)
    .order('price', { ascending: true })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error(`Error fetching minimum price for client ${clientId}:`, error);
    throw new Error(`Error fetching minimum price: ${error.message}`);
  }
  return data ? data.price : null;
};

ListingService.getMaxPrice = async (clientId) => {
  const { data, error } = await supabase
    .from('listings')
    .select('price')
    .eq('client_id', clientId)
    .order('price', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error(`Error fetching maximum price for client ${clientId}:`, error);
    throw new Error(`Error fetching maximum price: ${error.message}`);
  }
  return data ? data.price : null;
};

// Returns the full row for the lowest price listing
ListingService.getMinPriceListing = async (clientId) => {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('client_id', clientId)
    .order('price', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') {
    console.error(`Error fetching minimum price listing for client ${clientId}:`, error);
    throw new Error(`Error fetching minimum price listing: ${error.message}`);
  }
  return data || null;
};

// Returns the full row for the highest price listing
ListingService.getMaxPriceListing = async (clientId) => {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('client_id', clientId)
    .order('price', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') {
    console.error(`Error fetching maximum price listing for client ${clientId}:`, error);
    throw new Error(`Error fetching maximum price listing: ${error.message}`);
  }
  return data || null;
};

// Returns top-N cheapest listings filtered by typology and optional development
ListingService.getCheapestListingsByTypology = async (clientId, typology, developmentId = null, limit = 3) => {
  let query = supabase
    .from('listings')
    .select('id, listing_uuid, name, type, price, client_id, development_id')
    .eq('client_id', clientId)
    .order('price', { ascending: true })
    .limit(limit);

  if (typology) {
    // Try to filter by standardized type column; fallback to name contains
    query = query.ilike('type', `${typology}%`);
  }
  if (developmentId) {
    query = query.eq('development_id', developmentId);
  }

  const { data, error } = await query;
  if (error) {
    console.error(`Error fetching cheapest listings for typology ${typology}:`, error);
    throw new Error(`Error fetching cheapest listings: ${error.message}`);
  }
  return Array.isArray(data) ? data.filter(r => r && r.price != null) : [];
};

  // Find listings by a case-insensitive pattern on name
  ListingService.findByNameLike = async (clientId, ilikePattern, limit = 5) => {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('client_id', clientId)
      .ilike('name', ilikePattern)
      .limit(limit);
    if (error) {
      throw new Error(`Error searching listing by name: ${error.message}`);
    }
    return data || [];
  };

  // Resolve by typology (e.g., T2), fraction letter (e.g., D) and block number (e.g., 2)
  ListingService.findByTypologyLetterBlock = async (clientId, typology, letter, block) => {
    const patterns = [
      `%${typology}% ${letter}%Bloco ${block}%`,
      `%${typology}% ${letter} - Bloco ${block}%`,
      `%${typology}%${letter}%Bloco ${block}%`,
      `%Apartamento ${typology} ${letter}%Bloco ${block}%`,
    ];
    for (const p of patterns) {
      const rows = await ListingService.findByNameLike(clientId, p, 3);
      if (rows.length) return rows[0];
    }
    return null;
  };

  // Suggest listings based on onboarding answers (typology + budget bucket)
  ListingService.findListingsByOnboarding = async (clientId, onboarding, limit = 4) => {
    let query = supabase
      .from('listings')
      .select('id, name, type, price, development_id')
      .eq('client_id', clientId)
      .order('price', { ascending: true })
      .limit(limit);

    const typology = onboarding?.typology ? String(onboarding.typology).toUpperCase().trim() : null;
    if (typology) {
      query = query.ilike('type', `${typology}%`);
    }

    // Map budget bucket to price range (EUR)
    const bucket = String(onboarding?.budget_bucket || '').toLowerCase();
    const ranges = {
      '100_200k': [100000, 200000],
      '200_300k': [200000, 300000],
      '300_400k': [300000, 400000],
      '400_500k': [400000, 500000],
      '500k_plus': [500000, null],
    };
    if (bucket in ranges) {
      const [min, max] = ranges[bucket];
      if (min != null) query = query.gte('price', min);
      if (max != null) query = query.lte('price', max);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Error fetching listings for onboarding: ${error.message}`);
    }
    return Array.isArray(data) ? data : [];
  };

export default ListingService;