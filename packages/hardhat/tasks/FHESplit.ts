import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { FhevmType } from "@fhevm/hardhat-plugin";

/**
 * FHESplit CLI Tasks
 * Complete command-line interface for interacting with FHESplit contracts
 */

// =============================================================
//                    TOKEN OPERATIONS
// =============================================================

/**
 * Mint mock ERC20 tokens for testing
 * Example: npx hardhat claim-token --token 0x... --amount 1000
 */
task("claim-token", "Mint mock ERC20 tokens for testing")
  .addParam("token", "Address of the MockERC20 token")
  .addParam("amount", "Amount to mint")
  .addOptionalParam("user", "User index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    const signers = await ethers.getSigners();
    const user = signers[parseInt(taskArguments.user)];
    const amount = ethers.parseUnits(taskArguments.amount, 6);

    console.log("🪙 Minting tokens...");
    console.log("User:", user.address);
    console.log("Amount:", taskArguments.amount);

    const token = await ethers.getContractAt("MockERC20", taskArguments.token);
    const mintTx = await token.connect(user).mint(user.address, amount);
    await mintTx.wait();

    const balance = await token.balanceOf(user.address);
    console.log("✅ Tokens minted successfully");
    console.log("New balance:", ethers.formatUnits(balance, 6));
    console.log("Transaction:", mintTx.hash);
  });

/**
 * Wrap ERC20 tokens into cToken
 * Example: npx hardhat wrap-token --ctoken 0x... --amount 500
 */
task("wrap-token", "Wrap ERC20 tokens to cToken")
  .addParam("ctoken", "Address of the cToken contract")
  .addParam("amount", "Amount to wrap")
  .addOptionalParam("user", "User index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    const signers = await ethers.getSigners();
    const user = signers[parseInt(taskArguments.user)];
    const amount = ethers.parseUnits(taskArguments.amount, 6);

    console.log("🔄 Wrapping tokens to cToken...");
    console.log("User:", user.address);
    console.log("Amount:", taskArguments.amount);

    const cToken = await ethers.getContractAt("cToken", taskArguments.ctoken);
    const underlyingAddress = await cToken.underlying();
    const underlying = await ethers.getContractAt("MockERC20", underlyingAddress);

    // Check and approve if needed
    const allowance = await underlying.allowance(user.address, taskArguments.ctoken);
    if (allowance < amount) {
      console.log("📝 Approving token spending...");
      const approveTx = await underlying.connect(user).approve(taskArguments.ctoken, amount);
      await approveTx.wait();
      console.log("✅ Approval confirmed");
    }

    // Wrap tokens
    const wrapTx = await cToken.connect(user).wrap(user.address, amount);
    await wrapTx.wait();

    console.log("✅ Wrapped", taskArguments.amount, "tokens to cToken");
    console.log("Transaction:", wrapTx.hash);
  });

/**
 * Unwrap cToken back to ERC20
 * Example: npx hardhat unwrap-token --ctoken 0x... --amount 100
 */
task("unwrap-token", "Unwrap cToken back to ERC20")
  .addParam("ctoken", "Address of the cToken contract")
  .addParam("amount", "Amount to unwrap")
  .addOptionalParam("user", "User index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, { ethers, fhevm }) {
    await fhevm.initializeCLIApi();
    const signers = await ethers.getSigners();
    const user = signers[parseInt(taskArguments.user)];
    const amount = parseInt(taskArguments.amount) * 1000000; // Convert to 6 decimals

    console.log("🔄 Unwrapping cToken...");
    console.log("User:", user.address);
    console.log("Amount:", taskArguments.amount);

    const cToken = await ethers.getContractAt("cToken", taskArguments.ctoken);

    // Create encrypted input
    const input = fhevm.createEncryptedInput(taskArguments.ctoken, user.address);
    input.add64(amount);
    const encryptedInput = await input.encrypt();

    const unwrapTx = await cToken
      .connect(user)
      .unwrap(encryptedInput.handles[0], encryptedInput.inputProof);
    await unwrapTx.wait();

    console.log("✅ Unwrapped cToken successfully");
    console.log("Transaction:", unwrapTx.hash);
  });

