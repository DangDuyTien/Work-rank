import React from 'react';
import {
  Crown,
  ShieldAlert,
  ShieldCheck,
  Award,
  Star,
  Sparkles,
  Video,
  Code,
  User,
  Users,
  Flame,
  Zap,
} from 'lucide-react';

/**
 * WORKRANK TIERED JOB TITLE & ROLE BADGE HIERARCHY
 * 
 * Tier 6: Executive / Founder / CEO / Director (Hoàng Gia Kim Cương)
 * Tier 5: System Administrator / Super Admin (Quản Trị Tối Thượng)
 * Tier 4: Management / Department Leads / Team Leads (Lãnh Đạo & Quản Lý)
 * Tier 3: Senior Specialists & Core Engineers (Chuyên Viên Cao Cấp)
 * Tier 2: Specialists & Creative Roles (Chuyên Môn Sáng Tạo)
 * Tier 1: Standard Staff & General Members (Nhân Viên Chuẩn)
 */

export const CATEGORIZED_JOB_TITLES = [
  {
    category: 'Ban Lãnh Đạo Tối Cao (Tier 6)',
    titles: [
      'Founder / Nhà Sáng Lập',
      'Chủ Tịch Hội Đồng Quản Trị',
      'CEO / Tổng Giám Đốc',
      'Giám Đốc Điều Hành (COO)',
      'Giám Đốc Kỹ Thuật (CTO)',
      'Giám Đốc Tài Chính (CFO)',
      'Giám Đốc Marketing (CMO)',
      'Giám Đốc / Executive Director',
      'Phó Tổng Giám Đốc',
    ],
  },
  {
    category: 'Quản Trị Hệ Thống (Tier 5)',
    titles: [
      'Quản Trị Viên Hệ Thống (Admin)',
      'Kỹ Sư Trưởng Hệ Thống (Principal Engineer)',
      'System Administrator',
      'Lead DevOps Engineer',
    ],
  },
  {
    category: 'Cấp Quản Lý & Trưởng Phòng (Tier 4)',
    titles: [
      'Trưởng Phòng / Team Lead',
      'Phó Trưởng Phòng',
      'Kênh Trưởng / Channel Manager',
      'Trưởng Ban Biên Tập',
      'Quản Lý Dự Án / Project Manager',
      'Art Director / Giám Đốc Mỹ Thuật',
    ],
  },
  {
    category: 'Chuyên Viên Cao Cấp (Tier 3)',
    titles: [
      'Chuyên Viên Cao Cấp (Senior Specialist)',
      'Senior Video Editor',
      'Senior Content Creator',
      'Kỹ Sư Phần Mềm (Senior Developer)',
      'Chuyên Viên Truyền Thông',
      'Producer / Nhà Sản Xuất',
    ],
  },
  {
    category: 'Chuyên Môn & Sáng Tạo (Tier 2)',
    titles: [
      'Video Editor',
      'Content Creator',
      'Graphic Designer',
      'Media Specialist',
      'Kỹ Thuật Viên Video',
      'Copywriter / Biên Kịch',
    ],
  },
  {
    category: 'Nhân Sự Tiêu Chuẩn (Tier 1)',
    titles: [
      'Nhân Viên',
      'Thành Viên Đội Ngũ',
      'Cộng Tác Viên (Collaborator)',
      'Thực Tập Sinh (Intern)',
    ],
  },
];

export const CATEGORIZED_DEPARTMENTS = [
  'Media & Content',
  'Phòng Sản Xuất Video',
  'Phòng Truyền Thông',
  'Engineering Core',
  'Phòng Kỹ Thuật & Hệ Thống',
  'Community & Growth',
  'Ban Giám Đốc',
  'Phòng Hành Chính Nhân Sự',
];

