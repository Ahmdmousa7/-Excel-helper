import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, ClipboardList, RefreshCw, Plus, Trash2, Settings2, GripVertical, ArrowUp, ArrowDown, Download, ChevronDown, FileSpreadsheet, FileText, FileJson, Upload, Save } from 'lucide-react';
import { TRANSLATIONS, Language } from '../utils/translations';
// FieldDef/FieldCondition and their validators live in utils/ so the shape rules
// can be unit-tested — the template in localStorage is this tab's only untrusted
// input, and since ADR-0005 it is also its only copy.
import { FieldCondition, FieldDef, isFieldDefArray } from '../utils/projectSummarySchema';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  language?: Language;
}

const INITIAL_FIELDS: FieldDef[] = [
  { id: 'accountName', label: 'Account Name', options: [] },
  { id: 'accountLink', label: 'Account Link', options: [] },
  { id: 'magicLink', label: 'Magic Link Account', options: [] },
  { id: 'numProducts', label: 'Number of Products', options: [] },
  { id: 'variableProducts', label: 'Variable Product Items', options: [] },
  { id: 'simpleProducts', label: 'Simple Product Items', options: [] },
  { id: 'addedSku', label: 'Products with duplicated/missing SKU (Added)', options: ['Yes', 'No', 'N/A', 'Resolved'] },
  { id: 'ignoredSku', label: 'Products with duplicated/missing SKU (Not Added)', options: ['Yes', 'No', 'N/A', 'Ignored'] },
  { id: 'negativeQty', label: 'Products with negative Quantity (Set to 0)', options: ['Yes', 'No', 'N/A', 'Fixed'] },
  { id: 'integration', label: 'Integration with Zid/Salla', options: ['Zid', 'Salla', 'Shopify', 'WooCommerce', 'None'] },
  { id: 'stockManagement', label: 'Enable Stock Management', options: ['Yes', 'No'] },
  { id: 'costPrice', label: 'Cost Price', options: ['Included', 'Not Included', 'Provided by Client', 'N/A'] },
  { id: 'retailPrice', label: 'Retail Price', options: ['Included', 'Not Included', 'Provided by Client', 'N/A'] },
  { id: 'translation', label: 'Translation', options: ['Done', 'Not Required', 'Partial', 'Pending'] },
  { id: 'branches', label: 'Branches', options: ['Main Branch Only', 'Multiple Branches', 'N/A'] },
  { id: 'note', label: 'Note', options: [], isMultiline: true },
];

