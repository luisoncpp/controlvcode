import sys
import re
import os
from pathlib import Path

def aplicar_archivos_desde_markdown(ruta_md):
    ruta_archivo = Path(ruta_md)
    
    if not ruta_archivo.exists():
        print(f"Error: No se encontró el archivo '{ruta_md}'")
        return

    # Leemos el contenido del archivo Markdown
    with open(ruta_archivo, 'r', encoding='utf-8') as f:
        contenido = f.read()

    # Regex para capturar la ruta y el contenido del bloque <file>
    # Busca: <file ... path="ruta" ...> contenido </file>
    patron = re.compile(r'<file\s+[^>]*path="([^"]+)"[^>]*>\s*(.*?)\s*</file>', re.DOTALL)
    coincidencias = patron.findall(contenido)

    if not coincidencias:
        print("No se encontraron etiquetas <file> en el documento.")
        return

    print(f"Se encontraron {len(coincidencias)} archivos para procesar.\n")

    for ruta_destino_str, contenido_archivo in coincidencias:
        ruta_destino = Path(ruta_destino_str)
        print(f"-> Procesando: {ruta_destino}")
        
        # Crear todos los directorios padre si no existen
        ruta_destino.parent.mkdir(parents=True, exist_ok=True)
        
        # Escribir o reemplazar el archivo
        with open(ruta_destino, 'w', encoding='utf-8') as f:
            f.write(contenido_archivo)
            
        print(f"   [OK] Archivo guardado con éxito.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python bootstrap.py <ruta_al_archivo_markdown>")
        sys.exit(1)
        
    ruta_markdown = sys.argv[1]
    aplicar_archivos_desde_markdown(ruta_markdown)