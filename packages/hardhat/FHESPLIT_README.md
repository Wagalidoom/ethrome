# FHESplit - Private Expense Splitting with FHE

FHESplit is a privacy-preserving expense splitting platform built with Zama's Fully Homomorphic Encryption (FHE). It enables groups to track shared expenses and settle debts while keeping all monetary amounts fully encrypted on-chain.

## 🔐 Privacy Features

- **All amounts are encrypted (euint64)**: Balances, debts, and transfers use FHE
- **Group-scoped debt tracking**: Debts are isolated per group
- **Auto-settling transfers**: Debt settlement happens automatically during transfers
- **ACL-based access control**: Only authorized parties can decrypt amounts
- **Social graph visible, amounts private**: Who owes whom is public, but amounts are encrypted

## 📦 Contracts

### 1. **cToken.sol** - Confidential Token Wrapper
Wraps any ERC20 token (like USDT) into a confidential version with encrypted balances.

**Key Features:**
- Wrap/unwrap ERC20 ↔ cToken
- Confidential transfers with encrypted amounts
- Operator permissions for authorized transfers
- Based on OpenZeppelin's ConfidentialFungibleTokenERC20Wrapper

### 2. **FHESplit.sol** - Main Splitting Platform
The core contract managing groups, expenses, and settlements.

**Key Features:**
- Group management (create, add/remove members)
- Expense tracking with encrypted shares
- Platform balance management
- Auto-settling transfers within groups
- Comprehensive debt tracking

### 3. **MockERC20.sol** - Test Token
Simple ERC20 implementation for testing.

## 🚀 Getting Started

### Installation

```bash
npm install
```

### Deployment

```bash
# Deploy to local network
npx hardhat node  # In separate terminal
npx hardhat deploy --network localhost

# Deploy to Sepolia testnet
npx hardhat deploy --network sepolia
```

### Running Tests

```bash
npx hardhat test
```

## 📝 CLI Usage

FHESplit provides comprehensive CLI commands for all functionality:

### Token Operations

```bash
# Mint test tokens
npx hardhat claim-token --token 0x... --amount 1000

# Wrap ERC20 to cToken
npx hardhat wrap-token --ctoken 0x... --amount 500

# Unwrap cToken to ERC20
npx hardhat unwrap-token --ctoken 0x... --amount 100

# Check cToken balance
npx hardhat check-ctoken-balance --ctoken 0x... --user 0
```

### Platform Operations

```bash
# Approve FHESplit as operator
npx hardhat approve-platform --split 0x... --ctoken 0x...

# Deposit to platform
npx hardhat deposit --split 0x... --amount 100

# Withdraw from platform
npx hardhat withdraw --split 0x... --amount 50

# Withdraw all
npx hardhat withdraw-all --split 0x...

# Check platform balance
npx hardhat platform-balance --split 0x... --user 0
```

### Group Management (Bot Only)

```bash
# Create group
npx hardhat create-group --split 0x... --name "Roommates" --members "0x1,0x2,0x3"

# Add member
npx hardhat add-member --split 0x... --group 1 --member 0x...

# Remove member
npx hardhat remove-member --split 0x... --group 1 --member 0x...

# List user's groups
npx hardhat list-groups --split 0x... --user 0

# Show group members
npx hardhat group-members --split 0x... --group 1
```

### Expense Management (Bot Only)

```bash
# Add expense
npx hardhat add-expense \
  --split 0x... \
  --group 1 \
  --payer 0 \
  --description "Pizza" \
  --members "0,1,2" \
  --shares "100,100,100"

# List expenses
npx hardhat list-expenses --split 0x... --group 1

# Get expense share
npx hardhat get-expense-share --split 0x... --expense 1 --user 0
```

### Transfers & Settlement

```bash
# Transfer with auto-settlement
npx hardhat transfer-in-group \
  --split 0x... \
  --group 1 \
  --to 1 \
  --amount 50 \
  --from 0

# Get net owed
npx hardhat get-net-owed \
  --split 0x... \
  --group 1 \
  --debtor 0 \
  --creditor 1

# Get creditors (who you owe)
npx hardhat get-creditors --split 0x... --group 1 --user 0

# Get debtors (who owes you)
npx hardhat get-debtors --split 0x... --group 1 --user 0
```

### Utilities

```bash
# Diagnose contract state
npx hardhat diagnose \
  --split 0x... \
  --ctoken 0x... \
  --token 0x... \
  --user 0
```

## 🎬 Demo Workflow

Run the complete demo showing all features:

```bash
npx hardhat node  # Terminal 1
npx hardhat run scripts/demo-workflow.ts --network localhost  # Terminal 2
```

The demo demonstrates:
1. ✅ Token wrapping (ERC20 → cToken)
2. ✅ Platform deposits with encryption
3. ✅ Group creation
4. ✅ Expense tracking with encrypted shares
5. ✅ Auto-settling transfers
6. ✅ Debt management
7. ✅ Privacy preservation

## 🔧 Frontend Integration

See `examples/frontend-interaction.ts` for complete examples of:
- Connecting wallets
- Encrypting inputs
- Making transactions
- Decrypting balances
- React component examples

### Quick Example

```typescript
import { connectWallet, initFHEVM, depositToPlatform } from './examples/frontend-interaction';

// Connect wallet
const user = await connectWallet();

// Initialize FHE
const fhevmInstance = await initFHEVM(fheSplitAddress, provider);

// Deposit tokens
await depositToPlatform(fheSplit, fhevmInstance, "100");
```

## 🏗️ Architecture

### Data Flow

