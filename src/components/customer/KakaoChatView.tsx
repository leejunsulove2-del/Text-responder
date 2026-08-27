import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Image as ImageIcon,
  Plus,
  X,
  User,
  Shield,
  RotateCcw,
  Smartphone,
  ChevronLeft,
  Loader2,
} from 'lucide-react';
import { InquiryTicket, InquiryMessage, ActiveAgentPresence } from '../../types';
import {
  getOrCreateCustomerSessionTicket,
  createNewCustomerTicket,
  subscribeToTicket,
  subscribeToTicketMessages,
  sendCustomerMessage,
  markAsReadByCustomer,
  getLocalCustomerName,
  setLocalCustomerName,
} from '../../lib/ticketService';
import { getAutoCustomerDeviceIdentifier } from '../../lib/deviceInfo';
import { compressImage } from '../../lib/imageCompressor';

interface KakaoChatViewProps {
  onSwitchToStaff?: () => void;
  onBackToHome?: () => void;
}

export function KakaoChatView({ onSwitchToStaff, onBackToHome }: KakaoChatViewProps) {
  const [ticket, setTicket] = useState<InquiryTicket | null>(null);
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [customerName, setCustomerName] = useState(getLocalCustomerName());
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or fetch customer session with device & IP
  useEffect(() => {
    let unsubTicket: (() => void) | undefined;
    let unsubMessages: (() => void) | undefined;

    async function init() {
      let authorName = getLocalCustomerName();
      if (!authorName) {
        authorName = await getAutoCustomerDeviceIdentifier();
        setCustomerName(authorName);
        setLocalCustomerName(authorName);
      }

      const initTicket = await getOrCreateCustomerSessionTicket(authorName);
      setTicket(initTicket);
      if (initTicket.customerName) {
        setCustomerName(initTicket.customerName);
      }

      unsubTicket = subscribeToTicket(initTicket.id, (t) => {
        if (t) {
          setTicket(t);
          markAsReadByCustomer(initTicket.id);
        }
      });

      unsubMessages = subscribeToTicketMessages(initTicket.id, (msgs) => {
        // Customer never sees internal notes
        const visibleMsgs = msgs.filter((m) => !m.isInternalNote);
        setMessages(visibleMsgs);
        markAsReadByCustomer(initTicket.id);
      });
    }

    init();

    return () => {
      if (unsubTicket) unsubTicket();
      if (unsubMessages) unsubMessages();
    };
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedImage]);

  // Handle new conversation
  const handleStartNewChat = async () => {
    if (confirm('새로운 상담을 시작하시겠습니까? (기존 대화방은 보관됩니다)')) {
      const autoName = await getAutoCustomerDeviceIdentifier();
      const newTicket = await createNewCustomerTicket(autoName);
      setCustomerName(autoName);
      setTicket(newTicket);
      setSelectedImage(null);
      setInputText('');
    }
  };

  // Image Selection & Compression
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const compressedDataUrl = await compressImage(file, 1080, 1080, 0.8);
      setSelectedImage(compressedDataUrl);
    } catch (err) {
      console.error('Image compression failed', err);
      alert('이미지 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!ticket) return;
    if (!inputText.trim() && !selectedImage) return;

    try {
      setIsSending(true);
      await sendCustomerMessage({
        ticketId: ticket.id,
        senderName: customerName || '고객님',
        content: inputText.trim(),
        imageUrl: selectedImage || undefined,
      });

      setInputText('');
      setSelectedImage(null);
    } catch (err) {
      console.error('Failed to send message', err);
      alert('메시지 전송에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSending(false);
    }
  };

  // Format timestamp (오후 3:20)
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? '오후' : '오전';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${ampm} ${hours}:${minutes}`;
  };

  // Check if any agent is currently active or typing
  const activeAgentList = (Object.values(ticket?.activeAgents || {}) as ActiveAgentPresence[]).filter(
    (a) => a && Date.now() - a.lastActive < 45000
  );
  const typingAgent = activeAgentList.find((a) => a.isTyping);

  return (
    <div className="flex flex-col items-center justify-center p-0 sm:p-2 w-full h-full">
      {/* Mobile Frame Container */}
      <div className="w-full max-w-md bg-[#BACEE0] h-[100dvh] sm:h-[780px] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-300/60 relative">
        
        {/* Top Header */}
        <div className="bg-[#A0B4C8] text-slate-800 px-3 sm:px-4 pt-[max(10px,env(safe-area-inset-top))] pb-3 flex items-center justify-between shadow-sm z-10 border-b border-black/5 select-none">
          <div className="flex items-center gap-2">
            {onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                title="처음 화면으로 나가기"
                className="p-1.5 -ml-1 text-slate-700 hover:text-slate-900 hover:bg-black/5 rounded-full transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-9 h-9 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-inner text-xs ring-2 ring-white/70 flex-shrink-0">
              상담
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-sm text-slate-900 tracking-tight flex items-center gap-1.5">
                  1:1 실시간 상담
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                </h1>
              </div>
              <div className="text-[11px] text-slate-700 flex items-center gap-1 font-medium truncate max-w-[160px] sm:max-w-[200px]">
                <Smartphone className="w-3 h-3 text-slate-600 flex-shrink-0" />
                <span className="truncate">{customerName || '고객님'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              id="customer-new-chat-btn"
              onClick={handleStartNewChat}
              title="새 상담 시작하기"
              className="p-2 text-slate-700 hover:text-slate-900 hover:bg-black/5 rounded-full transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Security Notification Banner */}
        <div className="bg-slate-800/10 px-3 py-1.5 text-[11px] text-slate-700 flex items-center justify-between border-b border-black/5">
          <div className="flex items-center gap-1.5 truncate">
            <Shield className="w-3 h-3 text-slate-600 flex-shrink-0" />
            <span className="truncate">
              {activeAgentList.length > 0
                ? `담당자가 실시간으로 응대 중입니다.`
                : '문의 사항이나 현장 사진을 남겨주시면 즉시 답변드립니다.'}
            </span>
          </div>
        </div>

        {/* Sensitive Information Disclaimer Strip */}
        <div className="bg-amber-100/90 border-b border-amber-300/40 px-3 py-1 text-[11px] text-amber-900 font-medium flex items-center gap-1.5 shadow-2xs">
          <span className="text-[11px]">⚠️</span>
          <span className="truncate">주민등록번호, 계좌번호 등 민감한 개인정보는 전송하지 마세요.</span>
        </div>

        {/* Chat Messages Scrollable Area */}
        <div
          id="kakao-chat-messages-container"
          className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth"
        >
          {/* Date Divider */}
          <div className="flex justify-center my-2">
            <span className="bg-black/15 text-white/90 text-[11px] font-medium px-3 py-0.5 rounded-full shadow-2xs backdrop-blur-xs">
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

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <div className="bg-black/20 text-white text-xs px-3.5 py-2 rounded-xl max-w-[88%] text-center shadow-xs whitespace-pre-line leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              );
            }

            if (isCustomer) {
              // Customer Bubble (Right side, Kakao Yellow #FEE500)
              return (
                <div key={msg.id} className="flex justify-end items-end gap-1.5 pl-8 group">
                  <div className="flex flex-col items-end text-[10px] text-slate-600 pb-0.5">
                    {ticket?.unreadStaffCount === 0 && (
                      <span className="text-amber-800 font-bold text-[9px] leading-tight">읽음</span>
                    )}
                    <span>{formatTime(msg.createdAt)}</span>
                  </div>

                  <div className="relative max-w-[78%]">
                    <div className="bg-[#FEE500] text-[#191919] px-3.5 py-2 rounded-2xl rounded-tr-xs shadow-xs text-xs sm:text-sm leading-relaxed break-words font-sans">
                      {msg.imageUrl && (
                        <div className="mb-2 overflow-hidden rounded-lg cursor-pointer border border-black/10 hover:opacity-95 transition-opacity">
                          <img
                            src={msg.imageUrl}
                            alt="고객 첨부 사진"
                            className="w-full max-h-60 object-cover"
                            onClick={() => setLightboxImage(msg.imageUrl || null)}
                          />
                        </div>
                      )}
                      {msg.content && <p className="whitespace-pre-line">{msg.content}</p>}
                    </div>
                  </div>
                </div>
              );
            }

            // Staff/Agent Bubble (Left side, White Bubble)
            return (
              <div key={msg.id} className="flex items-start gap-2 pr-8">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-sm ring-1 ring-black/10 mt-0.5"
                  style={{ backgroundColor: msg.senderAvatarColor || '#2563EB' }}
                >
                  {msg.senderName.slice(0, 1)}
                </div>

                <div className="flex flex-col max-w-[80%]">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-bold text-slate-800">
                      {msg.senderName}
                    </span>
                    {msg.senderDepartment && (
                      <span className="text-[10px] bg-slate-700/10 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                        {msg.senderDepartment}
                      </span>
                    )}
                  </div>

                  <div className="flex items-end gap-1.5">
                    <div className="bg-white text-[#191919] px-3.5 py-2 rounded-2xl rounded-tl-xs shadow-xs text-xs sm:text-sm leading-relaxed break-words font-sans border border-black/5">
                      {msg.imageUrl && (
                        <div className="mb-2 overflow-hidden rounded-lg cursor-pointer border border-slate-200 hover:opacity-95 transition-opacity">
                          <img
                            src={msg.imageUrl}
                            alt="담당자 첨부 사진"
                            className="w-full max-h-60 object-cover"
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
          })}

          {/* Typing Indicator */}
          {typingAgent && (
            <div className="flex items-center gap-2 text-xs text-slate-700 bg-white/70 py-1.5 px-3 rounded-full w-fit shadow-xs backdrop-blur-xs animate-pulse">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: typingAgent.avatarColor || '#2563EB' }}
              />
              <span>{typingAgent.agentName}님이 답변을 입력하고 있습니다...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Selected Image Preview Pill */}
        {selectedImage && (
          <div className="bg-slate-100 p-2 border-t border-slate-200 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <img
                src={selectedImage}
                alt="전송 예정 이미지"
                className="w-10 h-10 object-cover rounded-lg border border-slate-300 shadow-xs"
              />
              <div>
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                  사진이 첨부되었습니다
                </span>
                <span className="text-[10px] text-slate-500 block">메시지와 함께 전송됩니다</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedImage(null)}
              className="p-1 hover:bg-slate-200 text-slate-500 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input Bar with Safe Area Bottom Padding */}
        <form
          onSubmit={handleSendMessage}
          className="bg-white px-3 pt-2.5 pb-[max(20px,calc(env(safe-area-inset-bottom)+8px))] border-t border-slate-200/80 flex items-end gap-2 z-10 shadow-lg"
        >
          {/* Image Attach Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageChange}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            id="customer-image-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isCompressing}
            title="사진/이미지 첨부"
            className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0 active:scale-95 cursor-pointer"
          >
            {isCompressing ? (
              <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
            ) : (
              <Plus className="w-5 h-5 text-slate-600" />
            )}
          </button>

          {/* Textarea */}
          <div className="flex-1 bg-slate-100/90 rounded-2xl px-3 py-1.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-amber-400 border border-slate-200 transition-all flex items-center">
            <textarea
              id="customer-chat-textarea"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="메시지를 입력하세요 (Enter: 전송)"
              className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder-slate-400 resize-none max-h-24 min-h-[22px] focus:outline-none leading-relaxed"
              rows={1}
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            id="customer-send-btn"
            disabled={(!inputText.trim() && !selectedImage) || isSending}
            className={`p-2.5 rounded-full font-bold transition-all shadow-xs flex-shrink-0 flex items-center justify-center active:scale-95 ${
              inputText.trim() || selectedImage
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-500 cursor-pointer ring-1 ring-black/5'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            title="전송"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 text-white hover:text-amber-400 p-2 rounded-full bg-white/10"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxImage}
            alt="확대 이미지"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
