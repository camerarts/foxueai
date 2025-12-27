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

const ProjectWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProject = async () => {
      if (!id) return;
      try {
        const data = await storage.getProject(id);
        if (data) {
          setProject(data);
        } else {
          // navigate('/dashboard');
        }
      } catch (error) {
        console.error("Failed to load project", error);
      } finally {
        setLoading(false);
      }
    };
    loadProject();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="w-10 h-10 text-rose-500" />
        <p className="text-slate-500 font-bold">Project not found</p>
        <button onClick={() => navigate('/dashboard')} className="text-blue-600 hover:underline">Return to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#F8F9FC]">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
           <h1 className="text-xl font-bold text-slate-800">{project.title}</h1>
           <p className="text-xs text-slate-500">Status: {project.status}</p>
        </div>
      </div>
      <div className="flex-1 p-8 overflow-y-auto">
         <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
            <Sparkles className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-slate-700 mb-2">Workspace Placeholder</h2>
            <p className="text-slate-500">The full content of this file was truncated. This is a recovered placeholder to fix build errors.</p>
         </div>
      </div>
    </div>
  );
};

export default ProjectWorkspace;