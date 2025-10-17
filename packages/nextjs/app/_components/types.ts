export interface GroupMember {
  id: string;
  name: string;
  avatar?: string;
  balance?: number;
  isCurrentUser?: boolean;
  isAdmin?: boolean;
}

export interface GroupInfo {
  id: string;
  name: string;
  createdDate: string;
  icon?: React.ReactNode;
}