/**
 * Check cToken balance
 * Example: npx hardhat check-ctoken-balance --ctoken 0x... --user 0
 */
task("check-ctoken-balance", "Check encrypted cToken balance")
  .addParam("ctoken", "Address of the cToken contract")
  .addOptionalParam("user", "User index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, { ethers, fhevm }) {
    await fhevm.initializeCLIApi();
    const signers = await ethers.getSigners();
    const user = signers[parseInt(taskArguments.user)];

    console.log("📊 Checking cToken balance...");
    console.log("User:", user.address);

    const cToken = await ethers.getContractAt("cToken", taskArguments.ctoken);
    const encryptedBalance = await cToken.balanceOf(user.address);
    console.log("Encrypted balance handle:", encryptedBalance);

    try {
      const clearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        taskArguments.ctoken,
        user
      );
      console.log("Decrypted balance:", (Number(clearBalance) / 1000000).toFixed(6));
    } catch (error) {
      console.log("⚠️ Could not decrypt balance");
    }
  });

// =============================================================
//                  PLATFORM OPERATIONS
// =============================================================

/**
 * Approve FHESplit as operator for cToken
 * Example: npx hardhat approve-platform --split 0x... --ctoken 0x...
 */
task("approve-platform", "Approve FHESplit as operator for cToken")
  .addParam("split", "Address of the FHESplit contract")
  .addParam("ctoken", "Address of the cToken contract")
  .addOptionalParam("user", "User index (default: 0)", "0")
  .addOptionalParam("duration", "Duration in seconds (default: 1 year)", "31536000")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    const signers = await ethers.getSigners();
    const user = signers[parseInt(taskArguments.user)];
    const cToken = await ethers.getContractAt("cToken", taskArguments.ctoken);

    const until = Math.floor(Date.now() / 1000) + parseInt(taskArguments.duration);

    console.log("🔐 Approving FHESplit as operator...");
    console.log("User:", user.address);
    console.log("FHESplit:", taskArguments.split);
    console.log("Valid until:", new Date(until * 1000).toISOString());

    const approveTx = await cToken.connect(user).setOperator(taskArguments.split, until);
    await approveTx.wait();

    console.log("✅ FHESplit approved as operator");
    console.log("Transaction:", approveTx.hash);
  });

/**
 * Deposit cToken to FHESplit platform
 * Example: npx hardhat deposit --split 0x... --amount 100
 */
task("deposit", "Deposit cToken to FHESplit platform")
  .addParam("split", "Address of the FHESplit contract")
  .addParam("amount", "Amount to deposit")
  .addOptionalParam("user", "User index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, { ethers, fhevm }) {
    await fhevm.initializeCLIApi();
    const signers = await ethers.getSigners();
    const user = signers[parseInt(taskArguments.user)];
    const amount = parseInt(taskArguments.amount) * 1000000;

    console.log("💰 Depositing to FHESplit...");
    console.log("User:", user.address);
    console.log("Amount:", taskArguments.amount);

    const fheSplit = await ethers.getContractAt("FHESplit", taskArguments.split);

    // Create encrypted input
    const input = fhevm.createEncryptedInput(taskArguments.split, user.address);
    input.add64(amount);
    const encryptedInput = await input.encrypt();

    const depositTx = await fheSplit
      .connect(user)
      .deposit(encryptedInput.handles[0], encryptedInput.inputProof);
    await depositTx.wait();

    console.log("✅ Deposit successful");
    console.log("Transaction:", depositTx.hash);
  });

/**
 * Withdraw cToken from FHESplit platform
 * Example: npx hardhat withdraw --split 0x... --amount 50
 */
