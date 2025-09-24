# Revised `tagging_rules` for Client Configuration

Here is the complete, revised `tagging_rules` JSON. This merges the existing feature tags with the new, more specific intent rules, and adds the new `feature:bathroom` dictionary rule.

Please copy the JSON block below and use it to update the `tagging_rules` column in your `clients` table in Supabase.

```json
{
  "desc:vistas": [
    "vistas panorâmicas",
    "vistas para a cidade",
    "vistas para o oceano",
    "vistas para a montanha",
    "paisagem cénica",
    "vistas deslumbrantes"
  ],
  "tipo:moradia": [
    "moradia",
    "casa unifamiliar",
    "residência"
  ],
  "feature:suite": [
    "suíte",
    "suite"
  ],
  "feature:bathroom": [
    "casa de banho",
    "quarto de banho",
    "wc",
    "banheiro"
  ],
  "estilo:artesao": [
    "artesão",
    "estilo artesão"
  ],
  "estilo:colonial": [
    "colonial",
    "revivalismo colonial"
  ],
  "comodidade:vinha": [
    "vinha",
    "adega",
    "quinta com vinhas"
  ],
  "estilo:vitoriano": [
    "vitoriano",
    "casa da era vitoriana",
    "arquitetura vitoriana",
    "estilo rainha ana"
  ],
  "material:granito": [
    "bancadas de granito",
    "laje de granito"
  ],
  "material:madeira": [
    "chão de madeira",
    "pavimento de madeira",
    "chão de mogno rico",
    "madeira reluzente"
  ],
  "material:marmore": [
    "bancadas de mármore",
    "chão de mármore",
    "mármore carrara",
    "mármore calacatta",
    "mármore estatuário"
  ],
  "material:quartzo": [
    "bancadas de quartzo",
    "pedra de quartzo"
  ],
  "tipo:apartamento": [
    "apartamento",
    "condomínio",
    "flat"
  ],
  "comodidade:arrumos": [
    "arrumos",
    "arrecadação"
  ],
  "comodidade:garagem": [
    "garagem para dois carros",
    "garagem para três carros",
    "garagem grande",
    "garagem espaçosa"
  ],
  "comodidade:ginasio": [
    "ginásio em casa",
    "sala de fitness",
    "ginásio privado",
    "estúdio de fitness",
    "sala de exercício"
  ],
  "comodidade:jacuzzi": [
    "jacuzzi",
    "banheira de hidromassagem",
    "spa",
    "hidromassagem"
  ],
  "comodidade:lareira": [
    "lareira",
    "lareira a lenha",
    "lareira a gás",
    "lareira dupla face",
    "lareira acolhedora",
    "recuperador de calor",
    "pellets"
  ],
  "comodidade:terraco": [
    "terraço",
    "terraço de 92.41 m²",
    "terraço espaçoso"
  ],
  "comodidade:elevador": [
    "elevador privado",
    "elevador residencial"
  ],
  "tipo:imovel_de_luxo": [
    "imóvel de luxo",
    "propriedade exclusiva",
    "mansão",
    "castelo",
    "quinta"
  ],
  "estilo:casa_de_campo": [
    "casa de campo",
    "casa de campo moderna",
    "casa de campo rústica"
  ],
  "estilo:contemporaneo": [
    "contemporâneo",
    "minimalista moderno",
    "contemporâneo elegante",
    "design de vanguarda"
  ],
  "estilo:mediterranico": [
    "mediterrânico",
    "vila mediterranica"
  ],
  "comodidade:garrafeira": [
    "garrafeira",
    "adega",
    "sala de vinhos",
    "coleção de vinhos",
    "adega de sommelier"
  ],
  "desc:pronto_a_habitar": [
    "pronto a habitar",
    "pronto para entrar",
    "recém-renovado",
    "totalmente atualizado"
  ],
  "tipo:moradia_geminada": [
    "moradia geminada",
    "casa em banda",
    "moradia em banda"
  ],
  "comodidade:luz_natural": [
    "abundante luz natural",
    "luz natural"
  ],
  "desc:condominio_fechado": [
    "condomínio fechado",
    "entrada fechada",
    "propriedade fechada e segura"
  ],
  "comodidade:vidros_duplos": [
    "vidros duplos",
    "dupla vidraça"
  ],
  "comodidade:sala_de_cinema": [
    "sala de cinema",
    "cinema em casa",
    "sala de projeção",
    "cinema privado"
  ],
  "localizacao:centro_cidade": [
    "centro da cidade",
    "coração da cidade",
    "zona urbana"
  ],
  "comodidade:a_beira_da_agua": [
    "à beira-mar",
    "à beira do lago",
    "na linha da frente do oceano",
    "junto ao rio",
    "na praia"
  ],
  "comodidade:piscina_privada": [
    "piscina privada",
    "piscina infinita",
    "piscina estreita",
    "piscina gruta",
    "piscina de imersão",
    "piscina iluminada pelo sol",
    "piscina cintilante"
  ],
  "estilo:seculo_meio_moderno": [
    "meio do século moderno",
    "design do meio do século"
  ],
  "localizacao:acessivel_a_pe": [
    "bairro acessível a pé",
    "perto de comodidades",
    "localização conveniente"
  ],
  "localizacao:beco_sem_saida": [
    "beco sem saída",
    "rua sem saída"
  ],
  "comodidade:campo_desportivo": [
    "campo de ténis",
    "campo de basquetebol",
    "campo de pickleball",
    "campo desportivo"
  ],
  "comodidade:casa_inteligente": [
    "casa inteligente",
    "casa automatizada",
    "sistema inteligente integrado"
  ],
  "comodidade:cozinha_equipada": [
    "cozinha equipada",
    "cozinha com eletrodomésticos"
  ],
  "comodidade:cozinha_exterior": [
    "cozinha exterior",
    "churrasqueira",
    "área de churrasco"
  ],
  "localizacao:a_beira_da_agua": [
    "à beira-mar",
    "à beira do lago",
    "na linha da frente do oceano",
    "junto ao rio",
    "na praia"
  ],
  "caracteristica:espaco_aberto": [
    "espaço em conceito aberto",
    "layout fluído",
    "planta de piso aberto",
    "espaço aberto e arejado"
  ],
  "caracteristica:feita_a_medida": [
    "feita à medida",
    "personalizada",
    "desenhada à medida",
    "única",
    "trabalho artesanal"
  ],
  "caracteristica:pe_direito_alto": [
    "pé-direito alto",
    "tetos abobadados",
    "tetos com vigas",
    "tetos com altura dupla"
  ],
  "caracteristica:janelas_do_chao_ao_teto": [
    "janelas do chão ao teto",
    "janelões",
    "parede de vidro"
  ],
  "intent:query_bedroom_area": {
    "keywords": [
      "tamanho do quarto",
      "área do quarto",
      "area do quarto",
      "metros quadrados do quarto",
      "dimensões do quarto",
      "dimensoes do quarto"
    ],
    "prompt_instruction": "INSTRUÇÃO CRÍTICA E OBRIGATÓRIA: O utilizador está perguntando especificamente sobre o tamanho/área do quarto. DEVE procurar no contexto fornecido informações sobre a área do quarto (normalmente em m² ou metros quadrados) e INCLUIR EXPLICITAMENTE essas medidas na sua resposta. Se encontrar múltiplas referências, apresente TODAS as informações relevantes. NÃO diga que a informação não está disponível se ela estiver presente no contexto."
  },
  "intent:query_terrace_area": {
    "keywords": [
      "área do terraço",
      "area do terraço",
      "area do terraco",
      "metros quadrados do terraço",
      "tamanho do terraço",
      "dimensões do terraço",
      "dimensoes do terraço"
    ],
    "prompt_instruction": "INSTRUÇÃO CRÍTICA E OBRIGATÓRIA: O utilizador está perguntando especificamente sobre o tamanho/área do terraço. DEVE procurar no contexto fornecido informações sobre a área do terraço (normalmente em m² ou metros quadrados) e INCLUIR EXPLICITAMENTE essas medidas na sua resposta. Se encontrar múltiplas referências, apresente TODAS as informações relevantes. NÃO diga que a informação não está disponível se ela estiver presente no contexto."
  },
  "intent:query_bathroom_area": {
    "keywords": [
      "tamanho da casa de banho",
      "área da casa de banho",
      "area da casa de banho",
      "metros quadrados da casa de banho",
      "dimensões da casa de banho",
      "dimensoes da casa de banho",
      "tamanho do quarto de banho",
      "área do quarto de banho",
      "area do quarto de banho",
      "metros quadrados do quarto de banho",
      "dimensões do quarto de banho",
      "dimensoes do quarto de banho",
      "tamanho do wc",
      "área do wc",
      "area do wc",
      "metros quadrados do wc"
    ],
    "prompt_instruction": "INSTRUÇÃO CRÍTICA E OBRIGATÓRIA: O utilizador está perguntando especificamente sobre o tamanho/área da casa de banho. DEVE procurar no contexto fornecido informações sobre a área da casa de banho (normalmente em m² ou metros quadrados) e INCLUIR EXPLICITAMENTE essas medidas na sua resposta. Se encontrar múltiplas referências, apresente TODAS as informações relevantes. NÃO diga que a informação não está disponível se ela estiver presente no contexto."
  },
  "intent:query_living_kitchen_area": {
    "keywords": [
      "dimensões da sala",
      "dimensoes da sala",
      "área da sala",
      "area da sala",
      "metros quadrados da sala",
      "tamanho da sala"
    ],
    "prompt_instruction": "INSTRUÇÃO CRÍTICA E OBRIGATÓRIA: O utilizador está perguntando especificamente sobre o tamanho/área da sala/cozinha. DEVE procurar no contexto fornecido informações sobre a área da sala ou cozinha (normalmente em m² ou metros quadrados) e INCLUIR EXPLICITAMENTE essas medidas na sua resposta. Se encontrar múltiplas referências, apresente TODAS as informações relevantes. NÃO diga que a informação não está disponível se ela estiver presente no contexto."
  }
}