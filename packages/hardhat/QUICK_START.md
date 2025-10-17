# FHESplit Quick Start Guide

## 🚀 Quick Setup (5 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Start local node (Terminal 1)
npx hardhat node

# 3. Deploy contracts (Terminal 2)
npx hardhat deploy --network localhost

# 4. Run demo (Terminal 2)
npx hardhat run scripts/demo-workflow.ts --network localhost
```

## 📋 Common Workflows

### For Users

```bash
# Get contract addresses from deployment
SPLIT=0x...
CTOKEN=0x...
TOKEN=0x...

# 1. Setup (one-time)
npx hardhat claim-token --token $TOKEN --amount 1000
npx hardhat wrap-token --ctoken $CTOKEN --amount 500
npx hardhat approve-platform --split $SPLIT --ctoken $CTOKEN

# 2. Deposit
npx hardhat deposit --split $SPLIT --amount 200

# 3. Check balance
npx hardhat platform-balance --split $SPLIT

# 4. View groups
npx hardhat list-groups --split $SPLIT

# 5. Make transfer
npx hardhat transfer-in-group --split $SPLIT --group 1 --to 1 --amount 50
```

### For XMTP Bot

```bash
# Create group
npx hardhat create-group \
  --split $SPLIT \
  --name "Roommates" \
  --members "0xalice,0xbob,0xcharlie"

# Add expense
npx hardhat add-expense \
  --split $SPLIT \
  --group 1 \
  --payer 0 \
  --description "Pizza night" \
  --members "0,1,2" \
  --shares "100,100,100"

# Check debts
npx hardhat get-net-owed --split $SPLIT --group 1 --debtor 1 --creditor 0
```

## 🔍 Debug Issues

```bash
# Check everything
npx hardhat diagnose --split $SPLIT --ctoken $CTOKEN --token $TOKEN

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test
```

## 📝 Key Concepts

### Privacy Model
- ✅ **Encrypted**: All amounts (balances, debts, transfers)
- ❌ **Public**: Group membership, expense metadata

### Auto-Settlement
When you transfer money to someone you owe:
1. Debt is settled first (encrypted)
2. Remainder goes to their balance (encrypted)
3. All happens atomically

### Example:
- You owe Bob 100 tokens
- You transfer 150 tokens to Bob
- → 100 settles debt, 50 goes to Bob's balance

## 🎯 User Journey

1. **Mint & Wrap**: Get test tokens, wrap to cToken
2. **Approve**: Let FHESplit move your cTokens
3. **Deposit**: Move cTokens to platform balance
4. **Join Group**: Bot adds you to expense group
5. **Track Expenses**: Bot records shared costs
6. **Settle Up**: Transfer money (auto-settles debts)
7. **Withdraw**: Take remaining balance back to cToken/ERC20

## 📊 Architecture

```
User Wallet
   ↓
ERC20 (USDT) ←→ wrap/unwrap ←→ cToken (encrypted)
   ↓
   deposit/withdraw
   ↓
FHESplit Platform Balance (encrypted)
   ↓
   expense tracking
   ↓
Group-Scoped Debts (encrypted)
   ↓
   auto-settling transfers
   ↓
Debt Settlement (encrypted)
```

## 🔐 Security Checklist

- [ ] XMTP bot address is secure
- [ ] Users approve platform as operator
- [ ] All amounts use encrypted inputs
- [ ] ACL permissions properly set
- [ ] Only bot can create groups/expenses
- [ ] Only group members can transfer within group

## 🆘 Help

See full documentation: `FHESPLIT_README.md`
Frontend examples: `examples/frontend-interaction.ts`
Test examples: `test/FHESplit.test.ts`

## 🐛 Common Issues

**"Not authorized"**
→ Run: `npx hardhat approve-platform --split $SPLIT --ctoken $CTOKEN`

**"Insufficient balance"**
→ Deposit more: `npx hardhat deposit --split $SPLIT --amount 100`

**"Not a group member"**
→ Bot must add you: `npx hardhat add-member --split $SPLIT --group 1 --member 0x...`

**Can't decrypt**
→ You may not have permission to view that encrypted value
