import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  writeBatch,
  deleteField,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  InquiryTicket,
  InquiryMessage,
  AgentProfile,
  InquiryStatus,
} from '../types';
import { DEFAULT_AGENTS } from '../data/mockPresets';
import { getAutoCustomerDeviceIdentifier } from './deviceInfo';

/**
 * Remove any undefined properties so Firestore setDoc/updateDoc never fails
 */
function cleanFirestoreData<T extends Record<string, any>>(obj: T): Partial<T> {
  const clean: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      clean[key] = obj[key];
    }
  }
  return clean;
}

const TICKETS_COL = 'inquiries';
const LOCAL_CUSTOMER_KEY = 'kakao_customer_session_ticket_v3';
const LOCAL_CUSTOMER_NAME_KEY = 'kakao_customer_device_name_v3';
const LAST_CLEANUP_KEY = 'kakao_last_cleanup_timestamp_v3';

// 3 days retention policy (3 days in milliseconds: 259,200,000 ms)
export const RETENTION_PERIOD_DAYS = 3;
export const RETENTION_PERIOD_MS = RETENTION_PERIOD_DAYS * 24 * 60 * 60 * 1000;

/**
 * Generate friendly ticket code
 */
export function generateTicketNo(): string {
  const num = Math.floor(100 + Math.random() * 900);
  return `TALK-${num}`;
}

export function getLocalCustomerName(): string {
  return localStorage.getItem(LOCAL_CUSTOMER_NAME_KEY) || '';
}

export function getLocalCustomerSessionTicketId(): string {
  return localStorage.getItem(LOCAL_CUSTOMER_KEY) || '';
}

export function setLocalCustomerName(name: string) {
  localStorage.setItem(LOCAL_CUSTOMER_NAME_KEY, name.trim());
}

/**
 * Automatically retrieves or creates the customer's dedicated KakaoTalk session
 * Uses device model & client public IP by default
 * Discards tickets older than 3 days
 */
export async function getOrCreateCustomerSessionTicket(customName?: string): Promise<InquiryTicket> {
  const savedTicketId = localStorage.getItem(LOCAL_CUSTOMER_KEY);
  let authorName = customName || getLocalCustomerName();

  if (!authorName) {
    authorName = await getAutoCustomerDeviceIdentifier();
    setLocalCustomerName(authorName);
  }

  if (savedTicketId) {
    try {
      const docRef = doc(db, TICKETS_COL, savedTicketId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const ticketData = { id: snap.id, ...(snap.data() as Omit<InquiryTicket, 'id'>) };
        const lastActive = Math.max(ticketData.updatedAt || 0, ticketData.lastMessageTime || 0, ticketData.createdAt || 0);
        
        // If older than 3 days, delete local storage pointer and create a new session
        if (lastActive > 0 && Date.now() - lastActive > RETENTION_PERIOD_MS) {
          localStorage.removeItem(LOCAL_CUSTOMER_KEY);
        } else {
          // If ticket customerName was generic, update it to device name
          if (!ticketData.customerName || ticketData.customerName === '고객님') {
            ticketData.customerName = authorName;
            await updateDoc(docRef, { customerName: authorName });
          }
          return ticketData;
        }
      } else {
        localStorage.removeItem(LOCAL_CUSTOMER_KEY);
      }
    } catch (e) {
      console.warn('Could not fetch existing customer ticket, creating new one', e);
    }
  }

  // Create new session ticket
  return createNewCustomerTicket(authorName);
}

/**
 * Helper to determine if a ticket has an actual user-sent customer inquiry message
 */
export function isRealCustomerInquiry(ticket: InquiryTicket): boolean {
  if (ticket.hasCustomerMessage === true) return true;
  if (ticket.hasCustomerMessage === false) return false;
  // Fallback for legacy tickets
  const isDefaultGreeting =
    !ticket.lastMessage ||
    ticket.lastMessage === '상담이 시작되었습니다. 무엇이든 편하게 남겨주세요.' ||
    ticket.lastMessage === '[대화 대기중]';
  return !isDefaultGreeting;
}

