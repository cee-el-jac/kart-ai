// OCRScan.jsx — v3.8
// Shows confidence for text & digits; robust flyer ROI; 3-pass digits OCR; gas normalization;
// safer price fuse (avoid ".99" when only cents are detected).
import React, { useRef, useState } from "react";
import Tesseract from "tesseract.js";

/* ---------- tiny canvas helpers ---------- */
function makeCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
function toImg(url){return new Promise((res,rej)=>{const i=new Image();i.crossOrigin="anonymous";i.onload=()=>res(i);i.onerror=rej;i.src=url;});}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

/* grayscale + contrast + gamma */
function preprocess(ctx,w,h,{contrast=1.0,gamma=1.0}={}) {
  const im=ctx.getImageData(0,0,w,h), d=im.data, c=contrast, g=gamma;
  for(let i=0;i<d.length;i+=4){let y=0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]; y=(y-128)*c+128; y=255*Math.pow(clamp(y,0,255)/255,1/g); d[i]=d[i+1]=d[i+2]=y;}
  ctx.putImageData(im,0,0);
}
/* light adaptive threshold */
function adaptiveThreshold(ctx,w,h,tile=32,offset=8){
  const im=ctx.getImageData(0,0,w,h), d=im.data, tw=Math.ceil(w/tile), th=Math.ceil(h/tile);
  const sums=new Array(tw*th).fill(0), cnt=new Array(tw*th).fill(0);
  for(let y=0;y<h;y++){const ty=(y/tile)|0;for(let x=0;x<w;x++){const tx=(x/tile)|0,k=ty*tw+tx,i=(y*w+x)*4; sums[k]+=d[i]; cnt[k]++;}}
  for(let y=0;y<h;y++){const ty=(y/tile)|0;for(let x=0;x<w;x++){const tx=(x/tile)|0,k=ty*tw+tx,i=(y*w+x)*4; const m=sums[k]/cnt[k]; const v=d[i]<(m-offset)?0:255; d[i]=d[i+1]=d[i+2]=v;}}
  ctx.putImageData(im,0,0);
}

/* flyer ROI: right-half dense dark region */
function flyerDigitsROI(src){
  const w=src.width,h=src.height; const [c,ctx]=makeCanvas(w,h);
  ctx.drawImage(src,0,0); preprocess(ctx,w,h,{contrast:1.35,gamma:1.1}); adaptiveThreshold(ctx,w,h,24,6);
  const xStart=(w*0.45)|0; const img=ctx.getImageData(0,0,w,h).data;
  let best={score:-1,x:xStart,y:0,rw:(w*0.5)|0,rh:(h*0.7)|0};
  for(let y0=(h*0.05)|0;y0<(h*0.5)|0;y0+=6){
    for(let h0=(h*0.35)|0;h0<(h*0.85)|0;h0+=12){
      const x0=xStart,w0=(w*0.5)|0; let dark=0,tot=0;
      for(let y=y0;y<Math.min(h,y0+h0);y+=3){for(let x=x0;x<Math.min(w,x0+w0);x+=3){const i=(y*w+x)*4; tot++; if(img[i]<40) dark++;}}
      const density=dark/Math.max(1,tot); const score=density*(w0*h0);
      if(score>best.score) best={score,x:x0,y:y0,rw:w0,rh:h0};
    }
  }
  return best;
}

/* parse helpers */
function priceFromText(txt){const m=txt.match(/(?:\$|C\$)?\s*(\d{1,4}(?:[.,]\d{2})?)/); return m?Number(m[1].replace(",",".")):null;}
function parseMulti(txt){const m=txt.replace(",",".").match(/(\d+)\s*(?:for|\/|pour)\s*\$?\s*(\d+(?:\.\d{2})?)/i); if(!m) return null; const qty=+m[1], total=+m[2]; return (qty&&isFinite(total))?{qty,total,perUnit:+(total/qty).toFixed(4)}:null;}
function avgWordConf(res){try{const words=res.data.words||[]; if(!words.length) return null; const a=words.reduce((s,w)=>s+(w.confidence??0),0)/words.length; return Math.round(a);}catch{ return null; }}

