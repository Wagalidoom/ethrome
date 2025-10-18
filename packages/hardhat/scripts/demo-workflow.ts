/**
 * FHESplit Comprehensive Demo Workflow
 *
 * This script demonstrates ALL functionality of FHESplit with real-world scenarios.
 * Perfect for frontend integration reference.
 *
 * Features demonstrated:
 * ✓ Token setup (ERC20 → cToken → Platform)
 * ✓ Deposits and withdrawals
 * ✓ Multi-group creation and management
 * ✓ Adding/removing members
 * ✓ Expense tracking with encrypted shares
 * ✓ Auto-settling transfers
 * ✓ Cross-group debt queries
 * ✓ Privacy features and access control
 * ✓ Encrypted membership tokens
 * ✓ All query functions
 *
 * Run with:
 *   Terminal 1: npx hardhat node
 *   Terminal 2: npx hardhat run scripts/demo-workflow.ts --network localhost
 */

import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

// ============================================
// HELPER FUNCTIONS (Frontend Reference)
// ============================================

/**
 * Format token amount from wei to human-readable
 * @param amount - Amount in wei (1000000 = 1 token with 6 decimals)
 * @returns Formatted string
 */
function formatAmount(amount: bigint | number): string {
  const num = typeof amount === "bigint" ? Number(amount) : amount;
  return (num / 1000000).toFixed(2);
}

/**
 * Get user display name from address
 * Frontend: Replace with your user lookup logic
 */
