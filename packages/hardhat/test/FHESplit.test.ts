import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import {
  FHESplit,
  FHESplit__factory,
  cToken,
  cToken__factory,
  MockERC20,
  MockERC20__factory,
} from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  bot: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  charlie: HardhatEthersSigner;
};

async function deployFixture() {
  const signers = await ethers.getSigners();

  // Deploy MockERC20
  const tokenFactory = (await ethers.getContractFactory("MockERC20")) as MockERC20__factory;
  const mockToken = (await tokenFactory.deploy("Mock USDT", "mUSDT", 6)) as MockERC20;
  const mockTokenAddress = await mockToken.getAddress();

  // Deploy cToken
  const cTokenFactory = (await ethers.getContractFactory("cToken")) as cToken__factory;
  const cTokenContract = (await cTokenFactory.deploy(
    mockTokenAddress,
    "Confidential USDT",
    "cUSDT"
  )) as cToken;
  const cTokenAddress = await cTokenContract.getAddress();

  // Deploy FHESplit (use deployer as bot for testing)
  const fheSplitFactory = (await ethers.getContractFactory("FHESplit")) as FHESplit__factory;
  const fheSplitContract = (await fheSplitFactory.deploy(
    cTokenAddress,
    signers[0].address // Bot address
  )) as FHESplit;
  const fheSplitAddress = await fheSplitContract.getAddress();

  return {
    mockToken,
    mockTokenAddress,
    cTokenContract,
    cTokenAddress,
    fheSplitContract,
    fheSplitAddress,
  };
}

