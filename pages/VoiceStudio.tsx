
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, Play, Square, Download, Loader2, Save, Trash2, Volume2, Sparkles, Languages, Settings2, RefreshCw, Fingerprint, Star, Plus, CheckCircle2, FileAudio } from 'lucide-react';
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

  const handleSaveVoice = async () => {
      if (!customVoiceId.trim() || !customVoiceName.trim()) return;
      
      const newVoice: CustomVoice = {
          id: customVoiceId.trim(),
          name: customVoiceName.trim(),
          createdAt: Date.now()
      };

      // Check duplicates
      if (savedVoices.some(v => v.id === newVoice.id)) {
          alert("该 Voice ID 已存在于收藏列表中");
          return;
      }

      const updatedList = [newVoice, ...savedVoices];
      await persistVoices(updatedList);
      setCustomVoiceName(''); // Clear name input after save
  };

  const handleDeleteVoice = async (id: string) => {
      if (!window.confirm("确定要删除这个收藏的声音吗？")) return;
      const updatedList = savedVoices.filter(v => v.id !== id);
      await persistVoices(updatedList);
      
      // If deleted voice was selected, clear selection (but keep text in box so user knows what happened)
      if (customVoiceId === id) {
          // Optional: clear input or keep it as 'unsaved'
          // Keeping it allows user to re-save if accidental
      }
  };

  const handleSelectSavedVoice = (voice: CustomVoice) => {
      setCustomVoiceId(voice.id);
      setSelectedPresetId(''); // Clear preset selection
  };

  const handleSelectPreset = (id: string) => {
      setSelectedPresetId(id);
      setCustomVoiceId(''); // Clear custom input to indicate preset usage
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

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6 custom-scrollbar">
          
          {/* Custom Input Section */}
          <div>
             <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center justify-between">
                <span>自定义 Voice ID</span>
                {customVoiceId && <span className="text-[10px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded font-bold">优先使用</span>}
             </label>
             <div className="relative mb-2">
                 <input 
                    type="text"
                    value={customVoiceId}
                    onChange={(e) => {
                        setCustomVoiceId(e.target.value);
                        if (e.target.value) setSelectedPresetId('');
                    }}
                    placeholder="粘贴 ElevenLabs Voice ID..."
                    className={`w-full pl-9 pr-3 py-3 text-xs bg-slate-50 border rounded-xl outline-none transition-all font-mono text-slate-600 ${customVoiceId ? 'border-violet-300 ring-2 ring-violet-500/10 bg-white shadow-sm' : 'border-slate-200 focus:border-violet-300'}`}
                 />
                 <Fingerprint className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${customVoiceId ? 'text-violet-500' : 'text-slate-400'}`} />
             </div>

             {/* Save Controls - Only show if ID exists and not saved */}
             {customVoiceId && !isCurrentIdSaved && (
                 <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
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
                        className="px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="保存到收藏"
                     >
                        <Save className="w-4 h-4" />
                     </button>
                 </div>
             )}

             {/* Delete Controls - Show if ID exists and IS saved */}
             {customVoiceId && isCurrentIdSaved && (
                  <div className="flex items-center justify-between mt-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg animate-in fade-in">
                      <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-xs font-bold text-emerald-700">已收藏: {savedVoiceMatch?.name}</span>
                      </div>
                      <button 
                        onClick={() => handleDeleteVoice(customVoiceId)}
                        className="p-1.5 text-emerald-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                        title="删除此收藏"
                      >
                         <Trash2 className="w-3.5 h-3.5" />
                      </button>
                  </div>
             )}
          </div>

          {/* Saved Voices List */}
          {savedVoices.length > 0 && (
              <div>
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
                                <div className="min-w-0">
                                    <div className={`text-sm font-bold truncate ${customVoiceId === voice.id ? 'text-violet-700' : 'text-slate-700'}`}>{voice.name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">{voice.id}</div>
                                </div>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteVoice(voice.id); }}
                                className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors group-hover:opacity-100"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
              </div>
          )}

          {/* Preset Voices List */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">系统预置</label>
            <div className="space-y-2">
              {PRESET_VOICES.map(voice => (
                <div 
                  key={voice.id}
                  onClick={() => handleSelectPreset(voice.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${selectedPresetId === voice.id && !customVoiceId ? 'bg-slate-100 border-slate-300 shadow-sm' : 'bg-white border-slate-100 hover:border-violet-100 hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${selectedPresetId === voice.id && !customVoiceId ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {voice.name[0]}
                    </div>
                    <div>
                      <div className={`text-sm font-bold ${selectedPresetId === voice.id && !customVoiceId ? 'text-slate-900' : 'text-slate-700'}`}>{voice.name}</div>
                      <div className="text-[10px] text-slate-400">{voice.category}</div>
                    </div>
                  </div>
                  {selectedPresetId === voice.id && !customVoiceId && <div className="w-2 h-2 rounded-full bg-slate-800" />}
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
             <h4 className="text-xs font-bold text-indigo-700 mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> 提示</h4>
             <p className="text-[10px] text-indigo-600 leading-relaxed">
               试听生成片段（不消耗额度），满意后生成完整版并自动保存到云端。
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
