import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
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
  Crown,
  AlertTriangle,
  Radio,
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



// Helper to clean & sanitize challenge text to standard lowercase Vietnamese without punctuation
const sanitizeChallengeText = (text) =>
  (text || '')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();

// Helper to generate a continuous stream of words from challenges for uninterrupted typing
const generatePracticeStream = (challenges) => {
  const list = challenges && challenges.length > 0 ? challenges : DEFAULT_PRACTICE_CHALLENGES;
  const shuffled = [...list].sort(() => Math.random() - 0.5);
  return shuffled
    .map((c) => sanitizeChallengeText(c.content))
    .filter(Boolean)
    .join(' ');
};

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

// ── LIVE SPECTATOR OBSERVATION TYPING STREAM COMPONENT ──
function SpectatorTypingStream({ player, challengeText, teamColor = '#0284c7', teamLetter = 'A' }) {
  const containerRef = useRef(null);
  const cursorRef = useRef(null);
  const [scrollOffsetY, setScrollOffsetY] = useState(0);

  const typedChars = Math.min(challengeText.length, player?.typedChars || 0);
  const isFinished = player?.status === 'FINISHED' || typedChars >= challengeText.length;

  const typedPart = challengeText.slice(0, typedChars);
  const activeChar = !isFinished && challengeText[typedChars] ? challengeText[typedChars] : '';
  const upcomingPart = !isFinished ? challengeText.slice(typedChars + 1) : '';

  useEffect(() => {
    if (!containerRef.current || !cursorRef.current) return;
    const container = containerRef.current;
    const activeEl = cursorRef.current;
    const firstEl = container.firstElementChild;
    const firstTop = firstEl ? firstEl.offsetTop : 0;
    const activeTop = activeEl.offsetTop;
    const relativeTop = activeTop - firstTop;
    const lineHeight = 38;
    const currentLine = Math.max(0, Math.floor((relativeTop + 4) / lineHeight));
    setScrollOffsetY(currentLine * lineHeight);
  }, [typedChars]);

  const teamBgSoft = teamColor === '#0284c7' ? 'rgba(2, 132, 199, 0.08)' : 'rgba(234, 88, 12, 0.08)';
  const teamBorder = teamColor === '#0284c7' ? 'rgba(2, 132, 199, 0.3)' : 'rgba(234, 88, 12, 0.3)';

  return (
    <div
      style={{
        background: 'var(--surface, #ffffff)',
        border: `1.5px solid ${teamBorder}`,
        borderRadius: 10,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Stream Header: Player identity & live telemetry */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: teamBgSoft,
              border: `1.5px solid ${teamColor}`,
              color: teamColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {(player?.user?.name || `P${teamLetter}`)[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              {player?.user?.name || `Người chơi ${teamLetter}`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {player?.user?.jobTitle || (teamLetter === 'A' ? 'Đội Xanh' : 'Đội Cam')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: teamColor,
              padding: '2px 8px',
              borderRadius: 6,
              background: teamBgSoft,
            }}
          >
            {player?.wpm || 0} WPM
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {player?.accuracy || 100}% chính xác
          </span>
          {isFinished && (
            <Badge variant="success">🏁 Xong</Badge>
          )}
        </div>
      </div>

      {/* Observation Scrolling Stage */}
      <div
        style={{
          position: 'relative',
          height: 120,
          overflow: 'hidden',
          background: 'var(--surface-soft, #f8f7f4)',
          borderRadius: 8,
          border: '1px solid var(--border, rgba(0, 0, 0, 0.06))',
          padding: '12px 14px',
          userSelect: 'none',
        }}
      >
        <div
          ref={containerRef}
          style={{
            transform: `translateY(-${scrollOffsetY}px)`,
            transition: 'transform var(--motion-fast) var(--ease-standard)',
            fontSize: 15,
            lineHeight: '38px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            letterSpacing: '0.02em',
            wordBreak: 'break-word',
          }}
        >
          {/* Typed Portion */}
          <span style={{ color: teamColor, fontWeight: 700 }}>
            {typedPart}
          </span>

          {/* Active Cursor Character */}
          {!isFinished && activeChar && (
            <span
              ref={cursorRef}
              style={{
                position: 'relative',
                background: teamBgSoft,
                borderBottom: `2.5px solid ${teamColor}`,
                color: 'var(--text-primary)',
                fontWeight: 900,
                borderRadius: '2px 2px 0 0',
                padding: '0 1px',
              }}
            >
              {activeChar}
              <span
                style={{
                  position: 'absolute',
                  right: -2,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: teamColor,
                  animation: 'caretBlink 1s infinite',
                }}
              />
            </span>
          )}

          {/* Remaining Portion */}
          {!isFinished && upcomingPart && (
            <span style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
              {upcomingPart}
            </span>
          )}

          {isFinished && (
            <span style={{ marginLeft: 8, color: 'var(--success, #15803d)', fontWeight: 700 }}>
              ✓ Đã hoàn thành toàn bộ bài thi!
            </span>
          )}
        </div>
      </div>

      {/* Bottom Mini Telemetry: Progress track & Error count */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted)' }}>
        <div>
          Tiến độ: <strong style={{ color: teamColor }}>{player?.progressPct || 0}%</strong> ({Math.round(typedChars / 5)} / {Math.round(challengeText.length / 5)} từ)
        </div>
        <div>
          Lỗi: <strong style={{ color: (player?.errorCount || 0) > 0 ? '#dc2626' : 'var(--text-muted)' }}>{player?.errorCount || 0}</strong>
        </div>
      </div>
    </div>
  );
}

export default function TypingBattle() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { roomId: urlRoomId } = useParams();
  const { user, socket, isAdmin } = useAuth();
  const { isComingSoon, game: availabilityGame, proceedAsAdmin } = useGameAvailability('typing_battle');

  // Spectator Role & Live State
  const isSpectateRoute = location.pathname.includes('/spectate/') || searchParams.get('spectate') === '1';
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [spectators, setSpectators] = useState([]);
  const [showSpectatorsModal, setShowSpectatorsModal] = useState(false);
  const [liveMatches, setLiveMatches] = useState([]);
  const [spectatorViewTab, setSpectatorViewTab] = useState('both'); // 'both' | 'p1' | 'p2'

  // Navigation Tabs: 'practice' (Instant Trainer) | 'arena' (Online PvP) | 'leaderboard'
  const [activeTab, setActiveTab] = useState('practice');
  const [selectedMode, setSelectedMode] = useState('1V1'); // 'SOLO' | '1V1' | '2V2' | '3V3'
  const [selectedMatchType, setSelectedMatchType] = useState('RANKED'); // 'RANKED' | 'PRACTICE'

  // Time-based Test Settings: 30s, 60s (1 min), 120s (2 min), 300s (5 min)
  const [selectedDuration, setSelectedDuration] = useState(120); // Default: 2 minutes (120s)

  // Online Room & Gameplay State
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);

  // Check if current user is an active participant player in the room
  const isUserInPlayers = useMemo(() => {
    return players?.some((p) => p.userId && Number(p.userId) === Number(user?.id));
  }, [players, user?.id]);

  // Read-only spectator mode flag
  const isSpectator = isSpectateRoute || (!isUserInPlayers && (room?.status === 'PLAYING' || room?.status === 'FINISHED'));
  const [loading, setLoading] = useState(false);
  const [roomError, setRoomError] = useState(null);
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
  const [practiceStreamText, setPracticeStreamText] = useState(() => generatePracticeStream(DEFAULT_PRACTICE_CHALLENGES));
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
  const [practiceSubmissionResult, setPracticeSubmissionResult] = useState(null);

  // 2-Line Smooth Rolling Window State & Refs
  const [scrollOffsetY, setScrollOffsetY] = useState(0);
  const wordsContainerRef = useRef(null);
  const wordRefs = useRef([]);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const activeCharRef = useRef(null);

  // Challenge text determination
  const challengeText = useMemo(() => {
    if (room?.challengeText) {
      return sanitizeChallengeText(room.challengeText);
    }
    return practiceStreamText;
  }, [room, practiceStreamText]);

  // Word Tokens breakdown for 2-line smooth rolling window
  const wordTokens = useMemo(() => {
    if (!challengeText) return [];
    const rawWords = challengeText.split(' ');
    let charCursor = 0;
    return rawWords.map((word, idx) => {
      const startIndex = charCursor;
      const endIndex = startIndex + word.length;
      charCursor = endIndex + 1; // +1 for the space separator
      return {
        id: idx,
        word,
        startIndex,
        endIndex,
      };
    });
  }, [challengeText]);

  // Determine active word index from current typed length
  const activeWordIndex = useMemo(() => {
    const currentLength = typedText.length;
    const foundIdx = wordTokens.findIndex(
      (w) => currentLength >= w.startIndex && currentLength <= w.endIndex
    );
    if (foundIdx !== -1) return foundIdx;
    if (currentLength > 0 && wordTokens.length > 0) {
      const spaceIdx = wordTokens.findIndex((w) => currentLength === w.endIndex + 1);
      if (spaceIdx !== -1) return Math.min(spaceIdx + 1, wordTokens.length - 1);
      return wordTokens.length - 1;
    }
    return 0;
  }, [wordTokens, typedText.length]);

  // Update vertical scroll offset to maintain a 2-line rolling window
  useEffect(() => {
    const container = wordsContainerRef.current;
    const activeEl = wordRefs.current[activeWordIndex];
    if (!container || !activeEl) {
      setScrollOffsetY(0);
      return;
    }

    const firstEl = container.firstElementChild;
    const firstTop = firstEl ? firstEl.offsetTop : 0;
    const activeTop = activeEl.offsetTop;
    const relativeTop = activeTop - firstTop;
    const lineHeight = 44;
    const currentLine = Math.max(0, Math.floor((relativeTop + 4) / lineHeight));

    setScrollOffsetY(currentLine * lineHeight);
  }, [activeWordIndex, challengeText]);

  // Recalculate on window resize
  useEffect(() => {
    const handleResize = () => {
      const container = wordsContainerRef.current;
      const activeEl = wordRefs.current[activeWordIndex];
      if (!container || !activeEl) return;
      const firstEl = container.firstElementChild;
      const firstTop = firstEl ? firstEl.offsetTop : 0;
      const activeTop = activeEl.offsetTop;
      const relativeTop = activeTop - firstTop;
      const lineHeight = 44;
      const currentLine = Math.max(0, Math.floor((relativeTop + 4) / lineHeight));
      setScrollOffsetY(currentLine * lineHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeWordIndex]);

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
      const [statsRes, lbRes, roomsRes, liveRoomsRes, chRes] = await Promise.all([
        typingGameApi.getMyStats().catch(() => null),
        typingGameApi.getLeaderboard({ limit: 50 }).catch(() => ({ leaderboard: [] })),
        typingGameApi.listRooms({ status: 'WAITING' }).catch(() => ({ rooms: [] })),
        typingGameApi.listRooms({ status: 'PLAYING' }).catch(() => ({ rooms: [] })),
        typingGameApi.getChallenges().catch(() => ({ challenges: [] })),
      ]);

      if (statsRes) setMyStats(statsRes.stats || statsRes);
      if (lbRes?.leaderboard) setLeaderboard(lbRes.leaderboard);
      if (roomsRes?.rooms) setRoomList(roomsRes.rooms);
      if (liveRoomsRes?.rooms) setLiveMatches(liveRoomsRes.rooms);
      if (chRes?.challenges && chRes.challenges.length > 0) {
        // Sanitize out any stray commas/periods and lowercase to strictly enforce standards
        const cleanChallenges = chRes.challenges.map((c) => ({
          ...c,
          content: sanitizeChallengeText(c.content),
        }));
        setPracticeChallenges(cleanChallenges);
        setPracticeStreamText(generatePracticeStream(cleanChallenges));
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRoomDetail = useCallback(async (roomIdToFetch) => {
    try {
      setLoading(true);
      setRoomError(null);
      let data = await typingGameApi.getRoomDetail(roomIdToFetch);
      if (data && data.room) {
        // Auto-join if user is NOT in spectate mode, logged in, room is in WAITING state, user is not already in players, and room not full
        if (
          !isSpectateRoute &&
          user?.id &&
          data.room.status === 'WAITING' &&
          (!data.players || !data.players.some((p) => p.userId && Number(p.userId) === Number(user.id))) &&
          (data.players ? data.players.length : 0) < (data.room.maxPlayers || 2)
        ) {
          try {
            const joinedData = await typingGameApi.joinRoom(roomIdToFetch);
            if (joinedData && joinedData.room) {
              data = joinedData;
            }
          } catch (joinErr) {
            const status = joinErr.response?.status;
            const message = joinErr.response?.data?.message || joinErr.message || 'Không thể tham gia phòng thi đấu';
            console.warn('[TypingBattle] Auto-join notice:', message);
            if ([403, 404, 409].includes(status)) setRoomError(message);
          }
        }

        setRoom(data.room);
        setPlayers(data.players || []);
        if (typeof data.spectatorCount === 'number') {
          setSpectatorCount(data.spectatorCount);
        }
        if (Array.isArray(data.spectators)) {
          setSpectators(data.spectators);
        }
        if (data.result) {
          setMatchResult(data.result);
          if (data.room.status === 'FINISHED') {
            setShowResultModal(true);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch typing room detail:', err);
      navigate('/games/typing');
    } finally {
      setLoading(false);
    }
  }, [navigate, user?.id, isSpectateRoute]);

  const handleJoinExistingRoom = async (targetRoomId) => {
    try {
      setLoading(true);
      const res = await typingGameApi.joinRoom(targetRoomId);
      if (res?.room) {
        setRoom(res.room);
        setPlayers(res.players || []);
        navigate(`/games/typing/room/${res.room.id}`);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Không thể tham gia phòng thi đấu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (urlRoomId) {
      fetchRoomDetail(urlRoomId);
    } else {
      setRoom(null);
      setPlayers([]);
      setRoomError(null);
      fetchHubData();
    }
  }, [urlRoomId, fetchRoomDetail, fetchHubData]);

  // ── 3. REALTIME SOCKET EVENT LISTENERS ──
  useEffect(() => {
    if (!socket) return;

    // Subscribe to the socket room only once the authoritative room is known.
    // Emitting on `urlRoomId` alone races the HTTP auto-join: a slow join leaves
    // the socket rejected (non-player in WAITING) and it never re-subscribes, so
    // the client silently misses every later event (ready/starting/started).
    const joinRoomChannel = () => {
      if (room?.id) {
        socket.emit(
          'typing:joinRoom',
          { roomId: Number(room.id), clientSpectatorHint: Boolean(isSpectator) },
          (res) => {
            if (res && res.ok === false) {
              setRoomError(res.error || 'Bạn không phải là người chơi trong phòng này.');
            } else if (res && res.ok) {
              setRoomError(null);
              if (typeof res.spectatorCount === 'number') {
                setSpectatorCount(res.spectatorCount);
              }
            }
          }
        );
      }
    };
    joinRoomChannel();
    socket.on('connect', joinRoomChannel);

    // Authoritative snapshot pushed by the server right after the socket joins.
    // Covers late join / reconnect where the original broadcasts were missed.
    const handleRoomState = (data) => {
      if (data?.room) {
        setRoom(data.room);
        if (data.room.status === 'PLAYING' && data.room.startedAt) {
          setStartTime((prev) => prev ?? new Date(data.room.startedAt).getTime());
        }
      }
      if (Array.isArray(data?.players)) setPlayers(data.players);
      if (typeof data?.spectatorCount === 'number') setSpectatorCount(data.spectatorCount);
      if (Array.isArray(data?.spectators)) setSpectators(data.spectators);
      if (data?.result) {
        setMatchResult(data.result);
        if (data?.room?.status === 'FINISHED') setShowResultModal(true);
      }
    };

    const handleRoomUpdated = (data) => {
      if (data?.room) {
        setRoom((prev) => ({ ...prev, ...data.room }));
      }
    };

    const handlePlayerJoined = (data) => {
      if (data?.players) setPlayers(data.players);
    };

    const handlePlayerLeft = (data) => {
      if (data?.players) setPlayers(data.players);
    };

    const handlePlayerReady = (data) => {
      if (data?.players) setPlayers(data.players);
    };

    const handleStarting = (data) => {
      if (data?.room) setRoom((prev) => ({ ...prev, ...data.room }));
      if (data?.players) setPlayers(data.players);
      setCountdownNumber(5);
      if (soundEnabled) typingSound.playCountdown();
    };

    const handleStartingCancelled = (data) => {
      setCountdownNumber(null);
      if (data?.room) setRoom((prev) => ({ ...prev, ...data.room }));
      if (data?.players) setPlayers(data.players);
    };

    const handleStarted = (data) => {
      setCountdownNumber(null);
      if (data?.room) setRoom(data.room);
      if (data?.players) setPlayers(data.players);
      setTypedText('');
      setScrollOffsetY(0);
      setErrorCount(0);
      setLiveWpm(0);
      setLiveAccuracy(100);
      setStartTime(Date.now());
      setTimeElapsed(0);
      const duration = data.durationLimitSeconds || data.room?.durationLimitSeconds || 120;
      setTimeRemaining(duration);
      setIsFinished(false);
      setMatchResult(null);
      setShowResultModal(false);
      if (soundEnabled) typingSound.playStart();
      setTimeout(() => inputRef.current?.focus(), 60);
    };

    const handleProgressBatch = (data) => {
      if (Array.isArray(data?.updates)) {
        setPlayers((prev) =>
          prev.map((p) => {
            const update = data.updates.find((u) => Number(u.userId) === Number(p.userId));
            if (update) {
              return {
                ...p,
                progressPct: update.progressPct,
                typedChars: update.typedChars,
                wpm: update.wpm,
                accuracy: update.accuracy,
                errorCount: update.errorCount,
              };
            }
            return p;
          })
        );
      }
    };

    const handlePlayerFinished = (data) => {
      setPlayers((prev) =>
        prev.map((p) => {
          if (Number(p.userId) === Number(data.userId)) {
            return {
              ...p,
              status: 'FINISHED',
              individualRank: data.individualRank,
              wpm: data.wpm,
              accuracy: data.accuracy,
              completionTimeMs: data.completionTimeMs,
              progressPct: 100,
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
      if (data?.room) setRoom((prev) => ({ ...prev, ...data.room, status: 'FINISHED' }));
      if (soundEnabled) typingSound.playWin();
      fetchHubData();
    };

    const handleSpectatorCount = (data) => {
      if (data && (Number(data.roomId) === Number(room?.id) || !data.roomId)) {
        if (typeof data.spectatorCount === 'number') {
          setSpectatorCount(data.spectatorCount);
        }
        if (Array.isArray(data.spectators)) {
          setSpectators(data.spectators);
        }
      }
    };

    const handleRoomReset = (data) => {
      setTypedText('');
      setScrollOffsetY(0);
      setErrorCount(0);
      setLiveWpm(0);
      setLiveAccuracy(100);
      setStartTime(null);
      setTimeElapsed(0);
      setIsFinished(false);
      setMatchResult(null);
      setShowResultModal(false);
      if (data?.room) setRoom(data.room);
      if (data?.players) setPlayers(data.players);
      const duration = data.room?.durationLimitSeconds || 120;
      setTimeRemaining(duration);
      setTimeout(() => inputRef.current?.focus(), 60);
    };

    const handleRoomListChanged = () => {
      if (!urlRoomId) {
        typingGameApi.listRooms({ status: 'WAITING' }).then((res) => {
          if (res?.rooms) setRoomList(res.rooms);
        }).catch(() => {});
        typingGameApi.listRooms({ status: 'PLAYING' }).then((res) => {
          if (res?.rooms) setLiveMatches(res.rooms);
        }).catch(() => {});
      }
    };

    socket.on('typing:roomState', handleRoomState);
    socket.on('typing:roomUpdated', handleRoomUpdated);
    socket.on('typing:playerJoined', handlePlayerJoined);
    socket.on('typing:playerLeft', handlePlayerLeft);
    socket.on('typing:playerReady', handlePlayerReady);
    socket.on('typing:starting', handleStarting);
    socket.on('typing:startingCancelled', handleStartingCancelled);
    socket.on('typing:started', handleStarted);
    socket.on('typing:progressBatch', handleProgressBatch);
    socket.on('typing:playerFinished', handlePlayerFinished);
    socket.on('typing:matchFinished', handleMatchFinished);
    socket.on('typing:spectatorCount', handleSpectatorCount);
    socket.on('typing:roomReset', handleRoomReset);
    socket.on('typing:roomListChanged', handleRoomListChanged);

    return () => {
      socket.off('connect', joinRoomChannel);
      if (room?.id) {
        socket.emit('typing:leaveRoom', { roomId: Number(room.id) });
      }
      socket.off('typing:roomState', handleRoomState);
      socket.off('typing:roomUpdated', handleRoomUpdated);
      socket.off('typing:playerJoined', handlePlayerJoined);
      socket.off('typing:playerLeft', handlePlayerLeft);
      socket.off('typing:playerReady', handlePlayerReady);
      socket.off('typing:starting', handleStarting);
      socket.off('typing:startingCancelled', handleStartingCancelled);
      socket.off('typing:started', handleStarted);
      socket.off('typing:progressBatch', handleProgressBatch);
      socket.off('typing:playerFinished', handlePlayerFinished);
      socket.off('typing:matchFinished', handleMatchFinished);
      socket.off('typing:spectatorCount', handleSpectatorCount);
      socket.off('typing:roomReset', handleRoomReset);
      socket.off('typing:roomListChanged', handleRoomListChanged);
    };
  }, [socket, room?.id, urlRoomId, soundEnabled, fetchHubData, isSpectator]);

  // Countdown timer effect
  useEffect(() => {
    if (countdownNumber === null) return;
    if (countdownNumber <= 0) {
      setCountdownNumber(null);
      return;
    }
    const timer = setTimeout(() => {
      const next = countdownNumber - 1;
      setCountdownNumber(next);
      if (soundEnabled) {
        if (next > 0) typingSound.playCountdown();
        else typingSound.playStart();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdownNumber, soundEnabled]);

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
          } else if (!room && user) {
            // Check if duration qualifies for individual leaderboard (>= 2 minutes / 120 seconds)
            const finalAccuracy = totalChars > 0 ? Math.max(0, Math.round(((totalChars - totalErrors) / totalChars) * 100)) : 100;
            if (selectedDuration >= 120) {
              typingGameApi
                .submitPracticeResult({
                  durationLimitSeconds: selectedDuration,
                  wpm: currentWpm,
                  accuracy: finalAccuracy,
                  typedChars: totalChars,
                  errorCount: totalErrors,
                  elapsedSeconds: elapsedSec,
                })
                .then((res) => {
                  setPracticeSubmissionResult(res);
                  if (res?.stats) {
                    setMyStats(res.stats);
                  }
                  fetchHubData();
                })
                .catch((err) => {
                  console.warn('Practice submission error:', err);
                });
            } else {
              setPracticeSubmissionResult({
                recorded: false,
                reason: 'DURATION_LESS_THAN_2_MINUTES',
                message: 'Khởi động nhanh (< 2 phút) không tính vào BXH cá nhân',
              });
            }
          }
        }
      }, 250);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [
    startTime,
    isFinished,
    typedText.length,
    errorCount,
    sessionCompletedChars,
    sessionCompletedErrors,
    effectiveTotalDuration,
    soundEnabled,
    socket,
    room,
    user,
    selectedDuration,
    fetchHubData,
  ]);

  // ── 5. PRACTICE ACTIONS & DURATION SELECTOR ──
  const handleDurationChange = (newDuration) => {
    setSelectedDuration(newDuration);
    setTimeRemaining(newDuration);
    setPracticeSubmissionResult(null);
    handleRestartPractice();
  };

  const handleRestartPractice = () => {
    setPracticeStreamText(generatePracticeStream(practiceChallenges));
    setTypedText('');
    setScrollOffsetY(0);
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
    setPracticeSubmissionResult(null);
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
        if (lastTypedChar?.toLowerCase() === targetChar?.toLowerCase() && errors === 0) {
          typingSound.playKey(lastTypedChar);
        } else {
          // Play pleasant library-grade mechanical error sound
          typingSound.playError();
        }
      }
    }

    // Practice Mode: seamless continuous stream extension if near the end
    if (!room && challengeText.length - val.length < 150) {
      setPracticeStreamText((prev) => `${prev} ${generatePracticeStream(practiceChallenges)}`);
    }

    // When the user finishes typing the entire challenge text in multiplayer room:
    if (room && room.status === 'PLAYING' && val.length >= challengeText.length) {
      const finalErrors = errors;
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

  // ── 7. LOBBY & ROOM MANAGEMENT HANDLERS ──
  const handleCreateCustomRoom = async (e) => {
    if (e?.preventDefault) e.preventDefault();
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
      alert(err.response?.data?.message || err.message || 'Không thể tạo phòng lúc này.');
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

  const handleResetRoom = async () => {
    if (!room?.id) return;
    try {
      setLoading(true);
      if (socket) {
        socket.emit('typing:resetRoom', { roomId: room.id });
      } else {
        await typingGameApi.resetRoom(room.id);
      }
    } catch (err) {
      alert(err.message || 'Không thể đặt lại phòng');
    } finally {
      setLoading(false);
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


  // ── 8. ELEGANT 2-LINE TYPING ARENA (SMOOTH 2-LINE ROLLING WINDOW) ──
  const renderedText = useMemo(() => {
    if (!challengeText) return null;

    return (
      <div
        className="workrank-typing-text-arena"
        style={{
          height: 104,
          padding: '8px 24px',
          background: 'var(--surface, #ffffff)',
          border: isInputFocused ? '1.5px solid var(--accent, #b45309)' : '1px solid var(--border-strong, rgba(0, 0, 0, 0.16))',
          borderRadius: 12,
          position: 'relative',
          cursor: 'text',
          overflow: 'hidden',
          boxShadow: isInputFocused ? '0 0 0 3px var(--accent-soft, rgba(180, 83, 9, 0.08)), 0 4px 16px rgba(0, 0, 0, 0.04)' : '0 2px 8px rgba(0, 0, 0, 0.03)',
          transition: 'border-color var(--motion-normal) var(--ease-spring), box-shadow var(--motion-normal) var(--ease-spring)',
          userSelect: 'none',
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
          ref={wordsContainerRef}
          style={{
            width: '100%',
            fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: 'clamp(20px, 2.1vw, 24px)',
            lineHeight: '44px',
            letterSpacing: '0.02em',
            display: 'flex',
            flexWrap: 'wrap',
            columnGap: '10px',
            rowGap: '0px',
            alignItems: 'baseline',
            transform: `translateY(-${scrollOffsetY}px)`,
            transition: 'transform var(--motion-normal, 260ms) var(--ease-spring, cubic-bezier(0.16, 1, 0.3, 1))',
            willChange: 'transform',
          }}
        >
          {wordTokens.map((token, tokenIdx) => {
            return (
              <span
                key={token.id}
                ref={(el) => (wordRefs.current[tokenIdx] = el)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  position: 'relative',
                  whiteSpace: 'nowrap',
                }}
              >
                {token.word.split('').map((char, charIdx) => {
                  const absoluteCharIdx = token.startIndex + charIdx;
                  const isTyped = absoluteCharIdx < typedText.length;
                  const isCurrent = absoluteCharIdx === typedText.length;
                  const isCorrect = isTyped && typedText[absoluteCharIdx]?.toLowerCase() === char.toLowerCase();
                  const isMismatch = isTyped && typedText[absoluteCharIdx]?.toLowerCase() !== char.toLowerCase();

                  let color = '#94a3b8'; // Slate un-typed color
                  let bg = 'transparent';

                  if (isCorrect) {
                    color = 'var(--text-primary, #111111)';
                  } else if (isMismatch) {
                    color = '#dc2626';
                    bg = 'rgba(220, 38, 38, 0.14)';
                  }

                  return (
                    <span
                      key={charIdx}
                      style={{
                        position: 'relative',
                        display: 'inline-block',
                      }}
                    >
                      {isCurrent && (
                        <span
                          ref={activeCharRef}
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: '15%',
                            bottom: '15%',
                            width: '2.5px',
                            background: 'var(--accent, #b45309)',
                            borderRadius: '1px',
                            animation: 'caretBlink 1s infinite cubic-bezier(0.4, 0, 0.6, 1)',
                            zIndex: 2,
                          }}
                        />
                      )}
                      <span
                        style={{
                          color,
                          background: bg,
                          borderRadius: isMismatch ? 3 : 0,
                          padding: isMismatch ? '0 1px' : 0,
                          fontWeight: isTyped ? 700 : 500,
                          transition: 'color var(--motion-fast) var(--ease-standard), background var(--motion-fast) var(--ease-standard)',
                        }}
                      >
                        {char}
                      </span>
                    </span>
                  );
                })}

                {/* Blinking cursor if typing space after word */}
                {typedText.length === token.endIndex && (
                  <span
                    style={{
                      position: 'absolute',
                      right: -5,
                      top: '15%',
                      bottom: '15%',
                      width: '2.5px',
                      background: 'var(--accent, #b45309)',
                      borderRadius: '1px',
                      animation: 'caretBlink 1s infinite cubic-bezier(0.4, 0, 0.6, 1)',
                      zIndex: 2,
                    }}
                  />
                )}
              </span>
            );
          })}
        </div>
      </div>
    );
  }, [challengeText, wordTokens, typedText, isInputFocused, isFinished, scrollOffsetY]);

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
    const mePlayer = (players || []).find((p) => Number(p.userId) === Number(user?.id));
    const requiredPlayerCount = room.mode === 'SOLO' ? 1 : room.mode === '1V1' ? 2 : room.mode === '2V2' ? 4 : 6;
    const canStartMatch = isHost && (players || []).length >= requiredPlayerCount && (players || []).every((p) => p.isReady);
    const isTeamMode = room.mode === '2V2' || room.mode === '3V3';
    const teamSlotCapacity = room.mode === '3V3' ? 3 : 2;

    // Real-time metric augmentation (blends user's live keystrokes with server updates)
    const getPlayerMetrics = (p) => {
      const isMe = Number(p.userId) === Number(user?.id);
      const typedChars = isMe ? Math.max(p.typedChars || 0, typedText.length) : (p.typedChars || 0);
      const wpm = isMe ? liveWpm : (p.wpm || 0);
      const accuracy = isMe ? liveAccuracy : (p.accuracy !== undefined ? p.accuracy : 100);
      const wordsTyped = Math.round(typedChars / 5);
      const totalWords = Math.max(1, Math.round(challengeText.length / 5));
      const progressPct = isMe
        ? Math.min(100, Math.round((typedText.length / Math.max(1, challengeText.length)) * 100))
        : (p.progressPct !== undefined
          ? p.progressPct
          : Math.min(100, Math.round(((p.typedChars || 0) / Math.max(1, challengeText.length)) * 100)));
      return {
        ...p,
        isMe,
        typedChars,
        wpm,
        accuracy,
        wordsTyped,
        totalWords,
        progressPct,
      };
    };

    const augmentedPlayers = (players || []).map(getPlayerMetrics);
    const augTeamAPlayers = augmentedPlayers.filter((p) => p.team === 'A');
    const augTeamBPlayers = augmentedPlayers.filter((p) => p.team === 'B');
    const rawTeamAPlayers = (players || []).filter((p) => p.team === 'A');
    const rawTeamBPlayers = (players || []).filter((p) => p.team === 'B');

    // Individual team leaders (highest progress, tie-break by WPM)
    const teamALeaderId = augTeamAPlayers.length > 0
      ? [...augTeamAPlayers].sort((a, b) => b.progressPct - a.progressPct || b.wpm - a.wpm)[0]?.userId
      : null;
    const teamBLeaderId = augTeamBPlayers.length > 0
      ? [...augTeamBPlayers].sort((a, b) => b.progressPct - a.progressPct || b.wpm - a.wpm)[0]?.userId
      : null;

    // Aggregate team performance metrics
    const teamAMetrics = {
      avgProgress: augTeamAPlayers.length > 0
        ? Math.round(augTeamAPlayers.reduce((sum, p) => sum + p.progressPct, 0) / augTeamAPlayers.length)
        : 0,
      avgWpm: augTeamAPlayers.length > 0
        ? Math.round(augTeamAPlayers.reduce((sum, p) => sum + p.wpm, 0) / augTeamAPlayers.length)
        : 0,
      totalWords: augTeamAPlayers.reduce((sum, p) => sum + p.wordsTyped, 0),
    };

    const teamBMetrics = {
      avgProgress: augTeamBPlayers.length > 0
        ? Math.round(augTeamBPlayers.reduce((sum, p) => sum + p.progressPct, 0) / augTeamBPlayers.length)
        : 0,
      avgWpm: augTeamBPlayers.length > 0
        ? Math.round(augTeamBPlayers.reduce((sum, p) => sum + p.wpm, 0) / augTeamBPlayers.length)
        : 0,
      totalWords: augTeamBPlayers.reduce((sum, p) => sum + p.wordsTyped, 0),
    };

    // Lead & competitive momentum analysis
    const diffProgress = teamAMetrics.avgProgress - teamBMetrics.avgProgress;
    const diffWords = teamAMetrics.totalWords - teamBMetrics.totalWords;
    let leadAnalysis = {
      leadingTeam: null,
      title: 'CÂN TÀI CÂN SỨC',
      marginText: 'Bám đuổi sít sao! ⚔️',
      color: 'var(--text-secondary, #555555)',
      bg: 'var(--surface-soft, #f0eee9)',
      borderColor: 'var(--border, rgba(0, 0, 0, 0.08))',
    };
    if (diffProgress >= 2) {
      leadAnalysis = {
        leadingTeam: 'A',
        title: 'ĐỘI XANH DẪN ĐẦU',
        marginText: `+${diffProgress}% (${Math.max(1, diffWords)} từ)`,
        color: '#0284c7',
        bg: 'rgba(2, 132, 199, 0.08)',
        borderColor: 'rgba(2, 132, 199, 0.25)',
      };
    } else if (diffProgress <= -2) {
      leadAnalysis = {
        leadingTeam: 'B',
        title: 'ĐỘI CAM DẪN ĐẦU',
        marginText: `+${Math.abs(diffProgress)}% (${Math.max(1, Math.abs(diffWords))} từ)`,
        color: '#ea580c',
        bg: 'rgba(234, 88, 12, 0.08)',
        borderColor: 'rgba(234, 88, 12, 0.25)',
      };
    }

    // 1v1 duelists
    let duelPlayer1 = null;
    let duelPlayer2 = null;
    if (room.mode === '1V1') {
      if (mePlayer) {
        duelPlayer1 = augmentedPlayers.find((p) => Number(p.userId) === Number(user?.id)) || augmentedPlayers[0];
        duelPlayer2 = augmentedPlayers.find((p) => Number(p.userId) !== Number(user?.id)) || augmentedPlayers[1] || null;
      } else {
        duelPlayer1 = augmentedPlayers[0] || null;
        duelPlayer2 = augmentedPlayers[1] || null;
      }
    }
    const duelGapWords = duelPlayer1 && duelPlayer2 ? duelPlayer1.wordsTyped - duelPlayer2.wordsTyped : 0;
    const duelLead = {
      text: duelGapWords > 1
        ? `${duelPlayer1?.isMe ? 'Bạn đang dẫn' : (duelPlayer1?.user?.name || 'P1')} +${duelGapWords} từ`
        : duelGapWords < -1
        ? `${duelPlayer2?.isMe ? 'Bạn đang dẫn' : (duelPlayer2?.user?.name || 'P2')} +${Math.abs(duelGapWords)} từ`
        : 'Ngang tài ngang sức! ⚔️',
      color: duelGapWords > 1 ? '#0284c7' : duelGapWords < -1 ? '#ea580c' : 'var(--text-secondary)',
      bg: duelGapWords > 1 ? 'rgba(2, 132, 199, 0.08)' : duelGapWords < -1 ? 'rgba(234, 88, 12, 0.08)' : 'var(--surface-soft)',
      borderColor: duelGapWords > 1 ? 'rgba(2, 132, 199, 0.25)' : duelGapWords < -1 ? 'rgba(234, 88, 12, 0.25)' : 'var(--border)',
    };

    const soloPlayer = augmentedPlayers[0] || mePlayer || null;

    // Helper: render individual player lane / chip
    const renderPlayerLane = (p, teamLetter, leaderId) => {
      const isMe = Number(p.userId) === Number(user?.id);
      const isLeader = Number(p.userId) === Number(leaderId);
      const teamColor = teamLetter === 'A' ? '#0284c7' : '#ea580c';
      const teamSoft = teamLetter === 'A' ? 'rgba(2, 132, 199, 0.12)' : 'rgba(234, 88, 12, 0.12)';
      const isFinishedPlayer = p.status === 'FINISHED' || (p.progressPct || 0) >= 100;
      const isDisconnected = p.status === 'DISCONNECTED';

      return (
        <div
          key={p.userId}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 8px',
            borderRadius: 6,
            background: isMe ? 'var(--surface, #ffffff)' : 'rgba(255, 255, 255, 0.75)',
            border: isMe ? `1.5px solid ${teamColor}` : '1px solid var(--border, rgba(0, 0, 0, 0.08))',
            boxShadow: isMe ? `0 2px 6px ${teamSoft}` : 'none',
            transition: 'border-color var(--motion-fast) var(--ease-standard), background var(--motion-fast) var(--ease-standard)',
          }}
        >
          {/* Avatar token */}
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: isMe ? teamColor : 'var(--surface-soft, #f0eee9)',
              color: isMe ? '#ffffff' : 'var(--text-primary)',
              border: `1.5px solid ${teamColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10.5,
              fontWeight: 800,
              flexShrink: 0,
              position: 'relative',
            }}
          >
            {(p.user?.name || 'P')[0].toUpperCase()}
            {isLeader && (
              <span
                title="Dẫn đầu đội"
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -5,
                  fontSize: 10,
                  lineHeight: 1,
                }}
              >
                👑
              </span>
            )}
          </div>

          {/* Name & Tag */}
          <div style={{ width: 85, minWidth: 65, flexShrink: 0, overflow: 'hidden' }}>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: isMe ? 800 : 600,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={p.user?.name || `Player #${p.userId}`}
            >
              {p.user?.name || `Player #${p.userId}`}{isMe ? ' (Bạn)' : ''}
            </div>
            <div style={{ fontSize: 9.5, color: isMe ? teamColor : 'var(--text-muted)', fontWeight: isMe ? 700 : 500 }}>
              {isMe ? 'Bạn' : Number(p.userId) === Number(room?.hostUserId) ? 'Chủ phòng' : 'Đồng đội'}
            </div>
          </div>

          {/* Individual Mini Progress Bar */}
          <div
            style={{
              flex: 1,
              height: 14,
              background: 'var(--surface-muted, #eceae4)',
              borderRadius: 4,
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.05))',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, p.progressPct || 0)}%`,
                background:
                  teamLetter === 'A'
                    ? 'linear-gradient(90deg, #0284c7, #38bdf8)'
                    : 'linear-gradient(90deg, #ea580c, #fb923c)',
                borderRadius: 3,
                transition: 'width var(--motion-fast) var(--ease-standard)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                color: (p.progressPct || 0) > 55 ? '#ffffff' : 'var(--text-secondary)',
                fontVariantNumeric: 'tabular-nums',
                textShadow: (p.progressPct || 0) > 55 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
              }}
            >
              {p.progressPct || 0}%
            </div>
          </div>

          {/* WPM & Accuracy */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
            <strong style={{ color: teamColor, fontWeight: 800 }}>{p.wpm || 0}</strong>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>WPM</span>
          </div>

          {/* Status Pill */}
          <div style={{ flexShrink: 0 }}>
            {isFinishedPlayer ? (
              <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--success, #15803d)', background: 'var(--success-soft)', border: '1px solid var(--success-border)', padding: '1px 5px', borderRadius: 4 }}>
                🏁 Xong
              </span>
            ) : isDisconnected ? (
              <span style={{ fontSize: 9.5, fontWeight: 700, color: '#dc2626', background: 'rgba(220, 38, 38, 0.1)', padding: '1px 5px', borderRadius: 4 }}>
                ⚠️ Rời mạng
              </span>
            ) : (
              <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--surface-soft, #f0eee9)', padding: '1px 5px', borderRadius: 4 }}>
                {p.wordsTyped} từ
              </span>
            )}
          </div>
        </div>
      );
    };

    // Helper: render 1v1 duel card
    const renderDuelCard = (p, teamLetter) => {
      if (!p) {
        return (
          <div
            style={{
              padding: 14,
              borderRadius: 8,
              border: '1px dashed var(--border, rgba(0, 0, 0, 0.15))',
              background: 'var(--surface-soft, #f0eee9)',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 12,
            }}
          >
            Chờ đối thủ kết nối...
          </div>
        );
      }
      const isMe = Number(p.userId) === Number(user?.id);
      const teamColor = teamLetter === 'A' ? '#0284c7' : '#ea580c';
      const isFinishedPlayer = p.status === 'FINISHED' || (p.progressPct || 0) >= 100;
      return (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: isMe ? 'var(--surface, #ffffff)' : 'var(--surface-soft, #f0eee9)',
            border: isMe ? `1.5px solid ${teamColor}` : '1px solid var(--border, rgba(0, 0, 0, 0.08))',
            boxShadow: isMe ? `0 2px 8px ${teamLetter === 'A' ? 'rgba(2, 132, 199, 0.12)' : 'rgba(234, 88, 12, 0.12)'}` : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: isMe ? teamColor : 'var(--surface, #ffffff)',
                  color: isMe ? '#ffffff' : 'var(--text-primary)',
                  border: `1.5px solid ${teamColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                {(p.user?.name || 'P')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: isMe ? 800 : 600, color: 'var(--text-primary)' }}>
                  {p.user?.name || `Player #${p.userId}`} {isMe && '(Bạn)'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {p.accuracy || 100}% chính xác
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: teamColor, fontVariantNumeric: 'tabular-nums' }}>
                {p.wpm || 0} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>WPM</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {isFinishedPlayer ? '🏁 Đã hoàn thành' : `${p.wordsTyped} từ đã gõ`}
              </div>
            </div>
          </div>
          {/* Race track */}
          <div style={{ height: 16, background: 'var(--surface-muted, #eceae4)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, p.progressPct || 0)}%`,
                background: teamLetter === 'A' ? 'linear-gradient(90deg, #0284c7, #38bdf8)' : 'linear-gradient(90deg, #ea580c, #fb923c)',
                transition: 'width var(--motion-fast) var(--ease-standard)',
              }}
            />
            <span style={{ position: 'absolute', right: 8, top: 1, fontSize: 10, fontWeight: 700, color: (p.progressPct || 0) > 60 ? '#ffffff' : 'var(--text-primary)' }}>
              {p.progressPct || 0}%
            </span>
          </div>
        </div>
      );
    };

    // Helper: render Solo racer track
    const renderSoloCard = () => {
      return (
        <div style={{ padding: '8px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--accent, #b45309)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                {(user?.name || 'S')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {user?.name || 'Bạn'} <span style={{ color: 'var(--accent, #b45309)' }}>(Thử Thách Solo)</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Mục tiêu tốc độ cá nhân: 60 - 80 WPM
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tốc độ hiện tại: </span>
                <strong style={{ fontSize: 16, color: 'var(--accent, #b45309)', fontVariantNumeric: 'tabular-nums' }}>{liveWpm} WPM</strong>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Chính xác: </span>
                <strong style={{ fontSize: 16, color: 'var(--success, #15803d)' }}>{liveAccuracy}%</strong>
              </div>
            </div>
          </div>
          <div style={{ height: 18, background: 'var(--surface-muted, #eceae4)', borderRadius: 6, overflow: 'hidden', position: 'relative', border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.round((typedText.length / Math.max(1, challengeText.length)) * 100))}%`,
                background: 'linear-gradient(90deg, var(--accent, #b45309), #d97706)',
                transition: 'width var(--motion-fast) var(--ease-standard)',
              }}
            />
            <span style={{ position: 'absolute', right: 10, top: 2, fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>
              {Math.round(typedText.length / 5)} / {Math.round(challengeText.length / 5)} từ ({Math.min(100, Math.round((typedText.length / Math.max(1, challengeText.length)) * 100))}%)
            </span>
          </div>
        </div>
      );
    };

    // Finished Match standings & MVP calculations
    const myResult = matchResult?.results?.find((r) => Number(r.userId) === Number(user?.id));
    const isTeamMatch = room.mode === '2V2' || room.mode === '3V3';
    const myTeam = mePlayer?.team;
    const winningTeam = matchResult?.winnerTeam || (teamAMetrics.avgProgress > teamBMetrics.avgProgress ? 'A' : teamBMetrics.avgProgress > teamAMetrics.avgProgress ? 'B' : 'DRAW');
    const didMyTeamWin = isTeamMatch ? (myTeam && myTeam === winningTeam) : myResult?.isWinner;
    const isMatchDraw = winningTeam === 'DRAW';

    const allStandings = [...(matchResult?.results || augmentedPlayers)].map((r) => {
      const pAug = augmentedPlayers.find((p) => Number(p.userId) === Number(r.userId));
      return {
        ...r,
        user: r.user || pAug?.user,
        team: r.team || pAug?.team,
        wpm: r.wpm !== undefined ? r.wpm : (pAug?.wpm || 0),
        accuracy: r.accuracy !== undefined ? r.accuracy : (pAug?.accuracy || 100),
        typedChars: r.typedChars !== undefined ? r.typedChars : (pAug?.typedChars || 0),
        wordsTyped: Math.round((r.typedChars !== undefined ? r.typedChars : (pAug?.typedChars || 0)) / 5),
        scoreDelta: r.scoreDelta !== undefined ? r.scoreDelta : (r.pointsAwarded || 0),
        isWinner: r.isWinner !== undefined ? r.isWinner : (isTeamMatch ? r.team === winningTeam : false),
      };
    }).sort((a, b) => (b.wpm || 0) - (a.wpm || 0));

    const matchMvp = allStandings[0] || null;

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
              <ArrowLeft size={14} /> {isSpectator ? 'Rời phòng xem' : 'Rời phòng'}
            </Button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {room.title || `Phòng thi đấu #${room.id}`}
                </h1>
                {isSpectator && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: 'rgba(220, 38, 38, 0.1)',
                      color: '#dc2626',
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    <Radio size={12} style={{ animation: 'livePulse 1.5s infinite' }} />
                    🔴 ĐANG XEM TRỰC TIẾP
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                <Badge variant="warning">{room.mode}</Badge>
                <Badge variant="info">{room.matchType === 'RANKED' ? 'Đấu Hạng WorkRank' : 'Luyện Tập'}</Badge>
                <Badge variant="neutral">
                  <Clock size={11} style={{ marginRight: 3 }} /> {room.durationLimitSeconds >= 60 ? `${room.durationLimitSeconds / 60} phút` : `${room.durationLimitSeconds}s`}
                </Badge>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {players.length}/{requiredPlayerCount} Tuyển thủ
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Realtime Spectator Count Button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSpectatorsModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                padding: '5px 10px',
                background: 'var(--surface-soft, #f0eee9)',
              }}
            >
              <Eye size={13} style={{ color: '#0284c7' }} />
              <span>{spectatorCount} người xem</span>
            </Button>

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

        {/* ── JOIN / ACCESS ERROR NOTICE ── */}
        {roomError && !isPlaying && !isDone && (
          <div
            className="motion-slide-down"
            role="alert"
            style={{
              marginBottom: 16,
              padding: '12px 16px',
              borderRadius: 10,
              background: 'rgba(185, 28, 28, 0.08)',
              border: '1px solid rgba(185, 28, 28, 0.25)',
              color: 'var(--danger, #b91c1c)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {roomError}
          </div>
        )}

        {/* ── LOBBY WAITING STAGE ── */}
        {!isPlaying && !isDone && (
          <Card style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  Sảnh Chờ Trận Đấu ({room.durationLimitSeconds >= 60 ? `${room.durationLimitSeconds / 60} Phút` : `${room.durationLimitSeconds}s`})
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                  {isSpectator
                    ? 'Bạn đang trong phòng với tư cách Khán giả. Trận đấu sẽ tự động bắt đầu khi tất cả tuyển thủ sẵn sàng.'
                    : 'Bài thi diễn ra liên tục theo mốc thời gian. Tất cả thành viên cần bấm Sẵn Sàng để bắt đầu.'}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isSpectator ? (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 6,
                      background: 'rgba(2, 132, 199, 0.08)',
                      color: '#0284c7',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <Eye size={14} /> Khán Giả Xem Trực Tiếp
                  </div>
                ) : mePlayer ? (
                  <Button
                    variant={mePlayer.isReady ? 'secondary' : 'primary'}
                    onClick={handleToggleReady}
                  >
                    {mePlayer.isReady ? 'Hủy Sẵn Sàng' : 'Sẵn Sàng'}
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={handleLeaveRoom}>Về sảnh thi đấu</Button>
                )}

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
            {isTeamMode ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                {/* Team A */}
                <div style={{ padding: 16, background: 'rgba(2, 132, 199, 0.05)', border: '1px solid rgba(2, 132, 199, 0.25)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#0284c7' }}>
                      <Shield size={16} /> ĐỘI XANH (TEAM A)
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                        ({rawTeamAPlayers.length}/{teamSlotCapacity})
                      </span>
                    </div>
                    {mePlayer?.team !== 'A' && (
                      <Button variant="secondary" size="sm" onClick={() => handleSwitchTeam('A')} style={{ fontSize: 11, padding: '3px 8px' }}>
                        Chuyển sang đội này
                      </Button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Array.from({ length: teamSlotCapacity }).map((_, slotIdx) => {
                      const p = rawTeamAPlayers[slotIdx];
                      if (p) {
                        return (
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
                              {Number(p.userId) === Number(room.hostUserId) && (
                                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 700 }}>
                                  Chủ phòng
                                </span>
                              )}
                            </div>
                            <Badge variant={p.isReady ? 'success' : 'neutral'}>{p.isReady ? 'Sẵn sàng' : 'Chờ'}</Badge>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={`empty-a-${slotIdx}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px dashed rgba(2, 132, 199, 0.3)',
                            color: 'var(--text-muted)',
                            fontSize: 12,
                            fontStyle: 'italic',
                          }}
                        >
                          Vị trí #{slotIdx + 1}: Chờ người chơi tham gia...
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Team B */}
                <div style={{ padding: 16, background: 'rgba(234, 88, 12, 0.05)', border: '1px solid rgba(234, 88, 12, 0.25)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#ea580c' }}>
                      <Shield size={16} /> ĐỘI CAM (TEAM B)
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                        ({rawTeamBPlayers.length}/{teamSlotCapacity})
                      </span>
                    </div>
                    {mePlayer?.team !== 'B' && (
                      <Button variant="secondary" size="sm" onClick={() => handleSwitchTeam('B')} style={{ fontSize: 11, padding: '3px 8px' }}>
                        Chuyển sang đội này
                      </Button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Array.from({ length: teamSlotCapacity }).map((_, slotIdx) => {
                      const p = rawTeamBPlayers[slotIdx];
                      if (p) {
                        return (
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
                              <User size={15} style={{ color: '#ea580c' }} />
                              <span style={{ fontSize: 13, fontWeight: 600 }}>
                                {p.user?.name || `Player #${p.userId}`} {Number(p.userId) === Number(user?.id) && '(Bạn)'}
                              </span>
                              {Number(p.userId) === Number(room.hostUserId) && (
                                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 700 }}>
                                  Chủ phòng
                                </span>
                              )}
                            </div>
                            <Badge variant={p.isReady ? 'success' : 'neutral'}>{p.isReady ? 'Sẵn sàng' : 'Chờ'}</Badge>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={`empty-b-${slotIdx}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px dashed rgba(234, 88, 12, 0.3)',
                            color: 'var(--text-muted)',
                            fontSize: 12,
                            fontStyle: 'italic',
                          }}
                        >
                          Vị trí #{slotIdx + 1}: Chờ người chơi tham gia...
                        </div>
                      );
                    })}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Top Battle Arena Card */}
            <Card style={{ padding: '16px 20px', overflow: 'hidden' }}>
              {/* Header: Mode, Duration, Dynamic Lead Ticker, Countdown Timer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                  paddingBottom: 10,
                  borderBottom: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Swords size={16} style={{ color: 'var(--accent, #b45309)' }} />
                  <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                    {room.mode === '2V2'
                      ? 'ĐẤU TRƯỜNG 2 VS 2 ĐỒNG ĐỘI'
                      : room.mode === '3V3'
                      ? 'ĐẠI CHIẾN 3 VS 3 ĐỒNG ĐỘI'
                      : room.mode === '1V1'
                      ? 'QUYẾT ĐẤU 1 VS 1'
                      : 'THỬ THÁCH TỐC ĐỘ SOLO'}
                  </span>
                  <Badge variant="warning">
                    {room.durationLimitSeconds >= 60 ? `${room.durationLimitSeconds / 60} Phút` : `${room.durationLimitSeconds}s`}
                  </Badge>
                </div>

                {/* Realtime Lead Ticker & Momentum Badge */}
                {isTeamMode ? (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 12px',
                      borderRadius: 9999,
                      background: leadAnalysis.bg,
                      border: `1px solid ${leadAnalysis.borderColor}`,
                      color: leadAnalysis.color,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <Zap size={13} />
                    <span>{leadAnalysis.title}:</span>
                    <strong>{leadAnalysis.marginText}</strong>
                  </div>
                ) : room.mode === '1V1' ? (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 12px',
                      borderRadius: 9999,
                      background: duelLead.bg,
                      border: `1px solid ${duelLead.borderColor}`,
                      color: duelLead.color,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <Zap size={13} />
                    <span>{duelLead.text}</span>
                  </div>
                ) : null}

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
                    fontSize: 15,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <Timer size={15} />
                  <span>{formatTime(timeRemaining)}</span>
                </div>
              </div>

              {/* ARENA CONTENT BASED ON MODE */}
              {isTeamMode ? (
                <>
                  {/* Central Tug-of-War Progress Track */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 11.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0284c7', fontWeight: 700 }}>
                        <span>🔵 ĐỘI XANH ({teamAMetrics.avgProgress}%)</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>• {teamAMetrics.totalWords} từ</span>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                        TIẾN ĐỘ TỔNG HỢP HAI ĐỘI
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ea580c', fontWeight: 700 }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{teamBMetrics.totalWords} từ •</span>
                        <span>ĐỘI CAM ({teamBMetrics.avgProgress}%) 🟠</span>
                      </div>
                    </div>

                    {/* Split dual progress track */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 3,
                        height: 10,
                        background: 'var(--surface-muted, #eceae4)',
                        borderRadius: 5,
                        padding: 1.5,
                        border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                      }}
                    >
                      {/* Team A Bar (fills left to right) */}
                      <div style={{ height: '100%', background: 'transparent', borderRadius: '3px 0 0 3px', overflow: 'hidden', position: 'relative' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${teamAMetrics.avgProgress}%`,
                            background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                            borderRadius: 3,
                            transition: 'width var(--motion-fast) var(--ease-standard)',
                          }}
                        />
                      </div>

                      {/* Team B Bar (fills right to left) */}
                      <div style={{ height: '100%', background: 'transparent', borderRadius: '0 3px 3px 0', overflow: 'hidden', position: 'relative', display: 'flex', justifyContent: 'flex-end' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${teamBMetrics.avgProgress}%`,
                            background: 'linear-gradient(90deg, #fb923c, #ea580c)',
                            borderRadius: 3,
                            transition: 'width var(--motion-fast) var(--ease-standard)',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Desktop Symmetrical Two-Wing Player Lanes Grid */}
                  <div className="workrank-team-lanes-grid">
                    {/* Left Wing: Team A */}
                    <div
                      style={{
                        background: 'rgba(2, 132, 199, 0.03)',
                        border: '1px solid rgba(2, 132, 199, 0.16)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#0284c7', fontSize: 12, fontWeight: 800 }}>
                          <Shield size={13} />
                          <span>ĐỘI XANH (TEAM A)</span>
                          {mePlayer?.team === 'A' && (
                            <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', fontWeight: 700 }}>
                              Bạn
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          TB: <strong style={{ color: '#0284c7' }}>{teamAMetrics.avgWpm}</strong> WPM
                        </div>
                      </div>

                      {/* Player lanes for Team A */}
                      {augTeamAPlayers.map((p) => renderPlayerLane(p, 'A', teamALeaderId))}
                    </div>

                    {/* Center VS Divider Badge */}
                    <div
                      className="workrank-team-vs-divider"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 4px',
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'var(--surface-dark, #141414)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          fontSize: 11,
                          letterSpacing: '0.05em',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                        }}
                      >
                        VS
                      </div>
                    </div>

                    {/* Right Wing: Team B */}
                    <div
                      style={{
                        background: 'rgba(234, 88, 12, 0.03)',
                        border: '1px solid rgba(234, 88, 12, 0.16)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#ea580c', fontSize: 12, fontWeight: 800 }}>
                          <Shield size={13} />
                          <span>ĐỘI CAM (TEAM B)</span>
                          {mePlayer?.team === 'B' && (
                            <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'rgba(234, 88, 12, 0.15)', color: '#ea580c', fontWeight: 700 }}>
                              Bạn
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          TB: <strong style={{ color: '#ea580c' }}>{teamBMetrics.avgWpm}</strong> WPM
                        </div>
                      </div>

                      {/* Player lanes for Team B */}
                      {augTeamBPlayers.map((p) => renderPlayerLane(p, 'B', teamBLeaderId))}
                    </div>
                  </div>
                </>
              ) : room.mode === '1V1' ? (
                /* 1v1 Duel Arena */
                <div className="workrank-duel-grid">
                  {renderDuelCard(duelPlayer1, 'A')}
                  <div
                    className="workrank-duel-vs-divider"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'var(--surface-dark, #141414)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: 12,
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                      }}
                    >
                      VS
                    </div>
                  </div>
                  {renderDuelCard(duelPlayer2, 'B')}
                </div>
              ) : (
                /* Solo Time Trial Arena */
                renderSoloCard()
              )}
            </Card>

            {/* Target Text & Dedicated Battle View */}
            {isSpectator ? (
              /* ── LIVE SPECTATOR DUAL OBSERVATION TYPING ARENA ── */
              <Card style={{ padding: '18px 22px' }}>
                {/* Spectator Sub-Header & Mobile Tab Switcher */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                    paddingBottom: 12,
                    borderBottom: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'rgba(220, 38, 38, 0.1)',
                        color: '#dc2626',
                        padding: '3px 10px',
                        borderRadius: 16,
                        fontSize: 11.5,
                        fontWeight: 800,
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: '#dc2626',
                          boxShadow: '0 0 6px #dc2626',
                          animation: 'livePulse 1.5s infinite',
                        }}
                      />
                      QUAN SÁT TRỰC TIẾP
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Vị trí con trỏ và tốc độ gõ của tuyển thủ được cập nhật theo thời gian thực
                    </span>
                  </div>

                  {/* Responsive Dual Stream Switcher */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {[
                      { id: 'both', label: 'Xem Cả Hai (Song Song)' },
                      { id: 'p1', label: `${duelPlayer1?.user?.name || 'Tuyển Thủ 1'} (Xanh)` },
                      { id: 'p2', label: `${duelPlayer2?.user?.name || 'Tuyển Thủ 2'} (Cam)` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSpectatorViewTab(tab.id)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: spectatorViewTab === tab.id ? '1.5px solid var(--accent, #b45309)' : '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                          background: spectatorViewTab === tab.id ? 'var(--accent-soft, rgba(180, 83, 9, 0.08))' : 'var(--surface-soft, #f0eee9)',
                          color: spectatorViewTab === tab.id ? 'var(--accent, #b45309)' : 'var(--text-secondary)',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all var(--motion-fast) var(--ease-standard)',
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dual Typing Stream Streams */}
                <div
                  className="workrank-spectator-dual-stream"
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      spectatorViewTab === 'p1' || spectatorViewTab === 'p2'
                        ? '1fr'
                        : 'repeat(auto-fit, minmax(340px, 1fr))',
                    gap: 16,
                  }}
                >
                  {(spectatorViewTab === 'both' || spectatorViewTab === 'p1') && (
                    <SpectatorTypingStream
                      player={duelPlayer1 || augmentedPlayers[0]}
                      challengeText={challengeText}
                      teamColor="#0284c7"
                      teamLetter="A"
                    />
                  )}
                  {(spectatorViewTab === 'both' || spectatorViewTab === 'p2') && (
                    <SpectatorTypingStream
                      player={duelPlayer2 || augmentedPlayers[1]}
                      challengeText={challengeText}
                      teamColor="#ea580c"
                      teamLetter="B"
                    />
                  )}
                </div>

                <div style={{ marginTop: 14, textAlign: 'center', fontSize: 11.5, color: 'var(--text-muted)' }}>
                  🔒 Chế độ Khán giả (Read-only): Bạn đang theo dõi trực tiếp trận đấu, thao tác gõ phím được bảo lưu cho tuyển thủ.
                </div>
              </Card>
            ) : (
              <Card style={{ padding: '18px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
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
                      Tiến độ bài thi: <strong style={{ color: 'var(--text-primary)', fontSize: 18 }}>{Math.round(typedText.length / 5)} / {Math.round(challengeText.length / 5)}</strong> từ ({Math.min(100, Math.round((typedText.length / Math.max(1, challengeText.length)) * 100))}%)
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
            )}
          </div>
        )}

        {/* ── MATCH RESULT SCREEN (WORKRANK EDITORIAL STYLE FOR TEAM & INDIVIDUAL BATTLE) ── */}
        {isDone && (
          <Card style={{ padding: '32px 28px', textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
            <div>
              {/* Victory / Defeat Header Icon & Title */}
              <div
                style={{
                  width: 68,
                  height: 68,
                  margin: '0 auto 16px',
                  borderRadius: '50%',
                  background: didMyTeamWin
                    ? 'var(--success-soft, rgba(21, 128, 61, 0.12))'
                    : isMatchDraw
                    ? 'rgba(2, 132, 199, 0.12)'
                    : 'rgba(220, 38, 38, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: didMyTeamWin
                    ? 'var(--success, #15803d)'
                    : isMatchDraw
                    ? '#0284c7'
                    : '#dc2626',
                }}
              >
                <Trophy size={34} />
              </div>

              <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {isSpectator ? (
                  <>
                    <Trophy size={22} style={{ color: 'var(--accent, #b45309)' }} />
                    {isTeamMatch
                      ? isMatchDraw
                        ? 'TRẬN ĐẤU HÒA NHAU!'
                        : `ĐỘI ${winningTeam === 'A' ? 'XANH' : 'CAM'} CHIẾN THẮNG!`
                      : allStandings[0]
                      ? `${allStandings[0].user?.name || 'Tuyển thủ'} CHIẾN THẮNG!`
                      : 'KẾT THÚC TRẬN ĐẤU'}
                  </>
                ) : isTeamMatch ? (
                  didMyTeamWin ? (
                    <>
                      <Sparkles size={22} style={{ color: 'var(--accent, #b45309)' }} /> ĐỘI BẠN CHIẾN THẮNG TUYỆT ĐỐI!
                    </>
                  ) : isMatchDraw ? (
                    <>
                      <Swords size={22} style={{ color: '#0284c7' }} /> TRẬN ĐẤU HÒA NHAU!
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={22} style={{ color: 'var(--accent, #b45309)' }} /> KẾT THÚC BÀI THI — ĐỘI BẠN VỀ NHÌ
                    </>
                  )
                ) : myResult?.isWinner ? (
                  <>
                    <Sparkles size={22} style={{ color: 'var(--accent, #b45309)' }} /> CHIẾN THẮNG TUYỆT ĐỐI!
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={22} style={{ color: 'var(--accent, #b45309)' }} /> KẾT THÚC BÀI THI
                  </>
                )}
              </h2>

              <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: 13 }}>
                {isSpectator
                  ? `Khán giả trực tiếp • Trận ${matchResult?.mode || room.mode} (${room.durationLimitSeconds >= 60 ? `${room.durationLimitSeconds / 60} Phút` : `${room.durationLimitSeconds}s`}) đã hoàn tất`
                  : isTeamMatch
                  ? isMatchDraw
                    ? 'Hai đội cống hiến màn rượt đuổi tốc độ cân tài cân sức!'
                    : `Chiến thắng thuộc về Đội ${winningTeam === 'A' ? 'Xanh (Team A)' : 'Cam (Team B)'}.`
                  : `${matchResult?.mode || room.mode} Match • ${room.durationLimitSeconds >= 60 ? `${room.durationLimitSeconds / 60} Phút` : `${room.durationLimitSeconds}s`}`}
              </p>

              {/* Head-to-Head Team Summary Box (for 2v2 and 3v3) */}
              {isTeamMatch && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 14,
                    marginBottom: 20,
                    textAlign: 'left',
                  }}
                >
                  {/* Team A Box */}
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: 8,
                      background: 'rgba(2, 132, 199, 0.05)',
                      border: winningTeam === 'A' ? '2px solid #0284c7' : '1px solid rgba(2, 132, 199, 0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 800, color: '#0284c7', fontSize: 13 }}>🔵 ĐỘI XANH (TEAM A)</span>
                      {winningTeam === 'A' && (
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#0284c7', color: '#ffffff' }}>
                          🏆 THẮNG
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Tốc độ TB: <strong style={{ color: 'var(--text-primary)' }}>{teamAMetrics.avgWpm} WPM</strong> • Tiến độ: <strong style={{ color: '#0284c7' }}>{teamAMetrics.avgProgress}%</strong>
                    </div>
                  </div>

                  {/* Team B Box */}
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: 8,
                      background: 'rgba(234, 88, 12, 0.05)',
                      border: winningTeam === 'B' ? '2px solid #ea580c' : '1px solid rgba(234, 88, 12, 0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 800, color: '#ea580c', fontSize: 13 }}>🟠 ĐỘI CAM (TEAM B)</span>
                      {winningTeam === 'B' && (
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#ea580c', color: '#ffffff' }}>
                          🏆 THẮNG
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Tốc độ TB: <strong style={{ color: 'var(--text-primary)' }}>{teamBMetrics.avgWpm} WPM</strong> • Tiến độ: <strong style={{ color: '#ea580c' }}>{teamBMetrics.avgProgress}%</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Match MVP Spotlight */}
              {matchMvp && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    borderRadius: 6,
                    background: 'var(--accent-soft, rgba(180, 83, 9, 0.08))',
                    border: '1px solid var(--accent-border, rgba(180, 83, 9, 0.25))',
                    color: 'var(--accent, #b45309)',
                    fontSize: 12,
                    fontWeight: 700,
                    marginBottom: 20,
                  }}
                >
                  <Crown size={16} />
                  <span>MVP TRẬN ĐẤU:</span>
                  <strong>{matchMvp.user?.name || `Player #${matchMvp.userId}`}</strong>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                    ({matchMvp.wpm} WPM • {matchMvp.accuracy}% Chính xác)
                  </span>
                </div>
              )}

              {/* All Standings Table */}
              <div style={{ marginBottom: 22, overflowX: 'auto', textAlign: 'left' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid var(--border, rgba(0, 0, 0, 0.12))', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: 45 }}>HẠNG</th>
                      {isTeamMode && <th style={{ padding: '8px 10px', width: 90 }}>ĐỘI</th>}
                      <th style={{ padding: '8px 10px' }}>THÀNH VIÊN</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>TỐC ĐỘ</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>CHÍNH XÁC</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>SỐ TỪ</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>ĐIỂM WORKRANK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allStandings.map((p, idx) => {
                      const isMe = Number(p.userId) === Number(user?.id);
                      return (
                        <tr
                          key={p.userId}
                          style={{
                            borderBottom: '1px solid var(--border, rgba(0, 0, 0, 0.06))',
                            background: isMe ? 'var(--accent-soft, rgba(180, 83, 9, 0.06))' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800 }}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                          </td>
                          {isTeamMode && (
                            <td style={{ padding: '8px 10px' }}>
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  color: p.team === 'A' ? '#0284c7' : '#ea580c',
                                }}
                              >
                                {p.team === 'A' ? '🔵 Đội A' : '🟠 Đội B'}
                              </span>
                            </td>
                          )}
                          <td style={{ padding: '8px 10px', fontWeight: isMe ? 800 : 600 }}>
                            {p.user?.name || `Player #${p.userId}`} {isMe && '(Bạn)'}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--accent, #b45309)', fontVariantNumeric: 'tabular-nums' }}>
                            {p.wpm || 0} WPM
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--success, #15803d)' }}>
                            {p.accuracy || 100}%
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {p.wordsTyped || Math.round((p.typedChars || 0) / 5)} từ
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#0284c7' }}>
                            +{p.scoreDelta || p.pointsAwarded || 0} XP
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Metric Ribbon */}
              {!isSpectator ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
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
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                  <div style={{ padding: '12px 14px', background: 'var(--surface-soft, #f0eee9)', borderRadius: 8, border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>TỐC ĐỘ CAO NHẤT</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent, #b45309)', marginTop: 2 }}>{matchMvp?.wpm || 0} WPM</div>
                  </div>
                  <div style={{ padding: '12px 14px', background: 'var(--surface-soft, #f0eee9)', borderRadius: 8, border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CHÍNH XÁC CAO NHẤT</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success, #15803d)', marginTop: 2 }}>{matchMvp?.accuracy || 100}%</div>
                  </div>
                  <div style={{ padding: '12px 14px', background: 'var(--surface-soft, #f0eee9)', borderRadius: 8, border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>KHÁN GIẢ THEO DÕI</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#0284c7', marginTop: 2 }}>{spectatorCount} người</div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                {isHost && (
                  <Button variant="primary" onClick={handleResetRoom} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <RotateCcw size={14} /> Chơi Lại Ván Mới
                  </Button>
                )}
                {isSpectator && (
                  <Button variant="secondary" onClick={() => setShowSpectatorsModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Eye size={14} /> Danh Sách Khán Giả ({spectatorCount})
                  </Button>
                )}
                <Button variant="secondary" onClick={handleLeaveRoom} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <LogOut size={14} /> Quay lại Sảnh Đấu
                </Button>
                <Button variant="secondary" onClick={() => navigate('/leaderboard')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Trophy size={14} /> Bảng Xếp Hạng Công Ty
                </Button>
              </div>

            </div>
          </Card>
        )}

        {/* ── SPECTATORS LIST MODAL ── */}
        <AnimatedModal
          isOpen={showSpectatorsModal}
          onClose={() => setShowSpectatorsModal(false)}
          title={`Khán Giả Đang Theo Dõi (${spectatorCount})`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Danh sách các thành viên đang theo dõi trực tiếp trận đấu này theo thời gian thực:
            </div>

            {spectators.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {isSpectator
                  ? 'Bạn là người đầu tiên đang theo dõi trận đấu này.'
                  : 'Chưa có khán giả nào đang theo dõi trận đấu.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                {spectators.map((s, idx) => {
                  const sName = s.name || `Khán giả #${s.userId || idx + 1}`;
                  const isMe = Number(s.userId) === Number(user?.id);
                  return (
                    <div
                      key={s.userId || s.socketId || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: isMe ? 'var(--accent-soft, rgba(180, 83, 9, 0.08))' : 'var(--surface-soft, #f0eee9)',
                        border: isMe ? '1.5px solid var(--accent, #b45309)' : '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: isMe ? 'var(--accent, #b45309)' : 'var(--surface, #ffffff)',
                            color: isMe ? '#ffffff' : 'var(--accent, #b45309)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: 13,
                            border: '1px solid var(--border, rgba(0, 0, 0, 0.1))',
                          }}
                        >
                          {sName[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {sName} {isMe && '(Bạn)'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {s.jobTitle || s.department || 'Đồng nghiệp WorkRank'}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <Eye size={12} style={{ color: '#0284c7' }} />
                        <span>Đang xem</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="secondary" onClick={() => setShowSpectatorsModal(false)}>
                Đóng
              </Button>
            </div>
          </div>
        </AnimatedModal>
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

                  <Badge variant={selectedDuration >= 120 ? 'success' : 'neutral'}>
                    {selectedDuration >= 120 ? '✓ Tính BXH cá nhân (≥ 2p)' : 'Khởi động nhanh'}
                  </Badge>
                  <Badge variant="warning">Không chấm phẩy</Badge>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Button
                    variant="secondary"
                    onClick={handleRestartPractice}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '6px 12px' }}
                  >
                    <RotateCcw size={13} /> Thử bài mới <span style={{ opacity: 0.6, fontSize: 10 }}>(Esc)</span>
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
                <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: 13 }}>
                  Bài thi tiếng Việt đạt chuẩn không chấm phẩy
                </p>

                {/* BXH Qualification Status Banner */}
                {practiceSubmissionResult && (
                  <div
                    style={{
                      margin: '0 auto 18px',
                      padding: '10px 14px',
                      borderRadius: 8,
                      maxWidth: 480,
                      background: practiceSubmissionResult.recorded ? 'var(--success-soft, rgba(21, 128, 61, 0.08))' : 'var(--accent-soft, rgba(180, 83, 9, 0.08))',
                      border: practiceSubmissionResult.recorded ? '1px solid var(--success-border, rgba(21, 128, 61, 0.25))' : '1px solid var(--accent-border, rgba(180, 83, 9, 0.25))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      color: practiceSubmissionResult.recorded ? 'var(--success, #15803d)' : 'var(--accent, #b45309)',
                    }}
                  >
                    {practiceSubmissionResult.recorded ? (
                      <>
                        <CheckCircle2 size={16} />
                        <span>{practiceSubmissionResult.message} (+{practiceSubmissionResult.awardedXp} XP)</span>
                      </>
                    ) : (
                      <>
                        <HelpCircle size={16} />
                        <span>{practiceSubmissionResult.message || 'Chế độ khởi động (< 2 phút) không tính vào BXH cá nhân.'}</span>
                      </>
                    )}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 24 }}>
                  <div style={{ padding: '12px 8px', background: 'var(--surface-soft, #f0eee9)', borderRadius: 8, border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>TỐC ĐỘ</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent, #b45309)', marginTop: 2 }}>{liveWpm} WPM</div>
                  </div>
                  <div style={{ padding: '12px 8px', background: 'var(--surface-soft, #f0eee9)', borderRadius: 8, border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>CHÍNH XÁC</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success, #15803d)', marginTop: 2 }}>{liveAccuracy}%</div>
                  </div>
                  <div style={{ padding: '12px 8px', background: 'var(--surface-soft, #f0eee9)', borderRadius: 8, border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>TỔNG TỪ GÕ</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{Math.round((sessionCompletedChars + typedText.length) / 5)}</div>
                  </div>
                  <div style={{ padding: '12px 8px', background: 'var(--surface-soft, #f0eee9)', borderRadius: 8, border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>LỖI SAI</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: (sessionCompletedErrors + errorCount) > 0 ? '#dc2626' : 'var(--text-primary)', marginTop: 2 }}>{sessionCompletedErrors + errorCount}</div>
                  </div>
                  <div style={{ padding: '12px 8px', background: 'var(--surface-soft, #f0eee9)', borderRadius: 8, border: '1px solid var(--border, rgba(0, 0, 0, 0.08))' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>XP TÍCH LŨY</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0284c7', marginTop: 2 }}>
                      {practiceSubmissionResult?.awardedXp ? `+${practiceSubmissionResult.awardedXp} XP` : '0 XP'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <Button variant="secondary" onClick={handleRestartPractice}>
                    <RotateCcw size={14} /> Thử Lại Lượt Mới
                  </Button>
                  <Button variant="secondary" onClick={() => navigate('/leaderboard')}>
                    <Trophy size={14} /> Xem Bảng Xếp Hạng
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

            {/* Create Room Actions */}
            <Card style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Đấu Trường Nội Bộ ({selectedMode})</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                    Tạo phòng thi đấu tốc độ trực tuyến với đồng nghiệp và leo bảng xếp hạng công ty.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Button variant="primary" onClick={() => setIsCreatingModal(true)}>
                    <Plus size={15} /> Tạo Phòng {selectedMode} Mới
                  </Button>
                </div>
              </div>
            </Card>

            {/* Live Now Spectator Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'rgba(220, 38, 38, 0.1)',
                      color: '#dc2626',
                      padding: '3px 10px',
                      borderRadius: 16,
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: '0.02em',
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: '#dc2626',
                        boxShadow: '0 0 6px #dc2626',
                        animation: 'livePulse 1.5s infinite',
                      }}
                    />
                    🔴 TRỰC TIẾP
                  </span>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                    Trận Đấu Đang Diễn Ra ({liveMatches.length})
                  </h3>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Khán giả có thể vào theo dõi trực tiếp diễn biến
                </span>
              </div>

              {liveMatches.length === 0 ? (
                <Card style={{ padding: 16, background: 'var(--surface-soft, #faf9f6)', textAlign: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                    Hiện chưa có trận PvP nào đang thi đấu. Khi hai người chơi bắt đầu trận, trận đấu sẽ xuất hiện tại đây để bạn vào xem trực tiếp!
                  </div>
                </Card>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 8 }}>
                  {liveMatches.map((m) => {
                    const p1 = m.players?.[0] || {};
                    const p2 = m.players?.[1] || {};
                    const p1Name = p1.user?.name || 'Tuyển thủ 1';
                    const p2Name = p2.user?.name || 'Tuyển thủ 2';
                    const p1Wpm = p1.wpm || 0;
                    const p2Wpm = p2.wpm || 0;
                    const p1Progress = p1.progressPct || 0;
                    const p2Progress = p2.progressPct || 0;
                    const viewers = m.spectatorCount || 0;

                    return (
                      <Card
                        key={m.id}
                        style={{
                          padding: 16,
                          border: '1.5px solid rgba(220, 38, 38, 0.25)',
                          position: 'relative',
                          overflow: 'hidden',
                          background: 'var(--surface, #ffffff)',
                          boxShadow: '0 4px 12px rgba(220, 38, 38, 0.05)',
                        }}
                      >
                        {/* Live Badge + Viewers Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: '#dc2626',
                                background: 'rgba(220, 38, 38, 0.08)',
                                padding: '2px 8px',
                                borderRadius: 4,
                              }}
                            >
                              🔴 {m.mode || '1V1'}
                            </span>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                              {m.title || `Trận đấu #${m.id}`}
                            </span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: 'var(--text-secondary)',
                              background: 'var(--surface-soft, #f0eee9)',
                              padding: '2px 8px',
                              borderRadius: 12,
                            }}
                          >
                            <Eye size={12} style={{ color: '#0284c7' }} />
                            <span>{viewers} đang xem</span>
                          </div>
                        </div>

                        {/* Competitors Head-to-Head Telemetry */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                          {/* Player 1 (Blue) */}
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <div
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: '50%',
                                  background: 'rgba(2, 132, 199, 0.1)',
                                  color: '#0284c7',
                                  fontSize: 11,
                                  fontWeight: 800,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: '1px solid #0284c7',
                                }}
                              >
                                {p1Name[0]?.toUpperCase() || 'A'}
                              </div>
                              <div style={{ fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p1Name}
                              </div>
                            </div>
                            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0284c7' }}>
                              {p1Wpm} WPM <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-muted)' }}>({p1Progress}%)</span>
                            </div>
                          </div>

                          {/* VS separator */}
                          <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                            VS
                          </div>

                          {/* Player 2 (Orange) */}
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 2 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p2Name}
                              </div>
                              <div
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: '50%',
                                  background: 'rgba(234, 88, 12, 0.1)',
                                  color: '#ea580c',
                                  fontSize: 11,
                                  fontWeight: 800,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: '1px solid #ea580c',
                                }}
                              >
                                {p2Name[0]?.toUpperCase() || 'B'}
                              </div>
                            </div>
                            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#ea580c' }}>
                              <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-muted)' }}>({p2Progress}%)</span> {p2Wpm} WPM
                            </div>
                          </div>
                        </div>

                        {/* Duel Progress Tracks */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                          <div style={{ height: 5, borderRadius: 3, background: 'var(--surface-soft, #f0eee9)', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${p1Progress}%`,
                                background: '#0284c7',
                                borderRadius: 3,
                                transition: 'width var(--motion-fast) var(--ease-standard)',
                              }}
                            />
                          </div>
                          <div style={{ height: 5, borderRadius: 3, background: 'var(--surface-soft, #f0eee9)', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${p2Progress}%`,
                                background: '#ea580c',
                                borderRadius: 3,
                                transition: 'width var(--motion-fast) var(--ease-standard)',
                              }}
                            />
                          </div>
                        </div>

                        {/* Spectate Action Button */}
                        <Button
                          variant="primary"
                          size="sm"
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          onClick={() => navigate(`/games/typing/spectate/${m.id}`)}
                        >
                          <Eye size={13} /> Xem Trực Tiếp ({viewers} đang xem)
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

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
                  description="Hãy bấm 'Tạo Phòng Mới' ở trên để bạn bè và đồng nghiệp cùng tham gia thi đấu."
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
                        onClick={() => handleJoinExistingRoom(r.id)}
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

      {/* ── SPECTATORS LIST MODAL ── */}
      <AnimatedModal
        isOpen={showSpectatorsModal}
        onClose={() => setShowSpectatorsModal(false)}
        title={`Khán Giả Đang Theo Dõi (${spectatorCount})`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Danh sách các thành viên đang theo dõi trực tiếp trận đấu này theo thời gian thực:
          </div>

          {spectators.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {isSpectator
                ? 'Bạn là người đầu tiên đang theo dõi trận đấu này.'
                : 'Chưa có khán giả nào đang theo dõi trận đấu.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              {spectators.map((s, idx) => {
                const sName = s.name || `Khán giả #${s.userId || idx + 1}`;
                const isMe = Number(s.userId) === Number(user?.id);
                return (
                  <div
                    key={s.userId || s.socketId || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: isMe ? 'var(--accent-soft, rgba(180, 83, 9, 0.08))' : 'var(--surface-soft, #f0eee9)',
                      border: isMe ? '1.5px solid var(--accent, #b45309)' : '1px solid var(--border, rgba(0, 0, 0, 0.08))',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: isMe ? 'var(--accent, #b45309)' : 'var(--surface, #ffffff)',
                          color: isMe ? '#ffffff' : 'var(--accent, #b45309)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 13,
                          border: '1px solid var(--border, rgba(0, 0, 0, 0.1))',
                        }}
                      >
                        {sName[0]?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {sName} {isMe && '(Bạn)'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {s.jobTitle || s.department || 'Đồng nghiệp WorkRank'}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <Eye size={12} style={{ color: '#0284c7' }} />
                      <span>Đang xem</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="secondary" onClick={() => setShowSpectatorsModal(false)}>
              Đóng
            </Button>
          </div>
        </div>
      </AnimatedModal>
    </PageShell>
  );
}
