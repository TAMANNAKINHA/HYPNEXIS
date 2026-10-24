// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library SpendingLimits {
    error ExceedsPerTxLimit();
    error InsufficientBudget();
    error ExceedsDailyLimit();

    struct SpendingTracker {
        uint256 totalSpent;
        uint256 dailySpent;
        uint256 lastDailyReset;
    }

    struct Limits {
        uint256 maxPerTx;
        uint256 maxDaily;
        uint256 totalBudget;
    }

    function getDailyResetTimestamp() internal view returns (uint256) {
        return (block.timestamp / 86400) * 86400;
    }

    function getEffectiveDailySpent(
        SpendingTracker storage tracker
    ) internal view returns (uint256) {
        uint256 currentDayStart = getDailyResetTimestamp();
        return tracker.lastDailyReset < currentDayStart
            ? 0
            : tracker.dailySpent;
    }

    function resetDailyIfNeeded(
        SpendingTracker storage tracker
    ) internal {
        uint256 currentDayStart = getDailyResetTimestamp();
        if (tracker.lastDailyReset < currentDayStart) {
            tracker.dailySpent = 0;
            tracker.lastDailyReset = currentDayStart;
        }
    }

    function checkLimits(
        SpendingTracker storage tracker,
        Limits memory limits,
        uint256 amount
    ) internal view {
        // Check per-transaction limit
        if (amount > limits.maxPerTx) {
            revert ExceedsPerTxLimit();
        }

        // Check total budget
        if (tracker.totalSpent + amount > limits.totalBudget) {
            revert InsufficientBudget();
        }

        // Check daily limit (with reset)
        uint256 effectiveDailySpent = getEffectiveDailySpent(tracker);
        if (effectiveDailySpent + amount > limits.maxDaily) {
            revert ExceedsDailyLimit();
        }
    }

    function recordSpending(
        SpendingTracker storage tracker,
        uint256 amount
    ) internal {
        resetDailyIfNeeded(tracker);
        tracker.totalSpent += amount;
        tracker.dailySpent += amount;
    }
}