import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Share, Lock, ExternalLink, Edit3, Cloud, FileText, Calendar, Mail, Folder, Users, CheckSquare, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useUI } from '../lib/state';

// High-fidelity code and json highlighter helpers
const highlightJson = (jsonStr: string) => {
  const lines = jsonStr.split('\n');
  return (
    <div className="font-mono text-[10px] leading-relaxed w-full">
      {lines.map((line, idx) => {
        const regex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|-?\b\d+(?:\.\d*)?(?:[eE][+-]?\d+)?\b/g;
        let lastIndex = 0;
        const result: React.ReactNode[] = [];
        let match;

        while ((match = regex.exec(line)) !== null) {
          const index = match.index;
          if (index > lastIndex) {
            result.push(line.substring(lastIndex, index));
          }

          const text = match[0];
          if (/^"/.test(text)) {
            if (/:$/.test(text)) { // JSON Key
              result.push(<span key={index} className="text-[#a855f7] font-bold">{text.replace(/:$/, '')}</span>);
              result.push(":");
            } else { // String value
              result.push(<span key={index} className="text-[#059669]">{text}</span>);
            }
          } else if (/^(true|false|null)$/.test(text)) { // Boolean/null
            result.push(<span key={index} className="text-[#ea580c] font-semibold">{text}</span>);
          } else { // Number
            result.push(<span key={index} className="text-[#dc2626]">{text}</span>);
          }

          lastIndex = regex.lastIndex;
        }

        if (lastIndex < line.length) {
          result.push(line.substring(lastIndex));
        }

        return (
          <div key={idx} className="flex min-h-[16px] hover:bg-gray-50/50 px-1">
            <span className="w-6 text-gray-400 font-sans text-[8px] text-right pr-1.5 select-none border-r border-gray-100 mr-2 shrink-0">{idx + 1}</span>
            <span className="whitespace-pre overflow-x-auto text-gray-700 break-all font-mono">
              {result.length > 0 ? result : line}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const highlightCode = (code: string) => {
  if (!code) return <span className="text-gray-400">No content</span>;
  const lines = code.split('\n');

  return (
    <div className="font-mono text-[10px] leading-relaxed w-full">
      {lines.map((line, idx) => {
        const regex = /(\/\/.*|#.*)|(["'`].*?["'`])|\b(const|let|var|function|return|import|from|export|if|else|for|while|do|class|interface|new|type|as|extends|implements|try|catch|finally|throw|async|await|null|undefined|true|false)\b|\b(def|elif|import|print|with|as|lambda|pass|in|is|not|and|or)\b|\b([a-zA-Z_]\w*)(?=\()|\b(\d+(?:\.\d+)?)\b/g;
        let lastIndex = 0;
        const result: React.ReactNode[] = [];
        let match;

        while ((match = regex.exec(line)) !== null) {
          const index = match.index;
          if (index > lastIndex) {
            result.push(line.substring(lastIndex, index));
          }

          const text = match[0];
          if (match[1]) { // Comment
            result.push(<span key={index} className="text-gray-400 italic">{text}</span>);
          } else if (match[2]) { // String
            result.push(<span key={index} className="text-[#059669]">{text}</span>);
          } else if (match[3]) { // JS Keyword
            result.push(<span key={index} className="text-[#a855f7] font-bold">{text}</span>);
          } else if (match[4]) { // Python key
            result.push(<span key={index} className="text-[#2563eb] font-bold">{text}</span>);
          } else if (match[5]) { // Function Call
            result.push(<span key={index} className="text-[#3b82f6] font-medium">{text}</span>);
          } else if (match[6]) { // Number
            result.push(<span key={index} className="text-[#dc2626]">{text}</span>);
          }

          lastIndex = regex.lastIndex;
        }

        if (lastIndex < line.length) {
          result.push(line.substring(lastIndex));
        }

        return (
          <div key={idx} className="flex min-h-[16px] hover:bg-gray-50/50 px-1">
            <span className="w-6 text-gray-400 font-sans text-[8px] text-right pr-1.5 select-none border-r border-gray-100 mr-2 shrink-0">{idx + 1}</span>
            <span className="whitespace-pre overflow-x-auto text-gray-700 break-all font-mono">{result.length > 0 ? result : line}</span>
          </div>
        );
      })}
    </div>
  );
};

const ActionButton = ({ icon: Icon, label, onClick, isDocx }: { icon: any, label: string, onClick: () => void, isDocx?: boolean }) => (
  <button 
    onClick={onClick}
    className="flex items-center gap-2 bg-[#0d1014] border border-white/5 hover:bg-[#161a22] transition-colors text-white text-[11px] font-medium rounded-[10px] h-[38px] px-2.5 w-full cursor-pointer"
  >
    {isDocx ? (
      <div className="flex items-center justify-center bg-[#1a56db] text-white font-[800] text-[10px] w-[18px] h-[18px] rounded-[4px]">W</div>
    ) : (
      <Icon size={16} strokeWidth={2} />
    )}
    {label}
  </button>
);

const DownloadButton = ({ content, title, type, ext }: { content: string, title: string, type: string, ext: string }) => {
  const handleDownload = () => {
    let url;
    if (content.startsWith('data:')) {
      url = content;
    } else {
      const blob = new Blob([content], { type });
      url = URL.createObjectURL(blob);
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title?.replace(/[^a-z0-9]/gi, '_') || 'document'}.${ext}`;
    a.click();
    if (!content.startsWith('data:')) {
      URL.revokeObjectURL(url);
    }
  };
  return <ActionButton icon={Download} label={`Download ${ext.toUpperCase()}`} onClick={handleDownload} />;
};

const DownloadDocButton = ({ content, title, type }: { content: string, title: string, type: string }) => {
  const handleDownload = () => {
    let htmlContent = content;
    if (type === 'markdown' || type === 'text' || type === 'code' || type === 'structured' || type === 'json') {
       let parsedContent = content;
       if (type === 'structured' || type === 'json') {
         try { parsedContent = JSON.stringify(JSON.parse(content), null, 2); } catch(e) {}
       }
       htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${title}</title></head><body><pre style="white-space: pre-wrap; font-family: monospace;">${parsedContent}</pre></body></html>`;
    } else if (type === 'html') {
       htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${title}</title></head><body>${content}</body></html>`;
    } else {
       return;
    }
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title?.replace(/[^a-z0-9]/gi, '_') || 'document'}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  if (['markdown', 'text', 'html', 'code', 'structured', 'json', 'pdf'].includes(type)) {
     return <ActionButton icon={FileText} label="Download DOCX" onClick={handleDownload} isDocx />;
  }
  return null;
};

const WorkspaceDataViewer: React.FC<{ data: any }> = ({ data }) => {
  if (!data) return null;

  // 1. Google Calendar check
  const isCalendar = data.kind === "calendar#events" || (Array.isArray(data.items) && data.items.some((item: any) => item.start && item.end));
  
  // 2. Google Drive check
  const isDrive = data.kind === "drive#fileList" || Array.isArray(data.files);

  // 3. Gmail Messages check
  const isGmail = data.messages || data.threads || (data.id && (data.threadId || data.labelIds));

  // 4. Contacts check
  const isContacts = Array.isArray(data.connections);

  // 5. Tasks check
  const isTasks = data.kind === "tasks#tasks" || (Array.isArray(data.items) && data.items.some((item: any) => item.due !== undefined || (item.kind && item.kind.includes('task'))));

  if (isCalendar) {
    const events = data.items || [];
    return (
      <div className="w-full text-white bg-[#0e1117] rounded-2xl border border-white/10 p-4 shrink-0 flex flex-col gap-4 font-sans text-xs">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Calendar size={18} />
          </div>
          <div>
            <h4 className="font-bold text-[14px]">Google Calendar Events</h4>
            <p className="text-[10px] text-gray-400">Active reminders and meeting schedules</p>
          </div>
        </div>
        {events.length === 0 ? (
          <p className="text-gray-400 text-center py-4 font-mono">No upcoming events scheduled.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
            {events.map((evt: any, i: number) => {
              const start = evt.start?.dateTime || evt.start?.date || '';
              const end = evt.end?.dateTime || evt.end?.date || '';
              const formattedDate = start ? new Date(start).toLocaleDateString() : 'All day';
              const formattedTime = start && evt.start?.dateTime ? `${new Date(start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'All Day';
              return (
                <div key={evt.id || i} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/15 transition-all flex flex-col gap-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-white text-[12px]">{evt.summary || 'Untitled Event'}</span>
                    <span className="text-[10px] font-semibold text-blue-400 shrink-0 bg-blue-500/10 px-2 py-0.5 rounded-full">{formattedDate}</span>
                  </div>
                  {evt.location && <div className="text-[11px] text-gray-300">📍 {evt.location}</div>}
                  <div className="text-[10px] text-gray-400 font-mono">⏰ {formattedTime}</div>
                  {evt.hangoutLink && (
                    <a href={evt.hangoutLink} target="_blank" rel="noopener noreferrer" className="mt-1 self-start flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30 font-medium text-[10px] transition-all">
                      <Sparkles size={11} /> Join Google Meet
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (isDrive) {
    const files = data.files || [];
    return (
      <div className="w-full text-white bg-[#0e1117] rounded-2xl border border-white/10 p-4 shrink-0 flex flex-col gap-4 font-sans text-xs">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400 shrink-0">
            <Folder size={18} />
          </div>
          <div>
            <h4 className="font-bold text-[14px]">Google Drive Files</h4>
            <p className="text-[10px] text-gray-400">Stored documents, forms, slides, and files</p>
          </div>
        </div>
        {files.length === 0 ? (
          <p className="text-gray-400 text-center py-4 font-mono">No files found.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
            {files.map((file: any, i: number) => (
              <div key={file.id || i} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/15 transition-all flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="p-1.5 rounded bg-white/10 shrink-0 text-white">
                    <FileText size={16} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-white truncate text-[11px]">{file.name}</span>
                    <span className="text-[9px] text-[#888] font-mono truncate">{file.mimeType?.split('.').pop() || 'File'}</span>
                  </div>
                </div>
                {file.webViewLink && (
                  <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-all shrink-0">
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isGmail) {
    const messages = data.messages || [];
    const isSingleMessage = data.id && (data.snippet || data.body);

    if (isSingleMessage) {
      const subject = data.payload?.headers?.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
      const from = data.payload?.headers?.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
      const date = data.payload?.headers?.find((h: any) => h.name === 'Date')?.value || '';
      return (
        <div className="w-full text-white bg-[#0e1117] rounded-2xl border border-white/10 p-4 shrink-0 flex flex-col gap-4 font-sans text-xs">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
              <Mail size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-[13px] truncate">{subject}</h4>
              <p className="text-[10px] text-gray-400 truncate">From: {from}</p>
            </div>
          </div>
          <div className="text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap max-h-[180px] overflow-y-auto pr-1">
            {data.snippet || data.body || 'No message content.'}
          </div>
          {date && <div className="text-[9px] text-gray-500 font-mono">Received: {date}</div>}
        </div>
      );
    }

    return (
      <div className="w-full text-white bg-[#0e1117] rounded-2xl border border-white/10 p-4 shrink-0 flex flex-col gap-4 font-sans text-xs">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
            <Mail size={18} />
          </div>
          <div>
            <h4 className="font-bold text-[14px]">Gmail Messages</h4>
            <p className="text-[10px] text-gray-400">Conversations from your Inbox</p>
          </div>
        </div>
        {messages.length === 0 ? (
          <p className="text-gray-400 text-center py-4 font-mono">No recent emails found.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
            {messages.map((msg: any, i: number) => (
              <div key={msg.id || i} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/15 transition-all flex flex-col gap-1">
                <span className="font-mono text-[9px] text-red-400 uppercase font-semibold">Message ID: {msg.id}</span>
                <p className="text-gray-300 text-[11px] line-clamp-2 leading-normal">{msg.snippet || 'Click email thread to open details.'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isContacts) {
    const connections = data.connections || [];
    return (
      <div className="w-full text-white bg-[#0e1117] rounded-2xl border border-white/10 p-4 shrink-0 flex flex-col gap-4 font-sans text-xs">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Users size={18} />
          </div>
          <div>
            <h4 className="font-bold text-[14px]">Google Contacts</h4>
            <p className="text-[10px] text-gray-400">People API Connections</p>
          </div>
        </div>
        {connections.length === 0 ? (
          <p className="text-gray-400 text-center py-4 font-mono">No contacts found.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
            {connections.map((conn: any, i: number) => {
              const name = conn.names?.[0]?.displayName || 'Unnamed Contact';
              const email = conn.emailAddresses?.[0]?.value || '';
              const phone = conn.phoneNumbers?.[0]?.value || '';
              return (
                <div key={conn.resourceName || i} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/15 transition-all flex flex-col gap-1">
                  <span className="font-bold text-white text-[12px]">{name}</span>
                  {email && <span className="text-[10px] text-gray-300">✉️ {email}</span>}
                  {phone && <span className="text-[10px] text-gray-400">📞 {phone}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (isTasks) {
    const tasks = data.items || [];
    return (
      <div className="w-full text-white bg-[#0e1117] rounded-2xl border border-white/10 p-4 shrink-0 flex flex-col gap-4 font-sans text-xs">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
            <CheckSquare size={18} />
          </div>
          <div>
            <h4 className="font-bold text-[14px]">Google Tasks</h4>
            <p className="text-[10px] text-gray-400">Active reminders and to-do lists</p>
          </div>
        </div>
        {tasks.length === 0 ? (
          <p className="text-gray-400 text-center py-4 font-mono">No outstanding tasks.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
            {tasks.map((task: any, i: number) => (
              <div key={task.id || i} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/15 transition-all flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="font-bold text-white text-[12px] truncate">{task.title || 'Untitled Task'}</span>
                  {task.notes && <p className="text-[10px] text-gray-400 truncate">{task.notes}</p>}
                </div>
                {task.due && (
                  <span className="text-[9px] font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full shrink-0">
                    {new Date(task.due).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Fallback / generic data (e.g. form created, slides created, standard confirmation payload)
  return (
    <div className="w-full text-white bg-[#0e1117] rounded-2xl border border-white/10 p-4 shrink-0 flex flex-col gap-4 font-sans text-xs">
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
          <Sparkles size={18} />
        </div>
        <div>
          <h4 className="font-bold text-[14px]">Workspace Request Successful</h4>
          <p className="text-[10px] text-gray-400">Workspace data payload and response</p>
        </div>
      </div>
      <div className="p-3 bg-white/5 border border-white/5 rounded-xl overflow-y-auto max-h-[200px]">
        {highlightJson(JSON.stringify(data, null, 2))}
      </div>
    </div>
  );
};

export const ArtifactOverlay: React.FC = () => {
  const activeWorkspaceResult = useUI((state) => state.activeWorkspaceResult);
  const isGenerating = useUI((state) => state.isGenerating);
  const setActiveWorkspaceResult = useUI((state) => state.setActiveWorkspaceResult);
  const setIsGenerating = useUI((state) => state.setIsGenerating);

  const closeOverlay = () => {
    setActiveWorkspaceResult(null);
    setIsGenerating(false);
  };

  if (!activeWorkspaceResult && !isGenerating) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
      className="flex flex-col bg-[#0d1117] rounded-[24px] overflow-hidden border border-[#263040] relative w-full aspect-[16/9]"
      style={{ zIndex: 5 }}
    >
      {/* Top Window Bar */}
      <div className="flex items-center justify-between px-4 h-[44px] border-b border-white/5 bg-[#0c0e12] shrink-0">
        <div className="flex items-center gap-[6px]">
          <div className="w-[10px] h-[10px] rounded-full bg-[#ff5f56] cursor-pointer" onClick={closeOverlay} />
          <div className="w-[10px] h-[10px] rounded-full bg-[#ffbd2e]" />
          <div className="w-[10px] h-[10px] rounded-full bg-[#27c93f]" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-row flex-1 overflow-hidden">
        
        {/* Left Sidebar Actions */}
        <div className="w-[32%] max-w-[200px] p-[14px] border-r border-white/5 bg-[#050709] flex-shrink-0 flex flex-col gap-[10px] overflow-y-auto hidden md:flex">
          <h3 className="text-[9.5px] tracking-[0.08em] text-[#5e6573] font-bold mb-1 uppercase">Workspace</h3>
          
          {activeWorkspaceResult?.artifact && (
            <>
              <DownloadButton 
                content={activeWorkspaceResult.artifact.content}
                title={activeWorkspaceResult.artifact.title || 'artifact'}
                type={
                  activeWorkspaceResult.artifact.type === 'markdown' ? 'text/markdown' : 
                  activeWorkspaceResult.artifact.type === 'pdf' ? 'application/pdf' : 
                  activeWorkspaceResult.artifact.type === 'json' ? 'application/json' :
                  activeWorkspaceResult.artifact.type === 'html' ? 'text/html' :
                  activeWorkspaceResult.artifact.type === 'image' ? 'image/png' :
                  activeWorkspaceResult.artifact.type === 'video' ? 'video/mp4' :
                  'text/plain'
                }
                ext={
                  activeWorkspaceResult.artifact.type === 'markdown' ? 'md' : 
                  activeWorkspaceResult.artifact.type === 'pdf' ? 'pdf' : 
                  activeWorkspaceResult.artifact.type === 'json' ? 'json' :
                  activeWorkspaceResult.artifact.type === 'html' ? 'html' :
                  activeWorkspaceResult.artifact.type === 'code' ? 'txt' : 
                  activeWorkspaceResult.artifact.type === 'image' ? 'png' : 
                  activeWorkspaceResult.artifact.type === 'video' ? 'mp4' : 'text'
                }
              />
              <DownloadDocButton
                content={activeWorkspaceResult.artifact.content}
                title={activeWorkspaceResult.artifact.title || 'artifact'}
                type={activeWorkspaceResult.artifact.type}
              />
            </>
          )}

          <ActionButton icon={Cloud} label="Save to Drive" onClick={() => alert('Saved to Google Drive!')} />
          <ActionButton icon={Edit3} label="Edit" onClick={() => alert('Edit mode activated')} />
          <ActionButton icon={Share} label="Share" onClick={() => alert('Share link copied!')} />
        </div>

        {/* Right Artifact View */}
        <div className="flex-1 bg-[#080b0f] p-[10px] relative overflow-y-auto w-full flex justify-center items-stretch h-full">
          {isGenerating ? (
            <div className="flex items-center justify-center h-full w-full bg-[#111111] text-[#888] rounded">
              <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-t-[#cbfb45] border-[#333] rounded-full animate-spin" />
                <p className="text-xs font-mono tracking-widest text-[#666] uppercase animate-pulse">Generating Artifact...</p>
              </div>
            </div>
          ) : activeWorkspaceResult?.artifact ? (
            <div className="w-full text-black bg-white rounded shadow-[0_4px_15px_rgba(0,0,0,0.15)] p-4 md:p-6 flex flex-col relative overflow-hidden text-xs">
              
              {/* Doc Header */}
              <div className="flex justify-between items-start border-b border-gray-200 pb-2 mb-3 shrink-0 font-sans">
                <div className="flex items-center gap-1.5">
                  <svg width="18" height="18" viewBox="0 0 100 100">
                    <path d="M50,18 C61,35 77,54 81,66 C85,78 75,88 62,84 C50,80 50,62 50,62 C50,62 50,80 38,84 C25,88 15,78 19,66 C23,54 39,35 50,18 Z" stroke="black" strokeWidth="10" fill="none" strokeLinejoin="round" />
                    <circle cx="50" cy="58" r="20" stroke="black" strokeWidth="7" fill="none" />
                  </svg>
                  <span className="text-[10px] font-black tracking-wider text-black">EBURON AI</span>
                </div>
                <div className="text-right text-[8px] text-gray-500 font-sans">
                  <div className="font-bold uppercase tracking-wider text-black">
                    {activeWorkspaceResult.artifact.type === 'markdown' ? 'PROPOSAL' : activeWorkspaceResult.artifact.type.toUpperCase()}
                  </div>
                  <div className="mt-0.5">{new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                </div>
              </div>

              {/* Document Content View */}
              <div className="doc-content flex-grow flex flex-col text-black min-h-0 overflow-hidden font-sans">
                <div className="doc-title text-[14px] md:text-[18px] font-extrabold leading-tight text-gray-950 mb-0.5 shrink-0">
                  {activeWorkspaceResult.artifact.title || 'Q2 2024 Strategic Partnership Proposal'}
                </div>
                <div className="doc-subtitle text-[8.5px] font-medium text-gray-500 uppercase tracking-widest mb-2 shrink-0">
                  Elevating Innovation Together • Session Workspace Delivery
                </div>
                
                <div className="doc-divider border-t border-gray-200 mb-2 shrink-0"></div>

                <div className="flex-1 overflow-y-auto pr-1 text-gray-800 leading-relaxed font-sans text-[11px]">
                  {activeWorkspaceResult.artifact.type === 'image' && (
                    <div className="flex items-center justify-center bg-black rounded p-2 h-full min-h-[180px]">
                      <img src={activeWorkspaceResult.artifact.content} alt={activeWorkspaceResult.artifact.title || 'Image Artifact'} className="max-w-full max-h-[160px] object-contain" />
                    </div>
                  )}
                  {activeWorkspaceResult.artifact.type === 'video' && (
                    <div className="flex items-center justify-center bg-black rounded p-2 h-full min-h-[180px]">
                      <video src={activeWorkspaceResult.artifact.content} controls className="max-w-full max-h-[160px] object-contain" />
                    </div>
                  )}
                  {activeWorkspaceResult.artifact.type === 'pdf' && (
                    <iframe src={activeWorkspaceResult.artifact.content} className="w-full h-full border-0 rounded bg-white min-h-[180px]" title="PDF Preview" />
                  )}
                  {activeWorkspaceResult.artifact.type === 'html' && (
                    <iframe srcDoc={activeWorkspaceResult.artifact.content} className="w-full h-full border-0 rounded bg-white min-h-[180px]" title="HTML Preview" />
                  )}
                  {activeWorkspaceResult.artifact.type === 'markdown' && (
                    <div className="prose prose-xs max-w-none prose-slate text-[11px] px-1 pb-4 leading-normal">
                      <ReactMarkdown
                        components={{
                          h1: ({node, ...props}) => <h1 className="text-[14px] font-black text-gray-900 border-b border-gray-100 pb-1 mt-4 mb-2" {...props}/>,
                          h2: ({node, ...props}) => <h2 className="text-[12px] font-bold text-gray-800 border-b border-gray-100 pb-0.5 mt-3.5 mb-1.5" {...props}/>,
                          h3: ({node, ...props}) => <h3 className="text-[11px] font-bold text-gray-700 mt-3 mb-1" {...props}/>,
                          p: ({node, ...props}) => <p className="text-[11px] text-gray-700 mb-2.5 leading-relaxed" {...props}/>,
                          ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-3 space-y-1.5" {...props}/>,
                          ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-3 space-y-1.5" {...props}/>,
                          li: ({node, ...props}) => <li className="text-[11px] text-gray-700 leading-relaxed" {...props}/>,
                          strong: ({node, ...props}) => <strong className="font-bold text-gray-950" {...props}/>,
                          em: ({node, ...props}) => <em className="italic text-gray-900" {...props}/>,
                          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-[#cef158] pl-3 py-1 italic my-3 text-gray-600 bg-gray-50/50 rounded-r text-[11px] leading-relaxed" {...props}/>,
                          code: ({node, className, children, ...props}: any) => {
                            const inline = !className || !className.includes('language-');
                            return inline ? (
                              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] font-mono text-purple-600 font-medium" {...props}>{children}</code>
                            ) : (
                              <pre className="bg-gray-900 text-[#ececec] p-3 rounded-lg my-3 overflow-auto font-mono text-[10px] border border-white/5"><code className={className} {...props}>{children}</code></pre>
                            )
                          },
                        }}
                      >
                        {activeWorkspaceResult.artifact.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  {(activeWorkspaceResult.artifact.type === 'structured' || activeWorkspaceResult.artifact.type === 'json') && (
                    <div className="p-3 bg-gray-50/50 border border-gray-100 rounded-xl overflow-y-auto w-full min-h-[180px]">
                      {(() => {
                        const content = activeWorkspaceResult.artifact.content;
                        let jsonStr = '';
                        if (typeof content === 'string') {
                          try {
                            jsonStr = JSON.stringify(JSON.parse(content), null, 2);
                          } catch (e) {
                            jsonStr = content;
                          }
                        } else {
                          jsonStr = JSON.stringify(content, null, 2);
                        }
                        return highlightJson(jsonStr);
                      })()}
                    </div>
                  )}
                  {activeWorkspaceResult.artifact.type === 'code' && (
                    <div className="p-3 bg-gray-50/50 border border-gray-100 rounded-xl overflow-y-auto w-full min-h-[180px]">
                      {highlightCode(activeWorkspaceResult.artifact.content)}
                    </div>
                  )}
                </div>
              </div>

              {/* Doc Footer Accent Signature */}
              <div className="doc-footer-line border-t-[1.5px] border-[#cef158] mt-3 pt-2 shrink-0 font-sans">
                <div className="flex justify-between items-center text-[8.5px] font-bold text-black uppercase">
                  <span>Eburon AI</span>
                  <span>Page 1 of 1</span>
                </div>
              </div>

            </div>
          ) : activeWorkspaceResult ? (
            <div className="w-full flex justify-center items-center h-full overflow-hidden p-2">
              <WorkspaceDataViewer data={activeWorkspaceResult} />
            </div>
          ) : null}
        </div>

      </div>
    </motion.div>
  );
};

