
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, Play, Square, Download, Loader2, Save, Trash2, Volume2, Sparkles, Languages, Settings2, RefreshCw, Fingerprint, Star, Plus, CheckCircle2, FileAudio, Cpu, Pencil, Activity } from 'lucide-react';
import * as storage from '../services/storageService';

const PRESET_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', category: 'American, Calm', gender: 'Female' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', category: 'American, Emotive', gender: 'Female' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', category: 'American, Soft', gender: 'Female' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', category: 'American, Well-rounded', gender: 'Male' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', category: 'American, Deep', gender: 'Male' },
  { id: 'ODq5zmih8GrVes37Dizj', name: 'Patrick', category: 'American, Shouty', gender: 'Male' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', category: 'American, Deep', gender: 'Male' },
];

const TTS_MODELS = [
  { id: 'eleven_v3', name: 'Eleven v3' },
];

interface CustomVoice {
    id: string;
    name: string;
    createdAt: number;
}

const STORAGE_KEY_VOICES = 'custom_voices';

const VoiceStudio: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  
  // Voice State
  const [selectedPresetId, setSelectedPresetId] = useState(PRESET_VOICES[0].id);
  const [customVoiceId, setCustomVoiceId] = useState('');
  const [customVoiceName, setCustomVoiceName] = useState('');
  const [savedVoices, setSavedVoices] = useState<CustomVoice[]>([]);
  const [modelId, setModelId] = useState(TTS_MODELS[0].id); // Default to Eleven v3
  
  // Project Context State
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string | null>(null);
  const [savingToProject, setSavingToProject] = useState(false);
  
  // Operation State
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Restore User Selection Preference
  useEffect(() => {
    const pref = localStorage.getItem('lva_voice_pref');
    if (pref) {
        try {
            const { type, id, name } = JSON.parse(pref);
            if (type === 'custom') {
                setCustomVoiceId(id);
                setCustomVoiceName(name || '');
                setSelectedPresetId('');
            } else if (type === 'preset') {
                setSelectedPresetId(id);
                setCustomVoiceId('');
                setCustomVoiceName('');
            }
        } catch (e) {
            console.error("Failed to parse voice preference", e);
        }
    }
  }, []);

  useEffect(() => {
    if (location.state?.text) {
      setText(location.state.text);
    }
    if (location.state?.projectId) {
        setProjectId(location.state.projectId);
    }
    if (location.state?.projectTitle) {
        setProjectTitle(location.state.projectTitle);
    }
    loadSavedVoices();
  }, [location]);

  const loadSavedVoices = async () => {
      try {
          // Try loading from local storage/IndexedDB first via tool data
          const data = await storage.getToolData<{ voices: CustomVoice[] }>(STORAGE_KEY_VOICES);
          if (data && Array.isArray(data.voices)) {
              setSavedVoices(data.voices);
          } else {
              // Try fetching remote if local is empty (initial sync)
              const remote = await storage.fetchRemoteToolData<{ voices: CustomVoice[] }>(STORAGE_KEY_VOICES);
              if (remote && Array.isArray(remote.voices)) {
                  setSavedVoices(remote.voices);
                  // Cache locally
                  await storage.saveToolData(STORAGE_KEY_VOICES, remote);
              }
          }
      } catch (e) {
          console.error("Failed to load custom voices", e);
      }
  };

  const persistVoices = async (voices: CustomVoice[]) => {
      setSavedVoices(voices);
      const payload = { voices };
      // Save locally
      await storage.saveToolData(STORAGE_KEY_VOICES, payload);
      // Sync to cloud (Background)
      storage.uploadToolData(STORAGE_KEY_VOICES, payload).catch(console.error);
  };

  const saveUserPref = (type: 'custom' | 'preset', id: string, name?: string) => {
      localStorage.setItem('lva_voice_pref', JSON.stringify({ type, id, name }));
  };

  const handleSaveVoice = async () => {
      if (!customVoiceId.trim() || !customVoiceName.trim()) return;
      
      const id = customVoiceId.trim();
      const name = customVoiceName.trim();

      // Check if updating existing or adding new
      const existingIndex = savedVoices.findIndex(v => v.id === id);
      
      let updatedList = [...savedVoices];
      
      if (existingIndex > -1) {
          // Update existing
          updatedList[existingIndex] = {
              ...updatedList[existingIndex],
              name: name
          };
      } else {
          // Add new
          const newVoice: CustomVoice = {
              id,
              name,
              createdAt: Date.now()
          };
          updatedList = [newVoice, ...savedVoices];
      }

      await persistVoices(updatedList);
      saveUserPref('custom', id, name);
      
      if (existingIndex === -1) {
          // Clear name only if it was a new add, however we keep inputs usually. 
          // But to be cleaner:
          // setCustomVoiceName(''); 
      }
  };

  const handleDeleteVoice = async (id: string) => {
      if (!window.confirm("确定要删除这个收藏的声音吗？")) return;
      const updatedList = savedVoices.filter(v => v.id !== id);
      await persistVoices(updatedList);
      
      // If deleted voice was selected, clear inputs
      if (customVoiceId === id) {
          setCustomVoiceName('');
          setCustomVoiceId('');
          setSelectedPresetId(PRESET_VOICES[0].id);
          saveUserPref('preset', PRESET_VOICES[0].id);
      }
  };

  const handleSelectSavedVoice = (voice: CustomVoice) => {
      setCustomVoiceId(voice.id);
      setCustomVoiceName(voice.name); // Auto-fill name for editing
      setSelectedPresetId(''); // Clear preset selection
      saveUserPref('custom', voice.id, voice.name);
  };

  const handleSelectPreset = (id: string) => {
      setSelectedPresetId(id);
      setCustomVoiceId(''); // Clear custom input to indicate preset usage
      setCustomVoiceName('');
      saveUserPref('preset', id);
  };

  const handleCustomIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setCustomVoiceId(val);
      if (val) {
          setSelectedPresetId('');
          saveUserPref('custom', val, customVoiceName);
      }
  };

  const handlePreview = async () => {
    if (!text.trim()) return;
    setStreaming(true);
    setAudioUrl(null);
    setErrorMsg(null);

    const effectiveVoiceId = customVoiceId.trim() || selectedPresetId;

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.substring(0, 500), // Preview limit
          voice_id: effectiveVoiceId,
          model_id: modelId,
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

    const effectiveVoiceId = customVoiceId.trim() || selectedPresetId;

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          voice_id: effectiveVoiceId,
          model_id: modelId,
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

  const handleSaveToProject = async () => {
      if (!audioUrl || !projectId) return;
      if (audioUrl.startsWith('blob:')) {
          alert("请先点击“生成完整音频”以获取可保存的持久化文件。");
          return;
      }

      setSavingToProject(true);
      try {
          const project = await storage.getProject(projectId);
          if (project) {
               const updated = { 
                   ...project, 
                   audioFile: audioUrl,
                   moduleTimestamps: { ...(project.moduleTimestamps || {}), audio_file: Date.now() }
               };
               await storage.saveProject(updated);
               
               // Trigger background sync
               storage.uploadProjects().catch(console.error);

               alert(`已成功保存到项目 "${project.title}" 的音频文件中！`);
          } else {
              alert("找不到对应项目，可能已被删除。");
          }
      } catch(e: any) {
          alert("保存失败: " + e.message);
      } finally {
          setSavingToProject(false);
      }
  };

  // Determine if the current custom ID is already saved
  const savedVoiceMatch = savedVoices.find(v => v.id === customVoiceId.trim());
  const isCurrentIdSaved = !!savedVoiceMatch;

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#F8F9FC] overflow-hidden">
      {/* Sidebar / Configuration */}
      <div className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col z-10 shadow-sm h-full">
        <div className="p-6 pb-2">
          <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600 mb-2 flex items-center gap-2">
            <Mic className="w-6 h-6 text-violet-600" />
            语音工坊
          </h1>
          <p className="text-xs text-slate-500 font-medium">ElevenLabs 驱动的高品质 TTS</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6 custom-scrollbar flex flex-col">
          
          {/* Model Selection */}
          <div className="shrink-0">
             <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5" /> 语音模型
             </label>
             <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-500/10 cursor-pointer text-slate-700"
             >
                {TTS_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                ))}
             </select>
          </div>

          {/* Custom Input Section */}
          <div className="shrink-0">
             <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center justify-between">
                <span>自定义 Voice ID</span>
                {customVoiceId && <span className="text-[10px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded font-bold">优先使用</span>}
             </label>
             <div className="relative mb-2">
                 <input 
                    type="text"
                    value={customVoiceId}
                    onChange={handleCustomIdChange}
                    placeholder="粘贴 ElevenLabs Voice ID..."
                    className={`w-full pl-9 pr-3 py-3 text-xs bg-slate-50 border rounded-xl outline-none transition-all font-mono text-slate-600 ${customVoiceId ? 'border-violet-300 ring-2 ring-violet-500/10 bg-white shadow-sm' : 'border-slate-200 focus:border-violet-300'}`}
                 />
                 <Fingerprint className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${customVoiceId ? 'text-violet-500' : 'text-slate-400'}`} />
             </div>

             {/* Save/Edit Controls - Show if ID exists */}
             {customVoiceId && (
                 <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-1">
                     <div className="flex gap-2">
                        <input 
                            type="text"
                            value={customVoiceName}
                            onChange={(e) => setCustomVoiceName(e.target.value)}
                            placeholder="给声音起个名..."
                            className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-violet-300"
                        />
                        <button 
                            onClick={handleSaveVoice}
                            disabled={!customVoiceName.trim()}
                            className={`px-3 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap ${isCurrentIdSaved ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-900 hover:bg-violet-600'}`}
                            title={isCurrentIdSaved ? "更新名称" : "保存到收藏"}
                        >
                            {isCurrentIdSaved ? <RefreshCw className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                            <span className="text-xs font-bold">{isCurrentIdSaved ? "更新" : "收藏"}</span>
                        </button>
                     </div>
                     
                     {/* If it's saved, show extra controls */}
                     {isCurrentIdSaved && (
                         <div className="flex items-center justify-between px-2 py-1 bg-slate-50 rounded border border-slate-100">
                             <span className="text-[10px] text-slate-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500"/> 已存在于列表</span>
                             <button 
                                onClick={() => handleDeleteVoice(customVoiceId)}
                                className="text-[10px] text-rose-500 hover:text-rose-700 hover:underline flex items-center gap-1"
                             >
                                <Trash2 className="w-3 h-3" /> 删除
                             </button>
                         </div>
                     )}
                 </div>
             )}
          </div>

          {/* Saved Voices List */}
          {savedVoices.length > 0 && (
              <div className="shrink-0">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> 我的收藏
                </label>
                <div className="space-y-2">
                    {savedVoices.map(voice => (
                        <div 
                            key={voice.id}
                            onClick={() => handleSelectSavedVoice(voice)}
                            className={`group p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${customVoiceId === voice.id ? 'bg-violet-50 border-violet-200 shadow-sm' : 'bg-white border-slate-100 hover:border-violet-100 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${customVoiceId === voice.id ? 'bg-violet-500 text-white' : 'bg-amber-100 text-amber-600'}`}>
                                    {voice.name[0]}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className={`text-sm font-bold truncate ${customVoiceId === voice.id ? 'text-violet-700' : 'text-slate-700'}`}>{voice.name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">{voice.id}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleSelectSavedVoice(voice); }}
                                    className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                                    title="编辑"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteVoice(voice.id); }}
                                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="删除"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
              </div>
          )}

          {/* Preset Voices Dropdown - Replaces previous list */}
          <div className="shrink-0">
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">系统预置</label>
            <select
                value={customVoiceId ? "" : selectedPresetId}
                onChange={(e) => {
                    if (e.target.value) handleSelectPreset(e.target.value);
                }}
                className={`w-full px-3 py-3 text-xs font-bold bg-white border border-slate-200 rounded-xl outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-500/10 cursor-pointer transition-colors ${customVoiceId ? 'text-slate-400 bg-slate-50' : 'text-slate-700'}`}
            >
                {customVoiceId && <option value="" disabled>-- 自定义 Voice ID 激活中 --</option>}
                {PRESET_VOICES.map(voice => (
                    <option key={voice.id} value={voice.id} className="text-slate-700">
                        {voice.name} · {voice.gender} ({voice.category})
                    </option>
                ))}
            </select>
          </div>
          
          {/* Generation Progress Console */}
          <div className="flex-1 flex flex-col justify-end min-h-[150px]">
             <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                 <Activity className="w-3.5 h-3.5" /> 生成进度
             </label>
             <div className="bg-slate-900 rounded-xl p-4 flex-1 border border-slate-800 shadow-inner flex flex-col">
                <div className="flex flex-col gap-2 font-mono text-[10px] leading-relaxed overflow-y-auto custom-scrollbar">
                    {!loading && !streaming && !audioUrl && !errorMsg && (
                        <span className="text-slate-600 italic">>> 系统就绪，等待任务...</span>
                    )}
                    
                    {(loading || streaming) && (
                        <>
                            <span className="text-slate-300">>> 任务已提交至后台</span>
                            <span className="text-slate-300">>> 连接 ElevenLabs v3...</span>
                            {text.length > 1700 && !streaming && (
                                <span className="text-amber-400">>> [长文本模式] 检测到 {text.length} 字符</span>
                            )}
                            {text.length > 1700 && !streaming && (
                                <span className="text-amber-400 animate-pulse">>> [处理中] 智能拆分 -> 逐段生成 -> 音频融合</span>
                            )}
                            <span className="text-violet-400 animate-pulse">>> 数据流传输中...</span>
                        </>
                    )}

                    {audioUrl && !loading && !streaming && (
                         <>
                            <span className="text-slate-500">>> 传输完成</span>
                            <span className="text-emerald-400 font-bold">>> √ 音频生成成功</span>
                            <span className="text-slate-500">>> 资源已加载到播放器</span>
                         </>
                    )}
                    
                    {errorMsg && (
                        <span className="text-rose-500 font-bold">>> 错误: {errorMsg}</span>
                    )}
                </div>
             </div>
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
                      <a href={audioUrl} download={`tts_${Date.now()}.mp3`} className="p-2 text-slate-400 hover:text-violet-600 transition-colors" title="下载音频">
                        <Download className="w-4 h-4" />
                      </a>
                      
                      {/* Save To Project Button - Only visible if project context exists and audio is persistent */}
                      {projectId && !audioUrl.startsWith('blob:') && (
                         <>
                            <div className="w-px h-4 bg-slate-200 mx-2" />
                            <button 
                                onClick={handleSaveToProject}
                                disabled={savingToProject}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                                title={`将当前音频保存至项目: ${projectTitle}`}
                            >
                                {savingToProject ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                保存到项目
                            </button>
                         </>
                      )}
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
