// @ts-nocheck
'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as opentype from "opentype.js";
import ClipperLib from "clipper-lib";

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULTS = {
  name:         "KAEL",
  fullName:     "Kael Doniel S.",
  gradeSection: "Grade 7 - Rizal",

  nameFont:         "Bhineka:style=Regular",
  subFont:          "Bhineka:style=Regular",

  nameCapHeight:    14.0,
  subCapHeight:     7.0,
  textHeight:       3.0,

  baseHeight:       2.0,
  padding:          3.5,
  rowGap:           3.0,

  // Tab (rectangular, top-center)
  tabWidth:         18.0,
  tabHeight:        10.0,
  tabThickness:     2.0,   // extra height above border
  holeWidth:        10.0,
  holeHeight:       4.5,
  tabCornerRadius:  2.5,

  // Colors — now three independent values
  baseColor:        "#f0ece4",   // white/cream base plate
  borderColor:      "#60a5fa",   // blue border ring
  textColor:        "#1d4ed8",   // all text same color
};

const FONT_URLS = {
  "Pacifico:style=Regular":      "/fonts/Pacifico-Regular.ttf",
  "Lobster:style=Regular":       "/fonts/Lobster-Regular.ttf",
  "Titan One:style=Regular":     "/fonts/TitanOne-Regular.ttf",
  "Luckiest Guy:style=Regular":  "/fonts/LuckiestGuy-Regular.ttf",
  "Bhineka:style=Regular":       "/fonts/Bhineka-Regular.ttf",
  "Pheonies:style=Regular":      "/fonts/Pheonies.otf",
  "Freedom:style=Regular":       "/fonts/Freedom-10eM.ttf",
  "Baby Plums:style=Regular":    "/fonts/BabyPlums-rv2gL.ttf",
  "Short Baby:style=Regular":    "/fonts/ShortBaby-Mg2w.ttf",
  "Cabal Bold:style=Regular":    "/fonts/CabalBold-78yP.ttf",
  "Pixel Letters:style=Regular": "/fonts/Pixellettersfull-BnJ5.ttf",
  "Hearty Geelyn:style=Regular": "/fonts/HeartyGeelynEditsAirbrush-ze23.ttf",
};

const LIGHT = {
  bg: "#f0f4ff", surface: "#ffffff", border: "#dce6ff", text: "#1e3a5f",
  muted: "#6b8ab5", accent: "#3b82f6", accent2: "#60a5fa", trackBg: "#dce6ff",
  pill: "#e0eaff", pillText: "#2563eb", inputBg: "#f8faff", inputBorder: "#c7d8f5",
  sceneBg: 0xd6e4f7, shadow: "#3b82f628",
  blob1: "#bfdbfe38", blob2: "#dbeafe38",
};
const DARK = {
  bg: "#0f1827", surface: "#131f30", border: "#1e3048", text: "#d4e6f8",
  muted: "#4a7aaa", accent: "#3b82f6", accent2: "#60a5fa", trackBg: "#1e3048",
  pill: "#1e3a5f", pillText: "#60a5fa", inputBg: "#0d1a2a", inputBorder: "#1e3a5f",
  sceneBg: 0x0c1625, shadow: "#3b82f618",
  blob1: "#3b82f612", blob2: "#60a5fa12",
};

