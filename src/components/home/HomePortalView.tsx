import React, { useState } from 'react';
import {
  MessageSquare,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Bell,
  Clock,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Headphones,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  requestNotificationPermission,
  getNotificationPermissionStatus,
  playNotificationSound,
} from '../../lib/notificationService';

interface HomePortalViewProps {
  onStartInquiry: () => void;
  onLoginAdmin: () => void;
  unansweredCount?: number;
}

export const HomePortalView: React.FC<HomePortalViewProps> = ({
  onStartInquiry,
  onLoginAdmin,
  unansweredCount = 0,
}) => {
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notifPermission, setNotifPermission] = useState(getNotificationPermissionStatus());

  // Handle Admin Password Verification
  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    // Expected admin password: kepco123456/
    if (password === 'kepco123456/') {
      onLoginAdmin();
    } else {
      setErrorMessage('비밀번호가 올바르지 않습니다. 다시 확인해 주세요.');
      setIsSubmitting(false);
    }
  };

  // Request Notification Permission
  const handleEnableNotifications = async () => {
    const res = await requestNotificationPermission();
    setNotifPermission(res);
    if (res === 'granted') {
      playNotificationSound();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 selection:bg-amber-400 selection:text-black relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar: Brand & Notification Status */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between z-10 pt-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-900 flex items-center justify-center font-black text-sm shadow-md ring-2 ring-amber-300/40">
            상담
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                실시간 응대 시스템
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                상담원 대기중
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              빠르고 간편한 1:1 실시간 민원 상담
            </p>
          </div>
        </div>

        {/* Notification Permission Indicator */}
        <button
          type="button"
          onClick={handleEnableNotifications}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
            notifPermission === 'granted'
              ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
              : 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700'
          }`}
          title="백그라운드 알림 설정"
        >
          <Bell className={`w-3.5 h-3.5 ${notifPermission === 'granted' ? 'text-emerald-400' : 'animate-bounce text-amber-400'}`} />
          <span className="hidden sm:inline">
            {notifPermission === 'granted' ? '알림 켜짐' : '알림 허용'}
          </span>
          <span className="sm:hidden">
            {notifPermission === 'granted' ? '알림 ON' : '알림 켜기'}
          </span>
        </button>
      </header>

      {/* Main Center Area: Hero & Big Inquiry Button */}
      <main className="max-w-xl w-full mx-auto my-auto flex flex-col items-center justify-center text-center z-10 py-6 sm:py-10">
        
        {/* Service Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-300 text-xs font-medium mb-6 shadow-sm">
          <Headphones className="w-4 h-4 text-amber-400" />
          <span>전기 요금 · 명의 변경 · 고장 신고 · 사진 접수</span>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-snug mb-3">
          어떤 도움이 필요하신가요?
        </h1>
        <p className="text-sm sm:text-base text-slate-300 max-w-md leading-relaxed mb-8">
          별도의 회원가입 없이 담당자와 
          <br />
          <strong className="text-amber-300 font-bold">1:1 실시간 상담</strong>을 시작하실 수 있습니다.
        </p>

        {/* 🌟 Big Prominent "문의하기" Button */}
        <div className="w-full max-w-md px-2">
          <button
            type="button"
            id="btn-start-inquiry"
            onClick={onStartInquiry}
            className="w-full group bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black rounded-3xl p-5 sm:p-6 shadow-xl shadow-amber-500/20 hover:shadow-amber-500/30 transition-all transform active:scale-[0.98] border-2 border-amber-300/80 flex items-center justify-between text-left cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-950 text-amber-400 flex items-center justify-center shadow-md flex-shrink-0 group-hover:scale-105 transition-transform">
                <MessageSquare className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-black tracking-tight block text-slate-950">
                  문의하기
                </span>
                <span className="text-xs sm:text-sm font-semibold text-slate-800 block mt-0.5">
                  이 버튼을 눌러 실시간 상담을 시작하세요
                </span>
              </div>
            </div>

            <div className="w-10 h-10 rounded-full bg-slate-950/10 flex items-center justify-center text-slate-950 group-hover:translate-x-1 transition-transform flex-shrink-0">
              <ArrowRight className="w-5 h-5" />
            </div>
          </button>
        </div>

        {/* Features Info Bar (Informative styling, not buttons) */}
        <div className="w-full max-w-md mt-6 px-3 py-3 rounded-2xl bg-slate-800/40 border border-slate-800 text-slate-300 text-xs">
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            <div className="flex items-center gap-1.5 flex-1 justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="font-medium text-slate-200 text-[11px] sm:text-xs">현장 사진 접수</span>
            </div>
            <div className="w-[1px] h-3 bg-slate-700" />
            <div className="flex items-center gap-1.5 flex-1 justify-center">
              <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="font-medium text-slate-200 text-[11px] sm:text-xs">실시간 답변</span>
            </div>
            <div className="w-[1px] h-3 bg-slate-700" />
            <div className="flex items-center gap-1.5 flex-1 justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span className="font-medium text-slate-200 text-[11px] sm:text-xs">3일 자동 파기</span>
            </div>
          </div>
        </div>

        {/* Notification Warning Banner if Default */}
        {notifPermission !== 'granted' && (
          <div className="mt-6 max-w-md w-full bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 px-4 text-left flex items-start gap-3">
            <Bell className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-bold text-amber-300">
                답변 도착 알림을 받으시려면?
              </p>
              <p className="text-slate-300 text-[11px] mt-0.5">
                상단의 <strong className="text-white">[알림 허용]</strong>을 켜두시면 답변 도착 시 즉시 소리와 알림을 받으실 수 있습니다.
              </p>
            </div>
          </div>
        )}

      </main>

      {/* 🌟 Bottom: "관리자페이지 접속" Button positioned safely above mobile home/gesture bars */}
      <footer className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center pt-2 pb-[max(3rem,calc(env(safe-area-inset-bottom)+2.5rem))] z-10">
        <button
          type="button"
          id="btn-admin-login-open"
          onClick={() => {
            setPassword('');
            setErrorMessage(null);
            setIsAdminModalOpen(true);
          }}
          className="text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 rounded-full transition-all font-semibold cursor-pointer py-2.5 px-5 shadow-sm active:scale-95 flex items-center gap-2"
        >
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          <span>관리자페이지 접속</span>
          {unansweredCount > 0 ? (
            <span className="bg-rose-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-xs">
              {unansweredCount}건 대기
            </span>
          ) : (
            <span className="text-slate-400 text-[10px]">로그인</span>
          )}
        </button>
      </footer>

      {/* 🔒 Administrator Password Modal */}
      {isAdminModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setIsAdminModalOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 shadow-2xl relative text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsAdminModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">관리자 전용 로그인</h2>
                <p className="text-xs text-slate-400">
                  담당자 및 관리자 페이지 접근을 위해 패스워드를 입력하세요.
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  관리자 패스워드
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoFocus
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="패스워드를 입력하세요"
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3 pl-4 pr-11 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Error Message */}
                {errorMessage && (
                  <div className="mt-2.5 text-xs text-rose-400 font-semibold flex items-center gap-1.5 animate-shake">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdminModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  id="btn-admin-login-submit"
                  disabled={!password.trim() || isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>관리자 접속</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
