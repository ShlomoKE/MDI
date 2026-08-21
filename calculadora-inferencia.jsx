import React, { useState, useMemo } from "react";

const C = {
  bg: "#F1F3F2", surface: "#FFFFFF", ink: "#111815", muted: "#6E7A75",
  line: "#D3DAD7", mem: "#1F5F4C", lat: "#B4451F",
  memSoft: "#DCE9E4", latSoft: "#F6E2D8",
  comp: "#4A4E8C", compSoft: "#E0E1EF",
};

const GB = 1024 ** 3;

const GPUS_INIT = [
  { id: 1, nombre: "H100 SXM", vram: 80, bw: 3350, tf: 1979, precio: 2.6, on: true },
  { id: 2, nombre: "H100 PCIe", vram: 80, bw: 2000, tf: 1513, precio: 2.1, on: true },
  { id: 3, nombre: "H200 SXM", vram: 141, bw: 4800, tf: 1979, precio: 3.7, on: true },
  { id: 4, nombre: "A100 80GB", vram: 80, bw: 2039, tf: 624, precio: 1.6, on: true },
  { id: 5, nombre: "L40S", vram: 48, bw: 864, tf: 733, precio: 1.0, on: true },
  { id: 6, nombre: "RTX 6000 Ada", vram: 48, bw: 960, tf: 728, precio: 0.9, on: true },
  { id: 7, nombre: "DGX Spark", vram: 128, bw: 273, tf: 250, precio: 0.2, on: true },
];

const MODELOS_INIT = {
  "Qwen3.5-27B (híbrido)": { N: 27, La: 16, H: 4, dk: 256 },
  "Denso 27B (GQA 8×128)": { N: 27, La: 46, H: 8, dk: 128 },
  "Denso 70B (GQA 8×128)": { N: 70, La: 80, H: 8, dk: 128 },
  "Denso 8B (GQA 8×128)": { N: 8, La: 32, H: 8, dk: 128 },
};

const Q = { fp16: 2, fp8: 1, int4: 0.5 };

const fmt = (n, d = 0) =>
  n === null || n === undefined || !isFinite(n)
    ? "—"
    : n.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });

function Campo({ label, valor, set, sufijo, paso = 1, min = 0 }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs" style={{ color: C.muted }}>{label}</span>
      <span className="flex items-baseline gap-1">
        <input type="number" value={valor} min={min} step={paso}
          onChange={(e) => set(Math.max(min, parseFloat(e.target.value) || 0))}
          className="w-24 px-2 py-1 text-right text-sm rounded border outline-none"
          style={{ fontFamily: "'IBM Plex Mono', monospace", borderColor: C.line, color: C.ink, background: C.surface }} />
        {sufijo && <span className="text-xs w-10" style={{ color: C.muted }}>{sufijo}</span>}
      </span>
    </label>
  );
}

function Fijo({ label, valor, nota }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs" style={{ color: C.muted }}>{label}</span>
      <span className="flex items-baseline gap-1">
        <span className="w-24 px-2 py-1 text-right text-sm rounded border mono"
          style={{ borderColor: C.line, color: C.muted, background: C.bg }}>{valor}</span>
        <span className="text-xs w-10" style={{ color: C.muted }}>{nota}</span>
      </span>
    </div>
  );
}

function Seccion({ titulo, children }) {
  return (
    <div className="mb-6">
      <div className="text-xs uppercase mb-2 pb-1 border-b"
        style={{ letterSpacing: "0.12em", color: C.ink, borderColor: C.line,
          fontFamily: "'IBM Plex Sans Condensed', sans-serif", fontWeight: 600 }}>
        {titulo}
      </div>
      {children}
    </div>
  );
}

function Kpi({ k, v, col }) {
  return (
    <div className="px-3 py-2 rounded border" style={{ borderColor: C.line, background: C.surface }}>
      <div className="text-xs" style={{ color: C.muted }}>{k}</div>
      <div className="mono text-lg" style={{ color: col || C.ink }}>{v}</div>
    </div>
  );
}