task("withdraw", "Withdraw cToken from FHESplit platform")
  .addParam("split", "Address of the FHESplit contract")
  .addParam("amount", "Amount to withdraw")
  .addOptionalParam("user", "User index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, { ethers, fhevm }) {
    await fhevm.initializeCLIApi();
    const signers = await ethers.getSigners();
    const user = signers[parseInt(taskArguments.user)];
    const amount = parseInt(taskArguments.amount) * 1000000;

    console.log("💸 Withdrawing from FHESplit...");
    console.log("User:", user.address);
    console.log("Amount:", taskArguments.amount);

    const fheSplit = await ethers.getContractAt("FHESplit", taskArguments.split);

    // Create encrypted input
    const input = fhevm.createEncryptedInput(taskArguments.split, user.address);
    input.add64(amount);
    const encryptedInput = await input.encrypt();

    const withdrawTx = await fheSplit
      .connect(user)
      .withdraw(encryptedInput.handles[0], encryptedInput.inputProof);
    await withdrawTx.wait();

    console.log("✅ Withdrawal successful");
    console.log("Transaction:", withdrawTx.hash);
  });

/**
 * Withdraw all balance from FHESplit platform
 * Example: npx hardhat withdraw-all --split 0x...
 */
task("withdraw-all", "Withdraw all balance from FHESplit platform")
  .addParam("split", "Address of the FHESplit contract")
  .addOptionalParam("user", "User index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    const signers = await ethers.getSigners();
    const user = signers[parseInt(taskArguments.user)];

    console.log("💸 Withdrawing all from FHESplit...");
    console.log("User:", user.address);

    const fheSplit = await ethers.getContractAt("FHESplit", taskArguments.split);
    const withdrawTx = await fheSplit.connect(user).withdrawAll();
    await withdrawTx.wait();

    console.log("✅ Withdrawal successful");
    console.log("Transaction:", withdrawTx.hash);
  });

/**
 * Get platform balance
 * Example: npx hardhat platform-balance --split 0x... --user 0
 */
task("platform-balance", "Get encrypted platform balance")
  .addParam("split", "Address of the FHESplit contract")
  .addOptionalParam("user", "User index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, { ethers, fhevm }) {
    await fhevm.initializeCLIApi();
    const signers = await ethers.getSigners();
    const user = signers[parseInt(taskArguments.user)];

    console.log("📊 Getting platform balance...");
    console.log("User:", user.address);

    const fheSplit = await ethers.getContractAt("FHESplit", taskArguments.split);
    const encryptedBalance = await fheSplit.getPlatformBalance(user.address);
    console.log("Encrypted balance handle:", encryptedBalance);

    try {
      const clearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        taskArguments.split,
        user
      );
      console.log("Decrypted balance:", (Number(clearBalance) / 1000000).toFixed(6));
    } catch (error) {
      console.log("⚠️ Could not decrypt balance");
    }
  });

// =============================================================
//                  GROUP MANAGEMENT
// =============================================================

/**
 * Create a new group
 * Example: npx hardhat create-group --split 0x... --name "Roommates" --members "0x123,0x456"
 */
task("create-group", "Create a new group (XMTP bot only)")
  .addParam("split", "Address of the FHESplit contract")
  .addParam("name", "Group name")
  .addParam("members", "Comma-separated member addresses")
  .addOptionalParam("bot", "Bot user index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    const signers = await ethers.getSigners();
    const bot = signers[parseInt(taskArguments.bot)];
    const members = taskArguments.members.split(",").map((m: string) => m.trim());

    console.log("👥 Creating group...");
    console.log("Bot:", bot.address);
    console.log("Name:", taskArguments.name);
    console.log("Members:", members);

    const fheSplit = await ethers.getContractAt("FHESplit", taskArguments.split);
    const createTx = await fheSplit.connect(bot).createGroup(taskArguments.name, members);
    const receipt = await createTx.wait();

    // Parse GroupCreated event
    const event = receipt?.logs.find((log: any) => {
      try {
        const parsed = fheSplit.interface.parseLog(log);
        return parsed?.name === "GroupCreated";
      } catch {
        return false;
      }
    });

    let groupId;
    if (event) {
      const parsed = fheSplit.interface.parseLog(event);
      groupId = parsed?.args[0];
    }

    console.log("✅ Group created successfully");
    console.log("Group ID:", groupId?.toString());
    console.log("Transaction:", createTx.hash);
  });

