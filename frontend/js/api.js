// --- BASE URL ---
// Points to your Flask server
const BASE_URL = 'http://127.0.0.1:5000/api';

const api = {
    // 1. Sign Up Function
    registerUser: async (userData) => {
        try {
            const response = await fetch(`${BASE_URL}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Registration failed');
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // 2. Login Function
    loginUser: async (credentials) => {
        try {
            const response = await fetch(`${BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Login failed');
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // 3. Fetch User's Active Escrows
    getUserEscrows: async (userId) => {
        try {
            const response = await fetch(`${BASE_URL}/users/${userId}/escrows?filter=active`);
            if (!response.ok) throw new Error('Failed to fetch escrows');
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // 4. Create a New Escrow
    createEscrow: async (escrowDetails) => {
        try {
            const response = await fetch(`${BASE_URL}/escrows`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(escrowDetails)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // 5. Update Escrow Status (State Machine Move)
    updateStatus: async (escrowId, newStatus, contractAddress = null) => {
        try {
            // Build the payload dynamically
            const payload = { status: newStatus };
            if (contractAddress) {
                payload.contract_address = contractAddress; // Attach the real Web3 address!
            }

            const response = await fetch(`${BASE_URL}/escrows/${escrowId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update status');
            }
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    getDisputes: async () => {
        const response = await fetch(`${BASE_URL}/admin/disputes`);
        return await response.json();
    },

    getProducts: async () => {
        try {
            const response = await fetch(`${BASE_URL}/products`);
            if (!response.ok) throw new Error('Failed to fetch product catalog');
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    addProduct: async (productData) => {
        const response = await fetch(`${BASE_URL}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });
        return await response.json();
    }
};