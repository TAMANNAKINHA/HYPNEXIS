// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMissionWallet {
    function executePayment(address recipient, uint256 amount) external;
}

contract MaliciousContract {
    IMissionWallet public immutable wallet;
    bool public attacked;

    constructor(address _wallet) {
        wallet = IMissionWallet(_wallet);
    }

    function attack() external payable {
        attacked = true;
        // Try to reenter by calling executePayment again
        // This would fail due to nonReentrant modifier
        wallet.executePayment(address(this), 1 ether);
    }

    receive() external payable {
        if (!attacked && address(wallet).balance >= 1 ether) {
            attacked = true;
            wallet.executePayment(address(this), 1 ether);
        }
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}