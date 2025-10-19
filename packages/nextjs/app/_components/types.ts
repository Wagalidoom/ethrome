export interface GroupMember {
  id: string;
  name: string;
  address: string;
  avatar?: string;
  balance?: number;
  isCurrentUser?: boolean;
  isOwner?: boolean;
}

export interface GroupInfo {
  id: string;
  name: string;
  createdDate: string;
  icon?: React.ReactNode;
}

// Contract-aligned expense type
export interface Expense {
  id: string;
  groupId: string;
  payer: string; // address
  description: string;
  createdAt: number; // timestamp
  exists: boolean;
}

// Extended expense with share information for UI display
export interface ExpenseWithShares extends Expense {
  shares: {
    member: string; // address
    memberName?: string; // display name (from member lookup)
    amount: bigint; // encrypted share amount (will need decryption)
  }[];
  totalAmount: bigint; // sum of all shares (if decrypted)
  payerName?: string; // display name for payer
}
