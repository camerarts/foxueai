import React, { useState, useEffect } from 'react';
import { X, Key, Check, ShieldCheck, Cpu, Zap, Image as ImageIcon, Type, FileText, Save } from 'lucide-react';

interface ApiKeyConfigModalProps {
  onClose: () => void;
}

const ApiKeyConfigModal: React.FC<ApiKeyConfigModalProps> = ({ onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const storedKey = localStorage.getItem('lva_custom_api_key');
    if (storedKey) setApiKey(storedKey);
  }, []);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('lva_custom_api_key', apiKey.trim());
    } else {
      localStorage.removeItem('lva_custom_api_key');
    }
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
      window.location.reload(); // Reload to apply new key to service instances
    }, 1000);
  };

  const MODULES = [
    {
      name: '脚本生成 (Script)',
      icon: FileText,
      model: 'gemini-2.5-flash-preview-09-2025',
      desc: '用于生成长视频口播文案，支持长文本逻辑。'
    },
    {
      name: '标题策划 (Titles)',
      icon: Type,
      model: 'gemini-3-flash-preview',
      desc: '快速生成具有病毒传播潜力的标题变体。'
    },
    {
      name: '封面提示词 (Prompt)',
      icon: Zap,
      model: 'gemini-2.5-flash-preview-09-2025',
      desc: '精准理解视频内容并转化为英文绘图指令。'
    },
    {
      name: 'AI 绘图 (Image Gen)',
      icon: ImageIcon,
      model: 'gemini-3-pro-image-preview',
      desc: '生成 4K 高质量电影感封面图与分镜画面。'
    }
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-slate-900 px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
              <Key className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">API 密钥配置</h3>
              <p className="text-xs text-slate-400">配置您的 Google Gemini API Key</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Key Input Section */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              自定义 API Key
            </label>
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-sm text-slate-800"
              />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              * 设置后将优先使用此 Key 调用 API。留空则使用系统默认 Key。<br/>
              * Key 仅存储在本地浏览器中，不会上传到我们的服务器。
            </p>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Module Models List */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5" />
              当前模块模型配置
            </h4>
            <div className="grid grid-cols-1 gap-3 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
              {MODULES.map((mod, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-500 border border-slate-200 shrink-0">
                    <mod.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-700">{mod.name}</span>
                    </div>
                    <div className="text-[10px] font-mono bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded inline-block mb-1.5 border border-indigo-100">
                      {mod.model}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">{mod.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
              saved 
              ? 'bg-emerald-500 text-white shadow-emerald-500/30' 
              : 'bg-slate-900 text-white hover:bg-indigo-600 shadow-slate-900/20 hover:shadow-indigo-500/30'
            }`}
          >
            {saved ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
            {saved ? '已保存并刷新' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyConfigModal;