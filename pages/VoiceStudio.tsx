
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, Play, Square, Download, Loader2, Save, Trash2, Volume2, Sparkles, Languages, Settings2, RefreshCw, Fingerprint, Star, Plus, CheckCircle2, FileAudio, Cpu, Pencil, Activity, Split, Merge, Scissors, ArrowRight, FolderOpen } from 'lucide-react';
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
  
  // Workflow State: 1=Input/Split, 2=Generate, 3=Merge
  const [step, setStep] = useState(1);
  const [isSplitMode, setIsSplitMode] = useState(false);

  // Text State
  const [text, setText] = useState('');
  const [textPart1, setTextPart1] = useState('');
  const [textPart2, setTextPart2] = useState('');
  
  // Audio State
  const [audioUrl1, setAudioUrl1] = useState<string | null>(null);
  const [audioUrl2, setAudioUrl2] = useState<string | null>(null);
  const [finalAudioUrl, setFinalAudioUrl] = useState<string | null>(null);

  // Voice State
  const [selectedPresetId, setSelectedPresetId] = useState(PRESET_VOICES[0].id);
  const [customVoiceId, setCustomVoiceId] = useState('');
  const [customVoiceName, setCustomVoiceName] = useState('');
  const [savedVoices, setSavedVoices] = useState<CustomVoice[]>([]);
  const [modelId, setModelId] = useState(TTS_MODELS[0].id);
  
  // Project Context
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string | null>(null);
  const [savingToProject, setSavingToProject] = useState(false);
  
  // Operation State
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<string[]>(['>> 系统就绪，等待任务...']);

  const addLog = (msg: string) => {
      setConsoleLogs(prev => [...prev.slice(-10), `>> ${msg}`]);
  };

  // Restore User Preference
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

  // Check text length on change to suggest splitting
  useEffect(() => {
      if (text.length > 1700 && !isSplitMode && step === 1) {
          addLog(`检测到长文本 (${text.length} 字符)，建议使用拆分功能。`);
      }
  }, [text]);

  const loadSavedVoices = async () => {
      try {
          const data = await storage.getToolData<{ voices: CustomVoice[] }>(STORAGE_KEY_VOICES);
          if (data && Array.isArray(data.voices)) {
              setSavedVoices(data.voices);
          } else {
              const remote = await storage.fetchRemoteToolData<{ voices: CustomVoice[] }>(STORAGE_KEY_VOICES);
              if (remote && Array.isArray(remote.voices)) {
                  setSavedVoices(remote.voices);
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
      await storage.saveToolData(STORAGE_KEY_VOICES, payload);
      storage.uploadToolData(STORAGE_KEY_VOICES, payload).catch(console.error);
  };

  const saveUserPref = (type: 'custom' | 'preset', id: string, name?: string) => {
      localStorage.setItem('lva_voice_pref', JSON.stringify({ type, id, name }));
  };

  const handleSaveVoice = async () => {
      if (!customVoiceId.trim() || !customVoiceName.trim()) return;
      const id = customVoiceId.trim();
      const name = customVoiceName.trim();
      const existingIndex = savedVoices.findIndex(v => v.id === id);
      let updatedList = [...savedVoices];
      if (existingIndex > -1) {
          updatedList[existingIndex] = { ...updatedList[existingIndex], name: name };
      } else {
          updatedList = [{ id, name, createdAt: Date.now() }, ...savedVoices];
      }
      await persistVoices(updatedList);
      saveUserPref('custom', id, name);
  };

  const handleDeleteVoice = async (id: string) => {
      if (!window.confirm("确定要删除这个收藏的声音吗？")) return;
      const updatedList = savedVoices.filter(v => v.id !== id);
      await persistVoices(updatedList);
      if (customVoiceId === id) {
          setCustomVoiceName('');
          setCustomVoiceId('');
          setSelectedPresetId(PRESET_VOICES[0].id);
          saveUserPref('preset', PRESET_VOICES[0].id);
      }
  };

  const handleSelectSavedVoice = (voice: CustomVoice) => {
      setCustomVoiceId(voice.id);
      setCustomVoiceName(voice.name);
      setSelectedPresetId('');
      saveUserPref('custom', voice.id, voice.name);
  };

  const handleSelectPreset = (id: string) => {
      setSelectedPresetId(id);
      setCustomVoiceId('');
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

  // --- Step 1: Split Text ---
  const handleSplitText = () => {
      if (!text) return;
      
      const limit = Math.ceil(text.length / 2);
      
      // Smart split logic: find closest sentence ending near middle
      let splitIdx = text.lastIndexOf('。', limit + 100);
      if (splitIdx === -1 || splitIdx < limit - 200) splitIdx = text.lastIndexOf('.', limit + 100);
      if (splitIdx === -1 || splitIdx < limit - 200) splitIdx = text.lastIndexOf('\n', limit + 100);
      
      if (splitIdx === -1) splitIdx = limit; // Hard split if no punctuation
      else splitIdx += 1; // Include punctuation

      setTextPart1(text.substring(0, splitIdx));
      setTextPart2(text.substring(splitIdx));
      
      setIsSplitMode(true);
      setStep(2);
      addLog(`文本已拆分为两部分 (P1: ${splitIdx}, P2: ${text.length - splitIdx})`);
  };

  const callTtsApi = async (txt: string, streamMode: boolean): Promise<string> => {
      const effectiveVoiceId = customVoiceId.trim() || selectedPresetId;
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: txt,
          voice_id: effectiveVoiceId,
          model_id: modelId,
          stream: streamMode
        })
      });

      if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Generation failed');
      }

      if (streamMode) {
          const blob = await response.blob();
          return URL.createObjectURL(blob);
      } else {
          const data = await response.json();
          return data.url;
      }
  };

  // --- Preview (Single) ---
  const handlePreview = async () => {
    if (!text.trim()) return;
    setStreaming(true);
    addLog("开始试听片段生成...");
    try {
        const url = await callTtsApi(text.substring(0, 300), true);
        if (audioRef.current) {
            audioRef.current.src = url;
            audioRef.current.play();
        }
        addLog("试听片段播放中");
    } catch (e: any) {
        setErrorMsg(e.message);
        addLog(`错误: ${e.message}`);
    } finally {
        setStreaming(false);
    }
  };

  // --- Step 2: Generate Dual Audio ---
  const handleGenerateDual = async () => {
      if (!textPart1 || !textPart2) return;
      setLoading(true);
      setErrorMsg(null);
      setAudioUrl1(null);
      setAudioUrl2(null);
      
      addLog("开始并行生成两段语音...");

      try {
          // Parallel Generation using non-streaming (cached) endpoint for better quality/stability
          const [res1, res2] = await Promise.all([
              callTtsApi(textPart1, false),
              callTtsApi(textPart2, false)
          ]);

          setAudioUrl1(res1);
          setAudioUrl2(res2);
          addLog("两段语音生成完毕，进入合并阶段");
          setStep(3);
      } catch (e: any) {
          setErrorMsg(e.message);
          addLog(`生成失败: ${e.message}`);
      } finally {
          setLoading(false);
      }
  };

  // --- Single Generate (No Split) ---
  const handleGenerateSingle = async () => {
      setLoading(true);
      try {
          const url = await callTtsApi(text, false);
          setFinalAudioUrl(url);
          if (audioRef.current) audioRef.current.src = url;
          addLog("完整语音生成成功");
      } catch (e: any) {
          setErrorMsg(e.message);
          addLog(`生成失败: ${e.message}`);
      } finally {
          setLoading(false);
      }
  };

  // --- Step 3: Merge Audio ---
  const handleMerge = async () => {
      if (!audioUrl1 || !audioUrl2) return;
      setLoading(true);
      addLog("开始合并音频...");

      try {
          // Fetch both blobs
          const [blob1, blob2] = await Promise.all([
              fetch(audioUrl1).then(r => r.blob()),
              fetch(audioUrl2).then(r => r.blob())
          ]);

          // Concatenate Blobs (MP3 allows simple concatenation)
          const mergedBlob = new Blob([blob1, blob2], { type: 'audio/mpeg' });
          
          // Upload merged file to R2 to get a permanent URL
          // We use the storage service logic manually here to upload a Blob
          const fileNameSafe = (projectTitle || `merged_${Date.now()}`).replace(/[\\/:*?"<>|]/g, "_");
          const file = new File([mergedBlob], `${fileNameSafe}.mp3`, { type: 'audio/mpeg' });
          const uploadedUrl = await storage.uploadFile(file, projectId || 'temp_voice_studio');
          
          setFinalAudioUrl(uploadedUrl);
          if (audioRef.current) audioRef.current.src = uploadedUrl;
          
          addLog("合并并上传成功！");
          
          // If in project context, auto save
          if (projectId) {
              await handleSaveToProject(uploadedUrl);
          }

      } catch (e: any) {
          setErrorMsg(e.message);
          addLog(`合并失败: ${e.message}`);
      } finally {
          setLoading(false);
      }
  };

  const handleSaveToProject = async (urlOverride?: string) => {
      const targetUrl = urlOverride || finalAudioUrl;
      if (!targetUrl || !projectId) return;
      if (targetUrl.startsWith('blob:')) {
          alert("请先生成完整音频（非试听）以获取可保存的文件。");
          return;
      }

      setSavingToProject(true);
      try {
          const project = await storage.getProject(projectId);
          if (project) {
               const updated = { 
                   ...project, 
                   audioFile: targetUrl,
                   moduleTimestamps: { ...(project.moduleTimestamps || {}), audio_file: Date.now() }
               };
               await storage.saveProject(updated);
               storage.uploadProjects().catch(console.error);
               addLog(`已保存到项目: ${project.title}`);
               alert(`已成功保存到项目 "${project.title}" 的音频文件中！`);
          }
      } catch(e: any) {
          alert("保存失败: " + e.message);
      } finally {
          setSavingToProject(false);
      }
  };

  const savedVoiceMatch = savedVoices.find(v => v.id === customVoiceId.trim());
  const isCurrentIdSaved = !!savedVoiceMatch;

  const downloadFileName = projectTitle 
      ? `${projectTitle.replace(/[\\/:*?"<>|]/g, "_")}.mp3`
      : `tts_${Date.now()}.mp3`;

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#F8F9FC] overflow-hidden">
      {/* Sidebar */}
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
                className="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-violet-300 cursor-pointer text-slate-700"
             >
                {TTS_MODELS.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}
             </select>
          </div>

          {/* Custom Input */}
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
                        <button onClick={handleSaveVoice} disabled={!customVoiceName.trim()} className={`px-3 py-2 text-white rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${isCurrentIdSaved ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-900 hover:bg-violet-600'}`}>
                            {isCurrentIdSaved ? <RefreshCw className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                            <span className="text-xs font-bold">{isCurrentIdSaved ? "更新" : "收藏"}</span>
                        </button>
                     </div>
                     {isCurrentIdSaved && (
                         <div className="flex items-center justify-between px-2 py-1 bg-slate-50 rounded border border-slate-100">
                             <span className="text-[10px] text-slate-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500"/> 已存在</span>
                             <button onClick={() => handleDeleteVoice(customVoiceId)} className="text-[10px] text-rose-500 hover:text-rose-700 flex items-center gap-1"><Trash2 className="w-3 h-3" /> 删除</button>
                         </div>
                     )}
                 </div>
             )}
          </div>

          {/* Saved Voices */}
          {savedVoices.length > 0 && (
              <div className="shrink-0">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block flex items-center gap-1"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /> 我的收藏</label>
                <div className="space-y-2">
                    {savedVoices.map(voice => (
                        <div key={voice.id} onClick={() => handleSelectSavedVoice(voice)} className={`group p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${customVoiceId === voice.id ? 'bg-violet-50 border-violet-200 shadow-sm' : 'bg-white border-slate-100 hover:border-violet-100 hover:bg-slate-50'}`}>
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${customVoiceId === voice.id ? 'bg-violet-500 text-white' : 'bg-amber-100 text-amber-600'}`}>{voice.name[0]}</div>
                                <div className="min-w-0 flex-1"><div className={`text-sm font-bold truncate ${customVoiceId === voice.id ? 'text-violet-700' : 'text-slate-700'}`}>{voice.name}</div></div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteVoice(voice.id); }} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        </div>
                    ))}
                </div>
              </div>
          )}

          {/* Presets */}
          <div className="shrink-0">
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">系统预置</label>
            <select
                value={customVoiceId ? "" : selectedPresetId}
                onChange={(e) => { if (e.target.value) handleSelectPreset(e.target.value); }}
                className={`w-full px-3 py-3 text-xs font-bold bg-white border border-slate-200 rounded-xl outline-none focus:border-violet-300 cursor-pointer transition-colors ${customVoiceId ? 'text-slate-400 bg-slate-50' : 'text-slate-700'}`}
            >
                {customVoiceId && <option value="" disabled>-- 自定义 Voice ID 激活中 --</option>}
                {PRESET_VOICES.map(voice => (<option key={voice.id} value={voice.id}>{voice.name} · {voice.gender}</option>))}
            </select>
          </div>
          
          {/* Console */}
          <div className="flex-1 flex flex-col justify-end min-h-[150px]">
             <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> 生成进度</label>
             <div className="bg-slate-900 rounded-xl p-4 flex-1 border border-slate-800 shadow-inner flex flex-col">
                <div className="flex flex-col gap-2 font-mono text-[10px] leading-relaxed overflow-y-auto custom-scrollbar h-32">
                    {consoleLogs.map((log, i) => (
                        <div key={i} className="text-slate-300">{log}</div>
                    ))}
                    {errorMsg && <div className="text-rose-500 font-bold">&gt;&gt; 错误: {errorMsg}</div>}
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
           <div className="max-w-4xl mx-auto h-full flex flex-col gap-6">
              
              {/* Stepper / Controls for Split Flow */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      {isSplitMode ? (
                          <div className="flex items-center gap-2">
                              <span className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold ${step === 1 ? 'bg-violet-100 text-violet-700' : 'text-slate-400'}`}>1. 拆分</span>
                              <ArrowRight className="w-3 h-3 text-slate-300" />
                              <span className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold ${step === 2 ? 'bg-violet-100 text-violet-700' : 'text-slate-400'}`}>2. 生成</span>
                              <ArrowRight className="w-3 h-3 text-slate-300" />
                              <span className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold ${step === 3 ? 'bg-violet-100 text-violet-700' : 'text-slate-400'}`}>3. 合并</span>
                          </div>
                      ) : (
                          <span className="text-sm font-bold text-slate-500">普通模式</span>
                      )}
                      
                      {projectTitle && (
                          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg">
                              <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
                              <span className="text-xs font-bold text-slate-600 max-w-[150px] truncate">{projectTitle}</span>
                          </div>
                      )}
                  </div>
                  
                  <div className="flex gap-2">
                      {!isSplitMode && (
                          <button 
                            onClick={handleSplitText}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-2 transition-all"
                            title="文本超过1700字时建议使用"
                          >
                              <Split className="w-3.5 h-3.5" /> 拆分文本
                          </button>
                      )}
                      {isSplitMode && step === 2 && (
                          <button 
                            onClick={handleGenerateDual}
                            disabled={loading}
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-violet-500/20"
                          >
                              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} 
                              语音生成 (2段)
                          </button>
                      )}
                      {isSplitMode && step === 3 && (
                          <button 
                            onClick={handleMerge}
                            disabled={loading}
                            className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-fuchsia-500/20"
                          >
                              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Merge className="w-3.5 h-3.5" />} 
                              合并语音 & 上传
                          </button>
                      )}
                  </div>
              </div>

              {/* Text Input Area */}
              <div className="flex-1 flex flex-col min-h-[300px]">
                {isSplitMode ? (
                    <div className="flex gap-4 h-full">
                        <div className="flex-1 bg-white rounded-2xl border border-slate-200 flex flex-col shadow-sm">
                            <div className="p-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl flex justify-between">
                                <span className="text-xs font-bold text-slate-500">第一部分</span>
                                <span className="text-xs font-mono text-slate-400">{textPart1.length} chars</span>
                            </div>
                            <textarea 
                                value={textPart1}
                                onChange={(e) => setTextPart1(e.target.value)}
                                className="flex-1 p-4 text-slate-700 text-sm leading-relaxed resize-none outline-none" 
                            />
                            {audioUrl1 && <div className="p-2 border-t bg-slate-50 rounded-b-2xl"><audio controls src={audioUrl1} className="w-full h-8" /></div>}
                        </div>
                        <div className="flex-1 bg-white rounded-2xl border border-slate-200 flex flex-col shadow-sm">
                            <div className="p-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl flex justify-between">
                                <span className="text-xs font-bold text-slate-500">第二部分</span>
                                <span className="text-xs font-mono text-slate-400">{textPart2.length} chars</span>
                            </div>
                            <textarea 
                                value={textPart2}
                                onChange={(e) => setTextPart2(e.target.value)}
                                className="flex-1 p-4 text-slate-700 text-sm leading-relaxed resize-none outline-none" 
                            />
                            {audioUrl2 && <div className="p-2 border-t bg-slate-50 rounded-b-2xl"><audio controls src={audioUrl2} className="w-full h-8" /></div>}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 h-full">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                            <div className="flex items-center gap-2">
                                <Languages className="w-4 h-4 text-slate-400" />
                                <span className="text-xs font-bold text-slate-600 uppercase">
                                    {projectTitle ? `项目文案: ${projectTitle}` : '文本输入'}
                                </span>
                            </div>
                            <span className="text-xs font-mono text-slate-400">
                                {text.length} chars / {(text.match(/[\u4e00-\u9fa5]/g) || []).length} 汉字
                            </span>
                        </div>
                        <textarea 
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          className="flex-1 p-6 text-slate-700 text-base leading-relaxed resize-none outline-none font-medium"
                          placeholder="在此输入或粘贴需要转换的文本..."
                        />
                    </div>
                )}
              </div>

              {/* Bottom Action Bar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 sticky bottom-6">
                 {finalAudioUrl && (
                   <div className="flex items-center gap-4 flex-1 w-full md:w-auto bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <audio ref={audioRef} controls className="w-full h-8 outline-none" src={finalAudioUrl} />
                      <a href={finalAudioUrl} download={downloadFileName} className="p-2 text-slate-400 hover:text-violet-600 transition-colors" title="下载音频">
                        <Download className="w-4 h-4" />
                      </a>
                      
                      {projectId && !finalAudioUrl.startsWith('blob:') && (
                         <>
                            <div className="w-px h-4 bg-slate-200 mx-2" />
                            <button 
                                onClick={() => handleSaveToProject()}
                                disabled={savingToProject}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                            >
                                {savingToProject ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                保存到项目
                            </button>
                         </>
                      )}
                   </div>
                 )}
                 
                 <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    {!isSplitMode ? (
                        <>
                            <button 
                              onClick={handlePreview}
                              disabled={loading || streaming || !text}
                              className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 bg-white border border-slate-200 hover:border-violet-300 hover:text-violet-600 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                               {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                               试听片段
                            </button>
                            
                            <button 
                              onClick={handleGenerateSingle}
                              disabled={loading || streaming || !text}
                              className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-slate-900 hover:bg-violet-600 transition-all shadow-lg hover:shadow-violet-500/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                               {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
                               生成完整音频
                            </button>
                        </>
                    ) : (
                        <div className="text-xs text-slate-400 font-bold italic">
                            分步模式进行中...
                        </div>
                    )}
                 </div>
              </div>

           </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceStudio;
