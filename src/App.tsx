import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { HomePortalView } from './components/home/HomePortalView';
import { KakaoChatView } from './components/customer/KakaoChatView';
import { StaffConsole } from './components/staff/StaffConsole';
import { InquiryTicket, InquiryMessage } from './types';
import {
  deleteSampleInquiries,
  subscribeToStaffTickets,
  subscribeToTicketMessages,
  getLocalCustomerSessionTicketId,
  isRealCustomerInquiry,
} from './lib/ticketService';
import {
  registerServiceWorker,
  sendBrowserNotification,
} from './lib/notificationService';

const SESSION_ROLE_KEY = 'app_user_session_role_v3';

export default function App() {
  // Read initial role from localStorage so session persists across app restarts
  const [currentView, setCurrentView] = useState<'landing' | 'customer' | 'staff' | 'split'>(() => {
    const saved = localStorage.getItem(SESSION_ROLE_KEY);
    if (saved === 'customer' || saved === 'staff' || saved === 'split') {
      return saved as 'customer' | 'staff' | 'split';
    }
    // If a customer previously created a ticket on this device, restore customer chat directly
    const customerTicketId = getLocalCustomerSessionTicketId();
    if (customerTicketId) {
      return 'customer';
    }
    return 'landing';
  });

  const [unansweredCount, setUnansweredCount] = useState(0);

  // References for tracking incoming messages for notifications
  const lastStaffNotifiedMsgTime = useRef<number>(Date.now());
  const lastCustomerNotifiedMsgTime = useRef<number>(Date.now());

  // Save session role changes to localStorage
  const handleViewChange = (view: 'landing' | 'customer' | 'staff' | 'split') => {
    setCurrentView(view);
    if (view === 'landing') {
      localStorage.removeItem(SESSION_ROLE_KEY);
    } else {
      localStorage.setItem(SESSION_ROLE_KEY, view);
    }
  };

  // Logout handler to return to landing screen
  const handleLogout = () => {
    handleViewChange('landing');
  };

  // Initialize service worker and cleanup any old virtual/demo inquiries
  useEffect(() => {
    registerServiceWorker();

    // Automatically remove any mock/virtual demo data so only real human inquiries exist
    deleteSampleInquiries()
      .then((res) => {
        if (res.deletedCount > 0) {
          console.log(`Cleaned up ${res.deletedCount} virtual/demo inquiries.`);
        }
      })
      .catch((e) => console.log('Sample cleanup info:', e));
  }, []);

  // Global ticket subscription for counts & Staff background notifications
  useEffect(() => {
    const unsub = subscribeToStaffTickets((tickets) => {
      const isWithin5Min = (t: InquiryTicket) =>
        Date.now() - (t.lastMessageTime || t.createdAt) <= 5 * 60 * 1000;

      // Only consider tickets where customer actually asked a question or completed
      const realInquiries = tickets.filter(isRealCustomerInquiry);

      const unreplied = realInquiries.filter(
        (t) => t.status === 'unanswered' || (t.status !== 'completed' && isWithin5Min(t))
      );
      setUnansweredCount(unreplied.length);

      // If user is currently in Staff view, trigger notification on new customer message
      if (currentView === 'staff' || currentView === 'split') {
        const latestMsgTicket = realInquiries
          .filter((t) => t.lastMessageTime && t.lastMessageTime > lastStaffNotifiedMsgTime.current)
          .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0))[0];

        if (latestMsgTicket && latestMsgTicket.lastMessageTime) {
          // Check if the latest message was from customer
          if (latestMsgTicket.unreadStaffCount > 0) {
            sendBrowserNotification({
              title: `💬 [${latestMsgTicket.customerName || '고객'}] 새 문의 접수`,
              body: `${latestMsgTicket.lastMessage || '새로운 고객 메시지가 도착했습니다.'} (${latestMsgTicket.ticketNo || ''})`,
              tag: `staff-ticket-${latestMsgTicket.id}`,
            });
          }
          lastStaffNotifiedMsgTime.current = latestMsgTicket.lastMessageTime;
        }
      }
    });

    return () => unsub();
  }, [currentView]);

  // Customer view background notification for Staff responses
  useEffect(() => {
    if (currentView !== 'customer' && currentView !== 'split') return;

    const customerTicketId = getLocalCustomerSessionTicketId();
    if (!customerTicketId) return;

    const unsubMsg = subscribeToTicketMessages(customerTicketId, (messages: InquiryMessage[]) => {
      if (messages.length === 0) return;
      const latest = messages[messages.length - 1];

      // If latest message is from staff/agent and created after our baseline
      if (
        latest.senderType === 'agent' &&
        latest.createdAt > lastCustomerNotifiedMsgTime.current
      ) {
        sendBrowserNotification({
          title: `🔔 한국전력 [${latest.senderName}] 담당자 답변`,
          body: latest.content || '사진을 전송했습니다.',
          tag: `cust-msg-${latest.id}`,
        });
        lastCustomerNotifiedMsgTime.current = latest.createdAt;
      }
    });

    return () => unsubMsg();
  }, [currentView]);

  return (
    <div className="min-h-[100dvh] bg-slate-100 text-slate-900 flex flex-col font-sans antialiased selection:bg-amber-400 selection:text-black overflow-x-hidden">
      {/* If not landing, display top navigation header */}
      {currentView !== 'landing' && (
        <Header
          currentView={currentView}
          onViewChange={handleViewChange}
          onLogout={handleLogout}
          unansweredCount={unansweredCount}
        />
      )}

      {/* Main View Router */}
      <main className="flex-1 flex flex-col">
        {/* 1. Landing / Portal Screen */}
        {currentView === 'landing' && (
          <HomePortalView
            onStartInquiry={() => handleViewChange('customer')}
            onLoginAdmin={() => handleViewChange('staff')}
            unansweredCount={unansweredCount}
          />
        )}

        {/* 2. Customer 1:1 Consultation View */}
        {currentView === 'customer' && (
          <div className="flex-1 flex items-center justify-center p-0 sm:p-4 animate-fadeIn">
            <KakaoChatView
              onSwitchToStaff={() => handleViewChange('staff')}
              onBackToHome={handleLogout}
            />
          </div>
        )}

        {/* 3. Staff Multi-Agent Response Console */}
        {currentView === 'staff' && (
          <div className="flex-1 animate-fadeIn">
            <StaffConsole onLogout={handleLogout} />
          </div>
        )}

        {/* 4. Dual Split Mode */}
        {currentView === 'split' && (
          <div className="flex-1 max-w-[1600px] w-full mx-auto p-2 sm:p-4 grid grid-cols-1 xl:grid-cols-12 gap-4 animate-fadeIn">
            {/* Left: Customer mobile UI (5 cols) */}
            <div className="xl:col-span-5 flex flex-col">
              <div className="bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-t-2xl flex items-center justify-between border-b border-slate-700">
                <span>[고객 시점] 1:1 실시간 상담 화면</span>
                <span className="text-[10px] bg-amber-400 text-black px-2 py-0.5 rounded-full font-bold">
                  고객용
                </span>
              </div>
              <div className="flex-1 bg-white rounded-b-2xl shadow-sm border border-slate-200 overflow-hidden flex justify-center p-2">
                <KakaoChatView
                  onSwitchToStaff={() => handleViewChange('staff')}
                  onBackToHome={handleLogout}
                />
              </div>
            </div>

            {/* Right: Multi-Agent Group Console (7 cols) */}
            <div className="xl:col-span-7 flex flex-col">
              <div className="bg-blue-900 text-white text-xs font-bold px-4 py-2 rounded-t-2xl flex items-center justify-between border-b border-blue-800">
                <span>[담당자 시점] 실시간 민원 응대 콘솔</span>
                <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">
                  관리자용
                </span>
              </div>
              <div className="flex-1 bg-white rounded-b-2xl shadow-sm border border-slate-200 overflow-hidden p-2">
                <StaffConsole onLogout={handleLogout} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
