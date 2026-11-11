const getIconConfig = (category = '', type = '') => {
  const cat = String(category).toLowerCase();

  if (type === 'Transfer' || cat.includes('transfer')) {
    return { bg: 'bg-blue-50 text-blue-600', kind: 'transfer' };
  }
  if (cat.includes('makan') || cat.includes('minum') || cat.includes('kopi') || cat.includes('kuliner')) {
    return { bg: 'bg-orange-50 text-orange-600', kind: 'food' };
  }
  if (cat.includes('transport') || cat.includes('gojek') || cat.includes('grab') || cat.includes('bensin')) {
    return { bg: 'bg-sky-50 text-sky-600', kind: 'transport' };
  }
  if (cat.includes('pendidikan') || cat.includes('kuliah') || cat.includes('buku') || cat.includes('kursus')) {
    return { bg: 'bg-indigo-50 text-indigo-600', kind: 'education' };
  }
  if (cat.includes('hiburan') || cat.includes('film') || cat.includes('game') || cat.includes('nonton')) {
    return { bg: 'bg-purple-50 text-purple-600', kind: 'entertainment' };
  }
  if (cat.includes('invest') || cat.includes('reksa') || cat.includes('sbn') || cat.includes('saham')) {
    return { bg: 'bg-emerald/10 text-emerald', kind: 'invest' };
  }
  if (cat.includes('tabung') || cat.includes('saving')) {
    return { bg: 'bg-teal-50 text-teal-600', kind: 'savings' };
  }
  if (
    cat.includes('freelance') ||
    cat.includes('usaha') ||
    cat.includes('phobo') ||
    cat.includes('proyek') ||
    cat.includes('gaji') ||
    type === 'Income'
  ) {
    return { bg: 'bg-emerald/10 text-emerald', kind: 'work' };
  }

  return { bg: 'bg-gray-100 text-navy', kind: 'wallet' };
};

const CategoryIcon = ({ category = '', type = '', size = 'md' }) => {
  const { bg, kind } = getIconConfig(category, type);
  const boxSize = size === 'sm' ? 'w-7 h-7 rounded-md' : 'w-9 h-9 rounded-lg';
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-4.5 h-4.5 w-5 h-5';

  return (
    <div className={`${boxSize} ${bg} flex items-center justify-center shrink-0`}>
      {kind === 'transfer' && (
        <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      )}
      {kind === 'food' && (
        <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M5 10l1 9a2 2 0 002 2h8a2 2 0 002-2l1-9M9 6a3 3 0 016 0" />
        </svg>
      )}
      {kind === 'transport' && (
        <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 17a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zM5 17H3v-6l2-5h11l4 5v6h-2" />
        </svg>
      )}
      {kind === 'education' && (
        <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
      )}
      {kind === 'entertainment' && (
        <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      )}
      {kind === 'invest' && (
        <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      )}
      {kind === 'savings' && (
        <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      {kind === 'work' && (
        <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )}
      {kind === 'wallet' && (
        <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      )}
    </div>
  );
};

export default CategoryIcon;