// ── Geometry helpers ──────────────────────────────────────────────────────────
function signedAreaVec2(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return a / 2;
}
function signedArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    a += poly[i][0] * poly[j][1] - poly[j][0] * poly[i][1];
  }
  return a / 2;
}
function pointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if (((yi > pt.y) !== (yj > pt.y)) && pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function opentypePathToContours(otPath, yFlip = true) {
  const contours = []; let current = null;
  const flip = yFlip ? -1 : 1;
  for (const cmd of otPath.commands) {
    if (cmd.type === "M") {
      if (current && current.length >= 3) contours.push(current);
      current = [new THREE.Vector2(cmd.x, flip * cmd.y)];
    } else if (cmd.type === "L") {
      current?.push(new THREE.Vector2(cmd.x, flip * cmd.y));
    } else if (cmd.type === "C") {
      if (current) {
        const p0 = current[current.length - 1];
        const p1 = new THREE.Vector2(cmd.x1, flip * cmd.y1);
        const p2 = new THREE.Vector2(cmd.x2, flip * cmd.y2);
        const p3 = new THREE.Vector2(cmd.x,  flip * cmd.y);
        for (let s = 1; s <= 12; s++) {
          const t = s / 12, mt = 1 - t;
          current.push(new THREE.Vector2(
            mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x,
            mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y,
          ));
        }
      }
    } else if (cmd.type === "Q") {
      if (current) {
        const p0 = current[current.length - 1];
        const p1 = new THREE.Vector2(cmd.x1, flip * cmd.y1);
        const p2 = new THREE.Vector2(cmd.x,  flip * cmd.y);
        for (let s = 1; s <= 10; s++) {
          const t = s / 10, mt = 1 - t;
          current.push(new THREE.Vector2(
            mt*mt*p0.x + 2*mt*t*p1.x + t*t*p2.x,
            mt*mt*p0.y + 2*mt*t*p1.y + t*t*p2.y,
          ));
        }
      }
    } else if (cmd.type === "Z") {
      if (current && current.length >= 3) { contours.push(current); current = null; }
    }
  }
  if (current && current.length >= 3) contours.push(current);
  return contours;
}

function opentypePathToThreeShapes(otPath) {
  const contours = opentypePathToContours(otPath, true);
  const outers = [], holes = [];
  for (const pts of contours) {
    (signedAreaVec2(pts) > 0 ? outers : holes).push(pts);
  }
  if (outers.length === 0 && holes.length > 0) {
    holes.sort((a, b) => Math.abs(signedAreaVec2(b)) - Math.abs(signedAreaVec2(a)));
    outers.push(holes.shift());
  }
  return outers.map(outerPts => {
    const shape = new THREE.Shape(outerPts);
    for (const holePts of holes)
      if (pointInPolygon(holePts[0], outerPts)) shape.holes.push(new THREE.Path(holePts));
    return shape;
  });
}

function svgShapesToThreeShapes(svgPaths) {
  return svgPaths.flatMap(path =>
    path.toShapes(true).map(shape => {
      const pts = shape.getPoints().map(p => new THREE.Vector2(p.x, -p.y));
      const ns = new THREE.Shape(pts);
      for (const hole of shape.holes)
        ns.holes.push(new THREE.Path(hole.getPoints().map(p => new THREE.Vector2(p.x, -p.y))));
      return ns;
    })
  );
}

// ── Rounded rectangle Shape builder ──────────────────────────────────────────
function roundedRectShape(w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo( w / 2 - r, -h / 2);
  s.quadraticCurveTo( w / 2, -h / 2,  w / 2, -h / 2 + r);
  s.lineTo( w / 2,  h / 2 - r);
  s.quadraticCurveTo( w / 2,  h / 2,  w / 2 - r,  h / 2);
  s.lineTo(-w / 2 + r,  h / 2);
  s.quadraticCurveTo(-w / 2,  h / 2, -w / 2,  h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

function roundedRectPath(w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  const p = new THREE.Path();
  p.moveTo(-w / 2 + r, -h / 2);
  p.lineTo( w / 2 - r, -h / 2);
  p.quadraticCurveTo( w / 2, -h / 2,  w / 2, -h / 2 + r);
  p.lineTo( w / 2,  h / 2 - r);
  p.quadraticCurveTo( w / 2,  h / 2,  w / 2 - r,  h / 2);
  p.lineTo(-w / 2 + r,  h / 2);
  p.quadraticCurveTo(-w / 2,  h / 2, -w / 2,  h / 2 - r);
  p.lineTo(-w / 2, -h / 2 + r);
  p.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return p;
}

// ── Rectangular tab geometry (rounded rect outer, rounded rect hole) ──────────
function makeRectTabGeo(tabW, tabH, holeW, holeH, depth, cornerR = 2.5, segs = 12) {
  const outerR = cornerR;
  const holeR  = Math.min(cornerR * 0.8, holeW / 2, holeH / 2);
  const shape  = roundedRectShape(tabW, tabH, outerR);
  shape.holes.push(roundedRectPath(holeW, holeH, holeR));
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: segs });
}

// ── 3MF writer ────────────────────────────────────────────────────────────────
function buildZip(files) {
  const enc = new TextEncoder();
  const toU8 = s => (typeof s === "string" ? enc.encode(s) : s);
  function u16(n) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; }
  function u32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; }
  function crc32(data) {
    let c = 0xFFFFFFFF;
    const table = crc32.table || (crc32.table = (() => {
      const t = new Uint32Array(256);
      for (let i = 0; i < 256; i++) { let v = i; for (let j = 0; j < 8; j++) v = (v & 1) ? (0xEDB88320 ^ (v >>> 1)) : (v >>> 1); t[i] = v; }
      return t;
    })());
    for (let i = 0; i < data.length; i++) c = table[(c ^ data[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function concat(...arrays) {
    const out = new Uint8Array(arrays.reduce((s, a) => s + a.length, 0));
    let off = 0; for (const a of arrays) { out.set(a, off); off += a.length; } return out;
  }
  const localH = [], centralH = []; let offset = 0;
  for (const file of files) {
    const name = enc.encode(file.name), data = toU8(file.data), crc = crc32(data);
    const local = concat(new Uint8Array([0x50,0x4B,0x03,0x04]), u16(20),u16(0),u16(0),u16(0),u16(0x5765),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data);
    const central = concat(new Uint8Array([0x50,0x4B,0x01,0x02]),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0x5765),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name);
    localH.push(local); centralH.push(central); offset += local.length;
  }
  const cdOffset = offset, cdSize = centralH.reduce((s, h) => s + h.length, 0);
  const eocd = concat(new Uint8Array([0x50,0x4B,0x05,0x06]),u16(0),u16(0),u16(files.length),u16(files.length),u32(cdSize),u32(cdOffset),u16(0));
  return concat(...localH, ...centralH, eocd);
}

function build3MFZip(baseGeo, tabGeo, textGeos, baseHex, borderHex, textHex) {
  const norm = hex => hex.replace(/^#/, "").toUpperCase().padStart(6, "0");
  function meshXML(geo) {
    const flat = geo.toNonIndexed(), pos = flat.attributes.position, cnt = pos.count;
    const v = [], t = [];
    for (let i = 0; i < cnt; i++) v.push(`          <vertex x="${pos.getX(i).toFixed(6)}" y="${pos.getY(i).toFixed(6)}" z="${pos.getZ(i).toFixed(6)}" />`);
    for (let i = 0; i < cnt; i += 3) t.push(`          <triangle v1="${i}" v2="${i+1}" v3="${i+2}" />`);
    flat.dispose();
    return `        <vertices>\n${v.join("\n")}\n        </vertices>\n        <triangles>\n${t.join("\n")}\n        </triangles>`;
  }

  const baseMeshXml = meshXML(baseGeo);
  const tabMeshXml  = meshXML(tabGeo);
  const textMeshXmls = textGeos.map(g => meshXML(g));

  const textObjects = textMeshXmls.map((xml, i) => `    <object id="${5 + i}" name="text_${i}" type="model">\n      <mesh> ${xml}\n      </mesh>\n    </object>`).join("\n");
  const allIds = [2, 3, 4, ...textMeshXmls.map((_, i) => 5 + i)];

  const modelXML = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="2" name="base" type="model"><mesh> ${baseMeshXml}\n      </mesh></object>
    <object id="3" name="border" type="model"><mesh> ${meshXML(baseGeo)}\n      </mesh></object>
    <object id="4" name="tab" type="model"><mesh> ${tabMeshXml}\n      </mesh></object>
${textObjects}
    <object id="${allIds[allIds.length - 1] + 1}" name="keychain" type="model">
      <components>
        <component objectid="2" /><component objectid="3" /><component objectid="4" />
        ${textMeshXmls.map((_, i) => `<component objectid="${5 + i}" />`).join("")}
      </components>
    </object>
  </resources>
  <build><item objectid="${allIds[allIds.length - 1] + 1}" /></build>
</model>`;

  const modelSettings = `<?xml version="1.0" encoding="UTF-8"?><config>
  <object id="2"><metadata key="extruder" value="1" /><metadata key="name" value="base" /></object>
  <object id="3"><metadata key="extruder" value="2" /><metadata key="name" value="border" /></object>
  <object id="4"><metadata key="extruder" value="2" /><metadata key="name" value="tab" /></object>
  <object id="5"><metadata key="extruder" value="3" /><metadata key="name" value="text" /></object>
</config>`;

  const plateSettings = `<?xml version="1.0" encoding="UTF-8"?><config><plate>
  <metadata key="plater_id" value="1" />
  <filament id="1" color="#${norm(baseHex)}"   type="PLA" />
  <filament id="2" color="#${norm(borderHex)}" type="PLA" />
  <filament id="3" color="#${norm(textHex)}"   type="PLA" />
</plate></config>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" /><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" /><Default Extension="config" ContentType="application/xml" /></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" /></Relationships>`;

  return buildZip([
    { name: "[Content_Types].xml",            data: contentTypes },
    { name: "_rels/.rels",                    data: rels },
    { name: "3D/3dmodel.model",               data: modelXML },
    { name: "Metadata/model_settings.config", data: modelSettings },
    { name: "Metadata/plate_settings.config", data: plateSettings },
  ]);
}

// ── React helpers ─────────────────────────────────────────────────────────────
function useDebounce(v, d) {
  const [dv, setDv] = useState(v);
  useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}

function ResetBtn({ onClick, C }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      title="Reset to default"
      style={{ background: hov ? C.pill : "none", border: "none", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 11, color: hov ? C.accent : C.muted, transition: "all 0.15s", padding: 0, flexShrink: 0 }}>↺</button>
  );
}

function FieldLabel({ children, dirty, onReset, C }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 5 }}>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted }}>{children}</span>
      {dirty && <ResetBtn onClick={onReset} C={C} />}
    </div>
  );
}

