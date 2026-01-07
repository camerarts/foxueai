
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, Play, Square, Download, Loader2, Save, Trash2, Volume2, Sparkles, Languages, Settings2, RefreshCw, Fingerprint, Star, Plus, CheckCircle2, FileAudio, Cpu, Pencil, Activity, Split, Merge, Scissors, ArrowRight, FolderOpen, BarChart3, Calendar, CloudUpload, Scaling, Radio, History, Clock, PlayCircle, CloudCheck } from 'lucide-react';
import * as storage from '../services/storageService';

// Default fallback voices
const DEFAULT_ELEVEN_VOICE = '21m00Tcm4TlvDq8ikWAM'; // Rachel
const DEFAULT_AURA_VOICE = 'English_expressive_narrator'; // Updated default from Aura docs

type TtsProvider = 'elevenlabs' | 'aura';

const TTS_MODELS: Record<TtsProvider, { id: string; name: string }[]> = {
  elevenlabs: [
    { id: 'eleven_v3', name: 'Eleven v3 (Default)' },
    { id: 'eleven_multilingual_v2', name: 'Multilingual v2' },
    { id: 'eleven_turbo_v2', name: 'Turbo v2 (Fast)' },
  ],
  aura: [
    { id: 'speech-2.6-turb', name: 'Speech 2.6 Turbo (Recommended)' },
    { id: 'speech-2.5', name: 'Speech 2.5 Standard' },
  ]
};

interface CustomVoice {
    id: string;
    name: string;
    createdAt: number;
    provider?: TtsProvider;
}

interface UsageLog {
    timestamp: number;
    charCount: number;
    provider?: TtsProvider;
}

interface HistoryItem {
    id: string;
    text: string;
    audioUrl: string;
    timestamp: number;
    provider: TtsProvider;
    isCloud?: boolean; // True if saved to R2
}

const STORAGE_KEY_VOICES = 'custom_voices';
const STORAGE_KEY_STATS = 'voice_usage_stats';
const STORAGE_KEY_HISTORY = 'voice_gen_history';