/**
 * Add member to group
 * Example: npx hardhat add-member --split 0x... --group 1 --member 0x789
 */
task("add-member", "Add member to a group (XMTP bot only)")
  .addParam("split", "Address of the FHESplit contract")
  .addParam("group", "Group ID")
  .addParam("member", "Member address to add")
  .addOptionalParam("bot", "Bot user index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    const signers = await ethers.getSigners();
    const bot = signers[parseInt(taskArguments.bot)];

    console.log("➕ Adding member to group...");
    console.log("Group ID:", taskArguments.group);
    console.log("Member:", taskArguments.member);

    const fheSplit = await ethers.getContractAt("FHESplit", taskArguments.split);
    const addTx = await fheSplit.connect(bot).addMember(taskArguments.group, taskArguments.member);
    await addTx.wait();

    console.log("✅ Member added successfully");
    console.log("Transaction:", addTx.hash);
  });

/**
 * Remove member from group
 * Example: npx hardhat remove-member --split 0x... --group 1 --member 0x789
 */
task("remove-member", "Remove member from a group (XMTP bot only)")
  .addParam("split", "Address of the FHESplit contract")
  .addParam("group", "Group ID")
  .addParam("member", "Member address to remove")
  .addOptionalParam("bot", "Bot user index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    const signers = await ethers.getSigners();
    const bot = signers[parseInt(taskArguments.bot)];

    console.log("➖ Removing member from group...");
    console.log("Group ID:", taskArguments.group);
    console.log("Member:", taskArguments.member);

    const fheSplit = await ethers.getContractAt("FHESplit", taskArguments.split);
    const removeTx = await fheSplit
      .connect(bot)
      .removeMember(taskArguments.group, taskArguments.member);
    await removeTx.wait();

    console.log("✅ Member removed successfully");
    console.log("Transaction:", removeTx.hash);
  });

/**
 * List groups for a user
 * Example: npx hardhat list-groups --split 0x... --user 0
 */
task("list-groups", "List all groups for a user")
  .addParam("split", "Address of the FHESplit contract")
  .addOptionalParam("user", "User index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    const signers = await ethers.getSigners();
    const user = signers[parseInt(taskArguments.user)];

    console.log("📋 Listing groups...");
    console.log("User:", user.address);

    const fheSplit = await ethers.getContractAt("FHESplit", taskArguments.split);
    const groupIds = await fheSplit.getUserGroups(user.address);

    console.log(`\nFound ${groupIds.length} groups:`);
    for (const groupId of groupIds) {
      const group = await fheSplit.getGroup(groupId);
      console.log(`\nGroup ID: ${groupId}`);
      console.log(`  Name: ${group.name}`);
      console.log(`  Creator: ${group.creator}`);
      console.log(`  Created: ${new Date(Number(group.createdAt) * 1000).toLocaleString()}`);
    }
  });

/**
 * Show group members
 * Example: npx hardhat group-members --split 0x... --group 1
 */
task("group-members", "Show members of a group")
  .addParam("split", "Address of the FHESplit contract")
  .addParam("group", "Group ID")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    console.log("👥 Getting group members...");
    console.log("Group ID:", taskArguments.group);

    const fheSplit = await ethers.getContractAt("FHESplit", taskArguments.split);
    const group = await fheSplit.getGroup(taskArguments.group);
    const members = await fheSplit.getGroupMembers(taskArguments.group);

    console.log(`\nGroup: ${group.name}`);
    console.log(`Members (${members.length}):`);
    members.forEach((member: string, index: number) => {
      console.log(`  ${index + 1}. ${member}`);
    });
  });

// =============================================================
//                  EXPENSE MANAGEMENT
// =============================================================

