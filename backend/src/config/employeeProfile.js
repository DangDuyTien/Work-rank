'use strict';

const JOB_TITLES = Object.freeze([
  'Editor',
  'Content',
  'Quản lý kênh',
  'Trưởng phòng',
  'Phó giám đốc',
  'Giám đốc',
]);

const DEPARTMENTS = Object.freeze([
  'Media & Content',
  'Editor',
  'Phòng Hành Chính Nhân Sự',
  'Ban Giám Đốc',
]);

const JOB_TITLE_LABELS = Object.freeze(Object.fromEntries(JOB_TITLES.map((value) => [value, value])));
const DEPARTMENT_LABELS = Object.freeze(Object.fromEntries(DEPARTMENTS.map((value) => [value, value])));

function normalize(value, allowed, labels) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const exact = allowed.find((candidate) => candidate === trimmed);
  if (exact) return exact;
  const lower = trimmed.toLocaleLowerCase('vi');
  const match = allowed.find((candidate) => candidate.toLocaleLowerCase('vi') === lower);
  return match || labels[trimmed] || null;
}

function normalizeJobTitle(value) {
  return normalize(value, JOB_TITLES, JOB_TITLE_LABELS);
}

function normalizeDepartment(value) {
  return normalize(value, DEPARTMENTS, DEPARTMENT_LABELS);
}

function isValidJobTitle(value) {
  return Boolean(normalizeJobTitle(value));
}

function isValidDepartment(value) {
  return Boolean(normalizeDepartment(value));
}

module.exports = {
  JOB_TITLES,
  DEPARTMENTS,
  JOB_TITLE_LABELS,
  DEPARTMENT_LABELS,
  normalizeJobTitle,
  normalizeDepartment,
  isValidJobTitle,
  isValidDepartment,
};
