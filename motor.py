"""
Motor de dimensionamiento de inferencia LLM.

Implementa las ecuaciones del documento:
  - TPOT con lote y las tres restricciones (memoria, latencia, cómputo)
  - Modo dimensionar: dada la carga, cuántas GPUs hacen falta
  - Modo capacidad:   dado el hardware, para cuánta carga alcanza
  - Cruces de régimen (Ceq1, Ceq2, Ceq3)

Todas las unidades internas son SI: bytes, bytes/s, FLOP/s, segundos.
Las funciones de entrada aceptan unidades cómodas (GB, GB/s, TFLOPS, ms).

La unidad de cómputo que se compra y se replica es una GPU suelta o un chasis
completo de n GPUs (ver `GPU`). Las ecuaciones son las mismas para las dos: el
chasis solo cambia los parámetros con que se alimentan.
"""

from __future__ import annotations
from dataclasses import dataclass, field, replace
from math import ceil, inf

GB = 1024 ** 3

# bytes por parámetro según cuantización
QUANT = {"fp32": 4.0, "fp16": 2.0, "bf16": 2.0, "fp8": 1.0, "int4": 0.5}


# --------------------------------------------------------------------------- #
# Entradas
# --------------------------------------------------------------------------- #

@dataclass
class Modelo:
    """Arquitectura del LLM. Los valores salen del config.json en HuggingFace."""
    nombre: str
    N: float                 # parámetros, en miles de millones
    capas_atn: int           # Lₐ — capas que generan KV cache (no las totales)
    kv_heads: int            # H
    head_dim: int            # dₖ
    quant_pesos: str = "fp8"
    quant_cache: str = "fp8"

    @property
    def b_w(self) -> float:
        return QUANT[self.quant_pesos]

    @property
    def b_kv(self) -> float:
        return QUANT[self.quant_cache]

    @property
    def Pm(self) -> float:
        """Pₘ — tamaño del modelo en bytes."""
        return self.N * 1e9 * self.b_w

    @property
    def KVt(self) -> float:
        """KVₜ — bytes de caché por token de contexto.  2·Lₐ·H·dₖ·b"""
        return 2 * self.capas_atn * self.kv_heads * self.head_dim * self.b_kv


@dataclass
class GPU:
    """
    Hardware: la unidad que se compra y se replica. `eff` descuenta el ancho de
    banda y los FLOPS nominales.

    Una unidad es una GPU suelta (n=1) o un chasis completo (n>1): n GPUs que
    sirven UNA réplica del modelo con paralelismo tensorial, así que los pesos y
    el caché se reparten entre las n. Las ecuaciones no cambian; cambian los
    parámetros con que se alimentan:

        Vt = n·V      W = n·σ·η·BW      F = n·σ·η·TFLOPS      O_total = n·O

    `vram_gb`, `bw_gbs` y `tflops` son POR GPU, tal como los publica el
    fabricante. `precio_hora` es el de la unidad COMPLETA.
    """
    nombre: str
    vram_gb: float           # por GPU
    bw_gbs: float            # ancho de banda nominal, por GPU
    tflops: float            # FLOPS pico en la precisión de cómputo, por GPU
    precio_hora: float       # USD/h de la unidad — CAPEX amortizado + OPEX
    eff: float = 0.5         # ver nota sobre eficiencia al final
    n: int = 1               # GPUs que forman la unidad; >1 es un chasis
    escala: float = 1.0      # σ — qué fracción del ancho de banda y los FLOPS
                             # agregados sobrevive a la comunicación entre las n

    @property
    def Vt(self) -> float:
        """VRAM total de la unidad, bytes."""
        return self.n * self.vram_gb * GB

    @property
    def W(self) -> float:
        """Ancho de banda efectivo de la unidad, bytes/s."""
        return self.n * self.bw_gbs * 1e9 * self.eff * self.escala

    @property
    def F(self) -> float:
        """FLOPS efectivos de la unidad."""
        return self.n * self.tflops * 1e12 * self.eff * self.escala


def modelo_en(m: Modelo, g: GPU) -> Modelo:
    """
    El modelo tal como queda guardado en la unidad.

    Con paralelismo tensorial de n vías y menos de n cabezas de KV, el motor de
    inferencia no puede partir una cabeza: la replica en n/H GPUs, y el caché
    por token se multiplica por n/H. Es lo mismo que tener max(H, n) cabezas,
    que es como se expresa aquí para no tocar KVₜ. Con una GPU suelta, o con
    H ≥ n, el modelo queda tal cual.
    """
    if g.n > 1 and 0 < m.kv_heads < g.n:
        return replace(m, kv_heads=g.n)
    return m