/* main */
export default function OCRScan({ onSuggest }) {
  const [status,setStatus]=useState(""); const [out,setOut]=useState(""); const [imgUrl,setImgUrl]=useState("");
  const [mode,setMode]=useState("flyer"); const [debug,setDebug]=useState(true); const [roiPreview,setRoiPreview]=useState(null);
  const fileRef=useRef(null); const pick=()=>fileRef.current?.click();

  async function onFile(e){const f=e.target.files?.[0]; if(!f) return; const url=URL.createObjectURL(f); setImgUrl(url); await run(url);}
  async function run(url){
    setStatus("Working…"); setOut(""); setRoiPreview(null);
    try{
      const img=await toImg(url);
      const [base,bctx]=makeCanvas(img.naturalWidth||img.width,img.naturalHeight||img.height); bctx.drawImage(img,0,0,base.width,base.height);
      const SCALE=Math.min(1,1200/Math.max(base.width,base.height));
      const [small,sctx]=makeCanvas((base.width*SCALE)|0,(base.height*SCALE)|0); sctx.drawImage(base,0,0,small.width,small.height);

      // 1) full text (eng+fra)
      const fullRes=await Tesseract.recognize(small,"eng+fra",{tessedit_pageseg_mode:Tesseract.PSM.AUTO});
      const textConf=Math.round(fullRes.data.confidence??0);
      const fullText=(fullRes.data.text||"").replace(/\u00A0/g," ").trim();

      // 2) ROI (mode-specific)
      let roiRect;
      if(mode==="flyer"){ roiRect=flyerDigitsROI(base); }
      else{ const x=(base.width*0.52)|0, y=(base.height*0.18)|0, rw=(base.width*0.42)|0, rh=(base.height*0.65)|0; roiRect={x,y,rw,rh}; }
      const [roi,roictx]=makeCanvas(roiRect.rw,roiRect.rh); roictx.drawImage(base,roiRect.x,roiRect.y,roiRect.rw,roiRect.rh,0,0,roiRect.rw,roiRect.rh);
      if(mode==="gas"){ preprocess(roictx,roi.width,roi.height,{contrast:1.45,gamma:1.25}); }
      if(debug) setRoiPreview(roi.toDataURL());

      const cfg={tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:"0123456789.$"};
      // A) raw
      let roiResA=await Tesseract.recognize(roi,"eng",cfg); let digitsText=roiResA.data.text||""; let digitsConf=avgWordConf(roiResA);
      // B) adaptive if needed
      if(!/\d/.test(digitsText)){
        const [r2,c2]=makeCanvas(roi.width,roi.height); c2.drawImage(roi,0,0); adaptiveThreshold(c2,roi.width,roi.height,24,6);
        const r=await Tesseract.recognize(r2,"eng",cfg); if((avgWordConf(r)||0)>(digitsConf||0)){digitsText=r.data.text||digitsText; digitsConf=avgWordConf(r);}
      }
      // C) high contrast if still weak
      if(!/\d/.test(digitsText)){
        const [r3,c3]=makeCanvas(roi.width,roi.height); c3.drawImage(roi,0,0); preprocess(c3,roi.width,roi.height,{contrast:1.6,gamma:1.15});
        const r=await Tesseract.recognize(r3,"eng",cfg); if((avgWordConf(r)||0)>(digitsConf||0)){digitsText=r.data.text||digitsText; digitsConf=avgWordConf(r);}
      }
      digitsConf = digitsConf==null ? 0 : Math.max(0, Math.min(100, Math.round(digitsConf)));

      // normalize digits like 7.99 from "799"
      let priceFromDigits=null;
      const raw=digitsText.replace(/\s/g,"");
      const m = raw.match(/(\d{1,4})(?:[.,]?)(\d{2})/); // prefer 1–4 + 2 digits
      if(m){
        const int=m[1], cents=m[2];
        if(int.length>=1){ priceFromDigits = Number(`${int.slice(0,-2)||int}.${cents}`); }
      }
      // if we only saw 2 digits total (e.g., "99"), treat as weak and ignore to avoid ".99"
      if(!m && /^\d{2}$/.test(raw)) priceFromDigits=null;

      // 3) fuse with full text + multi
      const multi=parseMulti(fullText);
      const priceTxt=priceFromText(fullText);
      let fused=null;
      if(multi) fused=multi.perUnit;
      else if(priceFromDigits!=null && isFinite(priceFromDigits)) fused=priceFromDigits;
      else if(priceTxt!=null && isFinite(priceTxt)) fused=priceTxt;

      setStatus(`Done. OCR OK (text ${textConf}% · digits ${digitsConf}%)`);
      setOut([
        "— Text pass (full) —",
        fullText || "(none)",
        "\n— Digits pass (ROI) —",
        (digitsText && digitsText.trim()) || "(none)",
        "\n— Final price (auto-fused) —",
        fused!=null ? String(fused) : "(none)"
      ].join("\n"));

      if(onSuggest){
        onSuggest({
          type: mode==="gas" ? "gas" : "grocery",
          item:"", store:"", station:"",
          location:"",
          unit: mode==="gas" ? "/L" : "/ea",
          price: multi ? multi.perUnit : (fused ?? 0),
          normalizedPerKg:null, normalizedPerL:null,
          originalMultiBuy: multi || null,
        });
      }
    }catch(err){ console.error(err); setStatus("OCR failed"); }
  }

  return (
    <div style={{border:"1px solid #e5e7eb",borderRadius:12,padding:12}}>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
        <button onClick={()=>fileRef.current?.click()} style={{padding:"8px 12px",borderRadius:10,border:"1px solid #d1d5db"}}>Scan from image</button>
        <select value={mode} onChange={(e)=>setMode(e.target.value)} style={{padding:8,borderRadius:10,border:"1px solid #d1d5db"}}>
          <option value="flyer">Flyer / Shelf tag</option><option value="gas">Gas sign</option>
        </select>
        <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12}}>
          <input type="checkbox" checked={debug} onChange={(e)=>setDebug(e.target.checked)} /> Debug
        </label>
        <span style={{fontSize:12,color:"#6b7280"}}>Supports ENG/FRA; multi-buy; tuned ROI; auto-normalizes cents; shows pass confidences.</span>
      </div>
      <input type="file" accept="image/*" ref={fileRef} onChange={onFile} style={{display:"none"}} />
      {imgUrl && (
        <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
          <img src={imgUrl} alt="Selected" style={{width:200,height:"auto",borderRadius:8,border:"1px solid #e5e7eb"}}/>
          <textarea readOnly value={`${status}\n\n${out}`} style={{flex:1,minHeight:230,padding:8,borderRadius:8,border:"1px solid #e5e7eb",fontFamily:"ui-monospace,Menlo,monospace",fontSize:12}}/>
        </div>
      )}
      {debug && roiPreview && (
        <div style={{marginTop:8}}>
          <div style={{fontSize:12,color:"#6b7280",marginBottom:4}}>ROI preview</div>
          <img src={roiPreview} alt="ROI" style={{width:180,border:"1px solid #e5e7eb",borderRadius:6}}/>
        </div>
      )}
    </div>
  );
} 