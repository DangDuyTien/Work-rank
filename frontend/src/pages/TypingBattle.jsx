import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Keyboard,
  Trophy,
  Zap,
  Target,
  Flame,
  Users,
  User,
  Shield,
  Clock,
  Play,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Award,
  Swords,
  Plus,
  RefreshCw,
  LogOut,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Volume2,
  VolumeX,
  Shuffle,
  Flag,
  ChevronRight,
  Eye,
  EyeOff,
  FlameKindling,
  Timer,
  Check,
  TrendingUp,
  Gauge,
  SlidersHorizontal,
} from 'lucide-react';
import { typingGameApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useGameAvailability } from '../hooks/useGameAvailability';
import GameComingSoon from '../components/GameComingSoon';
import VisualKeyboard from '../components/game/VisualKeyboard';
import { typingSound } from '../utils/typingSound';
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  SegmentedControl,
  TabTransition,
  AnimatedModal,
  AnimatedNumber,
  PageState,
  EmptyState,
} from '../components/ui';

// ── KHO BÀI THI 100% TIẾNG VIỆT CHUẨN (KHÔNG CHẤM PHẨY - KHÔNG TỪ TIẾNG ANH - CHỮ THƯỜNG) ──
const DEFAULT_PRACTICE_CHALLENGES = [
  // ── 1. ĐỜI SỐNG & BÌNH YÊN ──
  {
    id: 1,
    title: 'Thư Thái Sau Giờ Làm',
    category: 'Đời sống',
    difficulty: 'Dễ',
    language: 'VI',
    content:
      'chữa lành tâm hồn bằng một chén trà ấm và gác lại mọi lo toan công việc sau giờ hành chính để tận hưởng cuộc sống bình yên bên gia đình người thân',
  },
  {
    id: 2,
    title: 'Hạnh Phúc Giản Dị',
    category: 'Đời sống',
    difficulty: 'Dễ',
    language: 'VI',
    content:
      'nhiều người thích khoe nhà cao cửa rộng còn tôi chỉ thích tự hào vì hôm nay đã hoàn thành xong mọi kế hoạch công việc sớm hơn dự kiến một tiếng đồng hồ',
  },
  {
    id: 3,
    title: 'Tâm Thế Tích Cực',
    category: 'Đời sống',
    difficulty: 'Vừa',
    language: 'VI',
    content:
      'đi làm với tâm thế vui vẻ không cáu giận khi khách hàng yêu cầu chỉnh sửa bản vẽ nhiều lần vì mỗi lần sửa đổi là một lần nâng cao tay nghề điêu luyện',
  },
  {
    id: 4,
    title: 'Câu Chuyện Đời Thường',
    category: 'Đời sống',
    difficulty: 'Vừa',
    language: 'VI',
    content:
      'những câu chuyện đời thường giản dị và ý nghĩa trên mạng luôn thu hút hàng triệu người xem và mang lại niềm vui sảng khoái sau chuỗi ngày bận rộn',
  },
  {
    id: 5,
    title: 'Tâm Sự Đêm Muộn',
    category: 'Đời sống',
    difficulty: 'Vừa',
    language: 'VI',
    content:
      'đêm muộn lướt xem những dòng tâm sự chân thành thấy ai cũng đang âm thầm nỗ lực từng ngày để xây dựng tương lai tươi sáng và ấm no hơn',
  },
  {
    id: 6,
    title: 'Sức Mạnh Lời Động Viên',
    category: 'Đời sống',
    difficulty: 'Khó',
    language: 'VI',
    content:
      'một lời khen ngợi và vài câu động viên chân thành có thể tiếp thêm nguồn năng lượng dồi dào cho bạn bè đồng nghiệp tiếp tục cống hiến hết mình',
  },

  // ── 2. CÔNG VIỆC & ĐỒNG ĐỘI ──
  {
    id: 7,
    title: 'Hoàn Thành Nhiệm Vụ',
    category: 'Công sở',
    difficulty: 'Dễ',
    language: 'VI',
    content:
      'cảm giác chạy đua cùng thời gian để nộp bài hoàn chỉnh trước mười hai giờ đêm mang lại sự hồi hộp tột cùng nhưng niềm vui khi hoàn thành xuất sắc là vô giá',
  },
  {
    id: 8,
    title: 'Họp Hành Hiệu Quả',
    category: 'Công sở',
    difficulty: 'Dễ',
    language: 'VI',
    content:
      'một buổi họp thành công là buổi họp đi thẳng vào trọng tâm vấn đề đưa ra giải pháp rõ ràng và phân công nhiệm vụ cụ thể cho từng thành viên tham gia',
  },
  {
    id: 9,
    title: 'Khởi Đầu Ngày Mới',
    category: 'Công sở',
    difficulty: 'Vừa',
    language: 'VI',
    content:
      'hương thơm của ly cà phê sữa đá buổi sáng đánh thức mọi giác quan giúp tinh thần sảng khoái và sẵn sàng bùng nổ cùng những ý tưởng sáng tạo độc đáo',
  },
  {
    id: 10,
    title: 'Kỷ Luật Cá Nhân',
    category: 'Công sở',
    difficulty: 'Vừa',
    language: 'VI',
    content:
      'tự giác quản lý thời gian và hoàn thành trách nhiệm được giao là thước đo chính xác nhất cho sự chuyên nghiệp của một nhân sự tài năng trong tập thể',
  },
  {
    id: 11,
    title: 'Tình Đồng Đội Bền Chặt',
    category: 'Công sở',
    difficulty: 'Khó',
    language: 'VI',
    content:
      'có những người đồng nghiệp luôn sẵn lòng giúp đỡ chia sẻ kinh nghiệm và cùng nhau vượt qua khó khăn là điều may mắn lớn nhất trong sự nghiệp',
  },
  {
    id: 12,
    title: 'Học Hỏi Không Ngừng',
    category: 'Công sở',
    difficulty: 'Khó',
    language: 'VI',
    content:
      'không ngừng học hỏi những kỹ năng mới và chủ động đón nhận thử thách khó khăn giúp bạn nhanh chóng trở thành người dẫn đầu trong lĩnh vực của mình',
  },

  // ── 3. Ý CHÍ & PHÁT TRIỂN BẢN THÂN ──
  {
    id: 13,
    title: 'Vượt Qua Giới Hạn',
    category: 'Ý chí',
    difficulty: 'Dễ',
    language: 'VI',
    content:
      'mọi giới hạn sinh ra là để thử thách ý chí kiên định và lòng dũng cảm của những ai khao khát vươn tới đỉnh cao thành công trong cuộc đời',
  },
  {
    id: 14,
    title: 'Tích Lũy Từng Ngày',
    category: 'Ý chí',
    difficulty: 'Dễ',
    language: 'VI',
    content:
      'mỗi ngày tích lũy thêm một chút kiến thức rèn luyện thêm một chút kỹ năng sau một năm bạn sẽ nhìn lại và bất ngờ trước sự trưởng thành vượt bậc của bản thân',
  },
  {
    id: 15,
    title: 'Trân Trọng Hiện Tại',
    category: 'Ý chí',
    difficulty: 'Vừa',
    language: 'VI',
    content:
      'quá khứ đã qua đi tương lai chưa tới hãy dành trọn vẹn sự tập trung và tâm huyết cho từng việc nhỏ bạn đang làm ngay trong giây phút hiện tại',
  },
  {
    id: 16,
    title: 'Lòng Kiên Trì Bất Diệt',
    category: 'Ý chí',
    difficulty: 'Vừa',
    language: 'VI',
    content:
      'người kiên trì đi đến cùng luôn chiến thắng người có tài năng nhưng dễ nản lòng trước sóng gió thử thách khắc nghiệt của cuộc sống',
  },
  {
    id: 17,
    title: 'Tự Tin Tỏa Sáng',
    category: 'Ý chí',
    difficulty: 'Khó',
    language: 'VI',
    content:
      'bạn sở hữu những điểm mạnh độc nhất vô nhị hãy tự tin phát huy thế mạnh đó để tạo ra những giá trị tốt đẹp cho cộng đồng và xã hội xung quanh',
  },
  {
    id: 18,
    title: 'Bền Bỉ Vươn Lên',
    category: 'Ý chí',
    difficulty: 'Khó',
    language: 'VI',
    content:
      'thành công không đến từ sự may mắn chốc lát mà là kết quả của chuỗi ngày miệt mài rèn luyện kỷ luật bản thân và không bao giờ bỏ cuộc',
  },

  // ── 4. KỸ NĂNG ĐÁNH MÁY & PHẢN XẠ ──
  {
    id: 19,
    title: 'Thời Đại Kỹ Thuật Số',
    category: 'Kỹ năng',
    difficulty: 'Dễ',
    language: 'VI',
    content:
      'trí tuệ nhân tạo đang thay đổi cách thế giới vận hành giúp con người giải quyết công việc nhanh chóng và tập trung vào tư duy sáng tạo đỉnh cao',
  },
  {
    id: 20,
    title: 'Hạ Tầng Tốc Độ Cao',
    category: 'Kỹ năng',
    difficulty: 'Vừa',
    language: 'VI',
    content:
      'hệ thống máy chủ thế hệ mới cho phép truyền tải dữ liệu và cập nhật bảng xếp hạng thi đấu của hàng vạn người dùng trong chớp mắt không hề chậm trễ',
  },
  {
    id: 21,
    title: 'Đấu Trường Trực Tuyến',
    category: 'Kỹ năng',
    difficulty: 'Vừa',
    language: 'VI',
    content:
      'đấu trường đánh máy kết nối hàng ngàn tuyển thủ tài ba cùng so tài tốc độ độ chính xác và khả năng phản xạ nhanh nhạy trên từng phím bấm',
  },
  {
    id: 22,
    title: 'Nghệ Thuật Mười Ngón',
    category: 'Kỹ năng',
    difficulty: 'Khó',
    language: 'VI',
    content:
      'gõ phím mười ngón thuần thục như một nghệ sĩ lướt tay trên phím đàn dương cầm giúp bạn hiện thực hóa dòng suy nghĩ thành văn bản với tốc độ ánh sáng',
  },
  {
    id: 23,
    title: 'Âm Thanh Bàn Phím Cơ',
    category: 'Kỹ năng',
    difficulty: 'Khó',
    language: 'VI',
    content:
      'đôi bàn tay uyển chuyển lướt nhẹ trên từng phím bấm tạo nên những âm thanh lách cách giòn giã mang lại cảm giác thích thú và say mê bất tận',
  },
  {
    id: 24,
    title: 'Nâng Cao Năng Suất',
    category: 'Kỹ năng',
    difficulty: 'Khó',
    language: 'VI',
    content:
      'luyện tập gõ nhanh mỗi ngày giúp tăng cường khả năng tập trung phản xạ não bộ và nâng cao năng suất làm việc vượt bậc trong thời đại số',
  },

  // ── 5. ĐẤT NƯỚC & VĂN HÓA VIỆT NAM ──
  {
    id: 25,
    title: 'Non Sông Gấm Vóc',
    category: 'Việt Nam',
    difficulty: 'Dễ',
    language: 'VI',
    content:
      'đất nước việt nam gấm vóc tươi đẹp trải dài từ ải nam quan đến mũi cà mau với muôn vàn danh lam thắng cảnh và con người thân thiện hiếu khách',
  },
  {
    id: 26,
    title: 'Mùa Thu Hà Nội',
    category: 'Việt Nam',
    difficulty: 'Vừa',
    language: 'VI',
    content:
      'mùa thu hà nội thơm nồng mùi hoa sữa cùng những con phố cổ kính rêu phong đón từng cơn gió heo may se lạnh làm xao xuyến lòng người phương xa',
  },
  {
    id: 27,
    title: 'Phù Sa Miền Tây',
    category: 'Việt Nam',
    difficulty: 'Vừa',
    language: 'VI',
    content:
      'dòng sông mê kông màu mỡ bồi đắp phù sa cho những cánh đồng lúa chín vàng ươm trĩu hạt mang lại mùa màng bội thu cho bà con nông dân miền tây',
  },
  {
    id: 28,
    title: 'Biển Đảo Quê Hương',
    category: 'Việt Nam',
    difficulty: 'Vừa',
    language: 'VI',
    content:
      'tiếng sóng vỗ rì rào bên bờ biển xanh cát trắng nắng vàng cùng những hàng dừa nghiêng bóng tạo nên bức tranh thiên nhiên tuyệt mỹ của biển đảo quê hương',
  },
  {
    id: 29,
    title: 'Tinh Thần Hiếu Học',
    category: 'Việt Nam',
    difficulty: 'Khó',
    language: 'VI',
    content:
      'truyền thống tôn sư trọng đạo và tinh thần hiếu học nghìn năm của dân tộc là ngọn đuốc sáng soi đường cho các thế hệ trẻ vươn tầm thế giới',
  },
  {
    id: 30,
    title: 'Hương Vị Gia Đình',
    category: 'Việt Nam',
    difficulty: 'Khó',
    language: 'VI',
    content:
      'bữa cơm gia đình ấm cúng với bát canh rau muống luộc cùng đĩa cà pháo giòn tan luôn là ký ức thiêng liêng ấm áp nhất của mỗi người con xa xứ',
  },

  // ── 6. RÈN LUYỆN TỪ VỰNG TIẾNG VIỆT NGẪU NHIÊN ──
  {
    id: 31,
    title: 'Bình Minh Rạng Rỡ',
    category: 'Từ vựng ngẫu nhiên',
    difficulty: 'Dễ',
    language: 'VI',
    content:
      'mặt trời mọc chim hót chào ngày mới bình minh rực rỡ hoa cỏ ngát hương gió nhẹ thổi qua cành lá mang theo không khí trong lành dễ chịu',
  },
  {
    id: 32,
    title: 'Nhịp Điệu Đôi Tay',
    category: 'Từ vựng ngẫu nhiên',
    difficulty: 'Dễ',
    language: 'VI',
    content:
      'tập trung cao độ phản xạ nhạy bén bàn tay khéo léo phím bấm nhịp nhàng chuẩn xác từng chữ rèn luyện kiên trì mỗi ngày để đạt thành tích cao nhất',
  },
  {
    id: 33,
    title: 'Ý Nghĩ Tích Cực',
    category: 'Từ vựng ngẫu nhiên',
    difficulty: 'Vừa',
    language: 'VI',
    content:
      'suy nghĩ tích cực hành động quyết đoán vượt qua thử thách gặt hái thành công cuộc sống tràn đầy niềm vui và ý nghĩa bên những người thân yêu',
  },
  {
    id: 34,
    title: 'Kho Tàng Tri Thức',
    category: 'Từ vựng ngẫu nhiên',
    difficulty: 'Vừa',
    language: 'VI',
    content:
      'sách là kho tàng tri thức vô tận của nhân loại đọc sách giúp mở rộng tầm hiểu biết nuôi dưỡng tâm hồn và hoàn thiện nhân cách của mỗi con người',
  },
  {
    id: 35,
    title: 'Sức Mạnh Tập Thể',
    category: 'Từ vựng ngẫu nhiên',
    difficulty: 'Khó',
    language: 'VI',
    content:
      'đoàn kết tạo nên sức mạnh vô địch tập thể đồng lòng chung sức vượt qua mọi rào cản đưa tổ chức phát triển vững mạnh và vươn xa hơn nữa',
  },
  {
    id: 36,
    title: 'Nụ Cười Cuộc Sống',
    category: 'Từ vựng ngẫu nhiên',
    difficulty: 'Khó',
    language: 'VI',
    content:
      'nụ cười rạng rỡ ánh mắt ấm áp tình bạn chân thành sự sẻ chia kịp thời luôn là liều thuốc quý giá nhất xua tan mọi mệt mỏi trong cuộc sống',
  },
];



