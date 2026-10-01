import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, LogIn, UserPlus, Trophy, Sparkles, LayoutDashboard, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BrandMark from './BrandMark';

export default function PublicHeader({ activeNav = '' }) {
  const { user } = useAuth();
  const location = useLocation();
  const isSignedIn = Boolean(user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Trang Chủ', href: '/' },
    { label: 'Vinh Danh Mùa Giải', href: '/award' },
    { label: 'Kho Lưu Trữ', href: '/#archive' },
    { label: 'Cơ Chế Thi Đấu', href: '/#capabilities' },
    { label: 'Đấu Trường', href: '/#arena' },
  ];

  return (
    <header className="sticky top-0 left-0 right-0 z-50 bg-[#f7f5f0]/95 backdrop-blur-md border-b border-black/10 transition-all">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 h-16 sm:h-20 flex items-center justify-between">
        {/* Left: Brand / Logo */}
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="flex items-center gap-3 text-decoration-none group"
            title="WorkRank 3WIN Media"
          >
            <BrandMark size={28} showLabel={false} />
            <div className="flex items-baseline gap-2">
              <span className="font-['Space_Grotesk'] text-lg sm:text-xl font-bold tracking-tight text-[#111111] uppercase">
                WORKRANK
              </span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] px-2 py-0.5 bg-black/5 text-[#b45309] rounded-[4px]">
                3WIN MEDIA
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((item) => {
              const isActive =
                (item.href === '/' && location.pathname === '/' && !location.hash) ||
                (item.href === '/award' && location.pathname === '/award') ||
                activeNav === item.label;

              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className={`text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                    isActive
                      ? 'text-[#b45309] font-bold border-b-2 border-[#b45309] pb-0.5'
                      : 'text-[#555555] hover:text-[#111111]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: User / Auth Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          {isSignedIn ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-[#111111] hover:bg-[#262626] text-white text-xs sm:text-sm font-semibold rounded-[4px] transition-all shadow-sm"
            >
              <LayoutDashboard size={14} />
              <span>Vào Workspace ({user?.name || 'Thành viên'})</span>
              <ArrowRight size={14} />
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#333333] hover:text-[#111111] transition-colors"
              >
                <UserPlus size={14} />
                <span>Đăng ký</span>
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-[#111111] hover:bg-[#262626] text-white text-xs sm:text-sm font-semibold rounded-[4px] transition-all shadow-sm"
              >
                <LogIn size={14} />
                <span>Đăng nhập</span>
              </Link>
            </>
          )}

          {/* Mobile hamburger button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-[#111111] hover:bg-black/5 rounded-[4px] transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#f7f5f0] border-b border-black/10 px-6 py-4 space-y-3">
          {navLinks.map((item) => (
            <Link
              key={item.label}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-semibold uppercase tracking-[0.06em] text-[#333333] hover:text-[#b45309] py-1.5"
            >
              {item.label}
            </Link>
          ))}
          {!isSignedIn && (
            <div className="pt-3 border-t border-black/10 flex items-center gap-3">
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 py-2 text-center text-xs font-semibold text-[#111111] border border-black/20 rounded-[4px]"
              >
                Đăng ký
              </Link>
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 py-2 text-center text-xs font-semibold text-white bg-[#111111] rounded-[4px]"
              >
                Đăng nhập
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
