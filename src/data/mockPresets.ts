import { AgentProfile, QuickTemplate } from '../types';

export const DEFAULT_AGENTS: AgentProfile[] = [
  {
    id: 'agent_kim',
    name: '김지원 주임',
    department: '민원행정과',
    role: '일반행정 및 증명발급',
    avatarColor: '#2563EB', // Blue
  },
  {
    id: 'agent_park',
    name: '박민우 주무관',
    department: '도시시설안전과',
    role: '도로·교통·시설 보수',
    avatarColor: '#059669', // Emerald
  },
  {
    id: 'agent_lee',
    name: '이서연 상담관',
    department: '복지지원과',
    role: '취약계층·주거·생활복지',
    avatarColor: '#7C3AED', // Violet
  },
  {
    id: 'agent_jung',
    name: '정재훈 팀장',
    department: '상담총괄팀',
    role: '민원 총괄 및 분쟁조정',
    avatarColor: '#D97706', // Amber
  },
  {
    id: 'agent_choi',
    name: '최유진 주임',
    department: '세무과',
    role: '지방세 및 납부안내',
    avatarColor: '#DC2626', // Red
  },
];

export const DEFAULT_TEMPLATES: QuickTemplate[] = [
  {
    id: 'tpl_hello',
    title: '상담 접수 인사',
    category: '기본 인사',
    content: '안녕하십니까 고객님! 실시간 상담 센터입니다. 문의주신 내용을 확인하였으며 신속히 확인하여 답변 드리겠습니다.',
  },
  {
    id: 'tpl_request_photo',
    title: '현장 사진 / 추가 자료 요청',
    category: '자료 요청',
    content: '보다 정확하고 빠른 처리를 위해, 해당 위치나 현장 상황 사진을 아래 [+] 버튼을 눌러 전송해 주실 수 있으실까요?',
  },
  {
    id: 'tpl_department_joint',
    title: '전문 담당자 합동 배정',
    category: '합동 응대',
    content: '해당 문의는 전문 조치가 필요하여 관련 부서 담당자가 함께 본 상담방에 참여하였습니다. 잠시만 기다려 주시기 바랍니다.',
  },
  {
    id: 'tpl_in_progress',
    title: '현장 출동 및 조치 진행',
    category: '진행 안내',
    content: '접수해주신 사항은 현장 기동팀에 전달되어 현재 긴급 점검 및 조치 작업이 진행 중입니다.',
  },
  {
    id: 'tpl_complete',
    title: '처리 완료 안내',
    category: '완료',
    content: '요청해주신 문의 사항 처리가 완료되었습니다. 추가로 궁금하신 점이 있으시면 언제든지 편하게 톡 남겨주세요. 감사합니다!',
  },
];