export function resolveJobTitleTier(jobTitle = '', role = 'user') {
  const title = String(jobTitle || '').trim().toLowerCase();
  const r = String(role || '').trim().toLowerCase();

  // Tier 6: Executive / Board / Founder / CEO / Director
  if (
    title.includes('founder') ||
    title.includes('sáng lập') ||
    title.includes('ceo') ||
    title.includes('chủ tịch') ||
    title.includes('tổng giám đốc') ||
    title.includes('giám đốc') ||
    title.includes('director') ||
    title.includes('c-level') ||
    title.includes('cto') ||
    title.includes('cfo') ||
    title.includes('coo') ||
    title.includes('cmo') ||
    title.includes('executive')
  ) {
    return {
      tier: 6,
      tierName: 'Ban Lãnh Đạo Tối Cao',
      tierCode: 'EXECUTIVE',
      icon: Crown,
      badgeClass: 'job-badge-tier-6',
      accentColor: '#f59e0b',
      label: jobTitle || 'Giám Đốc',
    };
  }

  // Tier 5: System Administration & High Privileges
  if (
    r === 'admin' ||
    title.includes('quản trị viên') ||
    title.includes('administrator') ||
    title.includes('admin') ||
    title.includes('hệ thống') ||
    title.includes('sysadmin') ||
    title.includes('kỹ sư trưởng')
  ) {
    return {
      tier: 5,
      tierName: 'Quản Trị Viên Hệ Thống',
      tierCode: 'ADMIN',
      icon: ShieldCheck,
      badgeClass: 'job-badge-tier-5',
      accentColor: '#a855f7',
      label: jobTitle || (r === 'admin' ? 'Quản Trị Viên' : 'Kỹ Sư Hệ Thống'),
    };
  }

  // Tier 4: Management & Department Leads
  if (
    r === 'manager' ||
    title.includes('phó giám đốc') ||
    title.includes('trưởng phòng') ||
    title.includes('phó phòng') ||
    title.includes('trưởng ban') ||
    title.includes('quản lý') ||
    title.includes('manager') ||
    title.includes('lead') ||
    title.includes('kênh trưởng') ||
    title.includes('art director')
  ) {
    return {
      tier: 4,
      tierName: 'Cấp Quản Lý & Lãnh Đạo',
      tierCode: 'MANAGEMENT',
      icon: Award,
      badgeClass: 'job-badge-tier-4',
      accentColor: '#06b6d4',
      label: jobTitle || (r === 'manager' ? 'Trưởng Phòng' : 'Quản Lý'),
    };
  }

  // Tier 3: Senior Specialists & Core Engineers
  if (
    title.includes('chuyên viên cao cấp') ||
    title.includes('chuyên viên') ||
    title.includes('senior') ||
    title.includes('kỹ sư') ||
    title.includes('producer') ||
    title.includes('truyền thông') ||
    title.includes('master') ||
    title.includes('developer') ||
    title.includes('dev')
  ) {
    return {
      tier: 3,
      tierName: 'Chuyên Viên Cao Cấp',
      tierCode: 'SENIOR',
      icon: Star,
      badgeClass: 'job-badge-tier-3',
      accentColor: '#3b82f6',
      label: jobTitle || 'Chuyên Viên',
    };
  }

  // Tier 2: Specialists & Creative Roles
  if (
    title.includes('editor') ||
    title.includes('video') ||
    title.includes('content') ||
    title.includes('creator') ||
    title.includes('designer') ||
    title.includes('media') ||
    title.includes('marketing') ||
    title.includes('sản xuất')
  ) {
    return {
      tier: 2,
      tierName: 'Chuyên Môn & Sáng Tạo',
      tierCode: 'SPECIALIST',
      icon: Video,
      badgeClass: 'job-badge-tier-2',
      accentColor: '#0284c7',
      label: jobTitle || 'Video Editor',
    };
  }

  // Tier 1: Standard Staff & General Members
  return {
    tier: 1,
    tierName: 'Nhân Sự Tiêu Chuẩn',
    tierCode: 'STAFF',
    icon: User,
    badgeClass: 'job-badge-tier-1',
    accentColor: '#64748b',
    label: jobTitle || 'Nhân viên',
  };
}

export default function JobTitleBadge({
  jobTitle,
  role = 'user',
  size = 'md', // 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showIcon = true,
  showTierTag = false,
  className = '',
  style = {},
  title,
}) {
  const config = resolveJobTitleTier(jobTitle, role);
  const IconComponent = config.icon;
  const displayTitle = jobTitle || config.label;
  const tooltip = title || `${displayTitle} • ${config.tierName} (Tier ${config.tier})`;

  return (
    <span
      className={`job-title-badge job-title-badge-${size} ${config.badgeClass} ${className}`}
      title={tooltip}
      style={style}
    >
      {showIcon && (
        <span className="job-title-badge-icon">
          <IconComponent />
        </span>
      )}
      <span className="job-title-badge-text">{displayTitle}</span>
      {showTierTag && (
        <span
          style={{
            fontSize: '0.75em',
            opacity: 0.8,
            padding: '1px 4px',
            borderRadius: 2,
            background: 'rgba(0,0,0,0.06)',
            marginLeft: 2,
          }}
        >
          T{config.tier}
        </span>
      )}
    </span>
  );
}
