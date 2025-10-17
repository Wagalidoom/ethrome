import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { cToken, cToken__factory, MockERC20, MockERC20__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  charlie: HardhatEthersSigner;
};

async function deployFixture() {
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

  return { mockToken, mockTokenAddress, cTokenContract, cTokenAddress };
}

describe("cToken", function () {
  let signers: Signers;
  let mockToken: MockERC20;
  let mockTokenAddress: string;
  let cTokenContract: cToken;
  let cTokenAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
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

    ({ mockToken, mockTokenAddress, cTokenContract, cTokenAddress } = await deployFixture());

    // Mint tokens to Alice and Bob
    await mockToken.mint(signers.alice.address, ethers.parseUnits("1000", 6));
    await mockToken.mint(signers.bob.address, ethers.parseUnits("1000", 6));
  });

  describe("Deployment", function () {
    it("should have correct name and symbol", async function () {
      expect(await cTokenContract.name()).to.equal("Confidential USDT");
      expect(await cTokenContract.symbol()).to.equal("cUSDT");
      expect(await cTokenContract.decimals()).to.equal(6);
    });

    it("should have correct underlying token", async function () {
      expect(await cTokenContract.underlying()).to.equal(mockTokenAddress);
    });
  });

  describe("Wrapping", function () {
    it("should wrap tokens successfully", async function () {
      const wrapAmount = ethers.parseUnits("100", 6);

      // Approve cToken to spend mockTokens
      await mockToken.connect(signers.alice).approve(cTokenAddress, wrapAmount);

      // Wrap tokens
      await cTokenContract.connect(signers.alice).wrap(signers.alice.address, wrapAmount);

      // Check encrypted balance exists
      const encryptedBalance = await cTokenContract.confidentialBalanceOf(signers.alice.address);
      expect(encryptedBalance).to.not.equal(ethers.ZeroHash);

      // Decrypt and verify
      const clearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        cTokenAddress,
        signers.alice
      );
      expect(clearBalance).to.equal(wrapAmount);
    });

    it("should fail to wrap without approval", async function () {
      const wrapAmount = ethers.parseUnits("100", 6);

      // Try to wrap without approval
      await expect(
        cTokenContract.connect(signers.alice).wrap(signers.alice.address, wrapAmount)
      ).to.be.reverted;
    });

    it("should wrap tokens to different recipient", async function () {
      const wrapAmount = ethers.parseUnits("100", 6);

      // Approve and wrap to Bob
      await mockToken.connect(signers.alice).approve(cTokenAddress, wrapAmount);
      await cTokenContract.connect(signers.alice).wrap(signers.bob.address, wrapAmount);

      // Check Bob's balance
      const encryptedBalance = await cTokenContract.confidentialBalanceOf(signers.bob.address);
      const clearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        cTokenAddress,
        signers.bob
      );
      expect(clearBalance).to.equal(wrapAmount);

      // Alice should have 0 cTokens
      const aliceBalance = await cTokenContract.confidentialBalanceOf(signers.alice.address);
      expect(aliceBalance).to.equal(ethers.ZeroHash);
    });
  });

  describe("Unwrapping", function () {
    beforeEach(async function () {
      // Wrap some tokens for Alice
      const wrapAmount = ethers.parseUnits("500", 6);
      await mockToken.connect(signers.alice).approve(cTokenAddress, wrapAmount);
      await cTokenContract.connect(signers.alice).wrap(signers.alice.address, wrapAmount);
    });

    it("should unwrap tokens successfully", async function () {
      const unwrapAmount = 100000000n; // 100 tokens with 6 decimals
      const initialBalance = await mockToken.balanceOf(signers.alice.address);

      // Create encrypted input
      const encryptedAmount = await fhevm
        .createEncryptedInput(cTokenAddress, signers.alice.address)
        .add64(unwrapAmount)
        .encrypt();

      // Unwrap - use array notation to disambiguate overloaded function
      await cTokenContract
        .connect(signers.alice)
        ["unwrap(address,address,bytes32,bytes)"](signers.alice.address, signers.alice.address, encryptedAmount.handles[0], encryptedAmount.inputProof);

      // Wait for the decryption oracle to process the unwrap request
      await fhevm.awaitDecryptionOracle();

      // Check underlying token balance increased
      const newBalance = await mockToken.balanceOf(signers.alice.address);
      expect(newBalance - initialBalance).to.equal(unwrapAmount);

      // Check cToken balance decreased
      const encryptedBalance = await cTokenContract.confidentialBalanceOf(signers.alice.address);
      const clearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        cTokenAddress,
        signers.alice
      );
      expect(clearBalance).to.equal(400000000n); // 500 - 100 = 400
    });
  });

  describe("Operator Permissions", function () {
    it("should set operator successfully", async function () {
      const until = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      await cTokenContract.connect(signers.alice).setOperator(signers.bob.address, until);

      const isOperator = await cTokenContract.isOperator(signers.alice.address, signers.bob.address);
      expect(isOperator).to.be.true;
    });

    it("should revoke operator when time expires", async function () {
      const until = Math.floor(Date.now() / 1000) - 1; // Expired

      await cTokenContract.connect(signers.alice).setOperator(signers.bob.address, until);

      const isOperator = await cTokenContract.isOperator(signers.alice.address, signers.bob.address);
      expect(isOperator).to.be.false;
    });
  });

  describe("Confidential Transfers", function () {
    beforeEach(async function () {
      // Wrap tokens for Alice and Bob
      const wrapAmount = ethers.parseUnits("500", 6);
      await mockToken.connect(signers.alice).approve(cTokenAddress, wrapAmount);
      await cTokenContract.connect(signers.alice).wrap(signers.alice.address, wrapAmount);

      await mockToken.connect(signers.bob).approve(cTokenAddress, wrapAmount);
      await cTokenContract.connect(signers.bob).wrap(signers.bob.address, wrapAmount);
    });

    it("should transfer confidentially with external input", async function () {
      const transferAmount = 100000000n; // 100 tokens

      // Create encrypted input
      const encryptedAmount = await fhevm
        .createEncryptedInput(cTokenAddress, signers.alice.address)
        .add64(transferAmount)
        .encrypt();

      // Transfer from Alice to Bob - use array notation to disambiguate overloaded function
      await cTokenContract
        .connect(signers.alice)
        ["confidentialTransfer(address,bytes32,bytes)"](
          signers.bob.address,
          encryptedAmount.handles[0],
          encryptedAmount.inputProof
        );

      // Check Alice's balance decreased
      const aliceBalance = await cTokenContract.confidentialBalanceOf(signers.alice.address);
      const clearAliceBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        aliceBalance,
        cTokenAddress,
        signers.alice
      );
      expect(clearAliceBalance).to.equal(400000000n); // 500 - 100

      // Check Bob's balance increased
      const bobBalance = await cTokenContract.confidentialBalanceOf(signers.bob.address);
      const clearBobBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        bobBalance,
        cTokenAddress,
        signers.bob
      );
      expect(clearBobBalance).to.equal(600000000n); // 500 + 100
    });

    it("should transfer from with operator permission", async function () {
      const transferAmount = 500000000n; // 500 tokens (all of Alice's balance)
      const until = Math.floor(Date.now() / 1000) + 3600;

      // Alice sets Bob as operator
      await cTokenContract.connect(signers.alice).setOperator(signers.bob.address, until);

      // Bob creates an encrypted input for the transfer amount
      const encryptedAmount = await fhevm
        .createEncryptedInput(cTokenAddress, signers.bob.address)
        .add64(transferAmount)
        .encrypt();

      // Bob transfers from Alice to Charlie using operator permission
      await cTokenContract
        .connect(signers.bob)
        ["confidentialTransferFrom(address,address,bytes32,bytes)"](
          signers.alice.address,
          signers.charlie.address,
          encryptedAmount.handles[0],
          encryptedAmount.inputProof
        );

      // Check Alice's balance decreased to 0
      const newAliceBalance = await cTokenContract.confidentialBalanceOf(signers.alice.address);
      const clearAliceBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        newAliceBalance,
        cTokenAddress,
        signers.alice
      );
      expect(clearAliceBalance).to.equal(0n);

      // Check Charlie received tokens
      const charlieBalance = await cTokenContract.confidentialBalanceOf(signers.charlie.address);
      const clearCharlieBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        charlieBalance,
        cTokenAddress,
        signers.charlie
      );
      expect(clearCharlieBalance).to.equal(500000000n);
    });
  });

  describe("Testing Functions", function () {
    it("should mint tokens directly for testing", async function () {
      const mintAmount = 300000000n; // 300 tokens with 6 decimals

      // Mint directly to Alice without needing underlying token
      await cTokenContract.mintForTesting(signers.alice.address, mintAmount);

      // Check Alice's balance
      const encryptedBalance = await cTokenContract.confidentialBalanceOf(signers.alice.address);
      const clearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        cTokenAddress,
        signers.alice
      );
      expect(clearBalance).to.equal(mintAmount);
    });

    it("should batch mint to multiple addresses", async function () {
      const recipients = [signers.alice.address, signers.bob.address, signers.charlie.address];
      const amounts = [100000000n, 200000000n, 300000000n]; // 100, 200, 300 tokens

      // Batch mint
      await cTokenContract.batchMintForTesting(recipients, amounts);

      // Check each recipient's balance
      for (let i = 0; i < recipients.length; i++) {
        const encryptedBalance = await cTokenContract.confidentialBalanceOf(recipients[i]);
        const signer = i === 0 ? signers.alice : i === 1 ? signers.bob : signers.charlie;
        const clearBalance = await fhevm.userDecryptEuint(
          FhevmType.euint64,
          encryptedBalance,
          cTokenAddress,
          signer
        );
        expect(clearBalance).to.equal(amounts[i]);
      }
    });

    it("should fail to mint to zero address", async function () {
      await expect(
        cTokenContract.mintForTesting(ethers.ZeroAddress, 100000000n)
      ).to.be.revertedWith("Cannot mint to zero address");
    });

    it("should fail batch mint with mismatched arrays", async function () {
      const recipients = [signers.alice.address, signers.bob.address];
      const amounts = [100000000n]; // Only 1 amount for 2 recipients

      await expect(
        cTokenContract.batchMintForTesting(recipients, amounts)
      ).to.be.revertedWith("Array length mismatch");
    });

    it("should allow anyone to mint for testing", async function () {
      // Charlie (not owner) mints to himself
      await cTokenContract.connect(signers.charlie).mintForTesting(signers.charlie.address, 500000000n);

      const encryptedBalance = await cTokenContract.confidentialBalanceOf(signers.charlie.address);
      const clearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        cTokenAddress,
        signers.charlie
      );
      expect(clearBalance).to.equal(500000000n);
    });

    it("should work with transfers after minting for testing", async function () {
      // Mint to Alice
      await cTokenContract.mintForTesting(signers.alice.address, 500000000n);

      // Transfer from Alice to Bob
      const transferAmount = 100000000n;
      const encryptedAmount = await fhevm
        .createEncryptedInput(cTokenAddress, signers.alice.address)
        .add64(transferAmount)
        .encrypt();

      await cTokenContract
        .connect(signers.alice)
        ["confidentialTransfer(address,bytes32,bytes)"](
          signers.bob.address,
          encryptedAmount.handles[0],
          encryptedAmount.inputProof
        );

      // Verify balances
      const aliceBalance = await cTokenContract.confidentialBalanceOf(signers.alice.address);
      const clearAliceBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        aliceBalance,
        cTokenAddress,
        signers.alice
      );
      expect(clearAliceBalance).to.equal(400000000n); // 500 - 100

      const bobBalance = await cTokenContract.confidentialBalanceOf(signers.bob.address);
      const clearBobBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        bobBalance,
        cTokenAddress,
        signers.bob
      );
      expect(clearBobBalance).to.equal(100000000n);
    });
  });
});