/**
 * Add expense to group
 * Example: npx hardhat add-expense --split 0x... --group 1 --payer 0 --description "Pizza" --members "0,1,2" --shares "100,100,100"
 */
task("add-expense", "Add expense to a group (XMTP bot only)")
  .addParam("split", "Address of the FHESplit contract")
  .addParam("group", "Group ID")
  .addParam("payer", "Payer user index")
  .addParam("description", "Expense description")
  .addParam("members", "Comma-separated member indices")
  .addParam("shares", "Comma-separated share amounts (in tokens, e.g. 100,100,100)")
  .addOptionalParam("bot", "Bot user index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, { ethers, fhevm }) {
    await fhevm.initializeCLIApi();
    const signers = await ethers.getSigners();
    const bot = signers[parseInt(taskArguments.bot)];
    const payer = signers[parseInt(taskArguments.payer)];

    const memberIndices = taskArguments.members.split(",").map((m: string) => parseInt(m.trim()));
    const memberAddresses = memberIndices.map((i: number) => signers[i].address);
    const shareAmounts = taskArguments.shares.split(",").map((s: string) => parseInt(s.trim()) * 1000000);

    console.log("💵 Adding expense...");
    console.log("Group ID:", taskArguments.group);
    console.log("Payer:", payer.address);
    console.log("Description:", taskArguments.description);
    console.log("Members:", memberAddresses);
    console.log("Shares:", taskArguments.shares);

    const fheSplit = await ethers.getContractAt("FHESplit", taskArguments.split);

    // Encrypt each share
    const encryptedShares = [];
    const proofs = [];

    for (const share of shareAmounts) {
      const input = fhevm.createEncryptedInput(taskArguments.split, bot.address);
      input.add64(share);
      const encrypted = await input.encrypt();
      encryptedShares.push(encrypted.handles[0]);
      proofs.push(encrypted.inputProof);
    }

    const addTx = await fheSplit
      .connect(bot)
      .addExpense(
        taskArguments.group,
        payer.address,
        memberAddresses,
        encryptedShares,
        proofs,
        taskArguments.description
      );
    const receipt = await addTx.wait();

    // Parse ExpenseAdded event
    const event = receipt?.logs.find((log: any) => {
      try {
        const parsed = fheSplit.interface.parseLog(log);
        return parsed?.name === "ExpenseAdded";
      } catch {
        return false;
      }
    });

    let expenseId;
    if (event) {
      const parsed = fheSplit.interface.parseLog(event);
      expenseId = parsed?.args[0];
    }

    console.log("✅ Expense added successfully");
    console.log("Expense ID:", expenseId?.toString());
    console.log("Transaction:", addTx.hash);
  });

/**
 * List expenses in group
 * Example: npx hardhat list-expenses --split 0x... --group 1
 */
task("list-expenses", "List expenses in a group")
  .addParam("split", "Address of the FHESplit contract")
  .addParam("group", "Group ID")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    console.log("💵 Listing expenses...");
    console.log("Group ID:", taskArguments.group);

    const fheSplit = await ethers.getContractAt("FHESplit", taskArguments.split);
    const expenseIds = await fheSplit.getGroupExpenses(taskArguments.group);

    console.log(`\nFound ${expenseIds.length} expenses:`);
    for (const expenseId of expenseIds) {
      const expense = await fheSplit.getExpense(expenseId);
      console.log(`\nExpense ID: ${expenseId}`);
      console.log(`  Description: ${expense.description}`);
      console.log(`  Payer: ${expense.payer}`);
      console.log(`  Created: ${new Date(Number(expense.createdAt) * 1000).toLocaleString()}`);
    }
  });

/**
 * Get expense share for member
 * Example: npx hardhat get-expense-share --split 0x... --expense 1 --user 0
 */
