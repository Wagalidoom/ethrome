/**
 * Test FHESplit Get Functions with Decryption
 *
 * This script tests all get functions in FHESplit contract.
 * Uncomment the function you want to test and run the script.
 *
 * Prerequisites:
 * 1. Set MNEMONIC using: npx hardhat vars set MNEMONIC
 * 2. Ensure you have deployed FHESplit contract on Sepolia
 * 3. Update the configuration values below as needed
 *
 * Run with:
 *   npx hardhat run scripts/test-get-functions.ts --network sepolia
 */

import { ethers, fhevm, deployments } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FHESplit } from "../types";

// ============================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================

// OPTION 1: Set private key directly here (NOT RECOMMENDED - use env var instead)
const PRIVATE_KEY_OVERRIDE = ""; // Example: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

// OPTION 2: Will read from environment variable PRIVATE_KEY if not set above
// Run with: PRIVATE_KEY=0xYourKey npx hardhat run scripts/test-get-functions.ts --network sepolia

// Leave empty to auto-load from deployments, or set manually
const CONTRACT_ADDRESS_OVERRIDE = "0xbFBc56979dBfA4514C6560e5E9d33Ff608117ce5"; // New deployment with ACL fix

// Leave empty to use signer address
const USER_ADDRESS = "";

// Update these for specific tests
const GROUP_ID = 2n;
const EXPENSE_ID = 1n;
const DEBTOR_ADDRESS = "0xd4de553ABD6D11d9707CcB6Cc8d520D55010DdCC"; // YOU (the person who owes)
const CREDITOR_ADDRESS = "0x97D2eEb65DA0c37dc0F43FF4691E521673eFADfd"; // PAYER (the person you owe)
const MEMBER_ADDRESS = "0xd4de553ABD6D11d9707CcB6Cc8d520D55010DdCC"; // Set for getExpenseShare test

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Decrypt an encrypted uint64 value
 */
async function decryptAmount(
  encryptedValue: any,
  contractAddress: string,
  signer: HardhatEthersSigner
): Promise<bigint> {
  if (encryptedValue === ethers.ZeroHash || !encryptedValue) {
    return 0n;
  }
  try {
    return await fhevm.userDecryptEuint(FhevmType.euint64, encryptedValue, contractAddress, signer);
  } catch (e) {
    console.log("  ⚠️  Could not decrypt (may not have permission):", (e as Error).message);
    return 0n;
  }
}

/**
 * Format token amount (6 decimals)
 */
function formatAmount(amount: bigint): string {
  return (Number(amount) / 1000000).toFixed(2);
}

/**
 * Format address for display
 */
function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Print section header
 */
function printSection(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60) + "\n");
}

// ============================================
// MAIN TEST FUNCTIONS
// ============================================

