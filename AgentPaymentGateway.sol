// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Integration adapter used by the local/dev stack (Person 4).
///
/// The backend payment adapter (src/services/paymentService.ts) calls
///     execute(address recipient, uint256 amount)
/// and only confirms a payment when it sees
///     PaymentExecuted(address indexed recipient, uint256 amount)
/// MissionWallet.sol exposes executePayment(address,uint256) and a different,
/// 5-argument PaymentExecuted event, so the two cannot talk directly (INT-001
/// in KNOWN_BUGS.md). This gateway bridges the two WITHOUT weakening anything:
/// it is the MissionWallet owner, forwards every call to the wallet, and the
/// wallet still enforces per-tx / daily / total budget, allowlist and expiry.
/// If the wallet reverts, this call reverts too (no event, no funds moved).
///
/// Not an audited production contract. Remove once Person 1 aligns the
/// wallet ABI/event with the backend adapter (or the adapter with the wallet).
interface IMissionWalletAdmin {
    function executePayment(address recipient, uint256 amount) external;
    function updateRecipientAllowlist(address[] calldata recipients) external;
    function updateSpendingLimits(uint256 maxPerTx, uint256 maxDaily) external;
    function activateKillSwitch(address agent) external;
    function deactivateKillSwitch(address agent) external;
}

contract AgentPaymentGateway {
    IMissionWalletAdmin public immutable wallet;
    address public operator;

    event PaymentExecuted(address indexed recipient, uint256 amount);
    event OperatorChanged(address indexed previousOperator, address indexed newOperator);

    error NotOperator();
    error ZeroAddress();

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor(address missionWallet) {
        if (missionWallet == address(0)) revert ZeroAddress();
        wallet = IMissionWalletAdmin(missionWallet);
        operator = msg.sender;
    }

    function execute(address recipient, uint256 amount) external onlyOperator {
        wallet.executePayment(recipient, amount);
        emit PaymentExecuted(recipient, amount);
    }

    function setRecipientAllowlist(address[] calldata recipients) external onlyOperator {
        wallet.updateRecipientAllowlist(recipients);
    }

    function setSpendingLimits(uint256 maxPerTx, uint256 maxDaily) external onlyOperator {
        wallet.updateSpendingLimits(maxPerTx, maxDaily);
    }

    function activateKillSwitch(address agent) external onlyOperator {
        wallet.activateKillSwitch(agent);
    }

    function deactivateKillSwitch(address agent) external onlyOperator {
        wallet.deactivateKillSwitch(agent);
    }

    function transferOperator(address newOperator) external onlyOperator {
        if (newOperator == address(0)) revert ZeroAddress();
        emit OperatorChanged(operator, newOperator);
        operator = newOperator;
    }
}