const ProjectSummaryTab: React.FC<Props> = ({ language = 'en' }) => {
  const t = TRANSLATIONS[language];
  
  const [fields, setFields] = useState<FieldDef[]>(INITIAL_FIELDS);
  const [savedFields, setSavedFields] = useState<FieldDef[]>(INITIAL_FIELDS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // The template lives in localStorage only.
  //
  // This used to read a `preferences` blob from `users/{uid}` in Firestore after
  // loading the local copy, so a template followed you between devices. ADR-0005
  // removed Firebase; that cross-device sync is gone, and localStorage is
  // per-browser and per-origin. Clearing site data now loses the template.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('projectSummaryFields');
      if (saved) {
        // Shape-checked, not just parsed. `JSON.parse` returns `any`, and handing
        // that straight to `FieldDef[]` state threw on the first `fields.map()`
        // in render — OUTSIDE this try, so the catch never saw it.
        const parsed: unknown = JSON.parse(saved);

        if (isFieldDefArray(parsed)) {
          setFields(parsed);
          setSavedFields(parsed);
        } else {
          console.error('Ignoring saved project-summary template: not a FieldDef[]');
        }
      }
    } catch (e) {
      console.error('Failed to parse saved fields', e);
    }
    setIsLoaded(true);
  }, []);

  const handleSaveTemplate = () => {
    localStorage.setItem('projectSummaryFields', JSON.stringify(fields));
    setSavedFields(fields);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const [values, setValues] = useState<Record<string, { drop: string, text: string }>>({});
  const [copied, setCopied] = useState(false);
  const [autoCopy, setAutoCopy] = useState(false);
  const [editingOptionsId, setEditingOptionsId] = useState<string | null>(null);
  const [optionsInput, setOptionsInput] = useState<string>('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-copy effect
  useEffect(() => {
    if (autoCopy && isLoaded) {
      const text = generateSummary();
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }, [values, autoCopy, isLoaded]);

  const handleDropChange = (id: string, val: string) => {
    setValues(prev => ({
      ...prev,
      [id]: { ...prev[id], drop: val, text: prev[id]?.text || '' }
    }));
  };

  const handleTextChange = (id: string, val: string) => {
    setValues(prev => ({
      ...prev,
      [id]: { drop: prev[id]?.drop || '', text: val }
    }));
  };

  const updateFieldLabel = (id: string, newLabel: string) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, label: newLabel } : f));
  };

  const removeField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    setValues(prev => {
      const newVals = { ...prev };
      delete newVals[id];
      return newVals;
    });
  };

  const addField = () => {
    const newId = `custom_${Date.now()}`;
    setFields(prev => [...prev, { id: newId, label: 'New Custom Field', options: [] }]);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    setFields(prev => {
      const newFields = [...prev];
      if (direction === 'up' && index > 0) {
        [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
      } else if (direction === 'down' && index < newFields.length - 1) {
        [newFields[index + 1], newFields[index]] = [newFields[index], newFields[index + 1]];
      }
      return newFields;
    });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    setFields(prev => {
      const oldIndex = prev.findIndex(f => f.id === draggedId);
      const newIndex = prev.findIndex(f => f.id === targetId);
      if (oldIndex === -1 || newIndex === -1) return prev;

      const newFields = [...prev];
      const [moved] = newFields.splice(oldIndex, 1);
      newFields.splice(newIndex, 0, moved);
      return newFields;
    });
    setDraggedId(null);
  };

  const toggleEditOptions = (f: FieldDef) => {
    if (editingOptionsId === f.id) {
      setEditingOptionsId(null);
    } else {
      setEditingOptionsId(f.id);
      setOptionsInput(f.options.join(', '));
    }
  };

  const handleOptionsInputChange = (id: string, val: string) => {
    setOptionsInput(val);
    const newOptions = val.split(',').map(s => s.trim()).filter(s => s.length > 0);
    setFields(prev => prev.map(f => f.id === id ? { ...f, options: newOptions } : f));
  };

  const addCondition = (id: string) => {
    setFields(prev => prev.map(f => {
      if (f.id === id) {
        const conds = f.conditions || (f.condition ? [f.condition] : []);
        return { ...f, conditions: [...conds, { fieldId: '', value: '' }] };
      }
      return f;
    }));
  };

  const removeCondition = (id: string, index: number) => {
    setFields(prev => prev.map(f => {
      if (f.id === id) {
        const conds = f.conditions || (f.condition ? [f.condition] : []);
        const newConds = [...conds];
        newConds.splice(index, 1);
        return { ...f, conditions: newConds };
      }
      return f;
    }));
  };

  const updateConditionField = (id: string, index: number, dependsOnId: string) => {
    setFields(prev => prev.map(f => {
      if (f.id === id) {
        const conds = f.conditions || (f.condition ? [f.condition] : []);
        const newConds = [...conds];
        if (newConds[index]) {
          newConds[index] = { ...newConds[index], fieldId: dependsOnId };
        }
        return { ...f, conditions: newConds };
      }
      return f;
    }));
  };

  const updateConditionValue = (id: string, index: number, value: string | string[]) => {
    setFields(prev => prev.map(f => {
      if (f.id === id) {
        const conds = f.conditions || (f.condition ? [f.condition] : []);
        const newConds = [...conds];
        if (newConds[index]) {
          newConds[index] = { ...newConds[index], value };
        }
        return { ...f, conditions: newConds };
      }
      return f;
    }));
  };

  const isFieldVisible = (f: FieldDef) => {
    const conds = f.conditions || (f.condition ? [f.condition] : []);
    if (conds.length === 0) return true;

    return conds.every(cond => {
      if (!cond.fieldId) return true;
      const dependentValue = values[cond.fieldId]?.drop || values[cond.fieldId]?.text || '';
      
      if (Array.isArray(cond.value)) {
        if (cond.value.length === 0) return false;
        return cond.value.some(v => v.toLowerCase() === dependentValue.toLowerCase());
      }
      
      return dependentValue.toLowerCase() === (cond.value || '').toLowerCase();
    });
  };

  const generateSummary = () => {
    let summary = "📋 Project Summary\n===================\n\n";
    fields.filter(isFieldVisible).forEach(f => {
      const drop = values[f.id]?.drop || '';
      const text = values[f.id]?.text || '';
      
      let combined = '';
      if (drop && text) {
        combined = `${drop} - ${text}`;
      } else if (drop) {
        combined = drop;
      } else if (text) {
        combined = text;
      } else {
        combined = '';
      }
      
      summary += `${f.label}: ${combined}\n`;
    });
    return summary;
  };

  const handleCopy = () => {
    const text = generateSummary();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setValues({});
  };

  const handleResetTemplate = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    setFields(savedFields);
    setValues({});
    setShowResetConfirm(false);
  };

  const confirmFactoryReset = () => {
    setFields(INITIAL_FIELDS);
    setValues({});
    setShowResetConfirm(false);
  };

  const getExportData = () => {
    const headers = ['Field Label', 'Field ID', 'Options', 'Conditions'];
    const rows = fields.map(f => {
      const optionsStr = f.options.join('; ');
      
      const conds = f.conditions || (f.condition ? [f.condition] : []);
      const conditionsStr = conds.map(c => {
        if (!c.fieldId) return '';
        const depField = fields.find(other => other.id === c.fieldId);
        const depName = depField ? depField.label : c.fieldId;
        const vals = Array.isArray(c.value) ? c.value.join(' OR ') : c.value;
        return `If [${depName}] is (${vals})`;
      }).filter(Boolean).join(' AND ');

      return [f.label, f.id, optionsStr, conditionsStr || 'Always Show'];
    });
    return { headers, rows };
  };

  const exportToCSV = () => {
    const { headers, rows } = getExportData();
    const escapeCSV = (str: string) => `"${str.replace(/"/g, '""')}"`;
    const csvContent = [
      headers.join(','), 
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'project_summary_flow.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const exportToXLSX = () => {
    const { headers, rows } = getExportData();
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Flow");
    XLSX.writeFile(workbook, "project_summary_flow.xlsx");
    setShowExportMenu(false);
  };

  const exportToPDF = () => {
    const { headers, rows } = getExportData();
    const doc = new jsPDF();
    doc.text("Project Summary Flow", 14, 15);
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] }
    });
    doc.save('project_summary_flow.pdf');
    setShowExportMenu(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        if (jsonData.length < 2) {
          alert('File appears to be empty or missing data rows.');
          return;
        }

        const headers = (jsonData[0] as string[]).map(h => String(h).toLowerCase());
        const labelIdx = headers.findIndex(h => h.includes('label'));
        const idIdx = headers.findIndex(h => h.includes('id'));
        const optionsIdx = headers.findIndex(h => h.includes('options'));
        const condIdx = headers.findIndex(h => h.includes('conditions'));

        if (labelIdx === -1) {
          alert('Invalid file format. Missing "Field Label" column.');
          return;
        }

        const newFields: FieldDef[] = [];
        const rawConds: string[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0 || !row[labelIdx]) continue;

          const label = String(row[labelIdx]);
          const id = (idIdx !== -1 && row[idIdx]) ? String(row[idIdx]) : `custom_${Date.now()}_${i}`;
          const optionsStr = (optionsIdx !== -1 && row[optionsIdx]) ? String(row[optionsIdx]) : '';
          const options = optionsStr ? optionsStr.split(';').map(s => s.trim()).filter(Boolean) : [];
          const condStr = (condIdx !== -1 && row[condIdx]) ? String(row[condIdx]) : '';

          newFields.push({
            id,
            label,
            options,
            isMultiline: label.toLowerCase().includes('note')
          });
          rawConds.push(condStr);
        }

        // Parse conditions
        newFields.forEach((f, idx) => {
          const condStr = rawConds[idx];
          if (condStr && condStr !== 'Always Show') {
            const parts = condStr.split(' AND ');
            const conditions: FieldCondition[] = [];
            for (const part of parts) {
              const match = part.match(/If \[(.*?)\] is \((.*?)\)/);
              if (match) {
                const depNameOrId = match[1];
                const valsStr = match[2];
                const depField = newFields.find(nf => nf.id === depNameOrId || nf.label === depNameOrId);
                if (depField) {
                  const vals = valsStr.split(' OR ').map(v => v.trim());
                  conditions.push({ fieldId: depField.id, value: vals });
                }
              }
            }
            if (conditions.length > 0) {
              f.conditions = conditions;
            }
          }
        });

        setFields(newFields);
        setValues({});
      } catch (error) {
        console.error("Error parsing file:", error);
        alert("Error parsing file. Please ensure it's a valid Excel or CSV file matching the export format.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // reset
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-slate-700 text-lg flex items-center gap-2">
            <ClipboardList className="text-blue-600" size={24}/>
            Project Summary Builder
          </h3>
          <div className="flex gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
            />
            <button 
              onClick={handleImportClick}
              className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex items-center gap-1"
              title="Import flow from Excel/CSV"
            >
              <Upload size={14}/> Import Flow
            </button>
            <div className="relative" ref={exportMenuRef}>
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex items-center gap-1"
                title="Export flow"
              >
                <Download size={14}/> Export Flow <ChevronDown size={12} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>
              
              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-36 bg-white rounded-md shadow-lg border border-slate-200 py-1 z-10 animate-in fade-in slide-in-from-top-2">
                  <button
                    onClick={exportToCSV}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2"
                  >
                    <FileJson size={14} /> CSV
                  </button>
                  <button
                    onClick={exportToXLSX}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-green-600 flex items-center gap-2"
                  >
                    <FileSpreadsheet size={14} /> Excel (XLSX)
                  </button>
                  <button
                    onClick={exportToPDF}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-red-600 flex items-center gap-2"
                  >
                    <FileText size={14} /> PDF
                  </button>
                </div>
              )}
            </div>
            {/* No `isSaving` state: the save is a synchronous localStorage
                write now that the Firestore round-trip is gone, so a pending
                state could never be observed — React batches the true/false
                pair into one render. `saveSuccess` still drives "Saved!". */}
            <button
              onClick={handleSaveTemplate}
              className="px-3 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 border border-emerald-200 rounded-md transition-colors flex items-center gap-1 shadow-sm"
              title="Save current template as default"
            >
              {saveSuccess ? <Check size={14}/> : <Save size={14}/>}
              {saveSuccess ? 'Saved!' : 'Save Template'}
            </button>
            <button 
              onClick={handleResetTemplate}
              className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1"
              title="Revert changes or reset to factory defaults"
            >
              <RefreshCw size={14}/> Reset
            </button>
            <button 
              onClick={handleClear}
              className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1"
              title="Clear all input values"
            >
              <RefreshCw size={14}/> Clear Values
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1 self-center"></div>
            <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer group">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={autoCopy}
                  onChange={(e) => setAutoCopy(e.target.checked)}
                />
                <div className={`block w-8 h-4.5 rounded-full transition-colors ${autoCopy ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                <div className={`dot absolute left-0.5 top-0.5 bg-white w-3.5 h-3.5 rounded-full transition-transform ${autoCopy ? 'transform translate-x-3.5' : ''}`}></div>
              </div>
              <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700 transition-colors">Auto-Copy</span>
            </label>
            <button 
              onClick={() => {
                const text = generateSummary();
                const blob = new Blob([text], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Project_Summary.txt';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors flex items-center gap-1 shadow-sm"
              title="Download as TXT file"
            >
              <Download size={14}/> TXT
            </button>
            <button 
              onClick={() => {
                const text = generateSummary();
                const subject = encodeURIComponent("Project Summary");
                const body = encodeURIComponent(text);
                window.location.href = `mailto:?subject=${subject}&body=${body}`;
              }}
              className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors flex items-center gap-1 shadow-sm"
              title="Send via Email"
            >
              <FileText size={14}/> Email
            </button>
            <button 
              onClick={handleCopy}
              className="px-4 py-1.5 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2 shadow-sm"
            >
              {copied ? <Check size={14}/> : <Copy size={14}/>}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form Area */}
          <div className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2 pb-4">
            {fields.filter(isFieldVisible).map((f, index) => (
              <div 
                key={f.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, f.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, f.id)}
                className={`bg-slate-50 p-3 rounded-lg border relative group transition-all ${draggedId === f.id ? 'opacity-50 border-blue-400 border-dashed' : 'border-slate-200'}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2 w-3/4">
                    <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
                      <GripVertical size={16}/>
                    </div>
                    <input 
                      type="text"
                      value={f.label}
                      onChange={(e) => updateFieldLabel(f.id, e.target.value)}
                      className="text-xs font-bold text-slate-700 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none w-full transition-colors px-1"
                      placeholder="Field Name"
                    />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100 rounded-md p-1 border border-slate-200">
                    <button 
                      onClick={() => moveField(index, 'up')}
                      disabled={index === 0}
                      className="text-slate-400 hover:text-blue-500 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors p-1"
                      title="Move Up"
                    >
                      <ArrowUp size={14}/>
                    </button>
                    <button 
                      onClick={() => moveField(index, 'down')}
                      disabled={index === fields.length - 1}
                      className="text-slate-400 hover:text-blue-500 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors p-1"
                      title="Move Down"
                    >
                      <ArrowDown size={14}/>
                    </button>
                    <div className="w-px h-4 bg-slate-300 mx-1"></div>
                    <button 
                      onClick={() => toggleEditOptions(f)} 
                      className={`transition-colors p-1 ${editingOptionsId === f.id ? 'text-blue-500' : 'text-slate-400 hover:text-blue-500'}`}
                      title="Edit Dropdown Options"
                    >
                      <Settings2 size={14}/>
                    </button>
                    <button 
                      onClick={() => removeField(f.id)} 
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                      title="Remove Field"
                    >
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>

                {editingOptionsId === f.id && (
                  <div className="mb-3 space-y-2 p-3 bg-blue-50 rounded border border-blue-100 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-700 whitespace-nowrap w-20">Options:</span>
                      <input
                        type="text"
                        className="flex-1 text-xs p-1.5 border border-blue-200 rounded outline-none focus:border-blue-400 bg-white"
                        placeholder="Comma separated (e.g. Yes, No, N/A)"
                        value={optionsInput}
                        onChange={(e) => handleOptionsInputChange(f.id, e.target.value)}
                      />
                    </div>
                    <div className="pt-2 border-t border-blue-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-700">Show If (All must match):</span>
                        <button 
                          onClick={() => addCondition(f.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Plus size={12}/> Add Condition
                        </button>
                      </div>
                      
                      {(f.conditions || (f.condition ? [f.condition] : [])).map((cond, cIdx) => (
                        <div key={cIdx} className="flex items-center gap-2">
                          <select 
                            className="flex-1 text-xs p-1.5 border border-blue-200 rounded outline-none bg-white max-w-[150px]"
                            value={cond.fieldId || ''}
                            onChange={(e) => updateConditionField(f.id, cIdx, e.target.value)}
                          >
                            <option value="">Select field...</option>
                            {fields.filter(other => other.id !== f.id).map(other => (
                              <option key={other.id} value={other.id}>{other.label}</option>
                            ))}
                          </select>
                          
                          {cond.fieldId && (() => {
                            const dependentField = fields.find(other => other.id === cond.fieldId);
                            if (dependentField && dependentField.options.length > 0) {
                              return (
                                <div className="flex-1 flex flex-wrap gap-3 items-center bg-white p-1.5 border border-blue-200 rounded min-h-[30px]">
                                  {dependentField.options.map(opt => {
                                    const isSelected = Array.isArray(cond.value) 
                                      ? cond.value.includes(opt) 
                                      : cond.value === opt;
                                    return (
                                      <label key={opt} className="flex items-center gap-1.5 text-xs cursor-pointer text-slate-700 hover:text-blue-600">
                                        <input 
                                          type="checkbox" 
                                          className="accent-blue-500 cursor-pointer"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            const currentVals = Array.isArray(cond.value) 
                                              ? cond.value 
                                              : (cond.value ? [cond.value as string] : []);
                                            
                                            if (e.target.checked) {
                                              updateConditionValue(f.id, cIdx, [...currentVals, opt]);
                                            } else {
                                              updateConditionValue(f.id, cIdx, currentVals.filter(v => v !== opt));
                                            }
                                          }}
                                        />
                                        {opt}
                                      </label>
                                    );
                                  })}
                                </div>
                              );
                            }
                            return (
                              <input
                                type="text"
                                className="flex-1 text-xs p-1.5 border border-blue-200 rounded outline-none bg-white"
                                placeholder="Required value (e.g. Yes)"
                                value={Array.isArray(cond.value) ? cond.value.join(', ') : (cond.value || '')}
                                onChange={(e) => updateConditionValue(f.id, cIdx, e.target.value)}
                              />
                            );
                          })()}
                          
                          <button 
                            onClick={() => removeCondition(f.id, cIdx)}
                            className="text-slate-400 hover:text-red-500 p-1"
                          >
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {f.options.length > 0 && (
                    <select 
                      className="w-1/3 p-2 border border-slate-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={values[f.id]?.drop || ''}
                      onChange={(e) => handleDropChange(f.id, e.target.value)}
                    >
                      <option value="">Select...</option>
                      {f.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                  {f.isMultiline ? (
                    <textarea 
                      className="flex-1 p-2 border border-slate-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-y min-h-[80px]"
                      placeholder="Enter details..."
                      value={values[f.id]?.text || ''}
                      onChange={(e) => handleTextChange(f.id, e.target.value)}
                    />
                  ) : (
                    <input 
                      type="text" 
                      className="flex-1 p-2 border border-slate-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      placeholder={f.options.length > 0 ? "Additional text..." : "Enter value..."}
                      value={values[f.id]?.text || ''}
                      onChange={(e) => handleTextChange(f.id, e.target.value)}
                    />
                  )}
                </div>
              </div>
            ))}
            
            <button 
              onClick={addField}
              className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 rounded-lg hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 font-bold text-sm"
            >
              <Plus size={16}/> Add Custom Field
            </button>
          </div>

          {/* Preview Area */}
          <div className="bg-slate-800 rounded-xl p-5 text-slate-300 font-mono text-sm shadow-inner overflow-y-auto max-h-[70vh] custom-scrollbar relative group">
             <button 
                onClick={handleCopy}
                className="absolute top-4 right-4 p-2 bg-slate-700 hover:bg-blue-600 text-white rounded-md transition-colors opacity-0 group-hover:opacity-100"
                title="Copy to Clipboard"
             >
                {copied ? <Check size={16}/> : <Copy size={16}/>}
             </button>
             <pre className="whitespace-pre-wrap">{generateSummary()}</pre>
          </div>
        </div>
      </div>
      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Reset Template?</h3>
            <p className="text-slate-600 text-sm mb-6">
              You can revert to your <strong>last saved template</strong>, or completely reset to the <strong>factory defaults</strong>. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmFactoryReset}
                className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                Factory Reset
              </button>
              <button
                onClick={confirmReset}
                className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Revert to Saved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectSummaryTab;
