export type InquiryStatus = 'unanswered' | 'in_progress' | 'completed';

export interface AgentProfile {
  id: string;
  name: string;
  department: string;
  role: string;
  avatarColor: string;
  avatarIcon?: string;
}

export interface ActiveAgentPresence {
  agentId: string;
  agentName: string;
  department: string;
  avatarColor: string;
  lastActive: number; // timestamp ms
  isTyping?: boolean;
}

export interface InquiryMessage {
  id: string;
  ticketId: string;
  senderType: 'customer' | 'agent' | 'system';
  senderId?: string;
  senderName: string;
  senderRole?: string;
  senderDepartment?: string;
  senderAvatarColor?: string;
  content: string;
  imageUrl?: string; // Base64 data URL or image link
  isInternalNote?: boolean; // If true, only staff/admins can see this (내부 메모)
  unreadByCustomer?: boolean;
  unreadByStaff?: boolean;
  createdAt: number; // timestamp
}

export interface InquiryTicket {
  id: string; // Document ID
  ticketNo: string; // e.g. "TALK-204"
  customerName: string; // e.g. "김민수 고객님"
  customerContact?: string;
  customerToken: string; // unique secret token saved in localStorage for customer auto-login
  status: InquiryStatus;
  category?: string;
  
  // Last message preview for the staff list
  lastMessage: string;
  lastMessageType?: 'text' | 'image' | 'internal';
  lastMessageTime: number;
  
  // Assigned staff members
  assignedAgents: AgentProfile[];
  
  // Real-time simultaneous presence of staff on this ticket
  activeAgents?: Record<string, ActiveAgentPresence>;
  
  // Unread count indicators
  unreadStaffCount: number; // Unanswered / new message count for staff
  unreadCustomerCount: number; // Unread messages for customer
  hasCustomerMessage?: boolean; // True only when customer actually typed/sent a message
  
  // Internal staff summary / note
  internalSummary?: string;
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
}

export interface QuickTemplate {
  id: string;
  title: string;
  category: string;
  content: string;
}