describe("FHESplit", function () {
  let signers: Signers;
  let mockToken: MockERC20;
  let cTokenContract: cToken;
  let cTokenAddress: string;
  let fheSplitContract: FHESplit;
  let fheSplitAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      bot: ethSigners[0], // Using deployer as bot
      alice: ethSigners[1],
      bob: ethSigners[2],
      charlie: ethSigners[3],
    };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ mockToken, cTokenContract, cTokenAddress, fheSplitContract, fheSplitAddress } =
      await deployFixture());

    // Setup: Mint and wrap tokens for Alice, Bob, and Charlie
    for (const signer of [signers.alice, signers.bob, signers.charlie]) {
      // Mint 1000 tokens
      await mockToken.mint(signer.address, ethers.parseUnits("1000", 6));

      // Approve and wrap 500 tokens
      await mockToken.connect(signer).approve(cTokenAddress, ethers.parseUnits("500", 6));
      await cTokenContract.connect(signer).wrap(signer.address, ethers.parseUnits("500", 6));

      // Approve FHESplit as operator
      const until = Math.floor(Date.now() / 1000) + 3600;
      await cTokenContract.connect(signer).setOperator(fheSplitAddress, until);

      // Deposit 200 tokens to platform
      const depositAmount = 200000000n; // 200 tokens
      const encryptedDeposit = await fhevm
        .createEncryptedInput(fheSplitAddress, signer.address)
        .add64(depositAmount)
        .encrypt();
      await fheSplitContract
        .connect(signer)
        .deposit(encryptedDeposit.handles[0], encryptedDeposit.inputProof);
    }
  });

  describe("Deployment", function () {
    it("should have correct initial configuration", async function () {
      expect(await fheSplitContract.confidentialToken()).to.equal(cTokenAddress);
      expect(await fheSplitContract.xmtpBotAddress()).to.equal(signers.bot.address);
      expect(await fheSplitContract.getGroupCount()).to.equal(0);
      expect(await fheSplitContract.getExpenseCount()).to.equal(0);
    });
  });

  describe("Platform Operations", function () {
    it("should show correct platform balance after deposit", async function () {
      const encryptedBalance = await fheSplitContract.getPlatformBalance(signers.alice.address);
      const clearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        fheSplitAddress,
        signers.alice
      );
      expect(clearBalance).to.equal(200000000n); // 200 tokens
    });

    it("should withdraw successfully", async function () {
      const withdrawAmount = 50000000n; // 50 tokens

      const encryptedWithdraw = await fhevm
        .createEncryptedInput(fheSplitAddress, signers.alice.address)
        .add64(withdrawAmount)
        .encrypt();

      await fheSplitContract
        .connect(signers.alice)
        .withdraw(encryptedWithdraw.handles[0], encryptedWithdraw.inputProof);

      const encryptedBalance = await fheSplitContract.getPlatformBalance(signers.alice.address);
      const clearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        fheSplitAddress,
        signers.alice
      );
      expect(clearBalance).to.equal(150000000n); // 200 - 50 = 150
    });

    it("should withdraw all successfully", async function () {
      await fheSplitContract.connect(signers.alice).withdrawAll();

      const encryptedBalance = await fheSplitContract.getPlatformBalance(signers.alice.address);
      const clearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        fheSplitAddress,
        signers.alice
      );
      expect(clearBalance).to.equal(0n);
    });
  });

  describe("Group Management", function () {
    it("should create group successfully", async function () {
      const members = [signers.alice.address, signers.bob.address, signers.charlie.address];

      const tx = await fheSplitContract.connect(signers.bot).createGroup("Roommates", members);
      await tx.wait();

      expect(await fheSplitContract.getGroupCount()).to.equal(1);

      const group = await fheSplitContract.getGroup(1);
      expect(group.name).to.equal("Roommates");
      expect(group.creator).to.equal(signers.bot.address);
      expect(group.exists).to.be.true;

      const groupMembers = await fheSplitContract.getGroupMembers(1);
      expect(groupMembers.length).to.equal(3);
      expect(groupMembers).to.include(signers.alice.address);
      expect(groupMembers).to.include(signers.bob.address);
      expect(groupMembers).to.include(signers.charlie.address);
    });

    it("should fail to create group if not bot", async function () {
      const members = [signers.alice.address, signers.bob.address];

      await expect(
        fheSplitContract.connect(signers.alice).createGroup("Invalid", members)
      ).to.be.revertedWith("Only XMTP bot can call this");
    });

    it("should add member to existing group", async function () {
      const members = [signers.alice.address, signers.bob.address];
      await fheSplitContract.connect(signers.bot).createGroup("Roommates", members);

      await fheSplitContract.connect(signers.bot).addMember(1, signers.charlie.address);

      const groupMembers = await fheSplitContract.getGroupMembers(1);
      expect(groupMembers.length).to.equal(3);
      expect(groupMembers).to.include(signers.charlie.address);
    });

    it("should remove member from group", async function () {
      const members = [signers.alice.address, signers.bob.address, signers.charlie.address];
      await fheSplitContract.connect(signers.bot).createGroup("Roommates", members);

      await fheSplitContract.connect(signers.bot).removeMember(1, signers.charlie.address);

      const groupMembers = await fheSplitContract.getGroupMembers(1);
      expect(groupMembers.length).to.equal(2);
      expect(groupMembers).to.not.include(signers.charlie.address);

      const isMember = await fheSplitContract.isMemberOfGroup(1, signers.charlie.address);
      expect(isMember).to.be.false;
    });

    it("should track user groups correctly", async function () {
      await fheSplitContract
        .connect(signers.bot)
        .createGroup("Group1", [signers.alice.address, signers.bob.address]);
      await fheSplitContract
        .connect(signers.bot)
        .createGroup("Group2", [signers.alice.address, signers.charlie.address]);

      const aliceGroups = await fheSplitContract.getUserGroups(signers.alice.address);
      expect(aliceGroups.length).to.equal(2);
      expect(aliceGroups[0]).to.equal(1n);
      expect(aliceGroups[1]).to.equal(2n);

      const bobGroups = await fheSplitContract.getUserGroups(signers.bob.address);
      expect(bobGroups.length).to.equal(1);
      expect(bobGroups[0]).to.equal(1n);
    });
  });

  describe("Expense Management", function () {
    let groupId: bigint;

    beforeEach(async function () {
      // Create a group
      const members = [signers.alice.address, signers.bob.address, signers.charlie.address];
      const tx = await fheSplitContract.connect(signers.bot).createGroup("Roommates", members);
      await tx.wait();
      groupId = 1n;
    });

    it("should add expense successfully", async function () {
      const members = [signers.alice.address, signers.bob.address, signers.charlie.address];
      const shares = [100000000n, 100000000n, 100000000n]; // 100 each

      // Encrypt shares
      const encryptedShares = [];
      const proofs = [];
      for (const share of shares) {
        const encrypted = await fhevm
          .createEncryptedInput(fheSplitAddress, signers.bot.address)
          .add64(share)
          .encrypt();
        encryptedShares.push(encrypted.handles[0]);
        proofs.push(encrypted.inputProof);
      }

      const tx = await fheSplitContract
        .connect(signers.bot)
        .addExpense(groupId, signers.alice.address, members, encryptedShares, proofs, "Pizza night");
      await tx.wait();

      expect(await fheSplitContract.getExpenseCount()).to.equal(1);

      const expense = await fheSplitContract.getExpense(1);
      expect(expense.groupId).to.equal(groupId);
      expect(expense.payer).to.equal(signers.alice.address);
      expect(expense.description).to.equal("Pizza night");
      expect(expense.exists).to.be.true;
    });

    it("should update net owed correctly after expense", async function () {
      const members = [signers.alice.address, signers.bob.address, signers.charlie.address];
      const shares = [100000000n, 100000000n, 100000000n];

      const encryptedShares = [];
      const proofs = [];
      for (const share of shares) {
        const encrypted = await fhevm
          .createEncryptedInput(fheSplitAddress, signers.bot.address)
          .add64(share)
          .encrypt();
        encryptedShares.push(encrypted.handles[0]);
        proofs.push(encrypted.inputProof);
      }

      await fheSplitContract
        .connect(signers.bot)
        .addExpense(groupId, signers.alice.address, members, encryptedShares, proofs, "Dinner");

      // Bob should owe Alice 100
      const encryptedOwed = await fheSplitContract.getNetOwedInGroup(
        groupId,
        signers.bob.address,
        signers.alice.address
      );
      const clearOwed = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedOwed,
        fheSplitAddress,
        signers.bob
      );
      expect(clearOwed).to.equal(100000000n);

      // Charlie should owe Alice 100
      const encryptedOwed2 = await fheSplitContract.getNetOwedInGroup(
        groupId,
        signers.charlie.address,
        signers.alice.address
      );
      const clearOwed2 = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedOwed2,
        fheSplitAddress,
        signers.charlie
      );
      expect(clearOwed2).to.equal(100000000n);

      // Alice should not owe herself
      const encryptedOwed3 = await fheSplitContract.getNetOwedInGroup(
        groupId,
        signers.alice.address,
        signers.alice.address
      );
      expect(encryptedOwed3).to.equal(ethers.ZeroHash);
    });

    it("should track creditors and debtors", async function () {
      const members = [signers.alice.address, signers.bob.address, signers.charlie.address];
      const shares = [100000000n, 100000000n, 100000000n];

      const encryptedShares = [];
      const proofs = [];
      for (const share of shares) {
        const encrypted = await fhevm
          .createEncryptedInput(fheSplitAddress, signers.bot.address)
          .add64(share)
          .encrypt();
        encryptedShares.push(encrypted.handles[0]);
        proofs.push(encrypted.inputProof);
      }

      await fheSplitContract
        .connect(signers.bot)
        .addExpense(groupId, signers.alice.address, members, encryptedShares, proofs, "Dinner");

      // Bob's creditors should include Alice
      const bobCreditors = await fheSplitContract.getCreditorsInGroup(groupId, signers.bob.address);
      expect(bobCreditors).to.include(signers.alice.address);

      // Alice's debtors should include Bob and Charlie
      const aliceDebtors = await fheSplitContract.getDebtorsInGroup(groupId, signers.alice.address);
      expect(aliceDebtors).to.include(signers.bob.address);
      expect(aliceDebtors).to.include(signers.charlie.address);
    });

    it("should get expense share correctly", async function () {
      const members = [signers.alice.address, signers.bob.address];
      const shares = [150000000n, 150000000n]; // 150 each

      const encryptedShares = [];
      const proofs = [];
      for (const share of shares) {
        const encrypted = await fhevm
          .createEncryptedInput(fheSplitAddress, signers.bot.address)
          .add64(share)
          .encrypt();
        encryptedShares.push(encrypted.handles[0]);
        proofs.push(encrypted.inputProof);
      }

      await fheSplitContract
        .connect(signers.bot)
        .addExpense(groupId, signers.alice.address, members, encryptedShares, proofs, "Groceries");

      const bobShare = await fheSplitContract.getExpenseShare(1, signers.bob.address);
      const clearShare = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        bobShare,
        fheSplitAddress,
        signers.bob
      );
      expect(clearShare).to.equal(150000000n);
    });
  });

  describe("Auto-Settling Transfers", function () {
    let groupId: bigint;

    beforeEach(async function () {
      // Create group
      const members = [signers.alice.address, signers.bob.address, signers.charlie.address];
      await fheSplitContract.connect(signers.bot).createGroup("Roommates", members);
      groupId = 1n;

      // Add expense: Alice paid, Bob and Charlie owe 100 each
      const expenseMembers = [signers.alice.address, signers.bob.address, signers.charlie.address];
      const shares = [100000000n, 100000000n, 100000000n];

      const encryptedShares = [];
      const proofs = [];
      for (const share of shares) {
        const encrypted = await fhevm
          .createEncryptedInput(fheSplitAddress, signers.bot.address)
          .add64(share)
          .encrypt();
        encryptedShares.push(encrypted.handles[0]);
        proofs.push(encrypted.inputProof);
      }

      await fheSplitContract
        .connect(signers.bot)
        .addExpense(groupId, signers.alice.address, expenseMembers, encryptedShares, proofs, "Dinner");
    });

    it("should settle debt when transferring", async function () {
      // Bob owes Alice 100
      // Bob transfers 50 to Alice

      const transferAmount = 50000000n;
      const encryptedTransfer = await fhevm
        .createEncryptedInput(fheSplitAddress, signers.bob.address)
        .add64(transferAmount)
        .encrypt();

      await fheSplitContract
        .connect(signers.bob)
        .privateTransferInGroup(
          groupId,
          signers.alice.address,
          encryptedTransfer.handles[0],
          encryptedTransfer.inputProof
        );

      // Bob should now owe Alice 50
      const encryptedOwed = await fheSplitContract.getNetOwedInGroup(
        groupId,
        signers.bob.address,
        signers.alice.address
      );
      const clearOwed = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedOwed,
        fheSplitAddress,
        signers.bob
      );
      expect(clearOwed).to.equal(50000000n);

      // Platform balances shouldn't change (all went to settling debt)
      const bobBalance = await fheSplitContract.getPlatformBalance(signers.bob.address);
      const clearBobBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        bobBalance,
        fheSplitAddress,
        signers.bob
      );
      expect(clearBobBalance).to.equal(200000000n); // Still 200

      const aliceBalance = await fheSplitContract.getPlatformBalance(signers.alice.address);
      const clearAliceBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        aliceBalance,
        fheSplitAddress,
        signers.alice
      );
      expect(clearAliceBalance).to.equal(200000000n); // Still 200
    });

    it("should settle full debt and transfer remainder", async function () {
      // Bob owes Alice 100
      // Bob transfers 150 to Alice
      // Should settle 100 debt and transfer 50 to balance

      const transferAmount = 150000000n;
      const encryptedTransfer = await fhevm
        .createEncryptedInput(fheSplitAddress, signers.bob.address)
        .add64(transferAmount)
        .encrypt();

      await fheSplitContract
        .connect(signers.bob)
        .privateTransferInGroup(
          groupId,
          signers.alice.address,
          encryptedTransfer.handles[0],
          encryptedTransfer.inputProof
        );

      // Bob should owe Alice 0
      const encryptedOwed = await fheSplitContract.getNetOwedInGroup(
        groupId,
        signers.bob.address,
        signers.alice.address
      );
      const clearOwed = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedOwed,
        fheSplitAddress,
        signers.bob
      );
      expect(clearOwed).to.equal(0n);

      // Bob's balance should decrease by 50 (the remainder after settling)
      const bobBalance = await fheSplitContract.getPlatformBalance(signers.bob.address);
      const clearBobBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        bobBalance,
        fheSplitAddress,
        signers.bob
      );
      expect(clearBobBalance).to.equal(150000000n); // 200 - 50

      // Alice's balance should increase by 50
      const aliceBalance = await fheSplitContract.getPlatformBalance(signers.alice.address);
      const clearAliceBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        aliceBalance,
        fheSplitAddress,
        signers.alice
      );
      expect(clearAliceBalance).to.equal(250000000n); // 200 + 50
    });

    it("should fail transfer if not group member", async function () {
      const transferAmount = 50000000n;
      const encryptedTransfer = await fhevm
        .createEncryptedInput(fheSplitAddress, signers.alice.address)
        .add64(transferAmount)
        .encrypt();

      // Create another user not in group
      const nonMember = signers.deployer;

      await expect(
        fheSplitContract
          .connect(signers.alice)
          .privateTransferInGroup(
            groupId,
            nonMember.address,
            encryptedTransfer.handles[0],
            encryptedTransfer.inputProof
          )
      ).to.be.revertedWith("Recipient not in group");
    });
  });

  describe("Access Control", function () {
    it("should update bot address", async function () {
      const newBot = signers.alice.address;
      await fheSplitContract.connect(signers.bot).updateBotAddress(newBot);
      expect(await fheSplitContract.xmtpBotAddress()).to.equal(newBot);
    });

    it("should fail to update bot address if not current bot", async function () {
      await expect(
        fheSplitContract.connect(signers.alice).updateBotAddress(signers.bob.address)
      ).to.be.revertedWith("Only XMTP bot can call this");
    });
  });
});
