"""
Genera src/lib/referencia.json a partir de motor.py.

motor.py es la fuente de verdad de la matemática; este script congela su salida
para un conjunto de escenarios y motor.test.ts la compara contra el puerto de
TypeScript. Si cambias una fórmula en motor.py, vuelve a correr:

    python scripts/generar_referencia.py

Los flotantes se serializan con repr() para no perder ni un bit al pasar por JSON.
"""

from __future__ import annotations

import json
import math
import sys
from dataclasses import asdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from motor import (  # noqa: E402
    GPUS,
    MODELOS,
    Carga,
    Poblacion,
    capacidad,
    cruces,
    dimensionar,
    techos,
    techos_absolutos,
)

DESTINO = RAIZ / "src" / "lib" / "referencia.json"


def limpiar(v):
    """inf y nan no existen en JSON estricto; se pasan como cadenas centinela."""
    if isinstance(v, float):
        if math.isinf(v):
            return "Infinity" if v > 0 else "-Infinity"
        if math.isnan(v):
            return "NaN"
    if isinstance(v, dict):
        return {k: limpiar(x) for k, x in v.items()}
    if isinstance(v, list):
        return [limpiar(x) for x in v]
    return v


def modelo_json(m):
    d = asdict(m)
    d.update({"Pm": m.Pm, "KVt": m.KVt, "b_w": m.b_w, "b_kv": m.b_kv})
    return limpiar(d)


def gpu_json(g):
    d = asdict(g)
    d.update({"Vt": g.Vt, "W": g.W, "F": g.F})
    return limpiar(d)


def carga_json(c):
    return limpiar(
        {
            "humanos": asdict(c.humanos),
            "agentes": asdict(c.agentes),
            "slo_ms": c.slo_ms,
            "overhead_gb": c.overhead_gb,
            "activas": c.activas,
            "kappa": c.kappa,
        }
    )


# --------------------------------------------------------------------------- #
# Escenarios
# --------------------------------------------------------------------------- #

def escenarios():
    """Cada escenario es (id, modelo, carga, G para el modo capacidad)."""
    base = Carga(
        humanos=Poblacion(U=2000, D=0.15, C=3000),
        agentes=Poblacion(U=40, D=0.95, C=30000),
        slo_ms=30,
    )
    yield "demo", MODELOS[0], base, 12

    # el mismo modelo con contextos crecientes: el cuello debe migrar
    for ctx in (500, 2000, 8000, 32000, 128000):
        yield (
            f"contexto-{ctx}",
            MODELOS[0],
            Carga(
                humanos=Poblacion(U=2000, D=0.15, C=ctx),
                agentes=Poblacion(U=40, D=0.95, C=ctx),
                slo_ms=30,
            ),
            8,
        )

    # SLO holgado y SLO agresivo
    for slo in (10, 20, 50, 100, 250):
        yield (
            f"slo-{slo}",
            MODELOS[1],
            Carga(
                humanos=Poblacion(U=1200, D=0.15, C=4000),
                agentes=Poblacion(U=25, D=0.95, C=20000),
                slo_ms=slo,
            ),
            16,
        )

    # cada modelo del catálogo contra la carga base
    for i, m in enumerate(MODELOS):
        yield f"modelo-{i}", m, base, 12

    # cuantizaciones
    for qw, qkv in (("fp16", "fp16"), ("fp8", "int4"), ("int4", "int4"), ("bf16", "fp8")):
        m = MODELOS[1]
        variante = type(m)(
            nombre=f"{m.nombre} {qw}/{qkv}",
            N=m.N,
            capas_atn=m.capas_atn,
            kv_heads=m.kv_heads,
            head_dim=m.head_dim,
            quant_pesos=qw,
            quant_cache=qkv,
        )
        yield f"quant-{qw}-{qkv}", variante, base, 12

    # cargas degeneradas: sin agentes, sin humanos, contexto cero
    yield (
        "sin-agentes",
        MODELOS[0],
        Carga(humanos=Poblacion(2000, 0.15, 3000), agentes=Poblacion(0, 0.95, 30000), slo_ms=30),
        6,
    )
    yield (
        "sin-humanos",
        MODELOS[0],
        Carga(humanos=Poblacion(0, 0.15, 3000), agentes=Poblacion(40, 0.95, 30000), slo_ms=30),
        6,
    )
    yield (
        "contexto-cero",
        MODELOS[2],
        Carga(humanos=Poblacion(1, 1.0, 0), agentes=Poblacion(0, 0.0, 0), slo_ms=1000),
        1,
    )
    yield (
        "carga-minima",
        MODELOS[3],
        Carga(humanos=Poblacion(1, 1.0, 1), agentes=Poblacion(0, 0.0, 0), slo_ms=1000),
        1,
    )
    # overhead que deja sin espacio y SLO imposible
    yield (
        "overhead-enorme",
        MODELOS[2],
        Carga(humanos=Poblacion(100, 0.2, 4000), agentes=Poblacion(5, 0.9, 20000), slo_ms=30, overhead_gb=60),
        4,
    )
    yield (
        "slo-imposible",
        MODELOS[2],
        Carga(humanos=Poblacion(100, 0.2, 4000), agentes=Poblacion(5, 0.9, 20000), slo_ms=1),
        4,
    )
    # eficiencias distintas se cubren abajo, sobre las GPUs


def main() -> None:
    gpus = list(GPUS)
    # variantes de eficiencia sobre una GPU conocida, para cubrir el factor eff
    plantilla = GPUS[0]
    for eff in (0.3, 0.7, 1.0):
        gpus.append(
            type(plantilla)(
                nombre=f"{plantilla.nombre} eff={eff}",
                vram_gb=plantilla.vram_gb,
                bw_gbs=plantilla.bw_gbs,
                tflops=plantilla.tflops,
                precio_hora=plantilla.precio_hora,
                eff=eff,
            )
        )

    casos = []
    for cid, m, c, G in escenarios():
        for g in gpus:
            casos.append(
                {
                    "id": f"{cid}::{g.nombre}",
                    "modelo": modelo_json(m),
                    "gpu": gpu_json(g),
                    "carga": carga_json(c),
                    "G": G,
                    "techos": limpiar(asdict(techos(m, g, c))),
                    "dimensionar": limpiar(asdict(dimensionar(m, g, c))),
                    "capacidad": limpiar(asdict(capacidad(m, g, c, G))),
                    "cruces": limpiar(cruces(m, g, c)),
                    "techos_absolutos": limpiar(
                        techos_absolutos(m, g, c.humanos.C if c.humanos.C else 1)
                    ),
                }
            )

    salida = {
        "_nota": "Generado por scripts/generar_referencia.py. No editar a mano.",
        "GB": 1024 ** 3,
        "casos": casos,
    }
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(casos)} casos escritos en {DESTINO.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
