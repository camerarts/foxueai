
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProjectData, TitleItem, StoryboardFrame, CoverOption, PromptTemplate, ProjectStatus } from '../types';
import * as storage from '../services/storageService';
import * as gemini from '../services/geminiService';
import { 
  ArrowLeft, Layout, FileText, Type as TypeIcon, 
  List, Sparkles, Loader2, Copy, 
  Check, Images, ArrowRight, Palette, Film, RefreshCw, Rocket, AlertCircle,
  Cloud, CloudCheck, FileAudio, Trash2, Headphones, Download, Clock, Mic, 
  ChevronRight, Edit3, Save
} from 'lucide-react';

// --- Helper Components ---

const formatTimestamp = (ts?: number) => {
  if (!ts) return null;
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `本次生成时间: ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const CompactTimestamp = ({ ts }: { ts?: number }) => {
  if (!ts) return null;
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400/80 bg-slate-100/50 px-2 py-0.5 rounded border border-slate-200/50 whitespace-nowrap" title={`最后生成时间: ${dateStr} ${timeStr}`}>
      <Clock className="w-2.5 h-2.5" />
      <span>{dateStr}</span>
      <span className="opacity-30">|</span>
      <span>{timeStr}</span>
    </div>
  );
};

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={(e) => { e.stopPropagation(); handleCopy(); }} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="复制">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

const SectionHeader = ({ 
    icon: Icon, 
    title, 
    onGenerate, 
    loading, 
    timestamp, 
    hasContent, 
    extraAction 
}: any) => (
  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
    <div className="flex items-center gap-2">
      <div className={`p-2 rounded-lg ${hasContent ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
        <Icon className="w-4 h-4" />
      </div>
      <h3 className="font-bold text-slate-700 text-sm md:text-base">{title}</h3>
      <CompactTimestamp ts={timestamp} />
    </div>
    <div className="flex items-center gap-2">
      {extraAction}
      <button
        onClick={onGenerate}
        disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
          loading 
          ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
          : hasContent 
            ? 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600' 
            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-500/30'
        }`}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : hasContent ? <RefreshCw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
        {loading ? '生成中...' : hasContent ? '重新生成' : 'AI 生成'}
      </button>
    </div>
  </div>
);

const ProjectWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'synced' | 'error' | null>(null);
  const [prompts, setPrompts] = useState<Record<string, PromptTemplate>>({});
  
  // Generating States
  const [genScript, setGenScript] = useState(false);
  const [genStoryboard, setGenStoryboard] = useState(false);
  const [genTitles, setGenTitles] = useState(false);
  const [genSummary, setGenSummary] = useState(false);
  const [genCover, setGenCover] = useState(false);

  // Edit States
  const [editTopic, setEditTopic] = useState(false);
  const [tempTopic, setTempTopic] = useState('');

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const p = await storage.getProject(id);
      if (p) {
          setProject(p);
          setTempTopic(p.title);
      }
      const loadedPrompts = await storage.getPrompts();
      setPrompts(loadedPrompts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveProject = async (updated: ProjectData, sync = true) => {
    setProject(updated);
    await storage.saveProject(updated);
    if (sync) {
        setSyncStatus('saving');
        try {
            await storage.uploadProjects();
            setSyncStatus('synced');
        } catch {
            setSyncStatus('error');
        }
    }
  };

  // --- Handlers ---

  const handleUpdateTopic = async () => {
      if (!project || !tempTopic.trim()) return;
      await saveProject({ ...project, title: tempTopic, inputs: { ...project.inputs, topic: tempTopic } });
      setEditTopic(false);
  };

  const handleGenerateScript = async () => {
    if (!project) return;
    setGenScript(true);
    try {
        const template = prompts.SCRIPT?.template || '';
        const prompt = template
            .replace('{{topic}}', project.inputs.topic)
            .replace('{{tone}}', project.inputs.tone)
            .replace('{{language}}', project.inputs.language);
        
        const script = await gemini.generateText(prompt);
        await saveProject({
            ...project,
            script,
            moduleTimestamps: { ...project.moduleTimestamps, script: Date.now() }
        });
    } catch (e: any) {
        alert(`脚本生成失败: ${e.message}`);
    } finally {
        setGenScript(false);
    }
  };

  const handleGenerateStoryboard = async () => {
      if (!project || !project.script) return;
      setGenStoryboard(true);
      try {
          const template = prompts.STORYBOARD_TEXT?.template || '';
          const prompt = template.replace('{{script}}', project.script);
          
          const framesRaw = await gemini.generateJSON<{original: string, description: string}[]>(prompt, {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    original: { type: "STRING" },
                    description: { type: "STRING" }
                }
            }
          });

          const frames: StoryboardFrame[] = framesRaw.map((f, i) => ({
              id: crypto.randomUUID(),
              sceneNumber: i + 1,
              originalText: f.original,
              description: f.description,
              imagePrompt: f.description // Default prompt is description
          }));

          await saveProject({
              ...project,
              storyboard: frames,
              moduleTimestamps: { ...project.moduleTimestamps, storyboard: Date.now() }
          });
      } catch (e: any) {
          alert(`分镜生成失败: ${e.message}`);
      } finally {
          setGenStoryboard(false);
      }
  };

  const handleGenerateTitles = async () => {
      if (!project || !project.script) return;
      setGenTitles(true);
      try {
          const template = prompts.TITLES?.template || '';
          const prompt = template
            .replace('{{title}}', project.title)
            .replace('{{script}}', project.script.substring(0, 2000)); // Limit context

          const titlesData = await gemini.generateJSON<{mainTitle: string, subTitle: string, score: number}[]>(prompt, {
              type: "ARRAY",
              items: {
                  type: "OBJECT",
                  properties: {
                      mainTitle: { type: "STRING" },
                      subTitle: { type: "STRING" },
                      score: { type: "NUMBER" }
                  }
              }
          });

          await saveProject({
              ...project,
              titles: titlesData,
              moduleTimestamps: { ...project.moduleTimestamps, titles: Date.now() }
          });
      } catch (e: any) {
          alert(`标题生成失败: ${e.message}`);
      } finally {
          setGenTitles(false);
      }
  };

  const handleGenerateSummary = async () => {
      if (!project || !project.script) return;
      setGenSummary(true);
      try {
          const template = prompts.SUMMARY?.template || '';
          const prompt = template.replace('{{script}}', project.script);
          const summary = await gemini.generateText(prompt);
          
          await saveProject({
              ...project,
              summary,
              moduleTimestamps: { ...project.moduleTimestamps, summary: Date.now() }
          });
      } catch (e: any) {
          alert(`简介生成失败: ${e.message}`);
      } finally {
          setGenSummary(false);
      }
  };

  const handleGenerateCover = async () => {
      if (!project) return;
      setGenCover(true);
      try {
          const template = prompts.COVER_GEN?.template || '';
          const prompt = template
            .replace('{{title}}', project.title)
            .replace('{{script}}', project.script ? project.script.substring(0, 500) : project.inputs.topic);
            
          const coverPrompt = await gemini.generateText(prompt);
          
          await saveProject({
              ...project,
              coverImage: { ...project.coverImage, imageUrl: project.coverImage?.imageUrl || '', prompt: coverPrompt },
              moduleTimestamps: { ...project.moduleTimestamps, cover: Date.now() }
          });
      } catch (e: any) {
          alert(`封面提示词生成失败: ${e.message}`);
      } finally {
          setGenCover(false);
      }
  };

  const handleDeleteAudio = async () => {
      if (!project || !confirm("确定要删除当前配音文件吗？")) return;
      await saveProject({ ...project, audioFile: undefined });
  };

  if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>;
  if (!project) return <div className="p-8 text-center text-slate-500">项目不存在</div>;

  return (
    <div className="h-full flex flex-col bg-[#F8F9FC]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4 min-w-0">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    {editTopic ? (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                            <input 
                                autoFocus
                                value={tempTopic}
                                onChange={(e) => setTempTopic(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleUpdateTopic()}
                                className="text-xl font-bold text-slate-800 border-b-2 border-indigo-500 outline-none bg-transparent px-1 min-w-[300px]"
                            />
                            <button onClick={handleUpdateTopic} className="p-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditTopic(false)} className="p-1 text-slate-400 hover:text-slate-600"><ArrowLeft className="w-4 h-4" /></button>
                        </div>
                    ) : (
                        <h1 className="text-xl font-bold text-slate-800 truncate cursor-pointer hover:text-indigo-600 flex items-center gap-2 group" onClick={() => setEditTopic(true)}>
                            {project.title}
                            <Edit3 className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </h1>
                    )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">Status: {project.status}</span>
                    <span className="flex items-center gap-1">
                        {syncStatus === 'synced' ? <CloudCheck className="w-3 h-3 text-emerald-500" /> : syncStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin text-blue-500" /> : <Cloud className="w-3 h-3" />}
                        {syncStatus === 'synced' ? '已同步' : syncStatus === 'saving' ? '同步中...' : syncStatus === 'error' ? '同步失败' : '就绪'}
                    </span>
                </div>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
         <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
            
            {/* 1. Script Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                <SectionHeader 
                    icon={FileText} 
                    title="1. 视频文案 (Script)" 
                    onGenerate={handleGenerateScript} 
                    loading={genScript} 
                    hasContent={!!project.script}
                    timestamp={project.moduleTimestamps?.script}
                />
                <textarea 
                    value={project.script || ''}
                    onChange={(e) => setProject({ ...project, script: e.target.value })}
                    onBlur={() => saveProject(project)}
                    placeholder="点击右上角生成文案，或在此处直接输入..."
                    className="w-full h-[400px] p-4 bg-slate-50 border border-slate-200 rounded-xl resize-none outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm leading-relaxed"
                />
            </div>

            {/* 2. Storyboard Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                <SectionHeader 
                    icon={Layout} 
                    title="2. 分镜设计 (Storyboard)" 
                    onGenerate={handleGenerateStoryboard} 
                    loading={genStoryboard} 
                    hasContent={project.storyboard && project.storyboard.length > 0}
                    timestamp={project.moduleTimestamps?.storyboard}
                    extraAction={
                        project.storyboard && project.storyboard.length > 0 && (
                            <button 
                                onClick={() => navigate(`/project/${project.id}/images`)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-50 text-fuchsia-600 hover:bg-fuchsia-100 border border-fuchsia-100 rounded-lg text-xs font-bold transition-all"
                            >
                                <Images className="w-3.5 h-3.5" /> 
                                进入生图工坊
                            </button>
                        )
                    }
                />
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden min-h-[400px] flex flex-col relative">
                    {!project.storyboard || project.storyboard.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                            <Layout className="w-12 h-12 mb-2 opacity-20" />
                            <span className="text-sm">暂无分镜数据</span>
                        </div>
                    ) : (
                        <div className="overflow-y-auto max-h-[400px]">
                            {project.storyboard.map((frame, idx) => (
                                <div key={frame.id} className="p-3 border-b border-slate-100 hover:bg-white transition-colors flex gap-3 group">
                                    <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                                        {frame.sceneNumber}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-800 mb-1 line-clamp-2 font-medium">{frame.originalText || '无原文'}</p>
                                        <p className="text-[10px] text-slate-400 line-clamp-2">{frame.description}</p>
                                    </div>
                                    <div className="shrink-0 flex items-center">
                                        {frame.imageUrl ? (
                                            <div className="w-12 h-8 bg-slate-800 rounded overflow-hidden">
                                                <img src={frame.imageUrl} className="w-full h-full object-cover" alt="scene" />
                                            </div>
                                        ) : (
                                            <div className="w-12 h-8 bg-slate-100 rounded border border-slate-200 flex items-center justify-center">
                                                <Images className="w-3 h-3 text-slate-300" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Titles Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                <SectionHeader 
                    icon={TypeIcon} 
                    title="3. 标题策划 (Titles)" 
                    onGenerate={handleGenerateTitles} 
                    loading={genTitles} 
                    hasContent={project.titles && project.titles.length > 0}
                    timestamp={project.moduleTimestamps?.titles}
                />
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                    {project.titles?.map((t, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-white hover:border-indigo-100 hover:shadow-sm transition-all group">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">方案 {idx + 1}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-400">Score: {t.score}</span>
                                    <CopyButton text={`${t.mainTitle} - ${t.subTitle}`} />
                                </div>
                            </div>
                            <div className="font-bold text-slate-800 text-sm mb-0.5">{t.mainTitle}</div>
                            <div className="text-xs text-slate-500">{t.subTitle}</div>
                        </div>
                    ))}
                    {(!project.titles || project.titles.length === 0) && (
                        <div className="text-center py-10 text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            等待生成标题...
                        </div>
                    )}
                </div>
            </div>

            {/* 4. Audio Section (Voice Studio) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                <SectionHeader 
                    icon={Mic} 
                    title="4. 配音合成 (Voice)" 
                    onGenerate={() => navigate('/voice', { 
                        state: { 
                            text: project.script, 
                            projectId: project.id,
                            projectTitle: project.title
                        } 
                    })} 
                    loading={false} 
                    hasContent={!!project.audioFile}
                    timestamp={project.moduleTimestamps?.audio_file}
                />
                
                {project.audioFile ? (
                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                <Headphones className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-indigo-900 truncate">已合成项目音频</div>
                                <div className="text-xs text-indigo-500 truncate">{project.audioFile.split('/').pop()}</div>
                            </div>
                            <div className="flex items-center gap-1">
                                <a href={project.audioFile} download className="p-2 text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors">
                                    <Download className="w-4 h-4" />
                                </a>
                                <button onClick={handleDeleteAudio} className="p-2 text-indigo-400 hover:text-rose-600 hover:bg-rose-100 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <audio controls src={project.audioFile} className="w-full h-8" />
                    </div>
                ) : (
                    <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3 group cursor-pointer hover:bg-indigo-50/50 hover:border-indigo-200 transition-all" onClick={() => navigate('/voice', { state: { text: project.script, projectId: project.id, projectTitle: project.title } })}>
                        <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-300 group-hover:text-indigo-500 group-hover:scale-110 transition-all">
                            <Mic className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-bold text-slate-500 group-hover:text-indigo-600">点击进入语音工坊</p>
                        <p className="text-xs text-slate-400">使用 ElevenLabs 生成高质量配音</p>
                    </div>
                )}
            </div>

            {/* 5. Summary Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                <SectionHeader 
                    icon={List} 
                    title="5. 简介与标签 (Summary)" 
                    onGenerate={handleGenerateSummary} 
                    loading={genSummary} 
                    hasContent={!!project.summary}
                    timestamp={project.moduleTimestamps?.summary}
                />
                <textarea 
                    value={project.summary || ''}
                    onChange={(e) => setProject({ ...project, summary: e.target.value })}
                    onBlur={() => saveProject(project)}
                    placeholder="等待生成简介..."
                    className="w-full h-[200px] p-4 bg-slate-50 border border-slate-200 rounded-xl resize-none outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm leading-relaxed"
                />
            </div>

            {/* 6. Cover Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                <SectionHeader 
                    icon={Palette} 
                    title="6. 封面提示词 (Cover)" 
                    onGenerate={handleGenerateCover} 
                    loading={genCover} 
                    hasContent={!!project.coverImage?.prompt}
                    timestamp={project.moduleTimestamps?.cover}
                />
                <div className="relative">
                    <textarea 
                        value={project.coverImage?.prompt || ''}
                        onChange={(e) => setProject({ ...project, coverImage: { ...project.coverImage!, prompt: e.target.value } })}
                        onBlur={() => saveProject(project)}
                        placeholder="等待生成封面提示词..."
                        className="w-full h-[200px] p-4 bg-slate-50 border border-slate-200 rounded-xl resize-none outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all text-xs font-mono leading-relaxed"
                    />
                    <div className="absolute top-2 right-2">
                         <CopyButton text={project.coverImage?.prompt || ''} />
                    </div>
                </div>
            </div>

         </div>
      </div>
    </div>
  );
};

export default ProjectWorkspace;
