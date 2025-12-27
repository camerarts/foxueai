
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, Play, Square, Download, Loader2, Save, Trash2, Volume2, Sparkles, Languages, Settings2, RefreshCw, Fingerprint } from 'lucide-react';
import * as storage from '../services/storageService';

const VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', category: 'American, Calm', gender: 'Female' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', category: 'American, Emotive', gender: 'Female' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', category: 'American, Soft', gender: 'Female' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', category: 'American, Well-rounded', gender: 'Male' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', category: 'American, Deep', gender: 'Male' },
  { id: 'ODq5zmih8GrVes37Dizj', name: 'Patrick', category: 'American, Shouty', gender: 'Male' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', category: 'American, Deep', gender: 'Male' },
];

const VoiceStudio: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [customVoiceId, setCustomVoiceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Load text from navigation state if available
    if (location.state?.text) {
      setText(location.state.text);
    }
    loadHistory();
  }, [location]);

  const loadHistory = async () => {
     // Ideally load from DB, for now simple local state or modify DB schema later
     // This version is stateless for history for simplicity in V1
  };

  const handlePreview = async () => {
    if (!text.trim()) return;
    setStreaming(true);
    setAudioUrl(null);
    setErrorMsg(null);

    const effectiveVoiceId = customVoiceId.trim() || selectedVoice;

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.substring(0, 500), // Preview limit
          voice_id: effectiveVoiceId,
          stream: true
        })
      });

      if (!response.ok) throw new Error((await response.json()).error || 'Streaming failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setStreaming(false);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setAudioUrl(null);
    setErrorMsg(null);

    const effectiveVoiceId = customVoiceId.trim() || selectedVoice;

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          voice_id: effectiveVoiceId,
          stream: false // Request cached file
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Generation failed');

      setAudioUrl(data.url);
      if (audioRef.current) {
          audioRef.current.src = data.url;
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#F8F9FC] overflow-hidden">
      {/* Sidebar / Configuration */}
      <div className="w-full md:w-80 bg-white border-r border-slate-200 p-6 flex flex-col gap-6 z-10 shadow-sm overflow-y-auto">
        <div>
          <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600 mb-2 flex items-center gap-2">
            <Mic className="w-6 h-6 text-violet-600" />
            语音工坊
          </h1>
          <p className="text-xs text-slate-500 font-medium">ElevenLabs 驱动的高品质 TTS</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">选择声音</label>
            <div className="space-y-2">
              {VOICES.map(voice => (
                <div 
                  key={voice.id}
                  onClick={() => {
                      setSelectedVoice(voice.id);
                      setCustomVoiceId(''); // Clear custom input
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${selectedVoice === voice.id && !customVoiceId ? 'bg-violet-50 border-violet-200 shadow-sm' : 'bg-white border-slate-100 hover:border-violet-100 hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${selectedVoice === voice.id && !customVoiceId ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {voice.name[0]}
                    </div>
                    <div>
                      <div className={`text-sm font-bold ${selectedVoice === voice.id && !customVoiceId ? 'text-violet-700' : 'text-slate-700'}`}>{voice.name}</div>
                      <div className="text-[10px] text-slate-400">{voice.category}</div>
                    </div>
                  </div>
                  {selectedVoice === voice.id && !customVoiceId && <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
             <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center justify-between">
                <span>自定义 Voice ID</span>
                {customVoiceId && <span className="text-[10px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded font-bold">优先使用</span>}
             </label>
             <div className="relative">
                 <input 
                    type="text"
                    value={customVoiceId}
                    onChange={(e) => {
                        setCustomVoiceId(e.target.value);
                        if (e.target.value) setSelectedVoice(''); // Visually deselect list
                    }}
                    placeholder="输入 ElevenLabs Voice ID..."
                    className={`w-full pl-9 pr-3 py-3 text-xs bg-slate-50 border rounded-xl outline-none transition-all font-mono text-slate-600 ${customVoiceId ? 'border-violet-300 ring-2 ring-violet-500/10 bg-white' : 'border-slate-200 focus:border-violet-300'}`}
                 />
                 <Fingerprint className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${customVoiceId ? 'text-violet-500' : 'text-slate-400'}`} />
             </div>
             <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                如需使用克隆声音或其他库内声音，请在此粘贴 Voice ID，它将覆盖上方选择。
             </p>
          </div>
          
          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
             <h4 className="text-xs font-bold text-indigo-700 mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> 提示</h4>
             <p className="text-[10px] text-indigo-600 leading-relaxed">
               预览模式仅生成前 500 字符。点击“生成完整音频”将消耗额度并永久保存到云端。
             </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
           <div className="max-w-4xl mx-auto h-full flex flex-col gap-6">
              
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-[300px]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                        <Languages className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-600 uppercase">文本输入</span>
                    </div>
                    <span className="text-xs font-mono text-slate-400">{text.length} chars</span>
                </div>
                <textarea 
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="flex-1 p-6 text-slate-700 text-base leading-relaxed resize-none outline-none font-medium"
                  placeholder="在此输入或粘贴需要转换的文本..."
                />
              </div>

              {/* Action Bar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 sticky bottom-6">
                 {audioUrl && (
                   <div className="flex items-center gap-4 flex-1 w-full md:w-auto bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <audio ref={audioRef} controls className="w-full h-8 outline-none" src={audioUrl} />
                      <a href={audioUrl} download={`tts_${Date.now()}.mp3`} className="p-2 text-slate-400 hover:text-violet-600 transition-colors">
                        <Download className="w-4 h-4" />
                      </a>
                   </div>
                 )}
                 
                 <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    {errorMsg && <span className="text-xs font-bold text-rose-500 mr-2">{errorMsg}</span>}
                    
                    <button 
                      onClick={handlePreview}
                      disabled={loading || streaming || !text}
                      className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 bg-white border border-slate-200 hover:border-violet-300 hover:text-violet-600 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                       {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                       试听片段
                    </button>
                    
                    <button 
                      onClick={handleGenerate}
                      disabled={loading || streaming || !text}
                      className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-slate-900 hover:bg-violet-600 transition-all shadow-lg hover:shadow-violet-500/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
                       生成完整音频
                    </button>
                 </div>
              </div>

           </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceStudio;