function SliderRow({ label, value, min, max, step = 1, unit = "mm", onChange, defaultValue, C }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);
  const dirty = value !== defaultValue;
  const bipolar = min < 0 && max > 0;
  const zeroPct = (-min / (max - min)) * 100;
  const valPct  = ((value - min) / (max - min)) * 100;
  const fillLeft  = bipolar ? Math.min(zeroPct, valPct) : 0;
  const fillWidth = bipolar ? Math.abs(valPct - zeroPct) : valPct;
  function startEdit() { setDraft(String(value)); setEditing(true); setTimeout(() => inputRef.current?.select(), 0); }
  function commitEdit() {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) { const snapped = Math.round(parsed / step) * step; onChange(Math.min(max, Math.max(min, parseFloat(snapped.toFixed(10))))); }
    setEditing(false);
  }
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {editing ? (
            <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commitEdit}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitEdit(); } if (e.key === "Escape") setEditing(false); }}
              style={{ width: 62, fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.pillText, background: C.pill, border: "none", borderRadius: 20, padding: "2px 8px", outline: "none", textAlign: "right" }} />
          ) : (
            <span onClick={startEdit} style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: C.pillText, background: C.pill, borderRadius: 20, padding: "2px 8px", cursor: "text", userSelect: "none" }}>
              {bipolar && value > 0 ? `+${value}` : value}{unit}
            </span>
          )}
          {dirty && !editing && <ResetBtn onClick={() => onChange(defaultValue)} C={C} />}
        </div>
      </div>
      <div style={{ position: "relative", height: 18, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 4, background: C.trackBg, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: `${fillLeft}%`, width: `${fillWidth}%`, height: "100%", background: `linear-gradient(90deg,${C.accent},${C.accent2})`, borderRadius: 2 }} />
          {bipolar && <div style={{ position: "absolute", left: `${zeroPct}%`, top: 0, bottom: 0, width: 2, background: C.muted, transform: "translateX(-50%)", borderRadius: 1 }} />}
        </div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", margin: 0 }} />
      </div>
    </div>
  );
}

function SectionHeader({ label, C }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 10px" }}>
      <div style={{ flex: 1, height: 1, background: C.border }} />
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}

function ColorRow({ label, value, defaultValue, onChange, C }) {
  const dirty = value !== defaultValue;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 3 }}>{label}</div>
        <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: C.pillText }}>{value.toUpperCase()}</span>
      </div>
      {dirty && <ResetBtn onClick={() => onChange(defaultValue)} C={C} />}
      <div style={{ position: "relative", width: 44, height: 44, borderRadius: 10, overflow: "hidden", border: `2px solid ${C.border}`, flexShrink: 0, background: value, boxShadow: `0 2px 8px ${C.shadow}` }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ position: "absolute", inset: "-6px", width: "calc(100% + 12px)", height: "calc(100% + 12px)", opacity: 0, cursor: "pointer" }} />
      </div>
    </div>
  );
}

function ExportModal({ defaultName, format, onConfirm, onCancel, C }) {
  const [val, setVal] = useState(defaultName);
  const ref = useRef();
  useEffect(() => { setTimeout(() => ref.current?.select(), 50); }, []);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div style={{ background: C.surface, borderRadius: 18, padding: "28px 24px 22px", width: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.35)", border: `1.5px solid ${C.border}` }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>Name your {format} export</div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>
          {format === "3MF" ? <>Single <code>.3mf</code> — base, border &amp; text as separate color objects.</> : "Merged geometry, single color."}
        </div>
        <input ref={ref} value={val} onChange={e => setVal(e.target.value.replace(/[^a-zA-Z0-9 _-]/g, ""))}
          onKeyDown={e => { if (e.key === "Enter" && val.trim()) onConfirm(val.trim()); if (e.key === "Escape") onCancel(); }}
          maxLength={48}
          style={{ width: "100%", padding: "10px 13px", background: C.inputBg, border: "none", borderRadius: 11, color: C.text, fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 18 }} />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "10px 0", borderRadius: 11, border: `1.5px solid ${C.border}`, background: "none", color: C.muted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={() => val.trim() && onConfirm(val.trim())} disabled={!val.trim()}
            style={{ flex: 2, padding: "10px 0", borderRadius: 11, border: "none", background: `linear-gradient(135deg,${C.accent},${C.accent2})`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: val.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: val.trim() ? 1 : 0.5 }}>
            Download {format}
          </button>
        </div>
      </div>
    </div>
  );
}