export default function Calculadora() {
  const [modo, setModo] = useState("dimensionar");

  const [Uh, setUh] = useState(2000);
  const Dh = 0.15;   // peor caso: usuario muy activo
  const [Ch, setCh] = useState(3000);
  const [Ua, setUa] = useState(40);
  const Da = 0.95;   // peor caso: agente con herramientas rápidas
  const [Ca, setCa] = useState(30000);
  const [slo, setSlo] = useState(30);
  const [Gfijo, setGfijo] = useState(12);

  const [modeloSel, setModeloSel] = useState("Qwen3.5-27B (híbrido)");
  const [N, setN] = useState(27);
  const [La, setLa] = useState(16);
  const [H, setH] = useState(4);
  const [dk, setDk] = useState(256);
  const [qw, setQw] = useState("fp8");
  const [qkv, setQkv] = useState("fp8");
  const [O, setO] = useState(3);
  const [eff, setEff] = useState(0.5);

  const [gpus, setGpus] = useState(GPUS_INIT);
  const [hover, setHover] = useState(null);

  const cargarModelo = (k) => {
    setModeloSel(k);
    const m = MODELOS_INIT[k];
    if (m) { setN(m.N); setLa(m.La); setH(m.H); setDk(m.dk); }
  };

  const r = useMemo(() => {
    const Pm = N * 1e9 * Q[qw];
    const KVt = 2 * La * H * dk * Q[qkv];
    const Ah = Uh * Dh, Aa = Ua * Da, Aall = Ah + Aa;
    const bytesCache = KVt * (Ah * Ch + Aa * Ca);
    const Cavg = Aall > 0 ? (Ah * Ch + Aa * Ca) / Aall : 0;
    const KVavg = KVt * Cavg;
    const kappa = Dh * Ch > 0 ? (Da * Ca) / (Dh * Ch) : 0;
    const pctSesAg = Aall > 0 ? (Aa / Aall) * 100 : 0;

    const filas = gpus.filter((g) => g.on).map((g) => {
      const Vt = g.vram * GB, W = g.bw * 1e9 * eff, F = (g.tf || 500) * 1e12 * eff;
      const techoMem = Vt - Pm - O * GB;              // bytes de caché que permite la VRAM
      const techoLat = (slo / 1000) * W - Pm;         // bytes de caché que permite el SLO
      if (techoMem <= 0) return { ...g, viable: false, motivo: "El modelo no cabe en esta GPU" };
      if (techoLat <= 0) return { ...g, viable: false, motivo: "El SLO es inalcanzable en esta GPU" };

      const techo = Math.min(techoMem, techoLat);

      // tercer techo: cómputo. B ≤ SLO·F/(2N) por GPU
      const Bcomp = ((slo / 1000) * F) / (2 * N * 1e9);
      const cuello = techoMem <= techoLat ? "mem" : "lat";

      // dimensionar: GPUs necesarias para la carga dada
      const Gmem = bytesCache / techoMem;
      const Glat = bytesCache / techoLat;
      const Gcomp = Bcomp > 0 ? (Ah + Aa) / Bcomp : Infinity;
      const G = Math.max(1, Math.ceil(Math.max(Gmem, Glat, Gcomp)));
      const Breal = (Ah + Aa) / G;
      const tMem = (Pm + bytesCache / G) / W;
      const tComp = (2 * N * 1e9 * Breal) / F;
      const tpot = Math.max(tMem, tComp) * 1000;
      const cuelloDim = Gcomp >= Gmem && Gcomp >= Glat ? "comp" : (Gmem >= Glat ? "mem" : "lat");
      const tokSesion = 1000 / tpot;

      // capacidad: con Gfijo, agentes fijos, cuántos usuarios caben
      const cap = Gfijo * techo;                       // bytes de caché disponibles
      const porAgente = KVt * Da * Ca;                 // bytes que cuesta un agente
      const porUsuario = KVt * Dh * Ch;                // bytes que cuesta un usuario
      const maxAgentes = porAgente > 0 ? cap / porAgente : Infinity;
      const maxUsuarios = porUsuario > 0 ? cap / porUsuario : Infinity;
      const usadoAg = Ua * porAgente;
      const capPorBytes = porUsuario > 0 ? Math.max(0, (cap - usadoAg) / porUsuario) : 0;
      const capPorComp = Dh > 0 ? Math.max(0, (Gfijo * Bcomp - Ua * Da) / Dh) : Infinity;
      const capUsuarios = Math.min(capPorBytes, capPorComp);
      const limComp = capPorComp < capPorBytes;
      const alcanza = usadoAg <= cap;
      const bytesCap = usadoAg + capUsuarios * porUsuario;
      const BCap = (Ua * Da + capUsuarios * Dh) / Gfijo;
      const tpotCap = Math.max((Pm + bytesCap / Gfijo) / W, (2 * N * 1e9 * BCap) / F) * 1000;

      return {
        ...g, viable: true, techoMem, techoLat, techo, cuello,
        Gmem, Glat, G, tpot, tokSesion, costo: G * g.precio,
        B: (Ah + Aa) / G, tokH: Ah * tokSesion, tokA: Aa * tokSesion,
        maxAgentes, maxUsuarios, capUsuarios, alcanza, tpotCap, BCap, Bcomp, Gcomp, limComp,
        cuelloDim,
        costoCap: Gfijo * g.precio,
        tputCap: BCap > 0 ? (BCap / (tpotCap / 1000)) * Gfijo : 0,
      };
    });

    const ok = filas.filter((f) => f.viable);
    const pareto = ok.filter((f) => !ok.some((o) => o !== f && o.costo <= f.costo && o.tpot <= f.tpot && (o.costo < f.costo || o.tpot < f.tpot)))
      .sort((a, b) => a.tpot - b.tpot);

    return { Pm, KVt, Ah, Aa, Aall, pctSesAg, bytesCache, Cavg, kappa, filas, ok, pareto };
  }, [Uh, Ch, Ua, Ca, slo, N, La, H, dk, qw, qkv, O, eff, gpus, Gfijo]);

  const colCuello = (k) => (k === "mem" ? C.mem : k === "lat" ? C.lat : C.comp);
  const nomCuello = (k) => (k === "mem" ? "memoria" : k === "lat" ? "latencia" : "cómputo");
  const dim = modo === "dimensionar";
  const ok = r.ok;

  // ---- gráfica ----
  const Wc = 640, Hc = 340, ml = 66, mr = 24, mt = 24, mb = 46;
  const pw = Wc - ml - mr, ph = Hc - mt - mb;
  const xv = (d) => (dim ? d.tpot : d.maxAgentes);
  const yv = (d) => (dim ? d.costo : d.maxUsuarios);
  const maxX = dim
    ? Math.max(slo * 1.25, ...ok.map(xv), 10)
    : Math.max(Ua * 1.2, ...ok.map(xv), 1) * 1.08;
  const maxY = Math.max(...ok.map(yv), 1) * 1.15;
  const px = (v) => ml + (v / maxX) * pw;
  const py = (v) => mt + ph - (v / maxY) * ph;
  const mejor = ok.length
    ? (dim ? ok.reduce((a, b) => (b.costo < a.costo ? b : a))
           : ok.reduce((a, b) => (b.capUsuarios > a.capUsuarios ? b : a)))
    : null;
  const foco = ok.find((x) => x.id === hover) || mejor;

  return (
    <div style={{ background: C.bg, color: C.ink, minHeight: "100%", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        input[type=number]::-webkit-inner-spin-button{opacity:.35}
        .mono{font-family:'IBM Plex Mono',monospace}`}</style>

      <div className="px-6 py-5 border-b" style={{ borderColor: C.line, background: C.surface }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div style={{ fontFamily: "'IBM Plex Sans Condensed', sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: "-0.01em" }}>
              Dimensionamiento de inferencia
            </div>
            <div className="text-sm mt-1" style={{ color: C.muted }}>
              {dim
                ? "Define la carga: la calculadora devuelve el mínimo de GPUs que cumple memoria y latencia."
                : "Fija el hardware: la calculadora escala la mezcla de carga hasta donde alcance."}
            </div>
          </div>
          <div className="flex rounded border overflow-hidden" style={{ borderColor: C.line }}>
            {[["dimensionar", "¿Cuánto hardware?"], ["capacidad", "¿Para cuánto alcanza?"]].map(([k, l]) => (
              <button key={k} onClick={() => setModo(k)}
                className="px-4 py-2 text-sm"
                style={{ background: modo === k ? C.ink : C.surface, color: modo === k ? C.surface : C.muted }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div className="p-6 lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r" style={{ borderColor: C.line, background: C.surface }}>
          {!dim && (
            <Seccion titulo="Hardware disponible">
              <Campo label="GPUs por configuración" valor={Gfijo} set={setGfijo} paso={1} min={1} />
              <div className="text-xs mt-2 leading-relaxed" style={{ color: C.muted }}>
                Se evalúa cada GPU del catálogo como si tuvieras {Gfijo} unidades de ese tipo.
              </div>
            </Seccion>
          )}

          <Seccion titulo="Usuarios">
            {dim
              ? <Campo label="Usuarios" valor={Uh} set={setUh} paso={100} />
              : <Fijo label="Usuarios" valor="calculado" nota="" />}
            <Fijo label="Duty cycle" valor={Dh} nota="peor caso" />
            <Campo label="Contexto" valor={Ch} set={setCh} paso={500} sufijo="tok" />
          </Seccion>

          <Seccion titulo="Agentes">
            <Campo label="Agentes" valor={Ua} set={setUa} paso={5} />
            <Fijo label="Duty cycle" valor={Da} nota="peor caso" />
            <Campo label="Contexto" valor={Ca} set={setCa} paso={5000} sufijo="tok" />
            <div className="text-xs mt-2 leading-relaxed" style={{ color: C.muted }}>
              {dim
                ? "Duty cycles fijos en el peor caso. Trazas reales de agentes de código dan ~0.42 (13 s de generación por 18 s de herramientas); 0.95 corresponde a herramientas rápidas."
                : `Fijas cuántos agentes quieres; la calculadora devuelve cuántos usuarios caben además de ellos.`}
            </div>
          </Seccion>

          <Seccion titulo="Objetivo">
            <Campo label="SLO por token" valor={slo} set={setSlo} paso={5} sufijo="ms" />
            <div className="text-xs mt-2" style={{ color: C.muted }}>{fmt(1000 / slo)} tokens/s por sesión</div>
          </Seccion>

          <Seccion titulo="Modelo">
            <select value={modeloSel} onChange={(e) => cargarModelo(e.target.value)}
              className="w-full text-sm px-2 py-1 mb-2 rounded border outline-none"
              style={{ borderColor: C.line, background: C.surface, color: C.ink }}>
              {Object.keys(MODELOS_INIT).map((k) => <option key={k}>{k}</option>)}
              <option>Personalizado</option>
            </select>
            <Campo label="N parámetros" valor={N} set={(v) => { setN(v); setModeloSel("Personalizado"); }} sufijo="B" />
            <Campo label="Lₐ capas atn." valor={La} set={(v) => { setLa(v); setModeloSel("Personalizado"); }} />
            <Campo label="H cabezas KV" valor={H} set={(v) => { setH(v); setModeloSel("Personalizado"); }} />
            <Campo label="dₖ dimensión" valor={dk} set={(v) => { setDk(v); setModeloSel("Personalizado"); }} paso={32} />
            <div className="flex gap-2 mt-3">
              {[["Pesos", qw, setQw], ["Caché", qkv, setQkv]].map(([lbl, val, set]) => (
                <div key={lbl} className="flex-1">
                  <div className="text-xs mb-1" style={{ color: C.muted }}>{lbl}</div>
                  <select value={val} onChange={(e) => set(e.target.value)}
                    className="w-full text-sm px-2 py-1 rounded border outline-none"
                    style={{ borderColor: C.line, background: C.surface, color: C.ink }}>
                    {Object.keys(Q).map((k) => <option key={k}>{k}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-3"><Campo label="Overhead motor" valor={O} set={setO} sufijo="GB" /></div>
            <Campo label="Eficiencia de W" valor={eff} set={(v) => setEff(Math.min(1, Math.max(0.1, v)))} paso={0.05} />
            <div className="text-xs mt-2 leading-relaxed" style={{ color: C.muted }}>
              El TPOT teórico sale 20–40% optimista: el caché compite por el mismo ancho de banda y hay
              overhead de kernels. 0.5 es lo que respaldan los benchmarks públicos en modelos grandes; ajústalo con tu medición real. También descuenta los FLOPS.
            </div>
          </Seccion>
        </div>

        <div className="flex-1 p-6 min-w-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Kpi k="Pesos en VRAM" v={`${fmt(r.Pm / GB, 1)} GB`} />
            <Kpi k="KV por token" v={`${fmt(r.KVt / 1024)} KB`} />
            {dim
              ? <Kpi k="Sesiones activas" v={fmt(r.Aall)} />
              : <Kpi k="Contexto promedio" v={`${fmt(r.Cavg)} tok`} />}
            <Kpi k="κ agente/usuario" v={`${fmt(r.kappa)}×`} col={C.lat} />
          </div>

          <div className="rounded border mb-6 p-3" style={{ borderColor: C.line, background: C.surface }}>
            <div className="flex items-baseline justify-between mb-1 px-2 flex-wrap gap-2">
              <div className="text-xs uppercase" style={{ letterSpacing: "0.12em", fontFamily: "'IBM Plex Sans Condensed', sans-serif", fontWeight: 600 }}>
                {dim ? "Costo contra latencia" : `Frontera de capacidad con ${Gfijo} GPUs`}
              </div>
              <div className="flex gap-4 text-xs" style={{ color: C.muted }}>
                <span className="flex items-center gap-1"><i className="inline-block w-2 h-2 rounded-full" style={{ background: C.mem }} />limita memoria</span>
                <span className="flex items-center gap-1"><i className="inline-block w-2 h-2 rounded-full" style={{ background: C.lat }} />limita latencia</span>
                <span className="flex items-center gap-1"><i className="inline-block w-2 h-2 rounded-full" style={{ background: C.comp }} />limita cómputo</span>
              </div>
            </div>
            <svg viewBox={`0 0 ${Wc} ${Hc}`} className="w-full" style={{ maxHeight: 360 }}>
              {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                <g key={t}>
                  <line x1={ml} x2={ml + pw} y1={py(maxY * t)} y2={py(maxY * t)} stroke={C.line} strokeWidth="1" />
                  <text x={ml - 8} y={py(maxY * t) + 4} textAnchor="end" fontSize="10" fill={C.muted} className="mono">
                    {fmt(maxY * t, dim ? 1 : 0)}
                  </text>
                </g>
              ))}
              {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                <text key={t} x={px(maxX * t)} y={mt + ph + 18} textAnchor="middle" fontSize="10" fill={C.muted} className="mono">
                  {fmt(maxX * t, dim ? 0 : 1)}
                </text>
              ))}
              <text x={ml + pw / 2} y={Hc - 6} textAnchor="middle" fontSize="11" fill={C.muted}>
                {dim ? "TPOT logrado (ms/token)" : "Agentes"}
              </text>
              <text x={14} y={mt + ph / 2} textAnchor="middle" fontSize="11" fill={C.muted} transform={`rotate(-90 14 ${mt + ph / 2})`}>
                {dim ? "Costo (USD/hora)" : "Usuarios"}
              </text>

              {dim && (
                <>
                  <rect x={px(slo)} y={mt} width={Math.max(0, ml + pw - px(slo))} height={ph} fill={C.latSoft} opacity="0.45" />
                  <line x1={px(slo)} x2={px(slo)} y1={mt} y2={mt + ph} stroke={C.lat} strokeWidth="1.5" strokeDasharray="4 3" />
                  <text x={px(slo) + 5} y={mt + 12} fontSize="10" fill={C.lat} className="mono">SLO {slo} ms</text>
                </>
              )}

              {dim && r.pareto.length > 1 && (
                <polyline points={r.pareto.map((d) => `${px(d.tpot)},${py(d.costo)}`).join(" ")}
                  fill="none" stroke={C.muted} strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
              )}

              {!dim && ok.map((d) => {
                const col = colCuello(d.limComp ? "comp" : d.cuello);
                return (
                  <polyline key={"f" + d.id}
                    points={`${px(0)},${py(d.maxUsuarios)} ${px(d.maxAgentes)},${py(0)}`}
                    fill="none" stroke={col} strokeWidth={hover === d.id ? 2.5 : 1.2}
                    opacity={hover === d.id ? 1 : 0.45} />
                );
              })}

              {!dim && Ua > 0 && Ua < maxX && (
                <>
                  <line x1={px(Ua)} x2={px(Ua)} y1={mt} y2={mt + ph} stroke={C.ink} strokeWidth="1" strokeDasharray="4 3" />
                  <text x={px(Ua) + 5} y={mt + 12} fontSize="10" fill={C.ink} className="mono">{fmt(Ua)} agentes</text>
                </>
              )}

              {ok.map((d) => {
                const col = colCuello(dim ? d.cuelloDim : (d.limComp ? "comp" : d.cuello));
                const hv = hover === d.id;
                return (
                  <g key={d.id} onMouseEnter={() => setHover(d.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
                    <circle cx={px(dim ? d.tpot : Math.min(Ua, d.maxAgentes))} cy={py(dim ? d.costo : d.capUsuarios)} r={hv ? 8 : 5.5} fill={col} opacity={hv ? 1 : 0.88} />
                    <text x={px(dim ? d.tpot : Math.min(Ua, d.maxAgentes))} y={py(dim ? d.costo : d.capUsuarios) - 12} textAnchor="middle" fontSize="10" fill={C.ink} fontWeight={hv ? 600 : 400}>{d.nombre}</text>
                    {hv && (
                      <text x={px(dim ? d.tpot : Math.min(Ua, d.maxAgentes))} y={py(dim ? d.costo : d.capUsuarios) + 20} textAnchor="middle" fontSize="10" fill={C.muted} className="mono">
                        {dim ? `${d.G}× · $${fmt(d.costo, 2)}/h` : `${fmt(d.capUsuarios)} usuarios`}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="rounded border overflow-x-auto" style={{ borderColor: C.line, background: C.surface }}>
            <table className="w-full text-sm" style={{ minWidth: 760 }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  {(dim
                    ? ["GPU", "VRAM", "GB/s nom → efect", "USD/h", "GPUs", "Presión mem / lat", "TPOT", "tok/s sesión", "Costo/h"]
                    : ["GPU", "VRAM", "GB/s nom → efect", "USD/h", "Usuarios", "Solo agentes", "Cuello", "TPOT", "Costo/h"]
                  ).map((h, i) => (
                    <th key={h} className="text-left font-medium px-3 py-2 text-xs uppercase"
                      style={{ letterSpacing: "0.08em", color: C.muted, textAlign: i > 0 && !(dim && i === 5) ? "right" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.filas.map((d) => {
                  const cuello = d.viable ? (dim ? d.cuelloDim : (d.limComp ? "comp" : d.cuello)) : "mem";
                  const col = colCuello(cuello);
                  const esMejor = mejor && d.id === mejor.id;
                  const cumple = d.viable && (dim ? d.tpot : d.tpotCap) <= slo;
                  const mx = d.viable ? Math.max(d.Gmem, d.Glat, isFinite(d.Gcomp) ? d.Gcomp : 0) : 1;
                  return (
                    <tr key={d.id} className="border-t" style={{ borderColor: C.line, background: hover === d.id ? C.bg : "transparent" }}
                      onMouseEnter={() => setHover(d.id)} onMouseLeave={() => setHover(null)}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={d.on}
                            onChange={() => setGpus(gpus.map((g) => g.id === d.id ? { ...g, on: !g.on } : g))} />
                          <span style={{ fontWeight: esMejor ? 600 : 400 }}>{d.nombre}</span>
                          {esMejor && <span className="text-xs px-1 rounded" style={{ background: C.memSoft, color: C.mem }}>
                            {dim ? "más barata" : "más capacidad"}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right mono">{d.vram} GB</td>
                      <td className="px-3 py-2 text-right mono">{fmt(d.bw)}<span style={{ color: C.muted }}> → {fmt(d.bw * eff)}</span></td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" value={d.precio} step={0.1} min={0}
                          onChange={(e) => setGpus(gpus.map((g) => g.id === d.id ? { ...g, precio: parseFloat(e.target.value) || 0 } : g))}
                          className="w-16 px-1 py-0.5 text-right rounded border mono text-sm"
                          style={{ borderColor: C.line, background: C.surface }} />
                      </td>
                      {!d.viable ? (
                        <td colSpan={5} className="px-3 py-2 text-xs" style={{ color: C.lat }}>{d.motivo}</td>
                      ) : dim ? (
                        <>
                          <td className="px-3 py-2 text-right mono">{d.G}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-1" style={{ minWidth: 130 }}>
                              {[["mem", d.Gmem, C.mem], ["lat", d.Glat, C.lat], ["cpu", d.Gcomp, C.comp]].map(([k, v, c]) => (
                                <div key={k} className="flex items-center gap-2">
                                  <span className="text-xs w-6" style={{ color: (k === "cpu" ? "comp" : k) === cuello ? c : C.muted }}>{k}</span>
                                  <div className="flex-1 h-2 rounded" style={{ background: C.bg }}>
                                    <div className="h-2 rounded" style={{ width: `${Math.min(100, (v / mx) * 100)}%`, background: c, opacity: (k === "cpu" ? "comp" : k) === cuello ? 1 : 0.3 }} />
                                  </div>
                                  <span className="mono text-xs w-8 text-right" style={{ color: C.muted }}>{fmt(v, 1)}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right mono" style={{ color: cumple ? C.ink : C.lat }}>{fmt(d.tpot, 1)} ms</td>
                          <td className="px-3 py-2 text-right mono" style={{ color: cumple ? C.ink : C.lat }}>{fmt(d.tokSesion, 1)}</td>
                          <td className="px-3 py-2 text-right mono" style={{ color: col, fontWeight: esMejor ? 600 : 400 }}>${fmt(d.costo, 2)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-right mono" style={{ color: d.alcanza ? (esMejor ? col : C.ink) : C.lat, fontWeight: esMejor ? 600 : 400 }}>
                            {d.alcanza ? fmt(d.capUsuarios) : "no alcanza"}</td>
                          <td className="px-3 py-2 text-right mono" style={{ color: C.muted }}>{fmt(d.maxAgentes)}</td>
                          <td className="px-3 py-2 text-right text-xs" style={{ color: col }}>{nomCuello(cuello)}</td>
                          <td className="px-3 py-2 text-right mono" style={{ color: cumple ? C.ink : C.lat }}>{fmt(d.tpotCap, 1)} ms</td>
                          <td className="px-3 py-2 text-right mono">${fmt(d.costoCap, 2)}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {foco && (
            <div className="rounded border mt-4 p-4" style={{ borderColor: C.line, background: C.surface }}>
              <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
                <div className="text-xs uppercase" style={{ letterSpacing: "0.12em", fontFamily: "'IBM Plex Sans Condensed', sans-serif", fontWeight: 600 }}>
                  {foco.nombre} · {dim ? foco.G : Gfijo} GPU{(dim ? foco.G : Gfijo) > 1 ? "s" : ""}
                </div>
                <div className="text-xs" style={{ color: C.muted }}>pasa el cursor sobre otra GPU para comparar</div>
              </div>
              {dim ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Kpi k="Por sesión activa" v={`${fmt(foco.tokSesion, 1)} tok/s`} col={foco.tpot <= slo ? C.mem : C.lat} />
                  <Kpi k="Lote por GPU" v={`${fmt(foco.B, 1)} sesiones`} />
                  <Kpi k="Consumo usuarios" v={`${fmt(foco.tokH)} tok/s`} />
                  <Kpi k="Consumo agentes" v={`${fmt(foco.tokA)} tok/s`} />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Kpi k="Agentes fijados" v={fmt(Ua)} col={C.lat} />
                  <Kpi k="Usuarios que caben" v={foco.alcanza ? fmt(foco.capUsuarios) : "no alcanza"} col={foco.alcanza ? C.mem : C.lat} />
                  <Kpi k="Por sesión activa" v={`${fmt(1000 / foco.tpotCap, 1)} tok/s`} col={foco.tpotCap <= slo ? C.mem : C.lat} />
                  <Kpi k="Costo por agente" v={`$${fmt(foco.costoCap / Math.max(1, Ua), 2)}/h`} />
                </div>
              )}
              <div className="text-xs mt-3 leading-relaxed" style={{ color: C.muted }}>
                {dim
                  ? `Cada sesión del lote recibe un token por ciclo, así que usuarios y agentes generan a la misma velocidad. El ${fmt(r.pctSesAg)}% de las sesiones activas son agentes y se llevan esa misma fracción de la producción.`
                  : `Con ${Gfijo} unidades manda ${nomCuello(foco.limComp ? "comp" : foco.cuello)}. Cada agente que agregues cuesta ${fmt(r.kappa)} usuarios, así que la recta de la gráfica es el intercambio real entre ambos.`}
              </div>
            </div>
          )}

          <div className="text-xs mt-4 leading-relaxed" style={{ color: C.muted }}>
            {dim
              ? "Las barras muestran cuántas GPUs exige cada restricción por separado; la que domina define el total."
              : "Cada recta es una GPU: todos los puntos sobre ella saturan el sistema. No hay un óptimo único, es un intercambio — la pendiente es κ."}
            {" "}Si manda <span style={{ color: C.mem }}>memoria</span>, conviene más VRAM o recortar contexto;
            si manda <span style={{ color: C.lat }}>latencia</span>, conviene más ancho de banda;
            si manda <span style={{ color: C.comp }}>cómputo</span>, el lote saturó los Tensor Cores y solo ayuda un modelo más chico o más GPUs.
            Los precios por hora son editables y sirven como referencia, no como cotización.
          </div>
        </div>
      </div>
    </div>
  );
}
