
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectData, ProjectStatus } from '../types';
import * as storage from '../services/storageService';
import { Calendar, Trash2, Plus, Sparkles, Loader2, Cloud, CloudCheck, AlertCircle, FolderOpen, Video, Archive, Clock } from 'lucide-react';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'synced' | 'error' | 'pending' | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState('');
  
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(Date.now());
  const isBusyRef = useRef(false);

  useEffect(() => {
      isBusyRef.current = loading;
  }, [loading]);

  useEffect(() => {
    const updateActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener('click', updateActivity);
    return () => window.removeEventListener('click', updateActivity);
  }, []);

  useEffect(() => {
      let timeoutId: ReturnType<typeof setTimeout>;
      const performSync = async () => {
          const isUserActive = (Date.now() - lastActivityRef.current) < 30000;
          if (isBusyRef.current || isUserActive) {
              timeoutId = setTimeout(performSync, 2 * 60 * 1000);
              return;
          }
          setSyncStatus('saving');
          try {
              await storage.downloadAllData();
              setSyncStatus('synced');
              setLastSyncTime(new Date().toLocaleTimeString());
              const syncedData = await storage.getProjects();
              setProjects(syncedData.sort((a, b) => b.updatedAt - a.updatedAt));
          } catch (e) {
              setSyncStatus('error');
          }
          timeoutId = setTimeout(performSync, 5 * 60 * 1000);
      };
      timeoutId = setTimeout(performSync, 5 * 60 * 1000);
      return () => {
          clearTimeout(timeoutId);
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      };
  }, []);

  useEffect(() => {
    initData();
  }, []);

  const initData = async () => {
    setLoading(true);
    const localData = await storage.getProjects();
    setProjects(localData.sort((a, b) => b.updatedAt - a.updatedAt));
    setLoading(false);
    setSyncStatus('saving');
    try {
        await storage.downloadAllData();
        setSyncStatus('synced');
        setLastSyncTime(new Date().toLocaleTimeString());
        const syncedData = await storage.getProjects();
        setProjects(syncedData.sort((a, b) => b.updatedAt - a.updatedAt));
    } catch (e) {
        setSyncStatus('error');
    }
  };

  const serialMap = useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...projects].sort((a, b) => a.createdAt - b.createdAt);
    const dailyCounts: Record<string, number> = {};
    sorted.forEach(p => {
        const date = new Date(p.createdAt);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const dateKey = `${y}-${m}-${d}`;
        if (!dailyCounts[dateKey]) dailyCounts[dateKey] = 0;
        dailyCounts[dateKey]++;
        const seq = String(dailyCounts[dateKey]).padStart(3, '0');
        map.set(p.id, `[${dateKey}-${seq}]`);
    });
    return map;
  }, [projects]);

  const displayedProjects = useMemo(() => 
    projects.filter(p => p.status !== ProjectStatus.ARCHIVED),
  [projects]);

  const handleCreate = async () => {
    const newId = await storage.createProject();
    navigate(`/project/${newId}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    await storage.deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    setDeleteConfirmId(null);
    setSyncStatus('saving');
    try {
        await storage.uploadProjects();
        setSyncStatus('synced');
        setLastSyncTime(new Date().toLocaleTimeString());
    } catch(e) {
        setSyncStatus('error');
    }
  };

  const handleArchive = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('确定要归档此项目吗？归档后项目将移入归档仓库，仅供只读浏览。')) {
        await storage.archiveProject(id);
        setProjects(prev => prev.filter(p => p.id !== id));
        setSyncStatus('saving');
        try {
            await storage.uploadProjects();
            setSyncStatus('synced');
            setLastSyncTime(new Date().toLocaleTimeString());
        } catch(e) {
            setSyncStatus('error');
        }
    }
  };

  const handleToggleMark = async (e: React.MouseEvent, project: ProjectData) => {
      e.stopPropagation();
      const updated = { ...project, marked: !project.marked };
      
      // 立即更新 UI 状态
      setProjects(prev => prev.map(p => p.id === project.id ? updated : p));
      setSyncStatus('pending'); // 设置为待保存状态
      
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      
      // 8 秒后执行持久化和云端同步
      saveTimerRef.current = setTimeout(async () => {
          setSyncStatus('saving');
          try {
              await storage.saveProject(updated);
              await storage.uploadProjects();
              setSyncStatus('synced');
              setLastSyncTime(new Date().toLocaleTimeString());
          } catch { 
              setSyncStatus('error'); 
          }
      }, 8000);
  };

  const isProjectFullyComplete = (p: ProjectData) => {
      const hasScript = !!p.script && p.script.length > 0;
      const hasTitles = !!p.titles && p.titles.length > 0;
      const hasAudio = !!p.audioFile; 
      const hasSummary = !!p.summary && p.summary.length > 0;
      // Change: Check prompt existence instead of image or options
      const hasCover = !!p.coverImage?.prompt;
      return hasScript && hasTitles && hasAudio && hasSummary && hasCover;
  };

  const getEffectiveStatus = (p: ProjectData): ProjectStatus => {
      if (p.status === ProjectStatus.ARCHIVED) return ProjectStatus.ARCHIVED;
      if (isProjectFullyComplete(p)) return ProjectStatus.COMPLETED;
      return p.status;
  };

  const getStatusStyle = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.COMPLETED: return 'bg-emerald-100 text-emerald-700 ring-emerald-600/20';
      case ProjectStatus.IN_PROGRESS: return 'bg-blue-50 text-blue-700 ring-blue-700/10';
      case ProjectStatus.ARCHIVED: return 'bg-slate-100 text-slate-600 ring-slate-500/10';
      default: return 'bg-slate-50 text-slate-600 ring-slate-500/10';
    }
  };

  const getStatusText = (status: ProjectStatus) => {
      switch (status) {
        case ProjectStatus.DRAFT: return '草稿';
        case ProjectStatus.IN_PROGRESS: return '进行中';
        case ProjectStatus.COMPLETED: return '已完成';
        case ProjectStatus.ARCHIVED: return '已归档';
        default: return status;
      }
  };

  return (
    <div className="space-y-8 pb-24 md:pb-0">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">项目仪表盘</h1>
          <p className="text-sm font-medium text-slate-500">管理您的所有视频创作项目</p>
        </div>
        <div className="flex flex-col items-end gap-2">
            <div className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full border shadow-sm transition-all ${
                syncStatus === 'synced' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                syncStatus === 'saving' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                syncStatus === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse' :
                syncStatus === 'error' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                'bg-slate-50 text-slate-400 border-slate-100'
            }`}>
                {syncStatus === 'synced' ? <CloudCheck className="w-3 h-3" /> : 
                 syncStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : 
                 syncStatus === 'pending' ? <Clock className="w-3 h-3" /> :
                 <Cloud className="w-3 h-3" />}
                {syncStatus === 'synced' ? '已同步' : syncStatus === 'saving' ? '同步中...' : syncStatus === 'pending' ? '变更待保存 (8s)' : '准备就绪'}
            </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        </div>
      ) : displayedProjects.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-16 text-center shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-3">开始您的创作</h3>
          <p className="text-slate-500 mb-8 max-w-md mx-auto">使用 AI 快速生成脚本、分镜和画面。</p>
          <button onClick={handleCreate} className="text-blue-600 hover:text-blue-500 font-bold hover:underline underline-offset-4">
            创建第一个项目 &rarr;
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-slate-200">
                    <thead className="bg-slate-50 text-slate-600">
                        <tr>
                            <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider w-16 text-center border-r border-slate-200">序号</th>
                            <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider w-56 text-center border-r border-slate-200">项目ID</th>
                            <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider min-w-[300px] border-r border-slate-200">视频主题</th>
                            <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider w-32 text-center border-r border-slate-200">状态</th>
                            <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider w-40 text-center hidden md:table-cell border-r border-slate-200">创建日期</th>
                            <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider w-24 text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {displayedProjects.map((project, index) => {
                            const status = getEffectiveStatus(project);
                            const serial = serialMap.get(project.id) || '-';

                            // Completion Status Checks
                            const hasTitles = project.titles && project.titles.length > 0;
                            const hasAudio = !!project.audioFile;
                            const hasSummary = !!project.summary && project.summary.length > 0;
                            // Change: Check prompt existence instead of image or options
                            const hasCover = !!project.coverImage?.prompt;

                            return (
                                <tr 
                                    key={project.id} 
                                    onClick={() => navigate(`/project/${project.id}`)}
                                    className={`group transition-all cursor-pointer ${
                                        project.marked 
                                        ? 'bg-emerald-50 hover:bg-emerald-100 border-l-4 border-l-emerald-500' 
                                        : 'hover:bg-slate-50/80 border-l-4 border-l-transparent'
                                    }`}
                                >
                                    <td className="py-4 px-4 text-center text-sm font-bold text-slate-400 border-r border-slate-200">
                                        {index + 1}
                                    </td>
                                    <td className="py-4 px-4 text-center border-r border-slate-200">
                                        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200 whitespace-nowrap">
                                            {serial}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 max-w-[300px] border-r border-slate-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                                <FolderOpen className="w-4 h-4" />
                                            </div>
                                            <div className="font-bold text-slate-700 text-sm md:text-base group-hover:text-blue-600 transition-colors truncate">
                                                {project.title || '未命名项目'}
                                            </div>
                                        </div>
                                    </td>
                                    
                                    <td className="py-4 px-4 text-center align-middle relative h-full border-r border-slate-200">
                                        <div className="relative w-full h-full min-h-[40px] flex items-center justify-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${getStatusStyle(status)}`}>
                                                {getStatusText(status)}
                                            </span>
                                            
                                            {/* Corner Dots - Persistent Display */}
                                            {/* Top Left: Titles */}
                                            <div 
                                                title={`爆款标题: ${hasTitles ? '已完成' : '未完成'}`}
                                                className={`absolute top-0 left-0 w-2 h-2 rounded-full border border-white shadow-sm transition-colors ${hasTitles ? 'bg-emerald-500' : 'bg-rose-400'}`} 
                                            />
                                            {/* Top Right: Audio */}
                                            <div 
                                                title={`音频文件: ${hasAudio ? '已上传' : '未上传'}`}
                                                className={`absolute top-0 right-0 w-2 h-2 rounded-full border border-white shadow-sm transition-colors ${hasAudio ? 'bg-emerald-500' : 'bg-rose-400'}`} 
                                            />
                                            {/* Bottom Left: Summary */}
                                            <div 
                                                title={`简介标签: ${hasSummary ? '已生成' : '未生成'}`}
                                                className={`absolute bottom-0 left-0 w-2 h-2 rounded-full border border-white shadow-sm transition-colors ${hasSummary ? 'bg-emerald-500' : 'bg-rose-400'}`} 
                                            />
                                            {/* Bottom Right: Cover */}
                                            <div 
                                                title={`封面策划: ${hasCover ? '已生成提示词' : '未生成提示词'}`}
                                                className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white shadow-sm transition-colors ${hasCover ? 'bg-emerald-500' : 'bg-rose-400'}`} 
                                            />
                                        </div>
                                    </td>

                                    <td className="py-4 px-4 hidden md:table-cell text-center border-r border-slate-200">
                                        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                            {new Date(project.createdAt).toLocaleDateString('zh-CN')}
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button 
                                                onClick={(e) => handleArchive(e, project.id)}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                title="归档项目"
                                            >
                                                <Archive className="w-4 h-4" />
                                            </button>

                                            {deleteConfirmId === project.id ? (
                                                <button 
                                                    onClick={(e) => handleDelete(e, project.id)}
                                                    className="text-xs bg-rose-50 text-rose-600 border border-rose-200 px-2 py-1.5 rounded font-bold hover:bg-rose-100 transition-colors whitespace-nowrap"
                                                    onMouseLeave={() => setDeleteConfirmId(null)}
                                                >
                                                    确认删除?
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteConfirmId(project.id); }}
                                                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                    title="删除"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}

                                            <div className="w-px h-4 bg-slate-200 mx-1"></div>

                                            <input
                                                type="checkbox"
                                                checked={!!project.marked}
                                                onClick={(e) => e.stopPropagation()} 
                                                onChange={(e) => {
                                                    handleToggleMark(e as any, project);
                                                }}
                                                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                                                title="标记为已完成"
                                            />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
