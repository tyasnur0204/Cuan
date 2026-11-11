const FinMateLogo = ({ className = 'w-9 h-9', variant = 'glass' }) => {
  const wrapperClass =
    variant === 'solid'
      ? 'bg-emerald text-white shadow-sm'
      : 'bg-white/15 text-white border border-white/20 backdrop-blur-sm';

  return (
    <div
      className={`${className} ${wrapperClass} rounded-xl flex items-center justify-center shrink-0`}
    >
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-6 h-6"
        aria-hidden="true"
      >
        {/* Wallet / Shield Base */}
        <rect
          x="6"
          y="15"
          width="24"
          height="14"
          rx="4"
          fill="currentColor"
          fillOpacity="0.22"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M22 20.5H28.5V23.5H22C21.1716 23.5 20.5 22.8284 20.5 22C20.5 21.1716 21.1716 20.5 22 20.5Z"
          fill="currentColor"
        />
        {/* Growth Sprout / Leaves */}
        <path
          d="M18 15V9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M18 11.5C18 8 15 6 11.5 6.5C11.5 10 14 12.5 18 11.5Z"
          fill="currentColor"
        />
        <path
          d="M18 10.5C18 7 21 5 24.5 5.5C24.5 9 22 11.5 18 10.5Z"
          fill="currentColor"
          fillOpacity="0.85"
        />
      </svg>
    </div>
  );
};

export default FinMateLogo;
