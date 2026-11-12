const FinMateLogo = ({ className = 'w-9 h-9', variant = 'glass' }) => {
  const wrapperClass =
    variant === 'solid'
      ? 'bg-emerald text-white shadow-sm'
      : variant === 'light'
        ? 'bg-bg-light text-navy border border-gray-200 shadow-sm'
        : 'bg-white/15 text-white border border-white/25 backdrop-blur-sm';

  return (
    <div
      className={`${className} ${wrapperClass} rounded-xl flex items-center justify-center shrink-0`}
    >
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[68%] h-[68%]"
        aria-hidden="true"
      >
        {/* Tilted Wallet Flap / Card */}
        <path
          d="M6.8 13.6L23.2 6.4Q25.3 5.45 26.2 7.5L28.6 13.5"
          fill="currentColor"
          fillOpacity="0.14"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Wallet Body */}
        <rect
          x="4"
          y="13.5"
          width="28"
          height="17.5"
          rx="4"
          fill="currentColor"
          fillOpacity="0.12"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Right Clasp Strap */}
        <path
          d="M32 18.6H24.8A3.65 3.65 0 0 0 24.8 25.9H32"
          fill="currentColor"
          fillOpacity="0.16"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Clasp Button Dot */}
        <circle cx="24.8" cy="22.25" r="1.65" fill="currentColor" />
      </svg>
    </div>
  );
};

export default FinMateLogo;
