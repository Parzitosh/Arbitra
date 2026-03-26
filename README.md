# Arbitra ⚖️
**A Decentralized Peer-to-Peer Marketplace with On-Chain Escrow & Dispute Resolution.**

Arbitra bridges the gap between traditional Web 2.0 user experiences and Web3 trustless security. By locking funds in an immutable Ethereum smart contract, Arbitra ensures that buyers are protected from fraud, sellers are guaranteed payment upon delivery, and a neutral Arbiter can resolve disputes transparently on-chain.

---

## ✨ Key Features
* **Zero-Trust Transactions:** Funds are locked in a dynamically generated Ethereum Smart Contract (via a Factory pattern) until both parties are satisfied.
* **Role-Based Dashboards:** Distinct user experiences for Buyers, Sellers, and the Admin/Arbiter.
* **Web3 Integration:** Seamless MetaMask connectivity using `Web3.js` to sign and execute transactions on the Sepolia Testnet.
* **State Synchronization:** A Python/Flask backend that listens to frontend Web3 state changes to keep the SQL database perfectly synced with the blockchain.
* **On-Chain Dispute Resolution:** An Admin panel that allows an Arbiter to cryptographically enforce a refund to the Buyer or a payout to the Seller.

---

## 🛠️ Tech Stack
**Frontend (Web 2.5):**
* HTML5 / CSS3 (Custom styling)
* Vanilla JavaScript (ES6+)
* `Web3.js` (Blockchain interaction)
* MetaMask (Wallet Provider)

**Backend & Database:**
* Python 3.x
* Flask & Flask-CORS (REST API)
* SQLAlchemy (ORM)
* MySQL (Relational Database)

**Blockchain:**
* Solidity (Smart Contracts)
* Ethereum Sepolia Testnet

---

## ⚙️ Architecture Flow
1. **List:** A Seller posts a service to the global marketplace.
2. **Buy:** A Buyer initiates a purchase.
3. **Fund (Web3):** The Buyer triggers MetaMask to deploy a unique Escrow Smart Contract, locking their SepoliaETH inside it.
4. **Release (Web3):** Upon successful delivery, the Buyer signs a transaction to release the locked funds directly to the Seller's wallet.
5. **Dispute (Web3):** If something goes wrong, the Arbiter steps in and executes a smart contract function to definitively route the funds to the rightful party.

---

## 🚀 Local Setup & Installation

To run Arbitra locally, you will need to start both the Python backend API and a local frontend HTTP server.

### Prerequisites
* Python 3.8+
* MySQL Server running locally
* MetaMask browser extension (connected to Sepolia Testnet with test ETH)

### 1. Database Setup
1. Open your MySQL terminal or Workbench.
2. Create the database: `CREATE DATABASE escrow_db;`
3. Update the `app.py` file with your local MySQL credentials.

### 2. Backend Setup
Open a terminal, navigate to the project root, and run:
```bash
# Create and activate a virtual environment (Recommended)
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the Flask API
python app.py
```
*(The backend will run on `http://127.0.0.1:5000`)*

### 3. Frontend Setup
**CRITICAL:** Do not open `index.html` directly from your file explorer. MetaMask requires an `http://` protocol to inject the Web3 connection.

Open a **second terminal**, navigate to your `frontend/` folder, and run:
```bash
# Start a simple Python HTTP server
python -m http.server 8000
```

### 4. Test the App
1. Open your browser and navigate to **`http://localhost:8000`**
2. Create two different user accounts (Ensure you use two **different** MetaMask wallet addresses for testing the escrow flow!).
3. Start trading!

---

## 📄 Smart Contracts
The Solidity contracts powering Arbitra are designed using a Factory pattern to keep deployment gas costs low for the end user.
* **EscrowFactory:** Deploys child contracts and logs their addresses.
* **Escrow:** Holds the logic for `confirmDelivery()` and `resolveDispute(bool refundBuyer)`. 

*(Contracts are currently deployed and verified on the Ethereum Sepolia Testnet).*
```
