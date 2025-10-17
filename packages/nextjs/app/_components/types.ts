export interface GroupMember {
  id: string;
  name: string;
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
