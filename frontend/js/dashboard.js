document.addEventListener('DOMContentLoaded', async () => {
    const userId = localStorage.getItem('escrow_user_id');
    const username = localStorage.getItem('escrow_username');

    if (!userId) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('welcome-text').innerText = `Welcome, ${username}`;
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
    });

    // --- 1. DYNAMIC MARKETPLACE CATALOG ---
    const marketplaceContainer = document.getElementById('marketplace-container');

    async function loadMarketplace() {
        try {
            // Fetch real products from your Python backend
            const products = await api.getProducts();
            marketplaceContainer.innerHTML = ''; 

            if (products.length === 0) {
                marketplaceContainer.innerHTML = '<p style="color: var(--text-muted);">Marketplace is currently empty. Check back later!</p>';
                return;
            }

            products.forEach(product => {
                const card = document.createElement('div');
                card.className = 'product-card';
                card.innerHTML = `
                    <div>
                        <div class="product-icon">${product.icon || '📦'}</div>
                        <div class="card-title">${product.title}</div>
                        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 5px;">${product.desc}</p>
                        <div class="product-price">$${product.price.toFixed(2)}</div>
                        <p style="font-size: 0.8rem; color: #64748b;">Sold by Freelancer #${product.sellerId}</p>
                    </div>
                    <button class="btn-buy" onclick="buyProduct(${product.id}, ${product.price}, ${product.sellerId}, '${product.title.replace(/'/g, "\\'")}')">
                        ⚡ Buy Now in Escrow
                    </button>
                `;
                marketplaceContainer.appendChild(card);
            });
        } catch (error) {
            marketplaceContainer.innerHTML = `<p style="color: #ef4444;">Error loading marketplace: ${error.message}</p>`;
        }
    }

    // Updated Buy Function to work with dynamic data
    window.buyProduct = async function(productId, price, sellerId, title) {
        if (sellerId == userId) {
            alert("Security Notice: You cannot buy your own product.");
            return;
        }

        const confirmPurchase = confirm(`Create a secure escrow for "${title}" ($${price})?`);
        if (!confirmPurchase) return;

        try {
            await api.createEscrow({
                buyer_id: userId,
                seller_id: sellerId,
                amount: price
            });
            alert("Escrow initialized! Please fund the transaction in your 'Active Escrows' section.");
            loadEscrows(); 
        } catch (error) {
            alert(`Purchase Failed: ${error.message}`);
        }
    };

    // Call this along with loadEscrows() at the bottom
    loadMarketplace();


    // --- 2. ACTIVE ESCROWS RENDERER ---
    const escrowContainer = document.getElementById('escrow-container');

    async function loadEscrows() {
        try {
            const escrows = await api.getUserEscrows(userId);
            escrowContainer.innerHTML = ''; 

            if (escrows.length === 0) {
                escrowContainer.innerHTML = '<p style="color: var(--text-muted);">You have no active transactions.</p>';
                return;
            }

            escrows.forEach(escrow => {
                const isBuyer = escrow.buyer_id == userId;
                const roleText = isBuyer ? 'Buyer' : 'Seller';
                const counterpartyId = isBuyer ? escrow.seller_id : escrow.buyer_id;
                let actionButtons = '';

                // SMART BUTTON LOGIC
                if (escrow.status === 'pending') {
                    if (isBuyer) {
                        // NEW: We pass the exact seller wallet, arbiter wallet, and amount into the function!
                        actionButtons = `<button class="btn-success" onclick="updateEscrow(${escrow.id}, 'funded', '${escrow.seller_wallet}', '${escrow.arbiter_wallet}', ${escrow.amount})">💰 Fund Escrow</button>`;
                    } else {
                        actionButtons = `<button class="btn-outline" disabled>Waiting for Buyer</button>`;
                    }
                } 
                else if (escrow.status === 'funded') {
                    if (isBuyer) {
                        actionButtons = `
                            <button class="btn-success" onclick="updateEscrow(${escrow.id}, 'released', null, null, null, '${escrow.contract}')">✅ Release Funds</button>
                            <button class="btn-danger" onclick="updateEscrow(${escrow.id}, 'disputed')">⚠️ Dispute</button>
                        `;
                    } else {
                        actionButtons = `<button class="btn-outline" disabled>Waiting for Buyer</button>`;
                    }
                }
                else if (escrow.status === 'disputed') {
                    actionButtons = `<button class="btn-outline" disabled>Arbiter Reviewing...</button>`;
                }

                const card = document.createElement('div');
                card.className = 'escrow-card';
                card.innerHTML = `
                    <div class="card-header">
                        <div class="card-title">Tx #${escrow.id}</div>
                        <div class="badge badge-${escrow.status}">${escrow.status}</div>
                    </div>
                    <div class="card-body">
                        <p>Amount: <span style="font-size: 1.2rem; color: #22c55e;">$${escrow.amount}</span></p>
                        <p>My Role: <span>${roleText}</span></p>
                        <p>Partner ID: <span>#${counterpartyId}</span></p>
                        ${escrow.contract ? `<p style="font-size:0.8rem; margin-top:10px;">Contract: <span style="color: var(--primary);">${escrow.contract.substring(0,10)}...</span></p>` : ''}
                    </div>
                    <div class="card-actions">${actionButtons}</div>
                `;
                escrowContainer.appendChild(card);
            });

        } catch (error) {
            escrowContainer.innerHTML = `<p style="color: #ef4444;">Error loading escrows: ${error.message}</p>`;
        }
    }

    // Notice the new contractAddress parameter at the end
    window.updateEscrow = async function(escrowId, newStatus, sellerWallet, arbiterWallet, amount, contractAddress) {
        
        // --- 1. THE FUNDING LOGIC (Already working) ---
        if (newStatus === 'funded') {
            if (!sellerWallet || sellerWallet === 'null' || !arbiterWallet || arbiterWallet === 'null') {
                alert("Cannot proceed: The Seller or Arbiter is missing a Web3 wallet address.");
                return;
            }
            try {
                console.log(`Starting Web3 Tx: Sending $${amount} to Seller (${sellerWallet})`);
                const realAddress = await deployRealEscrow(sellerWallet, arbiterWallet, amount);
                await api.updateStatus(escrowId, 'funded', realAddress); 
                loadEscrows();
                alert("Blockchain transaction confirmed and contract deployed!");
            } catch (e) {
                console.error("Web3 Error:", e); 
                alert("Blockchain transaction failed. Check the F12 Console for details.");
            }

        // --- 2. THE NEW RELEASE LOGIC (Web3 Enabled!) ---
        } else if (newStatus === 'released') {
            if (!confirm(`Confirm releasing funds to the seller? This cannot be undone.`)) return;
            
            try {
                // 1. Tell MetaMask to talk to the specific Escrow contract
                await releaseRealEscrow(contractAddress);
                
                // 2. Only update the Python database AFTER the blockchain confirms the transfer
                await api.updateStatus(escrowId, 'released');
                loadEscrows();
                alert("Funds successfully released to the seller's wallet!");
            } catch (error) {
                alert(`Blockchain release failed: ${error.message}`);
            }

        // --- 3. DISPUTES AND OTHER UPDATES ---
        } else {
            if (!confirm(`Change transaction status to ${newStatus.toUpperCase()}?`)) return;
            try {
                await api.updateStatus(escrowId, newStatus);
                loadEscrows();
            } catch (error) {
                alert(`Failed: ${error.message}`);
            }
        }
    };

    // --- 3. CUSTOM ESCROW TOGGLE (For Edge Cases) ---
    document.getElementById('btn-custom-escrow').addEventListener('click', () => {
        document.getElementById('custom-escrow-form').classList.toggle('hidden');
    });

    document.getElementById('create-escrow-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const partnerId = document.getElementById('partner-id').value;
        const amount = document.getElementById('escrow-amount').value;

        try {
            await api.createEscrow({ buyer_id: userId, seller_id: partnerId, amount: amount });
            document.getElementById('create-escrow-form').reset();
            document.getElementById('custom-escrow-form').classList.add('hidden');
            loadEscrows(); 
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });

    // Initialize Dashboard
    loadEscrows();
});