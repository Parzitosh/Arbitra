// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Trustless P2P Escrow Service
/// @author Paritosh_1089
contract Escrow {
    // --- STATE VARIABLES ---
    address public buyer;
    address payable public seller;
    address public arbiter; 
    uint public amount;

    // Notice we removed AWAITING_PAYMENT because the contract is funded upon creation!
    enum State { AWAITING_DELIVERY, COMPLETE, REFUNDED }
    State public currentState;
    
    // --- EVENTS ---
    event DeliveryConfirmed(address indexed seller, uint amount);
    event DisputeResolved(bool refundedToBuyer);

    // --- MODIFIERS ---
    modifier onlyBuyer() {
        require(msg.sender == buyer, "Security Error: Only the designated buyer can execute this.");
        _; 
    }

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Security Error: Only the arbiter can execute this.");
        _;
    }

    modifier inState(State expectedState) {
        require(currentState == expectedState, "State Error: Action not allowed in current state.");
        _;
    }

    // --- CONSTRUCTOR (Now Payable) ---
    constructor(address _buyer, address payable _seller, address _arbiter) payable {
        require(_buyer != address(0), "Validation Error: Buyer cannot be the zero address");
        require(_seller != address(0), "Validation Error: Seller cannot be the zero address");
        require(_arbiter != address(0), "Validation Error: Arbiter cannot be the zero address");

        buyer = _buyer;
        seller = _seller;
        arbiter = _arbiter;
        amount = msg.value; // Automatically lock the funds sent during deployment
        currentState = State.AWAITING_DELIVERY;
    }

    // --- CORE FUNCTIONS ---
    function confirmDelivery() external onlyBuyer inState(State.AWAITING_DELIVERY) {
        currentState = State.COMPLETE;
        
        (bool success, ) = seller.call{value: amount}("");
        require(success, "Transaction Error: Transfer to seller failed");
        
        emit DeliveryConfirmed(seller, amount);
    }

    function resolveDispute(bool refundToBuyer) external onlyArbiter inState(State.AWAITING_DELIVERY) {
        if (refundToBuyer) {
            currentState = State.REFUNDED;
            (bool success, ) = buyer.call{value: amount}("");
            require(success, "Transaction Error: Refund to buyer failed");
        } else {
            currentState = State.COMPLETE;
            (bool success, ) = seller.call{value: amount}("");
            require(success, "Transaction Error: Transfer to seller failed");
        }
        
        emit DisputeResolved(refundToBuyer);
    }
}

/// @title Escrow Factory
contract EscrowFactory {
    Escrow[] public deployedEscrows;
    
    event EscrowCreated(address indexed escrowAddress, address indexed buyer, address indexed seller, uint amount);

    /// @notice Creates AND funds a new Escrow contract in a single transaction
    function createEscrow(address payable _seller, address _arbiter) external payable {
        require(msg.value > 0, "Validation Error: Must send ETH to fund the escrow");

        // The magic happens here: {value: msg.value} passes the ETH directly to the new contract
        Escrow newEscrow = (new Escrow){value: msg.value}(msg.sender, _seller, _arbiter);
        
        deployedEscrows.push(newEscrow);
        emit EscrowCreated(address(newEscrow), msg.sender, _seller, msg.value);
    }

    function getDeployedEscrows() external view returns (Escrow[] memory) {
        return deployedEscrows;
    }
}