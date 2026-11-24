import brandLogo from "./logo-resinas-jardim.png";
import { useState, useMemo, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = "https://yohwzwhmsqfksnwjtxmy.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvaHd6d2htc3Fma3Nud2p0eG15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTYzNzIsImV4cCI6MjA5NTU3MjM3Mn0.0iDV0TIxJ7dX37IsI6NtVdrkgQq-qQPYFweWztfaIz0";
const supabase = createClient(SUPA_URL, SUPA_KEY);

// ─── HELPERS ─────────────────────────────────────────────────────
const ehTerebintina = (p) => (p||"").toUpperCase().includes("TEREBINTINA");
function docsIniciais(produto) {
  const prod = produto||"";
  const temPallet = !prod.toUpperCase().includes("TAMBOR") && !prod.toUpperCase().includes("GRANEL");
  const base = { invoice:false, packing:false, co:false, ca:false, due:false, pallet: temPallet };
  return ehTerebintina(prod) ? { ...base, anexoVII:false, mdgf:false, dca:false } : base;
}
const LABEL_DOC = { invoice:"Commercial Invoice", packing:"Packing List", co:"Cert. Origem", ca:"Cert. Análise", due:"DU-E", pallet:"Cert. Pallets", anexoVII:"Anexo VII", mdgf:"MDGF", dca:"DCA" };
const TODAY = new Date();
const daysDiff = (d) => { if(!d) return null; return Math.ceil((new Date(d+"T12:00:00")-TODAY)/86400000); };
const fmtDate  = (d) => { if(!d) return "—"; return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); };
const fmtUSD   = (v) => "$"+Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:0});
const semReserva = (p) => !p.carg && !p.bl && p.status !== "PAGO";
const docsIncompletos = (p) => p.docs && Object.values(p.docs).some(v=>!v);

const STATUS_OPTIONS = ["PENDENTE","EM PROCESSAMENTO PELO BANCO","PAGO","PAGO PARCIAL","EM COBRANÇA","ATRASADO","INADIMPLENTE"];
const STATUS_CFG = {
  "PENDENTE":                    { bg:"#eff0e9", color:"#536458", border:"#d9ddd2", dot:"#68786b" },
  "EM PROCESSAMENTO PELO BANCO": { bg:"#f5f0e4", color:"#795c28", border:"#dfcfaa", dot:"#bd9855" },
  "PAGO":                        { bg:"#f0fdf4", color:"#15803d", border:"#bbf7d0", dot:"#22c55e" },
  "PAGO PARCIAL":                { bg:"#fefce8", color:"#a16207", border:"#fde68a", dot:"#eab308" },
  "EM COBRANÇA":                 { bg:"#fff7ed", color:"#c2410c", border:"#fed7aa", dot:"#f97316" },
  "ATRASADO":                    { bg:"#fef2f2", color:"#b91c1c", border:"#fecaca", dot:"#ef4444" },
  "INADIMPLENTE":                { bg:"#fdf2f8", color:"#9d174d", border:"#fbcfe8", dot:"#ec4899" },
};
const C = { white:"#ffffff", bg:"#f5f5ef", border:"#dedfd5", text:"#203a2b", sub:"#536458", muted:"#68786b", blue:"#1d402e", green:"#28734a", red:"#c82931", orange:"#ea580c", amber:"#946b25" };

// ─── UI ATOMS ─────────────────────────────────────────────────────
function Badge({ status }) {
  const s = STATUS_CFG[status]||STATUS_CFG["PENDENTE"];
  return <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:s.bg, color:s.color, border:`1px solid ${s.border}`, borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}><span style={{ width:6, height:6, borderRadius:"50%", background:s.dot, flexShrink:0 }}/>{status}</span>;
}
function Pill({ children, color="gray" }) {
  const m = { blue:{bg:"#f5f0e4",c:"#795c28",b:"#dfcfaa"}, red:{bg:"#fef2f2",c:"#b91c1c",b:"#fecaca"}, amber:{bg:"#fefce8",c:"#92400e",b:"#fde68a"}, green:{bg:"#f0fdf4",c:"#15803d",b:"#bbf7d0"}, gray:{bg:"#eff0e9",c:"#536458",b:"#d9ddd2"} };
  const s = m[color]||m.gray;
  return <span style={{ background:s.bg, color:s.c, border:`1px solid ${s.b}`, borderRadius:4, padding:"1px 7px", fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>{children}</span>;
}
function DaysBadge({ days }) {
  if(days===null) return <span style={{color:C.muted,fontSize:12}}>—</span>;
  if(days<0)  return <Pill color="red">{Math.abs(days)}d atrasado</Pill>;
  if(days===0) return <Pill color="red">Hoje!</Pill>;
  if(days<=5)  return <Pill color="red">{days}d</Pill>;
  if(days<=15) return <Pill color="amber">{days}d</Pill>;
  return <Pill color="green">{days}d</Pill>;
}
function KpiCard({ label, value, sub, color="blue", icon, onClick }) {
  const clr = color==="red"?C.red:color==="amber"?C.amber:color==="green"?C.green:C.blue;
  return (
    <button type="button" className="kpi" onClick={onClick} disabled={!onClick} style={{ "--accent":clr }}>
      <div style={{ fontSize:11, color:C.sub, fontWeight:600, textTransform:"uppercase", letterSpacing:.6, marginBottom:6 }}>{icon} {label}</div>
      <div style={{ fontSize:22, fontWeight:800, color:clr }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:C.sub, marginTop:5 }}>{sub}</div>}
      {onClick && <span className="kpi-link">Ver detalhes →</span>}
    </button>
  );
}