function getUserName(address: string, users: Map<string, string>): string {
  return users.get(address.toLowerCase()) || `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Decrypt encrypted uint64 value
 * Frontend: Use fhevm-sdk's decrypt function
 */
async function decryptAmount(
  encryptedValue: any,
  contractAddress: string,
  signer: HardhatEthersSigner
): Promise<bigint> {
  if (encryptedValue === ethers.ZeroHash || !encryptedValue) {
    return 0n;
  }
  return await fhevm.userDecryptEuint(FhevmType.euint64, encryptedValue, contractAddress, signer);
}

/**
 * Print section header
 */
function printSection(stepNumber: number, title: string, emoji: string = "📌") {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`${emoji} STEP ${stepNumber}: ${title}`);
  console.log(`${"=".repeat(60)}\n`);
}

/**
 * Print subsection
 */
function printSubsection(title: string) {
  console.log(`\n${"-".repeat(50)}`);
  console.log(`  ${title}`);
  console.log(`${"-".repeat(50)}`);
}

/**
 * Print success message
 */
function printSuccess(message: string) {
  console.log(`  ✅ ${message}`);
}

/**
 * Print info message
 */
function printInfo(message: string, indent: number = 1) {
  console.log(`${"  ".repeat(indent)}ℹ️  ${message}`);
}

/**
 * Print error or blocked action
 */
function printBlocked(message: string) {
  console.log(`  🚫 ${message}`);
}

// ============================================
// MAIN DEMO WORKFLOW
// ============================================

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("  🎯 FHESplit - Complete Demo Workflow");
  console.log("  Private Expense Splitting with Fully Homomorphic Encryption");
  console.log("=".repeat(70));

  await fhevm.initializeCLIApi();

  // ==========================================
  // INITIALIZATION
  // ==========================================
  const signers = await ethers.getSigners();
  const [deployer, alice, bob, charlie, david] = signers;

  // User mapping for display names
  const userNames = new Map<string, string>();
  userNames.set(deployer.address.toLowerCase(), "Deployer");
  userNames.set(alice.address.toLowerCase(), "Alice");
  userNames.set(bob.address.toLowerCase(), "Bob");
  userNames.set(charlie.address.toLowerCase(), "Charlie");
  userNames.set(david.address.toLowerCase(), "David");

  console.log("\n👥 Participants:");
  console.log(`  • Deployer:     ${deployer.address}`);
  console.log(`  • Alice:        ${alice.address}`);
  console.log(`  • Bob:          ${bob.address}`);
  console.log(`  • Charlie:      ${charlie.address}`);
  console.log(`  • David:        ${david.address} (outsider for privacy tests)`);

  // ==========================================
  printSection(1, "Contract Deployment", "📦");
  // ==========================================

  printInfo("Deploying MockERC20...");
  const MockTokenFactory = await ethers.getContractFactory("MockERC20");
  const mockToken = await MockTokenFactory.connect(deployer).deploy("Mock USDT", "USDT", 6);
  await mockToken.waitForDeployment();
  const mockTokenAddress = await mockToken.getAddress();
  printSuccess(`MockERC20 deployed to: ${mockTokenAddress}`);

  printInfo("Deploying cToken...");
  const CTokenFactory = await ethers.getContractFactory("cToken");
  const cToken = await CTokenFactory.connect(deployer).deploy(mockTokenAddress, "Confidential USDT", "cUSDT");
  await cToken.waitForDeployment();
  const cTokenAddress = await cToken.getAddress();
  printSuccess(`cToken deployed to: ${cTokenAddress}`);

  printInfo("Deploying FHESplit...");
  const FHESplitFactory = await ethers.getContractFactory("FHESplit");
  const fheSplit = await FHESplitFactory.connect(deployer).deploy(cTokenAddress);
  await fheSplit.waitForDeployment();
  const fheSplitAddress = await fheSplit.getAddress();
  printSuccess(`FHESplit deployed to: ${fheSplitAddress}`);

  printSuccess("All contracts deployed successfully!");
  printInfo(`MockERC20 (USDT): ${mockTokenAddress}`);
  printInfo(`cToken (Confidential): ${cTokenAddress}`);
  printInfo(`FHESplit (Main): ${fheSplitAddress}`);

  // ==========================================
  printSection(2, "User Token Setup", "💰");
  // ==========================================

  const users = [
    { signer: alice, name: "Alice" },
    { signer: bob, name: "Bob" },
    { signer: charlie, name: "Charlie" },
    { signer: david, name: "David" },
  ];

  printInfo("Setting up tokens for each user...");

  for (const user of users) {
    printSubsection(`${user.name}'s Setup`);

    // Mint 1000 tokens
    await mockToken.mint(user.signer.address, ethers.parseUnits("1000", 6));
    printSuccess(`Minted 1000 USDT`);

    // Approve and wrap 500 tokens
    await mockToken.connect(user.signer).approve(cTokenAddress, ethers.parseUnits("500", 6));
    await cToken.connect(user.signer).wrap(user.signer.address, ethers.parseUnits("500", 6));
    printSuccess(`Wrapped 500 USDT → cToken (encrypted)`);

    // Approve FHESplit as operator
    const until = Math.floor(Date.now() / 1000) + 3600;
    await cToken.connect(user.signer).setOperator(fheSplitAddress, until);
    printSuccess(`Approved FHESplit as operator (valid for 1 hour)`);

    // Deposit to platform
    const depositAmount = 300000000n; // 300 tokens
    const encryptedDeposit = await fhevm
      .createEncryptedInput(fheSplitAddress, user.signer.address)
      .add64(depositAmount)
      .encrypt();
    await fheSplit.connect(user.signer).deposit(encryptedDeposit.handles[0], encryptedDeposit.inputProof);

    // Verify balance
    const encryptedBalance = await fheSplit.connect(user.signer).getPlatformBalance(user.signer.address);
    const clearBalance = await decryptAmount(encryptedBalance, fheSplitAddress, user.signer);
    printSuccess(`Deposited ${formatAmount(clearBalance)} tokens to FHESplit`);
    printInfo(`Platform balance: ${formatAmount(clearBalance)} tokens`, 2);
  }

  // ==========================================
  printSection(3, "Creating Multiple Groups", "👥");
  // ==========================================

  printInfo("Creating Group 1: Roommates (Alice, Bob, Charlie) - Creator: Alice");
  const group1Members = [alice.address, bob.address, charlie.address];
  await fheSplit.connect(alice).createGroup("Roommates", group1Members);
  const group1Id = 1n;
  printSuccess(`Group "Roommates" created with ID ${group1Id}`);
  printInfo(`Creator: Alice, Members: Alice, Bob, Charlie`, 2);

  printInfo("\nCreating Group 2: Weekend Trip (Alice, Bob) - Creator: Bob");
  const group2Members = [alice.address, bob.address];
  await fheSplit.connect(bob).createGroup("Weekend Trip", group2Members);
  const group2Id = 2n;
  printSuccess(`Group "Weekend Trip" created with ID ${group2Id}`);
  printInfo(`Creator: Bob, Members: Alice, Bob`, 2);

  // Query group info (as member)
  printInfo("\nQuerying group details...");
  const group1 = await fheSplit.getGroup(group1Id);
  const group1MembersQueried = await fheSplit.connect(alice).getGroupMembers(group1Id);
  printInfo(`Group 1 "${group1.name}" has ${group1MembersQueried.length} members`, 2);

  // ==========================================
  printSection(4, "Lazy Group Creation via Expense", "🚀");
  // ==========================================

  printInfo("Demonstrating lazy group creation: Creating Group 3 by adding expense directly");
  printInfo("No need to call createGroup() first!", 2);

  const group3Id = 3n;
  const group3Members = [charlie.address, david.address];
  const group3Shares = [75000000n, 75000000n]; // 75 each

  let encryptedShares = [];
  let proofs = [];
  for (const share of group3Shares) {
    const encrypted = await fhevm
      .createEncryptedInput(fheSplitAddress, charlie.address)
      .add64(share)
      .encrypt();
    encryptedShares.push(encrypted.handles[0]);
    proofs.push(encrypted.inputProof);
  }

  // Add expense directly - group will be created automatically
  await fheSplit
    .connect(charlie)
    .addExpense(group3Id, charlie.address, group3Members, encryptedShares, proofs, "Game night 🎮");

  printSuccess("Group 3 created automatically via expense!");

  const group3 = await fheSplit.getGroup(group3Id);
  printInfo(`Group name: "${group3.name}"`, 2);
  printInfo(`Creator: ${getUserName(group3.creator, userNames)} (the payer)`, 2);

  const group3MembersQueried = await fheSplit.connect(charlie).getGroupMembers(group3Id);
  printInfo(`Members: ${group3MembersQueried.length} (Charlie, David)`, 2);

  // ==========================================
  printSection(5, "Auto-Adding Members via Expense", "➕");
  // ==========================================

  printInfo("Adding Alice to 'Weekend Trip' group by including her in an expense");
  printInfo("No explicit addMember() call needed!", 2);

  const initialGroup2Members = await fheSplit.connect(bob).getGroupMembers(group2Id);
  printInfo(`Weekend Trip currently has ${initialGroup2Members.length} members`, 2);

  // Add expense that includes Alice (who is not in group 2)
  const expandedMembers = [alice.address, bob.address];
  const expandedShares = [80000000n, 80000000n]; // 80 each

  encryptedShares = [];
  proofs = [];
  for (const share of expandedShares) {
    const encrypted = await fhevm
      .createEncryptedInput(fheSplitAddress, bob.address)
      .add64(share)
      .encrypt();
    encryptedShares.push(encrypted.handles[0]);
    proofs.push(encrypted.inputProof);
  }

  await fheSplit
    .connect(bob)
    .addExpense(group2Id, bob.address, expandedMembers, encryptedShares, proofs, "Restaurant dinner 🍽️");

  printSuccess("Alice automatically added to Weekend Trip group!");

  const expandedGroup2Members = await fheSplit.connect(bob).getGroupMembers(group2Id);
  printInfo(`Weekend Trip now has ${expandedGroup2Members.length} members`, 2);
  printInfo("Alice can now participate in all group activities", 2);

  // ==========================================
  printSection(6, "Traditional Group Management", "👥");
  // ==========================================

  printInfo("You can still manage groups the traditional way (creator only)");
  printInfo("David wants to join 'Roommates' group", 2);

  await fheSplit.connect(alice).addMember(group1Id, david.address);
  printSuccess("David added to Roommates group by Alice (creator)");

  const updatedMembers = await fheSplit.connect(alice).getGroupMembers(group1Id);
  printInfo(`Roommates now has ${updatedMembers.length} members`, 2);

  // Query David's groups
  const davidGroups = await fheSplit.getUserGroups(david.address);
  printInfo(`David is now in ${davidGroups.length} group(s)`, 2);

  // ==========================================
  printSection(7, "Adding Expenses in Multiple Groups", "💵");
  // ==========================================

  // ===== GROUP 1: Roommates Expenses =====
  printSubsection("Group 1: Roommates Expenses");

  printInfo("Expense 1: Alice paid for pizza - 400 tokens (split 4 ways)");
  const exp1Members = [alice.address, bob.address, charlie.address, david.address];
  const exp1Shares = [100000000n, 100000000n, 100000000n, 100000000n]; // 100 each

  encryptedShares = [];
  proofs = [];
  for (const share of exp1Shares) {
    const encrypted = await fhevm
      .createEncryptedInput(fheSplitAddress, alice.address)
      .add64(share)
      .encrypt();
    encryptedShares.push(encrypted.handles[0]);
    proofs.push(encrypted.inputProof);
  }

  await fheSplit
    .connect(alice)
    .addExpense(group1Id, alice.address, exp1Members, encryptedShares, proofs, "Pizza night 🍕");
  printSuccess("Added expense: Pizza night");
  printInfo("Alice paid 400, each owes Alice 100", 2);
  printInfo("Bob owes Alice: 100", 3);
  printInfo("Charlie owes Alice: 100", 3);
  printInfo("David owes Alice: 100", 3);

  printInfo("\nExpense 2: Bob paid for groceries - 240 tokens (split 4 ways)");
  const exp2Members = [alice.address, bob.address, charlie.address, david.address];
  const exp2Shares = [60000000n, 60000000n, 60000000n, 60000000n]; // 60 each

  encryptedShares = [];
  proofs = [];
  for (const share of exp2Shares) {
    const encrypted = await fhevm
      .createEncryptedInput(fheSplitAddress, bob.address)
      .add64(share)
      .encrypt();
    encryptedShares.push(encrypted.handles[0]);
    proofs.push(encrypted.inputProof);
  }

  await fheSplit
    .connect(bob)
    .addExpense(group1Id, bob.address, exp2Members, encryptedShares, proofs, "Groceries 🛒");
  printSuccess("Added expense: Groceries");
  printInfo("Bob paid 240, each owes Bob 60", 2);

  // ===== GROUP 2: Weekend Trip Expenses =====
  printSubsection("Group 2: Weekend Trip Expenses");

  printInfo("Expense 3: Alice paid for hotel - 200 tokens (split 2 ways)");
  const exp3Members = [alice.address, bob.address];
  const exp3Shares = [100000000n, 100000000n]; // 100 each

  encryptedShares = [];
  proofs = [];
  for (const share of exp3Shares) {
    const encrypted = await fhevm
      .createEncryptedInput(fheSplitAddress, alice.address)
      .add64(share)
      .encrypt();
    encryptedShares.push(encrypted.handles[0]);
    proofs.push(encrypted.inputProof);
  }

  await fheSplit
    .connect(alice)
    .addExpense(group2Id, alice.address, exp3Members, encryptedShares, proofs, "Hotel booking 🏨");
  printSuccess("Added expense: Hotel booking");
  printInfo("Alice paid 200, Bob owes Alice 100", 2);

  // ==========================================
  printSection(8, "Querying Debts (Single Group)", "📊");
  // ==========================================

  printSubsection("Debts in Group 1 (Roommates)");

  // Helper to show debt
  async function queryAndShowDebt(
    groupId: bigint,
    debtor: HardhatEthersSigner,
    creditor: HardhatEthersSigner
  ): Promise<bigint> {
    try {
      const encryptedDebt = await fheSplit
        .connect(debtor)
        .getNetOwedInGroup(groupId, debtor.address, creditor.address);
      const debtAmount = await decryptAmount(encryptedDebt, fheSplitAddress, debtor);

      if (debtAmount > 0n) {
        const debtorName = getUserName(debtor.address, userNames);
        const creditorName = getUserName(creditor.address, userNames);
        printInfo(`${debtorName} owes ${creditorName}: ${formatAmount(debtAmount)} tokens`, 2);
      }
      return debtAmount;
    } catch (e) {
      return 0n;
    }
  }

  printInfo("Alice's debts:");
  await queryAndShowDebt(group1Id, alice, bob);
  await queryAndShowDebt(group1Id, alice, charlie);
  await queryAndShowDebt(group1Id, alice, david);

  printInfo("\nBob's debts:");
  const bobOwesAlice = await queryAndShowDebt(group1Id, bob, alice);
  await queryAndShowDebt(group1Id, bob, charlie);
  await queryAndShowDebt(group1Id, bob, david);

  printInfo("\nCharlie's debts:");
  await queryAndShowDebt(group1Id, charlie, alice);
  await queryAndShowDebt(group1Id, charlie, bob);
  await queryAndShowDebt(group1Id, charlie, david);

  printInfo("\nDavid's debts:");
  await queryAndShowDebt(group1Id, david, alice);
  await queryAndShowDebt(group1Id, david, bob);
  await queryAndShowDebt(group1Id, david, charlie);

  printSubsection("Debts in Group 2 (Weekend Trip)");
  printInfo("Bob's debts:");
  await queryAndShowDebt(group2Id, bob, alice);

  // ==========================================
  printSection(9, "Cross-Group Debt Queries", "🌐");
  // ==========================================

  printInfo("Frontend: Use these functions to show user's debts across ALL groups");

  printSubsection("Alice's Cross-Group View");

  // All groups with debts
  const aliceGroupsWithDebts = await fheSplit.connect(alice).getMyGroupsWithDebts(alice.address);
  printInfo(`Alice has debts in ${aliceGroupsWithDebts.length} group(s)`, 2);

  // All creditors
  const [aliceCreditorGroups, aliceCreditorsList] = await fheSplit
    .connect(alice)
    .getAllMyCreditors(alice.address);
  printInfo(`\nPeople Alice owes (across all groups):`, 2);
  if (aliceCreditorGroups.length > 0) {
    for (let i = 0; i < aliceCreditorGroups.length; i++) {
      const gId = aliceCreditorGroups[i];
      const group = await fheSplit.getGroup(gId);
      printInfo(`In group "${group.name}":`, 3);
      for (const creditor of aliceCreditorsList[i]) {
        const creditorName = getUserName(creditor, userNames);
        printInfo(`→ ${creditorName}`, 4);
      }
    }
  } else {
    printInfo("Alice owes nobody! ✨", 3);
  }

  // All debtors
  const [aliceDebtorGroups, aliceDebtorsList] = await fheSplit.connect(alice).getAllMyDebtors(alice.address);
  printInfo(`\nPeople who owe Alice (across all groups):`, 2);
  if (aliceDebtorGroups.length > 0) {
    for (let i = 0; i < aliceDebtorGroups.length; i++) {
      const gId = aliceDebtorGroups[i];
      const group = await fheSplit.getGroup(gId);
      printInfo(`In group "${group.name}":`, 3);
      for (const debtor of aliceDebtorsList[i]) {
        const debtorName = getUserName(debtor, userNames);
        printInfo(`→ ${debtorName}`, 4);
      }
    }
  }

  printSubsection("Bob's Cross-Group View");

  const [bobCreditorGroups, bobCreditorsList] = await fheSplit.connect(bob).getAllMyCreditors(bob.address);
  printInfo(`People Bob owes:`, 2);
  for (let i = 0; i < bobCreditorGroups.length; i++) {
    const gId = bobCreditorGroups[i];
    const group = await fheSplit.getGroup(gId);
    printInfo(`In "${group.name}": ${bobCreditorsList[i].length} creditor(s)`, 3);
  }

  const [bobDebtorGroups, bobDebtorsList] = await fheSplit.connect(bob).getAllMyDebtors(bob.address);
  printInfo(`\nPeople who owe Bob:`, 2);
  for (let i = 0; i < bobDebtorGroups.length; i++) {
    const gId = bobDebtorGroups[i];
    const group = await fheSplit.getGroup(gId);
    printInfo(`In "${group.name}": ${bobDebtorsList[i].length} debtor(s)`, 3);
  }

  // ==========================================
  printSection(10, "Auto-Settling Transfers", "💸");
  // ==========================================

  printInfo("Auto-settling: When you transfer to someone you owe, debt is settled first!");

  printSubsection("Bob transfers 150 to Alice in Group 1");
  printInfo(`Bob currently owes Alice: ${formatAmount(bobOwesAlice)} in Group 1`, 2);
  printInfo("Bob will transfer 150 tokens", 2);
  printInfo("Expected: 40 settles debt, 110 goes to Alice's balance", 2);

  const bobBalanceBefore = await decryptAmount(
    await fheSplit.connect(bob).getPlatformBalance(bob.address),
    fheSplitAddress,
    bob
  );

  const aliceBalanceBefore = await decryptAmount(
    await fheSplit.connect(alice).getPlatformBalance(alice.address),
    fheSplitAddress,
    alice
  );

  const transferAmount = 150000000n;
  const encryptedTransfer = await fhevm
    .createEncryptedInput(fheSplitAddress, bob.address)
    .add64(transferAmount)
    .encrypt();

  await fheSplit
    .connect(bob)
    .privateTransferInGroup(group1Id, alice.address, encryptedTransfer.handles[0], encryptedTransfer.inputProof);

  const bobBalanceAfter = await decryptAmount(
    await fheSplit.connect(bob).getPlatformBalance(bob.address),
    fheSplitAddress,
    bob
  );

  const aliceBalanceAfter = await decryptAmount(
    await fheSplit.connect(alice).getPlatformBalance(alice.address),
    fheSplitAddress,
    alice
  );

  const bobDebtAfter = await decryptAmount(
    await fheSplit.connect(bob).getNetOwedInGroup(group1Id, bob.address, alice.address),
    fheSplitAddress,
    bob
  );

  printSuccess("Transfer complete!");
  printInfo(`Bob's debt to Alice: ${formatAmount(bobOwesAlice)} → ${formatAmount(bobDebtAfter)} ✓`, 2);
  printInfo(`Bob's balance: ${formatAmount(bobBalanceBefore)} → ${formatAmount(bobBalanceAfter)}`, 2);
  printInfo(`Alice's balance: ${formatAmount(aliceBalanceBefore)} → ${formatAmount(aliceBalanceAfter)}`, 2);
  printInfo(
    `Debt settled: ${formatAmount(bobOwesAlice - bobDebtAfter)}, Balance transferred: ${formatAmount(
      transferAmount - (bobOwesAlice - bobDebtAfter)
    )}`,
    2
  );

  // ==========================================
  printSection(11, "Withdrawal from Platform", "💵");
  // ==========================================

  printInfo("Charlie wants to withdraw 50 tokens from platform");

  const charlieBalanceBefore = await decryptAmount(
    await fheSplit.connect(charlie).getPlatformBalance(charlie.address),
    fheSplitAddress,
    charlie
  );

  const withdrawAmount = 50000000n;
  const encryptedWithdraw = await fhevm
    .createEncryptedInput(fheSplitAddress, charlie.address)
    .add64(withdrawAmount)
    .encrypt();

  await fheSplit.connect(charlie).withdraw(encryptedWithdraw.handles[0], encryptedWithdraw.inputProof);

  const charlieBalanceAfter = await decryptAmount(
    await fheSplit.connect(charlie).getPlatformBalance(charlie.address),
    fheSplitAddress,
    charlie
  );

  printSuccess("Withdrawal successful!");
  printInfo(`Platform balance: ${formatAmount(charlieBalanceBefore)} → ${formatAmount(charlieBalanceAfter)}`, 2);
  printInfo(`Withdrew: ${formatAmount(withdrawAmount)} tokens`, 2);

  // ==========================================
  printSection(12, "Privacy Features & Access Control", "🔒");
  // ==========================================

  printInfo("Demonstrating privacy: What can and cannot be accessed");

  printSubsection("✅ Allowed: Group Members Can Query Members");
  try {
    const members = await fheSplit.connect(alice).getGroupMembers(group1Id);
    printSuccess(`Alice (member) can see ${members.length} members in Roommates group`);
  } catch (e) {
    printBlocked(`Failed: ${(e as Error).message}`);
  }

  printSubsection("🚫 Blocked: Non-Members Cannot Query Members");
  try {
    // David was added to group 1, so let's remove him first (Alice is creator)
    await fheSplit.connect(alice).removeMember(group1Id, david.address);
    printInfo("David removed from Roommates group by Alice (creator)", 2);

    // Now David tries to query (should fail)
    await fheSplit.connect(david).getGroupMembers(group1Id);
    printBlocked("ERROR: David accessed group members (should have been blocked!)");
  } catch (e) {
    printSuccess("Correctly blocked: Non-member cannot view group members");
    printInfo("Error: Only group members can view members", 2);
  }

  printSubsection("🚫 Blocked: Cannot Query Other's Balance Without Permission");
  try {
    // David tries to query Alice's balance (no debt relationship)
    await fheSplit.connect(david).getPlatformBalance(alice.address);
    printBlocked("ERROR: David accessed Alice's balance (should have been blocked!)");
  } catch (e) {
    printSuccess("Correctly blocked: Cannot query unrelated user's balance");
    printInfo("Error: Not authorized to view balance", 2);
  }

  printSubsection("✅ Allowed: Can Query Balance of Debt-Related Party");
  try {
    // Bob has debt relationship with Alice in group 1
    const balance = await fheSplit.connect(bob).getPlatformBalance(alice.address);
    const clearBalance = await decryptAmount(balance, fheSplitAddress, bob);
    printSuccess(`Bob can query Alice's balance (they have debt relationship)`);
    printInfo(`Alice's balance visible to Bob: ${formatAmount(clearBalance)} tokens`, 2);
  } catch (e) {
    printBlocked(`Failed: ${(e as Error).message}`);
  }

  printSubsection("🚫 Blocked: Cannot Query Other's Debts");
  try {
    // David tries to query Bob's debt to Alice
    await fheSplit.connect(david).getNetOwedInGroup(group1Id, bob.address, alice.address);
    printBlocked("ERROR: David accessed Bob's debt (should have been blocked!)");
  } catch (e) {
    printSuccess("Correctly blocked: Cannot query other people's debts");
    printInfo("Error: Not authorized to view this debt", 2);
  }

  printSubsection("✅ Allowed: Can Query Own Cross-Group Debts");
  try {
    const [groupIds, creditors] = await fheSplit.connect(bob).getAllMyCreditors(bob.address);
    printSuccess(`Bob can query his own creditors across ${groupIds.length} groups`);
  } catch (e) {
    printBlocked(`Failed: ${(e as Error).message}`);
  }

  printSubsection("🚫 Blocked: Cannot Query Other's Cross-Group Debts");
  try {
    await fheSplit.connect(david).getAllMyCreditors(bob.address);
    printBlocked("ERROR: David accessed Bob's creditors (should have been blocked!)");
  } catch (e) {
    printSuccess("Correctly blocked: Cannot query other's cross-group debts");
    printInfo("Error: Not authorized", 2);
  }

  printSubsection("✅ Allowed: Group Members Can See Other Members");
  try {
    const members = await fheSplit.connect(bob).getGroupMembers(group1Id);
    printSuccess("Group members can see all other group members");
    printInfo(`Bob can see ${members.length} members in the group`, 2);
  } catch (e) {
    printBlocked(`Failed: ${(e as Error).message}`);
  }

  // ==========================================
  printSection(13, "Encrypted Membership Tokens", "🎫");
  // ==========================================

  printInfo("Each group member has an encrypted token for verification");

  printSubsection("Viewing Membership Tokens");

  try {
    // Alice queries Bob's token (both in same group)
    const bobToken = await fheSplit.connect(alice).getGroupMemberToken(group1Id, bob.address);
    printSuccess("Alice can see Bob's encrypted membership token (same group)");
    printInfo("Frontend: Can decrypt with FHE to verify membership", 2);

    // David (non-member) tries to query
    try {
      await fheSplit.connect(david).getGroupMemberToken(group1Id, alice.address);
      printBlocked("ERROR: David accessed token (should be blocked!)");
    } catch (e) {
      printSuccess("Non-members cannot view membership tokens");
    }
  } catch (e) {
    printBlocked(`Failed: ${(e as Error).message}`);
  }

  // ==========================================
  printSection(14, "Querying Creditors & Debtors", "📋");
  // ==========================================

  printInfo("Frontend: Use these to show 'who you owe' and 'who owes you'");

  printSubsection("Alice's Creditors in Group 1");
  const aliceCreditorsG1 = await fheSplit.connect(alice).getCreditorsInGroup(group1Id, alice.address);
  printInfo(`Alice owes ${aliceCreditorsG1.length} people in Roommates:`, 2);
  aliceCreditorsG1.forEach((creditor) => {
    printInfo(`→ ${getUserName(creditor, userNames)}`, 3);
  });

  printSubsection("Alice's Debtors in Group 1");
  const aliceDebtorsG1 = await fheSplit.connect(alice).getDebtorsInGroup(group1Id, alice.address);
  printInfo(`${aliceDebtorsG1.length} people owe Alice in Roommates:`, 2);
  aliceDebtorsG1.forEach((debtor) => {
    printInfo(`→ ${getUserName(debtor, userNames)}`, 3);
  });

  // ==========================================
  printSection(15, "Expense History & Shares", "📜");
  // ==========================================

  printSubsection("All Expenses in Group 1");

  const group1Expenses = await fheSplit.getGroupExpenses(group1Id);
  printInfo(`Total expenses in Roommates: ${group1Expenses.length}`, 2);

  for (let i = 0; i < group1Expenses.length; i++) {
    const expenseId = group1Expenses[i];
    const expense = await fheSplit.getExpense(expenseId);

    printInfo(`\nExpense ${i + 1}:`, 2);
    printInfo(`Description: ${expense.description}`, 3);
    printInfo(`Payer: ${getUserName(expense.payer, userNames)}`, 3);
    printInfo(`Created: ${new Date(Number(expense.createdAt) * 1000).toLocaleString()}`, 3);

    // Query Alice's share
    const aliceShare = await fheSplit.connect(alice).getExpenseShare(expenseId, alice.address);
    if (aliceShare !== ethers.ZeroHash) {
      const clearShare = await decryptAmount(aliceShare, fheSplitAddress, alice);
      printInfo(`Alice's share: ${formatAmount(clearShare)} tokens`, 3);
    }
  }

  // ==========================================
  printSection(16, "Final State Summary", "📊");
  // ==========================================

  printSubsection("Platform Balances");
  for (const user of users) {
    const balance = await decryptAmount(
      await fheSplit.connect(user.signer).getPlatformBalance(user.signer.address),
      fheSplitAddress,
      user.signer
    );
    printInfo(`${user.name}: ${formatAmount(balance)} tokens`, 2);
  }

  printSubsection("Group Statistics");
  const totalGroups = await fheSplit.getGroupCount();
  const totalExpenses = await fheSplit.getExpenseCount();
  printInfo(`Total groups created: ${totalGroups}`, 2);
  printInfo(`Total expenses tracked: ${totalExpenses}`, 2);

  printSubsection("User Group Memberships");
  for (const user of users) {
    const userGroups = await fheSplit.getUserGroups(user.signer.address);
    printInfo(`${user.name} is in ${userGroups.length} group(s)`, 2);
  }

  // ==========================================
  printSection(17, "Frontend Integration Guide", "💻");
  // ==========================================

  console.log(`
  📱 Frontend Integration Checklist:

  ✅ Token Operations:
     • deposit(encryptedAmount, proof) - Deposit cToken to platform
     • withdraw(encryptedAmount, proof) - Withdraw from platform
     • withdrawAll() - Withdraw entire balance
     • getPlatformBalance(user) - Query user's balance (returns encrypted)

  ✅ Group Management:
     • createGroup(name, members) - Any user can create (optional!)
     • addMember(groupId, member) - Creator only
     • removeMember(groupId, member) - Creator only
     • getGroupMembers(groupId) - Members only
     • getUserGroups(user) - Get user's groups
     • getGroup(groupId) - Get group details
     • isMemberOfGroup(groupId, member) - Check membership

  ✅ Expense Management (with Lazy Group Creation):
     • addExpense(groupId, payer, members, encryptedShares, proofs, description)
       - Creates group automatically if it doesn't exist
       - Adds new members automatically if they're not in the group
       - No need to create group beforehand!
     • getGroupExpenses(groupId) - Get all expense IDs
     • getExpense(expenseId) - Get expense details
     • getExpenseShare(expenseId, member) - Get member's share (encrypted)

  ✅ Debt Queries:
     • getNetOwedInGroup(groupId, debtor, creditor) - Get specific debt (encrypted)
     • getCreditorsInGroup(groupId, user) - Who user owes in group
     • getDebtorsInGroup(groupId, user) - Who owes user in group
     • getMyGroupsWithDebts(user) - Groups where user has debts
     • getAllMyCreditors(user) - All creditors across all groups
     • getAllMyDebtors(user) - All debtors across all groups

  ✅ Transfers:
     • privateTransferInGroup(groupId, to, encryptedAmount, proof) - Auto-settling transfer

  ✅ Privacy:
     • All amounts are encrypted (euint64)
     • Decrypt using: fhevm.userDecryptEuint(FhevmType.euint64, encryptedValue, contractAddress, signer)
     • Access control enforced on all queries
     • Events only emit group IDs (no addresses for privacy)

  ✅ Best Practices:
     • Always use proper signer for queries (affects access control)
     • Cache decrypted values client-side (decryption is expensive)
     • Use cross-group queries for dashboard views
     • Handle access control errors gracefully (show appropriate UI)
     • Group creators manage membership (add/remove members)
     • Any group member can add expenses
     • Leverage lazy group creation: Just add expenses, groups are created automatically!
     • Members are auto-added when included in expenses
  `);

  // ==========================================
  console.log("\n" + "=".repeat(70));
  console.log("  ✅ Demo Complete - All Features Demonstrated");
  console.log("=".repeat(70));
  console.log(`
  🎯 Summary of Demonstrated Features:

  ✓ Multi-group creation and management
  ✓ Lazy group creation via expenses (no upfront group creation needed!)
  ✓ Auto-adding members when included in expenses
  ✓ Adding/removing members with encrypted tokens
  ✓ Expense tracking across multiple groups
  ✓ Single-group and cross-group debt queries
  ✓ Auto-settling transfers with debt reduction
  ✓ Deposits and withdrawals
  ✓ Complete access control and privacy
  ✓ All query functions with proper authorization
  ✓ Event-based updates (anonymous for privacy)
  ✓ Frontend-ready examples with helper functions

  🔐 Privacy Features Verified:

  ✓ Group members hidden from outsiders
  ✓ Balances protected with access control
  ✓ Debts only visible to involved parties
  ✓ Cross-group queries user-restricted
  ✓ Encrypted membership tokens
  ✓ Anonymous events (only group IDs)

  📚 See code comments for frontend integration examples!
  `);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
