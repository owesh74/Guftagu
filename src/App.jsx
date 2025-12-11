import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import './App.css';
import { RiSendPlane2Line } from "react-icons/ri";

const API_URL = import.meta.env.VITE_API_BASE_URL;
const socket = io.connect(API_URL);

// --- HELPER: NOTIFICATIONS ---
const showNotification = (title, body) => {
  if (Notification.permission === 'granted' && document.hidden) {
    new Notification(title, { body, icon: '/vite.svg' });
  }
};

// --- COMPONENTS ---

const Landing = () => {
  const navigate = useNavigate();
  // Request notification permission quietly on click
  const requestNotifs = () => {
    if ("Notification" in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  return (
    <div className="container" onClick={requestNotifs}>
      <h1>👻 GuftaGu</h1>
      <h2>Private Group Messaging</h2>
      <div className="card">
        <button onClick={() => navigate('/create')} style={{marginBottom:'15px'}}>Create New Group</button>
        <button onClick={() => navigate('/join')} className="btn-create" style={{background: '#2d3436', border:'1px solid #555'}}>Open Existing Group</button>
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
        <input placeholder="Enter Unique Group Name" value={groupName} onChange={e=>setGroupName(e.target.value)} />
        <p style={{marginTop:'15px', borderTop:'1px solid #444', paddingTop:'15px', fontSize:'0.9em', color:'#aaa'}}>Optional: Create your character now</p>
        <input placeholder="Your Character Name" value={charName} onChange={e=>setCharName(e.target.value)} />
        <input placeholder="4-Digit PIN" maxLength={4} value={pin} onChange={e=>setPin(e.target.value)} />
        {error && <span className="error-text">{error}</span>}
        <button onClick={handlePreCheck} className="btn-login" style={{marginTop:'20px'}}>Create & Continue</button>
        <button className="btn-back" style={{marginTop:'10px', width:'100%', border:'none'}} onClick={()=>navigate('/')}>Cancel</button>
      </div>
      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Creation</h3>
            <p>Group Name: <strong style={{color:'#00d2ff'}}>{groupName}</strong></p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn-confirm" style={{background:'#28a745'}} onClick={handleCreate}>Yes, Create</button>
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
        <input placeholder="Enter Group Name" value={name} onChange={e=>{setName(e.target.value); setError('');}} onKeyDown={(e) => e.key === 'Enter' && handleJoin()} />
        {error && <span className="error-text">{error}</span>}
        <button onClick={handleJoin} style={{marginTop:'15px'}} disabled={loading}>{loading ? "Checking..." : "Next"}</button>
        <button className="btn-back" style={{marginTop:'10px', width:'100%', border:'none'}} onClick={()=>navigate('/')}>Cancel</button>
      </div>
    </div>
  );
};

// --- GROUP ROOM COMPONENT ---
const GroupRoom = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  
  const [step, setStep] = useState('auth'); 
  const [authView, setAuthView] = useState('selection'); 
  const [characters, setCharacters] = useState([]);
  const [messages, setMessages] = useState([]);
  const [myChar, setMyChar] = useState(null);
  const [groupExists, setGroupExists] = useState(true);
  
  // Auth Form State
  const [selectedChar, setSelectedChar] = useState(null);
  const [inputName, setInputName] = useState('');
  const [inputPin, setInputPin] = useState('');
  const [error, setError] = useState('');
  
  // Chat State
  const [msgText, setMsgText] = useState('');
  const [replyTo, setReplyTo] = useState(null); // STORES REPLY
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
  }, [messages, replyTo]); // Auto scroll when messages change or reply opens

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
    setReplyTo(msg); // Set the message to reply to
  };

  // --- AUTH VIEW ---
  if (step === 'auth') {
    return (
      <div className="container">
        <h3>Group: {code}</h3>
        {error && <div className="card" style={{padding:'10px', background:'rgba(255,0,0,0.1)', border:'1px solid red', marginBottom:'10px'}}><span className="error-text">{error}</span></div>}
        
        {authView === 'selection' && (
          <div className="card">
            <p style={{marginBottom:'20px', color:'#aaa'}}>Select an option to enter</p>
            <div className="auth-choice-container">
              <button className="big-btn btn-login" onClick={() => {setError(''); setAuthView('login')}}>Login as Existing</button>
              <button className="big-btn btn-create" onClick={() => {setError(''); setAuthView('create')}}>Create New Character</button>
            </div>
            <button className="btn-back" style={{marginTop:'20px', width:'100%', border:'none'}} onClick={()=>navigate('/')}>Exit Group</button>
          </div>
        )}
        {authView === 'login' && (
          <div className="card">
            <button className="btn-back" onClick={() => {setError(''); setAuthView('selection')}}>← Back</button>
            <h3 style={{marginBottom:'20px'}}>Who are you?</h3>
            {!groupExists || characters.length === 0 ? (
              <p style={{color:'#888', fontStyle:'italic', padding:'20px'}}>{ !groupExists ? "Group not found." : "No characters yet."}</p>
            ) : (
              characters.map(c => (
                <div key={c._id} style={{borderBottom: '1px solid #333', padding: '12px 0'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <span style={{fontWeight: '600', fontSize:'1.1em'}}>{c.name}</span>
                    {selectedChar === c.name ? (<span style={{fontSize:'0.8em', color:'#aaa'}}>Enter PIN 👇</span>) : (<button style={{width:'auto', padding:'6px 16px', background:'#444'}} onClick={() => {setError(''); setSelectedChar(c.name)}}>Select</button>)}
                  </div>
                  {selectedChar === c.name && (
                    <div style={{marginTop:'10px', display:'flex', gap:'8px'}}>
                       <input autoFocus placeholder="PIN" type="password" maxLength={4} onChange={e => setInputPin(e.target.value)} />
                       <button style={{width:'80px'}} onClick={() => attemptAuth(c.name, inputPin, false)}>Go</button>
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
             <h3 style={{marginBottom:'20px'}}>New Character</h3>
             <input placeholder="Character Name" value={inputName} onChange={e=>setInputName(e.target.value)} />
             <input placeholder="4-Digit PIN" maxLength={4} value={inputPin} onChange={e=>setInputPin(e.target.value)} />
             <button onClick={() => attemptAuth(inputName, inputPin, true)} style={{marginTop:'15px'}} className="btn-create">Join Chat</button>
          </div>
        )}
      </div>
    );
  }

  // --- CHAT VIEW (FIXED: Wide Input, Small Exit, Reply) ---
  return (
    <div style={{display:'flex', flexDirection:'column', height:'100dvh', width:'100vw', overflow:'hidden', position:'fixed', top:0, left:0}}>
      
      {/* 1. HEADER */}
      <div style={{
        background: 'linear-gradient(to bottom, #0a0a0a, #121212)', 
        padding:'15px 15px', 
        display:'flex', 
        justifyContent:'space-between', 
        alignItems:'center', 
        boxShadow:'0 2px 5px rgba(0,0,0,0.2)',
        height: '50px',
        flexShrink: 0,
        zIndex: 10
      }}>
        <div style={{display:'flex', flexDirection:'column'}}>
          <h3 style={{margin:0, color:'#d8dfe1ff', fontSize:'1.1em'}}>{code}</h3>
          <small style={{fontSize:'0.7em', color:'#888'}}></small>
        </div>
        <button 
          style={{width:'auto', padding:'5px 10px', fontSize:'0.8em', background:'#ff4d4d', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}} 
          onClick={()=>setStep('auth')}
        >
          Exit
        </button>
      </div>
      
      {/* 2. MESSAGES */}
      <div className="chat-box" style={{flex: 1, padding:'15px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'10px', paddingBottom:'20px'}}>
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.sender === myChar.name ? 'mine' : ''}`} style={{display:'flex', flexDirection:'column', maxWidth:'80%'}}>
             {m.sender !== myChar.name && <div className="msg-meta">{m.sender}</div>}
             
             {/* MESSAGE BUBBLE */}
             <div 
               onDoubleClick={() => handleDoubleTap(m)} // DOUBLE TAP LOGIC
               title="Double tap to reply"
               style={{cursor:'pointer'}}
             >
               {/* REPLY CONTEXT */}
               {m.replyTo && (
                 <div style={{
                   background:'rgba(0,0,0,0.2)', 
                   borderLeft:'3px solid #00d2ff', 
                   padding:'5px', 
                   marginBottom:'5px', 
                   borderRadius:'4px',
                   fontSize:'0.8em',
                   color:'#ccc'
                 }}>
                   <strong style={{color:'#00d2ff'}}>{m.replyTo.sender}</strong>: {m.replyTo.text || '[File]'}
                 </div>
               )}

               {/* CONTENT */}
               {m.fileUrl ? (
                 <div className="attachment-box">
                   {m.fileType === 'image' && (
                     <>
                       <img src={`${API_URL}${m.fileUrl}`} alt="uploaded" className="chat-image" onClick={()=>window.open(`${API_URL}${m.fileUrl}`)} />
                       <a href={`${API_URL}${m.fileUrl}`} download target="_blank" rel="noopener noreferrer" className="download-btn">⬇ Download</a>
                     </>
                   )}
                   {m.fileType !== 'image' && (
                     <a href={`${API_URL}${m.fileUrl}`} download target="_blank" rel="noopener noreferrer" className="download-btn" style={{background:'#333', color:'white', border:'1px solid #555'}}>
                       <span className="file-icon">📄</span> 
                       <div><div>{m.fileName}</div><small style={{color:'#aaa', fontWeight:'normal'}}>Click to Download</small></div>
                     </a>
                   )}
                 </div>
               ) : (
                  <span>{m.text}</span>
               )}
             </div>
          </div>
        ))}
        {isUploading && <div style={{textAlign:'center', fontSize:'0.8em', color:'#aaa', marginTop:'10px'}}>Uploading file (please wait)...</div>}
        <div ref={chatEndRef} />
      </div>

      {/* 3. INPUT AREA (Fixed, Wide) */}
      <div style={{background:'#1a1d21', padding:'10px', borderTop:'1px solid #333', flexShrink:0, width: '100%', boxSizing: 'border-box'}}>
        
        {/* REPLY BANNER */}
        {replyTo && (
          <div style={{background:'#222', padding:'8px', marginBottom:'8px', borderRadius:'4px', borderLeft:'3px solid #00d2ff', display:'flex', justifyContent:'space-between', color:'white'}}>
            <span style={{fontSize:'0.9em'}}>Replying to <strong>{replyTo.sender}</strong></span>
            <span onClick={() => setReplyTo(null)} style={{cursor:'pointer', fontWeight:'bold', color:'#888'}}>✖</span>
          </div>
        )}

        <div style={{display:'flex', gap:'10px', alignItems:'center', width:'100%'}}>
          <input type="file" ref={fileInputRef} style={{display:'none'}} onChange={handleFileSelect} />
          <button 
            style={{width:'40px', height:'40px', background:'transparent', fontSize:'1.5em', padding:'0', border:'none', color:'#aaa', cursor:'pointer'}} 
            onClick={() => fileInputRef.current.click()}
          >
            📎
          </button>

          {/* WIDE INPUT */}
          <input 
            style={{
              flex: 1, 
              padding:'12px', 
              borderRadius:'25px', 
              border:'1px solid #444', 
              background:'#2a2e38', 
              color:'white', 
              fontSize:'1rem',
              marginBottom: 0,
              width: '100%'
            }} 
            value={msgText} 
            onChange={e=>setMsgText(e.target.value)} 
            placeholder="Type a message..." 
            onKeyDown={e => e.key === 'Enter' && sendMessage()} 
          />
          
          <button 
            style={{width:'50px', height:'40px', background:'transparent', border:'none', color:'#00d2ff', fontSize:'1.5em', cursor:'pointer', marginTop:0}} 
            onClick={sendMessage}
          >
            <RiSendPlane2Line />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- ADMIN COMPONENT ---
const Admin = () => {
  const [auth, setAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [expandedGroup, setExpandedGroup] = useState(null);

  const login = async () => {
    try {
      await axios.post(`${API_URL}/api/admin/login`, { password });
      setAuth(true);
      fetchData();
    } catch(e) { alert("Invalid Password"); }
  };

  const fetchData = async () => {
    try {
        const res = await axios.get(`${API_URL}/api/admin/groups`, {
            headers: { 'x-admin-password': password }
        });
        setGroups(res.data);
    } catch (e) { console.error(e); }
  };

  const deleteGroup = async (id) => {
    if(!confirm("Delete this group and ALL its files?")) return;
    await axios.delete(`${API_URL}/api/admin/groups/${id}`, {
      headers: { 'x-admin-password': password }
    });
    fetchData();
  };

  const filteredGroups = groups.filter(g => g.groupName.toLowerCase().includes(search.toLowerCase()));
  const toggleDetails = (id) => { setExpandedGroup(expandedGroup === id ? null : id); };

  if (!auth) return (
    <div className="container">
      <h3>Admin Panel</h3>
      <div className="card">
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter Admin Password" />
        <button onClick={login}>Login</button>
      </div>
    </div>
  );

  return (
    <div className="container" style={{maxWidth:'600px'}}>
      <h3>Admin Dashboard</h3>
      <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
        <button style={{background: '#444', width:'auto'}} onClick={()=>setAuth(false)}>Logout</button>
        <button style={{background: '#00d2ff', width:'auto', color:'#000'}} onClick={fetchData}>Refresh</button>
      </div>
      
      <div className="card" style={{textAlign:'left'}}>
        <input 
          className="search-bar" 
          placeholder="Search Groups..." 
          value={search} 
          onChange={e=>setSearch(e.target.value)} 
        />

        {filteredGroups.map(g => (
          <div key={g._id} style={{background:'#252a35', marginBottom:'10px', padding:'10px', borderRadius:'8px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <strong style={{color:'#fff', fontSize:'1.1em'}}>{g.groupName}</strong> <br/>
                <small style={{color:'#888'}}>Users: {g.characters.length} | Msgs: {g.messages.length}</small>
              </div>
              <div style={{display:'flex', gap:'5px'}}>
                <button style={{width:'auto', padding:'5px 10px', background: '#17a2b8', marginTop:0}} onClick={()=>toggleDetails(g._id)}>
                  {expandedGroup === g._id ? 'Hide' : 'View'}
                </button>
                <button style={{width:'auto', padding:'5px 10px', background:'#ff416c', marginTop:0}} onClick={()=>deleteGroup(g._id)}>X</button>
              </div>
            </div>

            {expandedGroup === g._id && (
              <div style={{marginTop:'10px', background:'#1a1d24', padding:'10px', borderRadius:'6px'}}>
                <h4 style={{marginTop:0, color:'#aaa', fontSize:'0.9em'}}>Users & PINs</h4>
                {g.characters.length === 0 ? <p style={{fontSize:'0.8em'}}>No users.</p> : (
                  <ul style={{paddingLeft:'20px', margin:'5px 0', fontSize:'0.9em'}}>
                    {g.characters.map(c => (
                      <li key={c._id}><span style={{color:'#00d2ff'}}>{c.name}</span> - {c.pin}</li>
                    ))}
                  </ul>
                )}
                <h4 style={{margin:'10px 0 5px 0', color:'#aaa', fontSize:'0.9em'}}>Recent Messages</h4>
                <div style={{maxHeight:'150px', overflowY:'scroll', background:'#111', padding:'8px', borderRadius:'4px'}}>
                   {g.messages.length === 0 ? <p style={{fontSize:'0.8em', color:'#666'}}>No messages.</p> : (
                     g.messages.map((m, i) => (
                       <div key={i} style={{marginBottom:'5px', fontSize:'0.85em'}}>
                         <strong style={{color:'#00d2ff'}}>{m.sender}:</strong> {m.fileUrl ? (m.fileType === 'image' ? '[Image]' : `[File: ${m.fileName}]`) : m.text}
                       </div>
                     ))
                   )}
                </div>
              </div>
            )}
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