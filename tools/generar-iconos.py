"""Genera los iconos de la app.

El dibujo son dos barras enfrentadas de distinta altura sobre el azul del
sistema: el marcador de los dos batalleros, que es de lo que va la app. Sin
texto y sin detalle fino, para que siga leyéndose a 40 px en la pantalla de
inicio.

    python tools/generar-iconos.py

Necesita Pillow. Sólo hay que volver a ejecutarlo si se cambia el diseño;
los PNG que produce van versionados en el repositorio.
"""

from pathlib import Path

from PIL import Image, ImageDraw

ICONOS = Path(__file__).resolve().parent.parent / "icons"

# Azul del sistema iOS, con un degradado vertical muy suave como el que llevan
# los iconos de Apple.
AZUL_ARRIBA = (10, 132, 255)
AZUL_ABAJO = (0, 98, 214)
BLANCO = (255, 255, 255)

# Se dibuja a este múltiplo del tamaño final y luego se reduce: es lo que da
# los bordes suaves, porque Pillow no antialiasea las formas al dibujarlas.
SUPERMUESTREO = 4

# Medidas en fracción del lado del icono.
ANCHO_BARRA = 0.155
HUECO = 0.10
BARRA_ALTA = 0.52
BARRA_BAJA = 0.32

# Lo que encoge el dibujo en la variante maskable, para que quepa entero
# dentro de la zona segura cuando el sistema lo recorta en círculo.
ENCOGIDO_MASKABLE = 0.72


def fondo_degradado(lado: int) -> Image.Image:
    imagen = Image.new("RGB", (lado, lado), AZUL_ARRIBA)
    dibujo = ImageDraw.Draw(imagen)

    for y in range(lado):
        avance = y / max(lado - 1, 1)
        color = tuple(
            round(arriba + (abajo - arriba) * avance)
            for arriba, abajo in zip(AZUL_ARRIBA, AZUL_ABAJO)
        )
        dibujo.line([(0, y), (lado, y)], fill=color)

    return imagen


def dibujar_barras(imagen: Image.Image, lado: int, encogido: float) -> None:
    dibujo = ImageDraw.Draw(imagen)

    ancho = lado * ANCHO_BARRA * encogido
    hueco = lado * HUECO * encogido
    alturas = (lado * BARRA_BAJA * encogido, lado * BARRA_ALTA * encogido)

    centro = lado / 2
    # Las dos barras se apoyan en la misma línea de base, como un marcador.
    base = centro + max(alturas) / 2
    izquierda = centro - (ancho * 2 + hueco) / 2

    for i, altura in enumerate(alturas):
        x0 = izquierda + i * (ancho + hueco)
        dibujo.rounded_rectangle(
            [(x0, base - altura), (x0 + ancho, base)],
            radius=ancho / 2,
            fill=BLANCO,
        )


def generar(lado: int, nombre: str, encogido: float = 1.0) -> Path:
    grande = lado * SUPERMUESTREO
    imagen = fondo_degradado(grande)
    dibujar_barras(imagen, grande, encogido)

    destino = ICONOS / nombre
    imagen.resize((lado, lado), Image.LANCZOS).save(destino, "PNG", optimize=True)
    return destino


def main() -> None:
    ICONOS.mkdir(parents=True, exist_ok=True)

    hechos = [
        generar(180, "icon-180.png"),  # apple-touch-icon
        generar(192, "icon-192.png"),
        generar(512, "icon-512.png"),
        generar(512, "icon-512-maskable.png", encogido=ENCOGIDO_MASKABLE),
    ]

    for icono in hechos:
        print(f"{icono.relative_to(ICONOS.parent)}  {icono.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