@dataclass
class Poblacion:
    """Un perfil de uso: cuántos hay, qué tan activos están y cuánto contexto usan."""
    U: float                 # número de sesiones registradas
    D: float                 # duty cycle — fracción de tiempo generando
    C: float                 # contexto promedio en operación, en tokens

    @property
    def activas(self) -> float:
        """Sesiones generando en un instante cualquiera."""
        return self.U * self.D


@dataclass
class Carga:
    humanos: Poblacion
    agentes: Poblacion
    slo_ms: float = 30.0     # TPOT máximo aceptable
    overhead_gb: float = 4.0 # O — memoria del motor de inferencia

    @property
    def slo(self) -> float:
        return self.slo_ms / 1000.0

    @property
    def activas(self) -> float:
        return self.humanos.activas + self.agentes.activas

    def bytes_cache(self, m: Modelo) -> float:
        """Bytes de KV cache que demanda toda la carga activa."""
        return m.KVt * (self.humanos.activas * self.humanos.C
                        + self.agentes.activas * self.agentes.C)

    @property
    def kappa(self) -> float:
        """κ — cuántos usuarios equivale un agente."""
        den = self.humanos.D * self.humanos.C
        return (self.agentes.D * self.agentes.C) / den if den else inf


# --------------------------------------------------------------------------- #
# Techos: los tres límites de una GPU
# --------------------------------------------------------------------------- #

@dataclass
class Techos:
    memoria: float           # bytes de caché que permite la VRAM
    latencia: float          # bytes de caché que permite el SLO
    computo: float           # secuencias que permite el cálculo (B_comp)
    viable: bool
    motivo: str = ""


def techos(m: Modelo, g: GPU, c: Carga) -> Techos:
    # El overhead del motor (grafos de CUDA, buffers, fragmentación) es por GPU:
    # una unidad de n GPUs paga n veces.
    t_mem = g.Vt - m.Pm - c.overhead_gb * g.n * GB
    t_lat = c.slo * g.W - m.Pm
    b_comp = (c.slo * g.F) / (2 * m.N * 1e9)

    if t_mem <= 0:
        return Techos(t_mem, t_lat, b_comp, False,
                      f"{m.nombre} no cabe en {g.nombre}")
    if t_lat <= 0:
        return Techos(t_mem, t_lat, b_comp, False,
                      f"SLO de {c.slo_ms:g} ms inalcanzable en {g.nombre}")
    return Techos(t_mem, t_lat, b_comp, True)


# --------------------------------------------------------------------------- #
# Modo 1 — dimensionar: dada la carga, ¿cuántas GPUs?
# --------------------------------------------------------------------------- #

@dataclass
class Dimensionamiento:
    gpu: str
    viable: bool
    motivo: str = ""
    G: int = 0
    cuello: str = ""         # "memoria" | "latencia" | "computo"
    G_mem: float = 0.0
    G_lat: float = 0.0
    G_comp: float = 0.0
    B: float = 0.0           # lote resultante por unidad (GPU o chasis)
    tpot_ms: float = 0.0
    tok_s_sesion: float = 0.0
    throughput: float = 0.0  # tokens/s del sistema completo
    costo_hora: float = 0.0
    cumple_slo: bool = False


def dimensionar(m: Modelo, g: GPU, c: Carga) -> Dimensionamiento:
    t = techos(m, g, c)
    if not t.viable:
        return Dimensionamiento(g.nombre, False, t.motivo)

    m = modelo_en(m, g)
    bc = c.bytes_cache(m)
    G_mem = bc / t.memoria
    G_lat = bc / t.latencia
    G_comp = c.activas / t.computo if t.computo > 0 else inf

    G = max(1, ceil(max(G_mem, G_lat, G_comp)))
    cuello = max((G_mem, "memoria"), (G_lat, "latencia"), (G_comp, "computo"))[1]

    B = c.activas / G
    t_mem = (m.Pm + bc / G) / g.W
    t_cmp = (2 * m.N * 1e9 * B) / g.F
    tpot = max(t_mem, t_cmp)

    return Dimensionamiento(
        gpu=g.nombre, viable=True, G=G, cuello=cuello,
        G_mem=G_mem, G_lat=G_lat, G_comp=G_comp, B=B,
        tpot_ms=tpot * 1000, tok_s_sesion=1 / tpot,
        throughput=c.activas / tpot, costo_hora=G * g.precio_hora,
        cumple_slo=tpot <= c.slo,
    )


