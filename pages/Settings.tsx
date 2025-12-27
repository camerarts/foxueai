
import React, { useState, useEffect, useRef } from 'react';
import { PromptTemplate, DEFAULT_PROMPTS } from '../types';
import * as storage from '../services/storageService';
import { Save, RefreshCw, AlertTriangle, ClipboardPaste, Check, Maximize2, X, Loader2, Copy, Cloud, CloudCheck, AlertCircle, Clock } from 'lucide-react';

const Settings: React.FC = () => {
  const [prompts, setPrompts] = useState<Record<string, PromptTemplate>>({});
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'synced' | 'error' | 'pending'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [refreshTime, setRefreshTime] = useState('');
  
  // 用于标记是否已完成初始化加载，防止挂载时的初次保存
  const isInitialized = useRef(false);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());

  const ORDERED_KEYS = [
    'SCRIPT',
    'TITLES',
    'STORYBOARD_TEXT',
    'SUMMARY',
    'COVER_GEN'
  ];

  const VARIABLE_MAP: Record<string, string[]> = {
    'SCRIPT': ['{{topic}}', '{{tone}}', '{{language}}'],
    'TITLES': ['{{title}}', '{{script}}'],
    'STORYBOARD_TEXT': ['{{script}}'],
    'SUMMARY': ['{{script}}'],
    'COVER_GEN': ['{{title}}', '{{script}}']
  };

  useEffect(() => {
    const init = async () => {
        const localDataRaw = localStorage.getItem('lva_prompts');
        if (!localDataRaw) {
            setSyncStatus('saving');
            try {
                await storage.downloadAllData();
                setSyncStatus('synced');
            } catch (e) {
                console.error("Failed to download initial prompts", e);
                setSyncStatus('error');
            }
        }
        const data = await storage.getPrompts();
        setPrompts(data);
        setRefreshTime(`上次云端同步：${storage.getLastUploadTime()}`);
        isInitialized.current = true;
    };
    init();
  }, []);

  // 监听 prompts 变动，改为 8 秒延迟保存
  useEffect(() => {
    if (!isInitialized.current) return;

    setSyncStatus('pending'); 

    const autoSave = async () => {
        setSyncStatus('saving');
        try {
            await storage.savePrompts(prompts);
            await storage.uploadPrompts();
            setSyncStatus('synced');
            setRefreshTime(`保存完成：${new Date().toLocaleTimeString()}`);
        } catch (e) {
            console.error("Auto-sync prompts failed", e);
            setSyncStatus('error');
        }
    };

    const timer = setTimeout(autoSave, 8000); 
    return () => clearTimeout(timer);
  }, [prompts]);

  const handlePromptChange = (key: string, value: string) => {
    setPrompts(prev => ({
      ...prev,
      [key]: { ...prev[key], template: value }
    }));
    setDirtyKeys(prev => new Set(prev).add(key));
  };

  const handleCopy = (text: string) => {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        setMessage("已复制到剪贴板");
        setTimeout(() => setMessage(null), 1500);
    }
  };

  const handlePaste = async (key: string) => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handlePromptChange(key, text);
        setMessage("已粘贴");
        setTimeout(() => setMessage(null), 1500);
      }
    } catch (err) {
      alert("无法访问剪贴板，请手动粘贴。");
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-24 md:pb-20">
      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-end mb-6 md:mb-10">
        <div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-slate-900 mb-0.5 md:mb-2 tracking-tight">AI 提示词配置</h1>
          <p className="text-xs md:text-base text-slate-500 font-medium">配置将延迟 8 秒自动保存并同步至云端。</p>
        </div>
        <div className="flex flex-col items-end gap-2">
            <div className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full border bg-white shadow-sm transition-all ${
                syncStatus === 'synced' ? 'text-emerald-600 border-emerald-100' :
                syncStatus === 'saving' ? 'text-blue-600 border-blue-100' :
                syncStatus === 'pending' ? 'text-amber-600 border-amber-100 animate-pulse' :
                syncStatus === 'error' ? 'text-rose-600 border-rose-100' :
                'text-slate-400 border-slate-100'
            }`}>
                {syncStatus === 'synced' ? <CloudCheck className="w-3.5 h-3.5" /> : 
                 syncStatus === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 
                 syncStatus === 'pending' ? <Clock className="w-3.5 h-3.5" /> :
                 syncStatus === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> :
                 <Cloud className="w-3.5 h-3.5" />}
                {syncStatus === 'synced' ? '已同步云端' : syncStatus === 'saving' ? '同步中...' : syncStatus === 'pending' ? '变更待保存 (8s)' : syncStatus === 'error' ? '同步失败' : '就绪'}
            </div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                {refreshTime}
            </span>
        </div>
      </div>

      {message && (
        <div className="fixed bottom-8 right-8 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-5 z-50 font-bold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          {message}
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-2xl flex gap-4 items-start">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
                <p className="font-bold text-indigo-900 text-sm">自动同步机制</p>
                <p className="text-xs text-indigo-700/80 leading-relaxed">
                    任何修改都会在停止操作 8 秒后自动保存并上传至云端数据库。
                </p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {ORDERED_KEYS.map((key, index) => {
            const prompt = prompts[key];
            if (!prompt) return null;
            const systemDef = DEFAULT_PROMPTS[key];
            const displayName = systemDef ? systemDef.name : prompt.name;
            const displayDesc = systemDef ? systemDef.description : prompt.description;
            const variables = VARIABLE_MAP[key] || [];

            return (
              <div key={key} className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {index + 1}
                    </span>
                    <div>
                        <h3 className="text-base font-black text-slate-800 tracking-tight">{displayName}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{displayDesc}</p>
                        {variables.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2.5">
                                {variables.map(v => (
                                    <code key={v} className="text-[10px] font-mono text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/50 select-all cursor-text" title="系统注入变量">
                                        {v}
                                    </code>
                                ))}
                            </div>
                        )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                      <button onClick={() => handleCopy(prompt.template)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all"><Copy className="w-4 h-4" /></button>
                      <button onClick={() => handlePaste(key)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all"><ClipboardPaste className="w-4 h-4" /></button>
                  </div>
                </div>
                
                <div className="relative flex-1 group">
                    <textarea
                        value={prompt.template}
                        onChange={(e) => handlePromptChange(key, e.target.value)}
                        className="w-full h-64 bg-slate-50 border border-slate-100 rounded-2xl p-5 font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all resize-none"
                    />
                    <button 
                        onClick={() => setExpandedKey(key)}
                        className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {expandedKey && prompts[expandedKey] && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] shadow-2xl w-[90vw] h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="px-8 py-6 border-b flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-slate-800">全屏编辑: {DEFAULT_PROMPTS[expandedKey]?.name}</h2>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {VARIABLE_MAP[expandedKey]?.map(v => (
                                <code key={v} className="text-xs font-mono text-indigo-500 bg-indigo-50 px-2 py-1 rounded border border-indigo-100/50 select-all">
                                    {v}
                                </code>
                            ))}
                        </div>
                    </div>
                    <button onClick={() => setExpandedKey(null)} className="p-3 bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full"><X className="w-6 h-6" /></button>
                </div>
                <div className="flex-1 p-8 bg-slate-50">
                    <textarea
                        autoFocus
                        value={prompts[expandedKey].template}
                        onChange={(e) => handlePromptChange(expandedKey, e.target.value)}
                        className="w-full h-full bg-white border border-slate-200 rounded-3xl p-8 text-slate-800 font-mono text-sm leading-relaxed outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-inner resize-none"
                    />
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