function DimensionsCard({ dimensions, objectName, darkMode }) {
  if (!dimensions) return null;
  const bg     = darkMode ? "rgba(12,8,22,0.42)" : "rgba(255,255,255,0.30)";
  const border = darkMode ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.60)";
  const fg     = darkMode ? "#f0eaf8" : "#1a1a1a";
  const fgL    = darkMode ? "rgba(200,185,220,0.70)" : "rgba(60,50,80,0.60)";
  const mono   = "'DM Mono','Courier New',monospace";
  const Row = ({ label, value, color }) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6, lineHeight: "1.7" }}>
      <span style={{ fontSize: 11.5, color: fgL, fontFamily: mono, whiteSpace: "nowrap", flexShrink: 0, minWidth: 118 }}>{label}</span>
      <span style={{ fontSize: 11.5, color: color || fg, fontFamily: mono }}>{value}</span>
    </div>
  );
  const filamentM = ((parseFloat(dimensions.volume) * 1.2) / (Math.PI * Math.pow(1.75 / 2, 2)) / 1000).toFixed(2);
  return (
    <div style={{ position: "absolute", top: 12, left: 12, zIndex: 10, background: bg, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${border}`, borderRadius: 7, padding: "8px 13px 9px 11px", pointerEvents: "none", minWidth: 250, boxShadow: darkMode ? "0 3px 16px rgba(0,0,0,0.65)" : "0 2px 12px rgba(0,0,0,0.13)" }}>
      <Row label="Object name:" value={objectName} />
      <Row label="Size:"        value={`${dimensions.w} x ${dimensions.h} x ${dimensions.d} mm`} color="#4dabf7" />
      <Row label="Volume:"      value={`${dimensions.volume} mm³`} />
      <Row label="Triangles:"   value={dimensions.triangles.toLocaleString()} />
      <div style={{ height: 1, background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", margin: "5px 0 4px" }} />
      <Row label="Print Time:"       value={dimensions.printTime} />
      <Row label="Filament Weight:"  value={`${dimensions.weightG} g`} />
      <Row label="Filament Length:"  value={`${filamentM} m`} />
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function SchoolIDApp() {
  const [darkMode, setDarkMode] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = e => setDarkMode(e.matches);
    mq.addEventListener("change", h); return () => mq.removeEventListener("change", h);
  }, []);
  const C = darkMode ? DARK : LIGHT;

  const [name,         setName]         = useState(DEFAULTS.name);
  const [fullName,     setFullName]     = useState(DEFAULTS.fullName);
  const [gradeSection, setGradeSection] = useState(DEFAULTS.gradeSection);

  const [nameFont,      setNameFont]      = useState(DEFAULTS.nameFont);
  const [subFont,       setSubFont]       = useState(DEFAULTS.subFont);

  const [nameCapHeight, setNameCapHeight] = useState(DEFAULTS.nameCapHeight);
  const [subCapHeight,  setSubCapHeight]  = useState(DEFAULTS.subCapHeight);
  const [textHeight,    setTextHeight]    = useState(DEFAULTS.textHeight);

  const [baseHeight,    setBaseHeight]    = useState(DEFAULTS.baseHeight);
  const [padding,       setPadding]       = useState(DEFAULTS.padding);
  const [rowGap,        setRowGap]        = useState(DEFAULTS.rowGap);

  // Tab — now rectangular, top-center
  const [tabWidth,      setTabWidth]      = useState(DEFAULTS.tabWidth);
  const [tabHeight,     setTabHeight]     = useState(DEFAULTS.tabHeight);
  const [tabThickness,  setTabThickness]  = useState(DEFAULTS.tabThickness);
  const [holeWidth,     setHoleWidth]     = useState(DEFAULTS.holeWidth);
  const [holeHeight,    setHoleHeight]    = useState(DEFAULTS.holeHeight);
  const [tabCornerRadius, setTabCornerRadius] = useState(DEFAULTS.tabCornerRadius);

  // Colors — three independent
  const [baseColor,     setBaseColor]     = useState(DEFAULTS.baseColor);
  const [borderColor,   setBorderColor]   = useState(DEFAULTS.borderColor);
  const [textColor,     setTextColor]     = useState(DEFAULTS.textColor);

  const [dimensions,   setDimensions]    = useState(null);
  const [fontsReady,   setFontsReady]    = useState(false);
  const [loadedFonts,  setLoadedFonts]   = useState(new Set());
  const [status,       setStatus]        = useState("loading");
  const [exportModal,  setExportModal]   = useState(null);

  const dName         = useDebounce(name,          200);
  const dFullName     = useDebounce(fullName,       200);
  const dGradeSection = useDebounce(gradeSection,   200);
  const dNameCap      = useDebounce(nameCapHeight,  80);
  const dSubCap       = useDebounce(subCapHeight,   80);
  const dTextH        = useDebounce(textHeight,     80);
  const dBaseH        = useDebounce(baseHeight,     80);
  const dPadding      = useDebounce(padding,        80);
  const dRowGap       = useDebounce(rowGap,         80);
  const dTabW         = useDebounce(tabWidth,       80);
  const dTabH         = useDebounce(tabHeight,      80);
  const dTabThick     = useDebounce(tabThickness,   80);
  const dHoleW        = useDebounce(holeWidth,      80);
  const dHoleH        = useDebounce(holeHeight,     80);
  const dTabR         = useDebounce(tabCornerRadius,80);

  const safeText = (s, len = 30) => s.replace(/[^a-zA-Z0-9 _.'-]/g, "").slice(0, len);
  const safeName        = useMemo(() => safeText(dName, 20),         [dName]);
  const safeFullName    = useMemo(() => safeText(dFullName, 30),     [dFullName]);
  const safeGrade       = useMemo(() => safeText(dGradeSection, 30), [dGradeSection]);
  const suggestedName   = `ID_${safeName.replace(/\s+/g, "_")}`;

  const canvasRef    = useRef(null);
  const cameraRef    = useRef(null);
  const rendererRef  = useRef(null);
  const controlsRef  = useRef(null);
  const animRef      = useRef(null);
  const groupRef     = useRef(null);
  const sceneRef     = useRef(null);
  const fontCacheRef = useRef({});
  const exportGeoRef = useRef({ base: null, border: null, tab: null, texts: [] });
  const meshRef      = useRef({ base: null, border: null, tab: null, texts: [] });

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.background.set(C.sceneBg);
  }, [darkMode, C.sceneBg]);

  // Three.js init
  useEffect(() => {
    const el = canvasRef.current; if (!el) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(LIGHT.sceneBg);
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 5000);
    camera.position.set(0, 0, 160);
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const d = new THREE.DirectionalLight(0xffffff, 0.8); d.position.set(20, 30, 25); scene.add(d);
    const f = new THREE.DirectionalLight(0xccddff, 0.4); f.position.set(-20, -10, 10); scene.add(f);
    import("three/examples/jsm/controls/OrbitControls").then(({ OrbitControls }) => {
      const ctrl = new OrbitControls(camera, renderer.domElement);
      ctrl.enableDamping = true; ctrl.dampingFactor = 0.08; controlsRef.current = ctrl;
    });
    const g = new THREE.Group(); scene.add(g); groupRef.current = g;
    let last = 0;
    const tick = t => {
      animRef.current = requestAnimationFrame(tick);
      if (document.hidden || t - last < 14) return;
      last = t; controlsRef.current?.update(); renderer.render(scene, camera);
    };
    tick(0);
    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(animRef.current);
      controlsRef.current?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  // Font loading
  useEffect(() => {
    let alive = true;
    (async () => {
      const loaded = new Set();
      for (const k of Object.keys(FONT_URLS)) {
        try {
          const r = await fetch(FONT_URLS[k]); if (!r.ok) continue;
          const buf = await r.arrayBuffer();
          fontCacheRef.current[k] = opentype.parse(buf);
          loaded.add(k);
          if (!alive) return;
          setLoadedFonts(new Set(loaded));
        } catch { /* skip */ }
      }
      if (!alive) return;
      if (loaded.size > 0) { setFontsReady(true); setStatus("ready"); }
      else setStatus("error");
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (loadedFonts.size > 0 && !loadedFonts.has(nameFont)) setNameFont([...loadedFonts][0]);
  }, [loadedFonts, nameFont]);
  useEffect(() => {
    if (loadedFonts.size > 0 && !loadedFonts.has(subFont)) setSubFont([...loadedFonts][0]);
  }, [loadedFonts, subFont]);

  const clearGroup = useCallback(() => {
    const g = groupRef.current; if (!g) return;
    while (g.children.length) {
      const o = g.children.pop();
      o?.traverse?.(c => { if (c.isMesh) { c.geometry?.dispose(); c.material?.dispose(); } });
    }
  }, []);

  const buildTextShapes = useCallback((otFont, text, fontSize) => {
    const isCFF = !!(otFont.tables?.cff);
    const otPath = otFont.getPath(text, 0, 0, fontSize);
    if (isCFF) return opentypePathToThreeShapes(otPath);
    const svgStr = otPath.toPathData(4);
    const parsed = new SVGLoader().parse(`<svg><path d="${svgStr}"/></svg>`);
    const ttf = svgShapesToThreeShapes(parsed.paths);
    if (ttf.length > 0) {
      let outerA = 0, holeA = 0;
      for (const s of ttf) {
        outerA += Math.abs(signedAreaVec2(s.getPoints(8)));
        for (const h of s.holes) holeA += Math.abs(signedAreaVec2(h.getPoints(8)));
      }
      if (outerA > 0 && holeA / outerA > 0.6) return opentypePathToThreeShapes(otPath);
    }
    return ttf;
  }, []);

  function getFontSize(otFont, capHeightMm) {
    const unitsPerEm = otFont.unitsPerEm || 1000;
    const os2 = otFont.tables?.os2;
    const capUnits = (os2?.sCapHeight > 0 ? os2.sCapHeight : null) ?? (os2?.sTypoAscender > 0 ? os2.sTypoAscender : null) ?? unitsPerEm * 0.72;
    return capHeightMm * (unitsPerEm / capUnits);
  }

  // ── Main geometry build ───────────────────────────────────────────────────
  useEffect(() => {
    if (!fontsReady || !groupRef.current) return;
    const nFont = fontCacheRef.current[nameFont];
    const sFont = fontCacheRef.current[subFont];
    if (!nFont || !sFont) return;
    if (!safeName && !safeFullName && !safeGrade) return;

    setStatus("building");
    clearGroup();

    const tid = setTimeout(() => {
      try {
        const nameFSize = getFontSize(nFont, dNameCap);
        const subFSize  = getFontSize(sFont, dSubCap);

        const rows = [
          { font: nFont, text: safeName,     fontSize: nameFSize },
          { font: sFont, text: safeFullName, fontSize: subFSize  },
          { font: sFont, text: safeGrade,    fontSize: subFSize  },
        ].filter(r => r.text.length > 0);

        const rowGeos    = [];
        const rowHeights = [];

        for (const row of rows) {
          const shapes = buildTextShapes(row.font, row.text, row.fontSize);
          if (!shapes.length) { rowGeos.push(null); rowHeights.push(row.fontSize * 0.7); continue; }
          const geo = new THREE.ExtrudeGeometry(shapes, { depth: dTextH, bevelEnabled: false, curveSegments: 8 });
          geo.computeBoundingBox();
          const bb = geo.boundingBox;
          rowHeights.push(bb.max.y - bb.min.y);
          geo.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, 0);
          rowGeos.push(geo);
        }

        const baseW  = 150;
        const baseH2 = 75;
        const totalTextH = rowHeights.reduce((s, h) => s + h, 0) + dRowGap * (rows.length - 1);

        let curY = totalTextH / 2;
        const textMeshes = [];
        for (let i = 0; i < rows.length; i++) {
          const geo = rowGeos[i];
          const rh  = rowHeights[i];
          curY -= rh / 2;
          if (geo) {
            geo.translate(0, curY, 0);
            textMeshes.push({ geo });
          }
          curY -= rh / 2 + dRowGap;
        }

        const r = Math.min(baseW, baseH2) * 0.12;

        // ── Base plate (cream/white) ──────────────────────────────────────
        const baseShape = roundedRectShape(baseW, baseH2, r);
        const baseGeo = new THREE.ExtrudeGeometry(baseShape, { depth: dBaseH, bevelEnabled: false, curveSegments: 12 });

        // ── Border ring (colored, slightly taller) ────────────────────────
        const borderW = 3.0;
        const borderH = 1.5;
        const innerW  = baseW - borderW * 2;
        const innerH  = baseH2 - borderW * 2;
        const innerR  = Math.max(r - borderW, 1);

        const borderShapeClean = roundedRectShape(baseW, baseH2, r);
        const holeP = roundedRectPath(innerW, innerH, innerR);
        borderShapeClean.holes.push(holeP);
        const borderGeo = new THREE.ExtrudeGeometry(borderShapeClean, { depth: dBaseH + borderH, bevelEnabled: false, curveSegments: 12 });

        // ── Tab: rectangular with rounded corners, centered at top ────────
        // Tab sits flush above the top edge, centered on X
        const totalTabH = dBaseH + borderH + dTabThick;
        const tabGeo = makeRectTabGeo(dTabW, dTabH, dHoleW, dHoleH, totalTabH, dTabR);
        // Position: centered X=0, bottom of tab = top of card (baseH2/2), behind on Z
        tabGeo.translate(0, baseH2 / 2 + dTabH / 2 - 1.5, 0); // slight overlap for clean join

        clearGroup();

        const baseMat   = new THREE.MeshPhongMaterial({ color: baseColor,   shininess: 60,  side: THREE.DoubleSide });
        const borderMat = new THREE.MeshPhongMaterial({ color: borderColor, shininess: 120, side: THREE.DoubleSide });
        const textMat   = new THREE.MeshPhongMaterial({ color: textColor,   shininess: 100, side: THREE.DoubleSide });

        const baseMesh   = new THREE.Mesh(baseGeo,   baseMat);
        const borderMesh = new THREE.Mesh(borderGeo, borderMat);
        const tabMesh    = new THREE.Mesh(tabGeo,    borderMat);   // tab same color as border
        groupRef.current.add(baseMesh, borderMesh, tabMesh);

        const builtTextMeshes = [];
        for (const { geo } of textMeshes) {
          const m = new THREE.Mesh(geo, textMat);
          m.position.z = dBaseH;
          groupRef.current.add(m);
          builtTextMeshes.push(m);
        }

        meshRef.current = { base: baseMesh, border: borderMesh, tab: tabMesh, texts: builtTextMeshes };

        // Dimensions
        const box = new THREE.Box3();
        box.expandByObject(baseMesh); box.expandByObject(tabMesh);
        const size = new THREE.Vector3(); box.getSize(size);

        function meshVolume(geo) {
          const pos = geo.attributes.position; let vol = 0;
          for (let i = 0; i < pos.count; i += 3) {
            const ax=pos.getX(i),ay=pos.getY(i),az=pos.getZ(i);
            const bx=pos.getX(i+1),by=pos.getY(i+1),bz=pos.getZ(i+1);
            const cx=pos.getX(i+2),cy=pos.getY(i+2),cz=pos.getZ(i+2);
            vol += (ax*(by*cz-bz*cy)+bx*(cy*az-cz*ay)+cx*(ay*bz-az*by))/6;
          }
          return Math.abs(vol);
        }
        const bFlat = baseGeo.toNonIndexed(), tbFlat = tabGeo.toNonIndexed();
        let totalVol = meshVolume(bFlat) + meshVolume(tbFlat);
        let totalTris = (bFlat.attributes.position.count + tbFlat.attributes.position.count) / 3;
        bFlat.dispose(); tbFlat.dispose();
        for (const { geo } of textMeshes) {
          if (!geo) continue;
          const f = geo.toNonIndexed(); totalVol += meshVolume(f); totalTris += f.attributes.position.count / 3; f.dispose();
        }

        const printMins = (totalVol * 0.75 / 240) * 1.5 + 4;
        const printH = Math.floor(printMins / 60), printM = Math.round(printMins % 60);
        setDimensions({
          w: +size.x.toFixed(2), h: +size.y.toFixed(2), d: +(dBaseH + dTextH).toFixed(2),
          volume: totalVol.toFixed(2), triangles: Math.round(totalTris),
          weightG: ((size.x * size.y * (dBaseH + dTextH) * 0.40 / 1000) * 1.24 * 1.25).toFixed(2),
          printTime: printH > 0 ? `${printH}h ${printM}m` : `${printM}m`,
        });

        exportGeoRef.current = {
          base:   baseGeo.clone(),
          border: borderGeo.clone(),
          tab:    tabGeo.clone(),
          texts:  textMeshes.map(({ geo }) => ({ geo: geo.clone() })),
        };

        const span = Math.max(baseW + 40, baseH2 + dTabH + 40);
        if (cameraRef.current) cameraRef.current.position.set(0, 0, span * 1.3);
        if (controlsRef.current) { controlsRef.current.target.set(0, 0, dBaseH / 2); controlsRef.current.update(); }
        setStatus("ready");
      } catch (e) { console.error(e); setStatus("error"); }
    }, 0);
    return () => clearTimeout(tid);
  }, [
    fontsReady, safeName, safeFullName, safeGrade,
    nameFont, subFont, dNameCap, dSubCap, dTextH, dBaseH,
    dPadding, dRowGap, dTabW, dTabH, dTabThick, dHoleW, dHoleH, dTabR,
    baseColor, borderColor, textColor, clearGroup, buildTextShapes
  ]);

  // Live color updates
  useEffect(() => {
    const { base, border, tab, texts } = meshRef.current;
    if (base)   base.material.color.set(baseColor);
    if (border) border.material.color.set(borderColor);
    if (tab)    tab.material.color.set(borderColor);
    texts.forEach(m => m.material.color.set(textColor));
  }, [baseColor, borderColor, textColor]);

  // STL export
  const doExportSTL = useCallback((filename) => {
    const { base, border, tab, texts } = exportGeoRef.current;
    if (!base || !tab) return;
    const clones = [base.clone(), border.clone(), tab.clone()];
    for (const { geo } of texts) { const c = geo.clone(); c.translate(0, 0, baseHeight); clones.push(c); }
    const merged = mergeGeometries(clones, false); if (!merged) return;
    const stl = new STLExporter().parse(new THREE.Mesh(merged, new THREE.MeshNormalMaterial()), { binary: false });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([stl], { type: "model/stl" }));
    a.download = `${filename}.stl`; a.click(); URL.revokeObjectURL(a.href);
    merged.dispose(); clones.forEach(c => c.dispose());
  }, [baseHeight]);

  // 3MF export — now 3 color objects: base / border+tab / text
  const doExport3MF = useCallback((filename) => {
    const { base, border, tab, texts } = exportGeoRef.current;
    if (!base || !tab) return;
    const borderPlusTab = mergeGeometries([border.clone(), tab.clone()], false) || border.clone();
    const textGeos = texts.map(({ geo }) => { const c = geo.clone(); c.translate(0, 0, baseHeight); return c; });
    const zipBytes = build3MFZip(base, borderPlusTab, textGeos, baseColor, borderColor, textColor);
    borderPlusTab.dispose();
    textGeos.forEach(g => g.dispose());
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([zipBytes], { type: "application/zip" }));
    a.download = `${filename}.3mf`; a.click(); URL.revokeObjectURL(a.href);
  }, [baseHeight, baseColor, borderColor, textColor]);

  const resetCamera = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 0, 160);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  }, []);

  const resetAll = useCallback(() => {
    setName(DEFAULTS.name); setFullName(DEFAULTS.fullName); setGradeSection(DEFAULTS.gradeSection);
    setNameFont(DEFAULTS.nameFont); setSubFont(DEFAULTS.subFont);
    setNameCapHeight(DEFAULTS.nameCapHeight); setSubCapHeight(DEFAULTS.subCapHeight);
    setTextHeight(DEFAULTS.textHeight); setBaseHeight(DEFAULTS.baseHeight);
    setPadding(DEFAULTS.padding); setRowGap(DEFAULTS.rowGap);
    setTabWidth(DEFAULTS.tabWidth); setTabHeight(DEFAULTS.tabHeight);
    setTabThickness(DEFAULTS.tabThickness); setHoleWidth(DEFAULTS.holeWidth);
    setHoleHeight(DEFAULTS.holeHeight); setTabCornerRadius(DEFAULTS.tabCornerRadius);
    setBaseColor(DEFAULTS.baseColor); setBorderColor(DEFAULTS.borderColor); setTextColor(DEFAULTS.textColor);
  }, []);

  // Inject styles
  useEffect(() => {
    const id = "school-id-v2";
    if (document.getElementById(id)) return;
    const s = document.createElement("style"); s.id = id;
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=DM+Mono&display=swap');
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; overflow: hidden; height: 100%; background: transparent; }
      #root { height: 100%; overflow: hidden; }
      input[type=range]{-webkit-appearance:none;appearance:none;background:transparent;}
      input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;background:white;border:2px solid #3b82f6;box-shadow:0 1px 4px #3b82f660;cursor:pointer;transition:transform 0.12s;}
      input[type=range]::-webkit-slider-thumb:hover{transform:scale(1.25);}
      input[type=range]::-moz-range-thumb{width:15px;height:15px;border-radius:50%;background:white;border:2px solid #3b82f6;cursor:pointer;}
      input[type=range]:focus{outline:none;}
      select{-webkit-appearance:none;appearance:none;}
      ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(96,165,250,0.35);border-radius:3px;}
      @keyframes id-pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    `;
    document.head.appendChild(s);
  }, []);

  const isBuilding  = status === "building" || status === "loading";
  const statusColor = status === "ready" ? "#86efac" : status === "error" ? "#fca5a5" : "#fcd34d";
  const statusLabel = status === "ready" ? "Ready" : status === "error" ? "Error" : status === "building" ? "Rebuilding…" : "Loading fonts…";
  const inp = { width: "100%", padding: "9px 12px", background: C.inputBg, border: "none", borderRadius: 12, color: C.text, fontFamily: "'Montserrat',sans-serif", fontSize: 13, outline: "none" };

  return (
    <div style={{ fontFamily: "'Montserrat',sans-serif", background: C.bg, color: C.text, height: "100dvh", width: "100vw", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
      <div style={{ position: "absolute", top: -80, left: -60, width: 340, height: 340, borderRadius: "50%", background: C.blob1, filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "absolute", bottom: -60, right: -40, width: 280, height: 280, borderRadius: "50%", background: C.blob2, filter: "blur(50px)", pointerEvents: "none", zIndex: 0 }} />

      {/* Header */}
      <div style={{ position: "relative", zIndex: 1, padding: "12px 24px 0", borderBottom: `1px solid ${C.border}`, flexShrink: 0, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ paddingBottom: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", background: `linear-gradient(135deg,${C.accent},${C.accent2})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            School ID Keychain
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Name · Full Name · Grade &amp; Section</div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[{ label: "Keychain", app: "keychain" }, { label: "School ID", app: "school" }].map(({ label, app }) => {
            const active = app === "school";
            return (
              <a key={app} href={`/?app=${app}`}
                style={{ display: "block", padding: "8px 18px", fontSize: 12, fontWeight: 600, fontFamily: "inherit", textDecoration: "none", borderRadius: "10px 10px 0 0", border: `1.5px solid ${active ? C.border : "transparent"}`, borderBottom: active ? `2px solid ${C.bg}` : "none", marginBottom: active ? -1 : 0, background: active ? C.bg : "transparent", color: active ? C.accent : C.muted, transition: "color 0.15s", cursor: "pointer" }}>
                {label}
              </a>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "300px 1fr", flex: 1, minHeight: 0, overflow: "hidden" }}>

        {/* Controls */}
        <div style={{ background: C.surface, borderRight: `1px solid ${C.border}`, overflowY: "auto", overflowX: "hidden", padding: "16px 18px" }}>

          <SectionHeader label="Text Content" C={C} />

          <FieldLabel dirty={name !== DEFAULTS.name} onReset={() => setName(DEFAULTS.name)} C={C}>Name (big)</FieldLabel>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={20} placeholder="KAEL"
            style={{ ...inp, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }} />
          <div style={{ fontSize: 10, color: C.muted, textAlign: "right", marginBottom: 10 }}>{name.length}/20</div>

          <FieldLabel dirty={fullName !== DEFAULTS.fullName} onReset={() => setFullName(DEFAULTS.fullName)} C={C}>Full Name</FieldLabel>
          <input value={fullName} onChange={e => setFullName(e.target.value)} maxLength={30} placeholder="Kael Doniel S."
            style={{ ...inp, marginBottom: 4 }} />
          <div style={{ fontSize: 10, color: C.muted, textAlign: "right", marginBottom: 10 }}>{fullName.length}/30</div>

          <FieldLabel dirty={gradeSection !== DEFAULTS.gradeSection} onReset={() => setGradeSection(DEFAULTS.gradeSection)} C={C}>Grade &amp; Section</FieldLabel>
          <input value={gradeSection} onChange={e => setGradeSection(e.target.value)} maxLength={30} placeholder="Grade 7 - Rizal"
            style={{ ...inp, marginBottom: 12 }} />

          <SectionHeader label="Fonts" C={C} />

          <FieldLabel dirty={nameFont !== DEFAULTS.nameFont} onReset={() => setNameFont(DEFAULTS.nameFont)} C={C}>Name Font</FieldLabel>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <select value={nameFont} onChange={e => setNameFont(e.target.value)} style={{ ...inp, cursor: "pointer", paddingRight: 32 }}>
              {Object.keys(FONT_URLS).map(k => (
                <option key={k} value={k} disabled={!loadedFonts.has(k)}>
                  {k.split(":")[0]}{!loadedFonts.has(k) ? " – loading…" : ""}
                </option>
              ))}
            </select>
            <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 10, color: C.muted }}>▾</span>
          </div>

          <FieldLabel dirty={subFont !== DEFAULTS.subFont} onReset={() => setSubFont(DEFAULTS.subFont)} C={C}>Sub Text Font</FieldLabel>
          <div style={{ position: "relative", marginBottom: 4 }}>
            <select value={subFont} onChange={e => setSubFont(e.target.value)} style={{ ...inp, cursor: "pointer", paddingRight: 32 }}>
              {Object.keys(FONT_URLS).map(k => (
                <option key={k} value={k} disabled={!loadedFonts.has(k)}>
                  {k.split(":")[0]}{!loadedFonts.has(k) ? " – loading…" : ""}
                </option>
              ))}
            </select>
            <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 10, color: C.muted }}>▾</span>
          </div>

          <SectionHeader label="Sizes" C={C} />
          <SliderRow label="Name Cap Height" value={nameCapHeight} min={8}   max={40} step={0.5} onChange={setNameCapHeight} defaultValue={DEFAULTS.nameCapHeight} C={C} />
          <SliderRow label="Sub Cap Height"  value={subCapHeight}  min={4}   max={20} step={0.5} onChange={setSubCapHeight}  defaultValue={DEFAULTS.subCapHeight}  C={C} />
          <SliderRow label="Text Depth"      value={textHeight}    min={0.5} max={8}  step={0.5} onChange={setTextHeight}    defaultValue={DEFAULTS.textHeight}    C={C} />

          <SectionHeader label="Base" C={C} />
          <SliderRow label="Base Height" value={baseHeight} min={0.5} max={8}  step={0.5} onChange={setBaseHeight} defaultValue={DEFAULTS.baseHeight} C={C} />
          <SliderRow label="Row Gap"     value={rowGap}     min={0.5} max={10} step={0.5} onChange={setRowGap}     defaultValue={DEFAULTS.rowGap}     C={C} />

          <SectionHeader label="Tab (Top)" C={C} />
          <SliderRow label="Tab Width"    value={tabWidth}       min={8}   max={40} step={0.5} onChange={setTabWidth}       defaultValue={DEFAULTS.tabWidth}       C={C} />
          <SliderRow label="Tab Height"   value={tabHeight}      min={4}   max={25} step={0.5} onChange={setTabHeight}      defaultValue={DEFAULTS.tabHeight}      C={C} />
          <SliderRow label="Tab Depth+"   value={tabThickness}   min={0}   max={5}  step={0.5} onChange={setTabThickness}   defaultValue={DEFAULTS.tabThickness}   C={C} />
          <SliderRow label="Hole Width"   value={holeWidth}      min={2}   max={30} step={0.5} onChange={setHoleWidth}      defaultValue={DEFAULTS.holeWidth}      C={C} />
          <SliderRow label="Hole Height"  value={holeHeight}     min={1}   max={15} step={0.5} onChange={setHoleHeight}     defaultValue={DEFAULTS.holeHeight}     C={C} />
          <SliderRow label="Corner Radius" value={tabCornerRadius} min={0.5} max={8} step={0.5} onChange={setTabCornerRadius} defaultValue={DEFAULTS.tabCornerRadius} C={C} />

          <SectionHeader label="Colors" C={C} />
          <ColorRow label="Base Plate"    value={baseColor}   defaultValue={DEFAULTS.baseColor}   onChange={setBaseColor}   C={C} />
          <ColorRow label="Border + Tab"  value={borderColor} defaultValue={DEFAULTS.borderColor} onChange={setBorderColor} C={C} />
          <ColorRow label="All Text"      value={textColor}   defaultValue={DEFAULTS.textColor}   onChange={setTextColor}   C={C} />

          {/* Theme toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, marginBottom: 16 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted }}>Theme</span>
            <button onClick={() => setDarkMode(d => !d)}
              style={{ width: 42, height: 24, borderRadius: 20, border: "none", cursor: "pointer", background: darkMode ? `linear-gradient(90deg,${C.accent},${C.accent2})` : "#e0eaff", position: "relative", transition: "background 0.3s", padding: 0 }}>
              <span style={{ position: "absolute", top: "50%", left: darkMode ? "calc(100% - 20px)" : 4, transform: "translateY(-50%)", fontSize: 12, transition: "left 0.2s" }}>{darkMode ? "🌙" : "☀️"}</span>
            </button>
          </div>

          <button onClick={resetAll}
            style={{ width: "100%", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 12, background: "none", border: `1.5px solid ${C.border}`, color: C.muted, fontSize: 11, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
            ↺ Reset all settings
          </button>

          {/* Export buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            {[
              { label: "STL", format: "STL", grad: "linear-gradient(135deg,#60a5fa,#3b82f6)", note: "geometry only" },
              { label: "3MF", format: "3MF", grad: "linear-gradient(135deg,#93c5fd,#60a5fa)", note: "3 color objects" },
            ].map(({ label, format, grad, note }) => (
              <div key={format} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <button onClick={() => fontsReady && setExportModal(format)} disabled={!fontsReady}
                  onMouseEnter={e => fontsReady && (e.currentTarget.style.transform = "translateY(-1px)")}
                  onMouseLeave={e => (e.currentTarget.style.transform = "none")}
                  style={{ width: "100%", padding: "11px 0 9px", fontSize: 11, fontWeight: 700, fontFamily: "inherit", letterSpacing: "0.06em", textTransform: "uppercase", background: fontsReady ? grad : C.trackBg, color: fontsReady ? "white" : C.muted, border: "none", borderRadius: 14, cursor: fontsReady ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
                  Export {label}
                </button>
                <span style={{ fontSize: 9, color: C.muted }}>{note}</span>
              </div>
            ))}
          </div>

          {/* Status */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "6px 12px", borderRadius: 20, background: C.pill }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor, animation: isBuilding ? "id-pulse 1s ease-in-out infinite" : "none", flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, animation: isBuilding ? "id-pulse 1s ease-in-out infinite" : "none" }}>{statusLabel}</span>
          </div>
        </div>

        {/* Viewport */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted }}>3D Preview</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 10, color: C.muted }}>drag to rotate · scroll to zoom</span>
              <button onClick={resetCamera}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}
                style={{ fontSize: 10, color: C.muted, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                ⟳ Reset view
              </button>
            </div>
          </div>
          <div style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden" }}>
            <div ref={canvasRef} style={{ position: "absolute", inset: 0 }} />
            <DimensionsCard dimensions={dimensions} objectName={safeName || "school-id"} darkMode={darkMode} />
          </div>
        </div>
      </div>

      {exportModal && (
        <ExportModal defaultName={suggestedName} format={exportModal}
          onCancel={() => setExportModal(null)}
          onConfirm={filename => {
            if (exportModal === "STL") doExportSTL(filename);
            else if (exportModal === "3MF") doExport3MF(filename);
            setExportModal(null);
          }} C={C} />
      )}
    </div>
  );
}