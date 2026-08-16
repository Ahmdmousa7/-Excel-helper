
import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { FileData, LogEntry } from './types';
import { ApiKeyStatus } from './types/ai.types';
// excelService is imported dynamically in the handlers below (TD-004): it pulls
// xlsx + xlsx-js-style (~515 KB gzipped), and nothing needs them until the user
// actually opens a file.
import { getStoredApiKeys, setStoredApiKeys } from './services/apiKeyStorage';
// verifyGeminiKey / verifyGroqKey are imported dynamically where used (TD-004):
// they live in geminiService, which pulls @google/genai (~52 KB gzipped).
import { TRANSLATIONS, Language } from './utils/translations';
import LogViewer from './components/LogViewer';
import { useVoiceControl } from './hooks/useVoiceControl';

// ... tool imports ...
const HomeTab = lazy(() => import('./components/HomeTab'));
const TranslateTab = lazy(() => import('./components/TranslateTab'));
const CompositeTab = lazy(() => import('./components/CompositeTab'));
const SallaTab = lazy(() => import('./components/SallaTab'));
const ZidTab = lazy(() => import('./components/ZidTab'));
const VariableBalanceTab = lazy(() => import('./components/VariableBalanceTab'));
const MergeImagesTab = lazy(() => import('./components/MergeImagesTab'));
const PdfToolsTab = lazy(() => import('./components/PdfToolsTab'));
const ImageToPdfTab = lazy(() => import('./components/ImageToPdfTab'));
const ImageCompressorTab = lazy(() => import('./components/ImageCompressorTab'));
const QrCodeTab = lazy(() => import('./components/QrCodeTab'));
const PacksTab = lazy(() => import('./components/PacksTab'));
const WebScraperTab = lazy(() => import('./components/WebScraperTab'));
const OcrTab = lazy(() => import('./components/OcrTab'));
const GoogleSheetsTab = lazy(() => import('./components/GoogleSheetsTab'));
const FileValidationTab = lazy(() => import('./components/FileValidationTab'));
const VariableBalanceTabV2 = lazy(() => import('./components/VariableBalanceTabV2'));
const UnpivotTab = lazy(() => import('./components/UnpivotTab'));
const SmartLookupTab = lazy(() => import('./components/SmartLookupTab'));
const ProjectSummaryTab = lazy(() => import('./components/ProjectSummaryTab'));

const CleanTool = lazy(() => import('./components/CleanTool').then(m => ({ default: m.CleanTool })));
const CompareTool = lazy(() => import('./components/CompareTool').then(m => ({ default: m.CompareTool })));
const DeduplicateTool = lazy(() => import('./components/DeduplicateTool').then(m => ({ default: m.DeduplicateTool })));
const MergeTool = lazy(() => import('./components/MergeTool').then(m => ({ default: m.MergeTool })));
const SplitterTool = lazy(() => import('./components/SplitterTool').then(m => ({ default: m.SplitterTool })));


const SupportChat = lazy(() => import('./components/SupportChat'));
import ApiKeyModal from './components/ApiKeyModal';
import Sidebar from './components/Sidebar';
import AppHeader from './components/AppHeader';
import FileUploaderBase from './components/FileUploaderBase';
import ModuleOverview from './components/ModuleOverview';
import LogsFooter from './components/LogsFooter';
import { 
  FileSpreadsheet, Layers, ShoppingCart, X, Check, ShieldPlus,
  Image as ImageIcon, Scissors, FileImage, Zap, QrCode, FileText, RefreshCw, AlertTriangle, 
  Package, Globe, ScanText, ChevronRight, Hexagon, Palette, ChevronLeft, Info, HelpCircle, RotateCcw,
  Languages, PanelBottomOpen, PanelBottomClose, Terminal, Store, Network, Link as LinkIcon, ArrowRight, UserPlus, Home, Mic, MicOff, ShieldCheck, ArrowDownRight, Search, Bot, Building2, Lightbulb,
  Eraser, GitCompare, Filter, Combine, SplitSquareHorizontal, Loader2
} from 'lucide-react';

declare let google: any;