function Badge({ variant = 'neutral', children, style }) {
  const styles = {
    success: { bg: 'var(--success-soft, rgba(21, 128, 61, 0.08))', color: 'var(--success, #15803d)', border: '1px solid var(--success-border, rgba(21, 128, 61, 0.25))' },
    neutral: { bg: 'var(--surface-muted, #eceae4)', color: 'var(--text-secondary, #555555)', border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' },
    info: { bg: 'rgba(2, 132, 199, 0.08)', color: '#0284c7', border: '1px solid rgba(2, 132, 199, 0.25)' },
    warning: { bg: 'var(--accent-soft, rgba(180, 83, 9, 0.08))', color: 'var(--accent, #b45309)', border: '1px solid var(--accent-border, rgba(180, 83, 9, 0.25))' },
  };
  const current = styles[variant] || styles.neutral;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        background: current.bg,
        color: current.color,
        border: current.border,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export default function TypingBattle() {
  const navigate = useNavigate();
  const { roomId: urlRoomId } = useParams();
  const { user, socket, isAdmin } = useAuth();
  const { isComingSoon, game: availabilityGame, proceedAsAdmin } = useGameAvailability('typing_battle');

  // Navigation Tabs: 'practice' (Instant Trainer) | 'arena' (Online PvP) | 'leaderboard'
  const [activeTab, setActiveTab] = useState('practice');
  const [selectedMode, setSelectedMode] = useState('1V1'); // 'SOLO' | '1V1' | '2V2' | '3V3'
  const [selectedMatchType, setSelectedMatchType] = useState('RANKED'); // 'RANKED' | 'PRACTICE'

  // Time-based Test Settings: 30s, 60s (1 min), 120s (2 min), 300s (5 min)
  const [selectedDuration, setSelectedDuration] = useState(120); // Default: 2 minutes (120s)

  // Online Room & Gameplay State
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roomList, setRoomList] = useState([]);
  const [myStats, setMyStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isCreatingModal, setIsCreatingModal] = useState(false);
  const [customRoomTitle, setCustomRoomTitle] = useState('');
  const [customRoomDuration, setCustomRoomDuration] = useState(120);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundProfile, setSoundProfile] = useState(() => typingSound.getSwitchProfile());
  const [showKeyboard, setShowKeyboard] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(true);

  const handleSwitchProfileChange = (profile) => {
    setSoundProfile(profile);
    typingSound.setSwitchProfile(profile);
    if (soundEnabled) {
      typingSound.playKey('A');
    }
  };

  // Active Key Tracking for On-Screen Keyboard
  const [activeKeyCodes, setActiveKeyCodes] = useState(new Set());
  const [lastFeedback, setLastFeedback] = useState(null); // 'correct' | 'error' | null

  // In-Game Typing State (Shared between Practice and Room Play)
  const [practiceChallenges, setPracticeChallenges] = useState(DEFAULT_PRACTICE_CHALLENGES);
  const [selectedChallengeIndex, setSelectedChallengeIndex] = useState(0);
  const [sessionCompletedChars, setSessionCompletedChars] = useState(0);
  const [sessionCompletedErrors, setSessionCompletedErrors] = useState(0);
  const [sessionSentencesCount, setSessionSentencesCount] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [errorCount, setErrorCount] = useState(0);
  const [liveWpm, setLiveWpm] = useState(0);
  const [liveAccuracy, setLiveAccuracy] = useState(100);
  const [startTime, setStartTime] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(120);
  const [isFinished, setIsFinished] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [countdownNumber, setCountdownNumber] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);

  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const activeCharRef = useRef(null);

  // Determine current active challenge text (One clean, 2-line sentence at a time - 100% lowercase)
  const currentChallenge = useMemo(() => {
    if (room?.challengeText) {
      return {
        title: room.title || 'Trận Đấu Thi Đấu',
        content: (room.challengeText || '')
          .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, '')
          .replace(/\s+/g, ' ')
          .toLowerCase()
          .trim(),
        difficulty: room.difficulty || 'MEDIUM',
        category: 'Trực tuyến',
      };
    }
    const item = practiceChallenges[selectedChallengeIndex % practiceChallenges.length] || DEFAULT_PRACTICE_CHALLENGES[0];
    return {
      ...item,
      content: (item.content || '')
        .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .trim(),
    };
  }, [room, practiceChallenges, selectedChallengeIndex]);

  const challengeText = currentChallenge.content || '';
  const currentTargetChar = challengeText[typedText.length] || '';

  // ── 1. GLOBAL KEYBOARD EVENT LISTENERS FOR VISUAL KEYBOARD ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      setActiveKeyCodes((prev) => {
        const next = new Set(prev);
        next.add(e.code);
        return next;
      });

      // Restart shortcut: Escape when in practice mode
      if (e.key === 'Escape' && activeTab === 'practice' && !room) {
        e.preventDefault();
        handleRestartPractice();
        return;
      }

      // Auto focus input if user starts typing outside active input/textarea
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag !== 'input' && activeTag !== 'textarea') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
          inputRef.current?.focus();
        }
      }
    };

    const handleKeyUp = (e) => {
      setActiveKeyCodes((prev) => {
        const next = new Set(prev);
        next.delete(e.code);
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeTab, room]);

  // ── 2. FETCH INITIAL DATA & CHALLENGES ──
  const fetchHubData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, lbRes, roomsRes, chRes] = await Promise.all([
        typingGameApi.getMyStats().catch(() => null),
        typingGameApi.getLeaderboard(20).catch(() => ({ leaderboard: [] })),
        typingGameApi.listRooms('WAITING').catch(() => ({ rooms: [] })),
        typingGameApi.getChallenges().catch(() => ({ challenges: [] })),
      ]);

      if (statsRes?.stats) setMyStats(statsRes.stats);
      if (lbRes?.leaderboard) setLeaderboard(lbRes.leaderboard);
      if (roomsRes?.rooms) setRoomList(roomsRes.rooms);
      if (chRes?.challenges && chRes.challenges.length > 0) {
        // Sanitize out any stray commas/periods and lowercase to strictly enforce standards
        const cleanChallenges = chRes.challenges.map((c) => ({
          ...c,
          content: (c.content || '')
            .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, '')
            .replace(/\s+/g, ' ')
            .toLowerCase()
            .trim(),
        }));
        setPracticeChallenges(cleanChallenges);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHubData();
  }, [fetchHubData]);

  // ── 3. REALTIME SOCKET EVENT LISTENERS ──
  useEffect(() => {
    if (!socket) return;

    const handleRoomState = (data) => {
      if (data?.room) {
        setRoom(data.room);
        setPlayers(data.room.players || []);
      }
    };

    const handleCountdown = (data) => {
      setCountdownNumber(data.count);
      if (soundEnabled) {
        if (data.count > 0) typingSound.playCountdown();
        else typingSound.playStart();
      }
    };

    const handleMatchStarted = (data) => {
      setCountdownNumber(null);
      setRoom(data.room);
      setPlayers(data.room.players || []);
      setTypedText('');
      setErrorCount(0);
      setLiveWpm(0);
      setLiveAccuracy(100);
      setStartTime(Date.now());
      setTimeElapsed(0);
      const duration = data.room?.durationLimitSeconds || 120;
      setTimeRemaining(duration);
      setIsFinished(false);
      setMatchResult(null);
      setShowResultModal(false);
      if (soundEnabled) typingSound.playStart();

      // Auto-focus typing input immediately
      setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleProgressUpdate = (data) => {
      setPlayers((prev) =>
        prev.map((p) => {
          if (p.userId === data.userId) {
            return {
              ...p,
              typedChars: data.typedChars,
              wpm: data.wpm,
              accuracy: data.accuracy,
              isFinished: data.isFinished,
            };
          }
          return p;
        })
      );
    };

    const handleMatchFinished = (data) => {
      setIsFinished(true);
      setMatchResult(data);
      setShowResultModal(true);
      if (data.room) setRoom(data.room);
      if (soundEnabled) typingSound.playWin();
      fetchHubData();
    };

    socket.on('typing:roomState', handleRoomState);
    socket.on('typing:countdown', handleCountdown);
    socket.on('typing:started', handleMatchStarted);
    socket.on('typing:progressUpdate', handleProgressUpdate);
    socket.on('typing:finished', handleMatchFinished);

    return () => {
      socket.off('typing:roomState', handleRoomState);
      socket.off('typing:countdown', handleCountdown);
      socket.off('typing:started', handleMatchStarted);
      socket.off('typing:progressUpdate', handleProgressUpdate);
      socket.off('typing:finished', handleMatchFinished);
    };
  }, [socket, soundEnabled, fetchHubData]);

  // Handle URL room joining
  useEffect(() => {
    if (urlRoomId && socket) {
      socket.emit('typing:joinRoom', { roomId: Number(urlRoomId) });
    }
  }, [urlRoomId, socket]);

  // ── 4. TIME-BASED TEST ENGINE (COUNTDOWN & TIMEOUT FINALIZER) ──
  const effectiveTotalDuration = room?.durationLimitSeconds || selectedDuration;

  useEffect(() => {
    if (startTime && !isFinished) {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const elapsedSec = Math.max(1, Math.floor((now - startTime) / 1000));
        const remSec = Math.max(0, effectiveTotalDuration - elapsedSec);

        setTimeElapsed(elapsedSec);
        setTimeRemaining(remSec);

        // Recalculate live cumulative WPM: (cumulative correct chars / 5) / elapsed minutes
        const totalChars = sessionCompletedChars + typedText.length;
        const totalErrors = sessionCompletedErrors + errorCount;
        const correctChars = Math.max(0, totalChars - totalErrors);
        const words = correctChars / 5;
        const minutes = elapsedSec / 60;
        const currentWpm = minutes > 0 ? Math.round(words / minutes) : 0;
        setLiveWpm(currentWpm);

        // Auto Finish when Countdown reaches 0 (Time's Up!)
        if (remSec <= 0) {
          clearInterval(timerRef.current);
          setIsFinished(true);
          setShowResultModal(true);
          if (soundEnabled) typingSound.playWin();

          if (socket && room?.id && room?.status === 'PLAYING') {
            socket.emit('typing:finish', {
              roomId: room.id,
              typedChars: typedText.length,
              errorCount,
              clientDurationMs: elapsedSec * 1000,
            });
          }
        }
      }, 250);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [startTime, isFinished, typedText.length, errorCount, sessionCompletedChars, sessionCompletedErrors, effectiveTotalDuration, soundEnabled, socket, room]);

  // ── 5. PRACTICE ACTIONS & DURATION SELECTOR ──
  const handleDurationChange = (newDuration) => {
    setSelectedDuration(newDuration);
    setTimeRemaining(newDuration);
    handleRestartPractice();
  };

  const handleRestartPractice = () => {
    setTypedText('');
    setErrorCount(0);
    setLiveWpm(0);
    setLiveAccuracy(100);
    setStartTime(null);
    setTimeElapsed(0);
    setTimeRemaining(effectiveTotalDuration);
    setSessionCompletedChars(0);
    setSessionCompletedErrors(0);
    setSessionSentencesCount(0);
    setIsFinished(false);
    setShowResultModal(false);
    setLastFeedback(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleShufflePracticeChallenge = () => {
    setSelectedChallengeIndex((prev) => (prev + 1) % practiceChallenges.length);
    setTypedText('');
    setErrorCount(0);
    setLastFeedback(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleVirtualKeyClick = (key) => {
    if (isFinished) return;
    inputRef.current?.focus();
    if (soundEnabled) {
      typingSound.playKey(key.code || key.label, key.isSpecial);
    }
  };

  // ── 6. INPUT ENGINE (FULL VIETNAMESE TELEX / VNI SUPPORT) ──
  const handleInputChange = (e) => {
    if (isFinished) return;

    const val = e.target.value;
    const prevVal = typedText;

    // Start timer on first keystroke
    if (!startTime && (val.length > 0 || sessionCompletedChars > 0)) {
      setStartTime(Date.now());
    }

    // Compare typed text with challenge prefix (case-insensitive so user can type seamlessly without shift/capslock)
    let errors = 0;
    const minLen = Math.min(val.length, challengeText.length);
    for (let i = 0; i < minLen; i++) {
      if (val[i].toLowerCase() !== challengeText[i].toLowerCase()) {
        errors++;
      }
    }

    setErrorCount(errors);

    const isCorrectSoFar = errors === 0;
    const feedback = isCorrectSoFar ? 'correct' : 'error';
    setLastFeedback(feedback);

    // Audio mechanical switch trigger: "Tách tách" mechanical switch on hit, gentle thud on error
    if (soundEnabled) {
      if (val.length < prevVal.length) {
        // Backspace / character deletion
        typingSound.playKey('Backspace', true);
      } else if (val.length > 0) {
        const lastTypedChar = val[val.length - 1];
        const targetChar = challengeText[val.length - 1];
        if (lastTypedChar.toLowerCase() === targetChar?.toLowerCase() && errors === 0) {
          typingSound.playKey(lastTypedChar);
        } else {
          // Play pleasant library-grade mechanical error sound
          typingSound.playError();
        }
      }
    }

    // When the user finishes typing the entire current 2-line sentence:
    if (val.length >= challengeText.length) {
      const sentenceLen = challengeText.length;
      const finalErrors = errors;

      if (room && room.status === 'PLAYING') {
        // In multiplayer room: complete the match
        setTypedText(val);
        setIsFinished(true);
        setShowResultModal(true);
        if (soundEnabled) typingSound.playWin();
        if (socket && room.id) {
          socket.emit('typing:finish', {
            roomId: room.id,
            typedChars: val.length,
            errorCount: finalErrors,
            clientDurationMs: startTime ? Date.now() - startTime : 1000,
          });
        }
        return;
      }

      // In practice mode: seamlessly advance to the next sentence!
      if (soundEnabled) {
        typingSound.playStreak();
      }
      setSessionCompletedChars((prev) => prev + sentenceLen);
      setSessionCompletedErrors((prev) => prev + finalErrors);
      setSessionSentencesCount((prev) => prev + 1);
      setTypedText('');
      setErrorCount(0);
      setLastFeedback(null);
      setSelectedChallengeIndex((prev) => (prev + 1) % practiceChallenges.length);
      return;
    }

    setTypedText(val);

    // Compute real-time cumulative statistics
    const totalChars = sessionCompletedChars + val.length;
    const totalErrors = sessionCompletedErrors + errors;
    const accuracy = totalChars > 0 ? Math.max(0, Math.round(((totalChars - totalErrors) / totalChars) * 100)) : 100;
    setLiveAccuracy(accuracy);

    const elapsedMs = startTime ? Date.now() - startTime : 1;
    const minutes = Math.max(0.01, elapsedMs / 60000);
    const correctChars = Math.max(0, totalChars - totalErrors);
    const words = correctChars / 5;
    const wpm = Math.round(words / minutes);
    setLiveWpm(wpm);

    // Emit live progress if inside an active multiplayer room
    if (socket && room?.id && room?.status === 'PLAYING') {
      socket.emit('typing:progress', {
        roomId: room.id,
        typedChars: val.length,
        errorCount: errors,
        wpm,
        accuracy,
      });
    }
  };

  // ── 7. LOBBY & MATCHMAKING HANDLERS ──
  const handleQuickMatch = async () => {
    try {
      setLoading(true);
      const res = await typingGameApi.quickMatch({
        mode: selectedMode,
        matchType: selectedMatchType,
        difficulty: 'MEDIUM',
        language: 'VI',
      });
      if (res?.room) {
        navigate(`/games/typing/room/${res.room.id}`);
      }
    } catch (err) {
      alert(err.message || 'Không thể tìm trận lúc này, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomRoom = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await typingGameApi.createRoom({
        title: customRoomTitle.trim() || `Phòng thi đấu ${selectedMode}`,
        mode: selectedMode,
        matchType: selectedMatchType,
        difficulty: 'MEDIUM',
        language: 'VI',
        durationLimitSeconds: customRoomDuration,
      });
      if (res?.room) {
        setIsCreatingModal(false);
        navigate(`/games/typing/room/${res.room.id}`);
      }
    } catch (err) {
      alert(err.message || 'Không thể tạo phòng lúc này.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleReady = async () => {
    if (!room?.id) return;
    const me = (players || []).find((p) => Number(p.userId) === Number(user?.id));
    const nextState = !me?.isReady;
    try {
      if (socket) {
        socket.emit('typing:toggleReady', { roomId: room.id, isReady: nextState });
      } else {
        await typingGameApi.toggleReady(room.id, nextState);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSwitchTeam = async (targetTeam) => {
    if (!room?.id) return;
    try {
      if (socket) {
        socket.emit('typing:switchTeam', { roomId: room.id, team: targetTeam });
      } else {
        await typingGameApi.switchTeam(room.id, targetTeam);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStartMatch = async () => {
    if (!room?.id) return;
    try {
      if (socket) {
        socket.emit('typing:start', { roomId: room.id });
      } else {
        await typingGameApi.startMatch(room.id);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLeaveRoom = async () => {
    if (!room?.id) {
      navigate('/games/typing');
      return;
    }
    try {
      if (socket) {
        socket.emit('typing:leaveRoom', { roomId: room.id });
      }
      await typingGameApi.leaveRoom(room.id).catch(() => {});
    } finally {
      setRoom(null);
      navigate('/games/typing');
    }
  };

  // Format MM:SS helper
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ── 8. ELEGANT 2-LINE TYPING ARENA (CLEAN 2-LINE SENTENCE WITH BLINKING CARET) ──
  const renderedText = useMemo(() => {
    if (!challengeText) return null;

    return (
      <div
        className="workrank-typing-text-arena"
        style={{
          minHeight: 96,
          padding: '16px 24px',
          background: 'var(--surface, #ffffff)',
          border: isInputFocused ? '1.5px solid var(--accent, #b45309)' : '1px solid var(--border-strong, rgba(0, 0, 0, 0.16))',
          borderRadius: 12,
          position: 'relative',
          cursor: 'text',
          boxShadow: isInputFocused ? '0 0 0 3px var(--accent-soft, rgba(180, 83, 9, 0.08)), 0 4px 16px rgba(0, 0, 0, 0.04)' : '0 2px 8px rgba(0, 0, 0, 0.03)',
          transition: 'border-color var(--motion-normal) var(--ease-spring), box-shadow var(--motion-normal) var(--ease-spring)',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {!isInputFocused && !isFinished && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 10.5,
              fontWeight: 600,
              color: 'var(--accent, #b45309)',
              background: 'var(--accent-soft, rgba(180, 83, 9, 0.08))',
              border: '1px solid var(--accent-border, rgba(180, 83, 9, 0.25))',
              padding: '2px 8px',
              borderRadius: 4,
              zIndex: 10,
            }}
          >
            <Keyboard size={11} /> Bấm để gõ
          </div>
        )}

        <div
          style={{
            width: '100%',
            fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: 'clamp(20px, 2.1vw, 24px)',
            lineHeight: '40px',
            letterSpacing: '0.02em',
            wordBreak: 'break-word',
          }}
        >
          {(challengeText || '').split('').map((char, idx) => {
            const isTyped = idx < typedText.length;
            const isCurrent = idx === typedText.length;
            const isCorrect = isTyped && typedText[idx].toLowerCase() === char.toLowerCase();
            const isMismatch = isTyped && typedText[idx].toLowerCase() !== char.toLowerCase();

            // Theme-synchronized typography
            let color = '#94a3b8'; // Clear un-typed readable slate on white background
            let bg = 'transparent';

            if (isCorrect) {
              color = 'var(--text-primary, #111111)'; // Crisp high-contrast primary text
            } else if (isMismatch) {
              color = '#dc2626'; // Vivid error red
              bg = 'rgba(220, 38, 38, 0.12)';
            }

            return (
              <React.Fragment key={idx}>
                {isCurrent && (
                  <span
                    ref={activeCharRef}
                    style={{
                      display: 'inline-block',
                      width: '2.5px',
                      height: '1.2em',
                      verticalAlign: 'text-bottom',
                      background: 'var(--accent, #b45309)',
                      borderRadius: '1px',
                      marginRight: '-2.5px',
                      animation: 'caretBlink 1s infinite cubic-bezier(0.4, 0, 0.6, 1)',
                    }}
                  />
                )}
                <span
                  style={{
                    color,
                    background: bg,
                    borderRadius: isMismatch ? 3 : 0,
                    padding: isMismatch ? '0 2px' : 0,
                    fontWeight: isTyped ? 700 : 500,
                    transition: 'color var(--motion-fast) var(--ease-standard), background var(--motion-fast) var(--ease-standard)',
                  }}
                >
                  {char}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }, [challengeText, typedText, isInputFocused, isFinished]);

  // Coming Soon Screen Guard
  if (isComingSoon) {
    return (
      <PageShell>
        <GameComingSoon
          gameKey="typing_battle"
          name={availabilityGame?.name || 'WorkRank Typing Battle'}
          description={availabilityGame?.description}
          isAdmin={isAdmin}
          onAdminProceed={proceedAsAdmin}
        />
      </PageShell>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // DEDICATED ARENA ROOM VIEW (ONLINE MULTIPLAYER)
  // ══════════════════════════════════════════════════════════════════════════════
  if (room) {
    const isPlaying = room.status === 'PLAYING';
    const isDone = room.status === 'FINISHED';
    const isHost = Number(room?.hostUserId) === Number(user?.id);
    const requiredPlayerCount = room.mode === 'SOLO' ? 1 : room.mode === '1V1' ? 2 : room.mode === '2V2' ? 4 : 6;
    const canStartMatch = isHost && (players || []).length >= requiredPlayerCount && (players || []).every((p) => p.isReady);
    const teamAPlayers = (players || []).filter((p) => p.team === 'A');
    const teamBPlayers = (players || []).filter((p) => p.team === 'B');

    return (
      <PageShell>
        {/* Dedicated Battle Stage Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            paddingBottom: 14,
            borderBottom: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button variant="secondary" onClick={handleLeaveRoom} style={{ padding: '6px 10px', fontSize: 12 }}>
              <ArrowLeft size={14} /> Rời phòng
            </Button>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                {room.title || `Phòng thi đấu #${room.id}`}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                <Badge variant="warning">{room.mode}</Badge>
                <Badge variant="info">{room.matchType === 'RANKED' ? 'Đấu Hạng WorkRank' : 'Luyện Tập'}</Badge>
                <Badge variant="neutral">
                  <Clock size={11} style={{ marginRight: 3 }} /> {room.durationLimitSeconds >= 60 ? `${room.durationLimitSeconds / 60} phút` : `${room.durationLimitSeconds}s`}
                </Badge>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {players.length}/{requiredPlayerCount} Người tham gia
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={soundProfile}
              onChange={(e) => handleSwitchProfileChange(e.target.value)}
              aria-label="Loại tiếng bàn phím cơ"
              style={{
                background: 'var(--surface-soft, #f0eee9)',
                border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                borderRadius: 6,
                padding: '5px 8px',
                fontSize: 11.5,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="blue">Cơ Blue (Tách Tách)</option>
              <option value="thock">Cơ Panda (Thock Đầm)</option>
              <option value="linear">Cơ Red (Linear Êm)</option>
            </select>

            <button
              type="button"
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                typingSound.setMuted(!next);
                if (next) typingSound.playKey('A');
              }}
              title={soundEnabled ? 'Tắt âm thanh phím' : 'Bật âm thanh phím'}
              style={{
                background: soundEnabled ? 'var(--accent-soft, rgba(180, 83, 9, 0.08))' : 'var(--surface-soft, #f0eee9)',
                border: soundEnabled ? '1px solid var(--accent-border, rgba(180, 83, 9, 0.25))' : '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                borderRadius: 6,
                padding: '6px 10px',
                cursor: 'pointer',
                color: soundEnabled ? 'var(--accent, #b45309)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
          </div>
        </div>

        {/* ── COUNTDOWN MODAL ── */}
        {countdownNumber !== null && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(20, 20, 20, 0.85)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent, #b45309)', marginBottom: 12 }}>
              TRẬN ĐẤU SẮP BẮT ĐẦU ({room.durationLimitSeconds >= 60 ? `${room.durationLimitSeconds / 60} PHÚT` : `${room.durationLimitSeconds}S`})
            </div>
            <div
              style={{
                fontSize: 110,
                fontWeight: 900,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                color: countdownNumber === 0 ? 'var(--success, #15803d)' : 'var(--accent, #b45309)',
                textShadow: '0 0 30px rgba(180, 83, 9, 0.5)',
                animation: 'scalePulse 1s ease-in-out infinite',
              }}
            >
              {countdownNumber === 0 ? 'START!' : countdownNumber}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.8)', marginTop: 8 }}>
              Bài thi chuẩn không chấm phẩy · Hãy đặt tay sẵn sàng trên bàn phím...
            </div>
          </div>
        )}

        {/* ── LOBBY WAITING STAGE ── */}
        {!isPlaying && !isDone && (
          <Card style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Sảnh Chờ Trận Đấu ({room.durationLimitSeconds >= 60 ? `${room.durationLimitSeconds / 60} Phút` : `${room.durationLimitSeconds}s`})</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                  Bài thi diễn ra liên tục theo mốc thời gian. Tất cả thành viên cần bấm Sẵn Sàng để bắt đầu.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Button
                  variant={players.find((p) => Number(p.userId) === Number(user?.id))?.isReady ? 'secondary' : 'primary'}
                  onClick={handleToggleReady}
                >
                  {players.find((p) => Number(p.userId) === Number(user?.id))?.isReady ? 'Hủy Sẵn Sàng' : 'Sẵn Sàng'}
                </Button>

                {isHost && (
                  <Button
                    variant="primary"
                    disabled={!canStartMatch}
                    onClick={handleStartMatch}
                    style={{
                      background: canStartMatch ? 'var(--primary, #141414)' : undefined,
                    }}
                  >
                    Bắt Đầu Trận Đấu
                  </Button>
                )}
              </div>
            </div>

            {/* Team Layout for 2v2 / 3v3 */}
            {room.mode === '2V2' || room.mode === '3V3' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                {/* Team A */}
                <div style={{ padding: 16, background: 'rgba(2, 132, 199, 0.05)', border: '1px solid rgba(2, 132, 199, 0.2)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#0284c7' }}>
                      <Shield size={16} /> ĐỘI XANH (TEAM A)
                    </div>
                    {user?.team !== 'A' && (
                      <Button variant="secondary" size="sm" onClick={() => handleSwitchTeam('A')} style={{ fontSize: 11, padding: '3px 8px' }}>
                        Chuyển sang đội này
                      </Button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {teamAPlayers.map((p) => (
                      <div
                        key={p.userId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: 'var(--surface, #ffffff)',
                          borderRadius: 6,
                          border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <User size={15} style={{ color: '#0284c7' }} />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>
                            {p.user?.name || `Player #${p.userId}`} {Number(p.userId) === Number(user?.id) && '(Bạn)'}
                          </span>
                        </div>
                        <Badge variant={p.isReady ? 'success' : 'neutral'}>{p.isReady ? 'Sẵn sàng' : 'Chờ'}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Team B */}
                <div style={{ padding: 16, background: 'rgba(220, 38, 38, 0.05)', border: '1px solid rgba(220, 38, 38, 0.2)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#dc2626' }}>
                      <Shield size={16} /> ĐỘI ĐỎ (TEAM B)
                    </div>
                    {user?.team !== 'B' && (
                      <Button variant="secondary" size="sm" onClick={() => handleSwitchTeam('B')} style={{ fontSize: 11, padding: '3px 8px' }}>
                        Chuyển sang đội này
                      </Button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {teamBPlayers.map((p) => (
                      <div
                        key={p.userId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: 'var(--surface, #ffffff)',
                          borderRadius: 6,
                          border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <User size={15} style={{ color: '#dc2626' }} />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>
                            {p.user?.name || `Player #${p.userId}`} {Number(p.userId) === Number(user?.id) && '(Bạn)'}
                          </span>
                        </div>
                        <Badge variant={p.isReady ? 'success' : 'neutral'}>{p.isReady ? 'Sẵn sàng' : 'Chờ'}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Free-for-all 1v1 or Solo List */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {players.map((p) => (
                  <div
                    key={p.userId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: 'var(--surface-soft, #f0eee9)',
                      border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'var(--accent-soft, rgba(180, 83, 9, 0.1))',
                          color: 'var(--accent, #b45309)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {(p.user?.name || 'P')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {p.user?.name || `Player #${p.userId}`}
                          {Number(p.userId) === Number(user?.id) && ' (Bạn)'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {Number(p.userId) === Number(room.hostUserId) ? 'Chủ phòng' : 'Thành viên'}
                        </div>
                      </div>
                    </div>
                    <Badge variant={p.isReady ? 'success' : 'neutral'}>{p.isReady ? 'Sẵn sàng' : 'Chờ'}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ── LIVE PLAYING ARENA ── */}
        {isPlaying && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Live Timer & Race Track */}
            <Card style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Gauge size={15} style={{ color: 'var(--accent, #b45309)' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                      ĐƯỜNG ĐUA THỜI GIAN THỰC
                    </span>
                  </div>
                  <Badge variant="warning">{room.durationLimitSeconds >= 60 ? `${room.durationLimitSeconds / 60} Phút` : `${room.durationLimitSeconds}s`}</Badge>
                </div>

                {/* Big Countdown Timer */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 12px',
                    borderRadius: 6,
                    background: timeRemaining <= 10 ? 'rgba(220, 38, 38, 0.12)' : 'var(--surface-soft, #f0eee9)',
                    border: timeRemaining <= 10 ? '1px solid #dc2626' : '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                    color: timeRemaining <= 10 ? '#dc2626' : 'var(--text-primary)',
                    fontWeight: 800,
                    fontSize: 16,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <Timer size={16} />
                  <span>{formatTime(timeRemaining)}</span>
                </div>
              </div>

              {/* Race Track */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(players || []).map((p) => {
                  const wordsTyped = Math.round((p.typedChars || 0) / 5);
                  const isMe = Number(p.userId) === Number(user?.id);

                  return (
                    <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 140, fontSize: 12, fontWeight: isMe ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.user?.name || `Player #${p.userId}`} {isMe && '(Bạn)'}
                      </div>
                      <div style={{ flex: 1, position: 'relative', height: 22, background: 'var(--surface-soft, #f0eee9)', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, Math.round(((p.typedChars || 0) / Math.max(1, challengeText.length)) * 100))}%`,
                            background:
                              p.team === 'B'
                                ? 'linear-gradient(90deg, #f87171, #dc2626)'
                                : 'linear-gradient(90deg, var(--accent, #b45309), #d97706)',
                            transition: 'width 120ms linear',
                          }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            right: 8,
                            top: 2,
                            fontSize: 10,
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {wordsTyped} từ ({p.wpm || 0} WPM)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Target Text & Dedicated Battle View */}
            <Card style={{ padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
                  <span>
                    Tốc độ: <strong style={{ color: 'var(--accent, #b45309)', fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{liveWpm}</strong> WPM
                  </span>
                  <span>
                    Chính xác: <strong style={{ color: 'var(--success, #15803d)', fontSize: 18 }}>{liveAccuracy}%</strong>
                  </span>
                  <span>
                    Lỗi: <strong style={{ color: errorCount > 0 ? '#dc2626' : 'var(--text-primary)', fontSize: 18 }}>{errorCount}</strong>
                  </span>
                  <span>
                    Đã gõ: <strong style={{ color: 'var(--text-primary)', fontSize: 18 }}>{Math.round(typedText.length / 5)}</strong> từ
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowKeyboard(!showKeyboard)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '4px 8px' }}
                  >
                    {showKeyboard ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showKeyboard ? 'Ẩn phím' : 'Hiện phím'}
                  </Button>
                </div>
              </div>

              {renderedText}

              {/* Seamless Hidden Input */}
              <input
                ref={inputRef}
                type="text"
                value={typedText}
                onChange={handleInputChange}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                onPaste={(e) => {
                  e.preventDefault();
                  alert('Chống gian lận: Nghiêm cấm dán (paste) nội dung khi thi đấu!');
                }}
                onDrop={(e) => e.preventDefault()}
                onContextMenu={(e) => e.preventDefault()}
                autoFocus
                disabled={isFinished}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  pointerEvents: 'none',
                  top: -9999,
                  left: -9999,
                }}
              />

              {/* Minimalist Virtual Keyboard */}
              {showKeyboard && (
                <div style={{ marginTop: 18 }}>
                  <VisualKeyboard
                    activeKeys={activeKeyCodes}
                    targetChar={currentTargetChar}
                    lastFeedback={lastFeedback}
                    onKeyClick={handleVirtualKeyClick}
                  />
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── MATCH RESULT SCREEN (WORKRANK EDITORIAL STYLE) ── */}
        {isDone && (
          <Card style={{ padding: 36, textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
            {(() => {
              const myResult = matchResult?.results?.find((r) => Number(r.userId) === Number(user?.id));
              const isWinner = myResult?.isWinner;
              return (
                <div>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      margin: '0 auto 16px',
                      borderRadius: '50%',
                      background: isWinner ? 'var(--success-soft, rgba(21, 128, 61, 0.12))' : 'rgba(220, 38, 38, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isWinner ? 'var(--success, #15803d)' : '#dc2626',
                    }}
                  >
                    <Trophy size={32} />
                  </div>

                  <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {isWinner ? (
                      <>
                        <Sparkles size={22} style={{ color: 'var(--accent, #b45309)' }} /> CHIẾN THẮNG TUYỆT ĐỐI!
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={22} style={{ color: 'var(--accent, #b45309)' }} /> KẾT THÚC BÀI THI
                      </>
                    )}
                  </h2>
                  <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)', fontSize: 13 }}>
                    {matchResult?.mode} Match • {room.durationLimitSeconds >= 60 ? `${room.durationLimitSeconds / 60} Phút` : `${room.durationLimitSeconds}s`} • {matchResult?.matchType === 'RANKED' ? 'Đấu Hạng WorkRank' : 'Luyện Tập'}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 26 }}>
                    <div style={{ padding: '12px 14px', background: 'var(--surface-soft, #f0eee9)', borderRadius: 8, border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>TỐC ĐỘ GÕ</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent, #b45309)', marginTop: 2 }}>{myResult?.wpm || liveWpm} WPM</div>
                    </div>
                    <div style={{ padding: '12px 14px', background: 'var(--surface-soft, #f0eee9)', borderRadius: 8, border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CHÍNH XÁC</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success, #15803d)', marginTop: 2 }}>{myResult?.accuracy || liveAccuracy}%</div>
                    </div>
                    <div style={{ padding: '12px 14px', background: 'var(--surface-soft, #f0eee9)', borderRadius: 8, border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>SỐ TỪ GÕ</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{Math.round((myResult?.typedChars || typedText.length) / 5)} từ</div>
                    </div>
                    <div style={{ padding: '12px 14px', background: 'var(--surface-soft, #f0eee9)', borderRadius: 8, border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ĐIỂM WORKRANK</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#0284c7', marginTop: 2 }}>+{myResult?.scoreDelta || myResult?.pointsAwarded || 0} XP</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                    <Button variant="secondary" onClick={handleLeaveRoom}>
                      Quay lại Sảnh Đấu
                    </Button>
                    <Button variant="primary" onClick={() => navigate('/leaderboard')}>
                      Xem Bảng Xếp Hạng Công Ty
                    </Button>
                  </div>
                </div>
              );
            })()}
          </Card>
        )}
      </PageShell>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // MAIN HUB: CLEAN STAGE VIEW (WORKRANK NATIVE AESTHETIC)
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <PageShell>
      {/* Sleek Header matching WorkRank Home / Arena */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 18,
          paddingBottom: 16,
          borderBottom: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              WorkRank Typing Battle
            </h1>
            <Badge variant="warning">Đấu Trường Gõ Phím Mạng Xã Hội</Badge>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Bài thi chuẩn không dấu chấm phẩy · Luyện tập và thi đấu theo mốc 2 phút hoặc 5 phút · Tích hợp BXH công ty.
          </p>
        </div>

        {/* Compact Stats Ribbon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ padding: '6px 12px', background: 'var(--surface-soft, #f0eee9)', border: '1px solid var(--border, rgba(0, 0, 0, 0.08))', borderRadius: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>Best WPM: </span>
            <strong style={{ color: 'var(--accent, #b45309)' }}>
              <AnimatedNumber value={myStats?.bestWpm || 0} />
            </strong>
          </div>
          <div style={{ padding: '6px 12px', background: 'var(--surface-soft, #f0eee9)', border: '1px solid var(--border, rgba(0, 0, 0, 0.08))', borderRadius: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>Chính xác: </span>
            <strong style={{ color: 'var(--success, #15803d)' }}>{myStats?.bestAccuracy || 100}%</strong>
          </div>
          <div style={{ padding: '6px 12px', background: 'var(--surface-soft, #f0eee9)', border: '1px solid var(--border, rgba(0, 0, 0, 0.08))', borderRadius: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>Chiến thắng: </span>
            <strong style={{ color: '#0284c7' }}>{myStats?.winsCount || 0}</strong>
          </div>
          <div style={{ padding: '6px 12px', background: 'var(--surface-soft, #f0eee9)', border: '1px solid var(--border, rgba(0, 0, 0, 0.08))', borderRadius: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>Tích lũy: </span>
            <strong style={{ color: '#7c3aed' }}>+{myStats?.totalWorkRankPointsEarned || 0} XP</strong>
          </div>
          <select
            value={soundProfile}
            onChange={(e) => handleSwitchProfileChange(e.target.value)}
            aria-label="Loại tiếng bàn phím cơ"
            style={{
              background: 'var(--surface-soft, #f0eee9)',
              border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
              borderRadius: 6,
              padding: '5px 8px',
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="blue">Cơ Blue (Tách Tách)</option>
            <option value="thock">Cơ Panda (Thock Đầm)</option>
            <option value="linear">Cơ Red (Linear Êm)</option>
          </select>

          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              typingSound.setMuted(!next);
              if (next) typingSound.playKey('A');
            }}
            title={soundEnabled ? 'Tắt âm thanh phím' : 'Bật âm thanh phím'}
            style={{
              background: soundEnabled ? 'var(--accent-soft, rgba(180, 83, 9, 0.08))' : 'var(--surface-soft, #f0eee9)',
              border: soundEnabled ? '1px solid var(--accent-border, rgba(180, 83, 9, 0.25))' : '1px solid var(--border, rgba(0, 0, 0, 0.08))',
              borderRadius: 6,
              padding: '6px 10px',
              cursor: 'pointer',
              color: soundEnabled ? 'var(--accent, #b45309)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
        </div>
      </div>

      {/* ── TABS NAVIGATION ── */}
      <div style={{ marginBottom: 18 }}>
        <SegmentedControl
          value={activeTab}
          onChange={(tab) => setActiveTab(tab)}
          options={[
            { key: 'practice', label: 'Luyện Gõ Theo Giờ (2p / 5p)' },
            { key: 'arena', label: 'Đấu Trường Trực Tuyến (PvP)' },
            { key: 'leaderboard', label: 'Bảng Xếp Hạng' },
          ]}
        />
      </div>

      <TabTransition key={activeTab} minHeight={420}>
        {/* ══════════════════════════════════════════════════════════════════════════════
            TAB 1: DEDICATED TIMED PRACTICE & MINIMALIST KEYBOARD STAGE
        ══════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'practice' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card style={{ padding: 24 }}>
              {/* Practice Toolbar & Duration Selector */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 16,
                  paddingBottom: 14,
                  borderBottom: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Timer size={16} style={{ color: 'var(--accent, #b45309)' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Mốc thời gian:</span>
                  </div>

                  {/* Time Limit Selector Buttons */}
                  <div style={{ display: 'inline-flex', background: 'var(--surface-soft, #f0eee9)', padding: 3, borderRadius: 8, border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                    {[
                      { sec: 30, label: '30s' },
                      { sec: 60, label: '1 Phút' },
                      { sec: 120, label: '2 Phút (Chuẩn)' },
                      { sec: 300, label: '5 Phút (Bền bỉ)' },
                    ].map(({ sec, label }) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => handleDurationChange(sec)}
                        style={{
                          border: 'none',
                          background: selectedDuration === sec ? 'var(--surface, #ffffff)' : 'transparent',
                          color: selectedDuration === sec ? 'var(--accent, #b45309)' : 'var(--text-secondary)',
                          fontWeight: selectedDuration === sec ? 700 : 500,
                          fontSize: 12,
                          padding: '5px 12px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          boxShadow: selectedDuration === sec ? '0 1px 4px rgba(0, 0, 0, 0.06)' : 'none',
                          transition: 'all var(--motion-fast) var(--ease-standard)',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <Badge variant="warning">Không chấm phẩy</Badge>
                  <Badge variant="info">Mạng xã hội trending</Badge>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Button
                    variant="secondary"
                    onClick={handleRestartPractice}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '6px 12px' }}
                  >
                    <RotateCcw size={13} /> Gõ lại <span style={{ opacity: 0.6, fontSize: 10 }}>(Esc)</span>
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleShufflePracticeChallenge}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '6px 14px' }}
                  >
                    <Shuffle size={13} /> Đổi chủ đề MXH
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowKeyboard(!showKeyboard)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '6px 12px' }}
                  >
                    {showKeyboard ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showKeyboard ? 'Ẩn phím' : 'Hiện phím'}
                  </Button>
                </div>
              </div>

              {/* Realtime Minimalist Typing HUD with Big Countdown Clock */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 24,
                  marginBottom: 18,
                  padding: '14px 20px',
                  background: 'var(--surface-soft, #f0eee9)',
                  borderRadius: 10,
                  border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                  flexWrap: 'wrap',
                }}
              >
                {/* Big Countdown Timer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: timeRemaining <= 10 && startTime ? 'rgba(220, 38, 38, 0.15)' : 'var(--surface, #ffffff)',
                      border: timeRemaining <= 10 && startTime ? '1.5px solid #dc2626' : '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: timeRemaining <= 10 && startTime ? '#dc2626' : 'var(--accent, #b45309)',
                    }}
                  >
                    <Timer size={22} />
                  </div>
                  <div>
                    <span style={{ fontSize: 10, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>THỜI GIAN CÒN LẠI</span>
                    <div
                      style={{
                        fontSize: 26,
                        fontWeight: 900,
                        color: timeRemaining <= 10 && startTime ? '#dc2626' : 'var(--text-primary)',
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1.1,
                      }}
                    >
                      {formatTime(timeRemaining)}
                    </div>
                  </div>
                </div>

                <div style={{ borderLeft: '1px solid var(--border, rgba(0, 0, 0, 0.08))', paddingLeft: 20 }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>TỐC ĐỘ GÕ</span>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent, #b45309)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                    {liveWpm} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>WPM</span>
                  </div>
                </div>

                <div style={{ borderLeft: '1px solid var(--border, rgba(0, 0, 0, 0.08))', paddingLeft: 20 }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>CHÍNH XÁC</span>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--success, #15803d)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                    {liveAccuracy}%
                  </div>
                </div>

                <div style={{ borderLeft: '1px solid var(--border, rgba(0, 0, 0, 0.08))', paddingLeft: 20 }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>LỖI SAI</span>
                  <div style={{ fontSize: 26, fontWeight: 800, color: (sessionCompletedErrors + errorCount) > 0 ? '#dc2626' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                    {sessionCompletedErrors + errorCount}
                  </div>
                </div>

                <div style={{ borderLeft: '1px solid var(--border, rgba(0, 0, 0, 0.08))', paddingLeft: 20 }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>TỪ ĐÃ HOÀN THÀNH</span>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                    {Math.round((sessionCompletedChars + typedText.length) / 5)} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>từ</span>
                  </div>
                </div>

                <div style={{ borderLeft: '1px solid var(--border, rgba(0, 0, 0, 0.08))', paddingLeft: 20 }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>CÂU HOÀN THÀNH</span>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                    {sessionSentencesCount} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>câu</span>
                  </div>
                </div>
              </div>

              {/* Target Text Box */}
              {renderedText}

              {/* Seamless Hidden Input */}
              <input
                ref={inputRef}
                type="text"
                value={typedText}
                onChange={handleInputChange}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                autoFocus
                disabled={isFinished}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  pointerEvents: 'none',
                  top: -9999,
                  left: -9999,
                }}
              />

              {/* Minimalist Virtual Keyboard */}
              {showKeyboard && (
                <div style={{ marginTop: 20 }}>
                  <VisualKeyboard
                    activeKeys={activeKeyCodes}
                    targetChar={currentTargetChar}
                    lastFeedback={lastFeedback}
                    onKeyClick={handleVirtualKeyClick}
                  />
                </div>
              )}
            </Card>

            {/* Practice Result Modal */}
            <AnimatedModal
              isOpen={showResultModal && !room}
              onClose={() => setShowResultModal(false)}
              title="KẾT QUẢ BÀI THI ĐÁNH MÁY"
            >
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div
                  style={{
                    width: 60,
                    height: 60,
                    margin: '0 auto 14px',
                    borderRadius: '50%',
                    background: 'var(--success-soft, rgba(21, 128, 61, 0.12))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--success, #15803d)',
                  }}
                >
                  <Trophy size={30} />
                </div>

                <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Sparkles size={20} style={{ color: 'var(--accent, #b45309)' }} /> HOÀN THÀNH BÀI THI {selectedDuration >= 60 ? `${selectedDuration / 60} PHÚT` : `${selectedDuration}S`}!
                </h2>
                <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: 13 }}>
                  Bài thi mạng xã hội đạt chuẩn không chấm phẩy
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
                  <div style={{ padding: '12px 10px', background: 'var(--surface-soft, #f0eee9)', borderRadius: 8, border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>TỐC ĐỘ</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent, #b45309)', marginTop: 2 }}>{liveWpm} WPM</div>
                  </div>
                  <div style={{ padding: '12px 10px', background: 'var(--surface-soft, #f0eee9)', borderRadius: 8, border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>CHÍNH XÁC</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success, #15803d)', marginTop: 2 }}>{liveAccuracy}%</div>
                  </div>
                  <div style={{ padding: '12px 10px', background: 'var(--surface-soft, #f0eee9)', borderRadius: 8, border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>TỔNG TỪ ĐÃ GÕ</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{Math.round((sessionCompletedChars + typedText.length) / 5)} từ</div>
                  </div>
                  <div style={{ padding: '12px 10px', background: 'var(--surface-soft, #f0eee9)', borderRadius: 8, border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>CÂU HOÀN THÀNH</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{sessionSentencesCount} câu</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                  <Button variant="secondary" onClick={handleRestartPractice}>
                    <RotateCcw size={14} /> Thử Lại Lượt Mới
                  </Button>
                  <Button variant="primary" onClick={() => setActiveTab('arena')}>
                    <Swords size={14} /> So Tài Trực Tuyến
                  </Button>
                </div>
              </div>
            </AnimatedModal>
          </div>
        ) : activeTab === 'arena' ? (
          /* ══════════════════════════════════════════════════════════════════════════════
              TAB 2: MULTIPLAYER PVP ARENA & LOBBY HUB
          ══════════════════════════════════════════════════════════════════════════════ */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Mode Selection Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {[
                { mode: 'SOLO', title: 'Solo Time Trial', desc: 'Thử thách tốc độ đơn lẻ và tích lũy XP', icon: Zap },
                { mode: '1V1', title: '1 vs 1 Quyết Đấu', desc: 'Đối đầu trực diện 2 người chơi', icon: Swords },
                { mode: '2V2', title: '2 vs 2 Đồng Đội', desc: 'Phối hợp 2 người mỗi đội tính điểm team', icon: Users },
                { mode: '3V3', title: '3 vs 3 Đại Chiến', desc: 'Đấu trường 6 người kịch tính và danh dự', icon: Shield },
              ].map((item) => {
                const isSel = selectedMode === item.mode;
                const Icon = item.icon;
                return (
                  <Card
                    key={item.mode}
                    onClick={() => setSelectedMode(item.mode)}
                    style={{
                      padding: 16,
                      cursor: 'pointer',
                      border: isSel ? '2px solid var(--accent, #b45309)' : '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                      background: isSel ? 'var(--accent-soft, rgba(180, 83, 9, 0.08))' : 'var(--surface, #ffffff)',
                      boxShadow: isSel ? '0 4px 12px var(--accent-soft, rgba(180, 83, 9, 0.12))' : 'none',
                      transition: 'all var(--motion-fast) var(--ease-standard)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          background: isSel ? 'var(--accent, #b45309)' : 'var(--surface-soft, #f0eee9)',
                          color: isSel ? '#ffffff' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon size={18} />
                      </div>
                      <Badge variant={isSel ? 'warning' : 'neutral'}>{item.mode}</Badge>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{item.desc}</div>
                  </Card>
                );
              })}
            </div>

            {/* Quick Matchmaking & Create Room Actions */}
            <Card style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Tìm Trận Nhanh (Ranked)</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                    Hệ thống sẽ tự động ghép đối thủ phù hợp cùng cấp độ để tính điểm Bảng Xếp Hạng.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Button variant="secondary" onClick={() => setIsCreatingModal(true)}>
                    <Plus size={14} /> Tạo Phòng Tùy Chỉnh
                  </Button>
                  <Button variant="primary" onClick={handleQuickMatch} disabled={loading}>
                    <Play size={14} /> Bắt Đầu Ghép Trận ({selectedMode})
                  </Button>
                </div>
              </div>
            </Card>

            {/* Available Room List */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Danh Sách Phòng Đang Chờ ({roomList.length})</h3>
                <Button variant="secondary" size="sm" onClick={fetchHubData}>
                  <RefreshCw size={13} /> Làm mới
                </Button>
              </div>

              {roomList.length === 0 ? (
                <EmptyState
                  icon={Swords}
                  title="Chưa có phòng thi đấu nào"
                  description="Hãy tạo phòng mới hoặc bấm Tìm Trận Nhanh để tham gia đấu trường."
                  compact
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                  {roomList.map((r) => (
                    <Card key={r.id} style={{ padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{r.title}</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Badge variant="warning">{r.mode}</Badge>
                          <Badge variant="neutral">{r.durationLimitSeconds >= 60 ? `${r.durationLimitSeconds / 60}p` : `${r.durationLimitSeconds}s`}</Badge>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                        Chủ phòng: <strong>{r.host?.name || 'Thành viên'}</strong> • {r.players?.length || 1} Người
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        style={{ width: '100%' }}
                        onClick={() => navigate(`/games/typing/room/${r.id}`)}
                      >
                        Tham Gia Phòng
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ══════════════════════════════════════════════════════════════════════════════
              TAB 3: LEADERBOARD & HALL OF FAME
          ══════════════════════════════════════════════════════════════════════════════ */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Podium Top 3 */}
            {leaderboard.length >= 3 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 8 }}>
                {[
                  { pos: 2, rank: 'Hạng #2 (Bạc)', color: '#727f87', data: leaderboard[1] },
                  { pos: 1, rank: 'Hạng #1 (Vàng)', color: '#a78021', data: leaderboard[0] },
                  { pos: 3, rank: 'Hạng #3 (Đồng)', color: '#a3674c', data: leaderboard[2] },
                ].map(({ rank, color, data }, idx) => (
                  <Card
                    key={idx}
                    style={{
                      padding: 18,
                      textAlign: 'center',
                      background: 'var(--surface, #ffffff)',
                      border: `1.5px solid ${color}`,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 6 }}>{rank}</div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                      {data?.user?.name || data?.name || 'Chiến binh'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {data?.user?.teamName || data?.teamName || 'Đội công ty'}
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 10, fontSize: 12 }}>
                      <div>
                        <strong style={{ color: 'var(--accent, #b45309)' }}>{data?.bestWpm || 0}</strong> WPM
                      </div>
                      <div>
                        <strong style={{ color: 'var(--success, #15803d)' }}>{data?.bestAccuracy || 100}%</strong>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Leaderboard Table */}
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-soft, #f0eee9)', borderBottom: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', width: 60, fontWeight: 700 }}>HẠNG</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 700 }}>THÀNH VIÊN</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 700 }}>ĐỘI NHÓM</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', textAlign: 'right', fontWeight: 700 }}>BEST WPM</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', textAlign: 'right', fontWeight: 700 }}>CHÍNH XÁC</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', textAlign: 'right', fontWeight: 700 }}>THẮNG</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', textAlign: 'right', fontWeight: 700 }}>XP WORKRANK</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
                        Chưa có dữ liệu bảng xếp hạng typing. Hãy thi đấu để ghi danh!
                      </td>
                    </tr>
                  ) : (
                    leaderboard.map((item, index) => (
                      <tr
                        key={item.userId || index}
                        style={{
                          borderBottom: '1px solid var(--border, rgba(0, 0, 0, 0.05))',
                          background: Number(item.userId) === Number(user?.id) ? 'var(--accent-soft, rgba(180, 83, 9, 0.08))' : undefined,
                        }}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: index < 3 ? 'var(--accent, #b45309)' : 'var(--text-muted)' }}>
                          #{index + 1}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                          {item.user?.name || item.name || `User #${item.userId}`}
                          {Number(item.userId) === Number(user?.id) && ' (Bạn)'}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                          {item.user?.teamName || item.teamName || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--accent, #b45309)' }}>
                          {item.bestWpm || 0}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--success, #15803d)', fontWeight: 600 }}>
                          {item.bestAccuracy || 100}%
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#0284c7', fontWeight: 600 }}>
                          {item.winsCount || 0}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>
                          +{item.totalWorkRankPointsEarned || 0} XP
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </TabTransition>

      {/* ── CREATE CUSTOM ROOM MODAL ── */}
      <AnimatedModal
        isOpen={isCreatingModal}
        onClose={() => setIsCreatingModal(false)}
        title="Tạo Phòng Thi Đấu Tùy Chỉnh"
      >
        <form onSubmit={handleCreateCustomRoom} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Tên phòng thi đấu:
            </label>
            <input
              type="text"
              value={customRoomTitle}
              onChange={(e) => setCustomRoomTitle(e.target.value)}
              placeholder="VD: Phòng Đấu Tốc Độ Team Alpha"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 6,
                border: '1px solid var(--border-strong, rgba(0, 0, 0, 0.16))',
                background: 'var(--surface, #ffffff)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Mốc thời gian thi đấu:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { sec: 30, label: '30 Giây' },
                { sec: 60, label: '1 Phút' },
                { sec: 120, label: '2 Phút (Chuẩn)' },
                { sec: 300, label: '5 Phút (Bền bỉ)' },
              ].map(({ sec, label }) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setCustomRoomDuration(sec)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: customRoomDuration === sec ? '2px solid var(--accent, #b45309)' : '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                    background: customRoomDuration === sec ? 'var(--accent-soft, rgba(180, 83, 9, 0.08))' : 'var(--surface, #ffffff)',
                    color: customRoomDuration === sec ? 'var(--accent, #b45309)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Chế độ thi đấu:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {['SOLO', '1V1', '2V2', '3V3'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedMode(m)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: selectedMode === m ? '2px solid var(--accent, #b45309)' : '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                    background: selectedMode === m ? 'var(--accent-soft, rgba(180, 83, 9, 0.08))' : 'var(--surface, #ffffff)',
                    color: selectedMode === m ? 'var(--accent, #b45309)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Phân loại trận:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {[
                { type: 'RANKED', label: 'Đấu Hạng (Cộng điểm WorkRank)' },
                { type: 'PRACTICE', label: 'Luyện Tập (Không tính điểm)' },
              ].map(({ type, label }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedMatchType(type)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: selectedMatchType === type ? '2px solid var(--accent, #b45309)' : '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                    background: selectedMatchType === type ? 'var(--accent-soft, rgba(180, 83, 9, 0.08))' : 'var(--surface, #ffffff)',
                    color: selectedMatchType === type ? 'var(--accent, #b45309)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <Button variant="secondary" type="button" onClick={() => setIsCreatingModal(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              Tạo và Vào Phòng
            </Button>
          </div>
        </form>
      </AnimatedModal>
    </PageShell>
  );
}
