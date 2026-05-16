import React, { useMemo } from 'react';
import { ChevronLeft, Search, Check, ChevronRight, Palette, Languages, Key, LogOut, Hexagon } from 'lucide-react';
import { TRANSLATIONS, Language } from '../utils/translations';
import { logout } from '../firebase';

interface SidebarProps {
  isSidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  currentTheme: string;
  language: Language;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredMenuGroups: any[];
  tabs: any[];
  activeTab: number;
  setActiveTab: (tabId: number) => void;
  showThemeMenu: boolean;
  setShowThemeMenu: (show: boolean) => void;
  THEMES: any;
  setCurrentTheme: (theme: any) => void;
  toggleLanguage: () => void;
  setShowKeyModal: (show: boolean) => void;
  keyCount: number;
  groqKey: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  isSidebarCollapsed,
  setSidebarCollapsed,
  currentTheme,
  language,
  searchQuery,
  setSearchQuery,
  filteredMenuGroups,
  tabs,
  activeTab,
  setActiveTab,
  showThemeMenu,
  setShowThemeMenu,
  THEMES,
  setCurrentTheme,
  toggleLanguage,
  setShowKeyModal,
  keyCount,
  groqKey
}) => {
  const t = TRANSLATIONS[language];

  return (
    <aside 
      className={`flex flex-col shrink-0 transition-all duration-300 z-20 shadow-sm border-e ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}
      style={{ backgroundColor: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)', color: 'var(--sidebar-text)' }}
    >
      {/* Logo Area */}
      <div className={`h-16 flex items-center border-b relative ${isSidebarCollapsed ? 'justify-center px-0' : 'px-6'}`} style={{ borderColor: 'var(--sidebar-border)' }}>
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight" style={{ color: currentTheme === 'light' ? '#334155' : 'white' }}>
          <div className="p-1.5 rounded-sm" style={{ backgroundColor: 'var(--logo-bg)' }}>
            <Hexagon size={20} fill="currentColor" style={{ color: 'var(--logo-text)' }} />
          </div>
          {!isSidebarCollapsed && <span>{t.appTitle}</span>}
        </div>
        
        <button onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} className={`absolute top-1/2 transform -translate-y-1/2 bg-white border border-slate-200 rounded-full p-1 shadow-sm text-slate-500 hover:text-blue-600 z-50 hidden md:flex ${language === 'ar' ? '-left-3' : '-right-3'}`}>
          <ChevronLeft size={14} className={`transition-transform duration-300 ${isSidebarCollapsed ? (language === 'ar' ? 'rotate-0' : 'rotate-180') : (language === 'ar' ? 'rotate-180' : 'rotate-0')}`} />
        </button>
      </div>

      {/* Search Area */}
      {!isSidebarCollapsed && (
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
          <div className="relative">
            <Search size={14} className={`absolute top-1/2 transform -translate-y-1/2 text-slate-400 ${language === 'ar' ? 'right-3' : 'left-3'}`} />
            <input 
              type="text" 
              placeholder={language === 'ar' ? 'بحث...' : 'Search apps...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full py-1.5 text-sm rounded-md border outline-none transition-colors ${language === 'ar' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
              style={{ 
                backgroundColor: 'var(--sidebar-hover)', 
                borderColor: 'var(--sidebar-border)',
                color: 'var(--sidebar-text)'
              }}
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6 custom-scrollbar overflow-x-hidden">
        {filteredMenuGroups.map((group, idx) => (
          <div key={idx}>
            {!isSidebarCollapsed && <h3 className="px-3 text-[10px] font-bold uppercase tracking-wider mb-2 opacity-60 animate-in fade-in duration-300">{group.title}</h3>}
            {isSidebarCollapsed && <div className="h-px bg-slate-200/10 mx-2 mb-2"></div>}
            <div className="space-y-0.5">
              {group.items.map((itemId: number) => {
                const item = tabs.find(t => t.id === itemId);
                if (!item) return null;
                const isActive = activeTab === itemId;
                return (
                  <button
                    key={itemId}
                    onClick={() => setActiveTab(itemId)}
                    title={isSidebarCollapsed ? item.title : ''}
                    className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'} py-2 rounded-sm text-sm font-medium transition-all duration-100 group border border-transparent`}
                    style={{ backgroundColor: isActive ? 'var(--sidebar-active-bg)' : 'transparent', color: isActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)', borderColor: isActive ? 'var(--sidebar-border)' : 'transparent' }}
                    onMouseEnter={(e) => { if(!isActive) e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'; }}
                    onMouseLeave={(e) => { if(!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                      <span style={{ color: isActive ? 'var(--sidebar-icon-active)' : 'var(--sidebar-icon)' }}>{item.icon}</span>
                      {!isSidebarCollapsed && <span>{item.title}</span>}
                    </div>
                    {!isSidebarCollapsed && isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Action (Theme & Config) */}
      <div className="p-4 border-t space-y-3" style={{ backgroundColor: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}>
        
        <div className="relative">
          <button onClick={() => setShowThemeMenu(!showThemeMenu)} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'} py-2 rounded-sm text-xs font-medium border transition-colors hover:bg-slate-50`} style={{ borderColor: 'var(--sidebar-border)', color: 'var(--sidebar-text)' }}>
            <div className="flex items-center gap-2"><Palette size={14} />{!isSidebarCollapsed && <span>{t.theme[currentTheme as keyof typeof t.theme] || THEMES[currentTheme].name}</span>}</div>
            {!isSidebarCollapsed && <ChevronRight size={12} className={`transition-transform ${showThemeMenu ? '-rotate-90' : ''} ${language === 'ar' ? 'rotate-180' : ''}`} />}
          </button>
          {showThemeMenu && (
            <div className="absolute bottom-full start-0 w-full mb-2 bg-white rounded-sm shadow-xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-2 z-50 min-w-[200px]">
              {Object.entries(THEMES).map(([key, theme]: [string, any]) => (
                <button key={key} onClick={() => { setCurrentTheme(key as any); setShowThemeMenu(false); }} className="w-full text-start px-4 py-2 text-xs hover:bg-slate-50 text-slate-700 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border border-slate-300" style={{ backgroundColor: theme.colors['--sidebar-bg'] }}></div>
                  {t.theme[key as keyof typeof t.theme] || theme.name}
                  {currentTheme === key && <Check size={12} className="ms-auto text-green-600"/>}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={toggleLanguage} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'} py-2 rounded-sm text-xs font-medium border transition-colors hover:bg-slate-50`} style={{ borderColor: 'var(--sidebar-border)', color: 'var(--sidebar-text)' }}>
          <div className="flex items-center gap-2"><Languages size={14} />{!isSidebarCollapsed && <span>{language === 'en' ? 'English' : 'العربية'}</span>}</div>
        </button>
        <button onClick={() => setShowKeyModal(true)} className={`flex w-full h-10 ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-center px-4'} items-center gap-1 rounded-sm bg-primary-600 hover:bg-primary-700 text-white text-base font-medium shadow-sm transition-colors`} title="Configure API Keys">
          <Key size={16} />{!isSidebarCollapsed && <span>{t.actions.configureKey}</span>}{(keyCount > 0 || groqKey) && (<div className={`w-2 h-2 bg-green-400 rounded-full border border-primary-600 ${isSidebarCollapsed ? 'absolute top-1 end-1' : 'ms-1'}`}></div>)}
        </button>
        <button onClick={logout} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'} py-2 rounded-sm text-xs font-medium border border-red-200 text-red-600 transition-colors hover:bg-red-50`} title="Logout">
          <div className="flex items-center gap-2"><LogOut size={14} />{!isSidebarCollapsed && <span>Logout</span>}</div>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