// --- THEME DEFINITIONS ---
const THEMES = {
  light: {
    name: 'Modern Light',
    colors: {
      '--sidebar-bg': '#ffffff',
      '--sidebar-border': '#e2e8f0',
      '--sidebar-text': '#475569',
      '--sidebar-hover': '#f1f5f9',
      '--sidebar-active-bg': '#eff6ff',
      '--sidebar-active-text': '#2563eb', 
      '--sidebar-icon': '#94a3b8',
      '--sidebar-icon-active': '#2563eb',
      '--logo-bg': '#2563eb',
      '--logo-text': '#ffffff',
    }
  },
  dark: {
    name: 'Midnight',
    colors: {
      '--sidebar-bg': '#0f172a',
      '--sidebar-border': '#1e293b',
      '--sidebar-text': '#94a3b8',
      '--sidebar-hover': '#1e293b',
      '--sidebar-active-bg': '#2563eb',
      '--sidebar-active-text': '#ffffff',
      '--sidebar-icon': '#64748b',
      '--sidebar-icon-active': '#ffffff',
      '--logo-bg': '#3b82f6',
      '--logo-text': '#ffffff',
    }
  },
  forest: {
    name: 'Forest Pro',
    colors: {
      '--sidebar-bg': '#064e3b',
      '--sidebar-border': '#065f46',
      '--sidebar-text': '#a7f3d0',
      '--sidebar-hover': '#065f46',
      '--sidebar-active-bg': '#10b981',
      '--sidebar-active-text': '#ffffff',
      '--sidebar-icon': '#6ee7b7',
      '--sidebar-icon-active': '#ffffff',
      '--logo-bg': '#34d399',
      '--logo-text': '#064e3b',
    }
  }
};

type ThemeKey = keyof typeof THEMES;

const DEFAULT_GOOGLE_CLIENT_ID = "204867991878-fuucosuoei7mpqhp8m4qre8n9ej3vj7n.apps.googleusercontent.com";

/**
 * Shown while a tab's chunk downloads (TD-004).
 *
 * Deliberately matches the height and centring of a loaded tool so switching
 * tabs does not collapse the layout and then jolt it back — a spinner that
 * changes the page height reads as a bug even when it is working correctly.
 */