# --------------------------------------------------------------------------- #
# Modo 2 — capacidad: dado el hardware y los agentes, ¿cuántos usuarios?
# --------------------------------------------------------------------------- #

@dataclass
class Capacidad:
    gpu: str
    viable: bool
    motivo: str = ""
    G: int = 0
    usuarios: float = 0.0    # humanos que caben además de los agentes
    agentes: float = 0.0     # los que se fijaron
    max_solo_agentes: float = 0.0
    cuello: str = ""
    B: float = 0.0
    tpot_ms: float = 0.0
    throughput: float = 0.0
    costo_hora: float = 0.0
    alcanza: bool = True


def capacidad(m: Modelo, g: GPU, c: Carga, G: int) -> Capacidad:
    """Fija G y el número de agentes; devuelve cuántos humanos caben además."""
    t = techos(m, g, c)
    if not t.viable:
        return Capacidad(g.nombre, False, t.motivo)

    m = modelo_en(m, g)
    h, a = c.humanos, c.agentes
    por_agente = m.KVt * a.D * a.C          # bytes por agente registrado
    por_usuario = m.KVt * h.D * h.C         # bytes por usuario registrado
    usado_ag = a.U * por_agente

    techo_bytes = G * min(t.memoria, t.latencia)
    lim_bytes = "memoria" if t.memoria <= t.latencia else "latencia"

    if usado_ag > techo_bytes or a.U * a.D > G * t.computo:
        return Capacidad(g.nombre, True, "los agentes solos no caben",
                         G=G, agentes=a.U, alcanza=False,
                         costo_hora=G * g.precio_hora)

    u_bytes = (techo_bytes - usado_ag) / por_usuario if por_usuario else inf
    u_comp = (G * t.computo - a.U * a.D) / h.D if h.D else inf
    usuarios = min(u_bytes, u_comp)
    cuello = "computo" if u_comp < u_bytes else lim_bytes

    bc = m.KVt * (usuarios * h.D * h.C + a.U * a.D * a.C)
    B = (usuarios * h.D + a.U * a.D) / G
    tpot = max((m.Pm + bc / G) / g.W, (2 * m.N * 1e9 * B) / g.F)

    return Capacidad(
        gpu=g.nombre, viable=True, G=G, usuarios=usuarios, agentes=a.U,
        max_solo_agentes=techo_bytes / por_agente if por_agente else inf,
        cuello=cuello, B=B, tpot_ms=tpot * 1000,
        throughput=(usuarios * h.D + a.U * a.D) / tpot,
        costo_hora=G * g.precio_hora,
    )


# --------------------------------------------------------------------------- #
# Cruces de régimen — en qué contexto cambia el cuello de botella
# --------------------------------------------------------------------------- #

def cruces(m: Modelo, g: GPU, c: Carga) -> dict[str, float]:
    """
    Contextos donde se cruzan los pares de restricciones.
    Suponen una sola población; con carga mixta aplica el contexto promedio.
    """
    t = techos(m, g, c)
    m = modelo_en(m, g)
    den = c.slo * g.F * m.KVt
    return {
        "Ceq1_computo_latencia": (t.latencia * 2 * m.N * 1e9) / den if den else inf,
        "Ceq3_computo_memoria": (t.memoria * 2 * m.N * 1e9) / den if den else inf,
        # Ceq2 depende de B_max, que a su vez depende del contexto:
        # el cruce memoria/latencia es directo, ambos techos acotan bytes.
        "regimen": "memoria" if t.memoria <= t.latencia else "latencia",
    }


def techos_absolutos(m: Modelo, g: GPU, contexto: float) -> dict[str, float]:
    """Tokens/s máximos del sistema, sin importar cuántas sesiones se agreguen."""
    m = modelo_en(m, g)
    return {
        "por_memoria": g.W / (m.KVt * contexto),
        "por_computo": g.F / (2 * m.N * 1e9),
    }


# --------------------------------------------------------------------------- #
# Catálogos de referencia
# --------------------------------------------------------------------------- #

GPUS = [
    GPU("H100 SXM",     80,  3350, 1979, 2.60),
    GPU("H100 PCIe",    80,  2000, 1513, 2.10),
    GPU("H200 SXM",    141,  4800, 1979, 3.70),
    GPU("A100 80GB",    80,  2039,  624, 1.60),
    GPU("L40S",         48,   864,  733, 1.00),
    GPU("RTX 6000 Ada", 48,   960,  728, 0.90),
    GPU("DGX Spark",   128,   273,  250, 0.20),
]

