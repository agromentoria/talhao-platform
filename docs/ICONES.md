# Ícones e ilustrações

Todos ficam em `client/public/icons/`. Para trocar um desenho, salve o novo
arquivo **com o mesmo nome** (SVG, de preferência quadrado ou 325×260 nos
isométricos) — não precisa mexer no código.

| Arquivo | Onde aparece |
|---|---|
| `icon_soja_meu_talhao.svg`, `icon_milho_…`, `icon_feijao_…`, `icon_arroz_…`, `icon_trigo_…`, `icon_algodao_…` | Saca de cada cultura (vitrine, armazém do investidor, pilha de sacas, certificado) |
| `icon_touro_meu_talhao.svg`, `icon_vaca_meu_talhao.svg` | Pecuária de corte e de leite |
| `icon_saca_meu_talhao.png` | Saca genérica (a do logo) — culturas sem desenho próprio e boas-vindas |
| `icon_saca_graos_meu_talhao.png` | Conquista **Primeira saca** |
| `icon_bag_meu_talhao.png` | Conquista **10 sacas** |
| `icon_armazem_meu_talhao.png` | Conquista **100 sacas** e boas-vindas ("Seu armazém no app") |
| `icon_cuidando_terra_meu_talhao.png` | Conquista **Acompanhou o plantio** |
| `icon_colhendo_meu_talhao.png` | Conquista **Primeira colheita** e boas-vindas ("Na colheita, você recebe") |
| `icon_produtor_meu_talhao.png` | Conquista **3 culturas** |
| `icon_produtor_fazenda_meu_talhao.png` | Conquista **Amigo do campo** |
| `icon_fazendas.png` | Fazendas (listas, conversas, avisos, perfil do talhão) |
| `icon_talhao_…`, `icon_plantando_…`, `icon_germinando_…`, `icon_talhoes_combate_…`, `icon_ponto_colheita_…`, `icon_talhoes_colhendo_…` | Fases da lavoura |

PNG com fundo transparente funciona bem: 326×260 para as cenas isométricas e
200×200 para as sacas. Para ficar nítido em telas de alta resolução, o ideal
é exportar no dobro (652×520 e 400×400) com o mesmo nome.

Os SVGs das sacas de cultura são pesados (soja ~390 KB, arroz ~680 KB); se o
designer exportar também em PNG, dá para trocar e deixar o app mais leve.
