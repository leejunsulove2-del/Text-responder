import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  MessageSquare,
  Smartphone,
  UserCheck,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Zap,
  Filter,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Radio,
  Image as ImageIcon,
  Trash2,
  HardDrive,
  Check,
  LogOut,
} from 'lucide-react';
import { InquiryTicket, InquiryStatus } from '../../types';
import {
  subscribeToStaffTickets,
  updateTicketStatus,
  deleteSampleInquiries,
  runAutoRetentionCleanup,
  cleanupExpiredInquiries,
  deleteTicketWithAllMessages,
  RETENTION_PERIOD_DAYS,
  isRealCustomerInquiry,
} from '../../lib/ticketService';
import { StaffChatDetailView } from './StaffChatDetailView';

interface StaffConsoleProps {
  onLogout?: () => void;
}

export const StaffConsole: React.FC<StaffConsoleProps> = ({ onLogout }) => {
  const [tickets, setTickets] = useState<InquiryTicket[]>([]);
  const [activeTab, setActiveTab] = useState<'recent_5min' | 'all_active' | 'completed'>('recent_5min');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [staffNickname, setStaffNickname] = useState(() => {
    return localStorage.getItem('staff_nickname_pref') || '일반';
  });

  // Retention cleanup status states
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupNotice, setCleanupNotice] = useState<string | null>(null);

  // Save nickname preference
  const handleNicknameChange = (name: string) => {
    setStaffNickname(name);
    localStorage.setItem('staff_nickname_pref', name);
  };

  // Open ticket detail in full screen view with browser history support
  const handleOpenTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    try {
      window.history.pushState({ staffTicketId: ticketId }, '');
    } catch (e) {
      // ignore
    }
  };

  const handleBackToList = () => {
    setSelectedTicketId(null);
  };

  // Listen to browser/Android back button
  useEffect(() => {
    const handlePopState = () => {
      setSelectedTicketId(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Subscribe to all tickets in real time and run initial auto-retention cleanup
  useEffect(() => {
    // Run automated 3-day data retention cleanup on startup
    runAutoRetentionCleanup().then((res) => {
      if (res.executed && (res.deletedTicketsCount > 0 || res.deletedMessagesCount > 0)) {
        setCleanupNotice(`자동 용량 정리 완료: 3일 경과 상담 ${res.deletedTicketsCount}건, 메시지 ${res.deletedMessagesCount}건 삭제됨`);
        setTimeout(() => setCleanupNotice(null), 6000);
      }
    });

    const unsub = subscribeToStaffTickets((list) => {
      setTickets(list);
    });
    return () => unsub();
  }, []);

  // Manual cleanup handler
  const handleManualCleanup = async () => {
    setIsCleaning(true);
    try {
      const res = await cleanupExpiredInquiries(RETENTION_PERIOD_DAYS);
      if (res.deletedTicketsCount > 0 || res.deletedMessagesCount > 0) {
        setCleanupNotice(`3일 경과 데이터 정리 완료: 상담 ${res.deletedTicketsCount}건, 메시지 ${res.deletedMessagesCount}건이 영구 삭제되었습니다.`);
      } else {
        setCleanupNotice(`3일 이상 경과된 삭제 대상 데이터가 없습니다. (모든 데이터 최신 상태)`);
      }
    } catch (e) {
      setCleanupNotice('정리 중 오류가 발생했습니다.');
    } finally {
      setIsCleaning(false);
      setTimeout(() => setCleanupNotice(null), 5000);
    }
  };

  // Single ticket deletion
  const handleDeleteTicket = async (e: React.MouseEvent, ticketId: string, ticketNo: string) => {
    e.stopPropagation();
    if (window.confirm(`[${ticketNo}] 상담 내역과 메시지를 즉시 영구 삭제하시겠습니까?`)) {
      try {
        await deleteTicketWithAllMessages(ticketId);
        setCleanupNotice(`상담 [${ticketNo}]가 영구 삭제되었습니다.`);
        setTimeout(() => setCleanupNotice(null), 4000);
      } catch (err) {
        alert('삭제에 실패했습니다.');
      }
    }
  };

  // Check if timestamp is within 5 minutes
  const isWithin5Min = (timestamp: number) => {
    return Date.now() - timestamp <= 5 * 60 * 1000;
  };

  // Relative time formatter
  const formatTimeAgo = (ts: number) => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return '방금 전';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}시간 전`;
    return new Date(ts).toLocaleDateString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filtered tickets based on active tab and search (Only show real customer inquiries or completed tickets)
  const realInquiries = tickets.filter((t) => isRealCustomerInquiry(t) || t.status === 'completed');

  const filteredTickets = realInquiries.filter((t) => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = t.customerName?.toLowerCase().includes(q);
      const matchMsg = t.lastMessage?.toLowerCase().includes(q);
      const matchNo = t.ticketNo?.toLowerCase().includes(q);
      if (!matchName && !matchMsg && !matchNo) return false;
    }

    if (activeTab === 'recent_5min') {
      // 5분 이내 신규 접수 (최근 5분 이내 생성/수정되었거나 미답변 상태)
      return t.status !== 'completed' && (isWithin5Min(t.createdAt) || isWithin5Min(t.lastMessageTime) || t.status === 'unanswered');
    }

    if (activeTab === 'completed') {
      // 응대완료 화면
      return t.status === 'completed';
    }

    // 전체 / 응대중 화면 (미완료 전체)
    return t.status !== 'completed';
  });

  const count5Min = realInquiries.filter(
    (t) => t.status !== 'completed' && (isWithin5Min(t.createdAt) || isWithin5Min(t.lastMessageTime) || t.status === 'unanswered')
  ).length;

  const countCompleted = realInquiries.filter((t) => t.status === 'completed').length;
  const countActive = realInquiries.filter((t) => t.status !== 'completed').length;

  // Clean all virtual/demo inquiries
  const handleDeleteSampleData = async () => {
    setIsCleaning(true);
    try {
      const res = await deleteSampleInquiries();
      setCleanupNotice(`가상/샘플 문의 ${res.deletedCount}건을 삭제 완료했습니다. (실제 고객 문의만 남았습니다)`);
      setTimeout(() => setCleanupNotice(null), 5000);
    } catch (e) {
      setCleanupNotice('가상 데이터 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsCleaning(false);
    }
  };

  // If a ticket is selected, switch to full-screen Staff Chat Consultation view
  if (selectedTicketId) {
    return (
      <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 py-3 animate-fadeIn">
        <StaffChatDetailView
          ticketId={selectedTicketId}
          currentAgentName={staffNickname}
          onBack={handleBackToList}
          onAgentNameChange={handleNicknameChange}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 pb-[max(4rem,calc(env(safe-area-inset-bottom)+2.5rem))] space-y-4">
      
      {/* Top Banner: Staff Nickname input & Global Status */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        {/* Left: Console Title & Real-time Indicator */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black shadow-sm flex-shrink-0">
            <Radio className="w-6 h-6 animate-pulse text-blue-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
                실시간 민원 응대 콘솔
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                실시간 연결
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              문의 항목을 선택하여 1:1 실시간 답변을 전송할 수 있습니다.
            </p>
          </div>
        </div>

        {/* Right: Staff Nickname (담당자 이름 기재) & Logout */}
        <div className="w-full md:w-auto flex items-center gap-2">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2 flex-1 md:flex-initial">
            <label htmlFor="staff-nickname-input" className="text-xs font-bold text-slate-700 whitespace-nowrap flex items-center gap-1">
              <UserCheck className="w-4 h-4 text-blue-600" />
              담당자:
            </label>
            <input
              id="staff-nickname-input"
              type="text"
              value={staffNickname}
              onChange={(e) => handleNicknameChange(e.target.value)}
              placeholder="일반"
              className="bg-white text-xs font-bold text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-36"
            />
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1 px-3 py-2.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
              title="관리자 로그아웃"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>로그아웃</span>
            </button>
          )}
        </div>

      </div>

      {/* 3-Day Firebase Storage Retention Policy Bar */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-3.5 px-4 sm:px-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-700 text-amber-300 flex items-center justify-center flex-shrink-0 font-bold">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-amber-300 tracking-wide">
                데이터 3일 보관 정책
              </span>
              <span className="text-[10px] bg-slate-700 text-slate-200 px-2 py-0.5 rounded-full font-bold">
                자동 정리 활성
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              안전한 개인정보 보호를 위해 3일이 경과한 상담 내역은 자동으로 영구 삭제됩니다.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleManualCleanup}
          disabled={isCleaning}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-100 text-xs font-bold rounded-xl border border-slate-600 transition-colors shadow-2xs whitespace-nowrap self-end sm:self-center cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isCleaning ? 'animate-spin text-amber-400' : 'text-slate-300'}`} />
          <span>{isCleaning ? '정리 중...' : '3일 지난 자료 정리'}</span>
        </button>
      </div>

      {/* Cleanup Result Notification Toast/Banner */}
      {cleanupNotice && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl p-3 px-4 text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{cleanupNotice}</span>
          </div>
          <button
            onClick={() => setCleanupNotice(null)}
            className="text-emerald-600 hover:text-emerald-800 text-xs font-black ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Navigation Tabs */}
        <div className="flex items-center bg-slate-200/80 p-1 rounded-xl border border-slate-300 text-xs font-bold">
          
          {/* 1. 5분 이내 신규 접수 */}
          <button
            type="button"
            id="tab-recent-5min"
            onClick={() => setActiveTab('recent_5min')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'recent_5min'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>⚡ 5분 이내 신규 접수</span>
            <span
              className={`px-1.5 py-0.2 text-[11px] rounded-full font-black ${
                activeTab === 'recent_5min'
                  ? 'bg-white text-rose-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              {count5Min}
            </span>
          </button>

          {/* 2. 전체 / 응대중 */}
          <button
            type="button"
            id="tab-all-active"
            onClick={() => setActiveTab('all_active')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'all_active'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>📋 전체 문의</span>
            <span
              className={`px-1.5 py-0.2 text-[11px] rounded-full font-black ${
                activeTab === 'all_active'
                  ? 'bg-white text-blue-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {countActive}
            </span>
          </button>

          {/* 3. 응대완료 화면 */}
          <button
            type="button"
            id="tab-completed"
            onClick={() => setActiveTab('completed')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'completed'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>✅ 응대완료</span>
            <span
              className={`px-1.5 py-0.2 text-[11px] rounded-full font-black ${
                activeTab === 'completed'
                  ? 'bg-white text-slate-700'
                  : 'bg-slate-300 text-slate-800'
              }`}
            >
              {countCompleted}
            </span>
          </button>

        </div>

        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="기기명, IP주소, 문의 내용 검색..."
            className="w-full pl-9 pr-4 py-2 bg-white text-xs text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
        </div>

      </div>

      {/* Main Tickets List View */}
      <div className="space-y-2.5">
        {filteredTickets.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">
                {activeTab === 'recent_5min'
                  ? '5분 이내의 신규 접수된 문의가 없습니다'
                  : activeTab === 'completed'
                  ? '응대 완료된 내역이 없습니다'
                  : '접수된 문의 내역이 없습니다'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                실제 고객이 1:1 실시간 상담창에서 문의를 등록하면 즉시 여기에 실시간으로 표시됩니다.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleDeleteSampleData}
                disabled={isCleaning}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-xs font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>남아있는 가상/샘플 민원 정리</span>
              </button>
            </div>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const is5Min = isWithin5Min(ticket.createdAt) || isWithin5Min(ticket.lastMessageTime);
            const isUnanswered = ticket.status === 'unanswered';
            const isCompleted = ticket.status === 'completed';

            return (
              <div
                key={ticket.id}
                onClick={() => handleOpenTicket(ticket.id)}
                className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer hover:shadow-md relative group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isUnanswered
                    ? 'border-rose-300 ring-1 ring-rose-200/80 bg-rose-50/20'
                    : isCompleted
                    ? 'border-slate-200 opacity-80 hover:opacity-100'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                {/* Left Content */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  
                  {/* Avatar Icon */}
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold flex-shrink-0 shadow-xs ${
                      isUnanswered
                        ? 'bg-rose-500'
                        : isCompleted
                        ? 'bg-slate-500'
                        : 'bg-blue-600'
                    }`}
                  >
                    <Smartphone className="w-5 h-5" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    
                    {/* Header line: Customer Device+IP & Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900 tracking-tight">
                        {ticket.customerName || '고객 기기 미확인'}
                      </span>

                      <span className="text-[11px] text-slate-400 font-medium">
                        ({ticket.ticketNo})
                      </span>

                      {/* Status Badges */}
                      {isUnanswered && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
                          신규 미답변
                        </span>
                      )}

                      {is5Min && !isCompleted && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                          5분 이내 접수
                        </span>
                      )}

                      {isCompleted && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700">
                          응대완료
                        </span>
                      )}
                    </div>

                    {/* Message Preview */}
                    <p className="text-xs text-slate-600 font-medium line-clamp-2 leading-relaxed flex items-center gap-1">
                      {ticket.lastMessageType === 'image' && (
                        <ImageIcon className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                      )}
                      <span>{ticket.lastMessage || '내용 없음'}</span>
                    </p>

                    {/* Meta info line */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatTimeAgo(ticket.lastMessageTime || ticket.createdAt)}
                      </span>
                      {ticket.assignedAgents && ticket.assignedAgents.length > 0 && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <UserCheck className="w-3 h-3 text-blue-600" />
                          참여: {ticket.assignedAgents.map((a) => a.name).join(', ')}
                        </span>
                      )}
                    </div>

                  </div>
                </div>

                {/* Right Action Buttons */}
                <div
                  className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Status Toggle Button */}
                  {!isCompleted ? (
                    <button
                      type="button"
                      onClick={() => updateTicketStatus(ticket.id, 'completed')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 transition-colors flex items-center gap-1"
                      title="응대완료로 변경"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>완료</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updateTicketStatus(ticket.id, 'in_progress')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200 transition-colors flex items-center gap-1"
                      title="응대중으로 복원"
                    >
                      <span>재응대</span>
                    </button>
                  )}

                  {/* Manual Delete button */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteTicket(e, ticket.id, ticket.ticketNo)}
                    className="p-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 transition-colors"
                    title="상담 내역 및 메시지 영구 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Open Reply Screen Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenTicket(ticket.id)}
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>답변하기</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

