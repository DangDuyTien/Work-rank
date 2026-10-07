'use strict';

const { TypingChallenge } = require('../models');

// ── KHO BÀI THI 100% TIẾNG VIỆT CHUẨN (KHÔNG CHẤM PHẨY - KHÔNG TỪ TIẾNG ANH - CHỮ THƯỜNG) ──
const DEFAULT_CHALLENGES = [
  // ── 1. ĐỜI SỐNG & BÌNH YÊN ──
  {
    title: 'Thư Thái Sau Giờ Làm',
    category: 'Đời sống',
    difficulty: 'EASY',
    language: 'VI',
    content:
      'chữa lành tâm hồn bằng một chén trà ấm và gác lại mọi lo toan công việc sau giờ hành chính để tận hưởng cuộc sống bình yên bên gia đình người thân',
  },
  {
    title: 'Hạnh Phúc Giản Dị',
    category: 'Đời sống',
    difficulty: 'EASY',
    language: 'VI',
    content:
      'nhiều người thích khoe nhà cao cửa rộng còn tôi chỉ thích tự hào vì hôm nay đã hoàn thành xong mọi kế hoạch công việc sớm hơn dự kiến một tiếng đồng hồ',
  },
  {
    title: 'Tâm Thế Tích Cực',
    category: 'Đời sống',
    difficulty: 'MEDIUM',
    language: 'VI',
    content:
      'đi làm với tâm thế vui vẻ không cáu giận khi khách hàng yêu cầu chỉnh sửa bản vẽ nhiều lần vì mỗi lần sửa đổi là một lần nâng cao tay nghề điêu luyện',
  },
  {
    title: 'Câu Chuyện Đời Thường',
    category: 'Đời sống',
    difficulty: 'MEDIUM',
    language: 'VI',
    content:
      'những câu chuyện đời thường giản dị và ý nghĩa trên mạng luôn thu hút hàng triệu người xem và mang lại niềm vui sảng khoái sau chuỗi ngày bận rộn',
  },
  {
    title: 'Tâm Sự Đêm Muộn',
    category: 'Đời sống',
    difficulty: 'MEDIUM',
    language: 'VI',
    content:
      'đêm muộn lướt xem những dòng tâm sự chân thành thấy ai cũng đang âm thầm nỗ lực từng ngày để xây dựng tương lai tươi sáng và ấm no hơn',
  },
  {
    title: 'Sức Mạnh Lời Động Viên',
    category: 'Đời sống',
    difficulty: 'HARD',
    language: 'VI',
    content:
      'một lời khen ngợi và vài câu động viên chân thành có thể tiếp thêm nguồn năng lượng dồi dào cho bạn bè đồng nghiệp tiếp tục cống hiến hết mình',
  },

  // ── 2. CÔNG VIỆC & ĐỒNG ĐỘI ──
  {
    title: 'Hoàn Thành Nhiệm Vụ',
    category: 'Công sở',
    difficulty: 'EASY',
    language: 'VI',
    content:
      'cảm giác chạy đua cùng thời gian để nộp bài hoàn chỉnh trước mười hai giờ đêm mang lại sự hồi hộp tột cùng nhưng niềm vui khi hoàn thành xuất sắc là vô giá',
  },
  {
    title: 'Họp Hành Hiệu Quả',
    category: 'Công sở',
    difficulty: 'EASY',
    language: 'VI',
    content:
      'một buổi họp thành công là buổi họp đi thẳng vào trọng tâm vấn đề đưa ra giải pháp rõ ràng và phân công nhiệm vụ cụ thể cho từng thành viên tham gia',
  },
  {
    title: 'Khởi Đầu Ngày Mới',
    category: 'Công sở',
    difficulty: 'MEDIUM',
    language: 'VI',
    content:
      'hương thơm của ly cà phê sữa đá buổi sáng đánh thức mọi giác quan giúp tinh thần sảng khoái và sẵn sàng bùng nổ cùng những ý tưởng sáng tạo độc đáo',
  },
  {
    title: 'Kỷ Luật Cá Nhân',
    category: 'Công sở',
    difficulty: 'MEDIUM',
    language: 'VI',
    content:
      'tự giác quản lý thời gian và hoàn thành trách nhiệm được giao là thước đo chính xác nhất cho sự chuyên nghiệp của một nhân sự tài năng trong tập thể',
  },
  {
    title: 'Tình Đồng Đội Bền Chặt',
    category: 'Công sở',
    difficulty: 'HARD',
    language: 'VI',
    content:
      'có những người đồng nghiệp luôn sẵn lòng giúp đỡ chia sẻ kinh nghiệm và cùng nhau vượt qua khó khăn là điều may mắn lớn nhất trong sự nghiệp',
  },
  {
    title: 'Học Hỏi Không Ngừng',
    category: 'Công sở',
    difficulty: 'HARD',
    language: 'VI',
    content:
      'không ngừng học hỏi những kỹ năng mới và chủ động đón nhận thử thách khó khăn giúp bạn nhanh chóng trở thành người dẫn đầu trong lĩnh vực của mình',
  },

  // ── 3. Ý CHÍ & PHÁT TRIỂN BẢN THÂN ──
  {
    title: 'Vượt Qua Giới Hạn',
    category: 'Ý chí',
    difficulty: 'EASY',
    language: 'VI',
    content:
      'mọi giới hạn sinh ra là để thử thách ý chí kiên định và lòng dũng cảm của những ai khao khát vươn tới đỉnh cao thành công trong cuộc đời',
  },
  {
    title: 'Tích Lũy Từng Ngày',
    category: 'Ý chí',
    difficulty: 'EASY',
    language: 'VI',
    content:
      'mỗi ngày tích lũy thêm một chút kiến thức rèn luyện thêm một chút kỹ năng sau một năm bạn sẽ nhìn lại và bất ngờ trước sự trưởng thành vượt bậc của bản thân',
  },
  {
    title: 'Trân Trọng Hiện Tại',
    category: 'Ý chí',
    difficulty: 'MEDIUM',
    language: 'VI',
    content:
      'quá khứ đã qua đi tương lai chưa tới hãy dành trọn vẹn sự tập trung và tâm huyết cho từng việc nhỏ bạn đang làm ngay trong giây phút hiện tại',
  },
  {
    title: 'Lòng Kiên Trì Bất Diệt',
    category: 'Ý chí',
    difficulty: 'MEDIUM',
    language: 'VI',
    content:
      'người kiên trì đi đến cùng luôn chiến thắng người có tài năng nhưng dễ nản lòng trước sóng gió thử thách khắc nghiệt của cuộc sống',
  },
  {
    title: 'Tự Tin Tỏa Sáng',
    category: 'Ý chí',
    difficulty: 'HARD',
    language: 'VI',
    content:
      'bạn sở hữu những điểm mạnh độc nhất vô nhị hãy tự tin phát huy thế mạnh đó để tạo ra những giá trị tốt đẹp cho cộng đồng và xã hội xung quanh',
  },
  {
    title: 'Bền Bỉ Vươn Lên',
    category: 'Ý chí',
    difficulty: 'HARD',
    language: 'VI',
    content:
      'thành công không đến từ sự may mắn chốc lát mà là kết quả của chuỗi ngày miệt mài rèn luyện kỷ luật bản thân và không bao giờ bỏ cuộc',
  },

  // ── 4. KỸ NĂNG ĐÁNH MÁY & PHẢN XẠ ──
  {
    title: 'Thời Đại Kỹ Thuật Số',
    category: 'Kỹ năng',
    difficulty: 'EASY',
    language: 'VI',
    content:
      'trí tuệ nhân tạo đang thay đổi cách thế giới vận hành giúp con người giải quyết công việc nhanh chóng và tập trung vào tư duy sáng tạo đỉnh cao',
  },
  {
    title: 'Hạ Tầng Tốc Độ Cao',
    category: 'Kỹ năng',
    difficulty: 'MEDIUM',
    language: 'VI',
    content:
      'hệ thống máy chủ thế hệ mới cho phép truyền tải dữ liệu và cập nhật bảng xếp hạng thi đấu của hàng vạn người dùng trong chớp mắt không hề chậm trễ',
  },
  {
    title: 'Đấu Trường Trực Tuyến',
    category: 'Kỹ năng',
    difficulty: 'MEDIUM',
    language: 'VI',
    content:
      'đấu trường đánh máy kết nối hàng ngàn tuyển thủ tài ba cùng so tài tốc độ độ chính xác và khả năng phản xạ nhanh nhạy trên từng phím bấm',
  },
  {
    title: 'Nghệ Thuật Mười Ngón',
    category: 'Kỹ năng',
    difficulty: 'HARD',
    language: 'VI',
    content:
      'gõ phím mười ngón thuần thục như một nghệ sĩ lướt tay trên phím đàn dương cầm giúp bạn hiện thực hóa dòng suy nghĩ thành văn bản với tốc độ ánh sáng',
  },
  {
    title: 'Âm Thanh Bàn Phím Cơ',
    category: 'Kỹ năng',
    difficulty: 'HARD',
    language: 'VI',
    content:
      'đôi bàn tay uyển chuyển lướt nhẹ trên từng phím bấm tạo nên những âm thanh lách cách giòn giã mang lại cảm giác thích thú và say mê bất tận',
  },
  {
    title: 'Nâng Cao Năng Suất',
    category: 'Kỹ năng',
    difficulty: 'HARD',
    language: 'VI',
    content:
      'luyện tập gõ nhanh mỗi ngày giúp tăng cường khả năng tập trung phản xạ não bộ và nâng cao năng suất làm việc vượt bậc trong thời đại số',
  },

  // ── 5. ĐẤT NƯỚC & VĂN HÓA VIỆT NAM ──
  {
    title: 'Non Sông Gấm Vóc',
    category: 'Việt Nam',
    difficulty: 'EASY',
    language: 'VI',
    content:
      'đất nước việt nam gấm vóc tươi đẹp trải dài từ ải nam quan đến mũi cà mau với muôn vàn danh lam thắng cảnh và con người thân thiện hiếu khách',
  },
  {
    title: 'Mùa Thu Hà Nội',
    category: 'Việt Nam',
    difficulty: 'MEDIUM',
    language: 'VI',
    content:
      'mùa thu hà nội thơm nồng mùi hoa sữa cùng những con phố cổ kính rêu phong đón từng cơn gió heo may se lạnh làm xao xuyến lòng người phương xa',
  },
  {
    title: 'Phù Sa Miền Tây',
    category: 'Việt Nam',
    difficulty: 'MEDIUM',
    language: 'VI',
    content:
      'dòng sông mê kông màu mỡ bồi đắp phù sa cho những cánh đồng lúa chín vàng ươm trĩu hạt mang lại mùa màng bội thu cho bà con nông dân miền tây',
  },
  {
    title: 'Biển Đảo Quê Hương',
    category: 'Việt Nam',
    difficulty: 'MEDIUM',
    language: 'VI',
    content:
      'tiếng sóng vỗ rì rào bên bờ biển xanh cát trắng nắng vàng cùng những hàng dừa nghiêng bóng tạo nên bức tranh thiên nhiên tuyệt mỹ của biển đảo quê hương',
  },
  {
    title: 'Tinh Thần Hiếu Học',
    category: 'Việt Nam',
    difficulty: 'HARD',
    language: 'VI',
    content:
      'truyền thống tôn sư trọng đạo và tinh thần hiếu học nghìn năm của dân tộc là ngọn đuốc sáng soi đường cho các thế hệ trẻ vươn tầm thế giới',
  },
  {
    title: 'Hương Vị Gia Đình',
    category: 'Việt Nam',
    difficulty: 'HARD',
    language: 'VI',
    content:
      'bữa cơm gia đình ấm cúng với bát canh rau muống luộc cùng đĩa cà pháo giòn tan luôn là ký ức thiêng liêng ấm áp nhất của mỗi người con xa xứ',
  },

  // ── 6. RÈN LUYỆN TỪ VỰNG TIẾNG VIỆT NGẪU NHIÊN ──
  {
    title: 'Bình Minh Rạng Rỡ',
    category: 'Từ vựng ngẫu nhiên',
    difficulty: 'EASY',
    language: 'VI',
    content:
      'mặt trời mọc chim hót chào ngày mới bình minh rực rỡ hoa cỏ ngát hương gió nhẹ thổi qua cành lá mang theo không khí trong lành dễ chịu',
  },
  {
    title: 'Nhịp Điệu Đôi Tay',
    category: 'Từ vựng ngẫu nhiên',
    difficulty: 'EASY',
    language: 'VI',
    content:
      'tập trung cao độ phản xạ nhạy bén bàn tay khéo léo phím bấm nhịp nhàng chuẩn xác từng chữ rèn luyện kiên trì mỗi ngày để đạt thành tích cao nhất',
  },
  {
    title: 'Ý Nghĩ Tích Cực',
    category: 'Từ vựng ngẫu nhiên',
    difficulty: 'MEDIUM',
    language: 'VI',
    content:
      'suy nghĩ tích cực hành động quyết đoán vượt qua thử thách gặt hái thành công cuộc sống tràn đầy niềm vui và ý nghĩa bên những người thân yêu',
  },
  {
    title: 'Kho Tàng Tri Thức',
    category: 'Từ vựng ngẫu nhiên',
    difficulty: 'MEDIUM',
    language: 'VI',
    content:
      'sách là kho tàng tri thức vô tận của nhân loại đọc sách giúp mở rộng tầm hiểu biết nuôi dưỡng tâm hồn và hoàn thiện nhân cách của mỗi con người',
  },
  {
    title: 'Sức Mạnh Tập Thể',
    category: 'Từ vựng ngẫu nhiên',
    difficulty: 'HARD',
    language: 'VI',
    content:
      'đoàn kết tạo nên sức mạnh vô địch tập thể đồng lòng chung sức vượt qua mọi rào cản đưa tổ chức phát triển vững mạnh và vươn xa hơn nữa',
  },
  {
    title: 'Nụ Cười Cuộc Sống',
    category: 'Từ vựng ngẫu nhiên',
    difficulty: 'HARD',
    language: 'VI',
    content:
      'nụ cười rạng rỡ ánh mắt ấm áp tình bạn chân thành sự sẻ chia kịp thời luôn là liều thuốc quý giá nhất xua tan mọi mệt mỏi trong cuộc sống',
  },
];

async function seedTypingChallenges() {
  for (const challenge of DEFAULT_CHALLENGES) {
    const cleanContent = challenge.content
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, '')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim();

    const wordCount = cleanContent.split(/\s+/).length;
    const characterCount = cleanContent.length;

    const [record, created] = await TypingChallenge.findOrCreate({
      where: { title: challenge.title },
      defaults: {
        ...challenge,
        content: cleanContent,
        wordCount,
        characterCount,
        isActive: true,
      },
    });

    if (!created) {
      record.content = cleanContent;
      record.wordCount = wordCount;
      record.characterCount = characterCount;
      record.language = challenge.language;
      record.category = challenge.category;
      record.difficulty = challenge.difficulty;
      await record.save();
    }
  }

  // Sanitize all existing database records to guarantee ZERO commas, ZERO periods, and 100% lowercase content
  const allExisting = await TypingChallenge.findAll();
  for (const item of allExisting) {
    const sanitized = item.content
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, '')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim();
    if (sanitized !== item.content) {
      item.content = sanitized;
      item.wordCount = item.content.split(/\s+/).length;
      item.characterCount = item.content.length;
      await item.save();
    }
  }
}

module.exports = {
  DEFAULT_CHALLENGES,
  seedTypingChallenges,
};