const VoiceStudio: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Workflow State
  const [step, setStep] = useState(1);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50);

  // Text State
  const [text, setText] = useState('');
  const [textPart1, setTextPart1] = useState('');
  const [textPart2, setTextPart2] = useState('');
  
  // Audio State
  const [audioUrl1, setAudioUrl1] = useState<string | null>(null);
  const [audioUrl2, setAudioUrl2] = useState<string | null>(null);
  const [finalAudioUrl, setFinalAudioUrl] = useState<string | null>(null);

  // Voice State
  const [provider, setProvider] = useState<TtsProvider>('elevenlabs');
  const [customVoiceId, setCustomVoiceId] = useState('');
  const [customVoiceName, setCustomVoiceName] = useState('');
  const [savedVoices, setSavedVoices] = useState<CustomVoice[]>([]);
  const [modelId, setModelId] = useState('');
  
  // Statistics & History State
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [chartPeriod, setChartPeriod] = useState<number>(7);
  const [showHistory, setShowHistory] = useState(true);
  
  // Project Context
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string | null>(null);
  const [savingToProject, setSavingToProject] = useState(false);
  const [isSavedToProject, setIsSavedToProject] = useState(false);
  
  // Operation State
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<string[]>(['>> 系统就绪，等待任务...']);

  const addLog = (msg: string) => {
      const time = new Date().toLocaleTimeString('en-US', { hour12: false });
      setConsoleLogs(prev => [...prev.slice(-19), `[${time}] ${msg}`]);
  };

  // Auto-scroll logs
  useEffect(() => {
      if (logsContainerRef.current) {
          logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
      }
  }, [consoleLogs]);

  // Set default model when provider changes
  useEffect(() => {
      if (TTS_MODELS[provider] && TTS_MODELS[provider].length > 0) {
          setModelId(TTS_MODELS[provider][0].id);
      }
      setCustomVoiceId(''); 
      setCustomVoiceName('');
  }, [provider]);

  // Restore User Preference & Load Data
  useEffect(() => {
    const pref = localStorage.getItem('lva_voice_pref');
    if (pref) {
        try {
            const parsed = JSON.parse(pref);
            if (parsed.type === 'custom') {
                if (parsed.provider) setProvider(parsed.provider); 
                setCustomVoiceId(parsed.id);
                setCustomVoiceName(parsed.name || '');
            }
        } catch (e) {
            console.error("Failed to parse voice preference", e);
        }
    }
    loadData();
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
  }, [location]);

  useEffect(() => {
      const limit = provider === 'aura' ? 1000 : 2500;
      if (text.length > limit && !isSplitMode && step === 1) {
          addLog(`检测到长文本 (${text.length} 字符)，Aura 建议超过 ${limit} 字时使用拆分功能。`);
      }
  }, [text, provider]);

  const loadData = async () => {
      try {
          // Load Voices
          const voiceData = await storage.getToolData<{ voices: CustomVoice[] }>(STORAGE_KEY_VOICES);
          if (voiceData && Array.isArray(voiceData.voices)) {
              setSavedVoices(voiceData.voices);
          } else {
              const remote = await storage.fetchRemoteToolData<{ voices: CustomVoice[] }>(STORAGE_KEY_VOICES);
              if (remote && Array.isArray(remote.voices)) {
                  setSavedVoices(remote.voices);
                  await storage.saveToolData(STORAGE_KEY_VOICES, remote);
              }
          }

          // Load Stats
          const statsData = await storage.getToolData<{ logs: UsageLog[] }>(STORAGE_KEY_STATS);
          if (statsData && Array.isArray(statsData.logs)) {
              setUsageLogs(statsData.logs);
          }

          // Load History
          const historyData = await storage.getToolData<{ items: HistoryItem[] }>(STORAGE_KEY_HISTORY);
          if (historyData && Array.isArray(historyData.items)) {
              setHistoryItems(historyData.items);
          }
      } catch (e) {
          console.error("Failed to load data", e);
      }
  };

  const persistVoices = async (voices: CustomVoice[]) => {
      setSavedVoices(voices);
      const payload = { voices };
      await storage.saveToolData(STORAGE_KEY_VOICES, payload);
      storage.uploadToolData(STORAGE_KEY_VOICES, payload).catch(console.error);
  };

  const persistHistory = async (items: HistoryItem[]) => {
      setHistoryItems(items);
      const payload = { items };
      await storage.saveToolData(STORAGE_KEY_HISTORY, payload);
      storage.uploadToolData(STORAGE_KEY_HISTORY, payload).catch(console.error);
  };

  const recordUsage = async (charCount: number) => {
      const newLog: UsageLog = { timestamp: Date.now(), charCount, provider };
      const updatedLogs = [...usageLogs, newLog];
      setUsageLogs(updatedLogs);
      
      const payload = { logs: updatedLogs };
      await storage.saveToolData(STORAGE_KEY_STATS, payload);
      storage.uploadToolData(STORAGE_KEY_STATS, payload).catch(console.error);
  };

  const saveUserPref = (type: 'custom', id: string, name?: string) => {
      localStorage.setItem('lva_voice_pref', JSON.stringify({ type, id, name, provider }));
  };

  const handleSaveVoice = async () => {
      if (!customVoiceId.trim() || !customVoiceName.trim()) return;
      const id = customVoiceId.trim();
      const name = customVoiceName.trim();
      const existingIndex = savedVoices.findIndex(v => v.id === id);
      let updatedList = [...savedVoices];
      if (existingIndex > -1) {
          updatedList[existingIndex] = { ...updatedList[existingIndex], name: name, provider };
      } else {
          updatedList = [{ id, name, createdAt: Date.now(), provider }, ...savedVoices];
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
      }
  };

  const handleSelectSavedVoice = (voice: CustomVoice) => {
      if (voice.provider && voice.provider !== provider) {
          setProvider(voice.provider);
      }
      setCustomVoiceId(voice.id);
      setCustomVoiceName(voice.name);
      saveUserPref('custom', voice.id, voice.name);
  };

  const handleCustomIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setCustomVoiceId(val);
      if (val) {
          saveUserPref('custom', val, customVoiceName);
      }
  };

  // --- History Logic ---
  const addToHistory = async (blobUrl: string, txt: string, isCloud = false) => {
      const newItem: HistoryItem = {
          id: crypto.randomUUID(),
          text: txt.substring(0, 100) + (txt.length > 100 ? '...' : ''),
          audioUrl: blobUrl,
          timestamp: Date.now(),
          provider,
          isCloud
      };
      // Keep only last 10
      const updatedList = [newItem, ...historyItems].slice(0, 10);
      await persistHistory(updatedList);
      return newItem.id;
  };

  const updateHistoryItemUrl = async (id: string, newUrl: string) => {
      const updatedList = historyItems.map(item => 
          item.id === id ? { ...item, audioUrl: newUrl, isCloud: true } : item
      );
      await persistHistory(updatedList);
  };

  const deleteHistoryItem = async (id: string) => {
      if (!window.confirm("确定删除这条记录吗？")) return;
      const updatedList = historyItems.filter(i => i.id !== id);
      await persistHistory(updatedList);
  };

  const playHistoryItem = (item: HistoryItem) => {
      setFinalAudioUrl(item.audioUrl);
      if (audioRef.current) {
          audioRef.current.src = item.audioUrl;
          audioRef.current.play().catch(console.warn);
      }
  };

  // --- Core API Logic ---
  const performSmartSplit = (ratio: number) => {
      if (!text) return;
      const targetLen = Math.floor(text.length * (ratio / 100));
      const delimiters = ['\n', '。', '！', '？', '.', '!', '?'];
      let splitIndex = targetLen;
      let found = false;
      for (let offset = 0; offset < text.length; offset++) {
          const right = targetLen + offset;
          const left = targetLen - offset;
          if (right < text.length && delimiters.includes(text[right])) {
              splitIndex = right + 1; found = true; break;
          }
          if (left >= 0 && delimiters.includes(text[left])) {
              splitIndex = left + 1; found = true; break;
          }
      }
      if (!found) splitIndex = targetLen;
      setTextPart1(text.substring(0, splitIndex));
      setTextPart2(text.substring(splitIndex));
  };

  const handleSplitText = () => {
      if (!text) return;
      const limit = provider === 'aura' ? 1000 : 2500;
      if (text.length <= limit) {
          alert(`当前渠道建议在文本超过 ${limit} 字符时使用拆分功能。您的文本较短，直接生成即可。`);
          return;
      }
      setSplitRatio(50);
      performSmartSplit(50);
      setIsSplitMode(true);
      setStep(2);
      addLog(`文本已进入拆分模式`);
  };

  const handleRatioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value);
      setSplitRatio(val);
      performSmartSplit(val);
  };

  const callTtsApi = async (txt: string, streamMode: boolean): Promise<string> => {
      const defaultId = provider === 'elevenlabs' ? DEFAULT_ELEVEN_VOICE : DEFAULT_AURA_VOICE;
      const effectiveVoiceId = customVoiceId.trim() || defaultId;
      
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: txt,
          voice_id: effectiveVoiceId,
          model_id: modelId,
          stream: streamMode,
          provider: provider
        })
      });

      if (!response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
              const err = await response.json();
              throw new Error(err.error || 'Generation failed');
          } else {
              const text = await response.text();
              console.error("API Non-JSON Error:", text.substring(0, 200));
              throw new Error(`服务繁忙或超时 (${response.status})。请尝试拆分文本或稍后重试。`);
          }
      }

      if (streamMode) {
          const reader = response.body?.getReader();
          if (!reader) throw new Error("浏览器不支持流式读取");
          const chunks: Uint8Array[] = [];
          let receivedLength = 0;
          while(true) {
              const {done, value} = await reader.read();
              if (done) break;
              chunks.push(value);
              receivedLength += value.length;
          }
          if (receivedLength === 0) throw new Error("服务端返回了空数据流 (或生成失败)");
          const blob = new Blob(chunks, { type: 'audio/mpeg' });
          addLog(`--> 数据接收完成: ${(receivedLength/1024).toFixed(1)} KB`);
          return URL.createObjectURL(blob);
      } else {
          const data = await response.json();
          if (!data.url) throw new Error("API 返回了成功状态，但未包含有效的音频 URL");
          return data.url;
      }
  };

  // --- Single Generate (Stream + History) - NO AUTO UPLOAD ---
  const handleGenerateSingle = async () => {
      if (!text) {
          alert("请输入文本内容");
          return;
      }

      setLoading(true);
      setErrorMsg(null);
      setIsSavedToProject(false);
      setFinalAudioUrl(null); 

      addLog(`🚀 开始生成任务 (${provider === 'elevenlabs' ? 'ElevenLabs' : 'Aura'})...`);

      try {
          addLog("--> 正在请求音频流...");
          const blobUrl = await callTtsApi(text, true); 
          
          if (!blobUrl) throw new Error("API 返回了空数据");

          addLog("--> ✅ 流式生成成功，准备播放");
          setFinalAudioUrl(blobUrl);
          setLoading(false); 
          
          if (audioRef.current) {
              audioRef.current.src = blobUrl;
              audioRef.current.play().catch(console.warn);
          }

          // 1. Add to History (Ephemeral Blob URL first)
          await addToHistory(blobUrl, text, false);
          
          // 2. Record usage stats
          recordUsage(text.length).catch(console.error);
          
          addLog("ℹ️ 如需永久保存，请点击右下角“上传并保存”");

      } catch (e: any) {
          setLoading(false);
          setErrorMsg(e.message);
          addLog(`❌ 生成失败: ${e.message}`);
      }
  };

  // --- Preview (Single) ---
  const handlePreview = async () => {
    if (!text.trim()) return;
    setStreaming(true);
    addLog("开始试听片段生成 (Stream)...");
    try {
        const url = await callTtsApi(text.substring(0, 300), true);
        if (audioRef.current) {
            audioRef.current.src = url;
            audioRef.current.play();
        }
        addLog("✅ 试听片段播放中");
    } catch (e: any) {
        setErrorMsg(e.message);
        addLog(`❌ 错误: ${e.message}`);
    } finally {
        setStreaming(false);
    }
  };

  // ... [Other Handlers like handleGenerateDual, handleMerge, handleSaveToProject remain same] ...
  const performMerge = async (u1: string, u2: string): Promise<string> => {
      const response = await fetch('/api/audio/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url1: u1, url2: u2, projectId: projectId })
      });
      if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Merge failed');
      }
      const data = await response.json();
      return data.url;
  };

  const handleGenerateDual = async () => {
      if (!textPart1 || !textPart2) return;
      setLoading(true);
      setErrorMsg(null);
      setAudioUrl1(null);
      setAudioUrl2(null);
      setFinalAudioUrl(null);
      setIsSavedToProject(false);
      addLog(`🚀 开始并行生成两段语音 (${provider === 'elevenlabs' ? 'ElevenLabs' : 'Aura'})...`);
      try {
          const [res1, res2] = await Promise.all([callTtsApi(textPart1, false), callTtsApi(textPart2, false)]);
          setAudioUrl1(res1);
          setAudioUrl2(res2);
          recordUsage(textPart1.length + textPart2.length).catch(console.error);
          addLog("✅ 生成完毕，正在请求合并...");
          setStep(3); 
          const mergedUrl = await performMerge(res1, res2);
          setFinalAudioUrl(mergedUrl);
          if (audioRef.current) audioRef.current.src = mergedUrl;
          addLog("✅ 合并成功！");
          if (projectId) {
              addLog("💾 正在保存合并文件...");
              try { await handleSaveToProject(mergedUrl); } catch (saveErr: any) { console.error("Auto save failed", saveErr); addLog(`⚠️ 自动保存失败: ${saveErr.message}`); }
          } else { addLog("ℹ️ 未关联项目，跳过保存"); }
      } catch (e: any) { setErrorMsg(e.message); addLog(`❌ 流程失败: ${e.message}`); } finally { setLoading(false); }
  };

  const handleMerge = async () => {
      if (!audioUrl1 || !audioUrl2) return;
      setLoading(true);
      setIsSavedToProject(false);
      addLog("🔧 手动请求合并...");
      try {
          const mergedUrl = await performMerge(audioUrl1, audioUrl2);
          setFinalAudioUrl(mergedUrl);
          if (audioRef.current) audioRef.current.src = mergedUrl;
          addLog("✅ 合并成功！");
          if (projectId) { try { await handleSaveToProject(mergedUrl); } catch (e: any) { addLog(`⚠️ 自动保存失败: ${e.message}`); } }
      } catch (e: any) { setErrorMsg(e.message); addLog(`❌ 合并失败: ${e.message}`); } finally { setLoading(false); }
  };

  const handleSaveToProject = async (urlOverride?: string) => {
      let targetUrl = urlOverride || finalAudioUrl;
      if (!projectId) { console.warn("No Project ID"); return; }
      if (!targetUrl) { console.warn("No Audio URL"); return; }
      setSavingToProject(true);
      try {
          if (targetUrl.startsWith('blob:')) {
              addLog("🔄 检测到本地临时音频，正在上传...");
              const blob = await fetch(targetUrl).then(r => r.blob());
              const file = new File([blob], `tts_${Date.now()}.mp3`, { type: 'audio/mpeg' });
              
              const cloudUrl = await storage.uploadFile(file, projectId);
              addLog("✅ 上传成功！");
              
              // Try to find the history item with the blob URL and update it to the cloud URL
              // This persists the history item across page refreshes
              const historyItemToUpdate = historyItems.find(i => i.audioUrl === targetUrl);
              if (historyItemToUpdate) {
                  await updateHistoryItemUrl(historyItemToUpdate.id, cloudUrl);
                  addLog("✅ 历史记录已同步至云端");
              }

              targetUrl = cloudUrl; 
              setFinalAudioUrl(cloudUrl); 
          }
          const project = await storage.getProject(projectId);
          if (project) {
               const updated = { 
                   ...project, 
                   audioFile: targetUrl,
                   moduleTimestamps: { ...(project.moduleTimestamps || {}), audio_file: Date.now() }
               };
               await storage.saveProject(updated);
               storage.uploadProjects().catch(console.error);
               addLog(`✅ 项目音频已关联`);
               setIsSavedToProject(true);
          }
      } catch(e: any) { addLog(`❌ 保存失败: ${e.message}`); } finally { setSavingToProject(false); }
  };

  const downloadFileName = projectTitle ? `${projectTitle.replace(/[\\/:*?"<>|]/g, "_")}.mp3` : `tts_${Date.now()}.mp3`;

  // --- Filter Logic ---
  const filteredUsageLogs = useMemo(() => usageLogs.filter(log => (log.provider || 'elevenlabs') === provider), [usageLogs, provider]);
  const filteredSavedVoices = useMemo(() => savedVoices.filter(voice => (voice.provider || 'elevenlabs') === provider), [savedVoices, provider]);
  const totalCharsUsed = useMemo(() => filteredUsageLogs.reduce((acc, log) => acc + log.charCount, 0), [filteredUsageLogs]);
  const chartData = useMemo(() => {
      const now = new Date();
      const labels = [], data = [];
      const dateMap = new Map<string, number>();
      for (let i = chartPeriod - 1; i >= 0; i--) {
          const d = new Date(now); d.setDate(d.getDate() - i);
          const key = `${d.getMonth() + 1}/${d.getDate()}`;
          dateMap.set(key, 0); labels.push(key);
      }
      filteredUsageLogs.forEach(log => {
          const d = new Date(log.timestamp); const key = `${d.getMonth() + 1}/${d.getDate()}`;
          if (dateMap.has(key)) dateMap.set(key, (dateMap.get(key) || 0) + log.charCount);
      });
      labels.forEach(key => data.push(dateMap.get(key) || 0));
      return { labels, data, maxVal: Math.max(...data, 1) };
  }, [filteredUsageLogs, chartPeriod]);

  // Determine if current custom ID is already saved
  const isCurrentIdSaved = useMemo(() => {
    return savedVoices.some(v => v.id === customVoiceId.trim());
  }, [savedVoices, customVoiceId]);

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#F8F9FC] overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm h-full flex-shrink-0">
        <div className="p-6 pb-2">
          <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600 mb-2 flex items-center gap-2">
            <Mic className="w-6 h-6 text-violet-600" />
            语音工坊
          </h1>
          <p className="text-xs text-slate-500 font-medium">ElevenLabs & Aura 驱动的高品质 TTS</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6 custom-scrollbar flex flex-col">
          {/* Provider Selection */}
          <div className="shrink-0">
             <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                <Radio className="w-3.5 h-3.5" /> 渠道渠道
             </label>
             <div className="flex bg-slate-100 p-1 rounded-xl">
                 <button onClick={() => setProvider('elevenlabs')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${provider === 'elevenlabs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>ElevenLabs</button>
                 <button onClick={() => setProvider('aura')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${provider === 'aura' ? 'bg-white text-fuchsia-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Aura</button>
             </div>
          </div>

          {/* Model Selection */}
          <div className="shrink-0">
             <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Cpu className="w-3.5 h-3.5" /> 语音模型</label>
             <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-violet-300 cursor-pointer text-slate-700">
                {(TTS_MODELS[provider] || []).map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}
             </select>
          </div>

          {/* Custom Input */}
          <div className="shrink-0">
             <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center justify-between"><span>自定义 Voice ID</span>{customVoiceId && <span className="text-[10px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded font-bold">优先使用</span>}</label>
             <div className="relative mb-2">
                 <input type="text" value={customVoiceId} onChange={handleCustomIdChange} placeholder={provider === 'elevenlabs' ? "粘贴 ElevenLabs Voice ID..." : "粘贴 Aura Voice ID..."} className={`w-full pl-9 pr-3 py-3 text-xs bg-slate-50 border rounded-xl outline-none transition-all font-mono text-slate-600 ${customVoiceId ? 'border-violet-300 ring-2 ring-violet-500/10 bg-white shadow-sm' : 'border-slate-200 focus:border-violet-300'}`} />
                 <Fingerprint className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${customVoiceId ? 'text-violet-500' : 'text-slate-400'}`} />
             </div>
             {customVoiceId && (
                 <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-1">
                     <div className="flex gap-2">
                        <input type="text" value={customVoiceName} onChange={(e) => setCustomVoiceName(e.target.value)} placeholder="给声音起个名..." className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-violet-300" />
                        <button onClick={handleSaveVoice} disabled={!customVoiceName.trim()} className={`px-3 py-2 text-white rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${isCurrentIdSaved ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-900 hover:bg-violet-600'}`}>{isCurrentIdSaved ? <RefreshCw className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}<span className="text-xs font-bold">{isCurrentIdSaved ? "更新" : "收藏"}</span></button>
                     </div>
                     {isCurrentIdSaved && (<div className="flex items-center justify-between px-2 py-1 bg-slate-50 rounded border border-slate-100"><span className="text-[10px] text-slate-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500"/> 已存在</span><button onClick={() => handleDeleteVoice(customVoiceId)} className="text-[10px] text-rose-500 hover:text-rose-700 flex items-center gap-1"><Trash2 className="w-3 h-3" /> 删除</button></div>)}
                 </div>
             )}
          </div>

          {/* Saved Voices */}
          {filteredSavedVoices.length > 0 && (
              <div className="shrink-0">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block flex items-center gap-1"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /> 我的收藏 ({provider === 'elevenlabs' ? 'Eleven' : 'Aura'})</label>
                <div className="space-y-2">
                    {filteredSavedVoices.map(voice => (
                        <div key={voice.id} onClick={() => handleSelectSavedVoice(voice)} className={`group p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${customVoiceId === voice.id ? 'bg-violet-50 border-violet-200 shadow-sm' : 'bg-white border-slate-100 hover:border-violet-100 hover:bg-slate-50'}`}>
                            <div className="flex items-center gap-3 overflow-hidden"><div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${customVoiceId === voice.id ? 'bg-violet-500 text-white' : 'bg-amber-100 text-amber-600'}`}>{voice.name[0]}</div><div className="min-w-0 flex-1"><div className={`text-sm font-bold truncate ${customVoiceId === voice.id ? 'text-violet-700' : 'text-slate-700'}`}>{voice.name}</div><div className="text-[9px] text-slate-400 uppercase tracking-wider">{voice.provider || 'elevenlabs'}</div></div></div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => { e.stopPropagation(); handleDeleteVoice(voice.id); }} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></div>
                        </div>
                    ))}
                </div>
              </div>
          )}

          {/* Stats */}
          <div className="shrink-0 space-y-4 pt-4 border-t border-slate-100">
             <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> 用量统计 ({provider === 'elevenlabs' ? 'Eleven' : 'Aura'})</label>
             <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                 <table className="w-full text-xs text-left">
                     <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100"><tr><th className="py-2 px-3 w-10 text-center">#</th><th className="py-2 px-3">用户</th><th className="py-2 px-3 text-right">已使用字符</th></tr></thead>
                     <tbody className="text-slate-700"><tr><td className="py-2 px-3 text-center border-r border-slate-50">1</td><td className="py-2 px-3 border-r border-slate-50 font-bold">管理员</td><td className="py-2 px-3 text-right font-mono font-bold text-violet-600">{totalCharsUsed.toLocaleString()}</td></tr></tbody>
                 </table>
             </div>
             <div className="flex items-center justify-between"><span className="text-[10px] font-bold text-slate-400">每日趋势</span><div className="flex bg-slate-100 p-0.5 rounded-lg">{[7, 14, 30].map(d => (<button key={d} onClick={() => setChartPeriod(d)} className={`text-[9px] px-2 py-0.5 rounded-md font-bold transition-all ${chartPeriod === d ? 'bg-white shadow text-violet-600' : 'text-slate-400 hover:text-slate-600'}`}>{d}天</button>))}</div></div>
             <div className="h-28 flex items-end gap-1 pt-4 pb-1 border-b border-slate-100 relative">
                 {chartData.data.map((val, i) => (<div key={i} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end"><span className="text-[9px] text-slate-400 font-mono mb-0.5 opacity-100">{val > 0 ? val : ''}</span><div className="w-full bg-violet-200 hover:bg-violet-400 rounded-t-sm transition-all relative group-hover:shadow-md" style={{ height: `${(val / chartData.maxVal) * 100}%`, minHeight: val > 0 ? '4px' : '0' }}></div><span className="text-[8px] font-medium text-slate-400 -rotate-45 origin-top-left translate-y-2 whitespace-nowrap absolute bottom-0 left-1/2">{chartData.labels[i]}</span></div>))}
                 {chartData.data.every(v => v === 0) && (<div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-300 italic">暂无数据</div>)}
             </div>
          </div>
          
          {/* Console */}
          <div className="flex-1 flex flex-col justify-end min-h-[140px]">
             <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> 生成进度日志</label>
             <div className="bg-slate-900 rounded-xl p-4 flex-1 border border-slate-800 shadow-inner flex flex-col">
                <div ref={logsContainerRef} className="flex flex-col gap-2 font-mono text-[10px] leading-relaxed overflow-y-auto custom-scrollbar h-28 scroll-smooth">
                    {consoleLogs.map((log, i) => (<div key={i} className={`break-all ${log.includes('❌') ? 'text-rose-400 font-bold' : log.includes('✅') ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}>{log}</div>))}
                    {errorMsg && <div className="text-rose-500 font-bold border-l-2 border-rose-500 pl-2">错误: {errorMsg}</div>}
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F8F9FC] relative">
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
           <div className="max-w-4xl mx-auto h-full flex flex-col gap-6">
              {/* Stepper */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      {isSplitMode ? (
                          <div className="flex items-center gap-2"><span className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold ${step === 1 ? 'bg-violet-100 text-violet-700' : 'text-slate-400'}`}>1. 拆分</span><ArrowRight className="w-3 h-3 text-slate-300" /><span className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold ${step === 2 ? 'bg-violet-100 text-violet-700' : 'text-slate-400'}`}>2. 生成</span><ArrowRight className="w-3 h-3 text-slate-300" /><span className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold ${step === 3 ? 'bg-violet-100 text-violet-700' : 'text-slate-400'}`}>3. 合并</span></div>
                      ) : (<span className="text-sm font-bold text-slate-500">普通模式</span>)}
                      {projectTitle && (<div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg"><FolderOpen className="w-3.5 h-3.5 text-blue-500" /><span className="text-xs font-bold text-slate-600 max-w-[150px] truncate">{projectTitle}</span></div>)}
                  </div>
                  <div className="flex gap-2">
                      {!isSplitMode && (<button onClick={handleSplitText} disabled={text.length <= 1700} className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${text.length > 1700 ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`} title={text.length > 1700 ? "文本超过1700字时建议使用" : "文本未超过1700字，无需拆分"}><Split className="w-3.5 h-3.5" /> 拆分文本</button>)}
                      {isSplitMode && step === 2 && (<button onClick={handleGenerateDual} disabled={loading} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-violet-500/20">{loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} 语音合成</button>)}
                      {isSplitMode && step === 3 && (<button onClick={handleMerge} disabled={loading} className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-fuchsia-500/20">{loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Merge className="w-3.5 h-3.5" />} 手动重试合并</button>)}
                  </div>
              </div>

              {/* Text Input */}
              <div className="flex-1 flex flex-col min-h-[300px]">
                {isSplitMode ? (
                    <div className="flex flex-col h-full gap-4">
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-4"><div className="flex items-center gap-2 text-xs font-bold text-slate-500 whitespace-nowrap"><Scaling className="w-4 h-4 text-violet-500" /> 拆分比例 <span className="bg-slate-100 px-1.5 py-0.5 rounded text-violet-600 font-mono">{splitRatio}%</span></div><input type="range" min="10" max="90" value={splitRatio} onChange={handleRatioChange} className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-violet-600" title="拖动滑块调整第一部分内容的比例（智能识别句子边界）" /><span className="text-[10px] text-slate-400 font-medium">智能整句拆分</span></div>
                        <div className="flex gap-4 flex-1">
                            <div className="flex-1 bg-white rounded-2xl border border-slate-200 flex flex-col shadow-sm"><div className="p-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl flex justify-between"><span className="text-xs font-bold text-slate-500">第一部分</span><span className="text-xs font-mono text-slate-400">{textPart1.length} chars</span></div><textarea value={textPart1} onChange={(e) => setTextPart1(e.target.value)} className="flex-1 p-4 text-slate-700 text-sm leading-relaxed resize-none outline-none" />{audioUrl1 && <div className="p-2 border-t bg-slate-50 rounded-b-2xl"><audio controls src={audioUrl1} className="w-full h-8" /></div>}</div>
                            <div className="flex-1 bg-white rounded-2xl border border-slate-200 flex flex-col shadow-sm"><div className="p-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl flex justify-between"><span className="text-xs font-bold text-slate-500">第二部分</span><span className="text-xs font-mono text-slate-400">{textPart2.length} chars</span></div><textarea value={textPart2} onChange={(e) => setTextPart2(e.target.value)} className="flex-1 p-4 text-slate-700 text-sm leading-relaxed resize-none outline-none" />{audioUrl2 && <div className="p-2 border-t bg-slate-50 rounded-b-2xl"><audio controls src={audioUrl2} className="w-full h-8" /></div>}</div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 h-full">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                            <div className="flex items-center gap-2"><Languages className="w-4 h-4 text-slate-400" /><span className="text-xs font-bold text-slate-600 uppercase">{projectTitle ? `项目文案: ${projectTitle}` : '文本输入'}</span></div>
                            <div className="flex items-center gap-4"><span className="text-xs font-mono text-slate-400">{text.length} chars / {(text.match(/[\u4e00-\u9fa5]/g) || []).length} 汉字</span><button onClick={handleGenerateSingle} disabled={loading || streaming || !text} className="px-4 py-1.5 bg-slate-900 hover:bg-violet-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">{loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings2 className="w-3.5 h-3.5" />} 语音合成</button></div>
                        </div>
                        <textarea value={text} onChange={(e) => setText(e.target.value)} className="flex-1 p-6 text-slate-700 text-base leading-relaxed resize-none outline-none font-medium" placeholder="在此输入或粘贴需要转换的文本..." />
                    </div>
                )}
              </div>

              {/* Bottom Bar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 sticky bottom-6">
                 {finalAudioUrl && (
                   <div className="flex items-center gap-4 flex-1 w-full md:w-auto bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <audio ref={audioRef} controls className="w-full h-8 outline-none" src={finalAudioUrl} />
                      <a href={finalAudioUrl} download={downloadFileName} className="p-2 text-slate-400 hover:text-violet-600 transition-colors" title="下载音频"><Download className="w-4 h-4" /></a>
                      {projectId && (<><div className="w-px h-4 bg-slate-200 mx-2" /><button onClick={() => !isSavedToProject && handleSaveToProject()} disabled={savingToProject || isSavedToProject} className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${isSavedToProject ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-default' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-100'}`}>{savingToProject ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isSavedToProject ? <CheckCircle2 className="w-3.5 h-3.5" /> : (finalAudioUrl.startsWith('blob:') ? <CloudUpload className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />)}{isSavedToProject ? '已上传项目文件' : (finalAudioUrl.startsWith('blob:') ? '上传并保存' : '手动保存')}</button></>)}
                   </div>
                 )}
                 <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    {!isSplitMode ? (<><button onClick={handlePreview} disabled={loading || streaming || !text} className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 bg-white border border-slate-200 hover:border-violet-300 hover:text-violet-600 transition-all flex items-center gap-2 disabled:opacity-50">{streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} 试听片段</button></>) : (<div className="text-xs text-slate-400 font-bold italic">分步模式进行中...</div>)}
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Right Sidebar (History) */}
      <div className={`border-l border-slate-200 bg-white flex flex-col transition-all duration-300 z-10 shadow-sm ${showHistory ? 'w-80' : 'w-14'}`}>
          <div className="flex items-center justify-between p-4 border-b border-slate-100 h-14 shrink-0">
              {showHistory && <h3 className="font-bold text-sm text-slate-700 flex items-center gap-2"><History className="w-4 h-4" /> 历史记录 ({historyItems.length})</h3>}
              <button onClick={() => setShowHistory(!showHistory)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg mx-auto md:mx-0">
                  <History className="w-5 h-5" />
              </button>
          </div>
          
          {showHistory && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {historyItems.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-xs">
                          <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                          暂无生成记录
                      </div>
                  ) : (
                      historyItems.map((item) => (
                          <div key={item.id} className="group bg-slate-50 hover:bg-white border border-slate-100 hover:border-violet-200 rounded-xl p-3 transition-all shadow-sm hover:shadow">
                              <div className="flex justify-between items-start mb-2">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${item.provider === 'aura' ? 'bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                      {item.provider}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-mono">
                                      {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </span>
                              </div>
                              <p className="text-xs text-slate-600 line-clamp-2 mb-3 leading-relaxed font-medium" title={item.text}>
                                  {item.text}
                              </p>
                              <div className="flex items-center justify-between mt-auto">
                                  <button 
                                      onClick={() => playHistoryItem(item)}
                                      className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-violet-600 bg-white border border-slate-200 hover:border-violet-200 px-2 py-1 rounded-lg transition-all"
                                  >
                                      <PlayCircle className="w-3.5 h-3.5" /> 播放
                                  </button>
                                  <div className="flex items-center gap-1">
                                      {item.isCloud && (
                                        <div title="已云端同步">
                                          <CloudCheck className="w-3 h-3 text-emerald-400" />
                                        </div>
                                      )}
                                      <button 
                                          onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id); }}
                                          className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                                      >
                                          <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                  </div>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          )}
      </div>
    </div>
  );
};

export default VoiceStudio;
