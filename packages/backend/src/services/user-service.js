import supabase from '../config/supabase.js';

class UserService {
    async createUser(userData) {
        const { data, error } = await supabase
            .from('users')
            .insert([userData])
            .select();

        if (error) {
            console.error('Error creating user:', error);
            throw new Error('Failed to create user.');
        }
        return data[0];
    }

    async getUserById(userId) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching user by ID:', error);
            throw new Error('Failed to fetch user.');
        }
        return data;
    }

    async getUserByEmail(email) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error) {
            console.error('Error fetching user by email:', error);
            throw new Error('Failed to fetch user by email.');
        }
        return data;
    }

    async updateUser(userId, updates) {
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select();

        if (error) {
            console.error('Error updating user:', error);
            throw new Error('Failed to update user.');
        }
        return data[0];
    }

    async deleteUser(userId) {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);

        if (error) {
            console.error('Error deleting user:', error);
            throw new Error('Failed to delete user.');
        }
        return { success: true };
    }

    async getAllUsersByClientId(clientId) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('client_id', clientId);

        if (error) {
            console.error('Error fetching users by client ID:', error);
            throw new Error('Failed to fetch users by client ID.');
        }
        return data;
    }

    async getAgentsByClientId(clientId) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('client_id', clientId)
            .eq('role', 'promoter');

        if (error) {
            console.error('Error fetching agents by client ID:', error);
            throw new Error('Failed to fetch agents by client ID.');
        }
        return data;
    }

    async assignListingToAgent(userId, listingId) {
        const { data, error } = await supabase
            .from('agent_listings')
            .insert([{ user_id: userId, listing_id: listingId }])
            .select();

        if (error) {
            console.error('Error assigning listing to agent:', error);
            throw new Error('Failed to assign listing to agent.');
        }
        return data[0];
    }

    async removeListingFromAgent(userId, listingId) {
        const { error } = await supabase
            .from('agent_listings')
            .delete()
            .eq('user_id', userId)
            .eq('listing_id', listingId);

        if (error) {
            console.error('Error removing listing from agent:', error);
            throw new Error('Failed to remove listing from agent.');
        }
        return { success: true };
    }

    async getListingsByAgentId(userId) {
        const { data, error } = await supabase
            .from('agent_listings')
            .select('listing_id')
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching listings by agent ID:', error);
            throw new Error('Failed to fetch listings by agent ID.');
        }
        return data.map(row => row.listing_id);
    }
}

export default new UserService();