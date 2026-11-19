import React, {useEffect, useMemo, useRef, useState} from 'react';
import Markdown, {defaultUrlTransform} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js/lib/common';
import {invoke} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import {getCurrentWebview} from '@tauri-apps/api/webview';
import {open} from '@tauri-apps/plugin-dialog';

const native = !!window.__TAURI_INTERNALS__;
const defaults = {theme:'system',fontSize:17,width:'comfortable',sidebar:true,remoteImages:false,recents:[]};
const welcome = {path:'welcome',name:'Welcome to Frostmark',content:`# A little space to read.

Welcome to **Frostmark** — a quiet home for your Markdown. Beautiful typography, thoughtful details, and nothing between you and the page.

> Open a document with **Ctrl + O**, or simply drop a Markdown file anywhere in this window.

## Made for the words

Your files stay yours. Frostmark is a **read-only, offline-first** reader: no accounts, no cloud uploads, no changes to your documents.

- Open several documents in tabs
- Navigate long documents with the outline
- Choose light, dark, or follow your system
- Adjust the text size and reading width
- Print a clean copy with **Ctrl + P**

## All the right formatting

Tables, lists, links, blockquotes, and fenced code all have a place here.

| Feature | A considered detail |
| :--- | :--- |
| Typography | A comfortable measure and generous line spacing |
| Code | Syntax highlighting and one-click copying |
| Images | Local images load from the document folder |
| Privacy | Remote images are blocked by default |

### A little code

\`\`\`javascript
const reader = {
  name: 'Frostmark',
  mode: 'read-only',
  distractions: 0,
};

console.log('Make room for a good read.');
\`\`\`

### A few things to try

- [x] Find a calmer way to read
- [ ] Open your first Markdown file
- [ ] Make the reader feel like home

## Designed to travel

Keep the executable in a writable folder, on your desktop, or on a USB drive. Preferences and recent-file paths are stored beside the app. Your document contents are never copied into settings.

**Ready when you are.** Open a file to begin.
`};
const textOf = n => typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(textOf).join('') : n?.props ? textOf(n.props.children) : '';
const slug = t => t.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu,'').replace(/\s+/g,'-') || 'section';
function outlinePlugin() { return tree => { const counts = new Map(); const walk = node => { if (node.type === 'heading') { const plain = n => n.value || (n.children || []).map(plain).join(''); const base = slug(plain(node)); const n = counts.get(base)||0; counts.set(base,n+1); node.data = {...node.data,hProperties:{...node.data?.hProperties,id:n?`${base}-${n}`:base}}; } node.children?.forEach(walk); }; walk(tree); }; }
function Icon({name,...props}) { const paths = {open:'M3 7h6l2 2h10l-3 10H3V7Zm0 0V4h7l2 3',book:'M4 4h7l1 2 1-2h7v15h-7l-1 1-1-1H4V4Zm8 2v14',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',moon:'M20 14A8.5 8.5 0 0 1 10 4 8.5 8.5 0 1 0 20 14Z',screen:'M3 4h18v13H3V4Zm9 13v4m-4 0h8',search:'M16 16l5 5m-3-11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',settings:'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-7 0v6',side:'M3 4h18v16H3V4Zm6 0v16',print:'M6 8V3h12v5M6 17H3V9h18v8h-3M6 14h12v7H6v-7Z',refresh:'M20 6v5h-5M4 18v-5h5m-4-5a8 8 0 0 1 14-3l1 6M4 13l1 6a8 8 0 0 0 14-3',close:'m6 6 12 12M6 18 18 6',chevron:'m9 5 7 7-7 7',copy:'M8 8h12v13H8V8ZM4 16H3V3h12v1',check:'m4 12 5 5L20 6',file:'M6 2h8l5 5v15H6V2Zm8 0v6h5',clock:'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'}; return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]||paths.file}/></svg>; }
function Button({icon,label,children,...props}) { return <button type="button" title={label} aria-label={label} {...props}>{icon&&<Icon name={icon}/ >}{children}</button>; }
function Code({className='',children,...props}) { const [copied,setCopied] = useState(false); const code = String(children).replace(/\n$/,''); const language = /language-([\w+-]+)/.exec(className)?.[1]; if (!className && !String(children).includes('\n')) return <code {...props}>{children}</code>; let html; try { html = language && hljs.getLanguage(language) ? hljs.highlight(code,{language}).value : hljs.highlightAuto(code).value; } catch { return <code className={className}>{children}</code>; } return <div className="codeblock"><div className="codebar"><span>{language||'code'}</span><button onClick={async()=>{try{await navigator.clipboard.writeText(code);setCopied(true);setTimeout(()=>setCopied(false),1600);}catch{setCopied(false);}}}><Icon name={copied?'check':'copy'}/>{copied?'Copied':'Copy'}</button></div><code className={`hljs ${className}`} dangerouslySetInnerHTML={{__html:html}}/></div>; }
function Image({src,alt,documentPath,allowRemote}) { const [loaded,setLoaded]=useState(''); const [error,setError]=useState(''); useEffect(()=>{let alive=true;setLoaded('');setError(''); if(!src)return; if(/^https?:\/\//i.test(src)) {if(allowRemote)setLoaded(src);else setError('Remote image blocked for privacy');} else if(src.startsWith('data:image/')&&!src.startsWith('data:image/svg'))setLoaded(src); else if(native&&documentPath!=='welcome')invoke('read_image',{documentPath,path:src}).then(value=>{if(alive)setLoaded(value);}).catch(e=>{if(alive)setError(String(e));}); else setError('Open this document in the desktop app to view local images');return()=>{alive=false;};},[src,documentPath,allowRemote]); return loaded?<img src={loaded} alt={alt||''} loading="lazy" onError={()=>{setLoaded('');setError('Image could not be loaded');}}/>:<span className="image-placeholder" role="img" aria-label={alt||'Image'}>{alt||'Image'}<small>{error||'Loading image…'}</small></span>; }

export default function App() {
 const [tabs,setTabs]=useState([welcome]),[active,setActive]=useState('welcome'),[prefs,setPrefs]=useState(defaults),[ready,setReady]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(0),[settings,setSettings]=useState(false),[find,setFind]=useState(false),[query,setQuery]=useState(''),[drag,setDrag]=useState(false),[outline,setOutline]=useState([]),[progress,setProgress]=useState(0);
 const article=useRef(null),scroll=useRef(null),picker=useRef(null),queryInput=useRef(null),state=useRef({});
 const doc=tabs.find(t=>t.path===active)||tabs[0]||welcome;
 const update = values=>setPrefs(p=>({...p,...values}));
 const openPaths=async paths=>{for(const path of paths||[]){setBusy(b=>b+1);try{const d=await invoke('open_document',{path});setTabs(ts=>{const existing=ts.some(t=>t.path===d.path);return existing?ts.map(t=>t.path===d.path?d:t):[...ts.filter(t=>t.path!=='welcome'),d];});setActive(d.path);setPrefs(p=>({...p,recents:[{path:d.path,name:d.name},...p.recents.filter(x=>x.path!==d.path)].slice(0,15)}));setError('');}catch(e){setError(String(e));}finally{setBusy(b=>b-1);}}};
 const choose=async()=>{if(!native){picker.current?.click();return;}try{const paths=await open({multiple:true,filters:[{name:'Markdown and text',extensions:['md','markdown','mdown','mkd','txt']}]});if(paths)await openPaths(Array.isArray(paths)?paths:[paths]);}catch(e){setError(String(e));}};
 const closeTab=path=>{setTabs(ts=>{const rest=ts.filter(t=>t.path!==path);if(active===path)setActive(rest[Math.max(0,ts.findIndex(t=>t.path===path)-1)]?.path||'welcome');return rest.length?rest:[welcome];});};
 state.current={choose,openPaths,closeTab,doc,update,prefs};
 useEffect(()=>{let disposed=false;let unsub=[];(async()=>{try{const saved=native?await invoke('load_preferences'):JSON.parse(localStorage.getItem('frostmark')||'null');if(!disposed&&saved&&typeof saved==='object')setPrefs({...defaults,...saved,fontSize:Math.min(26,Math.max(13,Number(saved.fontSize)||17)),recents:Array.isArray(saved.recents)?saved.recents.filter(x=>typeof x.path==='string'&&typeof x.name==='string').slice(0,15):[]});}catch(e){if(!disposed)setError(`Preferences could not be loaded: ${e}`);}finally{if(!disposed)setReady(true);}if(native&&!disposed){try{const off=await listen('open-files',e=>state.current.openPaths(e.payload));if(disposed)off();else unsub.push(off);const offDrag=await getCurrentWebview().onDragDropEvent(e=>{setDrag(e.payload.type==='over'||e.payload.type==='enter');if(e.payload.type==='drop')state.current.openPaths(e.payload.paths);});if(disposed)offDrag();else unsub.push(offDrag);const paths=await invoke('startup_files');if(!disposed&&paths.length)state.current.openPaths(paths);}catch(e){if(!disposed)setError(String(e));}}})();return()=>{disposed=true;unsub.forEach(f=>f());};},[]);
 useEffect(()=>{if(!ready)return;const timeout=setTimeout(()=>{if(native)invoke('save_preferences',{preferences:prefs}).catch(e=>setError(String(e)));else try{localStorage.setItem('frostmark',JSON.stringify(prefs));}catch(e){setError(String(e));}},450);return()=>clearTimeout(timeout);},[prefs,ready]);
 useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)');const apply=()=>{document.documentElement.dataset.theme=prefs.theme==='system'?(media.matches?'dark':'light'):prefs.theme;};apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply);},[prefs.theme]);
 useEffect(()=>{document.title=doc.path==='welcome'?'Frostmark':`${doc.name} — Frostmark`;scroll.current?.scrollTo(0,0);setProgress(0);const frame=requestAnimationFrame(()=>setOutline(Array.from(article.current?.querySelectorAll('h1,h2,h3,h4')||[]).map(h=>({id:h.id,text:h.textContent,level:Number(h.tagName[1])}))));return()=>cancelAnimationFrame(frame);},[doc.content,doc.path]);
 useEffect(()=>{const handler=e=>{const s=state.current;if((e.ctrlKey||e.metaKey)&&!e.altKey){const key=e.key.toLowerCase();if(['o','w','f','r','p','+','=','-','0'].includes(key)){e.preventDefault();if(key==='o')s.choose();if(key==='w')s.closeTab(s.doc.path);if(key==='f'){setFind(true);setTimeout(()=>queryInput.current?.focus(),0);}if(key==='r'&&s.doc.path!=='welcome')s.openPaths([s.doc.path]);if(key==='p')window.print();if(key==='+'||key==='=')s.update({fontSize:Math.min(26,s.prefs.fontSize+1)});if(key==='-')s.update({fontSize:Math.max(13,s.prefs.fontSize-1)});if(key==='0')s.update({fontSize:17});}}if(e.key==='Escape'){setFind(false);setSettings(false);}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[]);
 const follow=async href=>{try{if(href.startsWith('#')){document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({behavior:'smooth'});return;}if(native){const link=await invoke('resolve_link',{documentPath:doc.path,href});if(link.kind==='document')await openPaths([link.target]);if(link.kind==='external')await invoke('open_external',{url:link.target});}else if(/^https?:|^mailto:/i.test(href))window.open(href,'_blank','noopener,noreferrer');else setError('Local document links are available in the desktop app.');}catch(e){setError(String(e));}};
 const components=useMemo(()=>({code:Code,pre:({children})=><div className="pre-wrapper">{children}</div>,img:({src,alt})=><Image src={src} alt={alt} documentPath={doc.path} allowRemote={prefs.remoteImages}/>,a:({href,children})=><a href={href} onClick={e=>{e.preventDefault();if(href)follow(href);}}>{children}</a>,table:({children})=><div className="table-scroll"><table>{children}</table></div>}),[doc.path,prefs.remoteImages]);
 const words=doc.content.trim().split(/\s+/).filter(Boolean).length;
 const runFind=backwards=>{if(query&&!window.find(query,false,backwards,true,false,false,false))setError(`No more matches for “${query}”.`);};
 return <div className={`app ${prefs.sidebar?'':'no-sidebar'}`}>
  <input ref={picker} type="file" multiple accept=".md,.markdown,.mdown,.mkd,.txt" hidden onChange={async e=>{for(const f of e.target.files){if(f.size>20*1024*1024){setError('Documents must be smaller than 20 MB');continue;}const d={path:`browser:${f.name}:${f.lastModified}`,name:f.name,content:await f.text()};setTabs(ts=>[...ts.filter(t=>t.path!=='welcome'&&t.path!==d.path),d]);setActive(d.path);}e.target.value='';}}/>
  <header className="topbar"><div className="brand"><span className="brandmark"><Icon name="book" width="21" height="21"/></span><strong>Frostmark</strong><span className="read-only">READ ONLY</span></div><div className="top-actions"><Button icon="open" label="Open files (Ctrl+O)" className="primary" onClick={choose}>Open file<span className="shortcut">Ctrl O</span></Button><span className="divider"/><Button icon="search" label="Find in document (Ctrl+F)" onClick={()=>{setFind(f=>!f);setTimeout(()=>queryInput.current?.focus(),0);}}/><Button icon="print" label="Print (Ctrl+P)" onClick={()=>window.print()}/><Button icon="settings" label="Reading preferences" aria-expanded={settings} onClick={()=>setSettings(v=>!v)}/></div></header>
  <div className="tabbar" role="tablist" aria-label="Open documents">{tabs.map(t=><div key={t.path} className={`tab ${doc.path===t.path?'selected':''}`}><button role="tab" aria-selected={doc.path===t.path} title={t.path==='welcome'?t.name:t.path} onClick={()=>setActive(t.path)}><Icon name={t.path==='welcome'?'book':'file'}/><span>{t.name}</span></button><Button icon="close" label={`Close ${t.name}`} className="tab-close" onClick={()=>closeTab(t.path)}/></div>)}<Button icon="open" label="Open another file" className="add-tab" onClick={choose}/></div>
  {error&&<div className="notice" role="alert"><span>{error}</span><Button icon="close" label="Dismiss message" onClick={()=>setError('')}/></div>}
  {settings&&<section className="settings" aria-label="Reading preferences"><div className="settings-head"><div><span className="eyebrow">MAKE IT YOURS</span><h2>Reading preferences</h2></div><Button icon="close" label="Close preferences" onClick={()=>setSettings(false)}/></div><label>Appearance</label><div className="segmented">{[['light','sun','Light'],['dark','moon','Dark'],['system','screen','System']].map(([value,icon,label])=><button key={value} className={prefs.theme===value?'chosen':''} onClick={()=>update({theme:value})}><Icon name={icon}/>{label}</button>)}</div><label>Text size <span>{prefs.fontSize} px</span></label><div className="size-control"><button aria-label="Smaller text" onClick={()=>update({fontSize:Math.max(13,prefs.fontSize-1)})}>A−</button><input aria-label="Text size" type="range" min="13" max="26" value={prefs.fontSize} onChange={e=>update({fontSize:Number(e.target.value)})}/><button aria-label="Larger text" onClick={()=>update({fontSize:Math.min(26,prefs.fontSize+1)})}>A+</button></div><label htmlFor="width">Reading width</label><select id="width" value={prefs.width} onChange={e=>update({width:e.target.value})}><option value="narrow">Narrow · focused</option><option value="comfortable">Comfortable · balanced</option><option value="wide">Wide · spacious</option></select><label className="check-label"><input type="checkbox" checked={prefs.remoteImages} onChange={e=>update({remoteImages:e.target.checked})}/>Allow remote images</label><p className="muted small">Remote images contact third-party servers. Keep this off for private, offline reading.</p><div className="settings-foot">No edits. No uploads. Just reading.</div></section>}
  {find&&<form className="findbar" onSubmit={e=>{e.preventDefault();runFind(false);}}><Icon name="search"/><input ref={queryInput} aria-label="Find text" placeholder="Find in document…" value={query} onChange={e=>setQuery(e.target.value)}/><button type="button" onClick={()=>runFind(true)}>Previous</button><button type="submit">Next</button><Button icon="close" label="Close find" onClick={()=>setFind(false)}/></form>}
  <div className="workspace"><aside className="sidebar" aria-label="Document navigation"><div className="sidebar-top"><span className="eyebrow">IN THIS DOCUMENT</span><Button icon="side" label="Hide navigation" onClick={()=>update({sidebar:false})}/></div><nav className="outline" aria-label="Table of contents">{outline.map(h=><a key={h.id} href={`#${h.id}`} className={`level-${h.level}`} onClick={e=>{e.preventDefault();document.getElementById(h.id)?.scrollIntoView({behavior:'smooth'});}}>{h.text}</a>)}{outline.length===0&&<p className="muted small">Headings will appear here.</p>}</nav><div className="recent-heading"><span className="eyebrow">RECENT FILES</span>{prefs.recents.length>0&&<button onClick={()=>update({recents:[]})}>Clear</button>}</div><div className="recents">{prefs.recents.length===0?<p className="muted small">Your next good read starts here.<br/>Open a file to get started.</p>:prefs.recents.slice(0,8).map(r=><button key={r.path} title={r.path} onClick={()=>openPaths([r.path])}><Icon name="file"/><span>{r.name}</span></button>)}</div><div className="sidebar-bottom"><Icon name="check"/><span>Your documents stay untouched.</span></div></aside>
  <main className="reader" ref={scroll} onScroll={e=>{const el=e.currentTarget;setProgress(el.scrollHeight===el.clientHeight?100:Math.round(el.scrollTop/(el.scrollHeight-el.clientHeight)*100));}}><div className="document-top"><div className="breadcrumb">{!prefs.sidebar&&<Button icon="side" label="Show navigation" onClick={()=>update({sidebar:true})}/>}<Icon name={doc.path==='welcome'?'book':'file'}/><span title={doc.path}>{doc.path==='welcome'?'Your reading space':doc.name}</span></div><div className="document-actions"><span>{Math.max(1,Math.ceil(words/220))} min read</span>{doc.path!=='welcome'&&<Button icon="refresh" label="Reload document (Ctrl+R)" onClick={()=>openPaths([doc.path])}/>}</div></div><article ref={article} className={`markdown width-${prefs.width}`} style={{fontSize:prefs.fontSize}}><Markdown remarkPlugins={[remarkGfm,outlinePlugin]} components={components} urlTransform={url=>defaultUrlTransform(url)}>{doc.content}</Markdown><div className="end-mark" aria-hidden="true">❄</div></article></main></div>
  <footer className="statusbar"><span><span className="status-dot"/>{busy?'Opening document…':native?'Portable · local files only':'Browser preview · local files only'}</span><span>{words.toLocaleString()} words<span className="status-sep">·</span>{prefs.fontSize} px<span className="status-sep">·</span>{progress}%</span></footer>
  {drag&&<div className="drop-overlay"><div><Icon name="open" width="48" height="48"/><h2>Drop a little reading here.</h2><p>Markdown & plain-text files</p></div></div>}
 </div>;
}
