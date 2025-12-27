
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inspiration, ProjectData, ProjectStatus } from '../types';
import * as storage from '../services/storageService';
import { Lightbulb, Plus, Trash2, Loader2, X, Save, ArrowLeft, Star, ArrowUpDown, ArrowUp, ArrowDown, Rocket, CheckSquare, Square, Filter, Download, Cloud, CloudCheck, Clock, FileText } from 'lucide-react';

const InspirationRepo: React.FC = () => {
  const navigate = useNavigate();
  const [inspirations, setInspirations] = useState<Inspiration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Sync Status State
  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'synced' | 'error' | 'pending' | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState('');
  
  // Sorting State - Initialize from localStorage if available
  const [sortConfig, setSortConfig] = useState<{ key: 'rating' | 'createdAt'; direction: 'asc' | 'desc' }>(() => {
    try {
        const saved = localStorage.getItem('lva_inspiration_sort');
        if (saved) return JSON.parse(saved);
    } catch(e) {}
    return { key: 'createdAt', direction: 'desc' };
  });

  // Filtering State
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Form Data
  const [singleData, setSingleData] = useState<Partial<Inspiration>>({});

  // Activity Tracking Refs
  const lastActivityRef = useRef(Date.now());
  const isBusyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update busy ref based on state
  useEffect(() => {
      isBusyRef.current = loading || showModal;
  }, [loading, showModal]);

  // Activity Listeners
  useEffect(() => {
    const updateActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener('click', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('mousemove', updateActivity);
    return () => {
        window.removeEventListener('click', updateActivity);
        window.removeEventListener('keydown', updateActivity);
        window.removeEventListener('mousemove', updateActivity);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Smart Auto-Sync Loop
  useEffect(() => {
      let timeoutId: ReturnType<typeof setTimeout>;

      const performSync = async () => {
          const isUserActive = (Date.now() - lastActivityRef.current) < 30000;
          
          if (isBusyRef.current || isUserActive) {
              timeoutId = setTimeout(performSync, 2 * 60 * 1000); // Retry in 2 mins
              return;
          }

          setSyncStatus('saving');
          try {
              await storage.downloadAllData();
              setSyncStatus('synced');
              setLastSyncTime(new Date().toLocaleTimeString());

              // Refresh Data
              const syncedData = await storage.getInspirations();
              setInspirations(syncedData);
          } catch (e) {
              console.warn("Auto-sync failed", e);
              setSyncStatus('error');
          }

          // Schedule next run (5 mins)
          timeoutId = setTimeout(performSync, 5 * 60 * 1000);
      };

      // Initial Delay
      timeoutId = setTimeout(performSync, 5 * 60 * 1000);

      return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    initData();
  }, []);

  const initData = async () => {
    setLoading(true);
    // 1. Load Local
    const localData = await storage.getInspirations();
    setInspirations(localData);
    setLoading(false);

    // 2. Sync
    setSyncStatus('saving');
    try {
        await storage.downloadAllData();
        setSyncStatus('synced');
        setLastSyncTime(new Date().toLocaleTimeString());
        
        // 3. Reload
        const syncedData = await storage.getInspirations();
        setInspirations(syncedData);
    } catch (e) {
        console.warn("Auto-sync failed", e);
        setSyncStatus('error');
    }
  };

  const handleAutoPush = async () => {
      setSyncStatus('pending'); // 设置为待保存状态
      
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      
      saveTimerRef.current = setTimeout(async () => {
          setSyncStatus('saving');
          try {
              // Push both Inspirations and Projects (in case of approval)
              await storage.uploadInspirations();
              await storage.uploadProjects();
              setSyncStatus('synced');
              setLastSyncTime(new Date().toLocaleTimeString());
          } catch(e) {
              console.error(e);
              setSyncStatus('error');
          }
      }, 8000);
  };

  // Persist sort config whenever it changes
  useEffect(() => {
    localStorage.setItem('lva_inspiration_sort', JSON.stringify(sortConfig));
  }, [sortConfig]);

  // Extract unique categories for filter dropdown
  const uniqueCategories = useMemo(() => {
    const categories = new Set(inspirations.map(i => i.category).filter(c => c && c !== '未分类'));
    return Array.from(categories).sort();
  }, [inspirations]);

  // Filtering & Sorting Logic
  const sortedInspirations = useMemo(() => {
    let data = [...inspirations];

    // 1. Filter
    if (selectedCategory !== 'ALL') {
        data = data.filter(i => i.category === selectedCategory);
    }

    // 2. Sort
    data.sort((a, b) => {
        if (sortConfig.key === 'rating') {
            const rateA = parseFloat(a.rating || '0');
            const rateB = parseFloat(b.rating || '0');
            if (rateA === rateB) return 0;
            return sortConfig.direction === 'asc' ? rateA - rateB : rateB - rateA;
        } else {
            // Default: Created At
            return sortConfig.direction === 'asc' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
        }
    });
    return data;
  }, [inspirations, sortConfig, selectedCategory]);

  const handleSort = (key: 'rating' | 'createdAt') => {
      setSortConfig(prev => ({
          key,
          direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
      }));
  };

  const handleDelete = async (id: string) => {
    await storage.deleteInspiration(id);
    setInspirations(prev => prev.filter(i => i.id !== id));
    setDeleteConfirmId(null);
    // 删除操作为了 UI 一致性，立即触发保存
    setSyncStatus('saving');
    try {
        await storage.uploadInspirations();
        setSyncStatus('synced');
        setLastSyncTime(new Date().toLocaleTimeString());
    } catch { setSyncStatus('error'); }
  };

  const handleToggleMark = async (item: Inspiration) => {
    const updated = { ...item, marked: !item.marked };
    // Optimistic update
    setInspirations(prev => prev.map(i => i.id === item.id ? updated : i));
    await storage.saveInspiration(updated);
    await handleAutoPush();
  };
  
  const handleTitleChange = (id: string, newTitle: string) => {
      setInspirations(prev => prev.map(i => i.id === id ? { ...i, viralTitle: newTitle } : i));
  };

  const handleTitleBlur = async (id: string) => {
      const item = inspirations.find(i => i.id === id);
      if (item) {
          await storage.saveInspiration(item);
          await handleAutoPush();
      }
  };

  const handleApprove = async (item: Inspiration) => {
    // 采纳是关键流程操作，立即保存
    setSyncStatus('saving');
    if (!item.marked) {
        const updatedInspiration = { ...item, marked: true };
        setInspirations(prev => prev.map(i => i.id === item.id ? updatedInspiration : i));
        await storage.saveInspiration(updatedInspiration);
    }

    const newId = crypto.randomUUID();
    const titleSnippet = item.viralTitle.length > 20 ? item.viralTitle.substring(0, 20) + '...' : item.viralTitle;
    
    const newProject: ProjectData = {
      id: newId,
      title: titleSnippet,
      status: ProjectStatus.DRAFT,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      inputs: {
        topic: item.viralTitle,
        tone: '信息丰富且引人入胜',
        language: '中文'
      }
    };

    await storage.saveProject(newProject);
    try {
        await storage.uploadInspirations();
        await storage.uploadProjects();
        setSyncStatus('synced');
        setLastSyncTime(new Date().toLocaleTimeString());
    } catch { setSyncStatus('error'); }

    navigate(`/project/${newId}`);
  };

  const handleDownloadExcel = () => {
    if (sortedInspirations.length === 0) {
        alert("暂无数据可导出");
        return;
    }

    let csvContent = "\uFEFF"; 
    csvContent += "序号,分类,标题,得分\n";
    
    sortedInspirations.forEach((item, index) => {
        const row = [
            index + 1,
            `"${(item.category || '').replace(/"/g, '""')}"`,
            `"${(item.viralTitle || '').replace(/"/g, '""')}"`,
            `"${(item.rating || '').replace(/"/g, '""')}"`
        ];
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `灵感仓库_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetModal = () => {
    setShowModal(false);
    setSingleData({});
  };

  const handleSaveSingle = async () => {
    if (!singleData.viralTitle) {
        alert("请输入灵感标题");
        return;
    }
    
    const newItem: Inspiration = {
      id: crypto.randomUUID(),
      content: singleData.content || '',
      category: singleData.category || '未分类',
      trafficLogic: singleData.trafficLogic || '',
      viralTitle: singleData.viralTitle,
      rating: singleData.rating || '',
      createdAt: Date.now()
    };
    await storage.saveInspiration(newItem);
    setInspirations(prev => [newItem, ...prev]);
    resetModal();
    // 录入灵感后 8 秒保存同步
    await handleAutoPush();
  };

  return (
    <div className="space-y-6 md:space-y-8 h-full flex flex-col pb-24 md:pb-0">
      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-end flex-shrink-0">
        <div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600 mb-0.5 md:mb-2 tracking-tight flex items-center gap-2 md:gap-3">
            <Lightbulb className="w-6 h-6 md:w-8 md:h-8 text-amber-500" />
            视频灵感仓库
          </h1>
          <p className="text-xs md:text-base text-slate-500 font-medium">收集灵感，打造爆款选题库。</p>
        </div>
        <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
             <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md border animate-in fade-in transition-colors self-end ${
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
                {syncStatus === 'synced' ? `已同步: ${lastSyncTime}` :
                 syncStatus === 'saving' ? '同步中...' :
                 syncStatus === 'pending' ? '变更待保存 (8s)' : '准备就绪'}
            </div>

            <div className="flex gap-2 md:gap-3">
                <button onClick={handleDownloadExcel} className="flex-1 md:flex-none justify-center bg-white border border-slate-200 text-slate-600 hover:text-amber-600 hover:border-amber-200 px-4 py-2.5 md:py-3 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 text-sm">
                    <Download className="w-4 h-4 md:w-5 md:h-5" /> <span className="hidden md:inline">导出表格</span><span className="md:hidden">导出</span>
                </button>
                <button onClick={() => setShowModal(true)} className="flex-1 md:flex-none justify-center bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 md:py-3 rounded-xl font-bold shadow-lg shadow-amber-500/30 flex items-center gap-2 transition-all hover:-translate-y-0.5 text-sm">
                    <Plus className="w-4 h-4 md:w-5 md:h-5" /> <span className="md:inline">记录灵感</span><span className="md:hidden">记录</span>
                </button>
            </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-amber-500 animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)] overflow-hidden flex-1 flex flex-col">
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-100 text-slate-600 border-b border-slate-200 z-10">
                <tr>
                  <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider w-16 text-center">#</th>
                  <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider w-48 text-center relative group">
                     <button onClick={(e) => { e.stopPropagation(); setShowCategoryFilter(!showCategoryFilter); }} className={`flex items-center justify-center gap-1 mx-auto transition-colors ${selectedCategory !== 'ALL' ? 'text-amber-600 font-extrabold' : 'hover:text-slate-800'}`}>
                        {selectedCategory === 'ALL' ? '分类' : selectedCategory} <Filter className="w-3 h-3" />
                     </button>
                     {showCategoryFilter && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowCategoryFilter(false)} />
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-40 bg-white rounded-xl shadow-xl border border-slate-100 z-20 py-1">
                                <div onClick={() => { setSelectedCategory('ALL'); setShowCategoryFilter(false); }} className={`px-4 py-2.5 text-xs font-bold hover:bg-slate-50 cursor-pointer ${selectedCategory === 'ALL' ? 'text-amber-600 bg-amber-50' : 'text-slate-600'}`}>全部</div>
                                {uniqueCategories.map(cat => (
                                    <div key={cat} onClick={() => { setSelectedCategory(cat); setShowCategoryFilter(false); }} className={`px-4 py-2.5 text-xs font-bold hover:bg-slate-50 cursor-pointer truncate ${selectedCategory === cat ? 'text-amber-600 bg-amber-50' : 'text-slate-600'}`}>{cat}</div>
                                ))}
                            </div>
                        </>
                     )}
                  </th>
                  <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider text-center">标题</th>
                  <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider w-28 text-center cursor-pointer hover:bg-slate-200/50" onClick={() => handleSort('rating')}>评分 {sortConfig.key === 'rating' ? (sortConfig.direction === 'desc' ? <ArrowDown className="w-3 h-3"/> : <ArrowUp className="w-3 h-3"/>) : <ArrowUpDown className="w-3 h-3" />}</th>
                  <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider w-56 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedInspirations.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-12 text-slate-400">暂无灵感</td></tr>
                ) : (
                    sortedInspirations.map((item, index) => (
                    <tr key={item.id} className={`group transition-colors ${item.marked ? 'bg-emerald-50 hover:bg-emerald-100/60' : 'hover:bg-amber-50/30'}`}>
                        <td className="py-3 px-4 text-center text-xs font-bold text-slate-400">{index + 1}</td>
                        <td className="py-3 px-4 text-center text-[10px] font-bold text-slate-800">{item.category}</td>
                        <td className="py-3 px-4">
                            <input 
                                value={item.viralTitle} 
                                onChange={(e) => handleTitleChange(item.id, e.target.value)}
                                onBlur={() => handleTitleBlur(item.id)}
                                className={`w-full bg-transparent border border-transparent focus:border-amber-300 focus:bg-white focus:ring-2 focus:ring-amber-100 rounded-lg px-2 py-1.5 text-sm font-bold transition-all outline-none ${item.marked ? 'text-emerald-800' : 'text-slate-800'}`}
                                placeholder="输入标题..."
                            />
                        </td>
                        <td className="py-3 px-4 text-center">{item.rating && <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-md border border-orange-100"><Star className="w-3 h-3 fill-orange-500" /> {item.rating}</span>}</td>
                        <td className="py-3 px-4 text-right pr-6">
                            <div className="flex items-center justify-center gap-3">
                                <button onClick={() => handleApprove(item)} className="px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold rounded-lg shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-1.5 whitespace-nowrap"><Rocket className="w-3 h-3" /> 采纳</button>
                                <button onClick={() => handleToggleMark(item)} className={`p-1.5 rounded-lg transition-all ${item.marked ? 'text-emerald-600 bg-emerald-100' : 'text-slate-300 hover:text-emerald-500'}`}>{item.marked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}</button>
                                {deleteConfirmId === item.id ? (
                                    <button onClick={() => handleDelete(item.id)} className="text-xs bg-rose-50 text-rose-600 border border-rose-200 px-2 py-1.5 rounded-lg font-bold" onMouseLeave={() => setDeleteConfirmId(null)}>删除?</button>
                                ) : (
                                    <button onClick={() => setDeleteConfirmId(item.id)} className="p-1.5 text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                                )}
                            </div>
                        </td>
                    </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">记录新灵感</h3>
              <button onClick={resetModal} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 space-y-5 overflow-y-auto">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">灵感标题 (必填)</label>
                    <input 
                        autoFocus
                        value={singleData.viralTitle || ''} 
                        onChange={e => setSingleData({...singleData, viralTitle: e.target.value})} 
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none" 
                        placeholder="输入核心想法或视频标题..."
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">分类</label>
                      <input 
                        value={singleData.category || ''} 
                        onChange={e => setSingleData({...singleData, category: e.target.value})} 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-amber-400 transition-all" 
                        placeholder="例如：科技、Vlog..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">预估评分</label>
                      <input 
                        value={singleData.rating || ''} 
                        onChange={e => setSingleData({...singleData, rating: e.target.value})} 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-amber-400 transition-all" 
                        placeholder="0-10" 
                      />
                    </div>
                </div>

                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">底层逻辑 (可选)</label>
                   <input 
                        value={singleData.trafficLogic || ''} 
                        onChange={e => setSingleData({...singleData, trafficLogic: e.target.value})} 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:border-amber-400 transition-all" 
                        placeholder="为什么这个话题会火？"
                   />
                </div>

                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5">
                       <FileText className="w-3.5 h-3.5" /> 备注 / 详细内容
                   </label>
                   <textarea
                        value={singleData.content || ''}
                        onChange={(e) => setSingleData({...singleData, content: e.target.value})}
                        placeholder="在此记录更多细节..."
                        className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-amber-400 transition-all resize-none text-sm"
                   />
                </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button onClick={resetModal} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-white hover:shadow-sm rounded-xl transition-all">取消</button>
                <button 
                  onClick={handleSaveSingle}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all hover:-translate-y-0.5"
                >
                  <Save className="w-4 h-4" /> 确认保存
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InspirationRepo;
