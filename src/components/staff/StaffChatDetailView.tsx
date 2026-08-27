import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Image as ImageIcon,
  Plus,
  X,
  Shield,
  CheckCircle2,
  Lock,
  Smartphone,
  ChevronLeft,
  Loader2,
  Trash2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  InquiryTicket,
  InquiryMessage,
  AgentProfile,
  ActiveAgentPresence,
  InquiryStatus,
} from '../../types';
import {
  subscribeToTicket,
  subscribeToTicketMessages,
  sendAgentMessage,
  updateAgentPresence,
  removeAgentPresence,
  updateTicketStatus,
  deleteTicketWithAllMessages,
  markAsReadByStaff,
} from '../../lib/ticketService';
import { compressImage } from '../../lib/imageCompressor';

interface StaffChatDetailViewProps {
  ticketId: string;
  currentAgentName: string;
  currentAgentDepartment?: string;
  onBack: () => void;
  onAgentNameChange?: (name: string) => void;
}

export const StaffChatDetailView: React.FC<StaffChatDetailViewProps> = ({
  ticketId,
  currentAgentName,
  currentAgentDepartment = '실시간 상담팀',
  onBack,
  onAgentNameChange,
}) => {
  const [ticket, setTicket] = useState<InquiryTicket | null>(null);
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const staffNickname = currentAgentName.trim() || '일반';

  // Construct current agent object
  const activeAgent: AgentProfile = {
    id: `agent_${staffNickname.replace(/\s+/g, '_')}`,
    name: staffNickname,
    department: currentAgentDepartment,
    role: '담당자',
    avatarColor: '#2563EB',
  };

  // Subscribe to ticket & messages
  useEffect(() => {
    const unsubTicket = subscribeToTicket(ticketId, (t) => {
      setTicket(t);
      if (t) markAsReadByStaff(ticketId);
    });

    const unsubMessages = subscribeToTicketMessages(ticketId, (msgs) => {
      setMessages(msgs);
      markAsReadByStaff(ticketId);
    });

    // Update presence
    updateAgentPresence(ticketId, activeAgent, false);
    const interval = setInterval(() => {
      updateAgentPresence(ticketId, activeAgent, false);
    }, 20000);

    return () => {
      clearInterval(interval);
      removeAgentPresence(ticketId, activeAgent.id);
      unsubTicket();
      unsubMessages();
    };
  }, [ticketId, staffNickname]);

  // Auto scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedImage]);

  // Image Upload handler
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const compressedDataUrl = await compressImage(file, 1080, 1080, 0.8);
      setSelectedImage(compressedDataUrl);
    } catch (err) {
      console.error('Image compression failed', err);
      alert('이미지 처리 중 오류가 발생했습니다.');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Send Message handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!ticket) return;
    if (!inputText.trim() && !selectedImage) return;

    try {
      setIsSending(true);
      await sendAgentMessage({
        ticketId: ticket.id,
        agent: activeAgent,
        content: inputText.trim(),
        imageUrl: selectedImage || undefined,
        isInternalNote,
      });

      setInputText('');
      setSelectedImage(null);
      setIsInternalNote(false);
    } catch (err) {
      console.error('Failed to send agent reply', err);
      alert('답변 전송에 실패했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  // Status toggle handler
  const handleToggleStatus = async (newStatus: InquiryStatus) => {
    if (!ticket) return;
    await updateTicketStatus(ticket.id, newStatus);
  };

  // Delete ticket handler
  const handleDelete = async () => {
    if (confirm('이 문의 상담 내역 및 메시지를 완전히 삭제하시겠습니까?')) {
      try {
        setIsDeleting(true);
        await deleteTicketWithAllMessages(ticketId);
        onBack();
      } catch (e) {
        alert('삭제 중 오류가 발생했습니다.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? '오후' : '오전';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${ampm} ${hours}:${minutes}`;
  };

  // Active presences
  const activeAgentPresences = (Object.values(ticket?.activeAgents || {}) as ActiveAgentPresence[]).filter(
    (a) => a && Date.now() - a.lastActive < 45000
  );

  const quickTemplates = [
    { title: '표준 인사', text: `안녕하세요 ${staffNickname} 주무관입니다. 문의해주신 내용 신속히 확인하여 답변드리겠습니다.` },
    { title: '상세위치 요청', text: '정확하고 빠른 현장 처리를 위해 발생 장소의 상세 위치(주소 또는 인근 전신주 번호)를 알려주시면 감사하겠습니다.' },
    { title: '현장 긴급접수', text: '접수해주신 현장 상황을 유관 부서에 긴급 전달하였으며, 담당 직원이 즉시 출동하여 조치 후 안내드리겠습니다.' },
    { title: '조치완료 안내', text: '문의하신 사항에 대한 조치가 완료되었습니다. 추가 문의가 있으시면 언제든 말씀해주세요. 감사합니다!' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col h-[100dvh] sm:h-[840px] bg-[#BACEE0] sm:rounded-3xl shadow-xl overflow-hidden border border-slate-300 relative animate-in fade-in duration-200">
      
      {/* Top Header Bar with Safe Area Top */}
      <div className="bg-[#9AB0C5] px-3 sm:px-5 pt-[max(10px,env(safe-area-inset-top))] pb-3 border-b border-black/10 flex items-center justify-between text-slate-900 select-none shadow-xs z-10">
        <div className="flex items-center gap-3">
          {/* Back button to return to inquiry list */}
          <button
            type="button"
            id="btn-back-to-list"
            onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900/10 hover:bg-slate-900/20 active:scale-95 text-slate-900 font-bold rounded-xl transition-all cursor-pointer text-xs sm:text-sm"
            title="목록으로 이동"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>목록으로</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-black shadow-inner text-xs ring-2 ring-white/60 flex-shrink-0">
              상담
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                  {ticket?.customerName || '고객 1:1 상담'}
                </h2>
                {ticket?.status === 'unanswered' ? (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold shadow-2xs">
                    미답변
                  </span>
                ) : ticket?.status === 'completed' ? (
                  <span className="px-2 py-0.5 rounded-full bg-slate-600 text-white text-[10px] font-bold">
                    응대완료
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                    응대중
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-700 flex items-center gap-1 font-medium mt-0.5">
                <Smartphone className="w-3 h-3 text-slate-600" />
                <span className="truncate max-w-[120px] sm:max-w-none">{ticket?.customerName}</span>
                <span className="text-slate-500 font-mono text-[10px]">({ticket?.ticketNo})</span>
              </p>
            </div>
          </div>
        </div>

        {/* Status Toggle & Delete Actions */}
        <div className="flex items-center gap-2">
          {ticket?.status !== 'completed' ? (
            <button
              type="button"
              id="btn-detail-complete"
              onClick={() => setShowCompleteConfirm(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
              title="상담 완료 처리"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">응대완료</span>
              <span className="sm:hidden">완료</span>
            </button>
          ) : (
            <button
              type="button"
              id="btn-detail-reopen"
              onClick={() => handleToggleStatus('in_progress')}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
              title="다시 응대중으로 전환"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>재응대</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
            title="상담 내역 영구 삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Staff Identity & Multi-Agent Presence Ribbon */}
      <div className="bg-slate-800 text-white px-3 sm:px-5 py-2 text-xs flex flex-wrap items-center justify-between gap-2 shadow-inner">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px] whitespace-nowrap">작성자(닉네임):</span>
          <input
            type="text"
            value={currentAgentName}
            onChange={(e) => onAgentNameChange && onAgentNameChange(e.target.value)}
            placeholder="일반"
            className="bg-slate-700 text-amber-300 font-bold px-2 py-0.5 rounded text-xs border border-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400 max-w-[130px]"
          />
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            동시 접속: {activeAgentPresences.length}명
            {activeAgentPresences.length > 0 && ` (${activeAgentPresences.map((a) => a.agentName).join(', ')})`}
          </span>
        </div>
      </div>

      {/* Messages Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 scroll-smooth">
        
        {/* Date separator */}
        <div className="flex justify-center my-1">
          <span className="bg-black/15 text-white text-[11px] font-medium px-3 py-0.5 rounded-full shadow-2xs">
            {new Date().toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </span>
        </div>

        {/* Messages Loop */}
        {messages.map((msg) => {
          const isCustomer = msg.senderType === 'customer';
          const isSystem = msg.senderType === 'system';
          const isInternal = !!msg.isInternalNote;

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <div className="bg-black/20 text-white text-xs px-3 py-1.5 rounded-xl max-w-[90%] text-center shadow-2xs whitespace-pre-line leading-relaxed">
                  {msg.content}
                </div>
              </div>
            );
          }

          if (isInternal) {
            // Internal whisper note (Staff only)
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <div className="bg-amber-100 border border-amber-300 text-amber-900 rounded-xl p-2.5 max-w-[92%] shadow-xs text-xs">
                  <div className="flex items-center gap-1.5 font-bold mb-1 text-amber-800">
                    <Lock className="w-3.5 h-3.5" />
                    <span>[내부 협의 비공개 메모] {msg.senderName}</span>
                    <span className="text-[10px] text-amber-600 font-normal ml-auto">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-line text-slate-800">{msg.content}</p>
                </div>
              </div>
            );
          }

          if (isCustomer) {
            // Customer message on Left (Yellow bubble)
            return (
              <div key={msg.id} className="flex items-start gap-2 pr-6 sm:pr-12">
                <div className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm ring-1 ring-black/10 mt-0.5">
                  고객
                </div>

                <div className="flex flex-col max-w-[85%]">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-bold text-slate-800">
                      {msg.senderName}
                    </span>
                    <span className="text-[10px] bg-slate-400/20 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                      고객 문의
                    </span>
                  </div>

                  <div className="flex items-end gap-1.5">
                    <div className="bg-[#FEE500] text-[#191919] px-3.5 py-2 rounded-2xl rounded-tl-xs shadow-xs text-xs sm:text-sm leading-relaxed break-words font-sans border border-black/5">
                      {msg.imageUrl && (
                        <div className="mb-2 overflow-hidden rounded-lg cursor-pointer border border-black/10 hover:opacity-95 transition-opacity">
                          <img
                            src={msg.imageUrl}
                            alt="고객 첨부 사진"
                            className="w-full max-h-64 object-cover"
                            onClick={() => setLightboxImage(msg.imageUrl || null)}
                          />
                        </div>
                      )}
                      {msg.content && <p className="whitespace-pre-line">{msg.content}</p>}
                    </div>

                    <div className="text-[10px] text-slate-600 pb-0.5 whitespace-nowrap">
                      {formatTime(msg.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // Agent Reply Bubble (Right Side White Bubble)
          return (
            <div key={msg.id} className="flex justify-end items-end gap-1.5 pl-6 sm:pl-12 group">
              <div className="flex flex-col items-end text-[10px] text-slate-600 pb-0.5">
                <span className="text-blue-700 font-semibold text-[9px]">{msg.senderName}</span>
                <span>{formatTime(msg.createdAt)}</span>
              </div>

              <div className="relative max-w-[85%]">
                <div className="bg-white text-[#191919] px-3.5 py-2 rounded-2xl rounded-tr-xs shadow-xs text-xs sm:text-sm leading-relaxed break-words font-sans border border-black/5">
                  {msg.imageUrl && (
                    <div className="mb-2 overflow-hidden rounded-lg cursor-pointer border border-slate-200 hover:opacity-95 transition-opacity">
                      <img
                        src={msg.imageUrl}
                        alt="담당자 첨부 사진"
                        className="w-full max-h-64 object-cover"
                        onClick={() => setLightboxImage(msg.imageUrl || null)}
                      />
                    </div>
                  )}
                  {msg.content && <p className="whitespace-pre-line">{msg.content}</p>}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Templates Drawer */}
      {showTemplates && (
        <div className="bg-white border-t border-slate-300 p-3 space-y-2 shadow-md animate-in slide-in-from-bottom-2 duration-150 z-20">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              자주 쓰는 상담 템플릿 (원클릭 입력)
            </span>
            <button
              onClick={() => setShowTemplates(false)}
              className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {quickTemplates.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInputText(tmpl.text);
                  setShowTemplates(false);
                }}
                className="text-left p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer"
              >
                <p className="text-xs font-bold text-slate-800">{tmpl.title}</p>
                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{tmpl.text}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Image Preview Pill */}
      {selectedImage && (
        <div className="bg-slate-100 p-2.5 border-t border-slate-200 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <img
              src={selectedImage}
              alt="첨부 예정 이미지"
              className="w-12 h-12 object-cover rounded-xl border border-slate-300 shadow-xs"
            />
            <div>
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                사진 첨부됨
              </span>
              <span className="text-[10px] text-slate-500 block">고객에게 함께 전송됩니다</span>
            </div>
          </div>
          <button
            onClick={() => setSelectedImage(null)}
            className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-full cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Staff Reply Control Panel with Safe Area Bottom Padding */}
      <div className="bg-white border-t border-slate-200/90 px-3 sm:px-4 pt-2.5 pb-[max(20px,calc(env(safe-area-inset-bottom)+8px))] z-10 shadow-lg">
        
        {/* Internal Memo Toggle & Template Buttons */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsInternalNote(!isInternalNote)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                isInternalNote
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isInternalNote ? '비공개 메모 중' : '내부 메모'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-medium cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>상담 템플릿</span>
            </button>
          </div>
        </div>

        {/* Input & Send Form */}
        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          {/* Image Attach */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageChange}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            id="staff-image-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isCompressing}
            title="사진 첨부"
            className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0 active:scale-95 cursor-pointer"
          >
            {isCompressing ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            ) : (
              <Plus className="w-5 h-5 text-slate-600" />
            )}
          </button>

          {/* Textarea */}
          <div
            className={`flex-1 rounded-2xl px-3.5 py-2 border transition-all flex items-center ${
              isInternalNote
                ? 'bg-amber-50/80 border-amber-300 focus-within:ring-2 focus-within:ring-amber-500'
                : 'bg-slate-100/90 border-slate-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500'
            }`}
          >
            <textarea
              id="staff-chat-textarea"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                isInternalNote
                  ? '담당자 공유용 비공개 메모를 입력하세요'
                  : `답변 내용을 입력하세요 (Enter: 전송)`
              }
              className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder-slate-400 resize-none max-h-28 min-h-[26px] focus:outline-none leading-relaxed"
              rows={1}
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            id="staff-send-btn"
            disabled={(!inputText.trim() && !selectedImage) || isSending}
            className={`p-3 rounded-full font-bold transition-all shadow-xs flex-shrink-0 flex items-center justify-center active:scale-95 ${
              inputText.trim() || selectedImage
                ? isInternalNote
                  ? 'bg-amber-500 text-white hover:bg-amber-600 cursor-pointer'
                  : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            title={isInternalNote ? '내부 메모 저장' : '답변 전송'}
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>

      {/* Lightbox for enlarged photo */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 text-white hover:text-amber-400 p-2 rounded-full bg-white/10 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxImage}
            alt="확대 사진"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}

      {/* Confirmation Modal for Complete */}
      {showCompleteConfirm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowCompleteConfirm(false)}
        >
          <div
            className="bg-white rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-slate-800 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">상담 완료 확인</h3>
                <p className="text-xs text-slate-500">
                  {ticket?.customerName} ({ticket?.ticketNo})
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 text-xs text-slate-600 leading-relaxed">
              <p className="font-bold text-slate-800 text-sm mb-1">
                상담을 완료하시겠습니까?
              </p>
              <p className="text-slate-500">
                완료 후에도 대화 내역은 보관되며, 필요 시 언제든 <strong>[재응대]</strong>로 다시 전환하실 수 있습니다.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCompleteConfirm(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                id="btn-confirm-complete"
                onClick={async () => {
                  await handleToggleStatus('completed');
                  setShowCompleteConfirm(false);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>완료하기</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
