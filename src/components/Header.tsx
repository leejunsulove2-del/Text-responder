import React, { useState, useEffect } from 'react';
import { AgentProfile } from '../types';
import { 
  MessageSquare, 
  Users, 
  Smartphone, 
  Layers, 
  Radio, 
  ShieldCheck,
  Bell,
  LogOut,
  ArrowLeft,
  Volume2
} from 'lucide-react';
import {
  requestNotificationPermission,
  getNotificationPermissionStatus,
  playNotificationSound,
} from '../lib/notificationService';

interface HeaderProps {
  currentView: 'landing' | 'customer' | 'staff' | 'split';
  onViewChange: (view: 'landing' | 'customer' | 'staff' | 'split') => void;
  onLogout: () => void;
  unansweredCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  onLogout,
  unansweredCount = 0,
}) => {
  const [notifPermission, setNotifPermission] = useState(getNotificationPermissionStatus());

  useEffect(() => {
    setNotifPermission(getNotificationPermissionStatus());
  }, []);

  const handleToggleNotification = async () => {
    const res = await requestNotificationPermission();
    setNotifPermission(res);
    playNotificationSound();
  };

  const isStaffRole = currentView === 'staff' || currentView === 'split';

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-sm select-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-15">
          
          {/* Logo & Service Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={onLogout}
              className="flex items-center gap-2.5 text-left group cursor-pointer"
              title="처음 화면으로 이동"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs shadow-sm ring-1 ring-amber-300 group-hover:scale-105 transition-transform flex-shrink-0">
                상담
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm sm:text-base tracking-tight text-white group-hover:text-amber-300 transition-colors">
                    실시간 응대 시스템
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isStaffRole
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {isStaffRole ? '관리자' : '고객'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden md:block">
                  {isStaffRole
                    ? '실시간 민원 응대 콘솔'
                    : '1:1 실시간 민원 접수 및 상담'}
                </p>
              </div>
            </button>
          </div>

          {/* Right Side: Notification Toggle & Role Control */}
          <div className="flex items-center gap-2">
            
            {/* Notification Bell Button */}
            <button
              type="button"
              onClick={handleToggleNotification}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                notifPermission === 'granted'
                  ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300 hover:bg-emerald-950/60'
                  : 'bg-amber-950/40 border-amber-600/50 text-amber-300 hover:bg-amber-900/50 animate-pulse'
              }`}
              title={notifPermission === 'granted' ? '백그라운드 알림 정상 작동 중 (클릭 시 소리 테스트)' : '클릭하여 백그라운드 푸시 알림 허용'}
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {notifPermission === 'granted' ? '알림 켜짐' : '알림 켜기'}
              </span>
            </button>

            {/* If Staff: Allow Split View Switcher */}
            {isStaffRole && (
              <div className="bg-slate-800/90 p-1 rounded-xl border border-slate-700/70 flex items-center shadow-inner">
                <button
                  type="button"
                  id="btn-switch-staff"
                  onClick={() => onViewChange('staff')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all relative ${
                    currentView === 'staff'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">담당자 콘솔</span>
                  {unansweredCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                      {unansweredCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  id="btn-switch-split"
                  onClick={() => onViewChange('split')}
                  className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    currentView === 'split'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                  title="고객 화면과 담당자 콘솔 동시 확인"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>분할 화면</span>
                </button>
              </div>
            )}

            {/* Logout / Exit Button */}
            <button
              type="button"
              id="btn-header-logout"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 border border-slate-700 hover:border-rose-700/50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              title="로그아웃하고 첫 화면으로 돌아가기"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>로그아웃</span>
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