task("get-expense-share", "Get member's encrypted share for an expense")
  .addParam("split", "Address of the FHESplit contract")
  .addParam("expense", "Expense ID")
  .addOptionalParam("user", "User index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, { ethers, fhevm }) {
    await fhevm.initializeCLIApi();
    const signers = await ethers.getSigners();
    const user = signers[parseInt(taskArguments.user)];

    console.log("💰 Getting expense share...");
    console.log("Expense ID:", taskArguments.expense);
    console.log("User:", user.address);

    const fheSplit = await ethers.getContractAt("FHESplit", taskArguments.split);
    const encryptedShare = await fheSplit.getExpenseShare(taskArguments.expense, user.address);
    console.log("Encrypted share handle:", encryptedShare);

    try {
      const clearShare = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedShare,
        taskArguments.split,
        user
      );
      console.log("Decrypted share:", (Number(clearShare) / 1000000).toFixed(6));
    } catch (error) {
      console.log("⚠️ Could not decrypt share");
    }
  });

// =============================================================
//                 TRANSFERS & SETTLEMENT
// =============================================================

/**
 * Transfer with auto-settlement within group
 * Example: npx hardhat transfer-in-group --split 0x... --group 1 --to 1 --amount 50 --from 0
 */
task("transfer-in-group", "Transfer with auto-settlement within a group")
  .addParam("split", "Address of the FHESplit contract")
  .addParam("group", "Group ID")
  .addParam("to", "Recipient user index")
  .addParam("amount", "Amount to transfer")
  .addOptionalParam("from", "Sender user index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, { ethers, fhevm }) {
    await fhevm.initializeCLIApi();
    const signers = await ethers.getSigners();
    const from = signers[parseInt(taskArguments.from)];
    const to = signers[parseInt(taskArguments.to)];
    const amount = parseInt(taskArguments.amount) * 1000000;

    console.log("💸 Transferring with auto-settlement...");
    console.log("Group ID:", taskArguments.group);
    console.log("From:", from.address);
    console.log("To:", to.address);
    console.log("Amount:", taskArguments.amount);

    const fheSplit = await ethers.getContractAt("FHESplit", taskArguments.split);

    // Create encrypted input
    const input = fhevm.createEncryptedInput(taskArguments.split, from.address);
    input.add64(amount);
    const encryptedInput = await input.encrypt();

    const transferTx = await fheSplit
      .connect(from)
      .privateTransferInGroup(
        taskArguments.group,
        to.address,
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );
    await transferTx.wait();

    console.log("✅ Transfer successful (debts settled automatically)");
    console.log("Transaction:", transferTx.hash);
  });

/**
 * Get net amount owed
 * Example: npx hardhat get-net-owed --split 0x... --group 1 --debtor 0 --creditor 1
 */
task("get-net-owed", "Get encrypted net amount owed between two users")
  .addParam("split", "Address of the FHESplit contract")
  .addParam("group", "Group ID")
  .addParam("debtor", "Debtor user index")
  .addParam("creditor", "Creditor user index")
  .setAction(async function (taskArguments: TaskArguments, { ethers, fhevm }) {
    await fhevm.initializeCLIApi();
    const signers = await ethers.getSigners();
    const debtor = signers[parseInt(taskArguments.debtor)];
    const creditor = signers[parseInt(taskArguments.creditor)];

    console.log("💰 Getting net owed...");
    console.log("Group ID:", taskArguments.group);
    console.log("Debtor:", debtor.address);
    console.log("Creditor:", creditor.address);

    const fheSplit = await ethers.getContractAt("FHESplit", taskArguments.split);
    const encryptedOwed = await fheSplit.getNetOwedInGroup(
      taskArguments.group,
      debtor.address,
      creditor.address
    );
    console.log("Encrypted owed handle:", encryptedOwed);

    try {
      const clearOwed = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedOwed,
        taskArguments.split,
        debtor
      );
      console.log(`${debtor.address} owes ${creditor.address}:`, (Number(clearOwed) / 1000000).toFixed(6));
    } catch (error) {
      console.log("⚠️ Could not decrypt amount");
    }
  });

/**
 * Get creditors in group
 * Example: npx hardhat get-creditors --split 0x... --group 1 --user 0
 */
