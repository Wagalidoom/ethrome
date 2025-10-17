/**
 * FHESplit Demo Workflow
 *
 * This script demonstrates the complete functionality of FHESplit:
 * 1. Deploy all contracts
 * 2. Setup users with tokens
 * 3. Create a group
 * 4. Add expenses
 * 5. Make auto-settling transfers
 * 6. Query balances and debts
 *
 * Run with: npx hardhat run scripts/demo-workflow.ts --network localhost
 */

import { ethers, fhevm, deployments } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";

async function main() {
  console.log("\n========================================");
  console.log("   FHESplit Demo Workflow");
  console.log("========================================\n");

  await fhevm.initializeCLIApi();

  // Get signers
  const signers = await ethers.getSigners();
  const [deployer, alice, bob, charlie] = signers;

  console.log("👤 Users:");
  console.log(`  Deployer/Bot: ${deployer.address}`);
  console.log(`  Alice: ${alice.address}`);
  console.log(`  Bob: ${bob.address}`);
  console.log(`  Charlie: ${charlie.address}`);

  // ========================================
  // STEP 1: Deploy Contracts
  // ========================================
  console.log("\n📦 STEP 1: Deploying Contracts...");

  await deployments.fixture(["MockToken", "cToken", "FHESplit"]);

  const mockTokenDeployment = await deployments.get("MockERC20");
  const cTokenDeployment = await deployments.get("cToken");
  const fheSplitDeployment = await deployments.get("FHESplit");

  const mockToken = await ethers.getContractAt("MockERC20", mockTokenDeployment.address);
  const cToken = await ethers.getContractAt("cToken", cTokenDeployment.address);
  const fheSplit = await ethers.getContractAt("FHESplit", fheSplitDeployment.address);

  console.log("✅ Contracts deployed:");
  console.log(`  MockERC20: ${mockTokenDeployment.address}`);
  console.log(`  cToken: ${cTokenDeployment.address}`);
  console.log(`  FHESplit: ${fheSplitDeployment.address}`);

  // ========================================
  // STEP 2: Setup Users
  // ========================================
  console.log("\n💰 STEP 2: Setting up users with tokens...");

  const users = [
    { signer: alice, name: "Alice" },
    { signer: bob, name: "Bob" },
    { signer: charlie, name: "Charlie" }
  ];

  for (const user of users) {
    // Mint 1000 tokens
    await mockToken.mint(user.signer.address, ethers.parseUnits("1000", 6));
    console.log(`  ${user.name}: Minted 1000 tokens`);

    // Approve and wrap 500 tokens to cToken
    await mockToken.connect(user.signer).approve(cTokenDeployment.address, ethers.parseUnits("500", 6));
    await cToken.connect(user.signer).wrap(user.signer.address, ethers.parseUnits("500", 6));
    console.log(`  ${user.name}: Wrapped 500 tokens to cToken`);

    // Approve FHESplit as operator
    const until = Math.floor(Date.now() / 1000) + 3600;
    await cToken.connect(user.signer).setOperator(fheSplitDeployment.address, until);
    console.log(`  ${user.name}: Approved FHESplit as operator`);

    // Deposit 300 tokens to platform
    const depositAmount = 300000000n; // 300 tokens
    const encryptedDeposit = await fhevm
      .createEncryptedInput(fheSplitDeployment.address, user.signer.address)
      .add64(depositAmount)
      .encrypt();
    await fheSplit.connect(user.signer).deposit(encryptedDeposit.handles[0], encryptedDeposit.inputProof);
    console.log(`  ${user.name}: Deposited 300 tokens to platform`);

    // Verify balance
    const encryptedBalance = await fheSplit.getPlatformBalance(user.signer.address);
    const clearBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      fheSplitDeployment.address,
      user.signer
    );
    console.log(`  ${user.name}: Platform balance = ${(Number(clearBalance) / 1000000).toFixed(2)} tokens ✓`);
  }

  // ========================================
  // STEP 3: Create Group
  // ========================================
  console.log("\n👥 STEP 3: Creating 'Roommates' group...");

  const members = [alice.address, bob.address, charlie.address];
  const createGroupTx = await fheSplit.connect(deployer).createGroup("Roommates", members);
  const receipt = await createGroupTx.wait();

  const groupId = 1n;
  const group = await fheSplit.getGroup(groupId);
  console.log(`✅ Group created:`);
  console.log(`  ID: ${groupId}`);
  console.log(`  Name: ${group.name}`);
  console.log(`  Members: ${members.length}`);

  const groupMembers = await fheSplit.getGroupMembers(groupId);
  groupMembers.forEach((member, i) => {
    const userName = member === alice.address ? "Alice" : member === bob.address ? "Bob" : "Charlie";
    console.log(`    ${i + 1}. ${userName} (${member})`);
  });

  // ========================================
  // STEP 4: Add Expenses
  // ========================================
  console.log("\n💵 STEP 4: Adding expenses...");

  // Expense 1: Alice paid for pizza (300 total, split equally)
  console.log("\n  📝 Expense 1: Alice paid for pizza - 300 tokens split 3 ways");
  const expense1Members = [alice.address, bob.address, charlie.address];
  const expense1Shares = [100000000n, 100000000n, 100000000n]; // 100 each

  const encrypted1Shares = [];
  const proofs1 = [];
  for (const share of expense1Shares) {
    const encrypted = await fhevm
      .createEncryptedInput(fheSplitDeployment.address, deployer.address)
      .add64(share)
      .encrypt();
    encrypted1Shares.push(encrypted.handles[0]);
    proofs1.push(encrypted.inputProof);
  }

  await fheSplit
    .connect(deployer)
    .addExpense(groupId, alice.address, expense1Members, encrypted1Shares, proofs1, "Pizza night 🍕");

  console.log(`  ✅ Added: Pizza night`);
  console.log(`     Payer: Alice`);
  console.log(`     Alice owes: 100`);
  console.log(`     Bob owes: 100`);
  console.log(`     Charlie owes: 100`);

  // Expense 2: Bob paid for groceries (180 total, split equally)
  console.log("\n  📝 Expense 2: Bob paid for groceries - 180 tokens split 3 ways");
  const expense2Members = [alice.address, bob.address, charlie.address];
  const expense2Shares = [60000000n, 60000000n, 60000000n]; // 60 each

  const encrypted2Shares = [];
  const proofs2 = [];
  for (const share of expense2Shares) {
    const encrypted = await fhevm
      .createEncryptedInput(fheSplitDeployment.address, deployer.address)
      .add64(share)
      .encrypt();
    encrypted2Shares.push(encrypted.handles[0]);
    proofs2.push(encrypted.inputProof);
  }

  await fheSplit
    .connect(deployer)
    .addExpense(groupId, bob.address, expense2Members, encrypted2Shares, proofs2, "Groceries 🛒");

  console.log(`  ✅ Added: Groceries`);
  console.log(`     Payer: Bob`);
  console.log(`     Alice owes: 60`);
  console.log(`     Bob owes: 60`);
  console.log(`     Charlie owes: 60`);

  // ========================================
  // STEP 5: Query Debts
  // ========================================
  console.log("\n📊 STEP 5: Current debts in group...");

  async function showDebt(debtor: any, creditor: any, debtorName: string, creditorName: string) {
    const encryptedOwed = await fheSplit.getNetOwedInGroup(groupId, debtor.address, creditor.address);
    if (encryptedOwed === ethers.ZeroHash) {
      console.log(`  ${debtorName} owes ${creditorName}: 0`);
      return 0;
    }
    const clearOwed = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedOwed,
      fheSplitDeployment.address,
      debtor
    );
    const amount = (Number(clearOwed) / 1000000).toFixed(2);
    console.log(`  ${debtorName} owes ${creditorName}: ${amount} tokens`);
    return Number(clearOwed);
  }

  console.log("\n  Alice's debts:");
  await showDebt(alice, bob, "Alice", "Bob");

  console.log("\n  Bob's debts:");
  await showDebt(bob, alice, "Bob", "Alice");

  console.log("\n  Charlie's debts:");
  await showDebt(charlie, alice, "Charlie", "Alice");
  await showDebt(charlie, bob, "Charlie", "Bob");

  // ========================================
  // STEP 6: Auto-Settling Transfers
  // ========================================
  console.log("\n💸 STEP 6: Making auto-settling transfers...");

  // Bob transfers 100 to Alice (should settle Bob's 100 debt to Alice completely)
  console.log("\n  📤 Bob transfers 100 tokens to Alice...");
  const bobToAliceAmount = 100000000n;
  const encryptedBobTransfer = await fhevm
    .createEncryptedInput(fheSplitDeployment.address, bob.address)
    .add64(bobToAliceAmount)
    .encrypt();

  await fheSplit
    .connect(bob)
    .privateTransferInGroup(groupId, alice.address, encryptedBobTransfer.handles[0], encryptedBobTransfer.inputProof);

  console.log(`  ✅ Transfer complete (with auto-settlement)`);

  // Check Bob's debt after transfer
  const bobDebtAfter = await showDebt(bob, alice, "Bob", "Alice");

  // Charlie transfers 80 to Alice
  console.log("\n  📤 Charlie transfers 80 tokens to Alice...");
  const charlieToAliceAmount = 80000000n;
  const encryptedCharlieTransfer = await fhevm
    .createEncryptedInput(fheSplitDeployment.address, charlie.address)
    .add64(charlieToAliceAmount)
    .encrypt();

  await fheSplit
    .connect(charlie)
    .privateTransferInGroup(
      groupId,
      alice.address,
      encryptedCharlieTransfer.handles[0],
      encryptedCharlieTransfer.inputProof
    );

  console.log(`  ✅ Transfer complete (with auto-settlement)`);

  // Check Charlie's remaining debt
  const charlieDebtAfter = await showDebt(charlie, alice, "Charlie", "Alice");

  // ========================================
  // STEP 7: Final Balances
  // ========================================
  console.log("\n💰 STEP 7: Final platform balances...");

  for (const user of users) {
    const encryptedBalance = await fheSplit.getPlatformBalance(user.signer.address);
    const clearBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      fheSplitDeployment.address,
      user.signer
    );
    const balance = (Number(clearBalance) / 1000000).toFixed(2);
    console.log(`  ${user.name}: ${balance} tokens`);
  }

  // ========================================
  // STEP 8: Final Debt Summary
  // ========================================
  console.log("\n📊 STEP 8: Final debt summary...");

  console.log("\n  Remaining debts in group:");
  const aliceToBob = await showDebt(alice, bob, "Alice", "Bob");
  const bobToAlice = await showDebt(bob, alice, "Bob", "Alice");
  const charlieToAlice = await showDebt(charlie, alice, "Charlie", "Alice");
  const charlieToBob = await showDebt(charlie, bob, "Charlie", "Bob");

  console.log("\n  Debt Statistics:");
  console.log(`    Total debts settled: ${(100 + 80) / 1} tokens`);
  console.log(`    Bob's remaining debt to Alice: ${(bobToAlice / 1000000).toFixed(2)} tokens`);
  console.log(`    Charlie's remaining debt to Alice: ${(charlieToAlice / 1000000).toFixed(2)} tokens`);
  console.log(`    Charlie's remaining debt to Bob: ${(charlieToBob / 1000000).toFixed(2)} tokens`);

  // ========================================
  // STEP 9: Expense Summary
  // ========================================
  console.log("\n📋 STEP 9: Expense summary...");

  const expenseIds = await fheSplit.getGroupExpenses(groupId);
  console.log(`\n  Total expenses: ${expenseIds.length}`);

  for (let i = 0; i < expenseIds.length; i++) {
    const expense = await fheSplit.getExpense(expenseIds[i]);
    const payerName = expense.payer === alice.address ? "Alice" : expense.payer === bob.address ? "Bob" : "Charlie";
    console.log(`\n  Expense ${i + 1}:`);
    console.log(`    Description: ${expense.description}`);
    console.log(`    Payer: ${payerName}`);
    console.log(`    Created: ${new Date(Number(expense.createdAt) * 1000).toLocaleString()}`);
  }

  // ========================================
  // Summary
  // ========================================
  console.log("\n========================================");
  console.log("   ✅ Demo Complete!");
  console.log("========================================");
  console.log("\n🎉 Successfully demonstrated:");
  console.log("  ✓ Token wrapping (ERC20 → cToken)");
  console.log("  ✓ Platform deposits with encryption");
  console.log("  ✓ Group creation");
  console.log("  ✓ Expense tracking with encrypted shares");
  console.log("  ✓ Auto-settling transfers");
  console.log("  ✓ Debt management");
  console.log("  ✓ Privacy preservation (all amounts encrypted)");
  console.log("\n💡 Key Privacy Features:");
  console.log("  • All balances are encrypted (euint64)");
  console.log("  • All debts are encrypted");
  console.log("  • Only authorized parties can decrypt");
  console.log("  • Group relationships are visible, amounts are private");
  console.log("\n📝 Try the CLI commands:");
  console.log("  npx hardhat list-groups --split", fheSplitDeployment.address);
  console.log("  npx hardhat platform-balance --split", fheSplitDeployment.address, "--user 1");
  console.log("  npx hardhat get-creditors --split", fheSplitDeployment.address, "--group 1 --user 2");
  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
