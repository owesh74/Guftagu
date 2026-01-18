import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import './App.css';
import { RiSendPlane2Line } from "react-icons/ri";

const API_URL = import.meta.env.VITE_API_BASE_URL;
const socket = io.connect(API_URL);

// --- HELPERS ---
const showNotification = (title, body) => {
  if (Notification.permission === 'granted' && document.hidden) {
    new Notification(title, { body, icon: '/vite.svg' });
  }
};

const formatTime = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getDateLabel = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString();
};

// --- COMPONENTS ---

const Landing = () => {
  const navigate = useNavigate();
  const requestNotifs = () => {
    if ("Notification" in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  return (
    <div className="container" onClick={requestNotifs}>
      <h1>👻 GuftRooms</h1>
      <h2>Private Group Messaging</h2>
      <div className="card">
        <button onClick={() => navigate('/create')} className="btn-primary mb-15">Create New Group</button>
        <button onClick={() => navigate('/join')} className="btn-secondary">Open Existing Group</button>
      </div>
    </div>
  );
};

const CreateGroup = () => {
  const [groupName, setGroupName] = useState('');
  const [charName, setCharName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  const handlePreCheck = () => {
    if (!groupName.trim()) { setError("Please enter a Group Name."); return; }
    setError(''); setShowConfirm(true); 
  };

  const handleCreate = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/groups`, { groupName, characterName: charName, pin });
      setShowConfirm(false); navigate(`/group/${res.data.groupName}`);
    } catch (err) { setShowConfirm(false); setError(err.response?.data?.error || "Error creating group"); }
  };

  return (
    <div className="container">
      <h3>Create Group</h3>
      <div className="card">
        <input className="auth-input" placeholder="Enter Unique Group Name" value={groupName} onChange={e=>setGroupName(e.target.value)} />
        <p className="hint-text">Optional: Create your character now</p>
        <input className="auth-input" placeholder="Your Character Name" value={charName} onChange={e=>setCharName(e.target.value)} />
        <input className="auth-input" placeholder="4-Digit PIN" maxLength={4} value={pin} onChange={e=>setPin(e.target.value)} />
        {error && <span className="error-text">{error}</span>}
        <button onClick={handlePreCheck} className="btn-primary mt-20">Create & Continue</button>
        <button className="btn-back" onClick={()=>navigate('/')}>Cancel</button>
      </div>
      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Creation</h3>
            <p>Group Name: <strong className="highlight-text">{groupName}</strong></p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn-confirm" onClick={handleCreate}>Yes, Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const JoinGroup = () => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleJoin = async () => {
    if (!name.trim()) { setError("Please enter the Group Name."); return; }
    setLoading(true); setError('');
    try {
      await axios.get(`${API_URL}/api/groups/${name}`);
      navigate(`/group/${name}`);
    } catch (err) {
      setLoading(false); setError("Group does not exist. Please check the name.");
    }
  };

  return (
    <div className="container">
      <h3>Open Group</h3>
      <div className="card">
        <input className="auth-input" placeholder="Enter Group Name" value={name} onChange={e=>{setName(e.target.value); setError('');}} onKeyDown={(e) => e.key === 'Enter' && handleJoin()} />
        {error && <span className="error-text">{error}</span>}
        <button onClick={handleJoin} className="btn-primary mt-15" disabled={loading}>{loading ? "Checking..." : "Next"}</button>
        <button className="btn-back" onClick={()=>navigate('/')}>Cancel</button>
      </div>
    </div>
  );
};

// --- GROUP ROOM ---
const GroupRoom = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  
  const [step, setStep] = useState('auth'); 
  const [authView, setAuthView] = useState('selection'); 
  const [characters, setCharacters] = useState([]);
  const [messages, setMessages] = useState([]);
  const [myChar, setMyChar] = useState(null);
  const [groupExists, setGroupExists] = useState(true);
  
  const [selectedChar, setSelectedChar] = useState(null);
  const [inputName, setInputName] = useState('');
  const [inputPin, setInputPin] = useState('');
  const [error, setError] = useState('');
  
  const [msgText, setMsgText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null); 

  useEffect(() => {
    fetchGroup();
  }, [code]);

  useEffect(() => {
    socket.emit('join_room', code);
    
    const handleReceiveMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (myChar && msg.sender !== myChar.name) {
        showNotification(
          `New Message in ${code}`, 
          `${msg.sender}: ${msg.fileUrl ? 'Sent a file' : msg.text}`
        );
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    return () => socket.off('receive_message', handleReceiveMessage);
  }, [code, myChar]); 

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, replyTo]);

  const fetchGroup = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/groups/${code}`);
      setCharacters(res.data.characters);
      setMessages(res.data.messages);
      setGroupExists(true);
    } catch (err) {
      setGroupExists(false);
      setCharacters([]);
    }
  };

  const attemptAuth = async (name, pin, isNew) => {
    if(!name || !pin) { setError("Please fill all fields"); return; }
    try {
      await axios.post(`${API_URL}/api/groups/${code}/join`, { name, pin, isNew });
      setMyChar({ name, pin });
      setStep('chat');
      if ("Notification" in window && Notification.permission === 'default') Notification.requestPermission();
    } catch (err) {
      const errMsg = err.response?.data?.error;
      if (err.response?.status === 404 && errMsg === "Group not found") setError("Group does not exist. Create it first.");
      else setError(errMsg || "Authentication Failed");
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) { alert("File is too large! Max 30MB."); return; }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_URL}/api/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data.success) {
        const msgData = { 
          groupName: code, sender: myChar.name, text: "", replyTo: replyTo,
          fileUrl: res.data.fileUrl, fileName: res.data.fileName, fileType: res.data.fileType
        };
        await socket.emit('send_message', msgData);
        setReplyTo(null);
      }
    } catch (err) { alert("Upload failed."); } finally { setIsUploading(false); e.target.value = null; }
  };

  const sendMessage = async () => {
    if (!msgText.trim()) return;
    const msgData = { groupName: code, sender: myChar.name, text: msgText, replyTo: replyTo };
    await socket.emit('send_message', msgData);
    setMsgText('');
    setReplyTo(null);
  };

  const handleDoubleTap = (msg) => {
    setReplyTo(msg);
  };

  if (step === 'auth') {
    return (
      <div className="container">
        <h3>Group: {code}</h3>
        {error && <div className="card error-card"><span className="error-text">{error}</span></div>}
        
        {authView === 'selection' && (
          <div className="card">
            <p className="hint-text">Select an option to enter</p>
            <div className="auth-choice-container">
              <button className="big-btn btn-login" onClick={() => {setError(''); setAuthView('login')}}>Login as Existing</button>
              <button className="big-btn btn-create" onClick={() => {setError(''); setAuthView('create')}}>Create New Character</button>
            </div>
            <button className="btn-back" onClick={()=>navigate('/')}>Exit Group</button>
          </div>
        )}
        {authView === 'login' && (
          <div className="card">
            <button className="btn-back" onClick={() => {setError(''); setAuthView('selection')}}>← Back</button>
            <h3 className="auth-title">Who are you?</h3>
            {!groupExists || characters.length === 0 ? (
              <p className="empty-text">{ !groupExists ? "Group not found." : "No characters yet."}</p>
            ) : (
              characters.map(c => (
                <div key={c._id} className="char-row">
                  <div className="char-info">
                    <span className="char-name">{c.name}</span>
                    {selectedChar === c.name ? (<span className="enter-pin-text">Enter PIN 👇</span>) : (<button className="btn-select" onClick={() => {setError(''); setSelectedChar(c.name)}}>Select</button>)}
                  </div>
                  {selectedChar === c.name && (
                    <div className="pin-input-row">
                       <input className="auth-input" autoFocus placeholder="PIN" type="password" maxLength={4} onChange={e => setInputPin(e.target.value)} />
                       <button className="btn-go" onClick={() => attemptAuth(c.name, inputPin, false)}>Go</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        {authView === 'create' && (
          <div className="card">
             <button className="btn-back" onClick={() => {setError(''); setAuthView('selection')}}>← Back</button>
             <h3 className="auth-title">New Character</h3>
             <input className="auth-input" placeholder="Character Name" value={inputName} onChange={e=>setInputName(e.target.value)} />
             <input className="auth-input" placeholder="4-Digit PIN" maxLength={4} value={inputPin} onChange={e=>setInputPin(e.target.value)} />
             <button onClick={() => attemptAuth(inputName, inputPin, true)} className="btn-create-submit">Join Chat</button>
          </div>
        )}
      </div>
    );
  }

  // --- CHAT RENDER ---
  return (
    <div className="chat-wrapper">
      
      {/* 1. HEADER */}
      <div className="chat-header">
        <div className="header-info">
          <h3 className="room-name">{code}</h3>
          <small className="room-hint">Double tap to reply</small>
        </div>
        <button className="btn-exit" onClick={()=>setStep('auth')}>Exit</button>
      </div>
      
      {/* 2. MESSAGES */}
      <div className="chat-area">
        {messages.map((m, i) => {
          // Date Separator Logic
          const showDateSeparator = i === 0 || 
            new Date(m.timestamp).toDateString() !== new Date(messages[i-1].timestamp).toDateString();

          return (
            <React.Fragment key={i}>
              {showDateSeparator && (
                <div className="date-separator">
                  {getDateLabel(m.timestamp)}
                </div>
              )}

              <div className={`msg-row ${m.sender === myChar.name ? 'mine' : ''}`}>
                {m.sender !== myChar.name && <div className="msg-meta">{m.sender}</div>}
                
                <div 
                  className="msg-bubble"
                  onDoubleClick={() => handleDoubleTap(m)}
                  title="Double tap to reply"
                >
                  {/* REPLY CONTEXT */}
                  {m.replyTo && (
                    <div className="reply-context">
                      <strong className="reply-sender">{m.replyTo.sender}</strong>: {m.replyTo.text || '[File]'}
                    </div>
                  )}

                  {/* CONTENT */}
                  {m.fileUrl ? (
                    <div className="attachment-box">
                      {m.fileType === 'image' && (
                        <>
                          <img src={m.fileUrl} alt="uploaded" className="chat-image" onClick={()=>window.open(m.fileUrl)} />
                          <a href={m.fileUrl} download target="_blank" rel="noopener noreferrer" className="download-btn">⬇ Download</a>
                        </>
                      )}
                      {m.fileType !== 'image' && (
                        <a href={m.fileUrl} download target="_blank" rel="noopener noreferrer" className="file-link">
                          <span className="file-icon">📄</span> 
                          <div><div>{m.fileName}</div><small>Click to Download</small></div>
                        </a>
                      )}
                    </div>
                  ) : (
                      <span>{m.text}</span>
                  )}

                  {/* TIMESTAMP */}
                  <span className="msg-time">{formatTime(m.timestamp)}</span>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {isUploading && <div className="uploading-text">Uploading file (please wait)...</div>}
        <div ref={chatEndRef} />
      </div>

      {/* 3. INPUT AREA */}
      <div className="input-area">
        
        {/* REPLY BANNER */}
        {replyTo && (
          <div className="reply-preview-bar">
            <span>Replying to <strong>{replyTo.sender}</strong></span>
            <span onClick={() => setReplyTo(null)} className="close-reply">✖</span>
          </div>
        )}

        <div className="input-wrapper">
          <input type="file" ref={fileInputRef} style={{display:'none'}} onChange={handleFileSelect} />
          <button className="btn-icon" onClick={() => fileInputRef.current.click()}>📎</button>

          <input 
            className="msg-input" 
            value={msgText} 
            onChange={e=>setMsgText(e.target.value)} 
            placeholder="Type a message..." 
            onKeyDown={e => e.key === 'Enter' && sendMessage()} 
          />
          
          <button className="btn-icon send-icon" onClick={sendMessage}>
            <RiSendPlane2Line />
          </button>
        </div>
      </div>
    </div>
  );
};

// ... (Admin component logic unchanged) ...
const Admin = () => {
  const [auth, setAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [expandedGroup, setExpandedGroup] = useState(null);

  const login = async () => {
    try { await axios.post(`${API_URL}/api/admin/login`, { password }); setAuth(true); fetchData(); } catch(e) { alert("Invalid Password"); }
  };

  const fetchData = async () => {
    try { const res = await axios.get(`${API_URL}/api/admin/groups`, { headers: { 'x-admin-password': password } }); setGroups(res.data); } catch (e) { console.error(e); }
  };

  const deleteGroup = async (id) => {
    if(!confirm("Delete this group and ALL its files?")) return;
    await axios.delete(`${API_URL}/api/admin/groups/${id}`, { headers: { 'x-admin-password': password } });
    fetchData();
  };

  const filteredGroups = groups.filter(g => g.groupName.toLowerCase().includes(search.toLowerCase()));
  const toggleDetails = (id) => { setExpandedGroup(expandedGroup === id ? null : id); };

  if (!auth) return <div className="container"><h3>Admin Panel</h3><div className="card"><input className="auth-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter Admin Password" /><button className="btn-primary" onClick={login}>Login</button></div></div>;

  return (
    <div className="container admin-container">
      <h3>Admin Dashboard</h3>
      <div className="admin-controls"><button className="btn-secondary" onClick={()=>setAuth(false)}>Logout</button><button className="btn-primary" onClick={fetchData}>Refresh</button></div>
      <div className="card admin-list">
        <input className="search-bar" placeholder="Search Groups..." value={search} onChange={e=>setSearch(e.target.value)} />
        {filteredGroups.map(g => (
          <div key={g._id} className="admin-row">
            <div className="admin-info"><div><strong>{g.groupName}</strong> <br/><small>Users: {g.characters.length} | Msgs: {g.messages.length}</small></div><div className="admin-actions"><button className="btn-secondary small" onClick={()=>toggleDetails(g._id)}>{expandedGroup === g._id ? 'Hide' : 'View'}</button><button className="btn-danger small" onClick={()=>deleteGroup(g._id)}>X</button></div></div>
            {expandedGroup === g._id && (<div className="admin-details"><h4>Users & PINs</h4><ul className="user-list">{g.characters.map(c => (<li key={c._id}><span className="highlight-text">{c.name}</span> - {c.pin}</li>))}</ul><h4>Recent Messages</h4><div className="msg-log">{g.messages.length === 0 ? <p>No messages.</p> : (g.messages.map((m, i) => (<div key={i} className="log-item"><strong className="highlight-text">{m.sender}:</strong> {m.fileUrl ? (m.fileType === 'image' ? '[Image]' : `[File: ${m.fileName}]`) : m.text}</div>)))}</div></div>)}
          </div>
        ))}
      </div>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/create" element={<CreateGroup />} />
        <Route path="/join" element={<JoinGroup />} />
        <Route path="/group/:code" element={<GroupRoom />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;