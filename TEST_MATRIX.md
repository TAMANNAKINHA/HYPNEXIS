# Test matrix
Status: PASS / FAIL / BLOCKED / TODO. Update after every run.

| ID | Area | Scenario | Layer | Status | Notes |
|----|------|----------|-------|--------|-------|
| C-01 | Contract | Spend above per-tx limit reverts | contract | TODO | |
| C-02 | Contract | Spend above daily/budget limit reverts | contract | TODO | |
| C-03 | Contract | Non-allowlisted recipient reverts | contract | TODO | |
| C-04 | Contract | Spend after expiry reverts | contract | TODO | |
| C-05 | Contract | Spend after revoke/freeze reverts | contract | TODO | |
| C-06 | Contract | Replay of same signed op rejected | contract | BLOCKED | Needs ERC-4337 (Person 1) |
| C-07 | Contract | Wrong chain ID / nonce rejected | contract | BLOCKED | Needs ERC-4337 (Person 1) |
| B-01 | Budget | Two simultaneous payments cannot exceed budget | integration | TODO | |
| B-02 | Budget | Insufficient remaining budget rejected | integration | TODO | |
| B-03 | Budget | Failed tx does not reduce spent amount | integration | TODO | |
| K-01 | Kill switch | Disabled agent's new payment rejected | integration | TODO | |
| K-02 | Kill switch | In-flight tx status handled | integration | TODO | |
| S-01 | Simulator | Valid payment simulated, nothing broadcast | integration | TODO | |
| S-02 | Simulator | Insufficient budget / blocked recipient reported | integration | TODO | |
| D-01 | Duplicate | Retry of same request is idempotent | api | TODO | |
| D-02 | Duplicate | Concurrent duplicates -> one payment | api | TODO | |
| D-03 | Duplicate | Legitimate similar payment still allowed | api | TODO | |
| A-01 | Approvals | Expired approval rejected | api | TODO | |
| A-02 | Approvals | Reused approval rejected | api | TODO | |
| A-03 | Approvals | Approval for altered details rejected | api | TODO | |
| H-01 | History | State transitions + audit records correct | api | TODO | |
| H-02 | History | Freezing eligible payments | api | TODO | |
| F-01 | Frontend | Loading + error states shown | e2e | TODO | |
| F-02 | Frontend | Backend unavailable handled gracefully | e2e | TODO | |
| F-03 | Frontend | Statuses match backend/chain | e2e | TODO | |
| I-01 | Integration | Reported tx hash matches chain tx | integration | BLOCKED | Needs working local chain |
| I-02 | Integration | DB/store status matches on-chain outcome | integration | BLOCKED | Needs working local chain |
| I-03 | Integration | Freeze/revoke enforced at contract layer, not just UI | integration | BLOCKED | Needs working local chain |
