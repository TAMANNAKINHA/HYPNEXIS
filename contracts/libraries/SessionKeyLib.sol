// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library SessionKeyLib {
    error InvalidNonce();

    struct SessionKey {
        uint256 maxPerTx;
        uint256 maxDaily;
        uint256 expiry;
        address[] allowedRecipients;
        bool revoked;
        uint256 nonce;
    }

    function isValid(
        SessionKey storage key,
        address recipient,
        uint256 amount
    ) internal view returns (bool) {
        if (key.revoked) return false;
        if (block.timestamp >= key.expiry) return false;
        if (amount > key.maxPerTx) return false;
        
        if (key.allowedRecipients.length > 0) {
            bool allowed = false;
            for (uint256 i = 0; i < key.allowedRecipients.length; i++) {
                if (key.allowedRecipients[i] == recipient) {
                    allowed = true;
                    break;
                }
            }
            if (!allowed) return false;
        }
        return true;
    }

    function incrementNonce(SessionKey storage key) internal {
        key.nonce += 1;
    }

    function checkNonce(SessionKey storage key, uint256 expectedNonce) internal view {
        if (key.nonce != expectedNonce) {
            revert InvalidNonce();
        }
    }
}