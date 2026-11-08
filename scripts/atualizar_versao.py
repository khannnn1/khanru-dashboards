"""Atualiza o ?v=AAAAMMDDHHMM dos arquivos CSS/JS em todas as páginas.

Rodar antes de publicar: python scripts/atualizar_versao.py
Assim o navegador baixa os arquivos novos em vez de usar a cópia guardada.
"""
import datetime
import glob
import re

versao = datetime.datetime.now().strftime("%Y%m%d%H%M")
for arquivo in glob.glob("*.html"):
    with open(arquivo, encoding="utf-8") as f:
        texto = f.read()
    texto = re.sub(r'(href="css/[a-z-]+\.css)(\?v=\d+)?"', rf'\1?v={versao}"', texto)
    texto = re.sub(r'(src="js/[a-z-]+\.js)(\?v=\d+)?"', rf'\1?v={versao}"', texto)
    with open(arquivo, "w", encoding="utf-8") as f:
        f.write(texto)
print(f"Versão {versao} aplicada.")
