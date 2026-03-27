document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
});

document.addEventListener('DOMContentLoaded', async () => {
    const userId = localStorage.getItem('escrow_user_id');
    
    // Security Check: Only User 1 (Admin) allowed
    if (userId !== "1") {
        alert("Access Denied: Arbiter credentials required.");
        window.location.href = 'index.html';
        return;
    }

    const container = document.getElementById('admin-dispute-container');

    async function loadDisputes() {
        try {
            // This calls your @app.route('/api/admin/disputes')
            const disputes = await api.getDisputes(); 
            container.innerHTML = '';

            if (disputes.length === 0) {
                container.innerHTML = '<p style="color: var(--text-muted);">No active disputes. Everything is peaceful!</p>';
                return;
            }

            disputes.forEach(tx => {
                const card = document.createElement('div');
                card.className = 'escrow-card';
                card.style.border = "1px solid #ef4444"; // Highlight Red
                card.innerHTML = `
                    <div class="card-header">
                        <div class="card-title">Dispute #${tx.id}</div>
                        <div class="badge badge-disputed">DISPUTED</div>
                    </div>
                    <div class="card-body">
                        <p>Total Value: <span>$${tx.amount}</span></p>
                        <p>Buyer ID: <span>#${tx.buyer_id}</span></p>
                        <p>Seller ID: <span>#${tx.seller_id}</span></p>
                        <p style="font-size: 0.75rem;">Contract: <span style="color: var(--primary);">${tx.contract}</span></p>
                    </div>
                    <div class="card-actions">
                        <button class="btn-danger" onclick="adminResolve(${tx.id}, '${tx.contract}', true)">Refund Buyer</button>
                        <button class="btn-success" onclick="adminResolve(${tx.id}, '${tx.contract}', false)">Pay Seller</button>
                    </div>
                `;
                container.appendChild(card);
            });
        } catch (e) {
            container.innerHTML = `<p style="color: #ef4444;">Error: ${e.message}</p>`;
        }
    }

    // THE ON-CHAIN RESOLUTION
    window.adminResolve = async function(dbId, contractAddress, refundBuyer) {
        const action = refundBuyer ? "REFUND BUYER" : "PAY SELLER";
        if (!confirm(`Confirm Arbiter Decision: ${action}?`)) return;

        try {
            // Force Web3 init if needed
            if (typeof web3 === 'undefined' || !web3) await initWeb3();

            // 1. Get Accounts safely
            const rawAccounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            
            // 2. Safely extract the exact address step-by-step
            let accountsString = String(rawAccounts);
            let accountsArray = accountsString.split(',');
            let firstAccountRaw = accountsArray;
            let adminAccount = String(firstAccountRaw).trim().substring(0, 42);

            const escrowInstance = new web3.eth.Contract(escrowABI, contractAddress);

            console.log(`⚖️ Sending Arbiter Decision from EXACT ADDRESS: ${adminAccount}`);
            
            // Trigger MetaMask to execute the Arbiter's ruling
            await escrowInstance.methods.resolveDispute(refundBuyer)
                .send({ from: adminAccount });

            // Update Database
            const finalStatus = refundBuyer ? 'refunded' : 'released';
            await api.updateStatus(dbId, finalStatus);
            
            alert("Dispute officially resolved on-chain.");
            loadDisputes();

        } catch (error) {
            alert(`Blockchain Resolution Failed: ${error.message}`);
        }
    };

    loadDisputes();
    setInterval(loadDisputes, 5000);
});