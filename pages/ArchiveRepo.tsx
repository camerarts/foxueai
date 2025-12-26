
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectData, ProjectStatus } from '../types';
import * as storage from '../services/storageService';
import { Calendar, Trash2, Loader2, Archive, ArchiveRestore, Cloud, CloudCheck, AlertCircle } from 'lucide-react';

const ArchiveRepo: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'synced' | 'error' | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState('');

  const lastActivityRef = useRef(Date.now());
  const isBusyRef = useRef(false);

  useEffect(() => { isBusyRef.current = loading; }, [loading]);

  useEffect(() => {
    const updateActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener('click', updateActivity);
    window.addEventListener('keydown', updateActivity);
    return () => {
        window.removeEventListener('click', updateActivity);
        window.removeEventListener('keydown', updateActivity);
    };
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
          } catch (e) { setSyncStatus('error'); }
          timeoutId = setTimeout(performSync, 5 * 60 * 1000);
      };
      timeoutId = setTimeout(performSync, 5 * 60 * 1000);
      return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => { initData(); }, []);

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
    } catch (e) { setSyncStatus('error'); }
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

  const archivedProjects = useMemo(() => 
    projects.filter(p => p.status === ProjectStatus.ARCHIVED),
  [projects]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await storage.deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    setDeleteConfirmId(null);
    setSyncStatus('saving');
    try {
        await storage.uploadProjects();
        setSyncStatus('synced');
    } catch { setSyncStatus('error'); }
  };

  const handleUnarchive = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (window.confirm('确定要恢复到项目列表吗？')) {
          await storage.unarchiveProject(id);
          setProjects(prev => prev.map(p => p.id === id ? { ...p, status: ProjectStatus.IN_PROGRESS } : p));
          setSyncStatus('saving');
          try { await storage.uploadProjects(); setSyncStatus('synced'); } catch { setSyncStatus('error'); }
      }
  };

  return (
    <div className="space-y-8 pb-24 md:pb-0">
      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-end">
        <div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Archive className="w-6 h-6 md:w-8 md:h-8 text-slate-400" /> 归档仓库
          </h1>
          <p className="text-sm font-medium text-slate-500">查看已归档的视频项目，支持恢复到工作台。</p>
        </div>
        <div className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full border bg-white shadow-sm ${syncStatus === 'synced' ? 'text-emerald-600 border-emerald-100' : 'text-slate-400 border-slate-100'}`}>
            {syncStatus === 'synced' ? <CloudCheck className="w-3 h-3" /> : syncStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cloud className="w-3 h-3" />}
            {syncStatus === 'synced' ? `已同步云端: ${lastSyncTime}` : syncStatus === 'saving' ? '同步中...' : '准备就绪'}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-slate-300 animate-spin" /></div>
      ) : archivedProjects.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center shadow-sm">
          <Archive className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-800 mb-2">暂无归档项目</h3>
          <p className="text-slate-400">项目完成后可在列表中点击归档，保持工作台整洁。</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-600">
                        <tr>
                            <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider w-16 text-center">序号</th>
                            <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider w-52 text-center">序列号</th>
                            <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider">视频主题</th>
                            <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider w-32 text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {archivedProjects.map((project, index) => {
                            const serial = serialMap.get(project.id) || '-';
                            return (
                                <tr 
                                    key={project.id} 
                                    onClick={() => navigate(`/project/${project.id}`)}
                                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                >
                                    <td className="py-4 px-4 text-center text-sm font-bold text-slate-300">{index + 1}</td>
                                    <td className="py-4 px-4 text-center">
                                        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200 whitespace-nowrap">
                                            {serial}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="font-bold text-slate-600 truncate max-w-md group-hover:text-indigo-600 transition-colors">
                                            {project.title}
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button 
                                                onClick={(e) => handleUnarchive(e, project.id)} 
                                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-all" 
                                                title="恢复项目"
                                            >
                                                <ArchiveRestore className="w-4 h-4" />
                                            </button>
                                            {deleteConfirmId === project.id ? (
                                                <button 
                                                    onClick={(e) => handleDelete(e, project.id)} 
                                                    className="text-[10px] bg-rose-50 text-rose-600 border border-rose-200 px-2 py-1 rounded font-bold hover:bg-rose-100" 
                                                    onMouseLeave={() => setDeleteConfirmId(null)}
                                                >
                                                    确认删除?
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(project.id); }} 
                                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
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

export default ArchiveRepo;
