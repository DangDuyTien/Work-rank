import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BrandMark from './BrandMark';

export default function PublicHeader() {
  const { user } = useAuth();
  const isSignedIn = Boolean(user);

  return (
    <header className="sticky top-0 left-0 right-0 z-50 bg-[#f7f5f0]/95 backdrop-blur-md border-b border-black/10">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 h-16 sm:h-20 flex items-center justify-between">
        {/* Left: Minimal Brand Logo & Name */}
        <Link
          to="/"
          className="flex items-center gap-3 text-decoration-none group"
          title="WorkRank • 3WIN Media"
        >
          <BrandMark size={32} showLabel={false} />
          <div className="flex items-center gap-2.5">
            <span className="font-['Space_Grotesk'] text-xl sm:text-2xl font-black tracking-tight text-[#111111] uppercase leading-none">
              WORKRANK
            </span>
            <span className="text-black/30 font-light text-base select-none">/</span>
            <span className="font-['Space_Grotesk'] text-xs font-bold uppercase tracking-[0.14em] text-[#666666] leading-none">
              3WIN MEDIA
            </span>
          </div>
        </Link>

        {/* Right: Ultra-minimal CTA */}
        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-[#111111] hover:bg-[#262626] text-white text-xs sm:text-sm font-semibold rounded-[2px] transition-all shadow-sm"
            >
              <LayoutDashboard size={14} />
              <span>Vào Workspace</span>
              <ArrowRight size={14} />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-[#111111] hover:bg-[#262626] text-white text-xs sm:text-sm font-semibold rounded-[2px] transition-all shadow-sm"
              >
                <span>Vào Workspace</span>
                <ArrowRight size={14} />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
