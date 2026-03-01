import React, { useState } from 'react';
import { UserRole } from '../../types';
import { useTranslation } from 'react-i18next';
import { FiSearch, FiLogOut } from 'react-icons/fi';

interface UniversalNavProps {
  userRole: UserRole;
  onLogout: () => void;
  onSearch: (query: string) => void;
  onHome: () => void;
}

const UniversalNav: React.FC<UniversalNavProps> = ({ userRole, onLogout, onSearch, onHome }) => {
    const { t, i18n } = useTranslation();
    const [query, setQuery] = useState('');

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        onSearch(e.target.value);
    }
  
  return (
    <header className="bg-white shadow-md sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            {/* Left Side */}
            <div className="flex items-center gap-4">
                <button onClick={onHome} className="flex items-center gap-3 group">
                    <img 
                        src="https://upload.wikimedia.org/wikipedia/commons/9/91/Ministry_of_Transport_and_Communications_of_Ethiopia.png" 
                        alt="Ministry of Transport and Logistics Logo" 
                        className="h-10 w-auto object-contain rounded-full" 
                    />
                    <h1 className="text-xl font-bold text-gray-800 hidden md:block border-l pl-3 border-gray-300">{t('appTitle')}</h1>
                </button>
            </div>
            
            {/* Center: Search */}
            <div className="flex-1 max-w-lg mx-4">
                 <div className="relative">
                    <input
                        type="text"
                        value={query}
                        onChange={handleSearchChange}
                        placeholder={t('searchPlaceholder')}
                        className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-transparent rounded-full text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <FiSearch size={20} />
                    </div>
                </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-4">
                {/* Language Toggle */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                    <button 
                        onClick={() => i18n.changeLanguage('en')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${i18n.language === 'en' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                    >
                        EN
                    </button>
                    <button 
                         onClick={() => i18n.changeLanguage('am')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${i18n.language === 'am' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                    >
                        አማ
                    </button>
                </div>

                <div className="text-right hidden sm:block">
                    <p className="font-semibold text-gray-800 text-sm">{userRole}</p>
                    <p className="text-xs text-gray-500">{t('online')}</p>
                </div>
                 <button
                    onClick={onLogout}
                    className="flex items-center text-sm font-medium text-red-600 hover:text-red-800 transition gap-2"
                    title={t('logout')}
                    aria-label={t('logout')}
                >
                    <FiLogOut size={20} />
                    <span className="hidden md:inline">{t('logout')}</span>
                </button>
            </div>
        </div>
    </header>
  );
};

export default UniversalNav;