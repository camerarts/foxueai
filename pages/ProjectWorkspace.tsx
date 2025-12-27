
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProjectData, TitleItem, StoryboardFrame, CoverOption, PromptTemplate, ProjectStatus } from '../types';
import * as storage from '../services/storageService';
import * as gemini from '../services/geminiService';
import { 
  ArrowLeft, Layout, FileText, Type as TypeIcon, 
  List, PanelRightClose, Sparkles, Loader2, Copy, 
  Check, Images, ArrowRight, Palette, Film, Maximize2, Play, Pause,
  ZoomIn, ZoomOut, Move, RefreshCw, Rocket, AlertCircle, Archive,
  Cloud, CloudCheck, ArrowLeftRight, FileAudio, Upload, Trash2, Headphones, CheckCircle2, CloudUpload, Volume2, VolumeX, Wand2, Download, Music4, Clock, X, ClipboardPaste, Image as ImageIcon,
  Mic
} from 'lucide-react';

const formatTimestamp = (ts?: number) => {
  if (!ts) return null;
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `本次生成时间: ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const CompactTimestamp = ({ ts }: { ts?: number }) => {
  if (!ts) return null;
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400/80 bg-slate-100/50 px-1.5 py-0.5 rounded border border-slate-200/50">
      <Clock className="w-2.5 h-2.5" />
      {pad(d.getHours())}:{pad(d.getMinutes())}
    </div>
  );
};

const RowCopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={(e) => { e.stopPropagation(); handleCopy(); }} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="复制">
      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
    </button>
  );
};

const MiniInlineCopy = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!text) return;
    const cleanText = text.replace(/^- | -$/g, '');
    navigator.clipboard.writeText(cleanText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button 
      onClick={(e) => { e.stopPropagation(); handleCopy(); }} 
      className="opacity-0 group-hover/cell:opacity-100 p-1 ml-1 text-slate-300 hover:text-indigo-600 transition-all rounded bg-white shadow-sm border border-slate-100" 
      title="复制内容"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
};

const FancyAudioPlayer = ({ src, fileName, downloadName, isLocal, onReplace, onDelete, isUploading, uploadProgress }: any) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);

    const bars = useMemo(() => Array.from({ length: 24 }).map(() => ({
        delay: Math.random() * -1.5,
        duration: 0.8 + Math.random() * 1.2
    })), []);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const updateTime = () => {
            setCurrentTime(audio.currentTime);
            setProgress((audio.currentTime / audio.duration) * 100);
        };
        const updateDuration = () => setDuration(audio.duration);
        const onEnded = () => setIsPlaying(false);
        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('ended', onEnded);
        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', onEnded);
        };
    }, []);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) audioRef.current.pause(); else audioRef.current.play();
        setIsPlaying(!isPlaying);
    };

    const handleSeek = (e: any) => {
        if (!audioRef.current) return;
        const newTime = (Number(e.target.value) / 100) * duration;
        audioRef.current.currentTime = newTime;
        setProgress(Number(e.target.value));
    };

    const handleDownload = async () => {
        if (!src || isDownloading) return;
        setIsDownloading(true);
        try {
            const response = await fetch(src);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeName = (downloadName || fileName || 'audio').replace(/[\\/:*?"<>|]/g, "_");
            a.download = `${safeName}.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download failed:', err);
            alert('下载失败');
        } finally {
            setIsDownloading(false);
        }
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return "00:00";
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="w-full relative group overflow-hidden bg-white/40 backdrop-blur-xl border border-white/20 rounded-[32px] shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] p-6 transition-all duration-500 hover:shadow-[0_8px_40px_0_rgba(31,38,135,0.12)]">
             <style>{`
                @keyframes music-bar-bounce { 
                    0%, 100% { height: 6px; opacity: 0.3; } 
                    50% { height: 100%; opacity: 0.9; } 
                }
                .audio-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 12px;
                    height: 12px;
                    background: #6366f1;
                    border-radius: 50%;
                    cursor: pointer;
                    border: 2px solid white;
                    box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
                }
             `}</style>
             <audio ref={audioRef} src={src} />
             
             <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-4">
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${isPlaying ? 'bg-indigo-500 text-white rotate-12' : 'bg-slate-100 text-slate-400'}`}>
                         {isPlaying ? <Music4 className="w-6 h-6 animate-pulse" /> : <Volume2 className="w-6 h-6" />}
                     </div>
                     <div className="max-w-[180px]">
                        <h4 className="text-sm font-bold text-slate-800 line-clamp-1 mb-0.5 tracking-tight">{fileName}</h4>
                        <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${isLocal ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isLocal ? 'Uploading...' : 'Cloud Synchronized'}</span>
                        </div>
                     </div>
                 </div>
                 
                 <div className="flex items-center gap-[2px] h-8 pt-1">
                    {bars.map((bar, i) => (
                        <div 
                            key={i} 
                            className="w-[2px] bg-indigo-500/80 rounded-full" 
                            style={{ 
                                animation: isPlaying ? `music-bar-bounce ${bar.duration}s infinite` : 'none', 
                                animationDelay: `${bar.delay}s`,
                                height: isPlaying ? 'auto' : `${4 + Math.random() * 8}px`
                            }} 
                        />
                    ))}
                 </div>
             </div>

             <div className="space-y-3 mb-8">
                <div className="relative h-1 w-full flex items-center">
                    <div className="absolute w-full h-[2px] bg-slate-200/50 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={progress} 
                        onChange={handleSeek} 
                        className="audio-slider absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                    />
                </div>
                <div className="flex justify-between text-[10px] font-bold font-mono text-slate-400 tracking-tighter">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
             </div>

             <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <button 
                        onClick={togglePlay} 
                        className="w-14 h-14 rounded-full bg-slate-900 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-900/10"
                    >
                        {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white ml-1" />}
                    </button>
                    <div className="flex gap-1.5 px-2">
                        <button onClick={handleDownload} disabled={isDownloading} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white/50 rounded-xl transition-all" title="下载音频">
                            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        </button>
                        <button onClick={onReplace} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white/50 rounded-xl transition-all" title="替换文件"><RefreshCw className="w-4 h-4" /></button>
                        {onDelete && <button onClick={onDelete} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all" title="删除"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                 </div>

                 {isUploading && (
                     <div className="flex items-center gap-3 text-indigo-600">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-xs font-black uppercase tracking-widest">{Math.round(uploadProgress)}%</span>
                     </div>
                 )}
             </div>
        </div>
    );
};

const TextResultBox = ({ content, title, onSave, placeholder, showStats, readOnly, autoCleanAsterisks, extraActions }: any) => {
  const clean = (t: string) => autoCleanAsterisks ? t.replace(/\*/g, '') : t;
  const [val, setVal] = useState(clean(content || ''));
  const [dirty, setDirty] = useState(false);
  
  useEffect(() => { 
      if (!dirty) setVal(clean(content || '')); 
  }, [content, dirty]);

  const stats = (t: string) => `【共${t.length}字符，汉字${(t.match(/[\u4e00-\u9fa5]/g) || []).length}个】`;
  
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col h-full max-h-[600px]">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3"><h4 className="text-xs font-bold text-slate-500 uppercase">{title}</h4>{showStats && <span className="text-[10px] bg-white px-2 py-0.5 rounded border font-bold text-indigo-600 border-indigo-100">{stats(val)}</span>}</div>
        <div className="flex items-center gap-2">
            {extraActions}
            {!readOnly && onSave && dirty && <button onClick={() => { onSave(val); setDirty(false); }} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">保存</button>}
            <RowCopyButton text={val} />
        </div>
      </div>
      {onSave && !readOnly ? (
        <textarea className="flex-1 w-full p-4 text-sm text-slate-700 leading-relaxed outline-none resize-none font-mono" value={val} onChange={(e) => { setVal(clean(e.target.value)); setDirty(true); }} placeholder={placeholder} />
      ) : (
        <div className="p-4 overflow-y-auto whitespace-pre-wrap text-sm text-slate-700 leading-relaxed flex-1 font-mono">{content || <span className="text-slate-300 italic">暂无内容</span>}</div>
      )}
    </div>
  );
};

const NODE_WIDTH = 280;
const NODE_HEIGHT = 160;
const NODES_CONFIG = [
  { id: 'input', label: '项目输入', panelTitle: '项目策划', icon: Layout, color: 'blue', description: '定义主题与基调', x: 50, y: 300 },
  { id: 'script', label: '视频脚本', panelTitle: '脚本编辑器', icon: FileText, color: 'violet', promptKey: 'SCRIPT', description: '生成完整口播文案', x: 450, y: 300 },
  { id: 'titles', label: '爆款标题', panelTitle: '标题策划', icon: TypeIcon, color: 'amber', promptKey: 'TITLES', description: '生成高点击率标题', x: 850, y: 100 },
  { id: 'audio_file', label: '上传MP3', panelTitle: '音频文件', icon: FileAudio, color: 'fuchsia', description: '上传配音/BGM', x: 850, y: 300 },
  { id: 'summary', label: '简介标签', panelTitle: '发布元数据', icon: List, color: 'emerald', promptKey: 'SUMMARY', description: 'SEO 简介与标签', x: 850, y: 500 },
  { id: 'cover', label: '封面图', panelTitle: '封面预览', icon: ImageIcon, color: 'rose', promptKey: 'COVER_GEN', description: '生成视频封面图', x: 850, y: 700 },
];
const CONNECTIONS = [ { from: 'input', to: 'script' }, { from: 'script', to: 'audio_file' }, { from: 'script', to: 'titles' }, { from: 'script', to: 'summary' }, { from: 'script', to: 'cover' } ];

const ProjectWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [generatingNodes, setGeneratingNodes] = useState<Set<string>>(new Set());
  const [prompts, setPrompts] = useState<Record<string, PromptTemplate>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const init = async () => {
        if (id) {
            const p = await storage.getProject(id);
            if (p) setProject(p);
            setLoading(false);
        }
        setPrompts(await storage.getPrompts());
    };
    init();
    return () => { if(saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [id]);

  const updateProjectAndSyncImmediately = (updated: ProjectData, forceCloudSync = false) => {
      setProject(updated);
      
      // 1. Save Locally Immediately (Fixes refresh data loss)
      storage.saveProject(updated).catch(console.error);

      if (forceCloudSync) {
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          setSyncStatus('saving');
          // Immediate cloud upload
          storage.uploadProjects()
              .then(() => setSyncStatus('synced'))
              .catch(() => setSyncStatus('error'));
          return;
      }

      setSyncStatus('pending'); 
      
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      
      // 2. Debounce Cloud Sync (8s)
      saveTimerRef.current = setTimeout(async () => {
          setSyncStatus('saving');
          try {
              await storage.uploadProjects();
              setSyncStatus('synced');
          } catch { 
              setSyncStatus('error'); 
          }
      }, 8000);
  };

  const handleNodeAction = async (nodeId: string) => {
    if (!project) return;
    if (nodeId === 'audio_file') { audioInputRef.current?.click(); return; }
    if (['titles', 'summary', 'cover'].includes(nodeId) && !project.script) { alert("请先生成脚本"); return; }

    setGeneratingNodes(prev => new Set(prev).add(nodeId));
    try {
        let update: any = {};
        const config = NODES_CONFIG.find(n => n.id === nodeId);
        const template = config?.promptKey ? prompts[config.promptKey]?.template : '';

        if (nodeId === 'script') {
            let text = await gemini.generateText(prompts['SCRIPT'].template.replace(/\{\{topic\}\}/g, project.inputs.topic || project.title).replace(/\{\{tone\}\}/g, project.inputs.tone).replace(/\{\{language\}\}/g, project.inputs.language));
            update = { script: text.replace(/\*/g, '') };
        } else if (nodeId === 'titles') {
            const schema = { type: "ARRAY", items: { type: "OBJECT", properties: { mainTitle: { type: "STRING" }, subTitle: { type: "STRING" }, score: { type: "NUMBER" } }, required: ["mainTitle", "subTitle", "score"] } };
            update = { titles: await gemini.generateJSON(template.replace(/\{\{title\}\}/g, project.title).replace(/\{\{script\}\}/g, project.script || ''), schema) };
        } else if (nodeId === 'summary') {
            let text = (await gemini.generateText(template.replace(/\{\{script\}\}/g, project.script || ''))).trim();
            if (!text) throw new Error("AI 返回内容为空");
            update = { summary: text.replace(/\*/g, '') };
        } else if (nodeId === 'cover') {
             // 1. Generate Prompt Description ONLY
            const visualPrompt = await gemini.generateText(
                template.replace(/\{\{title\}\}/g, project.title).replace(/\{\{script\}\}/g, project.script || ''),
                'gemini-2.5-flash-preview-09-2025'
            );
            // Don't generate image automatically. Clear existing image to avoid confusion.
            update = { coverImage: { imageUrl: '', prompt: visualPrompt } };
        }

        const now = Date.now();
        const nextProject = { ...project, ...update, moduleTimestamps: { ...(project.moduleTimestamps || {}), [nodeId]: now } };
        updateProjectAndSyncImmediately(nextProject);

    } catch (e: any) { alert(`生成失败: ${e.message}`); } finally { setGeneratingNodes(prev => { const n = new Set(prev); n.delete(nodeId); return n; }); }
  };

  const handleGenerateCoverImage = async () => {
      if (!project?.coverImage?.prompt) return;
      
      let finalPrompt = project.coverImage.prompt;
      
      // Extract Core Prompt if available to clean up input for the model
      // We look for the text between 【输出核心Prompt】 and 【排除词 or End
      const coreMatch = finalPrompt.match(/【输出核心Prompt】([\s\S]*?)(?:【|$)/);
      if (coreMatch && coreMatch[1]) {
          finalPrompt = coreMatch[1].trim();
      }

      setGeneratingNodes(prev => new Set(prev).add('cover_image'));
      try {
           // API Key Check for Pro model
            try {
                const hasKey = await (window as any).aistudio?.hasSelectedApiKey();
                if (!hasKey) {
                    await (window as any).aistudio?.openSelectKey();
                }
            } catch (e) { console.warn("AI Studio key check skipped", e); }

          const base64 = await gemini.generateImage(finalPrompt + " Youtube thumbnail, high quality, 4k", 'gemini-3-pro-image-preview');
          const url = await storage.uploadImage(base64, project.id);
          
          const updated = { 
              ...project, 
              coverImage: { ...project.coverImage, imageUrl: url } 
          };
          updateProjectAndSyncImmediately(updated);
      } catch (e: any) {
          alert(`生图失败: ${e.message}`);
      } finally {
          setGeneratingNodes(prev => { const n = new Set(prev); n.delete('cover_image'); return n; });
      }
  };

  const handleOneClickBatchGenerate = async () => {
    if (!project) return;
    if (!project.script) {
        alert("请先生成或录入视频脚本后再执行一键生成。");
        return;
    }

    const needsTitles = !project.titles || project.titles.length === 0;
    const needsSummary = !project.summary || project.summary.trim() === '';
    // Check for prompt, not image
    const needsCover = !project.coverImage || !project.coverImage.prompt;

    const actualTargets: string[] = [];
    if (needsTitles) actualTargets.push('titles');
    if (needsSummary) actualTargets.push('summary');
    if (needsCover) actualTargets.push('cover');

    if (actualTargets.length === 0) {
        alert("目标模块（标题、简介、封面提示词）均已有内容，已跳过生成。如需重新生成，请进入单个模块点击“重选”。");
        return;
    }
    
    setGeneratingNodes(prev => {
        const next = new Set(prev);
        actualTargets.forEach(t => next.add(t));
        return next;
    });

    try {
        const titlePrompt = prompts['TITLES'].template.replace(/\{\{title\}\}/g, project.title).replace(/\{\{script\}\}/g, project.script || '');
        const summaryPrompt = prompts['SUMMARY'].template.replace(/\{\{script\}\}/g, project.script || '');
        const coverTemplate = prompts['COVER_GEN'].template.replace(/\{\{title\}\}/g, project.title).replace(/\{\{script\}\}/g, project.script || '');
        
        const titleSchema = { type: "ARRAY", items: { type: "OBJECT", properties: { mainTitle: { type: "STRING" }, subTitle: { type: "STRING" }, score: { type: "NUMBER" } }, required: ["mainTitle", "subTitle", "score"] } };

        // Generate Titles and Summary (Parallel)
        const textTasks: Promise<any>[] = [];
        if (needsTitles) textTasks.push(gemini.generateJSON<TitleItem[]>(titlePrompt, titleSchema)); else textTasks.push(Promise.resolve(null));
        if (needsSummary) textTasks.push(gemini.generateText(summaryPrompt).then(res => res.trim().replace(/\*/g, ''))); else textTasks.push(Promise.resolve(null));
        
        const [titlesResult, summaryResult] = await Promise.all(textTasks);

        // Generate Cover Prompt Only (Sequential)
        let coverResult: { imageUrl: string; prompt?: string } | null = null;
        if (needsCover) {
            const visualPrompt = await gemini.generateText(
                coverTemplate,
                'gemini-2.5-flash-preview-09-2025'
            );
            // Save Prompt only
            coverResult = { imageUrl: '', prompt: visualPrompt };
        } else {
             coverResult = project.coverImage || null;
        }

        const now = Date.now();
        const nextProject: ProjectData = {
            ...project,
            titles: needsTitles ? titlesResult : project.titles,
            summary: needsSummary ? summaryResult : project.summary,
            coverImage: needsCover && coverResult ? coverResult : project.coverImage,
            moduleTimestamps: {
                ...(project.moduleTimestamps || {}),
                ...(needsTitles ? { titles: now } : {}),
                ...(needsSummary ? { summary: now } : {}),
                ...(needsCover ? { cover: now } : {})
            }
        };

        updateProjectAndSyncImmediately(nextProject);

    } catch (e: any) {
        alert(`一键生成部分失败: ${e.message}`);
    } finally {
        setGeneratingNodes(prev => {
            const n = new Set(prev);
            actualTargets.forEach(t => n.delete(t));
            return n;
        });
    }
  };

  const handleAudioUpload = async (file: File) => {
    if (!project) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
        const url = await storage.uploadFile(file, project.id, p => setUploadProgress(p));
        const updated = { 
            ...project, 
            audioFile: url, 
            moduleTimestamps: { ...(project.moduleTimestamps || {}), audio_file: Date.now() } 
        };
        updateProjectAndSyncImmediately(updated, true); // Force immediate sync for uploads
    } catch (err: any) {
        alert(`音频上传失败: ${err.message}`);
    } finally {
        setIsUploading(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; 
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
          setSelectedNodeId(null);
      }
  };
  
  const handleDownloadCover = () => {
      if (!project?.coverImage?.imageUrl) return;
      const link = document.createElement("a");
      link.href = project.coverImage.imageUrl;
      link.download = `cover_${project.title}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  if (loading || !project) return <div className="flex h-full items-center justify-center text-slate-400 font-bold">加载中...</div>;

  return (
    <div className="flex h-full relative bg-slate-50 overflow-hidden">
        <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAudioUpload(f); }} />
        <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
             <button onClick={() => navigate('/dashboard')} className="p-2 bg-white/50 rounded-full border hover:bg-white transition-all"><ArrowLeft className="w-5 h-5 text-slate-500" /></button>
             <h1 className="text-2xl font-black text-slate-400 select-none">{project.title}</h1>
        </div>
        <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
            <div className={`text-[10px] font-bold px-3 py-1.5 rounded-full border bg-white/90 shadow-sm flex items-center gap-1.5 ${syncStatus === 'synced' ? 'text-emerald-600' : syncStatus === 'pending' ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`}>
                {syncStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : syncStatus === 'synced' ? <CloudCheck className="w-3 h-3" /> : syncStatus === 'pending' ? <Clock className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
                {syncStatus === 'saving' ? '正在写入同步...' : syncStatus === 'synced' ? '已同步云端' : syncStatus === 'pending' ? '变更待保存 (8s)' : '就绪'}
            </div>
            <button 
                onClick={handleOneClickBatchGenerate} 
                disabled={generatingNodes.has('titles') || generatingNodes.has('summary') || generatingNodes.has('cover') || !project.script}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg transition-all ${!project.script ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                title={!project.script ? "需先生成脚本" : "一键生成标题、简介和封面（仅生成缺失部分）"}
            >
                {generatingNodes.size > 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} 
                一键生成 (3/5/6)
            </button>
        </div>

        <div 
          className={`flex-1 relative transition-colors ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
        >
             <div 
               className="absolute inset-0 opacity-10 pointer-events-none" 
               style={{ 
                 backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', 
                 backgroundSize: '24px 24px',
                 backgroundPosition: `${transform.x}px ${transform.y}px`
               }} 
             />
             <div style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transformOrigin: '0 0' }}>
                <svg className="overflow-visible absolute top-0 left-0 pointer-events-none">
                    {CONNECTIONS.map((c, i) => {
                        const f = NODES_CONFIG.find(n => n.id === c.from)!; const t = NODES_CONFIG.find(n => n.id === c.to)!;
                        return <path key={i} d={`M ${f.x+NODE_WIDTH} ${f.y+NODE_HEIGHT/2} C ${f.x+NODE_WIDTH+100} ${f.y+NODE_HEIGHT/2} ${t.x-100} ${t.y+NODE_HEIGHT/2} ${t.x} ${t.y+NODE_HEIGHT/2}`} stroke="#cbd5e1" strokeWidth="2" fill="none" />;
                    })}
                </svg>
                {NODES_CONFIG.map((n, i) => {
                    const has = n.id==='input' ? !!project.title : n.id==='script' ? !!project.script : n.id==='titles' ? !!project.titles?.length : n.id==='audio_file' ? !!project.audioFile : n.id==='summary' ? !!project.summary : n.id==='cover' ? !!(project.coverImage?.prompt) : false;
                    const ts = project.moduleTimestamps?.[n.id];
                    return (
                        <div key={n.id} style={{ left: n.x, top: n.y, width: NODE_WIDTH, height: NODE_HEIGHT }} onClick={(e) => { e.stopPropagation(); setSelectedNodeId(n.id); }} className={`absolute rounded-2xl shadow-sm border transition-all cursor-pointer flex flex-col overflow-hidden bg-white hover:shadow-md ${selectedNodeId===n.id ? 'ring-2 ring-indigo-400' : has ? 'bg-emerald-50/50 border-emerald-100' : ''}`}>
                             <div className={`h-11 border-b flex items-center px-4 justify-between ${has ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                                 <div className="flex flex-col">
                                     <div className="flex items-center gap-2.5 font-bold text-slate-700 text-sm">
                                         <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white shadow-sm transition-colors ${has ? 'bg-emerald-500' : 'bg-slate-900'}`}>
                                             {i + 1}
                                         </span>
                                         <n.icon className={`w-4 h-4 ${has ? 'text-emerald-500' : 'text-slate-400'}`} /> 
                                         {n.label}
                                     </div>
                                 </div>
                                 <div className="flex items-center gap-2">
                                     {ts && <CompactTimestamp ts={ts} />}
                                     {has && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                                 </div>
                             </div>
                             <div className="p-4 flex flex-col justify-between flex-1">
                                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{n.description}</p>
                                {n.id !== 'input' && (
                                    <button onClick={(e) => { e.stopPropagation(); handleNodeAction(n.id); }} className={`mt-auto py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${generatingNodes.has(n.id) ? 'bg-slate-100 text-slate-400' : has ? 'bg-white border text-slate-600' : 'bg-slate-900 text-white'}`}>
                                        {generatingNodes.has(n.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : has ? <RefreshCw className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />} {generatingNodes.has(n.id) ? '生成中' : has ? '重新生成' : '生成'}
                                    </button>
                                )}
                             </div>
                        </div>
                    );
                })}
             </div>
        </div>

        <div className={`absolute top-0 right-0 bottom-0 w-[500px] bg-white border-l shadow-2xl transition-transform duration-300 z-30 flex flex-col ${selectedNodeId ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="h-14 flex items-center justify-between px-6 border-b bg-white flex-shrink-0">
                <h3 className="font-bold text-slate-800">{selectedNodeId && NODES_CONFIG.find(x => x.id === selectedNodeId)?.panelTitle}</h3>
                <button onClick={() => setSelectedNodeId(null)} className="p-2 text-slate-400 hover:text-slate-600"><PanelRightClose className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-hidden bg-slate-50/50">
                 {selectedNodeId === 'input' && <div className="p-6 h-full overflow-y-auto"><TextResultBox title="视频主题" content={project.inputs.topic} readOnly={true} /></div>}
                 
                 {selectedNodeId === 'script' && <div className="p-6 h-full overflow-y-auto">
                    <TextResultBox 
                        title="视频脚本" 
                        content={project.script} 
                        showStats={true} 
                        onSave={(v: any) => updateProjectAndSyncImmediately({ ...project, script: v }, true)} 
                        autoCleanAsterisks={true} 
                        extraActions={
                            <a 
                                href="https://elevenlabs.io/app/speech-synthesis/text-to-speech" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-white hover:bg-slate-900 bg-white border border-slate-200 hover:border-slate-900 rounded-lg transition-all"
                            >
                                <Mic className="w-3 h-3" /> 去生成语音
                            </a>
                        }
                    />
                 </div>}

                 {selectedNodeId === 'audio_file' && (
                     <div className="flex flex-col h-full gap-4 p-6">
                        <div className="flex-[2] overflow-hidden">
                            <TextResultBox 
                                title="参考脚本内容" 
                                content={project.script} 
                                readOnly={true} 
                                autoCleanAsterisks={true} 
                            />
                        </div>
                        <div className="flex-[1] overflow-y-auto min-h-[220px]">
                            <div className="space-y-4">
                                {project.audioFile && (
                                    <FancyAudioPlayer 
                                        src={project.audioFile} 
                                        fileName={project.audioFile.split('/').pop() || '音频文件.mp3'} 
                                        downloadName={project.title}
                                        isLocal={isUploading} 
                                        isUploading={isUploading} 
                                        uploadProgress={uploadProgress} 
                                        onReplace={() => audioInputRef.current?.click()} 
                                    />
                                )}
                                {!project.audioFile && <div onClick={() => audioInputRef.current?.click()} className="h-40 border-2 border-dashed border-slate-200 bg-white/50 backdrop-blur rounded-[32px] flex flex-col items-center justify-center gap-4 text-slate-400 cursor-pointer hover:bg-white hover:border-indigo-300 hover:text-indigo-600 transition-all group">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-indigo-50 transition-all">
                                        {isUploading ? <Loader2 className="w-8 h-8 animate-spin text-indigo-600" /> : <Upload className="w-8 h-8" />}
                                    </div>
                                    <div className="text-center">
                                        <span className="text-sm font-bold block">{isUploading ? `正在上传 ${Math.round(uploadProgress)}%` : '点击上传音频'}</span>
                                        <span className="text-[10px] uppercase tracking-widest opacity-60">MP3, WAV, M4A supported</span>
                                    </div>
                                </div>}
                            </div>
                        </div>
                     </div>
                 )}
                 {selectedNodeId === 'titles' && (
                     <div className="p-4 h-full overflow-y-auto">
                        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b">
                                    <tr>
                                        <th className="py-3 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-12">序号</th>
                                        <th className="py-3 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">视觉主标题 (2-4字)</th>
                                        <th className="py-3 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">心理副标题 (6-12字)</th>
                                        <th className="py-3 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-20">得分 (10分制)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {project.titles?.map((t, i) => {
                                        const isObject = typeof t === 'object' && t !== null;
                                        const main = isObject ? (t.mainTitle || '') : (typeof t === 'string' ? t : '未知标题');
                                        const sub = isObject ? (t.subTitle || '') : '';
                                        const scoreValue = isObject ? (typeof t.score === 'number' ? t.score : parseFloat(t.score as any) || 0) : 0;
                                        
                                        return (
                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="py-4 px-3 text-center text-xs font-bold text-slate-400 align-top">{String.fromCharCode(65 + (i % 26))}</td>
                                                <td className="py-4 px-3 group/cell">
                                                    <div className="flex items-center gap-1">
                                                        <div className="text-sm font-black text-slate-800 leading-tight">{main}</div>
                                                        <MiniInlineCopy text={main} />
                                                    </div>
                                                </td>
                                                <td className="py-4 px-3 group/cell">
                                                    <div className="flex items-center gap-1">
                                                        <div className="text-[11px] font-bold text-slate-500 leading-relaxed">{sub ? `- ${sub} -` : ''}</div>
                                                        {sub && <MiniInlineCopy text={sub} />}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-3 text-center align-top">
                                                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${scoreValue >= 9 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                                        {scoreValue.toFixed(1)}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {(!project.titles || project.titles.length === 0) && (
                                        <tr>
                                            <td colSpan={4} className="py-20 text-center text-slate-300 italic text-xs">暂无生成方案</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                     </div>
                 )}
                 {selectedNodeId === 'summary' && <div className="p-6 h-full overflow-y-auto"><TextResultBox title="简介标签" content={project.summary} onSave={(v: any) => updateProjectAndSyncImmediately({ ...project, summary: v }, true)} /></div>}
                 {selectedNodeId === 'cover' && (
                     <div className="p-6 h-full overflow-hidden flex flex-col gap-6">
                        <div className="h-[40%] shrink-0 min-h-[200px]">
                            <TextResultBox
                                title="AI 封面提示词 (PROMPT)"
                                content={project.coverImage?.prompt || ''}
                                readOnly={true}
                                placeholder="生成后将在此显示用于绘图的英文提示词..."
                            />
                        </div>
                        <div className="flex-1 min-h-0 bg-slate-100 rounded-2xl border border-slate-200 p-4 flex flex-col items-center justify-center relative overflow-hidden group">
                            {project.coverImage?.imageUrl ? (
                                <div className="relative w-full h-full flex items-center justify-center">
                                    <img src={project.coverImage.imageUrl} className="max-w-full max-h-full object-contain shadow-sm rounded-lg" alt="Cover Preview" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button 
                                            onClick={handleDownloadCover} 
                                            className="bg-white text-slate-900 p-2 rounded-lg font-bold shadow-xl hover:bg-slate-100 transition-colors"
                                            title="下载封面"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={handleGenerateCoverImage} 
                                            className="bg-white text-slate-900 p-2 rounded-lg font-bold shadow-xl hover:bg-slate-100 transition-colors"
                                            title="重新生成"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-4">
                                    <ImageIcon className="w-12 h-12 text-slate-300" />
                                    <p className="text-slate-400 font-medium">暂无封面图片</p>
                                    {project.coverImage?.prompt && (
                                        <button 
                                            onClick={handleGenerateCoverImage}
                                            disabled={generatingNodes.has('cover_image')}
                                            className="px-6 py-2.5 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-fuchsia-500/20 hover:shadow-fuchsia-500/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                                        >
                                            {generatingNodes.has('cover_image') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}
                                            生成图片
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                     </div>
                 )}
            </div>
        </div>
    </div>
  );
};

export default ProjectWorkspace;
