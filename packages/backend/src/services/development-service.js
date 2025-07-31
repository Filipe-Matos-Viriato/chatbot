import supabase from '../config/supabase.js';

async function createDevelopment(developmentData) {
  const { data, error } = await supabase
    .from('developments')
    .insert([developmentData])
    .select();

  if (error) {
    throw new Error(`Error creating development: ${error.message}`);
  }
  return data[0];
}

async function getDevelopmentById(id) {
  const { data, error } = await supabase
    .from('developments')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
    throw new Error(`Error fetching development: ${error.message}`);
  }
  return data;
}

async function getDevelopmentsByClientId(client_id) {
  const { data, error } = await supabase
    .from('developments')
    .select('*')
    .eq('client_id', client_id);

  if (error) {
    throw new Error(`Error fetching developments by client_id: ${error.message}`);
  }
  return data;
}

async function updateDevelopment(id, updates) {
  const { data, error } = await supabase
    .from('developments')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) {
    throw new Error(`Error updating development: ${error.message}`);
  }
  return data[0];
}

async function deleteDevelopment(id) {
  const { error } = await supabase
    .from('developments')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Error deleting development: ${error.message}`);
  }
  return { message: 'Development deleted successfully' };
}

export {
  createDevelopment,
  getDevelopmentById,
  getDevelopmentsByClientId,
  updateDevelopment,
  deleteDevelopment,
};