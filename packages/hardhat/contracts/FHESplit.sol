// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {cToken} from "./cToken.sol";

/// @title FHESplit - Private Group-Based Expense Splitting Platform
/// @notice Platform for creating groups, tracking expenses, and managing private token transfers with FHE
/// @dev Uses Zama FHE for encrypted balances and group-scoped debt tracking
contract FHESplit is SepoliaConfig {
    // =============================================================
    //                           STRUCTS
    // =============================================================

    struct Group {
        uint256 id;
        string name;
        address creator;
        uint256 createdAt;
        bool exists;
    }

    struct Expense {
        uint256 id;
        uint256 groupId;
        address payer;
        string description;
        uint256 createdAt;
        bool exists;
    }

    // =============================================================
    //                        STATE VARIABLES
    // =============================================================

    // The confidential token used for transfers
    cToken public immutable confidentialToken;

    // XMTP bot address (only this address can manage groups/expenses)
    address public xmtpBotAddress;

    // Platform balances: user => encrypted balance
    mapping(address => euint64) private platformBalances;

    // Group-scoped net owed: groupId => debtor => creditor => encrypted amount
    mapping(uint256 => mapping(address => mapping(address => euint64))) private groupNetOwed;

    // Group storage
    mapping(uint256 => Group) private groups;
    uint256 private groupCounter;

    // Group members: groupId => member addresses
    mapping(uint256 => address[]) private groupMembers;
    mapping(uint256 => mapping(address => bool)) private isGroupMember;

    // User's groups: user => groupIds
    mapping(address => uint256[]) private userGroups;

    // Expense storage
    mapping(uint256 => Expense) private expenses;
    uint256 private expenseCounter;

    // Group expenses: groupId => expenseIds
    mapping(uint256 => uint256[]) private groupExpenses;

    // Expense shares: expenseId => member => encrypted share amount
    mapping(uint256 => mapping(address => euint64)) private expenseShares;

    // Track creditors and debtors per group for easier queries
    mapping(uint256 => mapping(address => address[])) private groupCreditors; // who you owe in this group
    mapping(uint256 => mapping(address => address[])) private groupDebtors; // who owes you in this group
    mapping(uint256 => mapping(address => mapping(address => bool))) private hasDebtRelationship;

    // =============================================================
    //                           EVENTS
    // =============================================================

    event BotAddressUpdated(address indexed oldBot, address indexed newBot);
    event Deposit(address indexed user, uint256 timestamp);
    event Withdrawal(address indexed user, uint256 timestamp);
    event GroupCreated(uint256 indexed groupId, string name, address indexed creator);
    event MemberAdded(uint256 indexed groupId, address indexed member);
    event MemberRemoved(uint256 indexed groupId, address indexed member);
    event ExpenseAdded(uint256 indexed expenseId, uint256 indexed groupId, address indexed payer, string description);
    event TransferInGroup(uint256 indexed groupId, address indexed from, address indexed to);
    event DebtSettled(uint256 indexed groupId, address indexed debtor, address indexed creditor);

    // =============================================================
    //                         MODIFIERS
    // =============================================================

    modifier onlyXMTPBot() {
        require(msg.sender == xmtpBotAddress, "Only XMTP bot can call this");
        _;
    }

    modifier onlyGroupMember(uint256 groupId) {
        require(groups[groupId].exists, "Group does not exist");
        require(isGroupMember[groupId][msg.sender], "Not a group member");
        _;
    }

    modifier groupExists(uint256 groupId) {
        require(groups[groupId].exists, "Group does not exist");
        _;
    }

    // =============================================================
    //                        CONSTRUCTOR
    // =============================================================

    /// @notice Constructor
    /// @param _confidentialToken Address of the cToken contract
    /// @param _xmtpBotAddress Address of the XMTP bot
    constructor(address _confidentialToken, address _xmtpBotAddress) {
        require(_confidentialToken != address(0), "Invalid token address");
        require(_xmtpBotAddress != address(0), "Invalid bot address");
        confidentialToken = cToken(_confidentialToken);
        xmtpBotAddress = _xmtpBotAddress;
    }

    // =============================================================
    //                      ADMIN FUNCTIONS
    // =============================================================

    /// @notice Update XMTP bot address (only callable by current bot)
    /// @param newBotAddress The new bot address
    function updateBotAddress(address newBotAddress) external onlyXMTPBot {
        require(newBotAddress != address(0), "Invalid address");
        address oldBot = xmtpBotAddress;
        xmtpBotAddress = newBotAddress;
        emit BotAddressUpdated(oldBot, newBotAddress);
    }

    /// @notice Helper function to set this platform as operator for cToken transfers
    /// @param until Timestamp until when the operator permission is valid
    function approveTokenOperator(uint48 until) external {
        confidentialToken.setOperator(address(this), until);
    }

    // =============================================================
    //                   DEPOSIT & WITHDRAW
    // =============================================================

    /// @notice Deposit cToken to the platform
    /// @param encryptedAmount The encrypted amount to deposit
    /// @param inputProof The input proof for the encrypted amount
    function deposit(externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        // Transfer cToken from user to platform using confidentialTransferFrom
        FHE.allowTransient(amount, address(confidentialToken));
        euint64 transferred = confidentialToken.confidentialTransferFrom(msg.sender, address(this), amount);

        // Update user balance on platform
        platformBalances[msg.sender] = FHE.add(platformBalances[msg.sender], transferred);

        // Set ACL permissions
        FHE.allowThis(platformBalances[msg.sender]);
        FHE.allow(platformBalances[msg.sender], msg.sender);
        FHE.allow(platformBalances[msg.sender], xmtpBotAddress);

        emit Deposit(msg.sender, block.timestamp);
    }

    /// @notice Withdraw cToken from the platform
    /// @param encryptedAmount The encrypted amount to withdraw
    /// @param inputProof The input proof for the encrypted amount
    function withdraw(externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        // Check user has access to their balance
        require(FHE.isSenderAllowed(platformBalances[msg.sender]), "Unauthorized access");

        // Update user balance (subtract amount)
        platformBalances[msg.sender] = FHE.sub(platformBalances[msg.sender], amount);

        // Set ACL permissions
        FHE.allowThis(platformBalances[msg.sender]);
        FHE.allow(platformBalances[msg.sender], msg.sender);
        FHE.allow(platformBalances[msg.sender], xmtpBotAddress);

        // Transfer cToken back to user
        FHE.allowTransient(amount, address(confidentialToken));
        confidentialToken.confidentialTransfer(msg.sender, amount);

        emit Withdrawal(msg.sender, block.timestamp);
    }

    /// @notice Withdraw all balance from the platform
    function withdrawAll() external {
        euint64 amount = platformBalances[msg.sender];

        // Check user has access to their balance
        require(FHE.isSenderAllowed(amount), "Unauthorized access");

        // Set balance to zero
        platformBalances[msg.sender] = FHE.asEuint64(0);
        FHE.allowThis(platformBalances[msg.sender]);
        FHE.allow(platformBalances[msg.sender], msg.sender);
        FHE.allow(platformBalances[msg.sender], xmtpBotAddress);

        // Transfer cToken back to user
        FHE.allowTransient(amount, address(confidentialToken));
        confidentialToken.confidentialTransfer(msg.sender, amount);

        emit Withdrawal(msg.sender, block.timestamp);
    }

    // =============================================================
    //                   GROUP MANAGEMENT
    // =============================================================

    /// @notice Create a new group
    /// @param name The name of the group
    /// @param members Initial members of the group
    /// @return groupId The ID of the created group
    function createGroup(string memory name, address[] memory members) external onlyXMTPBot returns (uint256) {
        groupCounter++;
        uint256 groupId = groupCounter;

        groups[groupId] = Group({
            id: groupId,
            name: name,
            creator: msg.sender,
            createdAt: block.timestamp,
            exists: true
        });

        // Add all initial members
        for (uint256 i = 0; i < members.length; i++) {
            _addMemberInternal(groupId, members[i]);
        }

        emit GroupCreated(groupId, name, msg.sender);
        return groupId;
    }

    /// @notice Add a member to a group
    /// @param groupId The group ID
    /// @param member The member address to add
    function addMember(uint256 groupId, address member) external onlyXMTPBot groupExists(groupId) {
        _addMemberInternal(groupId, member);
        emit MemberAdded(groupId, member);
    }

    /// @notice Internal function to add a member
    function _addMemberInternal(uint256 groupId, address member) private {
        require(member != address(0), "Invalid member address");
        require(!isGroupMember[groupId][member], "Already a member");

        groupMembers[groupId].push(member);
        isGroupMember[groupId][member] = true;
        userGroups[member].push(groupId);
    }

    /// @notice Remove a member from a group
    /// @param groupId The group ID
    /// @param member The member address to remove
    function removeMember(uint256 groupId, address member) external onlyXMTPBot groupExists(groupId) {
        require(isGroupMember[groupId][member], "Not a member");

        isGroupMember[groupId][member] = false;

        // Remove from groupMembers array
        address[] storage members = groupMembers[groupId];
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] == member) {
                members[i] = members[members.length - 1];
                members.pop();
                break;
            }
        }

        // Remove from userGroups array
        uint256[] storage uGroups = userGroups[member];
        for (uint256 i = 0; i < uGroups.length; i++) {
            if (uGroups[i] == groupId) {
                uGroups[i] = uGroups[uGroups.length - 1];
                uGroups.pop();
                break;
            }
        }

        emit MemberRemoved(groupId, member);
    }

    // =============================================================
    //                    EXPENSE MANAGEMENT
    // =============================================================

    /// @notice Add an expense to a group
    /// @param groupId The group ID
    /// @param payer The person who paid
    /// @param members The members who share this expense
    /// @param encryptedShares The encrypted share amount for each member
    /// @param sharesProof The input proof for encrypted shares
    /// @param description Description of the expense
    /// @return expenseId The ID of the created expense
    function addExpense(
        uint256 groupId,
        address payer,
        address[] memory members,
        externalEuint64[] memory encryptedShares,
        bytes[] memory sharesProof,
        string memory description
    ) external onlyXMTPBot groupExists(groupId) returns (uint256) {
        require(isGroupMember[groupId][payer], "Payer not in group");
        require(members.length == encryptedShares.length, "Mismatched arrays");
        require(members.length == sharesProof.length, "Mismatched proofs");

        expenseCounter++;
        uint256 expenseId = expenseCounter;

        expenses[expenseId] = Expense({
            id: expenseId,
            groupId: groupId,
            payer: payer,
            description: description,
            createdAt: block.timestamp,
            exists: true
        });

        groupExpenses[groupId].push(expenseId);

        // Process each member's share
        for (uint256 i = 0; i < members.length; i++) {
            address member = members[i];
            require(isGroupMember[groupId][member], "Member not in group");

            euint64 share = FHE.fromExternal(encryptedShares[i], sharesProof[i]);
            expenseShares[expenseId][member] = share;

            // Set ACL for expense share
            FHE.allowThis(share);
            FHE.allow(share, member);
            FHE.allow(share, payer);
            FHE.allow(share, xmtpBotAddress);

            // Update net owed if member is not the payer
            if (member != payer) {
                // Member owes payer this share amount
                euint64 currentDebt = groupNetOwed[groupId][member][payer];
                groupNetOwed[groupId][member][payer] = FHE.add(currentDebt, share);

                // Set ACL permissions
                FHE.allowThis(groupNetOwed[groupId][member][payer]);
                FHE.allow(groupNetOwed[groupId][member][payer], member);
                FHE.allow(groupNetOwed[groupId][member][payer], payer);
                FHE.allow(groupNetOwed[groupId][member][payer], xmtpBotAddress);

                // Track debt relationship
                if (!hasDebtRelationship[groupId][member][payer]) {
                    groupCreditors[groupId][member].push(payer);
                    groupDebtors[groupId][payer].push(member);
                    hasDebtRelationship[groupId][member][payer] = true;
                }
            }
        }

        emit ExpenseAdded(expenseId, groupId, payer, description);
        return expenseId;
    }

    // =============================================================
    //                   PRIVATE TRANSFERS
    // =============================================================

    /// @notice Transfer with auto-settlement within a group
    /// @param groupId The group ID
    /// @param to The recipient address
    /// @param encryptedAmount The encrypted amount to transfer
    /// @param inputProof The input proof
    function privateTransferInGroup(
        uint256 groupId,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyGroupMember(groupId) {
        require(to != address(0), "Invalid recipient");
        require(isGroupMember[groupId][to], "Recipient not in group");
        require(to != msg.sender, "Cannot transfer to self");

        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        // Check sender has access to their balance
        require(FHE.isSenderAllowed(platformBalances[msg.sender]), "Unauthorized access");

        // Auto-settlement: Check if sender owes recipient anything
        euint64 debt = groupNetOwed[groupId][msg.sender][to];

        // Calculate settlement amount: min(amount, debt)
        euint64 settleAmount = FHE.min(amount, debt);

        // Reduce the debt by settlement amount
        groupNetOwed[groupId][msg.sender][to] = FHE.sub(debt, settleAmount);

        // Set ACL for updated debt
        FHE.allowThis(groupNetOwed[groupId][msg.sender][to]);
        FHE.allow(groupNetOwed[groupId][msg.sender][to], msg.sender);
        FHE.allow(groupNetOwed[groupId][msg.sender][to], to);
        FHE.allow(groupNetOwed[groupId][msg.sender][to], xmtpBotAddress);

        // Calculate remaining amount to transfer: amount - settleAmount
        euint64 remainingTransfer = FHE.sub(amount, settleAmount);

        // Update platform balances for the remaining transfer
        platformBalances[msg.sender] = FHE.sub(platformBalances[msg.sender], remainingTransfer);
        platformBalances[to] = FHE.add(platformBalances[to], remainingTransfer);

        // Set ACL permissions for balances
        FHE.allowThis(platformBalances[msg.sender]);
        FHE.allow(platformBalances[msg.sender], msg.sender);
        FHE.allow(platformBalances[msg.sender], xmtpBotAddress);

        FHE.allowThis(platformBalances[to]);
        FHE.allow(platformBalances[to], to);
        FHE.allow(platformBalances[to], xmtpBotAddress);

        emit TransferInGroup(groupId, msg.sender, to);
        emit DebtSettled(groupId, msg.sender, to);
    }

    // =============================================================
    //                      QUERY FUNCTIONS
    // =============================================================

    /// @notice Get user's platform balance
    /// @param user The user address
    /// @return The encrypted balance
    function getPlatformBalance(address user) external view returns (euint64) {
        return platformBalances[user];
    }

    /// @notice Get net amount owed in a group
    /// @param groupId The group ID
    /// @param debtor The debtor address
    /// @param creditor The creditor address
    /// @return The encrypted amount owed
    function getNetOwedInGroup(uint256 groupId, address debtor, address creditor)
        external view groupExists(groupId) returns (euint64) {
        return groupNetOwed[groupId][debtor][creditor];
    }

    /// @notice Get all creditors in a group (who you owe)
    /// @param groupId The group ID
    /// @param user The user address
    /// @return Array of creditor addresses
    function getCreditorsInGroup(uint256 groupId, address user)
        external view groupExists(groupId) returns (address[] memory) {
        return groupCreditors[groupId][user];
    }

    /// @notice Get all debtors in a group (who owes you)
    /// @param groupId The group ID
    /// @param user The user address
    /// @return Array of debtor addresses
    function getDebtorsInGroup(uint256 groupId, address user)
        external view groupExists(groupId) returns (address[] memory) {
        return groupDebtors[groupId][user];
    }

    /// @notice Get all groups a user belongs to
    /// @param user The user address
    /// @return Array of group IDs
    function getUserGroups(address user) external view returns (uint256[] memory) {
        return userGroups[user];
    }

    /// @notice Get group details
    /// @param groupId The group ID
    /// @return The group struct
    function getGroup(uint256 groupId) external view groupExists(groupId) returns (Group memory) {
        return groups[groupId];
    }

    /// @notice Get all members of a group
    /// @param groupId The group ID
    /// @return Array of member addresses
    function getGroupMembers(uint256 groupId) external view groupExists(groupId) returns (address[] memory) {
        return groupMembers[groupId];
    }

    /// @notice Get all expenses in a group
    /// @param groupId The group ID
    /// @return Array of expense IDs
    function getGroupExpenses(uint256 groupId) external view groupExists(groupId) returns (uint256[] memory) {
        return groupExpenses[groupId];
    }

    /// @notice Get expense details
    /// @param expenseId The expense ID
    /// @return The expense struct
    function getExpense(uint256 expenseId) external view returns (Expense memory) {
        require(expenses[expenseId].exists, "Expense does not exist");
        return expenses[expenseId];
    }

    /// @notice Get a member's share for a specific expense
    /// @param expenseId The expense ID
    /// @param member The member address
    /// @return The encrypted share amount
    function getExpenseShare(uint256 expenseId, address member) external view returns (euint64) {
        require(expenses[expenseId].exists, "Expense does not exist");
        return expenseShares[expenseId][member];
    }

    /// @notice Check if an address is a member of a group
    /// @param groupId The group ID
    /// @param member The address to check
    /// @return True if member is in group
    function isMemberOfGroup(uint256 groupId, address member) external view returns (bool) {
        return isGroupMember[groupId][member];
    }

    /// @notice Get total number of groups
    /// @return The total group count
    function getGroupCount() external view returns (uint256) {
        return groupCounter;
    }

    /// @notice Get total number of expenses
    /// @return The total expense count
    function getExpenseCount() external view returns (uint256) {
        return expenseCounter;
    }
}