const TabLoadingFallback: React.FC = () => (
  <div
    className="flex flex-col items-center justify-center py-24 text-slate-400"
    role="status"
    aria-live="polite"
  >
    <Loader2 className="animate-spin mb-3" size={32} aria-hidden="true" />
    <span className="text-sm font-medium">Loading tool…</span>
  </div>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(-1); // Default to Home (-1)
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Off-canvas nav, below `md` only (TD-005). Deliberately separate from
  // isSidebarCollapsed, which is the desktop icon-rail toggle.
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Theme & Language State
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>('light');
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [language, setLanguage] = useState<Language>('en');

  // API Key State
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [googleClientId, setGoogleClientId] = useState(() => {
      if (typeof window !== 'undefined') {
          return localStorage.getItem('google_client_id') || DEFAULT_GOOGLE_CLIENT_ID;
      }
      return DEFAULT_GOOGLE_CLIENT_ID;
  });
  const [keySaved, setKeySaved] = useState(false);

  // Google Sheets Import State
  const [gsheetUrl, setGsheetUrl] = useState('');
  const [isImportingGSheet, setIsImportingGSheet] = useState(false);

  // Recent Files
  const [recentFiles, setRecentFiles] = useState<{name: string, date: string, type: 'local'|'gsheet', url?: string}[]>([]);

  // Test State
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState<ApiKeyStatus>('idle');
  const [testingGroq, setTestingGroq] = useState(false);
  const [groqStatus, setGroqStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  const [resetKey, setResetKey] = useState(0);

  const keyCount = geminiKey.split(/[\n,]+/).filter(k => k.trim().length > 0).length;
  const t = TRANSLATIONS[language]; 

  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. Load Keys
    const stored = getStoredApiKeys();
    if (stored.gemini) {
      setGeminiKey(stored.gemini);
      setGroqKey(stored.groq);
    }
    
    if (!localStorage.getItem('google_client_id')) {
        localStorage.setItem('google_client_id', DEFAULT_GOOGLE_CLIENT_ID);
        setGoogleClientId(DEFAULT_GOOGLE_CLIENT_ID);
    }

    if (!stored.gemini) {
      setShowKeyModal(true);
    }

    // 2. Load UI Prefs
    const savedTheme = localStorage.getItem('app_theme') as ThemeKey;
    if (savedTheme && THEMES[savedTheme]) {
      setCurrentTheme(savedTheme);
    }
    const savedLang = localStorage.getItem('app_lang') as Language;
    if (savedLang) setLanguage(savedLang);

    // 3. Load Recent Files
    const storedRecents = localStorage.getItem('recent_files');
    if (storedRecents) {
       try { setRecentFiles(JSON.parse(storedRecents)); } catch(e){}
    }
  }, []);

  // --- THEME APPLICATOR ---
  useEffect(() => {
    const root = document.documentElement;
    const colors = THEMES[currentTheme].colors;
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(key, String(value));
    });
    localStorage.setItem('app_theme', currentTheme);
    root.dir = language === 'ar' ? 'rtl' : 'ltr';
    root.lang = language;
    localStorage.setItem('app_lang', language);
  }, [currentTheme, language]);

  // --- VOICE CONTROL ---
  const handleVoiceCommand = (cmd: string, transcript: string) => {
     addLog(`Voice: "${transcript}" -> Command: ${cmd}`, 'info');
     
     if (cmd === 'home') setActiveTab(-1);
     else if (cmd === 'translator') setActiveTab(0);
     else if (cmd === 'salla') setActiveTab(5);
     else if (cmd === 'zid') setActiveTab(13);
     else if (cmd === 'reset') handleReset();
     else if (cmd === 'toggle_logs') setShowLogs(prev => !prev);
     else if (cmd === 'start') {
        // Trigger Primary Button in active tab
        const primaryBtn = document.querySelector('button[data-action="primary"]') as HTMLButtonElement;
        if (primaryBtn) {
           primaryBtn.click();
           addLog("Voice Command: Starting process...", 'success');
        } else {
           addLog("Voice Command: No start button found in this tab.", 'warning');
        }
     }
  };

  const { isListening, toggleListening, isSupported } = useVoiceControl({ onCommand: handleVoiceCommand });

  // --- APP LOGIC ---

  const addToRecentFiles = (name: string, type: 'local'|'gsheet', url?: string) => {
     const newEntry = {
        name,
        type,
        url,
        date: new Date().toLocaleDateString()
     };
     const updated = [newEntry, ...recentFiles.filter(f => f.name !== name || f.type !== type)].slice(0, 5);
     setRecentFiles(updated);
     localStorage.setItem('recent_files', JSON.stringify(updated));
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'ar' : 'en');
  };

  const handleTestGemini = async () => {
    if (!geminiKey) return;
    setTestingGemini(true);
    setGeminiStatus('idle');
    const result = await (await import('./services/geminiService')).verifyGeminiKey(geminiKey);
    setTestingGemini(false);
    setGeminiStatus(result);
  };

  const handleTestGroq = async () => {
    if (!groqKey) return;
    setTestingGroq(true);
    setGroqStatus('idle');
    const isValid = await (await import('./services/geminiService')).verifyGroqKey(groqKey);
    setTestingGroq(false);
    setGroqStatus(isValid ? 'valid' : 'invalid');
  };

  const handleSaveKey = () => {
    setStoredApiKeys(geminiKey, groqKey);
    localStorage.setItem('google_client_id', googleClientId);
    
    setKeySaved(true);
    setTimeout(() => {
      setKeySaved(false);
      setShowKeyModal(false);
    }, 1000);
    
    const msg = t.actions.saved;
    addLog(msg, 'success');
  };

  const logQueueRef = useRef<LogEntry[]>([]);
  const logTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    logQueueRef.current.push({ timestamp, message, type });
    
    if (!logTimeoutRef.current) {
      logTimeoutRef.current = setTimeout(() => {
        const logsToAdd = [...logQueueRef.current];
        logQueueRef.current = [];
        logTimeoutRef.current = null;
        setLogs(prev => {
            // Keep maximum of 500 logs to prevent memory leaks and UI freezing
            const newLogs = [...prev, ...logsToAdd];
            if (newLogs.length > 500) {
                return newLogs.slice(newLogs.length - 500);
            }
            return newLogs;
        });
      }, 250); 
    }
  };

  const handleReset = () => {
    setFileData(null);
    setGsheetUrl('');
    setLogs([]);
    setResetKey(prev => prev + 1); 
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      addLog(`${t.actions.uploadFile}: ${file.name}...`, 'info');
      const { readExcelFile } = await import('./services/excelService');
      const data = await readExcelFile(file);
      setFileData(data);
      addToRecentFiles(file.name, 'local');
      addLog(`${t.system.fileLoaded}. ${t.system.sheets}: ${data.sheets.join(', ')}`, 'success');
    } catch (error: any) {
      addLog(`Error loading file: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const handleGSheetLoad = async (url: string) => {
      setGsheetUrl(url);
      handleGSheetImport(url);
  };

  const handleGSheetImport = async (targetUrl?: string) => {
    const finalUrl = targetUrl || gsheetUrl;
    if (!finalUrl.trim()) return;
    
    setIsImportingGSheet(true);
    addLog(`Fetching Google Sheet...`, 'info');
    try {
        const { fetchGoogleSheet } = await import('./services/excelService');
        const data = await fetchGoogleSheet(finalUrl);
        setFileData(data);
        addToRecentFiles(data.name, 'gsheet', finalUrl);
        setGsheetUrl(''); 
        addLog(`${t.system.fileLoaded}: ${data.name}`, 'success');
    } catch (error: any) {
        addLog(`Import Error: ${error.message}`, 'error');
    } finally {
        setIsImportingGSheet(false);
    }
  };

  const tabs = [
    { id: -1, title: t.tabs.home, icon: <Home size={18} />, description: t.toolInfo.home.desc, instructions: t.toolInfo.home.instr, component: <HomeTab onNavigate={setActiveTab} recentFiles={recentFiles} onLoadGSheet={handleGSheetLoad} fileData={fileData} /> },
    { id: 23, title: t.tabs.smartLookup, icon: <Search size={18} />, description: t.toolInfo.smartLookup.desc, instructions: t.toolInfo.smartLookup.instr, component: <SmartLookupTab fileData={fileData} addLog={addLog} onReset={handleReset} /> },
    { id: 0, title: t.tabs.translator, icon: <Layers size={18} />, description: t.toolInfo.translator.desc, instructions: t.toolInfo.translator.instr, component: <TranslateTab fileData={fileData} addLog={addLog} keyCount={keyCount} onReset={handleReset} googleClientId={googleClientId} /> },
    { id: 16, title: t.tabs.fileValidation, icon: <ShieldCheck size={18} />, description: t.toolInfo.fileValidation.desc, instructions: t.toolInfo.fileValidation.instr, component: <FileValidationTab fileData={fileData} addLog={addLog} onReset={handleReset} /> }, 
    { id: 2, title: t.tabs.packs, icon: <Package size={18} />, description: t.toolInfo.packs.desc, instructions: t.toolInfo.packs.instr, component: <PacksTab fileData={fileData} addLog={addLog} onReset={handleReset} /> },
    { id: 14, title: t.tabs.balance, icon: <Network size={18} />, description: t.toolInfo.balance.desc, instructions: t.toolInfo.balance.instr, component: <VariableBalanceTab fileData={fileData} addLog={addLog} onReset={handleReset} /> },
    { id: 22, title: t.tabs.unpivot, icon: <ArrowDownRight size={18} />, description: t.toolInfo.unpivot.desc, instructions: t.toolInfo.unpivot.instr, component: <UnpivotTab fileData={fileData} addLog={addLog} onReset={handleReset} /> },
    { id: 5, title: t.tabs.salla, icon: <ShoppingCart size={18} />, description: t.toolInfo.salla.desc, instructions: t.toolInfo.salla.instr, component: <SallaTab fileData={fileData} addLog={addLog} onReset={handleReset} /> },
    { id: 13, title: t.tabs.zid, icon: <Store size={18} />, description: t.toolInfo.zid.desc, instructions: t.toolInfo.zid.instr, component: <ZidTab fileData={fileData} addLog={addLog} onReset={handleReset} /> },
    { id: 4, title: t.tabs.composite, icon: <FileSpreadsheet size={18} />, description: t.toolInfo.composite.desc, instructions: t.toolInfo.composite.instr, component: <CompositeTab fileData={fileData} addLog={addLog} onReset={handleReset} /> },
    { id: 12, title: t.tabs.ocr, icon: <ScanText size={18} />, description: t.toolInfo.ocr.desc, instructions: t.toolInfo.ocr.instr, component: <OcrTab addLog={addLog} onReset={handleReset} /> },
    { id: 3, title: t.tabs.scraper, icon: <Globe size={18} />, description: t.toolInfo.scraper.desc, instructions: t.toolInfo.scraper.instr, component: <WebScraperTab addLog={addLog} onReset={handleReset} /> },
    { id: 7, title: t.tabs.pdfTools, icon: <Scissors size={18} />, description: t.toolInfo.pdfTools.desc, instructions: t.toolInfo.pdfTools.instr, component: <PdfToolsTab addLog={addLog} onReset={handleReset} /> },
    { id: 8, title: t.tabs.imgPdf, icon: <FileImage size={18} />, description: t.toolInfo.imgPdf.desc, instructions: t.toolInfo.imgPdf.instr, component: <ImageToPdfTab addLog={addLog} onReset={handleReset} /> },
    { id: 6, title: t.tabs.mergeImg, icon: <ImageIcon size={18} />, description: t.toolInfo.mergeImg.desc, instructions: t.toolInfo.mergeImg.instr, component: <MergeImagesTab addLog={addLog} onReset={handleReset} /> },
    { id: 9, title: t.tabs.compressor, icon: <Zap size={18} />, description: t.toolInfo.compressor.desc, instructions: t.toolInfo.compressor.instr, component: <ImageCompressorTab addLog={addLog} onReset={handleReset} /> },
    { id: 10, title: t.tabs.qr, icon: <QrCode size={18} />, description: t.toolInfo.qr.desc, instructions: t.toolInfo.qr.instr, component: <QrCodeTab addLog={addLog} onReset={handleReset} /> },
    { id: 19, title: t.tabs.gsheets, icon: <LinkIcon size={18} />, description: t.toolInfo.gsheets.desc, instructions: t.toolInfo.gsheets.instr, component: <GoogleSheetsTab addLog={addLog} onFileDataLoaded={(d) => { setFileData(d); addLog('Imported from Google Sheets', 'success'); }} /> },
    { id: 26, title: t.tabs.projectSummary, icon: <FileText size={18} />, description: t.toolInfo.projectSummary.desc, instructions: t.toolInfo.projectSummary.instr, component: <ProjectSummaryTab language={language} /> },
    { id: 30, title: "Remove Blanks", icon: <Eraser size={18} />, description: "Clean empty columns from dataset", instructions: "Select a start row to drop empty columns.", component: <CleanTool fileData={fileData} addLog={addLog} /> },
    { id: 31, title: "Compare Files", icon: <GitCompare size={18} />, description: "Find matches and differences", instructions: "Map columns to compare two sheets.", component: <CompareTool fileData={fileData} addLog={addLog} geminiKey={geminiKey} language={language} /> },
    { id: 32, title: "Deduplicator (Pro)", icon: <Filter size={18} />, description: "Advanced duplicate removal", instructions: "Hash datasets to remove duplicates.", component: <DeduplicateTool fileData={fileData} addLog={addLog} /> },
    { id: 33, title: "Merge Datasets", icon: <Combine size={18} />, description: "Append or Join two sheets", instructions: "Select join algorithm.", component: <MergeTool fileData={fileData} addLog={addLog} /> },
    { id: 34, title: "Separator", icon: <SplitSquareHorizontal size={18} />, description: "Split rows or extract sheets", instructions: "Choose split mode and chunk size.", component: <SplitterTool fileData={fileData} addLog={addLog} /> },
  ];

  const menuGroups = [
    { title: 'Dashboard', items: [-1] },
    { title: 'New Solid Data Tools', items: [30, 31, 32, 33, 34] },
    { title: t.menu.excelTools, items: [23, 16, 0, 1, 22, 2, 14, 5, 13, 4, 11] },
    { title: t.menu.aiTools, items: [12, 3] }, 
    { title: t.menu.mediaTools, items: [7, 8, 6, 9] },
    { title: t.menu.utils, items: [26, 27, 10, 19] }
  ];

  const filteredMenuGroups = useMemo(() => {
    if (!searchQuery.trim()) return menuGroups;
    const query = searchQuery.toLowerCase();
    return menuGroups.map(group => {
      const filteredItems = group.items.filter(itemId => {
        if (itemId === -1) return 'dashboard'.includes(query) || 'home'.includes(query);
        const item = tabs.find(t => t.id === itemId);
        if (!item) return false;
        return item.title.toLowerCase().includes(query) || item.description.toLowerCase().includes(query);
      });
      return { ...group, items: filteredItems };
    }).filter(group => group.items.length > 0);
  }, [searchQuery, language]); // Re-run when search or language changes

  const activeTabObj = tabs.find(t => t.id === activeTab);
  const isExcelTool = [0, 1, 2, 4, 5, 11, 13, 14, 16, 22, 23, 30, 31, 32, 33, 34].includes(activeTab);

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* ... Sidebar and Header (unchanged) ... */}
      {/* Sidebar */}
      <Sidebar 
        isSidebarCollapsed={isSidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        currentTheme={currentTheme}
        language={language}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filteredMenuGroups={filteredMenuGroups}
        tabs={tabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        showThemeMenu={showThemeMenu}
        setShowThemeMenu={setShowThemeMenu}
        THEMES={THEMES}
        setCurrentTheme={setCurrentTheme}
        toggleLanguage={toggleLanguage}
        setShowKeyModal={setShowKeyModal}
        keyCount={keyCount}
        groqKey={groqKey}
        isMobileNavOpen={isMobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
         {/* Header */}
         <AppHeader 
           language={language}
           activeTabObj={activeTabObj}
           activeTab={activeTab}
           isSupported={isSupported}
           isListening={isListening}
           toggleListening={toggleListening}
           fileData={fileData}
           isExcelTool={isExcelTool}
           handleReset={handleReset}
           showLogs={showLogs}
           setShowLogs={setShowLogs}
           onOpenMobileNav={() => setMobileNavOpen(true)}
           isMobileNavOpen={isMobileNavOpen}
         />

         {/* Main */}
         <main className="flex-1 overflow-y-auto p-6 relative scroll-smooth bg-slate-50/50">
            <div className="max-w-7xl mx-auto space-y-6">
               
               {activeTab !== -1 && activeTabObj && (
                  <ModuleOverview activeTabObj={activeTabObj} />
               )}

               {isExcelTool && activeTab !== -1 && (
                  <FileUploaderBase 
                    language={language}
                    fileData={fileData}
                    resetKey={resetKey}
                    handleFileUpload={handleFileUpload}
                    gsheetUrl={gsheetUrl}
                    setGsheetUrl={setGsheetUrl}
                    handleGSheetImport={handleGSheetImport}
                    isImportingGSheet={isImportingGSheet}
                    handleReset={handleReset}
                  />
               )}
               
               <input key={`home-upload-${resetKey}`} type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" id="home-upload-trigger" />

               <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Each tab is a lazy chunk (TD-004). Suspense keys on the
                      active tab so switching tools shows the fallback rather
                      than holding the previous tool on screen while the next
                      chunk downloads. */}
                  <Suspense key={activeTab} fallback={<TabLoadingFallback />}>
                    {activeTabObj?.component && React.cloneElement(activeTabObj.component as React.ReactElement<any>, { key: resetKey, language })}
                  </Suspense>
               </div>
            </div>
         </main>

         {/* Logs Footer */}
         <LogsFooter 
           showLogs={showLogs}
           logs={logs}
           setLogs={setLogs}
           t={t}
         />
      </div>

      {/* API Key Modal */}
      {showKeyModal && (
        <ApiKeyModal 
          language={language}
          onClose={() => setShowKeyModal(false)}
          geminiKey={geminiKey}
          setGeminiKey={setGeminiKey}
          geminiStatus={geminiStatus}
          setGeminiStatus={setGeminiStatus}
          testingGemini={testingGemini}
          handleTestGemini={handleTestGemini}
          googleClientId={googleClientId}
          setGoogleClientId={setGoogleClientId}
          groqKey={groqKey}
          setGroqKey={setGroqKey}
          groqStatus={groqStatus}
          setGroqStatus={setGroqStatus}
          testingGroq={testingGroq}
          handleTestGroq={handleTestGroq}
          handleSaveKey={handleSaveKey}
          keySaved={keySaved}
        />
      )}

      {/* Floating Support Chat Widget. Lazy (TD-004) — it imports xlsx, and a
          chat bubble should not be on the first-paint critical path. No visible
          fallback: the widget appearing a moment late is correct behaviour,
          whereas a spinner floating over the corner of the app is not. */}
      <Suspense fallback={null}>
        <SupportChat language={language} fileData={fileData} />
      </Suspense>
    </div>
  );
};

export default App;
