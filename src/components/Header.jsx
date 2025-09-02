// src/components/Header.jsx
import kartLogo from '../assets/KART_AI_LOGO_WHITE_BG.png';

export default function Header() {
  return (
    <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2 sm:py-3 md:py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <img
            src={kartLogo}
            alt="KART AI logo"
            className="h-10 w-10 sm:h-12 sm:w-12 md:h-16 md:w-16 rounded-2xl object-cover shrink-0"
          />
          <div className="leading-tight">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-[#00674F]">
                KART AI

            </h1>
            <p className="hidden sm:block text-[11px] sm:text-xs text-gray-500">
              Real Prices. Real Savings. Real Time.
            </p>
          </div>
        </div>

        <div className="text-[10px] sm:text-xs text-gray-500">
          v0.3.5 — groceries + gas units
        </div>
      </div>
    </header>
  );
}