```
ERC20 Token (USDT)
    ↓ wrap()
cToken (Confidential)
    ↓ deposit()
FHESplit Platform Balance (encrypted)
    ↓ expense tracking
Group Debts (encrypted, per-group)
    ↓ auto-settling transfer
Debt Settlement + Balance Transfer
```

### Encryption Pattern

```solidity
// Encrypt input
const input = fhevm.createEncryptedInput(contractAddress, userAddress);
input.add64(amount);
const encrypted = await input.encrypt();

// Send to contract
await contract.method(encrypted.handles[0], encrypted.inputProof);

// Decrypt output
const clearValue = await fhevm.userDecryptEuint(
  FhevmType.euint64,
  encryptedValue,
  contractAddress,
  signer
);
```

## 🔐 Security Considerations

### Access Control

- **XMTP Bot Only**: Group and expense management restricted to authorized bot
- **Group Members Only**: Transfers only within group members
- **ACL Permissions**: Properly configured for all encrypted values
  - Contract always has access
  - Users can decrypt their own data
  - XMTP bot can read for notifications

### Privacy Guarantees

**Encrypted:**
- ✅ Platform balances
- ✅ Expense shares
- ✅ Net amounts owed
- ✅ Transfer amounts

**Public:**
- ❌ Group membership
- ❌ Expense metadata (payer, description)
- ❌ Debt relationships (who owes whom)

### Auto-Settlement Logic

```solidity
// When A transfers X to B in a group:
debt = groupNetOwed[groupId][A][B];
settleAmount = min(X, debt);
groupNetOwed[groupId][A][B] -= settleAmount;
remainingTransfer = X - settleAmount;

// Only remainingTransfer affects platform balances
platformBalances[A] -= remainingTransfer;
platformBalances[B] += remainingTransfer;
```

## 🧪 Testing

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/cToken.test.ts
npx hardhat test test/FHESplit.test.ts

# Run with gas reporting
REPORT_GAS=true npx hardhat test
```

### Test Coverage

- ✅ cToken: Wrapping, unwrapping, transfers, operators
- ✅ FHESplit: Deposits, withdrawals, groups, expenses, transfers
- ✅ Auto-settlement: Full debt, partial debt, no debt scenarios
- ✅ Access control: Bot permissions, group membership
- ✅ Privacy: Encryption/decryption of all amounts

## 📚 Contract API

### FHESplit Core Functions

**Platform Operations:**
- `deposit(encryptedAmount, inputProof)` - Deposit cToken
- `withdraw(encryptedAmount, inputProof)` - Withdraw cToken
- `withdrawAll()` - Withdraw all balance
- `getPlatformBalance(user)` - Get encrypted balance

**Group Management (Bot):**
- `createGroup(name, members[])` - Create new group
- `addMember(groupId, member)` - Add member to group
- `removeMember(groupId, member)` - Remove member from group

**Expense Management (Bot):**
- `addExpense(groupId, payer, members[], encryptedShares[], proofs[], description)` - Add expense

**Transfers:**
- `privateTransferInGroup(groupId, to, encryptedAmount, inputProof)` - Transfer with auto-settlement

**Queries:**
- `getUserGroups(user)` - Get user's groups
- `getGroupMembers(groupId)` - Get group members
- `getNetOwedInGroup(groupId, debtor, creditor)` - Get encrypted debt
- `getCreditorsInGroup(groupId, user)` - Who you owe
- `getDebtorsInGroup(groupId, user)` - Who owes you
- `getGroupExpenses(groupId)` - Get expense IDs
- `getExpense(expenseId)` - Get expense details
- `getExpenseShare(expenseId, member)` - Get encrypted share

## 🤖 XMTP Bot Integration

The contract is designed to work with an XMTP bot that:
1. Listens to group chat messages
2. Creates groups from XMTP conversations
3. Adds expenses based on messages
4. Sends notifications about debts
5. Facilitates settlement requests

**Bot Address Setup:**
- Set during deployment
- Can be updated by current bot
- All group/expense operations require bot signature

## 📊 Events

```solidity
event Deposit(address indexed user, uint256 timestamp);
event Withdrawal(address indexed user, uint256 timestamp);
event GroupCreated(uint256 indexed groupId, string name, address indexed creator);
event MemberAdded(uint256 indexed groupId, address indexed member);
event MemberRemoved(uint256 indexed groupId, address indexed member);
event ExpenseAdded(uint256 indexed expenseId, uint256 indexed groupId, address indexed payer, string description);
event TransferInGroup(uint256 indexed groupId, address indexed from, address indexed to);
event DebtSettled(uint256 indexed groupId, address indexed debtor, address indexed creditor);
```

## 🌐 Deployment Addresses

### Localhost / Hardhat
Deploy locally with `npx hardhat deploy --network localhost`

### Sepolia Testnet
Update with your deployed addresses:
```
MockERC20: 0x...
cToken: 0x...
FHESplit: 0x...
```

## 📖 Additional Resources

- [Zama FHE Documentation](https://docs.zama.ai/)
- [FHEVM Solidity Guide](https://docs.zama.ai/protocol/solidity-guides/smart-contract)
- [FHE Types Reference](https://docs.zama.ai/protocol/solidity-guides/smart-contract/types)
- [ACL Documentation](https://docs.zama.ai/protocol/solidity-guides/smart-contract/acl)

## 🤝 Contributing

Contributions welcome! Areas for improvement:
- Enhanced XMTP bot implementation
- Frontend UI/UX
- Gas optimizations
- Additional privacy features
- Multi-currency support

## 📄 License

BSD-3-Clause-Clear

## ⚠️ Disclaimer

This is experimental software using cutting-edge FHE technology. Audit thoroughly before production use.
