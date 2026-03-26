// --- WEB3 SETUP ---
let web3;
let factoryContract;

// IMPORTANT: Ensure these match your actual Remix deployment!
const factoryAddress = "0xa9b93fB45d2B8cB554D92852a1317a64625413Ab"; 
const factoryABI = [
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "escrowAddress",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "buyer",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "seller",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "EscrowCreated",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address payable",
				"name": "_seller",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_arbiter",
				"type": "address"
			}
		],
		"name": "createEscrow",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "deployedEscrows",
		"outputs": [
			{
				"internalType": "contract Escrow",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getDeployedEscrows",
		"outputs": [
			{
				"internalType": "contract Escrow[]",
				"name": "",
				"type": "address[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

const escrowABI = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_buyer",
				"type": "address"
			},
			{
				"internalType": "address payable",
				"name": "_seller",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_arbiter",
				"type": "address"
			}
		],
		"stateMutability": "payable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "seller",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "DeliveryConfirmed",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "bool",
				"name": "refundedToBuyer",
				"type": "bool"
			}
		],
		"name": "DisputeResolved",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "amount",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "arbiter",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "buyer",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "confirmDelivery",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "currentState",
		"outputs": [
			{
				"internalType": "enum Escrow.State",
				"name": "",
				"type": "uint8"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bool",
				"name": "refundToBuyer",
				"type": "bool"
			}
		],
		"name": "resolveDispute",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "seller",
		"outputs": [
			{
				"internalType": "address payable",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]

async function initWeb3() {
    if (window.ethereum) {
        web3 = new Web3(window.ethereum);
        try {
            // Request account access (This triggers the MetaMask popup to connect to the site)
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            factoryContract = new web3.eth.Contract(factoryABI, factoryAddress);
            console.log("✅ Web3 Initialized & Connected to Sepolia");
            return true;
        } catch (error) {
            console.error("User denied account access", error);
            throw new Error("MetaMask connection was denied. Please allow EscrowPay to connect to your wallet.");
        }
    } else {
        throw new Error("MetaMask is not installed or not detected in this browser.");
    }
}

// Check every 500ms if ethereum is ready on page load (silent connection attempt)
const checkMetaMask = setInterval(() => {
    if (window.ethereum) {
        clearInterval(checkMetaMask);
        initWeb3().catch(e => console.log("Initial silent connect failed, waiting for user click."));
    }
}, 500);
setTimeout(() => clearInterval(checkMetaMask), 3000); // Stop checking after 3s

// --- DEPLOY REAL ESCROW ---
async function deployRealEscrow(sellerAddress, arbiterAddress, amountInUSD) {
    
    if (typeof web3 === 'undefined' || !web3) {
        console.log("⚠️ Web3 not ready. Forcing initialization...");
        await initWeb3();
    }

    // 1. Ask MetaMask for the accounts
    const rawAccounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    // 2. THE BULLETPROOF EXTRACTION (Step-by-Step)
    let accountsString = String(rawAccounts);        // Turn whatever we got into a string
    let accountsArray = accountsString.split(',');   // Split it at the commas
    let firstAccountRaw = accountsArray;          // Grab only the first item
    
    // Convert to string again (just in case), trim spaces, and cut to exactly 42 characters
    let buyerAccount = String(firstAccountRaw).trim().substring(0, 42); 

    if (!buyerAccount || buyerAccount.length !== 42) {
        throw new Error("Invalid MetaMask account detected. Please check your wallet.");
    }

    // 3. Safely calculate the Wei amount to avoid decimal errors
    const rawEthAmount = amountInUSD * 0.0001;
    const cleanEthString = parseFloat(rawEthAmount.toFixed(10)).toString();
    const amountInWei = web3.utils.toWei(cleanEthString, 'ether');

    try {
        console.log(`🚀 Triggering MetaMask from Buyer EXACT ADDRESS: ${buyerAccount}`);
        
        const receipt = await factoryContract.methods.createEscrow(sellerAddress, arbiterAddress)
            .send({ from: buyerAccount, value: amountInWei });

        const newEscrowAddress = receipt.events.EscrowCreated.returnValues.escrowAddress;
        console.log("✨ Real Escrow Deployed at:", newEscrowAddress);
        
        return newEscrowAddress;
    } catch (error) {
        console.error("Web3 Deployment Failed:", error);
        throw error;
    }
}

// --- RELEASE REAL ESCROW ---
async function releaseRealEscrow(contractAddress) {
    if (typeof web3 === 'undefined' || !web3) await initWeb3();

    // 1. Get Accounts safely
    const rawAccounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    // 2. Safely extract the exact address step-by-step
    let accountsString = String(rawAccounts);
    let accountsArray = accountsString.split(',');
    let firstAccountRaw = accountsArray;
    let buyerAccount = String(firstAccountRaw).trim().substring(0, 42);

    try {
        console.log(`🚀 Triggering MetaMask to Release Funds from EXACT ADDRESS: ${buyerAccount}`);
        const escrowInstance = new web3.eth.Contract(escrowABI, contractAddress);
        
        // This talks to the blockchain to move the money to the seller!
        await escrowInstance.methods.confirmDelivery().send({ from: buyerAccount });
        return true;
    } catch (error) {
        console.error("Web3 Release Failed:", error);
        throw error;
    }
}