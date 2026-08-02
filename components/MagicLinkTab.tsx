import React, { useState, useEffect } from 'react';
import { Key, Link as LinkIcon, Play, Copy, Check, AlertCircle, FileOutput, Loader2, RotateCcw } from 'lucide-react';

// --- Domain Models / Interfaces (ISP) ---
interface Props {
  addLog: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export interface MagicLinkResult {
  email: string;
  link: string | null;
  error: string | null;
  status: 'pending' | 'success' | 'error';
}

// --- Services (SRP, DIP) ---
/**
 * Abstract service for generating magic links.
 * Implementing DIP by depending on an abstraction.
 */
interface IMagicLinkService {
    generateLink(email: string, token: string, signal?: AbortSignal): Promise<string>;
    extendAccess(email: string, token: string, signal?: AbortSignal): Promise<string>;
}

class RewaaAdminLinkService implements IMagicLinkService {
    async generateLink(email: string, rawToken: string, signal?: AbortSignal): Promise<string> {
        // Clean the token (remove surrounding quotes sometimes added when copying from devtools)
        const token = rawToken.trim().replace(/^"|"$/g, '');
        
        // Normalize Authorization header
        let jwtOnly = token;
        if (jwtOnly.toLowerCase().startsWith('bearer ')) {
            jwtOnly = jwtOnly.substring(7).trim();
        }

        // Pre-flight Client-Side Validation: Ensure it's a valid JWT structure
        if (jwtOnly.split('.').length !== 3) {
            throw new Error("Invalid Token format: JWT string must consist of exactly 3 parts (header, payload, signature). Please check that you copied the entire token without extra characters.");
        }

        const authHeader = `Bearer ${jwtOnly}`;

        const res = await fetch(`https://admin.platform.rewaatech.com/api/nucleus/admin/backlink/${encodeURIComponent(email)}`, {
            method: 'GET',
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json, text/plain, */*'
            },
            signal
        });

        if (!res.ok) {
            let errorText = res.statusText;
            try {
                const errorJson = await res.json();
                if (errorJson.message) errorText = errorJson.message;
            } catch {
                const text = await res.text();
                if (text) errorText = text;
            }
            throw new Error(`Status ${res.status}: ${errorText}`);
        }

        const data = await res.json();
        
        let extractedLink = '';
        if (typeof data === 'string') {
            extractedLink = data;
        } else if (data?.link && typeof data.link === 'string') {
            extractedLink = data.link;
        } else if (data?.url && typeof data.url === 'string') {
            extractedLink = data.url;
        } else {
            extractedLink = JSON.stringify(data);
        }

        return extractedLink;
    }

    async extendAccess(email: string, rawToken: string, signal?: AbortSignal): Promise<string> {
        const token = rawToken.trim().replace(/^"|"$/g, '');
        let jwtOnly = token;
        if (jwtOnly.toLowerCase().startsWith('bearer ')) {
            jwtOnly = jwtOnly.substring(7).trim();
        }

        if (jwtOnly.split('.').length !== 3) {
            throw new Error("Invalid Token format.");
        }

        const authHeader = `Bearer ${jwtOnly}`;

        // Attempting to hit the extend endpoint - typically this might be a POST to backlink/extend or similar.
        // We will try posting to the backdoor or backlink endpoint which usually handles extensions.
        const res = await fetch(`https://admin.platform.rewaatech.com/api/nucleus/admin/backlink/${encodeURIComponent(email)}/extend`, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email }),
            signal
        });

        if (!res.ok) {
            let errorText = res.statusText;
            try {
                const errorJson = await res.json();
                if (errorJson.message) errorText = errorJson.message;
            } catch {
                const text = await res.text();
                if (text) errorText = text;
            }
            throw new Error(`Status ${res.status}: ${errorText}`);
        }

        return "Access extended successfully.";
    }
}

// Service instantiation (can be injected via Context in a larger application for full Dependency Inversion)
const magicLinkService: IMagicLinkService = new RewaaAdminLinkService();

const MagicLinkTab: React.FC<Props> = ({ addLog }) => {
  const [token, setToken] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [results, setResults] = useState<MagicLinkResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const savedToken = localStorage.getItem('rewaa_admin_token');
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  // Cooldown timer logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setToken(val);
    localStorage.setItem('rewaa_admin_token', val);
  };

  const processLinks = async () => {
    if (!token.trim()) {
      addLog('Please enter your Authorization Token.', 'warning');
      return;
    }

    const email = emailInput.trim();
    if (!email) {
      addLog('Please enter an email address.', 'warning');
      return;
    }

    if (cooldown > 0) {
      addLog(`Please wait ${cooldown} seconds before generating another link.`, 'warning');
      return;
    }

    setIsProcessing(true);
    addLog(`Starting to generate magic link for ${email}.`, 'info');

    const newResult: MagicLinkResult = {
      email,
      link: null,
      error: null,
      status: 'pending'
    };

    setResults(prev => [newResult, ...prev]);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout

        // Call the decoupled service logic (SRP)
        const extractedLink = await magicLinkService.generateLink(email, token, controller.signal);

        clearTimeout(timeoutId);

        setResults(prev => {
            const copy = [...prev];
            copy[0] = { ...copy[0], link: extractedLink, status: 'success' };
            return copy;
        });
        addLog(`Successfully generated link for ${email}.`, 'success');
        
        // Start cooldown (DoS protection)
        setCooldown(5); // 5 seconds wait before next allowed

    } catch (err: any) {
        setResults(prev => {
            const copy = [...prev];
            // Format timeout error differently
            const errorMsg = err.name === 'AbortError' ? 'Request timed out after 15 seconds' : err.message;
            copy[0] = { ...copy[0], error: errorMsg, status: 'error' };
            return copy;
        });
        const errorMsgLog = err.name === 'AbortError' ? 'timeout (API did not respond in 15s)' : err.message;
        addLog(`Failed to generate link for ${email}: ${errorMsgLog}`, 'error');
        setCooldown(3); // 3 seconds timeout on error just in case
    }
    
    setIsProcessing(false);
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(index);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReset = () => {
      setEmailInput('');
      setResults([]);
      setCooldown(0);
      addLog('Reset Magic Links generator.', 'info');
  };

  const handleExportCSV = () => {
      if (results.length === 0) return;
      const csvLines = ["Email,Magic Link,Status,Error"];
      results.forEach(r => {
          const row = [
              `"${r.email}"`,
              `"${r.link || ''}"`,
              `"${r.status}"`,
              `"${r.error || ''}"`
          ].join(',');
          csvLines.push(row);
      });

      const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `magic_links_${new Date().getTime()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const isTokenValid = (rawToken: string) => {
      if (!rawToken) return false;
      let jwtOnly = rawToken.trim().replace(/^"|"$/g, '');
      if (jwtOnly.toLowerCase().startsWith('bearer ')) {
          jwtOnly = jwtOnly.substring(7).trim();
      }
      return jwtOnly.split('.').length === 3;
  };

  return (
    <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px]">
        {/* LEFT PANEL - Input parameters */}
        <div className="w-1/3 border-r border-slate-200 p-6 flex flex-col gap-6 bg-slate-50/50 overflow-y-auto">
            <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2">
                    <Key className="text-blue-600" size={20} />
                    Configuration
                </h2>
                <p className="text-xs text-slate-500">Provide your Rewaa Admin token.</p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                        <span>Authorization Token</span>
                        {isTokenValid(token) && (
                            <span className="text-green-600 flex items-center gap-1 text-[10px]">
                                <Check size={12} strokeWidth={3} /> Valid Format
                            </span>
                        )}
                    </label>
                    <input 
                        type="password"
                        placeholder="Bearer eyJhbGciOi..."
                        value={token}
                        onChange={handleTokenChange}
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 ${isTokenValid(token) ? 'border-green-300 focus:border-green-500 focus:ring-green-500 bg-green-50/30' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500'}`}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Saved locally in your browser.</p>
                </div>
            </div>

            <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2 mt-4">
                    <LinkIcon className="text-blue-600" size={20} />
                    Email Setup
                </h2>
                <p className="text-xs text-slate-500">Only one email at a time.</p>
                
                <div className="mt-4">
                     <input
                         type="email"
                         value={emailInput}
                         onChange={(e) => setEmailInput(e.target.value)}
                         placeholder="store@example.com"
                         className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                     />
                </div>
            </div>

             <div className="flex flex-col gap-3 mt-auto">
                 <button
                    onClick={processLinks}
                    disabled={isProcessing || !emailInput.trim() || !token.trim() || cooldown > 0}
                    className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2
                        ${isProcessing || !emailInput.trim() || !token.trim() || cooldown > 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}`}
                >
                    {isProcessing ? <Loader2 className="animate-spin" size={20}/> : <Play size={20}/>}
                    <span>{isProcessing ? 'Generating...' : cooldown > 0 ? `Wait ${cooldown}s` : 'Generate Link'}</span>
                </button>

                <button
                    onClick={async () => {
                        if (!token.trim() || !emailInput.trim() || cooldown > 0) return;
                        setIsProcessing(true);
                        addLog(`Attempting to extend backdoor access for ${emailInput}...`, 'info');
                        try {
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 15000);
                            await magicLinkService.extendAccess(emailInput.trim(), token, controller.signal);
                            clearTimeout(timeoutId);
                            addLog(`Extended backdoor access for ${emailInput}. You can now try generating a link.`, 'success');
                            setCooldown(5);
                        } catch (err: any) {
                            addLog(`Failed to extend access: ${err.message}`, 'error');
                            setCooldown(3);
                        }
                        setIsProcessing(false);
                    }}
                    disabled={isProcessing || !emailInput.trim() || !token.trim() || cooldown > 0}
                    className={`w-full py-3 rounded-xl font-bold text-white shadow-md transition-all transform active:scale-95 flex items-center justify-center gap-2
                        ${isProcessing || !emailInput.trim() || !token.trim() || cooldown > 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600'}`}
                >
                    <RotateCcw size={18} />
                    <span>Extend Backdoor Access</span>
                </button>

                <button
                    onClick={handleReset}
                    disabled={isProcessing}
                    className={`w-full py-3 rounded-xl font-bold border-2 transition-all flex items-center justify-center gap-2 
                        ${isProcessing ? 'border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 active:scale-95'}`}
                >
                    <RotateCcw size={18} />
                    <span>Reset</span>
                </button>
             </div>
        </div>

        {/* RIGHT PANEL - Results */}
         <div className="w-2/3 p-6 flex flex-col">
            <div className="flex justify-between items-end mb-4">
                <div>
                     <h2 className="text-lg font-bold text-slate-800">Generated Links</h2>
                     <p className="text-sm text-slate-500">Results will appear below.</p>
                </div>
                {results.length > 0 && (
                     <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded border border-slate-200 transition-colors">
                        <FileOutput size={16} /> Export CSV
                    </button>
                )}
            </div>

            <div className="flex-1 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                                <th className="p-3 w-12 text-center">#</th>
                                <th className="p-3">Email</th>
                                <th className="p-3">Result</th>
                                <th className="p-3 w-16 text-center">Copy</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {results.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-400">
                                        No links generated yet.
                                    </td>
                                </tr>
                            ) : (
                                results.map((result, i) => (
                                    <tr key={i} className="hover:bg-white transition-colors">
                                        <td className="p-3 text-center text-slate-400">{i + 1}</td>
                                        <td className="p-3 font-medium text-slate-700 truncate max-w-[200px]" title={result.email}>
                                            {result.email}
                                        </td>
                                        <td className="p-3">
                                            {result.status === 'pending' && <span className="text-slate-400 flex items-center gap-1"><Loader2 className="animate-spin" size={14}/> Pending...</span>}
                                            {result.status === 'error' && <span className="text-red-500 flex items-center gap-1 text-xs"><AlertCircle size={14}/> {result.error}</span>}
                                            {result.status === 'success' && (
                                                <a href={result.link!} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate max-w-[300px] block" title={result.link!}>
                                                    {result.link}
                                                </a>
                                            )}
                                        </td>
                                        <td className="p-3 text-center">
                                            {result.status === 'success' && result.link && (
                                                <button
                                                    onClick={() => handleCopy(result.link!, i)}
                                                    className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                                                    title="Copy Link"
                                                >
                                                    {copiedId === i ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
         </div>
    </div>
  );
};

export default MagicLinkTab;
