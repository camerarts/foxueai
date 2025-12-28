
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, Play, Square, Download, Loader2, Save, Trash2, Volume2, Sparkles, Languages, Settings2, RefreshCw, Fingerprint, Star, Plus, CheckCircle2, FileAudio, Cpu, Pencil, Activity, Split, Merge, Scissors, ArrowRight, FolderOpen, BarChart3, Calendar } from 'lucide-react';
import * as storage from '../services/storageService';

// Default fallback voice if no custom ID is provided (Rachel)
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

const TTS_MODELS = [
  { id: 'eleven_v3', name: 'Eleven v3' },
];

interface CustomVoice {
    id: string;
    name: string;
    createdAt: number;
}

interface UsageLog {
    timestamp: number;
    charCount: number;
}

const STORAGE_KEY_VOICES = 'custom_voices';
const STORAGE_KEY_STATS = 'voice_usage_stats';

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
  const [customVoiceId, setCustomVoiceId] = useState('');
  const [customVoiceName, setCustomVoiceName] = useState('');
  const [savedVoices, setSavedVoices] = useState<CustomVoice[]>([]);
  const [modelId, setModelId] = useState(TTS_MODELS[0].id);
  
  // Statistics State
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [chartPeriod, setChartPeriod] = useState<number>(7); // Days
  
  // Project Context
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string | null>(null);
  const [savingToProject, setSavingToProject] = useState(false);
  const [isSavedToProject, setIsSavedToProject] = useState(false);
  
  // Operation State
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<string[]>(['>> 系统就绪，等待任务...']);

  const addLog = (msg: string) => {
      setConsoleLogs(prev => [...prev.slice(-10), `>> ${msg}`]);
  };

  // Restore User Preference & Load Data
  useEffect(() => {
    const pref = localStorage.getItem('lva_voice_pref');
    if (pref) {
        try {
            const { type, id, name } = JSON.parse(pref);
            if (type === 'custom') {
                setCustomVoiceId(id);
                setCustomVoiceName(name || '');
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

  // Check text length on change to suggest splitting
  useEffect(() => {
      if (text.length > 1700 && !isSplitMode && step === 1) {
          addLog(`检测到长文本 (${text.length} 字符)，建议使用拆分功能。`);
      }
  }, [text]);

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

  const recordUsage = async (charCount: number) => {
      const newLog: UsageLog = { timestamp: Date.now(), charCount };
      const updatedLogs = [...usageLogs, newLog];
      setUsageLogs(updatedLogs);
      
      const payload = { logs: updatedLogs };
      await storage.saveToolData(STORAGE_KEY_STATS, payload);
      // Optional: upload immediately or let background sync handle it
      storage.uploadToolData(STORAGE_KEY_STATS, payload).catch(console.error);
  };

  const saveUserPref = (type: 'custom', id: string, name?: string) => {
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
      }
  };

  const handleSelectSavedVoice = (voice: CustomVoice) => {
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

  // --- Step 1: Split Text ---
  const handleSplitText = () => {
      if (!text) return;
      if (text.length <= 1700) {
          alert("文本未超过 1700 字符，无需使用拆分功能，直接生成即可。");
          return;
      }
      const limit = Math.ceil(text.length / 2);
      let splitIdx = text.lastIndexOf('。', limit + 100);
      if (splitIdx === -1 || splitIdx < limit - 200) splitIdx = text.lastIndexOf('.', limit + 100);
      if (splitIdx === -1 || splitIdx < limit - 200) splitIdx = text.lastIndexOf('\n', limit + 100);
      if (splitIdx === -1) splitIdx = limit;
      else splitIdx += 1;

      setTextPart1(text.substring(0, splitIdx));
      setTextPart2(text.substring(splitIdx));
      setIsSplitMode(true);
      setStep(2);
      addLog(`文本已拆分为两部分 (P1: ${splitIdx}, P2: ${text.length - splitIdx})`);
  };

  const callTtsApi = async (txt: string, streamMode: boolean): Promise<string> => {
      const effectiveVoiceId = customVoiceId.trim() || DEFAULT_VOICE_ID;
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

  // Core API Logic for Merging
  const performMerge = async (u1: string, u2: string): Promise<string> => {
      const response = await fetch('/api/audio/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
              url1: u1, 
              url2: u2, 
              projectId: projectId 
          })
      });

      if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Merge failed');
      }

      const data = await response.json();
      return data.url;
  };

  // --- Step 2: Generate Dual Audio (And Auto Merge/Save) ---
  const handleGenerateDual = async () => {
      if (!textPart1 || !textPart2) return;
      setLoading(true);
      setErrorMsg(null);
      setAudioUrl1(null);
      setAudioUrl2(null);
      setFinalAudioUrl(null);
      setIsSavedToProject(false);
      
      addLog("开始并行生成两段语音...");

      try {
          const [res1, res2] = await Promise.all([
              callTtsApi(textPart1, false),
              callTtsApi(textPart2, false)
          ]);

          setAudioUrl1(res1);
          setAudioUrl2(res2);
          
          // Record Usage
          await recordUsage(textPart1.length + textPart2.length);

          addLog("两段语音生成完毕，正在请求自动合并...");
          setStep(3); 

          const mergedUrl = await performMerge(res1, res2);
          setFinalAudioUrl(mergedUrl);
          
          if (audioRef.current) audioRef.current.src = mergedUrl;
          addLog("合并成功！");

          if (projectId) {
              addLog("正在自动保存至项目...");
              await handleSaveToProject(mergedUrl);
          }

      } catch (e: any) {
          setErrorMsg(e.message);
          addLog(`流程失败: ${e.message}`);
      } finally {
          setLoading(false);
      }
  };

  // --- Single Generate (And Auto Save) ---
  const handleGenerateSingle = async () => {
      setLoading(true);
      setErrorMsg(null);
      setIsSavedToProject(false);
      try {
          const url = await callTtsApi(text, false);
          
          // Record Usage
          await recordUsage(text.length);

          setFinalAudioUrl(url);
          if (audioRef.current) audioRef.current.src = url;
          addLog("语音生成成功！");

          if (projectId) {
              addLog("正在自动保存至项目...");
              await handleSaveToProject(url);
          }
      } catch (e: any) {
          setErrorMsg(e.message);
          addLog(`生成失败: ${e.message}`);
      } finally {
          setLoading(false);
      }
  };

  // --- Manual Merge Trigger (Backup) ---
  const handleMerge = async () => {
      if (!audioUrl1 || !audioUrl2) return;
      setLoading(true);
      setIsSavedToProject(false);
      addLog("手动请求合并...");

      try {
          const mergedUrl = await performMerge(audioUrl1, audioUrl2);
          setFinalAudioUrl(mergedUrl);
          if (audioRef.current) audioRef.current.src = mergedUrl;
          addLog("合并成功！");
          if (projectId) await handleSaveToProject(mergedUrl);
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
               addLog(`已成功保存到项目 "${project.title}" 的音频文件中！`);
               setIsSavedToProject(true);
          }
      } catch(e: any) {
          addLog(`保存失败: ${e.message}`);
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

  // --- Stats Calculation ---
  const totalCharsUsed = useMemo(() => usageLogs.reduce((acc, log) => acc + log.charCount, 0), [usageLogs]);
  
  const chartData = useMemo(() => {
      const now = new Date();
      const labels = [];
      const data = [];
      
      // Initialize map for last N days
      const dateMap = new Map<string, number>();
      for (let i = chartPeriod - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const key = `${d.getMonth() + 1}/${d.getDate()}`;
          dateMap.set(key, 0);
          labels.push(key);
      }

      // Aggregate usage
      usageLogs.forEach(log => {
          const d = new Date(log.timestamp);
          const key = `${d.getMonth() + 1}/${d.getDate()}`;
          if (dateMap.has(key)) {
              dateMap.set(key, (dateMap.get(key) || 0) + log.charCount);
          }
      });

      // Build data array ensuring order
      labels.forEach(key => data.push(dateMap.get(key) || 0));
      
      const maxVal = Math.max(...data, 1); // Prevent division by zero
      
      return { labels, data, maxVal };
  }, [usageLogs, chartPeriod]);

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

          {/* Stats Section */}
          <div className="shrink-0 space-y-4 pt-4 border-t border-slate-100">
             <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> 用量统计</label>
             
             {/* Total Table */}
             <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                 <table className="w-full text-xs text-left">
                     <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                         <tr>
                             <th className="py-2 px-3 w-10 text-center">#</th>
                             <th className="py-2 px-3">用户</th>
                             <th className="py-2 px-3 text-right">已使用字符</th>
                         </tr>
                     </thead>
                     <tbody className="text-slate-700">
                         <tr>
                             <td className="py-2 px-3 text-center border-r border-slate-50">1</td>
                             <td className="py-2 px-3 border-r border-slate-50 font-bold">管理员</td>
                             <td className="py-2 px-3 text-right font-mono font-bold text-violet-600">{totalCharsUsed.toLocaleString()}</td>
                         </tr>
                     </tbody>
                 </table>
             </div>

             {/* Chart Controls */}
             <div className="flex items-center justify-between">
                 <span className="text-[10px] font-bold text-slate-400">每日趋势</span>
                 <div className="flex bg-slate-100 p-0.5 rounded-lg">
                     {[7, 14, 30].map(d => (
                         <button 
                            key={d} 
                            onClick={() => setChartPeriod(d)}
                            className={`text-[9px] px-2 py-0.5 rounded-md font-bold transition-all ${chartPeriod === d ? 'bg-white shadow text-violet-600' : 'text-slate-400 hover:text-slate-600'}`}
                         >
                             {d}天
                         </button>
                     ))}
                 </div>
             </div>

             {/* CSS Bar Chart */}
             <div className="h-28 flex items-end gap-1 pt-4 pb-1 border-b border-slate-100 relative">
                 {chartData.data.map((val, i) => (
                     <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                         {/* Bar */}
                         <div 
                            className="w-full bg-violet-200 hover:bg-violet-400 rounded-t-sm transition-all relative group-hover:shadow-md"
                            style={{ height: `${(val / chartData.maxVal) * 100}%`, minHeight: val > 0 ? '4px' : '0' }}
                         >
                             {/* Tooltip */}
                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                 {val}
                             </div>
                         </div>
                         {/* Date Label */}
                         <span className="text-[8px] font-medium text-slate-400 -rotate-45 origin-top-left translate-y-2 whitespace-nowrap absolute bottom-0 left-1/2">{chartData.labels[i]}</span>
                     </div>
                 ))}
                 {chartData.data.every(v => v === 0) && (
                     <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-300 italic">暂无数据</div>
                 )}
             </div>
          </div>
          
          {/* Console */}
          <div className="flex-1 flex flex-col justify-end min-h-[120px]">
             <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> 生成进度</label>
             <div className="bg-slate-900 rounded-xl p-4 flex-1 border border-slate-800 shadow-inner flex flex-col">
                <div className="flex flex-col gap-2 font-mono text-[10px] leading-relaxed overflow-y-auto custom-scrollbar h-24">
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
                            disabled={text.length <= 1700}
                            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${text.length > 1700 ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}
                            title={text.length > 1700 ? "文本超过1700字时建议使用" : "文本未超过1700字，无需拆分"}
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
                              语音生成 + 自动合并
                          </button>
                      )}
                      {isSplitMode && step === 3 && (
                          <button 
                            onClick={handleMerge}
                            disabled={loading}
                            className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-fuchsia-500/20"
                          >
                              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Merge className="w-3.5 h-3.5" />} 
                              手动重试合并
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
                                onClick={() => !isSavedToProject && handleSaveToProject()}
                                disabled={savingToProject || isSavedToProject}
                                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                                    isSavedToProject 
                                    ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-default' 
                                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-100'
                                }`}
                            >
                                {savingToProject ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isSavedToProject ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                                {isSavedToProject ? '已上传项目文件' : '保存到项目'}
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
                               生成并自动保存
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
