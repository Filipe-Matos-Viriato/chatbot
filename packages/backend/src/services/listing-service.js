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
    .select('id, name, type, price, client_id, development_id')
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

export default ListingService;