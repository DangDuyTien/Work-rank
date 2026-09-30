import React from 'react';
import {
  Scissors,
  Sparkles,
  Tv,
  Briefcase,
  Building2,
  Crown,
} from 'lucide-react';

/**
 * =========================================================================
 * WORKRANK CANONICAL JOB TITLE SYSTEM — 6 OFFICIAL ROLES ONLY
 * =========================================================================
 * 
 * 1. EDITOR           (Biên tập & dựng video - Scissors)
 * 2. CONTENT          (Sáng tạo nội dung & kịch bản - Sparkles)
 * 3. QUẢN LÝ KÊNH     (Quản trị kênh YouTube & Media - Tv)
 * 4. TRƯỞNG PHÒNG     (Lãnh đạo & quản lý phòng ban - Briefcase)
 * 5. PHÓ GIÁM ĐỐC     (Phó giám đốc điều hành & chiến lược - Building2)
 * 6. GIÁM ĐỐC         (Giám đốc & ban điều hành tối cao - Crown)
 */

export const JOB_TITLE_CONFIG = {
  editor: {
    id: 'editor',
    label: 'Editor',
    shortLabel: 'Editor',
    icon: Scissors,
    description: 'Biên tập & dựng video chuyên nghiệp',
    priority: 1,
    className: 'job-badge-editor',
    color: '#0f766e',
    accentColor: '#0d9488',
    bgColor: '#f0fdfa',
    borderColor: '#99f6e4',
  },
  content: {
    id: 'content',
    label: 'Content',
    shortLabel: 'Content',
    icon: Sparkles,
    description: 'Sáng tạo nội dung & kịch bản truyền thông',
    priority: 2,
    className: 'job-badge-content',
    color: '#6d28d9',
    accentColor: '#7c3aed',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe',
  },
  channel_manager: {
    id: 'channel_manager',
    label: 'Quản lý kênh',
    shortLabel: 'QL Kênh',
    icon: Tv,
    description: 'Quản trị & tối ưu hóa kênh phát triển',
    priority: 3,
    className: 'job-badge-channel-manager',
    color: '#1e40af',
    accentColor: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  head_of_department: {
    id: 'head_of_department',
    label: 'Trưởng phòng',
    shortLabel: 'Trưởng phòng',
    icon: Briefcase,
    description: 'Lãnh đạo & quản lý phòng ban chuyên môn',
    priority: 4,
    className: 'job-badge-head-of-department',
    color: '#c2410c',
    accentColor: '#ea580c',
    bgColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  deputy_director: {
    id: 'deputy_director',
    label: 'Phó giám đốc',
    shortLabel: 'Phó GĐ',
    icon: Building2,
    description: 'Phó giám đốc điều hành & chiến lược',
    priority: 5,
    className: 'job-badge-deputy-director',
    color: '#92400e',
    accentColor: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  director: {
    id: 'director',
    label: 'Giám đốc',
    shortLabel: 'Giám đốc',
    icon: Crown,
    description: 'Giám đốc & ban điều hành tối cao',
    priority: 6,
    className: 'job-badge-director',
    color: '#9f1239',
    accentColor: '#e11d48',
    bgColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
};

export const OFFICIAL_JOB_TITLES = [
  'Editor',
  'Content',
  'Quản lý kênh',
  'Trưởng phòng',
  'Phó giám đốc',
  'Giám đốc',
];

export const CATEGORIZED_JOB_TITLES = [
  {
    category: 'Chuyên Môn & Sản Xuất (Production)',
    titles: ['Editor', 'Content'],
  },
  {
    category: 'Cấp Quản Lý & Điều Hành (Management & Executive)',
    titles: ['Quản lý kênh', 'Trưởng phòng', 'Phó giám đốc', 'Giám đốc'],
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

/**
 * Resolve any raw job title string into one of the 6 canonical configs
 */
export function resolveJobTitleConfig(jobTitle = '') {
  const str = String(jobTitle || '').trim().toLowerCase();

  if (
    str === 'giám đốc' ||
    str === 'giam doc' ||
    str === 'director' ||
    str === 'ceo' ||
    str === 'founder' ||
    str === 'chủ tịch' ||
    str === 'tổng giám đốc' ||
    (str.includes('giám đốc') && !str.includes('phó')) ||
    (str.includes('director') && !str.includes('deputy'))
  ) {
    return JOB_TITLE_CONFIG.director;
  }

  if (
    str === 'phó giám đốc' ||
    str === 'pho giam doc' ||
    str === 'deputy director' ||
    str === 'phó gđ' ||
    str.includes('phó giám đốc') ||
    str.includes('deputy') ||
    str.includes('phó tổng')
  ) {
    return JOB_TITLE_CONFIG.deputy_director;
  }

  if (
    str === 'trưởng phòng' ||
    str === 'truong phong' ||
    str === 'head of department' ||
    str === 'lead' ||
    str.includes('trưởng phòng') ||
    str.includes('phó phòng') ||
    str.includes('trưởng ban') ||
    str.includes('team lead')
  ) {
    return JOB_TITLE_CONFIG.head_of_department;
  }

  if (
    str === 'quản lý kênh' ||
    str === 'quan ly kenh' ||
    str === 'channel manager' ||
    str === 'kênh trưởng' ||
    str.includes('quản lý kênh') ||
    str.includes('channel') ||
    str.includes('kênh')
  ) {
    return JOB_TITLE_CONFIG.channel_manager;
  }

  if (
    str === 'content' ||
    str === 'content creator' ||
    str.includes('content') ||
    str.includes('kịch bản') ||
    str.includes('copywriter') ||
    str.includes('nội dung')
  ) {
    return JOB_TITLE_CONFIG.content;
  }

  // Default to Editor
  return JOB_TITLE_CONFIG.editor;
}

export function resolveJobTitleTier(jobTitle = '') {
  const config = resolveJobTitleConfig(jobTitle);
  return {
    tier: config.priority,
    tierName: config.label,
    tierCode: config.id.toUpperCase(),
    icon: config.icon,
    badgeClass: config.className,
    accentColor: config.accentColor,
    label: config.label,
  };
}

/**
 * Canonical JobTitleBadge Component
 */
export default function JobTitleBadge({
  jobTitle,
  size = 'md', // 'xs' | 'sm' | 'md' | 'lg'
  showIcon = true,
  className = '',
  style = {},
  title,
}) {
  const config = resolveJobTitleConfig(jobTitle);
  const IconComponent = config.icon;
  const displayLabel = config.label;
  const tooltip = title || `${displayLabel} • ${config.description}`;

  return (
    <span
      className={`job-title-badge job-title-badge-${size} ${config.className} ${className}`}
      title={tooltip}
      style={style}
    >
      {showIcon && (
        <span className="job-title-badge-icon">
          <IconComponent />
        </span>
      )}
      <span className="job-title-badge-text">{displayLabel}</span>
    </span>
  );
}