# Chasis completos: n GPUs que sirven una réplica con paralelismo tensorial.
#
# `vram_gb`, `bw_gbs` y `tflops` son POR GPU, como los publica el fabricante
# (FLOPS pico DENSOS de 8 bits, igual que en GPUS). El precio es el del chasis
# entero. De dónde sale cada precio por hora —lista, consumo y fuente— está en
# `src/lib/catalogos.ts`, y una prueba exige que ahí y aquí digan lo mismo.
#
# σ (`escala`) es un supuesto, no una medición. Los de NVIDIA se estiman con las
# latencias de all-reduce que mide vLLM y publica el repositorio aiconfigurator
# (ai-dynamo): `python scripts/estimar_sigma.py` rehace el cálculo y da 0.70 en
# H100, 0.60 en H200, 0.40 en B200 y 0.35 en B300 —las GPUs más rápidas pierden
# más, porque la latencia del all-reduce no baja con el ancho de banda—. AMD no
# tiene una medición equivalente: se supone 0.40, como la peor de las medidas.
CHASIS = [
    GPU("DGX H100",    80, 3350, 1979, 19.98, n=8, escala=0.70),
    GPU("DGX H200",   141, 4800, 1979, 28.64, n=8, escala=0.60),
    GPU("DGX B200",   180, 8000, 4500, 31.90, n=8, escala=0.40),
    GPU("DGX B300",   288, 8000, 4500, 34.03, n=8, escala=0.35),
    GPU("MI300X x8",  192, 5300, 2615, 14.77, n=8, escala=0.40),
]

MODELOS = [
    Modelo("Qwen3.5-27B (híbrido)", 27, capas_atn=16, kv_heads=4,  head_dim=256),
    Modelo("Denso 27B",             27, capas_atn=46, kv_heads=8,  head_dim=128),
    Modelo("Denso 70B",             70, capas_atn=80, kv_heads=8,  head_dim=128),
    Modelo("Denso 8B",               8, capas_atn=32, kv_heads=8,  head_dim=128),
]


# --------------------------------------------------------------------------- #
# Demo
# --------------------------------------------------------------------------- #

if __name__ == "__main__":
    modelo = MODELOS[0]
    carga = Carga(
        humanos=Poblacion(U=2000, D=0.15, C=3000),
        agentes=Poblacion(U=40,   D=0.95, C=30000),
        slo_ms=30,
    )

    print(f"Modelo: {modelo.nombre}")
    print(f"  Pesos:        {modelo.Pm/GB:.1f} GB")
    print(f"  KV por token: {modelo.KVt/1024:.0f} KB")
    print(f"  κ:            {carga.kappa:.0f} usuarios por agente")
    print(f"  Sesiones activas: {carga.activas:.0f}\n")

    def tabla_dimensionar(titulo: str, unidades: list[GPU]) -> None:
        print(f"{titulo:<16}{'G':>4}{'cuello':>11}{'TPOT':>10}{'tok/s':>8}{'USD/h':>9}")
        print("-" * 58)
        for g in unidades:
            d = dimensionar(modelo, g, carga)
            if not d.viable:
                print(f"{g.nombre:<16}  {d.motivo}")
                continue
            print(f"{d.gpu:<16}{d.G:>4}{d.cuello:>11}"
                  f"{d.tpot_ms:>9.1f}m{d.tok_s_sesion:>8.1f}{d.costo_hora:>9.2f}")

    tabla_dimensionar("GPU", GPUS)

    # Un chasis es una unidad de n GPUs con paralelismo tensorial: G cuenta chasis
    # y la columna USD/h es el costo de los chasis completos.
    print("\nChasis completos (n GPUs con paralelismo tensorial; G cuenta chasis):")
    tabla_dimensionar("Chasis", CHASIS)

    print(f"\nCapacidad con 12 unidades y {carga.agentes.U:.0f} agentes fijos:")
    print(f"{'GPU':<16}{'usuarios':>10}{'cuello':>11}{'TPOT':>10}{'USD/h':>9}")
    print("-" * 56)
    for g in GPUS:
        c2 = capacidad(modelo, g, carga, G=12)
        if not c2.viable:
            print(f"{g.nombre:<16}  {c2.motivo}")
        elif not c2.alcanza:
            print(f"{c2.gpu:<16}{'no alcanza':>10}")
        else:
            print(f"{c2.gpu:<16}{c2.usuarios:>10.0f}{c2.cuello:>11}"
                  f"{c2.tpot_ms:>9.1f}m{c2.costo_hora:>9.2f}")
