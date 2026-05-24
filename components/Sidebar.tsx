/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { FunctionCall, useSettings, useUI, useTools } from '@/lib/state';
import c from 'classnames';
import { DEFAULT_LIVE_API_MODEL, AVAILABLE_VOICES, VOICE_ALIASES } from '@/lib/constants';
import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { useState } from 'react';
import ToolEditorModal from './ToolEditorModal';
import { LANGUAGES } from '@/lib/languages';
import { auth, db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { X, Check, Sliders, Volume2, Globe, FileText, User, Cpu, Sparkles, CheckSquare, Square, Plus, Trash2, Edit2 } from 'lucide-react';

const AVAILABLE_MODELS = [
  DEFAULT_LIVE_API_MODEL
];

export default function Sidebar() {
  const { isSidebarOpen, toggleSidebar } = useUI();
  const { 
    systemPrompt, 
    model, 
    voice, 
    language, 
    personaName, 
    userCallName,
    setSystemPrompt, 
    setModel, 
    setVoice, 
    setLanguage, 
    setPersonaName,
    setUserCallName
  } = useSettings();
  const { tools, toggleTool, addTool, removeTool, updateTool } = useTools();
  const { connected } = useLiveAPIContext();

  const [editingTool, setEditingTool] = useState<FunctionCall | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const handleSaveTool = (updatedTool: FunctionCall) => {
    if (editingTool) {
      updateTool(editingTool.name, updatedTool);
    }
    setEditingTool(null);
  };

  const handleSaveSettings = async () => {
    setSaveStatus('saving');
    const user = auth.currentUser;
    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          settings: {
            personaName,
            userCallName,
            systemPrompt,
            voice,
            language,
            model
          }
        }, { merge: true });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } else {
      // Local successful indication
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isSidebarOpen && (
        <div 
          onClick={toggleSidebar} 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2999] transition-opacity duration-300"
        />
      )}

      {/* Drawer */}
      <aside className={c(
        "fixed top-0 right-0 h-[100dvh] w-full sm:max-w-[420px] bg-gradient-to-b from-[#141414] to-[#070707] border-l border-[#222] z-[3000] flex flex-col transition-transform duration-300 ease-in-out shadow-2xl overflow-hidden",
        isSidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#222]">
          <div className="flex items-center gap-2">
            <Sliders size={20} className="text-[#cbfb45]" />
            <span className="font-semibold text-lg text-white">Assistant Setup</span>
          </div>
          <button 
            onClick={toggleSidebar} 
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-full bg-[#1a1a1a] hover:bg-[#222]"
            aria-label="Close settings sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Setup Section */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
          
          {/* Identity Info */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 border-b border-[#222] pb-2">
              <User size={14} className="text-[#cbfb45]" />
              Persona Identity
            </h4>

            {/* Persona Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400 ml-1">Persona Name</label>
              <input 
                type="text" 
                value={personaName}
                onChange={e => setPersonaName(e.target.value)}
                disabled={connected}
                className="w-full bg-[#151515] border border-[#222] rounded-xl px-4 py-3 placeholder-gray-600 font-medium text-sm text-white focus:outline-none focus:border-[#cbfb45] disabled:opacity-50 transition-colors"
                placeholder="e.g. Beatrice"
              />
            </div>

            {/* User Call Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400 ml-1">What to call you</label>
              <input 
                type="text" 
                value={userCallName}
                onChange={e => setUserCallName(e.target.value)}
                disabled={connected}
                className="w-full bg-[#151515] border border-[#222] rounded-xl px-4 py-3 placeholder-gray-600 font-medium text-sm text-white focus:outline-none focus:border-[#cbfb45] disabled:opacity-50 transition-colors"
                placeholder="e.g. Boss"
              />
            </div>
          </div>

          {/* Localization & Sound */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 border-b border-[#222] pb-2">
              <Volume2 size={14} className="text-[#cbfb45]" />
              Voice and Language
            </h4>

            {/* Voice select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400 ml-1">Voice Persona</label>
              <div className="relative">
                <select 
                  value={voice} 
                  onChange={e => setVoice(e.target.value)}
                  disabled={connected}
                  className="w-full appearance-none bg-[#151515] border border-[#222] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#cbfb45] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {AVAILABLE_VOICES.map(v => (
                    <option key={v} value={v}>
                      {VOICE_ALIASES[v] || v}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                  <span className="text-[10px]">▼</span>
                </div>
              </div>
            </div>

            {/* Language Select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400 ml-1">Spoken Language</label>
              <div className="relative">
                <select 
                  value={language} 
                  onChange={e => setLanguage(e.target.value)}
                  disabled={connected}
                  className="w-full appearance-none bg-[#151515] border border-[#222] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#cbfb45] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                  <span className="text-[10px]">▼</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Intelligence config */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 border-b border-[#222] pb-2">
              <FileText size={14} className="text-[#cbfb45]" />
              AI System prompt
            </h4>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400 ml-1">Instruction / Persona Prompt</label>
              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                disabled={connected}
                rows={6}
                className="w-full bg-[#151515] border border-[#222] rounded-xl p-4 placeholder-gray-600 font-medium text-sm text-white focus:outline-none focus:border-[#cbfb45] disabled:opacity-50 transition-colors resize-none leading-relaxed"
                placeholder="Give Beatrice specific instructions on how to behave, respond, and customize context..."
              />
            </div>

            {/* Model Setup */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400 ml-1">Gemini AI Model Type</label>
              <div className="relative">
                <select 
                  value={model} 
                  onChange={e => setModel(e.target.value)}
                  disabled={connected}
                  className="w-full appearance-none bg-[#151515] border border-[#222] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#cbfb45] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {AVAILABLE_MODELS.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                  <span className="text-[10px]">▼</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tools Toggle & Custom Configuration Section */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 border-b border-[#222] pb-2">
              <Cpu size={14} className="text-[#cbfb45]" />
              Dynamic Tools Map
            </h4>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {tools.map(tool => (
                <div 
                  key={tool.name} 
                  className="flex items-center justify-between p-3 bg-[#151515] border border-[#222] rounded-xl"
                >
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      id={`tool-checkbox-${tool.name}`}
                      checked={tool.isEnabled}
                      onChange={() => toggleTool(tool.name)}
                      disabled={connected}
                      className="hidden"
                    />
                    <span className="text-gray-400 hover:text-white transition-colors">
                      {tool.isEnabled ? (
                        <CheckSquare size={18} className="text-[#cbfb45]" />
                      ) : (
                        <Square size={18} />
                      )}
                    </span>
                    <span className="text-sm font-medium text-white truncate max-w-[140px]">
                      {tool.name}
                    </span>
                  </label>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingTool(tool)}
                      disabled={connected}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-[#222] rounded-lg transition-colors disabled:opacity-50"
                      aria-label={`Edit ${tool.name}`}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => removeTool(tool.name)}
                      disabled={connected}
                      className="p-1.5 text-[#ff4d4d] hover:bg-[#2a1111] rounded-lg transition-colors disabled:opacity-50"
                      aria-label={`Delete ${tool.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addTool}
              disabled={connected}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-transparent hover:bg-white/5 border border-dashed border-gray-700 hover:border-gray-500 rounded-xl font-medium text-xs text-gray-300 transition-all disabled:opacity-50"
            >
              <Plus size={14} /> Add Function Call Call
            </button>
          </div>
        </div>

        {/* Global Action Footer */}
        <div className="p-4 bg-[#111] border-t border-[#222] flex flex-col gap-2">
          <button 
            type="button"
            onClick={handleSaveSettings}
            className={c(
              "w-full py-3.5 rounded-full font-bold text-sm transition-all flex items-center justify-center gap-1.5",
              saveStatus === 'saved' ? "bg-[#00d97e] text-white" :
              saveStatus === 'saving' ? "bg-gray-700 text-gray-300 pointer-events-none" :
              saveStatus === 'error' ? "bg-red-600 text-white" :
              "bg-[#cbfb45] text-black hover:opacity-90 active:scale-[0.98]"
            )}
          >
            {saveStatus === 'saving' && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {saveStatus === 'saved' && <Check size={16} />}
            {saveStatus === 'saved' ? 'Setup Saved Successfully' :
             saveStatus === 'saving' ? 'Syncing Custom Setup...' :
             saveStatus === 'error' ? 'Failed to sync, Retry' :
             'Save Setup Config'}
          </button>
        </div>
      </aside>

      {editingTool && (
        <ToolEditorModal
          tool={editingTool}
          onClose={() => setEditingTool(null)}
          onSave={handleSaveTool}
        />
      )}
    </>
  );
}
