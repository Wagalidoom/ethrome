"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWagmiEthers } from "../wagmi/useWagmiEthers";
import { FhevmInstance } from "@fhevm-sdk";
import { ethers } from "ethers";
import { useReadContract } from "wagmi";
import FHESplit_ABI from "~~/utils/abi/FHESplit";

const FHESplitAddress = '0xbFBc56979dBfA4514C6560e5E9d33Ff608117ce5';

export const useFHESplitWagmi = (parameters: {
  instance: FhevmInstance | undefined;
  initialMockChains?: Readonly<Record<number, string>>;
  groupId: number;
}) => {
  const { instance, initialMockChains, groupId } = parameters;

  // Wagmi + ethers interop
  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);

  const [message, setMessage] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState<boolean>(false);

  // Helpers
  const hasProvider = Boolean(ethersReadonlyProvider);
  const hasSigner = Boolean(ethersSigner);

  const getContract = useCallback(
    (mode: "read" | "write") => {
      const providerOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
      if (!providerOrSigner) return undefined;
      return new ethers.Contract(FHESplitAddress, FHESplit_ABI, providerOrSigner);
    },
    [ethersReadonlyProvider, ethersSigner],
  );

  const readMembersResult = useReadContract({
    address: FHESplitAddress,
    abi: FHESplit_ABI,
    functionName: "getGroupMembers",
    args: [BigInt(groupId)],
    query: {
      enabled: Boolean(hasProvider),
      refetchOnWindowFocus: false,
    },
  });

  // Read expense IDs for the group
  const readExpenseIdsResult = useReadContract({
    address: FHESplitAddress,
    abi: FHESplit_ABI,
    functionName: "getGroupExpenses",
    args: [BigInt(groupId)],
    query: {
      enabled: Boolean(hasProvider && groupId),
      refetchOnWindowFocus: false,
    },
  });

  const groupMembers = useMemo(
    () => (readMembersResult.data as string[] | undefined) ?? [],
    [readMembersResult.data],
  );

  const expenseIds = useMemo(
    () => (readExpenseIdsResult.data as bigint[] | undefined) ?? [],
    [readExpenseIdsResult.data],
  );

  const refreshMembers = useCallback(async () => {
    const res = await readMembersResult.refetch();
    if (res.error) setMessage("Failed to fetch members: " + (res.error as Error).message);
  }, [readMembersResult]);

  // Fetch all expenses for the group
  const fetchExpenses = useCallback(async () => {
    if (!hasProvider || expenseIds.length === 0) {
      setExpenses([]);
      return;
    }

    setIsLoadingExpenses(true);
    try {
      const readContract = getContract("read");
      if (!readContract) {
        console.error("Contract not available");
        setIsLoadingExpenses(false);
        return;
      }

      const expensePromises = expenseIds.map(id => readContract.getExpense(id));
      const expensesData = await Promise.all(expensePromises);

      console.log("Fetched expenses:", expensesData);
      setExpenses(expensesData);
    } catch (error) {
      console.error("Error fetching expenses:", error);
    } finally {
      setIsLoadingExpenses(false);
    }
  }, [hasProvider, expenseIds, getContract]);

  // Auto-fetch expenses when expense IDs change
  useEffect(() => {
    if (expenseIds.length > 0) {
      fetchExpenses();
    } else {
      setExpenses([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseIds.length, hasProvider]);

  const readGroupResult = useReadContract({
    address: FHESplitAddress,
    abi: FHESplit_ABI,
    functionName: "getGroup",
    args: [BigInt(groupId)],
    query: {
      enabled: Boolean(hasProvider && groupId),
      refetchOnWindowFocus: false,
    },
  });

  const groupInfo = useMemo(() => readGroupResult.data, [readGroupResult.data]);

  // Add member function
  const addMember = useCallback(
    async (memberAddress: string) => {
      if (isProcessing || !hasSigner || groupId === undefined) {
        setMessage("Cannot add member: missing requirements");
        return false;
      }

      setIsProcessing(true);
      setMessage(`Adding member ${memberAddress.slice(0, 6)}...${memberAddress.slice(-4)}...`);

      try {
        const writeContract = getContract("write");
        if (!writeContract) {
          setMessage("Contract not available");
          return false;
        }

        // Validate address
        if (!ethers.isAddress(memberAddress)) {
          setMessage("Invalid Ethereum address");
          return false;
        }

        const tx = await writeContract.addMember(BigInt(groupId), memberAddress);
        setMessage("Waiting for transaction confirmation...");
        await tx.wait();

        setMessage(`Successfully added member!`);
        await refreshMembers();
        return true;
      } catch (e) {
        const error = e as Error;
        setMessage(`Failed to add member: ${error.message}`);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, groupId, getContract, refreshMembers],
  );

  // Remove member function
  const removeMember = useCallback(
    async (memberAddress: string) => {
      if (isProcessing || !hasSigner || groupId === undefined) {
        setMessage("Cannot remove member: missing requirements");
        return false;
      }

      setIsProcessing(true);
      setMessage(`Removing member ${memberAddress.slice(0, 6)}...${memberAddress.slice(-4)}...`);

      try {
        const writeContract = getContract("write");
        if (!writeContract) {
          setMessage("Contract not available");
          return false;
        }

        const tx = await writeContract.removeMember(BigInt(groupId), memberAddress);
        setMessage("Waiting for transaction confirmation...");
        await tx.wait();

        setMessage(`Successfully removed member!`);
        await refreshMembers();
        return true;
      } catch (e) {
        const error = e as Error;
        setMessage(`Failed to remove member: ${error.message}`);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, groupId, getContract, refreshMembers],
  );

  // Check if user is a member
  const readIsMemberResult = useReadContract({
    address: FHESplitAddress,
    abi: FHESplit_ABI,
    functionName: "isMemberOfGroup",
    args: groupId !== undefined && accounts?.[0] ? [BigInt(groupId), accounts[0]] : undefined,
    query: {
      enabled: Boolean(hasProvider && groupId !== undefined && accounts?.[0]),
      refetchOnWindowFocus: false,
    },
  });

  const isCurrentUserMember = useMemo(() => Boolean(readIsMemberResult.data), [readIsMemberResult.data]);

  const canManageMembers = useMemo(
    () => Boolean(instance && hasSigner && !isProcessing && groupId !== undefined),
    [instance, hasSigner, isProcessing, groupId],
  );

  // Add expense function
  const addExpense = useCallback(
    async (params: {
      payer: string;
      members: string[];
      shares: bigint[];
      description: string;
    }) => {
      const { payer, members, shares, description } = params;

      if (isProcessing || !hasSigner || !instance || groupId === undefined) {
        setMessage(
          `Cannot add expense: isProcessing=${isProcessing}, hasSigner=${hasSigner}, hasInstance=${!!instance}, groupId=${groupId}`,
        );
        return false;
      }

      if (members.length !== shares.length) {
        setMessage(`Members count (${members.length}) must match shares count (${shares.length})`);
        return false;
      }

      setIsProcessing(true);
      setMessage("Encrypting shares...");

      try {
        if (!ethers.isAddress(payer)) {
          setMessage("Invalid payer address");
          setIsProcessing(false);
          return false;
        }

        for (const member of members) {
          if (!ethers.isAddress(member)) {
            setMessage(`Invalid member address: ${member}`);
            setIsProcessing(false);
            return false;
          }
        }

        const userAddress = await ethersSigner?.getAddress();
        if (!userAddress) {
          setMessage("Unable to get user address");
          return false;
        }

        // Encrypt each share
        const encryptedShares: string[] = [];
        const proofs: string[] = [];

        console.log("Starting encryption for", shares.length, "shares");
        for (let i = 0; i < shares.length; i++) {
          const share = shares[i];
          console.log(`Encrypting share ${i + 1}/${shares.length}: ${share}`);
          
          const encrypted = await instance
            .createEncryptedInput(FHESplitAddress, userAddress)
            .add64(share)
            .encrypt();

          const handleHex = "0x" + Buffer.from(encrypted.handles[0]).toString("hex");
          const proofHex = "0x" + Buffer.from(encrypted.inputProof).toString("hex");

          encryptedShares.push(handleHex);
          proofs.push(proofHex);
          console.log(`Encrypted share ${i + 1}: handle length=${handleHex.length}, proof length=${proofHex.length}`);
        }

        console.log("All shares encrypted. Encrypted shares:", encryptedShares.length);
        console.log("Proofs:", proofs.length);
        setMessage("Submitting transaction...");

        const writeContract = getContract("write");
        if (!writeContract) {
          setMessage("Contract not available");
          return false;
        }

        console.log("Calling addExpense with:", {
          groupId: BigInt(groupId),
          payer,
          members,
          encryptedSharesCount: encryptedShares.length,
          proofsCount: proofs.length,
          description,
        });

        const tx = await writeContract.addExpense(
          BigInt(groupId),
          payer,
          members,
          encryptedShares,
          proofs,
          description,
        );

        console.log("Transaction sent:", tx.hash);
        setMessage("Waiting for transaction confirmation...");
        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt);

        setMessage(`Successfully added expense: ${description}`);
        return true;
      } catch (e) {
        const error = e as Error;
        console.error("Error adding expense:", error);
        setMessage(`Failed to add expense: ${error.message}`);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasSigner, instance, groupId, ethersSigner, getContract],
  );

  return {
    contractAddress: FHESplitAddress,
    groupMembers,
    groupInfo,
    isCurrentUserMember,
    canManageMembers,
    addMember,
    removeMember,
    addExpense,
    refreshMembers,
    expenses,
    expenseIds,
    isLoadingExpenses,
    fetchExpenses,
    message,
    isProcessing,
    isRefreshing: readMembersResult.isFetching,
    // Wagmi-specific values
    chainId,
    accounts,
    isConnected,
    ethersSigner,
  };
};

