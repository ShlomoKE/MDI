"""
Estima σ, la escala del paralelismo tensorial, a partir de mediciones reales.

σ es la fracción del ancho de banda agregado de un chasis que sobrevive a la
comunicación entre sus GPUs. No hay una constante física que dé su valor, así que
los de `motor.py` salen de aquí, para que cualquiera pueda rehacer el cálculo:

    python -m pip install pyarrow
    python scripts/estimar_sigma.py

Qué hace. El repositorio público ai-dynamo/aiconfigurator publica, por GPU, la
latencia que mide vLLM para un all-reduce de 8 GPUs (bf16, con grafos de CUDA)
según el tamaño del mensaje. En un paso de decodificación cada capa hace dos
all-reduce, y el mensaje mide lote × hidden elementos. Con un 70B en fp8 (80
capas, hidden 8192):

    t_mem  = Pm / (8 · BW · η)           lo que tarda leer los pesos
    t_comm = 2 · capas · t_allreduce     lo que cuesta comunicar las 8 GPUs
    σ      = t_mem / (t_mem + t_comm)

Es decir, σ es la parte del paso que NO se va en comunicación. Se promedia en
lotes de 32 a 128 —el rango de un servicio con carga— y se redondea a 0.05.

Lo que esto NO es. Es una estimación para UN modelo y UNA pila de software, con
la latencia de un all-reduce aislado y sin solapar con el cómputo. AMD e Intel no
tienen una medición equivalente ahí, y los servidores PCIe sin NVLink sí la
tienen pero salen tan mal con el lote (ver la última tabla) que σ deja de ser una
constante. Úsalo para acotar un orden de magnitud, no para fijar un decimal; si
mides tu motor sobre tu chasis, usa tu medición.
"""

from __future__ import annotations

import sys
import tempfile
import urllib.request
from pathlib import Path

try:
    import pyarrow.parquet as pq
except ImportError:
    sys.exit("Falta pyarrow: python -m pip install pyarrow")

BASE = (
    "https://raw.githubusercontent.com/ai-dynamo/aiconfigurator/main/"
    "aic-core/src/aiconfigurator_core/systems/data"
)

# (nombre, carpeta, versión de vLLM, ancho de banda por GPU en bytes/s)
GPUS = [
    ("H100", "h100_sxm", "0.24.0", 3.35e12),
    ("H200", "h200_sxm", "0.24.0", 4.80e12),
    ("B200", "b200_sxm", "0.24.0", 8.00e12),
    ("B300", "b300_sxm", "0.24.0", 8.00e12),
    ("L40S (PCIe)", "l40s", "0.22.0", 0.864e12),
]

# El modelo de referencia y la eficiencia que usa MDI por defecto.
PM, CAPAS, HIDDEN, ETA, N_GPUS = 70e9, 80, 8192, 0.5, 8
LOTES = (8, 16, 32, 64, 128, 256)
RANGO_PROMEDIO = (32, 64, 128)


def latencias(carpeta: str, version: str, destino: Path) -> dict[int, float]:
    """Latencia del all-reduce de 8 GPUs con grafos de CUDA, en µs, por tamaño de mensaje."""
    url = f"{BASE}/{carpeta}/comm/vllm/{version}/custom_allreduce_perf.parquet"
    ruta = destino / f"{carpeta}.parquet"
    urllib.request.urlretrieve(url, ruta)  # noqa: S310 — URL fija, https
    tabla = pq.read_table(ruta)
    col = {k: tabla.column(k).to_pylist() for k in tabla.column_names}
    return {
        col["message_size"][i]: col["latency"][i] * 1000  # ms → µs
        for i in range(tabla.num_rows)
        if col["num_gpus"][i] == N_GPUS and col["backend"][i] == "vllm_graph"
    }


def main() -> None:
    print(f"σ = t_mem / (t_mem + t_comm) · {PM / 1e9:.0f}B fp8, {CAPAS} capas, η = {ETA}\n")
    print(f"{'GPU':<13}{'t_mem ms':>9} |" + "".join(f"{'lote ' + str(b):>10}" for b in LOTES) + " | sugerido")
    print("-" * (24 + 10 * len(LOTES) + 12))
    with tempfile.TemporaryDirectory() as tmp:
        for nombre, carpeta, version, bw in GPUS:
            lat = latencias(carpeta, version, Path(tmp))
            t_mem = PM / (N_GPUS * bw * ETA) * 1000
            sigma = {
                b: t_mem / (t_mem + 2 * CAPAS * lat[b * HIDDEN] / 1000) for b in LOTES
            }
            medio = sum(sigma[b] for b in RANGO_PROMEDIO) / len(RANGO_PROMEDIO)
            sugerido = round(medio / 0.05) * 0.05
            print(
                f"{nombre:<13}{t_mem:>9.2f} |"
                + "".join(f"{sigma[b]:>10.2f}" for b in LOTES)
                + f" | {sugerido:>6.2f}"
            )
    print(
        "\nLa última fila es la razón de que los servidores PCIe no vengan en el catálogo: "
        "su σ se desploma con el lote."
    )


if __name__ == "__main__":
    main()