// ─── CHECKLIST ────────────────────────────────────────────────────
function DocChecklist({ docs, onChange, compact }) {
  if(!docs) return null;
  const isTere = "anexoVII" in docs;
  const grupos = [
    { titulo:"Comerciais", keys:["invoice","packing"] },
    { titulo:"Regulatórios", keys:["co","ca","due",...("pallet" in docs?["pallet"]:[])] },
    ...(isTere?[{ titulo:"Terebintina", keys:["anexoVII","mdgf","dca"] }]:[]),
  ];
  const total = Object.keys(docs).length;
  const feitos = Object.values(docs).filter(Boolean).length;
  const pct = total>0?Math.round((feitos/total)*100):0;
  if(compact) return (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <div style={{ flex:1, height:4, background:"#dedfd5", borderRadius:4, minWidth:50 }}>
        <div style={{ height:"100%", width:`${pct}%`, background:pct===100?"#22c55e":pct>60?"#f59e0b":"#ef4444", borderRadius:4 }}/>
      </div>
      <span style={{ fontSize:11, color:C.sub, fontWeight:600 }}>{feitos}/{total}</span>
    </div>
  );
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <div style={{ flex:1, height:6, background:"#eff0e9", borderRadius:4 }}>
          <div style={{ height:"100%", width:`${pct}%`, background:pct===100?"#22c55e":pct>60?"#f59e0b":"#ef4444", borderRadius:4, transition:"width .3s" }}/>
        </div>
        <span style={{ fontSize:12, fontWeight:700, color:C.sub }}>{feitos}/{total} ({pct}%)</span>
      </div>
      {grupos.map(g=>(
        <div key={g.titulo} style={{ marginBottom:10 }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:.8, marginBottom:5 }}>{g.titulo}</div>
          {g.keys.filter(k=>k in docs).map(k=>(
            <label key={k} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", padding:"6px 10px", borderRadius:6, background:docs[k]?"#f0fdf4":"#f5f5ef", border:`1px solid ${docs[k]?"#bbf7d0":C.border}`, marginBottom:4 }}>
              <input type="checkbox" checked={docs[k]} onChange={e=>onChange&&onChange(k,e.target.checked)} style={{ accentColor:"#22c55e", width:14, height:14 }}/>
              <span style={{ fontSize:12, fontWeight:600, color:docs[k]?C.green:C.sub }}>{LABEL_DOC[k]}</span>
              {docs[k] && <span style={{ marginLeft:"auto", fontSize:10, color:C.green }}>✓</span>}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── MODAL PROCESSO ───────────────────────────────────────────────
function ProcessoModal({ proc, onClose, onSave, loading }) {
  const [f, setF] = useState({ ...proc });
  const [subTab, setSubTab] = useState("dados");
  const [uploading, setUploading] = useState(false);
  const [arquivos, setArquivos] = useState([]);
  const fileRef = useRef();
  const isNew = !proc.id;

  useEffect(() => {
    if(proc.id) loadArquivos();
  }, [proc.id]);

  const loadArquivos = async () => {
    const { data,error } = await supabase.from("arquivos").select("*").eq("processo_id", proc.id).order("created_at");
    if(error) alert("Falha ao consultar arquivos: "+error.message);
    if(data) setArquivos(data);
  };

  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const setDoc = (k,v) => setF(p=>({...p, docs:{...p.docs,[k]:v}}));

  const addFile = async (e) => {
    const files = Array.from(e.target.files);
    setUploading(true);
    try {
      for(const file of files) {
        const path = `${proc.id}/${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
        const {error}=await supabase.storage.from("arquivos").upload(path,file);
        if(error) throw error;
        const {data:urlData}=supabase.storage.from("arquivos").getPublicUrl(path);
        const {error:metaError}=await supabase.from("arquivos").insert({processo_id:proc.id,nome:file.name,tamanho:file.size,tipo:file.type,url:urlData.publicUrl});
        if(metaError) {await supabase.storage.from("arquivos").remove([path]);throw metaError;}
      }
    } catch(e) {alert("Falha no envio de um ou mais arquivos: "+e.message);}
    finally {await loadArquivos();setUploading(false);e.target.value="";}
  };
  const removeFile = async (arq) => {
    if(!window.confirm(`Remover ${arq.nome}?`)) return;
    const {error}=await supabase.from("arquivos").delete().eq("id",arq.id);
    if(error) {alert("Não foi possível remover: "+error.message);return;}
    setArquivos(a=>a.filter(x=>x.id!==arq.id));
  };
  const openFile = async (arq) => {
    try {
      const path=decodeURIComponent(new URL(arq.url).pathname.split("/object/public/arquivos/")[1]||"");
      if(!path) throw new Error("Caminho de arquivo inválido");
      const {data,error}=await supabase.storage.from("arquivos").createSignedUrl(path,60);
      if(error) throw error;
      window.location.assign(data.signedUrl);
    } catch(e) {alert("Não foi possível abrir o arquivo: "+e.message);}
  };

  const inp = { width:"100%", boxSizing:"border-box", border:`1px solid ${C.border}`, borderRadius:7, padding:"8px 11px", fontSize:13, fontFamily:"inherit", color:C.text, background:C.white, outline:"none" };
  const lbl = { fontSize:11, color:C.sub, fontWeight:600, letterSpacing:.5, textTransform:"uppercase", display:"block", marginBottom:4 };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(15,23,42,0.4)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:14, width:"100%", maxWidth:640, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,.15)" }}>
        <div style={{ padding:"20px 24px 0", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
            <div>
              <div style={{ fontSize:11, color:C.blue, fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:2 }}>{f.empresa} · {f.proforma||"Novo processo"}</div>
              <div style={{ fontSize:17, fontWeight:800, color:C.text }}>{f.cliente||"—"}</div>
            </div>
            <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.muted }}>×</button>
          </div>
          <div style={{ display:"flex", gap:0 }}>
            {[["dados","Dados"],["docs","✓ Documentos"],["arquivos","📎 Arquivos"]].map(([id,label])=>(
              <button key={id} onClick={()=>setSubTab(id)} style={{ background:"none", border:"none", borderBottom:`2px solid ${subTab===id?C.blue:"transparent"}`, color:subTab===id?C.blue:C.muted, padding:"8px 16px", fontSize:12, fontWeight:subTab===id?700:500, cursor:"pointer", fontFamily:"inherit" }}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ padding:"20px 24px" }}>
          {subTab==="dados" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              {[["cliente","Cliente","text","1/span 2"],["produto","Produto","text","1/span 2"],["destino","País Destino","text"],["incoterm","Incoterm","incoterm"],["qtd","Quantidade","number"],["valor","Valor USD","number"],["prazo","Prazo Pgto (dias)","number"],["termos","Termos Pgto","termos"],["prontidao","Previsão Prontidão","date"],["carg","Data Carregamento","date"],["bl","Data BL","date"],["pgm","Previsão Pagamento","date"]].map(([k,lb,type,gc])=>(
                <div key={k} style={{ gridColumn:gc }}>
                  <label style={lbl}>{lb}</label>
                  {type==="incoterm"?<select value={f[k]||"FOB"} onChange={e=>set(k,e.target.value)} style={inp}>{["FOB","CIF","CFR","EXW","DAP","DDP"].map(o=><option key={o}>{o}</option>)}</select>
                  :type==="termos"?<select value={f[k]||"DIAS DO BL"} onChange={e=>set(k,e.target.value)} style={inp}>{["DIAS DO BL","NO BL","DIAS DO PEDIDO","100% ANTECIPADO","50% ANTECIPADO","PARCELADO"].map(o=><option key={o}>{o}</option>)}</select>
                  :<input type={type} value={f[k]||""} onChange={e=>set(k,e.target.value)} style={inp}/>}
                </div>
              ))}
              <div style={{ gridColumn:"1/span 2" }}>
                <label style={lbl}>Status Pagamento</label>
                <select value={f.status} onChange={e=>set("status",e.target.value)} style={inp}>{STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}</select>
              </div>
              <div style={{ gridColumn:"1/span 2" }}>
                <label style={lbl}>Obs. Prazos/Pagamentos</label>
                <textarea value={f.obs_prazo||""} onChange={e=>set("obs_prazo",e.target.value)} rows={2} style={{ ...inp, resize:"vertical" }}/>
              </div>
              <div style={{ gridColumn:"1/span 2" }}>
                <label style={lbl}>Obs. Gerais</label>
                <textarea value={f.obs||""} onChange={e=>set("obs",e.target.value)} rows={2} style={{ ...inp, resize:"vertical" }}/>
              </div>
            </div>
          )}
          {subTab==="docs" && <DocChecklist docs={f.docs} onChange={setDoc}/>}
          {subTab==="arquivos" && (
            <div>
              {isNew && <div style={{ background:"#fefce8", border:"1px solid #fde68a", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#92400e", marginBottom:14 }}>💡 Salve o processo primeiro para poder anexar arquivos.</div>}
              {!isNew && (
                <>
                  <div onClick={()=>fileRef.current.click()} style={{ border:`2px dashed ${C.border}`, borderRadius:10, padding:"24px", textAlign:"center", cursor:"pointer", marginBottom:14, background:"#f5f5ef" }}>
                    <div style={{ fontSize:24, marginBottom:6 }}>📎</div>
                    <div style={{ color:C.sub, fontSize:13 }}>{uploading?"Enviando...":"Clique para anexar arquivos"}</div>
                  </div>
                  <input ref={fileRef} type="file" multiple style={{ display:"none" }} onChange={addFile}/>
                  {arquivos.map(arq=>(
                    <div key={arq.id} style={{ display:"flex", alignItems:"center", gap:10, border:`1px solid ${C.border}`, borderRadius:8, padding:"9px 13px", marginBottom:8, background:"#f5f5ef" }}>
                      <span style={{ fontSize:18 }}>📎</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{arq.nome}</div>
                        <div style={{ fontSize:11, color:C.muted }}>{arq.tamanho?(arq.tamanho/1024).toFixed(1)+" KB":""}</div>
                      </div>
                      <button onClick={()=>openFile(arq)} style={{ background:"#f5f0e4", color:C.blue, border:"1px solid #dfcfaa", borderRadius:5, padding:"4px 9px", fontSize:11, fontWeight:600, textDecoration:"none" }}>⬇</button>
                      <button onClick={()=>removeFile(arq)} style={{ background:"#fef2f2", color:C.red, border:"1px solid #fecaca", borderRadius:5, padding:"4px 9px", fontSize:11, cursor:"pointer" }}>🗑</button>
                    </div>
                  ))}
                  {arquivos.length===0 && <div style={{ textAlign:"center", color:C.muted, fontSize:12, padding:16 }}>Nenhum arquivo anexado</div>}
                </>
              )}
            </div>
          )}
        </div>
        <div style={{ padding:"16px 24px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ background:C.bg, color:C.sub, border:`1px solid ${C.border}`, borderRadius:7, padding:"8px 18px", fontWeight:600, fontSize:13, cursor:"pointer" }}>Cancelar</button>
          <button onClick={()=>onSave(f)} disabled={loading} style={{ background:C.blue, color:"#fff", border:"none", borderRadius:7, padding:"8px 20px", fontWeight:700, fontSize:13, cursor:"pointer" }}>{loading?"Salvando...":"Salvar"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── TABELA ───────────────────────────────────────────────────────
function Th({ ch, right }) { return <th style={{ padding:"9px 12px", fontSize:11, fontWeight:700, color:C.sub, textTransform:"uppercase", letterSpacing:.5, textAlign:right?"right":"left", borderBottom:`1px solid ${C.border}`, background:"#f5f5ef", whiteSpace:"nowrap" }}>{ch}</th>; }
function Td({ children, style }) { return <td style={{ padding:"10px 12px", borderBottom:"1px solid #eff0e9", verticalAlign:"middle", fontSize:13, ...style }}>{children}</td>; }

function Tabela({ rows, onEdit, cols={} }) {
  if(!rows.length) return <div style={{ textAlign:"center", padding:40, color:C.muted }}>Nenhum processo encontrado</div>;
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead><tr>
          <Th ch="Proforma"/><Th ch="Empresa"/><Th ch="Cliente"/><Th ch="Produto"/>
          {cols.prontidao&&<Th ch="Prontidão"/>}
          <Th ch="USD" right/>
          {cols.carg&&<Th ch="Carregamento"/>}
          {cols.bl&&<Th ch="BL"/>}
          {cols.pgm&&<Th ch="Pgto Prev."/>}
          {cols.diasPgm&&<Th ch="Vence"/>}
          {cols.docs&&<Th ch="Docs"/>}
          {cols.status&&<Th ch="Status"/>}
          <Th ch=""/>
        </tr></thead>
        <tbody>
          {rows.map((p,i)=>(
            <tr key={p.id||p.proforma} style={{ background:i%2===0?C.white:"#fafafa", cursor:"pointer" }} onClick={()=>onEdit(p)}>
              <Td><span style={{ color:C.blue, fontWeight:700, fontSize:12 }}>{p.proforma}</span></Td>
              <Td><Pill>{p.empresa}</Pill></Td>
              <Td style={{ fontWeight:600 }}>{p.cliente}</Td>
              <Td style={{ color:C.sub, maxWidth:160 }}><span style={{ display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:160 }}>{p.produto}</span></Td>
              {cols.prontidao&&<Td>{p.prontidao?fmtDate(p.prontidao):<Pill color="amber">Indefinida</Pill>}</Td>}
              <Td style={{ textAlign:"right", fontWeight:700, color:C.green }}>{fmtUSD(p.valor)}</Td>
              {cols.carg&&<Td>{p.carg?fmtDate(p.carg):<Pill color="red">Sem reserva</Pill>}</Td>}
              {cols.bl&&<Td style={{ color:C.sub }}>{fmtDate(p.bl)}</Td>}
              {cols.pgm&&<Td style={{ color:C.sub }}>{fmtDate(p.pgm)}</Td>}
              {cols.diasPgm&&<Td><DaysBadge days={daysDiff(p.pgm)}/></Td>}
              {cols.docs&&<Td style={{ minWidth:100 }}><DocChecklist docs={p.docs||{}} compact/></Td>}
              {cols.status&&<Td><Badge status={p.status}/></Td>}
              <Td><button onClick={e=>{e.stopPropagation();onEdit(p)}} style={{ background:"#f5f0e4", color:C.blue, border:"1px solid #dfcfaa", borderRadius:5, padding:"4px 10px", fontSize:11, fontWeight:600, cursor:"pointer" }}>Abrir</button></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const entrar = async () => {
    setErro(""); setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      if(error) setErro(error.status === 400 ? "E-mail ou senha incorretos." : "Não foi possível entrar. Verifique a conexão e tente novamente.");
    } catch { setErro("Falha de conexão. Tente novamente."); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-shell" style={{ minHeight:"100vh", background:"#f5f5ef", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter','Segoe UI',sans-serif" }}>
      <div className="login-card" style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16, padding:"40px 36px", width:"100%", maxWidth:380, boxShadow:"0 4px 24px rgba(0,0,0,.07)" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <img className="login-logo" src={brandLogo} alt="Resinas Jardim"/>
          <div style={{ fontSize:20, fontWeight:800, color:C.text }}>RJ & Alliance Exports</div>
          <div style={{ fontSize:13, color:C.muted, marginTop:4 }}>Controle de Exportação Marítima</div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:600, color:C.sub, display:"block", marginBottom:5 }}>E-MAIL</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com"
            style={{ width:"100%", boxSizing:"border-box", border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px", fontSize:14, fontFamily:"inherit", outline:"none" }}
            onKeyDown={e=>e.key==="Enter"&&entrar()}/>
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:12, fontWeight:600, color:C.sub, display:"block", marginBottom:5 }}>SENHA</label>
          <input type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder="••••••••"
            style={{ width:"100%", boxSizing:"border-box", border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px", fontSize:14, fontFamily:"inherit", outline:"none" }}
            onKeyDown={e=>e.key==="Enter"&&entrar()}/>
        </div>
        {erro && <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:7, padding:"9px 12px", fontSize:13, color:C.red, marginBottom:14 }}>{erro}</div>}
        <button onClick={entrar} disabled={loading} style={{ width:"100%", background:C.blue, color:"#fff", border:"none", borderRadius:8, padding:"11px", fontWeight:700, fontSize:14, cursor:"pointer" }}>
          {loading?"Entrando...":"Entrar"}
        </button>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [data, setData] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("Todos");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [cloudError, setCloudError] = useState("");
  const [synced, setSynced] = useState(null);
  const [recebFiltro, setRecebFiltro] = useState("todos");
  const navigate = (page, filter="todos", client="Todos") => {
    setBusca(""); setFiltroCliente(client); setFiltroStatus("Todos");
    setRecebFiltro(filter); setTab(page); window.scrollTo(0,0);
  };

  // Auth
  useEffect(()=>{
    supabase.auth.getSession().then(({data, error})=>{ if(error) console.error(error); setSession(data?.session ?? null); }).catch(console.error).finally(()=>setAuthLoading(false));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_,s)=>setSession(s));
    return ()=>subscription.unsubscribe();
  },[]);

  // Banco de dados como fonte oficial; nenhuma gravação local ou importação automática.
  const loadData = async (quiet=false) => {
    if(!quiet) setDbLoading(true);
    try {
      const {data:rows,error}=await supabase.from("processos").select("*").order("created_at");
      if(error) throw error;
      setData(rows || []); setCloudError(""); setSynced(new Date());
    } catch(e) { setCloudError("Não foi possível consultar a nuvem: "+e.message); }
    finally { if(!quiet) setDbLoading(false); }
  };
  useEffect(()=>{
    if(!session?.user?.id) { setData([]); setSynced(null); return; }
    loadData();
    const refresh=()=>loadData(true);
    const timer=window.setInterval(refresh,30000);
    window.addEventListener("focus",refresh);
    return ()=>{window.clearInterval(timer);window.removeEventListener("focus",refresh);};
  },[session?.user?.id]);

  const saveProcesso = async (proc) => {
    if(!proc.proforma?.trim() || !proc.cliente?.trim()) { alert("Informe a proforma e o cliente."); return; }
    setSaving(true);
    try {
      const {id,created_at,...rest}=proc;
      const payload={...rest,docs:{...docsIniciais(proc.produto),...proc.docs}};
      const result=id ? await supabase.from("processos").update({...payload,updated_at:new Date().toISOString()}).eq("id",id).select().single() : await supabase.from("processos").insert(payload).select().single();
      if(result.error || !result.data) throw result.error || new Error("Gravação não confirmada");
      setData(d=>id?d.map(p=>p.id===id?result.data:p):[...d,result.data]);
      setSynced(new Date()); setCloudError(""); setModal(null);
      await loadData(true);
    } catch(e) { setCloudError("Falha ao salvar: "+e.message); alert("Dados não salvos. O formulário foi mantido. "+e.message); }
    finally { setSaving(false); }
  };

  const logout = () => supabase.auth.signOut();

  // Derivados
  const semRes    = data.filter(semReserva);
  const semDocs   = data.filter(p=>p.status!=="PAGO"&&docsIncompletos(p));
  const vencidos  = data.filter(p=>p.pgm&&p.status!=="PAGO"&&daysDiff(p.pgm)<0);
  const mesAtual  = data.filter(p=>{ if(!p.pgm||p.status==="PAGO") return false; const d=new Date(p.pgm+"T12:00:00"); return d.getMonth()===TODAY.getMonth()&&d.getFullYear()===TODAY.getFullYear(); });
  const totalPend = data.filter(p=>p.status!=="PAGO").reduce((a,p)=>a+Number(p.valor||0),0);
  const totalVenc = vencidos.reduce((a,p)=>a+Number(p.valor||0),0);
  const totalMes  = mesAtual.reduce((a,p)=>a+Number(p.valor||0),0);
  const totalGeral= data.reduce((a,p)=>a+Number(p.valor||0),0);
  const clientes  = useMemo(()=>["Todos",...Array.from(new Set(data.map(p=>p.cliente))).sort()],[data]);
  const listaFilt = useMemo(()=>data.filter(p=>{
    const q=busca.toLowerCase();
    return (filtroCliente==="Todos"||p.cliente===filtroCliente)&&(filtroStatus==="Todos"||p.status===filtroStatus)&&(!busca||p.proforma?.toLowerCase().includes(q)||p.cliente?.toLowerCase().includes(q)||p.produto?.toLowerCase().includes(q));
  }),[data,busca,filtroCliente,filtroStatus]);

  const emptyProc = { empresa:"RJ", proforma:"", cliente:"", produto:"", qtd:0, valor:0, carg:null, bl:null, prazo:45, termos:"DIAS DO BL", pgm:null, status:"PENDENTE", prontidao:null, incoterm:"FOB", destino:"", obs_prazo:"", obs:"", docs:{} };

  const TABS = [
    {id:"dashboard",label:"Painel Geral"},
    {id:"booking",label:"Booking Pendente",alert:semRes.length},
    {id:"docs",label:"Docs Pendentes",alert:semDocs.length},
    {id:"recebimentos",label:"Recebimentos"},
    {id:"todos",label:"Todos os Processos"},
  ];

  if(authLoading) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Inter,sans-serif", color:C.muted }}>Carregando...</div>;
  if(!session) return <Login onLogin={()=>{}}/>;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Inter','Segoe UI',sans-serif", color:C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>

      {/* TOPBAR */}
      <div className="topbar">
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <img className="brand-logo" src={brandLogo} alt="Resinas Jardim"/>
          <div>
            <div style={{ fontWeight:800, fontSize:15, color:C.text }}>RJ & Alliance Exports</div>
            <div style={{ fontSize:11, color:C.muted }}>Controle de Exportação Marítima · {session.user.email}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>setModal(emptyProc)} style={{ background:C.blue, color:"#fff", border:"none", borderRadius:7, padding:"7px 16px", fontWeight:700, fontSize:13, cursor:"pointer" }}>+ Novo Processo</button>
          <button onClick={logout} style={{ background:"#eff0e9", color:C.sub, border:`1px solid ${C.border}`, borderRadius:7, padding:"7px 14px", fontWeight:600, fontSize:13, cursor:"pointer" }}>Sair</button>
        </div>
      </div>

      {/* TABS */}
      <div className="nav-bar">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>navigate(t.id)} style={{ background:"none", border:"none", borderBottom:`2px solid ${tab===t.id?C.blue:"transparent"}`, color:tab===t.id?C.blue:C.sub, padding:"12px 14px", fontSize:13, fontWeight:tab===t.id?700:500, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap" }}>
            {t.label}{t.alert>0&&<span style={{ background:"#fef2f2", color:C.red, border:"1px solid #fecaca", borderRadius:20, padding:"0 6px", fontSize:10, fontWeight:700 }}>{t.alert}</span>}
          </button>
        ))}
      </div>

      <div className="cloud-bar"><span role="status">{cloudError ? cloudError : synced ? `Nuvem conectada · última consulta ${synced.toLocaleTimeString("pt-BR")}` : "Conectando à nuvem…"}</span><button onClick={()=>loadData()}>Atualizar dados</button></div>
      {dbLoading && <div style={{ textAlign:"center", padding:40, color:C.muted }}>Carregando dados...</div>}

      {!dbLoading && (
        <main className="workspace">

          {/* DASHBOARD */}
          {tab==="dashboard" && (
            <div>
              <div style={{ marginBottom:20 }}>
                <h2 style={{ margin:0, fontSize:17, fontWeight:800, color:C.text }}>Painel Geral</h2>
                <p style={{ margin:"4px 0 0", fontSize:13, color:C.sub }}>Visão consolidada de todos os processos</p>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:22 }}>
                <KpiCard icon="📦" label="Total Processos" onClick={()=>navigate("todos","todos")} value={data.length} sub={`${data.filter(p=>p.status==="PAGO").length} pagos`}/>
                <KpiCard icon="💵" label="Volume Total" onClick={()=>navigate("todos","todos")} value={fmtUSD(totalGeral)} sub="todos os processos"/>
                <KpiCard icon="⏳" label="A Receber" onClick={()=>navigate("recebimentos","pendentes")} value={fmtUSD(totalPend)} sub={`${data.filter(p=>p.status!=="PAGO").length} processos`} color="amber"/>
                <KpiCard icon="📅" label="Receber este Mês" onClick={()=>navigate("recebimentos","mes")} value={fmtUSD(totalMes)} sub={`${mesAtual.length} vencimentos`} color="green"/>
                <KpiCard icon="🚨" label="Vencidos" onClick={()=>navigate("recebimentos","vencidos")} value={fmtUSD(totalVenc)} sub={`${vencidos.length} processos`} color={totalVenc>0?"red":"green"}/>
                <KpiCard icon="🚢" label="Sem Booking" onClick={()=>navigate("booking","todos")} value={semRes.length} sub="pendentes de reserva" color={semRes.length>0?"red":"green"}/>
                <KpiCard icon="📄" label="Docs Incompletos" onClick={()=>navigate("docs","todos")} value={semDocs.length} sub="com pendência" color={semDocs.length>0?"amber":"green"}/>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,340px),1fr))", gap:18, marginBottom:18 }}>
                {[
                  { title:"🚢 Booking Pendente", items:semRes, tabKey:"booking", val:(p)=>fmtUSD(p.valor), sub:(p)=>p.cliente },
                  { title:"💰 Recebimentos do Mês", items:mesAtual, tabKey:"recebimentos", filter:"mes", val:(p)=>fmtUSD(p.valor), sub:(p)=><DaysBadge days={daysDiff(p.pgm)}/> },
                  { title:"📄 Docs Pendentes", items:semDocs, tabKey:"docs", val:(p)=>{ const miss=Object.entries(p.docs||{}).filter(([,v])=>!v).map(([k])=>LABEL_DOC[k]); return <span style={{ fontSize:11, color:C.orange }}>{miss.slice(0,2).join(" · ")}{miss.length>2?"...":""}</span>; }, sub:(p)=>p.cliente },
                  { title:"🔴 Pagamentos Vencidos", items:vencidos, tabKey:"recebimentos", filter:"vencidos", val:(p)=>fmtUSD(p.valor), sub:(p)=><DaysBadge days={daysDiff(p.pgm)}/>, alertColor:totalVenc>0?"red":"green" },
                ].map(card=>(
                  <div key={card.title} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 20px", borderTop:`3px solid ${card.alertColor===("red")?C.red:card.alertColor===("green")?C.green:C.border}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                      <button className="plain-link" onClick={()=>navigate(card.tabKey,card.filter)}>{card.title}</button>
                      <button onClick={()=>navigate(card.tabKey,card.filter)} style={{ background:"none", border:"none", color:C.blue, fontSize:12, cursor:"pointer", fontWeight:600 }}>Ver todos →</button>
                    </div>
                    {card.items.slice(0,4).map(p=>(
                      <div key={p.id} onClick={()=>setModal(p)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid #eff0e9", cursor:"pointer" }}>
                        <div><span style={{ fontSize:12, fontWeight:700, color:C.blue }}>{p.proforma}</span><span style={{ fontSize:12, color:C.sub, marginLeft:8 }}>{p.cliente}</span></div>
                        <div style={{ textAlign:"right", fontSize:12 }}>{card.val(p)}</div>
                      </div>
                    ))}
                    {card.items.length===0 && <div style={{ textAlign:"center", color:C.muted, fontSize:12, padding:16 }}>✅ Tudo em dia!</div>}
                  </div>
                ))}
              </div>
              <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 20px" }}>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>📊 Volume por Cliente</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))", gap:10 }}>
                  {Object.entries(data.reduce((a,p)=>{a[p.cliente]=(a[p.cliente]||0)+Number(p.valor||0);return a},{})).sort((a,b)=>b[1]-a[1]).map(([cli,val])=>(
                    <button className="client-card" key={cli} onClick={()=>navigate("todos","todos",cli)}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                        <span style={{ fontSize:12, fontWeight:700 }}>{cli}</span>
                        <span style={{ fontSize:12, fontWeight:700, color:C.green }}>{fmtUSD(val)}</span>
                      </div>
                      <div style={{ height:4, background:C.border, borderRadius:4 }}>
                        <div style={{ height:"100%", width:`${(totalGeral?Number(val)/totalGeral*100:0)}%`, background:C.blue, borderRadius:4 }}/>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* BOOKING */}
          {tab==="booking" && (
            <div>
              <h2 style={{ margin:"0 0 8px", fontSize:17, fontWeight:800 }}>Processos Pendentes de Booking</h2>
              {semRes.length>0 && <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:9, padding:"11px 16px", marginBottom:16, fontSize:13, color:C.red, fontWeight:600 }}>⚠️ {semRes.length} processo{semRes.length>1?"s":""} sem reserva · {fmtUSD(semRes.reduce((a,p)=>a+Number(p.valor||0),0))} em aberto</div>}
              <Tabela rows={semRes} onEdit={setModal} cols={{ prontidao:true, carg:true, docs:true }}/>
            </div>
          )}

          {/* DOCS */}
          {tab==="docs" && (
            <div>
              <h2 style={{ margin:"0 0 16px", fontSize:17, fontWeight:800 }}>Documentos Pendentes</h2>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {semDocs.map(p=>{
                  const miss=Object.entries(p.docs||{}).filter(([,v])=>!v).map(([k])=>LABEL_DOC[k]);
                  const done=Object.entries(p.docs||{}).filter(([,v])=>v).map(([k])=>LABEL_DOC[k]);
                  return (
                    <div key={p.id} onClick={()=>setModal(p)} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 20px", cursor:"pointer" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10, flexWrap:"wrap", gap:8 }}>
                        <div><span style={{ color:C.blue, fontWeight:700 }}>{p.proforma}</span><span style={{ color:C.sub, marginLeft:10 }}>{p.cliente}</span><span style={{ color:C.muted, marginLeft:8, fontSize:12 }}>{p.produto}</span></div>
                        <div style={{ display:"flex", gap:8, alignItems:"center" }}><span style={{ fontWeight:700, color:C.green }}>{fmtUSD(p.valor)}</span><Badge status={p.status}/></div>
                      </div>
                      <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:10 }}>
                        {miss.length>0 && <div><div style={{ fontSize:10, fontWeight:700, color:C.red, textTransform:"uppercase", letterSpacing:.8, marginBottom:4 }}>⚠ Pendente</div><div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>{miss.map(m=><Pill key={m} color="red">{m}</Pill>)}</div></div>}
                        {done.length>0 && <div><div style={{ fontSize:10, fontWeight:700, color:C.green, textTransform:"uppercase", letterSpacing:.8, marginBottom:4 }}>✓ Emitido</div><div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>{done.map(d=><Pill key={d} color="green">{d}</Pill>)}</div></div>}
                      </div>
                      <DocChecklist docs={p.docs||{}} compact/>
                    </div>
                  );
                })}
                {semDocs.length===0 && <div style={{ textAlign:"center", padding:60, color:C.muted }}>✅ Todos os documentos em dia!</div>}
              </div>
            </div>
          )}

          {/* RECEBIMENTOS */}
          {tab==="recebimentos" && (
            <div>
              <h2>Controle de Recebimentos</h2><div className="filter-bar">{[["todos","Visão completa"],["vencidos","Vencidos"],["mes","Este mês"],["pendentes","Todos a receber"]].map(([id,label])=><button key={id} className={recebFiltro===id?"active":""} onClick={()=>setRecebFiltro(id)}>{label}</button>)}</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:14, marginBottom:22 }}>
                <KpiCard icon="🔴" label="Vencidos" onClick={()=>navigate("recebimentos","vencidos")} value={fmtUSD(totalVenc)} sub={`${vencidos.length} processos`} color={totalVenc>0?"red":"green"}/>
                <KpiCard icon="📅" label="A receber no mês" onClick={()=>navigate("recebimentos","mes")} value={fmtUSD(totalMes)} sub={`${mesAtual.length} processos`} color="amber"/>
                <KpiCard icon="⏳" label="Total a receber" onClick={()=>navigate("recebimentos","pendentes")} value={fmtUSD(totalPend)} sub={`${data.filter(p=>p.status!=="PAGO").length} processos`}/>
              </div>
              {(recebFiltro==="todos"||recebFiltro==="vencidos") && <div style={{ marginBottom:24 }}><div style={{ fontWeight:700, color:C.red, fontSize:14, marginBottom:10 }}>🔴 Vencidos</div><Tabela rows={vencidos} onEdit={setModal} cols={{ pgm:true, diasPgm:true, status:true }}/></div>}
              {(recebFiltro==="todos"||recebFiltro==="mes") && <div style={{ marginBottom:24 }}><div style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>📅 A receber em {TODAY.toLocaleString("pt-BR",{month:"long",year:"numeric"})}</div><Tabela rows={mesAtual.sort((a,b)=>new Date(a.pgm)-new Date(b.pgm))} onEdit={setModal} cols={{ pgm:true, diasPgm:true, status:true }}/></div>}
              {(recebFiltro==="todos"||recebFiltro==="pendentes") && <div><div style={{ fontWeight:700, color:C.sub, fontSize:14, marginBottom:10 }}>📋 Todos os Pendentes</div><Tabela rows={data.filter(p=>p.status!=="PAGO").sort((a,b)=>new Date(a.pgm||"9999")-new Date(b.pgm||"9999"))} onEdit={setModal} cols={{ pgm:true, diasPgm:true, status:true }}/></div>}
            </div>
          )}

          {/* TODOS */}
          {tab==="todos" && (
            <div>
              <h2 style={{ margin:"0 0 16px", fontSize:17, fontWeight:800 }}>Todos os Processos</h2>
              <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
                <input placeholder="🔍 Proforma, cliente ou produto..." value={busca} onChange={e=>setBusca(e.target.value)} style={{ border:`1px solid ${C.border}`, borderRadius:7, padding:"7px 12px", fontSize:13, flex:1, minWidth:200, fontFamily:"inherit", outline:"none" }}/>
                <select value={filtroCliente} onChange={e=>setFiltroCliente(e.target.value)} style={{ border:`1px solid ${C.border}`, borderRadius:7, padding:"7px 12px", fontSize:13, fontFamily:"inherit", background:C.white }}>{clientes.map(c=><option key={c}>{c}</option>)}</select>
                <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)} style={{ border:`1px solid ${C.border}`, borderRadius:7, padding:"7px 12px", fontSize:13, fontFamily:"inherit", background:C.white }}><option value="Todos">Todos os status</option>{STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}</select>
              </div>
              <Tabela rows={listaFilt} onEdit={setModal} cols={{ prontidao:true, carg:true, bl:true, pgm:true, docs:true, status:true }}/>
              <div style={{ marginTop:10, fontSize:11, color:C.muted, textAlign:"right" }}>{listaFilt.length} de {data.length} · {fmtUSD(listaFilt.reduce((a,p)=>a+Number(p.valor||0),0))}</div>
            </div>
          )}
        </main>
      )}

      {modal && <ProcessoModal proc={modal} onClose={()=>setModal(null)} onSave={saveProcesso} loading={saving}/>}
    </div>
  );
}
