# FHESplit
Privately add group expenses and pay your dues without anyone watching. Privacy is non-negotiable. Privacy is lost whenever financial transactions reveal how much you owe, spend, or earn to third parties - even when those parties are just curious friends or group members.

> Scroll down for demo videos

## The Problem
Traditional expense-splitting apps (Splitwise, Venmo, etc.) expose your financial details:

- Everyone sees exact amounts: Group members know how much you paid, owe, or spent
- Payment history is visible: Your spending patterns and financial behavior are tracked
- Third parties collect data: Companies monetize your transaction data
- Worse track recording in a blockchain – where everything is transparent

## Our Solution: FHE-Powered Privacy
FHESplit uses Fully Homomorphic Encryption (FHE) via Zama's fhEVM to ensure complete amount privacy:

## What's Encrypted (Full Privacy)

✅ All balances - Your platform balance is encrypted (euint64)

✅ All debt amounts - Exactly how much you owe is hidden (euint64)

✅ All expense shares - Your portion of group expenses is private (euint64)

✅ Membership tokens - Encrypted group membership verification (euint64)

## What's Public (Standard Blockchain)

⚠️ Addresses - Required for Ethereum transactions (pseudonymous, not anonymous)

⚠️ Group membership - Who is in which group (required for access control)

⚠️ Debt relationships - Who owes whom (but not how much!)

## Key Features
### 🔐 Privacy-First Architecture


Confidential Token (cToken): ERC20 wrapper with FHE encryption

Encrypted Balances: All amounts stored as euint64 on-chain

Private Debt Tracking: Only involved parties can decrypt amounts

Access Control: Granular permissions via FHE ACL

### 👥 Flexible Group Management


Lazy Creation: Groups auto-created when adding first expense

Auto-Membership: Members added automatically when included in expenses

Traditional Management: Creators can still manually add/remove members

Cross-Group Support: Track debts across multiple friend groups
### 💸 Smart Expense Splitting


Encrypted Shares: Each member's portion is privately encrypted

Flexible Distribution: Supports unequal splits (e.g., 60/40)

Expense History: Track who paid and when

Multi-Group Support: Keep work, friends, and family expenses separate

### 🔄 Auto-Settling Transfers


Debt Reduction: Transfers automatically settle existing debts first

Privacy Preserved: Settlement happens in encrypted domain

Gas Efficient: Single transaction for transfer + settlement

Example: Transfer 150 to someone you owe 40 → Settles 40 debt, transfers 110 balance

### 📊 Comprehensive Queries


Single Group: View creditors/debtors within one group

Cross-Group: See all people you owe across all groups

Expense Details: Query past expenses and your shares

Balance Tracking: Monitor platform balance (encrypted)

Advanced Privacy Features

### 🎭 Plausible Deniability Through Group Membership

Group membership does NOT prove financial interaction.

Since anyone can add any address to their group, seeing two addresses in the same group reveals nothing about whether they've actually transacted.

### Benefits:


Membership ≠ Interaction: Being in a group doesn't mean you've transacted

Decoy Groups: Users can create groups with random addresses for privacy

No Confirmation Required: Members don't need to accept invitations (on-chain)

Observer Confusion: Chain watchers can't determine actual relationships

Example: If Bob's address appears in 50 different groups across the chain, an observer has no way to know which groups (if any) represent real financial relationships.

### 🔒 Transfer Privacy Guarantees

Even when transfers are visible on-chain, amounts remain completely private:

Privacy is not optional. It's fundamental.

GitHub: https://github.com/Wagalidoom/ethrome

## Demo Videos

### Core Flow (Terminal View)

https://www.youtube.com/watch?v=5nrB0ZEzQF8&embeds_referring_euri=https%3A%2F%2Ftaikai.network%2F

> All console logs (including the links of Sepolia Explorer can be found in this GitHub Gist.

### MiniApp (Demo UI View)

https://www.youtube.com/watch?v=moJbzZ8HsCg

The contract addresses on Ethereum Sepolia (verified):

```
"MockERC20":  "0x522D9F63b1ab865099152481D2c72432bC78c677"
"cToken":     "0x80A75e0B15A943E91945eda2558A02Afa30CDb3F"
"FHESplit":   "0xbFBc56979dBfA4514C6560e5E9d33Ff608117ce5"
Bounties – Zama
FHESplit demonstrates production-ready FHE integration for real-world financial privacy. We leverage Zama's fhEVM to encrypt all monetary amounts (balances, debts, expense shares) while maintaining on-chain verifiability and composability. Our deployed (and verified) Sepolia contracts showcase advanced FHE patterns: confidential ERC20 wrapping, encrypted debt tracking across multiple groups, auto-settling transfers in the encrypted domain, and granular ACL-based decryption. With 61 passing tests and comprehensive documentation, FHESplit proves that practical consumer applications can achieve genuine privacy without sacrificing blockchain benefits - solving the trillion-dollar problem of financial surveillance in expense-splitting apps used by millions globally.
```

## Key Technical Achievements:

✅ Confidential token wrapper (cToken) using OpenZeppelin + fhEVM

✅ Complex encrypted state management (multi-group debt tracking)

✅ Encrypted arithmetic operations (auto-settling transfers with debt reduction)

✅ Production deployment on Sepolia with ACL integration