/**
 * Create a fresh new inquiry chat session for the customer
 */
export async function createNewCustomerTicket(customName?: string): Promise<InquiryTicket> {
  const authorName = customName || (await getAutoCustomerDeviceIdentifier());
  const docRef = doc(collection(db, TICKETS_COL));
  const ticketNo = generateTicketNo();
  const customerToken = 'cust_' + Math.random().toString(36).substring(2, 12) + Date.now();
  const now = Date.now();

  const newTicket: InquiryTicket = {
    id: docRef.id,
    ticketNo,
    customerName: authorName,
    customerToken,
    status: 'unanswered',
    lastMessage: '상담이 시작되었습니다. 무엇이든 편하게 남겨주세요.',
    lastMessageType: 'text',
    lastMessageTime: now,
    assignedAgents: [],
    activeAgents: {},
    unreadStaffCount: 0, // Customer has not typed any message yet - do NOT alert staff
    unreadCustomerCount: 0,
    hasCustomerMessage: false, // Flag indicating real customer interaction
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(docRef, newTicket);
  localStorage.setItem(LOCAL_CUSTOMER_KEY, docRef.id);
  setLocalCustomerName(authorName);

  // Add welcome system message to the chatroom
  const msgDocRef = doc(collection(db, TICKETS_COL, docRef.id, 'messages'));
  const welcomeMsg: InquiryMessage = {
    id: msgDocRef.id,
    ticketId: docRef.id,
    senderType: 'system',
    senderName: '실시간 응대 시스템 안내',
    content: `반갑습니다 ${authorName}! 실시간 응대 시스템에 오신 것을 환영합니다.\n\n궁금하신 내용이나 현장 사진을 입력해 주시면, 담당자가 실시간으로 확인하여 즉시 응대해 드립니다.\n\n⚠️ 주민등록번호, 계좌번호, 비밀번호 등 민감한 개인정보는 전송하지 마세요.`,
    isInternalNote: false,
    createdAt: now,
  };
  await setDoc(msgDocRef, cleanFirestoreData(welcomeMsg));

  return newTicket;
}

/**
 * Customer sends a message (Text or Image)
 */
export async function sendCustomerMessage(params: {
  ticketId: string;
  senderName: string;
  content: string;
  imageUrl?: string;
}): Promise<void> {
  const messagesCol = collection(db, TICKETS_COL, params.ticketId, 'messages');
  const msgDocRef = doc(messagesCol);
  const now = Date.now();

  const msgData: Record<string, any> = {
    id: msgDocRef.id,
    ticketId: params.ticketId,
    senderType: 'customer',
    senderName: params.senderName || '고객님',
    content: params.content.trim(),
    isInternalNote: false,
    unreadByStaff: true,
    unreadByCustomer: false,
    createdAt: now,
  };

  if (params.imageUrl) {
    msgData.imageUrl = params.imageUrl;
  }

  await setDoc(msgDocRef, cleanFirestoreData(msgData));

  // Update ticket overview - Now it is a real active inquiry for staff to attend!
  const ticketRef = doc(db, TICKETS_COL, params.ticketId);
  const previewText = params.content.trim() || (params.imageUrl ? '📷 [사진 첨부]' : '새 문의 메시지');

  await updateDoc(ticketRef, {
    lastMessage: previewText,
    lastMessageType: params.imageUrl ? 'image' : 'text',
    lastMessageTime: now,
    status: 'unanswered', // Highlight as unanswered when customer speaks
    unreadStaffCount: 1,
    hasCustomerMessage: true, // Mark that customer has actually asked something!
    updatedAt: now,
  }).catch((err) => console.warn('Ticket update error:', err));
}

/**
 * Staff Agent sends a message (Text, Image, or Internal Whisper Note)
 */
export async function sendAgentMessage(params: {
  ticketId: string;
  agent: AgentProfile;
  content: string;
  imageUrl?: string;
  isInternalNote?: boolean;
}): Promise<void> {
  const messagesCol = collection(db, TICKETS_COL, params.ticketId, 'messages');
  const msgDocRef = doc(messagesCol);
  const now = Date.now();

  const msgData: Record<string, any> = {
    id: msgDocRef.id,
    ticketId: params.ticketId,
    senderType: 'agent',
    senderId: params.agent.id || 'agent',
    senderName: params.agent.name || '담당자',
    senderRole: params.agent.role || '상담관',
    senderDepartment: params.agent.department || '고객지원',
    senderAvatarColor: params.agent.avatarColor || '#3B82F6',
    content: params.content.trim(),
    isInternalNote: !!params.isInternalNote,
    unreadByCustomer: !params.isInternalNote,
    unreadByStaff: false,
    createdAt: now,
  };

  if (params.imageUrl) {
    msgData.imageUrl = params.imageUrl;
  }

  await setDoc(msgDocRef, cleanFirestoreData(msgData));

  // Update ticket status
  const ticketRef = doc(db, TICKETS_COL, params.ticketId);

  // Check if agent is already in assigned list, if not add them
  try {
    const snap = await getDoc(ticketRef);
    if (snap.exists()) {
      const data = snap.data() as InquiryTicket;
      const currentAssigned = data.assignedAgents || [];
      const hasAgent = currentAssigned.some((a) => a.id === params.agent.id);
      const updatedAssigned = hasAgent ? currentAssigned : [...currentAssigned, params.agent];

      const previewText = params.isInternalNote
        ? `[내부메모: ${params.agent.name}] ${params.content.trim()}`
        : params.content.trim() || (params.imageUrl ? '📷 [사진]' : '담당자 답변');

      const payload: Record<string, any> = {
        lastMessage: previewText,
        lastMessageType: params.isInternalNote ? 'internal' : params.imageUrl ? 'image' : 'text',
        lastMessageTime: now,
        assignedAgents: updatedAssigned,
        updatedAt: now,
      };

      if (!params.isInternalNote) {
        payload.status = 'in_progress';
        payload.unreadStaffCount = 0;
        payload.unreadCustomerCount = 1;
      }

      await updateDoc(ticketRef, cleanFirestoreData(payload));
    }
  } catch (err) {
    console.warn('Update ticket after agent message error:', err);
  }
}

/**
 * Subscribe to all tickets for staff dashboard
 */
export function subscribeToStaffTickets(
  callback: (tickets: InquiryTicket[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, TICKETS_COL), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: InquiryTicket[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...(docSnap.data() as Omit<InquiryTicket, 'id'>) });
      });
      callback(list);
    },
    (err) => {
      console.error('subscribeToStaffTickets error', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe to a single ticket details
 */
export function subscribeToTicket(
  ticketId: string,
  callback: (ticket: InquiryTicket | null) => void,
  onError?: (err: Error) => void
) {
  const docRef = doc(db, TICKETS_COL, ticketId);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...(snapshot.data() as Omit<InquiryTicket, 'id'>) });
      } else {
        callback(null);
      }
    },
    (err) => {
      console.error('subscribeToTicket error', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe to messages in a specific ticket
 */
export function subscribeToTicketMessages(
  ticketId: string,
  callback: (messages: InquiryMessage[]) => void,
  onError?: (err: Error) => void
) {
  const messagesCol = collection(db, TICKETS_COL, ticketId, 'messages');
  const q = query(messagesCol, orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const messages: InquiryMessage[] = [];
      snapshot.forEach((docSnap) => {
        messages.push({ id: docSnap.id, ...(docSnap.data() as Omit<InquiryMessage, 'id'>) });
      });
      callback(messages);
    },
    (err) => {
      console.error('subscribeToTicketMessages error', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Update Agent Live Presence in a chat room
 */
export async function updateAgentPresence(
  ticketId: string,
  agent: AgentProfile,
  isTyping: boolean = false
): Promise<void> {
  try {
    const ticketRef = doc(db, TICKETS_COL, ticketId);
    const key = `activeAgents.${agent.id}`;
    await updateDoc(ticketRef, {
      [key]: {
        agentId: agent.id,
        agentName: agent.name,
        department: agent.department,
        avatarColor: agent.avatarColor,
        lastActive: Date.now(),
        isTyping,
      },
    });
  } catch (e) {
    // ignore
  }
}

/**
 * Remove Agent Presence when leaving
 */
export async function removeAgentPresence(ticketId: string, agentId: string): Promise<void> {
  try {
    const ticketRef = doc(db, TICKETS_COL, ticketId);
    const key = `activeAgents.${agentId}`;
    await updateDoc(ticketRef, {
      [key]: deleteField(),
    });
  } catch (e) {
    // ignore
  }
}

/**
 * Update Status (unanswered / in_progress / completed)
 */
export async function updateTicketStatus(
  ticketId: string,
  status: InquiryStatus
): Promise<void> {
  const ticketRef = doc(db, TICKETS_COL, ticketId);
  await updateDoc(ticketRef, {
    status,
    updatedAt: Date.now(),
    ...(status === 'completed' ? { unreadStaffCount: 0 } : {}),
  });
}

/**
 * Delete a ticket if needed
 */
export async function deleteTicket(ticketId: string): Promise<void> {
  const ticketRef = doc(db, TICKETS_COL, ticketId);
  await deleteDoc(ticketRef);
}

/**
 * Mark messages as read by customer
 */
export async function markAsReadByCustomer(ticketId: string): Promise<void> {
  try {
    const ticketRef = doc(db, TICKETS_COL, ticketId);
    await updateDoc(ticketRef, {
      unreadCustomerCount: 0,
    });
  } catch (e) {
    // ignore
  }
}

/**
 * Mark messages as read by staff
 */
export async function markAsReadByStaff(ticketId: string): Promise<void> {
  try {
    const ticketRef = doc(db, TICKETS_COL, ticketId);
    await updateDoc(ticketRef, {
      unreadStaffCount: 0,
    });
  } catch (e) {
    // ignore
  }
}

/**
 * Permanently delete all virtual/demo sample inquiries and un-sent empty greeting tickets from Firestore
 */
export async function deleteSampleInquiries(): Promise<{ deletedCount: number }> {
  try {
    const snap = await getDocs(collection(db, TICKETS_COL));
    const sampleKeywords = [
      'TALK-881',
      'TALK-512',
      'TALK-429',
      '보도블록',
      '자동차세',
      '맞춤돌봄',
      '175.223.88.19',
      '211.195.42.12',
      '121.160.84.19',
    ];

    let deletedCount = 0;
    for (const docSnap of snap.docs) {
      const data = docSnap.data() as InquiryTicket;
      const isSample =
        sampleKeywords.some((kw) => data.ticketNo?.includes(kw)) ||
        sampleKeywords.some((kw) => data.customerName?.includes(kw)) ||
        sampleKeywords.some((kw) => data.lastMessage?.includes(kw));

      const isUnsentGhost =
        data.hasCustomerMessage === false ||
        (data.lastMessage === '상담이 시작되었습니다. 무엇이든 편하게 남겨주세요.' &&
          !data.hasCustomerMessage &&
          data.status !== 'completed');

      if (isSample || isUnsentGhost) {
        await deleteTicketWithAllMessages(docSnap.id);
        deletedCount++;
      }
    }
    return { deletedCount };
  } catch (err) {
    console.error('deleteSampleInquiries error:', err);
    return { deletedCount: 0 };
  }
}

/**
 * Seed realistic initial demo data (DISABLED: ONLY REAL INQUIRIES FROM USERS)
 */
export async function seedSampleInquiries(): Promise<void> {
  // Disabled permanently so only real human inquiries are preserved
  return Promise.resolve();
}

/**
 * Delete a ticket along with all its subcollection messages to prevent orphaned storage
 */
export async function deleteTicketWithAllMessages(ticketId: string): Promise<{ deletedMessages: number }> {
  try {
    const msgsCol = collection(db, TICKETS_COL, ticketId, 'messages');
    const msgSnap = await getDocs(msgsCol);
    
    // Batch delete messages
    let batch = writeBatch(db);
    let count = 0;
    for (const docSnap of msgSnap.docs) {
      batch.delete(docSnap.ref);
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }
    
    // Delete ticket document
    batch.delete(doc(db, TICKETS_COL, ticketId));
    await batch.commit();

    return { deletedMessages: msgSnap.size };
  } catch (err) {
    console.error(`deleteTicketWithAllMessages (${ticketId}) error:`, err);
    throw err;
  }
}

/**
 * Cleanup all inquiry tickets and messages older than 3 days (Retention Policy)
 * Firebase storage optimization: Permanently deletes expired consultation data
 */
export async function cleanupExpiredInquiries(maxDays: number = RETENTION_PERIOD_DAYS): Promise<{
  deletedTicketsCount: number;
  deletedMessagesCount: number;
}> {
  const threshold = Date.now() - maxDays * 24 * 60 * 60 * 1000;
  let deletedTicketsCount = 0;
  let deletedMessagesCount = 0;

  try {
    const snap = await getDocs(collection(db, TICKETS_COL));
    const expiredTicketIds: string[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data() as InquiryTicket;
      const latestActivityTime = Math.max(
        data.updatedAt || 0,
        data.lastMessageTime || 0,
        data.createdAt || 0
      );
      // If the latest activity is older than threshold (3 days)
      if (latestActivityTime > 0 && latestActivityTime < threshold) {
        expiredTicketIds.push(docSnap.id);
      }
    });

    for (const ticketId of expiredTicketIds) {
      const res = await deleteTicketWithAllMessages(ticketId);
      deletedMessagesCount += res.deletedMessages;
      deletedTicketsCount += 1;
    }

    return { deletedTicketsCount, deletedMessagesCount };
  } catch (err) {
    console.error('cleanupExpiredInquiries error:', err);
    throw err;
  }
}

/**
 * Automated retention cleanup runner
 * Automatically triggered when staff or app loads (throttled to avoid redundant operations)
 */
export async function runAutoRetentionCleanup(force: boolean = false): Promise<{
  executed: boolean;
  deletedTicketsCount: number;
  deletedMessagesCount: number;
}> {
  const lastRun = Number(localStorage.getItem(LAST_CLEANUP_KEY) || 0);
  const now = Date.now();

  // Run automatically if never run or > 30 minutes since last check, unless forced
  if (!force && now - lastRun < 30 * 60 * 1000) {
    return { executed: false, deletedTicketsCount: 0, deletedMessagesCount: 0 };
  }

  try {
    const result = await cleanupExpiredInquiries(RETENTION_PERIOD_DAYS);
    localStorage.setItem(LAST_CLEANUP_KEY, String(now));
    return { executed: true, ...result };
  } catch (err) {
    console.warn('Auto retention cleanup runner error:', err);
    return { executed: false, deletedTicketsCount: 0, deletedMessagesCount: 0 };
  }
}

/**
 * Get count of active vs expired data
 */
export async function getRetentionStats(maxDays: number = RETENTION_PERIOD_DAYS): Promise<{
  totalTickets: number;
  expiredTickets: number;
  retentionDays: number;
}> {
  const threshold = Date.now() - maxDays * 24 * 60 * 60 * 1000;
  try {
    const snap = await getDocs(collection(db, TICKETS_COL));
    let total = 0;
    let expired = 0;
    snap.forEach((docSnap) => {
      total++;
      const data = docSnap.data() as InquiryTicket;
      const latestActivityTime = Math.max(
        data.updatedAt || 0,
        data.lastMessageTime || 0,
        data.createdAt || 0
      );
      if (latestActivityTime > 0 && latestActivityTime < threshold) {
        expired++;
      }
    });
    return { totalTickets: total, expiredTickets: expired, retentionDays: maxDays };
  } catch (e) {
    return { totalTickets: 0, expiredTickets: 0, retentionDays: maxDays };
  }
}

