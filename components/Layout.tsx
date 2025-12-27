
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Settings, Video, Plus, Image as ImageIcon, Lightbulb, LogOut, CloudUpload, CloudDownload, Loader2, CheckCircle2, XCircle, Circle, Menu, X, Sparkles, Type, Archive, AlertCircle, Key, Mic } from 'lucide-react';
import * as storage from '../services/storageService';
import ApiKeyConfigModal from './ApiKeyConfigModal';

interface LayoutProps {
  children: React.ReactNode;
}

type SyncStatus = 'idle' | 'loading' | 'success' | 'error';

interface UploadState {
  projects: SyncStatus;
  inspirations: SyncStatus;
  tools: SyncStatus;
  settings: SyncStatus;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState<'upload' | 'download' | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({
    projects: 'idle',
    inspirations: 'idle',
    tools: 'idle',
    settings: 'idle'
  });
  const [unsavedModules, setUnsavedModules] = useState<string[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // New Project Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectTopic, setNewProjectTopic] = useState('');
  const [creating, setCreating] = useState(false);

  const isActive = (path: string) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  const isWorkspace = location.pathname.startsWith('/project/') && !location.pathname.endsWith('/images');

  useEffect(() => {
    const checkStatus = () => {
        setUnsavedModules(storage.getUnsavedModules());
    };
    checkStatus();
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleConfirmCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTopic.trim()) return;
    setCreating(true);
    try {
        const newId = await storage.createProject(newProjectTopic);
        setShowCreateModal(false);
        navigate(`/project/${newId}`);
    } catch (err) { console.error(err); } finally { setCreating(false); }
  };

  const handleUpload = async () => {
    if (!window.confirm('确定要将所有本地数据上传覆盖到云端吗？')) return;
    setShowUploadModal(true);
    setSyncing('upload');
    setUploadState({ projects: 'loading', inspirations: 'idle', tools: 'idle', settings: 'idle' });

    try {
        await storage.uploadProjects();
        setUploadState(prev => ({ ...prev, projects: 'success', inspirations: 'loading' }));
        await storage.uploadInspirations();
        setUploadState(prev => ({ ...prev, inspirations: 'success', tools: 'loading' }));
        await storage.uploadTools();
        setUploadState(prev => ({ ...prev, tools: 'success', settings: 'loading' }));
        await storage.uploadPrompts();
        setUploadState(prev => ({ ...prev, settings: 'success' }));

        setTimeout(() => { window.location.reload(); }, 500);
    } catch (e: any) {
        console.error(e);
        setShowUploadModal(false);
        setSyncing(null);
        alert(`上传失败: ${e.message}`);
    }
  };

  const handleDownload = async () => {
    if (window.confirm('确定要从云端下载数据吗？这将覆盖本地记录。')) {
        setSyncing('download');
        try {
            await storage.downloadAllData();
            window.location.reload();
        } catch (e: any) {
            alert(`下载失败: ${e.message}`);
        } finally { setSyncing(null); }
    }
  };

  const StatusIcon = ({ status }: { status: SyncStatus }) => {
      switch (status) {
          case 'loading': return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
          case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
          case 'error': return <XCircle className="w-5 h-5 text-rose-500" />;
          default: return <Circle className="w-5 h-5 text-slate-200" />;
      }
  };

  return (
    <div className="h-screen flex text-slate-900 font-sans overflow-hidden bg-slate-50">
      <aside className={`fixed inset-y-0 left-0 z-50 w-20 flex flex-col items-center py-6 bg-white border-r border-slate-200 shadow-sm sm:relative sm:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col items-center mb-8">
            <Link to="/dashboard" className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Video className="text-white w-6 h-6" />
            </Link>
        </div>

        <nav className="flex-1 flex flex-col gap-4 w-full px-2 items-center overflow-y-auto no-scrollbar">
          <button onClick={() => setShowCreateModal(true)} className="w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center transition-all mb-2"><Plus className="w-5 h-5" /></button>
          
          <Link to="/dashboard" className={`flex flex-col items-center justify-center py-2 w-full rounded-xl transition-all gap-1 ${isActive('/dashboard') ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
            <LayoutDashboard className="w-5 h-5" /><span className="text-[10px] font-medium">项目</span>
          </Link>
          <Link to="/ai-titles" className={`flex flex-col items-center justify-center py-2 w-full rounded-xl transition-all gap-1 ${isActive('/ai-titles') ? 'bg-violet-50 text-violet-600' : 'text-slate-400 hover:text-slate-600'}`}>
            <Type className="w-5 h-5" /><span className="text-[10px] font-medium">标题</span>
          </Link>
          <Link to="/inspiration" className={`flex flex-col items-center justify-center py-2 w-full rounded-xl transition-all gap-1 ${isActive('/inspiration') ? 'bg-amber-50 text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}>
            <Lightbulb className="w-5 h-5" /><span className="text-[10px] font-medium">灵感</span>
          </Link>
          <Link to="/archive" className={`flex flex-col items-center justify-center py-2 w-full rounded-xl transition-all gap-1 ${isActive('/archive') ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
            <Archive className="w-5 h-5" /><span className="text-[10px] font-medium">归档</span>
          </Link>
          <Link to="/voice" className={`flex flex-col items-center justify-center py-2 w-full rounded-xl transition-all gap-1 ${isActive('/voice') ? 'bg-fuchsia-50 text-fuchsia-600' : 'text-slate-400 hover:text-slate-600'}`}>
            <Mic className="w-5 h-5" /><span className="text-[10px] font-medium">语音</span>
          </Link>

          <div className="mt-auto w-full flex flex-col gap-2 pt-4 border-t border-slate-100 items-center">
             
             {/* Key Configuration Button */}
             <button 
                onClick={() => setShowKeyModal(true)}
                className="flex flex-col items-center justify-center py-2 w-full rounded-xl transition-all gap-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                title="配置 API Key"
             >
                <Key className="w-5 h-5" />
                <span className="text-[10px] font-medium">密钥</span>
             </button>

             <div className="relative w-full px-2" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
                <button
                    onClick={handleUpload}
                    disabled={!!syncing}
                    className={`flex flex-col items-center justify-center py-2 w-full rounded-xl transition-all gap-1 ${unsavedModules.length > 0 ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                >
                    {syncing === 'upload' ? <Loader2 className="w-5 h-5 animate-spin" /> : <CloudUpload className="w-5 h-5" />}
                    <span className="text-[10px] font-medium">上传</span>
                </button>
                
                {/* Custom Granular Tooltip */}
                {showTooltip && unsavedModules.length > 0 && (
                    <div className="absolute left-full ml-2 top-0 z-[100] w-40 bg-slate-900 text-white rounded-xl shadow-2xl p-3 animate-in fade-in slide-in-from-left-2 duration-200 pointer-events-none">
                        <div className="flex items-center gap-1.5 mb-2 text-[10px] font-black text-rose-400 uppercase tracking-widest border-b border-white/10 pb-1.5">
                            <AlertCircle className="w-3 h-3" /> 待上传项
                        </div>
                        <ul className="space-y-1.5">
                            {unsavedModules.map(m => (
                                <li key={m} className="text-[11px] font-bold flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-rose-500" /> {m}
                                </li>
                            ))}
                        </ul>
                        <div className="absolute top-4 -left-1 w-2 h-2 bg-slate-900 rotate-45" />
                    </div>
                )}
             </div>

            <button onClick={handleDownload} disabled={!!syncing} className="flex flex-col items-center justify-center py-2 w-full rounded-xl transition-all gap-1 hover:bg-slate-100 text-slate-400"><CloudDownload className="w-5 h-5" /></button>
            <Link to="/settings" className={`flex flex-col items-center justify-center py-2 w-full rounded-xl transition-all ${isActive('/settings') ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}><Settings className="w-5 h-5" /></Link>
          </div>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        {isWorkspace ? <div className="flex-1 h-full w-full">{children}</div> : <div className="flex-1 overflow-y-auto w-full p-4 md:p-8"><div className="container mx-auto max-w-7xl min-h-full">{children}</div></div>}
      </main>

      {showUploadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center mb-6"><div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4"><CloudUpload className="w-6 h-6 text-blue-600" /></div><h3 className="text-lg font-bold">同步中</h3></div>
                <div className="space-y-3">
                    {['Projects', 'Inspirations', 'Tools', 'Settings'].map((key) => (
                        <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-xs font-bold text-slate-600 uppercase">{key}</span>
                            <StatusIcon status={uploadState[key.toLowerCase() as keyof UploadState]} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative animate-in zoom-in-95 duration-200">
                <button onClick={() => setShowCreateModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                <div className="flex flex-col items-center mb-8"><div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg mb-4"><Sparkles className="w-6 h-6 text-white" /></div><h3 className="text-xl font-bold">新建项目</h3></div>
                <form onSubmit={handleConfirmCreate} className="space-y-6">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">视频主题</label>
                    <input autoFocus required value={newProjectTopic} onChange={(e) => setNewProjectTopic(e.target.value)} placeholder="输入主题..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all" /></div>
                    <button type="submit" disabled={creating} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2">{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}创建</button>
                </form>
            </div>
        </div>
      )}

      {showKeyModal && (
        <ApiKeyConfigModal onClose={() => setShowKeyModal(false)} />
      )}
    </div>
  );
};

export default Layout;