async function main() {
  console.log("\n🔍 FHESplit Get Functions Test Suite");
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, `(Chain ID: ${network.chainId})`);

  // Load contract address
  let contractAddress = CONTRACT_ADDRESS_OVERRIDE;
  if (!contractAddress) {
    try {
      const deployment = await deployments.get("FHESplit");
      contractAddress = deployment.address;
      console.log("✅ Auto-loaded contract address from deployment");
    } catch (e) {
      console.error("❌ Could not load deployment. Please set CONTRACT_ADDRESS_OVERRIDE manually.");
      throw e;
    }
  }

  console.log("Contract Address:", contractAddress);

  // Initialize fhevm for Sepolia (chainId 11155111)
  if (network.chainId === 11155111n || network.chainId === 8009n) {
    console.log("🔐 Initializing FHEVM...");
    try {
      await fhevm.initializeCLIApi();
      console.log("✅ FHEVM initialized successfully");
    } catch (e) {
      console.log("⚠️  FHEVM init warning:", (e as Error).message);
    }
  }

  // Get signer from private key
  let signer: HardhatEthersSigner;
  const privateKey = PRIVATE_KEY_OVERRIDE || process.env.PRIVATE_KEY;

  if (privateKey) {
    console.log("✅ Using private key from configuration");
    // Create wallet from private key
    const wallet = new ethers.Wallet(privateKey, ethers.provider);
    signer = wallet as any; // Cast to HardhatEthersSigner for compatibility
  } else {
    console.log("⚠️  No private key found, using default signer from hardhat config");
    [signer] = await ethers.getSigners();
  }

  const signerAddress = await signer.getAddress();
  console.log("Signer Address:", signerAddress);

  // Check balance
  const balance = await ethers.provider.getBalance(signerAddress);
  console.log("Signer Balance:", ethers.formatEther(balance), "ETH");

  // Get contract instance
  const fheSplit = (await ethers.getContractAt("FHESplit", contractAddress)) as FHESplit;

  const userAddr = USER_ADDRESS || signerAddress;

  // ==========================================
  // TEST 1: getPlatformBalance
  // ==========================================
  // printSection("TEST 1: getPlatformBalance");
  // try {
  //   const encryptedBalance = await fheSplit.connect(signer).getPlatformBalance(userAddr);
  //   const balance = await decryptAmount(encryptedBalance, contractAddress, signer);
  //   console.log("✅ User:", formatAddress(userAddr));
  //   console.log("✅ Platform Balance:", formatAmount(balance), "tokens");
  //   console.log("✅ Raw value:", balance.toString());
  // } catch (error) {
  //   console.log("❌ Error:", (error as Error).message);
  // }

  // ==========================================
  // TEST 2: getNetOwedInGroup - DIRECT DEBT CHECK
  // ==========================================
  printSection("TEST 2: getNetOwedInGroup - How Much You Owe");
  try {
    console.log("🔍 Checking debt between:");
    console.log("   Debtor (YOU):", DEBTOR_ADDRESS);
    console.log("   Creditor (PAYER):", CREDITOR_ADDRESS);
    console.log("");

    const encryptedOwed = await fheSplit
      .connect(signer)
      .getNetOwedInGroup(GROUP_ID, DEBTOR_ADDRESS, CREDITOR_ADDRESS);

    console.log("📦 Encrypted debt retrieved:", encryptedOwed !== ethers.ZeroHash);
    console.log("🔓 Attempting to decrypt...");

    const owed = await decryptAmount(encryptedOwed, contractAddress, signer);

    console.log("\n✅ SUCCESS!");
    console.log("✅ Group ID:", GROUP_ID.toString());
    console.log("✅ Debtor (YOU):", formatAddress(DEBTOR_ADDRESS));
    console.log("✅ Creditor (THEM):", formatAddress(CREDITOR_ADDRESS));
    console.log("💰 Amount You Owe:", formatAmount(owed), "tokens");
    console.log("💰 Raw value (wei):", owed.toString());
  } catch (error) {
    console.log("❌ Error:", (error as Error).message);
    console.log("\n💡 This might mean:");
    console.log("   1. ACL permissions weren't set when expense was created");
    console.log("   2. The debt is actually 0 (already settled)");
    console.log("   3. Try checking your expense share instead (TEST 10)");
  }

  // ==========================================
  // TEST 3: getCreditorsInGroup (WITH AMOUNTS!)
  // ==========================================
  printSection("TEST 3: getCreditorsInGroup - Who You Owe & How Much");
  try {
    const creditors = await fheSplit.connect(signer).getCreditorsInGroup(GROUP_ID, userAddr);
    console.log("✅ Group ID:", GROUP_ID.toString());
    console.log("✅ User:", formatAddress(userAddr));
    console.log("✅ Number of Creditors:", creditors.length);

    if (creditors.length > 0) {
      console.log("\n💸 Creditors (people you owe):");

      // Loop through each creditor and get the amount
      for (let i = 0; i < creditors.length; i++) {
        const creditor = creditors[i];

        // Get the encrypted debt amount
        const encryptedOwed = await fheSplit
          .connect(signer)
          .getNetOwedInGroup(GROUP_ID, userAddr, creditor);

        // Decrypt the amount
        const owed = await decryptAmount(encryptedOwed, contractAddress, signer);

        if (owed > 0n) {
          console.log(`  ${i + 1}. ${creditor}`);
          console.log(`     💰 You owe: ${formatAmount(owed)} tokens (${owed.toString()} wei)`);
        } else {
          console.log(`  ${i + 1}. ${creditor} (settled/no debt)`);
        }
      }

      // Calculate total debt
      let totalDebt = 0n;
      for (const creditor of creditors) {
        const encryptedOwed = await fheSplit.connect(signer).getNetOwedInGroup(GROUP_ID, userAddr, creditor);
        const owed = await decryptAmount(encryptedOwed, contractAddress, signer);
        totalDebt += owed;
      }

      console.log("\n📊 Total Debt in this Group:", formatAmount(totalDebt), "tokens");

    } else {
      console.log("✨ No creditors (you don't owe anyone in this group)");
    }
  } catch (error) {
    console.log("❌ Error:", (error as Error).message);
  }

  // ==========================================
  // TEST 4: getDebtorsInGroup
  // ==========================================
  printSection("TEST 4: getDebtorsInGroup - Who Owes You & How Much");
  try {
    const debtors = await fheSplit.connect(signer).getDebtorsInGroup(GROUP_ID, userAddr);
    console.log("✅ Group ID:", GROUP_ID.toString());
    console.log("✅ User:", formatAddress(userAddr));
    console.log("✅ Number of Debtors:", debtors.length);

    if (debtors.length > 0) {
      console.log("\n💰 Debtors (people who owe you):");

      // Loop through each debtor and get the amount
      for (let i = 0; i < debtors.length; i++) {
        const debtor = debtors[i];

        // Get the encrypted debt amount
        const encryptedOwed = await fheSplit
          .connect(signer)
          .getNetOwedInGroup(GROUP_ID, debtor, userAddr);

        // Decrypt the amount
        const owed = await decryptAmount(encryptedOwed, contractAddress, signer);

        if (owed > 0n) {
          console.log(`  ${i + 1}. ${debtor}`);
          console.log(`     💰 Owes you: ${formatAmount(owed)} tokens (${owed.toString()} wei)`);
        } else {
          console.log(`  ${i + 1}. ${debtor} (settled/no debt)`);
        }
      }

      // Calculate total owed to you
      let totalOwedToYou = 0n;
      for (const debtor of debtors) {
        const encryptedOwed = await fheSplit.connect(signer).getNetOwedInGroup(GROUP_ID, debtor, userAddr);
        const owed = await decryptAmount(encryptedOwed, contractAddress, signer);
        totalOwedToYou += owed;
      }

      console.log("\n📊 Total Owed to You in this Group:", formatAmount(totalOwedToYou), "tokens");

    } else {
      console.log("✨ No debtors (nobody owes you in this group)");
    }
  } catch (error) {
    console.log("❌ Error:", (error as Error).message);
  }

  // ==========================================
  // TEST 5: getUserGroups
  // ==========================================
  printSection("TEST 5: getUserGroups");
  try {
    const groups = await fheSplit.getUserGroups(userAddr);
    console.log("✅ User:", formatAddress(userAddr));
    console.log("✅ Number of Groups:", groups.length);
    if (groups.length > 0) {
      console.log("\n📋 Group IDs:");
      groups.forEach((groupId, i) => {
        console.log(`  ${i + 1}. Group #${groupId.toString()}`);
      });
    } else {
      console.log("  User is not in any groups");
    }
  } catch (error) {
    console.log("❌ Error:", (error as Error).message);
  }

  // ==========================================
  // TEST 6: getGroup
  // ==========================================
  // printSection("TEST 6: getGroup");
  // try {
  //   const group = await fheSplit.getGroup(GROUP_ID);
  //   console.log("✅ Group ID:", group.id.toString());
  //   console.log("✅ Name:", group.name);
  //   console.log("✅ Creator:", group.creator);
  //   console.log("✅ Created At:", new Date(Number(group.createdAt) * 1000).toLocaleString());
  //   console.log("✅ Exists:", group.exists);
  // } catch (error) {
  //   console.log("❌ Error:", (error as Error).message);
  // }

  // ==========================================
  // TEST 7: getGroupMembers
  // ==========================================
  // printSection("TEST 7: getGroupMembers");
  // try {
  //   const members = await fheSplit.connect(signer).getGroupMembers(GROUP_ID);
  //   console.log("✅ Group ID:", GROUP_ID.toString());
  //   console.log("✅ Number of Members:", members.length);
  //   if (members.length > 0) {
  //     console.log("\n📋 Members:");
  //     members.forEach((member, i) => {
  //       console.log(`  ${i + 1}. ${member}`);
  //     });
  //   }
  // } catch (error) {
  //   console.log("❌ Error:", (error as Error).message);
  // }

  // ==========================================
  // TEST 8: getGroupExpenses
  // ==========================================
  printSection("TEST 8: getGroupExpenses");
  try {
    const expenseIds = await fheSplit.getGroupExpenses(GROUP_ID);
    console.log("✅ Group ID:", GROUP_ID.toString());
    console.log("✅ Number of Expenses:", expenseIds.length);
    if (expenseIds.length > 0) {
      console.log("\n📋 Expense IDs:");
      expenseIds.forEach((expenseId, i) => {
        console.log(`  ${i + 1}. Expense #${expenseId.toString()}`);
      });
    } else {
      console.log("  No expenses in this group");
    }
  } catch (error) {
    console.log("❌ Error:", (error as Error).message);
  }

  // ==========================================
  // TEST 9: getExpense
  // ==========================================
  printSection("TEST 9: getExpense");
  try {
    const expense = await fheSplit.getExpense(EXPENSE_ID);
    console.log("✅ Expense ID:", expense.id.toString());
    console.log("✅ Group ID:", expense.groupId.toString());
    console.log("✅ Payer:", expense.payer);
    console.log("✅ Description:", expense.description);
    console.log("✅ Created At:", new Date(Number(expense.createdAt) * 1000).toLocaleString());
    console.log("✅ Exists:", expense.exists);
    console.log("\n💡 Note: The payer is who paid for this expense.");
    console.log("💡 If payer is different from you, you might owe them money.");
  } catch (error) {
    console.log("❌ Error:", (error as Error).message);
  }

  // ==========================================
  // TEST 10: getExpenseShare - YOUR SHARE IN THE EXPENSE
  // ==========================================
  printSection("TEST 10: getExpenseShare - Your Share");
  try {
    const memberAddr = MEMBER_ADDRESS || signerAddress;
    console.log("🔍 Checking your share in expense:", EXPENSE_ID.toString());
    console.log("   Member (YOU):", memberAddr);
    console.log("");

    const encryptedShare = await fheSplit.connect(signer).getExpenseShare(EXPENSE_ID, memberAddr);

    console.log("📦 Encrypted share retrieved:", encryptedShare !== ethers.ZeroHash);
    console.log("🔓 Attempting to decrypt...");

    const share = await decryptAmount(encryptedShare, contractAddress, signer);

    console.log("\n✅ SUCCESS!");
    console.log("✅ Expense ID:", EXPENSE_ID.toString());
    console.log("✅ Your Address:", formatAddress(memberAddr));
    console.log("💰 Your Share:", formatAmount(share), "tokens");
    console.log("💰 Raw value (wei):", share.toString());
    console.log("\n💡 This is your portion of the total expense.");
    console.log("💡 This is what you should pay to the payer.");
  } catch (error) {
    console.log("❌ Error:", (error as Error).message);
  }

  // ==========================================
  // TEST 11: getGroupCount
  // ==========================================
  // printSection("TEST 11: getGroupCount");
  // try {
  //   const count = await fheSplit.getGroupCount();
  //   console.log("✅ Total Groups Created:", count.toString());
  // } catch (error) {
  //   console.log("❌ Error:", (error as Error).message);
  // }

  // ==========================================
  // TEST 12: getExpenseCount
  // ==========================================
  // printSection("TEST 12: getExpenseCount");
  // try {
  //   const count = await fheSplit.getExpenseCount();
  //   console.log("✅ Total Expenses Created:", count.toString());
  // } catch (error) {
  //   console.log("❌ Error:", (error as Error).message);
  // }

  // ==========================================
  // TEST 13: getMyGroupsWithDebts
  // ==========================================
  printSection("TEST 13: getMyGroupsWithDebts");
  try {
    const groupIds = await fheSplit.connect(signer).getMyGroupsWithDebts(userAddr);
    console.log("✅ User:", formatAddress(userAddr));
    console.log("✅ Groups with Debts:", groupIds.length);
    if (groupIds.length > 0) {
      console.log("\n📋 Group IDs:");
      groupIds.forEach((groupId, i) => {
        console.log(`  ${i + 1}. Group #${groupId.toString()}`);
      });
    } else {
      console.log("✨ No active debts in any group");
    }
  } catch (error) {
    console.log("❌ Error:", (error as Error).message);
  }

  // ==========================================
  // TEST 14: getAllMyCreditors
  // ==========================================
  printSection("TEST 14: getAllMyCreditors");
  try {
    const [groupIds, creditorsList] = await fheSplit.connect(signer).getAllMyCreditors(userAddr);
    console.log("✅ User:", formatAddress(userAddr));
    console.log("✅ Groups with Creditors:", groupIds.length);
  
    if (groupIds.length > 0) {
      console.log("\n📋 Creditors by Group:");
      for (let i = 0; i < groupIds.length; i++) {
        const group = await fheSplit.getGroup(groupIds[i]);
        console.log(`\n  Group #${groupIds[i]} - "${group.name}":`);
        creditorsList[i].forEach((creditor, j) => {
          console.log(`    ${j + 1}. ${creditor}`);
        });
      }
    } else {
      console.log("✨ You don't owe anyone!");
    }
  } catch (error) {
    console.log("❌ Error:", (error as Error).message);
  }

  // ==========================================
  // TEST 15: getAllMyDebtors
  // ==========================================
  printSection("TEST 15: getAllMyDebtors");
  try {
    const [groupIds, debtorsList] = await fheSplit.connect(signer).getAllMyDebtors(userAddr);
    console.log("✅ User:", formatAddress(userAddr));
    console.log("✅ Groups with Debtors:", groupIds.length);
  
    if (groupIds.length > 0) {
      console.log("\n📋 Debtors by Group:");
      for (let i = 0; i < groupIds.length; i++) {
        const group = await fheSplit.getGroup(groupIds[i]);
        console.log(`\n  Group #${groupIds[i]} - "${group.name}":`);
        debtorsList[i].forEach((debtor, j) => {
          console.log(`    ${j + 1}. ${debtor}`);
        });
      }
    } else {
      console.log("✨ Nobody owes you!");
    }
  } catch (error) {
    console.log("❌ Error:", (error as Error).message);
  }

  // ==========================================
  // TEST 16: getGroupMemberToken
  // ==========================================
  // printSection("TEST 16: getGroupMemberToken");
  // try {
  //   const encryptedToken = await fheSplit.connect(signer).getGroupMemberToken(GROUP_ID, MEMBER_ADDRESS);
  //   const token = await decryptAmount(encryptedToken, contractAddress, signer);
  //   console.log("✅ Group ID:", GROUP_ID.toString());
  //   console.log("✅ Member:", formatAddress(MEMBER_ADDRESS));
  //   console.log("✅ Membership Token:", token.toString());
  //   console.log("✅ Is Member:", token > 0n ? "Yes" : "No");
  // } catch (error) {
  //   console.log("❌ Error:", (error as Error).message);
  // }

  // ==========================================
  // COMPREHENSIVE TEST: Get All Debt Details
  // ==========================================
  // printSection("COMPREHENSIVE: All Debt Details for User");
  // try {
  //   console.log("User:", formatAddress(userAddr));
  //
  //   // Get all groups
  //   const userGroups = await fheSplit.getUserGroups(userAddr);
  //   console.log("\n✅ Total Groups:", userGroups.length);
  //
  //   for (const groupId of userGroups) {
  //     const group = await fheSplit.getGroup(groupId);
  //     console.log(`\n${"=".repeat(50)}`);
  //     console.log(`📁 Group #${groupId} - "${group.name}"`);
  //     console.log(`${"=".repeat(50)}`);
  //
  //     // Get creditors
  //     const creditors = await fheSplit.connect(signer).getCreditorsInGroup(groupId, userAddr);
  //     if (creditors.length > 0) {
  //       console.log("\n💸 You owe:");
  //       for (const creditor of creditors) {
  //         const encryptedOwed = await fheSplit.connect(signer).getNetOwedInGroup(groupId, userAddr, creditor);
  //         const owed = await decryptAmount(encryptedOwed, contractAddress, signer);
  //         if (owed > 0n) {
  //           console.log(`  → ${formatAddress(creditor)}: ${formatAmount(owed)} tokens`);
  //         }
  //       }
  //     }
  //
  //     // Get debtors
  //     const debtors = await fheSplit.connect(signer).getDebtorsInGroup(groupId, userAddr);
  //     if (debtors.length > 0) {
  //       console.log("\n💰 Owe you:");
  //       for (const debtor of debtors) {
  //         const encryptedOwed = await fheSplit.connect(signer).getNetOwedInGroup(groupId, debtor, userAddr);
  //         const owed = await decryptAmount(encryptedOwed, contractAddress, signer);
  //         if (owed > 0n) {
  //           console.log(`  → ${formatAddress(debtor)}: ${formatAmount(owed)} tokens`);
  //         }
  //       }
  //     }
  //
  //     // Get expenses
  //     const expenseIds = await fheSplit.getGroupExpenses(groupId);
  //     console.log(`\n📋 Total Expenses: ${expenseIds.length}`);
  //   }
  // } catch (error) {
  //   console.log("❌ Error:", (error as Error).message);
  // }

  console.log("\n✅ Test complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
