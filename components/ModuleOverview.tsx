import React from 'react';
import { Lightbulb } from 'lucide-react';

interface ModuleOverviewProps {
  activeTabObj: any;
}

const ModuleOverview: React.FC<ModuleOverviewProps> = ({ activeTabObj }) => {
  if (!activeTabObj) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-xl p-5 border border-blue-100 shadow-sm flex items-start gap-4">
      <div className="bg-white p-2.5 rounded-lg text-blue-600 shadow-sm border border-blue-100 shrink-0 mt-0.5">
        <Lightbulb size={24} />
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-bold text-slate-800 mb-1.5 flex items-center gap-2">
          Module Overview: {activeTabObj.title}
        </h4>
        <p className="text-sm text-slate-600 mb-3 leading-relaxed max-w-4xl">
          {activeTabObj.description}
        </p>
        <div className="bg-white/60 rounded-lg p-3 border border-blue-50/50 max-w-4xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1 block">Pro Tip</span>
          <p className="text-xs text-slate-700 leading-relaxed">
            {activeTabObj.instructions}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModuleOverview;