task("get-creditors", "Get who you owe in a group")
  .addParam("split", "Address of the FHESplit contract")
  .addParam("group", "Group ID")
  .addOptionalParam("user", "User index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    const signers = await ethers.getSigners();
    const user = signers[parseInt(taskArguments.user)];

    console.log("📋 Getting creditors...");
    console.log("Group ID:", taskArguments.group);
    console.log("User:", user.address);

    const fheSplit = await ethers.getContractAt("FHESplit", taskArguments.split);
    const creditors = await fheSplit.getCreditorsInGroup(taskArguments.group, user.address);

    console.log(`\n${user.address} owes:`);
    if (creditors.length === 0) {
      console.log("  No one (all settled!)");
    } else {
      creditors.forEach((creditor: string, index: number) => {
        console.log(`  ${index + 1}. ${creditor}`);
      });
    }
  });

/**
 * Get debtors in group
 * Example: npx hardhat get-debtors --split 0x... --group 1 --user 0
 */
task("get-debtors", "Get who owes you in a group")
  .addParam("split", "Address of the FHESplit contract")
  .addParam("group", "Group ID")
  .addOptionalParam("user", "User index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    const signers = await ethers.getSigners();
    const user = signers[parseInt(taskArguments.user)];

    console.log("📋 Getting debtors...");
    console.log("Group ID:", taskArguments.group);
    console.log("User:", user.address);

    const fheSplit = await ethers.getContractAt("FHESplit", taskArguments.split);
    const debtors = await fheSplit.getDebtorsInGroup(taskArguments.group, user.address);

    console.log(`\nWho owes ${user.address}:`);
    if (debtors.length === 0) {
      console.log("  No one");
    } else {
      debtors.forEach((debtor: string, index: number) => {
        console.log(`  ${index + 1}. ${debtor}`);
      });
    }
  });

// =============================================================
//                      UTILITIES
// =============================================================

/**
 * Diagnose contract state
 * Example: npx hardhat diagnose --split 0x... --ctoken 0x... --token 0x...
 */
task("diagnose", "Diagnose contract state for debugging")
  .addParam("split", "Address of the FHESplit contract")
  .addParam("ctoken", "Address of the cToken contract")
  .addParam("token", "Address of the underlying token contract")
  .addOptionalParam("user", "User index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    const signers = await ethers.getSigners();
    const user = signers[parseInt(taskArguments.user)];

    console.log("🔍 Diagnosing contract state...");
    console.log("User:", user.address);
    console.log("FHESplit:", taskArguments.split);
    console.log("cToken:", taskArguments.ctoken);
    console.log("Token:", taskArguments.token);

    try {
      const token = await ethers.getContractAt("MockERC20", taskArguments.token);
      const cToken = await ethers.getContractAt("cToken", taskArguments.ctoken);
      const fheSplit = await ethers.getContractAt("FHESplit", taskArguments.split);

      // Check underlying token balance
      const tokenBalance = await token.balanceOf(user.address);
      console.log("📊 Underlying token balance:", ethers.formatUnits(tokenBalance, 6));

      // Check if FHESplit is operator
      const isOperator = await cToken.isOperator(user.address, taskArguments.split);
      console.log("🔐 Is FHESplit operator?", isOperator);

      // Check cToken balance
      try {
        const cTokenBalance = await cToken.balanceOf(user.address);
        console.log("💰 cToken balance handle:", cTokenBalance);
      } catch (e) {
        console.log("⚠️ Cannot read cToken balance");
      }

      // Check platform balance
      try {
        const platformBalance = await fheSplit.getPlatformBalance(user.address);
        console.log("🏛️ Platform balance handle:", platformBalance);
      } catch (e: any) {
        console.log("⚠️ Cannot read platform balance:", e.message);
      }

      // Check groups
      const groups = await fheSplit.getUserGroups(user.address);
      console.log("👥 User is in", groups.length, "groups");
    } catch (error: any) {
      console.error("❌ Error during diagnosis:", error.message);
    }
  });

export default {};
